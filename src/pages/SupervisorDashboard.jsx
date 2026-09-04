import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookOpen, Calendar, Users, Star, Award, CheckCircle, FileText, ArrowLeft, ArrowRight, ClipboardList } from 'lucide-react';
import AdminPreparations from './AdminPreparations';
import WeeklyPlanView from '../components/WeeklyPlanView';
import ManageSchedules from './ManageSchedules';
import AdminExcellence from './AdminExcellence';
import SchoolExcellenceDashboard from './SchoolExcellenceDashboard';
import SchoolSettings from './SchoolSettings';
import AttendanceSummaryExport from '../components/AttendanceSummaryExport';
import NoorIntegrationHub from '../components/NoorIntegrationHub';
import SchoolMessagingHub from './SchoolMessagingHub';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import ComprehensiveStudentRecord from './ComprehensiveStudentRecord';
import TeacherPerformanceEvaluationHub from './TeacherPerformanceEvaluationHub';

function SupervisorHome({ schoolId }) {
  const { userData } = useAuth();
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState({ teachers: 0, preparations: 0, weeklyPlans: 0, files: 0 });

  useEffect(() => {
    if (!schoolId) return;

    const qTeachers = query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      setStats(prev => ({ ...prev, teachers: snap.size }));
    });

    const qPrep = query(collection(db, 'preparations'), where('schoolId', '==', schoolId));
    const unsubPrep = onSnapshot(qPrep, (snap) => {
      setStats(prev => ({ ...prev, preparations: snap.size }));
    });

    const qPlans = query(collection(db, 'weekly_plans'), where('schoolId', '==', schoolId));
    const unsubPlans = onSnapshot(qPlans, (snap) => {
      setStats(prev => ({ ...prev, weeklyPlans: snap.size }));
    });

    const qFiles = query(collection(db, 'excellence_files'), where('schoolId', '==', schoolId));
    const unsubFiles = onSnapshot(qFiles, (snap) => {
      setStats(prev => ({ ...prev, files: snap.size }));
    });

    return () => {
      unsubTeachers();
      unsubPrep();
      unsubPlans();
      unsubFiles();
    };
  }, [schoolId]);

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{ 
        padding: '24px', 
        background: 'linear-gradient(135deg, rgba(99, 178, 198, 0.2) 0%, rgba(255, 255, 255, 0.9) 100%)',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)' }}>
            مرحباً بك المشرف التعليمي: {userData?.name || 'المشرف'}
          </h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '15px' }}>
            التخصص / المجال: <strong>{userData?.specialty || 'إشراف تربوي عام'}</strong> • {userData?.schoolName || 'المدرسة'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/supervisor/student-records" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'linear-gradient(135deg, #0e7490 0%, #0369a1 100%)' }}>
            <ClipboardList size={18} /> سجل متابعة الطالب الشامل
          </Link>
          <Link to="/supervisor/preparations" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-primary-dark)' }}>
            <BookOpen size={18} /> متابعة التحضير
          </Link>
          <Link to="/supervisor/weekly-plan" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-primary-dark)' }}>
            <Calendar size={18} /> الخطة الأسبوعية
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <Link to="/supervisor/teachers" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card glass-panel" style={{ cursor: 'pointer' }}>
            <div className="stat-icon blue">
              <Users size={32} />
            </div>
            <div className="stat-info">
              <p>كادر المعلمين</p>
              <h3>{stats.teachers}</h3>
            </div>
          </div>
        </Link>

        <Link to="/supervisor/preparations" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card glass-panel" style={{ cursor: 'pointer' }}>
            <div className="stat-icon green">
              <BookOpen size={32} />
            </div>
            <div className="stat-info">
              <p>تحضيرات الدروس</p>
              <h3>{stats.preparations}</h3>
            </div>
          </div>
        </Link>

        <Link to="/supervisor/weekly-plan" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card glass-panel" style={{ cursor: 'pointer' }}>
            <div className="stat-icon orange">
              <Calendar size={32} />
            </div>
            <div className="stat-info">
              <p>الخطط الأسبوعية</p>
              <h3>{stats.weeklyPlans}</h3>
            </div>
          </div>
        </Link>

        <Link to="/supervisor/excellence" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-card glass-panel" style={{ cursor: 'pointer' }}>
            <div className="stat-icon purple" style={{ color: '#eab308', background: 'rgba(234, 179, 8, 0.1)' }}>
              <Star size={32} />
            </div>
            <div className="stat-info">
              <p>ملفات التميز</p>
              <h3>{stats.files}</h3>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <Link to="/supervisor/preparations" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="var(--color-primary)" /> متابعة تحضير الدروس
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                الاطلاع على تحضير المعلمين والتقييم التربوي
              </p>
            </div>
            <ArrowIcon size={20} color="var(--color-primary)" />
          </div>
        </Link>

        <Link to="/supervisor/weekly-plan" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="var(--color-primary)" /> متابعة الخطة الأسبوعية
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                مراجعة الخطط الأسبوعية لجميع المواد والفصول
              </p>
            </div>
            <ArrowIcon size={20} color="var(--color-primary)" />
          </div>
        </Link>

        <Link to="/supervisor/schedule" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="var(--color-primary)" /> الجدول الدراسي العام
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                استعراض جدول الحصص وتوزيع المعلمين
              </p>
            </div>
            <ArrowIcon size={20} color="var(--color-primary)" />
          </div>
        </Link>

        <Link to="/supervisor/excellence" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} color="#eab308" /> ملفات التميز والتوثيق
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                الاطلاع على شواهد وإنجازات المدرسة
              </p>
            </div>
            <ArrowIcon size={20} color="var(--color-primary)" />
          </div>
        </Link>
      </div>
    </div>
  );
}

