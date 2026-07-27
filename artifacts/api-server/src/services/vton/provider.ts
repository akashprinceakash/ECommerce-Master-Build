/**
 * VTON provider selection.
 *
 * Set VTON_PROVIDER=fashn (default) or VTON_PROVIDER=replicate in the
 * environment to switch between providers at runtime without redeploying.
 *
 * FASHN is the production default.  Replicate/IDM-VTON is kept as a
 * fallback so we can revert instantly by changing one env var.
 */
export type VtonProvider = "fashn" | "replicate";

export function getActiveProvider(): VtonProvider {
  const raw = (process.env["VTON_PROVIDER"] ?? "fashn").toLowerCase().trim();
  return raw === "replicate" ? "replicate" : "fashn";
}
