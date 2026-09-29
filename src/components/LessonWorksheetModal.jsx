import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, doc, setDoc, addDoc, updateDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { 
  Sparkles, Save, Printer, Download, Eye, EyeOff, Edit3, Trash2, Plus, 
  CheckCircle2, AlertCircle, Share2, Globe, Lock, BookOpen, Clock, 
  CheckSquare, Square, X, Award, HelpCircle, Layers, ArrowRight, RefreshCw, FileText,
  ArrowLeftRight, Image as ImageIcon, Upload, Check, ChevronDown, ChevronUp, Loader, Copy
} from 'lucide-react';
import { 
  generateWorksheetAI, 
  generateWorksheetFromAttachment, 
  extractTextFromPdfArrayBuffer, 
  formatNumberBySymbol, 
  toArabicNumerals, 
  toWesternNumerals, 
  BLOOM_LEVELS, 
  isInternationalSchool 
} from '../utils/aiWorksheetGenerator';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { readFileAsDataUrl } from '../utils/fileStorageService';
import MarkdownViewer from './MarkdownViewer';
import MarkdownInput from './MarkdownInput';
import LatexMathToolbar from './LatexMathToolbar';
import QuickLatexToolbar from './QuickLatexToolbar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

// Helper: normalize answers for reliable matching comparison (handles English case, Arabic tatweel, Alif forms)
export const normalizeAnswerKey = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\u0640/g, '') // remove Arabic tatweel (kashida)
    .replace(/[إأآا]/g, 'ا'); // normalize Arabic Alif
};

