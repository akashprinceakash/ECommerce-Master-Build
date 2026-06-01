---
name: Collar UV mapping
description: The collar UV island is not horizontally mirrored like the body zones — UV-left maps to garment-left.
---

The body UV canvas is horizontally mirrored: UV-right = garment-left, UV-left = garment-right.
The collar UV island does NOT follow this mirror. UV-left = garment-left, UV-right = garment-right.

**Why:** The collar is a separate UV island with its own orientation. Previous code assumed body-mirror logic applied everywhere, causing collar-left and collar-right placements to appear on the wrong side.

**How to apply:** When setting LOGO_POSITIONS for collar-left/right, use UV-left coords for garment-left and UV-right coords for garment-right (no flip). Current values: collar-left {left:140, top:300}, collar-right {left:390, top:300}. The top:300 places the logo near the collar tips (collar UV zone spans top:183–349).
