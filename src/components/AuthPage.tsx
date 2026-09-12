import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../lib/useLanguage";
import { useAuthStore } from "../store/authStore";
import { authT } from "./authI18n";

type AuthMode = "login" | "register" | "forgot" | "reset";

type AuthPageProps = {
  mode: AuthMode;
};

export function AuthPage({ mode }: AuthPageProps) {
  useLanguage();
  const [loading, setLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, requestPasswordReset, resetPassword } =
    useAuthStore();
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  // Check for OAuth parameters
  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");

  const isOAuthFlow = !!(responseType && clientId && redirectUri && codeChallenge);

  useEffect(() => {
    if (!isReset) return;
    const token = searchParams.get("token");
    if (token) {
      form.setFieldsValue({ token });
    }
  }, [isReset, searchParams, form]);

  const handleSubmit = async (values: {
    email?: string;
    password?: string;
    name?: string;
    token?: string;
    newPassword?: string;
  }) => {
    setLoading(true);
    try {
      if (isLogin && values.email && values.password) {
        await login(values.email, values.password);
        message.success(authT("login.success"));

        // If this is an OAuth flow, redirect to authorization endpoint
        if (isOAuthFlow) {
          const authUrl = `/oauth/authorize?response_type=${responseType}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod || "S256"}`;
          if (scope) {
            window.location.href = `${authUrl}&scope=${scope}`;
          } else {
            window.location.href = authUrl;
          }
          return;
        }

        navigate("/", { replace: true });
        return;
      }
      if (isRegister && values.email && values.password) {
        await register(
          values.email,
          values.password,
          values.name || values.email.split("@")[0],
        );
        message.success(authT("register.success"));

        // If this is an OAuth flow, redirect to authorization endpoint
        if (isOAuthFlow) {
          const authUrl = `/oauth/authorize?response_type=${responseType}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri!)}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod || "S256"}`;
          if (scope) {
            window.location.href = `${authUrl}&scope=${scope}`;
          } else {
            window.location.href = authUrl;
          }
          return;
        }

        navigate("/", { replace: true });
        return;
      }
      if (isForgot && values.email) {
        await requestPasswordReset(values.email);
        setResetRequested(true);
        message.success(authT("reset.requested"));
        return;
      }
      if (isReset && values.token && values.newPassword) {
        await resetPassword(values.token, values.newPassword);
        message.success(authT("reset.success"));
        navigate("/login", { replace: true });
        return;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : authT("operation.failed");
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const title = isLogin
    ? isOAuthFlow
      ? authT("title.authorize")
      : authT("title.login")
    : isRegister
      ? isOAuthFlow
        ? authT("title.registerAuthorize")
        : authT("title.register")
      : isForgot
        ? authT("title.forgot")
        : authT("title.reset");
  const subtitle = isLogin
    ? isOAuthFlow
      ? authT("subtitle.authorize")
      : authT("subtitle.login")
    : isRegister
      ? isOAuthFlow
        ? authT("subtitle.registerAuthorize")
        : authT("subtitle.register")
      : isForgot
        ? authT("subtitle.forgot")
        : authT("subtitle.reset");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card style={{ width: 420 }}>
        <Space orientation="vertical" style={{ width: "100%" }} size={16}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {title}
            </Typography.Title>
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          </div>
          <Form layout="vertical" onFinish={handleSubmit} form={form}>
            {isRegister && (
              <Form.Item
                label={authT("field.name")}
                name="name"
                rules={[{ required: true, message: authT("field.nameRequired") }]}
              >
                <Input placeholder={authT("field.namePlaceholder")} />
              </Form.Item>
            )}
            {(isLogin || isRegister || isForgot) && (
              <Form.Item
                label={authT("field.email")}
                name="email"
                rules={[{ required: true, message: authT("field.emailRequired") }]}
              >
                <Input type="email" placeholder="name@example.com" />
              </Form.Item>
            )}
            {(isLogin || isRegister) && (
              <Form.Item
                label={authT("field.password")}
                name="password"
                rules={[{ required: true, message: authT("field.passwordRequired") }]}
              >
                <Input.Password placeholder={authT("field.passwordPlaceholder")} />
              </Form.Item>
            )}
            {isReset && (
              <>
                <Form.Item
                  label={authT("field.resetToken")}
                  name="token"
                  rules={[{ required: true, message: authT("field.resetTokenRequired") }]}
                >
                  <Input placeholder={authT("field.resetTokenPlaceholder")} autoComplete="off" />
                </Form.Item>
                <Form.Item
                  label={authT("field.newPassword")}
                  name="newPassword"
                  rules={[{ required: true, message: authT("field.newPasswordRequired") }]}
                >
                  <Input.Password placeholder={authT("field.newPasswordPlaceholder")} autoComplete="new-password" />
                </Form.Item>
              </>
            )}
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                {isLogin
                  ? authT("action.login")
                  : isRegister
                    ? authT("action.register")
                    : isForgot
                      ? authT("action.sendReset")
                      : authT("action.updatePassword")}
              </Button>
              {isLogin && (
                <Button type="link" block onClick={() => navigate("/register")}>
                  {authT("action.toRegister")}
                </Button>
              )}
              {isRegister && (
                <Button type="link" block onClick={() => navigate("/login")}>
                  {authT("action.toLogin")}
                </Button>
              )}
              {isLogin && (
                <Button
                  type="link"
                  block
                  onClick={() => navigate("/forgot-password")}
                >
                  {authT("action.forgot")}
                </Button>
              )}
              {(isForgot || isReset) && (
                <Button type="link" block onClick={() => navigate("/login")}>
                  {authT("action.backLogin")}
                </Button>
              )}
            </Space>
            {isForgot && resetRequested ? (
              <Typography.Paragraph
                type="secondary"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                {authT("reset.requested")}
              </Typography.Paragraph>
            ) : null}
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default AuthPage;
