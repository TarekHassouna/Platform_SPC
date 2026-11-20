"use client";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Strips any unsafe SVG tags/attributes before rendering an inline AI physics diagram.
 */
function sanitizeSvg(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  let svg = match[0];
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  // Ensure responsive sizing inside chat/explanation cards
  if (!/class=/.test(svg.slice(0, 120))) {
    svg = svg.replace(/<svg/i, '<svg class="max-w-full h-auto mx-auto"');
  }
  return svg;
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

function renderMathSegment(segment: string, keyPrefix: string) {
  const parts = segment.split(
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g
  );

  return parts.map((part, idx) => {
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
          key={`${keyPrefix}-dm-${idx}`}
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
      return <span key={`${keyPrefix}-im-${idx}`} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    return <span key={`${keyPrefix}-p-${idx}`}>{renderProseWithBold(part, `${keyPrefix}-${idx}`)}</span>;
  });
}

/**
 * Renders French physics prose containing:
 * - Inline $...$ / \(...\) and display $$...$$ / \[...\] KaTeX math
 * - **bold** markdown
 * - ```svg ... ``` physics/chemistry diagrams (sanitized)
 */
export function MathText({ text, className = "" }: MathTextProps) {
  if (!text) return null;

  const blocks = text.split(/(```svg[\s\S]*?```)/gi);

  return (
    <span className={className}>
      {blocks.map((block, bIdx) => {
        if (/^```svg/i.test(block) && block.endsWith("```")) {
          const inner = block.replace(/^```svg\s*/i, "").replace(/```$/, "");
          const safeSvg = sanitizeSvg(inner);
          if (safeSvg) {
            return (
              <span
                key={`svg-${bIdx}`}
                className="block my-3 bg-white border border-indigo-100 rounded-2xl p-3 shadow-xs overflow-x-auto"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1.5">
                  📐 Schéma explicatif
                </span>
                <span className="block" dangerouslySetInnerHTML={{ __html: safeSvg }} />
              </span>
            );
          }
        }
        return <span key={`txt-${bIdx}`}>{renderMathSegment(block, `b${bIdx}`)}</span>;
      })}
    </span>
  );
}
