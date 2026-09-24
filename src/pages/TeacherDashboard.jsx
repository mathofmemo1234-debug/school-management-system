import Settings from './Settings';
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Calendar, FileText, Users, X, Edit, Trash2, CheckSquare, Square, Plus, Save, Award, AlertCircle, CheckCircle, BarChart2, Clock, BookOpen, Eye, RotateCcw, Check, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { db, auth } from '../firebase';
import TeacherSchedule from './TeacherSchedule';
import { doc, setDoc, getDoc, collection, addDoc, query, where, onSnapshot, deleteDoc, updateDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import LessonPreparation from './LessonPreparation';
import MaterialsUpload from './MaterialsUpload';
import TeacherExams from './TeacherExams';
import TeacherGradeEntry from './TeacherGradeEntry';
import SchoolExcellenceDashboard from './SchoolExcellenceDashboard';
import AttendanceSummaryExport from '../components/AttendanceSummaryExport';
import SchoolMessagingHub from './SchoolMessagingHub';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import ComprehensiveStudentRecord from './ComprehensiveStudentRecord';
import TeacherPerformanceEvaluationHub from './TeacherPerformanceEvaluationHub';
import MarkdownInput from '../components/MarkdownInput';
import { useLanguage } from '../contexts/LanguageContext';
import SharedQuestionBankModal from '../components/SharedQuestionBankModal';
import GamificationBadge from '../components/GamificationBadge';
import { calculateTeacherActivity, calculateStudentActivity } from '../utils/gamificationEngine';
import { Sparkles, Star, Zap } from 'lucide-react';

function TeacherTasks() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Teacher activity state for gamification
  const [preparations, setPreparations] = useState([]);
  const [weeklyPlans, setWeeklyPlans] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [teacherExams, setTeacherExams] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [teacherDocId, setTeacherDocId] = useState(null);

  // Fetch teacher Doc ID
  useEffect(() => {
    if (userData?.nationalId) {
      const q = query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId));
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          setTeacherDocId(snap.docs[0].id);
        } else if (!isNaN(userData.nationalId)) {
          const numQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)));
          getDocs(numQ).then(numSnap => {
            if (!numSnap.empty) setTeacherDocId(numSnap.docs[0].id);
          });
        }
      });
      return () => unsub();
    }
  }, [userData]);

  // Fetch teacher activity documents for gamification calculation
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';

    // Preparations
    const qPrep = schoolId === 'ALL'
      ? collection(db, 'preparations')
      : query(collection(db, 'preparations'), where('schoolId', '==', schoolId));
    const unsubPrep = onSnapshot(qPrep, snap => {
      setPreparations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Weekly Plans
    const qPlans = schoolId === 'ALL'
      ? collection(db, 'weekly_plans')
      : query(collection(db, 'weekly_plans'), where('schoolId', '==', schoolId));
    const unsubPlans = onSnapshot(qPlans, snap => {
      setWeeklyPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Assignments
    const qAssign = schoolId === 'ALL'
      ? collection(db, 'assignments')
      : query(collection(db, 'assignments'), where('schoolId', '==', schoolId));
    const unsubAssign = onSnapshot(qAssign, snap => {
      setTeacherAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Exams
    const qExams = schoolId === 'ALL'
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('schoolId', '==', schoolId));
    const unsubExams = onSnapshot(qExams, snap => {
      setTeacherExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Materials
    const qMat = schoolId === 'ALL'
      ? collection(db, 'materials')
      : query(collection(db, 'materials'), where('schoolId', '==', schoolId));
    const unsubMat = onSnapshot(qMat, snap => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Attendance logs
    const qAtt = schoolId === 'ALL'
      ? collection(db, 'attendance')
      : query(collection(db, 'attendance'), where('schoolId', '==', schoolId));
    const unsubAtt = onSnapshot(qAtt, snap => {
      setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubPrep();
      unsubPlans();
      unsubAssign();
      unsubExams();
      unsubMat();
      unsubAtt();
    };
  }, [userData?.schoolId]);

  // Compute Teacher activity & gamification points
  const teacherActivity = useMemo(() => {
    return calculateTeacherActivity({
      teacherId: teacherDocId || auth.currentUser?.uid,
      teacherEmail: auth.currentUser?.email || '',
      preparations,
      weeklyPlans,
      assignments: teacherAssignments,
      exams: teacherExams,
      attendanceLogs,
      materials
    });
  }, [teacherDocId, preparations, weeklyPlans, teacherAssignments, teacherExams, attendanceLogs, materials]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'tasks'),
      where('teacherId', '==', auth.currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() });
      });
      // Sort so incomplete tasks are at the top
      tasksData.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
      setTasks(tasksData);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !auth.currentUser) return;
    
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTaskTitle,
        completed: false,
        teacherId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setNewTaskTitle('');
    } catch (error) {
      console.error("Error adding task:", error);
      alert(t('teacherDashboard.addTaskFail'));
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTask = async (task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completed: !task.completed
      });
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Teacher Professional Activity & Gamification Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #0e7490 100%)',
        borderRadius: '20px',
        padding: '24px 28px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(15, 118, 110, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background ambient light */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          left: '-30px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, rgba(234, 179, 8, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.4rem' }}>👨‍🏫</span>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
                مرحباً بك، {userData?.name || 'الأستاذ الفاضل'}
              </h2>
            </div>
            <p style={{ margin: '0 0 12px 0', opacity: 0.9, fontSize: '0.92rem' }}>
              مؤشر النشاط والتميز المهني للمعلم • احتساب تلقائي لنقاط التحاضير، الخطط، الواجبات، الاختبارات ورصد الحضور
            </p>
            <Link
              to="/teacher/student-records"
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #fef08a 0%, #facc15 100%)',
                color: '#713f12',
                border: 'none',
                fontWeight: 800,
                fontSize: '13px',
                padding: '8px 18px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(250, 204, 21, 0.4)'
              }}
            >
              <ClipboardList size={17} /> سجل متابعة الطالب الشامل (فصولك المسندة)
            </Link>
          </div>

          {/* Golden Stars & Points Badge Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '10px 18px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#ccfbf1', marginBottom: '2px', fontWeight: 600 }}>
                رتبة التميز المهني:
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{teacherActivity?.levelBadge || '🌱'}</span>
                <span>{teacherActivity?.levelTitle || 'معلم مبادر'}</span>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.25)' }} />

            <div>
              <div style={{ fontSize: '0.75rem', color: '#ccfbf1', marginBottom: '2px', fontWeight: 600 }}>
                النجوم والنقاط:
              </div>
              <GamificationBadge
                points={teacherActivity?.totalPoints || 0}
                stars={teacherActivity?.stars || 1}
                size="md"
                showStars={true}
                showPoints={true}
                isTeacher={true}
                breakdown={teacherActivity?.breakdown}
              />
            </div>
          </div>
        </div>

        {/* Progress Bar to next Star / Level */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600 }}>
            <span style={{ color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} />
              التقدم نحو النجمة / الرتبة التالية ({teacherActivity?.nextLevel ? teacherActivity.nextLevel.title : 'أعلى رتبة قيادية 👑'})
            </span>
            <span style={{ color: '#ccfbf1' }}>
              {teacherActivity?.totalPoints || 0} / {teacherActivity?.nextLevel ? teacherActivity.nextLevel.minPoints : (teacherActivity?.totalPoints || 0)} نقطة
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${teacherActivity?.progressToNext || 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #facc15 0%, #fef08a 100%)',
              borderRadius: '10px',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
        </div>

        {/* Activity Breakdown Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: '#ccfbf1', display: 'block' }}>📖 التحاضير</span>
            <strong style={{ fontSize: '0.95rem' }}>{teacherActivity?.breakdown?.preparationsCount || 0} درس</strong> <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(+{teacherActivity?.breakdown?.prepPoints || 0} ن)</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: '#ccfbf1', display: 'block' }}>📅 الخطط الأسبوعية</span>
            <strong style={{ fontSize: '0.95rem' }}>{teacherActivity?.breakdown?.weeklyPlansCount || 0} خطة</strong> <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(+{teacherActivity?.breakdown?.planPoints || 0} ن)</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: '#ccfbf1', display: 'block' }}>📝 الواجبات</span>
            <strong style={{ fontSize: '0.95rem' }}>{teacherActivity?.breakdown?.assignmentsCount || 0} واجب</strong> <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(+{teacherActivity?.breakdown?.assignmentPoints || 0} ن)</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: '#ccfbf1', display: 'block' }}>📋 الاختبارات</span>
            <strong style={{ fontSize: '0.95rem' }}>{teacherActivity?.breakdown?.examsCount || 0} اختبار</strong> <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(+{teacherActivity?.breakdown?.examPoints || 0} ن)</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: '#ccfbf1', display: 'block' }}>👥 رصد الحضور</span>
            <strong style={{ fontSize: '0.95rem' }}>{teacherActivity?.breakdown?.attendanceSessionsCount || 0} جلسة</strong> <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(+{teacherActivity?.breakdown?.attendancePoints || 0} ن)</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: '#ccfbf1', display: 'block' }}>📂 المواد الإثرائية</span>
            <strong style={{ fontSize: '0.95rem' }}>{teacherActivity?.breakdown?.materialsCount || 0} ملف</strong> <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>(+{teacherActivity?.breakdown?.materialPoints || 0} ن)</span>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>{t('teacherDashboard.todayTasks')}</h2>
        </div>
        
        <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder={t('teacherDashboard.enterNewTask')} 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" className="btn btn-primary" disabled={isAdding || !newTaskTitle.trim()}>
            <Plus size={16} /> {t('teacherDashboard.addTask')}
          </button>
        </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>{t('teacherDashboard.noTasks')}</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} style={{ 
              background: 'white', 
              padding: '16px', 
              borderRadius: '8px', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center', 
              borderLeft: `4px solid ${task.completed ? 'var(--color-text-muted)' : 'var(--color-primary)'}`,
              opacity: task.completed ? 0.7 : 1
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', flex: 1 }} onClick={() => toggleTask(task)}>
                {task.completed ? <CheckSquare color="var(--color-primary)" /> : <Square color="var(--color-text-muted)" />}
                <span style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</span>
              </div>
              <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}>
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  );
}

function WeeklyPlan() {
  const { t } = useLanguage();
  const daysKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
  const WEEKS = Array.from({length: 18}, (_, i) => `الأسبوع ${i + 1}`);
  const [plan, setPlan] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(WEEKS[0]);
  const [classesList, setClassesList] = useState([]);
  const [planDocId, setPlanDocId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { userData } = useAuth();
  const [teacherDocId, setTeacherDocId] = useState(null);

  // Fetch teacher doc ID based on nationalId
  useEffect(() => {
    if (userData?.nationalId) {
      const unsub = onSnapshot(query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId)), (snap) => {
        if (!snap.empty) {
          setTeacherDocId(snap.docs[0].id);
        } else if (!isNaN(userData.nationalId)) {
          const numQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)));
          getDocs(numQ).then(numSnap => {
            if (!numSnap.empty) setTeacherDocId(numSnap.docs[0].id);
            else setTeacherDocId(null);
          });
        } else {
          setTeacherDocId(null);
        }
      });
      return () => unsub();
    }
  }, [userData]);

  // Fetch available classes for this teacher based on their schedule
  useEffect(() => {
    if (!teacherDocId) {
      setClassesList([]);
      return;
    }
    
    // First fetch classes for this school to get their names
    const schoolId = userData?.schoolId || 'default_school_1';
    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsubClasses = onSnapshot(qClasses, (classesSnap) => {
      const classNames = {};
      classesSnap.docs.forEach(d => classNames[d.id] = d.data().name);
      
      // Then fetch schedules for this school to see which classes this teacher teaches
      const qSchedules = schoolId === 'ALL'
        ? collection(db, 'schedules')
        : query(collection(db, 'schedules'), where('schoolId', '==', schoolId));

      const unsubSchedules = onSnapshot(qSchedules, (schedulesSnap) => {
        const myClassNames = new Set();
        schedulesSnap.docs.forEach(docSnap => {
          const matrix = docSnap.data().matrix || {};
          let isTeaching = false;
          Object.values(matrix).forEach(cell => {
            if (cell.teacherId === teacherDocId) {
              isTeaching = true;
            }
          });
          if (isTeaching && classNames[docSnap.id]) {
            myClassNames.add(classNames[docSnap.id]);
          }
        });
        setClassesList(Array.from(myClassNames));
      });
      
      return () => unsubSchedules();
    });
    
    return () => unsubClasses();
  }, [teacherDocId, userData?.schoolId]);

  // Fetch existing plan for selected class
  useEffect(() => {
    if (!auth.currentUser || !selectedClass || !teacherDocId) {
      setPlan({});
      setPlanDocId(null);
      return;
    }
    const q = query(
      collection(db, 'weekly_plans'),
      where('teacherId', '==', teacherDocId),
      where('className', '==', selectedClass),
      where('week', '==', selectedWeek)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setPlan(snapshot.docs[0].data().plan || {});
        setPlanDocId(snapshot.docs[0].id);
      } else {
        setPlan({});
        setPlanDocId(null);
      }
    });
    return () => unsub();
  }, [selectedClass, selectedWeek, teacherDocId]);

  const handleChange = (day, field, value) => {
    setPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return alert(t('teacherDashboard.mustLogin'));
    if (!selectedClass) return alert(t('teacherDashboard.mustSelectClass'));
    setIsSaving(true);
    try {
      const payload = {
        teacherId: teacherDocId,
        teacherEmail: auth.currentUser.email,
        schoolId: userData?.schoolId || 'default_school_1',
        className: selectedClass,
        week: selectedWeek,
        plan: plan,
        updatedAt: new Date().toISOString()
      };

      if (planDocId) {
        await updateDoc(doc(db, 'weekly_plans', planDocId), payload);
      } else {
        await addDoc(collection(db, 'weekly_plans'), payload);
      }
      alert(t('teacherDashboard.planSaveSuccess'));
    } catch (error) {
      console.error("Error saving plan:", error);
      alert(t('teacherDashboard.planSaveFail'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>{t('teacherDashboard.weeklyPlan')}</h2>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select 
            className="input-field" 
            style={{ width: '200px', marginBottom: 0 }}
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">{t('teacherDashboard.selectClass')}</option>
            {classesList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select 
            className="input-field" 
            style={{ width: '200px', marginBottom: 0 }}
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {WEEKS.map(w => (
              <option key={w} value={w}>{w.replace('الأسبوع', t('lessonPreparation.weekPrefix'))}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || !selectedClass}>
            <Save size={18} /> {isSaving ? t('teacherDashboard.saving') : t('teacherDashboard.savePlan')}
          </button>
        </div>
      </div>
      
      {!selectedClass ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
          {t('teacherDashboard.pleaseSelectClassPlan')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {daysKeys.map(dayKey => (
            <div key={dayKey} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ borderBottom: '2px solid var(--color-bg)', paddingBottom: '10px', marginBottom: '16px', color: 'var(--color-primary-dark)' }}>{t(`days.${dayKey}`)}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>{t('teacherDashboard.lessonTopicLabel')}</label>
                  <input 
                    type="text" 
                    placeholder={t('teacherDashboard.lessonTopicPlaceholder')} 
                    value={plan[dayKey]?.topic || ''}
                    onChange={(e) => handleChange(dayKey, 'topic', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600, color: '#15803d', marginBottom: '6px', display: 'block' }}>📝 {t('teacherDashboard.lessonHomeworkLabel') || 'الواجب'}</label>
                  <input 
                    type="text" 
                    placeholder={t('teacherDashboard.lessonHomeworkPlaceholder') || 'اكتب الواجب المطلوب...'} 
                    value={plan[dayKey]?.homework ?? plan[dayKey]?.goals ?? ''}
                    onChange={(e) => handleChange(dayKey, 'homework', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontWeight: 600, color: '#a16207', marginBottom: '6px', display: 'block' }}>📌 {t('teacherDashboard.lessonNotesLabel') || 'ملاحظات أو مهام إضافية'}</label>
                  <input 
                    type="text" 
                    placeholder={t('teacherDashboard.lessonNotesPlaceholder') || 'أدخل ملاحظات أو مهام إضافية...'} 
                    value={plan[dayKey]?.notes || ''}
                    onChange={(e) => handleChange(dayKey, 'notes', e.target.value)}
                  />
                </div>
              </div>
              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Assignments() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [teacherDocId, setTeacherDocId] = useState(null);

  // Modes: 'list' | 'create' | 'edit' | 'results'
  const [activeView, setActiveView] = useState('list');
  const [currentAssignment, setCurrentAssignment] = useState(null);

  // Form State
  const [assignmentType, setAssignmentType] = useState('electronic'); // 'electronic' | 'manual'
  const [title, setTitle] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [allowedAttempts, setAllowedAttempts] = useState('2'); // '1' | '2' | '3' | 'unlimited'
  const [numQuestions, setNumQuestions] = useState(1);
  const [questions, setQuestions] = useState([]);
  
  // Manual Assignment Specific State
  const [bookPage, setBookPage] = useState('');
  const [exerciseNumbers, setExerciseNumbers] = useState('');
  const [instructions, setInstructions] = useState('');
  const [maxScore, setMaxScore] = useState('5');
  const [submissionMethod, setSubmissionMethod] = useState('notebook'); // 'notebook' | 'upload' | 'both'
  const [isSaving, setIsSaving] = useState(false);
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);

  // Results State
  const [assignmentResults, setAssignmentResults] = useState([]);
  const [studentsCache, setStudentsCache] = useState({});
  const [studentActivityMap, setStudentActivityMap] = useState({});
  const [viewingSubmission, setViewingSubmission] = useState(null);
  
  // Manual Grading Roster State
  const [manualClassStudents, setManualClassStudents] = useState([]);
  const [manualGrades, setManualGrades] = useState({}); // { [studentId]: { score, isSubmitted, note } }
  const [isSavingManualGrades, setIsSavingManualGrades] = useState(false);

  // Fetch teacher ID & subjects
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
    const unsub = onSnapshot(qClasses, (snap) => {
      setClassesList(snap.docs.map(doc => doc.data().name));
    });
    return () => unsub();
  }, [userData?.schoolId]);

  // Fetch teacher's assignments
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';
    const qAssignments = schoolId === 'ALL'
      ? collection(db, 'assignments')
      : query(collection(db, 'assignments'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qAssignments, (snapshot) => {
      const tid = teacherDocId || auth.currentUser?.uid;
      const tEmail = auth.currentUser?.email;
      const tNat = userData?.nationalId;

      const data = [];
      snapshot.forEach((docSnap) => {
        const d = { id: docSnap.id, ...docSnap.data() };
        const isMine = 
          !d.teacherId ||
          d.teacherId === tid ||
          d.teacherId === auth.currentUser?.uid ||
          d.teacherId === tNat ||
          d.teacherEmail === tEmail ||
          userData?.role === 'superadmin' ||
          userData?.role === 'admin';
        
        if (isMine) {
          data.push(d);
        }
      });
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setAssignments(data);
    });
    return () => unsub();
  }, [teacherDocId, userData]);

  // Fetch students for results view + compute gamification
  useEffect(() => {
    if (activeView === 'results') {
      const schoolId = userData?.schoolId || 'default_school_1';
      const qStudents = schoolId === 'ALL'
        ? collection(db, 'students')
        : query(collection(db, 'students'), where('schoolId', '==', schoolId));

      const qA = schoolId === 'ALL' ? collection(db, 'assignment_results') : query(collection(db, 'assignment_results'), where('schoolId', '==', schoolId));
      const qE = schoolId === 'ALL' ? collection(db, 'exam_results') : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));
      const qAtt = schoolId === 'ALL' ? collection(db, 'attendance') : query(collection(db, 'attendance'), where('schoolId', '==', schoolId));

      Promise.all([getDocs(qStudents), getDocs(qA), getDocs(qE), getDocs(qAtt)]).then(([snapS, snapA, snapE, snapAtt]) => {
        const cache = {};
        const sList = [];
        snapS.forEach(d => {
          cache[d.id] = d.data().name;
          sList.push({ id: d.id, ...d.data() });
        });
        setStudentsCache(cache);

        const aList = snapA.docs.map(d => d.data());
        const eList = snapE.docs.map(d => d.data());
        const attList = snapAtt.docs.map(d => d.data());

        const map = {};
        sList.forEach(s => {
          map[s.id] = calculateStudentActivity({
            studentId: s.id,
            assignmentResults: aList,
            examResults: eList,
            attendanceDocs: attList
          });
        });
        setStudentActivityMap(map);
      });
    }
  }, [activeView, userData?.schoolId]);

  // Initialize questions
  useEffect(() => {
    if (activeView === 'list' || activeView === 'results') return;
    const count = parseInt(numQuestions) || 1;
    setQuestions(prev => {
      const newQs = [...prev];
      if (newQs.length < count) {
        for (let i = newQs.length; i < count; i++) {
          newQs.push({
            id: `q_hw_${Date.now()}_${i}`,
            text: '',
            options: ['( أ )', '( ب )', '( ج )', '( د )'],
            correctOption: 0
          });
        }
      } else if (newQs.length > count) {
        newQs.splice(count);
      }
      return newQs;
    });
  }, [numQuestions, activeView]);

  const resetForm = () => {
    setCurrentAssignment(null);
    setAssignmentType('electronic');
    setTitle('');
    setTargetClass(classesList[0] || '');
    setSubject(subjectsList[0] || '');
    setDueDate('');
    setAllowedAttempts('2');
    setNumQuestions(1);
    setQuestions([]);
    setBookPage('');
    setExerciseNumbers('');
    setInstructions('');
    setMaxScore('5');
    setSubmissionMethod('notebook');
    setActiveView('list');
    setAssignmentResults([]);
    setViewingSubmission(null);
    setManualClassStudents([]);
    setManualGrades({});
  };

  const handleEdit = (assignment) => {
    setCurrentAssignment(assignment);
    const isMan = assignment.type === 'manual' || assignment.isInteractive === false;
    setAssignmentType(isMan ? 'manual' : 'electronic');
    setTitle(assignment.title || '');
    setTargetClass(assignment.targetClass || assignment.className || '');
    setSubject(assignment.subject || '');
    setDueDate(assignment.dueDate || '');
    setAllowedAttempts(String(assignment.allowedAttempts || '2'));
    setBookPage(assignment.bookPage || '');
    setExerciseNumbers(assignment.exerciseNumbers || '');
    setInstructions(assignment.instructions || '');
    setMaxScore(String(assignment.maxScore || assignment.totalQuestions || '5'));
    setSubmissionMethod(assignment.submissionMethod || 'notebook');

    const qs = assignment.questions || [];
    setNumQuestions(qs.length || 1);
    setQuestions(qs);
    setActiveView('edit');
  };

  const handleViewResults = async (assignment) => {
    setCurrentAssignment(assignment);
    setActiveView('results');

    const schoolId = userData?.schoolId || 'default_school_1';
    const q = query(collection(db, 'assignment_results'), where('assignmentId', '==', assignment.id));
    const snap = await getDocs(q);
    const results = [];
    const gradesMap = {};
    snap.forEach(d => {
      const data = d.data();
      results.push({ id: d.id, ...data });
      if (data.studentId) {
        gradesMap[data.studentId] = {
          score: data.score !== undefined ? data.score : '',
          isSubmitted: data.isSubmitted !== undefined ? data.isSubmitted : true,
          note: data.note || ''
        };
      }
    });
    results.sort((a, b) => new Date(b.timestamp?.toDate ? b.timestamp.toDate() : b.timestamp) - new Date(a.timestamp?.toDate ? a.timestamp.toDate() : a.timestamp));
    setAssignmentResults(results);

    // If manual assignment, fetch all students of target class to facilitate grading roster
    if (assignment.type === 'manual' || assignment.isInteractive === false) {
      const qStudents = schoolId === 'ALL'
        ? collection(db, 'students')
        : query(collection(db, 'students'), where('schoolId', '==', schoolId));
      
      const studentsSnap = await getDocs(qStudents);
      const sList = [];
      const target = (assignment.targetClass || assignment.className || '').trim();
      studentsSnap.forEach(d => {
        const data = d.data();
        const sClass = (data.class || data.className || '').trim();
        if (!target || sClass === target || sClass.includes(target) || target.includes(sClass)) {
          sList.push({ id: d.id, ...data });
        }
      });
      sList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      setManualClassStudents(sList);
      setManualGrades(gradesMap);
    }
  };

  const handleSaveManualGrades = async () => {
    if (!currentAssignment) return;
    setIsSavingManualGrades(true);
    try {
      const max = parseFloat(currentAssignment.maxScore || maxScore) || 5;
      const schoolId = userData?.schoolId || 'default_school_1';

      for (const student of manualClassStudents) {
        const gradeInfo = manualGrades[student.id];
        if (gradeInfo && (gradeInfo.score !== '' || gradeInfo.note || gradeInfo.isSubmitted !== undefined)) {
          const docKey = `${currentAssignment.id}_${student.id}`;
          const numScore = gradeInfo.score !== '' ? Math.min(max, Math.max(0, parseFloat(gradeInfo.score) || 0)) : 0;
          
          await setDoc(doc(db, 'assignment_results', docKey), {
            assignmentId: currentAssignment.id,
            assignmentTitle: currentAssignment.title,
            studentId: student.id,
            studentName: student.name || 'طالب',
            nationalId: student.nationalId || '',
            className: currentAssignment.targetClass || currentAssignment.className,
            subject: currentAssignment.subject || 'عام',
            isManual: true,
            isSubmitted: gradeInfo.isSubmitted !== false,
            score: numScore,
            totalQuestions: max,
            maxScore: max,
            note: gradeInfo.note || '',
            schoolId,
            timestamp: new Date().toISOString()
          }, { merge: true });
        }
      }
      alert('تم حفظ ورصد درجات الواجب اليدوي لجميع الطلاب بنجاح!');
      handleViewResults(currentAssignment);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ درجات الواجب اليدوي: ' + err.message);
    } finally {
      setIsSavingManualGrades(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا الواجب؟')) {
      await deleteDoc(doc(db, 'assignments', id));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const tid = teacherDocId || auth.currentUser?.uid;
    if (!tid) return;

    if (assignmentType === 'electronic') {
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].text) {
          alert(`يرجى كتابة نص السؤال رقم ${i + 1}`);
          return;
        }
        for (let j = 0; j < 4; j++) {
          if (!questions[i].options[j]) {
            alert(`يرجى تعبئة الخيار رقم ${j + 1} للسؤال رقم ${i + 1}`);
            return;
          }
        }
      }
    }

    setIsSaving(true);
    const payload = {
      teacherId: tid,
      teacherName: userData?.name || 'معلم',
      teacherEmail: auth.currentUser?.email || '',
      title,
      type: assignmentType,
      targetClass,
      className: targetClass,
      subject,
      dueDate,
      schoolId: userData?.schoolId || 'default_school_1',
      schoolName: userData?.schoolName || '',
      updatedAt: new Date().toISOString()
    };

    if (assignmentType === 'electronic') {
      payload.isInteractive = true;
      payload.allowedAttempts = allowedAttempts === 'unlimited' ? 'unlimited' : parseInt(allowedAttempts);
      payload.questions = questions;
      payload.totalQuestions = questions.length;
    } else {
      payload.isInteractive = false;
      payload.bookPage = bookPage;
      payload.exerciseNumbers = exerciseNumbers;
      payload.instructions = instructions;
      payload.maxScore = parseFloat(maxScore) || 5;
      payload.totalQuestions = parseFloat(maxScore) || 5;
      payload.submissionMethod = submissionMethod;
    }

    try {
      if (activeView === 'edit' && currentAssignment) {
        await updateDoc(doc(db, 'assignments', currentAssignment.id), payload);
      } else {
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'assignments'), payload);
      }
      alert(assignmentType === 'manual' ? 'تم حفظ الواجب اليدوي بنجاح!' : 'تم حفظ الواجب الإلكتروني بنجاح!');
      resetForm();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الواجب');
    } finally {
      setIsSaving(false);
    }
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

  // Render Submissions & Results View
  if (activeView === 'results') {
    const isManual = currentAssignment?.type === 'manual' || currentAssignment?.isInteractive === false;
    const maxScoreVal = currentAssignment?.maxScore || currentAssignment?.totalQuestions || 5;

    return (
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 /> {isManual ? 'رصد ومتابعة درجات الواجب اليدوي:' : 'تسليمات ودرجات واجب:'} {currentAssignment?.title}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              الفصل: <strong>{currentAssignment?.targetClass || currentAssignment?.className}</strong> | المادة: <strong>{currentAssignment?.subject}</strong> | آخر موعد: <strong>{currentAssignment?.dueDate}</strong> {isManual && `| النهاية العظمى: ${maxScoreVal} درجات`}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {isManual && (
              <button 
                className="btn btn-primary" 
                onClick={handleSaveManualGrades}
                disabled={isSavingManualGrades}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} /> {isSavingManualGrades ? 'جاري الحفظ...' : 'حفظ ورصد درجات جميع الطلاب'}
              </button>
            )}
            <button className="btn btn-outline" onClick={resetForm}>العودة للواجبات</button>
          </div>
        </div>

        {/* If Manual Homework: Render Student Roster with live grading inputs */}
        {isManual ? (
          <div>
            {/* Information card about manual assignment */}
            <div style={{ background: '#f0f9ff', padding: '14px 18px', borderRadius: '10px', border: '1px solid #bae6fd', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '14px' }}>
              {currentAssignment.bookPage && <div>📖 رقم الصفحة: <strong>{currentAssignment.bookPage}</strong></div>}
              {currentAssignment.exerciseNumbers && <div>✏️ التمارين المطلوبة: <strong>{currentAssignment.exerciseNumbers}</strong></div>}
              <div>🎯 الدرجة العظمى: <strong>{maxScoreVal} درجات</strong></div>
              <div>📥 طريقة التسليم: <strong>{currentAssignment.submissionMethod === 'notebook' ? 'كراسة الواجب في الصف' : currentAssignment.submissionMethod === 'upload' ? 'تصوير وإرفاق الحل بالمنصة' : 'كراسة الواجب / إرفاق بالمنصة'}</strong></div>
              {currentAssignment.instructions && (
                <div style={{ width: '100%', marginTop: '4px', color: '#0369a1' }}>
                  <strong>تعليمات الحل:</strong> {currentAssignment.instructions}
                </div>
              )}
            </div>

            {manualClassStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                لا يوجد طلاب مسجلين في هذا الفصل
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px 14px', fontSize: '13px', width: '40px', textAlign: 'center' }}>م</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>اسم الطالب / الهوية</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>حالة التسليم</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center', width: '140px' }}>الدرجة المرصودة (من {maxScoreVal})</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>ملاحظات المعلم والتغذية الراجعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualClassStudents.map((student, idx) => {
                      const gradeData = manualGrades[student.id] || { score: '', isSubmitted: false, note: '' };
                      const isSub = gradeData.isSubmitted;

                      return (
                        <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{student.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>هوية: {student.nationalId || '—'}</div>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: isSub ? '#166534' : '#64748b' }}>
                              <input
                                type="checkbox"
                                checked={isSub}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setManualGrades(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      isSubmitted: checked,
                                      score: checked && (prev[student.id]?.score === '' || prev[student.id]?.score === undefined) ? maxScoreVal : prev[student.id]?.score
                                    }
                                  }));
                                }}
                              />
                              {isSub ? '✅ تم التسليم' : 'لم يسلم'}
                            </label>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min="0"
                                max={maxScoreVal}
                                step="0.5"
                                value={gradeData.score !== undefined ? gradeData.score : ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setManualGrades(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      score: val,
                                      isSubmitted: val !== '' ? true : prev[student.id]?.isSubmitted
                                    }
                                  }));
                                }}
                                placeholder="—"
                                style={{
                                  width: '70px',
                                  textAlign: 'center',
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #cbd5e1',
                                  fontWeight: 'bold',
                                  fontSize: '14px'
                                }}
                              />
                              <span style={{ fontSize: '12px', color: '#64748b' }}>/ {maxScoreVal}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <input
                              type="text"
                              value={gradeData.note || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setManualGrades(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    ...prev[student.id],
                                    note: val
                                  }
                                }));
                              }}
                              placeholder="مثال: ممتاز ومرتب، ينقص تمرين رقم 3..."
                              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveManualGrades}
                disabled={isSavingManualGrades}
                style={{ padding: '10px 32px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Save size={18} /> {isSavingManualGrades ? 'جاري الحفظ...' : 'حفظ ورصد درجات جميع الطلاب'}
              </button>
            </div>
          </div>
        ) : (
          /* Electronic Homework Results */
          <div>
            {assignmentResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                لم يقم أي طالب بتسليم هذا الواجب حتى الآن
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontSize: '13px' }}>اسم الطالب</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>الدرجة</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>النسبة</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>رقم المحاولة</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px' }}>وقت التسليم</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>حالة التسليم</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>الإجابات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentResults.map((res, idx) => {
                      const totalQ = Math.max(parseFloat(res.maxScore) || 0, (parseFloat(res.totalQuestions) > 1 ? parseFloat(res.totalQuestions) : 0), parseFloat(res.score) || 0, 1);
                      const pct = Math.min(100, Math.round(((parseFloat(res.score) || 0) / totalQ) * 100));
                      const isPass = pct >= 50;
                      const dateStr = res.timestamp?.toDate ? res.timestamp.toDate().toLocaleString('ar-SA') : (res.timestamp ? new Date(res.timestamp).toLocaleString('ar-SA') : '—');
                      
                      return (
                        <tr key={res.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span>{studentsCache[res.studentId] || res.studentName || 'طالب'}</span>
                              <GamificationBadge
                                points={studentActivityMap[res.studentId]?.totalPoints || 0}
                                stars={studentActivityMap[res.studentId]?.stars || 1}
                                size="xs"
                                breakdown={studentActivityMap[res.studentId]?.breakdown}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#0e7490' }}>
                            <span dir="ltr">{res.score} / {totalQ}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: isPass ? '#166534' : '#991b1b' }}>
                            {pct}%
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            المحاولة {res.attemptNumber || 1}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>
                            {dateStr}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              background: res.isLate ? '#fee2e2' : '#dcfce7',
                              color: res.isLate ? '#991b1b' : '#166534'
                            }}>
                              {res.isLate ? 'تسليم متأخر' : 'في الموعد'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setViewingSubmission(res)}
                            >
                              <Eye size={14} /> مراجعة الحل
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
        )}

        {/* Modal to view student answers (Electronic) */}
        {viewingSubmission && currentAssignment && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
                  إجابات الطالب: {studentsCache[viewingSubmission.studentId] || viewingSubmission.studentName}
                </h3>
                <button className="btn btn-outline" onClick={() => setViewingSubmission(null)}>إغلاق</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {currentAssignment.questions?.map((q, qIdx) => {
                  const studentAnswer = viewingSubmission.answers?.[qIdx];
                  const isCorrect = studentAnswer === q.correctOption;

                  return (
                    <div key={q.id || qIdx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: `1px solid ${isCorrect ? '#86efac' : '#fca5a5'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <strong>السؤال {qIdx + 1}: {q.text}</strong>
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
                              {opt} {isTheCorrectOne ? ' (الإجابة الصحيحة)' : ''} {isStudentPick ? ' (اختيار الطالب)' : ''}
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

  // Render List View
  if (activeView === 'list') {
    return (
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen /> إدارة الواجبات (الإلكترونية واليدوية)
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              إنشاء ومتابعة الواجبات الإلكترونية التفاعلية والواجبات اليدوية / كراسة الواجب ورصد درجات الطلاب بكل سهولة
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setTargetClass(classesList[0] || '');
                setSubject(subjectsList[0] || '');
                setAssignmentType('electronic');
                setActiveView('create');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={18} /> واجب إلكتروني تفاعلي
            </button>
            <button 
              className="btn" 
              onClick={() => {
                setTargetClass(classesList[0] || '');
                setSubject(subjectsList[0] || '');
                setAssignmentType('manual');
                setActiveView('create');
              }}
              style={{
                background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                fontWeight: 'bold',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
              }}
            >
              <FileSpreadsheet size={18} /> 📝 واجب يدوي / كراسة الواجب
            </button>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            لا توجد واجبات مسجلة حالياً
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {assignments.map(a => {
              const isMan = a.type === 'manual' || a.isInteractive === false;

              return (
                <div key={a.id} style={{ background: 'rgba(255,255,255,0.85)', padding: '20px', borderRadius: '12px', border: isMan ? '1.5px solid #67e8f9' : '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>{a.title}</h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      background: isMan ? '#e0f2fe' : 'rgba(37, 211, 102, 0.1)',
                      color: isMan ? '#0369a1' : '#166534',
                      border: `1px solid ${isMan ? '#bae6fd' : '#bbf7d0'}`
                    }}>
                      {isMan ? '📝 واجب يدوي' : '💻 واجب إلكتروني'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#475569' }}>
                    <div><Users size={15} style={{ display: 'inline', marginInlineEnd: '6px' }}/> الفصل: <strong>{a.targetClass || a.className}</strong></div>
                    <div><BookOpen size={15} style={{ display: 'inline', marginInlineEnd: '6px' }}/> المادة: <strong>{a.subject || 'عام'}</strong></div>
                    <div><Calendar size={15} style={{ display: 'inline', marginInlineEnd: '6px' }}/> آخر موعد للتسليم: <strong>{a.dueDate}</strong></div>
                    
                    {isMan ? (
                      <div style={{ background: '#f0f9ff', padding: '8px', borderRadius: '6px', border: '1px solid #e0f2fe', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#0369a1' }}>
                        {a.bookPage && <div>📖 الكتاب: <strong>{a.bookPage}</strong></div>}
                        {a.exerciseNumbers && <div>✏️ التمارين: <strong>{a.exerciseNumbers}</strong></div>}
                        <div>🎯 الدرجة: <strong>{a.maxScore || a.totalQuestions || 5} درجات</strong></div>
                      </div>
                    ) : (
                      <>
                        <div><RotateCcw size={15} style={{ display: 'inline', marginInlineEnd: '6px' }}/> المحاولات: <strong>{a.allowedAttempts === 'unlimited' ? 'غير محدود' : `${a.allowedAttempts || 1} محاولات`}</strong></div>
                        <div><FileText size={15} style={{ display: 'inline', marginInlineEnd: '6px' }}/> عدد الأسئلة: <strong>{a.questions?.length || 0} أسئلة</strong></div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                      onClick={() => handleViewResults(a)}
                    >
                      <BarChart2 size={16} /> {isMan ? 'رصد ومتابعة الدرجات' : 'كشف التسليمات والدرجات'}
                    </button>
                    <button 
                      className="btn btn-outline" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px' }}
                      onClick={() => handleEdit(a)}
                      title="تعديل الواجب"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="btn btn-outline" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', borderColor: '#fca5a5', padding: '8px 12px' }}
                      onClick={() => handleDelete(a.id)}
                      title="حذف الواجب"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Render Create / Edit Form
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2>
          {activeView === 'create' 
            ? (assignmentType === 'manual' ? 'إضافة واجب يدوي / منزلي / كراسة الواجب' : 'إنشاء واجب إلكتروني تفاعلي')
            : (assignmentType === 'manual' ? 'تعديل الواجب اليدوي' : 'تعديل الواجب الإلكتروني')}
        </h2>
        <button className="btn btn-outline" onClick={resetForm}>العودة للقائمة</button>
      </div>

      {/* Assignment Type Selector Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setAssignmentType('electronic')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '10px',
            border: assignmentType === 'electronic' ? '2px solid #0e7490' : '1px solid #cbd5e1',
            background: assignmentType === 'electronic' ? '#eff6ff' : '#f8fafc',
            color: assignmentType === 'electronic' ? '#0e7490' : '#64748b',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          💻 واجب إلكتروني تفاعلي (أسئلة واختيارات)
        </button>

        <button
          type="button"
          onClick={() => setAssignmentType('manual')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '10px',
            border: assignmentType === 'manual' ? '2px solid #0e7490' : '1px solid #cbd5e1',
            background: assignmentType === 'manual' ? '#eff6ff' : '#f8fafc',
            color: assignmentType === 'manual' ? '#0e7490' : '#64748b',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          📝 واجب يدوي / منزلي / كراسة الواجب (صفحات وتمارين الكتاب)
        </button>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>عنوان الواجب</label>
            <input 
              type="text" 
              className="input-field" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required 
              placeholder={assignmentType === 'manual' ? "مثال: واجب تمارين ص ٤٥ - الحركة في بعد واحد" : "مثال: واجب الدرس الأول - الحركة في بعد واحد"} 
            />
          </div>

          <div className="form-group">
            <label>الفصل المستهدف</label>
            <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)} required>
              <option value="">اختر الفصل</option>
              {classesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>المادة الدراسية</label>
            <select className="input-field" value={subject} onChange={e => setSubject(e.target.value)} required>
              <option value="">اختر المادة</option>
              {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>تاريخ الاستحقاق (آخر موعد للتسليم)</label>
            <input type="date" className="input-field" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>

          {/* Electronic Specific Fields */}
          {assignmentType === 'electronic' && (
            <>
              <div className="form-group">
                <label>عدد مرات إجراء الواجب (المحاولات)</label>
                <select className="input-field" value={allowedAttempts} onChange={e => setAllowedAttempts(e.target.value)} required>
                  <option value="1">محاولة واحدة فقط (1)</option>
                  <option value="2">محاولتان (2)</option>
                  <option value="3">3 محاولات</option>
                  <option value="5">5 محاولات</option>
                  <option value="unlimited">غير محدود (مفتوح للتكرار)</option>
                </select>
              </div>

              <div className="form-group">
                <label>عدد الأسئلة</label>
                <input type="number" min="1" max="30" className="input-field" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} required />
              </div>
            </>
          )}

          {/* Manual Specific Fields */}
          {assignmentType === 'manual' && (
            <>
              <div className="form-group">
                <label>رقم الصفحة في الكتاب المدرسي</label>
                <input type="text" className="input-field" value={bookPage} onChange={e => setBookPage(e.target.value)} placeholder="مثال: ص ٤٥ - ٤٦" />
              </div>

              <div className="form-group">
                <label>أرقام التمارين / المسائل المطلوبة</label>
                <input type="text" className="input-field" value={exerciseNumbers} onChange={e => setExerciseNumbers(e.target.value)} placeholder="مثال: التمارين ١، ٣، ٥، ٨" />
              </div>

              <div className="form-group">
                <label>الدرجة العظمى المخصصة للواجب</label>
                <input type="number" min="1" max="100" className="input-field" value={maxScore} onChange={e => setMaxScore(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>طريقة تسليم الواجب</label>
                <select className="input-field" value={submissionMethod} onChange={e => setSubmissionMethod(e.target.value)}>
                  <option value="notebook">تسليم كراسة الواجب في الصف للمعلم</option>
                  <option value="upload">تصوير الحل وإرفاقه عبر المنصة</option>
                  <option value="both">كلاهما متاح (كراسة الواجب أو إرفاق صورة بالمنصة)</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <MarkdownInput
                  label="تعليمات وإرشادات إضافية للحل (اختياري - تدعم الصور المرفقة المضغوطة)"
                  value={instructions}
                  onChange={setInstructions}
                  placeholder="اكتب هنا أي تعليمات إضافية للطالب بخصوص حل التمارين أو الرسم أو المطلوب..."
                  height="120px"
                />
              </div>
            </>
          )}
        </div>

        {/* Central Question Bank Import Banner (Electronic only) */}
        {assignmentType === 'electronic' && (
          <>
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

            {/* Questions Builder */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {questions.map((q, qIndex) => (
                <div key={q.id || qIndex} style={{ background: 'rgba(255,255,255,0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 16px 0', borderBottom: '2px solid var(--color-primary-light)', paddingBottom: '8px', display: 'inline-block' }}>
                    السؤال رقم {qIndex + 1}
                  </h3>

                  <MarkdownInput 
                    label="نص السؤال (يدعم صياغة المعادلات والنصوص المنسقة والصور المضغوطة)"
                    value={q.text}
                    onChange={(val) => updateQuestion(qIndex, 'text', val)}
                    placeholder="اكتب نص السؤال هنا..."
                    height="130px"
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                    {[0, 1, 2, 3].map(optIndex => {
                      const defaultLetter = ['( أ )', '( ب )', '( ج )', '( د )'][optIndex];
                      return (
                        <div key={optIndex} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: q.correctOption === optIndex ? 'rgba(37, 211, 102, 0.1)' : 'transparent', padding: '12px', borderRadius: '8px', border: q.correctOption === optIndex ? '2px solid #25D366' : '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#0f172a',
                              color: '#ffffff',
                              fontWeight: '800',
                              fontSize: '15px',
                              padding: '4px 14px',
                              borderRadius: '6px',
                              letterSpacing: '0.5px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                            }}>
                              {defaultLetter}
                            </span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer', color: q.correctOption === optIndex ? '#25D366' : 'inherit', fontWeight: 'bold' }}>
                              <input 
                                type="radio" 
                                name={`hw_correct_${qIndex}`} 
                                checked={q.correctOption === optIndex} 
                                onChange={() => updateQuestion(qIndex, 'correctOption', optIndex)}
                              />
                              الإجابة الصحيحة
                            </label>
                          </div>
                          <MarkdownInput 
                            label=""
                            value={q.options && q.options[optIndex] !== undefined ? q.options[optIndex] : defaultLetter}
                            onChange={(val) => updateOption(qIndex, optIndex, val)}
                            placeholder={defaultLetter}
                            height="90px"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 36px', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }} disabled={isSaving}>
            <Save size={20} />
            {isSaving ? 'جاري الحفظ...' : (assignmentType === 'manual' ? 'حفظ ونشر الواجب اليدوي' : 'حفظ ونشر الواجب الإلكتروني')}
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

function Attendance() {
  const { userData } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'summary'
  const [classesList, setClassesList] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [studentActivityMap, setStudentActivityMap] = useState({});
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [attendanceNotes, setAttendanceNotes] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [teacherDocId, setTeacherDocId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [classesMap, setClassesMap] = useState({});
  const [teachersMap, setTeachersMap] = useState({});
  const [scheduledPeriodsToday, setScheduledPeriodsToday] = useState([]);

  const today = new Date().toISOString().split('T')[0];
  const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const currentDayArabic = dayNamesArabic[new Date().getDay()];

  // Compute gamification activity for students in selected class
  useEffect(() => {
    if (!students || students.length === 0) {
      setStudentActivityMap({});
      return;
    }
    const schoolId = userData?.schoolId || 'default_school_1';
    const qA = schoolId === 'ALL' ? collection(db, 'assignment_results') : query(collection(db, 'assignment_results'), where('schoolId', '==', schoolId));
    const qE = schoolId === 'ALL' ? collection(db, 'exam_results') : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));
    const qAtt = schoolId === 'ALL' ? collection(db, 'attendance') : query(collection(db, 'attendance'), where('schoolId', '==', schoolId));

    Promise.all([getDocs(qA), getDocs(qE), getDocs(qAtt)]).then(([snapA, snapE, snapAtt]) => {
      const aList = snapA.docs.map(d => d.data());
      const eList = snapE.docs.map(d => d.data());
      const attList = snapAtt.docs.map(d => d.data());

      const map = {};
      students.forEach(s => {
        map[s.id] = calculateStudentActivity({
          studentId: s.id,
          assignmentResults: aList,
          examResults: eList,
          attendanceDocs: attList
        });
      });
      setStudentActivityMap(map);
    });
  }, [students, userData?.schoolId]);

  // Fetch teacher Doc ID
  useEffect(() => {
    if (userData?.nationalId) {
      const q = query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId));
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          setTeacherDocId(snap.docs[0].id);
        } else if (!isNaN(userData.nationalId)) {
          const numQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)));
          getDocs(numQ).then(numSnap => {
            if (!numSnap.empty) setTeacherDocId(numSnap.docs[0].id);
          });
        }
      });
      return () => unsub();
    }
  }, [userData]);

  // Fetch classes, schedules, and teachers
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';

    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const cMap = {};
      const list = [];
      snap.docs.forEach(d => {
        cMap[d.id] = d.data().name;
        list.push(d.data().name);
      });
      setClassesMap(cMap);
      setClassesList(list);
      if (list.length > 0 && !selectedClass) {
        setSelectedClass(list[0]);
      }
    });

    const qSchedules = schoolId === 'ALL'
      ? collection(db, 'schedules')
      : query(collection(db, 'schedules'), where('schoolId', '==', schoolId));

    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qTeachers = schoolId === 'ALL'
      ? collection(db, 'teachers')
      : query(collection(db, 'teachers'), where('schoolId', '==', schoolId));

    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const tMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        tMap[d.id] = data.name;
        if (data.nationalId) tMap[data.nationalId] = data.name;
      });
      setTeachersMap(tMap);
    });

    return () => {
      unsubClasses();
      unsubSchedules();
      unsubTeachers();
    };
  }, [userData?.schoolId]);

  // Check if teacher has a period with selectedClass on currentDayArabic
  useEffect(() => {
    if (!selectedClass || schedules.length === 0) {
      setScheduledPeriodsToday([]);
      return;
    }

    const tid = teacherDocId || userData?.nationalId || auth.currentUser?.uid;
    const periods = [];

    schedules.forEach(sched => {
      const clsName = classesMap[sched.id] || sched.className;
      if (clsName === selectedClass && sched.matrix) {
        for (let p = 1; p <= 8; p++) {
          const key = `${currentDayArabic}-${p}`;
          const cell = sched.matrix[key];
          if (cell && (cell.teacherId === tid || cell.teacherId === teacherDocId || cell.teacherId === userData?.nationalId)) {
            periods.push(p);
          }
        }
      }
    });

    setScheduledPeriodsToday(periods);
  }, [selectedClass, schedules, classesMap, teacherDocId, userData, currentDayArabic]);

  // Find schedule doc for the selected class
  const currentClassSchedule = schedules.find(s => (classesMap[s.id] || s.className) === selectedClass);

  // Fetch students for selected class and today's attendance & notes
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setAttendanceRecords({});
      setAttendanceNotes({});
      return;
    }

    const schoolId = userData?.schoolId || 'default_school_1';

    const sq = schoolId === 'ALL'
      ? query(collection(db, 'students'), where('class', '==', selectedClass))
      : query(collection(db, 'students'), where('class', '==', selectedClass), where('schoolId', '==', schoolId));

    const unsubStudents = onSnapshot(sq, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    });

    const aq = schoolId === 'ALL'
      ? query(
          collection(db, 'attendance'),
          where('className', '==', selectedClass),
          where('date', '==', today)
        )
      : query(
          collection(db, 'attendance'),
          where('schoolId', '==', schoolId),
          where('className', '==', selectedClass),
          where('date', '==', today)
        );

    const unsubAttendance = onSnapshot(aq, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setAttendanceRecords(data.records || {});
        setAttendanceNotes(data.notes || {});
      } else {
        const init = {};
        students.forEach(s => { init[s.id] = 'present'; });
        setAttendanceRecords(init);
        setAttendanceNotes({});
      }
    });

    return () => {
      unsubStudents();
      unsubAttendance();
    };
  }, [selectedClass, today, userData?.schoolId]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleNoteChange = (studentId, note) => {
    setAttendanceNotes(prev => ({
      ...prev,
      [studentId]: note
    }));
  };

  const handleSaveAttendance = async () => {
    if (!auth.currentUser || !selectedClass) return;
    if (scheduledPeriodsToday.length === 0) {
      alert(`عفواً، لا يمكنك رصد الغياب لهذا الفصل لعدم وجود حصة مجدولة لك معه اليوم (${currentDayArabic}).`);
      return;
    }

    setIsSaving(true);
    try {
      const schoolId = userData?.schoolId || 'default_school_1';
      const docId = `${schoolId}_${selectedClass.replace(/\//g, '-')}_${today}`;
      const docRef = doc(db, 'attendance', docId);

      await setDoc(docRef, {
        schoolId,
        className: selectedClass,
        date: today,
        teacherId: teacherDocId || auth.currentUser.uid,
        teacherEmail: auth.currentUser.email,
        records: attendanceRecords,
        notes: attendanceNotes,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      alert(t('teacherDashboard.attendanceSaveSuccess'));
    } catch (error) {
      console.error("Error saving attendance:", error);
      alert(t('teacherDashboard.attendanceSaveFail'));
    } finally {
      setIsSaving(false);
    }
  };

  const hasScheduledClassToday = scheduledPeriodsToday.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('record')}
          className="btn"
          style={{
            background: activeTab === 'record' ? 'var(--color-primary-dark)' : 'white',
            color: activeTab === 'record' ? 'white' : 'var(--color-primary-dark)',
            border: '1px solid var(--color-border)',
            fontWeight: 'bold',
            borderRadius: '10px',
            padding: '10px 20px',
            cursor: 'pointer'
          }}
        >
          📝 {t('teacherDashboard.attendanceRecord')}
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className="btn"
          style={{
            background: activeTab === 'summary' ? 'var(--color-primary-dark)' : 'white',
            color: activeTab === 'summary' ? 'white' : 'var(--color-primary-dark)',
            border: '1px solid var(--color-border)',
            fontWeight: 'bold',
            borderRadius: '10px',
            padding: '10px 20px',
            cursor: 'pointer'
          }}
        >
          📊 ملخص وتصدير تقرير الغياب (Excel / PDF)
        </button>
        <Link
          to="/teacher/student-records"
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #0e7490 0%, #0369a1 100%)',
            color: 'white',
            border: 'none',
            fontWeight: 'bold',
            borderRadius: '10px',
            padding: '10px 20px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)'
          }}
        >
          <ClipboardList size={18} /> سجل متابعة الطالب الشامل
        </Link>
      </div>

      {activeTab === 'summary' ? (
        <AttendanceSummaryExport schoolId={userData?.schoolId} />
      ) : (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0' }}>{t('teacherDashboard.attendanceRecord')} ({today}) - {currentDayArabic}</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                رصد وتعديل غياب الطلاب لليوم الحالي للحصص المجدولة مع خانة الملاحظات
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select 
                className="input-field" 
                style={{ width: '200px', marginBottom: 0 }}
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveAttendance} 
                disabled={isSaving || !selectedClass || !hasScheduledClassToday}
                style={{ opacity: !hasScheduledClassToday ? 0.6 : 1 }}
              >
                <Save size={18} /> {isSaving ? t('teacherDashboard.saving') : t('teacherDashboard.saveRecord')}
              </button>
            </div>
          </div>

          {/* Schedule Check Banner */}
          {selectedClass && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: hasScheduledClassToday ? '#f0fdf4' : '#fee2e2',
              border: `1px solid ${hasScheduledClassToday ? '#bbf7d0' : '#fca5a5'}`,
              color: hasScheduledClassToday ? '#166534' : '#991b1b'
            }}>
              {hasScheduledClassToday ? (
                <>
                  <CheckCircle size={20} />
                  <span>
                    لديك حصة مجدولة اليوم مع (<strong>{selectedClass}</strong>): <strong>الحصة {scheduledPeriodsToday.join('، الحصة ')}</strong>. مسموح برصد وتعديل الغياب.
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={20} />
                  <span>
                    تنبيه: ليس لديك حصة مجدولة مع (<strong>{selectedClass}</strong>) اليوم ({currentDayArabic}). لا يُسمح للمعلم برصد أو تعديل الغياب إلا في أيام الحصص المجدولة.
                  </span>
                </>
              )}
            </div>
          )}

          {/* Class Daily Schedule Visualizer */}
          {selectedClass && (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <Calendar size={16} /> جدول حصص فصل (<strong>{selectedClass}</strong>) ليوم <strong>{currentDayArabic}</strong>:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(periodNum => {
                  const key = `${currentDayArabic}-${periodNum}`;
                  const cell = currentClassSchedule?.matrix?.[key];
                  const tid = teacherDocId || userData?.nationalId || auth.currentUser?.uid;
                  const isMyPeriod = cell && (cell.teacherId === tid || cell.teacherId === teacherDocId || cell.teacherId === userData?.nationalId);
                  const tName = cell?.teacherId ? (teachersMap[cell.teacherId] || 'معلم') : '';

                  return (
                    <div
                      key={periodNum}
                      style={{
                        background: isMyPeriod ? '#ecfdf5' : cell?.subject ? 'white' : '#f1f5f9',
                        border: `1.5px solid ${isMyPeriod ? '#10b981' : cell?.subject ? '#cbd5e1' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'center',
                        boxShadow: isMyPeriod ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: isMyPeriod ? '#047857' : '#475569', marginBottom: '4px' }}>
                        الحصة {periodNum} {isMyPeriod && '⭐ (حصتك)'}
                      </div>
                      {cell?.subject ? (
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{cell.subject}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{tName}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {!selectedClass ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
              {t('teacherDashboard.pleaseSelectClassAttendance')}
            </p>
          ) : students.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
              {t('teacherDashboard.noStudentsClass')}
            </p>
          ) : (
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontSize: '13px' }}>#</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px' }}>{t('teacherDashboard.studentName')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>{t('teacherDashboard.present')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>{t('teacherDashboard.absent')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>{t('teacherDashboard.late')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>بعذر</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', width: '30%' }}>الملاحظات / سبب الغياب</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => (
                    <tr key={student.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{student.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-primary-dark)', background: 'rgba(99, 178, 198, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                              {student.class || student.className || selectedClass}
                            </span>
                          </div>
                          <GamificationBadge
                            points={studentActivityMap[student.id]?.totalPoints || 0}
                            stars={studentActivityMap[student.id]?.stars || 1}
                            size="xs"
                            breakdown={studentActivityMap[student.id]?.breakdown}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input 
                          type="radio" 
                          name={`status_${student.id}`} 
                          disabled={!hasScheduledClassToday}
                          checked={attendanceRecords[student.id] === 'present'}
                          onChange={() => handleStatusChange(student.id, 'present')}
                          style={{ cursor: hasScheduledClassToday ? 'pointer' : 'not-allowed', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input 
                          type="radio" 
                          name={`status_${student.id}`} 
                          disabled={!hasScheduledClassToday}
                          checked={attendanceRecords[student.id] === 'absent'}
                          onChange={() => handleStatusChange(student.id, 'absent')}
                          style={{ cursor: hasScheduledClassToday ? 'pointer' : 'not-allowed', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input 
                          type="radio" 
                          name={`status_${student.id}`} 
                          disabled={!hasScheduledClassToday}
                          checked={attendanceRecords[student.id] === 'late'}
                          onChange={() => handleStatusChange(student.id, 'late')}
                          style={{ cursor: hasScheduledClassToday ? 'pointer' : 'not-allowed', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input 
                          type="radio" 
                          name={`status_${student.id}`} 
                          disabled={!hasScheduledClassToday}
                          checked={attendanceRecords[student.id] === 'excused'}
                          onChange={() => handleStatusChange(student.id, 'excused')}
                          style={{ cursor: hasScheduledClassToday ? 'pointer' : 'not-allowed', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          placeholder="اكتب ملاحظة..."
                          value={attendanceNotes[student.id] || ''}
                          disabled={!hasScheduledClassToday}
                          onChange={(e) => handleNoteChange(student.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            background: hasScheduledClassToday ? 'white' : '#f8fafc'
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



export default function TeacherDashboard() {
  const { t } = useLanguage();
  return (
    <Layout role="teacher" title={t('teacherDashboard.pageTitle')}>
      <Routes>
        <Route path="/" element={<TeacherTasks />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/schedule" element={<TeacherSchedule />} />
        <Route path="/weekly-plan" element={<WeeklyPlan />} />
        <Route path="/preparation" element={<LessonPreparation />} />
        <Route path="/materials" element={<MaterialsUpload />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/grade-entry/*" element={<TeacherGradeEntry />} />
        <Route path="/exams" element={<TeacherExams />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/student-records" element={<ComprehensiveStudentRecord role="teacher" />} />
        <Route path="/performance-evaluation" element={<TeacherPerformanceEvaluationHub role="teacher" />} />
        <Route path="/portfolio" element={<AchievementPortfolioPage />} />
        <Route path="/excellence" element={<SchoolExcellenceDashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
