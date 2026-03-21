import { Fragment } from "react";

import { cn } from "@/lib/utils";

interface AiFormattedMessageProps {
  content: string;
  className?: string;
}

function isBulletLine(line: string) {
  return /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line);
}

function isSectionHeadingLine(line: string) {
  return /^\*\*[^*]+\*\*:?\s*$/.test(line) || /^[A-Za-zÄÖÜäöüß0-9][^:\n]{1,64}:\s*$/.test(line);
}

function stripBulletPrefix(line: string) {
  return line.replace(/^([-*•]|\d+\.)\s+/, "");
}

function stripHeadingPrefix(line: string) {
  return line.replace(/^#{1,6}\s+/, "");
}

function normalizeAssistantContent(value: string) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/([.!?])\s+(?=\*\*[^\n*]{2,48}\*\*:)/g, "$1\n\n")
    .replace(/\s+\*\s+(?=(?:\*\*|[A-Za-z0-9ÄÖÜäöüß]))/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInlineText(text: string, keyPrefix: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-slate-50">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded bg-slate-950/70 px-1.5 py-0.5 text-[0.92em] text-cyan-100"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{token}</Fragment>;
  });
}

export default function AiFormattedMessage({ content, className }: AiFormattedMessageProps) {
  const normalized = normalizeAssistantContent(content);
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className={cn("space-y-3 break-words", className)}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);

        if (lines.length === 1 && /^#{1,6}\s+/.test(lines[0])) {
          return (
            <h4 key={`heading-${blockIndex}`} className="text-[13px] font-semibold uppercase tracking-[0.16em] text-cyan-100/85">
              {renderInlineText(stripHeadingPrefix(lines[0]), `heading-${blockIndex}`)}
            </h4>
          );
        }

        if (lines.length > 1 && isSectionHeadingLine(lines[0]) && lines.slice(1).every(isBulletLine)) {
          return (
            <div key={`section-list-${blockIndex}`} className="space-y-2">
              <p className="text-[14px] leading-6 text-slate-100">
                {renderInlineText(lines[0], `section-heading-${blockIndex}`)}
              </p>
              <ul className="space-y-2 pl-4 text-[14px] leading-6 text-slate-100 marker:text-cyan-300">
                {lines.slice(1).map((line, lineIndex) => (
                  <li key={`section-item-${blockIndex}-${lineIndex}`}>
                    {renderInlineText(stripBulletPrefix(line), `section-list-${blockIndex}-${lineIndex}`)}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (lines.length > 0 && lines.every(isBulletLine)) {
          return (
            <ul
              key={`list-${blockIndex}`}
              className="space-y-2 pl-4 text-[14px] leading-6 text-slate-100 marker:text-cyan-300"
            >
              {lines.map((line, lineIndex) => (
                <li key={`item-${blockIndex}-${lineIndex}`}>
                  {renderInlineText(stripBulletPrefix(line), `list-${blockIndex}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`} className="text-[14px] leading-6 text-slate-100">
            {lines.map((line, lineIndex) => (
              <Fragment key={`line-${blockIndex}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineText(line, `paragraph-${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export { normalizeAssistantContent };
