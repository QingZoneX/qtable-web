export type PasswordResetRequestResult = {
  message: string;
};

export const PASSWORD_RESET_FALLBACK_MESSAGE =
  "If the account exists, password reset instructions will be sent.";

export const sanitizePasswordResetResponse = (
  value: unknown,
): PasswordResetRequestResult => {
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return { message };
    }
  }
  return { message: PASSWORD_RESET_FALLBACK_MESSAGE };
};
