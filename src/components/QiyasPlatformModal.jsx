import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, Sparkles, ExternalLink, X, BookOpen, 
  CheckCircle2, Clock, Zap, Target, FileText, Camera, ArrowLeft, GripVertical
} from 'lucide-react';

export default function QiyasPlatformModal({ isLoginPage = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const qiyasUrl = 'https://mathofmemo1234-debug.github.io/qiyas-platform/';

  // Draggable Floating Position State
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('nabeeh_button_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.top === 'number' && typeof parsed.left === 'number') {
          const clampedTop = Math.max(10, Math.min(window.innerHeight - 50, parsed.top));
          const clampedLeft = Math.max(10, Math.min(window.innerWidth - 170, parsed.left));
          return { top: clampedTop, left: clampedLeft };
        }
      }
    } catch (e) {}

    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const defaultLeft = isLoginPage ? Math.max(16, w - 190) : Math.max(16, w - 460);
    const defaultTop = Math.max(16, h - 70);
    return { top: defaultTop, left: defaultLeft };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef({
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
    hasMoved: false
  });
  const buttonRef = useRef(null);

  // Keep button inside viewport on screen resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        return {
          top: Math.max(10, Math.min(h - 50, prev.top)),
          left: Math.max(10, Math.min(w - 170, prev.left))
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse Drag Handler
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragInfoRef.current = {
      startX,
      startY,
      startTop: position.top,
      startLeft: position.left,
      hasMoved: false
    };

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragInfoRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragInfoRef.current.hasMoved) {
        moveEvent.preventDefault();
        const btnW = buttonRef.current?.offsetWidth || 165;
        const btnH = buttonRef.current?.offsetHeight || 36;
        const newLeft = Math.max(10, Math.min(window.innerWidth - btnW - 10, dragInfoRef.current.startLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - btnH - 10, dragInfoRef.current.startTop + dy));
        setPosition({ top: newTop, left: newLeft });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);

      if (dragInfoRef.current.hasMoved) {
        setPosition(curr => {
          try {
            localStorage.setItem('nabeeh_button_pos', JSON.stringify(curr));
          } catch (e) {}
          return curr;
        });
      } else {
        setIsOpen(true);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Touch Drag Handler for Tablets and Mobile
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    dragInfoRef.current = {
      startX,
      startY,
      startTop: position.top,
      startLeft: position.left,
      hasMoved: false
    };

    const handleTouchMove = (moveEvent) => {
      const t = moveEvent.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragInfoRef.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragInfoRef.current.hasMoved) {
        if (moveEvent.cancelable) moveEvent.preventDefault();
        const btnW = buttonRef.current?.offsetWidth || 165;
        const btnH = buttonRef.current?.offsetHeight || 36;
        const newLeft = Math.max(10, Math.min(window.innerWidth - btnW - 10, dragInfoRef.current.startLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - btnH - 10, dragInfoRef.current.startTop + dy));
        setPosition({ top: newTop, left: newLeft });
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      setIsDragging(false);

      if (dragInfoRef.current.hasMoved) {
        setPosition(curr => {
          try {
            localStorage.setItem('nabeeh_button_pos', JSON.stringify(curr));
          } catch (e) {}
          return curr;
        });
      } else {
        setIsOpen(true);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

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
      {/* Draggable Compact Floating Action Button */}
      <button
        ref={buttonRef}
        type="button"
        className={`floating-qiyas-btn no-print ${isDragging ? 'is-dragging' : ''}`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          bottom: 'auto',
          right: 'auto',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title="اسحب الزر لنقله لأي مكان فارغ • اضغط لفتح منصة نبيه للقدرات"
      >
        <div className="qiyas-drag-grip" title="اسحب للتحريك">
          <GripVertical size={13} />
        </div>
        <div className="qiyas-btn-icon-wrapper">
          <GraduationCap size={15} className="qiyas-btn-icon" />
        </div>
        <span className="qiyas-title">منصة نَبِـيــهْ للقدرات</span>
        <Sparkles size={13} className="qiyas-sparkle" />
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
