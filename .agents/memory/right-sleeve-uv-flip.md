---
name: Placement flip rules (confirmed working — DO NOT CHANGE)
description: Correct flipX/flipY per-placement values for the 3D customizer texture canvas. Updated after UI label swap where left-sleeve/right-sleeve display labels were exchanged.
---

## Rule — DO NOT CHANGE WITHOUT USER CONFIRMATION

In `artifacts/kasha/src/pages/customize.tsx`:

```ts
function placementFlipX(placement: string): boolean {
  return placement !== "collar-left";
}
function placementFlipY(placement: string): boolean {
  return placement === "collar-left";
}
```

**Per-placement flip table (after UI label swap):**

| key (internal) | UI label shown | flipX | flipY | Reason |
|---|---|---|---|---|
| front-left | Chest Left | true | false | UV h-mirrored |
| front-right | Chest Right | true | false | UV h-mirrored |
| left-sleeve | Right Sleeve | true | false | UV h-mirrored |
| right-sleeve | Left Sleeve | true | false | UV h-mirrored (same zone behavior after label swap) |
| back-top | Back Top | true | false | UV h-mirrored |
| back-center | Centre Back | true | false | UV h-mirrored |
| collar-left | Collar Right | false | true | UV not h-mirrored, vertically flipped |
| collar-right | Collar Left | true | false | UV h-mirrored |

**Why:** After the UI display-label swap (left-sleeve↔right-sleeve, collar-left↔collar-right labels), the `right-sleeve` key now drives the UI "Left Sleeve" position. Its UV behavior at that position requires flipX=true, flipY=false — identical to `left-sleeve`. Adding the `&& placement !== "right-sleeve"` exclusion (old code) caused mirrored text on "Left Sleeve".

**UI label ↔ key mapping (permanent after swap):**
- UI "Left Sleeve" → key `right-sleeve`
- UI "Right Sleeve" → key `left-sleeve`
- UI "Collar Left" → key `collar-right`
- UI "Collar Right" → key `collar-left`

**How to apply:** If a merge or rollback resets these functions, re-apply exactly as above. The only special case is `collar-left` key (UI: "Collar Right") which needs flipX=false, flipY=true.
