import { registerHooks } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        // Fall through to Node's default resolution so genuine missing modules
        // keep their original error and stack trace.
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  mergeSettingsWorkspaces,
  resolveSettingsWorkspaceId,
  workspaceRoleLabel,
} = await import("../src/components/Settings/settingsModel.ts");
const { settingsT } = await import("../src/components/Settings/settingsI18n.ts");
const {
  getLandingPreference,
  setLandingPreference,
} = await import("../src/components/Home/homePreferences.ts");

test("workspace merge deduplicates owned/invited and preserves ownership", () => {
  const workspaces = mergeSettingsWorkspaces({
    owned: [
      { id: "w2", name: "Beta" },
      { id: "w1", name: "Alpha" },
    ],
    invited: [
      { id: "w1", name: "Duplicate invited" },
      { id: "w3", name: "Gamma" },
    ],
  });
  assert.deepEqual(
    workspaces.map(({ id, owned }) => ({ id, owned })),
    [
      { id: "w1", owned: true },
      { id: "w2", owned: true },
      { id: "w3", owned: false },
    ],
  );
});

test("settings workspace resolution keeps valid preference and safely falls back", () => {
  const workspaces = mergeSettingsWorkspaces({
    owned: [{ id: "w1", name: "Alpha" }],
    invited: [{ id: "w2", name: "Beta" }],
  });
  assert.equal(resolveSettingsWorkspaceId("w2", workspaces), "w2");
  assert.equal(resolveSettingsWorkspaceId("missing", workspaces), "w1");
  assert.equal(resolveSettingsWorkspaceId("missing", []), "");
});

test("workspace role labels do not invent elevated permissions", () => {
  assert.equal(workspaceRoleLabel("owner"), settingsT("roleOwner"));
  assert.equal(workspaceRoleLabel("editor"), settingsT("roleEditor"));
  assert.equal(workspaceRoleLabel("viewer"), settingsT("roleViewer"));
  assert.equal(workspaceRoleLabel("custom"), "custom");
  assert.equal(workspaceRoleLabel(undefined), settingsT("roleUnknown"));
});

test("landing preference acknowledges successful browser persistence", () => {
  const values = new Map();
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    },
  });
  try {
    assert.equal(setLandingPreference("last_workbench"), true);
    assert.equal(getLandingPreference(), "last_workbench");
    assert.equal(setLandingPreference("home"), true);
    assert.equal(getLandingPreference(), "home");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("landing preference returns failure when browser storage rejects the write", () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("storage blocked");
        },
      },
    },
  });
  try {
    assert.equal(setLandingPreference("last_workbench"), false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
