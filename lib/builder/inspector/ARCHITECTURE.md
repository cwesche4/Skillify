# Inspector Architecture (Locked)

- Import Inspector UI via the barrel `lib/builder/inspector/components`.
- InspectorPanel must remain a composition-only orchestrator; JSX lives in subcomponents.
- Side-effects, storage, telemetry, and AI helpers run in hooks under `lib/builder/inspector/hooks`.
- Hooks responsibilities:
  - `useInspectorSettings`: load/save Inspector AI settings (localStorage keys unchanged).
  - `useInspectorWorkMode`: load/save work mode, default tab handling.
  - `useInspectorPresets`: manage presets per workspace + node type (`skillify.inspector.presets.{workspaceId}.{nodeType}`).
  - `useInspectorTelemetry`: wraps telemetry helpers; no direct use inside components.
  - `useInspectorAI`: scoring, suggestions, diff/autofix state (no storage access in components).
  - `useInspectorValidation`: validation wrapper.
- Invariants:
  - Storage keys and telemetry event names stay unchanged.
  - Dock side/width preset/follow-selection handling unchanged.
  - AI is optional and must be disable-able.
- Do not import internal files directly; always use the barrel exports.
