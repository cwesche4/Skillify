# Grouping UX — Security Pack Automation Builder

Purely visual organization; no execution logic changes. Compatible with ReactFlow v11+.

## Behaviors

- Group node/container with title and optional description.
- Drag nodes in/out of a group; groups only affect layout/organization, not execution order.
- Collapse/expand groups (stored via `collapsed` on group node data); collapsed groups still keep children.
- Nested groups allowed one level deep: nodes may have `parentGroupId`; group nodes may list `groupChildren`.
- Clear visual boundary, hover + selection states inherit from GroupNode styles.
- Keyboard accessible: group selection and focus treated like other nodes; no hidden controls.

## Persistence

- Stored in `Automation.flow` JSON with:
  - `parentGroupId` on nodes to indicate membership (one level).
  - `groupChildren` on group nodes (optional) for UI hints.
  - `collapsed` on group nodes.
- Backward compatible: all fields optional; flows without grouping continue to load.

## Guardrails

- Groups do not alter execution order or edge routing.
- No auto-nesting side effects; dragging sets `parentGroupId` only.
- No implicit behavior changes when collapsing.
- Keep grouping purely visual; entitlements/approvals unaffected.
