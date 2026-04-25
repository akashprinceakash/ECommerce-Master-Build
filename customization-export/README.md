# KA.SHA Customizer — Print Library Export

This folder contains every piece of code I added to make the 3D customizer's
Print Library work. The structure mirrors how the work splits across roles:

```
customization-export/
├── designer/                          ← edited by the design team
│   ├── patterns.ts                    ← print registry (one row per print)
│   └── patterns/                      ← raw pattern image files (.jpg)
│       ├── paisley.jpg
│       ├── vines-pink.jpg
│       └── …  (11 files total)
└── customer/                          ← edited by developers
    └── customize-print-library.snippet.tsx   ← all additions to customize.tsx
```

---

## Designer side (admin / extensibility)

The designer or store admin only ever touches **two locations** to add a new
print to the customer-facing customizer:

1. **Drop the image** into the public folder
   - Repo path: `artifacts/kasha/public/patterns/`
   - Any `.jpg` / `.png` works. Keep them under ~2 MB and ideally
     square-ish (the customizer uses `cover` for thumbnails).

2. **Register it** in `patterns.ts`
   - Repo path: `artifacts/kasha/src/components/3d/patterns.ts`
   - Append one line to the `PATTERNS` array:
     ```ts
     { id: "my-new-print", label: "My New Print", file: "my-new-print.jpg",
       swatchColors: ["#aabbcc", "#112233"] },
     ```
   - That's it. The print appears in the customizer immediately on next reload.

`patterns.ts` also holds the **calibrated UV coordinates** for each panel of
the t-shirt model:

```ts
ZONE_PRESETS = {
  leftSleeve:  { left: 410, top: 90,  scale: 0.10 },
  rightSleeve: { left: 818, top: 95,  scale: 0.10 },
  collar:      { left: 268, top: 254, scale: 0.10 },
  front:       { left: 280, top: 683, scale: 0.10 },
  back:        { left: 777, top: 697, scale: 0.20 },
};
```

If you swap to a different t-shirt model whose UV layout differs, those are
the only numbers that need re-measuring.

---

## Customer side (in-page UI)

The customer-facing additions all live inside the existing customizer page:

- Repo path: `artifacts/kasha/src/pages/customize.tsx`

Because that file is large (~1800 lines) I extracted **only the lines I
added** into `customer/customize-print-library.snippet.tsx`. The snippet is
broken into 5 numbered sections, each with an `INSERT AT:` comment that
tells you exactly where in `customize.tsx` it belongs.

Sections:

1. **Import** — pulls `PATTERNS`, `ZONE_PRESETS`, helpers, and types from the
   designer registry.
2. **State** — five fields: the active/selected print, the all-over print id,
   custom uploads, the body-colour memory ref, and a sequence token so
   double-clicks don't race.
3. **Patches to existing colour handlers** — three small edits to
   `applyPartColor`, `applyPrimary`, and the load-saved-design effect so
   colour changes don't fight the active all-over print.
4. **Print handlers** — the five callbacks that drive the feature:
   - `removePrintObjects(filter?)` — generic cleanup
   - `addZoneImage(p, zone, opts)` — drops one image at one calibrated zone
   - `applyAllOverPrint(p)` — preloads in parallel, places on all 5 panels,
     race-guarded with `allOverSeqRef`
   - `clearAllOverPrint()` — removes the all-over set, restores the body
     colour the user last picked
   - `placePrintOnZone(p, zone)` — single-panel placement (stays draggable)
   - `handleUploadCustomPrint(e)` — turns an uploaded file into a data-URL
     `PatternDef` and adds it to `customPrints`
5. **UI block** — the JSX section that renders the upload button, the
   `Your uploads` grid, the `Curated prints` grid, and the per-print
   detail card with `Apply to whole T-shirt` + 5 zone buttons.

---

## Dependencies you already have

- `fabric` v7 — used for `fabric.Canvas`, `fabric.FabricImage.fromURL`, and
  the `data` tagging on objects.
- `@/hooks/use-toast` — toast notifications (existing in your repo).
- The existing `fcRef`, `setFabricBg`, `syncTexture` helpers in `customize.tsx`.

No new npm packages were added.
