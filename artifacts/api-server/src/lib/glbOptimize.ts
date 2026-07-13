/**
 * GLB/glTF optimization pipeline using @gltf-transform.
 *
 * Pipeline (in order):
 *   1. prune  — removes unused nodes, meshes, materials, textures, animations, cameras, skins
 *   2. dedup  — deduplicates accessors, meshes, materials, textures (merges identical data)
 *   3. weld   — merges bitwise-identical vertices (improves Draco compression ratio)
 *   4. draco  — Draco geometry compression via draco3d (KHR_draco_mesh_compression)
 *
 * Textures are intentionally left untouched — they serve as UV maps for the 3D customizer
 * and lossy texture compression could introduce visible artifacts on fabric renders.
 *
 * Draco is supported by Google model-viewer 3.x out of the box (built-in decoder, no extra
 * configuration needed on the <model-viewer> element).
 */

import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { prune, dedup, weld, draco } from "@gltf-transform/functions";
import { logger } from "./logger";

export interface GlbOptimizeResult {
  buffer: Buffer;
  originalBytes: number;
  optimizedBytes: number;
  /** Percentage size reduction, e.g. 62 means 62% smaller. 0 if optimization failed or was a no-op. */
  reductionPct: number;
}

// ── Lazy singleton draco module instances (WASM init is expensive ~1-2s) ────

let _dracoDecoder: unknown = null;
let _dracoEncoder: unknown = null;
let _dracoInitPromise: Promise<void> | null = null;

async function initDraco(): Promise<void> {
  if (_dracoDecoder && _dracoEncoder) return;
  if (_dracoInitPromise) return _dracoInitPromise;

  _dracoInitPromise = (async () => {
    // draco3d is externalized in esbuild so it loads from node_modules at runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("draco3d") as typeof import("draco3d");
    _dracoDecoder = await mod.createDecoderModule();
    _dracoEncoder = await mod.createEncoderModule();
    logger.info("glbOptimize: Draco WASM modules initialised");
  })();

  return _dracoInitPromise;
}

// Warm up Draco WASM on first server start so the first upload isn't slow.
initDraco().catch((e) =>
  logger.warn({ e }, "glbOptimize: Draco WASM warm-up failed — will retry on first upload"),
);

// ── Main optimization entry point ────────────────────────────────────────────

/**
 * Optimise a GLB/glTF binary buffer.
 * Always resolves — on failure returns the original buffer with reductionPct = 0.
 */
export async function optimizeGlb(input: Buffer): Promise<GlbOptimizeResult> {
  const originalBytes = input.byteLength;

  try {
    await initDraco();

    const io = new NodeIO()
      .registerExtensions([KHRDracoMeshCompression])
      .registerDependencies({
        "draco3d.decoder": _dracoDecoder,
        "draco3d.encoder": _dracoEncoder,
      });

    const document = await io.readBinary(input);

    await document.transform(
      prune(),
      dedup(),
      weld(),
      draco({
        method: "edgebreaker" as const,
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
        quantizeColor: 8,
        encodeSpeed: 5,
        decodeSpeed: 5,
      }),
    );

    const optimized = Buffer.from(await io.writeBinary(document));
    const optimizedBytes = optimized.byteLength;

    // If optimised output is unexpectedly larger, keep the original.
    if (optimizedBytes >= originalBytes) {
      logger.info(
        { originalBytes, optimizedBytes },
        "glbOptimize: optimised file not smaller — keeping original",
      );
      return { buffer: input, originalBytes, optimizedBytes: originalBytes, reductionPct: 0 };
    }

    const reductionPct = Math.round((1 - optimizedBytes / originalBytes) * 100);
    logger.info(
      { originalBytes, optimizedBytes, reductionPct },
      "glbOptimize: optimisation complete",
    );

    return { buffer: optimized, originalBytes, optimizedBytes, reductionPct };
  } catch (e) {
    logger.warn({ e }, "glbOptimize: optimisation failed — uploading original file");
    return { buffer: input, originalBytes, optimizedBytes: originalBytes, reductionPct: 0 };
  }
}
