import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.min.js';

/**
 * Helper to ensure Arabic letters/words inside math expressions are wrapped in \text{...}
 * so KaTeX parses them natively without errors and renders smooth cursive Arabic font.
 */
export function wrapArabicInsideLatex(str) {
  if (!str || typeof str !== 'string') return '';
  const protectedParts = [];
  // Protect existing \text{...}, \mathrm{...}, \mathbf{...}, \ce{...}
  let s = str.replace(/\\(text|mathrm|mathbf|ce)\{[^}]*\}/g, (m) => {
    const id = `___PROT_${protectedParts.length}___`;
    protectedParts.push(m);
    return id;
  });

  // Arabic letters only (not spaces, not digits, not math punctuation)
  s = s.replace(/([\u0621-\u064A\u0671-\u06D3]+)/g, (match) => {
    return `\\text{${match}}`;
  });

  // Restore protected parts
  protectedParts.forEach((orig, idx) => {
    s = s.replace(`___PROT_${idx}___`, orig);
  });
  return s;
}

/**
 * Pre-processes text to ensure mathematical and chemical LaTeX notations
 * in BOTH Arabic (س، ص، ع، نق، ط، جا، جتا، ظا، جذر) and English (x, y, z, \frac, \sqrt, \sin, etc.)
 * are automatically recognized, auto-repaired, and converted into standard Markdown LaTeX delimiters ($...$ and $$...$$).
 * Leaves ZERO room for syntax errors in mathematical equations.
 */
