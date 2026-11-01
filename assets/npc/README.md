# MISTVALE | NPC Starter Pack (로웬 · 에델린)

This is a first-integration TEST pack, not final production-quality motion frames.

- characters/<id>/sprites/*.png : 128×128 transparent RGBA, one pose per file (idle/work/greet/read)
- characters/<id>/portraits/*.png : 256×256 RGBA canvas, artwork cropped from large sheet, original background remains INSIDE each portrait
- characters/<id>/original/illustration.jpg : user-supplied illustration, alternative to pixel dialogue portrait
- characters/<id>/original/source-sheet.png : generated reference sprite sheet, for future reworking
- characters.json : asset paths and sample dialogue

IMPORTANT
1. Sprites are manually extracted from a COMPOSITE concept sheet, with automatic foreground masking. Some edge pixels, details, or artifacts may remain. Review visually before use.
2. Idle/work/greet are separate STATIC poses, NOT properly interpolated animation frames. Do not cycle them quickly as if walk frames. Use idle with slow 1–3px CSS bob or optional temporary pose on click (work/greet), then return to idle. No artificial jumping.
3. All small sprites share a 128×128 canvas and bottom alignment. Display with image-rendering: pixelated; object-fit: contain; avoid CSS smoothing / stretching.
4. Dialogue portraits are simple crops; labels/frame artwork are excluded. Replace B with original illustration at any time by changing only the portrait asset path. Never change the A sprite path when replacing B.
5. 에델린's small library hours were not supplied: do not invent hours.
6. This pack contains a fictional web introduction, not a full farming game engine.

QUALITY CHECK: Rowen A work/greet were NOT included because automatic extraction damaged them. Use idle only until proper individual sprites are regenerated. Edelin pose sprites passed a basic visual check but may need edge touch-up.
