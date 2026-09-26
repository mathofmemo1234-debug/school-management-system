import Settings from './Settings';
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import StudentSchedule from './StudentSchedule';
import StudentExams from './StudentExams';
import SchoolMessagingHub from './SchoolMessagingHub';
import WeeklyPlanView from '../components/WeeklyPlanView';
import MarkdownViewer from '../components/MarkdownViewer';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import LessonWorksheetModal from '../components/LessonWorksheetModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import GamificationBadge from '../components/GamificationBadge';
import { calculateStudentActivity } from '../utils/gamificationEngine';
import { 
  Sparkles, 
  Award, 
  CheckCircle, 
  Calendar, 
  FileText, 
  BookOpen, 
  TrendingUp, 
  Star, 
  Zap, 
  ChevronLeft,
  Download,
  Link as LinkIcon,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BarChart2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

function StudentHome() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const studentClass = useStudentClass();

  const [studentDocId, setStudentDocId] = useState(null);
  const [assignmentResults, setAssignmentResults] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Student doc id
  useEffect(() => {
    const nid = (userData?.nationalId || auth.currentUser?.email?.replace('@school.local', '') || '').trim();
    if (!nid && !auth.currentUser?.email) return;

    const q = nid 
      ? query(collection(db, 'students'), where('nationalId', '==', nid))
      : query(collection(db, 'students'), where('email', '==', auth.currentUser.email));

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setStudentDocId(snap.docs[0].id);
      } else {
        setStudentDocId(auth.currentUser?.uid || nid);
      }
    });
    return () => unsub();
  }, [userData]);

  // 2. Fetch student results & attendance
  useEffect(() => {
    if (!studentDocId) return;

    const schoolId = userData?.schoolId || 'default_school_1';

    // Fetch assignment results
    const qAssign = schoolId === 'ALL'
      ? collection(db, 'assignment_results')
      : query(collection(db, 'assignment_results'), where('schoolId', '==', schoolId));

    const unsubAssign = onSnapshot(qAssign, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.studentId === studentDocId || r.studentDocId === studentDocId || r.nationalId === userData?.nationalId);
      setAssignmentResults(list);
    });

    // Fetch exam results
    const qExams = schoolId === 'ALL'
      ? collection(db, 'exam_results')
      : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));

    const unsubExams = onSnapshot(qExams, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.studentId === studentDocId || r.studentDocId === studentDocId || r.nationalId === userData?.nationalId);
      setExamResults(list);
    });

    // Fetch attendance for student class
    if (studentClass) {
      const qAtt = schoolId === 'ALL'
        ? query(collection(db, 'attendance'), where('className', '==', studentClass))
        : query(collection(db, 'attendance'), where('schoolId', '==', schoolId), where('className', '==', studentClass));

      const unsubAtt = onSnapshot(qAtt, snap => {
        setAttendanceDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });

      return () => {
        unsubAssign();
        unsubExams();
        unsubAtt();
      };
    } else {
      setLoading(false);
      return () => {
        unsubAssign();
        unsubExams();
      };
    }
  }, [studentDocId, studentClass, userData]);

  // Compute activity & gamification stats
  const activity = useMemo(() => {
    return calculateStudentActivity({
      studentId: studentDocId,
      assignmentResults,
      examResults,
      attendanceDocs
    });
  }, [studentDocId, assignmentResults, examResults, attendanceDocs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Welcome & Gamification Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
        borderRadius: '20px',
        padding: '28px 32px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background glow circle */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          left: '-40px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, rgba(234, 179, 8, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.4rem' }}>👋</span>
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                مرحباً بك، {userData?.name || 'عزيزي الطالب'}
              </h2>
            </div>
            <p style={{ margin: 0, opacity: 0.85, fontSize: '0.95rem' }}>
              {studentClass ? `الصف: ${studentClass}` : 'لوحة الطالب التفاعلية'} • تابع واجباتك واختباراتك واكسب المزيد من النجوم الذهبية!
            </p>
          </div>

          {/* Gamification Stars & Points Badge Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '12px 20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#e0e7ff', marginBottom: '2px', fontWeight: 600 }}>
                المستوى والرتبة:
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{activity?.levelBadge || '🥉'}</span>
                <span>{activity?.levelTitle || 'طالب منطلق'}</span>
              </div>
            </div>

            <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.2)' }} />

            <div>
              <div style={{ fontSize: '0.78rem', color: '#e0e7ff', marginBottom: '2px', fontWeight: 600 }}>
                النجوم والنقاط:
              </div>
              <GamificationBadge
                points={activity?.totalPoints || 0}
                stars={activity?.stars || 1}
                size="md"
                showStars={true}
                showPoints={true}
                breakdown={activity?.breakdown}
              />
            </div>
          </div>
        </div>

        {/* Progress Bar to next Star / Level */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 600 }}>
            <span style={{ color: '#fef08a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} />
              التقدم نحو النجمة / الرتبة التالية ({activity?.nextLevel ? activity.nextLevel.title : 'أعلى رتبة ماسية 👑'})
            </span>
            <span style={{ color: '#e0e7ff' }}>
              {activity?.totalPoints || 0} / {activity?.nextLevel ? activity.nextLevel.minPoints : (activity?.totalPoints || 0)} نقطة
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${activity?.progressToNext || 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #eab308 0%, #facc15 100%)',
              borderRadius: '10px',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
          </div>
        </div>
      </div>

      {/* Activity Breakdown Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* Homeworks Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              background: '#e0f2fe',
              color: '#0284c7',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={22} />
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0284c7', background: '#f0f9ff', padding: '3px 10px', borderRadius: '20px' }}>
              +{activity.breakdown.assignmentPoints} نقطة
            </span>
          </div>

          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#0f172a' }}>الواجبات التفاعلية</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
              تم تسليم <strong>{activity.breakdown.completedAssignmentsCount}</strong> واجب إلكتروني
            </p>
          </div>

          <Link
            to="/assignments"
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: '8px',
              color: '#0284c7',
              textDecoration: 'none',
              fontSize: '0.86rem',
              fontWeight: 600
            }}
          >
            <span>عرض الواجبات</span>
            <ChevronLeft size={16} />
          </Link>
        </div>

        {/* Exams Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              background: '#ccfbf1',
              color: '#0f766e',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={22} />
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0f766e', background: '#f0fdfa', padding: '3px 10px', borderRadius: '20px' }}>
              +{activity.breakdown.examPoints} نقطة
            </span>
          </div>

          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#0f172a' }}>الاختبارات والتقييمات</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
              تم إنجاز <strong>{activity.breakdown.completedExamsCount}</strong> اختبار مدرسي
            </p>
          </div>

          <Link
            to="/exams"
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: '8px',
              color: '#0f766e',
              textDecoration: 'none',
              fontSize: '0.86rem',
              fontWeight: 600
            }}
          >
            <span>عرض الاختبارات</span>
            <ChevronLeft size={16} />
          </Link>
        </div>

        {/* Attendance Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              background: '#fef3c7',
              color: '#d97706',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={22} />
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#d97706', background: '#fffbeb', padding: '3px 10px', borderRadius: '20px' }}>
              +{activity.breakdown.attendancePoints} نقطة
            </span>
          </div>

          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#0f172a' }}>الانضباط والحضور</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
              سجل حضور <strong>{activity.breakdown.presentDaysCount}</strong> يوم دراسي
            </p>
          </div>

          <Link
            to="/schedule"
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: '8px',
              color: '#d97706',
              textDecoration: 'none',
              fontSize: '0.86rem',
              fontWeight: 600
            }}
          >
            <span>عرض الجدول الدراسي</span>
            <ChevronLeft size={16} />
          </Link>
        </div>

      </div>

      {/* Quick Navigation Cards */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '10px' }}>
            <TrendingUp size={24} color="#475569" />
          </div>
          <div>
            <h4 style={{ margin: '0 0 2px', fontSize: '1rem', color: '#1e293b' }}>الخطة الأسبوعية والمواد التعليمية</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>تصفح الدروس والواجبات المجدولة للأسبوع الحالي</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link
            to="/weekly-plan"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#4f46e5',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            الخطة الأسبوعية
          </Link>
          <Link
            to="/materials"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 600
            }}
          >
            المواد الإثرائية
          </Link>
        </div>
      </div>

    </div>
  );
}

