---
name: Customisation pricing rules
description: Pricing policy for the Bespoke Studio — which customisations carry a charge.
---

As of the current implementation:
- Zone prints (front, back, collar, sleeve): ₹0 — no charge
- All-over prints: ₹0 — no charge
- Logo upload: ₹20 base + ₹1 per sq inch (minimum ₹20, since 1 sq in base = ₹21 but ₹20 base is always added)
- Text / name: ₹20 base + ₹1 per sq inch

**Why:** The user confirmed prints are part of the product design and carry no extra cost. Personalisation (logo, name) does carry a charge.

**How to apply:** The customizationCharge is computed in the cartMut mutationFn and included in the customization save payload. The pricing UI is an IIFE inside the placement panel (right side panel) in customize.tsx.
