/**
 * Regenerate GT001-GT005 (Classic group) textures with proper UV zoning.
 *
 * Layout (1024x1024 UV):
 *   - Top-left  (0..160, 0..160)      : icons / utility — leave white
 *   - Top band  (170..1024, 0..160)   : sleeves (left+right)
 *   - Mid band  (0..400, 160..265)    : collar
 *   - Front     (0..400, 265..1024)   : front body (with V-neck + placket near top)
 *   - Back      (400..1024, 265..1024): back body
 *
 * Rule (per user): body uniform PRIMARY; ACCENT only on thin trim:
 *   - Collar binding: thin strip top of collar zone
 *   - Placket:        thin vertical strip on front centre
 *   - Cuff edge:      thin strip at the outer edge of each sleeve
 *   - Hem:            thin strip at the bottom of front + back bodies
 *
 * Output: writes a TypeScript fragment with 5 base64 PNGs to /tmp/gt-classic-out.txt
 * for paste-in to gt-styles.ts -> GT_BASE_TEXTURES.
 */
import { PNG } from "pngjs";
import * as fs from "fs";

const W = 1024;
const H = 1024;

interface Rgb { r: number; g: number; b: number }
const hex2rgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
};

interface Style { id: string; primary: string; accent: string }
const STYLES: Style[] = [
  { id:"GT001", primary:"#C5D3DE", accent:"#362223" },
  { id:"GT002", primary:"#F0CED2", accent:"#362223" },
  { id:"GT003", primary:"#ACB1A1", accent:"#362223" },
  { id:"GT004", primary:"#E9DAC3", accent:"#362223" },
  { id:"GT005", primary:"#FFFFFF", accent:"#273878" },
];

function buildTexture(primary: string, accent: string): Buffer {
  const png = new PNG({ width: W, height: H, colorType: 2 });

  const P = hex2rgb(primary);
  const A = hex2rgb(accent);
  const WHITE: Rgb = { r: 255, g: 255, b: 255 };

  const setPx = (x: number, y: number, c: Rgb) => {
    const i = (y * W + x) * 4;
    png.data[i]     = c.r;
    png.data[i + 1] = c.g;
    png.data[i + 2] = c.b;
    png.data[i + 3] = 255;
  };

  const fillRect = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
    const xa = Math.max(0, Math.min(W, x0));
    const xb = Math.max(0, Math.min(W, x1));
    const ya = Math.max(0, Math.min(H, y0));
    const yb = Math.max(0, Math.min(H, y1));
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) setPx(x, y, c);
    }
  };

  // 1) Whole canvas → WHITE (safety)
  fillRect(0, 0, W, H, WHITE);

  // 2) Body zones → PRIMARY
  // Sleeves (top band) — full primary; the cuff edge will be overpainted
  fillRect(170, 0, W, 160, P);
  // Collar zone — full primary (top edge will become accent binding)
  fillRect(0, 160, 400, 265, P);
  // Buttons / placket strips area on the right of collar — primary
  fillRect(400, 160, W, 265, P);
  // Front body — full primary
  fillRect(0, 265, 400, H, P);
  // Back body — full primary
  fillRect(400, 265, W, H, P);

  // 3) Thin trim strips → ACCENT
  // a) Collar binding — top edge of collar UV zone
  fillRect(0, 160, 400, 175, A);
  // b) Placket — thin vertical strip on front body centre top half
  //    Front V-neck/placket sits roughly around x:185-210, y:280-470
  fillRect(180, 280, 215, 470, A);
  // c) Cuff edges — thin band at the OUTER edge of each sleeve UV
  //    Left sleeve UV occupies ~ x:170..560, cuff edge = leftmost ~14px
  fillRect(170, 0, 184, 160, A);
  //    Right sleeve UV occupies ~ x:560..1024, cuff edge = rightmost ~14px
  fillRect(1010, 0, W, 160, A);
  // d) Hem — thin strip across the BOTTOM of front + back bodies
  fillRect(0, 1008, W, H, A);

  return PNG.sync.write(png, { deflateLevel: 9, deflateStrategy: 3 });
}

const out: string[] = [];
for (const s of STYLES) {
  const buf = buildTexture(s.primary, s.accent);
  const b64 = buf.toString("base64");
  out.push(`  "${s.id}": "data:image/png;base64,${b64}",`);
  console.log(`${s.id}: ${buf.length} bytes`);
}

fs.writeFileSync("/tmp/gt-classic-out.txt", out.join("\n") + "\n");
console.log("Wrote /tmp/gt-classic-out.txt");
