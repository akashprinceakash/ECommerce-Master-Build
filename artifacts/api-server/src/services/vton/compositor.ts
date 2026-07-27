import sharp from "sharp";
import { logger } from "../../lib/logger";

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`compositor: failed to download image (${res.status}) from ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Composites two FASHN try-on results into a single image.
 *
 * Both `topResultUrl` and `bottomResultUrl` should be independent try-ons
 * against the **original** human photo — not chained. We take the upper
 * portion from the top-garment result and the lower portion from the
 * bottom-garment result, blending across the waist seam so the join is
 * invisible.
 *
 * @param topResultUrl    URL of the FASHN result with the top garment applied
 * @param bottomResultUrl URL of the FASHN result with the bottom garment applied
 * @param splitFraction   Fraction of image height where the waist sits (default 0.54)
 * @param transitionFraction Half-width of the blend zone as fraction of height (default 0.06)
 */
export async function compositeTopBottom(
  topResultUrl: string,
  bottomResultUrl: string,
  splitFraction = 0.54,
  transitionFraction = 0.06,
): Promise<Buffer> {
  logger.info({ topResultUrl, bottomResultUrl, splitFraction }, "compositor: downloading both try-on results");

  const [topBuf, botBuf] = await Promise.all([
    fetchBuffer(topResultUrl),
    fetchBuffer(bottomResultUrl),
  ]);

  // Normalise both images to RGBA and the same dimensions.
  // FASHN always returns images at the same resolution as the input, so they
  // should already match — but we resize the bottom to match the top just in case.
  const topImage = sharp(topBuf).ensureAlpha();
  const topMeta = await sharp(topBuf).metadata();
  const width = topMeta.width ?? 768;
  const height = topMeta.height ?? 1024;

  const [topRaw, botRaw] = await Promise.all([
    topImage.raw().toBuffer(),
    sharp(botBuf)
      .ensureAlpha()
      .resize(width, height, { fit: "fill" })
      .raw()
      .toBuffer(),
  ]);

  const channels = 4; // RGBA
  const splitY = Math.round(height * splitFraction);
  const transitionHalf = Math.round(height * transitionFraction);

  const out = Buffer.allocUnsafe(width * height * channels);

  for (let y = 0; y < height; y++) {
    // alpha: 1 = fully top-garment image, 0 = fully bottom-garment image
    let alpha: number;
    if (y <= splitY - transitionHalf) {
      alpha = 1;
    } else if (y >= splitY + transitionHalf) {
      alpha = 0;
    } else {
      // smooth step blend (cubic) across the transition zone
      const t = (y - (splitY - transitionHalf)) / (2 * transitionHalf); // 0..1
      const smooth = t * t * (3 - 2 * t);
      alpha = 1 - smooth;
    }

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        out[i + c] = Math.round((topRaw[i + c] ?? 0) * alpha + (botRaw[i + c] ?? 0) * (1 - alpha));
      }
    }
  }

  logger.info(
    { width, height, splitY, transitionHalf },
    "compositor: blend complete, encoding PNG",
  );

  return sharp(out, { raw: { width, height, channels } }).png().toBuffer();
}
