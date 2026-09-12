import { loadBrowserEnv } from "@visactor/vrender-kits/env/browser";
import { vglobal } from "@visactor/vtable";

/**
 * Activate VRender's browser environment.
 *
 * VRender components (the table scroll bar, poptips, ...) call
 * `vglobal.addEventListener` while they are being constructed. That proxy
 * method requires `vglobal.envContribution` to be bound, otherwise the very
 * first table render throws
 * `Cannot read properties of undefined (reading 'addEventListener')`.
 *
 * VTable activates the env internally (`loadBrowserEnv()` + `setEnv(env, {
 * force: true })`) when it creates a stage, but that can happen after the
 * table body has already built its scroll bar. It also means a plain
 * `vglobal.setEnv("browser")` issued by the app beforehand becomes a no-op
 * once `_env` is already `"browser"`, leaving the contribution unbound after
 * a table release/re-mount (React StrictMode double-invokes effects in dev).
 *
 * Binding the env during app bootstrap — and re-forcing it before each table
 * is created — removes that ordering race. Both calls are idempotent:
 * `loadBrowserEnv` guards with an internal `__loaded` flag and `setEnv` only
 * reacts to `force`.
 */
export function ensureVisActorBrowserEnv(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  loadBrowserEnv();
  void vglobal.setEnv("browser", { force: true });
}
