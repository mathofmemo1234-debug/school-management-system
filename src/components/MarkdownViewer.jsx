import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.min.js';

/**
 * Pre-processes text to ensure mathematical and chemical LaTeX notations
 * are automatically recognized and converted into standard Markdown LaTeX delimiters ($...$ and $$...$$).
 * Supports IMPLICIT LaTeX: Automatically detects raw LaTeX commands (\frac, \sqrt, etc.),
 * math powers/subscripts (x^2, y_1), and chemical formulas (\ce{...}) without needing manual $ wrapping.
 */
export function normalizeLatex(text) {
  if (!text || typeof text !== 'string') return text || '';

  // 1. Convert \[ ... \] display math to $$ ... $$
  let normalized = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);

  // 2. Convert \( ... \) inline math to $ ... $
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // Protect already existing math blocks ($$...$$ and $...$) so we don't double-wrap or alter them
  const mathPlaceholders = [];
  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g, (match) => {
    const id = `__MATH_PROTECTED_${mathPlaceholders.length}__`;
    mathPlaceholders.push(match);
    return id;
  });

  // 3. Convert standalone \ce{...} to $\ce{...}$
  normalized = normalized.replace(/\\ce\{([^{}]+(?:\d|[a-zA-Z\s+\-><=^().[\]{}])*)\}/g, (match) => {
    return `$${match}$`;
  });

  // 4. Implicit LaTeX: Auto-wrap standalone LaTeX math commands and their mathematical arguments
  // Matches commands like \frac{...}{...}, \sqrt{...}, \pm, \times, \div, \sum, \int, \alpha, \pi, etc.
  const latexCommandPattern = /\\(?:frac\{[^{}]*\}\{[^{}]*\}|sqrt(?:\[[^{}]*\])?\{[^{}]*\}|left[([{|.]|right[)\]}|.]|sum(?:_\{[^{}]*\}\^\{[^{}]*\}|_\{[^{}]*\}|\^[^{}]*)?|int(?:_\{[^{}]*\}\^\{[^{}]*\}|_\{[^{}]*\}|\^[^{}]*)?|lim(?:_\{[^{}]*\})?|vec\{[^{}]*\}|mathbf\{[^{}]*\}|mathrm\{[^{}]*\}|text\{[^{}]*\}|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|times|div|pm|mp|cdot|circ|bullet|approx|neq|le|ge|equiv|sim|ll|gg|infty|partial|nabla|angle|perp|parallel|forall|exists|in|notin|subset|supset|cup|cap|to|leftarrow|rightarrow|Rightarrow|Leftarrow|Leftrightarrow|degree)(?:(?:\s*[\+\-\*\/=><^_\s]\s*|\s+)(?:\\?[a-zA-Z0-9_{}()]+|\{[^{}]*\}|\d+(?:\.\d+)?))*/g;

  normalized = normalized.replace(latexCommandPattern, (match) => {
    return `$${match.trim()}$`;
  });

  // 5. Implicit variable powers/subscripts (e.g. x^2, y_1, x^2 + 4, a^2 + b^2 = c^2)
  const varPowerPattern = /(?<![a-zA-Z0-9_\\])(?:[a-zA-Z](?:\^[0-9a-zA-Z{}]+|_[0-9a-zA-Z{}]+)(?:\s*[\+\-\*\/=><]\s*(?:[a-zA-Z0-9]+(?:\^[0-9a-zA-Z{}]+|_[0-9a-zA-Z{}]+)?|\d+))*)(?![a-zA-Z0-9_\\])/g;

  normalized = normalized.replace(varPowerPattern, (match) => {
    return `$${match.trim()}$`;
  });

  // 6. Restore protected math blocks
  mathPlaceholders.forEach((orig, idx) => {
    normalized = normalized.replace(`__MATH_PROTECTED_${idx}__`, orig);
  });

  return normalized;
}

export default function MarkdownViewer({ content, inline = false, style = {} }) {
  if (!content) return null;
  const processedContent = normalizeLatex(content);

  return (
    <div 
      className={`markdown-content ${inline ? 'markdown-inline' : ''}`} 
      style={{ 
        direction: 'rtl', 
        textAlign: 'right',
        display: inline ? 'inline' : 'block',
        ...style
      }}
    >
      <style>{`
        .markdown-content .katex {
          direction: ltr !important;
          unicode-bidi: isolate !important;
          text-align: left !important;
        }
        .markdown-content .katex-display {
          direction: ltr !important;
          unicode-bidi: isolate !important;
          text-align: center !important;
          margin: 0.6em 0 !important;
        }
        .markdown-inline p {
          display: inline !important;
          margin: 0 !important;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { trust: true, strict: false, throwOnError: false }]]}
        urlTransform={(url) => url}
        components={{
          ...(inline ? {
            p: ({ node, ...props }) => <span style={{ margin: 0, display: 'inline' }} {...props} />
          } : {}),
          img: ({ node, ...props }) => {
            const imgSrc = props.src || node?.properties?.src;
            return (
              <span
                style={{
                  position: 'relative',
                  display: inline ? 'inline-block' : 'block',
                  maxWidth: '100%',
                  margin: inline ? '2px 4px' : '8px 0',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  pointerEvents: 'auto'
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <img
                  {...props}
                  src={imgSrc}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '8px',
                    display: inline ? 'inline-block' : 'block',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitUserDrag: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    ...props.style
                  }}
                  alt={props.alt || "صورة السؤال"}
                />
                {/* Protective transparent layer over the image */}
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'transparent',
                    cursor: 'default',
                    userSelect: 'none'
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                />
              </span>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
