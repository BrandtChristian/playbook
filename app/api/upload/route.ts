import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/dal";
import sharp from "sharp";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 1200;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

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
      { error: "File too large. Maximum 5MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Optimize with sharp
  const metadata = await sharp(buffer).metadata();
  const isPng = file.type === "image/png";

  let processed: Buffer;
  let outputWidth: number;
  let outputHeight: number;

  if (isPng) {
    // Keep PNG for transparency, but resize and compress
    const result = sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .png({ quality: 85 });
    const info = await result.toBuffer({ resolveWithObject: true });
    processed = info.data;
    outputWidth = info.info.width;
    outputHeight = info.info.height;
  } else {
    // Convert to JPEG for everything else
    const result = sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true });
    const info = await result.toBuffer({ resolveWithObject: true });
    processed = info.data;
    outputWidth = info.info.width;
    outputHeight = info.info.height;
  }

  // Upload to Supabase Storage using service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = isPng ? "png" : "jpg";
  const filename = `${user.org_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("email-images")
    .upload(filename, processed, {
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
  } = supabase.storage.from("email-images").getPublicUrl(filename);

  return NextResponse.json({
    url: publicUrl,
    width: outputWidth,
    height: outputHeight,
  });
}
