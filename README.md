# ComfyUI-CrosshairGuidelines

https://github.com/user-attachments/assets/94340d82-08f5-41cd-9a0d-37e0e9b56d1a

Crosshair guidelines for ComfyUI to help align nodes and groups while moving or resizing.

### Installation

Install via ComfyUI Manager or clone this repo into `ComfyUI/custom_nodes/ComfyUI-CrosshairGuidelines`.

> [!NOTE]
> Nodes 2.0 support is best-effort and may vary slightly between ComfyUI releases.

* * *

### Features

- Crosshair guidelines on move and resize (nodes and groups).
- Adjustable move, resize, and idle modes.
- Customizable color and line thickness.
- Link and node opacity dimming so the active object stays visually prominent.
- Optional hiding of the active outline during move/resize.

* * *

### Settings

All settings appear under `Crosshair Guidelines` in ComfyUI settings.

- `move_mode`: `off` or `all`.
- `resize_mode`: `off`, `selected`, or `all`.
- `idle_mode`: `off` or `all`.
- `color`: Any CSS color value (hex, rgb, hsl, or named colors).
- `thickness`: Line width in pixels.
- `link_opacity`: Multiplier for link opacity during move/resize (0–1).
- `node_opacity`: Multiplier for node/group opacity during move/resize (0–1).
- `hide_active_outline`: Hides the active node/group outline while moving or resizing.

* * *

### Notes

- `link_opacity` and `node_opacity` affect all objects except the active one.
- The JavaScript is unavoidably large (6k+ lines!) because it contains a lot of defensive compatibility logic for different ComfyUI / LiteGraph / Nodes 2.0 variants, plus input handling and rendering edge cases.
- Tested on Microsoft Edge.