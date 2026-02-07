All notable changes to this project will be documented in this file.

<details><summary>0.2.0 - 7 February 2026</summary>

### Added
- Added a `CTRL behavior` setting with options to show crosshairs, hide crosshairs, or ignore Ctrl/Meta (`off`) while moving/resizing an already-selected node or group.

### Fixed
- Fixed crosshairs appearing during Ctrl/Meta marquee multi-selection by explicitly suppressing guideline rendering while a selection rectangle is active.
- Updated the Crosshair color tooltip to document support for hex values with alpha (for example `#RRGGBBAA`).

</details>

<details><summary>0.1.2 - 6 February 2026</summary>

### Fixed
- Fixed intermittent extra crosshairs during group moves (especially after tab switching) by prioritizing explicit group interactions over node move targets during interaction-state resolution.
- Fixed stale crosshair interaction state persisting across tab switches by resetting pointer/interaction state on document `visibilitychange` when the page becomes hidden.

</details>

<details><summary>0.1.1 - 6 January 2026</summary>

### Fixed
- Fixed false connection-latch suppression when starting a node/group move near slot-label edges by releasing the slot latch as soon as real move/resize activity is detected without an active Comfy link-drag state.

</details>

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
- Removed redundant node-bounds recalculations in resize-candidate detection.

</details>

<details><summary>0.0.1 - 5 January 2026</summary>

### Added
- Initial release

</details>
