/**
 * OAuth 2.0 Authorization Code + S256 PKCE helpers.
 *
 * QTable is the QingZone Identity Authority. Public clients must always send
 * state and S256 PKCE; plain PKCE is intentionally not part of this API.
 */

export function generateCodeVerifier(): string {
  const array = new Uint8Array(56);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i += 1) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export function buildAuthorizationUrl(params: {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}): string {
  if (!params.state) {
    throw new Error("OAuth state is required");
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) {
    throw new Error("Invalid S256 PKCE challenge");
  }

  const url = new URL("/oauth/authorize", params.baseUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);

  if (params.scope) {
    url.searchParams.set("scope", params.scope);
  }
  return url.toString();
}

export async function exchangeCodeForToken(params: {
  baseUrl: string;
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}> {
  const response = await fetch(new URL("/oauth/token", params.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      detail?: string;
      error_description?: string;
      error?: string;
    };
    throw new Error(
      error.detail ||
        error.error_description ||
        error.error ||
        "Failed to exchange code for token",
    );
  }

  return await response.json();
}

export async function fetchUserInfo(
  baseUrl: string,
  accessToken: string,
): Promise<{
  sub: string;
  name: string;
  email: string;
}> {
  const response = await fetch(new URL("/oauth/userinfo", baseUrl), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }
  return await response.json();
}

export async function performOAuthFlow(config: {
  baseUrl: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  openBrowser: (url: string) => Promise<void>;
  waitForCallback: () => Promise<{ code: string; state?: string }>;
}): Promise<{
  accessToken: string;
  userInfo: { sub: string; name: string; email: string };
}> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  sessionStorage.setItem("oauth_code_verifier", codeVerifier);
  sessionStorage.setItem("oauth_state", state);

  try {
    const authUrl = buildAuthorizationUrl({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      codeChallenge,
      scope: config.scope,
      state,
    });

    await config.openBrowser(authUrl);

    const callback = await config.waitForCallback();
    if (!callback.state || callback.state !== state) {
      throw new Error("OAuth state validation failed");
    }
    if (!callback.code) {
      throw new Error("OAuth callback is missing authorization code");
    }

    const storedVerifier = sessionStorage.getItem("oauth_code_verifier");
    if (!storedVerifier || storedVerifier !== codeVerifier) {
      throw new Error("PKCE verifier state was lost");
    }

    const tokenResponse = await exchangeCodeForToken({
      baseUrl: config.baseUrl,
      code: callback.code,
      redirectUri: config.redirectUri,
      clientId: config.clientId,
      codeVerifier: storedVerifier,
    });

    const userInfo = await fetchUserInfo(
      config.baseUrl,
      tokenResponse.access_token,
    );

    return { accessToken: tokenResponse.access_token, userInfo };
  } finally {
    sessionStorage.removeItem("oauth_code_verifier");
    sessionStorage.removeItem("oauth_state");
  }
}
