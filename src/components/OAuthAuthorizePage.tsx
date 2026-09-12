import { useEffect, useState } from "react";
import { Alert, Button, Card, message, Space, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiUrl } from "../lib/apiUrl";
import { useAuthStore } from "../store/authStore";

const { Title, Text, Paragraph } = Typography;

const isS256Challenge = (value: string | null) =>
  Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));

export function OAuthAuthorizePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope");
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");

  const errorMessage =
    responseType !== "code"
      ? "response_type must be code"
      : !clientId
        ? "Missing client_id parameter"
        : !redirectUri
          ? "Missing redirect_uri parameter"
          : !state
            ? "Missing state parameter"
            : codeChallengeMethod !== "S256"
              ? "S256 PKCE is required"
              : !isS256Challenge(codeChallenge)
                ? "Invalid S256 code_challenge"
                : "";
  const hasError = Boolean(errorMessage);

  useEffect(() => {
    if (hasError) {
      message.error(errorMessage);
    }
  }, [hasError, errorMessage]);

  const preservedParams = () => {
    const params = new URLSearchParams();
    params.set("response_type", "code");
    if (clientId) params.set("client_id", clientId);
    if (redirectUri) params.set("redirect_uri", redirectUri);
    if (scope) params.set("scope", scope);
    if (state) params.set("state", state);
    if (codeChallenge) params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
    return params;
  };

  const handleLogin = () => {
    navigate(`/login?${preservedParams().toString()}`);
  };

  const handleRegister = () => {
    navigate(`/register?${preservedParams().toString()}`);
  };

  const handleAuthorize = async () => {
    if (hasError) return;
    if (!token) {
      message.error("You must be logged in to authorize.");
      handleLogin();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl("/oauth/authorize-code"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: scope || undefined,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        redirect_url?: string;
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        message.error(data.detail || "Authorization request was rejected.");
        return;
      }

      if (data.error) {
        if (data.error === "invalid_token" || data.error === "unauthorized") {
          message.error("Your session has expired. Please log in again.");
          handleLogin();
        } else {
          message.error(`Authorization failed: ${data.error}`);
        }
        return;
      }

      if (!data.redirect_url) {
        message.error("Authorization server returned no callback URL.");
        return;
      }

      // The backend has already validated client_id + redirect_uri and built
      // this URL. Never construct a callback from the raw query parameter.
      window.location.assign(data.redirect_url);
    } catch {
      message.error("Failed to authorize. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (hasError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Card style={{ width: 520 }}>
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Alert
              message="Authorization Error"
              description={errorMessage}
              type="error"
              showIcon
            />
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Restart authorization from the requesting application. QTable
              requires a registered redirect URI, OAuth state, and S256 PKCE.
            </Paragraph>
            <Button type="primary" block onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Card style={{ width: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <Space orientation="vertical" style={{ width: "100%" }} size={20}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                backgroundColor: "#667eea",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 32,
              }}
            >
              🔐
            </div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Authorize Application
            </Title>
            <Text type="secondary">
              An application is requesting access to your QTable account
            </Text>
          </div>

          <Card
            size="small"
            style={{ backgroundColor: "#f5f5f5", border: "1px solid #e8e8e8" }}
          >
            <Space orientation="vertical" size={8}>
              <div>
                <Text strong>Application:</Text>
                <br />
                <Text>{clientId}</Text>
              </div>
              <div>
                <Text strong>Redirect URI:</Text>
                <br />
                <Text code style={{ wordBreak: "break-all" }}>
                  {redirectUri}
                </Text>
              </div>
              {scope && (
                <div>
                  <Text strong>Requested Permissions:</Text>
                  <br />
                  <Text>{scope}</Text>
                </div>
              )}
            </Space>
          </Card>

          {token && user ? (
            <Alert
              message="You are logged in"
              description={`Logged in as ${user.email}. Click authorize to continue.`}
              type="success"
              showIcon
            />
          ) : (
            <Alert
              message="Authentication Required"
              description="Please log in or create an account to authorize this application."
              type="info"
              showIcon
            />
          )}

          <Space orientation="vertical" style={{ width: "100%" }} size={12}>
            {token && user ? (
              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                onClick={handleAuthorize}
              >
                Authorize
              </Button>
            ) : (
              <>
                <Button type="primary" size="large" block onClick={handleLogin}>
                  Log In to Authorize
                </Button>
                <Button size="large" block onClick={handleRegister}>
                  Create Account
                </Button>
              </>
            )}

            <Button
              type="link"
              block
              danger
              onClick={() => {
                // Do not redirect to a client-supplied URI until the backend
                // has validated that URI. A denial does not need to expose an
                // open-redirect primitive.
                message.info("Authorization cancelled.");
                navigate("/", { replace: true });
              }}
            >
              Deny
            </Button>
          </Space>

          <Alert
            message="Security Notice"
            description={
              <Paragraph style={{ margin: 0, fontSize: 12 }}>
                Only authorize applications you trust. QTable uses OAuth state
                and S256 PKCE for public clients. Never share your password with
                the requesting application.
              </Paragraph>
            }
            type="warning"
            showIcon
          />
        </Space>
      </Card>
    </div>
  );
}

export default OAuthAuthorizePage;
