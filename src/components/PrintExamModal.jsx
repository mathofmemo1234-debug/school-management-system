import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X, FileText, CheckCircle, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FormsExportModal from './FormsExportModal';
import MarkdownViewer from './MarkdownViewer';

export default function PrintExamModal({
  exam,
  results = [],
  studentsCache = {},
  mode = 'exam', // 'exam' | 'results' | 'student_result'
  studentResult = null,
  onClose
}) {
  const { userData } = useAuth();
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [formsExportPlatform, setFormsExportPlatform] = useState(null);
  const [examTypeTitle, setExamTypeTitle] = useState('اختبار تقويمي / نهائي');
  const [semesterTitle, setSemesterTitle] = useState('الفصل الدراسي الثاني');
  const [academicYear, setAcademicYear] = useState('1447 - 1448 هـ');
  const [supervisorName, setSupervisorName] = useState(exam?.supervisorName || userData?.supervisorName || 'أ. أحمد المقدم');
  const [principalName, setPrincipalName] = useState(exam?.principalName || userData?.principalName || 'أ. أنس الجهني');

  // Custom typography and layout states
  const [fontFamily, setFontFamily] = useState(exam?.fontFamily || "'Cairo', sans-serif");
  const [fontColor, setFontColor] = useState(exam?.fontColor || '#000000');
  const [fontSize, setFontSize] = useState(exam?.fontSize || '11pt');
  const [optionsLayout, setOptionsLayout] = useState('single-row'); // 'single-row' | 'two-rows' | 'column'
  const [paperTemplate, setPaperTemplate] = useState('standard'); // 'standard' | 'standard_plus_bubble' | 'bubble_only'
  const [pageMargins, setPageMargins] = useState('10mm'); // '10mm' | '6mm' | '14mm'
  const [lineSpacing, setLineSpacing] = useState('1.6');
  const [showStudentBox, setShowStudentBox] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');

  const schoolName = userData?.schoolName || 'المجمع التعليمي';
  const logoUrl = userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`;
  const teacherName = userData?.name || exam?.teacherName || 'معلم المادة';

  // Statistics calculation for results
  const totalStudents = results.length;
  const rawScores = results.map(r => {
    const isAbs = r.isAbsent === true || r.score === 'غ' || r.score === 'غائب';
    return isAbs ? 0 : (parseFloat(r.score) || 0);
  });
  const maxObservedScore = rawScores.length > 0 ? Math.max(...rawScores) : 20;

  // Determine true maximum score possible for the exam
  const totalScorePossible = Math.max(
    parseFloat(exam?.maxScore) || 0,
    parseFloat(results.find(r => parseFloat(r.maxScore) > 0)?.maxScore) || 0,
    (exam?.questions?.length && exam.questions.length > 1 ? exam.questions.length : 0),
    (parseFloat(results.find(r => parseFloat(r.totalQuestions) > 1)?.totalQuestions) || 0),
    maxObservedScore,
    20
  );

  const presentResults = results.filter(r => !(r.isAbsent === true || r.score === 'غ' || r.score === 'غائب'));
  const presentCount = presentResults.length;
  const scoresArray = presentResults.map(r => Number(r.score) || 0);
  const highestScore = presentCount > 0 ? Math.max(...scoresArray) : 0;
  const lowestScore = presentCount > 0 ? Math.min(...scoresArray) : 0;
  const avgScore = presentCount > 0 ? (scoresArray.reduce((a, b) => a + b, 0) / presentCount).toFixed(1) : 0;
  const passCount = presentResults.filter(r => {
    const sMax = Math.max(parseFloat(r.maxScore) || 0, totalScorePossible, Number(r.score) || 0);
    return (Number(r.score) / (sMax || 1)) >= 0.5;
  }).length;
  const passRate = presentCount > 0 ? Math.round((passCount / presentCount) * 100) : 0;

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanExamTitle = (exam?.title || (exam?.subject ? `اختبار_${exam.subject}_${exam.targetClass || ''}` : 'اختبار')).replace(/[/\\?%*:|"<>]/g, '_').trim();
    const printTitle = mode === 'exam' ? cleanExamTitle : `كشف_نتائج_${cleanExamTitle}`;
    document.title = printTitle;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Helper to generate Word Document (.doc) Blob
  const exportToWord = () => {
    const printContent = document.getElementById('exam-printable-document');
    if (!printContent) return;

    // Clone to manipulate for Word-specific markup
    const clone = printContent.cloneNode(true);

    // Convert flex options containers into single-row tables for Word compatibility
    const optionContainers = clone.querySelectorAll('.exam-options-container');
    optionContainers.forEach(container => {
      const optionItems = container.children;
      if (optionsLayout === 'single-row' && optionItems.length > 0) {
        const table = document.createElement('table');
        table.className = 'opt-table';
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '8px';
        const tr = document.createElement('tr');
        const colWidth = `${Math.floor(100 / optionItems.length)}%`;
        Array.from(optionItems).forEach(item => {
          const td = document.createElement('td');
          td.style.width = colWidth;
          td.style.border = '1px solid #cbd5e1';
          td.style.padding = '6px 10px';
          td.style.verticalAlign = 'middle';
          td.style.background = '#fafafa';
          td.innerHTML = item.innerHTML;
          tr.appendChild(td);
        });
        table.appendChild(tr);
        container.parentNode.replaceChild(table, container);
      }
    });

    const bodyContent = clone.innerHTML;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${exam?.title || 'وثيقة الاختبار'}</title>
        <style>
          @page Section1 {
            size: A4 portrait;
            margin: ${pageMargins === '6mm' ? '0.8cm' : pageMargins === '14mm' ? '1.8cm' : '1.2cm'};
            mso-header-margin: 36pt;
            mso-footer-margin: 36pt;
            mso-paper-source: 0;
          }
          div.Section1 {
            page: Section1;
          }
          body {
            font-family: ${fontFamily}, 'Traditional Arabic', 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
            text-align: right;
            color: ${fontColor};
            font-size: ${fontSize};
            line-height: ${lineSpacing};
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            text-align: right;
            font-size: 11pt;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
          }
          .header-table {
            border: none;
            margin-bottom: 20px;
          }
          .header-table td {
            border: none;
            padding: 4px;
            vertical-align: middle;
          }
          .exam-question-box {
            border: 1px solid #94a3b8;
            padding: 12px;
            margin-bottom: 16px;
            border-radius: 6px;
            background-color: #ffffff;
          }
          .opt-table td {
            border: 1px solid #e2e8f0;
            padding: 6px 10px;
            background: #fafafa;
          }
          .grade-grid {
            border: 2px solid #0f172a;
            margin-top: 20px;
          }
          .grade-grid th, .grade-grid td {
            border: 1px solid #0f172a;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${bodyContent}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanExamTitle = (exam?.title || (exam?.subject ? `اختبار_${exam.subject}_${exam.targetClass || ''}` : 'اختبار')).replace(/[/\\?%*:|"<>]/g, '_').trim();
    const filename = mode === 'exam' 
      ? `${cleanExamTitle}.doc`
      : `كشف_نتائج_${cleanExamTitle}.doc`;

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to export CSV/Excel for results
  const exportToExcel = () => {
    if (results.length === 0) return;

    let csvContent = 'م,اسم الطالب,الصف/الفصل,الدرجة المحصلة,الدرجة الكلية,النسبة المئوية,التقدير,تاريخ التسليم\n';

    results.forEach((r, idx) => {
      const isAbsent = r.isAbsent === true || r.score === 'غ' || r.score === 'غائب';
      const studentName = (studentsCache[r.studentId] || r.studentName || 'طالب').replace(/,/g, ' ');
      const sClass = (r.studentClass || exam?.targetClass || '').replace(/,/g, ' ');
      const score = isAbsent ? 0 : (Number(r.score) || 0);
      const studentMax = Math.max(
        parseFloat(r.maxScore) || 0,
        parseFloat(exam?.maxScore) || 0,
        (parseFloat(r.totalQuestions) > 1 ? parseFloat(r.totalQuestions) : 0),
        totalScorePossible,
        score
      );
      let pct = 0;
      if (!isAbsent && studentMax > 0) {
        if (r.percentage !== undefined && !isNaN(r.percentage) && Number(r.percentage) <= 100 && Number(r.percentage) >= 0) {
          pct = Math.round(Number(r.percentage));
        } else {
          pct = Math.min(100, Math.max(0, Math.round((score / studentMax) * 100)));
        }
      }
      const grade = isAbsent ? 'غائب' : pct >= 90 ? 'ممتاز' : pct >= 80 ? 'جيد جداً' : pct >= 70 ? 'جيد' : pct >= 50 ? 'مقبول' : 'غير مجتاز';
      const scoreDisplay = isAbsent ? 'غائب' : score;
      const dateStr = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString('ar-SA') : '';

      csvContent += `${idx + 1},${studentName},${sClass},${scoreDisplay},${studentMax},${isAbsent ? '—' : `${pct}%`},${grade},${dateStr}\n`;
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `نتائج_${exam?.title || 'اختبار'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalJSX = (
    <div className="exam-modal-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      {/* Printable CSS Injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800&family=Noto+Kufi+Arabic:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap');

        /* Options Single-Row Guarantee */
        .print-options-single-row {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          width: 100% !important;
          gap: 8px !important;
          align-items: stretch !important;
        }
        .print-options-single-row > div {
          flex: 1 1 0% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .custom-options-bar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-options-bar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: ${fontSize} !important;
            font-family: ${fontFamily} !important;
            color: ${fontColor} !important;
            line-height: ${lineSpacing} !important;
          }
          /* Completely hide EVERYTHING under body except the modal container so NO blank pages exist! */
          body > *:not(.exam-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .exam-modal-root,
          .exam-modal-dialog,
          .exam-modal-scroll-area {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            min-height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            backdrop-filter: none !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          #exam-printable-document,
          #exam-printable-document * {
            visibility: visible !important;
            font-family: ${fontFamily} !important;
            color: ${fontColor} !important;
          }
          #exam-printable-document {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            display: block !important;
            font-size: ${fontSize} !important;
            line-height: ${lineSpacing} !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .katex {
            font-size: 1.05em !important;
          }
          .katex .text {
            font-family: ${fontFamily} !important;
            color: ${fontColor} !important;
          }
          @page {
            size: A4 portrait;
            margin: ${pageMargins};
          }
        }
      `}</style>
      <div className="exam-modal-dialog" style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '92vh',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        
        {/* Modal Toolbar (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #0e7490, #0891b2)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>
                {mode === 'exam' ? `طباعة وتصدير أسئلة: ${exam?.title || 'الاختبار'}` : `طباعة وتصدير نتائج: ${exam?.title || 'الاختبار'}`}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                يدعم الحفظ بصيغة Microsoft Word (.doc) والطباعة الفورية الرسمية (PDF)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {mode === 'exam' && (
              <button
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className="btn"
                style={{
                  background: showAnswerKey ? '#10b981' : 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {showAnswerKey ? <Eye size={16} /> : <EyeOff size={16} />}
                {showAnswerKey ? 'إخفاء الإجابات الصحيحة' : 'إظهار نموذج الإجابة'}
              </button>
            )}

            {mode === 'results' && (
              <button
                onClick={exportToExcel}
                className="btn"
                style={{
                  background: '#15803d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
            )}

            {mode === 'exam' && (
              <>
                <button
                  onClick={() => setFormsExportPlatform('google')}
                  className="btn"
                  style={{
                    background: '#673ab7',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 'bold'
                  }}
                  title="تصدير إلى Google Forms"
                >
                  <span>🟣</span> Google Forms
                </button>

                <button
                  onClick={() => setFormsExportPlatform('microsoft')}
                  className="btn"
                  style={{
                    background: '#008272',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: 'bold'
                  }}
                  title="تصدير إلى Microsoft Forms"
                >
                  <span>🔷</span> MS Forms
                </button>
              </>
            )}

            <button
              onClick={exportToWord}
              className="btn"
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '8px 14px',
                fontSize: '13px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 'bold'
              }}
              title="تصدير وتنزيل ملف Microsoft Word جاهز للتعديل"
            >
              <Download size={16} /> تصدير Word (.doc)
            </button>

            <button
              onClick={handlePrint}
              className="btn"
              style={{
                background: '#f8fafc',
                color: '#0e7490',
                border: 'none',
                padding: '8px 16px',
                fontSize: '13px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 'bold'
              }}
            >
              <Printer size={16} /> طباعة / PDF
            </button>

            <button
              onClick={onClose}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: 'none',
                padding: '8px',
                borderRadius: '8px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Customization Bar - ALL OPTIONS IN THE SAME LINE (Hidden on Print) */}
        <div className="no-print custom-options-bar" style={{
          padding: '10px 18px',
          background: '#f8fafc',
          borderBottom: '1.5px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'thin'
        }}>
          {/* 1. Font Family Selector */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#0e7490', fontWeight: 'bold' }}>نوع الخط:</label>
            <select
              value={fontFamily}
              onChange={e => setFontFamily(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontWeight: '600',
                color: '#1e293b'
              }}
            >
              <option value="'Cairo', sans-serif">خط القاهرة (الافتراضي)</option>
              <option value="'Amiri', serif">خط النسخ الأصيل (Amiri)</option>
              <option value="'Traditional Arabic', serif">الخط العربي التقليدي</option>
              <option value="'Tajawal', sans-serif">خط تجوال (Tajawal)</option>
              <option value="'Almarai', sans-serif">خط المراعي (Almarai)</option>
              <option value="'Noto Naskh Arabic', serif">خط نسخ المقررات (Noto Naskh)</option>
              <option value="'Segoe UI', Tahoma, sans-serif">الخط المبسط (Segoe UI)</option>
              <option value="'Aref Ruqaa', serif">خط الرقعة الجمالي</option>
            </select>
          </div>

          {/* 2. Font Color Selector + Custom Color Picker */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#0e7490', fontWeight: 'bold' }}>لون الخط:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                value={fontColor}
                onChange={e => setFontColor(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 'bold',
                  color: fontColor
                }}
              >
                <option value="#000000">أسود طباعة ناصع (#000000)</option>
                <option value="#0f172a">كحلي رسمي (#0f172a)</option>
                <option value="#1e3a8a">أزرق ملكي (#1e3a8a)</option>
                <option value="#14532d">أخضر زيتي (#14532d)</option>
                <option value="#334155">رمادي فحمي (#334155)</option>
              </select>
              <input
                type="color"
                value={fontColor}
                onChange={e => setFontColor(e.target.value)}
                title="منتقي لون مخصص للكتابة"
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* 3. Font Size */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>الحجم:</label>
            <select
              value={fontSize}
              onChange={e => setFontSize(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff'
              }}
            >
              <option value="10.5pt">مضغوط (10.5pt)</option>
              <option value="11pt">قياسي (11pt)</option>
              <option value="12pt">متوسط (12pt)</option>
              <option value="13pt">كبير (13pt)</option>
            </select>
          </div>

          {/* 4. Options Layout in Same Row */}
          {mode === 'exam' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <label style={{ color: '#0e7490', fontWeight: 'bold' }}>تخطيط الخيارات:</label>
              <select
                value={optionsLayout}
                onChange={e => setOptionsLayout(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1.5px solid #0e7490',
                  background: '#ecfeff',
                  fontWeight: 'bold',
                  color: '#0e7490'
                }}
              >
                <option value="single-row">✓ كل الخيارات في نفس السطر (أفقي)</option>
                <option value="two-rows">سطران (2 خيار بكل سطر)</option>
                <option value="column">عمودي (خيار لكل سطر)</option>
              </select>
            </div>
          )}

          {/* 5. Paper Template */}
          {mode === 'exam' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <label style={{ color: '#0e7490', fontWeight: 'bold' }}>نموذج الورقة:</label>
              <select
                value={paperTemplate}
                onChange={e => setPaperTemplate(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1.5px solid #0e7490',
                  background: '#ecfeff',
                  fontWeight: 'bold',
                  color: '#0e7490'
                }}
              >
                <option value="standard">📄 ورقة أسئلة عادية</option>
                <option value="standard_plus_bubble">📝 أسئلة + ورقة تظليل (Bubble Sheet)</option>
                <option value="bubble_only">⭕ ورقة تظليل فقط (OMR Sheet)</option>
              </select>
            </div>
          )}

          {/* 6. Page Margins */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>الهوامش:</label>
            <select
              value={pageMargins}
              onChange={e => setPageMargins(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff'
              }}
            >
              <option value="10mm">قياسية (10mm)</option>
              <option value="6mm">ضيقة / توفير ورق (6mm)</option>
              <option value="14mm">واسعة (14mm)</option>
            </select>
          </div>

          {/* 7. Line Spacing */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>التباعد:</label>
            <select
              value={lineSpacing}
              onChange={e => setLineSpacing(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff'
              }}
            >
              <option value="1.4">مضغوط (1.4)</option>
              <option value="1.6">قياسي (1.6)</option>
              <option value="1.8">مريح (1.8)</option>
            </select>
          </div>

          {/* 8. Visibility Toggles */}
          {mode === 'exam' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#ffffff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0, fontWeight: '600', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={showStudentBox}
                  onChange={e => setShowStudentBox(e.target.checked)}
                />
                بيانات الطالب
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0, fontWeight: '600', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={showInstructions}
                  onChange={e => setShowInstructions(e.target.checked)}
                />
                التعليمات
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0, fontWeight: '600', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={e => setShowSignatures(e.target.checked)}
                />
                جدول الرصد
              </label>
            </div>
          )}

          {/* 9. Watermark */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>علامة مائية:</label>
            <input
              type="text"
              placeholder="اختياري (سري/رسمي)..."
              value={watermarkText}
              onChange={e => setWatermarkText(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', width: '130px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* 10. Exam Type Title */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>نوع الاختبار:</label>
            <input
              type="text"
              value={examTypeTitle}
              onChange={e => setExamTypeTitle(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', width: '130px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* 11. Semester */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>الفصل:</label>
            <input
              type="text"
              value={semesterTitle}
              onChange={e => setSemesterTitle(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', width: '120px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* 12. Academic Year */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>العام:</label>
            <input
              type="text"
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', width: '110px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          {/* 13. Principal Name */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>مدير المدرسة:</label>
            <input
              type="text"
              value={principalName}
              onChange={e => setPrincipalName(e.target.value)}
              placeholder="اسم المدير"
              style={{ padding: '4px 8px', fontSize: '12px', width: '120px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="exam-modal-scroll-area" style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'center'
        }}>
          
          <div id="exam-printable-document" style={{
            width: '100%',
            maxWidth: '820px',
            background: '#ffffff',
            padding: '36px 40px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            boxSizing: 'border-box',
            color: fontColor,
            fontFamily: fontFamily,
            fontSize: fontSize,
            position: 'relative',
            overflow: 'hidden'
          }}>

            {/* Optional Watermark */}
            {watermarkText && (
              <div style={{
                position: 'absolute',
                top: '45%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-35deg)',
                fontSize: '68px',
                fontWeight: '900',
                color: 'rgba(15, 23, 42, 0.05)',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 0,
                whiteSpace: 'nowrap'
              }}>
                {watermarkText}
              </div>
            )}

            {/* Official Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ textAlign: 'right', fontSize: '12px', lineHeight: '1.6', fontWeight: 'bold', color: '#1e293b' }}>
                <div>المملكة العربية السعودية</div>
                <div>وزارة التعليم</div>
                <div>الإدارة العامة للتعليم</div>
                <div style={{ color: '#0e7490' }}>{schoolName}</div>
              </div>

              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <img
                    src={`${import.meta.env.BASE_URL}minst.svg`}
                    alt="وزارة التعليم"
                    style={{ height: '70px', width: 'auto', maxWidth: '115px', objectFit: 'contain', display: 'block' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                    }}
                  />
                  <div style={{ width: '1.5px', height: '42px', background: '#cbd5e1' }}></div>
                  <img
                    src={logoUrl}
                    alt="شعار المدرسة"
                    style={{ height: '62px', width: 'auto', maxWidth: '95px', objectFit: 'contain', display: 'block' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginTop: '4px' }}>
                  {academicYear}
                </div>
              </div>

              <div style={{ textAlign: 'left', fontSize: '12px', lineHeight: '1.6', color: '#1e293b' }}>
                <div><strong>المادة:</strong> {exam?.subject || 'غير محدد'}</div>
                <div><strong>الصف:</strong> {exam?.targetClass || 'عام'}</div>
                <div><strong>الزمن:</strong> {exam?.duration || '45'} دقيقة</div>
                <div><strong>التاريخ:</strong> {exam?.examDate || new Date().toISOString().split('T')[0]}</div>
              </div>
            </div>

            {/* Title Banner */}
            <div style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, #0e7490, #0891b2)',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '17px',
              marginBottom: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {mode === 'exam' 
                ? `${examTypeTitle} - ${exam?.title || 'نموذج أسئلة الاختبار'} (${semesterTitle})`
                : `كشف نتائج ودرجات: ${exam?.title || 'الاختبار'} (${semesterTitle})`}
            </div>

            {/* ======================================================== */}
            {/* MODE 1: EXAM QUESTIONS PAPER */}
            {/* ======================================================== */}
            {mode === 'exam' && (
              <div>
                {/* Student Info & Marks Box */}
                {showStudentBox && paperTemplate !== 'bubble_only' && (
                  <div style={{
                    border: '1.5px solid #0f172a',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '24px',
                    background: '#f8fafc'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', fontSize: '13px', alignItems: 'center' }}>
                      <div>
                        <strong>اسم الطالب رباعي:</strong> ................................................................
                      </div>
                      <div>
                        <strong>رقم الجلوس / الهوية:</strong> ......................
                      </div>
                      <div>
                        <strong>الفصل:</strong> {exam?.targetClass || '........'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {showInstructions && paperTemplate !== 'bubble_only' && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    marginBottom: '24px',
                    lineHeight: '1.6'
                  }}>
                    <strong>📌 تعليمات هامة:</strong> استعن بالله تعالى أولاً • اقرأ الأسئلة بعناية قبل الإجابة • اختر إجابة واحدة صحيحة لكل فقرة بتظليل الحرف المناسب • الدرجة الكلية للاختبار: <strong>({exam?.questions?.length || 0}) درجة</strong>.
                  </div>
                )}

                {/* Questions List */}
                {paperTemplate !== 'bubble_only' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {exam?.questions && exam.questions.length > 0 ? (
                      exam.questions.map((q, qIdx) => {
                        const letters = ['أ', 'ب', 'ج', 'د'];
                        return (
                          <div key={q.id || qIdx} style={{
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '10px',
                            padding: '16px',
                            background: '#ffffff',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid',
                            fontFamily: fontFamily,
                            color: fontColor
                          }}>
                            {/* Question Header */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '1px dashed #cbd5e1',
                              paddingBottom: '8px',
                              marginBottom: '12px'
                            }}>
                              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0e7490' }}>
                                السؤال ({qIdx + 1}):
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                [درجة واحدة]
                              </div>
                            </div>

                            {/* Question Text */}
                            <div style={{ fontSize: fontSize, fontWeight: '600', marginBottom: '14px', color: fontColor, lineHeight: '1.7' }}>
                              <MarkdownViewer content={q.text} />
                            </div>

                            {/* Options Container (Displayed in the exact same line / single-row by default) */}
                            <div 
                              className={`exam-options-container ${optionsLayout === 'single-row' ? 'print-options-single-row' : ''}`}
                              style={{
                                display: optionsLayout === 'single-row' ? 'flex' : (optionsLayout === 'two-rows' ? 'grid' : 'flex'),
                                flexDirection: optionsLayout === 'single-row' ? 'row' : (optionsLayout === 'two-rows' ? undefined : 'column'),
                                gridTemplateColumns: optionsLayout === 'two-rows' ? 'repeat(2, minmax(0, 1fr))' : undefined,
                                flexWrap: optionsLayout === 'single-row' ? 'nowrap' : undefined,
                                gap: '8px',
                                width: '100%',
                                alignItems: 'stretch',
                                fontSize: fontSize
                              }}
                            >
                              {q.options && q.options.map((opt, optIdx) => {
                                const isCorrect = q.correctOption === optIdx;
                                return (
                                  <div key={optIdx} style={{
                                     flex: optionsLayout === 'single-row' ? '1 1 0%' : undefined,
                                     minWidth: 0,
                                     boxSizing: 'border-box',
                                     display: 'flex',
                                     alignItems: 'center',
                                     gap: '8px',
                                     padding: '7px 10px',
                                     borderRadius: '6px',
                                     border: (showAnswerKey && isCorrect) ? '2px solid #10b981' : '1px solid #cbd5e1',
                                     background: (showAnswerKey && isCorrect) ? '#ecfdf5' : '#f8fafc',
                                     color: fontColor
                                  }}>
                                    <span style={{
                                       width: '24px',
                                       height: '24px',
                                       minWidth: '24px',
                                       borderRadius: '50%',
                                       border: '1.5px solid #64748b',
                                       display: 'flex',
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       fontSize: '11px',
                                       fontWeight: 'bold',
                                       background: (showAnswerKey && isCorrect) ? '#10b981' : '#ffffff',
                                       color: (showAnswerKey && isCorrect) ? '#ffffff' : fontColor
                                    }}>
                                       {letters[optIdx] || optIdx + 1}
                                    </span>
                                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'break-word', wordBreak: 'break-word', color: fontColor }}>
                                      <MarkdownViewer content={opt} inline />
                                    </span>
                                    {showAnswerKey && isCorrect && (
                                       <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>✓ صح</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p style={{ textAlign: 'center', color: '#94a3b8' }}>لا توجد أسئلة مسجلة في هذا الاختبار.</p>
                    )}
                  </div>
                )}

                {/* Grading Verification & Signatures Table */}
                {showSignatures && paperTemplate !== 'bubble_only' && (
                  <div style={{ marginTop: '36px', pageBreakInside: 'avoid' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      textAlign: 'center',
                      fontSize: '12px',
                      border: '1.5px solid #0f172a'
                    }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ border: '1px solid #0f172a', padding: '8px' }}>الدرجة كتابة</th>
                          <th style={{ border: '1px solid #0f172a', padding: '8px' }}>الدرجة رقماً</th>
                          <th style={{ border: '1px solid #0f172a', padding: '8px' }}>المصحح</th>
                          <th style={{ border: '1px solid #0f172a', padding: '8px' }}>المراجع</th>
                          <th style={{ border: '1px solid #0f172a', padding: '8px' }}>المدقق</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ border: '1px solid #0f172a', padding: '14px' }}></td>
                          <td style={{ border: '1px solid #0f172a', padding: '14px', fontWeight: 'bold' }}>/ {exam?.questions?.length || 0}</td>
                          <td style={{ border: '1px solid #0f172a', padding: '14px' }}>{teacherName}</td>
                          <td style={{ border: '1px solid #0f172a', padding: '14px' }}>...........................</td>
                          <td style={{ border: '1px solid #0f172a', padding: '14px' }}>...........................</td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '24px',
                      paddingTop: '16px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: '#334155'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div>معلم المادة</div>
                        <div style={{ marginTop: '30px' }}>{teacherName}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div>ختم المدرسة</div>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          border: '2px dashed #94a3b8',
                          borderRadius: '50%',
                          margin: '10px auto 0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: '#94a3b8'
                        }}>
                          ختم الإدارة
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div>مدير المدرسة</div>
                        <div style={{ marginTop: '14px', fontWeight: 'bold', color: '#0f172a' }}>{principalName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>الختم والتوقيع: .....................</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* BUBBLE SHEET / OMR SECTION */}
                {/* ======================================================== */}
                {(paperTemplate === 'standard_plus_bubble' || paperTemplate === 'bubble_only') && (
                  <div style={{
                    pageBreakBefore: paperTemplate === 'standard_plus_bubble' ? 'always' : 'auto',
                    breakBefore: paperTemplate === 'standard_plus_bubble' ? 'page' : 'auto',
                    marginTop: paperTemplate === 'standard_plus_bubble' ? '36px' : '0',
                    fontFamily: fontFamily,
                    color: fontColor
                  }}>
                    {/* Bubble Sheet Header Banner */}
                    <div style={{
                      border: '2px solid #0f172a',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      background: '#f8fafc',
                      textAlign: 'center'
                    }}>
                      <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'bold', color: fontColor }}>
                        ورقة الإجابة والتظليل الرسمية المعتمدة (Bubble Sheet / OMR)
                      </h3>
                      <div style={{ fontSize: '11px', color: '#475569', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <span><strong>المادة:</strong> {exam?.subject || 'عام'}</span>
                        <span><strong>الصف:</strong> {exam?.targetClass || 'عام'}</span>
                        <span><strong>عدد الفقرات:</strong> {exam?.questions?.length || 0} فقرة</span>
                        <span><strong>الزمن:</strong> {exam?.duration || 45} دقيقة</span>
                      </div>
                    </div>

                    {/* Student Info Box on Bubble Sheet */}
                    {showStudentBox && (
                      <div style={{
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '16px',
                        background: '#ffffff'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                          <div><strong>اسم الطالب رباعي:</strong> ................................................................</div>
                          <div><strong>رقم الجلوس / الهوية:</strong> ......................</div>
                          <div><strong>الفصل:</strong> {exam?.targetClass || '........'}</div>
                        </div>
                      </div>
                    )}

                    {/* Shading Guide */}
                    {showInstructions && (
                      <div style={{
                        border: '1px dashed #cbd5e1',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        marginBottom: '16px',
                        background: '#f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <div>
                          <strong>📌 تعليمات التظليل:</strong> استخدم قلم رصاص أو جاف • ظلل الدائرة بالكامل • لا تضع علامة صح أو خطأ
                        </div>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0f172a', display: 'inline-block' }}></span>
                            <span style={{ color: '#166534', fontWeight: 'bold' }}>تظليل صحيح</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                            <span style={{ color: '#dc2626', fontWeight: 'bold' }}>خطأ</span>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1.5px solid #0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✕</span>
                            <span style={{ color: '#dc2626', fontWeight: 'bold' }}>خطأ</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bubbles Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: (exam?.questions?.length || 0) <= 12 ? '1fr' : (exam?.questions?.length || 0) <= 24 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                      gap: '14px',
                      marginBottom: '20px'
                    }}>
                      {(() => {
                        const qCount = exam?.questions?.length || 10;
                        const questionsArray = exam?.questions && exam.questions.length > 0
                          ? exam.questions
                          : Array.from({ length: qCount }, (_, i) => ({ id: i, correctOption: 0 }));
                        const numCols = qCount <= 12 ? 1 : qCount <= 24 ? 2 : 3;
                        const chunkSize = Math.ceil(qCount / numCols);
                        const columns = [];
                        for (let c = 0; c < numCols; c++) {
                          columns.push(questionsArray.slice(c * chunkSize, (c + 1) * chunkSize));
                        }
                        return columns.map((colQuestions, colIdx) => (
                          <div key={colIdx} style={{
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '10px',
                            background: '#ffffff'
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '4px 8px',
                              background: '#f1f5f9',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              color: '#475569',
                              marginBottom: '8px'
                            }}>
                              <span>رقم الفقرة</span>
                              <div style={{ display: 'flex', gap: '16px', marginLeft: '6px' }}>
                                <span>أ</span>
                                <span>ب</span>
                                <span>ج</span>
                                <span>د</span>
                              </div>
                            </div>
                            {colQuestions.map((q, qSubIdx) => {
                              const actualIndex = colIdx * chunkSize + qSubIdx;
                              return (
                                <div key={q.id || actualIndex} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: actualIndex % 2 === 0 ? '#f8fafc' : '#ffffff',
                                  border: '1px solid #f1f5f9',
                                  marginBottom: '4px'
                                }}>
                                  <div style={{ fontWeight: 'bold', fontSize: '12px', minWidth: '40px', color: '#0e7490' }}>
                                    ({actualIndex + 1})
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                                      const isCorrect = showAnswerKey && (q.correctOption === optIdx);
                                      return (
                                        <span
                                          key={optIdx}
                                          style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            border: isCorrect ? '2px solid #10b981' : '1.5px solid #334155',
                                            background: isCorrect ? '#10b981' : '#ffffff',
                                            color: isCorrect ? '#ffffff' : '#334155',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                          }}
                                        >
                                          {isCorrect ? '✓' : letter}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Bubble Sheet Footer Verification */}
                    {showSignatures && (
                      <div style={{
                        marginTop: '20px',
                        border: '1.5px solid #0f172a',
                        borderRadius: '8px',
                        padding: '12px',
                        background: '#f8fafc',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        textAlign: 'center',
                        fontSize: '12px'
                      }}>
                        <div>
                          <strong>الدرجة النهائية:</strong>
                          <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 'bold', color: '#0e7490' }}>
                            ........... / {exam?.questions?.length || 0}
                          </div>
                        </div>
                        <div>
                          <strong>المصحح / الراصد:</strong>
                          <div style={{ marginTop: '8px' }}>{teacherName}</div>
                        </div>
                        <div>
                          <strong>المراجع / رئيس الكنترول:</strong>
                          <div style={{ marginTop: '8px' }}>...........................</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* MODE 2: EXAM RESULTS & GRADES SHEET */}
            {/* ======================================================== */}
            {mode === 'results' && (
              <div>
                {/* Stats Summary Bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '10px',
                  marginBottom: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>إجمالي المختبرين</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0e7490' }}>{totalStudents}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '11px', color: '#166534' }}>نسبة النجاح</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#166534' }}>{passRate}%</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>متوسط الدرجات</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#334155' }}><span dir="ltr">{avgScore} / {totalScorePossible}</span></div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>أعلى درجة</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803d' }}>{highestScore}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>أقل درجة</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c' }}>{lowestScore}</div>
                  </div>
                </div>

                {/* Results Table */}
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  textAlign: 'right',
                  border: '1px solid #cbd5e1'
                }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                      <th style={{ padding: '10px', textAlign: 'center', width: '40px', border: '1px solid #cbd5e1' }}>م</th>
                      <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>اسم الطالب</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>الصف/الفصل</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>الدرجة</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>النسبة</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>التقدير</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                          لا توجد نتائج مسجلة لهذا الاختبار حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      results.map((r, idx) => {
                        const isAbsent = r.isAbsent === true || r.score === 'غ' || r.score === 'غائب';
                        const studentName = studentsCache[r.studentId] || r.studentName || 'طالب';
                        const score = isAbsent ? 0 : (Number(r.score) || 0);
                        const studentMax = Math.max(
                          parseFloat(r.maxScore) || 0,
                          parseFloat(exam?.maxScore) || 0,
                          (parseFloat(r.totalQuestions) > 1 ? parseFloat(r.totalQuestions) : 0),
                          totalScorePossible,
                          score
                        );
                        let pct = 0;
                        if (!isAbsent && studentMax > 0) {
                          if (r.percentage !== undefined && !isNaN(r.percentage) && Number(r.percentage) <= 100 && Number(r.percentage) >= 0) {
                            pct = Math.round(Number(r.percentage));
                          } else {
                            pct = Math.min(100, Math.max(0, Math.round((score / studentMax) * 100)));
                          }
                        }
                        const isPass = !isAbsent && pct >= 50;
                        const grade = isAbsent ? 'غائب' : pct >= 90 ? 'ممتاز' : pct >= 80 ? 'جيد جداً' : pct >= 70 ? 'جيد' : pct >= 50 ? 'مقبول' : 'غير مجتاز';

                        return (
                          <tr key={r.id || idx} style={{
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{idx + 1}</td>
                            <td style={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{studentName}</td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>{r.studentClass || exam?.targetClass || '-'}</td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0e7490' }}>
                              {isAbsent ? (
                                <span style={{ color: '#dc2626' }}>غائب</span>
                              ) : (
                                <span dir="ltr">{score} / {studentMax}</span>
                              )}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold', color: isAbsent ? '#94a3b8' : (isPass ? '#16a34a' : '#dc2626') }}>
                              {isAbsent ? '—' : `${pct}%`}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                              {grade}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                background: isAbsent ? '#f1f5f9' : isPass ? '#dcfce7' : '#fee2e2',
                                color: isAbsent ? '#64748b' : isPass ? '#166534' : '#991b1b'
                              }}>
                                {isAbsent ? 'غائب' : isPass ? 'ناجح' : 'راسب'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Approvals and Signatures Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '36px',
                  paddingTop: '20px',
                  borderTop: '1.5px solid #0f172a',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  pageBreakInside: 'avoid'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div>معلم المادة</div>
                    <div style={{ marginTop: '14px', fontWeight: 'bold', color: '#0f172a' }}>{teacherName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>التوقيع: .....................</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div>مدير المدرسة</div>
                    <div style={{ marginTop: '14px', fontWeight: 'bold', color: '#0f172a' }}>{principalName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>الختم والتوقيع: .....................</div>
                  </div>
                </div>
              </div>
            )}

            {/* Document Verification Notice */}
            <div style={{
              textAlign: 'center',
              marginTop: '30px',
              paddingTop: '12px',
              borderTop: '1px dashed #cbd5e1',
              fontSize: '11px',
              color: '#94a3b8'
            }}>
              تم إنشاء هذا المستند رسمياً عبر منظومة الإدارة والتعلم الذكي • تاريخ التوليد: {new Date().toLocaleDateString('ar-SA')}
            </div>

          </div>
        </div>
      </div>

      {formsExportPlatform && (
        <FormsExportModal
          isOpen={!!formsExportPlatform}
          exam={exam}
          initialPlatform={formsExportPlatform}
          onClose={() => setFormsExportPlatform(null)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
