import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Printer, TrendingUp, ArrowLeftRight, BarChart2, CheckCircle2, 
  AlertCircle, Sparkles, Filter, Search, Award, HelpCircle, Users, ArrowUpRight, ArrowDownRight, Minus, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  computeBivariateAnalysis, 
  interpretCorrelation 
} from '../utils/examCorrelationEngine';
import { sortStudentList } from '../utils/studentSorting';

export default function ExamCorrelationModal({
  isOpen,
  onClose,
  allExams = [],
  allExamResultsMap = {}, // map of examId -> results array
  initialExam1 = null,
  initialExam2 = null
}) {
  const { userData } = useAuth();

  const [selectedExamId1, setSelectedExamId1] = useState(initialExam1?.id || '');
  const [selectedExamId2, setSelectedExamId2] = useState(initialExam2?.id || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSort, setStudentSort] = useState('name_asc');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'improved' | 'stable' | 'declined'

  const [supervisorName, setSupervisorName] = useState(userData?.supervisorName || 'أ. أحمد المقدم');
  const [principalName, setPrincipalName] = useState(userData?.principalName || 'أ. أنس الجهني');

  // تخزين النتائج المسترجعة تلقائياً في حال لم يتم تمريرها مسبقاً
  const [fetchedResults, setFetchedResults] = useState({});
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // تحديث الاختبارات المختارة عند فتح النافذة
  useEffect(() => {
    if (initialExam1?.id) setSelectedExamId1(initialExam1.id);
    if (initialExam2?.id) setSelectedExamId2(initialExam2.id);
    else if (allExams.length >= 2 && !selectedExamId2) {
      const other = allExams.find(e => e.id !== (initialExam1?.id || selectedExamId1));
      if (other) setSelectedExamId2(other.id);
    }
  }, [initialExam1, initialExam2, allExams]);

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

  if (!isOpen) return null;

  const exam1 = allExams.find(e => e.id === selectedExamId1);
  const exam2 = allExams.find(e => e.id === selectedExamId2);

  const results1 = (exam1 && (allExamResultsMap[exam1.id] || fetchedResults[exam1.id])) || [];
  const results2 = (exam2 && (allExamResultsMap[exam2.id] || fetchedResults[exam2.id])) || [];

  // حساب التحليل التكاملي ومعامل الارتباط
  const analysis = useMemo(() => {
    if (!exam1 || !exam2) return null;
    return computeBivariateAnalysis(results1, results2, exam1, exam2);
  }, [exam1, exam2, results1, results2]);

  // تبديل موضعي الاختبارين (X <-> Y)
  const handleSwapExams = () => {
    const temp = selectedExamId1;
    setSelectedExamId1(selectedExamId2);
    setSelectedExamId2(temp);
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

  const handlePrint = () => {
    const origTitle = document.title;
    document.title = `تقرير_معامل_الارتباط_${(exam1?.title || 'اختبار1')}_و_${(exam2?.title || 'اختبار2')}`;
    window.print();
    setTimeout(() => { document.title = origTitle; }, 1000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      direction: 'rtl',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '92vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        
        {/* Top Header Toolbar (Hidden on print) */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={24} color="#38bdf8" />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                تحليل ومعامل الارتباط بين اختبارين (Bivariate Correlation & Growth Analysis)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#c7d2fe' }}>
                حساب معامل بيرسون وسبيرمان، الصدق التلازمي، التباين المشترك، ومؤشر نماء التعلم وحجم الأثر
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
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
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> طباعة التقرير والاعتماد
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
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Exam Selection Bar (Hidden on print) */}
          <div className="no-print" style={{
            background: '#f8fafc',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: '1 1 280px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                1. الاختبار الأول (المتغير المستقل X):
              </label>
              <select
                className="input-field"
                style={{ width: '100%', marginBottom: 0, padding: '8px 12px', fontSize: '13px', fontWeight: 'bold' }}
                value={selectedExamId1}
                onChange={e => setSelectedExamId1(e.target.value)}
              >
                <option value="">-- اختر الاختبار الأول --</option>
                {allExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} • {ex.subject} ({ex.targetClass})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSwapExams}
              title="تبديل ترتيب الاختبارين"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '18px'
              }}
            >
              <ArrowLeftRight size={18} color="#0e7490" />
            </button>

            <div style={{ flex: '1 1 280px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                2. الاختبار الثاني للمقارنة والصدق (المتغير التابع Y):
              </label>
              <select
                className="input-field"
                style={{ width: '100%', marginBottom: 0, padding: '8px 12px', fontSize: '13px', fontWeight: 'bold' }}
                value={selectedExamId2}
                onChange={e => setSelectedExamId2(e.target.value)}
              >
                <option value="">-- اختر الاختبار الثاني --</option>
                {allExams.map(ex => (
                  <option key={ex.id} value={ex.id} disabled={ex.id === selectedExamId1}>
                    {ex.title} • {ex.subject} ({ex.targetClass})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingResults && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#eef2ff', borderRadius: '10px', marginBottom: '16px' }}>
              <RefreshCw className="spin-slow" size={20} />
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>جاري استرجاع درجات الطلاب ومطابقة الاختبارين إحصائياً...</span>
            </div>
          )}

          {!analysis || !exam1 || !exam2 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <HelpCircle size={48} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
              <h4>يرجى اختيار اختبارين لبدء حساب معامل الارتباط وتحليل نمو التعلم</h4>
            </div>
          ) : analysis.totalPaired === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a', color: '#92400e' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 10px', color: '#d97706' }} />
              <h4 style={{ margin: '0 0 6px 0' }}>لا يوجد طلاب مشتركون اختبروا كلا الاختبارين</h4>
              <p style={{ margin: 0, fontSize: '13px' }}>
                تأكد من اختيار اختبارين تم تطبيقهما على نفس الفصل أو الطلاب المشتركين.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Printable Official Header (Only on print) */}
              <div className="print-only" style={{ display: 'none', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>تقرير التحليل السيكومتري ومعامل الارتباط بين اختبارين</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                      المملكة العربية السعودية • وزارة التعليم • منظومة الإدارة والقياس الذكي
                    </p>
                  </div>
                  <div style={{ textAlign: 'left', fontSize: '12px' }}>
                    <div>التاريخ: {new Date().toLocaleDateString('ar-SA')}</div>
                    <div>عدد الطلاب المشتركين: {analysis.totalPaired} طالب</div>
                  </div>
                </div>
              </div>

              {/* Comparison Header Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#0e7490', fontWeight: 'bold' }}>الاختبار الأول (X)</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{exam1.title}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>المادة: {exam1.subject} | الدرجة العظمى: {exam1.maxScore || 20} | المتوسط: {analysis.pearson.mean1}%</div>
                </div>

                <div style={{ fontSize: '20px', fontWeight: '900', color: '#4338ca' }}>مقارنة مع ⟷</div>

                <div>
                  <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold' }}>الاختبار الثاني (Y)</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{exam2.title}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>المادة: {exam2.subject} | الدرجة العظمى: {exam2.maxScore || 20} | المتوسط: {analysis.pearson.mean2}%</div>
                </div>

                <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#475569' }}>الطلاب المشتركون</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{analysis.totalPaired} طالب</div>
                </div>
              </div>

              {/* 1. Core Correlation Metrics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                
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

              {/* 2. Learning Gain & Growth Breakdown (مؤشر نماء التعلم وحجم الأثر) */}
              <div style={{
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

              {/* 3. Interactive Scatter Plot with Linear Regression Line */}
              <div style={{
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

                    {/* Linear Regression Line (y_hat = intercept + slope * x) */}
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

                    {/* Data Points for Paired Students */}
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
                  <span>المحور الأفقي (X): درجات {exam1.title}</span>
                  <span>المحور الرأسي (Y): درجات {exam2.title}</span>
                </div>
              </div>

              {/* 4. Detailed Paired Students Table */}
              <div style={{
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

              {/* 5. Official Signatures Section for Teacher, Supervisor, Principal */}
              <div style={{
                marginTop: '10px',
                padding: '24px 20px',
                background: 'white',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1'
              }}>
                <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', color: '#1e293b', fontSize: '15px' }}>
                  الاعتماد والمصادقة الرسمية على تقرير معامل الارتباط ومؤشرات نماء التعلم
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', textAlign: 'center' }}>
                  {/* 1. Teacher */}
                  <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>معلم المادة</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{exam1.teacherName || userData?.name || 'معلم المادة'}</div>
                    <div style={{ marginTop: '20px', borderTop: '1px dashed #94a3b8', paddingTop: '8px', fontSize: '12px', color: '#64748b' }}>
                      التوقيع: .......................................
                    </div>
                  </div>

                  {/* 2. Principal */}
                  <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534', marginBottom: '6px' }}>مدير المدرسة</div>
                    <input
                      type="text"
                      value={principalName}
                      onChange={e => setPrincipalName(e.target.value)}
                      style={{
                        fontSize: '15px',
                        fontWeight: 'bold',
                        color: '#0f172a',
                        textAlign: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px dashed #cbd5e1',
                        width: '90%',
                        padding: '4px'
                      }}
                      title="انقر لتعديل اسم مدير المدرسة"
                    />
                    <div style={{ marginTop: '20px', borderTop: '1px dashed #94a3b8', paddingTop: '8px', fontSize: '12px', color: '#64748b' }}>
                      الختم والتوقيع: .......................................
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#94a3b8' }}>
                  تقرير إحصائي معتمد صادر عبر منظومة الإدارة والقياس والتعلم الذكية • {new Date().toLocaleDateString('ar-SA')}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
