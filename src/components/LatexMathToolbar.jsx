import React, { useState } from 'react';
import MarkdownViewer from './MarkdownViewer';
import { 
  Calculator, 
  FlaskConical, 
  Sparkles, 
  Copy, 
  Check, 
  Eye, 
  PlusCircle,
  HelpCircle,
  Languages,
  BookOpen
} from 'lucide-react';

export default function LatexMathToolbar({ onInsert, compact = false }) {
  // Tabs: 'arabic_math' | 'english_math' | 'chem' | 'templates'
  const [activeTab, setActiveTab] = useState('arabic_math');
  const [testInput, setTestInput] = useState('\\text{س}^2 + 5\\text{س} + 6 = 0');
  const [copiedCode, setCopiedCode] = useState(null);

  const handleInsert = (code) => {
    if (onInsert) {
      onInsert(code);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  // 1. Arabic Math Groups (رموز ومعادلات الرياضيات المعتمدة باللغة العربية)
  const arabicMathGroups = [
    {
      title: 'المتغيرات والأسس والجذور العربية',
      items: [
        { label: 'س', desc: 'المتغير س', code: '$\\text{س}$' },
        { label: 'ص', desc: 'المتغير ص', code: '$\\text{ص}$' },
        { label: 'ع', desc: 'المتغير ع', code: '$\\text{ع}$' },
        { label: 'ن', desc: 'المتغير ن', code: '$\\text{ن}$' },
        { label: 'ل', desc: 'المتغير ل', code: '$\\text{ل}$' },
        { label: 'م', desc: 'المتغير م', code: '$\\text{م}$' },
        { label: 'س²', desc: 'س تربيع', code: '$\\text{س}^2$' },
        { label: 'س³', desc: 'س تكعيب', code: '$\\text{س}^3$' },
        { label: 'سⁿ', desc: 'س أس ن', code: '$\\text{س}^n$' },
        { label: 'س₁', desc: 'س بدليل سفلي', code: '$\\text{س}_1$' },
        { label: '√س', desc: 'جذر تربيعي للمتغير س', code: '$\\sqrt{\\text{س}}$' },
        { label: 'ⁿ√س', desc: 'جذر نوني للمتغير س', code: '$\\sqrt[n]{\\text{س}}$' },
        { label: '|س|', desc: 'القيمة المطلقة للمتغير س', code: '$|\\text{س}|$' },
        { label: 'س/ص', desc: 'كسر اعتيادي س على ص', code: '$\\frac{\\text{س}}{\\text{ص}}$' },
        { label: 'أ/ب', desc: 'كسر أ على ب', code: '$\\frac{\\text{أ}}{\\text{ب}}$' },
        { label: '(س/ص)', desc: 'أقواس كسرية مرنة', code: '$\\left(\\frac{\\text{س}}{\\text{ص}}\\right)$' }
      ]
    },
    {
      title: 'الثوابت والهندسة والزوايا العربية',
      items: [
        { label: 'ط (π)', desc: 'النسبة التقريبية باي (ط)', code: '$\\text{ط}$' },
        { label: 'نق', desc: 'نصف القطر (نق)', code: '$\\text{نق}$' },
        { label: 'ط نق²', desc: 'مساحة الدائرة ط نق²', code: '$\\text{ط} \\, \\text{نق}^2$' },
        { label: '2 ط نق', desc: 'محيط الدائرة 2 ط نق', code: '$2 \\, \\text{ط} \\, \\text{نق}$' },
        { label: '°', desc: 'درجة مئوية / قياس زاوية', code: '$^{\\circ}$' },
        { label: '∠أ', desc: 'رمز الزاوية أ', code: '$\\angle \\text{أ}$' },
        { label: '△', desc: 'رمز المثلث', code: '$\\triangle$' },
        { label: '∥', desc: 'يوازي', code: '$\\parallel$' },
        { label: '⊥', desc: 'يعامد', code: '$\\perp$' },
        { label: 'ق(∠أ)', desc: 'قياس الزاوية أ', code: '$\\text{ق}(\\angle \\text{أ})$' }
      ]
    },
    {
      title: 'الدوال المثلثية والنهايات والتكامل العربي',
      items: [
        { label: 'جا(س)', desc: 'جيب الزاوية (جا)', code: '$\\text{جا}(\\text{س})$' },
        { label: 'جتا(س)', desc: 'جيب التمام (جتا)', code: '$\\text{جتا}(\\text{س})$' },
        { label: 'ظا(س)', desc: 'ظل الزاوية (ظا)', code: '$\\text{ظا}(\\text{س})$' },
        { label: 'ظتا(س)', desc: 'ظل تمام الزاوية (ظتا)', code: '$\\text{ظتا}(\\text{س})$' },
        { label: 'قا(س)', desc: 'قاطع الزاوية (قا)', code: '$\\text{قا}(\\text{س})$' },
        { label: 'قتا(س)', desc: 'قاطع تمام الزاوية (قتا)', code: '$\\text{قتا}(\\text{س})$' },
        { label: 'لو(س)', desc: 'اللوغاريتم (لو)', code: '$\\text{لو}(\\text{س})$' },
        { label: 'نها د(س)', desc: 'نهاية دالة عندما س تؤول للصفر', code: '$\\lim_{\\text{س} \\to 0} د(\\text{س})$' },
        { label: '∫ د(س)ءس', desc: 'تكامل دالة بالنسبة للمتغير س', code: '$\\int د(\\text{س}) \\, d\\text{س}$' },
        { label: 'مجـ', desc: 'المجموع التراكمي (مجـ)', code: '$\\sum_{i=1}^{n} \\text{س}_i$' }
      ]
    },
    {
      title: 'العمليات والمقارنات',
      items: [
        { label: '×', desc: 'علامة الضرب', code: '$\\times$' },
        { label: '÷', desc: 'علامة القسمة', code: '$\\div$' },
        { label: '±', desc: 'زائد أو ناقص', code: '$\\pm$' },
        { label: '·', desc: 'ضرب نقطي', code: '$\\cdot$' },
        { label: '≤', desc: 'أصغر من أو يساوي', code: '$\\le$' },
        { label: '≥', desc: 'أكبر من أو يساوي', code: '$\\ge$' },
        { label: '≠', desc: 'لا يساوي', code: '$\\neq$' },
        { label: '≈', desc: 'يساوي تقريباً', code: '$\\approx$' },
        { label: '≡', desc: 'يطابق', code: '$\\equiv$' },
        { label: '∞', desc: 'ما لا نهاية', code: '$\\infty$' }
      ]
    }
  ];

  // 2. English Math Groups (English & Latin Math Notation)
  const englishMathGroups = [
    {
      title: 'Fractions, Powers & Roots (Latin)',
      items: [
        { label: 'a/b', desc: 'كسر اعتيادي إنجليزي', code: '$\\frac{a}{b}$' },
        { label: 'x²', desc: 'x تربيع', code: '$x^2$' },
        { label: 'xⁿ', desc: 'x أس متغير', code: '$x^n$' },
        { label: 'x₁', desc: 'دليل سفلي', code: '$x_1$' },
        { label: '√x', desc: 'جذر تربيعي', code: '$\\sqrt{x}$' },
        { label: 'ⁿ√x', desc: 'جذر نوني', code: '$\\sqrt[n]{x}$' },
        { label: '|x|', desc: 'قيمة مطلقة', code: '$|x|$' },
        { label: '(a/b)', desc: 'أقواس كسرية مرنة', code: '$\\left(\\frac{a}{b}\\right)$' }
      ]
    },
    {
      title: 'Functions, Trigonometry & Calculus (Latin)',
      items: [
        { label: 'sin(x)', desc: 'جيب الزاوية (sin)', code: '$\\sin(x)$' },
        { label: 'cos(x)', desc: 'جيب التمام (cos)', code: '$\\cos(x)$' },
        { label: 'tan(x)', desc: 'ظل الزاوية (tan)', code: '$\\tan(x)$' },
        { label: 'log(x)', desc: 'اللوغاريتم العشري', code: '$\\log(x)$' },
        { label: 'ln(x)', desc: 'اللوغاريتم الطبيعي', code: '$\\ln(x)$' },
        { label: 'lim', desc: 'نهاية دالة', code: '$\\lim_{x \\to 0} f(x)$' },
        { label: 'df/dx', desc: 'مشتقة أولى', code: '$\\frac{df}{dx}$' },
        { label: '∫', desc: 'تكامل محدد', code: '$\\int_{a}^{b} f(x)\\,dx$' },
        { label: '∑', desc: 'المجموع التراكمي', code: '$\\sum_{i=1}^{n} x_i$' }
      ]
    },
    {
      title: 'Greek Letters & Vectors',
      items: [
        { label: 'π', desc: 'باي (Pi)', code: '$\\pi$' },
        { label: 'θ', desc: 'ثيتا (زاوية)', code: '$\\theta$' },
        { label: 'α', desc: 'ألفا', code: '$\\alpha$' },
        { label: 'β', desc: 'بيتا', code: '$\\beta$' },
        { label: 'Δ', desc: 'دلتا (التغير)', code: '$\\Delta$' },
        { label: 'λ', desc: 'لامدا (الطول الموجي)', code: '$\\lambda$' },
        { label: 'μ', desc: 'ميكرو / معامل الاحتكاك', code: '$\\mu$' },
        { label: 'v⃗', desc: 'متجه', code: '$\\vec{v}$' }
      ]
    }
  ];

  // 3. Chemistry & Physics
  const chemGroups = [
    {
      title: 'صيغ كيميائية شهيرة (Chemical Formulas)',
      items: [
        { label: 'ماء (H₂O)', desc: 'الماء', code: '$\\ce{H2O}$' },
        { label: 'CO₂', desc: 'ثاني أكسيد الكربون', code: '$\\ce{CO2}$' },
        { label: 'O₂', desc: 'غاز الأكسجين', code: '$\\ce{O2}$' },
        { label: 'H₂', desc: 'غاز الهيدروجين', code: '$\\ce{H2}$' },
        { label: 'NaCl', desc: 'كلوريد الصوديوم (ملح)', code: '$\\ce{NaCl}$' },
        { label: 'HCl', desc: 'حمض الهيدروكلوريك', code: '$\\ce{HCl}$' },
        { label: 'H₂SO₄', desc: 'حمض الكبريتيك', code: '$\\ce{H2SO4}$' },
        { label: 'NaOH', desc: 'هيدروكسيد الصوديوم', code: '$\\ce{NaOH}$' },
        { label: 'CaCO₃', desc: 'كربونات الكالسيوم', code: '$\\ce{CaCO3}$' },
        { label: 'C₆H₁₂O₆', desc: 'الجلوكوز', code: '$\\ce{C6H12O6}$' }
      ]
    },
    {
      title: 'أسهم التفاعل والأيونات وحالات المادة',
      items: [
        { label: '➔', desc: 'سهم التفاعل الكيميائي', code: '$\\ce{->}$' },
        { label: '⇄', desc: 'اتزان كيميائي (تفاعل عكسي)', code: '$\\ce{<=>}$' },
        { label: '➔[Δ]', desc: 'تفاعل مع تسخين', code: '$\\ce{->[\\Delta]}$' },
        { label: '↑ (غاز)', desc: 'تصاعد غاز', code: '$\\ce{^}$' },
        { label: '↓ (راسب)', desc: 'تكون راسب في المحلول', code: '$\\ce{v}$' },
        { label: 'Na⁺', desc: 'أيون صوديوم', code: '$\\ce{Na+}$' },
        { label: 'Cl⁻', desc: 'أيون كلوريد', code: '$\\ce{Cl-}$' },
        { label: '(s) صلب', desc: 'حالة صلبة', code: '$\\ce{(s)}$' },
        { label: '(aq) مائي', desc: 'محلول مائي', code: '$\\ce{(aq)}$' }
      ]
    }
  ];

  // 4. Bilingual Zero-Error Equation Templates
  const templateList = [
    {
      title: 'القانون العام للمعادلة التربيعية (رموز عربية)',
      lang: 'عربي',
      subject: 'رياضيات',
      code: '$$\\text{س} = \\frac{-\\text{ب} \\pm \\sqrt{\\text{ب}^2 - 4\\text{أ}\\text{ج}}}{2\\text{أ}}$$'
    },
    {
      title: 'القانون العام للمعادلة التربيعية (رموز إنجليزية)',
      lang: 'English',
      subject: 'رياضيات',
      code: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'
    },
    {
      title: 'نظرية فيثاغورس (رموز عربية)',
      lang: 'عربي',
      subject: 'رياضيات',
      code: '$$\\text{أ}^2 + \\text{ب}^2 = \\text{ج}^2$$'
    },
    {
      title: 'نظرية فيثاغورس (رموز إنجليزية)',
      lang: 'English',
      subject: 'رياضيات',
      code: '$$a^2 + b^2 = c^2$$'
    },
    {
      title: 'مساحة ومحيط الدائرة (رموز عربية)',
      lang: 'عربي',
      subject: 'رياضيات',
      code: '$$\\text{المساحة} = \\text{ط} \\, \\text{نق}^2 \\quad , \\quad \\text{المحيط} = 2 \\, \\text{ط} \\, \\text{نق}$$'
    },
    {
      title: 'مساحة ومحيط الدائرة (رموز إنجليزية)',
      lang: 'English',
      subject: 'رياضيات',
      code: '$$A = \\pi r^2 \\quad , \\quad C = 2\\pi r$$'
    },
    {
      title: 'المتطابقة المثلثية الأساسية (رموز عربية)',
      lang: 'عربي',
      subject: 'رياضيات',
      code: '$$\\text{جا}^2(\\text{س}) + \\text{جتا}^2(\\text{س}) = 1$$'
    },
    {
      title: 'المتطابقة المثلثية الأساسية (رموز إنجليزية)',
      lang: 'English',
      subject: 'رياضيات',
      code: '$$\\sin^2(x) + \\cos^2(x) = 1$$'
    },
    {
      title: 'معادلة الخط المستقيم (صيغة الميل والمقطع)',
      lang: 'English',
      subject: 'رياضيات',
      code: '$$y = mx + b$$'
    },
    {
      title: 'معادلة تكوين الماء',
      lang: 'عالمي',
      subject: 'كيمياء',
      code: '$$\\ce{2H2 (g) + O2 (g) -> 2H2O (l)}$$'
    },
    {
      title: 'تفاعل البناء الضوئي',
      lang: 'عالمي',
      subject: 'كيمياء / أحياء',
      code: '$$\\ce{6CO2 + 6H2O ->[ضوء] C6H12O6 + 6O2 ^}$$'
    },
    {
      title: 'قانون نيوتن الثاني للحركة',
      lang: 'فيزياء',
      subject: 'فيزياء',
      code: '$$F = m \\cdot a$$'
    },
    {
      title: 'معادلة أينشتاين للكتلة والطاقة',
      lang: 'فيزياء',
      subject: 'فيزياء',
      code: '$$E = mc^2$$'
    }
  ];

  return (
    <div style={{
      background: '#f8fafc',
      border: '1.5px solid #cbd5e1',
      borderRadius: '12px',
      padding: compact ? '10px' : '14px',
      marginBottom: '12px',
      direction: 'rtl'
    }}>
      {/* Header and Category Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '10px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: 'linear-gradient(135deg, #0e7490, #0891b2)',
            color: '#fff',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <Sparkles size={14} /> لوحة المعادلات الشاملة (عربي / إنجليزي)
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            يدعم تلقائياً الرموز العربية (س، ص، جا، نق) والرموز الإنجليزية خالية من الأخطاء
          </span>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('arabic_math')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: activeTab === 'arabic_math' ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
              background: activeTab === 'arabic_math' ? '#ecfeff' : '#fff',
              color: activeTab === 'arabic_math' ? '#0e7490' : '#475569',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🇸🇦 رياضيات عربية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('english_math')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: activeTab === 'english_math' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
              background: activeTab === 'english_math' ? '#eff6ff' : '#fff',
              color: activeTab === 'english_math' ? '#2563eb' : '#475569',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🌐 English Math</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chem')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: activeTab === 'chem' ? '1.5px solid #059669' : '1px solid #cbd5e1',
              background: activeTab === 'chem' ? '#ecfdf5' : '#fff',
              color: activeTab === 'chem' ? '#059669' : '#475569',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FlaskConical size={13} /> كيمياء وفيزياء
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: activeTab === 'templates' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
              background: activeTab === 'templates' ? '#f5f3ff' : '#fff',
              color: activeTab === 'templates' ? '#7c3aed' : '#475569',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Sparkles size={13} /> قوالب جاهزة
          </button>
        </div>
      </div>

      {/* Tab 1: Arabic Mathematics */}
      {activeTab === 'arabic_math' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {arabicMathGroups.map((grp, gIdx) => (
            <div key={gIdx} style={{ background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>
                {grp.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {grp.items.map((item, iIdx) => (
                  <button
                    key={iIdx}
                    type="button"
                    onClick={() => handleInsert(item.code)}
                    title={`${item.desc} | انقر للإدراج فورياً`}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#1e293b',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#0e7490';
                      e.currentTarget.style.background = '#f0fdfa';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 'bold', color: '#0e7490' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      ({item.desc})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: English Mathematics */}
      {activeTab === 'english_math' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {englishMathGroups.map((grp, gIdx) => (
            <div key={gIdx} style={{ background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', marginBottom: '6px' }}>
                {grp.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {grp.items.map((item, iIdx) => (
                  <button
                    key={iIdx}
                    type="button"
                    onClick={() => handleInsert(item.code)}
                    title={`${item.desc} | Click to insert: ${item.code}`}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#1e293b',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', direction: 'ltr', color: '#1d4ed8' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      ({item.desc})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Chemistry & Physics */}
      {activeTab === 'chem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {chemGroups.map((grp, gIdx) => (
            <div key={gIdx} style={{ background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#059669', marginBottom: '6px' }}>
                {grp.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {grp.items.map((item, iIdx) => (
                  <button
                    key={iIdx}
                    type="button"
                    onClick={() => handleInsert(item.code)}
                    title={`${item.desc} | انقر للإدراج`}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#1e293b',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#059669';
                      e.currentTarget.style.background = '#ecfdf5';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', direction: 'ltr', color: '#047857' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      ({item.desc})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Ready Templates (Arabic & English) */}
      {activeTab === 'templates' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '8px'
        }}>
          {templateList.map((tpl, tIdx) => (
            <div
              key={tIdx}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
                    {tpl.title}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: tpl.lang === 'عربي' ? '#dcfce7' : '#e0f2fe',
                    color: tpl.lang === 'عربي' ? '#15803d' : '#0369a1',
                    fontWeight: 'bold'
                  }}>
                    {tpl.lang}
                  </span>
                </div>
                <div style={{
                  padding: '6px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  minHeight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MarkdownViewer content={tpl.code} inline />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleCopy(tpl.code)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#475569'
                  }}
                  title="نسخ كود LaTeX"
                >
                  {copiedCode === tpl.code ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  {copiedCode === tpl.code ? 'تم النسخ' : 'نسخ'}
                </button>
                <button
                  type="button"
                  onClick={() => handleInsert(tpl.code)}
                  style={{
                    background: '#0e7490',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#fff',
                    fontWeight: 'bold'
                  }}
                  title="إدراج في موضع المؤشر"
                >
                  <PlusCircle size={12} /> إدراج
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Quick-Test Sandbox & Instant Preview Strip */}
      <div style={{
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 260px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>
            🧪 تجربة صيغة فورية:
          </span>
          <input
            type="text"
            dir="ltr"
            placeholder="اكتب معادلة بالعربي (س^2 + 5س = 0) أو بالإنجليزي..."
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '12px',
              fontFamily: 'Cairo, monospace, sans-serif',
              border: '1px solid #cbd5e1',
              borderRadius: '6px'
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '4px 12px',
          minWidth: '150px'
        }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>المعاينة:</span>
          <div style={{ fontSize: '13px' }}>
            <MarkdownViewer content={testInput.startsWith('$') ? testInput : `$${testInput}$`} inline />
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleInsert(testInput.startsWith('$') ? testInput : `$${testInput}$`)}
          style={{
            background: '#0e7490',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <PlusCircle size={13} /> إدراج الصيغة التجريبية
        </button>
      </div>

      {/* Helpful Quick Tip */}
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <HelpCircle size={13} color="#0e7490" />
        <span>
          <strong>ضمان عدم الخطأ:</strong> يتعرف النظام تلقائياً على كل المتغيرات العربية مثل <code style={{ color: '#0e7490' }}>س² + 5س + 6 = 0</code> و <code style={{ color: '#0e7490' }}>ط نق²</code> وكذلك الإنجليزية <code style={{ color: '#2563eb' }}>x^2 + 2x = 0</code> دون الحاجة لكتابة كود معقد.
        </span>
      </div>
    </div>
  );
}
