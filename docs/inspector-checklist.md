# Inspector QA Checklist (Builder)

- Toggle Inspector with `]` and via command palette.
- Dock left/right and verify layout reflows; resize handle works on both sides.
- Apply width presets (Compact/Standard/Wide) and persistence across reloads.
- Pin/unpin Inspector; when unpinned, clearing selection auto-closes if follow-selection is on.
- Follow-selection toggle: selecting a node opens Inspector; clearing selection closes (if not pinned).
- Mobile/narrow viewport: Inspector renders as overlay/drawer, backdrop click closes, no canvas overflow.
- Minimap offsets away from Inspector when open/resized/dock changes.
- Unknown/draft nodes render safely with a copyable schema stub; no crashes.
- Command Center entries exist for Inspector toggle, dock, pin, follow-selection, and presets.
