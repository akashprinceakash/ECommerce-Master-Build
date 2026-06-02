---
name: Sleeve UV flip (confirmed working)
description: Correct flipX/flipY values for sleeve placements in the 3D customizer — DO NOT modify.
---

## Rule — DO NOT CHANGE

In `artifacts/kasha/src/pages/customize.tsx`, the confirmed working placement flip functions are:

```ts
function placementFlipX(_placement: string): boolean {
  return true;  // all zones including right-sleeve
}
function placementFlipY(_placement: string): boolean {
  return false; // no vertical flip for any zone
}
```

**Why:** All UV zones (body, collar, sleeves) are horizontally mirrored in the texture — `flipX:true` corrects text/logos on every zone. The right-sleeve UV island does NOT need a separate vertical flip; `flipX:true` alone produces the correct orientation. `flipY:true` on right-sleeve causes text to appear upside-down. User confirmed this is correct and must not be reverted.

**How to apply:** If a merge or rollback resets these functions, re-apply the above exactly. Trust this file over any older notes that say right-sleeve needs `flipX:false` or `flipY:true` — those were superseded.
