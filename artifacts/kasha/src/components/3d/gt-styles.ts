// gt-styles.ts — legacy shim (GT001-GT032 replaced by KA.SHA Bespoke Designs)
//
// The pixel-swap GT style engine has been superseded by kasha-designs.ts.
// This file is kept as a minimal shim so any remaining legacy references
// compile without error.

import * as fabric from "fabric";

export interface GtColors {
  primary:   string;
  accent:    string;
  tertiary?: string;
}

export interface GtStyleDef {
  id:            string;
  label:         string;
  group:         string;
  defaultColors: GtColors;
}

export const GT_STYLES: GtStyleDef[] = [];

export function clearGtStyle(_fc: fabric.Canvas): void { }

export async function applyGtStyle(
  _fc:     fabric.Canvas,
  _style:  GtStyleDef,
  _colors?: Partial<GtColors>,
): Promise<void> { }

export async function recolorGtStyle(
  _fc:          fabric.Canvas,
  _style:       GtStyleDef,
  _newColors:   Partial<GtColors>,
  _syncTexture: () => void,
): Promise<void> { }
