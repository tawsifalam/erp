# UI patterns: drawers, dialogs, and lists

Standard patterns for ERP web screens. **PMS** is the reference implementation.

## Shell components

| Component | Path | Use |
|-----------|------|-----|
| `FormDrawer` | `apps/web/src/components/form-drawer.tsx` | Create/edit with 5+ fields or sections (`sm` / `md` / `lg`) |
| `FormDialog` | `apps/web/src/components/form-dialog.tsx` | ≤4 fields (payment amount, quick confirm) |
| `FormSection` | `apps/web/src/components/form-section.tsx` | Section headings inside large drawers |
| `RowActionsMenu` | `apps/web/src/components/row-actions-menu.tsx` | Secondary row actions (⋯ trigger, `aria-label="Actions"`) |
| `ContentCard` | `@erp/ui` | List and page sections |
| `TableScrollArea` | `@erp/ui` | Horizontal scroll for wide tables |
| `useConfirmDialog` | `apps/web/src/lib/use-confirm-dialog.tsx` | Delete and destructive confirms |

## Responsive drawer behavior

| Viewport | Placement | Notes |
|----------|-----------|--------|
| `< md` | Bottom sheet, ~92dvh | Full-width; rounded top |
| `md+` | Right (`end`) | Width by size: sm ~360px, md ~420px, lg ~480px |

Footer buttons stack full-width on mobile (`column-reverse` so primary is on top).

**Z-index:** backdrop/content `1400`–`1499`, row menus `1450`, mobile nav `1500`.

## When to use what

- **FormDrawer** — CRUD forms, recipes/BOMs, multi-section reservation/order forms.
- **FormDialog** — Payment amount, single-step confirms.
- **Inline panel** — Rare exception for live workspaces (e.g. building a POS cart) if product prefers; prefer `FormDrawer` lg for consistency.
- **Do not add** new `position="fixed"` form overlays.

## Page layout

```tsx
<Flex gap={2} mb={4} wrap="wrap">
  <Button size="sm" onClick={load}>Refresh</Button>
  <Button size="sm" colorPalette="blue" w={{ base: "full", sm: "auto" }} onClick={openCreate}>
    + Add …
  </Button>
</Flex>

<ContentCard p={0} overflow="hidden">
  <TableScrollArea>
    <Table.Root size="sm">…</Table.Root>
  </TableScrollArea>
</ContentCard>
```

## Fields inside drawers

- `FormField` from `@erp/ui` with `width="100%"` inputs/selects.
- `Stack gap={4}` between fields; `SimpleGrid columns={{ base: 1, sm: 2 }}` for pairs only.
- Hide non-critical table columns: `display={{ base: "none", md: "table-cell" }}`.

## Row actions

- Keep **one or two primary** actions visible (Confirm, Check in, Send to kitchen, Complete & pay).
- Move Payment, Edit, Cancel, Delete, etc. to `RowActionsMenu`.

## Testing

- E2E: open via drawer title; secondary actions via `getByRole("button", { name: "Actions" })` then `menuitem`.
- Helper: `apps/web/e2e/helpers/row-actions.ts`.
- Mobile: `page.setViewportSize({ width: 375, height: 812 })` for drawer smoke tests.

## Module docs

Each module doc should link here and note drawer usage: `pms-module.md`, `pos-module.md`, `inventory-module.md`, etc.
