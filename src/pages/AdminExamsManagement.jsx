import React, { useState, useEffect, useMemo } from 'react';
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
  setDoc
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileSpreadsheet, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  BarChart2, 
  Sliders, 
  Award, 
  X, 
  RefreshCw
} from 'lucide-react';
import { 
  ACADEMIC_LEVELS, 
  STANDARD_SPECIALIZATIONS, 
  STANDARD_STAGES,
  computeClassExamStats
} from '../utils/examGradingEngine';

export default function AdminExamsManagement() {
  const { userData } = useAuth();
  const schoolId = userData?.schoolId || 'default_school_1';

  // Tabs: 'builder' | 'remedial_matrix' | 'analytics'
  const [activeTab, setActiveTab] = useState('builder');

  // Exams list from Firestore
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Remedial Matrix state
  const [remedialMatrix, setRemedialMatrix] = useState(ACADEMIC_LEVELS);
  const [editingLevel, setEditingLevel] = useState(null);
  const [matrixSaving, setMatrixSaving] = useState(false);

  // Exam Builder Modal state
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  // Form State
  const [examTitle, setExamTitle] = useState('');
  const [academicYear, setAcademicYear] = useState('1447هـ / 2026م');
  const [term, setTerm] = useState('الفصل الدراسي الثاني');
  const [targetStages, setTargetStages] = useState(['المرحلة الابتدائية', 'المرحلة المتوسطة']);
  const [allSpecializations, setAllSpecializations] = useState(true);
  const [selectedSpecializations, setSelectedSpecializations] = useState([]);
  const [allowTeacherSelectAnySubject, setAllowTeacherSelectAnySubject] = useState(true);
  const [coreSubjectMaxScore, setCoreSubjectMaxScore] = useState(20);
  const [customColumns, setCustomColumns] = useState([
    { id: 'c_part', key: 'participation', label: 'المشاركة والتفاعل الصفي', maxScore: 5 },
    { id: 'c_att', key: 'attendance', label: 'المواظبة والانضباط', maxScore: 5 },
    { id: 'c_work', key: 'worksheets', label: 'أوراق العمل والمهام الأدائية', maxScore: 10 },
    { id: 'c_hw', key: 'homework', label: 'الواجبات والأنشطة المنزلية', maxScore: 10 }
  ]);
  const [examStatus, setExamStatus] = useState('active'); // 'active' | 'draft' | 'closed'

  // Analytics State
  const [allGrades, setAllGrades] = useState([]);
  const [analyticsExamFilter, setAnalyticsExamFilter] = useState('all');

  // Realtime Listener for Exams
  useEffect(() => {
    const qExams = schoolId === 'ALL'
      ? collection(db, 'school_exams')
      : query(collection(db, 'school_exams'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qExams, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setExams(list);
      setLoading(false);
    }, err => {
      console.warn('School exams listener error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId]);

  // Realtime Listener for Custom Remedial Matrix
  useEffect(() => {
    const configDocRef = doc(db, 'exam_remedial_configs', schoolId);
    const unsub = onSnapshot(configDocRef, docSnap => {
      if (docSnap.exists() && Array.isArray(docSnap.data().levels)) {
        setRemedialMatrix(docSnap.data().levels);
      } else {
        setRemedialMatrix(ACADEMIC_LEVELS);
      }
    }, err => {
      console.warn('Remedial config listener notice:', err);
    });
    return () => unsub();
  }, [schoolId]);

  // Realtime Listener for all exam grades for analytics
  useEffect(() => {
    const qGrades = schoolId === 'ALL'
      ? collection(db, 'exam_grades_records')
      : query(collection(db, 'exam_grades_records'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qGrades, snap => {
      setAllGrades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.warn('Exam grades records listener notice:', err);
    });

    return () => unsub();
  }, [schoolId]);

  // Computed Total Max Score
  const totalMaxScore = useMemo(() => {
    const core = Number(coreSubjectMaxScore) || 0;
    const custom = customColumns.reduce((acc, col) => acc + (Number(col.maxScore) || 0), 0);
    return core + custom;
  }, [coreSubjectMaxScore, customColumns]);

  // Open Exam Modal for Create
  const handleOpenCreateModal = () => {
    setEditingExamId(null);
    setExamTitle('');
    setAcademicYear('1447هـ / 2026م');
    setTerm('الفصل الدراسي الثاني');
    setTargetStages(['المرحلة الابتدائية', 'المرحلة المتوسطة']);
    setAllSpecializations(true);
    setSelectedSpecializations(STANDARD_SPECIALIZATIONS);
    setAllowTeacherSelectAnySubject(true);
    setCoreSubjectMaxScore(20);
    setCustomColumns([
      { id: 'c_part', key: 'participation', label: 'المشاركة والتفاعل الصفي', maxScore: 5 },
      { id: 'c_att', key: 'attendance', label: 'المواظبة والانضباط', maxScore: 5 },
      { id: 'c_work', key: 'worksheets', label: 'أوراق العمل والمهام الأدائية', maxScore: 10 },
      { id: 'c_hw', key: 'homework', label: 'الواجبات والأنشطة المنزلية', maxScore: 10 }
    ]);
    setExamStatus('active');
    setShowExamModal(true);
  };

  // Open Exam Modal for Edit
  const handleOpenEditModal = (exam) => {
    setEditingExamId(exam.id);
    setExamTitle(exam.title || '');
    setAcademicYear(exam.academicYear || '1447هـ / 2026م');
    setTerm(exam.term || 'الفصل الدراسي الثاني');
    setTargetStages(exam.targetStages || []);
    setAllSpecializations(exam.targetSpecializations?.includes('ALL') || exam.targetSpecializations?.length === 0);
    setSelectedSpecializations(exam.targetSpecializations?.includes('ALL') ? STANDARD_SPECIALIZATIONS : (exam.targetSpecializations || []));
    setAllowTeacherSelectAnySubject(exam.allowTeacherSelectAnySubject !== false);
    setCoreSubjectMaxScore(exam.coreSubjectMaxScore || 20);
    setCustomColumns(exam.customColumns || []);
    setExamStatus(exam.status || 'active');
    setShowExamModal(true);
  };

  // Add Custom Column
  const handleAddCustomColumn = () => {
    const colIndex = customColumns.length + 1;
    const newCol = {
      id: `col_${Date.now()}`,
      key: `custom_col_${colIndex}`,
      label: `عمود تقييم مخصص ${colIndex}`,
      maxScore: 5
    };
    setCustomColumns([...customColumns, newCol]);
  };

  // Remove Custom Column
  const handleRemoveCustomColumn = (id) => {
    setCustomColumns(customColumns.filter(c => c.id !== id));
  };

  // Update Custom Column
  const handleUpdateCustomColumn = (id, field, value) => {
    setCustomColumns(customColumns.map(c => {
      if (c.id === id) {
        return { ...c, [field]: field === 'maxScore' ? Math.max(0, Number(value) || 0) : value };
      }
      return c;
    }));
  };

  // Toggle Stage
  const handleToggleStage = (stageName) => {
    if (targetStages.includes(stageName)) {
      setTargetStages(targetStages.filter(s => s !== stageName));
    } else {
      setTargetStages([...targetStages, stageName]);
    }
  };

  // Toggle Specialization
  const handleToggleSpecialization = (spec) => {
    if (selectedSpecializations.includes(spec)) {
      setSelectedSpecializations(selectedSpecializations.filter(s => s !== spec));
    } else {
      setSelectedSpecializations([...selectedSpecializations, spec]);
    }
  };

  // Save Exam (Create or Update)
  const handleSaveExam = async (e) => {
    e.preventDefault();
    if (!examTitle.trim()) {
      alert('يرجى كتابة اسم أو عنوان الاختبار');
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        schoolId,
        title: examTitle.trim(),
        academicYear: academicYear.trim(),
        term: term.trim(),
        targetStages,
        targetSpecializations: allSpecializations ? ['ALL'] : selectedSpecializations,
        allowTeacherSelectAnySubject,
        coreSubjectMaxScore: Number(coreSubjectMaxScore) || 20,
        customColumns: customColumns.map(col => ({
          id: col.id,
          key: col.key || `key_${col.id}`,
          label: col.label.trim(),
          maxScore: Number(col.maxScore) || 0
        })),
        totalMaxScore,
        status: examStatus,
        updatedAt: serverTimestamp()
      };

      if (editingExamId) {
        await updateDoc(doc(db, 'school_exams', editingExamId), payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = userData?.name || 'مدير قسم الاختبارات';
        await addDoc(collection(db, 'school_exams'), payload);
      }

      setShowExamModal(false);
      setEditingExamId(null);
    } catch (err) {
      console.error('Error saving school exam:', err);
      alert('حدث خطأ أثناء حفظ بيانات الاختبار');
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Exam
  const handleDeleteExam = async (id, title) => {
    if (!window.confirm(`هل أنت متأكد من حذف الاختبار "${title}"؟`)) return;
    try {
      await deleteDoc(doc(db, 'school_exams', id));
    } catch (err) {
      console.error('Error deleting exam:', err);
      alert('تعذر حذف الاختبار');
    }
  };

  // Save Custom Remedial Matrix to Firestore
  const handleSaveRemedialMatrix = async (updatedLevels) => {
    setMatrixSaving(true);
    try {
      await setDoc(doc(db, 'exam_remedial_configs', schoolId), {
        schoolId,
        levels: updatedLevels,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.name || 'مدير قسم الاختبارات'
      }, { merge: true });
      setRemedialMatrix(updatedLevels);
      setEditingLevel(null);
      alert('تم حفظ مصفوفة البرامج العلاجية بنجاح!');
    } catch (err) {
      console.error('Error saving remedial matrix:', err);
      alert('حدث خطأ أثناء حفظ مصفوفة البرامج العلاجية');
    } finally {
      setMatrixSaving(false);
    }
  };

  // Filtered Grades for Analytics
  const filteredGrades = useMemo(() => {
    if (analyticsExamFilter === 'all') return allGrades;
    return allGrades.filter(g => g.examId === analyticsExamFilter);
  }, [allGrades, analyticsExamFilter]);

  // Overall Stats
  const analyticsStats = useMemo(() => {
    return computeClassExamStats(filteredGrades, 100);
  }, [filteredGrades]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', direction: 'rtl' }}>
      
      {/* Page Header Banner */}
      <div className="glass-panel" style={{ 
        padding: '24px', 
        borderRadius: '16px', 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', 
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '14px', 
              background: 'rgba(255, 255, 255, 0.12)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <FileSpreadsheet size={30} color="#38bdf8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>نظام إدارة الاختبارات ورصد الدرجات والبرامج العلاجية</h1>
                <span style={{ 
                  background: 'rgba(56, 189, 248, 0.2)', 
                  color: '#38bdf8', 
                  padding: '2px 10px', 
                  borderRadius: '20px', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  إدارة قسم الاختبارات
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                إعداد الاختبارات المدرسية، تخصيص أعمدة الدرجات المرنة، التصنيف التلقائي إلى 8 مستويات أكاديمية، وتوليد الخطط العلاجية والإثرائية الذكية.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={handleOpenCreateModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={18} />
              <span>إنشاء اختبار مدرسي جديد</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Counters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '24px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px 18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>إجمالي الاختبارات المجهزة</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>{exams.length}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px 18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>سجلات الدرجات المرصودة</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ade80' }}>{allGrades.length}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px 18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>نسبة الاجتياز والتفوق العامة</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24' }}>
              {analyticsStats.passRate}%
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '14px 18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>طلاب بحاجة لبرامج علاجية</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>
              {analyticsStats.remedialCount} <span style={{ fontSize: '13px', fontWeight: 'normal', opacity: 0.8 }}>({analyticsStats.remedialRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('builder')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            background: activeTab === 'builder' ? '#0284c7' : 'transparent',
            color: activeTab === 'builder' ? 'white' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <Sliders size={18} />
          <span>إعداد وتخصيص الاختبارات ({exams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('remedial_matrix')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            background: activeTab === 'remedial_matrix' ? '#0284c7' : 'transparent',
            color: activeTab === 'remedial_matrix' ? 'white' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <Award size={18} />
          <span>مصفوفة المستويات الثمانية والبرامج العلاجية</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            background: activeTab === 'analytics' ? '#0284c7' : 'transparent',
            color: activeTab === 'analytics' ? 'white' : '#64748b',
            transition: 'all 0.2s'
          }}
        >
          <BarChart2 size={18} />
          <span>متابعة الرصد والتحليل الإحصائي</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: EXAM BUILDER & MANAGEMENT
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'builder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {loading ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw className="spin-slow" size={32} style={{ margin: '0 auto 12px' }} />
              <div>جاري تحميل اختبارات المدرسة...</div>
            </div>
          ) : exams.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '16px' }}>
              <FileSpreadsheet size={50} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>لا توجد اختبارات مجهزة بعد</h3>
              <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '450px', margin: '0 auto 20px' }}>
                ابدأ بإنشاء أول اختبار مدرسي وحدد الدرجة العظمى للمادة وأضف الأعمدة المخصصة كالمشاركة والحضور وأوراق العمل.
              </p>
              <button 
                onClick={handleOpenCreateModal}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={18} />
                <span>إعداد اختبار جديد الآن</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {exams.map(exam => (
                <div 
                  key={exam.id} 
                  className="glass-panel" 
                  style={{ 
                    borderRadius: '16px', 
                    padding: '20px', 
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}
                >
                  <div>
                    {/* Status badge & Term */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        padding: '3px 10px', 
                        borderRadius: '20px',
                        background: exam.status === 'active' ? '#ecfdf5' : '#f1f5f9',
                        color: exam.status === 'active' ? '#059669' : '#64748b',
                        border: `1px solid ${exam.status === 'active' ? '#a7f3d0' : '#cbd5e1'}`
                      }}>
                        {exam.status === 'active' ? '● نشط ومتاح للرصد' : exam.status === 'draft' ? 'مسودة' : 'مغلق / مؤرشف'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                        {exam.term} - {exam.academicYear}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>
                      {exam.title}
                    </h3>

                    {/* Total Max Score Highlight */}
                    <div style={{ 
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                      padding: '10px 14px', 
                      borderRadius: '10px', 
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px'
                    }}>
                      <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: 'bold' }}>الدرجة العظمى الكلية:</span>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#0284c7' }}>
                        {exam.totalMaxScore || 100} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>درجة</span>
                      </span>
                    </div>

                    {/* Columns Breakdown Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                        <span>اختبار المادة الأساسية (تحريري):</span>
                        <strong>{exam.coreSubjectMaxScore || 20} درجة</strong>
                      </div>
                      {(exam.customColumns || []).map((col, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                          <span>{col.label}:</span>
                          <strong>{col.maxScore} درجة</strong>
                        </div>
                      ))}
                    </div>

                    {/* Stages & Specializations badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(exam.targetStages || []).map((stage, idx) => (
                        <span key={idx} style={{ fontSize: '11px', background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '6px' }}>
                          {stage}
                        </span>
                      ))}
                      {exam.targetSpecializations?.includes('ALL') ? (
                        <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                          كافة التخصصات والمواد
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '6px' }}>
                          {(exam.targetSpecializations || []).length} مواد مخصصة
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      بواسطة: {exam.createdBy || 'المدير'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleOpenEditModal(exam)}
                        style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit size={14} />
                        <span>تعديل</span>
                      </button>

                      <button 
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                        title="حذف الاختبار"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: 8 REMEDIAL LEVELS MATRIX
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'remedial_matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', background: 'var(--color-bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#0f172a' }}>
                  مصفوفة المستويات الأكاديمية الثمانية والبرامج العلاجية التلقائية
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  يقوم النظام بتصنيف درجات الطلاب آلياً إلى أحد المستويات الثمانية فور إدخال المعلم للدرجة، وتوليد الخطة العلاجية أو الإثرائية المقترحة. يمكن لمدير الاختبارات تخصيص التوصيات لكل مستوى.
                </p>
              </div>

              <button 
                onClick={() => handleSaveRemedialMatrix(ACADEMIC_LEVELS)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                استعادة الضبط الافتراضي للمستويات
              </button>
            </div>

            {/* 8 Levels Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {remedialMatrix.map((lvl) => (
                <div 
                  key={lvl.code}
                  style={{
                    borderRadius: '14px',
                    border: `2px solid ${lvl.borderColor}`,
                    background: lvl.bgColor,
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <div>
                    {/* Header: Level Name, Symbol, Percentage */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '8px', 
                          background: lvl.color, 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: '13px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          {lvl.symbol}
                        </span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: lvl.color }}>
                            {lvl.id}. {lvl.name}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                            {lvl.typeLabel}
                          </span>
                        </div>
                      </div>

                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: '900', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        background: 'white', 
                        color: lvl.color,
                        border: `1px solid ${lvl.borderColor}`
                      }}>
                        {lvl.minPercentage}% - {lvl.maxPercentage}%
                      </span>
                    </div>

                    {/* Program Title */}
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '6px' }}>
                      {lvl.defaultTitle}
                    </div>

                    {/* Diagnosis */}
                    <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                      {lvl.diagnosis}
                    </p>

                    {/* Action Plan Points Preview */}
                    <div style={{ background: 'white', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${lvl.borderColor}`, fontSize: '11px', color: '#334155' }}>
                      <strong style={{ display: 'block', marginBottom: '6px', color: lvl.color }}>أبرز بنود الخطة:</strong>
                      <ul style={{ margin: 0, paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(lvl.actionPlan || []).slice(0, 3).map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Edit Level Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: `1px dashed ${lvl.borderColor}`, paddingTop: '10px' }}>
                    <button 
                      onClick={() => setEditingLevel({ ...lvl })}
                      style={{
                        background: 'white',
                        border: `1px solid ${lvl.borderColor}`,
                        color: lvl.color,
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Edit size={14} />
                      <span>تخصيص الخطة والتوجيهات</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: MONITORING & ANALYTICS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>تصفية حسب الاختبار:</span>
              <select 
                value={analyticsExamFilter}
                onChange={(e) => setAnalyticsExamFilter(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '220px' }}
              >
                <option value="all">جميع الاختبارات المدرسية</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              إجمالي السجلات المرصودة المعروضة: <strong>{filteredGrades.length} سجل</strong>
            </div>
          </div>

          {/* 8-Level Distribution Visual Progress Bars */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--color-bg-card)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '18px' }}>
              التوزيع الإحصائي للطلاب عبر المستويات الثمانية
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {analyticsStats.levelsDistribution.map(lvl => (
                <div key={lvl.code} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: lvl.color }} />
                      <strong style={{ color: lvl.color }}>{lvl.name} ({lvl.symbol})</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>[{lvl.minPercentage}% - {lvl.maxPercentage}%]</span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
                      {lvl.count} طالب ({lvl.percentage}%)
                    </div>
                  </div>

                  {/* Progress bar container */}
                  <div style={{ width: '100%', height: '10px', borderRadius: '6px', background: '#f1f5f9', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${lvl.percentage}%`, 
                        height: '100%', 
                        background: lvl.color, 
                        borderRadius: '6px',
                        transition: 'width 0.5s ease-in-out'
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Graded Students Detailed Table */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', marginBottom: '14px' }}>
              كشف سجلات الرصد المباشرة والبرامج المخصصة
            </h3>

            {filteredGrades.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                لا توجد سجلات درجات مرصودة ضمن الفلتر المختار
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '12px' }}>اسم الطالب</th>
                    <th style={{ padding: '12px' }}>الصف</th>
                    <th style={{ padding: '12px' }}>المادة</th>
                    <th style={{ padding: '12px' }}>المعلم الراصد</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>المجموع / النسبة</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>المستوى (من 8)</th>
                    <th style={{ padding: '12px' }}>البرنامج الموجه</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrades.slice(0, 50).map(rec => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                        {rec.studentName}
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>{rec.studentNationalId}</div>
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>{rec.className}</td>
                      <td style={{ padding: '12px', color: '#0284c7', fontWeight: 'bold' }}>{rec.subject}</td>
                      <td style={{ padding: '12px', color: '#475569' }}>{rec.teacherName}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <strong style={{ fontSize: '14px' }}>{rec.totalScore}</strong> / {rec.maxScore}
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{rec.percentage}%</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '3px 10px', 
                          borderRadius: '12px', 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          background: rec.levelBgColor || '#f1f5f9', 
                          color: rec.levelColor || '#334155',
                          border: `1px solid ${rec.levelBorderColor || '#cbd5e1'}`
                        }}>
                          {rec.levelName} ({rec.levelSymbol})
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: '#334155', maxWidth: '240px' }}>
                        {rec.remedialProgram?.title || 'خطة المتابعة المنهجية'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: CREATE / EDIT EXAM
      ───────────────────────────────────────────────────────────── */}
      {showExamModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            direction: 'rtl'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 'bold', color: '#0f172a' }}>
                  {editingExamId ? 'تعديل بيانات وإعدادات الاختبار' : 'إنشاء اختبار مدرسي جديد وتخصيص الأعمدة'}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  حدد اسم الاختبار، الدرجة العظمى للمادة، وأضف الأعمدة المرنة كالمشاركة والحضور وأوراق العمل.
                </p>
              </div>
              <button 
                onClick={() => setShowExamModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Exam Title */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>
                  اسم الاختبار المعتمد *
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="مثال: اختبار الفترة الأولى - الفصل الدراسي الثاني 1447هـ"
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Term & Year Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>الفصل الدراسي</label>
                  <select 
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="الفصل الدراسي الأول">الفصل الدراسي الأول</option>
                    <option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني</option>
                    <option value="الفصل الدراسي الثالث">الفصل الدراسي الثالث</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>العام الدراسي</label>
                  <input 
                    type="text" 
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>حالة الاختبار</label>
                  <select 
                    value={examStatus}
                    onChange={(e) => setExamStatus(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="active">نشط (متاح للرصد للمعلمين)</option>
                    <option value="draft">مسودة إدارية (مغلق مؤقتاً)</option>
                    <option value="closed">مغلق ومؤرشف</option>
                  </select>
                </div>
              </div>

              {/* Target Stages */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                  المراحل التعليمية المستهدفة
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {STANDARD_STAGES.map(stage => {
                    const isSelected = targetStages.includes(stage.name);
                    return (
                      <button
                        type="button"
                        key={stage.id}
                        onClick={() => handleToggleStage(stage.name)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : '#f8fafc',
                          color: isSelected ? '#0284c7' : '#64748b',
                          border: `1px solid ${isSelected ? '#38bdf8' : '#e2e8f0'}`
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{stage.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specializations Settings */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                    التخصصات والمواد المتاحة للرصد
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0284c7', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input 
                      type="checkbox" 
                      checked={allSpecializations}
                      onChange={(e) => setAllSpecializations(e.target.checked)}
                    />
                    <span>إتاحة كافة المواد والتخصصات المدرسية</span>
                  </label>
                </div>

                {!allSpecializations && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {STANDARD_SPECIALIZATIONS.map(spec => {
                      const isSel = selectedSpecializations.includes(spec);
                      return (
                        <button
                          type="button"
                          key={spec}
                          onClick={() => handleToggleSpecialization(spec)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            background: isSel ? '#0284c7' : 'white',
                            color: isSel ? 'white' : '#475569',
                            border: '1px solid #cbd5e1'
                          }}
                        >
                          {spec}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Teacher permission toggle */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={allowTeacherSelectAnySubject}
                      onChange={(e) => setAllowTeacherSelectAnySubject(e.target.checked)}
                    />
                    <span>السماح للمعلم باختيار أي مادة من القائمة (بدلاً من حصرها على تخصصه المسجل فقط)</span>
                  </label>
                </div>
              </div>

              {/* ─── SCORES & CUSTOM COLUMNS BUILDER ─── */}
              <div style={{ border: '2px solid #e0f2fe', background: '#f0f9ff', padding: '18px', borderRadius: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0369a1' }}>
                      تحديد الدرجة العظمى والأعمدة المخصصة المرنة
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#0284c7' }}>
                      الدرجة العظمى الإجمالية تحسب تلقائياً = المادة الأساسية + الأعمدة المخصصة.
                    </p>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '11px', color: '#0284c7', display: 'block' }}>المجموع الكلي:</span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#0369a1' }}>
                      {totalMaxScore} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>درجة</span>
                    </span>
                  </div>
                </div>

                {/* Core Subject Score Input */}
                <div style={{ background: 'white', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>درجة اختبار المادة الأساسية (تحريري) *</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>العمود الأساسي للاختبار</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>الدرجة العظمى:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      value={coreSubjectMaxScore}
                      onChange={(e) => setCoreSubjectMaxScore(Number(e.target.value) || 0)}
                      required
                      style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #0284c7', fontWeight: 'bold', textAlign: 'center', fontSize: '14px' }}
                    />
                  </div>
                </div>

                {/* Custom Columns List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0369a1' }}>
                    الأعمدة المخصصة الإضافية (مشاركة، حضور، أوراق عمل...):
                  </div>

                  {customColumns.map((col, idx) => (
                    <div 
                      key={col.id} 
                      style={{ 
                        background: 'white', 
                        padding: '10px 14px', 
                        borderRadius: '10px', 
                        border: '1px solid #e2e8f0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: '12px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {idx + 1}
                        </span>
                        <input 
                          type="text" 
                          value={col.label}
                          onChange={(e) => handleUpdateCustomColumn(col.id, 'label', e.target.value)}
                          placeholder="مسمى العمود (مثال: أوراق العمل)"
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>الدرجة:</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="100"
                          value={col.maxScore}
                          onChange={(e) => handleUpdateCustomColumn(col.id, 'maxScore', e.target.value)}
                          style={{ width: '65px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'center', fontSize: '13px' }}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveCustomColumn(col.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="حذف هذا العمود"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button 
                    type="button"
                    onClick={handleAddCustomColumn}
                    style={{
                      background: 'white',
                      border: '1px dashed #0284c7',
                      color: '#0284c7',
                      borderRadius: '10px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={16} />
                    <span>إضافة عمود مخصص جديد</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowExamModal(false)}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', cursor: 'pointer', fontSize: '13px' }}
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={formSaving}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={16} />
                  <span>{formSaving ? 'جاري الحفظ...' : editingExamId ? 'حفظ التعديلات' : 'إنشاء الاختبار'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT REMEDIAL LEVEL PLAN
      ───────────────────────────────────────────────────────────── */}
      {editingLevel && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            direction: 'rtl'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: editingLevel.color }}>
                  تخصيص الخطة: {editingLevel.name} ({editingLevel.minPercentage}% - {editingLevel.maxPercentage}%)
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{editingLevel.typeLabel}</span>
              </div>
              <button 
                onClick={() => setEditingLevel(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                  عنوان البرنامج التلقائي
                </label>
                <input 
                  type="text" 
                  value={editingLevel.defaultTitle}
                  onChange={(e) => setEditingLevel({ ...editingLevel, defaultTitle: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                  التشخيص التربوي للمستوى
                </label>
                <textarea 
                  rows="2"
                  value={editingLevel.diagnosis}
                  onChange={(e) => setEditingLevel({ ...editingLevel, diagnosis: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                  بنود الخطة والأنشطة المقترحة (بند في كل سطر)
                </label>
                <textarea 
                  rows="4"
                  value={(editingLevel.actionPlan || []).join('\n')}
                  onChange={(e) => setEditingLevel({ 
                    ...editingLevel, 
                    actionPlan: e.target.value.split('\n').filter(line => line.trim().length > 0) 
                  })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: '1.5' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                  إرشادات وتوجيهات لولي الأمر في التقرير
                </label>
                <textarea 
                  rows="2"
                  value={editingLevel.parentAdvice}
                  onChange={(e) => setEditingLevel({ ...editingLevel, parentAdvice: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '10px' }}>
                <button 
                  onClick={() => setEditingLevel(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => {
                    const updated = remedialMatrix.map(m => m.code === editingLevel.code ? editingLevel : m);
                    handleSaveRemedialMatrix(updated);
                  }}
                  disabled={matrixSaving}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={14} />
                  <span>{matrixSaving ? 'جاري الحفظ...' : 'حفظ الخطة للمستوى'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
