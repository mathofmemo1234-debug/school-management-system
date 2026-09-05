import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Save, 
  Clock, 
  BookOpen, 
  Users, 
  FileText, 
  BarChart2, 
  Printer, 
  PieChart, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  Award, 
  Search, 
  HelpCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Download,
  Upload,
  Check,
  RotateCcw,
  Sparkle,
  Eye,
  Wifi,
  WifiOff,
  Radio
} from 'lucide-react';
import MarkdownInput from '../components/MarkdownInput';
import MarkdownViewer from '../components/MarkdownViewer';
import { useLanguage } from '../contexts/LanguageContext';
import PrintExamModal from '../components/PrintExamModal';
import SharedQuestionBankModal from '../components/SharedQuestionBankModal';
import GamificationBadge from '../components/GamificationBadge';
import { calculateStudentActivity } from '../utils/gamificationEngine';
import { formatArabicTime } from '../utils/dateTimeUtils';

export default function TeacherExams() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [exams, setExams] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [teacherDocId, setTeacherDocId] = useState(null);
  
  // Views: 'list' | 'create' | 'edit' | 'external_exam' | 'item_analysis' | 'results_analytics' | 'live_monitoring'
  const [activeView, setActiveView] = useState('list');
  
  // Live Exam Monitoring State
  const [liveSessions, setLiveSessions] = useState({});
  const [liveClassStudents, setLiveClassStudents] = useState([]);
  const [liveFilter, setLiveFilter] = useState('all'); // 'all' | 'in_progress' | 'submitted' | 'not_entered' | 'interrupted'
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [allResultsCountMap, setAllResultsCountMap] = useState({});
  
  // Electronic Exam Form State
  const [currentExam, setCurrentExam] = useState(null);
  const [title, setTitle] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [subject, setSubject] = useState('');
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [entryDeadline, setEntryDeadline] = useState('');
  const [duration, setDuration] = useState('45');
  const [numQuestions, setNumQuestions] = useState(1);
  const [questions, setQuestions] = useState([]);
  
  // External (Paper) Exam Form & Results State
  const [maxScore, setMaxScore] = useState('20');
  const [externalStudentsList, setExternalStudentsList] = useState([]);
  const [manualScores, setManualScores] = useState({}); // { [studentId]: score }
  const [manualNotes, setManualNotes] = useState({}); // { [studentId]: note }
  const [externalEntryTab, setExternalEntryTab] = useState('manual'); // 'manual' | 'excel'
  const [excelPasteText, setExcelPasteText] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Common Results & Analytics state
  const [examResults, setExamResults] = useState([]);
  const [studentsCache, setStudentsCache] = useState({});
  const [studentActivityMap, setStudentActivityMap] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [printingExamData, setPrintingExamData] = useState(null);
  const [printingResultsData, setPrintingResultsData] = useState(null);
  
  // Results Analytics sub-tab: 'class' | 'student'
  const [analyticsTab, setAnalyticsTab] = useState('class');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [trackingStudent, setTrackingStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [inspectingStudentAnswers, setInspectingStudentAnswers] = useState(null);

  // Preset titles for quick selection
  const EXAM_PRESETS = [
    'اختبار الفترة الأولى',
    'اختبار الفترة الثانية',
    'اختبار منتصف الفصل الدراسي',
    'اختبار نهاية الفصل الدراسي',
    'اختبار فتري قصير',
    'اختبار تشخيصي قبلي',
    'اختبار بعدي / تقويمي',
    'اختبار تعزيز المهارات',
    'اختبار أعمال السنة'
  ];

  // Get teacher ID & subjects
  useEffect(() => {
    if (userData?.nationalId) {
      const q = query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId));
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          setTeacherDocId(snap.docs[0].id);
          const subjStr = snap.docs[0].data().subject || '';
          setSubjectsList(subjStr.split('،').map(s => s.trim()).filter(Boolean));
        } else if (!isNaN(userData.nationalId)) {
          const numQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)));
          getDocs(numQ).then(numSnap => {
            if (!numSnap.empty) {
              setTeacherDocId(numSnap.docs[0].id);
              const subjStr = numSnap.docs[0].data().subject || '';
              setSubjectsList(subjStr.split('،').map(s => s.trim()).filter(Boolean));
            }
          });
        }
      });
      return () => unsub();
    }
  }, [userData]);

  // Fetch classes
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';
    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsubClasses = onSnapshot(qClasses, (classesSnap) => {
      setClassesList(classesSnap.docs.map(d => d.data().name));
    });
    return () => unsubClasses();
  }, [userData?.schoolId]);

  // Fetch exams for this teacher
  useEffect(() => {
    if (!teacherDocId) return;
    const q = query(collection(db, 'exams'), where('teacherId', '==', teacherDocId));
    const unsub = onSnapshot(q, snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(`${b.examDate}T${b.startTime || '00:00'}`) - new Date(`${a.examDate}T${a.startTime || '00:00'}`));
      setExams(data);
    });
    return () => unsub();
  }, [teacherDocId]);

  // Fetch students dictionary cache
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';
    const qStudents = schoolId === 'ALL'
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('schoolId', '==', schoolId));

    getDocs(qStudents).then(snap => {
      const cache = {};
      snap.forEach(d => {
        cache[d.id] = d.data().name;
        if (d.data().nationalId) cache[d.data().nationalId] = d.data().name;
      });
      setStudentsCache(cache);
    });
  }, [userData?.schoolId]);

  // Compute student activity for exam results view
  useEffect(() => {
    if ((activeView === 'results_analytics' || activeView === 'item_analysis') && examResults.length > 0) {
      const schoolId = userData?.schoolId || 'default_school_1';
      const qA = schoolId === 'ALL' ? collection(db, 'assignment_results') : query(collection(db, 'assignment_results'), where('schoolId', '==', schoolId));
      const qE = schoolId === 'ALL' ? collection(db, 'exam_results') : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));
      const qAtt = schoolId === 'ALL' ? collection(db, 'attendance') : query(collection(db, 'attendance'), where('schoolId', '==', schoolId));

      Promise.all([getDocs(qA), getDocs(qE), getDocs(qAtt)]).then(([snapA, snapE, snapAtt]) => {
        const aList = snapA.docs.map(d => d.data());
        const eList = snapE.docs.map(d => d.data());
        const attList = snapAtt.docs.map(d => d.data());

        const map = {};
        examResults.forEach(res => {
          const sid = res.studentId;
          if (sid && !map[sid]) {
            map[sid] = calculateStudentActivity({
              studentId: sid,
              assignmentResults: aList,
              examResults: eList,
              attendanceDocs: attList
            });
          }
        });
        setStudentActivityMap(map);
      });
    }
  }, [activeView, examResults, userData?.schoolId]);

  // Live real-time submissions count for all exams
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';
    const qAllResults = schoolId === 'ALL'
      ? collection(db, 'exam_results')
      : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qAllResults, (snap) => {
      const counts = {};
      snap.forEach(d => {
        const eid = d.data().examId;
        if (eid) counts[eid] = (counts[eid] || 0) + 1;
      });
      setAllResultsCountMap(counts);
    });
    return () => unsub();
  }, [userData?.schoolId]);

  // Live real-time subscription for active exam results (instant updates on submission)
  useEffect(() => {
    if (!currentExam) return;
    if (activeView !== 'item_analysis' && activeView !== 'results_analytics' && activeView !== 'live_monitoring') return;

    const qResults = query(collection(db, 'exam_results'), where('examId', '==', currentExam.id));
    const unsubResults = onSnapshot(qResults, (snap) => {
      const results = [];
      snap.forEach(d => results.push({ id: d.id, ...d.data() }));
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
      setExamResults(results);
    });

    return () => unsubResults();
  }, [currentExam, activeView]);

  // Live real-time student sessions & class roster subscription for Live Monitoring
  useEffect(() => {
    if (!currentExam || activeView !== 'live_monitoring') return;

    const qSessions = query(collection(db, 'exam_sessions'), where('examId', '==', currentExam.id));
    const unsubSessions = onSnapshot(qSessions, (snap) => {
      const map = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.studentId) map[data.studentId] = { id: d.id, ...data };
        if (data.nationalId) map[data.nationalId] = { id: d.id, ...data };
      });
      setLiveSessions(map);
    });

    const schoolId = userData?.schoolId || 'default_school_1';
    const qStudents = schoolId === 'ALL'
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('schoolId', '==', schoolId));

    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const sList = [];
      const target = (currentExam.targetClass || '').trim();
      snap.forEach(d => {
        const data = d.data();
        const sClass = (data.class || data.className || '').trim();
        if (!target || sClass === target || sClass.includes(target) || target.includes(sClass)) {
          sList.push({ id: d.id, ...data });
        }
      });
      sList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      setLiveClassStudents(sList);
    });

    return () => {
      unsubSessions();
      unsubStudents();
    };
  }, [currentExam, activeView, userData?.schoolId]);

  // Fetch students for target class when in external exam mode
  useEffect(() => {
    if (activeView !== 'external_exam' || !targetClass) {
      setExternalStudentsList([]);
      return;
    }
    const schoolId = userData?.schoolId || 'default_school_1';
    const qStudents = schoolId === 'ALL'
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qStudents, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => (s.class || s.className || '').trim() === targetClass.trim());
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      setExternalStudentsList(list);
    });
    return () => unsub();
  }, [targetClass, activeView, userData?.schoolId]);

  // Handle Question numbers synchronization for electronic exams
  useEffect(() => {
    if (activeView === 'list' || activeView === 'item_analysis' || activeView === 'results_analytics' || activeView === 'external_exam') return;
    const count = parseInt(numQuestions) || 1;
    setQuestions(prev => {
      const newQs = [...prev];
      if (newQs.length < count) {
        for (let i = newQs.length; i < count; i++) {
          newQs.push({
            id: `q_${Date.now()}_${i}`,
            text: '',
            options: ['', '', '', ''],
            correctOption: 0
          });
        }
      } else if (newQs.length > count) {
        newQs.splice(count);
      }
      return newQs;
    });
  }, [numQuestions, activeView]);

  const calculateDefaultCutoff = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return '';
    const totalMins = parts[0] * 60 + parts[1] + 30;
    const newH = Math.floor(totalMins / 60) % 24;
    const newM = totalMins % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const resetForm = () => {
    setCurrentExam(null);
    setTitle('');
    setTargetClass(classesList[0] || '');
    setSubject(subjectsList[0] || '');
    setExamDate(new Date().toISOString().split('T')[0]);
    setStartTime('');
    setEntryDeadline('');
    setDuration('45');
    setNumQuestions(1);
    setQuestions([]);
    setMaxScore('20');
    setManualScores({});
    setManualNotes({});
    setExcelPasteText('');
    setImportNotice('');
    setActiveView('list');
    setExamResults([]);
    setTrackingStudent(null);
    setInspectingStudentAnswers(null);
  };

  // Open Electronic Exam Form
  const handleCreateElectronic = () => {
    resetForm();
    setTitle('اختبار قصير');
    setExamDate(new Date().toISOString().split('T')[0]);
    setActiveView('create');
  };

  // Open External / Paper Exam Form
  const handleCreateExternal = () => {
    resetForm();
    setTitle(EXAM_PRESETS[0]);
    setMaxScore('20');
    setExamDate(new Date().toISOString().split('T')[0]);
    setActiveView('external_exam');
  };

  const handleEdit = async (exam) => {
    setCurrentExam(exam);
    setTitle(exam.title);
    setTargetClass(exam.targetClass);
    setSubject(exam.subject);
    setExamDate(exam.examDate);
    
    if (exam.isExternal) {
      setMaxScore(String(exam.maxScore || exam.totalQuestions || 20));
      // Fetch existing results for this external exam
      const q = query(collection(db, 'exam_results'), where('examId', '==', exam.id));
      const snap = await getDocs(q);
      const scores = {};
      const notes = {};
      snap.forEach(d => {
        const data = d.data();
        scores[data.studentId] = data.score;
        if (data.note) notes[data.studentId] = data.note;
      });
      setManualScores(scores);
      setManualNotes(notes);
      setActiveView('external_exam');
    } else {
      setStartTime(exam.startTime);
      setEntryDeadline(exam.entryDeadline || calculateDefaultCutoff(exam.startTime));
      setDuration(exam.duration);
      setNumQuestions(exam.questions.length);
      setQuestions(exam.questions);
      setActiveView('edit');
    }
  };

  // 1. Open Live Student Monitoring Hub (غرفة المراقبة اللحظية للطلاب أثناء الاختبار)
  const handleOpenLiveMonitoring = (exam) => {
    setCurrentExam(exam);
    setLiveFilter('all');
    setLiveSearchQuery('');
    setActiveView('live_monitoring');
  };

  // 2. Open Item Analysis (تحليل بنود ومفردات الاختبار)
  const handleOpenItemAnalysis = (exam) => {
    setCurrentExam(exam);
    setActiveView('item_analysis');
  };

  // 3. Open Results Analytics (تحليل نتائج الاختبار على مستوى الفصل والطالب)
  const handleOpenResultsAnalytics = (exam) => {
    setCurrentExam(exam);
    setActiveView('results_analytics');
    setAnalyticsTab('class');
  };

  const handleTrackStudent = async (studentId) => {
    setTrackingStudent(studentId);
    const q = query(collection(db, 'exam_results'), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    
    const teacherExamIds = exams.map(e => e.id);
    const history = [];
    
    snap.forEach(d => {
      const data = d.data();
      if (teacherExamIds.includes(data.examId)) {
        const examDetails = exams.find(e => e.id === data.examId);
        history.push({
          ...data,
          examTitle: examDetails?.title,
          examDate: examDetails?.examDate
        });
      }
    });
    
    history.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));
    setStudentHistory(history);
  };

  const handleDelete = async (examId) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا الاختبار وكافة النتائج المسجلة له نهائياً؟')) {
      try {
        await deleteDoc(doc(db, 'exams', examId));
        // Also delete all related exam_results
        const q = query(collection(db, 'exam_results'), where('examId', '==', examId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } catch (err) {
        console.error('Error deleting exam:', err);
      }
    }
  };

  // Save Electronic Exam
  const handleSaveElectronic = async (e) => {
    e.preventDefault();
    if (!teacherDocId) return;
    
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text) {
        alert(t('teacherExams.questionEmpty').replace('{num}', i+1));
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!questions[i].options[j]) {
          alert(t('teacherExams.optionEmpty').replace('{opt}', j+1).replace('{num}', i+1));
          return;
        }
      }
    }

    setIsSaving(true);
    const finalCutoff = entryDeadline || calculateDefaultCutoff(startTime);
    const examData = {
      teacherId: teacherDocId,
      teacherName: userData?.name || 'معلم',
      teacherEmail: userData?.email || '',
      title,
      targetClass,
      subject,
      examDate,
      startTime,
      entryDeadline: finalCutoff,
      duration: parseInt(duration),
      isExternal: false,
      questions,
      schoolId: userData?.schoolId || 'default_school_1',
      schoolName: userData?.schoolName || '',
      updatedAt: serverTimestamp()
    };

    try {
      if (activeView === 'edit' && currentExam) {
        await updateDoc(doc(db, 'exams', currentExam.id), examData);
      } else {
        examData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'exams'), examData);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      alert(t('teacherExams.saveFail'));
    } finally {
      setIsSaving(false);
    }
  };

  // Save External (Paper) Exam & Results
  const handleSaveExternalExam = async (e) => {
    e.preventDefault();
    if (!teacherDocId) return alert('الرجاء التأكد من تسجيل الدخول كمعلم');
    if (!title.trim()) return alert('الرجاء كتابة أو اختيار اسم الاختبار');
    if (!targetClass) return alert('الرجاء اختيار الفصل الدراسي');
    if (!subject) return alert('الرجاء اختيار المادة');

    const totalMax = parseFloat(maxScore) || 20;
    setIsSaving(true);

    try {
      let examId = currentExam?.id;
      const schoolId = userData?.schoolId || 'default_school_1';
      const examPayload = {
        teacherId: teacherDocId,
        teacherName: userData?.name || 'معلم',
        teacherEmail: userData?.email || '',
        title: title.trim(),
        targetClass,
        subject,
        examDate: examDate || new Date().toISOString().split('T')[0],
        duration: 45,
        isExternal: true,
        type: 'paper_exam',
        maxScore: totalMax,
        totalQuestions: totalMax,
        questions: [],
        schoolId,
        schoolName: userData?.schoolName || '',
        updatedAt: serverTimestamp()
      };

      if (examId) {
        await updateDoc(doc(db, 'exams', examId), examPayload);
      } else {
        examPayload.createdAt = serverTimestamp();
        const newDoc = await addDoc(collection(db, 'exams'), examPayload);
        examId = newDoc.id;
      }

      // Save / Update Student Results in batch
      const existingResultsQuery = query(collection(db, 'exam_results'), where('examId', '==', examId));
      const existingSnap = await getDocs(existingResultsQuery);
      const existingMap = {};
      existingSnap.forEach(d => {
        existingMap[d.data().studentId] = d.id;
      });

      const batch = writeBatch(db);

      externalStudentsList.forEach(student => {
        const rawScore = manualScores[student.id];
        const hasScore = rawScore !== undefined && rawScore !== '' && rawScore !== null;
        const numScore = hasScore ? Math.min(totalMax, Math.max(0, parseFloat(rawScore))) : 0;
        const note = manualNotes[student.id] || '';

        if (hasScore) {
          const resPayload = {
            examId,
            studentId: student.id,
            studentName: student.name,
            nationalId: student.nationalId || '',
            className: targetClass,
            subject,
            examTitle: title.trim(),
            score: numScore,
            totalQuestions: totalMax,
            maxScore: totalMax,
            percentage: Math.round((numScore / totalMax) * 100),
            note,
            isExternal: true,
            schoolId,
            timestamp: serverTimestamp()
          };

          if (existingMap[student.id]) {
            batch.update(doc(db, 'exam_results', existingMap[student.id]), resPayload);
          } else {
            const newResRef = doc(collection(db, 'exam_results'));
            batch.set(newResRef, resPayload);
          }
        } else if (existingMap[student.id]) {
          // If score was cleared, remove from results
          batch.delete(doc(db, 'exam_results', existingMap[student.id]));
        }
      });

      await batch.commit();
      alert('✅ تم حفظ واعتماد نتائج الاختبار الورقي بنجاح!');
      resetForm();
    } catch (err) {
      console.error('Error saving external exam:', err);
      alert('حدث خطأ أثناء حفظ نتائج الاختبار: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk score helper tools
  const handleBulkFillFullScore = () => {
    const full = parseFloat(maxScore) || 20;
    const scores = { ...manualScores };
    externalStudentsList.forEach(s => {
      scores[s.id] = full;
    });
    setManualScores(scores);
  };

  const handleBulkClearScores = () => {
    if (window.confirm('هل تريد تصفير جميع الدرجات المدخلة؟')) {
      setManualScores({});
    }
  };

  // Download CSV / Excel Template for this class
  const handleDownloadTemplate = () => {
    if (!targetClass || externalStudentsList.length === 0) {
      alert('الرجاء اختيار الفصل الدراسي أولاً');
      return;
    }
    const headers = ['رقم الهوية', 'اسم الطالب', 'الصف', `الدرجة (من ${maxScore})`, 'ملاحظات'];
    const rows = externalStudentsList.map(s => [
      `"${s.nationalId || ''}"`,
      `"${s.name || ''}"`,
      `"${targetClass}"`,
      manualScores[s.id] !== undefined ? manualScores[s.id] : '',
      `"${manualNotes[s.id] || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `كشف_رصد_${title || 'اختبار'}_${targetClass}.csv`;
    link.click();
  };

  // Parse Text / Excel Paste or CSV
  const parseAndApplyImportData = (content) => {
    if (!content.trim()) return;
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    let matchedCount = 0;
    const newScores = { ...manualScores };
    const newNotes = { ...manualNotes };
    const totalMax = parseFloat(maxScore) || 20;

    lines.forEach(line => {
      // Split by tab or comma or semicolon
      const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length >= 2) {
        // Try to identify National ID, Name, and Grade
        let foundStudent = null;
        let scoreVal = null;
        let noteVal = '';

        parts.forEach((part, colIdx) => {
          // Check if part matches national ID
          const matchByNid = externalStudentsList.find(s => String(s.nationalId || '').trim() === part);
          if (matchByNid) foundStudent = matchByNid;

          // Check if part matches name
          const matchByName = externalStudentsList.find(s => s.name && s.name.trim().toLowerCase() === part.toLowerCase());
          if (matchByName) foundStudent = matchByName;

          // Check if numeric score
          const num = parseFloat(part);
          if (!isNaN(num) && num >= 0 && num <= totalMax * 1.5 && colIdx > 0) {
            scoreVal = Math.min(totalMax, num);
          }
        });

        if (foundStudent && scoreVal !== null) {
          newScores[foundStudent.id] = scoreVal;
          if (parts[4]) newNotes[foundStudent.id] = parts[4];
          matchedCount++;
        }
      }
    });

    setManualScores(newScores);
    setManualNotes(newNotes);
    setImportNotice(`✅ تم بنجاح مطابقة واستيراد درجات (${matchedCount}) طالب من الكشف!`);
    setTimeout(() => setImportNotice(''), 6000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      parseAndApplyImportData(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateQuestion = (index, field, value) => {
    const newQs = [...questions];
    newQs[index][field] = value;
    setQuestions(newQs);
  };

  const updateOption = (qIndex, optIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].options[optIndex] = value;
    setQuestions(newQs);
  };

  // Import questions from Central Shared Bank
  const handleImportQuestionsFromBank = (importedList) => {
    if (!importedList || importedList.length === 0) return;

    setQuestions(prev => {
      const existingMeaningful = prev.filter(q => q.text && q.text.trim());
      const combined = [...existingMeaningful, ...importedList];
      setNumQuestions(combined.length);
      return combined;
    });
  };

  // ==========================================
  // PSYCHOMETRIC & ITEM ANALYSIS CALCULATIONS
  // ==========================================
  const itemAnalysisData = useMemo(() => {
    if (!currentExam || examResults.length === 0) return null;

    const N = examResults.length;
    const K = currentExam.questions?.length || 1;
    const sortedResults = [...examResults].sort((a, b) => b.score - a.score);

    const groupSize = N >= 20 ? Math.max(1, Math.round(N * 0.27)) : Math.max(1, Math.floor(N / 2));
    const upperGroup = sortedResults.slice(0, groupSize);
    const lowerGroup = sortedResults.slice(N - groupSize);

    let sumP = 0;
    let sumPItemVariance = 0;

    const questionsAnalysis = (currentExam.questions || []).map((q, qIndex) => {
      let totalCorrect = 0;
      let upperCorrect = 0;
      let lowerCorrect = 0;
      const optionCounts = [0, 0, 0, 0];
      const upperOptionCounts = [0, 0, 0, 0];
      const lowerOptionCounts = [0, 0, 0, 0];

      examResults.forEach(res => {
        const studentAns = res.answers ? parseInt(res.answers[qIndex]) : -1;
        if (studentAns >= 0 && studentAns < 4) optionCounts[studentAns]++;
        if (studentAns === q.correctOption) totalCorrect++;
      });

      upperGroup.forEach(res => {
        const ans = res.answers ? parseInt(res.answers[qIndex]) : -1;
        if (ans >= 0 && ans < 4) upperOptionCounts[ans]++;
        if (ans === q.correctOption) upperCorrect++;
      });

      lowerGroup.forEach(res => {
        const ans = res.answers ? parseInt(res.answers[qIndex]) : -1;
        if (ans >= 0 && ans < 4) lowerOptionCounts[ans]++;
        if (ans === q.correctOption) lowerCorrect++;
      });

      const p = totalCorrect / N;
      sumP += p;
      sumPItemVariance += (p * (1 - p));
      const d = groupSize > 0 ? (upperCorrect - lowerCorrect) / groupSize : 0;

      let diffCategory = 'متوازن ومثالي';
      let diffColor = '#16a34a';
      let diffBg = '#dcfce7';
      if (p > 0.85) {
        diffCategory = 'سهل جداً';
        diffColor = '#2563eb';
        diffBg = '#dbeafe';
      } else if (p < 0.30) {
        diffCategory = 'صعب جداً';
        diffColor = '#dc2626';
        diffBg = '#fee2e2';
      }

      let discCategory = 'تمييز ممتاز (D ≥ 0.40)';
      let discColor = '#16a34a';
      let discBg = '#dcfce7';
      if (d >= 0.40) {
        discCategory = 'تمييز ممتاز (D ≥ 0.40)';
      } else if (d >= 0.30) {
        discCategory = 'تمييز جيد (0.30 - 0.39)';
        discColor = '#0284c7';
        discBg = '#e0f2fe';
      } else if (d >= 0.20) {
        discCategory = 'تمييز مقبول (0.20 - 0.29)';
        discColor = '#d97706';
        discBg = '#fef3c7';
      } else {
        discCategory = 'تمييز ضعيف / يحتاج مراجعة (D < 0.20)';
        discColor = '#dc2626';
        discBg = '#fee2e2';
      }

      const distractors = (q.options || []).map((optText, optIdx) => {
        const isCorrect = optIdx === q.correctOption;
        const count = optionCounts[optIdx];
        const pct = Math.round((count / N) * 100);
        const uCount = upperOptionCounts[optIdx];
        const lCount = lowerOptionCounts[optIdx];

        let note = '';
        if (!isCorrect) {
          if (count === 0) note = 'مشتت غير فعال (لم يختره أحد)';
          else if (uCount > lCount) note = 'مشتت جذاب مضلل (جذب المتفوقين)';
          else note = 'مشتت فعال ومناسب';
        }

        return {
          optIndex: optIdx,
          text: optText,
          isCorrect,
          count,
          pct,
          uCount,
          lCount,
          note
        };
      });

      let recommendation = 'سؤال صالح وممتاز، يُنصح بحفظه في بنك الأسئلة.';
      if (d < 0.20 && p > 0.85) {
        recommendation = 'السؤال مباشر وسهل جداً، يفضل تعميق مستوى الصعوبة لقياس مهارات تفكير أعلى.';
      } else if (d < 0.20 && p < 0.30) {
        recommendation = 'السؤال شديد الصعوبة أو غامض، يرجى مراجعة الصياغة ومناسبة البدائل.';
      } else if (d < 0.15) {
        recommendation = 'معامل التمييز منخفض، يُنصح بتنقيح المشتتات والخيارات.';
      }

      return {
        qIndex,
        question: q,
        totalCorrect,
        p,
        d,
        diffCategory,
        diffColor,
        diffBg,
        discCategory,
        discColor,
        discBg,
        distractors,
        recommendation
      };
    });

    const rawScores = examResults.map(r => r.score);
    const meanRaw = rawScores.reduce((a, b) => a + b, 0) / N;
    const varRaw = rawScores.reduce((a, b) => a + Math.pow(b - meanRaw, 2), 0) / N;
    const stdDev = Math.sqrt(varRaw);

    let kr20 = 0;
    if (K > 1 && varRaw > 0) {
      const alpha = (K / (K - 1)) * (1 - (sumPItemVariance / varRaw));
      kr20 = Math.max(0, Math.min(1, alpha));
    }
    const validity = Math.sqrt(kr20);
    const sem = stdDev * Math.sqrt(Math.max(0, 1 - kr20));
    const meanDifficulty = K > 0 ? (sumP / K) : 0;

    return {
      totalStudents: N,
      totalQuestions: K,
      meanScore: meanRaw.toFixed(1),
      stdDev: stdDev.toFixed(2),
      kr20: kr20.toFixed(2),
      validity: validity.toFixed(2),
      sem: sem.toFixed(2),
      meanDifficulty: meanDifficulty.toFixed(2),
      questionsAnalysis
    };
  }, [currentExam, examResults]);

  // ==========================================
  // RESULTS ANALYTICS (CLASS & STUDENT LEVEL)
  // ==========================================
  const resultsAnalyticsData = useMemo(() => {
    if (!currentExam || examResults.length === 0) return null;

    const total = examResults.length;
    let sumScores = 0;
    let passed = 0;
    let highest = 0;
    let lowest = 100;
    const maxPoss = currentExam.maxScore || currentExam.totalQuestions || 20;

    const bands = {
      excellent: { label: 'ممتاز (90% - 100%)', count: 0, color: '#16a34a', bg: '#dcfce7' },
      veryGood: { label: 'جيد جداً (80% - 89%)', count: 0, color: '#0284c7', bg: '#e0f2fe' },
      good: { label: 'جيد (70% - 79%)', count: 0, color: '#0d9488', bg: '#ccfbf1' },
      pass: { label: 'مقبول (60% - 69%)', count: 0, color: '#d97706', bg: '#fef3c7' },
      fail: { label: 'دون المقبول (< 60%)', count: 0, color: '#dc2626', bg: '#fee2e2' }
    };

    const studentRows = examResults.map(res => {
      const denom = res.totalQuestions || res.maxScore || maxPoss;
      const pct = Math.round((res.score / denom) * 100);
      sumScores += pct;
      if (pct >= 50) passed++;
      if (pct > highest) highest = pct;
      if (pct < lowest) lowest = pct;

      if (pct >= 90) bands.excellent.count++;
      else if (pct >= 80) bands.veryGood.count++;
      else if (pct >= 70) bands.good.count++;
      else if (pct >= 60) bands.pass.count++;
      else bands.fail.count++;

      const correctIndices = [];
      const incorrectIndices = [];
      if (currentExam.questions && currentExam.questions.length > 0) {
        currentExam.questions.forEach((q, idx) => {
          const studentPick = res.answers ? parseInt(res.answers[idx]) : -1;
          if (studentPick === q.correctOption) {
            correctIndices.push(idx + 1);
          } else {
            incorrectIndices.push(idx + 1);
          }
        });
      }

      return {
        id: res.id,
        studentId: res.studentId,
        studentName: res.studentName || studentsCache[res.studentId] || 'طالب',
        score: res.score,
        totalQuestions: denom,
        percentage: pct,
        isPass: pct >= 50,
        note: res.note || '',
        correctIndices,
        incorrectIndices,
        rawResult: res,
        timestamp: res.timestamp
      };
    });

    const average = Math.round(sumScores / total);
    const passRate = Math.round((passed / total) * 100);

    studentRows.sort((a, b) => b.percentage - a.percentage);
    studentRows.forEach((s, idx) => {
      s.rank = idx + 1;
      if (s.percentage > average + 5) s.comparison = 'فوق المتوسط 🚀';
      else if (s.percentage >= average - 5) s.comparison = 'في مستوى المتوسط ⚖️';
      else s.comparison = 'دون المتوسط (يحتاج دعم) ⚠️';
    });

    return {
      total,
      average,
      passRate,
      highest,
      lowest,
      bands,
      studentRows
    };
  }, [currentExam, examResults, studentsCache]);

  // =========================================================================
  // 1. EXTERNAL / PAPER EXAM VIEW (رصد واستيراد نتائج اختبار خارجي ورقي)
  // =========================================================================
  if (activeView === 'external_exam') {
    const totalMax = parseFloat(maxScore) || 20;

    return (
      <div className="glass-panel" style={{ padding: '24px', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid rgba(0,0,0,0.08)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileSpreadsheet size={26} color="#0e7490" />
              {currentExam ? 'تعديل درجات الاختبار الورقي / الخارجي' : '📥 رصد واستيراد نتائج اختبار ورقي (خارج المنصة)'}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              يمكنك تسمية الاختبار واختيار الفترة، وتعبئة الدرجات يدوياً أو سحبها مباشرة من كشف Excel، مع تحليل إحصائي فوري للنتائج.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={resetForm}>
              <ArrowRight size={16} /> العودة للاختبارات
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveExternalExam}>
          {/* Preset Name Selector & Custom Title */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '8px' }}>
              نوع ومسمى الاختبار (اختر تسمية سريعة أو اكتب المسمى يدوياً):
            </label>
            
            {/* Presets Chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {EXAM_PRESETS.map(preset => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setTitle(preset)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: title === preset ? 'bold' : 'normal',
                    background: title === preset ? '#0e7490' : 'white',
                    color: title === preset ? 'white' : '#334155',
                    border: `1.5px solid ${title === preset ? '#0e7490' : '#cbd5e1'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Editable Title Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="أدخل مسمى الاختبار المخصص هنا (مثال: اختبار الفترة الأولى - رياضيات)..."
                required
                style={{ fontSize: '15px', fontWeight: 'bold', padding: '12px 16px', background: 'white' }}
              />
            </div>
          </div>

          {/* Core Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>الصف / الفصل الدراسي</label>
              <select 
                className="input-field" 
                value={targetClass} 
                onChange={e => setTargetClass(e.target.value)} 
                required
              >
                <option value="">اختر الفصل...</option>
                {classesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>المادة الدراسية</label>
              <select 
                className="input-field" 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
                required
              >
                <option value="">اختر المادة...</option>
                {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>تاريخ إجراء الاختبار</label>
              <input 
                type="date" 
                className="input-field" 
                value={examDate} 
                onChange={e => setExamDate(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 'bold' }}>
                الدرجة الكلية (النهاية العظمى)
              </label>
              <input 
                type="number" 
                min="1" 
                max="1000" 
                className="input-field" 
                value={maxScore} 
                onChange={e => setMaxScore(e.target.value)} 
                required 
                style={{ fontWeight: 'bold', color: '#0e7490' }}
              />
            </div>
          </div>

          {/* Results Entry Modes: Manual vs Excel */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setExternalEntryTab('manual')}
                  className="btn"
                  style={{
                    padding: '10px 18px',
                    background: externalEntryTab === 'manual' ? 'var(--color-primary-dark)' : 'white',
                    color: externalEntryTab === 'manual' ? 'white' : 'var(--color-primary-dark)',
                    border: '1px solid var(--color-border)',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Edit size={16} /> 1. الرصد اليدوي للدرجات
                </button>

                <button
                  type="button"
                  onClick={() => setExternalEntryTab('excel')}
                  className="btn"
                  style={{
                    padding: '10px 18px',
                    background: externalEntryTab === 'excel' ? 'var(--color-primary-dark)' : 'white',
                    color: externalEntryTab === 'excel' ? 'white' : 'var(--color-primary-dark)',
                    border: '1px solid var(--color-border)',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Upload size={16} /> 2. سحب واستيراد كشف Excel / CSV
                </button>
              </div>

              {/* Bulk actions */}
              {targetClass && externalStudentsList.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn btn-outline"
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="تحميل كشف بأسماء وهوية طلاب الفصل بصيغة Excel"
                  >
                    <Download size={15} /> تحميل نموذج Excel للفصل
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkFillFullScore}
                    className="btn btn-outline"
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#86efac' }}
                  >
                    <Sparkles size={15} /> تعيين الدرجة الكاملة ({totalMax}) للجميع
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkClearScores}
                    className="btn btn-outline"
                    style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    <RotateCcw size={15} /> تصفير الدرجات
                  </button>
                </div>
              )}
            </div>

            {importNotice && (
              <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                <Check size={18} /> {importNotice}
              </div>
            )}

            {/* TAB 2: EXCEL IMPORT ZONE */}
            {externalEntryTab === 'excel' && (
              <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
                  {/* File Upload / Drag Drop */}
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => parseAndApplyImportData(ev.target.result);
                        reader.readAsText(file);
                      }
                    }}
                    style={{
                      border: `2px dashed ${isDragOver ? '#0e7490' : '#cbd5e1'}`,
                      background: isDragOver ? '#e0f2fe' : 'white',
                      borderRadius: '12px',
                      padding: '30px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={36} color="#0e7490" />
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>اسحب وأفلت كشف Excel / CSV هنا</strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>أو اضغط لتصفح الملف من جهازك (.csv, .txt, .tsv)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {/* Direct Paste Box */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
                      📋 أو انسخ جدول الدرجات من Excel والصقه مباشرة هنا:
                    </label>
                    <textarea
                      rows={5}
                      className="input-field"
                      placeholder="انسخ صفوف وأعمدة الدرجات من Excel ثم الصقها هنا مباشرة..."
                      value={excelPasteText}
                      onChange={e => setExcelPasteText(e.target.value)}
                      style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', marginBottom: 0 }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        parseAndApplyImportData(excelPasteText);
                        setExcelPasteText('');
                      }}
                      disabled={!excelPasteText.trim()}
                      style={{ alignSelf: 'flex-start', padding: '6px 16px', fontSize: '13px' }}
                    >
                      تطبيق الدرجات المنسوخة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: STUDENTS GRADES TABLE */}
            {!targetClass ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                <Users size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '15px' }}>يرجى اختيار الفصل الدراسي لعرض قائمة الطلاب ورصد درجاتهم.</p>
              </div>
            ) : externalStudentsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                <AlertCircle size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '15px' }}>لا يوجد طلاب مسجلون في فصل ({targetClass}).</p>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px 14px', fontSize: '13px', width: '40px' }}>#</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>اسم الطالب</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>رقم الهوية</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px', width: '160px', textAlign: 'center' }}>
                        الدرجة (من {totalMax})
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center', width: '90px' }}>النسبة</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center', width: '110px' }}>الحالة</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>الملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalStudentsList.map((student, idx) => {
                      const scoreVal = manualScores[student.id];
                      const numScore = parseFloat(scoreVal);
                      const hasScore = scoreVal !== undefined && scoreVal !== '' && !isNaN(numScore);
                      const pct = hasScore ? Math.round((numScore / totalMax) * 100) : null;
                      const isPass = pct !== null && pct >= 50;

                      return (
                        <tr 
                          key={student.id} 
                          style={{ 
                            borderBottom: '1px solid #f1f5f9', 
                            background: idx % 2 === 0 ? 'white' : '#fafafa' 
                          }}
                        >
                          <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 'bold' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>{student.name}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'monospace' }}>{student.nationalId || '—'}</td>
                          
                          {/* Score Input */}
                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max={totalMax}
                                placeholder="0"
                                value={scoreVal !== undefined ? scoreVal : ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setManualScores(prev => ({
                                    ...prev,
                                    [student.id]: val
                                  }));
                                }}
                                style={{
                                  width: '80px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: `1.5px solid ${hasScore ? '#0e7490' : '#cbd5e1'}`,
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                  fontSize: '14px'
                                }}
                              />
                              <span style={{ color: '#64748b', fontSize: '13px' }}>/ {totalMax}</span>
                            </div>
                          </td>

                          {/* Live Percentage */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold', color: pct === null ? '#94a3b8' : isPass ? '#16a34a' : '#dc2626' }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </td>

                          {/* Pass/Fail Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {pct === null ? (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>غير مرصود</span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                background: isPass ? '#dcfce7' : '#fee2e2',
                                color: isPass ? '#166534' : '#991b1b'
                              }}>
                                {isPass ? 'ناجح ✅' : 'يحتاج متابعة ⚠️'}
                              </span>
                            )}
                          </td>

                          {/* Notes */}
                          <td style={{ padding: '6px 14px' }}>
                            <input
                              type="text"
                              placeholder="ملاحظات اختيارية..."
                              value={manualNotes[student.id] || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setManualNotes(prev => ({ ...prev, [student.id]: val }));
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '13px'
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '30px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving || !targetClass || externalStudentsList.length === 0}
              style={{
                padding: '12px 36px',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0e7490, #0284c7)'
              }}
            >
              <Save size={20} />
              {isSaving ? 'جاري حفظ واعتماد النتائج...' : 'حفظ واعتماد نتائج الاختبار الورقي'}
            </button>

            <button type="button" className="btn btn-outline" onClick={resetForm} style={{ padding: '12px 24px' }}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // 2. ITEM ANALYSIS VIEW (تحليل الاختبار ومفرداته)
  // =========================================================================
  if (activeView === 'item_analysis' && currentExam) {
    return (
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid rgba(0,0,0,0.08)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={26} color="#0e7490" /> تقرير التحليل السيكومتري ومفردات الاختبار: {currentExam.title}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              الفصل: <strong>{currentExam.targetClass}</strong> | المادة: <strong>{currentExam.subject}</strong> | عدد الأسئلة: <strong>{currentExam.questions?.length || 0}</strong> | المختبرين: <strong>{examResults.length}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="btn btn-primary" 
              style={{ background: 'linear-gradient(135deg, #0e7490, #63B2C6)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => window.print()}
            >
              <Printer size={16} /> طباعة تقرير التحليل (PDF)
            </button>
            <button className="btn btn-outline" onClick={resetForm}>
              <ArrowRight size={16} /> العودة للاختبارات
            </button>
          </div>
        </div>

        {examResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-muted)', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <AlertCircle size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
            <h3>لا توجد نتائج مسجلة لهذا الاختبار حتى الآن</h3>
          </div>
        ) : itemAnalysisData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Overall Psychometric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534' }}>معامل الثبات (KR-20)</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#15803d', margin: '4px 0' }}>{itemAnalysisData.kr20}</div>
                <div style={{ fontSize: '11px', color: '#166534' }}>{parseFloat(itemAnalysisData.kr20) >= 0.70 ? '✅ ثبات عالي وموثوق' : '⚠️ ثبات متوسط'}</div>
              </div>

              <div style={{ background: '#f0fdfa', padding: '16px', borderRadius: '10px', border: '1px solid #99f6e4', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f766e' }}>معامل الصدق الذاتي</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#0d9488', margin: '4px 0' }}>{itemAnalysisData.validity}</div>
                <div style={{ fontSize: '11px', color: '#0f766e' }}>جذر معامل الثبات (√KR-20)</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>متوسط صعوبة الاختبار</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#0284c7', margin: '4px 0' }}>{itemAnalysisData.meanDifficulty}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>المعدل المثالي (0.40 - 0.75)</div>
              </div>

              <div style={{ background: '#fdf4ff', padding: '16px', borderRadius: '10px', border: '1px solid #f5d0fe', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#86198f' }}>الانحراف المعياري (Sx)</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#a21caf', margin: '4px 0' }}>{itemAnalysisData.stdDev}</div>
                <div style={{ fontSize: '11px', color: '#86198f' }}>تشتت درجات الطلاب</div>
              </div>

              <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e' }}>خطأ القياس المعياري (SEM)</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#b45309', margin: '4px 0' }}>{itemAnalysisData.sem}</div>
                <div style={{ fontSize: '11px', color: '#92400e' }}>دقة تقدير الدرجة الحقيقية</div>
              </div>
            </div>

            {/* Questions Detailed Analysis Table & Cards */}
            {itemAnalysisData.questionsAnalysis && itemAnalysisData.questionsAnalysis.length > 0 ? (
              <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={20} color="#0e7490" /> جدول تحليل مفردات وبنود الأسئلة (Item Psychometrics)
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {itemAnalysisData.questionsAnalysis.map((item, idx) => (
                    <div key={item.qIndex} style={{ background: '#f8fafc', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ background: 'var(--color-primary)', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', marginInlineEnd: '8px' }}>
                            السؤال {idx + 1}
                          </span>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>{item.question.text}</strong>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', background: item.diffBg, color: item.diffColor, border: `1px solid ${item.diffColor}40` }}>
                            معامل السهولة P: {item.p.toFixed(2)} ({item.diffCategory})
                          </span>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', background: item.discBg, color: item.discColor, border: `1px solid ${item.discColor}40` }}>
                            معامل التمييز D: {item.d.toFixed(2)} ({item.discCategory})
                          </span>
                        </div>
                      </div>

                      {/* Distractors Frequency */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '12px' }}>
                        {item.distractors.map((d) => (
                          <div
                            key={d.optIndex}
                            style={{
                              background: d.isCorrect ? '#f0fdf4' : 'white',
                              border: `1.5px solid ${d.isCorrect ? '#22c55e' : '#cbd5e1'}`,
                              borderRadius: '8px',
                              padding: '10px',
                              fontSize: '13px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <strong style={{ color: d.isCorrect ? '#166534' : '#334155' }}>
                                الخيار {d.optIndex + 1} {d.isCorrect && '✅ (الصحيح)'}
                              </strong>
                              <span style={{ fontWeight: 'bold', color: d.isCorrect ? '#166534' : '#64748b' }}>
                                {d.count} طلاب ({d.pct}%)
                              </span>
                            </div>
                            <div style={{ color: '#475569', fontSize: '12px', marginBottom: '6px' }}>{d.text}</div>
                            {d.note && (
                              <div style={{ fontSize: '11px', fontWeight: 'bold', color: d.note.includes('مضلل') ? '#dc2626' : d.note.includes('غير فعال') ? '#d97706' : '#16a34a' }}>
                                💡 {d.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: '12px', background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                        <Sparkles size={16} color="#0e7490" />
                        <span><strong>التوصية التربوية:</strong> {item.recommendation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
                <p>تم رصد درجات هذا الاختبار كدرجة إجمالية مباشرة (اختبار ورقي/خارجي). يمكنك استعراض كافة المؤشرات والتحليلات الإحصائية للفصل والطلاب عبر زر "تحليل نتائج الاختبار".</p>
              </div>
            )}

          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. RESULTS ANALYTICS VIEW (تحليل نتائج الاختبار على مستوى الفصل والطالب)
  // =========================================================================
  if (activeView === 'results_analytics' && currentExam) {
    const data = resultsAnalyticsData;

    return (
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid rgba(0,0,0,0.08)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart2 size={26} color="#0e7490" /> تحليل نتائج الاختبار: {currentExam.title}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              الفصل: <strong>{currentExam.targetClass}</strong> | المادة: <strong>{currentExam.subject}</strong> | التاريخ: <strong>{currentExam.examDate}</strong> {currentExam.isExternal && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', marginInlineStart: '6px' }}>📝 اختبار ورقي</span>}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="btn btn-primary" 
              style={{ background: 'linear-gradient(135deg, #0e7490, #63B2C6)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setPrintingResultsData({ exam: currentExam, results: examResults })}
            >
              <Printer size={16} /> طباعة وتصدير كشف النتائج (Word/PDF)
            </button>
            <button className="btn btn-outline" onClick={resetForm}>
              <ArrowRight size={16} /> العودة للاختبارات
            </button>
          </div>
        </div>

        {/* Tab Switcher: Class Level vs Student Level */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          <button
            onClick={() => setAnalyticsTab('class')}
            className="btn"
            style={{
              flex: 1,
              padding: '12px',
              background: analyticsTab === 'class' ? 'var(--color-primary-dark)' : 'white',
              color: analyticsTab === 'class' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)',
              fontWeight: 'bold',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Users size={18} /> 1. تحليل النتائج على مستوى الفصل
          </button>

          <button
            onClick={() => setAnalyticsTab('student')}
            className="btn"
            style={{
              flex: 1,
              padding: '12px',
              background: analyticsTab === 'student' ? 'var(--color-primary-dark)' : 'white',
              color: analyticsTab === 'student' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)',
              fontWeight: 'bold',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Award size={18} /> 2. تحليل النتائج على مستوى الطالب
          </button>
        </div>

        {!data || data.total === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-muted)', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <AlertCircle size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
            <h3>لا توجد نتائج مسجلة لهذا الاختبار بعد</h3>
          </div>
        ) : (
          <>
            {/* SUB-TAB 1: CLASS LEVEL ANALYTICS */}
            {analyticsTab === 'class' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Metrics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>عدد المختبرين</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#0284c7', marginTop: '4px' }}>{data.total} طالب</div>
                  </div>

                  <div style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>متوسط الفصل</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: data.average >= 50 ? '#16a34a' : '#dc2626', marginTop: '4px' }}>{data.average}%</div>
                  </div>

                  <div style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>نسبة النجاح</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: data.passRate >= 50 ? '#16a34a' : '#dc2626', marginTop: '4px' }}>{data.passRate}%</div>
                  </div>

                  <div style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>أعلى درجة</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#16a34a', marginTop: '4px' }}>{data.highest}%</div>
                  </div>

                  <div style={{ background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>أدنى درجة</div>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>{data.lowest}%</div>
                  </div>
                </div>

                {/* Grade Bands & Distribution Bars */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PieChart size={20} color="#0e7490" /> توزيع مستويات أداء طلاب الفصل (Performance Distribution)
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Object.entries(data.bands).map(([key, band]) => {
                      const pct = data.total > 0 ? Math.round((band.count / data.total) * 100) : 0;

                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                            <span style={{ color: band.color }}>{band.label}</span>
                            <span style={{ color: '#334155' }}>{band.count} طالب ({pct}%)</span>
                          </div>
                          <div style={{ height: '14px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: band.color,
                                borderRadius: '10px',
                                transition: 'width 0.4s ease'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* SUB-TAB 2: STUDENT LEVEL ANALYTICS */}
            {analyticsTab === 'student' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Search Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="بحث باسم الطالب..."
                      value={studentSearchQuery}
                      onChange={e => setStudentSearchQuery(e.target.value)}
                      style={{ paddingRight: '36px', marginBottom: 0 }}
                    />
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    إجمالي الطلاب: <strong>{data.studentRows.length}</strong> | متوسط الفصل: <strong>{data.average}%</strong>
                  </div>
                </div>

                {/* Students Table */}
                <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '12px 14px', fontSize: '13px', width: '50px' }}>الرتبة</th>
                        <th style={{ padding: '12px 14px', fontSize: '13px' }}>اسم الطالب</th>
                        <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>الدرجة</th>
                        <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>النسبة</th>
                        <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>المستوى بالنسبة للمتوسط</th>
                        {currentExam.questions?.length > 0 && (
                          <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>نقاط القوة / الضعف</th>
                        )}
                        <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.studentRows
                        .filter(s => !studentSearchQuery || s.studentName.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                        .map((student, idx) => (
                          <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold' }}>
                              {student.rank === 1 ? '🥇 1' : student.rank === 2 ? '🥈 2' : student.rank === 3 ? '🥉 3' : student.rank}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0f172a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span>{student.studentName}</span>
                                <GamificationBadge
                                  points={studentActivityMap[student.studentId]?.totalPoints || 0}
                                  stars={studentActivityMap[student.studentId]?.stars || 1}
                                  size="xs"
                                  breakdown={studentActivityMap[student.studentId]?.breakdown}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold' }}>
                              {student.score} / {student.totalQuestions}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold', color: student.isPass ? '#16a34a' : '#dc2626' }}>
                              {student.percentage}%
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                              {student.comparison}
                            </td>
                            {currentExam.questions?.length > 0 && (
                              <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px' }}>
                                <span style={{ color: '#16a34a', marginInlineEnd: '8px' }}>
                                  صحيحة: {student.correctIndices.length}
                                </span>
                                <span style={{ color: '#dc2626' }}>
                                  خاطئة: {student.incorrectIndices.length}
                                </span>
                              </td>
                            )}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                {currentExam.questions?.length > 0 && (
                                  <button
                                    className="btn btn-outline"
                                    style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => setInspectingStudentAnswers(student)}
                                    title="فحص إجابات الطالب"
                                  >
                                    فحص الحل
                                  </button>
                                )}
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleTrackStudent(student.studentId)}
                                  title="تتبع مستوى الطالب عبر الاختبارات"
                                >
                                  <TrendingUp size={13} /> تتبع
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </>
        )}

        {/* Modal: Student History Tracking */}
        {trackingStudent && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0 }}><TrendingUp size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}/> سجل تتبع تطور الطالب: {studentsCache[trackingStudent]}</h3>
                <button className="btn btn-outline" onClick={() => setTrackingStudent(null)}>إغلاق</button>
              </div>
              
              {studentHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>لا توجد اختبارات سابقة لهذا الطالب في موادك.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>الاختبار</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>التاريخ</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>الدرجة</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>النسبة والتطور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentHistory.map((h, i) => {
                      const denom = h.totalQuestions || h.maxScore || 1;
                      const pct = Math.round((h.score / denom) * 100);
                      let trend = null;
                      if (i > 0) {
                        const prevDenom = studentHistory[i-1].totalQuestions || studentHistory[i-1].maxScore || 1;
                        const prevPct = Math.round((studentHistory[i-1].score / prevDenom) * 100);
                        if (pct > prevPct) trend = <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>▲ (+{pct - prevPct}%)</span>;
                        else if (pct < prevPct) trend = <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>▼ ({pct - prevPct}%)</span>;
                        else trend = <span style={{ color: '#64748b', fontSize: '12px' }}>◀▶ (0%)</span>;
                      }
                      return (
                        <tr key={h.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{h.examTitle}</td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>{h.examDate}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{h.score} / {denom}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <span style={{ color: pct >= 50 ? '#166534' : '#991b1b', fontWeight: 'bold' }}>{pct}%</span>
                              {trend}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {printingResultsData && (
          <PrintExamModal 
            exam={printingResultsData.exam} 
            results={printingResultsData.results} 
            studentsCache={studentsCache} 
            mode="results" 
            onClose={() => setPrintingResultsData(null)} 
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // 3.5. LIVE STUDENT MONITORING VIEW (غرفة المراقبة اللحظية للطلاب أثناء الاختبار)
  // =========================================================================
  if (activeView === 'live_monitoring' && currentExam) {
    const studentsWithStatus = liveClassStudents.map(student => {
      const sId = student.id;
      const sNid = student.nationalId;
      const submission = examResults.find(r => r.studentId === sId || (sNid && r.studentId === sNid));
      const session = liveSessions[sId] || (sNid ? liveSessions[sNid] : null);

      let status = 'not_entered'; // 'not_entered' | 'in_progress' | 'submitted' | 'interrupted'
      let statusLabel = 'لم يدخل بعد';
      let statusBadgeBg = '#f1f5f9';
      let statusBadgeColor = '#64748b';
      let statusIcon = '🔴';
      let entryTime = '—';
      let submitTime = '—';
      let scoreDisplay = '—';
      let lastActive = '—';

      if (submission) {
        status = 'submitted';
        statusLabel = 'تم التسليم بنجاح';
        statusBadgeBg = '#dcfce7';
        statusBadgeColor = '#166534';
        statusIcon = '🟢';
        entryTime = session?.enteredAtArabic || (session?.enteredAt ? formatArabicTime(session.enteredAt) : '—');
        submitTime = session?.submittedAtArabic || (submission.timestamp ? formatArabicTime(submission.timestamp) : '—');
        const numQ = submission.totalQuestions || currentExam?.questions?.length || 1;
        const pct = Math.round(((submission.score || 0) / numQ) * 100);
        scoreDisplay = `${submission.score} / ${numQ} (${pct}%)`;
        lastActive = 'تم الإنهاء ✅';
      } else if (session) {
        entryTime = session.enteredAtArabic || (session.enteredAt ? formatArabicTime(session.enteredAt) : '—');
        
        const lastHbDate = session.lastHeartbeat ? new Date(session.lastHeartbeat) : null;
        const isHbStale = lastHbDate ? (new Date().getTime() - lastHbDate.getTime() > 60000) : false;

        if (session.status === 'interrupted' || session.isOnline === false || isHbStale) {
          status = 'interrupted';
          statusLabel = 'انقطع أثناء الاختبار';
          statusBadgeBg = '#ffedd5';
          statusBadgeColor = '#c2410c';
          statusIcon = '🟠';
          lastActive = lastHbDate ? `آخر نشاط: ${formatArabicTime(lastHbDate)}` : 'انقطع الاتصال ⚠️';
        } else {
          status = 'in_progress';
          statusLabel = 'داخل الاختبار - جاري الحل ✍️';
          statusBadgeBg = '#dbeafe';
          statusBadgeColor = '#1e40af';
          statusIcon = '🟡';
          lastActive = 'متصل الآن 🟢';
        }
      }

      return {
        ...student,
        status,
        statusLabel,
        statusBadgeBg,
        statusBadgeColor,
        statusIcon,
        entryTime,
        submitTime,
        scoreDisplay,
        lastActive,
        submission
      };
    });

    // Counts
    const totalClass = liveClassStudents.length;
    const inProgressCount = studentsWithStatus.filter(s => s.status === 'in_progress').length;
    const submittedCount = studentsWithStatus.filter(s => s.status === 'submitted').length;
    const notEnteredCount = studentsWithStatus.filter(s => s.status === 'not_entered').length;
    const interruptedCount = studentsWithStatus.filter(s => s.status === 'interrupted').length;

    // Filter and Search
    const filteredLiveStudents = studentsWithStatus.filter(s => {
      if (liveFilter !== 'all' && s.status !== liveFilter) return false;
      if (liveSearchQuery.trim()) {
        const q = liveSearchQuery.trim().toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchNid = String(s.nationalId || '').toLowerCase().includes(q);
        if (!matchName && !matchNid) return false;
      }
      return true;
    });

    return (
      <div className="glass-panel" style={{ padding: '24px', background: 'white' }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid rgba(0,0,0,0.08)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ display: 'inline-flex', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
              <h2 style={{ margin: 0, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={24} color="#059669" /> غرفة المتابعة والمراقبة اللحظية للاختبار: {currentExam.title}
              </h2>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              الفصل: <strong>{currentExam.targetClass}</strong> | المادة: <strong>{currentExam.subject}</strong> | تاريخ الاختبار: <strong>{currentExam.examDate}</strong> (وقت البدء: <strong>{currentExam.startTime}</strong>)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-outline" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              onClick={() => handleOpenResultsAnalytics(currentExam)}
            >
              <BarChart2 size={16} /> كشف النتائج والدرجات
            </button>
            <button 
              className="btn btn-outline" 
              onClick={resetForm}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <ArrowRight size={16} /> العودة للاختبارات
            </button>
          </div>
        </div>

        {/* 5 Live Counters Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {/* Card 1: Total */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>👥 إجمالي طلاب الفصل</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>{totalClass}</div>
          </div>

          {/* Card 2: In Progress */}
          <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', border: '1.5px solid #93c5fd', textAlign: 'center', boxShadow: inProgressCount > 0 ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none' }}>
            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
              داخل الاختبار الآن (جاري الحل)
            </div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#1d4ed8' }}>{inProgressCount}</div>
          </div>

          {/* Card 3: Submitted */}
          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1.5px solid #86efac', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: 'bold', marginBottom: '4px' }}>✅ تم تسليم الاختبار</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#15803d' }}>{submittedCount}</div>
          </div>

          {/* Card 4: Not Entered */}
          <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 'bold', marginBottom: '4px' }}>🔴 لم يدخل بعد</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#b91c1c' }}>{notEnteredCount}</div>
          </div>

          {/* Card 5: Interrupted */}
          <div style={{ background: '#fff7ed', padding: '16px', borderRadius: '12px', border: '1.5px solid #fdba74', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 'bold', marginBottom: '4px' }}>⚠️ انقطع أثناء الاختبار</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#ea580c' }}>{interruptedCount}</div>
          </div>
        </div>

        {/* Filter Chips & Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: `الكل (${totalClass})` },
              { key: 'in_progress', label: `جاري الحل الآن (${inProgressCount})` },
              { key: 'submitted', label: `تم التسليم (${submittedCount})` },
              { key: 'not_entered', label: `لم يدخل بعد (${notEnteredCount})` },
              { key: 'interrupted', label: `انقطع الاتصال (${interruptedCount})` }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setLiveFilter(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: liveFilter === tab.key ? 'bold' : 'normal',
                  background: liveFilter === tab.key ? '#0e7490' : '#f8fafc',
                  color: liveFilter === tab.key ? 'white' : '#475569',
                  border: `1px solid ${liveFilter === tab.key ? '#0e7490' : '#cbd5e1'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="input-field"
              value={liveSearchQuery}
              onChange={e => setLiveSearchQuery(e.target.value)}
              placeholder="البحث باسم الطالب أو الهوية..."
              style={{ width: '100%', paddingRight: '36px', fontSize: '13px', margin: 0 }}
            />
          </div>
        </div>

        {/* Real-time Students Table */}
        {filteredLiveStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '10px' }}>
            لا يوجد طلاب مطابقين للفلتر المحدد
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '12px 14px', fontSize: '13px', width: '40px', textAlign: 'center' }}>م</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px' }}>اسم الطالب / الهوية</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>حالة الطالب أثناء الاختبار</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>زمن الدخول</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>زمن التسليم</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>الدرجة المحصلة</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>حالة الاتصال والنشاط</th>
                  <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredLiveStudents.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{s.name || 'طالب'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>هوية: {s.nationalId || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: s.statusBadgeBg,
                        color: s.statusBadgeColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{s.statusIcon}</span>
                        <span>{s.statusLabel}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: s.entryTime !== '—' ? 'bold' : 'normal', color: s.entryTime !== '—' ? '#0e7490' : '#94a3b8' }}>
                      {s.entryTime}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: s.submitTime !== '—' ? 'bold' : 'normal', color: s.submitTime !== '—' ? '#166534' : '#94a3b8' }}>
                      {s.submitTime}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: s.scoreDisplay !== '—' ? '#0f766e' : '#94a3b8' }}>
                      {s.scoreDisplay}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', color: s.status === 'in_progress' ? '#15803d' : s.status === 'interrupted' ? '#c2410c' : '#64748b' }}>
                      {s.lastActive}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {s.submission ? (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setInspectingStudentAnswers({
                            studentId: s.id,
                            studentName: s.name,
                            score: s.submission.score,
                            totalQuestions: s.submission.totalQuestions,
                            answers: s.submission.answers || {}
                          })}
                        >
                          <Eye size={14} /> فحص الإجابات
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>قيد الانتظار</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal to inspect student answers */}
        {inspectingStudentAnswers && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
                  إجابات الطالب: {inspectingStudentAnswers.studentName || studentsCache[inspectingStudentAnswers.studentId]}
                </h3>
                <button className="btn btn-outline" onClick={() => setInspectingStudentAnswers(null)}>إغلاق</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {currentExam.questions?.map((q, qIdx) => {
                  const studentAnswer = inspectingStudentAnswers.answers?.[qIdx];
                  const isCorrect = studentAnswer === q.correctOption;

                  return (
                    <div key={q.id || qIdx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: `1px solid ${isCorrect ? '#86efac' : '#fca5a5'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <strong>السؤال {qIdx + 1}: <MarkdownViewer content={q.text} /></strong>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: isCorrect ? '#166534' : '#991b1b' }}>
                          {isCorrect ? '✅ إجابة صحيحة' : '❌ إجابة خاطئة'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                        {q.options?.map((opt, optIdx) => {
                          const isStudentPick = studentAnswer === optIdx;
                          const isTheCorrectOne = q.correctOption === optIdx;

                          let bg = '#fff';
                          let border = '#e2e8f0';
                          if (isTheCorrectOne) {
                            bg = '#dcfce7';
                            border = '#22c55e';
                          } else if (isStudentPick && !isCorrect) {
                            bg = '#fee2e2';
                            border = '#ef4444';
                          }

                          return (
                            <div key={optIdx} style={{ padding: '8px 12px', background: bg, border: `1px solid ${border}`, borderRadius: '6px' }}>
                              <MarkdownViewer content={opt} /> {isTheCorrectOne ? ' (الإجابة النموذجية)' : ''} {isStudentPick ? ' (اختيار الطالب)' : ''}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 4. MAIN LIST VIEW (بطاقات الاختبارات الإلكترونية والورقية)
  // =========================================================================
  if (activeView === 'list') {
    return (
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>
              <FileText style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> {t('teacherExams.electronicExams')} والاختبارات الورقية
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              إنشاء الاختبارات الإلكترونية، المراقبة اللحظية للطلاب، رصد نتائج الاختبارات الورقية، وتحليل النتائج فورياً
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Button 1: Create Electronic Exam */}
            <button className="btn btn-primary" onClick={handleCreateElectronic} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> {t('teacherExams.createNewExam')}
            </button>

            {/* Button 2: Import / Record External Paper Exam */}
            <button 
              className="btn" 
              onClick={handleCreateExternal}
              style={{
                background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
              }}
            >
              <FileSpreadsheet size={18} /> 📥 رصد / استيراد اختبار ورقي (خارج المنصة)
            </button>
          </div>
        </div>

        {exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            {t('teacherExams.noExamsRecorded')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {exams.map(exam => {
              const submissionCount = allResultsCountMap[exam.id] || 0;

              return (
                <div 
                  key={exam.id} 
                  style={{ 
                    background: 'rgba(255,255,255,0.9)', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    border: exam.isExternal ? '1.5px solid #67e8f9' : '1px solid rgba(0,0,0,0.06)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '17px' }}>{exam.title}</h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      background: exam.isExternal ? '#e0f2fe' : 'rgba(37, 211, 102, 0.1)',
                      color: exam.isExternal ? '#0369a1' : '#166534',
                      border: `1px solid ${exam.isExternal ? '#bae6fd' : '#bbf7d0'}`
                    }}>
                      {exam.isExternal ? '📝 اختبار ورقي' : '💻 اختبار إلكتروني'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16}/> {t('teacherExams.classLabel')} <strong>{exam.targetClass}</strong></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={16}/> {t('teacherExams.subjectLabel')} <strong>{exam.subject}</strong></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={16}/> التاريخ: <strong>{exam.examDate}</strong> {exam.startTime && `| ${exam.startTime} (${exam.duration} دقيقة)`}
                    </div>
                    {exam.isExternal ? (
                      <div style={{ fontSize: '13px', color: '#0e7490', background: 'rgba(14, 116, 144, 0.08)', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🎯 النهاية العظمى: <strong>{exam.maxScore || exam.totalQuestions} درجة</strong>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div>{t('teacherExams.questionsCount')} <strong>{exam.questions?.length || 0} أسئلة</strong></div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          {submissionCount} تسليم
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Analysis & Monitoring Action Buttons */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Live Monitoring Button for Electronic Exams */}
                    {!exam.isExternal && (
                      <button 
                        className="btn" 
                        style={{
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          color: 'white',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          padding: '10px 12px',
                          fontWeight: 'bold',
                          borderRadius: '8px',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
                        }}
                        onClick={() => handleOpenLiveMonitoring(exam)}
                        title="غرفة المراقبة اللحظية: متابعة من دخل الاختبار، من لم يدخل، ومن انقطع أو سلم"
                      >
                        <Radio size={16} /> 🟢 غرفة المراقبة الحية للطلاب (مباشر)
                      </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {/* Button 1: Item & Exam Analysis (Electronic only, or statistical summary) */}
                      <button 
                        className="btn btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', padding: '8px', fontWeight: 'bold' }} 
                        onClick={() => handleOpenItemAnalysis(exam)}
                        title="تحليل مفردات وفقرات الاختبار ومعاملات الصعوبة والتمييز والصدق والثبات"
                      >
                        <Activity size={15} /> تحليل الاختبار
                      </button>

                      {/* Button 2: Results Analytics (Class & Student level) */}
                      <button 
                        className="btn" 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', padding: '8px', background: 'linear-gradient(135deg, #0e7490, #63B2C6)', color: 'white', border: 'none', fontWeight: 'bold' }} 
                        onClick={() => handleOpenResultsAnalytics(exam)}
                        title="تحليل نتائج الاختبار على مستوى الفصل وعلى مستوى الطالب"
                      >
                        <BarChart2 size={15} /> تحليل النتائج
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!exam.isExternal && (
                        <button 
                          className="btn btn-outline" 
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', padding: '6px' }} 
                          onClick={() => setPrintingExamData(exam)}
                          title="طباعة وتصدير أسئلة الاختبار بصيغة Word و PDF"
                        >
                          <Printer size={14} /> طباعة الأسئلة
                        </button>
                      )}
                      
                      <button 
                        className="btn btn-outline" 
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }} 
                        onClick={() => handleEdit(exam)}
                        title={exam.isExternal ? 'تعديل درجات وبيانات الاختبار' : 'تعديل الاختبار'}
                      >
                        <Edit size={14} /> {exam.isExternal ? 'تعديل الدرجات' : t('teacherExams.edit')}
                      </button>

                      <button 
                        className="btn btn-outline" 
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', borderColor: '#fca5a5', padding: '6px 10px' }} 
                        onClick={() => handleDelete(exam.id)}
                        title="حذف الاختبار"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {printingExamData && (
          <PrintExamModal exam={printingExamData} mode="exam" onClose={() => setPrintingExamData(null)} />
        )}
      </div>
    );
  }

  // =========================================================================
  // 5. CREATE / EDIT ELECTRONIC EXAM FORM
  // =========================================================================
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '16px' }}>
        <h2>{activeView === 'create' ? t('teacherExams.createExam') : t('teacherExams.editExam')}</h2>
        <button className="btn btn-outline" onClick={resetForm}>{t('teacherExams.backToList')}</button>
      </div>

      <form onSubmit={handleSaveElectronic}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="form-group">
            <label>{t('teacherExams.examTitle')}</label>
            <input type="text" className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder={t('teacherExams.examTitlePlaceholder')} />
          </div>
          
          <div className="form-group">
            <label>{t('teacherExams.targetClass')}</label>
            <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)} required>
              <option value="">{t('teacherExams.selectClass')}</option>
              {classesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>{t('teacherExams.subject')}</label>
            <select className="input-field" value={subject} onChange={e => setSubject(e.target.value)} required>
              <option value="">{t('teacherExams.selectSubject')}</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>{t('teacherExams.examDate')}</label>
            <input type="date" className="input-field" value={examDate} onChange={e => setExamDate(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>{t('teacherExams.startTime')}</label>
            <input 
              type="time" 
              className="input-field" 
              value={startTime} 
              onChange={e => {
                const val = e.target.value;
                setStartTime(val);
                if (!entryDeadline || entryDeadline === calculateDefaultCutoff(startTime)) {
                  setEntryDeadline(calculateDefaultCutoff(val));
                }
              }} 
              required 
            />
          </div>

          <div className="form-group">
            <label>
              آخر موعد لسماح الدخول
              <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-primary-dark)', marginInlineStart: '4px' }}>
                (تلقائياً 30 دقيقة من البدء)
              </span>
            </label>
            <input 
              type="time" 
              className="input-field" 
              value={entryDeadline} 
              onChange={e => setEntryDeadline(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label>{t('teacherExams.durationMinutes')}</label>
            <input type="number" min="1" className="input-field" value={duration} onChange={e => setDuration(e.target.value)} required />
          </div>

          <div className="form-group">
            <label>{t('teacherExams.numQuestions')}</label>
            <input type="number" min="1" max="50" className="input-field" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} required />
          </div>
        </div>

        {/* Central Question Bank Import Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1.5px dashed #0d9488',
          margin: '10px 0 24px 0',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: '#0d9488',
              color: '#ffffff',
              padding: '10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={24} />
            </div>
            <div>
              <strong style={{ fontSize: '1.05rem', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                بنك الأسئلة المركزي المشترك (كافة المدارس)
                <span style={{ fontSize: '0.75rem', background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: '12px' }}>
                  متاح الآن
                </span>
              </strong>
              <span style={{ fontSize: '0.86rem', color: '#475569', display: 'block', marginTop: '3px' }}>
                ابحث واستورد أسئلة جاهزة من واجبات واختبارات المدارس الأخرى مع إمكانية تعديلها بحرية تامة دون التأثير على الأصل
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowQuestionBankModal(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={18} />
            تصفح واستيراد من بنك الأسئلة
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {questions.map((q, qIndex) => (
            <div key={q.id || qIndex} style={{ background: 'rgba(255,255,255,0.5)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px 0', borderBottom: '2px solid var(--color-primary-light)', paddingBottom: '8px', display: 'inline-block' }}>{t('teacherExams.question')} {qIndex + 1}</h3>
              
              <MarkdownInput 
                label={t('teacherExams.questionText')}
                value={q.text}
                onChange={(val) => updateQuestion(qIndex, 'text', val)}
                placeholder={t('teacherExams.questionTextPlaceholder')}
                height="150px"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                {[0, 1, 2, 3].map(optIndex => (
                  <div key={optIndex} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: q.correctOption === optIndex ? 'rgba(37, 211, 102, 0.1)' : 'transparent', padding: '12px', borderRadius: '8px', border: q.correctOption === optIndex ? '2px solid #25D366' : '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0, fontWeight: 'bold' }}>{t('teacherExams.option')} {optIndex + 1}</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer', color: q.correctOption === optIndex ? '#25D366' : 'inherit' }}>
                        <input 
                          type="radio" 
                          name={`correct_${qIndex}`} 
                          checked={q.correctOption === optIndex} 
                          onChange={() => updateQuestion(qIndex, 'correctOption', optIndex)}
                        />
                        {t('teacherExams.correctAnswer')}
                      </label>
                    </div>
                    <MarkdownInput 
                      label=""
                      value={q.options[optIndex]}
                      onChange={(val) => updateOption(qIndex, optIndex, val)}
                      placeholder={`${t('teacherExams.option')} ${optIndex + 1}...`}
                      height="100px"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }} disabled={isSaving}>
            <Save size={20} />
            {isSaving ? t('teacherExams.saving') : t('teacherExams.saveExam')}
          </button>
        </div>
      </form>

      {/* Central Shared Question Bank Modal */}
      <SharedQuestionBankModal
        isOpen={showQuestionBankModal}
        onClose={() => setShowQuestionBankModal(false)}
        onImportQuestions={handleImportQuestionsFromBank}
        currentSubject={subject}
        currentClass={targetClass}
      />
    </div>
  );
}
