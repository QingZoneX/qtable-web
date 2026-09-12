import { qtableTokens } from "../../../styles/tokens";

export const vtableTheme = {
  headerStyle: {
    bgColor: qtableTokens.color.backgroundLayout,
    color: qtableTokens.color.textSecondary,
    fontSize: qtableTokens.typography.size.label,
    fontWeight: 600,
    fontFamily: qtableTokens.typography.fontFamily,
    borderColor: qtableTokens.color.border,
    borderLineWidth: 1,
    textStick: true,
    padding: [0, qtableTokens.space[4], 0, qtableTokens.space[4]],
  },
  bodyStyle: {
    bgColor: qtableTokens.color.background,
    color: qtableTokens.color.text,
    fontSize: qtableTokens.typography.size.table,
    fontFamily: qtableTokens.typography.fontFamily,
    borderColor: qtableTokens.color.border,
    borderLineWidth: 1,
    padding: [qtableTokens.space[2], qtableTokens.space[4], qtableTokens.space[2], qtableTokens.space[4]],
    hover: {
      cellBgColor: qtableTokens.color.surfaceHover,
    },
  },
  frameStyle: {
    borderColor: qtableTokens.color.border,
    borderLineWidth: 0,
    radius: 0,
    shadowBlur: 0,
  },
  columnResize: {
    lineColor: qtableTokens.color.primary,
    lineWidth: 2,
    bgColor: qtableTokens.color.primarySelection,
  },
  selectionStyle: {
    cellBgColor: qtableTokens.color.primarySelection,
    cellBorderColor: qtableTokens.color.primary,
    cellBorderLineWidth: 0,
    cellBorderRadius: 0,
  },
};
