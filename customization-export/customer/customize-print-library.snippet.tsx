/* ───────────────────────────────────────────────────────────────────────────
 * KA.SHA Customizer — Print Library additions
 *
 * This file is a SNIPPET, not a standalone component. It contains every line
 * I added to the existing customer-facing customizer page so you can copy it
 * into your repo with the correct context. The host file is:
 *
 *     artifacts/kasha/src/pages/customize.tsx
 *
 * The customizer is a 1800-line file built around a `fabric.Canvas` whose
 * texture is rendered onto a 3D model-viewer t-shirt. The Print Library
 * wires into the existing `fcRef.current` (Fabric canvas), `syncTexture()`
 * (push canvas pixels to the 3D material), and the `rightTab="design"` panel
 * that already houses Garment Options + Pattern Overlay.
 *
 * The five blocks below are ordered top-to-bottom in the same order they
 * appear inside customize.tsx. Each block is preceded by a `--- INSERT AT ---`
 * comment so a developer can locate the anchor line in the original file.
 * ─────────────────────────────────────────────────────────────────────────── */

// ─── 1. IMPORT (top of file, alongside the other imports) ──────────────────
//     INSERT AT: just below `import * as fabric from "fabric";`
import {
  PATTERNS,
  ZONE_PRESETS,
  ZONE_LABEL,
  ALL_OVER_ZONES,
  patternUrl,
  type PatternZone,
  type PatternDef,
} from "@/components/3d/patterns";


// ─── 2. STATE (inside the Customize component, near the other useState calls)
//     INSERT AT: right after `const [rightTab, setRightTab] = useState(...)`
const [activePrintId, setActivePrintId]     = useState<string | null>(null);
const [allOverPrintId, setAllOverPrintId]   = useState<string | null>(null);
const [customPrints, setCustomPrints]       = useState<PatternDef[]>([]);
const baseBgRef       = useRef<string>("#C5D3DE");      // last solid body colour
const printUploadRef  = useRef<HTMLInputElement | null>(null);
const allOverSeqRef   = useRef(0);                       // race-guard token


// ─── 3. PATCH the existing colour handlers ─────────────────────────────────
//     The colour handlers must NOT overwrite the canvas background while
//     an all-over print is active. They also need to remember the last
//     selected colour so removing the print can restore it.

// applyPartColor — inside the `if (idx === 0)` branch:
//     INSERT this line BEFORE setFabricBg() and ADD allOverPrintId to the
//     useCallback dependency array.
baseBgRef.current = hex;
if (!allOverPrintId) setFabricBg(fc, hex);            // skip if pattern active

// applyPrimary — same idea:
const applyPrimary = (hex: string) => {
  setPrimaryColor(hex); setCanvasBg(hex);
  const fc = fcRef.current;
  baseBgRef.current = hex;
  if (!allOverPrintId) setFabricBg(fc, hex);
  syncTexture();
  if (mats[0]) { applyPartColor(0, hex); }
};

// loadExistingDesign hydration block — initialise the restore-to colour
// from the saved primary colour:
//     INSERT AT: right after setSecondaryColor() in the load-from-JSON effect.
baseBgRef.current = parsed.primaryColor || bg;


// ─── 4. PRINT HANDLERS ─────────────────────────────────────────────────────
//     Place these together as a single block. They expect the Fabric canvas
//     ref `fcRef.current` and the `syncTexture()` helper to already exist.

// Remove every fabric object that was placed by the print system, optionally
// filtered by tag. Used both for clearing all-over and for replacing it.
const removePrintObjects = useCallback((filter?: (data: any) => boolean) => {
  const fc = fcRef.current; if (!fc) return 0;
  const victims = fc.getObjects().filter(o => {
    const d = (o as any).data;
    if (!d || (d.kashaZone === undefined && !d.kashaAllOver)) return false;
    return filter ? filter(d) : true;
  });
  victims.forEach(o => fc.remove(o));
  return victims.length;
}, []);

// Place one print image on one zone using the calibrated UV preset.
// The image keeps its natural aspect ratio; `preset.scale` is applied to
// both axes so the design isn't stretched.
const addZoneImage = useCallback(async (
  p: PatternDef,
  zone: PatternZone,
  opts: { allOver?: boolean; selectable?: boolean } = {},
) => {
  const fc = fcRef.current; if (!fc) return null;
  const preset = ZONE_PRESETS[zone];
  const img = await fabric.FabricImage.fromURL(patternUrl(p.file), { crossOrigin: "anonymous" });
  img.set({
    left: preset.left,
    top: preset.top,
    originX: "center",
    originY: "center",
    scaleX: preset.scale,
    scaleY: preset.scale,
    selectable: opts.selectable ?? true,
    evented: opts.selectable ?? true,
  });
  (img as any).data = {
    kashaZone: zone,
    kashaPrintId: p.id,
    kashaAllOver: !!opts.allOver,
  };
  fc.add(img);
  return img;
}, []);

