import React, { useState } from 'react';
import { 
  GraduationCap, Sparkles, ExternalLink, X, BookOpen, 
  CheckCircle2, Clock, Zap, Target, FileText, Camera, ArrowLeft
} from 'lucide-react';

export default function QiyasPlatformModal({ isLoginPage = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const qiyasUrl = 'https://mathofmemo1234-debug.github.io/qiyas-platform/';

  const handleOpenPlatform = () => {
    window.open(qiyasUrl, '_blank', 'noopener,noreferrer');
  };

  const features = [
    {
      icon: <Target size={22} color="#0284c7" />,
      title: 'مسار التأسيس الشامل',
      desc: 'بناء المفاهيم والقواعد الأساسية في القسمين الكمي واللفظي بأسلوب شيق ومبسط يضمن استيعاب كافة المهارات.'
    },
    {
      icon: <Clock size={22} color="#4f46e5" />,
      title: 'محاكي قياس المحوسب',
      desc: 'تجربة واقعية تحاكي شاشات وبيئة اختبارات قياس الفعلية، مع ضبط التوقيت لكل قسم وتوزيع الأسئلة الدقيق.'
    },
    {
      icon: <Zap size={22} color="#d97706" />,
      title: 'بنك الأسئلة والاختبار الذاتي',
      desc: 'آلاف الأسئلة المتدرجة والمصنفة مهارياً، مع إمكانية تصميم اختبارات مخصصة تلائم مستوى الطالب وتركيزه.'
    },
    {
      icon: <BookOpen size={22} color="#dc2626" />,
      title: 'دفتر الأخطاء الذكي',
      desc: 'رصد فوري وتلقائي للأسئلة غير الموفقة مع تحليل أسباب الخطأ وإمكانية إعادة التدريب عليها حتى الوصول للإتقان.'
    },
    {
      icon: <Camera size={22} color="#059669" />,
      title: 'قارئ الـ OCR ومستورد PDF',
      desc: 'تقنية ذكية للتعرف على الأسئلة والمعادلات من الصور وملفات الـ PDF فورياً واستيرادها بنقرة واحدة.'
    },
    {
      icon: <FileText size={22} color="#7c3aed" />,
      title: 'محرك المعادلات والرموز الرياضية',
      desc: 'دعم كامل لمحرك MathJax لعرض الرموز الرياضية والكسور والجذور باللغة العربية واللاتينية بأعلى دقة ووضوح.'
    }
  ];

  return (
    <>
      {/* Attractive Floating Action Button (Far from the bottom-left About Us button) */}
      <button
        type="button"
        className={`floating-qiyas-btn ${isLoginPage ? 'floating-qiyas-login' : ''}`}
        onClick={() => setIsOpen(true)}
        title="منصة نَبِـيــهْ للقدرات العامة | تدريب تفاعلي ومحاكاة حقيقية لقياس"
      >
        <span className="qiyas-pulse-ring" />
        <span className="qiyas-pulse-dot" />
        <div className="qiyas-btn-icon-wrapper">
          <GraduationCap size={20} className="qiyas-btn-icon" />
        </div>
        <div className="qiyas-btn-text">
          <span className="qiyas-title">منصة نَبِـيــهْ للقدرات</span>
          <span className="qiyas-sub">تدريب تفاعلي ومحاكي قياس</span>
        </div>
        <Sparkles size={16} className="qiyas-sparkle" />
      </button>

      {/* Distinguished Introduction Modal */}
      {isOpen && (
        <div 
          className="qiyas-modal-overlay"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="qiyas-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="qiyas-modal-close-btn"
              title="إغلاق"
            >
              <X size={20} />
            </button>

            {/* Header Hero Banner */}
            <div className="qiyas-modal-hero">
              <div className="qiyas-hero-decoration" />
              <div className="qiyas-hero-badge">
                <Sparkles size={14} />
                <span>المنصة التفاعلية المعتمدة للقدرات</span>
              </div>
              <h2 className="qiyas-hero-title">
                منصة نَبِـيــهْ للقدرات العامة
              </h2>
              <p className="qiyas-hero-subtitle">
                التدريب التفاعلي الذكي للقسمين الكمي واللفظي، ومحاكاة بيئة اختبارات قياس المحوسبة الفعلية بأحدث المعايير
              </p>

              {/* Quick Launch Button in Header */}
              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={handleOpenPlatform}
                  className="qiyas-launch-hero-btn"
                >
                  <span>الدخول المباشر للمنصة الآن</span>
                  <ExternalLink size={18} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="qiyas-modal-body">
              {/* Introduction Box */}
              <div className="qiyas-intro-box">
                <h3 className="qiyas-section-title">
                  <GraduationCap size={22} className="text-indigo-600" />
                  عن منصة نَبِـيــهْ للقدرات
                </h3>
                <p className="qiyas-intro-text">
                  تُعد منصة <strong>«نَبِـيــهْ»</strong> الوجهة الشاملة والمتطورة لتدريب وتمكين طلابنا وطالباتنا لاجتياز اختبارات القدرات العامة بكفاءة واقتدار. توفر المنصة منظومة متكاملة تجمع بين التأسيس المنهجي المتدرج والمحاكاة الحقيقية للاختبار المحوسب، مدعومة بأدوات ذكاء اصطناعي لتحليل نقاط القوة ومعالجة نقاط الضعف بدقة فائقة.
                </p>
              </div>

              {/* Pillars & Features Grid */}
              <h3 className="qiyas-section-title" style={{ marginTop: '24px', marginBottom: '14px' }}>
                <Sparkles size={20} className="text-amber-500" />
                أبرز ركائز ومميزات المنصة
              </h3>
              <div className="qiyas-features-grid">
                {features.map((feat, idx) => (
                  <div key={idx} className="qiyas-feature-card">
                    <div className="qiyas-feature-icon-box">
                      {feat.icon}
                    </div>
                    <div className="qiyas-feature-info">
                      <h4 className="qiyas-feature-title">{feat.title}</h4>
                      <p className="qiyas-feature-desc">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* System Compatibility & Highlights */}
              <div className="qiyas-highlights-box">
                <div className="qiyas-highlight-item">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>تطبيق ويب تقدمي (PWA) يعمل على الجوال والتابلت والكمبيوتر</span>
                </div>
                <div className="qiyas-highlight-item">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>محاكاة مطابقة 100% لواجهة وتوقيت المركز الوطني للقياس</span>
                </div>
                <div className="qiyas-highlight-item">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>تقارير أداء فورية وقياس دقيق لنسبة الإتقان وسرعة الحل</span>
                </div>
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="qiyas-modal-footer">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="qiyas-btn-cancel"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handleOpenPlatform}
                className="qiyas-btn-primary"
              >
                <span>الانتقال إلى منصة نَبِـيــهْ للقدرات</span>
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
