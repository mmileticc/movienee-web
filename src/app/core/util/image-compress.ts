/**
 * Shrinks an image file in the browser: scales it so the longer side is at most `maxDimension`
 * (applying the EXIF orientation), then encodes JPEG with decreasing quality (0.9 -> 0.2) until it
 * fits in `maxBytes`. Same approach as the Android app (AvatarImage.kt / VisionRepository).
 */
export async function compressImage(
  file: Blob,
  maxDimension: number,
  maxBytes: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.9;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > maxBytes && quality > 0.2) {
    quality -= 0.1;
    blob = await toJpeg(canvas, quality);
  }
  return blob;
}

/** A Blob as a `data:` URI (the avatar is sent to the backend in this form). */
export function toDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      'image/jpeg',
      quality,
    ),
  );
}