function useStudentClass() {
  const { userData } = useAuth();
  const [studentClass, setStudentClass] = useState(null);
  
  useEffect(() => {
    const nid = (userData?.nationalId || auth.currentUser?.email?.replace('@school.local', '') || '').trim();
    if (!nid && !auth.currentUser?.email) return;

    const q = nid 
      ? query(collection(db, 'students'), where('nationalId', '==', nid))
      : query(collection(db, 'students'), where('email', '==', auth.currentUser.email));

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(d => d.data());
        const validDoc = docs.find(d => (d.class || d.className)?.trim()) || docs[0];
        const cls = (validDoc?.class || validDoc?.className || '')?.trim();
        setStudentClass(cls || null);
      } else {
        // Fallback: check users collection
        if (nid) {
          const uq = query(collection(db, 'users'), where('nationalId', '==', nid));
          const unsubUsers = onSnapshot(uq, (uSnap) => {
            if (!uSnap.empty) {
              const uData = uSnap.docs[0].data();
              setStudentClass((uData.class || uData.className || '')?.trim() || null);
            } else {
              setStudentClass(null);
            }
          });
          return () => unsubUsers();
        } else {
          setStudentClass(null);
        }
      }
    });

    return () => unsub();
  }, [userData]);

  return studentClass;
}

function StudentWeeklyPlan() {
  const { userData } = useAuth();
  const studentClass = useStudentClass();
  return <WeeklyPlanView studentClass={studentClass} schoolId={userData?.schoolId} />;
}

