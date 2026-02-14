/**
 * Client-side image compression using Canvas API.
 * Resizes large images before upload to stay under Vercel's
 * serverless function body size limit (4.5MB).
 */

const MAX_DIMENSION = 1600;
const TARGET_SIZE = 3.5 * 1024 * 1024; // 3.5MB target (leaves room for FormData overhead)
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.5;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

/**
 * Compress an image file client-side. Returns the original file if it's
 * already small enough, or a compressed Blob wrapped in a new File.
 *
 * - Resizes to max 1600px on longest side
 * - Compresses JPEG/WebP quality iteratively until under 3.5MB
 * - Preserves PNG format for transparency (but still resizes)
 */
export async function compressImage(file: File): Promise<File> {
  // GIFs can't be re-encoded with canvas (loses animation) — skip
  if (file.type === "image/gif") {
    return file;
  }

  // Already small enough — skip compression
  if (file.size <= TARGET_SIZE) {
    return file;
  }

  const img = await loadImage(file);
  const { width, height } = img;

  // Calculate new dimensions
  let newWidth = width;
  let newHeight = height;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  const isPng = file.type === "image/png";
  const mimeType = isPng ? "image/png" : "image/jpeg";

  if (isPng) {
    // PNG: can't control quality, just resize
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png")
    );
    return new File([blob], file.name, { type: "image/png" });
  }

  // JPEG/WebP: iteratively lower quality until size is acceptable
  let quality = INITIAL_QUALITY;
  let blob: Blob;

  do {
    blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), mimeType, quality)
    );
    if (blob.size <= TARGET_SIZE) break;
    quality -= 0.1;
  } while (quality >= MIN_QUALITY);

  const ext = isPng ? ".png" : ".jpg";
  const name = file.name.replace(/\.[^.]+$/, ext);
  return new File([blob], name, { type: mimeType });
}
