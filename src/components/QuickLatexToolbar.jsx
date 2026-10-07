import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Languages } from 'lucide-react';

const ARABIC_PRESETS = [
  { label: 'س²', desc: 'س تربيع', code: '$\\text{س}^2$' },
  { label: 'سⁿ', desc: 'س أس متغير', code: '$\\text{س}^n$' },
  { label: 'س/ص', desc: 'كسر اعتيادي عربي', code: '$\\frac{\\text{س}}{\\text{ص}}$' },
  { label: 'أ/ب', desc: 'كسر أ على ب', code: '$\\frac{\\text{أ}}{\\text{ب}}$' },
  { label: '√س', desc: 'جذر تربيعي للمتغير س', code: '$\\sqrt{\\text{س}}$' },
  { label: 'ط (π)', desc: 'النسبة التقريبية باي (ط)', code: '$\\text{ط}$' },
  { label: 'نق', desc: 'نصف القطر (نق)', code: '$\\text{نق}$' },
  { label: 'ط نق²', desc: 'مساحة الدائرة (ط نق²)', code: '$\\text{ط} \\, \\text{نق}^2$' },
  { label: 'جا(س)', desc: 'جيب الزاوية (جا)', code: '$\\text{جا}(\\text{س})$' },
  { label: 'جتا(س)', desc: 'جيب التمام (جتا)', code: '$\\text{جتا}(\\text{س})$' },
  { label: 'ظا(س)', desc: 'ظل الزاوية (ظا)', code: '$\\text{ظا}(\\text{س})$' },
  { label: 'نها', desc: 'نهاية دالة', code: '$\\lim_{\\text{س} \\to 0}$' },
  { label: 'س₁', desc: 'دليل سفلي س₁', code: '$\\text{س}_1$' },
  { label: '±', desc: 'زائد أو ناقص', code: '$\\pm$' },
  { label: '×', desc: 'ضرب', code: '$\\times$' },
  { label: '÷', desc: 'قسمة', code: '$\\div$' },
  { label: '≤', desc: 'أصغر من أو يساوي', code: '$\\le$' },
  { label: '≥', desc: 'أكبر من أو يساوي', code: '$\\ge$' },
  { label: '≠', desc: 'لا يساوي', code: '$\\neq$' },
  { label: '≈', desc: 'تقريباً يساوي', code: '$\\approx$' },
  { label: '∈', desc: 'ينتمي إلى', code: '$\\in$' },
  { label: '∉', desc: 'لا ينتمي إلى', code: '$\\notin$' },
  { label: '∪', desc: 'اتحاد مجموعات', code: '$\\cup$' },
  { label: '∩', desc: 'تقاطع مجموعات', code: '$\\cap$' },
  { label: '∞', desc: 'ما لا نهاية', code: '$\\infty$' },
  { label: '°', desc: 'درجة مئوية / زاوية', code: '$^{\\circ}$' }
];

const ENGLISH_PRESETS = [
  { label: 'x²', desc: 'x تربيع', code: '$x^2$' },
  { label: 'xⁿ', desc: 'x أس متغير', code: '$x^n$' },
  { label: 'a/b', desc: 'كسر اعتيادي إنجليزي', code: '$\\frac{a}{b}$' },
  { label: '√x', desc: 'جذر تربيعي للمتغير x', code: '$\\sqrt{x}$' },
  { label: 'π', desc: 'باي (Pi)', code: '$\\pi$' },
  { label: 'θ', desc: 'زاوية ثيتا (Theta)', code: '$\\theta$' },
  { label: 'Δ', desc: 'دلتا (Delta)', code: '$\\Delta$' },
  { label: 'sin(x)', desc: 'جيب الزاوية (sin)', code: '$\\sin(x)$' },
  { label: 'cos(x)', desc: 'جيب التمام (cos)', code: '$\\cos(x)$' },
  { label: 'tan(x)', desc: 'ظل الزاوية (tan)', code: '$\\tan(x)$' },
  { label: 'lim', desc: 'نهاية دالة (Limit)', code: '$\\lim_{x \\to 0}$' },
  { label: '∫', desc: 'تكامل (Integral)', code: '$\\int x \\, dx$' },
  { label: '∑', desc: 'مجموع (Summation)', code: '$\\sum_{i=1}^n$' },
  { label: 'x₁', desc: 'دليل سفلي x₁', code: '$x_1$' },
  { label: '±', desc: 'زائد أو ناقص', code: '$\\pm$' },
  { label: '×', desc: 'ضرب', code: '$\\times$' },
  { label: '÷', desc: 'قسمة', code: '$\\div$' },
  { label: '≤', desc: 'أصغر من أو يساوي', code: '$\\le$' },
  { label: '≥', desc: 'أكبر من أو يساوي', code: '$\\ge$' },
  { label: '≠', desc: 'لا يساوي', code: '$\\neq$' },
  { label: '≈', desc: 'تقريباً يساوي', code: '$\\approx$' },
  { label: '∈', desc: 'ينتمي إلى', code: '$\\in$' },
  { label: '∉', desc: 'لا ينتمي إلى', code: '$\\notin$' },
  { label: '∪', desc: 'اتحاد', code: '$\\cup$' },
  { label: '∩', desc: 'تقاطع', code: '$\\cap$' },
  { label: '∞', desc: 'ما لا نهاية', code: '$\\infty$' },
  { label: 'H₂O', desc: 'ماء (صيغة كيميائية)', code: '$\\ce{H2O}$' },
  { label: 'CO₂', desc: 'ثاني أكسيد الكربون', code: '$\\ce{CO2}$' },
  { label: '➔', desc: 'سهم تفاعل كيميائي', code: '$\\ce{->}$' }
];

