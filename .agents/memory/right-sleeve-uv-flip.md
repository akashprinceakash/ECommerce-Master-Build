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
  return placement === "collar-left";
}
```

**Per-placement flip table (confirmed):**

| Placement        | flipX | flipY | Reason                                                      |
|------------------|-------|-------|-------------------------------------------------------------|
| front-center     | true  | false | UV is horizontally mirrored                                 |
| back-center      | true  | false | UV is horizontally mirrored                                 |
| back-top         | true  | false | UV is horizontally mirrored                                 |
| left-sleeve      | true  | false | rightSleeve UV zone — horizontally mirrored                 |
| right-sleeve     | false | false | leftSleeve UV zone — NOT mirrored; no flips needed          |
| collar-left      | false | true  | UV not mirrored horizontally, but vertically flipped        |
| collar-right     | true  | false | UV is horizontally mirrored, not vertically flipped         |

**Why right-sleeve is false/false:** The leftSleeve UV zone at (409, 120) is not mirrored by the UV map. Applying any flip in Fabric.js adds an extra mirror on top — flipX=true reverses the text, flipX+flipY=true gives double-flip (180° = text upside-down AND mirrored). No flip in canvas lets the UV render it correctly.

**How to apply:** If a merge or rollback resets these functions, re-apply exactly as above. Trust this table over any older notes.
