const configuredApiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, "");

export const API_BASE_URL = configuredApiBaseUrl || "";

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;
