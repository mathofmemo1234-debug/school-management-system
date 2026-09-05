import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BookOpen, Calendar, Users, Star, CheckSquare, ShieldCheck, ArrowLeft, ArrowRight, Settings, FileText, Printer, Globe, ClipboardList } from 'lucide-react';
import AdminPreparations from './AdminPreparations';
import WeeklyPlanView from '../components/WeeklyPlanView';
import ManageSchedules from './ManageSchedules';
import AdminExcellence from './AdminExcellence';
import SchoolExcellenceDashboard from './SchoolExcellenceDashboard';
import SchoolSettings from './SchoolSettings';
import TeacherDashboard from './TeacherDashboard';
import AttendanceSummaryExport from '../components/AttendanceSummaryExport';
import CertificateLetterModal from '../components/CertificateLetterModal';
import PrintStudentRecordsModal from '../components/PrintStudentRecordsModal';
import NoorIntegrationHub from '../components/NoorIntegrationHub';
import SchoolMessagingHub from './SchoolMessagingHub';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import ComprehensiveStudentRecord from './ComprehensiveStudentRecord';
import TeacherPerformanceEvaluationHub from './TeacherPerformanceEvaluationHub';
import SchoolResourcesHub from './SchoolResourcesHub';

function StaffHome({ schoolId }) {
  const { userData } = useAuth();
  const { lang } = useLanguage();
  const [stats, setStats] = useState({ teachers: 0, students: 0, preparations: 0, weeklyPlans: 0, files: 0 });

  const userPerms = userData?.permissions || ['preparations', 'weekly_plans', 'schedules', 'students', 'teachers', 'attendance', 'excellence'];

  useEffect(() => {
    if (!schoolId) return;

    const qTeachers = query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      setStats(prev => ({ ...prev, teachers: snap.size }));
    });

    const qStudents = query(collection(db, 'students'), where('schoolId', '==', schoolId));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStats(prev => ({ ...prev, students: snap.size }));
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
      unsubStudents();
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
        background: 'linear-gradient(135deg, rgba(99, 178, 198, 0.2) 0%, rgba(255, 255, 255, 0.95) 100%)',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)' }}>
            مرحباً بك: {userData?.name || 'عضو الكادر'}
          </h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '15px' }}>
            المسمى الوظيفي: <strong>{userData?.roleTitle || 'كادر إداري / تعليمي'}</strong> • {userData?.schoolName || 'المدرسة'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/staff/student-records" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'linear-gradient(135deg, #0e7490 0%, #0369a1 100%)' }}>
            <ClipboardList size={18} /> سجل متابعة الطالب الشامل
          </Link>
          {userPerms.includes('preparations') && (
            <Link to="/staff/preparations" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-primary-dark)' }}>
              <BookOpen size={18} /> متابعة التحضير
            </Link>
          )}
          {userPerms.includes('weekly_plans') && (
            <Link to="/staff/weekly-plan" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-primary-dark)' }}>
              <Calendar size={18} /> الخطة الأسبوعية
            </Link>
          )}
          {userPerms.includes('students') && (
            <Link to="/staff/students" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-primary-dark)' }}>
              <Users size={18} /> شؤون الطلاب
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {userPerms.includes('teachers') && (
          <Link to="/staff/teachers" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        )}

        {userPerms.includes('students') && (
          <Link to="/staff/students" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-card glass-panel" style={{ cursor: 'pointer' }}>
              <div className="stat-icon green">
                <Users size={32} />
              </div>
              <div className="stat-info">
                <p>إجمالي الطلاب</p>
                <h3>{stats.students}</h3>
              </div>
            </div>
          </Link>
        )}

        {userPerms.includes('preparations') && (
          <Link to="/staff/preparations" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-card glass-panel" style={{ cursor: 'pointer' }}>
              <div className="stat-icon orange">
                <BookOpen size={32} />
              </div>
              <div className="stat-info">
                <p>تحضيرات الدروس</p>
                <h3>{stats.preparations}</h3>
              </div>
            </div>
          </Link>
        )}

        {userPerms.includes('excellence') && (
          <Link to="/staff/excellence" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        )}
      </div>

      {/* Dynamic Shortcuts to Allowed Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {userPerms.includes('preparations') && (
          <Link to="/staff/preparations" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        )}

        {userPerms.includes('weekly_plans') && (
          <Link to="/staff/weekly-plan" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        )}

        {userPerms.includes('schedules') && (
          <Link to="/staff/schedule" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        )}

        {userPerms.includes('students') && (
          <Link to="/staff/students" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="var(--color-primary)" /> شؤون وسجلات الطلاب
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  الاطلاع على بيانات وقوائم الطلاب وفصولهم
                </p>
              </div>
              <ArrowIcon size={20} color="var(--color-primary)" />
            </div>
          </Link>
        )}

        {userPerms.includes('attendance') && (
          <Link to="/staff/attendance" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckSquare size={20} color="var(--color-primary)" /> ملخص وتصدير غياب وحضور الطلاب
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  البحث بالاسم أو الهوية أو التاريخ وتصدير كشف الغياب (Excel / PDF)
                </p>
              </div>
              <ArrowIcon size={20} color="var(--color-primary)" />
            </div>
          </Link>
        )}

        {userPerms.includes('excellence') && (
          <Link to="/staff/excellence" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={20} color="#eab308" /> ملفات التميز والتوثيق
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  الاطلاع على شواهد وإنجازات المدرسة
                </p>
              </div>
              <ArrowIcon size={20} color="var(--color-primary)" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function StaffTeachersView({ schoolId }) {
  const [teachers, setTeachers] = useState([]);
  const [printingLetterTeacher, setPrintingLetterTeacher] = useState(null);

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
      <h2 style={{ marginBottom: '20px', color: 'var(--color-primary-dark)' }}>دليل كادر المعلمين</h2>
      <div style={{ display: 'grid', gap: '12px' }}>
        {teachers.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>لا يوجد معلمون مسجلون حالياً</p>
        ) : (
          teachers.map(tData => (
            <div key={tData.id} style={{ padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#0e7490',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    🌐 {tData.nationality || 'سعودي'}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  رقم الهوية: {tData.nationalId} {tData.whatsapp ? `• واتساب: ${tData.whatsapp}` : ''}
                </p>
              </div>
              <div>
                <button
                  onClick={() => setPrintingLetterTeacher(tData)}
                  className="btn"
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="طباعة مشهد تعريف معلم"
                >
                  <FileText size={15} /> مشهد تعريف
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {printingLetterTeacher && (
        <CertificateLetterModal person={printingLetterTeacher} type="teacher" onClose={() => setPrintingLetterTeacher(null)} />
      )}
    </div>
  );
}

function StaffStudentsView({ schoolId }) {
  const [students, setStudents] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [printingLetterStudent, setPrintingLetterStudent] = useState(null);
  const [isPrintingStudentRecords, setIsPrintingStudentRecords] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, 'students'), where('schoolId', '==', schoolId));
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
      setStudents(list);
    });

    const qCls = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
    const unsubCls = onSnapshot(qCls, (snap) => {
      setClassesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
      unsubCls();
    };
  }, [schoolId]);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>سجلات وقوائم الطلاب</h2>
        <button 
          className="btn" 
          style={{background: 'linear-gradient(135deg, #0e7490, #63B2C6)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'}} 
          onClick={() => setIsPrintingStudentRecords(true)}
        >
          <Printer size={16} /> طباعة وسجل قيد الطلاب
        </button>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {students.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>لا يوجد طلاب مسجلون حالياً</p>
        ) : (
          students.map(s => (
            <div key={s.id} style={{ padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {s.name}
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    color: 'var(--color-primary-dark)', 
                    background: 'rgba(99, 178, 198, 0.15)', 
                    padding: '2px 10px', 
                    borderRadius: '12px' 
                  }}>
                    {s.class || s.className || 'غير محدد'}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#0e7490',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    🌐 {s.nationality || 'سعودي'}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  رقم الهوية: {s.nationalId}
                </p>
              </div>
              <div>
                <button
                  onClick={() => setPrintingLetterStudent(s)}
                  className="btn"
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="طباعة شهادة تعريف طالب"
                >
                  <FileText size={15} /> شهادة تعريف
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {printingLetterStudent && (
        <CertificateLetterModal person={printingLetterStudent} type="student" onClose={() => setPrintingLetterStudent(null)} />
      )}

      {isPrintingStudentRecords && (
        <PrintStudentRecordsModal students={students} classesList={classesList} onClose={() => setIsPrintingStudentRecords(false)} />
      )}
    </div>
  );
}

export default function StaffDashboard() {
  const { userData } = useAuth();
  const userPerms = userData?.permissions || ['preparations', 'weekly_plans', 'schedules', 'students', 'teachers', 'attendance', 'excellence'];

  return (
    <Layout role="staff" title={userData?.roleTitle || 'لوحة تحكم الكادر المدرسي'}>
      <Routes>
        <Route path="/" element={<StaffHome schoolId={userData?.schoolId} />} />
        <Route path="/resources" element={<SchoolResourcesHub role="staff" />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/portfolio" element={<AchievementPortfolioPage />} />
        <Route path="/teacher-evaluations" element={<TeacherPerformanceEvaluationHub role="staff" />} />
        <Route path="/student-records" element={<ComprehensiveStudentRecord role="staff" />} />
        {userPerms.includes('preparations') && (
          <Route path="/preparations" element={<AdminPreparations schoolId={userData?.schoolId} />} />
        )}
        {userPerms.includes('weekly_plans') && (
          <Route path="/weekly-plan" element={<WeeklyPlanView schoolId={userData?.schoolId} />} />
        )}
        {userPerms.includes('schedules') && (
          <Route path="/schedule" element={<ManageSchedules schoolId={userData?.schoolId} />} />
        )}
        {userPerms.includes('teachers') && (
          <Route path="/teachers" element={<StaffTeachersView schoolId={userData?.schoolId} />} />
        )}
        {userPerms.includes('students') && (
          <Route path="/students" element={<StaffStudentsView schoolId={userData?.schoolId} />} />
        )}
        {userPerms.includes('attendance') && (
          <Route path="/attendance" element={<AttendanceSummaryExport schoolId={userData?.schoolId} />} />
        )}
        {userPerms.includes('excellence') && (
          <Route path="/excellence" element={<SchoolExcellenceDashboard />} />
        )}
        <Route path="/noor" element={<NoorIntegrationHub schoolId={userData?.schoolId} />} />
        <Route path="/settings" element={<SchoolSettings schoolId={userData?.schoolId} />} />
        <Route path="*" element={<StaffHome schoolId={userData?.schoolId} />} />
      </Routes>
    </Layout>
  );
}
