export const isDarkColor = (color: string): boolean => {
  if (!color) return false;

  let r, g, b;

  if (color.startsWith("#")) {
    const hex = color.substring(1);
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith("rgb")) {
    const rgb = color.match(/\d+/g);
    if (rgb) {
      r = parseInt(rgb[0]);
      g = parseInt(rgb[1]);
      b = parseInt(rgb[2]);
    }
  }

  if (r !== undefined && g !== undefined && b !== undefined) {
    // YIQ equation
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 128;
  }

  return false;
};

export const getTextColor = (bgColor: string): string => {
  return isDarkColor(bgColor) ? "#FFFFFF" : "#222329";
};