export default function QuickLatexToolbar({ 
  onInsert, 
  compact = false, 
  showFullToggle = true, 
  isFullOpen = false, 
  onToggleFull = null,
  title = 'معادلات ورموز سريعة:' 
}) {
  const [langMode, setLangMode] = useState('arabic'); // 'arabic' | 'english'
  const currentPresets = langMode === 'arabic' ? ARABIC_PRESETS : ENGLISH_PRESETS;

  return (
    <div 
      className="quick-latex-toolbar" 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '4px' : '6px',
        flexWrap: 'wrap',
        margin: compact ? '3px 0' : '6px 0',
        padding: compact ? '3px 6px' : '6px 10px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1.5px solid #e2e8f0',
        fontSize: compact ? '11px' : '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

        {/* Quick Language Switcher: Arabic vs English Symbols */}
        <div style={{
          display: 'inline-flex',
          borderRadius: '5px',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
          background: '#ffffff'
        }}>
          <button
            type="button"
            onClick={() => setLangMode('arabic')}
            style={{
              padding: '2px 7px',
              fontSize: '10px',
              fontWeight: 'bold',
              border: 'none',
              background: langMode === 'arabic' ? '#0e7490' : '#ffffff',
              color: langMode === 'arabic' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="إظهار رموز الرياضيات المعتمدة باللغة العربية (س، ص، ع، نق، ط، جا، جتا، إلخ)"
          >
            🇸🇦 عربي
          </button>
          <button
            type="button"
            onClick={() => setLangMode('english')}
            style={{
              padding: '2px 7px',
              fontSize: '10px',
              fontWeight: 'bold',
              border: 'none',
              background: langMode === 'english' ? '#0e7490' : '#ffffff',
              color: langMode === 'english' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="إظهار رموز الرياضيات والعلوم الإنجليزية واللاتينية (x, y, sin, cos, frac, etc.)"
          >
            🌐 English
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '3px' : '5px', flexWrap: 'wrap' }}>
        {currentPresets.map((item, idx) => (
          <button
            key={idx}
            type="button"
            title={`${item.desc} (${item.code}) - انقر للإدراج فورياً`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onInsert) onInsert(item.code);
            }}
            style={{
              padding: compact ? '2px 6px' : '3px 8px',
              fontSize: compact ? '11px' : '12px',
              fontFamily: 'Cairo, monospace, sans-serif',
              fontWeight: 'bold',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              color: '#0f172a',
              cursor: 'pointer',
              lineHeight: '1.2',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0e7490';
              e.currentTarget.style.color = '#0e7490';
              e.currentTarget.style.background = '#ecfeff';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Expanded LaTeX Toolbar Toggle */}
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
            padding: compact ? '2px 8px' : '3px 10px',
            fontSize: compact ? '10px' : '11px',
            fontWeight: 'bold',
            background: isFullOpen ? '#ecfeff' : '#f1f5f9',
            border: isFullOpen ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
            borderRadius: '5px',
            color: isFullOpen ? '#0e7490' : '#475569',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="فتح لوحة LaTeX الكاملة لجميع الرموز والتفاضل والتكامل والكيمياء والقوالب الجاهزة"
        >
          <span>📐 {isFullOpen ? 'إخفاء اللوحة الموسعة' : 'لوحة المعادلات الموسعة'}</span>
          {isFullOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  );
}
