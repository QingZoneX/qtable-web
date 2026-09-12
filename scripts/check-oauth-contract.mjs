import fs from "node:fs";

const oauth = fs.readFileSync("src/lib/oauth.ts", "utf8");
const authorize = fs.readFileSync("src/components/OAuthAuthorizePage.tsx", "utf8");
const callback = fs.readFileSync("src/components/OAuthCallbackPage.tsx", "utf8");

const checks = [
  ["helper fixes S256", oauth.includes('code_challenge_method", "S256"')],
  ["helper requires state", oauth.includes("OAuth state is required")],
  ["callback rejects missing state", oauth.includes("!callback.state || callback.state !== state")],
  ["plain PKCE removed", !oauth.includes("'plain'") && !oauth.includes('"plain"')],
  ["authorize page requires state", authorize.includes('Missing state parameter')],
  ["authorize page requires S256", authorize.includes('S256 PKCE is required')],
  ["authorize page has no token preview", !authorize.includes("tokenPreview")],
  ["authorize page has no debug parameter log", !authorize.includes("Received Parameters")],
  ["deny does not redirect to raw redirect URI", !authorize.includes("errorUrl")],
  ["web callback validates exact state", callback.includes("state !== expectedState")],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"} ${name}`);
  failed ||= !ok;
}
if (failed) process.exit(1);
