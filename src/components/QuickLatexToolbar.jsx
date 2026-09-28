import React from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_PRESETS = [
  { label: 'a/b', desc: 'كسر اعتيادي', code: '\\frac{a}{b}' },
  { label: 'x²', desc: 'أس تربيعي', code: 'x^2' },
  { label: 'xⁿ', desc: 'أس متغير', code: 'x^n' },
  { label: '√x', desc: 'جذر تربيعي', code: '\\sqrt{x}' },
  { label: '±', desc: 'زائد أو ناقص', code: '\\pm' },
  { label: '×', desc: 'ضرب', code: '\\times' },
  { label: '÷', desc: 'قسمة', code: '\\div' },
  { label: '≤', desc: 'أصغر من أو يساوي', code: '\\le' },
  { label: '≥', desc: 'أكبر من أو يساوي', code: '\\ge' },
  { label: '≠', desc: 'لا يساوي', code: '\\neq' },
  { label: 'π', desc: 'باي (ط)', code: '\\pi' },
  { label: 'θ', desc: 'زاوية ثيتا', code: '\\theta' },
  { label: 'H₂O', desc: 'صيغة كيميائية (ماء)', code: '\\ce{H2O}' },
  { label: 'CO₂', desc: 'ثاني أكسيد الكربون', code: '\\ce{CO2}' },
  { label: '➔', desc: 'سهم تفاعل', code: '\\ce{->}' }
];

export default function QuickLatexToolbar({ 
  onInsert, 
  compact = false, 
  showFullToggle = true, 
  isFullOpen = false, 
  onToggleFull = null,
  title = 'معادلات ورموز سريعة:' 
}) {
  return (
    <div 
      className="quick-latex-toolbar" 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '4px' : '6px',
        flexWrap: 'wrap',
        margin: compact ? '3px 0' : '6px 0',
        padding: compact ? '2px 4px' : '4px 8px',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
        fontSize: compact ? '11px' : '12px'
      }}
    >
      <span style={{ 
        fontWeight: 'bold', 
        color: '#0e7490', 
        fontSize: compact ? '10px' : '11px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
        <Sparkles size={compact ? 11 : 13} color="#0e7490" />
        {title}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '3px' : '5px', flexWrap: 'wrap' }}>
        {DEFAULT_PRESETS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            title={`${item.desc} (${item.code})`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onInsert) onInsert(item.code);
            }}
            style={{
              padding: compact ? '1px 5px' : '2px 7px',
              fontSize: compact ? '11px' : '12px',
              fontFamily: 'monospace, sans-serif',
              fontWeight: 'bold',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              color: '#0f172a',
              cursor: 'pointer',
              lineHeight: '1.2',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0e7490';
              e.currentTarget.style.color = '#0e7490';
              e.currentTarget.style.background = '#ecfeff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {showFullToggle && onToggleFull && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFull();
          }}
          style={{
            marginInlineStart: 'auto',
            padding: compact ? '1px 6px' : '2px 8px',
            fontSize: compact ? '10px' : '11px',
            fontWeight: 'bold',
            background: isFullOpen ? '#ecfeff' : '#f1f5f9',
            border: isFullOpen ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
            borderRadius: '4px',
            color: isFullOpen ? '#0e7490' : '#475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}
          title="فتح لوحة LaTeX الكاملة لجميع الرموز والتفاضل والتكامل والكيمياء"
        >
          <span>📐 {isFullOpen ? 'إخفاء اللوحة' : 'لوحة LaTeX الموسعة'}</span>
          {isFullOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      )}
    </div>
  );
}
