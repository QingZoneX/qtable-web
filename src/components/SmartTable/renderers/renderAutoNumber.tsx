/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from "../utils/vtable-jsx";
import type { Field } from "../../../store/useSmartTableStore";
import { renderText } from "./renderText";
import { formatAutoNumber } from "../utils/autoNumber";

void jsx;

type AutoNumberLayoutArgs = Parameters<typeof renderText>[0];

export const renderAutoNumber = (
  args: AutoNumberLayoutArgs,
  field: Field,
) =>
  renderText({
    ...args,
    value: formatAutoNumber(field, args.value),
  });
