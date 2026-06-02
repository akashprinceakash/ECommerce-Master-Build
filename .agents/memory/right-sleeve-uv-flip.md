---
name: Placement flip rules (confirmed working — DO NOT CHANGE)
description: Correct flipX/flipY per-placement values for the 3D customizer texture canvas. User-confirmed. Do not revert.
---

## Rule — DO NOT CHANGE WITHOUT USER CONFIRMATION

In `artifacts/kasha/src/pages/customize.tsx`:

```ts
function placementFlipX(placement: string): boolean {
  return placement !== "collar-left";  // collar-left UV area is NOT mirrored; all others are
}
function placementFlipY(placement: string): boolean {
  return placement === "collar-left";  // collar-left UV area is vertically flipped; no others are
}
```

**Why:**
- All body/sleeve UV zones are horizontally mirrored → `flipX:true` corrects text/logos everywhere.
- `collar-right` (x≈451) is in a mirrored UV zone → `flipX:true, flipY:false`.
- `collar-left` (x≈80) is in a non-mirrored AND vertically-flipped UV zone → `flipX:false, flipY:true`.
- Right-sleeve: `flipX:true, flipY:false` — confirmed correct by user.

**How to apply:** If a merge or rollback resets these functions, re-apply exactly as above.
