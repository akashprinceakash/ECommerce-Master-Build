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
function placementFlipY(_placement: string): boolean {
  return false;  // no vertical flip needed for any placement
}
```

**Why:**
- All body/sleeve UV zones are horizontally mirrored in the texture → `flipX:true` corrects text/logos.
- `collar-right` (x≈451) is in a mirrored UV zone → needs `flipX:true`.
- `collar-left` (x≈80) is in a non-mirrored UV zone → `flipX:true` reverses text; must use `flipX:false`.
- Right-sleeve was previously thought to need `flipY:true`, but user confirmed `flipX:true, flipY:false` produces correct orientation there too.

**How to apply:** If a merge or rollback resets these functions, re-apply exactly as above. Ignore any older notes suggesting right-sleeve needs `flipX:false` or `flipY:true` — superseded and confirmed incorrect.
