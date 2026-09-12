# QTable Design System v1

QTable uses one semantic token source: `src/styles/tokens.ts`.

## Principles

- 4px spacing grid.
- Blue is reserved for primary/current/action semantics.
- Green = success/completed, orange = warning, red = danger/overdue, purple = AI/special.
- Product surfaces stay neutral and low-noise.
- Grid density defaults to 44px rows.
- Keyboard focus must always remain visible.
- New product UI must consume semantic tokens instead of introducing new raw brand colors.

## Typography

| Role | Size | Line height |
| --- | ---: | ---: |
| Page title | 24px | 32px |
| Section title | 18px | 24px |
| Body | 14px | 22px |
| Table body | 13px | 20px |
| Label / secondary | 12px | 18px |
| Micro metadata | 11px | 16px |

The shared font stack includes macOS, Windows and common Chinese system fallbacks.

## Spacing

Use 4 / 8 / 12 / 16 / 20 / 24px. Avoid inventing one-off spacing values for new components.

## Radius

- 6px: compact controls and small interactive elements.
- 8px: normal controls and medium surfaces.
- 12px: cards, drawers and large surfaces.
- 999px: pills only.

## Control and density sizes

- App bar target: 64px.
- Compact control: 32px.
- Normal control: 36px.
- Primary CTA: 40px when a larger primary action is needed.
- Table density: compact 36px / default 44px / comfortable 52px.

## Runtime architecture

`src/styles/tokens.ts` drives all three styling systems:

1. **Ant Design** via the single `ConfigProvider` in `src/App.tsx`.
2. **VTable** via `src/components/SmartTable/config/theme.ts`.
3. **Tailwind/CSS** via CSS variables installed by `installQTableCssVariables()` and mapped in `src/index.css @theme`.

Do not add nested `ConfigProvider` instances to individual pages. A page-level provider creates token drift and is blocked by `npm run check:design-system`.

## Accessibility baseline

- Never remove `:focus-visible` globally.
- Icon-only actions require an accessible name and should normally expose a Tooltip.
- Respect `prefers-reduced-motion`.
- Do not encode critical state by color alone.

## Loading / empty / error baseline

For new async product surfaces, implement all three states explicitly:
- loading: Skeleton/spinner without layout jump;
- empty: explain what is empty and offer the next action when appropriate;
- error: persistent state with retry or recovery action; do not rely on a transient toast alone.

## Migration policy

This issue establishes the foundation. Existing large page-level inline styles are migrated when their page is redesigned:
- App Shell/Header/Sidebar: #44
- Table toolbar/view tabs: #48
- Record detail: #46
- Kanban: #49
- Dashboard: #53

New code should not add a competing raw primary color or a new page-local theme.

## Validation

Run:

```bash
npm run check:design-system
npm run lint
npm run build
```

CI also runs the design-system contract before the production build.
