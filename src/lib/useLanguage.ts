import { useSyncExternalStore } from "react";
import {
  getLanguage,
  subscribeLanguage,
  type Language,
} from "./i18nRuntime";

export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}
