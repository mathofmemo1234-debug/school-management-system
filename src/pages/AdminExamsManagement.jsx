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
  setDoc,
  getDocs
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
  RefreshCw,
  Activity,
  Printer,
  ArrowUpDown,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Search
} from 'lucide-react';
import { 
  ACADEMIC_LEVELS, 
  STANDARD_SPECIALIZATIONS, 
  STANDARD_STAGES,
  computeClassExamStats
} from '../utils/examGradingEngine';
import { computePsychometrics } from '../utils/psychometricsEngine';
import PsychometricCharts from '../components/PsychometricCharts';
import { sortStudentList, STUDENT_SORT_OPTIONS } from '../utils/studentSorting';
import ExamCorrelationModal from '../components/ExamCorrelationModal';

export default function AdminExamsManagement() {
  const { userData } = useAuth();
  const schoolId = userData?.schoolId || 'default_school_1';

  // Tabs: 'builder' | 'remedial_matrix' | 'analytics'
  const [activeTab, setActiveTab] = useState('builder');

  // Exams list from Firestore
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dual Exam Correlation State
  const [showCorrelationModal, setShowCorrelationModal] = useState(false);
  const [correlationExam1, setCorrelationExam1] = useState(null);
  const [correlationExam2, setCorrelationExam2] = useState(null);

  // Remedial Matrix state
  const [remedialMatrix, setRemedialMatrix] = useState(ACADEMIC_LEVELS);
  const [editingLevel, setEditingLevel] = useState(null);
  const [matrixSaving, setMatrixSaving] = useState(false);

  // Delegation of Permissions for Supervisor & Staff
  const [allowSupervisorsToManageLevels, setAllowSupervisorsToManageLevels] = useState(false);
  const [allowStaffToManageLevels, setAllowStaffToManageLevels] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Roles & Permissions check
  const userRole = userData?.role || 'admin';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';
  const isSupervisor = userRole === 'supervisor';
  const isStaff = userRole === 'staff';
  const canManageLevels = isAdmin || (isSupervisor && allowSupervisorsToManageLevels) || (isStaff && allowStaffToManageLevels);

  // Set default tab for supervisor or staff to remedial_matrix
  useEffect(() => {
    if (!isAdmin && (isSupervisor || isStaff)) {
      setActiveTab('remedial_matrix');
    }
  }, [isAdmin, isSupervisor, isStaff]);

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
  const [analyticsSourceFilter, setAnalyticsSourceFilter] = useState('all'); // 'all' | 'teacher' | 'school'
  const [analyticsTeacherFilter, setAnalyticsTeacherFilter] = useState('all');
  const [analyticsSubjectFilter, setAnalyticsSubjectFilter] = useState('all');

  // Teacher Exams, Teachers & Results State for comprehensive admin analysis
  const [teacherExams, setTeacherExams] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [allTeacherResults, setAllTeacherResults] = useState([]);

  // Realtime Listener for School Exams
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

  // Realtime Listener for Teacher Exams (بنوك اختبارات المعلمين)
  useEffect(() => {
    const qTExams = schoolId === 'ALL'
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qTExams, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(`${b.examDate || ''}T${b.startTime || '00:00'}`) - new Date(`${a.examDate || ''}T${a.startTime || '00:00'}`));
      setTeacherExams(list);
    }, err => {
      console.warn('Teacher exams listener notice:', err);
    });

    return () => unsub();
  }, [schoolId]);

  // Fetch Teachers List
  useEffect(() => {
    const qT = schoolId === 'ALL'
      ? collection(db, 'teachers')
      : query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
    getDocs(qT).then(snap => {
      setTeachersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(err => {
      console.warn('Could not load teachers list:', err);
    });
  }, [schoolId]);

  // Realtime Listener for Teacher Exam Results
  useEffect(() => {
    const qResults = schoolId === 'ALL'
      ? collection(db, 'exam_results')
      : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qResults, snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          studentId: data.studentId || d.id,
          studentName: data.studentName,
          nationalId: data.studentNationalId || data.nationalId || '',
          score: data.totalScore !== undefined ? Number(data.totalScore) : (Number(data.score) || 0),
          totalScore: data.totalScore !== undefined ? Number(data.totalScore) : (Number(data.score) || 0),
          maxScore: data.maxScore || 20,
          isAbsent: Boolean(data.isAbsent || data.status === 'غائب' || data.score === 'غ' || data.score === 'غائب'),
          examId: data.examId,
          ...data
        };
      });
      setAllTeacherResults(list);
    }, err => {
      console.warn('Teacher exam results listener notice:', err);
    });

    return () => unsub();
  }, [schoolId]);

  // Combined exams (School + Teacher)
  const combinedExams = useMemo(() => {
    const sExams = exams.map(e => ({
      ...e,
      source: 'school',
      sourceType: 'الاختبارات المدرسية الموحدة',
      teacherName: e.teacherName || 'إدارة المدرسة'
    }));
    const tExams = teacherExams.map(e => ({
      ...e,
      source: 'teacher',
      sourceType: 'اختبارات المعلمين',
      teacherName: e.teacherName || 'معلم'
    }));
    return [...sExams, ...tExams];
  }, [exams, teacherExams]);

  // Realtime Listener for Custom Remedial Matrix and Permissions
  useEffect(() => {
    const configDocRef = doc(db, 'exam_remedial_configs', schoolId);
    const unsub = onSnapshot(configDocRef, docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.levels) && data.levels.length > 0) {
          setRemedialMatrix(data.levels);
        } else {
          setRemedialMatrix(ACADEMIC_LEVELS);
        }
        setAllowSupervisorsToManageLevels(Boolean(data.allowSupervisorsToManageLevels));
        setAllowStaffToManageLevels(Boolean(data.allowStaffToManageLevels));
      } else {
        setRemedialMatrix(ACADEMIC_LEVELS);
        setAllowSupervisorsToManageLevels(false);
        setAllowStaffToManageLevels(false);
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
    if (!canManageLevels) {
      alert('ليس لديك صلاحية لتعديل مصفوفة المستويات. يرجى التواصل مع مدير المدرسة.');
      return;
    }
    setMatrixSaving(true);
    try {
      // ترتيب المستويات تنازلياً حسب النسبة المئوية
      const sorted = [...updatedLevels].sort((a, b) => (Number(b.minPercentage) || 0) - (Number(a.minPercentage) || 0));
      await setDoc(doc(db, 'exam_remedial_configs', schoolId), {
        schoolId,
        levels: sorted,
        allowSupervisorsToManageLevels,
        allowStaffToManageLevels,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.name || 'مدير قسم الاختبارات'
      }, { merge: true });
      setRemedialMatrix(sorted);
      setEditingLevel(null);
      alert('تم حفظ مصفوفة البرامج العلاجية وتحديث المستويات بنجاح!');
    } catch (err) {
      console.error('Error saving remedial matrix:', err);
      alert('حدث خطأ أثناء حفظ مصفوفة البرامج العلاجية');
    } finally {
      setMatrixSaving(false);
    }
  };

  // Delete Level
  const handleDeleteLevel = (levelCode) => {
    if (!canManageLevels) {
      alert('ليس لديك صلاحية لتعديل أو حذف المستويات.');
      return;
    }
    if (remedialMatrix.length <= 1) {
      alert('يجب الإبقاء على مستوى واحد على الأقل في النظام.');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا المستوى الأكاديمي؟')) return;
    const filtered = remedialMatrix.filter(lvl => (lvl.code || `level_${lvl.id}`) !== levelCode);
    handleSaveRemedialMatrix(filtered);
  };

  // Add New Level
  const handleAddNewLevel = () => {
    if (!canManageLevels) {
      alert('ليس لديك صلاحية لإضافة مستويات.');
      return;
    }
    const newId = remedialMatrix.length + 1;
    const newLevel = {
      code: `level_custom_${Date.now()}`,
      id: newId,
      name: 'مستوى جديد',
      symbol: 'C+',
      minPercentage: 65,
      maxPercentage: 74.99,
      color: '#0284c7',
      bgColor: '#f0f9ff',
      borderColor: '#bae6fd',
      type: 'reinforcement',
      typeLabel: 'برنامج تعزيز ودعم المهارات',
      defaultTitle: 'برنامج تطوير المهارات الأكاديمية والارتقاء بالأداء',
      diagnosis: 'يظهر الطالب استيعاباً للمفاهيم الأساسية، مع وجود فرص للتطوير في المهارات التطبيقية.',
      actionPlan: [
        'تطبيق أوراق عمل تفاعلية على المهارات المستهدفة.',
        'متابعة حل التدريبات الصفية وتوجيه تغذية راجعة فورية.',
        'تشجيع الطالب على المشاركة المنتظمة.'
      ],
      parentAdvice: 'يرجى متابعة الطالب في المنزل وتنظيم أوقات المذاكرة والتعاون مع معلم المادة.',
      enTitle: 'Academic Development & Skills Reinforcement Program',
      enDiagnosis: 'Student shows a good understanding of core skills with opportunities to improve.',
      enActionPlan: [
        'Provide targeted practice worksheets.',
        'Follow up with classroom assignments and provide immediate feedback.',
        'Encourage active participation in daily lessons.'
      ],
      enParentAdvice: 'Please assist in organizing home study routines and communicate regularly with the subject teacher.'
    };
    setEditingLevel(newLevel);
  };

  // Toggle Permissions for Supervisor / Staff
  const handleTogglePermission = async (permKey, value) => {
    if (!isAdmin) {
      alert('فقط مدير المدرسة يملك صلاحية منح أو تعديل أذونات النظام.');
      return;
    }
    setSavingPermissions(true);
    try {
      await setDoc(doc(db, 'exam_remedial_configs', schoolId), {
        schoolId,
        [permKey]: value,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.name || 'مدير المدرسة'
      }, { merge: true });
      if (permKey === 'allowSupervisorsToManageLevels') setAllowSupervisorsToManageLevels(value);
      if (permKey === 'allowStaffToManageLevels') setAllowStaffToManageLevels(value);
      alert('تم تحديث الصلاحية بنجاح!');
    } catch (err) {
      console.error('Error updating permissions:', err);
      alert('حدث خطأ أثناء حفظ الصلاحية');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Available subjects for analytics filter
  const availableSubjects = useMemo(() => {
    const set = new Set();
    combinedExams.forEach(e => { if (e.subject) set.add(e.subject); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [combinedExams]);

  // Filtered displayed exams list for analytics
  const displayedAnalyticsExams = useMemo(() => {
    return combinedExams.filter(e => {
      if (analyticsSourceFilter !== 'all' && e.source !== analyticsSourceFilter) return false;
      if (analyticsTeacherFilter !== 'all' && (e.teacherId !== analyticsTeacherFilter && e.teacherName !== analyticsTeacherFilter)) return false;
      if (analyticsSubjectFilter !== 'all' && e.subject !== analyticsSubjectFilter) return false;
      return true;
    });
  }, [combinedExams, analyticsSourceFilter, analyticsTeacherFilter, analyticsSubjectFilter]);

  // Currently selected exam object in analytics
  const activeAnalyticsExam = useMemo(() => {
    if (analyticsExamFilter === 'all') return null;
    return combinedExams.find(e => e.id === analyticsExamFilter) || null;
  }, [combinedExams, analyticsExamFilter]);

  // Filtered Grades for Analytics
  const filteredGrades = useMemo(() => {
    if (analyticsExamFilter === 'all') {
      if (analyticsSourceFilter === 'teacher') return allTeacherResults;
      if (analyticsSourceFilter === 'school') return allGrades;
      return [...allGrades, ...allTeacherResults];
    }
    const isTeacher = activeAnalyticsExam?.source === 'teacher';
    if (isTeacher) {
      return allTeacherResults.filter(g => g.examId === analyticsExamFilter);
    }
    return allGrades.filter(g => g.examId === analyticsExamFilter);
  }, [analyticsExamFilter, activeAnalyticsExam, analyticsSourceFilter, allGrades, allTeacherResults]);

  // Overall Stats
  const analyticsStats = useMemo(() => {
    return computeClassExamStats(filteredGrades, 100);
  }, [filteredGrades]);

  // Analytics sub-tab & sorting
  const [analyticsSubTab, setAnalyticsSubTab] = useState('overview'); // 'overview' | 'psychometrics'
  const [studentSortBy, setStudentSortBy] = useState('default');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Computed Psychometrics for Selected Exam or All Exams (يعمل لأي اختبار لأي معلم أو مدرسة)
  const adminPsychometrics = useMemo(() => {
    if (!filteredGrades || filteredGrades.length === 0) return null;

    const maxScore = activeAnalyticsExam?.coreSubjectMaxScore || activeAnalyticsExam?.totalMaxScore || activeAnalyticsExam?.maxScore || 20;

    const results = filteredGrades.map(g => ({
      id: g.id,
      studentId: g.studentId || g.id,
      studentName: g.studentName,
      nationalId: g.studentNationalId || g.nationalId || '',
      score: g.totalScore !== undefined ? Number(g.totalScore) : Number(g.score) || 0,
      maxScore: g.maxScore || maxScore,
      percentage: g.percentage !== undefined ? Number(g.percentage) : 0,
      isAbsent: Boolean(g.isAbsent || g.status === 'غائب' || g.totalScore === 'غائب' || g.totalScore === 'غ' || g.score === 'غائب' || g.score === 'غ'),
      status: g.status,
      answers: g.answers || null
    }));

    return computePsychometrics({
      exam: {
        title: activeAnalyticsExam?.title || 'الاختبارات المدرسية الشاملة',
        subject: activeAnalyticsExam?.subject || 'جميع المواد',
        targetClass: activeAnalyticsExam?.className || activeAnalyticsExam?.targetClass || 'جميع الفصول',
        teacherName: activeAnalyticsExam?.teacherName || 'إدارة المدرسة',
        maxScore: maxScore,
        totalQuestions: activeAnalyticsExam?.totalQuestions || activeAnalyticsExam?.questions?.length || 10,
        questions: activeAnalyticsExam?.questions || []
      },
      results
    });
  }, [filteredGrades, activeAnalyticsExam]);

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
                تحليل أي اختبار لأي معلم، إجراء المقارنات الإحصائية بين المعلمين والفصول، والتصنيف التلقائي للطلاب مع الخطط العلاجية.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                setCorrelationExam1(null);
                setCorrelationExam2(null);
                setShowCorrelationModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.2s'
              }}
              title="مقارنة أي اختبارين لأي معلمين مختلفين أو نفس المعلم وحساب الفروق الإحصائية"
            >
              <TrendingUp size={18} color="#a5b4fc" />
              <span>مقارنة أي اختبارين (معلمين مختلفين / نفس المعلم)</span>
            </button>

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
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => {
                          setCorrelationExam1(exam);
                          setCorrelationExam2(null);
                          setShowCorrelationModal(true);
                        }}
                        style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="حساب معامل الارتباط ونماء التعلم مع اختبار آخر"
                      >
                        <TrendingUp size={14} color="#6366f1" />
                        <span>معامل الارتباط</span>
                      </button>

                      <button 
                        onClick={() => {
                          setAnalyticsExamFilter(exam.id);
                          setActiveTab('analytics');
                          setAnalyticsSubTab('psychometrics');
                        }}
                        style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="عرض التحليل السيكومتري وموثوقية القياس للاختبار"
                      >
                        <Activity size={14} />
                        <span>التحليل السيكومتري</span>
                      </button>

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
          
          {/* Permission Notice if user cannot manage levels */}
          {!canManageLevels && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px 18px', borderRadius: '12px', color: '#92400e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} color="#d97706" />
              <div>
                <strong>تنبيه الصلاحية:</strong> مصفوفة المستويات والبرامج العلاجية للقراءة فقط لحسابك الحالي. يمكن لمدير المدرسة منحك صلاحية التعديل من خلال لوحة تفويض الصلاحيات أدناه.
              </div>
            </div>
          )}

          {/* Admin Permissions Delegation Card */}
          {isAdmin && (
            <div className="glass-panel" style={{ 
              padding: '18px 22px', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
              border: '2px solid #bfdbfe'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={18} color="#2563eb" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#1e3a8a' }}>
                      تفويض صلاحيات إدارة المستويات والبرامج العلاجية
                    </h3>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    يمكنك كمدير للمدرسة منح صلاحية تعديل مسميات ونسب المستويات وإعداد الخطط للمشرف التربوي والكادر الإداري:
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: allowSupervisorsToManageLevels ? '#166534' : '#334155', 
                    cursor: 'pointer', 
                    background: allowSupervisorsToManageLevels ? '#f0fdf4' : 'white', 
                    padding: '8px 14px', 
                    borderRadius: '10px', 
                    border: `1px solid ${allowSupervisorsToManageLevels ? '#86efac' : '#cbd5e1'}` 
                  }}>
                    <input 
                      type="checkbox" 
                      checked={allowSupervisorsToManageLevels}
                      onChange={(e) => handleTogglePermission('allowSupervisorsToManageLevels', e.target.checked)}
                      disabled={savingPermissions}
                    />
                    <span>صلاحية المشرف التربوي (Supervisor)</span>
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: allowStaffToManageLevels ? '#166534' : '#334155', 
                    cursor: 'pointer', 
                    background: allowStaffToManageLevels ? '#f0fdf4' : 'white', 
                    padding: '8px 14px', 
                    borderRadius: '10px', 
                    border: `1px solid ${allowStaffToManageLevels ? '#86efac' : '#cbd5e1'}` 
                  }}>
                    <input 
                      type="checkbox" 
                      checked={allowStaffToManageLevels}
                      onChange={(e) => handleTogglePermission('allowStaffToManageLevels', e.target.checked)}
                      disabled={savingPermissions}
                    />
                    <span>صلاحية الكادر الإداري (Staff)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', background: 'var(--color-bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#0f172a' }}>
                  مصفوفة المستويات الأكاديمية والبرامج العلاجية ({remedialMatrix.length} مستويات)
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  تصنيف ديناميكي مرن: يمكنك تعديل التسميات، مدى الدرجات والنسب، الرموز، وإضافة أو حذف المستويات.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {canManageLevels && (
                  <button 
                    onClick={handleAddNewLevel}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                      border: 'none',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <Plus size={16} />
                    <span>إضافة مستوى جديد</span>
                  </button>
                )}

                {canManageLevels && (
                  <button 
                    onClick={() => {
                      if (window.confirm('هل أنت متأكد من استعادة الضبط الافتراضي للمستويات الثمانية؟')) {
                        handleSaveRemedialMatrix(ACADEMIC_LEVELS);
                      }
                    }}
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
                    استعادة الضبط الافتراضي
                  </button>
                )}
              </div>
            </div>

            {/* Levels Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {remedialMatrix.map((lvl, index) => (
                <div 
                  key={lvl.code || lvl.id || index}
                  style={{
                    borderRadius: '14px',
                    border: `2px solid ${lvl.borderColor || '#cbd5e1'}`,
                    background: lvl.bgColor || '#f8fafc',
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
                          background: lvl.color || '#0284c7', 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: '13px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          {lvl.symbol || 'L'}
                        </span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: lvl.color || '#0f172a' }}>
                            {lvl.name}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                            {lvl.typeLabel || (lvl.type === 'enrichment' ? 'برنامج إثرائي' : lvl.type === 'remedial' ? 'برنامج علاجي' : 'برنامج تعزيز')}
                          </span>
                        </div>
                      </div>

                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: '900', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        background: 'white', 
                        color: lvl.color || '#0284c7',
                        border: `1px solid ${lvl.borderColor || '#cbd5e1'}`
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
                    <div style={{ background: 'white', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${lvl.borderColor || '#e2e8f0'}`, fontSize: '11px', color: '#334155' }}>
                      <strong style={{ display: 'block', marginBottom: '6px', color: lvl.color || '#0284c7' }}>أبرز بنود الخطة:</strong>
                      <ul style={{ margin: 0, paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(lvl.actionPlan || []).slice(0, 3).map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actions (Edit / Delete) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px dashed ${lvl.borderColor || '#cbd5e1'}`, paddingTop: '10px' }}>
                    {canManageLevels && remedialMatrix.length > 1 ? (
                      <button
                        onClick={() => handleDeleteLevel(lvl.code || `level_${lvl.id}`)}
                        style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="حذف هذا المستوى"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    ) : <div />}

                    {canManageLevels ? (
                      <button 
                        onClick={() => setEditingLevel({ ...lvl })}
                        style={{
                          background: 'white',
                          border: `1px solid ${lvl.borderColor || '#cbd5e1'}`,
                          color: lvl.color || '#0284c7',
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
                        <span>تعديل المستوى والخطة</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>للقراءة فقط</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: MONITORING & ANALYTICS (مع التحليل السيكومتري)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              
              {/* Source Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>المصدر:</span>
                <select
                  value={analyticsSourceFilter}
                  onChange={e => {
                    setAnalyticsSourceFilter(e.target.value);
                    setAnalyticsExamFilter('all');
                  }}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white' }}
                >
                  <option value="all">كل المصادر (المعلم + الإدارة)</option>
                  <option value="teacher">👨‍🏫 بنك اختبارات المعلمين</option>
                  <option value="school">🏛️ الاختبارات المدرسية الموحدة</option>
                </select>
              </div>

              {/* Teacher Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>المعلم:</span>
                <select
                  value={analyticsTeacherFilter}
                  onChange={e => {
                    setAnalyticsTeacherFilter(e.target.value);
                    setAnalyticsExamFilter('all');
                  }}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white', maxWidth: '180px' }}
                >
                  <option value="all">كل المعلمين</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>{t.name || t.email}</option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>المادة:</span>
                <select
                  value={analyticsSubjectFilter}
                  onChange={e => {
                    setAnalyticsSubjectFilter(e.target.value);
                    setAnalyticsExamFilter('all');
                  }}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white' }}
                >
                  <option value="all">كل المواد</option>
                  {availableSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Exam Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e3a8a' }}>الاختبار المستهدف:</span>
                <select 
                  value={analyticsExamFilter}
                  onChange={(e) => setAnalyticsExamFilter(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #0284c7', fontSize: '12px', fontWeight: 'bold', minWidth: '240px', background: '#f0f9ff' }}
                >
                  <option value="all">كافة الاختبارات المجمعة</option>
                  {displayedAnalyticsExams.map(e => (
                    <option key={e.id} value={e.id}>
                      [{e.teacherName || 'معلم'}] • {e.title} • {e.subject} ({e.targetClass || e.className || 'عام'})
                    </option>
                  ))}
                </select>
              </div>

            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              السجلات المرصودة المعروضة: <strong style={{ color: '#0f172a' }}>{filteredGrades.length} سجل</strong>
            </div>
          </div>

          {/* Sub-tab Navigation: Overview vs Psychometrics */}
          <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setAnalyticsSubTab('overview')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                background: analyticsSubTab === 'overview' ? '#0f172a' : 'white',
                color: analyticsSubTab === 'overview' ? 'white' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Award size={18} />
              <span>1. كشف السجلات والمستويات الثمانية والبرامج المخصصة</span>
            </button>

            <button
              type="button"
              onClick={() => setAnalyticsSubTab('psychometrics')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #0e7490',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                background: analyticsSubTab === 'psychometrics' ? '#0e7490' : 'white',
                color: analyticsSubTab === 'psychometrics' ? 'white' : '#0e7490',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Activity size={18} />
              <span>2. 📊 التحليل السيكومتري وموثوقية القياس (KR-21 والرسوم البيانية)</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* SUB-TAB 1: OVERVIEW & 8-LEVELS DISTRIBUTION */}
          {/* ======================================================== */}
          {analyticsSubTab === 'overview' && (
            <>
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

              {/* Graded Students Detailed Table with Search & Sorting */}
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                    كشف سجلات الرصد المباشرة والبرامج المخصصة
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', width: '220px' }}>
                      <Search size={14} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="بحث بالاسم أو الهوية..."
                        value={studentSearchTerm}
                        onChange={e => setStudentSearchTerm(e.target.value)}
                        style={{ padding: '6px 28px 6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%' }}
                      />
                    </div>

                    {/* Sort Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ArrowUpDown size={14} color="#0e7490" />
                      <select
                        value={studentSortBy}
                        onChange={e => setStudentSortBy(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white' }}
                      >
                        {STUDENT_SORT_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {filteredGrades.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    لا توجد سجلات درجات مرصودة ضمن الفلتر المختار
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th 
                          style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setStudentSortBy(prev => prev === 'name_asc' ? 'name_desc' : 'name_asc')}
                          title="فرز حسب اسم الطالب"
                        >
                          اسم الطالب {studentSortBy === 'name_asc' ? '▲' : studentSortBy === 'name_desc' ? '▼' : '⇅'}
                        </th>
                        <th style={{ padding: '12px' }}>الصف</th>
                        <th style={{ padding: '12px' }}>المادة</th>
                        <th style={{ padding: '12px' }}>المعلم الراصد</th>
                        <th 
                          style={{ padding: '12px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => setStudentSortBy(prev => prev === 'score_desc' ? 'score_asc' : 'score_desc')}
                          title="فرز حسب الدرجة"
                        >
                          المجموع / النسبة {studentSortBy === 'score_desc' ? '▼' : studentSortBy === 'score_asc' ? '▲' : '⇅'}
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>المستوى (من 8)</th>
                        <th style={{ padding: '12px' }}>البرنامج الموجه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let records = filteredGrades.filter(r => {
                          if (!studentSearchTerm.trim()) return true;
                          const q = studentSearchTerm.trim().toLowerCase();
                          return (r.studentName && r.studentName.toLowerCase().includes(q)) ||
                                 (r.studentNationalId && String(r.studentNationalId).includes(q));
                        });

                        records = sortStudentList(records, studentSortBy);

                        return records.slice(0, 100).map(rec => {
                          const isAbsent = Boolean(rec.isAbsent || rec.status === 'غائب' || rec.totalScore === 'غائب' || rec.totalScore === 'غ');
                          return (
                            <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9', background: isAbsent ? '#fef2f2' : 'white' }}>
                              <td style={{ padding: '12px', fontWeight: 'bold', color: isAbsent ? '#991b1b' : '#0f172a' }}>
                                {rec.studentName}
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>{rec.studentNationalId}</div>
                              </td>
                              <td style={{ padding: '12px', color: '#475569' }}>{rec.className}</td>
                              <td style={{ padding: '12px', color: '#0284c7', fontWeight: 'bold' }}>{rec.subject}</td>
                              <td style={{ padding: '12px', color: '#475569' }}>{rec.teacherName}</td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                {isAbsent ? (
                                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                    غائب عن الاختبار 🚫
                                  </span>
                                ) : (
                                  <>
                                    <strong style={{ fontSize: '14px' }}>{rec.totalScore}</strong> / {rec.maxScore}
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{rec.percentage}%</div>
                                  </>
                                )}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{ 
                                  padding: '3px 10px', 
                                  borderRadius: '12px', 
                                  fontSize: '11px', 
                                  fontWeight: 'bold', 
                                  background: isAbsent ? '#fee2e2' : (rec.levelBgColor || '#f1f5f9'), 
                                  color: isAbsent ? '#991b1b' : (rec.levelColor || '#334155'),
                                  border: `1px solid ${isAbsent ? '#fecaca' : (rec.levelBorderColor || '#cbd5e1')}`
                                }}>
                                  {isAbsent ? 'غائب' : `${rec.levelName || 'المستوى'} (${rec.levelSymbol || '—'})`}
                                </span>
                              </td>
                              <td style={{ padding: '12px', fontSize: '12px', color: '#334155', maxWidth: '240px' }}>
                                {isAbsent ? 'متابعة أسباب الغياب وإعادة الاختبار' : (rec.remedialProgram?.title || 'خطة المتابعة المنهجية')}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* SUB-TAB 2: PSYCHOMETRIC & MEASUREMENT RELIABILITY ANALYSIS */}
          {/* ======================================================== */}
          {analyticsSubTab === 'psychometrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Header with Print Action */}
              <div style={{ 
                background: 'white', 
                padding: '20px 24px', 
                borderRadius: '16px', 
                border: '1px solid #e2e8f0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '12px' 
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
                    المملكة العربية السعودية • وزارة التعليم • {userData?.schoolName || 'المجمع التعليمي'}
                  </div>
                  <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={26} color="#0e7490" /> تقرير التحليل السيكومتري وموثوقية الاختبارات
                  </h2>
                  <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>
                    الاختبار المستهدف: <strong>{activeAnalyticsExam ? `${activeAnalyticsExam.title} (المعلم: ${activeAnalyticsExam.teacherName || 'إدارة المدرسة'})` : 'كافة الاختبارات المدرسية المجمعة'}</strong> | إجمالي السجلات: <strong>{filteredGrades.length} طالب</strong>
                  </p>
                </div>

                <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={() => {
                      setCorrelationExam1(activeAnalyticsExam || null);
                      setCorrelationExam2(null);
                      setShowCorrelationModal(true);
                    }}
                    title="مقارنة هذا الاختبار باختبار آخر لنفس المعلم أو معلم آخر"
                  >
                    <TrendingUp size={16} /> 📈 إجراء مقارنة مع اختبار آخر
                  </button>

                  <button
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #0e7490, #0284c7)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      const orig = document.title;
                      document.title = `تقرير_التحليل_السيكومتري_المدرسي_${new Date().toISOString().split('T')[0]}`;
                      window.print();
                      setTimeout(() => { document.title = orig; }, 1000);
                    }}
                  >
                    <Printer size={16} /> طباعة تقرير التحليل المعتمد (PDF)
                  </button>
                </div>
              </div>

              {!adminPsychometrics || filteredGrades.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-muted)', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <AlertCircle size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <h3>لا توجد درجات مرصودة لهذا الاختبار حتى الآن لحساب التحليل السيكومتري</h3>
                </div>
              ) : (
                <>
                  {/* Attendees & Absence Summary Bar */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div>👥 إجمالي المسجلين: <strong>{adminPsychometrics.totalTested || filteredGrades.length}</strong></div>
                    <div>•</div>
                    <div style={{ color: '#16a34a' }}>✅ الحاضرون: <strong>{adminPsychometrics.presentCount || filteredGrades.filter(r => !r.isAbsent).length}</strong></div>
                    <div>•</div>
                    <div style={{ color: '#dc2626' }}>🚫 الغائبون: <strong>{adminPsychometrics.absentCount || filteredGrades.filter(r => r.isAbsent).length}</strong></div>
                    <div>•</div>
                    <div>معادلة الثبات المحسوبة: <strong style={{ color: '#0e7490' }}>{adminPsychometrics.formulaUsed || 'KR-21'}</strong></div>
                  </div>

                  {/* Core Psychometric Indicator Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                    <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', border: '1.5px solid #86efac', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#166534' }}>
                        معامل الثبات ({adminPsychometrics.formulaUsed || 'KR-21'})
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', margin: '4px 0', fontWeight: 'bold' }}>
                        🎯 المدى المناسب: (0.70 - 0.90)
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: '#15803d', margin: '2px 0' }}>{adminPsychometrics.kr20}</div>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>
                        {parseFloat(adminPsychometrics.kr20) >= 0.85 ? '🌟 ثبات ممتاز وموثوق جداً' : parseFloat(adminPsychometrics.kr20) >= 0.70 ? '✅ ثبات جيد ومناسب للتقويم' : parseFloat(adminPsychometrics.kr20) >= 0.60 ? '⚠️ ثبات مقبول' : '❌ ثبات ضعيف يتطلب مراجعة'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px', lineHeight: '1.4' }}>
                        اتساق درجات الطلاب واستقرارها وخلوها من التشتت العشوائي
                      </div>
                    </div>

                    <div style={{ background: '#f0fdfa', padding: '16px', borderRadius: '10px', border: '1.5px solid #5eead4', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f766e' }}>معامل الصدق الذاتي (Index of Validity)</div>
                      <div style={{ fontSize: '11px', color: '#0f766e', background: '#ccfbf1', padding: '2px 8px', borderRadius: '12px', display: 'inline-block', margin: '4px 0', fontWeight: 'bold' }}>
                        🎯 المدى المناسب: (0.84 - 0.95)
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: '#0d9488', margin: '2px 0' }}>{adminPsychometrics.validity}</div>
                      <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 'bold' }}>
                        {parseFloat(adminPsychometrics.validity) >= 0.85 ? '🌟 صدق ذاتي ممتاز وعالٍ' : parseFloat(adminPsychometrics.validity) >= 0.70 ? '✅ صدق مناسب ومقبول تربوياً' : '⚠️ صدق منخفض'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px', lineHeight: '1.4' }}>
                        مدى قياس الاختبار للأهداف ونواتج التعلم المستهدفة
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>متوسط صعوبة الاختبار (P)</div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: '#0284c7', margin: '4px 0' }}>{adminPsychometrics.meanDifficulty}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>المعدل المثالي (0.40 - 0.75)</div>
                    </div>

                    <div style={{ background: '#fdf4ff', padding: '16px', borderRadius: '10px', border: '1px solid #f5d0fe', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#86198f' }}>الانحراف المعياري (Sx)</div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: '#a21caf', margin: '4px 0' }}>{adminPsychometrics.stdDev}</div>
                      <div style={{ fontSize: '11px', color: '#86198f' }}>تشتت درجات الطلاب</div>
                    </div>

                    <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e' }}>خطأ القياس المعياري (SEM)</div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: '#b45309', margin: '4px 0' }}>{adminPsychometrics.sem}</div>
                      <div style={{ fontSize: '11px', color: '#92400e' }}>دقة تقدير الدرجة الحقيقية</div>
                    </div>
                  </div>


                  {/* الدليل الإرشادي والتفسير التربوي لمعاملات الصدق والثبات */}
                  <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <Sparkles size={18} color="#0e7490" />
                      <span>الدليل التربوي والقياسي لتفسير جودة وموثوقية الاختبارات المضافة:</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px', lineHeight: '1.6', color: '#334155' }}>
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderRight: '3px solid #16a34a' }}>
                        <strong style={{ color: '#166534', display: 'block', marginBottom: '2px' }}>🔒 الثبات (Reliability):</strong>
                        يقيس استقرار ودقة الاختبار. النطاق الموصى به من <strong>0.70 إلى 0.90</strong>.
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderRight: '3px solid #0d9488' }}>
                        <strong style={{ color: '#0f766e', display: 'block', marginBottom: '2px' }}>🎯 الصدق الذاتي (Validity):</strong>
                        يقيس مطابقة الاختبار للأهداف التعليمية. النطاق الموصى به من <strong>0.84 إلى 0.95</strong>.
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderRight: '3px solid #0284c7' }}>
                        <strong style={{ color: '#0369a1', display: 'block', marginBottom: '2px' }}>⚖️ الصعوبة (Difficulty P):</strong>
                        المدى المتوازن بين <strong>0.40 و 0.75</strong> لضمان عدالة قياس مستويات الطلاب.
                      </div>
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderRight: '3px solid #b45309' }}>
                        <strong style={{ color: '#b45309', display: 'block', marginBottom: '2px' }}>📏 الخطأ المعياري (SEM):</strong>
                        هامش الخطأ المحتمل حول درجات الطلاب. كلما اقترب من الصفر دل على ثبات أعلى.
                      </div>
                    </div>
                  </div>

                  {/* VISUAL CHARTS */}
                  <PsychometricCharts psychometrics={adminPsychometrics} printMode={false} />

                  {/* Kelly's 27% Upper vs Lower Groups Analysis */}
                  {adminPsychometrics.kellyAnalysis && (
                    <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={20} color="#0e7490" /> تحليل الفئات الطرفية (طريقة كيلي 27% للتمييز والمقارنة)
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                        <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>🟢 الفئة العليا (الأعلى 27%)</div>
                          <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>عدد الطلاب: <strong>{adminPsychometrics.kellyAnalysis.upperCount} طالب</strong></div>
                            <div>متوسط درجات الفئة العليا: <strong style={{ color: '#16a34a' }}>{adminPsychometrics.kellyAnalysis.upperMean}%</strong></div>
                          </div>
                        </div>

                        <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                          <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>🔴 الفئة الدنيا (الأدنى 27%)</div>
                          <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>عدد الطلاب: <strong>{adminPsychometrics.kellyAnalysis.lowerCount} طالب</strong></div>
                            <div>متوسط درجات الفئة الدنيا: <strong style={{ color: '#dc2626' }}>{adminPsychometrics.kellyAnalysis.lowerMean}%</strong></div>
                          </div>
                        </div>

                        <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                          <div style={{ fontWeight: 'bold', color: '#0369a1', marginBottom: '8px' }}>⚖️ القوة التمييزية للاختبار</div>
                          <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div>الفرق بين الفئتين: <strong>{adminPsychometrics.kellyAnalysis.diffScore}%</strong></div>
                            <div>التقييم: <strong style={{ color: '#0284c7' }}>{adminPsychometrics.kellyAnalysis.discriminationQuality}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Quartiles */}
                      {adminPsychometrics.quartiles && (
                        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', flexWrap: 'wrap' }}>
                          <div>الربيع الأول (Q1): <strong>{adminPsychometrics.quartiles.q1}%</strong></div>
                          <div>•</div>
                          <div>الوسيط (Q2 / Median): <strong>{adminPsychometrics.quartiles.median}%</strong></div>
                          <div>•</div>
                          <div>الربيع الثالث (Q3): <strong>{adminPsychometrics.quartiles.q3}%</strong></div>
                          <div>•</div>
                          <div>المدى الربيعي (IQR): <strong>{adminPsychometrics.quartiles.iqr}%</strong></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Classical Test Theory Note */}
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>📋 تقرير تحليل ثبات وصدق الاختبارات المدرسية المضافة</h4>
                    <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.7' }}>
                      تم تطبيق خوارزمية كودر-ريتشاردسون 21 (KR-21) لتقدير الاتساق الداخلي للاختبار بموثوقية بلغت <strong>({adminPsychometrics.kr20})</strong>، والصدق الذاتي المحسوب <strong>({adminPsychometrics.validity})</strong>، مع متوسط معامل صعوبة كلي قدره <strong>({adminPsychometrics.meanDifficulty})</strong>، مما يتيح للإدارة المدرسية والمشرفين تقييم كفاءة الاختبارات المضافة واعتماد النتائج.
                    </p>
                  </div>

                  {/* Official Signatures Section for Teacher, Supervisor, Principal */}
                  <div style={{ 
                    marginTop: '20px', 
                    padding: '24px 20px', 
                    background: 'white', 
                    borderRadius: '12px', 
                    border: '1.5px solid #cbd5e1' 
                  }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', color: '#1e293b', fontSize: '15px' }}>
                      الاعتماد والمصادقة الرسمية على تقرير التحليل السيكومتري وموثوقية الاختبار
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', textAlign: 'center' }}>
                      {/* 1. Teacher / Coordinator */}
                      <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', background: '#f8fafc' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>معلم المادة / المنسق</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>
                          {filteredGrades[0]?.teacherName || 'معلم المادة المعتمد'}
                        </div>
                        <div style={{ marginTop: '30px', borderTop: '1px dashed #94a3b8', paddingTop: '8px', fontSize: '12px', color: '#64748b' }}>
                          التوقيع: .......................................
                        </div>
                      </div>

                      {/* 2. Principal */}
                      <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', background: '#f8fafc' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534', marginBottom: '6px' }}>مدير المدرسة</div>
                        <input
                          type="text"
                          defaultValue={userData?.role === 'admin' ? userData.name : (userData?.principalName || 'أ. أنس الجهني')}
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
                      وثيقة رسمية صادرة عبر منظومة إدارة الاختبارات المدرسية الذكية • {new Date().toLocaleDateString('ar-SA')}
                    </div>
                  </div>
                </>
              )}

            </div>
          )}

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
            maxWidth: '680px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '24px',
            direction: 'rtl',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: editingLevel.color || '#0284c7' }}>
                  تخصيص المستوى الأكاديمي: {editingLevel.name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  تعديل التسمية، مدى الدرجات والنسبة المئوية، وبنود الخطة العلاجية والإثرائية
                </span>
              </div>
              <button 
                onClick={() => setEditingLevel(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Row 1: Name & Symbol */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                    مسمى المستوى الأكاديمي (التسمية) *
                  </label>
                  <input 
                    type="text" 
                    value={editingLevel.name || ''}
                    onChange={(e) => setEditingLevel({ ...editingLevel, name: e.target.value })}
                    placeholder="مثال: ممتاز مرتفع، متقدم، يحتاج دعم..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                    الرمز (Symbol) *
                  </label>
                  <input 
                    type="text" 
                    value={editingLevel.symbol || ''}
                    onChange={(e) => setEditingLevel({ ...editingLevel, symbol: e.target.value })}
                    placeholder="A+, A, B..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}
                    required
                  />
                </div>
              </div>

              {/* Row 2: Min & Max Percentage (Score Range) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                    الحد الأدنى للنسبة (%) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    value={editingLevel.minPercentage !== undefined ? editingLevel.minPercentage : 0}
                    onChange={(e) => setEditingLevel({ ...editingLevel, minPercentage: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                    الحد الأعلى للنسبة (%) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    value={editingLevel.maxPercentage !== undefined ? editingLevel.maxPercentage : 100}
                    onChange={(e) => setEditingLevel({ ...editingLevel, maxPercentage: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                    تصنيف البرنامج التربوي
                  </label>
                  <select 
                    value={editingLevel.type || 'reinforcement'}
                    onChange={(e) => {
                      const tVal = e.target.value;
                      const labelMap = {
                        enrichment: 'برنامج إثرائي متقدم ورعاية موهوبين',
                        reinforcement: 'برنامج تعزيز ودعم المهارات',
                        remedial: 'برنامج علاجي وتدخل طارئ'
                      };
                      setEditingLevel({ 
                        ...editingLevel, 
                        type: tVal,
                        typeLabel: labelMap[tVal] || 'برنامج أكاديمي'
                      });
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    <option value="enrichment">إثرائي ورعاية موهوبين (Enrichment)</option>
                    <option value="reinforcement">تعزيز ودعم المهارات (Reinforcement)</option>
                    <option value="remedial">علاجي وتدخل طارئ (Remedial)</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Color Theme */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>لون تمييز المستوى:</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {['#059669', '#10b981', '#2563eb', '#0891b2', '#d97706', '#ea580c', '#dc2626', '#991b1b', '#7c3aed'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingLevel({ 
                        ...editingLevel, 
                        color: c, 
                        bgColor: `${c}12`, 
                        borderColor: `${c}40` 
                      })}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: c,
                        border: editingLevel.color === c ? '3px solid #0f172a' : '2px solid white',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={editingLevel.color || '#2563eb'}
                    onChange={(e) => setEditingLevel({ 
                      ...editingLevel, 
                      color: e.target.value,
                      bgColor: `${e.target.value}15`,
                      borderColor: `${e.target.value}45`
                    })}
                    style={{ width: '32px', height: '30px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    title="اختر لوناً مخصصاً"
                  />
                </div>
              </div>

              {/* Arabic Content */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>
                  🇸🇦 النصوص والرسائل باللغة العربية:
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                      عنوان البرنامج التلقائي
                    </label>
                    <input 
                      type="text" 
                      value={editingLevel.defaultTitle || ''}
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
                      value={editingLevel.diagnosis || ''}
                      onChange={(e) => setEditingLevel({ ...editingLevel, diagnosis: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                      بنود الخطة والأنشطة المقترحة (بند في كل سطر)
                    </label>
                    <textarea 
                      rows="3"
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
                      value={editingLevel.parentAdvice || ''}
                      onChange={(e) => setEditingLevel({ ...editingLevel, parentAdvice: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* English Content */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#4338ca' }}>
                  🇬🇧 النصوص والرسائل باللغة الإنجليزية (English Version):
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', direction: 'ltr' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Program Title (English)
                    </label>
                    <input 
                      type="text" 
                      value={editingLevel.enTitle || ''}
                      onChange={(e) => setEditingLevel({ ...editingLevel, enTitle: e.target.value })}
                      placeholder="e.g. Academic Excellence Program"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Educational Diagnosis (English)
                    </label>
                    <textarea 
                      rows="2"
                      value={editingLevel.enDiagnosis || ''}
                      onChange={(e) => setEditingLevel({ ...editingLevel, enDiagnosis: e.target.value })}
                      placeholder="e.g. Outstanding performance demonstrating comprehensive mastery..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Parent Guidance Advice (English)
                    </label>
                    <textarea 
                      rows="2"
                      value={editingLevel.enParentAdvice || ''}
                      onChange={(e) => setEditingLevel({ ...editingLevel, enParentAdvice: e.target.value })}
                      placeholder="e.g. We congratulate you on your child's success..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '10px' }}>
                <button 
                  onClick={() => setEditingLevel(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
                >
                  إلغاء
                </button>
                <button 
                  onClick={() => {
                    const exists = remedialMatrix.some(m => (m.code || `level_${m.id}`) === (editingLevel.code || `level_${editingLevel.id}`));
                    const updated = exists 
                      ? remedialMatrix.map(m => (m.code || `level_${m.id}`) === (editingLevel.code || `level_${editingLevel.id}`) ? editingLevel : m)
                      : [...remedialMatrix, editingLevel];
                    handleSaveRemedialMatrix(updated);
                  }}
                  disabled={matrixSaving}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={14} />
                  <span>{matrixSaving ? 'جاري الحفظ...' : 'حفظ واعتماد المستوى'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Dual Exam Correlation & Growth Modal */}
      {showCorrelationModal && (
        <ExamCorrelationModal
          isOpen={showCorrelationModal}
          onClose={() => {
            setShowCorrelationModal(false);
            setCorrelationExam1(null);
            setCorrelationExam2(null);
          }}
          allExams={combinedExams}
          initialExam1={correlationExam1}
          initialExam2={correlationExam2}
        />
      )}

    </div>
  );
}
