import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc, 
  setDoc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileSpreadsheet, 
  Save, 
  CheckCircle2, 
  Users, 
  Printer, 
  Search, 
  Sparkles, 
  X, 
  Check, 
  RefreshCw
} from 'lucide-react';
import { 
  STANDARD_SPECIALIZATIONS, 
  calculateStudentGradeResult, 
  computeClassExamStats 
} from '../utils/examGradingEngine';
import { generateRemedialPlanAI } from '../utils/aiPlanGenerator';

export default function TeacherGradeEntry() {
  const { userData } = useAuth();
  const schoolId = userData?.schoolId || 'default_school_1';

  // Core selections
  const [exams, setExams] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(userData?.subject || '');
  const [selectedClass, setSelectedClass] = useState('');

  // Data states
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [existingRecords, setExistingRecords] = useState({}); // { [studentId]: record }
  const [editingScores, setEditingScores] = useState({}); // { [studentId]: { coreScore, customScores: {}, teacherNotes, skillsToTarget, remedialProgram } }
  const [customMatrix, setCustomMatrix] = useState(null);

  // Status & UI
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentForPlan, setSelectedStudentForPlan] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalLangTab, setPlanModalLangTab] = useState('ar'); // 'ar' | 'en'
  const [planModalData, setPlanModalData] = useState(null);
  const [generatingAIForId, setGeneratingAIForId] = useState(null); // studentId currently generating

  // 1. Fetch available exams for the school
  useEffect(() => {
    const qExams = schoolId === 'ALL'
      ? collection(db, 'school_exams')
      : query(collection(db, 'school_exams'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qExams, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // prioritize active exams
      list.sort((a) => (a.status === 'active' ? -1 : 1));
      setExams(list);
      if (list.length > 0) {
        setSelectedExamId(prev => prev || list[0].id);
      }
    });

    return () => unsub();
  }, [schoolId]);

  // 2. Fetch classes list
  useEffect(() => {
    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qClasses, snap => {
      const cls = snap.docs.map(d => d.data().name || d.data().className).filter(Boolean);
      const uniqueCls = Array.from(new Set(cls));
      setClassesList(uniqueCls);
      if (uniqueCls.length > 0) {
        setSelectedClass(prev => prev || uniqueCls[0]);
      }
    });

    return () => unsub();
  }, [schoolId]);

  // 3. Fetch school remedial configs if customized
  useEffect(() => {
    getDocs(query(collection(db, 'exam_remedial_configs'), where('schoolId', '==', schoolId))).then(snap => {
      if (!snap.empty && Array.isArray(snap.docs[0].data().levels)) {
        setCustomMatrix(snap.docs[0].data().levels);
      }
    }).catch(() => {});
  }, [schoolId]);

  // Current active exam object
  const currentExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Available subjects for the selected exam
  const availableSubjects = useMemo(() => {
    if (!currentExam) return STANDARD_SPECIALIZATIONS;
    if (currentExam.allowTeacherSelectAnySubject || currentExam.targetSpecializations?.includes('ALL')) {
      return STANDARD_SPECIALIZATIONS;
    }
    if (Array.isArray(currentExam.targetSpecializations) && currentExam.targetSpecializations.length > 0) {
      return currentExam.targetSpecializations;
    }
    return STANDARD_SPECIALIZATIONS;
  }, [currentExam]);

  // Ensure selectedSubject is valid
  useEffect(() => {
    if (!selectedSubject && availableSubjects.length > 0) {
      setSelectedSubject(userData?.subject || availableSubjects[0]);
    }
  }, [availableSubjects, selectedSubject, userData?.subject]);

  // 4. Fetch students when selectedClass changes
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    setLoadingStudents(true);
    const qStudents = schoolId === 'ALL'
      ? query(collection(db, 'students'), where('class', '==', selectedClass))
      : query(collection(db, 'students'), where('schoolId', '==', schoolId), where('class', '==', selectedClass));

    const unsub = onSnapshot(qStudents, snap => {
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Fallback query for className
      if (list.length === 0) {
        getDocs(query(collection(db, 'students'), where('className', '==', selectedClass))).then(altSnap => {
          if (!altSnap.empty) {
            setStudents(altSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } else {
            setStudents([]);
          }
          setLoadingStudents(false);
        });
      } else {
        setStudents(list);
        setLoadingStudents(false);
      }
    }, err => {
      console.warn('Students listener error:', err);
      setLoadingStudents(false);
    });

    return () => unsub();
  }, [schoolId, selectedClass]);

  // 5. Fetch existing grade records for (selectedExamId, selectedSubject, selectedClass)
  useEffect(() => {
    if (!selectedExamId || !selectedSubject || !selectedClass) {
      setExistingRecords({});
      return;
    }

    const qGrades = query(
      collection(db, 'exam_grades_records'),
      where('examId', '==', selectedExamId),
      where('subject', '==', selectedSubject),
      where('className', '==', selectedClass)
    );

    const unsub = onSnapshot(qGrades, snap => {
      const recMap = {};
      const editMap = {};

      snap.docs.forEach(d => {
        const data = d.data();
        recMap[data.studentId] = { id: d.id, ...data };
        editMap[data.studentId] = {
          coreScore: data.coreScore !== undefined ? data.coreScore : '',
          customScores: data.customScores || {},
          teacherNotes: data.remedialProgram?.teacherNotes || '',
          skillsToTarget: data.remedialProgram?.skillsToTarget || []
        };
      });

      setExistingRecords(recMap);
      // Merge with editing scores without wiping active typing
      setEditingScores(prev => ({
        ...editMap,
        ...prev
      }));
    }, err => {
      console.warn('Grades listener error:', err);
    });

    return () => unsub();
  }, [selectedExamId, selectedSubject, selectedClass]);

  // Handle score change for student
  const handleScoreChange = (studentId, field, val) => {
    setEditingScores(prev => {
      const current = prev[studentId] || { coreScore: '', customScores: {}, teacherNotes: '', skillsToTarget: [] };
      if (field === 'coreScore') {
        return {
          ...prev,
          [studentId]: {
            ...current,
            coreScore: val
          }
        };
      } else {
        return {
          ...prev,
          [studentId]: {
            ...current,
            customScores: {
              ...(current.customScores || {}),
              [field]: val
            }
          }
        };
      }
    });
  };

  // Compute live computed grade for each student
  const computedStudentsData = useMemo(() => {
    if (!currentExam) return [];

    return students.map(st => {
      const edit = editingScores[st.id] || { coreScore: '', customScores: {}, teacherNotes: '', skillsToTarget: [] };
      const calculation = calculateStudentGradeResult({
        coreScore: edit.coreScore,
        customScores: edit.customScores,
        exam: currentExam,
        customMatrix,
        teacherCustomNotes: edit.teacherNotes,
        skillsToTarget: edit.skillsToTarget
      });

      // دمج الخطة المخصصة أو المولدة بالذكاء الاصطناعي إن وجدت
      const existingProg = edit.remedialProgram || existingRecords[st.id]?.remedialProgram;
      if (existingProg) {
        calculation.remedialProgram = {
          ...calculation.remedialProgram,
          ...existingProg,
          title: existingProg.title || calculation.remedialProgram.title,
          diagnosis: existingProg.diagnosis || calculation.remedialProgram.diagnosis,
          actionPlan: existingProg.actionPlan || calculation.remedialProgram.actionPlan,
          parentAdvice: existingProg.parentAdvice || calculation.remedialProgram.parentAdvice,
          teacherNotes: edit.teacherNotes || existingProg.teacherNotes || '',
          parentLanguageDisplay: existingProg.parentLanguageDisplay || 'both',
          ar: existingProg.ar || calculation.remedialProgram.ar,
          en: existingProg.en || calculation.remedialProgram.en
        };
      }

      const isGraded = edit.coreScore !== '' || Object.keys(edit.customScores || {}).length > 0;

      return {
        student: st,
        edit,
        calculation,
        isGraded,
        isSaved: !!existingRecords[st.id]
      };
    });
  }, [students, editingScores, currentExam, customMatrix, existingRecords]);

  // Class stats computation
  const classStats = useMemo(() => {
    if (!currentExam) return { totalCount: 0, averageScore: 0, passRate: 0, remedialCount: 0 };
    const gradedList = computedStudentsData.filter(d => d.isGraded).map(d => d.calculation);
    return computeClassExamStats(gradedList, currentExam.totalMaxScore);
  }, [computedStudentsData, currentExam]);

  // Generate AI Plan for Student (with optional custom teacher note)
  const handleGenerateAIForStudent = async (studentItem, customNote = null) => {
    const sId = studentItem.student.id;
    setGeneratingAIForId(sId);

    try {
      const note = customNote !== null ? customNote : (editingScores[sId]?.teacherNotes || '');
      const { calculation, student } = studentItem;

      const aiResult = await generateRemedialPlanAI({
        studentName: student.name || 'الطالب',
        subject: selectedSubject,
        percentage: calculation.percentage,
        totalScore: calculation.totalScore,
        maxScore: calculation.maxScore,
        levelName: calculation.levelName,
        levelSymbol: calculation.levelSymbol,
        levelType: calculation.levelType,
        teacherNotes: note
      });

      const updatedProgram = {
        ...(editingScores[sId]?.remedialProgram || calculation.remedialProgram || {}),
        ...aiResult,
        title: aiResult.ar?.title || calculation.remedialProgram?.title,
        diagnosis: aiResult.ar?.diagnosis || calculation.remedialProgram?.diagnosis,
        actionPlan: aiResult.ar?.actionPlan || calculation.remedialProgram?.actionPlan,
        parentAdvice: aiResult.ar?.parentAdvice || calculation.remedialProgram?.parentAdvice,
        teacherNotes: note,
        parentLanguageDisplay: editingScores[sId]?.remedialProgram?.parentLanguageDisplay || planModalData?.parentLanguageDisplay || 'both'
      };

      setEditingScores(prev => ({
        ...prev,
        [sId]: {
          ...(prev[sId] || {}),
          teacherNotes: note,
          remedialProgram: updatedProgram
        }
      }));

      if (selectedStudentForPlan && selectedStudentForPlan.student.id === sId) {
        setPlanModalData(updatedProgram);
      }
    } catch (err) {
      console.error('Error generating AI plan:', err);
      alert('حدث خطأ أثناء توليد الخطة بالذكاء الاصطناعي');
    } finally {
      setGeneratingAIForId(null);
    }
  };

  // Save single student grade
  const handleSaveStudentGrade = async (studentData, overridePlan = null) => {
    const { student, edit, calculation } = studentData;
    const recordDocId = `${selectedExamId}_${student.id}_${selectedSubject}`.replace(/[/\s#]/g, '_');
    const finalProg = overridePlan || edit.remedialProgram || calculation.remedialProgram;

    try {
      await setDoc(doc(db, 'exam_grades_records', recordDocId), {
        schoolId,
        examId: selectedExamId,
        examTitle: currentExam?.title || 'اختبار مدرسي',
        studentId: student.id,
        studentNationalId: student.nationalId || '',
        studentName: student.name || 'طالب',
        className: selectedClass,
        subject: selectedSubject,
        teacherId: userData?.nationalId || userData?.uid || 'teacher_id',
        teacherName: userData?.name || 'معلم المادة',
        coreScore: calculation.coreScore,
        customScores: calculation.customScores,
        totalScore: calculation.totalScore,
        maxScore: calculation.maxScore,
        percentage: calculation.percentage,
        levelCode: calculation.levelCode,
        levelName: calculation.levelName,
        levelSymbol: calculation.levelSymbol,
        levelColor: calculation.levelColor,
        levelBgColor: calculation.levelBgColor,
        levelBorderColor: calculation.levelBorderColor,
        levelType: calculation.levelType,
        remedialProgram: {
          ...calculation.remedialProgram,
          ...finalProg,
          teacherNotes: edit.teacherNotes || finalProg.teacherNotes || '',
          skillsToTarget: edit.skillsToTarget || [],
          parentLanguageDisplay: finalProg.parentLanguageDisplay || 'both'
        },
        status: 'submitted',
        updatedAt: serverTimestamp()
      }, { merge: true });

      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err) {
      console.error('Error saving grade:', err);
      alert('حدث خطأ أثناء حفظ الدرجة');
    }
  };

  // Batch Save all students in class
  const handleSaveAllGrades = async () => {
    if (!currentExam || students.length === 0) return;
    setIsSavingAll(true);

    try {
      const batch = writeBatch(db);
      computedStudentsData.forEach(d => {
        const { student, edit, calculation } = d;
        const recordDocId = `${selectedExamId}_${student.id}_${selectedSubject}`.replace(/[/\s#]/g, '_');
        const docRef = doc(db, 'exam_grades_records', recordDocId);
        const finalProg = edit.remedialProgram || calculation.remedialProgram;

        batch.set(docRef, {
          schoolId,
          examId: selectedExamId,
          examTitle: currentExam.title,
          studentId: student.id,
          studentNationalId: student.nationalId || '',
          studentName: student.name || 'طالب',
          className: selectedClass,
          subject: selectedSubject,
          teacherId: userData?.nationalId || userData?.uid || 'teacher_id',
          teacherName: userData?.name || 'معلم المادة',
          coreScore: calculation.coreScore,
          customScores: calculation.customScores,
          totalScore: calculation.totalScore,
          maxScore: calculation.maxScore,
          percentage: calculation.percentage,
          levelCode: calculation.levelCode,
          levelName: calculation.levelName,
          levelSymbol: calculation.levelSymbol,
          levelColor: calculation.levelColor,
          levelBgColor: calculation.levelBgColor,
          levelBorderColor: calculation.levelBorderColor,
          levelType: calculation.levelType,
          remedialProgram: {
            ...calculation.remedialProgram,
            ...finalProg,
            teacherNotes: edit.teacherNotes || finalProg.teacherNotes || '',
            skillsToTarget: edit.skillsToTarget || [],
            parentLanguageDisplay: finalProg.parentLanguageDisplay || 'both'
          },
          status: 'submitted',
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      setIsSavingAll(false);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 4000);
    } catch (err) {
      console.error('Error batch saving grades:', err);
      setIsSavingAll(false);
      alert('حدث خطأ أثناء الحفظ الجماعي للدرجات');
    }
  };

  // Open Remedial Customization Modal
  const handleOpenPlanModal = (studentItem) => {
    setSelectedStudentForPlan(studentItem);
    const existingProg = editingScores[studentItem.student.id]?.remedialProgram || studentItem.calculation.remedialProgram;
    const note = editingScores[studentItem.student.id]?.teacherNotes || existingProg?.teacherNotes || '';

    const modalData = {
      ...existingProg,
      teacherNotes: note,
      parentLanguageDisplay: existingProg?.parentLanguageDisplay || 'both',
      ar: existingProg?.ar || {
        title: existingProg?.title || studentItem.calculation.levelName,
        diagnosis: existingProg?.diagnosis || '',
        actionPlan: existingProg?.actionPlan || [],
        parentAdvice: existingProg?.parentAdvice || '',
        teacherNotes: note
      },
      en: existingProg?.en || {
        title: existingProg?.enTitle || `Academic Program (${studentItem.calculation.levelSymbol})`,
        diagnosis: existingProg?.enDiagnosis || '',
        actionPlan: existingProg?.enActionPlan || ['Follow up with classroom teacher.', 'Practice daily worksheets.'],
        parentAdvice: existingProg?.enParentAdvice || '',
        teacherNotes: note
      }
    };
    setPlanModalData(modalData);
    setPlanModalLangTab('ar');
    setPlanModalOpen(true);
  };

  // Filtered Students by search query
  const filteredStudentItems = useMemo(() => {
    if (!searchQuery.trim()) return computedStudentsData;
    const q = searchQuery.trim().toLowerCase();
    return computedStudentsData.filter(item => 
      (item.student.name || '').toLowerCase().includes(q) ||
      (item.student.nationalId || '').includes(q)
    );
  }, [computedStudentsData, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', direction: 'rtl' }}>
      
      {/* Teacher Hub Header */}
      <div className="glass-panel" style={{ 
        padding: '24px', 
        borderRadius: '16px', 
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
        color: 'white',
        boxShadow: '0 8px 20px -4px rgba(2, 132, 199, 0.3)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '52px', 
              height: '52px', 
              borderRadius: '12px', 
              background: 'rgba(255, 255, 255, 0.15)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(6px)'
            }}>
              <FileSpreadsheet size={28} color="white" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>منظومة رصد درجات الاختبارات والبرامج العلاجية</h1>
                <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                  بوابة المعلم
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                رصد درجات الطلاب في الاختبار التحريري والأعمدة المخصصة، مع تصنيف فوري للمستويات الثمانية وتوليد الخطط العلاجية الذكية.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSaveAllGrades}
              disabled={isSavingAll || students.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Save size={16} />
              <span>{isSavingAll ? 'جاري الحفظ الجماعي...' : 'اعتماد وحفظ كشف الفصل كاملاً'}</span>
            </button>

            <button
              onClick={() => window.print()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.15)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>

        {/* Live Class KPI Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '20px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>طلاب الفصل</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{students.length}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>تم رصدهم</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#86efac' }}>
              {computedStudentsData.filter(d => d.isGraded).length}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>متوسط الدرجات</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
              {classStats.averageScore} <span style={{ fontSize: '11px', fontWeight: 'normal' }}>({classStats.averagePercentage}%)</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>نسبة الاجتياز والتفوق</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fde047' }}>
              {classStats.passRate}%
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px 14px', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>يحتاجون لبرنامج علاجي</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fca5a5' }}>
              {classStats.remedialCount}
            </div>
          </div>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccessNotice && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #6ee7b7',
          color: '#065f46',
          padding: '12px 18px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 'bold',
          animation: 'fadeIn 0.3s'
        }}>
          <CheckCircle2 size={20} color="#10b981" />
          <span>تم حفظ الدرجات وتحديث البرامج العلاجية وتصنيف المستويات للطلاب بنجاح تام!</span>
        </div>
      )}

      {/* Control Bar: Selection Filters & Search */}
      <div className="glass-panel" style={{ padding: '18px', borderRadius: '14px', background: 'var(--color-bg-card)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
        
        {/* Filters Group */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
          
          {/* Exam Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
              الاختبار المستهدف
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '200px', fontWeight: '600' }}
            >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} {ex.status !== 'active' ? `(${ex.status})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
              المادة والتخصص
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '160px', fontWeight: 'bold', color: '#0284c7' }}
            >
              {availableSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
              الصف والفصل الدراسي
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '160px', fontWeight: '600' }}
            >
              {classesList.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '10px' }} />
          <input 
            type="text"
            placeholder="بحث عن طالب بالاسم أو الهوية..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '8px 34px 8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
          />
        </div>
      </div>

      {/* Exam Breakdown Details Banner */}
      {currentExam && (
        <div style={{ 
          background: '#f8fafc', 
          padding: '12px 18px', 
          borderRadius: '10px', 
          border: '1px solid #e2e8f0', 
          display: 'flex', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '12px', 
          fontSize: '12px', 
          color: '#475569' 
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            <span><strong>اختبار المادة التحريري:</strong> {currentExam.coreSubjectMaxScore || 20} درجة</span>
            {(currentExam.customColumns || []).map(col => (
              <span key={col.id} style={{ background: 'white', padding: '2px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {col.label}: <strong>{col.maxScore}</strong> د
              </span>
            ))}
          </div>

          <div style={{ fontWeight: 'bold', color: '#0369a1' }}>
            الدرجة العظمى الإجمالية: <span style={{ fontSize: '15px' }}>{currentExam.totalMaxScore || 100}</span> درجة
          </div>
        </div>
      )}

      {/* ─── SPREADSHEET GRADING TABLE ─── */}
      <div className="glass-panel" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', background: 'var(--color-bg-card)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        
        {loadingStudents ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw className="spin-slow" size={28} style={{ margin: '0 auto 10px' }} />
            <div>جاري تحميل قائمة طلاب الفصل...</div>
          </div>
        ) : filteredStudentItems.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#334155' }}>لا يوجد طلاب مسجلين في هذا الفصل</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>تأكد من اختيار الصف المناسب أو تسجيل الطلاب في النظام.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '12px 14px', width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '12px 14px', minWidth: '170px' }}>اسم الطالب</th>
                  
                  {/* Core Exam Column */}
                  <th style={{ padding: '12px 10px', textAlign: 'center', background: '#e0f2fe', color: '#0369a1', minWidth: '100px' }}>
                    <div>المادة (تحريري)</div>
                    <span style={{ fontSize: '11px', fontWeight: 'normal' }}>العظمى: {currentExam?.coreSubjectMaxScore || 20}</span>
                  </th>

                  {/* Dynamic Custom Columns */}
                  {(currentExam?.customColumns || []).map((col) => (
                    <th key={col.id} style={{ padding: '12px 10px', textAlign: 'center', minWidth: '95px' }}>
                      <div>{col.label}</div>
                      <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>العظمى: {col.maxScore}</span>
                    </th>
                  ))}

                  {/* Computed Total Column */}
                  <th style={{ padding: '12px 10px', textAlign: 'center', background: '#f8fafc', minWidth: '90px' }}>
                    <div>المجموع</div>
                    <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>من {currentExam?.totalMaxScore || 100}</span>
                  </th>

                  {/* Computed Percentage */}
                  <th style={{ padding: '12px 10px', textAlign: 'center', minWidth: '80px' }}>النسبة</th>

                  {/* Level Classification Badge */}
                  <th style={{ padding: '12px 12px', textAlign: 'center', minWidth: '140px' }}>المستوى الأكاديمي</th>

                  {/* Teacher Notes & AI Generator Column */}
                  <th style={{ padding: '12px 12px', textAlign: 'center', minWidth: '240px', background: '#f5f3ff', color: '#6d28d9' }}>
                    <div>ملاحظات المعلم والذكاء الاصطناعي</div>
                    <span style={{ fontSize: '11px', fontWeight: 'normal' }}>تدوين ملاحظة + توليد الخطة AI</span>
                  </th>

                  {/* Remedial Program Action */}
                  <th style={{ padding: '12px 12px', textAlign: 'center', minWidth: '130px' }}>الخطة والتوجيهات</th>

                  {/* Row Save Button */}
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '60px' }}>حفظ</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudentItems.map((item, index) => {
                  const { student, edit, calculation } = item;
                  const coreScoreVal = edit.coreScore !== undefined ? edit.coreScore : '';
                  const coreMax = currentExam?.coreSubjectMaxScore || 20;
                  const isCoreOver = Number(coreScoreVal) > coreMax;

                  return (
                    <tr 
                      key={student.id} 
                      style={{ 
                        borderBottom: '1px solid #e2e8f0', 
                        background: index % 2 === 0 ? 'white' : '#fcfcfd',
                        transition: 'background 0.15s'
                      }}
                    >
                      {/* Row Index */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        {index + 1}
                      </td>

                      {/* Student Info */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{student.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>هوية: {student.nationalId || '---'}</div>
                      </td>

                      {/* Core Score Input */}
                      <td style={{ padding: '8px 10px', textAlign: 'center', background: '#f0f9ff' }}>
                        <input 
                          type="number"
                          step="0.25"
                          min="0"
                          max={coreMax}
                          value={coreScoreVal}
                          onChange={(e) => handleScoreChange(student.id, 'coreScore', e.target.value)}
                          placeholder="0"
                          style={{
                            width: '65px',
                            padding: '6px',
                            textAlign: 'center',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            border: `2px solid ${isCoreOver ? '#ef4444' : '#bae6fd'}`,
                            background: isCoreOver ? '#fef2f2' : 'white',
                            color: isCoreOver ? '#b91c1c' : '#0369a1'
                          }}
                        />
                      </td>

                      {/* Custom Columns Inputs */}
                      {(currentExam?.customColumns || []).map((col) => {
                        const val = edit.customScores?.[col.key] !== undefined ? edit.customScores[col.key] : '';
                        const isOver = Number(val) > col.maxScore;

                        return (
                          <td key={col.id} style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input 
                              type="number"
                              step="0.25"
                              min="0"
                              max={col.maxScore}
                              value={val}
                              onChange={(e) => handleScoreChange(student.id, col.key, e.target.value)}
                              placeholder="0"
                              style={{
                                width: '60px',
                                padding: '6px',
                                textAlign: 'center',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '13px',
                                border: `1px solid ${isOver ? '#ef4444' : '#cbd5e1'}`,
                                background: isOver ? '#fef2f2' : 'white',
                                color: isOver ? '#b91c1c' : '#1e293b'
                              }}
                            />
                          </td>
                        );
                      })}

                      {/* Computed Total Score */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', background: '#f8fafc' }}>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                          {calculation.totalScore}
                        </strong>
                      </td>

                      {/* Computed Percentage */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>
                        {calculation.percentage}%
                      </td>

                      {/* 8-Level Classification Badge */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          background: calculation.levelBgColor, 
                          color: calculation.levelColor,
                          border: `1px solid ${calculation.levelBorderColor}`,
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: calculation.levelColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                            {calculation.levelSymbol}
                          </span>
                          <span>{calculation.levelName}</span>
                        </span>
                      </td>

                      {/* Teacher Notes & AI Generator Column */}
                      <td style={{ padding: '8px 10px', minWidth: '240px', background: '#faf5ff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="text"
                            placeholder="اكتب ملاحظتك عن الطالب..."
                            value={edit.teacherNotes || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingScores(prev => ({
                                ...prev,
                                [student.id]: {
                                  ...(prev[student.id] || {}),
                                  teacherNotes: val
                                }
                              }));
                            }}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #d8b4fe',
                              fontSize: '12px',
                              background: 'white'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateAIForStudent(item)}
                            disabled={generatingAIForId === student.id}
                            title="توليد وتحديث الخطة العلاجية بالذكاء الاصطناعي بناءً على الملاحظات"
                            style={{
                              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)'
                            }}
                          >
                            <Sparkles size={12} className={generatingAIForId === student.id ? 'spin-slow' : ''} />
                            <span>{generatingAIForId === student.id ? 'توليد...' : 'AI'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Smart Remedial Program Trigger */}
                      <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenPlanModal(item)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            border: `1px solid ${calculation.levelBorderColor}`,
                            background: 'white',
                            color: calculation.levelColor,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Sparkles size={12} />
                          <span>
                            {calculation.levelType === 'remedial' ? 'الخطة العلاجية' : 'الخطة الإثرائية'}
                          </span>
                        </button>
                      </td>

                      {/* Single Row Save Action */}
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleSaveStudentGrade(item)}
                          title="حفظ درجة الطالب"
                          style={{
                            background: item.isSaved ? '#f0fdf4' : '#f1f5f9',
                            color: item.isSaved ? '#16a34a' : '#0284c7',
                            border: `1px solid ${item.isSaved ? '#bbf7d0' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto'
                          }}
                        >
                          {item.isSaved ? <Check size={16} /> : <Save size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: STUDENT SMART REMEDIAL / ENRICHMENT PLAN CUSTOMIZER (AI-POWERED)
      ───────────────────────────────────────────────────────────── */}
      {planModalOpen && selectedStudentForPlan && planModalData && (
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
            maxWidth: '720px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '24px',
            direction: 'rtl',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
                    {selectedStudentForPlan.calculation.levelType === 'remedial' ? 'البرنامج العلاجي الذكي المخصص للطالب' : 'البرنامج الإثرائي لتعزيز التفوق'}
                  </h3>
                  <span style={{ 
                    padding: '3px 10px', 
                    borderRadius: '8px', 
                    fontSize: '11px', 
                    fontWeight: 'bold',
                    background: selectedStudentForPlan.calculation.levelBgColor,
                    color: selectedStudentForPlan.calculation.levelColor,
                    border: `1px solid ${selectedStudentForPlan.calculation.levelBorderColor}`
                  }}>
                    {selectedStudentForPlan.calculation.levelName} ({selectedStudentForPlan.calculation.percentage}%)
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  الطالب: <strong>{selectedStudentForPlan.student.name}</strong> | المادة: <strong>{selectedSubject}</strong> | الصف: <strong>{selectedClass}</strong>
                </p>
              </div>

              <button 
                onClick={() => setPlanModalOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            {/* Plan Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* AI Generation Quick Banner */}
              <div style={{ 
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
                padding: '14px 18px', 
                borderRadius: '12px', 
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                    <Sparkles size={18} />
                    <span>توليد وإعادة صياغة الخطة والتوجيهات بالذكاء الاصطناعي</span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '11px', opacity: 0.9 }}>
                    يقوم الذكاء الاصطناعي بتحليل مستوى الطالب وملاحظات المعلم وتوليد خطة وتوجيهات لولي الأمر باللغتين العربية والإنجليزية.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateAIForStudent(selectedStudentForPlan, planModalData.teacherNotes)}
                  disabled={generatingAIForId === selectedStudentForPlan.student.id}
                  style={{
                    background: 'white',
                    color: '#4f46e5',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  <Sparkles size={14} className={generatingAIForId === selectedStudentForPlan.student.id ? 'spin-slow' : ''} />
                  <span>{generatingAIForId === selectedStudentForPlan.student.id ? 'جاري التوليد...' : 'توليد بالذكاء الاصطناعي'}</span>
                </button>
              </div>

              {/* Teacher Custom Notes with AI Re-generate Button */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#0f172a' }}>
                  ملاحظات معلم المادة المخصصة عن الطالب (يدمجها الذكاء الاصطناعي في الخطة وتظهر لولي الأمر):
                </label>
                <textarea 
                  rows="2"
                  value={planModalData.teacherNotes || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlanModalData(prev => ({ ...prev, teacherNotes: val }));
                    setEditingScores(prev => ({
                      ...prev,
                      [selectedStudentForPlan.student.id]: {
                        ...(prev[selectedStudentForPlan.student.id] || {}),
                        teacherNotes: val
                      }
                    }));
                  }}
                  placeholder="مثال: يظهر الطالب فهماً ممتازاً للمفاهيم الرياضية ولكنه يتعجل في العمليات الحسابية، يحتاج للتركيز على خطوات الحل..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: '1.5' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleGenerateAIForStudent(selectedStudentForPlan, planModalData.teacherNotes)}
                    disabled={generatingAIForId === selectedStudentForPlan.student.id}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={12} />
                    <span>إعادة توليد بالذكاء الاصطناعي بناءً على هذه الملاحظات</span>
                  </button>
                </div>
              </div>

              {/* Parent Language Visibility Selector */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>
                  تحديد الردود واللغة التي ستظهر لولي الأمر في التقرير:
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'ar', label: '🇸🇦 لغة عربية فقط' },
                    { id: 'en', label: '🇬🇧 إنجليزية فقط (English Only)' },
                    { id: 'both', label: '🌐 اللغتان معاً (عربي + إنجليزي)' }
                  ].map(opt => (
                    <label key={opt.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: planModalData.parentLanguageDisplay === opt.id ? '#16a34a' : 'white',
                      color: planModalData.parentLanguageDisplay === opt.id ? 'white' : '#334155',
                      border: `1px solid ${planModalData.parentLanguageDisplay === opt.id ? '#16a34a' : '#cbd5e1'}`,
                      transition: 'all 0.15s'
                    }}>
                      <input
                        type="radio"
                        name="parentLanguageDisplay"
                        checked={planModalData.parentLanguageDisplay === opt.id}
                        onChange={() => setPlanModalData(prev => ({ ...prev, parentLanguageDisplay: opt.id }))}
                        style={{ display: 'none' }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Bilingual Tabs Navigation */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
                <button
                  type="button"
                  onClick={() => setPlanModalLangTab('ar')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    border: 'none',
                    background: planModalLangTab === 'ar' ? '#0284c7' : '#f1f5f9',
                    color: planModalLangTab === 'ar' ? 'white' : '#64748b'
                  }}
                >
                  🇸🇦 النسخة العربية (Arabic)
                </button>

                <button
                  type="button"
                  onClick={() => setPlanModalLangTab('en')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px 8px 0 0',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: 'pointer',
                    border: 'none',
                    background: planModalLangTab === 'en' ? '#0284c7' : '#f1f5f9',
                    color: planModalLangTab === 'en' ? 'white' : '#64748b'
                  }}
                >
                  🇬🇧 English Version
                </button>
              </div>

              {/* Tab 1: Arabic Content */}
              {planModalLangTab === 'ar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                      عنوان البرنامج
                    </label>
                    <input 
                      type="text"
                      value={planModalData.ar?.title || ''}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        ar: { ...(prev.ar || {}), title: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                      التشخيص التربوي للمستوى
                    </label>
                    <textarea 
                      rows="2"
                      value={planModalData.ar?.diagnosis || ''}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        ar: { ...(prev.ar || {}), diagnosis: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                      بنود الخطة الموصى بها (بند في كل سطر)
                    </label>
                    <textarea 
                      rows="3"
                      value={Array.isArray(planModalData.ar?.actionPlan) ? planModalData.ar.actionPlan.join('\n') : (planModalData.ar?.actionPlan || '')}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        ar: { 
                          ...(prev.ar || {}), 
                          actionPlan: e.target.value.split('\n').filter(line => line.trim().length > 0) 
                        }
                      }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: '1.5' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
                      توجيهات لولي الأمر في التقرير
                    </label>
                    <textarea 
                      rows="2"
                      value={planModalData.ar?.parentAdvice || ''}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        ar: { ...(prev.ar || {}), parentAdvice: e.target.value }
                      }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: English Content */}
              {planModalLangTab === 'en' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', direction: 'ltr' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Program Title (English)
                    </label>
                    <input 
                      type="text"
                      value={planModalData.en?.title || ''}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        en: { ...(prev.en || {}), title: e.target.value }
                      }))}
                      placeholder="e.g. Academic Excellence Program"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Educational Diagnosis (English)
                    </label>
                    <textarea 
                      rows="2"
                      value={planModalData.en?.diagnosis || ''}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        en: { ...(prev.en || {}), diagnosis: e.target.value }
                      }))}
                      placeholder="e.g. The student demonstrated strong conceptual understanding..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Action Plan Points (One per line)
                    </label>
                    <textarea 
                      rows="3"
                      value={Array.isArray(planModalData.en?.actionPlan) ? planModalData.en.actionPlan.join('\n') : (planModalData.en?.actionPlan || '')}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        en: { 
                          ...(prev.en || {}), 
                          actionPlan: e.target.value.split('\n').filter(line => line.trim().length > 0) 
                        }
                      }))}
                      placeholder="e.g. Review targeted worksheets\nFollow up with classroom teacher"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: '1.5' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b', textAlign: 'left' }}>
                      Parent Guidance Advice (English)
                    </label>
                    <textarea 
                      rows="2"
                      value={planModalData.en?.parentAdvice || ''}
                      onChange={(e) => setPlanModalData(prev => ({
                        ...prev,
                        en: { ...(prev.en || {}), parentAdvice: e.target.value }
                      }))}
                      placeholder="e.g. Please assist in organizing daily home review routines..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button 
                  type="button" 
                  onClick={() => setPlanModalOpen(false)}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}
                >
                  إلغاء
                </button>

                <button 
                  type="button" 
                  onClick={() => {
                    handleSaveStudentGrade(selectedStudentForPlan, planModalData);
                    setPlanModalOpen(false);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '8px 22px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={16} />
                  <span>حفظ واعتماد الخطة</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
