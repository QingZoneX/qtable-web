import { Button, Spin, Typography } from "antd";
import {
  BookOutlined,
  GlobalOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import type { SourceInboxItem } from "./types";
import {
  resolveRecordBacklinks,
  resolveSourceBacklinks,
} from "./sourceBacklink";
import "./sourceContext.css";

const { Text } = Typography;

type SourceContextSectionProps = {
  items: SourceInboxItem[];
  loading: boolean;
  hasMore?: boolean;
  fields: Array<{ id: string; name?: string | null }>;
  record: Record<string, unknown>;
};

type ContextCardProps = {
  title: string;
  sourceType?: string | null;
  quote?: string | null;
  annotation?: string | null;
  qnoteUrl?: string | null;
  webUrl?: string | null;
};

function ContextCard({
  title,
  sourceType,
  quote,
  annotation,
  qnoteUrl,
  webUrl,
}: ContextCardProps) {
  return (
    <div className="qtable-record-source-card">
      <div className="qtable-record-source-head">
        <span className="qtable-record-source-icon" aria-hidden="true">
          <LinkOutlined />
        </span>
        <div className="qtable-record-source-title">
          <Text strong ellipsis>
            {title}
          </Text>
          {sourceType ? (
            <span className="qtable-record-source-kind">{sourceType}</span>
          ) : null}
        </div>
        <div className="qtable-record-source-actions">
          {qnoteUrl ? (
            <Button
              size="small"
              icon={<BookOutlined />}
              href={qnoteUrl}
              title="打开这条任务对应的 QNote 原始批注"
            >
              在 QNote 中打开
            </Button>
          ) : null}
          {webUrl ? (
            <Button
              type="text"
              size="small"
              icon={<GlobalOutlined />}
              href={webUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开网页来源
            </Button>
          ) : null}
        </div>
      </div>
      {quote ? <div className="qtable-record-source-quote">{quote}</div> : null}
      {annotation ? (
        <div className="qtable-record-source-annotation">{annotation}</div>
      ) : null}
    </div>
  );
}

export function SourceContextSection({
  items,
  loading,
  hasMore,
  fields,
  record,
}: SourceContextSectionProps) {
  const recordLinks = resolveRecordBacklinks(fields, record);
  const sourceQNoteUrls = new Set(
    items
      .map((item) => resolveSourceBacklinks(item).qnoteUrl)
      .filter((value): value is string => Boolean(value)),
  );
  const sourceWebUrls = new Set(
    items
      .map((item) => resolveSourceBacklinks(item).webUrl)
      .filter((value): value is string => Boolean(value)),
  );
  const showRecordFallback = Boolean(
    (recordLinks.qnoteUrl && !sourceQNoteUrls.has(recordLinks.qnoteUrl)) ||
      (recordLinks.webUrl && !sourceWebUrls.has(recordLinks.webUrl)),
  );

  return (
    <section className="qtable-record-workspace-section">
      <div className="qtable-record-workspace-section-title">
        <h3>来源与上下文</h3>
      </div>
      {loading && !items.length ? (
        <div className="qtable-record-source-loading">
          <Spin size="small" />
          <span>正在读取来源关系…</span>
        </div>
      ) : null}
      {items.map((item) => {
        const links = resolveSourceBacklinks(item);
        return (
          <ContextCard
            key={item.id}
            title={item.pageTitle || item.url || item.sourceType || "QNote 来源"}
            sourceType={item.sourceType}
            quote={item.quote}
            annotation={item.annotation}
            qnoteUrl={links.qnoteUrl}
            webUrl={links.webUrl}
          />
        );
      })}
      {showRecordFallback ? (
        <ContextCard
          title="QNote 原始上下文"
          sourceType="qnote"
          qnoteUrl={recordLinks.qnoteUrl}
          webUrl={recordLinks.webUrl}
        />
      ) : null}
      {!loading && !items.length && !showRecordFallback ? (
        <div className="qtable-record-workspace-empty">
          {hasMore
            ? "当前来源索引较多；未在首批结果中定位到此记录的来源，可从来源箱继续检索。"
            : "这条记录没有关联的 QNote / Source Inbox 来源。"}
        </div>
      ) : null}
    </section>
  );
}