function SupervisorTeachers({ schoolId }) {
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      const seen = new Set();
      snap.docs.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() };
        const nid = (d.nationalId || d.id || '').trim();
        if (!seen.has(nid)) {
          seen.add(nid);
          list.push(d);
        }
      });
      setTeachers(list);
    });
    return () => unsub();
  }, [schoolId]);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '20px', color: 'var(--color-primary-dark)' }}>دليل معلمي المدرسة</h2>
      <div style={{ display: 'grid', gap: '12px' }}>
        {teachers.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>لا يوجد معلمون مسجلون حالياً</p>
        ) : (
          teachers.map(tData => (
            <div key={tData.id} style={{ padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {tData.name}
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    color: 'var(--color-primary-dark)', 
                    background: 'rgba(99, 178, 198, 0.15)', 
                    padding: '2px 10px', 
                    borderRadius: '12px' 
                  }}>
                    {tData.subject || 'غير محدد'}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  رقم الهوية: {tData.nationalId} {tData.whatsapp ? `• واتساب: ${tData.whatsapp}` : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SupervisorDashboard() {
  const { userData } = useAuth();
  return (
    <Layout role="supervisor" title="لوحة تحكم المشرف التعليمي">
      <Routes>
        <Route path="/" element={<SupervisorHome schoolId={userData?.schoolId} />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/portfolio" element={<AchievementPortfolioPage />} />
        <Route path="/teacher-evaluations" element={<TeacherPerformanceEvaluationHub role="supervisor" />} />
        <Route path="/student-records" element={<ComprehensiveStudentRecord role="supervisor" />} />
        <Route path="/attendance" element={<AttendanceSummaryExport schoolId={userData?.schoolId} />} />
        <Route path="/preparations" element={<AdminPreparations schoolId={userData?.schoolId} />} />
        <Route path="/weekly-plan" element={<WeeklyPlanView schoolId={userData?.schoolId} />} />
        <Route path="/schedule" element={<ManageSchedules schoolId={userData?.schoolId} />} />
        <Route path="/teachers" element={<SupervisorTeachers schoolId={userData?.schoolId} />} />
        <Route path="/excellence" element={<SchoolExcellenceDashboard />} />
        <Route path="/noor" element={<NoorIntegrationHub schoolId={userData?.schoolId} />} />
        <Route path="/settings" element={<SchoolSettings schoolId={userData?.schoolId} />} />
        <Route path="*" element={<SupervisorHome schoolId={userData?.schoolId} />} />
      </Routes>
    </Layout>
  );
}
