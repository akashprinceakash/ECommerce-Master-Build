---
name: Placement flip rules (confirmed working — DO NOT CHANGE)
description: Correct flipX/flipY per-placement values for the 3D customizer texture canvas. User-confirmed. Do not revert.
---

## Rule — DO NOT CHANGE WITHOUT USER CONFIRMATION

In `artifacts/kasha/src/pages/customize.tsx`:

```ts
function placementFlipX(placement: string): boolean {
  return placement !== "collar-left" && placement !== "right-sleeve";
}
function placementFlipY(placement: string): boolean {
  return placement === "collar-left" || placement === "right-sleeve";
}
```

**Per-placement flip table:**

| Placement    | flipX | flipY | Reason                                                     |
|--------------|-------|-------|------------------------------------------------------------|
| front-center | true  | false | UV horizontally mirrored                                   |
| back-center  | true  | false | UV horizontally mirrored                                   |
| back-top     | true  | false | UV horizontally mirrored                                   |
| left-sleeve  | true  | false | rightSleeve UV zone — horizontally mirrored                |
| right-sleeve | false | true  | leftSleeve UV zone — vertically flipped, not h-mirrored    |
| collar-left  | false | true  | UV not h-mirrored, but vertically flipped                  |
| collar-right | true  | false | UV horizontally mirrored, not vertically flipped           |

**Why right-sleeve is false/true:** The UV zone at (409,120) is vertically flipped by the UV map but NOT horizontally mirrored. flipX=true adds an unwanted h-mirror on top; flipY=true cancels the UV's vertical flip. Any other combination produces reversed/upside-down text.

**How to apply:** If a merge or rollback resets these functions, re-apply exactly as above.
