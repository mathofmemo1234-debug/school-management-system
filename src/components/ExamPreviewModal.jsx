import React, { useState } from 'react';
import { 
  Eye, EyeOff, Printer, Download, X, CheckCircle2, 
  FileText, Clock, BookOpen, User, Calendar, Award, ExternalLink
} from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';

export default function ExamPreviewModal({ 
  isOpen, 
  exam, 
  onClose,
  onOpenPrint
}) {
  const [showAnswerKey, setShowAnswerKey] = useState(true);
  const [simulatedAnswers, setSimulatedAnswers] = useState({});

  if (!isOpen || !exam) return null;

  const questions = exam.questions || [];
  const totalQuestions = questions.length;
  const letters = ['( أ )', '( ب )', '( ج )', '( د )'];

  const handleSelectOption = (qIdx, optIdx) => {
    setSimulatedAnswers(prev => ({
      ...prev,
      [qIdx]: optIdx
    }));
  };

  // Export as 100% Self-Contained Standalone HTML File with Embedded Images (Offline, No External Links)
  const handleSaveStandaloneHtml = () => {
    const questionsHtml = questions.map((q, idx) => {
      const optsHtml = (q.options || []).map((opt, optIdx) => {
        const isCorrect = q.correctOption === optIdx;
        return `
          <div class="opt-box ${isCorrect ? 'correct' : ''}">
            <span class="opt-badge">${letters[optIdx] || `(${optIdx + 1})`}</span>
            <div class="opt-text">${opt}</div>
            ${isCorrect ? '<span class="correct-tag">✓ الإجابة الصحيحة</span>' : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="question-card">
          <div class="question-header">
            <span class="q-badge">السؤال (${idx + 1})</span>
            <span class="q-score">[درجة واحدة]</span>
          </div>
          <div class="question-body">
            ${q.text}
          </div>
          <div class="options-grid">
            ${optsHtml}
          </div>
        </div>
      `;
    }).join('');

    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${exam.title || 'اختبار'} - ${exam.subject || ''}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", Tahoma, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      direction: rtl;
      margin: 0;
      padding: 30px 20px;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
      padding: 32px;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
      color: #0f172a;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      font-size: 14px;
      color: #334155;
    }
    .meta-item {
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 8px;
    }
    .question-card {
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 22px;
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 8px;
    }
    .q-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 4px 14px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 14px;
    }
    .q-score {
      font-size: 12px;
      color: #64748b;
    }
    .question-body {
      font-size: 16px;
      line-height: 1.7;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .question-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 10px 0;
      display: block;
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 640px) {
      .options-grid { grid-template-columns: 1fr; }
    }
    .opt-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
    }
    .opt-box.correct {
      border: 2px solid #10b981;
      background: #ecfdf5;
    }
    .opt-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 13px;
    }
    .opt-text {
      flex: 1;
      font-size: 14px;
    }
    .opt-text img {
      max-width: 100%;
      max-height: 120px;
      border-radius: 6px;
    }
    .correct-tag {
      color: #10b981;
      font-size: 12px;
      font-weight: bold;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${exam.title || 'اختبار تقويمي'}</h1>
      <div class="meta-grid">
        <div class="meta-item"><strong>المادة:</strong> ${exam.subject || '-'}</div>
        <div class="meta-item"><strong>الفصل المستهدف:</strong> ${exam.targetClass || '-'}</div>
        <div class="meta-item"><strong>المعلم:</strong> ${exam.teacherName || '-'}</div>
        <div class="meta-item"><strong>المدة:</strong> ${exam.duration || 45} دقيقة</div>
        <div class="meta-item"><strong>التاريخ:</strong> ${exam.examDate || '-'}</div>
        <div class="meta-item"><strong>الأسئلة:</strong> ${totalQuestions} سؤال</div>
      </div>
    </div>
    <div class="questions-list">
      ${questionsHtml}
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `اختبار_${exam.subject || 'مادة'}_${exam.targetClass || ''}_مستقل_بالصور.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel"
        style={{
          background: '#ffffff',
          width: '900px',
          maxWidth: '100%',
          height: '92vh',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          direction: 'rtl',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ 
                background: '#0284c7', 
                color: '#ffffff', 
                padding: '3px 10px', 
                borderRadius: '6px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Eye size={14} /> معاينة الاختبار الرسمية
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                متاحة للمعلم واضع الاختبار، المدير، المشرف، والوكيل
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
              {exam.title || 'اختبار إلكتروني'}
            </h2>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAnswerKey(prev => !prev)}
              className="btn"
              style={{
                background: showAnswerKey ? '#065f46' : 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px'
              }}
              title="إظهار أو إخفاء الإجابات الصحيحة في المعاينة"
            >
              {showAnswerKey ? <Eye size={15} /> : <EyeOff size={15} />}
              {showAnswerKey ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
            </button>

            {onOpenPrint && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPrint(exam);
                }}
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px'
                }}
              >
                <Printer size={15} /> طباعة / PDF
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveStandaloneHtml}
              className="btn"
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
              }}
              title="حفظ وتصدير ملف الاختبار كاملاً بالصور مدمجة بداخله دون أي روابط خارجية"
            >
              <Download size={15} /> حفظ بالصور (مستقل)
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'all 0.2s'
              }}
              title="إغلاق المعاينة"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          gap: '20px',
          fontSize: '13px',
          color: '#475569',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="#0284c7" />
            <span>المادة: <strong>{exam.subject || '-'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="#4f46e5" />
            <span>الفصل: <strong>{exam.targetClass || '-'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={16} color="#059669" />
            <span>المعلم: <strong>{exam.teacherName || '-'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} color="#d97706" />
            <span>المدة: <strong>{exam.duration || 45} دقيقة</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#dc2626" />
            <span>التاريخ: <strong>{exam.examDate || '-'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
            <FileText size={16} color="#7c3aed" />
            <span>إجمالي الأسئلة: <strong>{totalQuestions} سؤال</strong></span>
          </div>
        </div>

        {/* Questions Scrollable Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          background: '#f8fafc'
        }}>
          {questions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <FileText size={48} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <h3>لا توجد أسئلة مسجلة في هذا الاختبار بعد</h3>
              <p>قم بإضافة أسئلة من النموذج لتتمكن من معاينتها هنا.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {questions.map((q, qIndex) => {
                const selectedOpt = simulatedAnswers[qIndex];
                return (
                  <div 
                    key={q.id || qIndex} 
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Question Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '14px',
                      borderBottom: '1px dashed #e2e8f0',
                      paddingBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: '#0f172a',
                          color: '#ffffff',
                          fontWeight: '800',
                          fontSize: '14px',
                          padding: '4px 12px',
                          borderRadius: '8px'
                        }}>
                          السؤال {qIndex + 1}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          (اختر إجابة واحدة صحيحة)
                        </span>
                      </div>
                      <span style={{
                        fontSize: '12px',
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontWeight: 'bold'
                      }}>
                        [درجة واحدة]
                      </span>
                    </div>

                    {/* Question Text with MarkdownViewer (Supports Equations, LaTeX, and Base64 Images) */}
                    <div style={{ 
                      fontSize: '16px', 
                      color: '#1e293b', 
                      marginBottom: '18px',
                      lineHeight: '1.7'
                    }}>
                      <MarkdownViewer content={q.text || 'نص السؤال...'} />
                    </div>

                    {/* Options Grid (2 Columns) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '12px'
                    }}>
                      {[0, 1, 2, 3].map(optIndex => {
                        const defaultLetter = letters[optIndex];
                        const optVal = q.options && q.options[optIndex] !== undefined && q.options[optIndex] !== ''
                          ? q.options[optIndex]
                          : defaultLetter;
                        const isCorrect = q.correctOption === optIndex;
                        const isSelected = selectedOpt === optIndex;

                        return (
                          <div
                            key={optIndex}
                            onClick={() => handleSelectOption(qIndex, optIndex)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 14px',
                              borderRadius: '10px',
                              border: (showAnswerKey && isCorrect)
                                ? '2px solid #10b981'
                                : isSelected
                                ? '2px solid #0284c7'
                                : '1px solid #cbd5e1',
                              background: (showAnswerKey && isCorrect)
                                ? '#ecfdf5'
                                : isSelected
                                ? '#f0f9ff'
                                : '#ffffff',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Dark Letter Badge: ( أ ) ( ب ) ( ج ) ( د ) */}
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#0f172a',
                              color: '#ffffff',
                              fontWeight: '800',
                              fontSize: '14px',
                              padding: '4px 12px',
                              borderRadius: '6px',
                              flexShrink: 0
                            }}>
                              {defaultLetter}
                            </span>

                            {/* Option Content with MarkdownViewer */}
                            <div style={{ flex: 1, fontSize: '14px', color: '#1e293b' }}>
                              <MarkdownViewer content={optVal} />
                            </div>

                            {/* Correct Indicator Badge */}
                            {showAnswerKey && isCorrect && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#10b981',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                flexShrink: 0
                              }}>
                                <CheckCircle2 size={13} /> الإجابة الصحيحة
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            💡 انقر على أي خيار لتجربة الإجابة تفاعلياً كما يراها الطالب.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '8px 24px', fontSize: '14px' }}
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    </div>
  );
}
