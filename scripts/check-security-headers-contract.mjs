import fs from "node:fs";

const fail = (message) => {
  console.error("[security-headers-contract] " + message);
  process.exit(1);
};

const read = (path) => fs.readFileSync(path, "utf8");
const snippet = read("nginx-security-headers.conf");
const nginx = read("nginx.conf.template");
const html = read("index.html");
const main = read("src/main.tsx");
const readme = read("README.md");

for (const token of [
  'add_header X-Content-Type-Options "nosniff" always;',
  'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
  'add_header X-Frame-Options "DENY" always;',
  'add_header Permissions-Policy ',
  'add_header Content-Security-Policy ',
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws://$http_host wss://$http_host",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
]) {
  if (!snippet.includes(token)) fail(`security snippet is missing: ${token}`);
}
if (snippet.includes("'unsafe-eval'")) fail("CSP must not allow unsafe-eval");
const scriptDirective = snippet
  .split(";")
  .map((part) => part.trim())
  .find((part) => part.includes("script-src ")) ?? "";
if (scriptDirective.includes("'unsafe-inline'")) fail("script-src must not allow unsafe-inline");

for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"])
  if (!snippet.includes(feature)) fail(`Permissions-Policy is missing ${feature}`);

const snippetInclude = "include /etc/nginx/snippets/qtable-security-headers.conf;";
if (!nginx.includes(snippetInclude)) fail("Nginx server does not include the security snippet");
for (const marker of ["location = /healthz", "location = /sw.js", "location ~*"]) {
  const start = nginx.indexOf(marker);
  if (start < 0) fail(`Nginx location is missing: ${marker}`);
  const end = nginx.indexOf("}\n", start);
  if (end < 0 || !nginx.slice(start, end).includes(snippetInclude))
    fail(`${marker} must repeat the security snippet because it defines add_header`);
}

const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]));
if (inlineScripts.length) fail("index.html must not contain inline script blocks under script-src 'self'");
if (html.includes("fonts.googleapis.com") || html.includes("fonts.gstatic.com"))
  fail("index.html must not prefetch undeclared external font origins");
if (!html.includes('src="/src/main.tsx"')) fail("index.html must load the Vite entry module");

if (!main.includes("import.meta.env.PROD"))
  fail("Service Worker bootstrap contract is missing: import.meta.env.PROD");
if (!/navigator\.serviceWorker\s*\.\s*register\(\s*["']\/sw\.js["']\s*\)/s.test(main))
  fail('Service Worker bootstrap contract is missing: navigator.serviceWorker.register("/sw.js")');
if (!/navigator\.serviceWorker\s*\.\s*getRegistrations\(\s*\)/s.test(main))
  fail("Service Worker bootstrap contract is missing: navigator.serviceWorker.getRegistrations()");

for (const token of [
  "## Production browser security headers",
  "script-src",
  "unsafe-inline",
  "unsafe-eval",
  "TLS",
  "HSTS",
]) {
  if (!readme.includes(token)) fail(`README security-header documentation is missing: ${token}`);
}

console.log("[security-headers-contract] OK");
