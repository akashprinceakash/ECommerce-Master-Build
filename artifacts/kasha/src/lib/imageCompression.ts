/**
 * Browser-side image compression using Canvas API.
 * No external dependencies — pure browser APIs.
 */

export interface CompressOptions {
  maxPx?: number;
  quality?: number;
  format?: "webp" | "jpeg" | "auto";
}

function supportsWebP(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch { return false; }
}

/**
 * Compress an image File using Canvas.
 * Resizes to maxPx on the longest side, converts to WebP (JPEG fallback).
 * Returns the original file if compression produces a larger result.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxPx = 1200, quality = 0.82, format = "auto" } = options;

  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const useWebP = format === "webp" || (format === "auto" && supportsWebP());
  const mimeOut = useWebP ? "image/webp" : "image/jpeg";
  const extOut  = useWebP ? ".webp" : ".jpg";

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let { width, height } = img;

        if (width > maxPx || height > maxPx) {
          if (width >= height) { height = Math.round((height / width) * maxPx); width = maxPx; }
          else                 { width  = Math.round((width / height) * maxPx); height = maxPx; }
        }

        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }

        if (mimeOut === "image/jpeg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) { resolve(file); return; }
            const base    = file.name.replace(/\.[^.]+$/, "");
            const newFile = new File([blob], `${base}${extOut}`, {
              type: mimeOut, lastModified: Date.now(),
            });
            resolve(newFile);
          },
          mimeOut,
          quality,
        );
      } catch { resolve(file); }
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

/** Compress multiple files concurrently. */
export async function compressImages(
  files: File[],
  options?: CompressOptions,
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)));
}
