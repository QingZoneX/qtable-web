import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentPath = path.join(
  root,
  "src/components/SmartTable/TemplateSelector.tsx",
);
const stylesheetPath = path.join(
  root,
  "src/components/SmartTable/templateSelector.css",
);

const component = fs.readFileSync(componentPath, "utf8");
const stylesheet = fs.readFileSync(stylesheetPath, "utf8");
const failures = [];

function requireText(source, needle, message) {
  if (!source.includes(needle)) failures.push(message);
}

requireText(
  component,
  'import "./templateSelector.css";',
  "TemplateSelector must load its dedicated layout stylesheet.",
);
requireText(
  component,
  'rootClassName="qtable-template-selector-modal"',
  "TemplateSelector modal must expose a scoped root class.",
);
requireText(
  component,
  'data-testid="template-category-rail"',
  "Template categories must be exposed as a persistent navigation rail.",
);
requireText(
  component,
  'className={`qtable-template-category-item${selected ? " is-selected" : ""}`}',
  "Template category navigation must expose its selected state.",
);
requireText(
  component,
  'const BLANK_TEMPLATE_ID = "blank";',
  "The repository-owned blank template must have a stable display-order key.",
);
requireText(
  component,
  'if (left.id === BLANK_TEMPLATE_ID) return -1;',
  "Blank template must be pinned to the first position in the all-category view.",
);
requireText(
  component,
  'if (category !== "all") return 0;',
  "Blank-template pinning must not disturb category-specific catalog order.",
);
requireText(
  component,
  "function TemplateCover",
  "Template cards must render a visual cover rather than icon-only content.",
);
requireText(
  component,
  '<TemplateCover template={template} />',
  "Every rendered template card must include its visual cover.",
);
requireText(
  component,
  'onDoubleClick={() => handleUseTemplate(template)}',
  "Double-click creation must target the card that was activated, not stale preview state.",
);
requireText(
  component,
  'className="qtable-template-list-region"',
  "The template list must keep a dedicated scroll region.",
);
requireText(
  component,
  'className="qtable-template-preview-scroll"',
  "The preview details must keep an independent scroll region.",
);
requireText(
  component,
  "templateListRef.current?.scrollTo({ top: 0 });",
  "Template list scroll position must reset after scope/filter changes.",
);
requireText(
  component,
  "previewScrollRef.current?.scrollTo({ top: 0 });",
  "Preview scroll position must reset when the selected template changes.",
);
requireText(
  component,
  "aria-pressed={selected}",
  "Selectable template cards must expose their selected state.",
);

if (component.includes("<Select")) {
  failures.push(
    "The desktop category dropdown must not return; categories now belong in the left navigation rail.",
  );
}
if (/maxHeight\s*:\s*430/.test(component)) {
  failures.push(
    "The legacy 430px inline list cap must not return; it caused the blank lower pane.",
  );
}

requireText(
  stylesheet,
  "grid-template-columns: 164px minmax(0, 1fr) 340px;",
  "Desktop Template Center must reserve a left category rail, template gallery, and preview column.",
);
requireText(
  stylesheet,
  ".qtable-template-category-rail",
  "Left-side category navigation styles are missing.",
);
requireText(
  stylesheet,
  ".qtable-template-cover",
  "Template cover styles are missing.",
);
requireText(
  stylesheet,
  ".qtable-template-card.is-blank-template .qtable-template-cover-icon",
  "Blank template needs a distinctive create-from-scratch cover treatment.",
);
requireText(
  stylesheet,
  "height: min(760px, calc(100dvh - 230px));",
  "Desktop template center height must remain bounded by the viewport.",
);
requireText(
  stylesheet,
  ".qtable-template-list-region",
  "Template list scroll-region styles are missing.",
);
requireText(
  stylesheet,
  "overflow-y: auto;",
  "Template center must use internal vertical scrolling instead of growing indefinitely.",
);
requireText(
  stylesheet,
  ".qtable-template-preview-footer",
  "Preview actions must remain outside the scrolling details section.",
);
requireText(
  stylesheet,
  "@media (max-width: 1120px)",
  "Template center must adapt its three-pane layout on narrower desktop/tablet screens.",
);
requireText(
  stylesheet,
  "@media (max-width: 760px)",
  "Category navigation must gain a compact narrow-screen treatment.",
);
requireText(
  stylesheet,
  "@media (max-width: 560px)",
  "Template cards need a single-column mobile layout.",
);

for (const category of [
  "general",
  "project",
  "product",
  "sales",
  "operations",
  "people",
  "finance",
  "asset",
]) {
  requireText(
    stylesheet,
    `.category-${category}`,
    `Template category ${category} must have a distinct visual theme.`,
  );
}

if (failures.length > 0) {
  console.error("Template selector layout contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Template selector layout contract passed.");
