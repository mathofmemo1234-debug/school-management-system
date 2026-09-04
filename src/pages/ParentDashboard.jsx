import React, { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import StudentSchedule from './StudentSchedule';
import StudentExams from './StudentExams';
import SchoolMessagingHub from './SchoolMessagingHub';
import WeeklyPlanView from '../components/WeeklyPlanView';
import Settings from './Settings';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import ComprehensiveStudentRecord from './ComprehensiveStudentRecord';
import { User, GraduationCap, School, BookOpen, Calendar, Award, Mail, FileText, CheckCircle2, ChevronLeft, ClipboardList } from 'lucide-react';

function ParentHome() {
  const { userData, currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'weekly-plan' | 'exams' | 'messages'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Profile Card */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--color-bg-card)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="صورة ولي الأمر" 
                style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--color-primary)' }}
              />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <User size={32} />
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>
                {t('parent.welcomeTitle')}: {userData?.name || currentUser?.displayName || 'ولي الأمر'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                {currentUser?.email || ''}
              </p>
            </div>
          </div>

          {/* Linked Student Card */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            border: '1px solid rgba(59, 130, 246, 0.2)',
            minWidth: '280px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
              <GraduationCap size={18} />
              <span>{t('parent.linkedStudent')} {userData?.studentName || 'الطالب المتابع'}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>الصف الدراسي:</strong> {userData?.studentClass || 'غير محدد'}</div>
              <div><strong>المدرسة/المجمع:</strong> {userData?.schoolName || 'المدارس المتقدمة للتعلم الذكي'}</div>
              <div><strong>رقم هوية الطالب:</strong> {userData?.studentNationalId || 'غير محدد'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Interactive Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div 
          onClick={() => setActiveTab('records')}
          className="glass-panel" 
          style={{ 
            padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            cursor: 'pointer', border: activeTab === 'records' ? '2px solid #0e7490' : '1px solid var(--color-border)',
            transition: 'all 0.2s', background: activeTab === 'records' ? '#f0f9ff' : 'var(--color-bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>التقرير الشامل</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text)' }}>سجل متابعة الطالب الشامل</div>
            </div>
          </div>
          <ChevronLeft size={20} color="#94a3b8" />
        </div>

        <div 
          onClick={() => setActiveTab('schedule')}
          className="glass-panel" 
          style={{ 
            padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            cursor: 'pointer', border: activeTab === 'schedule' ? '2px solid #2563eb' : '1px solid var(--color-border)',
            transition: 'all 0.2s', background: activeTab === 'schedule' ? '#eff6ff' : 'var(--color-bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>الجدول والتوقيت</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text)' }}>جدول الطالب الأسبوعي</div>
            </div>
          </div>
          <ChevronLeft size={20} color="#94a3b8" />
        </div>

        <div 
          onClick={() => setActiveTab('weekly-plan')}
          className="glass-panel" 
          style={{ 
            padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            cursor: 'pointer', border: activeTab === 'weekly-plan' ? '2px solid #16a34a' : '1px solid var(--color-border)',
            transition: 'all 0.2s', background: activeTab === 'weekly-plan' ? '#f0fdf4' : 'var(--color-bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>التحاضير والواجبات</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text)' }}>تحاضير ومعلمي الصف</div>
            </div>
          </div>
          <ChevronLeft size={20} color="#94a3b8" />
        </div>

        <div 
          onClick={() => setActiveTab('exams')}
          className="glass-panel" 
          style={{ 
            padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            cursor: 'pointer', border: activeTab === 'exams' ? '2px solid #9333ea' : '1px solid var(--color-border)',
            transition: 'all 0.2s', background: activeTab === 'exams' ? '#faf5ff' : 'var(--color-bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>الدرجات والنتائج</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text)' }}>سجل التميز والاختبارات</div>
            </div>
          </div>
          <ChevronLeft size={20} color="#94a3b8" />
        </div>

        <div 
          onClick={() => setActiveTab('messages')}
          className="glass-panel" 
          style={{ 
            padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            cursor: 'pointer', border: activeTab === 'messages' ? '2px solid #d97706' : '1px solid var(--color-border)',
            transition: 'all 0.2s', background: activeTab === 'messages' ? '#fffbeb' : 'var(--color-bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={24} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>التواصل المدرسي</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-text)' }}>التعاميم والرسائل المباشرة</div>
            </div>
          </div>
          <ChevronLeft size={20} color="#94a3b8" />
        </div>
      </div>

      {/* Embedded Active Section */}
      <div style={{ marginTop: '10px' }}>
        {activeTab === 'records' && (
          <div>
            <ComprehensiveStudentRecord role="parent" />
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text)' }}>
              جدول الطالب الأسبوعي ({userData?.studentName || 'الطالب'})
            </h3>
            <StudentSchedule />
          </div>
        )}

        {activeTab === 'weekly-plan' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text)' }}>
              الخطة الأسبوعية والتحاضير للصف ({userData?.studentClass || 'جميع الصفوف'})
            </h3>
            <WeeklyPlanView studentClass={userData?.studentClass} schoolId={userData?.schoolId} />
          </div>
        )}

        {activeTab === 'exams' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text)' }}>
              سجل الاختبارات والنتائج ({userData?.studentName || 'الطالب'})
            </h3>
            <StudentExams />
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text)' }}>
              التعاميم والرسائل الموجهة لولي الأمر
            </h3>
            <SchoolMessagingHub />
          </div>
        )}
      </div>
    </div>
  );
}

function ParentWeeklyPlan() {
  const { userData } = useAuth();
  return <WeeklyPlanView studentClass={userData?.studentClass} schoolId={userData?.schoolId} />;
}

function ParentStudentPortfolio() {
  const { userData } = useAuth();
  const studentUser = {
    name: userData?.studentName || 'الطالب',
    nationalId: userData?.studentNationalId || '',
    class: userData?.studentClass || '',
    schoolName: userData?.schoolName || 'المجمع التعليمي'
  };
  return <AchievementPortfolioPage targetRole="student" targetUser={studentUser} />;
}

export default function ParentDashboard() {
  return (
    <Layout role="parent">
      <Routes>
        <Route path="/" element={<ParentHome />} />
        <Route path="/student-records" element={<ComprehensiveStudentRecord role="parent" />} />
        <Route path="/weekly-plan" element={<ParentWeeklyPlan />} />
        <Route path="/schedule" element={<StudentSchedule />} />
        <Route path="/exams" element={<StudentExams />} />
        <Route path="/assignments" element={<StudentExams />} />
        <Route path="/portfolio" element={<ParentStudentPortfolio />} />
        <Route path="/preparations" element={<ParentWeeklyPlan />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
