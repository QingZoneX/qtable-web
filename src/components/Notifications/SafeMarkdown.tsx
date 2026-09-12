import type { ReactNode } from "react";

const decodeEntities = (value: string) =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

const renderInline = (line: string, lineIndex: number): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;
  for (const match of line.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(line.slice(cursor, index));
    const token = match[0];
    const key = `${lineIndex}-${tokenIndex}`;
    tokenIndex += 1;
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = linkMatch?.[1] || token;
      const href = linkMatch?.[2]?.trim() || "";
      const safe = /^(https?:\/\/|mailto:)/i.test(href);
      nodes.push(
        safe ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    }
    cursor = index + token.length;
  }
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
};

export function SafeMarkdown({ value }: { value?: string | null }) {
  const text = decodeEntities(String(value || ""));
  const lines = text.split("\n");
  return (
    <div className="qtable-safe-markdown">
      {lines.map((line, index) => (
        <span key={`${index}-${line.slice(0, 12)}`}>
          {renderInline(line, index)}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </div>
  );
}