// "Apply to whole T-shirt" — drop the same print on every panel using each
// zone's own calibrated placement. No background tiling, no zoom.
const applyAllOverPrint = useCallback(async (p: PatternDef) => {
  const fc = fcRef.current; if (!fc) return;
  const myTicket = ++allOverSeqRef.current;
  try {
    // Preload all 5 zone images in parallel — much snappier than sequential.
    const url = patternUrl(p.file);
    const sources = await Promise.all(
      ALL_OVER_ZONES.map(() => fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" })),
    );
    // A newer apply landed while we were loading; bail out without touching state.
    if (myTicket !== allOverSeqRef.current) return;

    // Now commit atomically: clear previous all-over, then add fresh ones.
    removePrintObjects(d => d.kashaAllOver === true);
    ALL_OVER_ZONES.forEach((zone, i) => {
      const img = sources[i];
      const preset = ZONE_PRESETS[zone];
      img.set({
        left: preset.left, top: preset.top,
        originX: "center", originY: "center",
        scaleX: preset.scale, scaleY: preset.scale,
        selectable: false, evented: false,
      });
      (img as any).data = { kashaZone: zone, kashaPrintId: p.id, kashaAllOver: true };
      fc.add(img);
    });
    fc.discardActiveObject();
    fc.renderAll();
    setAllOverPrintId(p.id);
    setActivePrintId(p.id);
    syncTexture();
    toast({ title: "Print applied", description: `${p.label} mapped to every panel of the t-shirt.` });
  } catch {
    if (myTicket === allOverSeqRef.current) {
      toast({ title: "Could not load print", variant: "destructive" });
    }
  }
}, [removePrintObjects, syncTexture, toast]);

const clearAllOverPrint = useCallback(() => {
  const fc = fcRef.current; if (!fc) return;
  // Invalidate any in-flight apply so it can't re-add the print after we clear.
  allOverSeqRef.current++;
  removePrintObjects(d => d.kashaAllOver === true);
  // Reconcile the body background to whatever colour was last selected while
  // the all-over print was masking it.
  if (baseBgRef.current) setFabricBg(fc, baseBgRef.current);
  fc.renderAll();
  setAllOverPrintId(null);
  syncTexture();
  toast({ title: "All-over print removed" });
}, [removePrintObjects, syncTexture, toast]);

// Single-zone placement. Stays selectable so power users can still nudge.
const placePrintOnZone = useCallback(async (p: PatternDef, zone: PatternZone) => {
  const fc = fcRef.current; if (!fc) return;
  try {
    // Replace any previous image on the same zone (keeps things tidy).
    removePrintObjects(d => d.kashaZone === zone && !d.kashaAllOver);
    const img = await addZoneImage(p, zone, { allOver: false, selectable: true });
    if (img) fc.setActiveObject(img);
    fc.renderAll();
    setActivePrintId(p.id);
    syncTexture();
    toast({ title: "Print placed", description: `${p.label} on ${ZONE_LABEL[zone]} — fits the panel automatically.` });
  } catch {
    toast({ title: "Could not load print", variant: "destructive" });
  }
}, [addZoneImage, removePrintObjects, syncTexture, toast]);

// Upload your own design — reads the file as a data URL and registers it as
// a custom print. The same zone/all-over actions then work on it.
const handleUploadCustomPrint = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast({ title: "Please choose an image file", variant: "destructive" });
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast({ title: "Image too large", description: "Please use a file under 8 MB.", variant: "destructive" });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result || "");
    const id = `custom-${Date.now()}`;
    const def: PatternDef = {
      id,
      label: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "My Design",
      file: url,                  // data: URL — patternUrl() returns it as-is
      swatchColors: ["#888888"],
    };
    setCustomPrints(prev => [def, ...prev].slice(0, 12));
    setActivePrintId(id);
    toast({ title: "Design uploaded", description: "Pick a zone or apply it to the whole t-shirt." });
  };
  reader.onerror = () => toast({ title: "Could not read file", variant: "destructive" });
  reader.readAsDataURL(file);
  // Reset input so the same file can be re-uploaded if needed.
  e.target.value = "";
}, [toast]);


// ─── 5. UI BLOCK ───────────────────────────────────────────────────────────
//     INSERT AT: inside `{rightTab==="design" && (...)}`, right AFTER the
//     existing "Pattern Overlay" `<div>` block and BEFORE the "Quick tip"
//     `<div>` at the bottom of the design panel.
//
//     Style helpers used (V, sl, btnStyle) are already defined at the top
//     of customize.tsx — no need to redeclare them.

