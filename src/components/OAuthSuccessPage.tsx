import { useEffect, useState } from "react";
import { Card, Button, Typography, Space, message, Alert } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircleOutlined, CopyOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export function OAuthSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Get the authorization code from URL params
  const code = searchParams.get("code");

  // Store code in localStorage automatically when page loads
  // This allows Tauri webview to poll for it (development mode)
  useEffect(() => {
    if (code) {
      localStorage.setItem('tauri_oauth_code', code);
      localStorage.setItem('tauri_oauth_timestamp', Date.now().toString());
      localStorage.setItem('tauri_oauth_status', 'pending');
      console.log('✅ OAuth code stored in localStorage for Tauri app polling');
      console.log('   Code:', code.substring(0, 20) + '...');
      console.log('   Tauri app can poll localStorage to retrieve it');
    }
  }, [code]);

  const handleCopyCode = async () => {
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        message.success("Authorization code copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        message.error("Failed to copy code");
      }
    }
  };

  const handleOpenApp = () => {
    // Method 1: Try custom protocol (works after app installation)
    window.location.href = "qtable://login/callback?code=" + encodeURIComponent(code || "");
    
    // Method 2: Also store in localStorage as backup (for development)
    // Tauri webview can poll this
    localStorage.setItem('tauri_oauth_code', code || '');
    localStorage.setItem('tauri_oauth_timestamp', Date.now().toString());
    localStorage.setItem('tauri_oauth_status', 'pending');
    console.log('OAuth code also stored in localStorage for Tauri polling');
  };

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
      <Card
        style={{
          width: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}
      >
        <Space orientation="vertical" style={{ width: "100%" }} size={20}>
          {/* Success Icon */}
          <div style={{ textAlign: "center" }}>
            <CheckCircleOutlined
              style={{
                fontSize: 64,
                color: "#52c41a",
              }}
            />
            <Title level={3} style={{ marginTop: 16, marginBottom: 8 }}>
              Authorization Successful!
            </Title>
            <Text type="secondary">
              You have successfully authorized the Cloud Design Client application
            </Text>
          </div>

          {/* Authorization Code Display */}
          {code && (
            <>
              <Alert
                title="Next Step Required"
                description={
                  <div>
                    <Paragraph style={{ margin: "0 0 8px 0" }}>
                      Your browser cannot automatically redirect to the desktop app during development.
                      Please follow one of these options:
                    </Paragraph>
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      <li>Copy the authorization code below</li>
                      <li>Paste it into your Tauri app when prompted</li>
                      <li>Or click "Try to Open App" below</li>
                    </ol>
                  </div>
                }
                type="info"
                showIcon
              />

              <Card
                size="small"
                title="Authorization Code"
                style={{ backgroundColor: "#f5f5f5" }}
              >
                <Space orientation="vertical" style={{ width: "100%" }} size={12}>
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "#fff",
                      border: "1px solid #d9d9d9",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontSize: "14px",
                      wordBreak: "break-all",
                      maxHeight: "100px",
                      overflow: "auto",
                    }}
                  >
                    {code}
                  </div>
                  <Button
                    type="primary"
                    icon={<CopyOutlined />}
                    onClick={handleCopyCode}
                    block
                  >
                    {copied ? "Copied!" : "Copy Code"}
                  </Button>
                </Space>
              </Card>

              <Button
                type="default"
                onClick={handleOpenApp}
                block
                size="large"
              >
                Try to Open Desktop App
              </Button>

              <Alert
                title="Development Mode Notice"
                description={
                  <Paragraph style={{ margin: 0, fontSize: 12 }}>
                    During development, the custom protocol handler may not be registered.
                    After building and installing the app, this automatic redirect will work.
                    For now, you can manually enter the code in your Tauri app or rebuild the app.
                  </Paragraph>
                }
                type="warning"
                showIcon
                style={{ fontSize: 12 }}
              />
            </>
          )}

          {!code && (
            <Alert
              title="No Authorization Code"
              description="No authorization code was received. Please try the authorization process again."
              type="error"
              showIcon
            />
          )}

          <Button
            type="link"
            onClick={() => navigate("/")}
            block
          >
            Return to Home
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default OAuthSuccessPage;
