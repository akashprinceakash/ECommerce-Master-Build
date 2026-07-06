---
name: Avatar-based Lookbook builder
description: Design decisions behind KA.SHA's avatar/mannequin-based single top+bottom outfit builder (replaced free-form canvas).
---

The Lookbook was rebuilt from a free-form multi-item canvas (drag/resize/layer anything anywhere) into a constrained single top-slot + single bottom-slot builder on a static full-body mannequin avatar image.

**Why:** the client explicitly said the free-form version "looks artificial" and garments don't "fit the body correctly." Unconstrained placement let users layer clothing anywhere on a blank canvas with no body reference, so outfits never looked like something a person could wear. Anchoring exactly two garment roles (top, bottom) to fixed percentage-based bounding boxes on a mannequin image made the result read as an actual outfit.

**How to apply:**
- Only two garment roles exist: `top` and `bottom`. Products are assigned a role by mapping their `category` field into `TOP_CATEGORIES` / `BOTTOM_CATEGORIES` sets — categories outside both sets (e.g. accessories) are excluded from the slot system entirely rather than forced into a slot.
- Garment images are placed inside fixed anchor percentage-boxes tuned to the specific generated avatar's proportions, not free-dragged. Users can only zoom in/out per slot, not reposition arbitrarily.
- If the avatar art changes (new proportions), the anchor box percentages must be re-tuned by eye — they are hardcoded to match the current avatar images, not derived from any pose data.
- The old free-form multi-item canvas pattern (arbitrary x/y/width per item, many items at once) should not be reintroduced for outfit/mannequin-style visualization features — it was the exact thing the client rejected as unrealistic.