// Helper: robustly extract expected matching key for an item from correctAnswer text
export const getMatchingCorrectAnswer = (correctAnswerText, itemNum) => {
  if (!correctAnswerText || itemNum === undefined || itemNum === null) return null;
  const numWestern = String(itemNum).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const numArabic = String(itemNum).trim().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const numPattern = numWestern === numArabic ? numWestern : `${numWestern}|${numArabic}`;
  try {
    // Note: '-' is safely placed at start of character class [-:] to avoid Range out of order SyntaxError
    const regex = new RegExp(`(?:\\(|^|\\s)(?:${numPattern})\\s*(?:➔|→|->|[-:])\\s*([^),;،\\n\\r]+)\\)?`);
    const m = String(correctAnswerText).match(regex);
    return m ? m[1].trim() : null;
  } catch (e) {
    console.error('Error parsing matching correct answer:', e);
    return null;
  }
};

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

  // Role Detection
  const effectiveRole = userRole || userData?.role || 'teacher';
  const isStudent = effectiveRole === 'student' || userData?.role === 'student';
  const isParent = effectiveRole === 'parent' || userData?.role === 'parent';
  const isTeacherOrStaff = !isStudent && !isParent;

  // Basic Details
  const lessonTitle = prepData?.lessonTitle || existingWorksheet?.lessonTitle || 'درس تعليمي';
  const subject = prepData?.subject || existingWorksheet?.subject || 'المادة الدراسية';
  const className = prepData?.className || existingWorksheet?.className || '';
  const stage = prepData?.stage || existingWorksheet?.stage || '';
  const semester = prepData?.semester || existingWorksheet?.semester || '';
  const schoolId = prepData?.schoolId || userData?.schoolId || 'default_school_1';
  const prepId = prepData?.id || prepData?.prepDocId || existingWorksheet?.prepId || null;

  // Name Resolution: Teacher vs Student
  const effectiveTeacherName = 
    existingWorksheet?.teacherName || 
    prepData?.teacherName || 
    prepData?.teacher ||
    (isTeacherOrStaff ? (userData?.name || 'معلم المادة') : 'معلم المادة');

  const effectiveStudentName = 
    isParent 
      ? (userData?.studentName || 'الطالب') 
      : isStudent 
        ? (userData?.name || 'الطالب') 
        : (existingWorksheet?.studentName || '');

  const effectiveStudentNid = 
    isParent 
      ? (userData?.studentNationalId || '') 
      : isStudent 
        ? (userData?.nationalId || userData?.studentId || '') 
        : (existingWorksheet?.studentNationalId || '');

  const effectiveClassName = 
    className || 
    userData?.class || 
    userData?.className || 
    userData?.studentClass || 
    prepData?.className || 
    '';

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

  // Show/Hide Objectives Option (Defaults to false: hidden from student)
  const [showObjectives, setShowObjectives] = useState(existingWorksheet?.showObjectives || false);

  // Show/Hide Solution Answers Key (Defaults to false for student worksheets & drafts)
  const [showAnswers, setShowAnswers] = useState(existingWorksheet?.showAnswers !== undefined ? Boolean(existingWorksheet.showAnswers) : false);

  // Show/Hide Estimated Time and Timer Bar (Defaults to false for drafts & student worksheets)
  const [showTime, setShowTime] = useState(existingWorksheet?.showTime !== undefined ? Boolean(existingWorksheet.showTime) : false);

  // Active View Tab: 'student' (Student Worksheet) | 'teacher' (Model Answer Key) | 'studio' (AI Editor)
  const [activeTab, setActiveTab] = useState(userRole === 'student' ? 'student' : (existingWorksheet ? 'student' : 'studio'));

  // Question Editing & Image Uploading States
  const [uploadingImgQIndex, setUploadingImgQIndex] = useState(null);
  const [editingQIndex, setEditingQIndex] = useState(null);
  const [latexEditingIdx, setLatexEditingIdx] = useState(null);
  const [activeOptionLatex, setActiveOptionLatex] = useState(null); // { qIdx, optIdx }
  const [activeBlankLatex, setActiveBlankLatex] = useState(null); // qIdx
  const [activeMatchingLatex, setActiveMatchingLatex] = useState(null); // { qIdx, col, itemIdx }
  const [activeProblemLatex, setActiveProblemLatex] = useState(null); // qIdx
  const [activeBonusLatex, setActiveBonusLatex] = useState(null); // 'question' | 'modelAnswer'

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

  // Parse estimated minutes (e.g., '20 دقيقة' -> 20)
  const defaultMinutes = useMemo(() => {
    const raw = existingWorksheet?.estimatedMinutes || estimatedMinutes || '20';
    const match = String(raw).match(/\d+/);
    return match ? Math.max(5, Math.min(120, parseInt(match[0], 10))) : 20;
  }, [existingWorksheet?.estimatedMinutes, estimatedMinutes]);

  // Student Interactive Solving & Countdown Timer State
  const [selectedDuration, setSelectedDuration] = useState(defaultMinutes);
  const [timeRemaining, setTimeRemaining] = useState(defaultMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(true);
  const [timerEnded, setTimerEnded] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [studentSubmitted, setStudentSubmitted] = useState(false);
  const [submissionScore, setSubmissionScore] = useState(null);
  const [submissionPercentage, setSubmissionPercentage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);

  // Loading & Saving State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [worksheetDocId, setWorksheetDocId] = useState(existingWorksheet?.id || null);

  // Attachment-based Worksheet Generation State (Image / PDF)
  const [worksheetAttachment, setWorksheetAttachment] = useState(existingWorksheet?.attachment || null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentDataUrl, setAttachmentDataUrl] = useState(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState('image'); // 'image' | 'pdf'
  const [extractedPdfText, setExtractedPdfText] = useState('');
  const [attachmentNotes, setAttachmentNotes] = useState('');
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

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
      setShowObjectives(existingWorksheet.showObjectives || false);
      setShowAnswers(existingWorksheet.showAnswers !== undefined ? Boolean(existingWorksheet.showAnswers) : false);
      setShowTime(existingWorksheet.showTime !== undefined ? Boolean(existingWorksheet.showTime) : false);
      setWorksheetDocId(existingWorksheet.id || null);
      setWorksheetAttachment(existingWorksheet.attachment || null);
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
        schoolName: userData?.schoolName || prepData?.schoolName || '',
        showObjectives
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

  // Handle Attachment Selection (Image or PDF)
  const handleAttachmentFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAttachment(true);
    setAttachmentNotice('');
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);

      if (!isPdf && !isImg) {
        alert('يرجى اختيار ملف صورة صالحة (PNG, JPG, WebP) أو مستند PDF');
        return;
      }

      setAttachmentFile(file);
      setAttachmentName(file.name);
      setAttachmentType(isPdf ? 'pdf' : 'image');

      if (isPdf) {
        // Read as Data URL for storage & display
        const dataUrl = await readFileAsDataUrl(file);
        setAttachmentDataUrl(dataUrl);

        // Read as ArrayBuffer to extract text
        const arrayBuf = await file.arrayBuffer();
        const extracted = extractTextFromPdfArrayBuffer(arrayBuf);
        setExtractedPdfText(extracted);
        setAttachmentNotice(`✓ تم بنجاح قراءة وتحليل ملف PDF (${file.name})! يمكنك الآن توليد ورقة العمل.`);
      } else {
        // Image compression
        const dataUrl = await compressImageToDataUrl(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.85
        });
        setAttachmentDataUrl(dataUrl);
        setExtractedPdfText('');
        setAttachmentNotice(`✓ تم بنجاح ضغط وتجهيز الصورة المرفقة (${file.name})! يمكنك الآن توليد ورقة العمل.`);
      }
    } catch (err) {
      console.error('Error processing attachment:', err);
      alert('حدث خطأ أثناء معالجة المرفق: ' + (err.message || ''));
    } finally {
      setIsProcessingAttachment(false);
      e.target.value = '';
    }
  };

  // Handle Remove Attachment
  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentDataUrl(null);
    setAttachmentName('');
    setAttachmentType('image');
    setExtractedPdfText('');
    setAttachmentNotes('');
    setAttachmentNotice('');
    setWorksheetAttachment(null);
  };

  // Handle Generating Worksheet based on the Attachment (Image or PDF)
  const handleGenerateFromAttachment = async () => {
    if (!attachmentDataUrl && !attachmentFile) {
      alert('يرجى أولاً اختيار أو إرفاق ملف صورة أو مستند PDF');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateWorksheetFromAttachment({
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
        schoolName: userData?.schoolName || prepData?.schoolName || '',
        showObjectives,
        attachment: {
          file: attachmentFile,
          dataUrl: attachmentDataUrl,
          name: attachmentName || 'مرفق ورقة العمل',
          type: attachmentType,
          extractedText: extractedPdfText,
          customNotes: attachmentNotes
        }
      });

      setQuestions(result.questions);
      setBonusQuestion(result.bonusQuestion);
      setInstructions(result.instructions);
      setEstimatedMinutes(result.estimatedMinutes);
      setWorksheetAttachment(result.attachment);
      setAttachmentNotice(`🎉 تم بنجاح توليد (${result.questions.length}) أسئلة ذكية بناءً على المرفق (${attachmentName})!`);
    } catch (err) {
      console.error('Error generating worksheet from attachment:', err);
      alert('حدث خطأ أثناء توليد ورقة العمل من المرفق');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Changing Symbol Language & Auto-formatting
  const handleSetSymbolLanguage = (lang) => {
    setSymbolLanguage(lang);
    if (lang === 'ar') {
      convertAllQuestionsToArabicNumerals();
    }
  };

  // Convert all questions, options, column numbers to Arabic Numerals
  const convertAllQuestionsToArabicNumerals = () => {
    setQuestions(prev => prev.map(q => {
      const newQ = { ...q };
      if (typeof newQ.question === 'string') newQ.question = toArabicNumerals(newQ.question);
      if (typeof newQ.text === 'string') newQ.text = toArabicNumerals(newQ.text);
      if (Array.isArray(newQ.options)) {
        newQ.options = newQ.options.map(opt => typeof opt === 'string' ? toArabicNumerals(opt) : opt);
      }
      if (typeof newQ.correctAnswer === 'string') newQ.correctAnswer = toArabicNumerals(newQ.correctAnswer);
      if (typeof newQ.explanation === 'string') newQ.explanation = toArabicNumerals(newQ.explanation);
      if (Array.isArray(newQ.columnA)) {
        newQ.columnA = newQ.columnA.map((item, idxA) => ({
          ...item,
          num: toArabicNumerals(idxA + 1),
          text: typeof item.text === 'string' ? toArabicNumerals(item.text) : item.text
        }));
      }
      if (Array.isArray(newQ.columnB)) {
        newQ.columnB = newQ.columnB.map(item => ({
          ...item,
          text: typeof item.text === 'string' ? toArabicNumerals(item.text) : item.text
        }));
      }
      return newQ;
    }));
    if (bonusQuestion) {
      setBonusQuestion(prev => ({
        ...prev,
        title: toArabicNumerals(prev.title),
        question: toArabicNumerals(prev.question),
        modelAnswer: toArabicNumerals(prev.modelAnswer)
      }));
    }
    setEstimatedMinutes(prev => toArabicNumerals(prev));
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

  // Duplicate question (نسخ السؤال)
  const duplicateQuestion = (index) => {
    setQuestions(prev => {
      if (!prev[index]) return prev;
      const copy = JSON.parse(JSON.stringify(prev[index]));
      copy.id = `q_${Date.now()}_copy_${Math.floor(Math.random() * 1000)}`;
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next.map((q, i) => ({ ...q, number: i + 1 }));
    });
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

  // Helper to convert external or blob image URLs to embedded Base64 (saving images directly without external links)
  const convertExternalImageUrlsToBase64 = async (text) => {
    if (!text || typeof text !== 'string') return text;
    const imgRegex = /!\[(.*?)\]\((https?:\/\/[^\s\)]+|blob:[^\s\)]+)\)/g;
    let match;
    let updatedText = text;
    const matches = [];
    while ((match = imgRegex.exec(text)) !== null) {
      matches.push({ full: match[0], alt: match[1], url: match[2] });
    }

    for (const item of matches) {
      try {
        const response = await fetch(item.url, { mode: 'cors' });
        const blob = await response.blob();
        let base64 = await compressImageToDataUrl(blob, {
          maxWidth: 1000,
          maxHeight: 1000,
          quality: 0.78
        });
        if (!base64) {
          base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
        if (base64) {
          updatedText = updatedText.replace(item.full, `![${item.alt}](${base64})`);
        }
      } catch (err) {
        console.warn('Could not convert external image to Base64 in worksheet:', item.url, err);
      }
    }
    return updatedText;
  };

  // Helper for matching cells to handle clipboard image paste (Ctrl+V)
  const handleMatchingPasteImage = async (qIdx, col, rIdx, e) => {
    const items = e.clipboardData?.items;
    let file = null;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          file = items[i].getAsFile();
          break;
        }
      }
    }
    if (!file && e.clipboardData?.files?.length > 0) {
      const f = e.clipboardData.files[0];
      if (f.type && f.type.startsWith('image/')) file = f;
    }
    if (file) {
      e.preventDefault();
      try {
        const dataUrl = await compressImageToDataUrl(file, { maxWidth: 800, maxHeight: 800, quality: 0.80 });
        if (dataUrl) {
          const currentText = col === 'columnA' ? (questions[qIdx]?.columnA?.[rIdx]?.text || '') : (questions[qIdx]?.columnB?.[rIdx]?.text || '');
          updateMatchingItem(qIdx, col, rIdx, (currentText ? currentText + ' ' : '') + `![صورة](${dataUrl})`);
        }
      } catch (err) {
        console.error('Error pasting image to matching item:', err);
      }
    }
  };

  // Helper to upload image for matching cell via file picker
  const handleMatchingFileUpload = async (qIdx, col, rIdx, file) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 800, maxHeight: 800, quality: 0.80 });
      if (dataUrl) {
        const currentText = col === 'columnA' ? (questions[qIdx]?.columnA?.[rIdx]?.text || '') : (questions[qIdx]?.columnB?.[rIdx]?.text || '');
        updateMatchingItem(qIdx, col, rIdx, (currentText ? currentText + ' ' : '') + `![صورة](${dataUrl})`);
      }
    } catch (err) {
      console.error('Error uploading image to matching item:', err);
    }
  };

  // Handle Save (Draft or Published)
  const handleSave = async (desiredStatus = status) => {
    setIsSaving(true);
    try {
      // When saving draft directed to students, answers and time are explicitly hidden by default
      const finalShowAnswers = desiredStatus === 'draft' ? false : Boolean(showAnswers);
      const finalShowTime = desiredStatus === 'draft' ? false : Boolean(showTime);

      // Convert any external/blob image URLs in questions and options to Base64 dataUrls
      const processedQuestions = await Promise.all(questions.map(async (q) => {
        const processedQ = { ...q };
        if (processedQ.question) {
          processedQ.question = await convertExternalImageUrlsToBase64(processedQ.question);
        }
        if (processedQ.text) {
          processedQ.text = await convertExternalImageUrlsToBase64(processedQ.text);
        }
        if (Array.isArray(processedQ.options)) {
          processedQ.options = await Promise.all(processedQ.options.map(opt => convertExternalImageUrlsToBase64(opt)));
        }
        if (processedQ.correctAnswer) {
          processedQ.correctAnswer = await convertExternalImageUrlsToBase64(processedQ.correctAnswer);
        }
        if (Array.isArray(processedQ.columnA)) {
          processedQ.columnA = await Promise.all(processedQ.columnA.map(async item => ({
            ...item,
            text: await convertExternalImageUrlsToBase64(item.text)
          })));
        }
        if (Array.isArray(processedQ.columnB)) {
          processedQ.columnB = await Promise.all(processedQ.columnB.map(async item => ({
            ...item,
            text: await convertExternalImageUrlsToBase64(item.text)
          })));
        }
        return processedQ;
      }));

      let processedBonus = bonusQuestion ? { ...bonusQuestion } : null;
      if (processedBonus) {
        if (processedBonus.question) {
          processedBonus.question = await convertExternalImageUrlsToBase64(processedBonus.question);
        }
        if (processedBonus.modelAnswer) {
          processedBonus.modelAnswer = await convertExternalImageUrlsToBase64(processedBonus.modelAnswer);
        }
      }

      const payload = {
        lessonTitle,
        subject,
        className,
        stage,
        semester,
        schoolId,
        prepId: prepId || '',
        teacherId: existingWorksheet?.teacherId || prepData?.teacherId || (isTeacherOrStaff ? (userData?.id || userData?.nationalId || 'teacher') : 'teacher'),
        teacherName: existingWorksheet?.teacherName || prepData?.teacherName || prepData?.teacher || (isTeacherOrStaff ? (userData?.name || 'معلم المادة') : 'معلم المادة'),
        symbolLanguage,
        curriculumTrack,
        isInternational: curriculumTrack === 'international',
        showObjectives,
        showAnswers: finalShowAnswers,
        showTime: finalShowTime,
        cognitiveDistribution,
        selectedTypes,
        estimatedMinutes,
        totalMarks,
        status: desiredStatus,
        objectives: effectiveObjectives,
        questions: processedQuestions,
        bonusQuestion: processedBonus,
        instructions,
        attachment: worksheetAttachment || null,
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
      if (desiredStatus === 'draft') {
        setShowAnswers(false);
        setShowTime(false);
      }

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
        alert('✓ تم حفظ ورقة العمل كمسودة موجهة للطالب بنجاح.\n(تم إخفاء الإجابات وحجب مؤقت الزمن تلقائياً، مع تفعيل رموز ومعادلات LaTeX ضمنياً).');
      }
    } catch (err) {
      console.error('Error saving worksheet:', err);
      alert('حدث خطأ أثناء حفظ ورقة العمل: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset timer when defaultMinutes changes
  useEffect(() => {
    setSelectedDuration(defaultMinutes);
    setTimeRemaining(defaultMinutes * 60);
    setTimeSpentSeconds(0);
    setTimerEnded(false);
  }, [defaultMinutes]);

  // Handle duration change from dropdown
  const handleDurationChange = (newMinutes) => {
    const mins = Math.max(1, Number(newMinutes) || 20);
    setSelectedDuration(mins);
    setTimeRemaining(mins * 60);
    setTimerEnded(false);
    setTimerRunning(true);
    setTimeSpentSeconds(0);
  };

  // Format time (MM:SS)
  const formatTime = (secs) => {
    const safeSecs = Math.max(0, secs);
    const m = Math.floor(safeSecs / 60);
    const s = safeSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate Student Score
  const calculateStudentScore = (answersToScore = studentAnswers) => {
    let earned = 0;
    questions.forEach((q, idx) => {
      const qPoints = Number(q.points) || 1;
      const userAns = answersToScore[idx];

      if (q.type === 'mcq') {
        if (userAns === q.correctOption) earned += qPoints;
      } else if (q.type === 'true_false') {
        if (userAns === q.correctOption) earned += qPoints;
      } else if (q.type === 'fill_blank') {
        const cleanUser = String(userAns || '').trim().toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه');
        const cleanCorrect = String(q.correctAnswer || '').trim().toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه');
        if (cleanUser && (cleanUser === cleanCorrect || cleanCorrect.includes(cleanUser))) {
          earned += qPoints;
        }
      } else if (q.type === 'matching') {
        const totalPairs = q.columnA?.length || 1;
        let matchedCorrectly = 0;
        q.columnA?.forEach(itemA => {
          const studentChoice = userAns?.[itemA.num];
          const correctChoice = getMatchingCorrectAnswer(q.correctAnswer, itemA.num);
          if (studentChoice && correctChoice && normalizeAnswerKey(studentChoice) === normalizeAnswerKey(correctChoice)) {
            matchedCorrectly += 1;
          }
        });
        earned += (matchedCorrectly / totalPairs) * qPoints;
      } else if (q.type === 'problem_solving') {
        if (userAns && String(userAns).trim().length > 5) {
          earned += qPoints;
        }
      }
    });

    return Math.min(totalMarks, Math.round(earned * 10) / 10);
  };

  // Handle Student Submit
  const handleStudentSubmit = async (isAuto = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setTimerRunning(false);

    try {
      const finalScore = calculateStudentScore(studentAnswers);
      const finalPercent = totalMarks > 0 ? Math.round((finalScore / totalMarks) * 100) : 100;
      setSubmissionScore(finalScore);
      setSubmissionPercentage(finalPercent);
      setStudentSubmitted(true);

      const targetWorksheetId = worksheetDocId || existingWorksheet?.id || prepId || `ws_${Date.now()}`;
      const studentId = userData?.id || userData?.nationalId || 'student_guest';

      const payload = {
        worksheetId: targetWorksheetId,
        prepId: prepId || '',
        lessonTitle,
        subject,
        className: effectiveClassName,
        studentId,
        studentName: effectiveStudentName,
        studentNationalId: effectiveStudentNid,
        teacherName: effectiveTeacherName,
        answers: studentAnswers,
        score: finalScore,
        totalMarks,
        percentage: finalPercent,
        timeLimitMinutes: selectedDuration,
        timeSpentSeconds: timeSpentSeconds,
        isAutoSubmitted: isAuto,
        submittedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'worksheet_submissions'), payload);
    } catch (err) {
      console.error('Error saving worksheet submission:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Countdown Timer Hook
  useEffect(() => {
    if (!isOpen || !timerRunning || studentSubmitted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimerEnded(true);
          setTimerRunning(false);
          handleStudentSubmit(true);
          return 0;
        }
        return prev - 1;
      });
      setTimeSpentSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timerRunning, studentSubmitted, studentAnswers, isSubmitting]);

  // Load existing submission if student previously solved this
  useEffect(() => {
    const fetchExistingSubmission = async () => {
      const studentId = userData?.id || userData?.nationalId;
      const targetWorksheetId = worksheetDocId || existingWorksheet?.id || prepId;
      if (!studentId || !targetWorksheetId) return;

      try {
        const qSub = query(
          collection(db, 'worksheet_submissions'),
          where('worksheetId', '==', targetWorksheetId),
          where('studentId', '==', studentId)
        );
        const snap = await getDocs(qSub);
        if (!snap.empty) {
          const subData = snap.docs[0].data();
          if (subData.answers) setStudentAnswers(subData.answers);
          if (subData.score !== undefined) setSubmissionScore(subData.score);
          if (subData.percentage !== undefined) setSubmissionPercentage(subData.percentage);
          setStudentSubmitted(true);
          setTimerRunning(false);
        }
      } catch (err) {
        console.warn('Could not fetch existing worksheet submission:', err);
      }
    };

    if (isOpen) {
      fetchExistingSubmission();
    }
  }, [isOpen, worksheetDocId, existingWorksheet?.id, prepId, userData?.id, userData?.nationalId]);

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
      padding: 10px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #333; padding: 4px 8px; font-size: 11px; }
    img { max-height: 38px; height: auto; vertical-align: middle; }
    .header-box { border: 1.5px solid #0e7490; padding: 6px; margin-bottom: 8px; text-align: center; }
    .question-box { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #ccc; }
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

  // Print worksheet with clean document title
  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanLesson = (lessonTitle || 'الدرس').replace(/[/\\?%*:|"<>]/g, '_').trim();
    const cleanSubject = (subject || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
    document.title = `ورقة_عمل_${cleanLesson}_${cleanSubject}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
            {/* Show / Hide Objectives Toggle */}
            <button
              type="button"
              onClick={() => setShowObjectives(prev => !prev)}
              style={{
                background: showObjectives ? '#f0fdfa' : '#ffffff',
                border: `1.5px solid ${showObjectives ? '#0e7490' : '#cbd5e1'}`,
                color: showObjectives ? '#0e7490' : '#64748b',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: showObjectives ? '0 2px 6px rgba(14, 116, 144, 0.15)' : 'none'
              }}
              title="التبديل بين إظهار أو إخفاء أهداف الدرس في ورقة العمل"
            >
              {showObjectives ? <Eye size={13} color="#0e7490" /> : <EyeOff size={13} color="#64748b" />}
              <span>الأهداف: {showObjectives ? 'معروضة 👁️' : 'مخفية 🔒'}</span>
            </button>

            {/* Show / Hide Answers Key Toggle */}
            <button
              type="button"
              onClick={() => setShowAnswers(prev => !prev)}
              style={{
                background: showAnswers ? '#ecfdf5' : '#ffffff',
                border: `1.5px solid ${showAnswers ? '#10b981' : '#cbd5e1'}`,
                color: showAnswers ? '#047857' : '#64748b',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: showAnswers ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none'
              }}
              title="التحكم في إظهار أو إخفاء الإجابات النموذجية ودليل الحل في ورقة العمل"
            >
              {showAnswers ? <CheckCircle2 size={13} color="#059669" /> : <EyeOff size={13} color="#64748b" />}
              <span>الإجابات: {showAnswers ? 'معروضة 👁️' : 'مخفية 🔒'}</span>
            </button>

            {/* Show / Hide Time Toggle */}
            <button
              type="button"
              onClick={() => setShowTime(prev => !prev)}
              style={{
                background: showTime ? '#eff6ff' : '#ffffff',
                border: `1.5px solid ${showTime ? '#3b82f6' : '#cbd5e1'}`,
                color: showTime ? '#1d4ed8' : '#64748b',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: showTime ? '0 2px 6px rgba(59, 130, 246, 0.15)' : 'none'
              }}
              title="التحكم في إظهار أو حجب الزمن والمؤقت الزمني"
            >
              {showTime ? <Clock size={13} color="#2563eb" /> : <EyeOff size={13} color="#64748b" />}
              <span>الزمن: {showTime ? 'معروض ⏱️' : 'مخفي 🔒'}</span>
            </button>

            <span>الأسئلة: <strong>{questions.length}</strong></span>
            <span>الدرجة: <strong>{totalMarks}</strong></span>
            {showTime && (
              <span>الزمن المقترح: <strong>{estimatedMinutes}</strong></span>
            )}
            <span>الرموز: <strong>{symbolLanguage === 'ar' ? '🇸🇦 عربية (س، ص)' : '🇬🇧 إنجليزية (x, y)'}</strong></span>
          </div>
        </div>

        {/* Student Interactive Solving & Countdown Timer Bar */}
        {activeTab === 'student' && showTime && (
          <div className="no-print" style={{
            background: timeRemaining <= 180 && !studentSubmitted ? '#fef2f2' : '#f0fdfa',
            borderBottom: `2px solid ${timeRemaining <= 180 && !studentSubmitted ? '#f87171' : '#99f6e4'}`,
            padding: '10px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: studentSubmitted ? '#ecfdf5' : (timeRemaining <= 180 ? '#fee2e2' : '#ccfbf1'),
                border: `1.5px solid ${studentSubmitted ? '#10b981' : (timeRemaining <= 180 ? '#ef4444' : '#14b8a6')}`
              }}>
                <Clock size={18} color={studentSubmitted ? '#059669' : (timeRemaining <= 180 ? '#dc2626' : '#0f766e')} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: studentSubmitted ? '#059669' : (timeRemaining <= 180 ? '#b91c1c' : '#0f766e') }}>
                  {studentSubmitted ? '✓ تم تسليم ورقة العمل' : '⏱️ المؤقت الزمني للإجابة:'}
                </span>
                <span style={{
                  fontSize: '17px',
                  fontWeight: '900',
                  fontFamily: 'monospace',
                  color: studentSubmitted ? '#059669' : (timeRemaining <= 180 ? '#dc2626' : '#0e7490'),
                  direction: 'ltr',
                  letterSpacing: '1.5px'
                }}>
                  {formatTime(timeRemaining)}
                </span>
              </div>

              {!studentSubmitted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <span>المدة المحددة:</span>
                  <select
                    value={selectedDuration}
                    onChange={(e) => handleDurationChange(Number(e.target.value))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#0e7490',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={5}>5 دقائق</option>
                    <option value={10}>10 دقائق</option>
                    <option value={15}>15 دقيقة</option>
                    <option value={20}>20 دقيقة (الافتراضي)</option>
                    <option value={30}>30 دقيقة</option>
                    <option value={45}>45 دقيقة</option>
                    <option value={60}>60 دقيقة</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setTimerRunning(!timerRunning)}
                    style={{
                      background: timerRunning ? '#fffbeb' : '#f0fdf4',
                      border: `1px solid ${timerRunning ? '#f59e0b' : '#10b981'}`,
                      color: timerRunning ? '#b45309' : '#15803d',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {timerRunning ? '⏸️ إيقاف مؤقت' : '▶️ متابعة العد'}
                  </button>
                </div>
              )}
            </div>

            <div>
              {!studentSubmitted ? (
                <button
                  type="button"
                  onClick={() => handleStudentSubmit(false)}
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #0e7490, #10b981)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(14, 116, 144, 0.2)'
                  }}
                >
                  {isSubmitting ? <Loader size={14} className="spin" /> : <CheckCircle2 size={16} />}
                  <span>تسليم ورقة العمل واعتماد الحل 🚀</span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#059669' }}>
                    الدرجة المستحقة: {submissionScore} / {totalMarks} ({submissionPercentage}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('هل تريد إعادة محاولة حل ورقة العمل من جديد؟')) {
                        setStudentSubmitted(false);
                        setStudentAnswers({});
                        setSubmissionScore(null);
                        setSubmissionPercentage(null);
                        setTimeRemaining(selectedDuration * 60);
                        setTimerRunning(true);
                        setTimerEnded(false);
                      }
                    }}
                    style={{
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      color: '#0e7490',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    إعادة المحاولة 🔄
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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

            {/* Attachment-based Worksheet Generator Card (Image / PDF) */}
            <div style={{
              background: '#f8fafc',
              border: '2px dashed #a855f7',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📸 📄 إنشاء وتوليد ورقة العمل من مرفق (صورة أو مستند PDF)
                    </strong>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                      ارفع صورة صفحة من الكتاب، أو تمارين مصورة، أو ملف PDF لأسئلة أو ورقة عمل، وسيقوم الذكاء الاصطناعي بتحليله وتوليد الأسئلة النموذجية بناءً عليه فوراً!
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="file"
                    id="worksheet-attachment-input"
                    accept=".pdf, .png, .jpg, .jpeg, .webp, application/pdf, image/*"
                    style={{ display: 'none' }}
                    onChange={handleAttachmentFileSelect}
                    disabled={isProcessingAttachment || isGenerating}
                  />
                  <label
                    htmlFor="worksheet-attachment-input"
                    style={{
                      background: '#7c3aed',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: isProcessingAttachment ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)'
                    }}
                  >
                    {isProcessingAttachment ? (
                      <>
                        <Loader size={15} className="spin" />
                        <span>جاري معالجة الملف...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        <span>{attachmentName ? 'تغيير المرفق' : 'اختيار صورة أو ملف PDF'}</span>
                      </>
                    )}
                  </label>
                  {attachmentName && (
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#ef4444',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                      title="إزالة المرفق"
                    >
                      إلغاء المرفق
                    </button>
                  )}
                </div>
              </div>

              {/* Attachment File Preview & Options */}
              {attachmentName && (
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {attachmentType === 'image' && attachmentDataUrl ? (
                        <img
                          src={attachmentDataUrl}
                          alt="المرفق"
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      ) : (
                        <div style={{ width: '48px', height: '48px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' }}>
                          PDF
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>
                          {attachmentName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {attachmentType === 'pdf' ? '📄 مستند PDF معتمد للقراءة واستخراج الأسئلة' : '🖼️ صورة توضيحية معتمدة للرسم والأسئلة'}
                          {extractedPdfText && ` • تم استخراج (${extractedPdfText.length}) حرفاً`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateFromAttachment}
                      disabled={isGenerating || isProcessingAttachment}
                      style={{
                        padding: '10px 22px',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 3px 10px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {isGenerating ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
                      {isGenerating ? 'جاري التحليل والتوليد...' : '✨ توليد ورقة العمل من المرفق الآن'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input-field"
                      style={{ marginBottom: 0, fontSize: '12px', flex: 1 }}
                      value={attachmentNotes}
                      onChange={(e) => setAttachmentNotes(e.target.value)}
                      placeholder="ملاحظات أو تركيز إضافي (اختياري: مثلاً: ركز على أسئلة الوحدة الثانية أو تمارين ص ٤٥)"
                    />
                  </div>
                </div>
              )}

              {attachmentNotice && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle2 size={16} />
                  <span>{attachmentNotice}</span>
                </div>
              )}
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
                    onClick={() => handleSetSymbolLanguage('ar')}
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
                    onClick={() => handleSetSymbolLanguage('en')}
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

                <button
                  type="button"
                  onClick={convertAllQuestionsToArabicNumerals}
                  style={{
                    width: '100%',
                    marginTop: '6px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #99f6e4',
                    background: '#ccfbf1',
                    color: '#0f766e',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  title="تحويل وتنسيق جميع أرقام الأسئلة الحالية والخيارات إلى الأرقام العربية (١، ٢، ٣)"
                >
                  <Sparkles size={13} />
                  <span>🇸🇦 كتابة الأرقام بالصيغة العربية (١، ٢، ٣)</span>
                </button>
              </div>

              {/* Show / Hide Objectives Option */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
                  عرض أهداف الدرس للطالب
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowObjectives(false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: !showObjectives ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: !showObjectives ? '#f0fdfa' : 'white',
                      color: !showObjectives ? '#0e7490' : '#475569'
                    }}
                    title="إخفاء الأهداف تماماً عن الطالب لعدم تشتيته أو كشف الإجابات"
                  >
                    🔒 إخفاء الأهداف (افتراضي)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowObjectives(true)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: showObjectives ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: showObjectives ? '#faf5ff' : 'white',
                      color: showObjectives ? '#7c3aed' : '#475569'
                    }}
                    title="إظهار الأهداف التعليمية كبطاقة إرشادية أعلى ورقة العمل"
                  >
                    👁️ إظهار الأهداف
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
        <div id="printable-worksheet-content" style={{ padding: '16px 20px', flex: 1 }}>
          
          {/* Official Ministry & School Printable Header (Ultra Compact) */}
          <div style={{
            borderBottom: '2px solid #0e7490',
            paddingBottom: '6px',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center',
            gap: '10px'
          }}>
            {/* Right: Kingdom & Ministry Hierarchy */}
            <div style={{ textAlign: 'right', fontSize: '10.5px', color: '#1e293b', lineHeight: '1.35', flex: '1 1 0' }}>
              <div style={{ fontWeight: 'bold' }}>المملكة العربية السعودية</div>
              <div>وزارة التعليم • إدارة التعليم</div>
              <div style={{ fontWeight: 'bold', color: '#0e7490', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userData?.schoolName || prepData?.schoolName || existingWorksheet?.schoolName || 'المدارس المتقدمة الذكية'}
              </div>
            </div>

            {/* Center: Compact Official Ministry Logo & School Logo + Title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1.8 1 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '3px' }}>
                <img
                  src={`${import.meta.env.BASE_URL}minst.svg`}
                  alt="وزارة التعليم"
                  style={{
                    height: '36px',
                    width: 'auto',
                    maxWidth: '75px',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                  }}
                />
                <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }}></div>
                <img
                  src={userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`}
                  alt="شعار المدرسة"
                  style={{
                    height: '32px',
                    width: 'auto',
                    maxWidth: '65px',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                  }}
                />
              </div>

              <div style={{
                display: 'inline-block',
                border: '1.5px solid #0e7490',
                padding: '2px 14px',
                borderRadius: '6px',
                background: '#f0fdfa',
                color: '#0e7490',
                fontWeight: '900',
                fontSize: '13px',
                lineHeight: '1.2',
                marginBottom: '2px'
              }}>
                ورقة عمل تقويمية: {lessonTitle}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.2' }}>
                مادة: {subject} • {className || stage} • {semester}
              </div>
            </div>

            {/* Left: Metadata & Grade */}
            <div style={{ textAlign: 'left', fontSize: '10.5px', color: '#1e293b', lineHeight: '1.35', flex: '1 1 0' }}>
              <div>معلم المادة: <strong>{effectiveTeacherName}</strong></div>
              {showTime && (
                <div>الزمن المقترح: <strong>{formatNumberBySymbol(estimatedMinutes, symbolLanguage)}</strong></div>
              )}
              <div>الدرجة الكلية: <strong>[ {formatNumberBySymbol(totalMarks, symbolLanguage)} {totalMarks === 1 ? 'درجة' : 'درجات'} ]</strong></div>
              <div style={{ color: '#64748b' }}>
                {prepData?.date || existingWorksheet?.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]} • 1447 / 1448 هـ
              </div>
            </div>
          </div>

          {/* Student Info Box (For Student Print / Solve - Ultra Compact) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '4px 10px',
            marginBottom: '8px',
            fontSize: '11px',
            alignItems: 'center'
          }}>
            <div><strong>اسم الطالب:</strong> {effectiveStudentName || '....................................'}</div>
            <div><strong>الصف / الفصل:</strong> {effectiveClassName || '....................'}</div>
            <div><strong>الرقم الأكاديمي:</strong> {effectiveStudentNid || '....................'}</div>
            <div style={{ textAlign: 'left', fontWeight: 'bold', color: '#0e7490' }}>
              <strong>الدرجة:</strong> [ {studentSubmitted ? `${formatNumberBySymbol(submissionScore, symbolLanguage)} / ${formatNumberBySymbol(totalMarks, symbolLanguage)}` : `...... / ${formatNumberBySymbol(totalMarks, symbolLanguage)}`} ]
            </div>
          </div>

          {/* Attached Source Material Banner (When generated from Attachment) */}
          {worksheetAttachment && (
            <div className="worksheet-attachment-banner" style={{
              background: '#f0fdfa',
              border: '1px solid #99f6e4',
              borderRadius: '6px',
              padding: '6px 12px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              fontSize: '11.5px',
              pageBreakInside: 'avoid'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <span style={{ fontSize: '15px' }}>{worksheetAttachment.type === 'pdf' ? '📑' : '🖼️'}</span>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#0e7490' }}>
                    {worksheetAttachment.type === 'pdf' ? 'المستند المرجعي (PDF): ' : 'الصورة المرفقة المعتمدة: '}
                  </span>
                  <span>{worksheetAttachment.name || 'مرفق ورقة العمل'}</span>
                  {worksheetAttachment.notes && (
                    <span style={{ color: '#64748b', marginRight: '6px' }}>({worksheetAttachment.notes})</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="no-print"
                onClick={() => setShowAttachmentModal(true)}
                style={{
                  background: '#0e7490',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title="معاينة المرفق المعتمد لورقة العمل"
              >
                <Eye size={13} />
                <span>معاينة المرفق</span>
              </button>
            </div>
          )}

          {/* Submission Celebration Banner */}
          {studentSubmitted && (
            <div className="no-print" style={{
              background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
              border: '1.5px solid #10b981',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🎉</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#065f46' }}>
                    تم تسليم إجابات ورقة العمل واعتماد درجتك بنجاح!
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857' }}>
                    {timerEnded ? 'انتهى الوقت المحدد للمؤقت وتم الاعتماد التلقائي.' : 'تم إنهاء الحل وتسليمه للمعلم.'} {showAnswers ? 'تم فتح دليل التصحيح والتعليل لمراجعة أدائك ذاتياً.' : 'تم حفظ وتسليم إجاباتك بنجاح بانتظار مراجعة المعلم.'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ background: 'white', border: '1px solid #10b981', borderRadius: '6px', padding: '4px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>الدرجة المحققة</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669' }}>{formatNumberBySymbol(submissionScore, symbolLanguage)} / {formatNumberBySymbol(totalMarks, symbolLanguage)}</div>
                </div>
                <div style={{ background: 'white', border: '1px solid #10b981', borderRadius: '6px', padding: '4px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>النسبة</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: submissionPercentage >= 70 ? '#059669' : '#d97706' }}>{formatNumberBySymbol(submissionPercentage, symbolLanguage)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions Box (Compact) */}
          <div style={{
            background: '#fffdf5',
            border: '1px solid #fef3c7',
            padding: '3px 8px',
            borderRadius: '4px',
            marginBottom: '8px',
            fontSize: '10.5px',
            color: '#92400e',
            lineHeight: '1.35'
          }}>
            <strong>📌 توجيهات:</strong> {instructions.join(' • ')}
          </div>

          {/* Target Objectives Box (Visible ONLY if teacher explicitly enables showObjectives - Compact) */}
          {showObjectives && effectiveObjectives.length > 0 && (
            <div style={{
              background: '#f0fdfa',
              border: '1px solid #99f6e4',
              padding: '4px 10px',
              borderRadius: '6px',
              marginBottom: '8px',
              fontSize: '10.5px',
              color: '#0f766e',
              pageBreakInside: 'avoid'
            }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                🎯 الأهداف المستهدفة:
              </strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {effectiveObjectives.map((obj, i) => (
                  <span key={i} style={{ background: '#ccfbf1', border: '1px solid #5eead4', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', color: '#115e59', fontWeight: 500 }}>
                    • {obj}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Questions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {questions.map((q, idx) => {
              const qNum = formatNumberBySymbol(idx + 1, symbolLanguage);
              const pts = formatNumberBySymbol(q.points, symbolLanguage);

              return (
                <div 
                  key={q.id || idx}
                  className="worksheet-question-card"
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    position: 'relative',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid'
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
                          <div style={{ marginBottom: '8px' }}>
                            <MarkdownInput
                              label={`نص السؤال ${qNum} (رأس السؤال)`}
                              value={q.question || q.text || ''}
                              onChange={(val) => {
                                updateQuestion(idx, 'question', val);
                                updateQuestion(idx, 'text', val);
                              }}
                              placeholder="اكتب نص السؤال هنا (يدعم LaTeX والمعادلات وصيغ الكيمياء ولصق صور مباشرة من الحافظة Ctrl+V)..."
                              height="140px"
                            />
                          </div>
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
                          className="no-print"
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

                      {/* Target Objective Badge (Visible if teacher enabled showObjectives, or in teacher view) */}
                      {(showObjectives || activeTab === 'teacher') && q.targetObjective && (
                        <span style={{
                          background: '#f0fdfa',
                          color: '#0e7490',
                          border: '1.5px solid #99f6e4',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }} title="الهدف التعليمي المستهدف لهذا السؤال">
                          🎯 {q.targetObjective}
                        </span>
                      )}

                      {canEdit && activeTab === 'studio' && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="no-print"
                            onClick={() => duplicateQuestion(idx)}
                            style={{
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              color: '#0369a1',
                              cursor: 'pointer',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                            title="نسخ وتكرار هذا السؤال"
                          >
                            <Copy size={13} />
                            <span>نسخ السؤال</span>
                          </button>
                          <button
                            type="button"
                            className="no-print"
                            onClick={() => removeQuestion(idx)}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', padding: '5px 8px', borderRadius: '6px' }}
                            title="حذف هذا السؤال"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
                      {canEdit && activeTab === 'studio' ? (
                        <div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: q.options?.length <= 4 ? `repeat(${q.options?.length || 4}, minmax(0, 1fr))` : 'repeat(4, minmax(0, 1fr))',
                            gap: '12px',
                            marginTop: '12px'
                          }}>
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = q.correctOption === oIdx;
                              const defaultOptLetter = symbolLanguage === 'ar'
                                ? ['( أ )', '( ب )', '( جـ )', '( د )', '( هـ )', '( و )'][oIdx] || `( ${oIdx + 1} )`
                                : `( ${String.fromCharCode(65 + oIdx)} )`;

                              return (
                                <div 
                                  key={oIdx} 
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : '#f8fafc',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: isCorrect ? '2px solid #10b981' : '1.5px solid #cbd5e1',
                                    boxShadow: isCorrect ? '0 2px 8px rgba(16, 185, 129, 0.12)' : 'none',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: isCorrect ? '#059669' : '#0f172a',
                                      color: '#ffffff',
                                      fontWeight: '800',
                                      fontSize: '13px',
                                      padding: '3px 12px',
                                      borderRadius: '6px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                      {defaultOptLetter}
                                    </span>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        margin: 0,
                                        cursor: 'pointer',
                                        color: isCorrect ? '#059669' : '#475569',
                                        fontWeight: 'bold',
                                        fontSize: '12px'
                                      }}>
                                        <input
                                          type="radio"
                                          name={`correct_opt_${idx}`}
                                          checked={isCorrect}
                                          onChange={() => {
                                            updateQuestion(idx, 'correctOption', oIdx);
                                            updateQuestion(idx, 'correctAnswer', opt);
                                          }}
                                          style={{ accentColor: '#10b981', cursor: 'pointer', width: '15px', height: '15px' }}
                                        />
                                        {isCorrect ? '✓ الإجابة الصحيحة' : 'تحديد كإجابة صحيحة'}
                                      </label>

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
                                          <X size={15} />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <MarkdownInput
                                    label=""
                                    value={opt}
                                    onChange={(val) => {
                                      updateOption(idx, oIdx, val);
                                      if (isCorrect) updateQuestion(idx, 'correctAnswer', val);
                                    }}
                                    placeholder={`نص أو صورة المشتت ${defaultOptLetter} (الصق صورة من الحافظة مباشرة Ctrl+V)...`}
                                    height="95px"
                                    compact
                                  />
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ marginTop: '12px' }}>
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
                                background: '#f0fdfa',
                                border: '1.5px dashed #0e7490',
                                borderRadius: '6px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                color: '#0e7490',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Plus size={14} /> إضافة خيار / مشتت جديد للسؤال
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: q.options?.length <= 4 ? `repeat(${q.options?.length || 4}, minmax(0, 1fr))` : 'repeat(4, minmax(0, 1fr))',
                          gap: '10px'
                        }}>
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = q.correctOption === oIdx;
                            const showAsCorrect = ((activeTab === 'teacher' && isCorrect) || (studentSubmitted && isCorrect)) && showAnswers;
                            const isSelectedByStudent = studentAnswers[idx] === oIdx;
                            const isStudentWrong = studentSubmitted && isSelectedByStudent && !isCorrect && showAnswers;

                            let cardBorder = '1px solid #e2e8f0';
                            let cardBg = '#f8fafc';
                            let textColor = '#334155';

                            if (showAsCorrect) {
                              cardBorder = '2px solid #10b981';
                              cardBg = '#ecfdf5';
                              textColor = '#065f46';
                            } else if (isStudentWrong) {
                              cardBorder = '2px solid #ef4444';
                              cardBg = '#fef2f2';
                              textColor = '#991b1b';
                            } else if (isSelectedByStudent && !studentSubmitted) {
                              cardBorder = '2px solid #0e7490';
                              cardBg = '#f0fdfa';
                              textColor = '#0e7490';
                            }

                            return (
                              <div 
                                key={oIdx}
                                className="worksheet-option-card"
                                onClick={() => {
                                  if (activeTab === 'student' && !studentSubmitted) {
                                    setStudentAnswers(prev => ({ ...prev, [idx]: oIdx }));
                                  }
                                }}
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  border: cardBorder,
                                  background: cardBg,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  fontSize: '13px',
                                  cursor: (activeTab === 'student' && !studentSubmitted) ? 'pointer' : 'default',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    border: (isSelectedByStudent || showAsCorrect)
                                      ? `5px solid ${showAsCorrect ? '#10b981' : (isStudentWrong ? '#ef4444' : '#0e7490')}`
                                      : '1.5px solid #94a3b8',
                                    display: 'inline-block',
                                    flexShrink: 0
                                  }} />
                                  <span style={{ fontWeight: (showAsCorrect || isSelectedByStudent) ? 'bold' : 'normal', color: textColor }}>
                                    <MarkdownViewer content={opt} inline />
                                  </span>
                                </div>

                                {studentSubmitted && showAnswers && (
                                  <div style={{ flexShrink: 0 }}>
                                    {isCorrect && (
                                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px' }}>
                                        ✓ الإجابة النموذجية
                                      </span>
                                    )}
                                    {isStudentWrong && (
                                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '6px' }}>
                                        ✗ اختيارك
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. True / False */}
                  {q.type === 'true_false' && (
                    <div style={{ display: 'flex', gap: '20px', marginRight: '34px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {['صح (True)', 'خطأ (False)'].map((choice, cIdx) => {
                        const isCorrect = q.correctOption === cIdx;
                        const showAsCorrect = ((activeTab === 'teacher' && isCorrect) || (studentSubmitted && isCorrect)) && showAnswers;
                        const isSelectedByStudent = studentAnswers[idx] === cIdx;
                        const isStudentWrong = studentSubmitted && isSelectedByStudent && !isCorrect && showAnswers;

                        let bdr = '1px solid #cbd5e1';
                        let bg = '#f8fafc';
                        let clr = '#334155';

                        if (showAsCorrect) {
                          bdr = '2px solid #10b981';
                          bg = '#ecfdf5';
                          clr = '#065f46';
                        } else if (isStudentWrong) {
                          bdr = '2px solid #ef4444';
                          bg = '#fef2f2';
                          clr = '#991b1b';
                        } else if (isSelectedByStudent && !studentSubmitted) {
                          bdr = '2px solid #0e7490';
                          bg = '#f0fdfa';
                          clr = '#0e7490';
                        }

                        return (
                          <div 
                            key={cIdx}
                            onClick={() => {
                              if (activeTab === 'student' && !studentSubmitted) {
                                setStudentAnswers(prev => ({ ...prev, [idx]: cIdx }));
                              }
                            }}
                            style={{
                              padding: '8px 20px',
                              borderRadius: '8px',
                              border: bdr,
                              background: bg,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontWeight: (showAsCorrect || isSelectedByStudent) ? 'bold' : '500',
                              color: clr,
                              fontSize: '13px',
                              cursor: (activeTab === 'student' && !studentSubmitted) ? 'pointer' : 'default',
                              transition: 'all 0.15s ease'
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
                                {isSelectedByStudent || showAsCorrect ? (
                                  <CheckSquare size={16} color={showAsCorrect ? '#10b981' : (isStudentWrong ? '#ef4444' : '#0e7490')} />
                                ) : (
                                  <Square size={16} color="#94a3b8" />
                                )}
                                <span>{choice}</span>
                                {studentSubmitted && showAnswers && isCorrect && (
                                  <span style={{ fontSize: '11px', color: '#059669', marginRight: '6px', fontWeight: 'bold' }}>✓ الصحيحة</span>
                                )}
                                {studentSubmitted && showAnswers && isStudentWrong && (
                                  <span style={{ fontSize: '11px', color: '#dc2626', marginRight: '6px', fontWeight: 'bold' }}>✗ اختيارك</span>
                                )}
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
                        <div>
                          {!studentSubmitted && (
                            <QuickLatexToolbar
                              compact
                              title="رموز ومعادلات سريعة للإجابة:"
                              onInsert={(code) => {
                                setStudentAnswers(prev => ({
                                  ...prev,
                                  [idx]: (prev[idx] || '') + (prev[idx] ? ' ' : '') + code
                                }));
                              }}
                              showFullToggle={false}
                            />
                          )}
                          <input
                            type="text"
                            value={studentAnswers[idx] || ''}
                            onChange={(e) => setStudentAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                            disabled={studentSubmitted}
                            placeholder="✍️ اكتب إجابتك أو المعادلة أو المصطلح المناسب هنا..."
                            style={{
                              width: '100%',
                              maxWidth: '460px',
                              border: studentSubmitted
                                ? (studentAnswers[idx]?.trim() ? '2px solid #10b981' : '2px solid #cbd5e1')
                                : '2px solid #0e7490',
                              borderRadius: '8px',
                              padding: '8px 14px',
                              fontSize: '13px',
                              outline: 'none',
                              background: studentSubmitted ? '#f8fafc' : '#ffffff'
                            }}
                          />
                          {studentAnswers[idx] && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#0e7490', background: '#f0fdfa', padding: '3px 8px', borderRadius: '4px', border: '1px dashed #99f6e4', display: 'inline-block' }}>
                              <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 'bold', display: 'inline-block', marginInlineEnd: '6px' }}>معاينة إجابتك:</span>
                              <MarkdownViewer content={studentAnswers[idx]} inline />
                            </div>
                          )}
                          {studentSubmitted && showAnswers && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', background: '#ecfdf5', padding: '6px 12px', borderRadius: '6px', display: 'inline-block' }}>
                              💡 <strong>الإجابة النموذجية المقررة:</strong> <MarkdownViewer content={q.correctAnswer} inline />
                            </div>
                          )}
                        </div>
                      )}
                      {canEdit && activeTab === 'studio' && (
                        <div style={{ marginTop: '8px', maxWidth: '600px' }}>
                          <MarkdownInput
                            label="الإجابة الصحيحة المقررة للفراغ"
                            value={q.correctAnswer || ''}
                            onChange={(val) => updateQuestion(idx, 'correctAnswer', val)}
                            placeholder="المصطلح أو المعادلة أو الصق صورة من الحافظة مباشرة Ctrl+V..."
                            height="85px"
                            compact
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Problem Solving / Essay */}
                  {q.type === 'problem_solving' && (
                    <div style={{ marginRight: '34px', marginTop: '12px' }}>
                      {activeTab === 'student' && (
                        <div>
                          {!studentSubmitted && (
                            <QuickLatexToolbar
                              compact
                              title="معادلات ورموز الحل الرياضي:"
                              onInsert={(code) => {
                                setStudentAnswers(prev => ({
                                  ...prev,
                                  [idx]: (prev[idx] || '') + (prev[idx] ? ' ' : '') + code
                                }));
                              }}
                              showFullToggle={false}
                            />
                          )}
                          <textarea
                            rows={3}
                            value={studentAnswers[idx] || ''}
                            onChange={(e) => setStudentAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                            disabled={studentSubmitted}
                            placeholder="✍️ اكتب خطوات الحل والنتائج والقوانين بالتفصيل هنا..."
                            style={{
                              width: '100%',
                              maxWidth: '650px',
                              border: '2px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              fontSize: '13px',
                              outline: 'none',
                              resize: 'vertical',
                              background: studentSubmitted ? '#f8fafc' : '#ffffff'
                            }}
                          />
                          {studentAnswers[idx] && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#0e7490', background: '#f0fdfa', padding: '4px 10px', borderRadius: '4px', border: '1px dashed #99f6e4', display: 'inline-block' }}>
                              <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 'bold', display: 'inline-block', marginInlineEnd: '6px' }}>معاينة حلك:</span>
                              <MarkdownViewer content={studentAnswers[idx]} />
                            </div>
                          )}
                          {studentSubmitted && showAnswers && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', background: '#ecfdf5', padding: '8px 12px', borderRadius: '6px' }}>
                              💡 <strong>خطوات ودليل الحل النموذجي:</strong>
                              <div style={{ marginTop: '4px' }}>
                                <MarkdownViewer content={q.correctAnswer} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {canEdit && activeTab === 'studio' && (
                        <div style={{ marginTop: '8px' }}>
                          <MarkdownInput
                            label="دليل وخطوات الحل النموذجي"
                            value={q.correctAnswer || ''}
                            onChange={(val) => updateQuestion(idx, 'correctAnswer', val)}
                            placeholder="اكتب خطوات الحل النموذجي المفصل (يدعم LaTeX وصيغ المعادلات ولصق صور الحل من الحافظة Ctrl+V)..."
                            height="130px"
                            compact
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

                            // Check teacher match key
                            let matchKey = null;
                            if (itemA && q.correctAnswer) {
                              matchKey = getMatchingCorrectAnswer(q.correctAnswer, itemA.num);
                            }
                            const studentAnsVal = studentAnswers[idx]?.[itemA.num];
                            const isMatchCorrect = studentSubmitted && matchKey && studentAnsVal && normalizeAnswerKey(studentAnsVal) === normalizeAnswerKey(matchKey);

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
                                      {/* Student answer dropdown / bracket */}
                                      {activeTab === 'student' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <select
                                            value={studentAnsVal || ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setStudentAnswers(prev => ({
                                                ...prev,
                                                [idx]: {
                                                  ...(prev[idx] || {}),
                                                  [itemA.num]: val
                                                }
                                              }));
                                            }}
                                            disabled={studentSubmitted}
                                            style={{
                                              height: '28px',
                                              padding: '0 6px',
                                              borderRadius: '6px',
                                              border: (studentSubmitted && showAnswers)
                                                ? (isMatchCorrect ? '2px solid #10b981' : '2px solid #ef4444')
                                                : (studentSubmitted ? '1.5px solid #cbd5e1' : '1.5px solid #0e7490'),
                                              background: (studentSubmitted && showAnswers)
                                                ? (isMatchCorrect ? '#ecfdf5' : '#fef2f2')
                                                : (studentSubmitted ? '#f8fafc' : 'white'),
                                              fontWeight: 'bold',
                                              fontSize: '12px',
                                              color: '#0e7490',
                                              cursor: studentSubmitted ? 'default' : 'pointer'
                                            }}
                                          >
                                            <option value="">( اختر )</option>
                                            {q.columnB.map(b => (
                                              <option key={b.label} value={b.label}>
                                                ({b.label})
                                              </option>
                                            ))}
                                          </select>
                                          {studentSubmitted && matchKey && showAnswers && (
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: 'bold',
                                              color: isMatchCorrect ? '#059669' : '#dc2626'
                                            }}>
                                              {isMatchCorrect ? '✓ صحيح' : `✗ (الصحيح: ${matchKey})`}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          minWidth: '40px',
                                          height: '24px',
                                          padding: '0 4px',
                                          border: (activeTab === 'teacher' && showAnswers && matchKey) ? '1.5px solid #10b981' : '1.5px solid #94a3b8',
                                          borderRadius: '6px',
                                          background: (activeTab === 'teacher' && showAnswers && matchKey) ? '#ecfdf5' : '#ffffff',
                                          fontWeight: 'bold',
                                          fontSize: '12px',
                                          color: (activeTab === 'teacher' && showAnswers && matchKey) ? '#059669' : '#64748b',
                                          flexShrink: 0
                                        }}>
                                          (&nbsp;{(showAnswers && matchKey) ? matchKey : <span style={{ display: 'inline-block', width: '16px' }} />}&nbsp;)
                                        </span>
                                      )}

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
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                              type="text"
                                              value={itemA.text}
                                              onChange={(e) => updateMatchingItem(idx, 'columnA', rIdx, e.target.value)}
                                              onPaste={(e) => handleMatchingPasteImage(idx, 'columnA', rIdx, e)}
                                              style={{
                                                flex: 1,
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                fontSize: '13px'
                                              }}
                                              placeholder="نص أو صورة المفاهيم (أ) (يدعم لصق صور من الحافظة Ctrl+V)..."
                                            />
                                            <label
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#f1f5f9',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                margin: 0,
                                                color: '#334155'
                                              }}
                                              title="إدراج صورة أو الصق من الحافظة Ctrl+V"
                                            >
                                              <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                  handleMatchingFileUpload(idx, 'columnA', rIdx, e.target.files?.[0]);
                                                  e.target.value = null;
                                                }}
                                              />
                                              <ImageIcon size={12} />
                                              <span style={{ fontSize: '10px' }}>صورة</span>
                                            </label>
                                          </div>
                                          <QuickLatexToolbar
                                            compact
                                            title="معادلات:"
                                            onInsert={(code) => updateMatchingItem(idx, 'columnA', rIdx, (itemA.text || '') + (itemA.text ? ' ' : '') + code)}
                                            showFullToggle={true}
                                            isFullOpen={activeMatchingLatex === `q${idx}_colA_${rIdx}`}
                                            onToggleFull={() => setActiveMatchingLatex(activeMatchingLatex === `q${idx}_colA_${rIdx}` ? null : `q${idx}_colA_${rIdx}`)}
                                          />
                                          {activeMatchingLatex === `q${idx}_colA_${rIdx}` && (
                                            <LatexMathToolbar
                                              compact
                                              onInsert={(code) => updateMatchingItem(idx, 'columnA', rIdx, (itemA.text || '') + (itemA.text ? ' ' : '') + code)}
                                            />
                                          )}
                                          {itemA.text && (
                                            <div style={{ fontSize: '11px', color: '#0e7490' }}>
                                              <MarkdownViewer content={itemA.text} inline />
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ color: '#1e293b', fontSize: '13px', lineHeight: '1.5' }}>
                                          <MarkdownViewer content={itemA.text} inline />
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
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                              type="text"
                                              value={itemB.text}
                                              onChange={(e) => updateMatchingItem(idx, 'columnB', rIdx, e.target.value)}
                                              onPaste={(e) => handleMatchingPasteImage(idx, 'columnB', rIdx, e)}
                                              style={{
                                                flex: 1,
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                fontSize: '13px'
                                              }}
                                              placeholder="نص أو صورة التعريفات (ب) (يدعم لصق صور من الحافظة Ctrl+V)..."
                                            />
                                            <label
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                background: '#f1f5f9',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                margin: 0,
                                                color: '#334155'
                                              }}
                                              title="إدراج صورة أو الصق من الحافظة Ctrl+V"
                                            >
                                              <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                  handleMatchingFileUpload(idx, 'columnB', rIdx, e.target.files?.[0]);
                                                  e.target.value = null;
                                                }}
                                              />
                                              <ImageIcon size={12} />
                                              <span style={{ fontSize: '10px' }}>صورة</span>
                                            </label>
                                          </div>
                                          <QuickLatexToolbar
                                            compact
                                            title="معادلات:"
                                            onInsert={(code) => updateMatchingItem(idx, 'columnB', rIdx, (itemB.text || '') + (itemB.text ? ' ' : '') + code)}
                                            showFullToggle={true}
                                            isFullOpen={activeMatchingLatex === `q${idx}_colB_${rIdx}`}
                                            onToggleFull={() => setActiveMatchingLatex(activeMatchingLatex === `q${idx}_colB_${rIdx}` ? null : `q${idx}_colB_${rIdx}`)}
                                          />
                                          {activeMatchingLatex === `q${idx}_colB_${rIdx}` && (
                                            <LatexMathToolbar
                                              compact
                                              onInsert={(code) => updateMatchingItem(idx, 'columnB', rIdx, (itemB.text || '') + (itemB.text ? ' ' : '') + code)}
                                            />
                                          )}
                                          {itemB.text && (
                                            <div style={{ fontSize: '11px', color: '#0e7490' }}>
                                              <MarkdownViewer content={itemB.text} inline />
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{ color: '#1e293b', fontSize: '13px', lineHeight: '1.5' }}>
                                          <MarkdownViewer content={itemB.text} inline />
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

                  {/* Model Answer & Pedagogical Explanation Box (Visible in Teacher / Admin view, and revealed to Student after submission if showAnswers is true) */}
                  {((activeTab === 'teacher' && showAnswers) || (studentSubmitted && showAnswers)) && (
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
                      <div style={{ color: '#14532d', lineHeight: '1.6' }}>
                        <MarkdownViewer content={q.correctAnswer} />
                      </div>
                      {q.explanation && (
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '6px', fontStyle: 'italic' }}>
                          💡 <strong>التعليل والتفسير التربوي:</strong> <MarkdownViewer content={q.explanation} inline />
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
                          <QuickLatexToolbar
                            compact
                            title="رموز وأسهم المزاوجة:"
                            onInsert={(code) => updateQuestion(idx, 'correctAnswer', (q.correctAnswer || '') + (q.correctAnswer ? ' ' : '') + code)}
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
                        <QuickLatexToolbar
                          compact
                          title="معادلات التعليل:"
                          onInsert={(code) => updateQuestion(idx, 'explanation', (q.explanation || '') + (q.explanation ? ' ' : '') + code)}
                        />
                      </div>
                    </div>
                  )}

                </div>
              );
            })}

            {/* Add Question Button in Studio Mode */}
            {canEdit && activeTab === 'studio' && (
              <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
                    <MarkdownInput
                      label="نص سؤال التحدي والتفكير الإبداعي"
                      value={bonusQuestion.question || ''}
                      onChange={(val) => setBonusQuestion(prev => ({ ...prev, question: val }))}
                      placeholder="اكتب نص سؤال التحدي (يدعم LaTeX وصيغ المعادلات ولصق صور من الحافظة Ctrl+V)..."
                      height="120px"
                    />
                  </div>
                ) : (
                  <div style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#78350f', lineHeight: '1.6' }}>
                    <MarkdownViewer content={bonusQuestion.question} />
                  </div>
                )}

                {activeTab === 'student' ? (
                  <div>
                    <div className="no-print" style={{ marginBottom: '6px' }}>
                      <QuickLatexToolbar
                        compact
                        title="أدوات كتابة الرموز والمعادلات لإجابتك:"
                        onInsert={(code) => setStudentAnswers(prev => ({ ...prev, bonus: (prev.bonus || '') + (prev.bonus ? ' ' : '') + code }))}
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={studentAnswers['bonus'] || ''}
                      onChange={(e) => setStudentAnswers(prev => ({ ...prev, bonus: e.target.value }))}
                      disabled={studentSubmitted}
                      placeholder="✍️ اكتب فكرتك أو إجابتك الإبداعية لسؤال التحدي هنا (يدعم المعادلات والرموز تلقائياً)..."
                      style={{
                        width: '100%',
                        border: '1.5px solid #d97706',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        outline: 'none',
                        background: 'white',
                        resize: 'vertical'
                      }}
                    />
                    {studentAnswers['bonus'] && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '6px 12px', borderRadius: '6px', border: '1px dashed #fcd34d' }}>
                        <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>معاينة إجابتك بالمعادلات:</span>
                        <MarkdownViewer content={studentAnswers['bonus']} />
                      </div>
                    )}
                    {studentSubmitted && showAnswers && bonusQuestion.modelAnswer && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: '6px' }}>
                        💡 <strong>معيار ودليل الإجابة النموذجية للتحدي:</strong> <MarkdownViewer content={bonusQuestion.modelAnswer} inline />
                      </div>
                    )}
                  </div>
                ) : canEdit && activeTab === 'studio' ? (
                  <div style={{ marginTop: '10px' }}>
                    <MarkdownInput
                      label="معيار ودليل التصحيح النموذجي للتحدي"
                      value={bonusQuestion.modelAnswer || ''}
                      onChange={(val) => setBonusQuestion(prev => ({ ...prev, modelAnswer: val }))}
                      placeholder="اكتب المعيار أو صيغة الحل النموذجية (يدعم المعادلات ولصق صور من الحافظة Ctrl+V)..."
                      height="90px"
                      compact
                    />
                  </div>
                ) : (
                  (showAnswers || (activeTab === 'teacher' && showAnswers)) && bonusQuestion.modelAnswer ? (
                    <div style={{ background: '#fefce8', border: '1px solid #fef08a', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', color: '#854d0e' }}>
                      <strong>معيار التصحيح للمعلم:</strong> <MarkdownViewer content={bonusQuestion.modelAnswer} inline />
                    </div>
                  ) : null
                )}
              </div>
            )}

          </div>

          {/* Printable Footer & Signatures */}
          <div style={{
            marginTop: '24px',
            borderTop: '2px solid #e2e8f0',
            paddingTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            color: '#475569',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}>
            <div>توقيع معلم المادة: ....................................</div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              تم إعداد ورقة العمل عبر النظام التعليمي الذكي المتكامل • باركود التحقق الرقمي متاح
            </div>
            <div>اعتماد المشرف / المدير: ....................................</div>
          </div>

        </div>

        {/* Student Bottom Solving & Submission Bar */}
        {activeTab === 'student' && !canEdit && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {showTime ? (
                <>
                  <Clock size={18} color="#0e7490" />
                  <span style={{ fontSize: '13px', color: '#475569' }}>
                    {studentSubmitted ? (
                      <strong style={{ color: '#059669' }}>✓ تم اعتماد وتسليم ورقة العمل</strong>
                    ) : (
                      <span>الوقت المتبقي: <strong style={{ color: '#0e7490', fontFamily: 'monospace' }}>{formatTime(timeRemaining)}</strong></span>
                    )}
                  </span>
                </>
              ) : (
                studentSubmitted ? (
                  <strong style={{ color: '#059669', fontSize: '13px' }}>✓ تم اعتماد وتسليم ورقة العمل</strong>
                ) : (
                  <span style={{ fontSize: '13px', color: '#64748b' }}>📝 ورقة عمل تدريبية بدون قيود زمنية</span>
                )
              )}
            </div>

            <div>
              {!studentSubmitted ? (
                <button
                  type="button"
                  onClick={() => handleStudentSubmit(false)}
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, #0e7490, #10b981)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 28px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader size={16} className="spin" /> جاري تسليم وحساب الدرجة...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> تسليم ورقة العمل واعتماد الحل 🚀
                    </>
                  )}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                      background: '#0e7490',
                      color: 'white',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Printer size={16} /> طباعة ورقة العمل مع الحل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('هل تود إعادة محاولة حل ورقة العمل مرة أخرى من البداية؟')) {
                        setStudentSubmitted(false);
                        setStudentAnswers({});
                        setSubmissionScore(null);
                        setSubmissionPercentage(null);
                        setTimeRemaining(selectedDuration * 60);
                        setTimerRunning(true);
                        setTimerEnded(false);
                      }
                    }}
                    style={{
                      background: 'white',
                      color: '#0e7490',
                      border: '1.5px solid #0e7490',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={16} /> إعادة المحاولة 🔄
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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

      {/* Attachment Preview Modal (Image or PDF extracted text) */}
      {showAttachmentModal && worksheetAttachment && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{worksheetAttachment.type === 'pdf' ? '📑' : '🖼️'}</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 'bold' }}>
                    {worksheetAttachment.name || 'المرفق المعتمد'}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {worksheetAttachment.type === 'pdf' ? 'مستند PDF تم استخراج محتواه' : 'صورة مرفقة مع ورقة العمل'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachmentModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
              {worksheetAttachment.type === 'image' && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={worksheetAttachment.dataUrl || attachmentDataUrl}
                    alt={worksheetAttachment.name || 'مرفق'}
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}
              {worksheetAttachment.type === 'pdf' && (
                <div>
                  <div style={{
                    padding: '8px 12px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#1e40af',
                    marginBottom: '12px'
                  }}>
                    💡 هذا المستند PDF تم تحليله واستخراج محتواه التعليمي لإنشاء وتوليد الأسئلة لورقة العمل.
                  </div>
                  {worksheetAttachment.textSample ? (
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      color: '#334155',
                      lineHeight: '1.7',
                      maxHeight: '50vh',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace'
                    }}>
                      {worksheetAttachment.textSample}
                    </div>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                      تم استخراج المحتوى وبناء أسئلة ورقة العمل بناءً على هذا الملف بنجاح.
                    </p>
                  )}
                </div>
              )}
              {worksheetAttachment.notes && (
                <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#475569' }}>
                  <strong>ملاحظات وتوجيهات المعلم:</strong> {worksheetAttachment.notes}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowAttachmentModal(false)}
                style={{
                  background: '#0e7490',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Print Styles for Perfect A4 Output */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .worksheet-option-card img {
          max-height: 120px !important;
          max-width: 100% !important;
          object-fit: contain !important;
          border-radius: 6px !important;
          display: inline-block !important;
        }
        .worksheet-question-card .markdown-content img {
          max-height: 280px;
          max-width: 100%;
          object-fit: contain;
          border-radius: 6px;
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
            font-size: 11pt !important;
          }
          /* Completely hide EVERYTHING under body except the worksheet modal container so NO blank pages exist! */
          body > *:not(.worksheet-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          button, .btn {
            display: none !important;
          }
          .worksheet-modal-root {
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
            z-index: auto !important;
          }
          .worksheet-modal-root .glass-panel {
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
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            display: block !important;
          }
          #printable-worksheet-content,
          #printable-worksheet-content * {
            visibility: visible !important;
          }
          #printable-worksheet-content {
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
            background: #ffffff !important;
            display: block !important;
            box-sizing: border-box !important;
          }
          #printable-worksheet-content > div {
            display: block !important;
          }
          .worksheet-question-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            margin-bottom: 8px !important;
            padding: 8px 12px !important;
            display: block !important;
            background: #ffffff !important;
          }
          .worksheet-option-card img {
            max-height: 90px !important;
            max-width: 100% !important;
            object-fit: contain !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .worksheet-question-card .markdown-content img {
            max-height: 140px !important;
            max-width: 100% !important;
            object-fit: contain !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .question-image-container img {
            max-height: 140px !important;
            max-width: 100% !important;
            object-fit: contain !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 8mm 8mm;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