export function normalizeLatex(text) {
  if (!text || typeof text !== 'string') return text || '';

  let normalized = text;

  // 1. Bracket conversion: \[ ... \] to $$ ... $$ and \( ... \) to $ ... $
  normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // 2. Unicode superscripts and subscripts
  const superscripts = {
    '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
    '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
    'ⁿ': '^n', '⁺': '^+', '⁻': '^-'
  };
  normalized = normalized.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻]/g, m => superscripts[m] || m);

  const subscripts = {
    '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4',
    '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9'
  };
  normalized = normalized.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, m => subscripts[m] || m);

  // 3. Helper to protect already existing math blocks ($...$ and $$...$$)
  const mathPlaceholders = [];
  const protectMath = (str) => {
    return str.replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g, (match, displayMath, inlineMath) => {
      let inner = displayMath !== undefined ? displayMath : inlineMath;
      const isDisplay = displayMath !== undefined;
      inner = wrapArabicInsideLatex(inner);
      const id = `__MATH_PROTECTED_${mathPlaceholders.length}__`;
      mathPlaceholders.push(isDisplay ? `\n$$\n${inner.trim()}\n$$\n` : `$${inner.trim()}$`);
      return id;
    });
  };

  // Protect already existing math blocks ($...$ and $$...$$)
  normalized = protectMath(normalized);

  // 4. Standalone chemistry: \ce{...}
  normalized = normalized.replace(/\\ce\{([^{}]+(?:\d|[a-zA-Z\s+\-><=^().[\]{}])*)\}/g, m => `$${m}$`);
  normalized = protectMath(normalized);

  // 5. Standalone contiguous LaTeX command sequence outside math
  // Matches e.g. \frac{a}{b}, \sqrt{x}, \lim_{x \to 0} \frac{\sin(x)}{x}, etc.
  const contiguousLatexPattern = /(?:\\(?:[a-zA-Z]+)(?:\{[^{}]*\}|\[[^\[\]]*\]|\^[a-zA-Z0-9{}]|_\{[^{}]*\}|_[a-zA-Z0-9]|[\s\+\-\*\/=><^_\d()a-zA-Zسصعنلمكدهـوط,])*)+/g;
  normalized = normalized.replace(contiguousLatexPattern, (match) => {
    const trimmed = match.trim();
    if (trimmed.startsWith('\\')) {
      return `$${trimmed}$`;
    }
    return match;
  });
  normalized = protectMath(normalized);

  // 6. Arabic fractions outside math: كسر(بسط, مقام)
  normalized = normalized.replace(/كسر\s*\(\s*([^,]+)\s*,\s*([^\)]+)\s*\)/g, (_, num, den) => {
    return `$\\frac{${wrapArabicInsideLatex(num.trim())}}{${wrapArabicInsideLatex(den.trim())}}$`;
  });
  normalized = protectMath(normalized);

  // 7. Arabic roots outside math: جذر(...) or جذر س
  normalized = normalized.replace(/جذر\s*\(\s*([^\)]+)\s*\)/g, (_, val) => {
    return `$\\sqrt{${wrapArabicInsideLatex(val)}}$`;
  });
  normalized = normalized.replace(/جذر\s+([أ-يa-zA-Z0-9]+)/g, (_, val) => {
    return `$\\sqrt{${wrapArabicInsideLatex(val)}}$`;
  });
  normalized = protectMath(normalized);

  // 8. Arabic limits outside math: نها (س -> 0) or نها(س → 0)
  normalized = normalized.replace(/نها\s*(?:\(\s*([^\)]+)\s*\)|([أ-يa-zA-Z0-9\s->→]+))/g, (m, p1, p2) => {
    const rawContent = (p1 || p2 || '').trim();
    if (!rawContent) return m;
    const content = rawContent.replace(/->|→/g, '\\to ');
    return `$\\lim_{${wrapArabicInsideLatex(content)}}$`;
  });
  normalized = protectMath(normalized);

  // 9. Arabic trig / log functions outside math: جا(س), جا س, جتا(س), ظا(س), لو(س)
  normalized = normalized.replace(/(جا|جتا|ظا|ظتا|قا|قتا|لو)\s*(?:\(\s*([^\)]+)\s*\)|([أ-يa-zA-Z0-9]+))/g, (_, fn, p1, p2) => {
    const arg = (p1 || p2 || '').trim();
    return `$\\text{${fn}}(${wrapArabicInsideLatex(arg)})$`;
  });
  normalized = protectMath(normalized);

  // 10. Circle geometry patterns: ط نق² or 2 ط نق or ط نق^2
  normalized = normalized.replace(/(?<![أ-يa-zA-Z])(?:2\s*)?ط\s*نق(?:\^[0-9{}]+|²)?(?![أ-يa-zA-Z])/g, (m) => {
    const withPow = m.replace('²', '^2');
    return `$${wrapArabicInsideLatex(withPow)}$`;
  });
  normalized = protectMath(normalized);

  // 11. Implicit whole equations with powers/operations (Arabic variables: س, ص, ع, أ, ب, ج, د, نق, ط etc. & English: x, y, z, etc.)
  // e.g. x^2 + 2x - 8 = 0, س^2 + 5س + 6 = 0, 2س + 3 = 7, أ^2 + ب^2 = ج^2, ق = ك × ت, ع = ف / ز
  const wholeEquationPattern = /(?<![^\s,،:;])(?:(?:\d+\s*)?(?:نق|ط|هـ|[a-zA-Zأ-ي])(?:\^[0-9a-zA-Zأ-ي{}]+|_[0-9a-zA-Zأ-ي{}]+)?(?:\s*[\+\-\*\/=><±×÷≤≥≠≈]\s*(?:(?:\d+\s*)?(?:نق|ط|هـ|[a-zA-Zأ-ي])(?:\^[0-9a-zA-Zأ-ي{}]+|_[0-9a-zA-Zأ-ي{}]+)?|\d+(?:\.\d+)?|\([^\)]+\)))+)(?![^\s,،:;.!؟])/g;
  normalized = normalized.replace(wholeEquationPattern, (match) => {
    return `$${wrapArabicInsideLatex(match.trim())}$`;
  });
  normalized = protectMath(normalized);

  // 12. Single variable with power/subscript: e.g. x^2, س^2, أ^2, y_1, ص_1, نق^2
  const singlePowerPattern = /(?<![^\s,،:;])((?:نق|ط|هـ|[a-zA-Zأ-ي])(?:\^[0-9a-zA-Zأ-ي{}]+|_[0-9a-zA-Zأ-ي{}]+))(?![^\s,،:;.!؟])/g;
  normalized = normalized.replace(singlePowerPattern, (match) => {
    return `$${wrapArabicInsideLatex(match.trim())}$`;
  });
  normalized = protectMath(normalized);

  // 13. Degree angles outside math: 30°, 45°, 90°, 180°
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*°/g, (_, deg) => `$${deg}^{\\circ}$`);
  normalized = protectMath(normalized);

  // 14. Restore all protected math blocks
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
        .markdown-content .katex .text {
          font-family: inherit, 'Cairo', 'Amiri', 'Traditional Arabic', sans-serif !important;
          font-style: normal !important;
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
