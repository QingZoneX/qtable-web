import { useEffect, useState } from "react";
import { Card, message, Spin, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

const { Title, Text } = Typography;

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      const expectedState = sessionStorage.getItem("oauth_state");

      if (error) {
        message.error(`Authorization failed: ${errorDescription || error}`);
        navigate("/login", { replace: true });
        return;
      }

      if (!state || !expectedState || state !== expectedState) {
        sessionStorage.removeItem("oauth_code_verifier");
        sessionStorage.removeItem("oauth_state");
        message.error("OAuth state validation failed. Please start login again.");
        navigate("/login", { replace: true });
        return;
      }

      if (!code) {
        message.error("No authorization code received");
        navigate("/login", { replace: true });
        return;
      }

      // The client-specific OAuth owner exchanges the code. This page only
      // confirms a valid callback and never logs or persists the code.
      message.success("Authorization successful! You can close this window.");
      setProcessing(false);
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  if (processing) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card style={{ width: 420, textAlign: "center" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Title level={4}>Processing Authorization...</Title>
            <Text type="secondary">
              Please wait while we validate the authorization callback.
            </Text>
          </div>
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
      }}
    >
      <Card style={{ width: 420, textAlign: "center" }}>
        <Title level={4}>Authorization Successful!</Title>
        <Text type="secondary">
          The callback passed OAuth state validation. You can close this window
          and return to your application.
        </Text>
      </Card>
    </div>
  );
}

export default OAuthCallbackPage;
