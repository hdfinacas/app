import type { ReactNode } from "react";

const INLINE_MARKUP = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_MARKUP).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-background/40 px-1 py-0.5 text-xs">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function SafeMessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div translate="no" className="notranslate whitespace-pre-wrap leading-relaxed prose-sm">
      {lines.map((line, index) => (
        <span key={index}>
          {renderInline(line.startsWith("- ") ? `• ${line.slice(2)}` : line)}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}
