# Phase 5.2 Product Catalog

Phase 5.2 keeps Product records in workspace-scoped preview storage. No database
tables, external commerce integrations, or order execution behavior are added in
this phase.

## Future Order Compatibility

Phase 5.3 Orders should create immutable order-line snapshots when a Product or
Variant is selected. Order lines should copy the product name, variant name, SKU,
unit price, currency, and quantity at the moment the Order is created.

Changing a Product later must not rewrite historical Order Lines.
