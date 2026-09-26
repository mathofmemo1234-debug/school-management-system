import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, doc, setDoc, addDoc, updateDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { 
  Sparkles, Save, Printer, Download, Eye, Edit3, Trash2, Plus, 
  CheckCircle2, AlertCircle, Share2, Globe, Lock, BookOpen, Clock, 
  CheckSquare, Square, X, Award, HelpCircle, Layers, ArrowRight, RefreshCw, FileText,
  ArrowLeftRight, Image as ImageIcon, Upload, Check, ChevronDown, ChevronUp, Loader
} from 'lucide-react';
import { generateWorksheetAI, formatNumberBySymbol, BLOOM_LEVELS, isInternationalSchool } from '../utils/aiWorksheetGenerator';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import MarkdownViewer from './MarkdownViewer';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function LessonWorksheetModal({
  isOpen,
  onClose,
  prepData = {},
  existingWorksheet = null,
  onSaveSuccess = null,
  readOnly = false,
  userRole = 'teacher'
}) {
  const { userData } = useAuth();
  const { t } = useLanguage();

  // Basic Details
  const lessonTitle = prepData?.lessonTitle || existingWorksheet?.lessonTitle || 'درس تعليمي';
  const subject = prepData?.subject || existingWorksheet?.subject || 'المادة الدراسية';
  const className = prepData?.className || existingWorksheet?.className || '';
  const stage = prepData?.stage || existingWorksheet?.stage || '';
  const semester = prepData?.semester || existingWorksheet?.semester || '';
  const schoolId = prepData?.schoolId || userData?.schoolId || 'default_school_1';
  const prepId = prepData?.id || prepData?.prepDocId || existingWorksheet?.prepId || null;

  // Track & Curriculum Detection (National vs International)
  const initialIsIntl = isInternationalSchool({
    isInternational: prepData?.isInternational || existingWorksheet?.isInternational,
    curriculumTrack: prepData?.curriculumTrack || existingWorksheet?.curriculumTrack,
    curriculumType: prepData?.curriculumType || userData?.curriculumType,
    schoolName: prepData?.schoolName || userData?.schoolName,
    track: prepData?.track
  });
  const [curriculumTrack, setCurriculumTrack] = useState(
    existingWorksheet?.curriculumTrack || (initialIsIntl ? 'international' : 'national')
  );

  // AI Configuration State
  const [questionCount, setQuestionCount] = useState(existingWorksheet?.questions?.length || 5);
  const [cognitiveDistribution, setCognitiveDistribution] = useState(existingWorksheet?.cognitiveDistribution || 'balanced');
  const [symbolLanguage, setSymbolLanguage] = useState(existingWorksheet?.symbolLanguage || 'ar');
  const [selectedTypes, setSelectedTypes] = useState(
    existingWorksheet?.selectedTypes || ['mcq', 'true_false', 'fill_blank', 'matching', 'problem_solving']
  );

  // Active View Tab: 'student' (Student Worksheet) | 'teacher' (Model Answer Key) | 'studio' (AI Editor)
  const [activeTab, setActiveTab] = useState(userRole === 'student' ? 'student' : (existingWorksheet ? 'student' : 'studio'));

  // Question Editing & Image Uploading States
  const [uploadingImgQIndex, setUploadingImgQIndex] = useState(null);
  const [editingQIndex, setEditingQIndex] = useState(null);

  // Worksheet Content State
  const [questions, setQuestions] = useState(existingWorksheet?.questions || []);
  const [bonusQuestion, setBonusQuestion] = useState(existingWorksheet?.bonusQuestion || null);
  const [instructions, setInstructions] = useState(
    existingWorksheet?.instructions || [
      'اقرأ جميع الأسئلة بعناية قبل البدء في الإجابة.',
      'في أسئلة الاختيار من متعدد، ظلل الدائرة المقابلة للإجابة الصحيحة.',
      'في المسائل الرياضية والعلمية، اكتب خطوات الحل كاملة ووضح القوانين.',
      'تأكد من مراجعة ورقة إجابتك بدقة قبل التسليم للمعلم.'
    ]
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(existingWorksheet?.estimatedMinutes || '20 دقيقة');
  const [status, setStatus] = useState(existingWorksheet?.status || 'published'); // 'draft' | 'published'

  // Loading & Saving State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [worksheetDocId, setWorksheetDocId] = useState(existingWorksheet?.id || null);

  // Generate initial draft if new and empty
  useEffect(() => {
    if (isOpen && (!questions || questions.length === 0) && !existingWorksheet) {
      handleGenerateAI();
    }
  }, [isOpen]);

  // Sync state if existingWorksheet prop changes
  useEffect(() => {
    if (existingWorksheet) {
      setQuestions(existingWorksheet.questions || []);
      setBonusQuestion(existingWorksheet.bonusQuestion || null);
      setInstructions(existingWorksheet.instructions || []);
      setEstimatedMinutes(existingWorksheet.estimatedMinutes || '20 دقيقة');
      setStatus(existingWorksheet.status || 'published');
      setSymbolLanguage(existingWorksheet.symbolLanguage || 'ar');
      setCurriculumTrack(existingWorksheet.curriculumTrack || (existingWorksheet.isInternational ? 'international' : 'national'));
      setWorksheetDocId(existingWorksheet.id || null);
    }
  }, [existingWorksheet]);

  // Aggregate behavioral objectives from prepData
  const effectiveObjectives = useMemo(() => {
    const list = [];
    if (prepData?.selectedObjectives && Array.isArray(prepData.selectedObjectives)) {
      list.push(...prepData.selectedObjectives);
    }
    if (prepData?.customObjectives && Array.isArray(prepData.customObjectives)) {
      list.push(...prepData.customObjectives);
    }
    if (prepData?.goals) {
      const lines = prepData.goals
        .split('\n')
        .map(l => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(l => l.length > 5);
      list.push(...lines);
    }
    return Array.from(new Set(list));
  }, [prepData]);

  // Handle AI Generation
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const result = await generateWorksheetAI({
        lessonTitle,
        subject,
        stage,
        className,
        semester,
        objectives: effectiveObjectives,
        questionCount,
        cognitiveDistribution,
        symbolLanguage,
        questionTypes: selectedTypes,
        curriculumTrack,
        isInternational: curriculumTrack === 'international',
        schoolName: userData?.schoolName || prepData?.schoolName || ''
      });

      setQuestions(result.questions);
      setBonusQuestion(result.bonusQuestion);
      setInstructions(result.instructions);
      setEstimatedMinutes(result.estimatedMinutes);
    } catch (err) {
      console.error('Error generating worksheet AI:', err);
      alert('حدث خطأ أثناء توليد ورقة العمل بالذكاء الاصطناعي');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Image Upload and Compression for a specific question
  const handleImageUpload = async (qIndex, file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP, SVG)');
      return;
    }
    setUploadingImgQIndex(qIndex);
    try {
      const dataUrl = await compressImageToDataUrl(file, {
        maxWidth: 1100,
        maxHeight: 900,
        quality: 0.80
      });
      if (dataUrl) {
        updateQuestion(qIndex, 'image', dataUrl);
      } else {
        alert('تعذر ضغط أو قراءة ملف الصورة المحدد.');
      }
    } catch (err) {
      console.error('Error uploading image to question:', err);
      alert('حدث خطأ أثناء معالجة وإرفاق الصورة: ' + err.message);
    } finally {
      setUploadingImgQIndex(null);
    }
  };

  // Remove Image from Question
  const removeImage = (qIndex) => {
    updateQuestion(qIndex, 'image', null);
  };

  // Toggle question type
  const toggleType = (tId) => {
    setSelectedTypes(prev => {
      if (prev.includes(tId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(x => x !== tId);
      } else {
        return [...prev, tId];
      }
    });
  };

  // Edit question text
  const updateQuestion = (index, field, value) => {
    setQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Edit option
  const updateOption = (qIndex, optIndex, value) => {
    setQuestions(prev => {
      const copy = [...prev];
      const opts = [...(copy[qIndex].options || [])];
      opts[optIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  // Edit matching column item (for Matching questions)
  const updateMatchingItem = (qIndex, colKey, itemIndex, value) => {
    setQuestions(prev => {
      const copy = [...prev];
      const list = [...(copy[qIndex][colKey] || [])];
      list[itemIndex] = { ...list[itemIndex], text: value };
      copy[qIndex] = { ...copy[qIndex], [colKey]: list };
      return copy;
    });
  };

  // Remove question
  const removeQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Add new manual question (supports 'mcq' or 'matching')
  const addNewQuestion = (qType = 'mcq') => {
    const isAr = symbolLanguage === 'ar';
    if (qType === 'matching') {
      const newQ = {
        id: `q_${Date.now()}_custom`,
        number: questions.length + 1,
        type: 'matching',
        typeLabel: 'المزاوجة والربط (صل بين أ و ب)',
        bloomLevel: isAr ? 'تحليل ومزاوجة' : 'Analyzing',
        targetObjective: effectiveObjectives[0] || 'هدف تعليمي إضافي',
        question: isAr 
          ? 'زاوج بين المفاهيم في العمود (أ) وما يناسبها في العمود (ب) بوضع الرمز المناسب:' 
          : 'Match concepts in Column (A) with corresponding definitions in Column (B):',
        columnA: isAr ? [
          { id: '1', num: '١', text: 'المفهوم أو المصطلح الأول' },
          { id: '2', num: '٢', text: 'المفهوم أو المصطلح الثاني' },
          { id: '3', num: '٣', text: 'المفهوم أو المصطلح الثالث' },
          { id: '4', num: '٤', text: 'المفهوم أو المصطلح الرابع' }
        ] : [
          { id: '1', num: '1', text: 'First Concept or Term' },
          { id: '2', num: '2', text: 'Second Concept or Term' },
          { id: '3', num: '3', text: 'Third Concept or Term' },
          { id: '4', num: '4', text: 'Fourth Concept or Term' }
        ],
        columnB: isAr ? [
          { id: 'a', label: 'أ', text: 'التعريف المقابل للمصطلح الثاني' },
          { id: 'b', label: 'ب', text: 'التعريف المقابل للمصطلح الأول' },
          { id: 'c', label: 'جـ', text: 'التعريف المقابل للمصطلح الرابع' },
          { id: 'd', label: 'د', text: 'التعريف المقابل للمصطلح الثالث' }
        ] : [
          { id: 'a', label: 'A', text: 'Definition matching second term' },
          { id: 'b', label: 'B', text: 'Definition matching first term' },
          { id: 'c', label: 'C', text: 'Definition matching fourth term' },
          { id: 'd', label: 'D', text: 'Definition matching third term' }
        ],
        correctAnswer: isAr 
          ? 'دليل المزاوجة الصحيح:\n(١ ➔ ب)، (٢ ➔ أ)، (٣ ➔ د)، (٤ ➔ جـ)' 
          : 'Matching Key:\n(1 ➔ B), (2 ➔ A), (3 ➔ D), (4 ➔ C)',
        explanation: isAr ? 'الربط المنهجي الدقيق بين المفاهيم وتعريفاتها.' : 'Accurate pairing between concepts and their definitions.',
        points: 2
      };
      setQuestions(prev => [...prev, newQ]);
      return;
    }

    const newQ = {
      id: `q_${Date.now()}_custom`,
      number: questions.length + 1,
      type: 'mcq',
      typeLabel: 'اختيار من متعدد',
      bloomLevel: isAr ? 'تطبيق' : 'Applying',
      targetObjective: effectiveObjectives[0] || 'هدف تعليمي إضافي',
      question: isAr ? 'اكتب نص السؤال الجديد هنا...' : 'Write new question text here...',
      options: isAr ? ['أ) خيار أول', 'ب) خيار ثانٍ', 'جـ) خيار ثالث', 'د) خيار رابع'] : ['A) First option', 'B) Second option', 'C) Third option', 'D) Fourth option'],
      correctOption: 0,
      correctAnswer: isAr ? 'خيار أول' : 'First option',
      explanation: isAr ? 'توضيح وتعليل الإجابة...' : 'Answer explanation...',
      points: 2
    };
    setQuestions(prev => [...prev, newQ]);
  };

  // Calculate total marks
  const totalMarks = useMemo(() => {
    let sum = questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0);
    if (bonusQuestion) sum += Number(bonusQuestion.points) || 0;
    return sum;
  }, [questions, bonusQuestion]);

  // Handle Save (Draft or Published)
  const handleSave = async (desiredStatus = status) => {
    setIsSaving(true);
    try {
      const payload = {
        lessonTitle,
        subject,
        className,
        stage,
        semester,
        schoolId,
        prepId: prepId || '',
        teacherId: userData?.id || userData?.nationalId || 'teacher',
        teacherName: userData?.name || 'معلم المادة',
        symbolLanguage,
        curriculumTrack,
        isInternational: curriculumTrack === 'international',
        cognitiveDistribution,
        selectedTypes,
        estimatedMinutes,
        totalMarks,
        status: desiredStatus,
        objectives: effectiveObjectives,
        questions,
        bonusQuestion,
        instructions,
        updatedAt: new Date().toISOString()
      };

      let finalId = worksheetDocId;
      if (finalId) {
        await updateDoc(doc(db, 'worksheets', finalId), payload);
      } else {
        payload.createdAt = new Date().toISOString();
        if (desiredStatus === 'published') payload.publishedAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'worksheets'), payload);
        finalId = docRef.id;
        setWorksheetDocId(finalId);
      }

      setStatus(desiredStatus);

      // Link with preparation document if prepId exists
      if (prepId) {
        try {
          await updateDoc(doc(db, 'preparations', prepId), {
            hasWorksheet: true,
            worksheetId: finalId,
            worksheetStatus: desiredStatus,
            worksheetTitle: lessonTitle
          });
        } catch (prepErr) {
          console.warn('Notice updating prep with worksheetId:', prepErr);
        }
      }

      if (onSaveSuccess) {
        onSaveSuccess({ id: finalId, ...payload });
      }

      if (desiredStatus === 'published') {
        alert('✓ تم اعتماد ونشر ورقة العمل بنجاح!\nأصبحت الآن متاحة وفورية للطالب وولي الأمر والكادر التعليمي والإدارة.');
      } else {
        alert('✓ تم حفظ ورقة العمل كمسودة خاصة للمعلم بنجاح.');
      }
    } catch (err) {
      console.error('Error saving worksheet:', err);
      alert('حدث خطأ أثناء حفظ ورقة العمل: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Microsoft Word (.doc)
  const exportToWord = () => {
    const printableNode = document.getElementById('printable-worksheet-content');
    if (!printableNode) return alert('لم يتم العثور على محتوى ورقة العمل');

    const htmlBody = printableNode.innerHTML;
    const isAr = symbolLanguage === 'ar';
    const docTitle = `ورقة_عمل_${lessonTitle.replace(/[\s/\\?%*:|"<>]/g, '_')}`;

    const docContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${docTitle}</title>
  <style>
    body {
      font-family: 'Simplified Arabic', 'Traditional Arabic', 'Segoe UI', Arial, sans-serif;
      direction: ${isAr ? 'rtl' : 'ltr'};
      text-align: ${isAr ? 'right' : 'left'};
      padding: 20px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #333; padding: 6px 10px; font-size: 13px; }
    .header-box { border: 2px solid #0e7490; padding: 12px; margin-bottom: 20px; text-align: center; }
    .question-box { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
    .badge { font-weight: bold; color: #0e7490; }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;

    const blob = new Blob(['\ufeff' + docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print worksheet
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const canEdit = !readOnly && (userRole === 'teacher' || userRole === 'admin' || userRole === 'supervisor');

  const modalJSX = (
    <div className="worksheet-modal-root" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div className="glass-panel" style={{
        width: '1050px',
        maxWidth: '100%',
        maxHeight: '94vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Top Header & Actions Bar (No Print) */}
        <div className="no-print" style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                <Sparkles size={16} /> ورقة عمل ذكية (AI)
              </span>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>
                {lessonTitle} • {subject} {className && `(${className})`}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              مربوطة مباشرة بالأهداف السلوكية للدرس • معتمدة ومتوافقة مع المعايير الوزارية
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Status Indicator / Switch for Teacher */}
            {canEdit && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: status === 'published' ? '#ecfdf5' : '#fffbeb',
                border: `1.5px solid ${status === 'published' ? '#10b981' : '#f59e0b'}`,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: status === 'published' ? '#047857' : '#b45309'
              }}>
                {status === 'published' ? <Globe size={15} /> : <Lock size={15} />}
                <span>{status === 'published' ? 'منشورة ومعتمدة للجميع' : 'مسودة خاصة بالمعلم'}</span>
                
                <button
                  type="button"
                  onClick={() => setStatus(prev => prev === 'published' ? 'draft' : 'published')}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: status === 'published' ? '#10b981' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  title="تغيير حالة النشر"
                >
                  {status === 'published' ? 'تحويل لمسودة' : 'اعتماد ونشر الآن'}
                </button>
              </div>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> طباعة (A4)
            </button>

            {/* Word Export */}
            <button
              onClick={exportToWord}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              title="تصدير إلى ملف Microsoft Word قابل للتعديل"
            >
              <Download size={16} /> تصدير Word
            </button>

            {/* Save Buttons for Teacher */}
            {canEdit && (
              <button
                onClick={() => handleSave(status)}
                disabled={isSaving}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Save size={16} /> {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar (No Print) */}
        <div className="no-print" style={{
          padding: '12px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: activeTab === 'student' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                background: activeTab === 'student' ? '#0e7490' : 'white',
                color: activeTab === 'student' ? 'white' : '#475569'
              }}
            >
              <BookOpen size={16} /> 📄 ورقة عمل الطالب (جاهزة للحل والطباعة)
            </button>

            {userRole !== 'student' && (
              <button
                type="button"
                onClick={() => setActiveTab('teacher')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: activeTab === 'teacher' ? '2px solid #059669' : '1px solid #cbd5e1',
                  background: activeTab === 'teacher' ? '#059669' : 'white',
                  color: activeTab === 'teacher' ? 'white' : '#475569'
                }}
              >
                <Award size={16} /> 🔑 دليل الحل النموذجي ومستويات بلوم
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: activeTab === 'studio' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: activeTab === 'studio' ? '#7c3aed' : 'white',
                  color: activeTab === 'studio' ? 'white' : '#475569'
                }}
              >
                <Sparkles size={16} /> ⚙️ استوديو الذكاء الاصطناعي والتخصيص
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: '#64748b' }}>
            <span>عدد الأسئلة: <strong>{questions.length}</strong></span>
            <span>الدرجة الكلية: <strong>{totalMarks} درجات</strong></span>
            <span>الزمن المقترح: <strong>{estimatedMinutes}</strong></span>
            <span>الرموز: <strong>{symbolLanguage === 'ar' ? '🇸🇦 عربية (س، ص، ١، ٢)' : '🇬🇧 إنجليزية (x, y, 1, 2)'}</strong></span>
          </div>
        </div>

        {/* AI Studio Configuration Box (Shown when activeTab === 'studio') */}
        {activeTab === 'studio' && canEdit && (
          <div className="no-print" style={{
            padding: '20px 24px',
            background: '#faf5ff',
            borderBottom: '2px solid #e9d5ff',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} /> لوحة تحكم وتوليد الأسئلة بالذكاء الاصطناعي
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#7e22ce' }}>
                  يمكنك تحديد عدد الأسئلة ومستويات التفكير والرموز الرياضية ثم إعادة التوليد فوراً
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGenerating}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                }}
              >
                <RefreshCw size={16} className={isGenerating ? 'spin' : ''} />
                {isGenerating ? 'جاري التوليد الذكي...' : '✨ إعادة التوليد بالذكاء الاصطناعي'}
              </button>
            </div>

            {/* Configurations Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e9d5ff'
            }}>
              
              {/* Question Count */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
                  عدد الأسئلة المطلوبة
                </label>
                <select
                  className="input-field"
                  style={{ width: '100%', marginBottom: 0, fontWeight: 'bold' }}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                >
                  <option value={3}>3 أسئلة (تطبيق سريع / ورقة دقيقة واحدة)</option>
                  <option value={5}>5 أسئلة (ورقة عمل نموذجية متكاملة)</option>
                  <option value={8}>8 أسئلة (شاملة ومفصلة)</option>
                  <option value={10}>10 أسئلة (اختبار تشخيصي أو تدريب مكثف)</option>
                  <option value={15}>15 سؤالاً (مراجعة وحدة دراسية كاملة)</option>
                </select>
              </div>

              {/* Cognitive / Bloom's Level */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
                  مستوى الصعوبة ومستويات بلوم
                </label>
                <select
                  className="input-field"
                  style={{ width: '100%', marginBottom: 0, fontWeight: 'bold' }}
                  value={cognitiveDistribution}
                  onChange={(e) => setCognitiveDistribution(e.target.value)}
                >
                  <option value="balanced">متنوع ومتوازن تربوياً (بلوم كامل)</option>
                  <option value="remember">تركيز على التذكر والمصطلحات الأساسية</option>
                  <option value="understand">تركيز على الفهم والاستيعاب والتعليل</option>
                  <option value="apply">تركيز على التطبيق وحل المسائل</option>
                  <option value="analyze">مهارات تفكير عليا وتحليل وتفكير ناقد</option>
                </select>
              </div>

              {/* Curriculum Track (National vs International) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
                  مسار المنهج والاعتماد
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCurriculumTrack('national')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: curriculumTrack === 'national' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: curriculumTrack === 'national' ? '#f0fdfa' : 'white',
                      color: curriculumTrack === 'national' ? '#0e7490' : '#475569'
                    }}
                    title="المنهج الوطني: أسئلة وشروحات عربية مع إمكانية الرموز الإنجليزية (x, y)"
                  >
                    🇸🇦 مسار وطني
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurriculumTrack('international')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: curriculumTrack === 'international' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: curriculumTrack === 'international' ? '#faf5ff' : 'white',
                      color: curriculumTrack === 'international' ? '#7c3aed' : '#475569'
                    }}
                    title="المنهج الدولي: أسئلة وشروحات ونصوص بالإنجليزية كاملة (American/British/IB)"
                  >
                    🌐 مسار دولي
                  </button>
                </div>
              </div>

              {/* Notation and Symbol Language */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
                  لغة الرموز والمتغيرات والأرقام
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSymbolLanguage('ar')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: symbolLanguage === 'ar' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: symbolLanguage === 'ar' ? '#f0fdfa' : 'white',
                      color: symbolLanguage === 'ar' ? '#0e7490' : '#475569'
                    }}
                  >
                    🇸🇦 عربية (س، ص، ١)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSymbolLanguage('en')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: symbolLanguage === 'en' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: symbolLanguage === 'en' ? '#f0fdfa' : 'white',
                      color: symbolLanguage === 'en' ? '#0e7490' : '#475569'
                    }}
                  >
                    🇬🇧 إنجليزية (x, y, 1)
                  </button>
                </div>
              </div>

            </div>

            {/* Curriculum and Language Hint Banner */}
            <div style={{
              background: curriculumTrack === 'national' && symbolLanguage === 'en' ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${curriculumTrack === 'national' && symbolLanguage === 'en' ? '#bfdbfe' : '#e2e8f0'}`,
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              color: curriculumTrack === 'national' && symbolLanguage === 'en' ? '#1d4ed8' : '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} color={curriculumTrack === 'national' && symbolLanguage === 'en' ? '#2563eb' : '#64748b'} />
              <span>
                {curriculumTrack === 'national' && symbolLanguage === 'en'
                  ? '💡 مضبوط للمسار الوطني: تظل صياغة الأسئلة والشروحات باللغة العربية، مع قصر الرموز والمعادلات الرياضية والعلمية على الإنجليزية (x, y, 1, 2) تماشياً مع مقررات ومناهج المدارس الأهلية والوطنية.'
                  : (curriculumTrack === 'international'
                      ? '🌐 المنهج الدولي معتمد: سيتم توليد ورقة العمل ونصوص الأسئلة والخيارات والتعليمات باللغة الإنجليزية بالكامل.'
                      : '🇸🇦 المنهج الوطني: صياغة الأسئلة والرموز باللغة العربية (س، ص، ١، ٢).')}
              </span>
            </div>

            {/* Allowed Question Types Checkboxes */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b21a8' }}>أنواع الأسئلة المضمنة:</span>
              {[
                { id: 'mcq', label: 'اختيار من متعدد' },
                { id: 'true_false', label: 'صح أو خطأ' },
                { id: 'fill_blank', label: 'أكمل الفراغ / مصطلح علمي' },
                { id: 'matching', label: 'المزاوجة والربط (صل بين أ و ب)' },
                { id: 'problem_solving', label: 'مسائل مقالية وتفكير ناقد' }
              ].map(tObj => {
                const isSelected = selectedTypes.includes(tObj.id);
                return (
                  <button
                    key={tObj.id}
                    type="button"
                    onClick={() => toggleType(tObj.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                      background: isSelected ? '#f5f3ff' : 'white',
                      color: isSelected ? '#6b21a8' : '#64748b'
                    }}
                  >
                    {isSelected ? <CheckSquare size={14} color="#7c3aed" /> : <Square size={14} color="#94a3b8" />}
                    <span>{tObj.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Target Objectives Display */}
            {effectiveObjectives.length > 0 && (
              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                <strong style={{ color: '#0e7490' }}>الأهداف السلوكية المعتمدة التي بنيت عليها الأسئلة ({effectiveObjectives.length}):</strong>
                <ul style={{ margin: '4px 0 0 0', paddingRight: '20px', color: '#334155', lineHeight: '1.6' }}>
                  {effectiveObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Printable / Viewable Worksheet Body */}
        <div id="printable-worksheet-content" style={{ padding: '30px 40px', flex: 1 }}>
          
          {/* Official Ministry & School Printable Header */}
          <div style={{
            borderBottom: '3px double #0e7490',
            paddingBottom: '16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            {/* Right: Kingdom & Ministry */}
            <div style={{ textAlign: 'right', fontSize: '13px', color: '#1e293b', lineHeight: '1.5' }}>
              <div style={{ fontWeight: 'bold' }}>المملكة العربية السعودية</div>
              <div>وزارة التعليم</div>
              <div>إدارة التعليم بمحافظة جدة</div>
              <div style={{ fontWeight: 'bold', color: '#0e7490' }}>{userData?.schoolName || 'المدارس المتقدمة الذكية'}</div>
            </div>

            {/* Center: Title & Subject */}
            <div>
              <div style={{
                display: 'inline-block',
                border: '2px solid #0e7490',
                padding: '6px 24px',
                borderRadius: '8px',
                background: '#f0fdfa',
                color: '#0e7490',
                fontWeight: '900',
                fontSize: '18px',
                marginBottom: '6px'
              }}>
                ورقة عمل تقويمية وتفاعلية
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
                موضوع الدرس: {lessonTitle}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                مادة: {subject} • {className || stage} • {semester}
              </div>
            </div>

            {/* Left: Metadata & Grade */}
            <div style={{ textAlign: 'left', fontSize: '12px', color: '#1e293b', lineHeight: '1.5' }}>
              <div>معلم المادة: <strong>{userData?.name || 'معلم المادة'}</strong></div>
              <div>الزمن المقترح: <strong>{estimatedMinutes}</strong></div>
              <div>الدرجة الكلية: <strong>[ {totalMarks} درجات ]</strong></div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                التاريخ: {prepData?.date || new Date().toISOString().split('T')[0]}
              </div>
            </div>
          </div>

          {/* Student Info Box (For Student Print / Solve) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            <div><strong>اسم الطالب:</strong> ....................................</div>
            <div><strong>الصف / الفصل:</strong> {className || '....................'}</div>
            <div><strong>الرقم الأكاديمي:</strong> ....................</div>
            <div style={{ textAlign: 'left', fontWeight: 'bold', color: '#0e7490' }}>
              <strong>الدرجة المستحقة:</strong> [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / {totalMarks} ]
            </div>
          </div>

          {/* Instructions Box */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            padding: '8px 14px',
            borderRadius: '6px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#92400e'
          }}>
            <strong>📌 تعليمات وتوجيهات ورقة العمل:</strong> {instructions.join(' • ')}
          </div>

          {/* Questions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {questions.map((q, idx) => {
              const qNum = formatNumberBySymbol(idx + 1, symbolLanguage);
              const pts = formatNumberBySymbol(q.points, symbolLanguage);

              return (
                <div 
                  key={q.id || idx}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    position: 'relative',
                    pageBreakInside: 'avoid'
                  }}
                >
                  {/* Question Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '280px' }}>
                      <span style={{
                        background: '#0e7490',
                        color: 'white',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {qNum}
                      </span>

                      <div style={{ flex: 1 }}>
                        {canEdit && activeTab === 'studio' ? (
                          <textarea
                            className="input-field"
                            rows={2}
                            style={{
                              margin: 0,
                              padding: '8px 12px',
                              fontSize: '14px',
                              width: '100%',
                              fontWeight: '600',
                              lineHeight: '1.5',
                              resize: 'vertical',
                              borderRadius: '8px',
                              border: '1.5px solid #cbd5e1'
                            }}
                            value={q.question}
                            placeholder="اكتب أو عدّل نص السؤال هنا (يدعم الرموز والمعادلات الرياضية والعلمية)..."
                            onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
                          />
                        ) : (
                          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a', lineHeight: '1.6' }}>
                            <MarkdownViewer content={q.question || q.text || ''} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {canEdit && activeTab === 'studio' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>درجة:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={q.points || 1}
                            onChange={(e) => updateQuestion(idx, 'points', Math.max(1, Number(e.target.value) || 1))}
                            style={{ width: '42px', padding: '2px 4px', fontSize: '12px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold' }}
                          />
                        </div>
                      ) : (
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          [{pts} {q.points === 1 ? 'درجة' : 'درجات'}]
                        </span>
                      )}

                      {/* Quick Edit Button (From Student or Teacher Tab) */}
                      {canEdit && activeTab !== 'studio' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('studio');
                            setEditingQIndex(idx);
                          }}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#0e7490',
                            cursor: 'pointer',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="تحرير وتعديل هذا السؤال أو إرفاق صورة له"
                        >
                          <Edit3 size={13} /> تحرير
                        </button>
                      )}

                      {/* Bloom Level Badge (Visible to Teacher / Admin) */}
                      {activeTab === 'teacher' && (
                        <span style={{
                          background: '#f0fdf4',
                          color: '#16a34a',
                          border: '1px solid #bbf7d0',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          بلوم: {q.bloomLevel}
                        </span>
                      )}

                      {canEdit && activeTab === 'studio' && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(idx)}
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', padding: '5px', borderRadius: '6px' }}
                          title="حذف هذا السؤال"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attached Image Display (Universal for Student, Teacher, Studio, Print, Word Export) */}
                  {q.image && (
                    <div className="question-image-container" style={{ margin: '12px 0 16px 36px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block',
                        position: 'relative',
                        borderRadius: '8px',
                        padding: '4px',
                        border: '1.5px solid #cbd5e1',
                        background: '#f8fafc',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                      }}>
                        <img
                          src={q.image}
                          alt={`رسم توضيحي للسؤال ${idx + 1}`}
                          style={{
                            maxHeight: '260px',
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: '6px',
                            display: 'block'
                          }}
                        />
                        {canEdit && activeTab === 'studio' && (
                          <div className="no-print" style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            display: 'flex',
                            gap: '6px'
                          }}>
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.95)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                              title="حذف الصورة"
                            >
                              <Trash2 size={12} /> حذف الصورة
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Image Attachment Action Button (Studio Mode) */}
                  {canEdit && activeTab === 'studio' && (
                    <div className="no-print" style={{ margin: '8px 0 14px 36px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <input
                        type="file"
                        id={`q-img-upload-${idx}`}
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploadingImgQIndex === idx}
                        onChange={(e) => handleImageUpload(idx, e.target.files?.[0])}
                      />
                      <label
                        htmlFor={`q-img-upload-${idx}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: uploadingImgQIndex === idx ? 'wait' : 'pointer',
                          background: q.image ? '#ecfdf5' : '#f0fdfa',
                          border: `1.5px dashed ${q.image ? '#10b981' : '#0e7490'}`,
                          color: q.image ? '#065f46' : '#0e7490'
                        }}
                        title="إرفاق صورة أو رسم هندسي/علمي للسؤال تماماً كما في الاختبارات"
                      >
                        {uploadingImgQIndex === idx ? (
                          <Loader size={14} className="spin" />
                        ) : (
                          <ImageIcon size={14} />
                        )}
                        <span>{uploadingImgQIndex === idx ? 'جاري ضغط ومعالجة الصورة...' : (q.image ? '📷 تغيير الصورة المرفقة' : '📷 إرفاق صورة / رسم توضيحي للسؤال')}</span>
                      </label>
                      {q.image && (
                        <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>
                          ✓ تم إرفاق وحفظ الصورة بالسؤال
                        </span>
                      )}
                    </div>
                  )}

                  {/* Render based on Question Type */}
                  {/* 1. Multiple Choice (MCQ) */}
                  {q.type === 'mcq' && q.options && (
                    <div style={{ marginRight: '34px' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '10px'
                      }}>
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = q.correctOption === oIdx;
                          const showAsCorrect = activeTab === 'teacher' && isCorrect;

                          return (
                            <div 
                              key={oIdx}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: (showAsCorrect || (canEdit && activeTab === 'studio' && isCorrect)) ? '2px solid #10b981' : '1px solid #e2e8f0',
                                background: (showAsCorrect || (canEdit && activeTab === 'studio' && isCorrect)) ? '#ecfdf5' : '#f8fafc',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '13px'
                              }}
                            >
                              {canEdit && activeTab === 'studio' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }} title="تحديد كإجابة صحيحة">
                                    <input
                                      type="radio"
                                      name={`correct_opt_${idx}`}
                                      checked={q.correctOption === oIdx}
                                      onChange={() => {
                                        updateQuestion(idx, 'correctOption', oIdx);
                                        updateQuestion(idx, 'correctAnswer', opt);
                                      }}
                                      style={{ accentColor: '#10b981', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: q.correctOption === oIdx ? '#059669' : '#64748b' }}>
                                      {q.correctOption === oIdx ? '✓ صحيحة' : 'صحيحة؟'}
                                    </span>
                                  </label>
                                  <input
                                    type="text"
                                    style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '13px' }}
                                    value={opt}
                                    onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                                  />
                                  {q.options.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextOpts = q.options.filter((_, i) => i !== oIdx);
                                        let nextCorr = q.correctOption;
                                        if (nextCorr === oIdx) nextCorr = 0;
                                        else if (nextCorr > oIdx) nextCorr -= 1;
                                        updateQuestion(idx, 'options', nextOpts);
                                        updateQuestion(idx, 'correctOption', nextCorr);
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                      title="حذف هذا الخيار"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <span style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    border: showAsCorrect ? '5px solid #10b981' : '1.5px solid #94a3b8',
                                    display: 'inline-block',
                                    flexShrink: 0
                                  }} />
                                  <span style={{ fontWeight: showAsCorrect ? 'bold' : 'normal', color: showAsCorrect ? '#065f46' : '#334155' }}>
                                    {opt}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Option Button in Studio Mode */}
                      {canEdit && activeTab === 'studio' && (
                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const nextOpts = [...(q.options || [])];
                              const nextLetter = symbolLanguage === 'ar' 
                                ? ['أ', 'ب', 'جـ', 'د', 'هـ', 'و'][nextOpts.length] || `خيار ${nextOpts.length + 1}`
                                : String.fromCharCode(65 + nextOpts.length);
                              nextOpts.push(`${nextLetter}) `);
                              updateQuestion(idx, 'options', nextOpts);
                            }}
                            style={{
                              background: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              color: '#0e7490',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Plus size={13} /> إضافة خيار جديد
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. True / False */}
                  {q.type === 'true_false' && (
                    <div style={{ display: 'flex', gap: '20px', marginRight: '34px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {['صح (True)', 'خطأ (False)'].map((choice, cIdx) => {
                        const isCorrect = q.correctOption === cIdx;
                        const showAsCorrect = activeTab === 'teacher' && isCorrect;

                        return (
                          <div 
                            key={cIdx}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '8px',
                              border: (showAsCorrect || (canEdit && activeTab === 'studio' && isCorrect)) ? '2px solid #10b981' : '1px solid #cbd5e1',
                              background: (showAsCorrect || (canEdit && activeTab === 'studio' && isCorrect)) ? '#ecfdf5' : '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontWeight: (showAsCorrect || (canEdit && activeTab === 'studio' && isCorrect)) ? 'bold' : '500',
                              color: (showAsCorrect || (canEdit && activeTab === 'studio' && isCorrect)) ? '#065f46' : '#334155',
                              fontSize: '13px'
                            }}
                          >
                            {canEdit && activeTab === 'studio' ? (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name={`tf_correct_${idx}`}
                                  checked={q.correctOption === cIdx}
                                  onChange={() => {
                                    updateQuestion(idx, 'correctOption', cIdx);
                                    updateQuestion(idx, 'correctAnswer', cIdx === 0 ? 'صح' : 'خطأ');
                                  }}
                                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                                />
                                <span>{choice} {q.correctOption === cIdx ? '(الإجابة الصحيحة)' : ''}</span>
                              </label>
                            ) : (
                              <>
                                <Square size={16} color={showAsCorrect ? '#10b981' : '#94a3b8'} />
                                <span>{choice}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Fill in Blanks */}
                  {q.type === 'fill_blank' && (
                    <div style={{ marginRight: '34px', marginTop: '10px' }}>
                      {activeTab === 'student' && (
                        <div style={{
                          borderBottom: '2px dashed #94a3b8',
                          height: '28px',
                          width: '70%',
                          marginTop: '8px'
                        }} />
                      )}
                      {canEdit && activeTab === 'studio' && (
                        <div style={{ marginTop: '8px' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#0e7490', fontWeight: 'bold', marginBottom: '4px' }}>
                            الإجابة الصحيحة المقررة:
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            style={{ margin: 0, fontSize: '13px', maxWidth: '380px' }}
                            value={q.correctAnswer || ''}
                            placeholder="المصطلح أو الإجابة الصحيحة..."
                            onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Problem Solving / Essay */}
                  {q.type === 'problem_solving' && (
                    <div style={{ marginRight: '34px', marginTop: '12px' }}>
                      {activeTab === 'student' && (
                        <div style={{
                          border: '1px dashed #cbd5e1',
                          borderRadius: '8px',
                          background: '#fcfcfc',
                          height: '90px',
                          padding: '8px',
                          color: '#94a3b8',
                          fontSize: '12px'
                        }}>
                          مساحة مخصصة لكتابة خطوات الحل الرياضي أو العلمي بدقة:
                        </div>
                      )}
                      {canEdit && activeTab === 'studio' && (
                        <div style={{ marginTop: '8px' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#0e7490', fontWeight: 'bold', marginBottom: '4px' }}>
                            دليل وخطوات الحل النموذجي:
                          </label>
                          <textarea
                            rows={3}
                            className="input-field"
                            style={{ margin: 0, fontSize: '13px', resize: 'vertical' }}
                            value={q.correctAnswer || ''}
                            placeholder="اكتب خطوات الحل النموذجي المفصل..."
                            onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Matching Question (المزاوجة والربط - صل بين أ و ب) */}
                  {q.type === 'matching' && q.columnA && q.columnB && (
                    <div style={{ marginRight: '34px', marginTop: '12px', overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        background: 'white',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                            <th style={{
                              padding: '10px 14px',
                              textAlign: symbolLanguage === 'ar' ? 'right' : 'left',
                              color: '#0e7490',
                              fontWeight: 'bold',
                              width: '50%',
                              borderRight: symbolLanguage === 'ar' ? 'none' : '1px solid #e2e8f0',
                              borderLeft: symbolLanguage === 'ar' ? '1px solid #e2e8f0' : 'none'
                            }}>
                              📌 {symbolLanguage === 'ar' ? 'العمود (أ) - المفاهيم والعبارات' : 'Column (A) - Concepts'}
                            </th>
                            <th style={{
                              padding: '10px 14px',
                              textAlign: symbolLanguage === 'ar' ? 'right' : 'left',
                              color: '#0e7490',
                              fontWeight: 'bold',
                              width: '50%'
                            }}>
                              🔍 {symbolLanguage === 'ar' ? 'العمود (ب) - التعريفات والخصائص' : 'Column (B) - Definitions'}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: Math.max(q.columnA.length, q.columnB.length) }).map((_, rIdx) => {
                            const itemA = q.columnA[rIdx];
                            const itemB = q.columnB[rIdx];

                            // Check teacher match key if in teacher tab
                            let matchKey = null;
                            if (activeTab === 'teacher' && itemA && q.correctAnswer) {
                              const regex = new RegExp(`\\(${itemA.num}\\s*[➔->:]\\s*([^)]+)\\)`);
                              const m = q.correctAnswer.match(regex);
                              if (m) matchKey = m[1].trim();
                            }

                            return (
                              <tr key={rIdx} style={{
                                borderBottom: '1px solid #e2e8f0',
                                background: rIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                              }}>
                                {/* Column A cell */}
                                <td style={{
                                  padding: '8px 12px',
                                  verticalAlign: 'middle',
                                  borderRight: symbolLanguage === 'ar' ? 'none' : '1px solid #e2e8f0',
                                  borderLeft: symbolLanguage === 'ar' ? '1px solid #e2e8f0' : 'none'
                                }}>
                                  {itemA ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {/* Student answer bracket: (    ) */}
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '40px',
                                        height: '24px',
                                        padding: '0 4px',
                                        border: activeTab === 'teacher' && matchKey ? '1.5px solid #10b981' : '1.5px solid #94a3b8',
                                        borderRadius: '6px',
                                        background: activeTab === 'teacher' && matchKey ? '#ecfdf5' : '#ffffff',
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        color: activeTab === 'teacher' && matchKey ? '#059669' : '#64748b',
                                        flexShrink: 0
                                      }}>
                                        (&nbsp;{matchKey || <span style={{ display: 'inline-block', width: '16px' }} />}&nbsp;)
                                      </span>

                                      {/* Item Number */}
                                      <span style={{
                                        fontWeight: 'bold',
                                        color: '#0e7490',
                                        fontSize: '13px',
                                        flexShrink: 0
                                      }}>
                                        {itemA.num}-
                                      </span>

                                      {/* Item Text or Edit Input */}
                                      {canEdit && activeTab === 'studio' ? (
                                        <input
                                          type="text"
                                          value={itemA.text}
                                          onChange={(e) => updateMatchingItem(idx, 'columnA', rIdx, e.target.value)}
                                          style={{
                                            flex: 1,
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '13px'
                                          }}
                                        />
                                      ) : (
                                        <span style={{ color: '#1e293b', fontSize: '13px', lineHeight: '1.5' }}>
                                          {itemA.text}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </td>

                                {/* Column B cell */}
                                <td style={{
                                  padding: '8px 12px',
                                  verticalAlign: 'middle'
                                }}>
                                  {itemB ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {/* Item Label Badge (أ, ب, جـ or A, B, C) */}
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '24px',
                                        height: '24px',
                                        padding: '0 4px',
                                        borderRadius: '6px',
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        color: '#0e7490',
                                        flexShrink: 0
                                      }}>
                                        {itemB.label}
                                      </span>

                                      {/* Item Text or Edit Input */}
                                      {canEdit && activeTab === 'studio' ? (
                                        <input
                                          type="text"
                                          value={itemB.text}
                                          onChange={(e) => updateMatchingItem(idx, 'columnB', rIdx, e.target.value)}
                                          style={{
                                            flex: 1,
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '13px'
                                          }}
                                        />
                                      ) : (
                                        <span style={{ color: '#1e293b', fontSize: '13px', lineHeight: '1.5' }}>
                                          {itemB.text}
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Teacher Model Answer Box (Visible ONLY in Teacher / Admin view) */}
                  {activeTab === 'teacher' && (
                    <div style={{
                      marginTop: '14px',
                      marginRight: '34px',
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '13px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={16} color="#16a34a" /> الإجابة النموذجية ودليل التصحيح:
                      </div>
                      <div style={{ color: '#14532d', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                        {q.correctAnswer}
                      </div>
                      {q.explanation && (
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '6px', fontStyle: 'italic' }}>
                          💡 <strong>التعليل والتفسير التربوي:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Studio Mode: Model Answer & Pedagogical Explanation Editing */}
                  {canEdit && activeTab === 'studio' && (
                    <div style={{
                      marginTop: '14px',
                      marginRight: '34px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '13px'
                    }}>
                      {q.type === 'matching' && (
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ display: 'block', fontSize: '11px', color: '#0e7490', fontWeight: 'bold', marginBottom: '4px' }}>
                            دليل الربط والمزاوجة النموذجي:
                          </label>
                          <textarea
                            rows={2}
                            className="input-field"
                            style={{ margin: 0, fontSize: '12px' }}
                            value={q.correctAnswer || ''}
                            placeholder="مثال: (١ ➔ ب)، (٢ ➔ أ)..."
                            onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#15803d', fontWeight: 'bold', marginBottom: '4px' }}>
                          💡 التعليل والتفسير التربوي (إرشادات وتوضيح الإجابة للطلاب):
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          style={{ margin: 0, fontSize: '12px' }}
                          value={q.explanation || ''}
                          placeholder="اكتب التعليل أو الإرشاد التربوي..."
                          onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                </div>
              );
            })}

            {/* Add Question Button in Studio Mode */}
            {canEdit && activeTab === 'studio' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => addNewQuestion('mcq')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '2px dashed #93c5fd',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Plus size={18} /> إضافة سؤال اختيار من متعدد (MCQ)
                </button>

                <button
                  type="button"
                  onClick={() => addNewQuestion('matching')}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '2px dashed #c084fc',
                    background: '#faf5ff',
                    color: '#7e22ce',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <ArrowLeftRight size={18} /> إضافة سؤال مزاوجة وربط (صل بين أ و ب)
                </button>
              </div>
            )}

            {/* Bonus Challenge Question Box */}
            {bonusQuestion && (
              <div style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '18px',
                pageBreakInside: 'avoid'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <Award size={20} color="#d97706" /> {bonusQuestion.title}
                  </h4>
                  <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                    [{bonusQuestion.points} درجات إضافية]
                  </span>
                </div>

                {canEdit && activeTab === 'studio' ? (
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#b45309', fontWeight: 'bold', marginBottom: '4px' }}>
                      نص سؤال التحدي والتفكير الإبداعي:
                    </label>
                    <textarea
                      rows={2}
                      className="input-field"
                      style={{ margin: 0, fontSize: '13px' }}
                      value={bonusQuestion.question || ''}
                      onChange={(e) => setBonusQuestion(prev => ({ ...prev, question: e.target.value }))}
                    />
                  </div>
                ) : (
                  <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#78350f', lineHeight: '1.6' }}>
                    {bonusQuestion.question}
                  </p>
                )}

                {activeTab === 'student' ? (
                  <div style={{
                    border: '1px dashed #d97706',
                    borderRadius: '8px',
                    background: 'white',
                    height: '80px',
                    padding: '8px',
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}>
                    مساحة إجابة سؤال التحدي والتفكير الإبداعي:
                  </div>
                ) : canEdit && activeTab === 'studio' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#854d0e', fontWeight: 'bold', marginBottom: '4px' }}>
                      معيار ودليل التصحيح النموذجي للتحدي:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ margin: 0, fontSize: '12px' }}
                      value={bonusQuestion.modelAnswer || ''}
                      onChange={(e) => setBonusQuestion(prev => ({ ...prev, modelAnswer: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div style={{ background: '#fefce8', border: '1px solid #fef08a', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', color: '#854d0e' }}>
                    <strong>معيار التصحيح للمعلم:</strong> {bonusQuestion.modelAnswer}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Printable Footer & Signatures */}
          <div style={{
            marginTop: '30px',
            borderTop: '2px solid #e2e8f0',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#475569'
          }}>
            <div>توقيع معلم المادة: ....................................</div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              تم إعداد ورقة العمل عبر النظام التعليمي الذكي المتكامل • باركود التحقق الرقمي متاح
            </div>
            <div>اعتماد المشرف / المدير: ....................................</div>
          </div>

        </div>

        {/* Bottom Save & Publish Bar (For Teacher / Admin) */}
        {canEdit && (
          <div className="no-print" style={{
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            borderBottomLeftRadius: '20px',
            borderBottomRightRadius: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
              <span>الحالة الحالية:</span>
              <strong style={{ color: status === 'published' ? '#059669' : '#d97706' }}>
                {status === 'published' ? '🌐 منشورة للطالب وولي الأمر والكادر' : '🔒 مسودة خاصة بالمعلم'}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={isSaving}
                className="btn"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🔒 حفظ كمسودة خاصة
              </button>

              <button
                type="button"
                onClick={() => handleSave('published')}
                disabled={isSaving}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)'
                }}
              >
                <Globe size={16} /> اعتماد ونشر ورقة العمل للجميع
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Global Print Styles for Perfect A4 Output */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .worksheet-modal-root,
          .worksheet-modal-root * {
            visibility: visible !important;
          }
          .worksheet-modal-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-worksheet-content {
            padding: 10mm 15mm !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .worksheet-question-card {
            page-break-inside: avoid !important;
          }
          .question-image-container img {
            max-height: 180px !important;
            max-width: 100% !important;
            object-fit: contain !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
