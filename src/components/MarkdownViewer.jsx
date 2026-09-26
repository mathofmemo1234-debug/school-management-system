import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.min.js';

/**
 * Pre-processes text to ensure mathematical and chemical LaTeX notations
 * (such as \(...\), \[...\], and standalone \ce{...}) are converted into
 * standard Markdown LaTeX delimiters ($...$ and $$...$$).
 */
export function normalizeLatex(text) {
  if (!text || typeof text !== 'string') return text || '';

  // 1. Convert \[ ... \] display math to $$ ... $$
  let normalized = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);

  // 2. Convert \( ... \) inline math to $ ... $
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // 3. Convert standalone \ce{...} that isn't surrounded by $ to $\ce{...}$
  // Avoid double dollar if already inside $...$ or $$...$$
  normalized = normalized.replace(/(?<!\$)\\ce\{([^{}]+(?:\d|[a-zA-Z\s+\-><=^().[\]{}])*)\}(?!\$)/g, (match) => {
    return `$${match}$`;
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
