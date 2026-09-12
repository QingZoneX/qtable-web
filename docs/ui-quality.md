# UI quality baseline

This document defines the QTableUI release baseline for localization, keyboard accessibility and responsive behavior. It is intentionally enforceable in source-level contracts even when browser E2E infrastructure is unavailable.

## Internationalization

The application locale runtime supports `zh-CN` and `en-US`.

Locale selection follows this order:

1. a valid manual choice stored in `localStorage` under `qtable.language`;
2. the browser's `navigator.languages` / `navigator.language` preference;
3. Simplified Chinese as the final fallback.

Changing the language updates the active translation runtime, `document.documentElement.lang`, Ant Design's component locale, and Day.js locale. The top application bar exposes the language switcher so the preference is not hidden in a setup-only screen.

Use `src/lib/i18nRuntime.ts` for new release-critical user-facing copy. It provides interpolation plus `Intl`-backed number/date helpers. Existing feature-local translation helpers remain compatible because the runtime synchronizes the legacy core language state and the application root re-renders on language changes.

The App Shell and Kanban release surfaces are fully audited by `npm run check:ui-quality`. New hardcoded product copy in those surfaces should be treated as a regression. Other feature modules should migrate incrementally rather than introducing a second locale state.

## Keyboard and assistive technology

The baseline requires:

- a visible `:focus-visible` indicator for keyboard-focusable controls;
- reduced-motion support through `prefers-reduced-motion`;
- a skip link from the application shell to a focusable `<main>` landmark;
- localized navigation labels and `aria-current` for the active primary route;
- status semantics for route/Kanban loading states and alert semantics for failures;
- accessible names for icon-only actions and switches on audited release surfaces;
- keyboard activation for interactive Kanban cards in addition to pointer/drag interaction.

Ant Design dialogs/drawers retain their framework focus-management behavior; custom components must not disable it or remove focus indication globally.

## Responsive behavior

The shell keeps the existing desktop/compact breakpoints and adds an explicit `<=720px` safety layout so navigation, breadcrumbs, global search and workspace switching do not force the content canvas wider than the viewport. The compact state hides secondary labels before removing controls.

Kanban deliberately remains horizontally scrollable instead of shrinking workflow columns until content becomes unusable. Components that own dense desktop workflows should prefer contained overflow or a compact mode over clipping controls.

Minimum release review sizes remain:

- 1440×900
- 1280×800
- 1024×768
- 768px management viewport

Public/mobile-only surfaces can define narrower contracts independently.

## Source-level gate

Run:

```bash
npm run check:ui-quality
npm run lint
npm run build
```

`check:ui-quality` verifies locale persistence/detection, bilingual key parity for the supplemental release catalog, Ant Design/Day.js locale wiring, manual language switching, focus/reduced-motion CSS, skip-link/main semantics, compact shell overflow protection, Kanban horizontal overflow and removal of known hardcoded release copy.

Browser keyboard, screenshot and viewport E2E remain valuable evidence, but their temporary unavailability must not allow source-level regressions to re-enter the product.