function StudentAssignments() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const studentClass = useStudentClass();
  const [assignments, setAssignments] = useState([]);
  const [studentDocId, setStudentDocId] = useState(null);
  const [mySubmissions, setMySubmissions] = useState({}); // { [assignmentId]: [submission1, submission2] }
  
  // Interactive Solver State
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackView, setFeedbackView] = useState(null); // { score, total, isLate, answers, assignment, attemptNumber }

  // Resolve Student ID
  useEffect(() => {
    const nid = (userData?.nationalId || auth.currentUser?.email?.replace('@school.local', '') || '').trim();
    if (!nid && !auth.currentUser?.email) return;

    const q = nid 
      ? query(collection(db, 'students'), where('nationalId', '==', nid))
      : query(collection(db, 'students'), where('email', '==', auth.currentUser.email));

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setStudentDocId(snap.docs[0].id);
      }
    });
    return () => unsub();
  }, [userData]);

  // Fetch Assignments for Student's Class filtered by schoolId
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';
    const qAssignments = schoolId === 'ALL'
      ? collection(db, 'assignments')
      : query(collection(db, 'assignments'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qAssignments, (snapshot) => {
      const norm = (s) => (s || '').replace(/\s+/g, '').replace(/[-_]/g, '/').toLowerCase();
      const sCls = norm(studentClass);

      const data = [];
      snapshot.forEach((docSnap) => {
        const d = { id: docSnap.id, ...docSnap.data() };
        const aCls = norm(d.targetClass || d.className || d.class);
        
        if (!studentClass || !aCls || aCls === sCls || aCls.includes(sCls) || sCls.includes(aCls)) {
          data.push(d);
        }
      });
      data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setAssignments(data);
    });
    return () => unsub();
  }, [studentClass, userData?.schoolId]);

  // Fetch Student Submissions
  useEffect(() => {
    if (!studentDocId) return;
    const q = query(collection(db, 'assignment_results'), where('studentId', '==', studentDocId));
    const unsub = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach(docSnap => {
        const sub = { id: docSnap.id, ...docSnap.data() };
        if (!map[sub.assignmentId]) map[sub.assignmentId] = [];
        map[sub.assignmentId].push(sub);
      });
      // Sort each assignment submissions by attemptNumber descending
      Object.keys(map).forEach(aid => {
        map[aid].sort((a, b) => (b.attemptNumber || 1) - (a.attemptNumber || 1));
      });
      setMySubmissions(map);
    });
    return () => unsub();
  }, [studentDocId]);

  const handleStartHomework = (assignment) => {
    setActiveAssignment(assignment);
    const saved = localStorage.getItem(`hw_checkpoint_${assignment.id}_${studentDocId}`);
    if (saved) {
      try {
        setCurrentAnswers(JSON.parse(saved));
      } catch {
        setCurrentAnswers({});
      }
    } else {
      setCurrentAnswers({});
    }
    setFeedbackView(null);
  };

  const handleAnswerSelect = (qIndex, optIndex) => {
    setCurrentAnswers(prev => {
      const next = { ...prev, [qIndex]: optIndex };
      if (activeAssignment && studentDocId) {
        localStorage.setItem(`hw_checkpoint_${activeAssignment.id}_${studentDocId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleSubmitHomework = async () => {
    if (!activeAssignment || !studentDocId) return;

    const questions = activeAssignment.questions || [];
    if (Object.keys(currentAnswers).length < questions.length) {
      if (!window.confirm('لم تقم بالإجابة على جميع الأسئلة. هل أنت متأكد من رغبتك في تسليم الواجب الآن؟')) {
        return;
      }
    }

    setIsSubmitting(true);
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (currentAnswers[idx] === q.correctOption) {
        correctCount++;
      }
    });

    const previousAttempts = mySubmissions[activeAssignment.id] || [];
    const attemptNumber = previousAttempts.length + 1;
    
    // Check if submitted after due date
    const todayStr = new Date().toISOString().split('T')[0];
    const isLate = activeAssignment.dueDate ? todayStr > activeAssignment.dueDate : false;

    const submissionData = {
      assignmentId: activeAssignment.id,
      studentId: studentDocId,
      studentName: userData?.name || 'طالب',
      nationalId: userData?.nationalId || '',
      className: studentClass,
      subject: activeAssignment.subject || 'عام',
      assignmentTitle: activeAssignment.title || 'واجب إلكتروني',
      score: correctCount,
      totalQuestions: questions.length,
      answers: currentAnswers,
      isLate,
      attemptNumber,
      schoolId: userData?.schoolId || 'default_school_1',
      timestamp: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'assignment_results'), submissionData);
      localStorage.removeItem(`hw_checkpoint_${activeAssignment.id}_${studentDocId}`);
      setFeedbackView({
        score: correctCount,
        total: questions.length,
        isLate,
        answers: currentAnswers,
        assignment: activeAssignment,
        attemptNumber
      });
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تسليم الواجب: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!studentClass) {
    return <div className="glass-panel" style={{ padding: '24px' }}>{t('studentDashboard.loadingData')}</div>;
  }

  // 1. Interactive Solver View (Untimed)
  if (activeAssignment && !feedbackView) {
    const questions = activeAssignment.questions || [];

    return (
      <div className="glass-panel" style={{ padding: '24px', maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)' }}>
              📝 {activeAssignment.title}
            </h2>
            <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px' }}>
              <span>المادة: <strong>{activeAssignment.subject || 'عام'}</strong></span>
              <span>آخر موعد: <strong>{activeAssignment.dueDate}</strong></span>
              <span style={{ color: '#0e7490' }}>⭐ واجب مفتوح بدون توقيت زمني</span>
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => setActiveAssignment(null)}>خروج وإلغاء</button>
        </div>

        {/* Question Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {questions.map((q, qIndex) => (
            <div key={q.id || qIndex} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#0f172a', marginBottom: '16px' }}>
                <span style={{ color: 'var(--color-primary)', marginInlineEnd: '8px' }}>السؤال {qIndex + 1}:</span>
                <MarkdownViewer content={q.text} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {q.options?.map((opt, optIndex) => {
                  const isSelected = currentAnswers[qIndex] === optIndex;
                  return (
                    <label
                      key={optIndex}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1.5px solid ${isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                        background: isSelected ? 'rgba(99, 178, 198, 0.12)' : '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="radio"
                        name={`q_${qIndex}`}
                        checked={isSelected}
                        onChange={() => handleAnswerSelect(qIndex, optIndex)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? 'var(--color-primary-dark)' : '#334155' }}>
                        <MarkdownViewer content={opt} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleSubmitHomework}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ padding: '12px 40px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <CheckCircle2 size={20} />
            {isSubmitting ? 'جاري تسليم الواجب...' : 'تسليم إجابات الواجب'}
          </button>
        </div>
      </div>
    );
  }

  // 2. Feedback & Correct Answers View (Immediately shown on submit or reviewing)
  if (feedbackView) {
    const { score, total, isLate, answers, assignment, attemptNumber } = feedbackView;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const isPass = percentage >= 50;
    const questions = assignment.questions || [];

    const allowed = assignment.allowedAttempts === 'unlimited' ? Infinity : (parseInt(assignment.allowedAttempts) || 1);
    const canRetry = attemptNumber < allowed;

    return (
      <div className="glass-panel" style={{ padding: '24px', maxWidth: '850px', margin: '0 auto' }}>
        {/* Instant Score Header */}
        <div style={{
          background: isPass ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #dc2626, #f87171)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          textAlign: 'center',
          marginBottom: '24px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>
            {isPass ? '🎉 أحسنت! تم تسليم الواجب ورصد الدرجة فورياً' : 'تم تسليم الواجب ورصد الدرجة'}
          </h2>
          <div style={{ fontSize: '36px', fontWeight: '900', margin: '12px 0' }}>
            {score} / {total} ({percentage}%)
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '14px', flexWrap: 'wrap' }}>
            <span>المحاولة رقم: <strong>{attemptNumber}</strong></span>
            <span>حالة التسليم: <strong>{isLate ? '⚠️ تسليم متأخر' : '✅ تسليم في الموعد'}</strong></span>
            <span>تم الحفظ في: <strong>سجل الإنجاز والدرجات</strong></span>
          </div>
        </div>

        {/* Detailed Question Review & Correct Answers */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="#059669" /> مراجعة الإجابات والتغذية الراجعة التفصيلية
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {questions.map((q, qIndex) => {
              const studentAnswer = answers[qIndex];
              const isCorrect = studentAnswer === q.correctOption;

              return (
                <div key={q.id || qIndex} style={{
                  background: 'white',
                  padding: '18px',
                  borderRadius: '12px',
                  border: `1.5px solid ${isCorrect ? '#86efac' : '#fca5a5'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                      <span style={{ marginInlineEnd: '8px' }}>السؤال {qIndex + 1}:</span>
                      <MarkdownViewer content={q.text} />
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: isCorrect ? '#dcfce7' : '#fee2e2',
                      color: isCorrect ? '#166534' : '#991b1b',
                      whiteSpace: 'nowrap'
                    }}>
                      {isCorrect ? '✅ إجابة صحيحة' : '❌ إجابة خاطئة'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {q.options?.map((opt, optIdx) => {
                      const isStudentPick = studentAnswer === optIdx;
                      const isTheCorrectOne = q.correctOption === optIdx;

                      let bg = '#f8fafc';
                      let border = '#e2e8f0';
                      let textTag = '';
                      let tagColor = '';

                      if (isTheCorrectOne) {
                        bg = '#dcfce7';
                        border = '#22c55e';
                        textTag = ' (الإجابة الصحيحة ✅)';
                        tagColor = '#166534';
                      } else if (isStudentPick && !isCorrect) {
                        bg = '#fee2e2';
                        border = '#ef4444';
                        textTag = ' (إجابتك ❌)';
                        tagColor = '#991b1b';
                      }

                      return (
                        <div key={optIdx} style={{
                          padding: '10px 14px',
                          background: bg,
                          border: `1.5px solid ${border}`,
                          borderRadius: '8px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <MarkdownViewer content={opt} />
                          {textTag && (
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: tagColor, marginInlineStart: '6px' }}>
                              {textTag}
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
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {canRetry && (
            <button
              onClick={() => {
                setFeedbackView(null);
                setCurrentAnswers({});
              }}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                fontSize: '15px'
              }}
            >
              <RotateCcw size={18} /> إعادة محاولة الواجب ({attemptNumber + 1} من {allowed === Infinity ? '∞' : allowed})
            </button>
          )}

          <button
            onClick={() => {
              setActiveAssignment(null);
              setFeedbackView(null);
            }}
            className="btn btn-outline"
            style={{ padding: '10px 24px', fontSize: '15px' }}
          >
            العودة لقائمة الواجبات
          </button>
        </div>
      </div>
    );
  }

  // 3. Assignment Cards List View
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen /> واجباتي الإلكترونية - فصل {studentClass}
        </h2>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
          حل الواجبات تفاعلياً بدون توقيت، ومعرفة درجتك ومراجعة الإجابات الصحيحة فورياً
        </p>
      </div>

      {assignments.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
          {t('studentDashboard.noAssignmentsClass')}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {assignments.map(a => {
            const isManual = a.type === 'manual' || a.isInteractive === false;
            const submissions = mySubmissions[a.id] || [];
            const hasSubmitted = submissions.length > 0;
            const latestSub = hasSubmitted ? submissions[0] : null;
            const allowed = a.allowedAttempts === 'unlimited' ? Infinity : (parseInt(a.allowedAttempts) || 1);
            const remainingAttempts = allowed === Infinity ? 'غير محدود' : Math.max(0, allowed - submissions.length);
            const canAttempt = allowed === Infinity || submissions.length < allowed;

            const todayStr = new Date().toISOString().split('T')[0];
            const isLateDeadline = a.dueDate ? todayStr > a.dueDate : false;

            return (
              <div
                key={a.id}
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  border: isManual ? '1.5px solid #67e8f9' : '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '16px' }}>{a.title}</h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    background: isManual ? '#e0f2fe' : hasSubmitted ? '#dcfce7' : 'rgba(37, 211, 102, 0.1)',
                    color: isManual ? '#0369a1' : hasSubmitted ? '#166534' : '#15803d',
                    border: `1px solid ${isManual ? '#bae6fd' : '#bbf7d0'}`
                  }}>
                    {isManual ? '📝 واجب يدوي' : hasSubmitted ? `تم الحل (${latestSub.score}/${latestSub.totalQuestions})` : '💻 واجب إلكتروني'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569' }}>
                  <div>المادة: <strong>{a.subject || 'عام'}</strong></div>
                  <div>المعلم: <strong>{a.teacherName || a.teacherEmail}</strong></div>
                  <div>آخر موعد للتسليم: <strong style={{ color: isLateDeadline ? '#dc2626' : 'inherit' }}>{a.dueDate || 'مفتوح'}</strong></div>

                  {isManual ? (
                    <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: '8px', border: '1px solid #e0f2fe', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#0369a1', marginTop: '4px' }}>
                      {a.bookPage && <div>📖 رقم الصفحة: <strong>{a.bookPage}</strong></div>}
                      {a.exerciseNumbers && <div>✏️ التمارين المطلوبة: <strong>{a.exerciseNumbers}</strong></div>}
                      <div>🎯 الدرجة: <strong>{a.maxScore || a.totalQuestions || 5} درجات</strong></div>
                      <div>📥 طريقة التسليم: <strong>{a.submissionMethod === 'notebook' ? 'كراسة الواجب في الصف للمعلم' : a.submissionMethod === 'upload' ? 'تصوير وإرفاق الحل بالمنصة' : 'كراسة الواجب / إرفاق بالمنصة'}</strong></div>
                      {a.instructions && (
                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #bae6fd' }}>
                          <span style={{ fontWeight: 'bold' }}>إرشادات الحل: </span>
                          <MarkdownViewer content={a.instructions} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>المحاولات المستنفدة: <strong>{submissions.length}</strong> من <strong>{allowed === Infinity ? 'غير محدود' : allowed}</strong></div>
                      {a.questions && <div>عدد الأسئلة: <strong>{a.questions.length}</strong> أسئلة (بدون توقيت)</div>}
                    </>
                  )}
                </div>

                {/* Status and Action Buttons */}
                <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {isManual ? (
                    <div>
                      {hasSubmitted && latestSub ? (
                        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ color: '#166534', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
                            ✅ تم رصد الدرجة: {latestSub.score} من {latestSub.totalQuestions || a.maxScore || 5}
                          </div>
                          {latestSub.note && (
                            <div style={{ fontSize: '12px', color: '#15803d' }}>
                              💬 ملاحظة المعلم: {latestSub.note}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: '#f8fafc', color: '#64748b', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>
                          ⏳ يرجى تسليم الواجب للمعلم بالصف للرصد
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {canAttempt ? (
                        <button
                          onClick={() => handleStartHomework(a)}
                          className="btn btn-primary"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Play size={16} /> {hasSubmitted ? `إعادة محاولة الواجب (${remainingAttempts} متبقية)` : 'بدء حل الواجب'}
                        </button>
                      ) : (
                        <div style={{ background: '#f1f5f9', color: '#64748b', padding: '10px', borderRadius: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                          استنفدت جميع المحاولات المسموحة ({allowed})
                        </div>
                      )}

                      {hasSubmitted && latestSub && (
                        <button
                          onClick={() => setFeedbackView({
                            score: latestSub.score,
                            total: latestSub.totalQuestions,
                            isLate: latestSub.isLate,
                            answers: latestSub.answers || {},
                            assignment: a,
                            attemptNumber: latestSub.attemptNumber || 1
                          })}
                          className="btn btn-outline"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                        >
                          <CheckCircle2 size={14} color="#059669" /> مراجعة الإجابات الصحيحة والتغذية الراجعة
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentPortfolio() {
  const { userData } = useAuth();
  const { t } = useLanguage();
  const [studentDocId, setStudentDocId] = useState(null);
  const [examResults, setExamResults] = useState([]);
  const [assignmentResults, setAssignmentResults] = useState([]);
  const [examsMap, setExamsMap] = useState({});
  const [filterType, setFilterType] = useState('all'); // 'all' | 'homework' | 'exam'
  const [viewingAnswersModal, setViewingAnswersModal] = useState(null);

  // Resolve Student ID
  useEffect(() => {
    const nid = (userData?.nationalId || auth.currentUser?.email?.replace('@school.local', '') || '').trim();
    if (!nid && !auth.currentUser?.email) return;

    const q = nid 
      ? query(collection(db, 'students'), where('nationalId', '==', nid))
      : query(collection(db, 'students'), where('email', '==', auth.currentUser.email));

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setStudentDocId(snap.docs[0].id);
      }
    });
    return () => unsub();
  }, [userData]);

  // Fetch Exams Map for metadata
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'exams'), (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      setExamsMap(map);
    });
    return () => unsub();
  }, []);

  // Fetch Student Exam Results
  useEffect(() => {
    if (!studentDocId) return;
    const q = query(collection(db, 'exam_results'), where('studentId', '==', studentDocId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, type: 'exam', ...d.data() }));
      setExamResults(list);
    });
    return () => unsub();
  }, [studentDocId]);

  // Fetch Student Assignment Results
  useEffect(() => {
    if (!studentDocId) return;
    const q = query(collection(db, 'assignment_results'), where('studentId', '==', studentDocId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, type: 'homework', ...d.data() }));
      setAssignmentResults(list);
    });
    return () => unsub();
  }, [studentDocId]);

  // Combined Portfolio Records
  const allRecords = useMemo(() => {
    const combined = [];

    // Map Exams
    examResults.forEach(er => {
      const examMeta = examsMap[er.examId] || {};
      const maxQ = Math.max(parseFloat(er.maxScore) || 0, parseFloat(examMeta.maxScore) || 0, (parseFloat(er.totalQuestions) > 1 ? parseFloat(er.totalQuestions) : 0), parseFloat(er.score) || 0, 1);
      const pct = Math.min(100, Math.round(((parseFloat(er.score) || 0) / maxQ) * 100));
      const dateStr = er.timestamp?.toDate ? er.timestamp.toDate().toISOString().split('T')[0] : (examMeta.examDate || '—');
      
      combined.push({
        id: er.id,
        type: 'exam',
        typeLabel: 'اختبار إلكتروني',
        title: examMeta.title || 'اختبار إلكتروني',
        subject: examMeta.subject || 'عام',
        score: er.score,
        totalQuestions: maxQ,
        percentage: pct,
        date: dateStr,
        isLate: false,
        rawTime: new Date(dateStr).getTime() || 0,
        answers: er.answers,
        questions: examMeta.questions || []
      });
    });

    // Map Homeworks
    assignmentResults.forEach(ar => {
      const pct = ar.totalQuestions > 0 ? Math.round((ar.score / ar.totalQuestions) * 100) : 0;
      const dateStr = ar.timestamp ? ar.timestamp.split('T')[0] : '—';

      combined.push({
        id: ar.id,
        type: 'homework',
        typeLabel: 'واجب إلكتروني',
        title: ar.assignmentTitle || 'واجب إلكتروني',
        subject: ar.subject || 'عام',
        score: ar.score,
        totalQuestions: ar.totalQuestions,
        percentage: pct,
        date: dateStr,
        isLate: ar.isLate,
        rawTime: new Date(dateStr).getTime() || 0,
        attemptNumber: ar.attemptNumber || 1,
        answers: ar.answers
      });
    });

    return combined.sort((a, b) => b.rawTime - a.rawTime);
  }, [examResults, assignmentResults, examsMap]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    if (filterType === 'all') return allRecords;
    return allRecords.filter(r => r.type === filterType);
  }, [allRecords, filterType]);

  // Portfolio Summary Statistics
  const summary = useMemo(() => {
    const totalTasks = allRecords.length;
    if (totalTasks === 0) return { totalTasks: 0, gpa: 0, hwCount: 0, hwAvg: 0, examCount: 0, examAvg: 0 };

    let totalPct = 0;
    let hwPct = 0;
    let hwCount = 0;
    let examPct = 0;
    let examCount = 0;

    allRecords.forEach(r => {
      totalPct += r.percentage;
      if (r.type === 'homework') {
        hwPct += r.percentage;
        hwCount++;
      } else {
        examPct += r.percentage;
        examCount++;
      }
    });

    return {
      totalTasks,
      gpa: Math.round(totalPct / totalTasks),
      hwCount,
      hwAvg: hwCount > 0 ? Math.round(hwPct / hwCount) : 0,
      examCount,
      examAvg: examCount > 0 ? Math.round(examPct / examCount) : 0
    };
  }, [allRecords]);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={26} color="#0e7490" /> سجل الإنجاز والدرجات الأكاديمية للطالب
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            السجل الموحد لنتائج جميع الواجبات والاختبارات الإلكترونية المرصودة فورياً
          </p>
        </div>

        {/* Filter Badges */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilterType('all')}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              background: filterType === 'all' ? 'var(--color-primary-dark)' : 'white',
              color: filterType === 'all' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)'
            }}
          >
            الكل ({allRecords.length})
          </button>
          <button
            onClick={() => setFilterType('homework')}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              background: filterType === 'homework' ? 'var(--color-primary-dark)' : 'white',
              color: filterType === 'homework' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)'
            }}
          >
            الواجبات ({summary.hwCount})
          </button>
          <button
            onClick={() => setFilterType('exam')}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              background: filterType === 'exam' ? 'var(--color-primary-dark)' : 'white',
              color: filterType === 'exam' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)'
            }}
          >
            الاختبارات ({summary.examCount})
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card glass-panel" style={{ background: 'white' }}>
          <div className="stat-icon" style={{ color: '#0e7490', background: '#e0f2fe' }}>
            <Award size={28} />
          </div>
          <div className="stat-info">
            <p>المعدل العام للإنجاز</p>
            <h3 style={{ color: '#0e7490' }}>{summary.gpa}%</h3>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'white' }}>
          <div className="stat-icon" style={{ color: '#16a34a', background: '#dcfce7' }}>
            <BookOpen size={28} />
          </div>
          <div className="stat-info">
            <p>متوسط الواجبات ({summary.hwCount})</p>
            <h3 style={{ color: '#16a34a' }}>{summary.hwAvg}%</h3>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'white' }}>
          <div className="stat-icon" style={{ color: '#8b5cf6', background: '#f3e8ff' }}>
            <FileText size={28} />
          </div>
          <div className="stat-info">
            <p>متوسط الاختبارات ({summary.examCount})</p>
            <h3 style={{ color: '#8b5cf6' }}>{summary.examAvg}%</h3>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'white' }}>
          <div className="stat-icon" style={{ color: '#d97706', background: '#fef3c7' }}>
            <CheckCircle2 size={28} />
          </div>
          <div className="stat-info">
            <p>إجمالي المهام المنجزة</p>
            <h3 style={{ color: '#d97706' }}>{summary.totalTasks}</h3>
          </div>
        </div>
      </div>

      {/* Records Table */}
      {filteredRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          لا توجد نتائج مسجلة حتى الآن
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px 14px', fontSize: '13px' }}>#</th>
                <th style={{ padding: '12px 14px', fontSize: '13px' }}>التكليف</th>
                <th style={{ padding: '12px 14px', fontSize: '13px' }}>النوع</th>
                <th style={{ padding: '12px 14px', fontSize: '13px' }}>المادة</th>
                <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>الدرجة</th>
                <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>النسبة</th>
                <th style={{ padding: '12px 14px', fontSize: '13px' }}>التاريخ</th>
                <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>التقييم</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, idx) => {
                const isPass = r.percentage >= 50;
                return (
                  <tr key={r.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0f172a' }}>{r.title}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: r.type === 'exam' ? '#f3e8ff' : '#e0f2fe',
                        color: r.type === 'exam' ? '#7e22ce' : '#0369a1'
                      }}>
                        {r.typeLabel}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{r.subject}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold', color: '#0e7490' }}>
                      <span dir="ltr">{r.score} / {r.totalQuestions}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold', color: isPass ? '#166534' : '#991b1b' }}>
                      {r.percentage}%
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '13px' }}>{r.date}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: r.percentage >= 90 ? '#dcfce7' : r.percentage >= 75 ? '#e0f2fe' : r.percentage >= 50 ? '#fef3c7' : '#fee2e2',
                        color: r.percentage >= 90 ? '#166534' : r.percentage >= 75 ? '#0369a1' : r.percentage >= 50 ? '#92400e' : '#991b1b'
                      }}>
                        {r.percentage >= 90 ? 'ممتاز ⭐' : r.percentage >= 75 ? 'جيد جداً' : r.percentage >= 50 ? 'ناجح' : 'يحتاج تحسين'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentMaterials() {
  const { t } = useLanguage();
  const studentClass = useStudentClass();
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    if (!studentClass) return;
    const q = query(collection(db, 'materials'), where('className', '==', studentClass));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setMaterials(data);
    });
    return () => unsub();
  }, [studentClass]);

  if (!studentClass) {
    return <div className="glass-panel" style={{ padding: '24px' }}>{t('studentDashboard.loadingData')}</div>;
  }

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2>{t('studentDashboard.materialsClass')} {studentClass}</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>{t('studentDashboard.materialsSubtitle')}</p>
      </div>

      {materials.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
          {t('studentDashboard.noMaterialsClass')}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {materials.map(m => (
            <div key={m.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', background: 'rgba(99,178,198,0.1)', borderRadius: '12px', color: 'var(--color-primary)' }}>
                  {m.type === 'file' ? <Download size={24} /> : <LinkIcon size={24} />}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)' }}>{m.title}</h4>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('studentDashboard.subjectLabel')} {m.subject} | {t('studentDashboard.teacherLabel')} {m.teacherEmail}</div>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <a 
                  href={m.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary" 
                  style={{ width: '100%', textAlign: 'center', display: 'block' }}
                >
                  {m.type === 'file' ? t('studentDashboard.downloadOpenFile') : t('studentDashboard.openLink')}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentPreparations() {
  const { t } = useLanguage();
  const studentClass = useStudentClass();
  const [preparations, setPreparations] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [publishedWorksheets, setPublishedWorksheets] = useState({});
  const [activeWorksheet, setActiveWorksheet] = useState(null);
  const [activePrepData, setActivePrepData] = useState(null);
  const [showGoalsMap, setShowGoalsMap] = useState({});

  useEffect(() => {
    if (!studentClass) return;
    const q = query(collection(db, 'preparations'), where('className', '==', studentClass));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setPreparations(data);
    });

    // Query published worksheets for this class
    const qWs = query(
      collection(db, 'worksheets'),
      where('className', '==', studentClass),
      where('status', '==', 'published')
    );
    const unsubWs = onSnapshot(qWs, (snapshot) => {
      const map = {};
      snapshot.forEach((docSnap) => {
        const wsData = { id: docSnap.id, ...docSnap.data() };
        if (wsData.prepId) map[wsData.prepId] = wsData;
        const normKey = `${(wsData.subject || '').trim()}_${(wsData.lessonTitle || '').trim()}`;
        map[normKey] = wsData;
      });
      setPublishedWorksheets(map);
    });

    return () => {
      unsub();
      unsubWs();
    };
  }, [studentClass]);

  if (!studentClass) {
    return <div className="glass-panel" style={{ padding: '24px' }}>{t('studentDashboard.loadingData')}</div>;
  }

  // Get unique subjects
  const subjects = [...new Set(preparations.map(p => p.subject))];
  
  // Filter by selected subject
  const filtered = selectedSubject ? preparations.filter(p => p.subject === selectedSubject) : preparations;

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>{t('studentDashboard.preparationsClass')} {studentClass}</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{t('studentDashboard.preparationsSubtitle')}</p>
        </div>
        
        {subjects.length > 0 && (
          <select 
            className="input-field" 
            style={{ width: '200px', marginBottom: 0 }}
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">{t('studentDashboard.allSubjects')}</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {preparations.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px' }}>
          {t('studentDashboard.noPreparationsClass')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {filtered.map(p => {
            const normKey = `${(p.subject || '').trim()}_${(p.lessonTitle || '').trim()}`;
            const ws = publishedWorksheets[p.id] || publishedWorksheets[p.worksheetId] || publishedWorksheets[normKey];

            return (
              <div key={p.id} style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '18px' }}>
                      {p.lessonTitle ? `${p.lessonTitle} - ` : ''}{t('studentDashboard.subjectLabel')} {p.subject}
                    </h3>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      {t('studentDashboard.teacherLabel')} {p.teacherName || p.teacherEmail}
                    </div>

                    {/* Action buttons (Worksheet & Toggle Lesson Objectives) */}
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {ws && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWorksheet(ws);
                            setActivePrepData(p);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)'
                          }}
                        >
                          <Sparkles size={14} /> 📄 ورقة عمل الدرس (معتمدة للحل والطباعة)
                        </button>
                      )}

                      {p.goals && (
                        <button
                          type="button"
                          onClick={() => setShowGoalsMap(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          style={{
                            background: showGoalsMap[p.id] ? '#f0fdfa' : '#f8fafc',
                            color: showGoalsMap[p.id] ? '#0e7490' : '#64748b',
                            border: `1px solid ${showGoalsMap[p.id] ? '#99f6e4' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title={showGoalsMap[p.id] ? 'إخفاء الأهداف السلوكية للدرس' : 'عرض الأهداف السلوكية للدرس'}
                        >
                          {showGoalsMap[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          <span>أهداف الدرس: {showGoalsMap[p.id] ? 'ظاهرة 👁️' : 'مخفية 🔒 (افتراضي)'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>{p.week || `${t('studentDashboard.week')} 1`}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('studentDashboard.date')} {p.date || '-'}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{t('studentDashboard.period')} {p.period || '-'}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {p.fileUrl && (
                    <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '12px 16px', borderRadius: '8px' }}>
                      <strong>{t('studentDashboard.attachedFile')}</strong> <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>{p.fileName}</a>
                    </div>
                  )}

                  {['goals', 'portfolio', 'warmup', 'strategy', 'content', 'resources', 'formativeEval', 'summativeEval', 'homework'].map(field => {
                    const titles = {
                      goals: t('lessonPreparation.behavioralGoals'),
                      portfolio: t('lessonPreparation.portfolio'),
                      warmup: t('lessonPreparation.warmup'),
                      strategy: t('lessonPreparation.teachingStrategies'),
                      content: t('lessonPreparation.lessonContent'),
                      resources: t('lessonPreparation.resources'),
                      formativeEval: t('lessonPreparation.formativeEval'),
                      summativeEval: t('lessonPreparation.summativeEval'),
                      homework: t('lessonPreparation.homework')
                    };
                    if (!p[field]) return null;

                    // Lesson behavioral goals are hidden from students by default, unless toggled on
                    if (field === 'goals') {
                      if (!showGoalsMap[p.id]) return null;
                      return (
                        <div key={field} style={{ background: '#f0fdfa', border: '1.5px solid #99f6e4', padding: '14px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h4 style={{ color: '#0e7490', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Eye size={16} /> {titles[field]}:
                            </h4>
                            <button
                              type="button"
                              onClick={() => setShowGoalsMap(prev => ({ ...prev, [p.id]: false }))}
                              style={{ background: 'transparent', border: 'none', color: '#0e7490', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              إخفاء 🔒
                            </button>
                          </div>
                          <div style={{ padding: '12px', background: '#fff', border: '1px solid #ccfbf1', borderRadius: '8px' }}>
                            <MarkdownViewer content={p[field]} />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={field}>
                        <h4 style={{ color: 'var(--color-secondary-dark)', margin: '0 0 8px 0' }}>{titles[field]}:</h4>
                        <div style={{ padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <MarkdownViewer content={p[field]} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Worksheet Modal */}
      {activeWorksheet && (
        <LessonWorksheetModal
          isOpen={Boolean(activeWorksheet)}
          onClose={() => {
            setActiveWorksheet(null);
            setActivePrepData(null);
          }}
          prepData={activePrepData}
          existingWorksheet={activeWorksheet}
          readOnly={true}
          userRole="student"
        />
      )}
    </div>
  );
}



export default function StudentDashboard() {
  const { t } = useLanguage();
  return (
    <Layout role="student" title={t('studentDashboard.pageTitle')}>
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/portfolio" element={<AchievementPortfolioPage />} />
        <Route path="/grades" element={<StudentPortfolio />} />
        <Route path="/weekly-plan" element={<StudentWeeklyPlan />} />
        <Route path="/assignments" element={<StudentAssignments />} />
        <Route path="/schedule" element={<StudentSchedule />} />
        <Route path="/materials" element={<StudentMaterials />} />
        <Route path="/preparations" element={<StudentPreparations />} />
        <Route path="/exams" element={<StudentExams />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
