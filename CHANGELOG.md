All notable changes to this project will be documented in this file.

<details><summary>0.1.0 - 6 January 2026</summary>

### Fixed
- Fixed Nodes 2.0 node-move guideline placement by converting global pointer `clientX/clientY` to canvas-local coordinates before graph-space conversion.
- Fixed Nodes 2.0 node-resize guideline flicker by adding a resize-session latch that preserves the active resize target/corner across transient frame-state drops.
- Fixed crosshairs appearing while multi-select modifier is active by tracking `Ctrl`/`Meta` state across pointer and keyboard events and suppressing guideline rendering while active.
- Fixed crosshairs appearing while dragging from node input slots to create links by treating input handles/proximity as connection drag state (same suppression path as output-link drags).
- Fixed settings panel labeling by using settings `category` arrays with the top-level label `Crosshair Guidelines`.
- Fixed crosshairs getting stuck hidden after dragging groups/nodes across another node's input/output slots by removing mid-drag connection-slot latching from interaction-state evaluation.
- Fixed Nodes 2.0 output-link drags intermittently showing crosshairs by adding connection-slot fallback hit detection when no node-body hit is present and by honoring immediate canvas link-drag state at pointer-down.
- Fixed output/input link drags started from slot label text (e.g., `STRING`) by expanding slot hit detection from point-only to slot-row/label hitboxes, improving consistency in both classic and Nodes 2.0.
- Tuned slot-row/label hitbox calibration to better catch uppercase-label edge cases (e.g., `IMAGE`) where dragging from the text-to-socket gap could still show crosshairs. Not yet perfect in Nodes 2.0.
- Removed redundant node-bounds recalculations in resize-candidate detection.

</details>

<details><summary>0.0.1 - 5 January 2026</summary>

### Added
- Initial release

</details>
