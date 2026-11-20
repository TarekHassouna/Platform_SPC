"use client";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

function renderProseWithBold(prose: string, keyPrefix: string) {
  const boldParts = prose.split(/(\*\*[^*\n]+?\*\*)/g);
  return boldParts.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-bold">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t-${i}`}>{seg}</span>;
  });
}

/**
 * Renders French physics prose containing inline $...$ / \(...\) or display $$...$$ / \[...\] LaTeX
 * via KaTeX, plus **bold** markdown emphasis.
 */
export function MathText({ text, className = "" }: MathTextProps) {
  if (!text) return null;

  const parts = text.split(
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g
  );

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (
          (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) ||
          (part.startsWith("\\[") && part.endsWith("\\]") && part.length > 4)
        ) {
          const latex = part.slice(2, -2).trim();
          const html = katex.renderToString(latex, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              className="block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        if (
          (part.startsWith("$") && part.endsWith("$") && part.length > 2) ||
          (part.startsWith("\\(") && part.endsWith("\\)") && part.length > 4)
        ) {
          const latex = part.startsWith("$")
            ? part.slice(1, -1).trim()
            : part.slice(2, -2).trim();
          const html = katex.renderToString(latex, {
            displayMode: false,
            throwOnError: false,
          });
          return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <span key={idx}>{renderProseWithBold(part, String(idx))}</span>;
      })}
    </span>
  );
}