{/* Print Library */}
<div>
  <div style={sl}>Print Library</div>
  <p style={{ margin:"0 0 8px",fontSize:"10px",color:V.mu,lineHeight:1.5 }}>
    Pick a print, then place it on a panel or apply it to the whole t-shirt — each zone is auto-fitted, no resizing needed.
  </p>

  {/* Upload your own */}
  <input ref={printUploadRef} type="file" accept="image/*" onChange={handleUploadCustomPrint} style={{ display:"none" }} />
  <button
    onClick={() => printUploadRef.current?.click()}
    style={{ ...btnStyle("secondary"),width:"100%",padding:"8px 0",fontSize:"11px",fontWeight:600,marginBottom:"8px" }}
  >
    ↑ Upload your own design
  </button>

  {customPrints.length > 0 && (
    <>
      <div style={{ fontSize:"9px",color:V.mu,textTransform:"uppercase",letterSpacing:"1px",margin:"4px 0 4px" }}>Your uploads</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px",marginBottom:"10px" }}>
        {customPrints.map((p) => {
          const sel = activePrintId === p.id;
          const all = allOverPrintId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePrintId(p.id)}
              title={p.label}
              style={{
                position:"relative",padding:0,aspectRatio:"1/1",borderRadius:"7px",overflow:"hidden",cursor:"pointer",
                background:`url(${patternUrl(p.file)}) center/cover`,
                border:sel?`2px solid ${V.ac}`:`1px solid ${V.bd}`,
                boxShadow:sel?`0 0 0 2px rgba(201,168,124,.25)`:"none",
              }}
            >
              <span style={{
                position:"absolute",bottom:2,left:2,fontSize:"8px",fontWeight:800,
                background:"rgba(0,0,0,.6)",color:"#fff",padding:"1px 4px",borderRadius:"3px",letterSpacing:"0.4px",
              }}>YOURS</span>
              {all && (
                <span style={{
                  position:"absolute",top:3,right:3,fontSize:"8px",fontWeight:800,
                  background:V.ac,color:"#fff",padding:"1px 4px",borderRadius:"3px",letterSpacing:"0.5px",
                }}>ALL</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  )}

  <div style={{ fontSize:"9px",color:V.mu,textTransform:"uppercase",letterSpacing:"1px",margin:"4px 0 4px" }}>Curated prints</div>
  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px" }}>
    {PATTERNS.map((p) => {
      const sel = activePrintId === p.id;
      const all = allOverPrintId === p.id;
      return (
        <button
          key={p.id}
          onClick={() => setActivePrintId(p.id)}
          title={p.label}
          style={{
            position:"relative",padding:0,aspectRatio:"1/1",borderRadius:"7px",overflow:"hidden",cursor:"pointer",
            background:`url(${patternUrl(p.file)}) center/cover`,
            border:sel?`2px solid ${V.ac}`:`1px solid ${V.bd}`,
            boxShadow:sel?`0 0 0 2px rgba(201,168,124,.25)`:"none",
          }}
        >
          {all && (
            <span style={{
              position:"absolute",top:3,right:3,fontSize:"8px",fontWeight:800,
              background:V.ac,color:"#fff",padding:"1px 4px",borderRadius:"3px",letterSpacing:"0.5px",
            }}>ALL</span>
          )}
        </button>
      );
    })}
  </div>

  {activePrintId && (() => {
    const p = [...customPrints, ...PATTERNS].find(x => x.id === activePrintId);
    if (!p) return null;
    return (
      <div style={{ marginTop:"10px",background:V.sf,border:`1px solid ${V.bd}`,borderRadius:"7px",padding:"10px",display:"flex",flexDirection:"column",gap:"8px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <div style={{ width:32,height:32,borderRadius:5,background:`url(${patternUrl(p.file)}) center/cover`,flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"11px",fontWeight:600 }}>{p.label}</div>
            <div style={{ display:"flex",gap:3,marginTop:3 }}>
              {p.swatchColors.map(c => (
                <span key={c} style={{ width:10,height:10,borderRadius:"50%",background:c,border:`1px solid ${V.bd}` }} />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => applyAllOverPrint(p)}
          style={{ ...btnStyle("primary"),padding:"7px 0",fontSize:"11px",fontWeight:700 }}
        >
          {allOverPrintId === p.id ? "✓ Applied All-Over" : "Apply to whole T-shirt"}
        </button>

        <div style={{ fontSize:"9px",color:V.mu,textTransform:"uppercase",letterSpacing:"1px",marginTop:2 }}>
          Or place on a single panel
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px" }}>
          {(["front","back","leftSleeve","rightSleeve","collar"] as PatternZone[]).map(zone => (
            <button
              key={zone}
              onClick={() => placePrintOnZone(p, zone)}
              style={{ ...btnStyle("secondary"),padding:"6px 0",fontSize:"10px",fontWeight:600 }}
            >
              + {ZONE_LABEL[zone]}
            </button>
          ))}
        </div>

        {allOverPrintId && (
          <button
            onClick={clearAllOverPrint}
            style={{ ...btnStyle("danger"),padding:"6px 0",fontSize:"10px",fontWeight:600 }}
          >
            ✕ Remove all-over print
          </button>
        )}
      </div>
    );
  })()}
</div>
