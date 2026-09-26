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
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function LatexMathToolbar({ onInsert, compact = false }) {
  const [activeTab, setActiveTab] = useState('math'); // 'math' | 'chem' | 'templates'
  const [testInput, setTestInput] = useState('\\frac{a}{b}');
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

  // Math categories
  const mathGroups = [
    {
      title: 'الكسور والأسس والجذور',
      items: [
        { label: 'a/b', desc: 'كسر اعتيادي', code: '$\\frac{a}{b}$' },
        { label: 'x²', desc: 'أس تربيعي', code: '$x^2$' },
        { label: 'xⁿ', desc: 'أس متغير', code: '$x^n$' },
        { label: 'x₁', desc: 'دليل سفلي', code: '$x_1$' },
        { label: '√x', desc: 'جذر تربيعي', code: '$\\sqrt{x}$' },
        { label: 'ⁿ√x', desc: 'جذر نوني', code: '$\\sqrt[n]{x}$' },
        { label: '|x|', desc: 'قيمة مطلقة', code: '$|x|$' },
        { label: '(a/b)', desc: 'أقواس كسرية مرنة', code: '$\\left(\\frac{a}{b}\\right)$' },
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
        { label: '∞', desc: 'ما لا نهاية', code: '$\\infty$' },
      ]
    },
    {
      title: 'الحروف والرموز والزوايا',
      items: [
        { label: 'π', desc: 'باي (ط)', code: '$\\pi$' },
        { label: 'θ', desc: 'ثيتا (زاوية)', code: '$\\theta$' },
        { label: 'α', desc: 'ألفا', code: '$\\alpha$' },
        { label: 'β', desc: 'بيتا', code: '$\\beta$' },
        { label: 'Δ', desc: 'دلتا (التغير)', code: '$\\Delta$' },
        { label: 'λ', desc: 'لامدا (الطول الموجي)', code: '$\\lambda$' },
        { label: 'μ', desc: 'ميكرو / معامل الاحتكاك', code: '$\\mu$' },
        { label: '°', desc: 'درجة مئوية / زاوية', code: '$^{\\circ}$' },
        { label: '∠A', desc: 'رمز الزاوية', code: '$\\angle A$' },
        { label: '∥', desc: 'يوازي', code: '$\\parallel$' },
        { label: '⊥', desc: 'يعامد', code: '$\\perp$' },
        { label: 'v⃗', desc: 'متجه', code: '$\\vec{v}$' }
      ]
    },
    {
      title: 'التفاضل والتكامل والمجموع',
      items: [
        { label: '∑', desc: 'المجموع التراكمي', code: '$\\sum_{i=1}^{n} x_i$' },
        { label: '∫', desc: 'تكامل محدد', code: '$\\int_{a}^{b} f(x)\\,dx$' },
        { label: 'lim', desc: 'نهاية دالة', code: '$\\lim_{x \\to 0} f(x)$' },
        { label: 'df/dx', desc: 'مشتقة أولى', code: '$\\frac{df}{dx}$' }
      ]
    }
  ];

  // Chemistry categories
  const chemGroups = [
    {
      title: 'صيغ كيميائية شهيرة (Chemical Formulas)',
      items: [
        { label: 'ماء (H₂O)', desc: 'الماء', code: '$\\ce{H2O}$' },
        { label: 'CO₂', desc: 'ثاني أكسيد الكربون', code: '$\\ce{CO2}$' },
        { label: 'O₂', desc: 'غاز الأكسجين', code: '$\\ce{O2}$' },
        { label: 'H₂', desc: 'غاز الهيدروجين', code: '$\\ce{H2}$' },
        { label: 'N₂', desc: 'غاز النيتروجين', code: '$\\ce{N2}$' },
        { label: 'NaCl', desc: 'كلوريد الصوديوم (ملح)', code: '$\\ce{NaCl}$' },
        { label: 'HCl', desc: 'حمض الهيدروكلوريك', code: '$\\ce{HCl}$' },
        { label: 'H₂SO₄', desc: 'حمض الكبريتيك', code: '$\\ce{H2SO4}$' },
        { label: 'NaOH', desc: 'هيدروكسيد الصوديوم', code: '$\\ce{NaOH}$' },
        { label: 'CaCO₃', desc: 'كربونات الكالسيوم', code: '$\\ce{CaCO3}$' },
        { label: 'CH₄', desc: 'الميثان', code: '$\\ce{CH4}$' },
        { label: 'NH₃', desc: 'النشادر (الأمونيا)', code: '$\\ce{NH3}$' },
        { label: 'C₆H₁₂O₆', desc: 'الجلوكوز', code: '$\\ce{C6H12O6}$' }
      ]
    },
    {
      title: 'أسهم التفاعل والرموز الكيميائية',
      items: [
        { label: '➔', desc: 'سهم التفاعل الكيميائي', code: '$\\ce{->}$' },
        { label: '⇄', desc: 'اتزان كيميائي (تفاعل عكسي)', code: '$\\ce{<=>}$' },
        { label: '➔[Δ]', desc: 'تفاعل مع حرارة / تسخين', code: '$\\ce{->[\\Delta]}$' },
        { label: '↑ (غاز)', desc: 'تصاعد غاز', code: '$\\ce{^}$' },
        { label: '↓ (راسب)', desc: 'تكون راسب في المحلول', code: '$\\ce{v}$' },
      ]
    },
    {
      title: 'الأيونات والشحنات وحالات المادة',
      items: [
        { label: 'Na⁺', desc: 'أيون صوديوم أحادي', code: '$\\ce{Na+}$' },
        { label: 'Ca²⁺', desc: 'أيون كالسيوم ثنائي', code: '$\\ce{Ca^{2+}}$' },
        { label: 'Fe³⁺', desc: 'أيون حديد ثلاثي', code: '$\\ce{Fe^{3+}}$' },
        { label: 'Cl⁻', desc: 'أيون كلوريد سالب', code: '$\\ce{Cl-}$' },
        { label: 'SO₄²⁻', desc: 'أيون كبريتات سالب', code: '$\\ce{SO4^{2-}}$' },
        { label: 'OH⁻', desc: 'أيون هيدروكسيد', code: '$\\ce{OH-}$' },
        { label: 'H₃O⁺', desc: 'أيون الهيدرونيوم', code: '$\\ce{H3O+}$' },
        { label: 'e⁻', desc: 'إلكترون', code: '$\\ce{e-}$' },
        { label: '(s)', desc: 'حالة صلبة (Solid)', code: '$\\ce{(s)}$' },
        { label: '(l)', desc: 'حالة سائلة (Liquid)', code: '$\\ce{(l)}$' },
        { label: '(g)', desc: 'حالة غازية (Gas)', code: '$\\ce{(g)}$' },
        { label: '(aq)', desc: 'محلول مائي (Aqueous)', code: '$\\ce{(aq)}$' }
      ]
    }
  ];

  // Templates
  const templateList = [
    {
      title: 'القانون العام لحل المعادلة التربيعية',
      subject: 'رياضيات',
      code: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'
    },
    {
      title: 'معادلة الخط المستقيم (صيغة الميل والمقطع)',
      subject: 'رياضيات',
      code: '$$y = mx + b$$'
    },
    {
      title: 'نظرية فيثاغورس',
      subject: 'رياضيات',
      code: '$$a^2 + b^2 = c^2$$'
    },
    {
      title: 'مساحة الدائرة',
      subject: 'رياضيات',
      code: '$$A = \\pi r^2$$'
    },
    {
      title: 'معادلة تكوين الماء',
      subject: 'كيمياء',
      code: '$$\\ce{2H2 (g) + O2 (g) -> 2H2O (l)}$$'
    },
    {
      title: 'تفاعل البناء الضوئي',
      subject: 'كيمياء / أحياء',
      code: '$$\\ce{6CO2 + 6H2O ->[ضوء] C6H12O6 + 6O2 ^}$$'
    },
    {
      title: 'تعادل حمض وقاعدة',
      subject: 'كيمياء',
      code: '$$\\ce{HCl (aq) + NaOH (aq) -> NaCl (aq) + H2O (l)}$$'
    },
    {
      title: 'تفكك كربونات الكالسيوم بالحرارة',
      subject: 'كيمياء',
      code: '$$\\ce{CaCO3 (s) ->[\\Delta] CaO (s) + CO2 (g) ^}$$'
    },
    {
      title: 'قانون السرعة المتجهة',
      subject: 'فيزياء',
      code: '$$v = \\frac{\\Delta d}{\\Delta t}$$'
    },
    {
      title: 'قانون التسارع (العجلة)',
      subject: 'فيزياء',
      code: '$$a = \\frac{\\Delta v}{\\Delta t}$$'
    },
    {
      title: 'قانون نيوتن الثاني للحركة',
      subject: 'فيزياء',
      code: '$$F = m \\cdot a$$'
    },
    {
      title: 'قانون الطاقة الحركية',
      subject: 'فيزياء',
      code: '$$KE = \\frac{1}{2}m v^2$$'
    },
    {
      title: 'معادلة أينشتاين لتكافؤ الكتلة والطاقة',
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
            background: '#0e7490',
            color: '#fff',
            borderRadius: '8px',
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Sparkles size={14} /> لوحة LaTeX للمعادلات
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            اضغط على أي رمز أو صيغة لإدراجها مباشرة بالسؤال أو الخيار
          </span>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('math')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: activeTab === 'math' ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
              background: activeTab === 'math' ? '#ecfeff' : '#fff',
              color: activeTab === 'math' ? '#0e7490' : '#475569',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Calculator size={13} /> معادلات الرياضيات
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
            <FlaskConical size={13} /> صيغ وتفاعلات الكيمياء
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
            <Sparkles size={13} /> قوالب ومعادلات شائعة
          </button>
        </div>
      </div>

      {/* Tab 1: Mathematics */}
      {activeTab === 'math' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mathGroups.map((grp, gIdx) => (
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
                    title={`${item.desc} | انقر للإدراج: ${item.code}`}
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
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', direction: 'ltr', display: 'inline-block' }}>
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

      {/* Tab 2: Chemistry */}
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
                    title={`${item.desc} | انقر للإدراج: ${item.code}`}
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
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', direction: 'ltr', display: 'inline-block', color: '#047857' }}>
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

      {/* Tab 3: Ready Templates */}
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
                    background: tpl.subject.includes('كيمياء') ? '#d1fae5' : '#e0f2fe',
                    color: tpl.subject.includes('كيمياء') ? '#065f46' : '#0369a1',
                    fontWeight: 'bold'
                  }}>
                    {tpl.subject}
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
                  <PlusCircle size={12} /> إدراج بالطلب
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
            placeholder="اكتب أو الصق صيغة تجريبية..."
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '12px',
              fontFamily: 'monospace',
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
          <strong>إرشادات سريعة:</strong> ضع الرمز الرياضي بين علامتي دولار <code style={{ color: '#0e7490' }}>$ ... $</code>، وللكيمياء اكتب <code style={{ color: '#059669' }}>$\ce&#123;H2O&#125;$</code> أو تفاعل كامل <code style={{ color: '#059669' }}>$\ce&#123;2H2 + O2 -&gt; 2H2O&#125;$</code>.
        </span>
      </div>
    </div>
  );
}
