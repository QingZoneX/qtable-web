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
import {
  HELP_GUIDES,
  HELP_RESOURCES,
  HELP_SHORTCUTS,
  buildFeedbackUrl,
} from "./helpModel";
import "./help.css";

const { Link, Paragraph, Text, Title } = Typography;

const shortcutScopeLabel = (scope: "global" | "search") =>
  scope === "global" ? "全局 / Global" : "搜索内 / In search";

export function HelpCenterPage() {
  const navigate = useNavigate();
  const version = __QTABLE_UI_VERSION__;
  const bugUrl = useMemo(() => buildFeedbackUrl("bug", version), [version]);
  const featureUrl = useMemo(
    () => buildFeedbackUrl("feature", version),
    [version],
  );

  return (
    <main className="qtable-help-page" aria-labelledby="qtable-help-title">
      <header className="qtable-help-hero">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">QTableUI {version}</Tag>
            <Tag>Open Source Preview</Tag>
          </Space>
          <Title id="qtable-help-title" level={2}>
            帮助中心 / Help Center
          </Title>
          <Paragraph type="secondary" className="qtable-help-lead">
            这里仅列出当前版本已经存在的快捷键、产品入口、开源文档和反馈渠道。
            This page only documents shortcuts, product surfaces, open-source
            resources and support paths that exist in the current build.
          </Paragraph>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<SearchOutlined />}
          onClick={openGlobalCommandPalette}
        >
          打开全局搜索 / Open search
        </Button>
      </header>

      <section className="qtable-help-section" aria-labelledby="help-shortcuts-title">
        <div className="qtable-help-section-heading">
          <KeyOutlined aria-hidden="true" />
          <div>
            <Title id="help-shortcuts-title" level={4}>
              快捷操作 / Shortcuts
            </Title>
            <Text type="secondary">
              只展示当前代码真实支持的键盘行为 / Only shortcuts implemented by the current codebase.
            </Text>
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
              <Text strong>{shortcut.titleZh}</Text>
              <Text type="secondary" className="qtable-help-block-text">
                {shortcut.titleEn}
              </Text>
              <Paragraph className="qtable-help-card-copy">
                {shortcut.detailZh}
                <br />
                <Text type="secondary">{shortcut.detailEn}</Text>
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
              产品使用指南 / Product guides
            </Title>
            <Text type="secondary">
              外部文档不可用时，这些本地说明仍可直接阅读 / These local instructions remain available even when external docs are unreachable.
            </Text>
          </div>
        </div>
        <div className="qtable-help-guide-grid">
          {HELP_GUIDES.map((guide) => (
            <Card key={guide.id} className="qtable-help-guide-card">
              <Title level={5}>{guide.titleZh}</Title>
              <Text type="secondary" className="qtable-help-block-text">
                {guide.titleEn}
              </Text>
              <Paragraph className="qtable-help-card-copy">
                {guide.descriptionZh}
                <br />
                <Text type="secondary">{guide.descriptionEn}</Text>
              </Paragraph>
              <Space size={8} wrap>
                {guide.route ? (
                  <Button
                    type="primary"
                    ghost
                    onClick={() => guide.route && navigate(guide.route)}
                    icon={<ArrowRightOutlined />}
                  >
                    打开 / Open
                  </Button>
                ) : null}
                {guide.resourceUrl ? (
                  <Button
                    href={guide.resourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    icon={<GithubOutlined />}
                  >
                    文档 / Docs
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
              开源文档 / Open-source resources
            </Title>
            <Text type="secondary">
              仅链接 QingZoneX/QTable 与 QingZoneX/QTableUI 的公开发布资料，不包含内部地址。
              Links are limited to release-facing QingZoneX/QTable and QTableUI resources.
            </Text>
          </div>
        </div>
        <Card className="qtable-help-resource-list">
          {HELP_RESOURCES.map((resource, index) => (
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
                    {resource.titleZh}
                  </Link>
                  <Text type="secondary" className="qtable-help-block-text">
                    {resource.titleEn}
                  </Text>
                  <Paragraph className="qtable-help-resource-copy">
                    {resource.descriptionZh}
                    <br />
                    <Text type="secondary">{resource.descriptionEn}</Text>
                  </Paragraph>
                </div>
                <Button
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`打开 ${resource.titleZh}`}
                  icon={<ArrowRightOutlined />}
                />
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section className="qtable-help-section" aria-labelledby="help-feedback-title">
        <div className="qtable-help-section-heading">
          <BugOutlined aria-hidden="true" />
          <div>
            <Title id="help-feedback-title" level={4}>
              反馈与支持 / Feedback & support
            </Title>
            <Text type="secondary">
              反馈模板只预填当前前端版本，不读取浏览器信息，也不附带任何工作区或业务数据。
              Templates prefill only the frontend version and never collect browser, workspace or business data automatically.
            </Text>
          </div>
        </div>
        <div className="qtable-help-feedback-grid">
          <Card className="qtable-help-feedback-card">
            <Space align="start" size={12}>
              <BugOutlined className="qtable-help-feedback-icon" aria-hidden="true" />
              <div>
                <Title level={5}>报告问题 / Report a bug</Title>
                <Paragraph>
                  请提供版本、浏览器、复现步骤、预期结果与实际结果。
                  Include the version, browser, reproduction steps, expected result and actual result.
                </Paragraph>
                <Button
                  type="primary"
                  href={bugUrl}
                  target="_blank"
                  rel="noreferrer"
                  icon={<GithubOutlined />}
                >
                  新建 Bug Issue
                </Button>
              </div>
            </Space>
          </Card>
          <Card className="qtable-help-feedback-card">
            <Space align="start" size={12}>
              <BulbOutlined className="qtable-help-feedback-icon" aria-hidden="true" />
              <div>
                <Title level={5}>功能建议 / Feature request</Title>
                <Paragraph>
                  请描述要解决的问题、期望体验与可接受的替代方案。
                  Describe the problem, desired experience and acceptable alternatives.
                </Paragraph>
                <Button
                  href={featureUrl}
                  target="_blank"
                  rel="noreferrer"
                  icon={<GithubOutlined />}
                >
                  新建 Feature Issue
                </Button>
              </div>
            </Space>
          </Card>
        </div>
        <Card className="qtable-help-privacy-note" size="small">
          <Text strong>提交前请检查 / Before submitting</Text>
          <Paragraph>
            不要粘贴 access token、API Key、密码、私有 workspace/table/record 内容或包含敏感信息的截图。
            Do not paste access tokens, API keys, passwords, private workspace/table/record content, or screenshots containing sensitive information.
          </Paragraph>
        </Card>
      </section>
    </main>
  );
}

export default HelpCenterPage;
