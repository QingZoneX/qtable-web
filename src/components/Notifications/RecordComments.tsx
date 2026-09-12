import {
  CommentOutlined,
  SendOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Avatar,
  Button,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../lib/useLanguage";
import {
  CREATE_RECORD_COMMENT,
  MENTION_CANDIDATES,
  RECORD_COMMENTS,
} from "./notificationGraphql";
import { exactTime, relativeTime } from "./notificationFormatters";
import { notificationT } from "./notificationI18n";
import { SafeMarkdown } from "./SafeMarkdown";
import type {
  CollaborationActor,
  RecordComment,
  RecordCommentPage,
} from "./types";

const PAGE_SIZE = 50;

const mutationId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const dedupeComments = (items: RecordComment[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export function RecordComments({
  tableId,
  recordId,
  canUpdate,
  highlightCommentId,
}: {
  tableId: string;
  recordId: string;
  canUpdate: boolean;
  highlightCommentId?: string | null;
}) {
  useLanguage();
  const [body, setBody] = useState("");
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [replyTo, setReplyTo] = useState<RecordComment | null>(null);
  const [extraItems, setExtraItems] = useState<RecordComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreOverride, setHasMoreOverride] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const commentQuery = useQuery<{ recordComments: RecordCommentPage }>(
    RECORD_COMMENTS,
    {
      variables: {
        tableId,
        recordId,
        cursor: null,
        limit: PAGE_SIZE,
      },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    },
  );
  const candidateQuery = useQuery<{ mentionCandidates: CollaborationActor[] }>(
    MENTION_CANDIDATES,
    {
      variables: { tableId },
      skip: !canUpdate,
      fetchPolicy: "cache-first",
    },
  );
  const [createComment, { loading: creating }] = useMutation(
    CREATE_RECORD_COMMENT,
  );

  const page = commentQuery.data?.recordComments;
  const comments = useMemo(
    () => dedupeComments([...(page?.items || []), ...extraItems]),
    [extraItems, page?.items],
  );
  const effectiveCursor = nextCursor ?? page?.pageInfo.nextCursor ?? null;
  const hasMore =
    hasMoreOverride ?? Boolean(page?.pageInfo.hasMore && effectiveCursor);
  const candidates = candidateQuery.data?.mentionCandidates || [];

  useEffect(() => {
    if (!highlightCommentId || !comments.length) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-comment-id="${CSS.escape(highlightCommentId)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [comments.length, highlightCommentId]);

  const resetPaging = () => {
    setExtraItems([]);
    setNextCursor(null);
    setHasMoreOverride(null);
  };

  const refresh = async () => {
    resetPaging();
    await commentQuery.refetch({
      tableId,
      recordId,
      cursor: null,
      limit: PAGE_SIZE,
    });
  };

  const submit = async () => {
    const normalizedBody = body.trim();
    if (!normalizedBody || creating) return;
    const replying = Boolean(replyTo);
    try {
      await createComment({
        variables: {
          tableId,
          recordId,
          body: normalizedBody,
          mentionUserIds: mentionIds,
          parentCommentId: replyTo?.id || null,
          clientMutationId: mutationId(),
        },
      });
      setBody("");
      setMentionIds([]);
      setReplyTo(null);
      await refresh();
      message.success(replying ? notificationT("comments.replySent") : notificationT("comments.commentSent"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : notificationT("comments.sendFailed"));
    }
  };

  const loadMore = async () => {
    if (!effectiveCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await commentQuery.fetchMore({
        variables: {
          tableId,
          recordId,
          cursor: effectiveCursor,
          limit: PAGE_SIZE,
        },
      });
      const next = result.data?.recordComments;
      if (!next) return;
      setExtraItems((current) => dedupeComments([...current, ...next.items]));
      setNextCursor(next.pageInfo.nextCursor || null);
      setHasMoreOverride(next.pageInfo.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="qtable-record-comments">
      {canUpdate ? (
        <section className="qtable-comment-composer" aria-label={notificationT("comments.composerAria")}>
          {replyTo ? (
            <div className="qtable-comment-replying">
              <span>{notificationT("comments.replying", { name: replyTo.author.name })}</span>
              <Button type="link" size="small" onClick={() => setReplyTo(null)}>
                {notificationT("comments.cancel")}
              </Button>
            </div>
          ) : null}
          <Input.TextArea
            value={body}
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={20000}
            showCount
            placeholder={replyTo ? notificationT("comments.replyPlaceholder") : notificationT("comments.placeholder")}
            onChange={(event) => setBody(event.target.value)}
            onPressEnter={(event) => {
              if ((event.metaKey || event.ctrlKey) && body.trim()) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <div className="qtable-comment-composer-actions">
            <Select
              mode="multiple"
              allowClear
              className="qtable-comment-mention-select"
              placeholder={notificationT("comments.mentionPlaceholder")}
              suffixIcon={<TeamOutlined />}
              value={mentionIds}
              options={candidates.map((member) => ({
                value: Number(member.id),
                label: member.email ? `${member.name} · ${member.email}` : member.name,
              }))}
              loading={candidateQuery.loading}
              optionFilterProp="label"
              onChange={(values) => setMentionIds(values.map(Number))}
            />
            <Space size={8}>
              <span className="qtable-comment-shortcut">Ctrl/⌘ + Enter</span>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={creating}
                disabled={!body.trim()}
                onClick={() => void submit()}
              >
                {replyTo ? notificationT("comments.reply") : notificationT("comments.comment")}
              </Button>
            </Space>
          </div>
        </section>
      ) : (
        <div className="qtable-record-workspace-empty">
          {notificationT("comments.readonly")}
        </div>
      )}

      <section className="qtable-comment-thread" aria-label={notificationT("comments.threadAria")}>
        {commentQuery.loading && !commentQuery.data ? (
          <div className="qtable-comment-loading"><Spin /></div>
        ) : commentQuery.error ? (
          <div className="qtable-record-workspace-empty">
            <div>{notificationT("comments.loadFailed", { message: commentQuery.error.message })}</div>
            <Button size="small" onClick={() => void refresh()}>{notificationT("common.retry")}</Button>
          </div>
        ) : comments.length ? (
          <>
            {comments.map((comment) => {
              const isReply = Boolean(comment.parentCommentId);
              const highlighted = comment.id === highlightCommentId;
              const authorInitial = (comment.author.name || "?").charAt(0).toUpperCase();
              return (
                <article
                  key={comment.id}
                  data-comment-id={comment.id}
                  className={`qtable-comment${isReply ? " is-reply" : ""}${
                    highlighted ? " is-highlighted" : ""
                  }${comment.deleted ? " is-deleted" : ""}`}
                >
                  <Avatar size={32} className="qtable-comment-avatar">
                    {authorInitial}
                  </Avatar>
                  <div className="qtable-comment-main">
                    <div className="qtable-comment-head">
                      <div>
                        <strong>{comment.author.name}</strong>
                        {isReply ? <Tag bordered={false}>{notificationT("comments.replyTag")}</Tag> : null}
                      </div>
                      <Tooltip title={exactTime(comment.createdAt)}>
                        <span>{relativeTime(comment.createdAt)}</span>
                      </Tooltip>
                    </div>
                    {comment.deleted ? (
                      <div className="qtable-comment-deleted-copy">{notificationT("comments.deleted")}</div>
                    ) : (
                      <SafeMarkdown value={comment.body} />
                    )}
                    {comment.mentions.length ? (
                      <div className="qtable-comment-mentions" aria-label={notificationT("comments.mentionsAria")}>
                        {comment.mentions.map((member) => (
                          <Tag key={member.id ?? member.email ?? member.name} bordered={false}>
                            @{member.name}
                          </Tag>
                        ))}
                      </div>
                    ) : null}
                    {!comment.deleted && canUpdate && !comment.parentCommentId ? (
                      <div className="qtable-comment-actions">
                        <Button
                          type="link"
                          size="small"
                          icon={<CommentOutlined />}
                          onClick={() => setReplyTo(comment)}
                        >
                          {notificationT("comments.reply")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {hasMore ? (
              <div className="qtable-comment-load-more">
                <Button loading={loadingMore} onClick={() => void loadMore()}>
                  {notificationT("comments.loadEarlier")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={notificationT("comments.empty")}
            className="qtable-comment-empty"
          />
        )}
      </section>
    </div>
  );
}
