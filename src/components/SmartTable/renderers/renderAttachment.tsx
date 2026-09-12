/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, type LayoutComponent } from "../utils/vtable-jsx";
import { CustomLayout } from "@visactor/vtable";
import {
  svgToDataUrl,
  fileOutlinedSvg,
  pdfOutlinedSvg,
  docOutlinedSvg,
  xlsOutlinedSvg,
  zipOutlinedSvg,
  videoOutlinedSvg,
} from "../icons";
import { measureTextWidth } from "../utils/textUtils";
import {
  stableAttachments,
  type AttachmentItem,
} from "../attachments/attachmentApi";

void jsx;

const Group = CustomLayout.Group as unknown as LayoutComponent;
const Image = CustomLayout.Image as unknown as LayoutComponent;
const Text = CustomLayout.Text as unknown as LayoutComponent;

type CellLayoutArgs = {
  table: {
    getCellRect: (
      col: number,
      row: number,
    ) => { height: number; width: number };
  };
  row: number;
  col: number;
  rect?: { height: number; width: number };
  value?: unknown;
};

const getFileIcon = (attachment: AttachmentItem) => {
  const type = attachment.contentType || "";
  if (type === "application/pdf") return pdfOutlinedSvg;
  if (type.includes("word") || type.includes("document")) return docOutlinedSvg;
  if (type.includes("excel") || type.includes("spreadsheet")) return xlsOutlinedSvg;
  if (type.includes("zip") || type.includes("rar") || type.includes("compressed")) return zipOutlinedSvg;
  if (type.startsWith("video/")) return videoOutlinedSvg;

  const ext = attachment.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return pdfOutlinedSvg;
  if (["doc", "docx"].includes(ext || "")) return docOutlinedSvg;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return xlsOutlinedSvg;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) return zipOutlinedSvg;
  if (["mp4", "avi", "mov", "wmv", "mkv"].includes(ext || "")) return videoOutlinedSvg;
  return fileOutlinedSvg;
};

export const renderAttachment = (args: CellLayoutArgs) => {
  const { table, row, col, rect } = args;
  const { height, width } = rect ?? table.getCellRect(col, row);
  const x = 8;
  const innerWidth = Math.max(0, width - x * 2);
  const attachments = stableAttachments(args.value);

  if (attachments.length > 0) {
    const thumbSize = 20;
    const gap = 4;
    const moreTextFontSize = 11;
    let usedWidth = 0;
    let showCount = 0;

    for (let i = 0; i < attachments.length; i++) {
      const remainingCount = attachments.length - (i + 1);
      const itemWidth = thumbSize + (showCount > 0 ? gap : 0);
      if (remainingCount > 0) {
        const moreTextWidth = measureTextWidth(`+${remainingCount}`, moreTextFontSize);
        if (usedWidth + itemWidth + gap + moreTextWidth > innerWidth) {
          if (showCount === 0) showCount = 1;
          break;
        }
      } else if (usedWidth + itemWidth > innerWidth) {
        if (showCount === 0) showCount = 1;
        break;
      }
      usedWidth += itemWidth;
      showCount += 1;
    }

    const attachmentElements = [];
    for (let i = 0; i < showCount; i++) {
      const attachment = attachments[i];
      attachmentElements.push(
        <Image
          key={attachment.attachmentId}
          attribute={{
            width: thumbSize,
            height: thumbSize,
            image: svgToDataUrl(getFileIcon(attachment)),
            marginRight: i < showCount - 1 || attachments.length > showCount ? gap : 0,
          }}
        />,
      );
    }

    const moreCount = attachments.length - showCount;
    if (moreCount > 0) {
      attachmentElements.push(
        <Text
          key="more-count"
          attribute={{
            text: `+${moreCount}`,
            fontSize: moreTextFontSize,
            fill: "#6B7280",
            fontWeight: 500,
          }}
        />,
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
          {attachmentElements}
        </Group>
      ),
      renderDefault: false,
    };
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
        }}
      >
        <Image
          attribute={{
            width: 16,
            height: 16,
            image: svgToDataUrl(fileOutlinedSvg),
          }}
        />
      </Group>
    ),
    renderDefault: false,
  };
};
