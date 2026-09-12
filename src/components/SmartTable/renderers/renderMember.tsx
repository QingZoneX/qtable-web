/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import { svgToDataUrl, userOutlinedSvg } from "../icons";
import { measureTextWidth } from "../utils/textUtils";
import type { Field } from "../../../store/useSmartTableStore";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;

const TAG_GAP = 8;
const TAG_HEIGHT = 24;
const TAG_PADDING_LEFT = 6;
const TAG_PADDING_RIGHT = 8;
const AVATAR_SIZE = 18;
const AVATAR_GAP = 6;
const NAME_FONT_SIZE = 13;
const ELLIPSIS = "...";

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
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const getTagWidth = (nameWidth: number) =>
  TAG_PADDING_LEFT + AVATAR_SIZE + AVATAR_GAP + nameWidth + TAG_PADDING_RIGHT;

const getMoreTagWidth = (moreText: string) =>
  TAG_PADDING_LEFT +
  measureTextWidth(moreText, NAME_FONT_SIZE) +
  TAG_PADDING_RIGHT;

type CellLayoutArgs = {
  table: {
    getCellRect: (col: number, row: number) => { height: number; width: number };
    getRecordByRowCol: (col: number, row: number) => Record<string, unknown> | null;
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
};

export const renderMember = (args: CellLayoutArgs, field: Field) => {
  const { table, row, col, rect } = args;
  const record = table.getRecordByRowCol(col, row);
  const { height, width } = rect ?? table.getCellRect(col, row);
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);
  const fieldValue = args.value ?? record?.[field.id];
  const extractUserId = (value: unknown): string => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const candidate = value as {
        id?: unknown;
        userId?: unknown;
        user_id?: unknown;
        value?: unknown;
      };
      const raw =
        candidate.id ?? candidate.userId ?? candidate.user_id ?? candidate.value;
      return raw == null ? "" : String(raw);
    }
    return value == null ? "" : String(value);
  };
  const userIds = (
    Array.isArray(fieldValue) ? fieldValue : fieldValue ? [fieldValue] : []
  )
    .map(extractUserId)
    .filter(Boolean);

  const options = field.options || [];

  if (userIds.length > 0) {
    const members = userIds.map((userId: string) => {
      const userOpt = options.find((opt) => opt.id === userId);
      const userName = userOpt ? userOpt.label : userId;
      return {
        userId,
        userName,
        initials: getMemberInitials(userName),
      };
    });

    const availableWidth = innerWidth;
    const visibleMembers: Array<{
      userId: string;
      userName: string;
      initials: string;
      displayName: string;
    }> = [];
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
      const maxTagWidth =
        availableWidth - usedWidth - gapBefore - reserveForMore;

      if (maxTagWidth <= 0) break;
      if (maxTagWidth < minTagWidth && visibleMembers.length > 0) break;

      const nameWidthLimit =
        maxTagWidth -
        TAG_PADDING_LEFT -
        AVATAR_SIZE -
        AVATAR_GAP -
        TAG_PADDING_RIGHT;
      const displayName = clampTextToWidth(member.userName, nameWidthLimit);
      const actualNameWidth = measureTextWidth(displayName, NAME_FONT_SIZE);
      const tagWidth = getTagWidth(actualNameWidth);
      usedWidth += gapBefore + tagWidth;

      visibleMembers.push({
        ...member,
        displayName,
      });
    }

    const moreCount = members.length - visibleMembers.length;

    const tags = visibleMembers.map((member) => (
      <Group
        key={member.userId}
        attribute={{
          height: TAG_HEIGHT,
          display: "flex",
          alignItems: "center",
          padding: [0, TAG_PADDING_RIGHT, 0, TAG_PADDING_LEFT],
          cornerRadius: TAG_HEIGHT / 2,
          fill: "#F3F4F6",
          border: {
            width: 1,
            color: "#E5E7EB",
          },
          marginRight: TAG_GAP,
        }}
      >
        <Group
          attribute={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            cornerRadius: AVATAR_SIZE / 2,
            fill: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: AVATAR_GAP,
            border: {
              width: 1,
              color: "#E5E7EB",
            },
          }}
        >
          <Text
            attribute={{
              text: member.initials,
              fontSize: 9,
              fill: "#5F6B7C",
              fontWeight: 600,
            }}
          />
        </Group>
        <Text
          attribute={{
            text: member.displayName,
            fontSize: NAME_FONT_SIZE,
            fill: "#111827",
          }}
        />
      </Group>
    ));

    if (moreCount > 0) {
      const moreLabel = `+${moreCount}`;
      const moreTagWidth = Math.max(TAG_HEIGHT, getMoreTagWidth(moreLabel));
      tags.push(
        <Group
          attribute={{
            height: TAG_HEIGHT,
            width: moreTagWidth,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cornerRadius: TAG_HEIGHT / 2,
            fill: "#F3F4F6",
            border: {
              width: 1,
              color: "#E5E7EB",
            },
          }}
        >
          <Text
            attribute={{
              text: moreLabel,
              fontSize: 12,
              fill: "#222329",
            }}
          />
        </Group>,
      );
    }

    return {
      rootContainer: (
        <Group
          attribute={{
            x,
            width: innerWidth,
            height,
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
          }}
        >
          {tags}
        </Group>
      ),
      renderDefault: false,
    };
  }

  // Placeholder
  return {
    rootContainer: (
      <Group
        attribute={{
          x,
          width: innerWidth,
          height,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Image
          attribute={{
            width: 16,
            height: 16,
            image: svgToDataUrl(userOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
