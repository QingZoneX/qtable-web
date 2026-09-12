/** @jsxRuntime classic */
/** @jsx jsx */
import dayjs from "dayjs";
import { jsx, type LayoutComponent, type CustomLayoutLike } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import type { Field } from "../../../store/useSmartTableStore";
import { getTextColor } from "../utils/colorUtils";
import { measureTextWidth } from "../utils/textUtils";
import { svgToDataUrl, alignLeftOutlinedSvg, userOutlinedSvg, radioOutlinedSvg, calendarOutlinedSvg, linkOutlinedSvg, pictureOutlinedSvg, checkSquareOutlinedSvg, starFilledSvg, starOutlinedSvg } from "../icons";

void jsx;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CellLayoutArgs = {
  table: {
    getCellRect: (col: number, row: number) => { height: number; width: number };
    getRecordByRowCol?: (col: number, row: number) => Record<string, unknown> | null;
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
  data?: {
    id?: string;
    isGroup?: boolean;
    vtableMerge?: boolean;
    [key: string]: unknown;
  };
};

// ---------------------------------------------------------------------------
// Defaults (re-export from @visactor/vtable for backward compat)
// ---------------------------------------------------------------------------

const defaultLayout: CustomLayoutLike = {
  Group: CustomLayout.Group as unknown as LayoutComponent,
  Text: CustomLayout.Text as unknown as LayoutComponent,
  Image: CustomLayout.Image as unknown as LayoutComponent,
  Tag: CustomLayout.Tag as unknown as LayoutComponent,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ELLIPSIS = "...";
const TAG_GAP = 8;
const TAG_HEIGHT = 24;
const TAG_PADDING_LEFT = 6;
const TAG_PADDING_RIGHT = 8;
const AVATAR_SIZE = 18;
const AVATAR_GAP = 6;
const NAME_FONT_SIZE = 13;
const TAG_PADDING = 16;
const CELL_PADDING_X = 8;

const clampTextToWidth = (text: string, maxWidth: number) => {
  const target = Math.max(0, maxWidth);
  if (measureTextWidth(text, NAME_FONT_SIZE) <= target) return text;
  const ellipsisWidth = measureTextWidth(ELLIPSIS, NAME_FONT_SIZE);
  if (ellipsisWidth >= target) return ELLIPSIS;
  let left = 0;
  let right = text.length;
  let best = "";
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const candidate = text.slice(0, mid);
    const width = measureTextWidth(candidate, NAME_FONT_SIZE) + ellipsisWidth;
    if (width <= target) {
      best = candidate;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return `${best}${ELLIPSIS}`;
};

const getMemberInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const getTagWidth = (nameWidth: number) =>
  TAG_PADDING_LEFT + AVATAR_SIZE + AVATAR_GAP + nameWidth + TAG_PADDING_RIGHT;

const getMoreTagWidth = (moreText: string) =>
  TAG_PADDING_LEFT + measureTextWidth(moreText, NAME_FONT_SIZE) + TAG_PADDING_RIGHT;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRenderers(CL: CustomLayoutLike = defaultLayout) {
  const Group = CL.Group;
  const Text = CL.Text;
  const Image = CL.Image;
  const Tag = CL.Tag!;

  // -- Text ----------------------------------------------------------------

  const renderText = (args: CellLayoutArgs) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = args.value;
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);

    if (value !== null && value !== undefined && value !== "") {
      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            <Text attribute={{ text: String(value), fontSize: 13, fontFamily: "sans-serif", fill: "#111827", maxLineWidth: innerWidth, ellipsis: true }} />
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(alignLeftOutlinedSvg) }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- Number --------------------------------------------------------------

  const renderNumber = (args: CellLayoutArgs, field: Field) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = args.value;
    const unit = field.property?.unit || "";
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);

    if (value !== null && value !== undefined && value !== "") {
      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            <Text attribute={{ text: `${unit}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, fontSize: 13, fontFamily: "sans-serif", fontWeight: "bold", fill: "#111827" }} />
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ width, height }} />
      ),
      renderDefault: false,
    };
  };

  // -- Date ----------------------------------------------------------------

  const renderDate = (args: CellLayoutArgs, field: Field) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = args.value;
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);

    if (value) {
      const format = field.property?.format || "MMM DD, YYYY";
      const dateValue =
        typeof value === "string" || typeof value === "number" || value instanceof Date
          ? value
          : null;
      const dateStr = dayjs(dateValue).format(format);

      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            <Text attribute={{ text: dateStr, fontSize: 13, fontFamily: "sans-serif", fill: "#4B5563" }} />
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(calendarOutlinedSvg), opacity: 0.5 }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- Select --------------------------------------------------------------

  const renderSelect = (args: CellLayoutArgs, field: Field) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = args.value;
    const options = field.options || [];
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);

    if (value) {
      const selectedOption =
        options.find((opt) => opt.id === value) ||
        options.find((opt) => opt.label === value);

      if (selectedOption) {
        const { label, color } = selectedOption;
        return {
          rootContainer: (
            <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
              <Tag attribute={{ text: label.toUpperCase(), padding: [4, 8, 4, 8], textStyle: { fontSize: 10, fontWeight: "bold", fill: getTextColor(color), fontFamily: "sans-serif" }, panel: { visible: true, fill: color, cornerRadius: 4 } }} />
            </Group>
          ),
          renderDefault: false,
        };
      }
      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            <Text attribute={{ text: value, fontSize: 14, fill: "#222329" }} />
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(radioOutlinedSvg) }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- Multi-Select --------------------------------------------------------

  const renderMultiSelect = (args: CellLayoutArgs, field: Field) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const values = args.value;
    const options = field.options || [];
    const innerWidth = Math.max(0, width - CELL_PADDING_X * 2);

    if (Array.isArray(values) && values.length > 0) {
      const availableWidth = innerWidth;
      let usedWidth = 0;
      let showCount = 0;

      const selectedOptions = values.map((val) => {
        const opt =
          options.find((o) => o.id === val) ||
          options.find((o) => o.label === val);
        return opt
          ? { ...opt, label: opt.label }
          : { label: val, color: "#e0e0e0" };
      });

      for (let i = 0; i < selectedOptions.length; i++) {
        const option = selectedOptions[i];
        const textWidth = measureTextWidth(option.label, 12);
        const tagWidth = textWidth + TAG_PADDING;
        const nextUsedWidth =
          usedWidth + tagWidth + (showCount > 0 ? TAG_GAP : 0);
        const remainingCount = selectedOptions.length - (i + 1);

        if (remainingCount > 0) {
          const moreText = `+${remainingCount}`;
          const moreWidth = measureTextWidth(moreText, 12) + TAG_PADDING;
          const requiredWidth = nextUsedWidth + TAG_GAP + moreWidth;
          if (requiredWidth > availableWidth) {
            if (showCount === 0) showCount = 1;
            break;
          }
        } else if (nextUsedWidth > availableWidth) {
          if (showCount === 0) showCount = 1;
          break;
        }

        usedWidth = nextUsedWidth;
        showCount += 1;
      }

      const tags = [];
      for (let i = 0; i < showCount; i++) {
        const option = selectedOptions[i];
        const color = option.color || "#e0e0e0";
        tags.push(
          <Tag attribute={{ text: option.label, padding: [4, 8, 4, 8], textStyle: { fontSize: 12, fill: getTextColor(color), fontFamily: "sans-serif" }, panel: { visible: true, fill: color, cornerRadius: 4 }, marginRight: i < showCount - 1 ? TAG_GAP : 0 }} />,
        );
      }

      if (showCount < selectedOptions.length) {
        const moreCount = selectedOptions.length - showCount;
        tags.push(
          <Tag attribute={{ text: `+${moreCount}`, padding: [4, 8, 4, 8], textStyle: { fontSize: 12, fill: "#222329", fontFamily: "sans-serif" }, panel: { visible: true, fill: "#f0f0f0", cornerRadius: 4 }, marginLeft: TAG_GAP }} />,
        );
      }

      return {
        rootContainer: (
          <Group attribute={{ x: CELL_PADDING_X, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            {tags}
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x: CELL_PADDING_X, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(checkSquareOutlinedSvg) }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- Member --------------------------------------------------------------

  const renderMember = (args: CellLayoutArgs, field: Field) => {
    const { table, row, col, rect } = args;
    const record = table.getRecordByRowCol?.(col, row);
    const { height, width } = rect ?? table.getCellRect(col, row);
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);
    const fieldValue = args.value ?? record?.[field.id];
    const userIds = Array.isArray(fieldValue)
      ? fieldValue
      : fieldValue
        ? [fieldValue]
        : [];

    const options = field.options || [];

    if (userIds.length > 0) {
      const members = userIds.map((userId: string) => {
        const userOpt = options.find((opt) => opt.id === userId);
        const userName = userOpt ? userOpt.label : userId;
        return { userId, userName, initials: getMemberInitials(userName) };
      });

      const availableWidth = innerWidth;
      const visibleMembers: Array<{ userId: string; userName: string; initials: string; displayName: string }> = [];
      let usedWidth = 0;
      const minNameWidth = measureTextWidth(ELLIPSIS, NAME_FONT_SIZE);
      const minTagWidth = getTagWidth(minNameWidth);

      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const remaining = members.length - i - 1;
        const moreText = remaining > 0 ? `+${remaining}` : "";
        const moreTagWidth = remaining > 0 ? getMoreTagWidth(moreText) : 0;
        const gapBefore = visibleMembers.length > 0 ? TAG_GAP : 0;
        const reserveForMore = remaining > 0 ? TAG_GAP + moreTagWidth : 0;
        const maxTagWidth = availableWidth - usedWidth - gapBefore - reserveForMore;

        if (maxTagWidth <= 0) break;
        if (maxTagWidth < minTagWidth && visibleMembers.length > 0) break;

        const nameWidthLimit = maxTagWidth - TAG_PADDING_LEFT - AVATAR_SIZE - AVATAR_GAP - TAG_PADDING_RIGHT;
        const displayName = clampTextToWidth(member.userName, nameWidthLimit);
        const actualNameWidth = measureTextWidth(displayName, NAME_FONT_SIZE);
        const tagWidth = getTagWidth(actualNameWidth);
        usedWidth += gapBefore + tagWidth;

        visibleMembers.push({ ...member, displayName });
      }

      const moreCount = members.length - visibleMembers.length;

      const tags = visibleMembers.map((member) => (
        <Group key={member.userId} attribute={{ height: TAG_HEIGHT, display: "flex", alignItems: "center", padding: [0, TAG_PADDING_RIGHT, 0, TAG_PADDING_LEFT], cornerRadius: TAG_HEIGHT / 2, fill: "#F3F4F6", border: { width: 1, color: "#E5E7EB" }, marginRight: TAG_GAP }}>
          <Group attribute={{ width: AVATAR_SIZE, height: AVATAR_SIZE, cornerRadius: AVATAR_SIZE / 2, fill: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", marginRight: AVATAR_GAP, border: { width: 1, color: "#E5E7EB" } }}>
            <Text attribute={{ text: member.initials, fontSize: 9, fill: "#5F6B7C", fontWeight: 600 }} />
          </Group>
          <Text attribute={{ text: member.displayName, fontSize: NAME_FONT_SIZE, fill: "#111827" }} />
        </Group>
      ));

      if (moreCount > 0) {
        const moreLabel = `+${moreCount}`;
        const moreTagWidth = Math.max(TAG_HEIGHT, getMoreTagWidth(moreLabel));
        tags.push(
          <Group attribute={{ height: TAG_HEIGHT, width: moreTagWidth, display: "flex", alignItems: "center", justifyContent: "center", cornerRadius: TAG_HEIGHT / 2, fill: "#F3F4F6", border: { width: 1, color: "#E5E7EB" } }}>
            <Text attribute={{ text: moreLabel, fontSize: 12, fill: "#222329" }} />
          </Group>,
        );
      }

      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center", flexWrap: "nowrap" }}>
            {tags}
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(userOutlinedSvg) }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- URL -----------------------------------------------------------------

  const renderUrl = (args: CellLayoutArgs) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = args.value;
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);

    if (value) {
      const textValue = typeof value === "string" ? value : String(value);
      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            <Group attribute={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <Image attribute={{ width: 14, height: 14, image: svgToDataUrl(linkOutlinedSvg), marginRight: 4 }} />
              <Text attribute={{ text: textValue.replace(/^https?:\/\//, ""), fontSize: 13, fontFamily: "sans-serif", fill: "#2563EB", underline: 0, maxLineWidth: innerWidth - 18, ellipsis: true }} />
            </Group>
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(linkOutlinedSvg) }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- Image ---------------------------------------------------------------

  const renderImage = (args: CellLayoutArgs) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = args.value;
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);
    const urls: string[] = Array.isArray(value)
      ? value
      : value
        ? [String(value)]
        : [];

    if (urls.length > 0) {
      const thumbSize = 24;
      const gap = 4;
      return {
        rootContainer: (
          <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
            {urls.map((url) => (
              <Image attribute={{ width: thumbSize, height: thumbSize, image: url, shape: "circle", marginRight: gap }} />
            ))}
          </Group>
        ),
        renderDefault: false,
      };
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          <Image attribute={{ width: 16, height: 16, image: svgToDataUrl(pictureOutlinedSvg) }} />
        </Group>
      ),
      renderDefault: false,
    };
  };

  // -- Rating --------------------------------------------------------------

  const renderRating = (args: CellLayoutArgs, field: Field) => {
    const { table, row, col, rect } = args;
    const { height, width } = rect ?? table.getCellRect(col, row);
    const value = Number(args.value) || 0;
    const max = field.property?.max || 5;
    const x = CELL_PADDING_X;
    const innerWidth = Math.max(0, width - x * 2);
    const iconSize = 16;
    const gap = 2;

    const stars = [];
    for (let i = 1; i <= max; i++) {
      const isFilled = i <= value;
      stars.push(
        <Image attribute={{ width: iconSize, height: iconSize, image: svgToDataUrl(isFilled ? starFilledSvg : starOutlinedSvg), marginRight: gap }} />,
      );
    }

    return {
      rootContainer: (
        <Group attribute={{ x, width: innerWidth, height, display: "flex", alignItems: "center" }}>
          {stars}
        </Group>
      ),
      renderDefault: false,
    };
  };

  return {
    renderText,
    renderNumber,
    renderDate,
    renderSelect,
    renderMultiSelect,
    renderMember,
    renderUrl,
    renderImage,
    renderRating,
  };
}
