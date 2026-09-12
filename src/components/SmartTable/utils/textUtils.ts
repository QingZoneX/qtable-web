export const measureTextWidth = (text: string, fontSize: number = 12): number => {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // ASCII characters are usually narrower
    // CJK and other full-width characters are usually 1em
    if (code >= 0 && code <= 255) {
      width += fontSize * 0.6;
    } else {
      width += fontSize;
    }
  }
  return width;
};
