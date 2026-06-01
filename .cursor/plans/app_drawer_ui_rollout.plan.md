---
name: App Drawer UI Rollout
overview: Roll out FormDrawer, FormDialog, RowActionsMenu, and ContentCard/TableScrollArea patterns across all ERP modules—PMS is the reference; migrate POS, Inventory, Accounting, HR, and Settings in phases.
todos:
  - id: foundation-docs
    content: Add docs/ui-patterns.md with decision matrix, toolbar/table/field standards, z-index notes
    status: completed
  - id: pos-payment-dialog
    content: "POS orders-tab: replace fixed payment overlay with FormDialog; ContentCard + TableScrollArea; RowActionsMenu"
    status: completed
  - id: pos-menu-drawers
    content: "POS menu-tab: category/item create-edit in FormDrawer sm; ContentCard lists; remove inline white cards"
    status: completed
  - id: pos-orders-drawer
    content: "POS orders-tab: new order composer in FormDrawer lg"
    status: completed
  - id: pos-e2e-docs
    content: Update pos e2e + docs/pos-module.md UI section
    status: completed
  - id: inventory-migration
    content: "Inventory items + recipes tabs: FormDrawer, ContentCard, TableScrollArea"
    status: completed
  - id: accounting-migration
    content: "Accounting page: journal/account forms to drawer/dialog; list polish"
    status: completed
  - id: hr-migration
    content: "HR page: employee add/edit drawers; small forms to dialog/drawer sm"
    status: completed
  - id: settings-migration
    content: "Settings: branch/org/pool forms to FormDrawer sm"
    status: completed
isProject: false
---

# App-wide UI: drawers + responsive lists

See [docs/ui-patterns.md](../../docs/ui-patterns.md). **PMS** and **POS** are complete. **Inventory** in progress.
