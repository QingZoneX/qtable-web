import {
  ArrowRightOutlined,
  BookOutlined,
  BugOutlined,
  BulbOutlined,
  GithubOutlined,
  KeyOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Card, Divider, Space, Tag, Typography } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { openGlobalCommandPalette } from "../../lib/shellEvents";
import { useLanguage } from "../../lib/useLanguage";
import {
  HELP_GUIDES,
  HELP_RESOURCES,
  HELP_SHORTCUTS,
  buildFeedbackUrl,
} from "./helpModel";
import { helpT } from "./helpI18n";
import "./help.css";

const { Link, Paragraph, Text, Title } = Typography;

const shortcutScopeLabel = (scope: "global" | "search") =>
  scope === "global" ? helpT("scopeGlobal") : helpT("scopeSearch");

export function HelpCenterPage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const version = __QTABLE_UI_VERSION__;
  const bugUrl = useMemo(() => buildFeedbackUrl("bug", version), [version]);
  const featureUrl = useMemo(
    () => buildFeedbackUrl("feature", version),
    [version],
  );
  const isEnglish = language === "en-US";

  return (
    <main className="qtable-help-page" aria-labelledby="qtable-help-title">
      <header className="qtable-help-hero">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">QTableUI {version}</Tag>
            <Tag>Open Source Preview</Tag>
          </Space>
          <Title id="qtable-help-title" level={2}>
            {helpT("title")}
          </Title>
          <Paragraph type="secondary" className="qtable-help-lead">
            {helpT("lead")}
          </Paragraph>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<SearchOutlined />}
          onClick={openGlobalCommandPalette}
        >
          {helpT("openSearch")}
        </Button>
      </header>

      <section className="qtable-help-section" aria-labelledby="help-shortcuts-title">
        <div className="qtable-help-section-heading">
          <KeyOutlined aria-hidden="true" />
          <div>
            <Title id="help-shortcuts-title" level={4}>
              {helpT("shortcutsTitle")}
            </Title>
            <Text type="secondary">{helpT("shortcutsSubtitle")}</Text>
          </div>
        </div>
        <div className="qtable-help-shortcut-grid">
          {HELP_SHORTCUTS.map((shortcut) => (
            <Card key={shortcut.id} className="qtable-help-shortcut-card" size="small">
              <div className="qtable-help-shortcut-topline">
                <Space size={6} wrap>
                  {shortcut.keys.map((key) => (
                    <kbd key={key} className="qtable-help-kbd">
                      {key}
                    </kbd>
                  ))}
                </Space>
                <Tag bordered={false}>{shortcutScopeLabel(shortcut.scope)}</Tag>
              </div>
              <Text strong>{isEnglish ? shortcut.titleEn : shortcut.titleZh}</Text>
              <Paragraph className="qtable-help-card-copy">
                {isEnglish ? shortcut.detailEn : shortcut.detailZh}
              </Paragraph>
            </Card>
          ))}
        </div>
      </section>

      <section className="qtable-help-section" aria-labelledby="help-guides-title">
        <div className="qtable-help-section-heading">
          <BookOutlined aria-hidden="true" />
          <div>
            <Title id="help-guides-title" level={4}>
              {helpT("guidesTitle")}
            </Title>
            <Text type="secondary">{helpT("guidesSubtitle")}</Text>
          </div>
        </div>
        <div className="qtable-help-guide-grid">
          {HELP_GUIDES.map((guide) => (
            <Card key={guide.id} className="qtable-help-guide-card">
              <Title level={5}>{isEnglish ? guide.titleEn : guide.titleZh}</Title>
              <Paragraph className="qtable-help-card-copy">
                {isEnglish ? guide.descriptionEn : guide.descriptionZh}
              </Paragraph>
              <Space size={8} wrap>
                {guide.route ? (
                  <Button
                    type="primary"
                    ghost
                    onClick={() => guide.route && navigate(guide.route)}
                    icon={<ArrowRightOutlined />}
                  >
                    {helpT("open")}
                  </Button>
                ) : null}
                {guide.resourceUrl ? (
                  <Button
                    href={guide.resourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    icon={<GithubOutlined />}
                  >
                    {helpT("docs")}
                  </Button>
                ) : null}
              </Space>
            </Card>
          ))}
        </div>
      </section>

      <section className="qtable-help-section" aria-labelledby="help-docs-title">
        <div className="qtable-help-section-heading">
          <GithubOutlined aria-hidden="true" />
          <div>
            <Title id="help-docs-title" level={4}>
              {helpT("resourcesTitle")}
            </Title>
            <Text type="secondary">{helpT("resourcesSubtitle")}</Text>
          </div>
        </div>
        <Card className="qtable-help-resource-list">
          {HELP_RESOURCES.map((resource, index) => {
            const title = isEnglish ? resource.titleEn : resource.titleZh;
            const description = isEnglish ? resource.descriptionEn : resource.descriptionZh;
            return (
              <div key={resource.id}>
                {index > 0 ? <Divider /> : null}
                <div className="qtable-help-resource-row">
                  <div>
                    <Link
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      strong
                    >
                      {title}
                    </Link>
                    <Paragraph className="qtable-help-resource-copy">
                      {description}
                    </Paragraph>
                  </div>
                  <Button
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={helpT("openResource", { title })}
                    icon={<ArrowRightOutlined />}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      <section className="qtable-help-section" aria-labelledby="help-feedback-title">
        <div className="qtable-help-section-heading">
          <BugOutlined aria-hidden="true" />
          <div>
            <Title id="help-feedback-title" level={4}>
              {helpT("feedbackTitle")}
            </Title>
            <Text type="secondary">{helpT("feedbackSubtitle")}</Text>
          </div>
        </div>
        <div className="qtable-help-feedback-grid">
          <Card className="qtable-help-feedback-card">
            <Space align="start" size={12}>
              <BugOutlined className="qtable-help-feedback-icon" aria-hidden="true" />
              <div>
                <Title level={5}>{helpT("bugTitle")}</Title>
                <Paragraph>{helpT("bugDescription")}</Paragraph>
                <Button
                  type="primary"
                  href={bugUrl}
                  target="_blank"
                  rel="noreferrer"
                  icon={<GithubOutlined />}
                >
                  {helpT("newBug")}
                </Button>
              </div>
            </Space>
          </Card>
          <Card className="qtable-help-feedback-card">
            <Space align="start" size={12}>
              <BulbOutlined className="qtable-help-feedback-icon" aria-hidden="true" />
              <div>
                <Title level={5}>{helpT("featureTitle")}</Title>
                <Paragraph>{helpT("featureDescription")}</Paragraph>
                <Button
                  href={featureUrl}
                  target="_blank"
                  rel="noreferrer"
                  icon={<GithubOutlined />}
                >
                  {helpT("newFeature")}
                </Button>
              </div>
            </Space>
          </Card>
        </div>
        <Card className="qtable-help-privacy-note" size="small">
          <Text strong>{helpT("beforeSubmitting")}</Text>
          <Paragraph>{helpT("privacy")}</Paragraph>
        </Card>
      </section>
    </main>
  );
}

export default HelpCenterPage;
