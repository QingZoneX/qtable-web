import test from "node:test";
import assert from "node:assert/strict";
import {
  HELP_GUIDES,
  HELP_RESOURCES,
  HELP_SHORTCUTS,
  buildFeedbackUrl,
} from "../src/components/Help/helpModel.ts";

test("all help resource links are release-facing QingZoneX GitHub URLs", () => {
  const urls = [
    ...HELP_RESOURCES.map((resource) => resource.url),
    ...HELP_GUIDES.flatMap((guide) => (guide.resourceUrl ? [guide.resourceUrl] : [])),
  ];
  assert.ok(urls.length >= 8);
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "github.com");
    assert.match(url.pathname, /^\/QingZoneX\/(QTableUI|QTable)(?:\/|$)/);
    assert.ok(!value.includes("localhost"));
    assert.ok(!value.includes("private-user-images"));
  }
});

test("help shortcut catalog is unique and only documents implemented search keys", () => {
  assert.equal(new Set(HELP_SHORTCUTS.map((item) => item.id)).size, HELP_SHORTCUTS.length);
  const globalSearch = HELP_SHORTCUTS.find((item) => item.id === "global-search");
  assert.deepEqual(globalSearch?.keys, ["Ctrl/⌘", "K"]);
  assert.equal(globalSearch?.scope, "global");
  const searchKeys = HELP_SHORTCUTS
    .filter((item) => item.scope === "search")
    .flatMap((item) => item.keys);
  assert.deepEqual(searchKeys, ["↑", "↓", "Enter", "Esc"]);
});

test("bug feedback URL prefills only a safe issue template and frontend version", () => {
  const url = new URL(buildFeedbackUrl("bug", "0.1.2-alpha"));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/QingZoneX/QTableUI/issues/new");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["body", "title"]);
  assert.equal(url.searchParams.get("title"), "[Bug] ");
  const body = url.searchParams.get("body") || "";
  assert.ok(body.includes("0.1.2-alpha"));
  assert.ok(body.includes("Browser / 浏览器"));
  assert.ok(body.includes("Steps to reproduce / 复现步骤"));
  assert.ok(body.includes("Expected behavior / 预期结果"));
  assert.ok(body.includes("Actual behavior / 实际结果"));
  assert.ok(body.includes("Do not include access tokens"));
  assert.ok(!body.includes("qtable_token="));
  assert.ok(!body.includes("workspaceId="));
  assert.ok(!body.includes("tableId="));
  assert.ok(!body.includes("recordId="));
});

test("feature feedback URL asks for problem and desired experience", () => {
  const url = new URL(buildFeedbackUrl("feature", "0.1.2-alpha"));
  assert.equal(url.searchParams.get("title"), "[Feature] ");
  const body = url.searchParams.get("body") || "";
  assert.ok(body.includes("Problem / 要解决的问题"));
  assert.ok(body.includes("Proposed experience / 期望体验"));
  assert.ok(body.includes("Alternatives / 可选方案"));
});

test("feedback version is normalized before entering a GitHub template", () => {
  const url = new URL(buildFeedbackUrl("bug", " 0.1.2-alpha\n<script>alert(1)</script> "));
  const body = url.searchParams.get("body") || "";
  assert.ok(body.includes("0.1.2-alphascriptalert1script"));
  assert.ok(!body.includes("<script>"));
  assert.ok(!body.includes("\n<script>"));
});
