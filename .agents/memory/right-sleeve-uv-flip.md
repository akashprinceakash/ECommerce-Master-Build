---
name: Placement flip rules (confirmed working — DO NOT CHANGE)
description: Correct flipX/flipY per-placement values for the 3D customizer texture canvas. User-confirmed. Do not revert.
---

## Rule — DO NOT CHANGE WITHOUT USER CONFIRMATION

In `artifacts/kasha/src/pages/customize.tsx`:

```ts
function placementFlipX(placement: string): boolean {
  return placement !== "collar-left";  // all except collar-left get flipX:true
}
function placementFlipY(placement: string): boolean {
  return placement === "collar-left";  // only collar-left gets flipY:true
}
```

**Per-placement flip table (confirmed):**

| Placement    | flipX | flipY | Reason                                                  |
|--------------|-------|-------|---------------------------------------------------------|
| front-center | true  | false | UV horizontally mirrored                                |
| back-center  | true  | false | UV horizontally mirrored                                |
| back-top     | true  | false | UV horizontally mirrored                                |
| left-sleeve  | true  | false | rightSleeve UV zone — horizontally mirrored             |
| right-sleeve | true  | false | leftSleeve UV zone — horizontally mirrored, needs flipX |
| collar-left  | false | true  | UV not mirrored horizontally, but vertically flipped    |
| collar-right | true  | false | UV horizontally mirrored, not vertically flipped        |

**How to apply:** If a merge or rollback resets these functions, re-apply exactly as above.
