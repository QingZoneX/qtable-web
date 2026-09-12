import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button, Result } from "antd";
import { subscribeLanguage, t } from "../../lib/i18nRuntime";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  private unsubscribeLanguage: (() => void) | null = null;

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidMount() {
    // This is a class component, so it cannot use the `useLanguage` hook.
    // Subscribe directly so the fallback UI re-renders when the user switches
    // language while the error screen is visible.
    this.unsubscribeLanguage = subscribeLanguage(() => {
      if (this.state.hasError) {
        this.forceUpdate();
      }
    });
  }

  public componentWillUnmount() {
    this.unsubscribeLanguage?.();
    this.unsubscribeLanguage = null;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, height: "100%", overflow: "auto" }}>
          <Result
            status="error"
            title={t("error.title")}
            subTitle={this.state.error?.message || t("error.subtitle")}
            extra={[
              <Button
                type="primary"
                key="reload"
                onClick={() => window.location.reload()}
              >
                {t("error.reload")}
              </Button>,
              <Button
                key="retry"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                {t("error.retry")}
              </Button>,
            ]}
          >
            <div className="desc">
              <p className="site-description-item-profile-p">
                {t("error.details")}
              </p>
              <pre style={{ textAlign: "left", background: "#f5f5f5", padding: 10, borderRadius: 4, overflow: "auto" }}>
                {this.state.error?.stack}
              </pre>
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}
