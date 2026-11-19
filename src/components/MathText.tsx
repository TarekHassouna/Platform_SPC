"use client";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders prose containing inline $...$ or display $$...$$ LaTeX using KaTeX.
 */
export function MathText({ text, className = "" }: MathTextProps) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
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
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const latex = part.slice(1, -1).trim();
          const html = katex.renderToString(latex, {
            displayMode: false,
            throwOnError: false,
          });
          return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}
