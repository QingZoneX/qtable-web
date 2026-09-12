export type ClipboardWriteResult =
  | { ok: true }
  | { ok: false; error: string };

export type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

const errorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "浏览器拒绝了剪贴板写入";
};

export async function copyTextToClipboard(
  text: string,
  writer: ClipboardWriter | null | undefined =
    typeof navigator !== "undefined" ? navigator.clipboard : null,
): Promise<ClipboardWriteResult> {
  if (!writer?.writeText) {
    return {
      ok: false,
      error: "当前浏览器无法访问剪贴板，请检查 HTTPS 环境或浏览器权限",
    };
  }

  try {
    await writer.writeText(text);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `复制失败：${errorMessage(error)}`,
    };
  }
}
