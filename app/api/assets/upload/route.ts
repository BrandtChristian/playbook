import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WIDTH = 1200;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (user.role !== "admin" && user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folderId = formData.get("folderId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum 10MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalSize = buffer.length;

  // Optimize with sharp
  const isPng = file.type === "image/png";
  let processed: Buffer;
  let outputWidth: number;
  let outputHeight: number;

  if (isPng) {
    const result = sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .png({ quality: 85, compressionLevel: 9 });
    const info = await result.toBuffer({ resolveWithObject: true });
    processed = info.data;
    outputWidth = info.info.width;
    outputHeight = info.info.height;
  } else {
    const result = sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true });
    const info = await result.toBuffer({ resolveWithObject: true });
    processed = info.data;
    outputWidth = info.info.width;
    outputHeight = info.info.height;
  }

  // Resolve folder slug for storage path
  const supabase = await createClient();
  let folderSlug = "";

  if (folderId) {
    const { data: folder } = await supabase
      .from("asset_folders")
      .select("slug")
      .eq("id", folderId)
      .single();
    if (folder) folderSlug = folder.slug;
  }

  // Upload to Supabase Storage using service role
  const storage = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = isPng ? "png" : "jpg";
  const sanitizedName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const timestamp = Date.now();
  const pathSegments = [user.org_id];
  if (folderSlug) pathSegments.push(folderSlug);
  pathSegments.push(`${timestamp}_${sanitizedName}.${ext}`);
  const storagePath = pathSegments.join("/");

  const { error: uploadError } = await storage.storage
    .from("organization-assets")
    .upload(storagePath, processed, {
      contentType: isPng ? "image/png" : "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = storage.storage
    .from("organization-assets")
    .getPublicUrl(storagePath);

  // Create asset record
  const displayName = file.name.replace(/\.[^/.]+$/, "");
  const { data: asset, error: dbError } = await supabase
    .from("assets")
    .insert({
      org_id: user.org_id,
      name: displayName,
      file_name: file.name,
      storage_path: storagePath,
      file_size: processed.length,
      mime_type: isPng ? "image/png" : "image/jpeg",
      dimensions: { width: outputWidth, height: outputHeight },
      optimization_metadata: {
        original_size: originalSize,
        optimized_size: processed.length,
        compression_ratio: Math.round((1 - processed.length / originalSize) * 100),
      },
      folder_id: folderId || null,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json(
      { error: "Failed to save asset record: " + dbError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    asset: { ...asset, url: publicUrl },
    url: publicUrl,
    width: outputWidth,
    height: outputHeight,
  });
}
