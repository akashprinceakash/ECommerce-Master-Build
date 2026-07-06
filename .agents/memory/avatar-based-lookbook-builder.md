---
name: Avatar-based Lookbook builder
description: Design decisions behind KA.SHA's avatar/mannequin-based single top+bottom outfit builder (replaced free-form canvas).
---

The Lookbook was rebuilt from a free-form multi-item canvas (drag/resize/layer anything anywhere) into a constrained single top-slot + single bottom-slot builder on a static full-body avatar image.

**Why:** the client first rejected the free-form version as "looks artificial" and garments not "fitting the body correctly." The first fix (grey faceless mannequin + overlay anchors) was *also* rejected on a second round — a mannequin still reads as fake even with correct anchoring. The client wants a photoreal human model wearing the default outfit baked directly into the avatar art, not a blank/grey body shape.

**How to apply:**
- Only two garment roles exist: `top` and `bottom`. Products are assigned a role by mapping their `category` field into `TOP_CATEGORIES` / `BOTTOM_CATEGORIES` sets — categories outside both sets (e.g. accessories) are excluded from the slot system entirely.
- Avatar art must be a photorealistic human model (generated via `generateImage` + background removal), not a grey/faceless mannequin — a mannequin was explicitly rejected as "artificial" even when garment placement was accurate.
- Bake the default outfit (plain white tee + navy trousers) directly into the avatar image itself, front-facing, arms slightly away from torso for overlay clearance. This makes "show a default outfit on load" trivial: when a slot is empty, nothing is overlaid and the avatar's own baked clothing shows through — no separate "default product" entity needed. When the user picks a real product, its cutout overlays that slot's anchor box, fully covering the baked default garment underneath.
- Garment images are placed inside fixed anchor percentage-boxes tuned by eye to the specific avatar image's proportions, not free-dragged. Users can only zoom in/out per slot, not reposition arbitrarily.
- Whenever the avatar art is regenerated (even a "same pose" regeneration), re-tune the anchor box percentages — small proportion shifts between generations are enough to make previous anchors misaligned. Anchors are hardcoded to the current avatar images, not derived from pose data.
- The old free-form multi-item canvas pattern (arbitrary x/y/width per item, many items at once) should not be reintroduced — it was the original thing the client rejected as unrealistic.
- After the avatar/placement problem was solved, the client's next complaint was that the builder felt visually flat/plain ("not a wow"), not a functional gap. They shared a styled illustrated-SVG mockup as a *layout/polish* reference, but explicitly want real product photos on the photoreal avatar — not the mockup's illustrated garments. When a reference mockup uses placeholder/illustrated art, treat it as a design-language reference (typography, spacing, status messaging, feedback affordances) and keep the real photoreal-avatar + real-product-photo approach already established above.
