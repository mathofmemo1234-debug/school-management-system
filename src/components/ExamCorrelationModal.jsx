import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, TrendingUp, ArrowLeftRight, BarChart2, CheckCircle2, 
  Sparkles, Search, Award, HelpCircle, Users, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, User, GitCompare
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { computeBivariateAnalysis } from '../utils/examCorrelationEngine';

export default function ExamCorrelationModal({
  isOpen,
  onClose,
  allExams = [],
  allExamResultsMap = {}, // map of examId -> results array
  initialExam1 = null,
  initialExam2 = null
}) {
  const { userData } = useAuth();

  const [selectedTeacher1, setSelectedTeacher1] = useState('all');
  const [selectedTeacher2, setSelectedTeacher2] = useState('all');
  const [selectedExamId1, setSelectedExamId1] = useState(initialExam1?.id || '');
  const [selectedExamId2, setSelectedExamId2] = useState(initialExam2?.id || '');

  // Tab view: 'cohort' (مقارنة المؤشرات بين المعلمين والفصول) | 'paired' (التحليل التلازمي ونماء الطلاب المشتركين)
  const [viewTab, setViewTab] = useState('cohort');

  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState('name_asc');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'improved' | 'stable' | 'declined'
  const [printScope, setPrintScope] = useState('all'); // 'all' (تقرير شامل لكافة المحاور) | 'current' (التبويب المعروض فقط)

  const [supervisorName, setSupervisorName] = useState(userData?.supervisorName || 'أ. أحمد المقدم');
  const [principalName, setPrincipalName] = useState(userData?.principalName || 'أ. أنس الجهني');

  // تخزين النتائج المسترجعة تلقائياً في حال لم يتم تمريرها مسبقاً
  const [fetchedResults, setFetchedResults] = useState({});
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // استخراج قائمة المعلمين الفريدين من كافة الاختبارات
  const uniqueTeachers = useMemo(() => {
    const map = new Map();
    allExams.forEach(e => {
      const tId = e.teacherId || e.teacherName || 'unknown';
      const tName = e.teacherName || 'معلم غير محدد';
      if (!map.has(tId)) {
        map.set(tId, { id: tId, name: tName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [allExams]);

  // تحديث الاختبارات المختارة عند فتح النافذة
  useEffect(() => {
    if (initialExam1?.id) {
      setSelectedExamId1(initialExam1.id);
      if (initialExam1.teacherId || initialExam1.teacherName) {
        setSelectedTeacher1(initialExam1.teacherId || initialExam1.teacherName);
      }
    }
    if (initialExam2?.id) {
      setSelectedExamId2(initialExam2.id);
      if (initialExam2.teacherId || initialExam2.teacherName) {
        setSelectedTeacher2(initialExam2.teacherId || initialExam2.teacherName);
      }
    } else if (allExams.length >= 2) {
      setSelectedExamId2(prev => {
        if (prev) return prev;
        const other = allExams.find(e => e.id !== (initialExam1?.id || selectedExamId1));
        if (other) {
          if (other.teacherId || other.teacherName) {
            setSelectedTeacher2(other.teacherId || other.teacherName);
          }
          return other.id;
        }
        return prev;
      });
    }
  }, [initialExam1, initialExam2, allExams, selectedExamId1]);

  // تصفية قائمة اختبارات الطرف الأول حسب المعلم
  const filteredExams1 = useMemo(() => {
    if (selectedTeacher1 === 'all') return allExams;
    return allExams.filter(e => (e.teacherId === selectedTeacher1 || e.teacherName === selectedTeacher1));
  }, [allExams, selectedTeacher1]);

  // تصفية قائمة اختبارات الطرف الثاني حسب المعلم
  const filteredExams2 = useMemo(() => {
    if (selectedTeacher2 === 'all') return allExams;
    return allExams.filter(e => (e.teacherId === selectedTeacher2 || e.teacherName === selectedTeacher2));
  }, [allExams, selectedTeacher2]);

  // جلب تلقائي لنتائج أي اختبار يتم اختياره من فايربيس إذا لم تكن النتائج محملة مسبقاً
  useEffect(() => {
    if (!isOpen) return;

    const fetchResultsForExam = async (examId) => {
      if (!examId || (allExamResultsMap && allExamResultsMap[examId]) || fetchedResults[examId]) return;
      try {
        setIsLoadingResults(true);
        // 1. المحاولة في مجموعة exam_results (اختبارات المعلم الورقية والإلكترونية)
        const q1 = query(collection(db, 'exam_results'), where('examId', '==', examId));
        const snap1 = await getDocs(q1);
        let items = snap1.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. إذا لم توجد نتائج، المحاولة في مجموعة exam_grades_records (اختبارات الإدارة والرصد المدرسي)
        if (items.length === 0) {
          const q2 = query(collection(db, 'exam_grades_records'), where('examId', '==', examId));
          const snap2 = await getDocs(q2);
          items = snap2.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              studentId: data.studentId || d.id,
              studentName: data.studentName,
              nationalId: data.studentNationalId || data.nationalId || '',
              score: data.totalScore !== undefined ? Number(data.totalScore) : (Number(data.score) || 0),
              maxScore: data.maxScore,
              isAbsent: Boolean(data.isAbsent || data.status === 'غائب'),
              ...data
            };
          });
        }

        setFetchedResults(prev => ({ ...prev, [examId]: items }));
      } catch (err) {
        console.warn('Could not auto-fetch exam results for correlation:', examId, err);
      } finally {
        setIsLoadingResults(false);
      }
    };

    if (selectedExamId1) fetchResultsForExam(selectedExamId1);
    if (selectedExamId2) fetchResultsForExam(selectedExamId2);
  }, [isOpen, selectedExamId1, selectedExamId2, allExamResultsMap, fetchedResults]);

  const exam1 = useMemo(() => allExams.find(e => e.id === selectedExamId1), [allExams, selectedExamId1]);
  const exam2 = useMemo(() => allExams.find(e => e.id === selectedExamId2), [allExams, selectedExamId2]);

  const results1 = useMemo(() => {
    if (!exam1) return [];
    return allExamResultsMap[exam1.id] || fetchedResults[exam1.id] || [];
  }, [exam1, allExamResultsMap, fetchedResults]);

  const results2 = useMemo(() => {
    if (!exam2) return [];
    return allExamResultsMap[exam2.id] || fetchedResults[exam2.id] || [];
  }, [exam2, allExamResultsMap, fetchedResults]);

  // حساب التحليل التكاملي والمقارن
  const analysis = useMemo(() => {
    if (!exam1 || !exam2) return null;
    return computeBivariateAnalysis(results1, results2, exam1, exam2);
  }, [exam1, exam2, results1, results2]);

  // ضبط التبويب التلقائي إذا لم تكن هناك بيانات مقترنة
  useEffect(() => {
    if (analysis && !analysis.hasPaired) {
      setViewTab('cohort');
    }
  }, [analysis]);

  // تبديل موضعي الاختبارين (X <-> Y)
  const handleSwapExams = () => {
    const tempExamId = selectedExamId1;
    const tempTeacher = selectedTeacher1;
    setSelectedExamId1(selectedExamId2);
    setSelectedTeacher1(selectedTeacher2);
    setSelectedExamId2(tempExamId);
    setSelectedTeacher2(tempTeacher);
  };

  // اختصار المقارنة لنفس المعلم
  const handleSetSameTeacher = () => {
    if (exam1) {
      const t = exam1.teacherId || exam1.teacherName;
      setSelectedTeacher1(t);
      setSelectedTeacher2(t);
      const otherForSameTeacher = allExams.find(e => e.id !== exam1.id && (e.teacherId === t || e.teacherName === t));
      if (otherForSameTeacher) setSelectedExamId2(otherForSameTeacher.id);
    }
  };

  // اختصار المقارنة بين معلمين مختلفين
  const handleSetDifferentTeachers = () => {
    if (exam1) {
      const t1 = exam1.teacherId || exam1.teacherName;
      const otherTeacherExam = allExams.find(e => (e.teacherId !== t1 && e.teacherName !== t1));
      if (otherTeacherExam) {
        setSelectedTeacher2(otherTeacherExam.teacherId || otherTeacherExam.teacherName);
        setSelectedExamId2(otherTeacherExam.id);
      }
    }
  };

  // تصفية وفرز قائمة الطلاب المقترنين
  const filteredStudents = useMemo(() => {
    if (!analysis || !analysis.pairedStudents) return [];
    let list = analysis.pairedStudents.filter(p => {
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        const matchName = (p.studentName || '').toLowerCase().includes(q);
        const matchNid = String(p.nationalId || '').includes(q);
        if (!matchName && !matchNid) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });

    if (studentSort === 'name_asc') list.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '', 'ar'));
    else if (studentSort === 'name_desc') list.sort((a, b) => (b.studentName || '').localeCompare(a.studentName || '', 'ar'));
    else if (studentSort === 'gain_desc') list.sort((a, b) => b.diffPct - a.diffPct);
    else if (studentSort === 'gain_asc') list.sort((a, b) => a.diffPct - b.diffPct);
    else if (studentSort === 'score1_desc') list.sort((a, b) => b.pct1 - a.pct1);
    else if (studentSort === 'score2_desc') list.sort((a, b) => b.pct2 - a.pct2);

    return list;
  }, [analysis, studentSearch, statusFilter, studentSort]);

  const handlePrint = (scope = printScope) => {
    const origTitle = document.title;
    const t1Name = exam1?.teacherName || 'معلم1';
    const t2Name = exam2?.teacherName || 'معلم2';
    document.title = `تقرير_مقارنة_اختبارات_${t1Name}_و_${t2Name}_${new Date().toISOString().split('T')[0]}`;
    window.print();
    setTimeout(() => { document.title = origTitle; }, 1000);
  };

  const isSameTeacher = analysis?.independent?.isSameTeacher;

  if (!isOpen) return null;

  const modalJSX = (
    <div className="correlation-modal-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      direction: 'rtl',
      padding: '16px'
    }}>
      <style>{`
        .print-only {
          display: none !important;
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
          /* Completely hide EVERYTHING under body except the correlation-modal-root so NO blank pages exist! */
          body > *:not(.correlation-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-only-flex {
            display: flex !important;
          }
          .correlation-modal-root,
          .correlation-modal-dialog,
          .correlation-modal-scroll-area {
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
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
        }
      `}</style>
      <div className="correlation-modal-dialog" style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '1150px',
        maxHeight: '94vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>
        
        {/* Top Header Toolbar (Hidden on print) */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={24} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                تحليل ومقارنة أي اختبارين للمعلمين (Teacher Exams Comparison & Analytics)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#c7d2fe' }}>
                مقارنة شاملة بين أي معلمين مختلفين أو نفس المعلم • اختبارات الفروق t-Test • توزيع التقديرات • الصدق ومعامل الارتباط
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {analysis?.hasPaired && (
              <select
                value={printScope}
                onChange={e => setPrintScope(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
                title="نطاق محتوى التقرير المطبوع"
              >
                <option value="all" style={{ color: '#0f172a' }}>📄 تقرير شامل (كافة المحاور)</option>
                <option value="current" style={{ color: '#0f172a' }}>📑 التبويب المعروض فقط</option>
              </select>
            )}
            <button
              onClick={() => handlePrint(printScope)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#0284c7',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Printer size={16} /> طباعة التقرير والاعتماد الرسمي
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: 'white',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="correlation-modal-scroll-area" style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Exam Selection & Teacher Filtering Bar (Hidden on print) */}
          <div className="no-print" style={{
            background: '#f8fafc',
            padding: '16px 20px',
            borderRadius: '14px',
            border: '1.5px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* Quick Presets Toggle Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitCompare size={16} color="#4338ca" />
                تحديد أطراف المقارنة:
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSetDifferentTeachers}
                  style={{
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    color: '#4338ca',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ⚡ مقارنة بين معلمين مختلفين
                </button>
                <button
                  type="button"
                  onClick={handleSetSameTeacher}
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🔄 مقارنة لنفس المعلم (فصلين/فترتين)
                </button>
                <button
                  type="button"
                  onClick={handleSwapExams}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="تبديل طرفي المقارنة"
                >
                  <ArrowLeftRight size={14} color="#0e7490" /> تبديل (X ⟷ Y)
                </button>
              </div>
            </div>

            {/* Selectors Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '16px',
              alignItems: 'center'
            }}>
              {/* Exam 1 Selector */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e3a8a' }}>
                    1. الاختبار الأول (الطرف الأول X):
                  </label>
                  <select
                    value={selectedTeacher1}
                    onChange={e => setSelectedTeacher1(e.target.value)}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: 'bold' }}
                  >
                    <option value="all">كل المعلمين</option>
                    {uniqueTeachers.map(t => (
                      <option key={t.id} value={t.id}>👨‍🏫 {t.name}</option>
                    ))}
                  </select>
                </div>

                <select
                  className="input-field"
                  style={{ width: '100%', marginBottom: 0, padding: '8px 10px', fontSize: '12px', fontWeight: 'bold' }}
                  value={selectedExamId1}
                  onChange={e => setSelectedExamId1(e.target.value)}
                >
                  <option value="">-- اختر الاختبار الأول --</option>
                  {filteredExams1.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      [{ex.teacherName || 'معلم'}] • {ex.title} • {ex.subject} ({ex.targetClass || 'عام'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Middle Icon */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#eef2ff',
                  border: '1.5px solid #c7d2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4338ca',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}>
                  VS
                </div>
              </div>

              {/* Exam 2 Selector */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#7c3aed' }}>
                    2. الاختبار الثاني (الطرف الثاني Y):
                  </label>
                  <select
                    value={selectedTeacher2}
                    onChange={e => setSelectedTeacher2(e.target.value)}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: 'bold' }}
                  >
                    <option value="all">كل المعلمين</option>
                    {uniqueTeachers.map(t => (
                      <option key={t.id} value={t.id}>👨‍🏫 {t.name}</option>
                    ))}
                  </select>
                </div>

                <select
                  className="input-field"
                  style={{ width: '100%', marginBottom: 0, padding: '8px 10px', fontSize: '12px', fontWeight: 'bold' }}
                  value={selectedExamId2}
                  onChange={e => setSelectedExamId2(e.target.value)}
                >
                  <option value="">-- اختر الاختبار الثاني --</option>
                  {filteredExams2.map(ex => (
                    <option key={ex.id} value={ex.id} disabled={ex.id === selectedExamId1}>
                      [{ex.teacherName || 'معلم'}] • {ex.title} • {ex.subject} ({ex.targetClass || 'عام'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isLoadingResults && (
            <div style={{ textAlign: 'center', padding: '16px', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#eef2ff', borderRadius: '10px' }}>
              <RefreshCw className="spin-slow" size={20} />
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>جاري استرجاع درجات الطلاب واحتساب الفروق الإحصائية...</span>
            </div>
          )}

          {!analysis || !exam1 || !exam2 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <HelpCircle size={48} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
              <h4>يرجى اختيار اختبارين لبدء المقارنة والتحليل الإحصائي بين المعلمين</h4>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Printable Official Header (Only on print) */}
              <div className="print-only" style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a', fontWeight: 'bold' }}>
                      تقرير المقارنة والتحليل الإحصائي بين الاختبارات المدرسية
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                      المملكة العربية السعودية • وزارة التعليم • {userData?.schoolName || 'منظومة الإدارة والقياس والتقويم الذكي'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'left', fontSize: '12px', color: '#334155' }}>
                    <div><strong>تاريخ التقرير:</strong> {new Date().toLocaleDateString('ar-SA')}</div>
                    <div><strong>طبيعة المقارنة:</strong> {isSameTeacher ? 'نفس المعلم (فترات/فصول)' : 'معلمان مختلفان'}</div>
                    <div><strong>نطاق التقرير:</strong> {printScope === 'all' && analysis.hasPaired ? 'تقرير شامل (كافة المحاور)' : (viewTab === 'cohort' ? 'مقارنة مؤشرات المعلمين والفصول' : 'التحليل التلازمي ونماء الطلاب')}</div>
                  </div>
                </div>
              </div>

              {/* Comparison Header Banner */}
              <div className="print-avoid-break" style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: '18px 22px',
                borderRadius: '14px',
                border: '1.5px solid #cbd5e1',
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '16px',
                alignItems: 'center'
              }}>
                {/* Party 1 */}
                <div style={{ borderRight: '4px solid #0284c7', paddingRight: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={14} /> المعلم: <span>{exam1.teacherName || 'غير محدد'}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginTop: '3px' }}>
                    {exam1.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    المادة: <strong>{exam1.subject}</strong> | الفصل: <strong>{exam1.targetClass || 'عام'}</strong> | العظمى: <strong>{exam1.maxScore || 20}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 'bold', marginTop: '4px' }}>
                    المتوسط: {analysis.independent.cohort1.meanPct}% ({analysis.independent.cohort1.totalTested} طالب)
                  </div>
                </div>

                {/* Center Badge */}
                <div style={{ textAlign: 'center', padding: '0 10px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: isSameTeacher ? '#f0fdf4' : '#eff6ff',
                    color: isSameTeacher ? '#166534' : '#1d4ed8',
                    border: `1px solid ${isSameTeacher ? '#bbf7d0' : '#bfdbfe'}`
                  }}>
                    {isSameTeacher ? '🔄 مقارنة لنفس المعلم' : '⚡ مقارنة بين معلمين مختلفين'}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#4338ca', margin: '4px 0' }}>
                    مقارنة مع ⟷
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {analysis.hasPaired ? `👥 ${analysis.totalPaired} طالب مشترك` : '👥 عينات وفصول مستقلة'}
                  </div>
                </div>

                {/* Party 2 */}
                <div style={{ borderLeft: '4px solid #7c3aed', paddingLeft: '12px', textAlign: 'left', direction: 'ltr' }}>
                  <div style={{ fontSize: '12px', color: '#6d28d9', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', direction: 'rtl' }}>
                    <User size={14} /> المعلم: <span>{exam2.teacherName || 'غير محدد'}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginTop: '3px', textAlign: 'right', direction: 'rtl' }}>
                    {exam2.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', textAlign: 'right', direction: 'rtl' }}>
                    المادة: <strong>{exam2.subject}</strong> | الفصل: <strong>{exam2.targetClass || 'عام'}</strong> | العظمى: <strong>{exam2.maxScore || 20}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 'bold', marginTop: '4px', textAlign: 'right', direction: 'rtl' }}>
                    المتوسط: {analysis.independent.cohort2.meanPct}% ({analysis.independent.cohort2.totalTested} طالب)
                  </div>
                </div>
              </div>

              {/* View Navigation Tabs (Hidden on print) */}
              <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setViewTab('cohort')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid #0284c7',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: viewTab === 'cohort' ? '#0284c7' : '#ffffff',
                    color: viewTab === 'cohort' ? '#ffffff' : '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: viewTab === 'cohort' ? '0 3px 10px rgba(2, 132, 199, 0.25)' : 'none'
                  }}
                >
                  <BarChart2 size={18} />
                  <span>1. مقارنة المؤشرات الشاملة بين المعلمين والفصول (Cohort Comparison & t-Test)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (analysis.hasPaired) setViewTab('paired');
                  }}
                  disabled={!analysis.hasPaired}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid #4338ca',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: analysis.hasPaired ? 'pointer' : 'not-allowed',
                    opacity: analysis.hasPaired ? 1 : 0.5,
                    background: viewTab === 'paired' ? '#4338ca' : '#ffffff',
                    color: viewTab === 'paired' ? '#ffffff' : '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: viewTab === 'paired' ? '0 3px 10px rgba(67, 56, 202, 0.25)' : 'none'
                  }}
                  title={analysis.hasPaired ? 'عرض الصدق التلازمي ونماء التعلم' : 'يتطلب وجود طلاب مشتركين اختبروا كلا الاختبارين'}
                >
                  <TrendingUp size={18} />
                  <span>
                    2. التحليل التلازمي ونماء الطلاب المشتركين 
                    {analysis.hasPaired ? ` (${analysis.totalPaired} طالب)` : ' (لا يوجد طلاب مشتركون)'}
                  </span>
                </button>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  VIEW A: COHORT & TEACHER COMPARISON (مقارنة مؤشرات المعلمين)
              ───────────────────────────────────────────────────────────── */}
              {(viewTab === 'cohort' || printScope === 'all') && (
                <div 
                  className={`${printScope === 'all' && viewTab !== 'cohort' ? 'print-only-flex' : ''}`}
                  style={{ 
                    display: (printScope === 'all' && viewTab !== 'cohort') ? undefined : 'flex', 
                    flexDirection: 'column', 
                    gap: '20px' 
                  }}
                >

                  {/* 1. Side-by-Side KPI Metrics Grid */}
                  <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    
                    {/* Card 1: Mean Percentage */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                        المتوسط الحسابي للدرجات
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0284c7' }}>{exam1.teacherName || 'الطرف 1'}</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0284c7' }}>{analysis.independent.cohort1.meanPct}%</div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#94a3b8' }}>مقابل</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '11px', color: '#7c3aed' }}>{exam2.teacherName || 'الطرف 2'}</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#7c3aed' }}>{analysis.independent.cohort2.meanPct}%</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: analysis.independent.meanDiff >= 0 ? '#f0fdf4' : '#fef2f2',
                        color: analysis.independent.meanDiff >= 0 ? '#166534' : '#991b1b',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        الفارق في الأداء: {analysis.independent.meanDiff >= 0 ? `+${analysis.independent.meanDiff}%` : `${analysis.independent.meanDiff}%`}
                      </div>
                    </div>

                    {/* Card 2: Pass Rate */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                        نسبة النجاح والاجتياز (≥ 50%)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0284c7' }}>{analysis.independent.cohort1.passCount}/{analysis.independent.cohort1.totalTested} طالب</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#16a34a' }}>{analysis.independent.cohort1.passRate}%</div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#94a3b8' }}>مقابل</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '11px', color: '#7c3aed' }}>{analysis.independent.cohort2.passCount}/{analysis.independent.cohort2.totalTested} طالب</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#16a34a' }}>{analysis.independent.cohort2.passRate}%</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        color: '#475569',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        فارق نسبة النجاح: {analysis.independent.passDiff >= 0 ? `+${analysis.independent.passDiff}%` : `${analysis.independent.passDiff}%`}
                      </div>
                    </div>

                    {/* Card 3: Mastery Rate */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                        نسبة الإتقان والتفوق (≥ 85%)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0284c7' }}>{analysis.independent.cohort1.masteryCount} طالب</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0284c7' }}>{analysis.independent.cohort1.masteryRate}%</div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#94a3b8' }}>مقابل</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '11px', color: '#7c3aed' }}>{analysis.independent.cohort2.masteryCount} طالب</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#7c3aed' }}>{analysis.independent.cohort2.masteryRate}%</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        color: '#475569',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        فارق التفوق: {analysis.independent.masteryDiff >= 0 ? `+${analysis.independent.masteryDiff}%` : `${analysis.independent.masteryDiff}%`}
                      </div>
                    </div>

                    {/* Card 4: Struggling Rate */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                        نسبة التعثر والحاجة للدعم (&lt; 50%)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0284c7' }}>{analysis.independent.cohort1.strugglingCount} طالب</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#dc2626' }}>{analysis.independent.cohort1.strugglingRate}%</div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#94a3b8' }}>مقابل</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '11px', color: '#7c3aed' }}>{analysis.independent.cohort2.strugglingCount} طالب</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#dc2626' }}>{analysis.independent.cohort2.strugglingRate}%</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}>
                        فارق التعثر: {analysis.independent.strugglingDiff >= 0 ? `+${analysis.independent.strugglingDiff}%` : `${analysis.independent.strugglingDiff}%`}
                      </div>
                    </div>

                    {/* Card 5: Standard Deviation */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                        الانحراف المعياري (تشتت وتجانس الطلاب)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0284c7' }}>SD 1</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#334155' }}>{analysis.independent.cohort1.stdDev}</div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#94a3b8' }}>مقابل</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '11px', color: '#7c3aed' }}>SD 2</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#334155' }}>{analysis.independent.cohort2.stdDev}</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: '11px',
                        textAlign: 'center'
                      }}>
                        {analysis.independent.cohort1.stdDevNum < analysis.independent.cohort2.stdDevNum 
                          ? `فصول ${exam1.teacherName || 'الطرف 1'} أكثر تجانساً وتقارباً` 
                          : `فصول ${exam2.teacherName || 'الطرف 2'} أكثر تجانساً وتقارباً`}
                      </div>
                    </div>

                    {/* Card 6: Difficulty Index */}
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                        معامل سهولة وصعوبة الاختبار (P-Value)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0284c7' }}>سهولة 1</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0e7490' }}>{analysis.independent.cohort1.difficultyIndex}</div>
                        </div>
                        <div style={{ fontSize: '18px', color: '#94a3b8' }}>مقابل</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '11px', color: '#7c3aed' }}>سهولة 2</div>
                          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0e7490' }}>{analysis.independent.cohort2.difficultyIndex}</div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '10px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: '11px',
                        textAlign: 'center'
                      }}>
                        المدى المثالي لمعامل السهولة: (0.40 - 0.70)
                      </div>
                    </div>

                  </div>

                  {/* 2. Statistical Significance Card (Welch's t-Test & Effect Size) */}
                  <div className="print-avoid-break" style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    borderRadius: '12px',
                    border: '1.5px solid #86efac',
                    padding: '18px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}>
                    <div style={{ flex: '1 1 320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Sparkles size={20} color="#16a34a" />
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#166534' }}>
                          اختبار الدلالة الإحصائية للفروق بين المجموعتين (Independent Samples t-Test)
                        </h4>
                      </div>
                      <div style={{ fontSize: '13px', color: '#14532d', lineHeight: '1.5' }}>
                        {analysis.independent.tTest.verdict}
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                        قيمة t المحسوبة: <strong>{analysis.independent.tTest.tValue}</strong> | درجات الحرية (df): <strong>{analysis.independent.tTest.df}</strong>
                      </div>
                    </div>

                    <div style={{
                      background: '#ffffff',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: '1px solid #86efac',
                      textAlign: 'center',
                      minWidth: '200px'
                    }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>حجم الأثر (Cohen's d)</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#15803d' }}>d = {analysis.independent.cohensD}</div>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>{analysis.independent.effectLabel}</div>
                    </div>
                  </div>

                  {/* 3. Visual Side-by-Side Grade Distribution Bars */}
                  <div className="print-avoid-break" style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart2 size={18} color="#0e7490" />
                      مقارنة توزيع التقديرات والمستويات التحصيلية بين الاختبارين
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {[
                        { key: 'excellent', label: 'ممتاز (90 - 100%)', color: '#16a34a' },
                        { key: 'veryGood', label: 'جيد جداً (80 - 89%)', color: '#0284c7' },
                        { key: 'good', label: 'جيد (70 - 79%)', color: '#6366f1' },
                        { key: 'pass', label: 'مقبول (50 - 69%)', color: '#d97706' },
                        { key: 'failed', label: 'ضعيف / غير مجتاز (< 50%)', color: '#dc2626' }
                      ].map(level => {
                        const dist1 = analysis.independent.cohort1.gradeDistribution[level.key];
                        const dist2 = analysis.independent.cohort2.gradeDistribution[level.key];

                        return (
                          <div key={level.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>
                              <span>{level.label}</span>
                              <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                                <span style={{ color: '#0284c7' }}>
                                  {exam1.teacherName || 'الطرف 1'}: {dist1.count} طالب ({dist1.rate}%)
                                </span>
                                <span style={{ color: '#7c3aed' }}>
                                  {exam2.teacherName || 'الطرف 2'}: {dist2.count} طالب ({dist2.rate}%)
                                </span>
                              </div>
                            </div>

                            {/* Dual Bars */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {/* Bar 1 */}
                              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${dist1.rate}%`, height: '100%', background: '#0284c7', borderRadius: '4px', transition: 'width 0.4s' }} />
                              </div>
                              {/* Bar 2 */}
                              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${dist2.rate}%`, height: '100%', background: '#7c3aed', borderRadius: '4px', transition: 'width 0.4s' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Smart Leadership Verdict & Pedagogical Insights for Principal */}
                  <div className="print-avoid-break" style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1.5px solid #cbd5e1'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Award size={18} color="#0e7490" />
                        {analysis.independent.verdict.title}
                      </h4>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'white',
                        background: analysis.independent.verdict.statusColor
                      }}>
                        {analysis.independent.verdict.statusBadge}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {analysis.independent.verdict.points.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#334155' }}>
                          <CheckCircle2 size={16} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>
                        📌 توصيات وتوجيهات المدير القيادية:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {analysis.independent.verdict.recommendations.map((rec, idx) => (
                          <div key={idx} style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#0e7490' }}>•</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  VIEW B: PAIRED BIVARIATE CORRELATION & GROWTH (للطلاب المشتركين)
              ───────────────────────────────────────────────────────────── */}
              {analysis.hasPaired && (viewTab === 'paired' || printScope === 'all') && (
                <div 
                  className={`print-page-break ${printScope === 'all' && viewTab !== 'paired' ? 'print-only-flex' : ''}`}
                  style={{ 
                    display: (printScope === 'all' && viewTab !== 'paired') ? undefined : 'flex', 
                    flexDirection: 'column', 
                    gap: '20px' 
                  }}
                >

                  {/* 1. Core Correlation Metrics Cards */}
                  <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                    
                    {/* Pearson r Card */}
                    <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1.5px solid #86efac', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534' }}>
                        معامل ارتباط بيرسون (Pearson r)
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', margin: '4px 0', fontWeight: 'bold' }}>
                        🎯 المدى المناسب: (0.70 - 0.90)
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '900', color: analysis.pearson.color, margin: '2px 0' }}>
                        {analysis.pearson.r}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: analysis.pearson.color }}>
                        {analysis.pearson.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
                        {analysis.pearson.pedagogicalMeaning}
                      </div>
                    </div>

                    {/* Spearman rs Card */}
                    <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1.5px solid #7dd3fc', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>
                        معامل ارتباط الرتب (Spearman rs)
                      </div>
                      <div style={{ fontSize: '11px', color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', margin: '4px 0', fontWeight: 'bold' }}>
                        مقاوم للقيم الشاذة والمتطرفة
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '900', color: '#0284c7', margin: '2px 0' }}>
                        {analysis.spearman.rs}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>
                        {analysis.spearman.interpretation}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
                        يقيس التوافق في ترتيب ورتب الطلاب بين الاختبارين
                      </div>
                    </div>

                    {/* Coefficient of Determination R² Card */}
                    <div style={{ background: '#faf5ff', padding: '16px', borderRadius: '12px', border: '1.5px solid #d8b4fe', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#6b21a8' }}>
                        معامل التحديد والتباين المشترك (R²)
                      </div>
                      <div style={{ fontSize: '11px', color: '#7c3aed', background: '#f3e8ff', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', margin: '4px 0', fontWeight: 'bold' }}>
                        نسبة التباين المفسر
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '900', color: '#7c3aed', margin: '2px 0' }}>
                        {analysis.pearson.rSquared}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b21a8' }}>
                        تباين مشترك بين درجات الاختبارين
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
                        نسبة التغير في درجات الاختبار الثاني الناتجة مباشرة عن أداء الاختبار الأول
                      </div>
                    </div>

                    {/* Significance & Criterion Validity Card */}
                    <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '12px', border: '1.5px solid #fde68a', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>
                        الدلالة والصدق التلازمي (Validity)
                      </div>
                      <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', margin: '4px 0', fontWeight: 'bold' }}>
                        {analysis.pearson.isSignificant ? '✅ دال إحصائياً' : '⚠️ غير دال'}
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: '#b45309', margin: '6px 0' }}>
                        t = {analysis.pearson.tStat}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e' }}>
                        {analysis.pearson.significanceText}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
                        يثبت صلاحية الاختبار كـ "محك موثوق" للتنبؤ بمستوى الطلاب مستقبلاً
                      </div>
                    </div>

                  </div>

                  {/* 2. Learning Gain & Growth Breakdown */}
                  <div className="print-avoid-break" style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={18} color="#0e7490" />
                        مؤشر نماء التعلم والتقدم التحصيلي (Learning Gain & Effect Size)
                      </h4>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0e7490' }}>
                        متوسط تغير الأداء العام: <strong>{analysis.growth.avgGainPct}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ArrowUpRight size={32} color="#16a34a" />
                        <div>
                          <div style={{ fontSize: '12px', color: '#166534', fontWeight: 'bold' }}>متحسنون (ارتفاع ≥ +5%)</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d' }}>
                            {analysis.growth.improvedCount} طالب <span style={{ fontSize: '13px', fontWeight: 'normal' }}>({analysis.growth.improvedRate}%)</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Minus size={32} color="#d97706" />
                        <div>
                          <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 'bold' }}>مستقرون (بين -5% و +5%)</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#b45309' }}>
                            {analysis.growth.stableCount} طالب <span style={{ fontSize: '13px', fontWeight: 'normal' }}>({analysis.growth.stableRate}%)</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ArrowDownRight size={32} color="#dc2626" />
                        <div>
                          <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 'bold' }}>متراجعون (انخفاض ≤ -5%)</div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#b91c1c' }}>
                            {analysis.growth.declinedCount} طالب <span style={{ fontSize: '13px', fontWeight: 'normal' }}>({analysis.growth.declinedRate}%)</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>حجم الأثر التدريسي (Cohen's d)</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>d = {analysis.growth.cohensD}</div>
                        <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 'bold' }}>{analysis.growth.effectSizeLabel}</div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Interactive Scatter Plot & Regression Trendline */}
                  <div className="print-avoid-break" style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart2 size={18} color="#0e7490" />
                        مخطط الانتشار البصري وخط الانحدار الخطي (Scatter Plot & Regression Trendline)
                      </h4>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        معادلة خط الانحدار: <strong style={{ color: '#0284c7' }}>{analysis.regression.formula}</strong>
                      </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%', height: '320px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <svg width="100%" height="100%" viewBox="0 0 500 300" preserveAspectRatio="none" style={{ display: 'block' }}>
                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map(val => {
                          const y = 270 - (val * 2.4);
                          const x = 40 + (val * 4.4);
                          return (
                            <g key={val}>
                              <line x1="40" y1={y} x2="480" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x="32" y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{val}%</text>

                              <line x1={x} y1="270" x2={x} y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x={x} y="286" fontSize="10" fill="#94a3b8" textAnchor="middle">{val}%</text>
                            </g>
                          );
                        })}

                        {/* 45-degree Identity Line (y = x) */}
                        <line x1="40" y1="270" x2="480" y2="30" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 5" />
                        <text x="470" y="44" fontSize="9" fill="#94a3b8" textAnchor="end">خط التطابق (Y = X)</text>

                        {/* Linear Regression Line */}
                        {(() => {
                          const x0 = 0;
                          const y0 = analysis.regression.predict(x0);
                          const x100 = 100;
                          const y100 = analysis.regression.predict(x100);

                          const svgX0 = 40 + (x0 * 4.4);
                          const svgY0 = 270 - (y0 * 2.4);
                          const svgX100 = 40 + (x100 * 4.4);
                          const svgY100 = 270 - (y100 * 2.4);

                          return (
                            <line
                              x1={svgX0}
                              y1={svgY0}
                              x2={svgX100}
                              y2={svgY100}
                              stroke="#0284c7"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                          );
                        })()}

                        {/* Data Points */}
                        {analysis.pairedStudents.map((st, idx) => {
                          const cx = 40 + (st.pct1 * 4.4);
                          const cy = 270 - (st.pct2 * 2.4);
                          const color = st.status === 'improved' ? '#16a34a' : st.status === 'declined' ? '#dc2626' : '#0284c7';

                          return (
                            <circle
                              key={st.studentId || idx}
                              cx={cx}
                              cy={cy}
                              r="5.5"
                              fill={color}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                            >
                              <title>{`${st.studentName}\nالاختبار 1: ${st.score1} من ${st.max1} (${st.pct1}%)\nالاختبار 2: ${st.score2} من ${st.max2} (${st.pct2}%)\nالفارق: ${st.diffPct >= 0 ? '+' : ''}${st.diffPct}%`}</title>
                            </circle>
                          );
                        })}
                      </svg>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                      <span>المحور الأفقي (X): درجات {exam1.title} ({exam1.teacherName || 'معلم 1'})</span>
                      <span>المحور الرأسي (Y): درجات {exam2.title} ({exam2.teacherName || 'معلم 2'})</span>
                    </div>
                  </div>

                  {/* 4. Detailed Paired Students Table */}
                  <div className="print-avoid-break" style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} color="#0e7490" />
                        كشف مقارنة درجات الطلاب المقترنين ({filteredStudents.length} طالب)
                      </h4>

                      {/* Table Controls (Hidden on print) */}
                      <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', width: '180px' }}>
                          <input
                            type="text"
                            placeholder="بحث بالاسم أو الهوية..."
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            style={{ width: '100%', padding: '6px 28px 6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                          <Search size={14} color="#94a3b8" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>

                        <select
                          value={statusFilter}
                          onChange={e => setStatusFilter(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                        >
                          <option value="all">كافة الحالات</option>
                          <option value="improved">🟢 متحسنون فقط</option>
                          <option value="stable">🟡 مستقرون فقط</option>
                          <option value="declined">🔴 متراجعون فقط</option>
                        </select>

                        <select
                          value={studentSort}
                          onChange={e => setStudentSort(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white' }}
                        >
                          <option value="name_asc">الاسم أبجدياً (أ-ي)</option>
                          <option value="name_desc">الاسم عكسياً (ي-أ)</option>
                          <option value="gain_desc">الأعلى تحسناً أولاً</option>
                          <option value="gain_asc">الأكثر تراجعاً أولاً</option>
                          <option value="score1_desc">درجة الاختبار 1 الأعلى</option>
                          <option value="score2_desc">درجة الاختبار 2 الأعلى</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155', fontWeight: 'bold' }}>
                          <tr>
                            <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>#</th>
                            <th style={{ padding: '10px 12px' }}>اسم الطالب</th>
                            <th style={{ padding: '10px 12px' }}>رقم الهوية</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', background: '#f0fdf4' }}>درجة {exam1.title} (X)</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', background: '#eff6ff' }}>درجة {exam2.title} (Y)</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>فارق النسبة (Δ)</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>مستوى التقدم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                                لا توجد سجلات مطابقة للبحث أو التصفية
                              </td>
                            </tr>
                          ) : (
                            filteredStudents.map((st, idx) => (
                              <tr key={st.studentId || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>{st.studentName}</td>
                                <td style={{ padding: '10px 12px', color: '#64748b' }}>{st.nationalId || '-'}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', background: '#f0fdf4', fontWeight: 'bold', color: '#166534' }}>
                                  {st.score1} من {st.max1} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>({st.pct1}%)</span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', background: '#eff6ff', fontWeight: 'bold', color: '#1d4ed8' }}>
                                  {st.score2} من {st.max2} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>({st.pct2}%)</span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: st.statusColor }}>
                                  {st.diffPct >= 0 ? `+${st.diffPct}%` : `${st.diffPct}%`}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: st.statusColor,
                                    background: st.status === 'improved' ? '#dcfce7' : st.status === 'declined' ? '#fee2e2' : '#fef3c7'
                                  }}>
                                    {st.statusLabel}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* 5. Official Signatures Section for Teachers, Supervisor, Principal */}
              <div className="print-avoid-break" style={{
                marginTop: '10px',
                padding: '24px 20px',
                background: 'white',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', color: '#1e293b', fontSize: '15px' }}>
                  الاعتماد والمصادقة الرسمية على تقرير مقارنة وتحليل الاختبارات المدرسية
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isSameTeacher ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
                  gap: '16px',
                  textAlign: 'center'
                }}>
                  {/* Teacher 1 */}
                  <div style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0e7490', marginBottom: '4px' }}>
                      {isSameTeacher ? 'معلم المادة' : `معلم 1: ${exam1.subject}`}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                      {exam1.teacherName || 'معلم المادة'}
                    </div>
                    <div style={{ marginTop: '16px', borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontSize: '11px', color: '#64748b' }}>
                      التوقيع: ..........................
                    </div>
                  </div>

                  {/* Teacher 2 (Only if different teacher) */}
                  {!isSameTeacher && (
                    <div style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px', background: '#f8fafc' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '4px' }}>
                        معلم 2: {exam2.subject}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                        {exam2.teacherName || 'معلم المادة'}
                      </div>
                      <div style={{ marginTop: '16px', borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        التوقيع: ..........................
                      </div>
                    </div>
                  )}

                  {/* Supervisor */}
                  <div style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7', marginBottom: '4px' }}>
                      المشرف التربوي / وكيل الشؤون
                    </div>
                    <div className="no-print">
                      <input
                        type="text"
                        value={supervisorName}
                        onChange={e => setSupervisorName(e.target.value)}
                        style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#0f172a',
                          textAlign: 'center',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed #cbd5e1',
                          width: '90%',
                          padding: '2px'
                        }}
                        title="انقر لتعديل اسم المشرف"
                      />
                    </div>
                    <div className="print-only" style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', textAlign: 'center', minHeight: '22px' }}>
                      {supervisorName || '..........................'}
                    </div>
                    <div style={{ marginTop: '16px', borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontSize: '11px', color: '#64748b' }}>
                      التوقيع: ..........................
                    </div>
                  </div>

                  {/* Principal */}
                  <div style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534', marginBottom: '4px' }}>مدير المدرسة</div>
                    <div className="no-print">
                      <input
                        type="text"
                        value={principalName}
                        onChange={e => setPrincipalName(e.target.value)}
                        style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#0f172a',
                          textAlign: 'center',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed #cbd5e1',
                          width: '90%',
                          padding: '2px'
                        }}
                        title="انقر لتعديل اسم مدير المدرسة"
                      />
                    </div>
                    <div className="print-only" style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', textAlign: 'center', minHeight: '22px' }}>
                      {principalName || '..........................'}
                    </div>
                    <div style={{ marginTop: '16px', borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontSize: '11px', color: '#64748b' }}>
                      الختم والتوقيع: ..........................
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#94a3b8' }}>
                  تقرير إحصائي ومقارنة معتمدة صادرة عبر منظومة الإدارة والقياس والتعلم الذكية • {new Date().toLocaleDateString('ar-SA')}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
