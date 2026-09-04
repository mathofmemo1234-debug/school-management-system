import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X, FileText, CheckCircle, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  const [examTypeTitle, setExamTypeTitle] = useState('اختبار تقويمي / نهائي');
  const [semesterTitle, setSemesterTitle] = useState('الفصل الدراسي الثاني');
  const [academicYear, setAcademicYear] = useState('1447 - 1448 هـ');

  const schoolName = userData?.schoolName || 'المجمع التعليمي';
  const logoUrl = userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`;
  const teacherName = userData?.name || exam?.teacherName || 'معلم المادة';

  // Statistics calculation for results
  const totalStudents = results.length;
  const totalScorePossible = exam?.questions?.length || (results[0]?.totalQuestions || 1);
  const scoresArray = results.map(r => Number(r.score) || 0);
  const highestScore = totalStudents > 0 ? Math.max(...scoresArray) : 0;
  const lowestScore = totalStudents > 0 ? Math.min(...scoresArray) : 0;
  const avgScore = totalStudents > 0 ? (scoresArray.reduce((a, b) => a + b, 0) / totalStudents).toFixed(1) : 0;
  const passCount = results.filter(r => (r.score / (r.totalQuestions || totalScorePossible)) >= 0.5).length;
  const passRate = totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  // Helper to generate Word Document (.doc) Blob
  const exportToWord = () => {
    const printContent = document.getElementById('exam-printable-document');
    if (!printContent) return;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${exam?.title || 'وثيقة الاختبار'}</title>
        <style>
          @page Section1 {
            size: A4 portrait;
            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
            mso-header-margin: 36pt;
            mso-footer-margin: 36pt;
            mso-paper-source: 0;
          }
          div.Section1 {
            page: Section1;
          }
          body {
            font-family: 'Traditional Arabic', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            text-align: right;
            color: #1e293b;
            line-height: 1.5;
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
          ${printContent.innerHTML}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = mode === 'exam' 
      ? `اختبار_${exam?.subject || 'مادة'}_${exam?.targetClass || ''}.doc`
      : `كشف_نتائج_اختبار_${exam?.title || 'مادة'}.doc`;

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
      const studentName = (studentsCache[r.studentId] || 'طالب').replace(/,/g, ' ');
      const sClass = (r.studentClass || exam?.targetClass || '').replace(/,/g, ' ');
      const score = r.score || 0;
      const total = r.totalQuestions || totalScorePossible;
      const pct = Math.round((score / total) * 100);
      const grade = pct >= 90 ? 'ممتاز' : pct >= 80 ? 'جيد جداً' : pct >= 70 ? 'جيد' : pct >= 50 ? 'مقبول' : 'غير مجتاز';
      const dateStr = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString('ar-SA') : '';

      csvContent += `${idx + 1},${studentName},${sClass},${score},${total},${pct}%,${grade},${dateStr}\n`;
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
            font-size: 11pt !important;
          }
          /* Completely hide EVERYTHING under body except the modal container so NO blank pages exist! */
          body > *:not(.exam-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .exam-modal-root,
          .exam-modal-dialog {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            backdrop-filter: none !important;
          }
          #exam-printable-document,
          #exam-printable-document * {
            visibility: visible !important;
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
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 12mm 12mm;
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

        {/* Customization Bar (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '12px 24px',
          background: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>نوع الاختبار:</label>
            <input
              type="text"
              value={examTypeTitle}
              onChange={e => setExamTypeTitle(e.target.value)}
              style={{ padding: '4px 10px', fontSize: '12px', width: '160px', borderRadius: '6px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>الفصل:</label>
            <input
              type="text"
              value={semesterTitle}
              onChange={e => setSemesterTitle(e.target.value)}
              style={{ padding: '4px 10px', fontSize: '12px', width: '150px', borderRadius: '6px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ color: '#475569', fontWeight: 'bold' }}>العام:</label>
            <input
              type="text"
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              style={{ padding: '4px 10px', fontSize: '12px', width: '130px', borderRadius: '6px' }}
            />
          </div>
        </div>

        {/* Scrollable Printable Document Container */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'center'
        }}>
          
          <div id="exam-printable-document" style={{
            width: '100%',
            maxWidth: '800px',
            background: '#ffffff',
            padding: '36px 40px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            boxSizing: 'border-box',
            color: '#0f172a',
            fontFamily: 'Cairo, sans-serif'
          }}>

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

                {/* Instructions */}
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

                {/* Questions List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {exam?.questions && exam.questions.length > 0 ? (
                    exam.questions.map((q, qIdx) => {
                      const letters = ['أ', 'ب', 'ج', 'د'];
                      return (
                        <div key={q.id || qIdx} style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '16px',
                          background: '#ffffff',
                          pageBreakInside: 'avoid'
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
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '14px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                            {q.text}
                          </div>

                          {/* Options Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            fontSize: '13px'
                          }}>
                            {q.options && q.options.map((opt, optIdx) => {
                              const isCorrect = q.correctOption === optIdx;
                              return (
                                <div key={optIdx} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: (showAnswerKey && isCorrect) ? '2px solid #10b981' : '1px solid #e2e8f0',
                                  background: (showAnswerKey && isCorrect) ? '#ecfdf5' : '#f8fafc'
                                }}>
                                  <span style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    border: '1.5px solid #64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    background: (showAnswerKey && isCorrect) ? '#10b981' : '#ffffff',
                                    color: (showAnswerKey && isCorrect) ? '#ffffff' : '#1e293b'
                                  }}>
                                    {letters[optIdx] || optIdx + 1}
                                  </span>
                                  <span style={{ flex: 1 }}>{opt}</span>
                                  {showAnswerKey && isCorrect && (
                                    <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>✓ الإجابة الصحيحة</span>
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

                {/* Grading Verification & Signatures Table */}
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
                      <div style={{ marginTop: '30px' }}>..........................................</div>
                    </div>
                  </div>
                </div>
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
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#334155' }}>{avgScore} / {totalScorePossible}</div>
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
                        const studentName = studentsCache[r.studentId] || 'طالب';
                        const score = Number(r.score) || 0;
                        const total = Number(r.totalQuestions) || totalScorePossible;
                        const pct = Math.round((score / total) * 100);
                        const isPass = pct >= 50;
                        const grade = pct >= 90 ? 'ممتاز' : pct >= 80 ? 'جيد جداً' : pct >= 70 ? 'جيد' : pct >= 50 ? 'مقبول' : 'غير مجتاز';

                        return (
                          <tr key={r.id || idx} style={{
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{idx + 1}</td>
                            <td style={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{studentName}</td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>{r.studentClass || exam?.targetClass || '-'}</td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#0e7490' }}>
                              {score} / {total}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                              {pct}%
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
                                background: isPass ? '#dcfce7' : '#fee2e2',
                                color: isPass ? '#166534' : '#991b1b'
                              }}>
                                {isPass ? 'ناجح' : 'راسب'}
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
                    <div style={{ marginTop: '30px' }}>{teacherName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div>المشرف التربوي</div>
                    <div style={{ marginTop: '30px' }}>..........................................</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div>وكيل الشؤون التعليمية</div>
                    <div style={{ marginTop: '30px' }}>..........................................</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div>مدير المدرسة</div>
                    <div style={{ marginTop: '30px' }}>..........................................</div>
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
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
