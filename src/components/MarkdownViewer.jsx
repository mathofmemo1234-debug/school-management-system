import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function MarkdownViewer({ content }) {
  if (!content) return null;
  
  return (
    <div className="markdown-content" style={{ direction: 'rtl', textAlign: 'right' }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => url}
        components={{
          img: ({ node, ...props }) => {
            const imgSrc = props.src || node?.properties?.src;
            return (
              <span
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  maxWidth: '100%',
                  margin: '8px 0',
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
                    display: 'block',
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
