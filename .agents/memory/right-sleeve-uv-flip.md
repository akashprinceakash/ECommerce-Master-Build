---
name: Right sleeve UV flip
description: Correct flipX/flipY values for the right-sleeve UV island in the 3D customizer texture canvas.
---

## Rule
In `artifacts/kasha/src/pages/customize.tsx`, the two placement flip functions must be:

```ts
function placementFlipX(placement: string): boolean {
  return placement !== "right-sleeve";   // all zones except right-sleeve
}
function placementFlipY(placement: string): boolean {
  return placement === "right-sleeve";   // only right-sleeve
}
```

**Why:** The UV texture map is horizontally mirrored for every zone, so `flipX:true` corrects text/logos everywhere. The right-sleeve UV island is additionally vertically flipped relative to the left sleeve — `flipY:true` corrects that. The combination means right-sleeve gets `flipX:false` + `flipY:true`; all other zones get `flipX:true` + `flipY:false`. Setting both to `true` (or both to `false`) produces reversed/upside-down text on the right sleeve.

**How to apply:** Any time a rollback or merge resets these functions, re-apply the above. The code comment in the file also documents this — trust the comment, not the function body if they conflict.
