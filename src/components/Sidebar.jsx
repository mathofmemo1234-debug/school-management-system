import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Users, BookOpen, Calendar, Home, Settings, FileText, Star, UserCheck, ShieldCheck, CheckSquare, Globe, Mail, Award, ClipboardList } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Sidebar({ role }) {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { t } = useLanguage();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  const adminLinks = [
    { path: '/admin', icon: Home, label: t('sidebar.overview') },
    { path: '/admin/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/admin/portfolio', icon: Award, label: 'ملف الإنجاز القيادي' },
    { path: '/admin/teacher-evaluations', icon: UserCheck, label: 'تقييم أداء المعلمين' },
    { path: '/admin/student-records', icon: ClipboardList, label: 'سجل متابعة الطالب الشامل' },
    { path: '/admin/staff', icon: ShieldCheck, label: t('sidebar.staff') },
    { path: '/admin/supervisors', icon: UserCheck, label: t('sidebar.supervisors') },
    { path: '/admin/teachers', icon: Users, label: t('sidebar.teachers') },
    { path: '/admin/students', icon: Users, label: t('sidebar.students') },
    { path: '/admin/classes', icon: BookOpen, label: t('sidebar.classes') },
    { path: '/admin/schedule', icon: Calendar, label: 'إدارة المواد والجدول الدراسي' },
    { path: '/admin/attendance', icon: CheckSquare, label: t('sidebar.attendance') },
    { path: '/admin/preparations', icon: BookOpen, label: t('sidebar.preparations') },
    { path: '/admin/weekly-plan', icon: BookOpen, label: t('sidebar.weeklyPlan') },
    { path: '/admin/excellence', icon: Star, label: t('sidebar.files') },
    { path: '/admin/noor', icon: Globe, label: t('sidebar.noorSystem') },
    { path: '/admin/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const userPerms = userData?.permissions || [
    'preparations', 'weekly_plans', 'schedules', 'students', 'teachers', 'attendance', 'classes', 'excellence'
  ];

  const staffLinks = [
    { path: '/staff', icon: Home, label: t('sidebar.overview') },
    { path: '/staff/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/staff/portfolio', icon: Award, label: 'ملف الإنجاز الإداري' },
    { path: '/staff/teacher-evaluations', icon: UserCheck, label: 'تقييم أداء المعلمين' },
    { path: '/staff/student-records', icon: ClipboardList, label: 'سجل متابعة الطالب الشامل' },
    ...(userPerms.includes('attendance') ? [{ path: '/staff/attendance', icon: CheckSquare, label: t('sidebar.attendance') }] : []),
    ...(userPerms.includes('preparations') ? [{ path: '/staff/preparations', icon: BookOpen, label: t('sidebar.preparations') }] : []),
    ...(userPerms.includes('weekly_plans') ? [{ path: '/staff/weekly-plan', icon: Calendar, label: t('sidebar.weeklyPlan') }] : []),
    ...(userPerms.includes('schedules') ? [{ path: '/staff/schedule', icon: Calendar, label: t('sidebar.schedule') }] : []),
    ...(userPerms.includes('students') ? [{ path: '/staff/students', icon: Users, label: t('sidebar.students') }] : []),
    ...(userPerms.includes('teachers') ? [{ path: '/staff/teachers', icon: Users, label: t('sidebar.teachers') }] : []),
    ...(userPerms.includes('classes') ? [{ path: '/staff/classes', icon: BookOpen, label: t('sidebar.classes') }] : []),
    ...(userPerms.includes('excellence') ? [{ path: '/staff/excellence', icon: Star, label: t('sidebar.files') }] : []),
    { path: '/staff/noor', icon: Globe, label: t('sidebar.noorSystem') },
    { path: '/staff/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const supervisorLinks = [
    { path: '/supervisor', icon: Home, label: t('sidebar.overview') },
    { path: '/supervisor/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/supervisor/portfolio', icon: Award, label: 'ملف الإنجاز الإشرافي' },
    { path: '/supervisor/teacher-evaluations', icon: UserCheck, label: 'تقييم أداء المعلمين' },
    { path: '/supervisor/student-records', icon: ClipboardList, label: 'سجل متابعة الطالب الشامل' },
    { path: '/supervisor/attendance', icon: CheckSquare, label: t('sidebar.attendance') },
    { path: '/supervisor/preparations', icon: BookOpen, label: t('sidebar.preparations') },
    { path: '/supervisor/weekly-plan', icon: Calendar, label: t('sidebar.weeklyPlan') },
    { path: '/supervisor/schedule', icon: Calendar, label: t('sidebar.schedule') },
    { path: '/supervisor/teachers', icon: Users, label: t('sidebar.teachers') },
    { path: '/supervisor/excellence', icon: Star, label: t('sidebar.files') },
    { path: '/supervisor/noor', icon: Globe, label: t('sidebar.noorSystem') },
    { path: '/supervisor/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const superAdminLinks = [
    { path: '/superadmin', icon: Home, label: t('sidebar.superAdminDashboard') },
    { path: '/superadmin/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/superadmin/portfolio', icon: Award, label: 'ملف الإنجاز القيادي' },
    { path: '/superadmin/excellence', icon: Star, label: 'معايير التميز والاعتماد' },
    { path: '/superadmin/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const teacherLinks = [
    { path: '/teacher', icon: Home, label: t('sidebar.overview') },
    { path: '/teacher/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/teacher/portfolio', icon: Award, label: 'ملف الإنجاز التربوي' },
    { path: '/teacher/performance-evaluation', icon: UserCheck, label: 'تقييم الأداء والزيارات' },
    { path: '/teacher/student-records', icon: ClipboardList, label: 'سجل متابعة الطالب الشامل' },
    { path: '/teacher/preparation', icon: BookOpen, label: t('sidebar.preparations') },
    { path: '/teacher/weekly-plan', icon: Calendar, label: t('sidebar.weeklyPlan') },
    { path: '/teacher/schedule', icon: Calendar, label: t('sidebar.schedule') },
    { path: '/teacher/assignments', icon: BookOpen, label: t('sidebar.assignments') },
    { path: '/teacher/exams', icon: FileText, label: t('sidebar.exams') },
    { path: '/teacher/materials', icon: BookOpen, label: t('sidebar.materials') },
    { path: '/teacher/attendance', icon: Users, label: t('sidebar.attendance') },
    { path: '/teacher/excellence', icon: Star, label: t('sidebar.files') },
    { path: '/teacher/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const studentLinks = [
    { path: '/student', icon: Home, label: t('sidebar.overview') },
    { path: '/student/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/student/portfolio', icon: Award, label: 'ملف الإنجاز الأكاديمي' },
    { path: '/student/weekly-plan', icon: Calendar, label: t('sidebar.weeklyPlan') },
    { path: '/student/schedule', icon: Calendar, label: t('sidebar.schedule') },
    { path: '/student/assignments', icon: BookOpen, label: t('sidebar.assignments') },
    { path: '/student/exams', icon: FileText, label: t('sidebar.exams') },
    { path: '/student/materials', icon: BookOpen, label: t('sidebar.materials') },
    { path: '/student/preparations', icon: BookOpen, label: t('sidebar.studentPreparations') },
    { path: '/student/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const parentLinks = [
    { path: '/parent', icon: Home, label: t('sidebar.overview') },
    { path: '/parent/messages', icon: Mail, label: 'المراسلات والتعاميم' },
    { path: '/parent/portfolio', icon: Award, label: 'ملف إنجاز الطالب' },
    { path: '/parent/student-records', icon: ClipboardList, label: 'سجل متابعة الطالب الشامل' },
    { path: '/parent/weekly-plan', icon: Calendar, label: t('sidebar.weeklyPlan') },
    { path: '/parent/schedule', icon: Calendar, label: t('sidebar.schedule') },
    { path: '/parent/assignments', icon: BookOpen, label: t('sidebar.assignments') },
    { path: '/parent/exams', icon: FileText, label: t('sidebar.exams') },
    { path: '/parent/settings', icon: Settings, label: t('sidebar.settings') },
  ];

  const links = role === 'superadmin' ? superAdminLinks : 
                role === 'admin' ? adminLinks : 
                role === 'staff' ? staffLinks : 
                role === 'supervisor' ? supervisorLinks : 
                role === 'teacher' ? teacherLinks : 
                role === 'parent' ? parentLinks : studentLinks;
  
  const logoSrc = userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`;

  return (
    <div className="sidebar">
      <div className="sidebar-logo-wrapper">
        <img 
          src={logoSrc} 
          alt="School Logo" 
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
          }}
          className="sidebar-logo-img"
        />
      </div>
      
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === `/${role}`}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <link.icon size={19} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={handleLogout} style={{ width: '100%', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', cursor: 'pointer', color: '#dc2626', borderRadius: '10px' }}>
          <LogOut size={19} />
          <span>{t('sidebar.logout')}</span>
        </button>
      </div>
    </div>
  );
}
