import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Bell, Globe, Mail, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function Header({ title, role }) {
  const { currentUser, userRole, userData } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  
  // Format role & extra info for display
  const effectiveRole = role || userRole;
  
  let extraDetail = '';
  if (effectiveRole === 'student') {
    const studentClass = userData?.class || userData?.className;
    if (studentClass) extraDetail = studentClass;
  } else if (effectiveRole === 'teacher') {
    const teacherSubject = userData?.subject;
    if (teacherSubject) extraDetail = teacherSubject;
  } else if (effectiveRole === 'staff') {
    if (userData?.roleTitle) extraDetail = userData.roleTitle;
  }

  let supervisorSpecialty = '';
  if (effectiveRole === 'supervisor') {
    supervisorSpecialty = userData?.specialty || userData?.subject || '';
  }

  const schoolId = userData?.schoolId || 'main_school';
  const myNid = (userData?.nationalId || currentUser?.email?.replace('@school.local', '') || currentUser?.uid || '').trim();
  const myClass = (userData?.class || userData?.className || '')?.trim();

  // Listen to unread messages in real-time across all school messages
  useEffect(() => {
    const cleanName = (userData?.name || '').replace(/^(أستاذ|أ\.|د\.|الاستاذ|الأستاذ|المعلم|الطالب)\s*/g, '').trim().toLowerCase();
    const myIdentities = new Set([
      myNid,
      userData?.nationalId,
      userData?.id,
      currentUser?.uid,
      currentUser?.email,
      currentUser?.email?.split('@')[0],
      (userData?.name || '').trim().toLowerCase(),
      cleanName
    ].filter(Boolean).map(s => String(s).trim().toLowerCase()));

    const msgQuery = schoolId === 'ALL' 
      ? collection(db, 'school_messages') 
      : query(collection(db, 'school_messages'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(msgQuery, (snap) => {
      let count = 0;
      snap.docs.forEach(docSnap => {
        const msg = docSnap.data();

        // Multi-school strict isolation
        if (schoolId !== 'ALL' && msg.schoolId !== schoolId) return;

        const readBy = msg.readBy || [];
        const hasRead = Array.isArray(readBy) && readBy.some(id => myIdentities.has(String(id).trim().toLowerCase()));
        if (hasRead) return; // already read

        // Check if message is for me
        if (msg.messageType === 'individual') {
          const recNid = String(msg.receiverNationalId || '').trim().toLowerCase();
          const recId = String(msg.receiverId || '').trim().toLowerCase();
          const recEmail = String(msg.receiverEmail || '').trim().toLowerCase();
          const recName = String(msg.receiverName || '').trim().toLowerCase();
          const myNameLower = (userData?.name || '').trim().toLowerCase();

          const isToMe = (
            (recNid && (myIdentities.has(recNid) || recNid === String(userData?.studentNationalId || '').trim().toLowerCase())) ||
            (recId && myIdentities.has(recId)) ||
            (recEmail && myIdentities.has(recEmail)) ||
            (recName && myIdentities.has(recName)) ||
            (recName && myNameLower && (recName.includes(myNameLower) || myNameLower.includes(recName)))
          );

          if (isToMe) count++;
        } else if (msg.messageType === 'group') {
          const tg = msg.targetGroup || 'all';
          if (tg === 'all') count++;
          else if (tg === 'teachers' && (effectiveRole === 'teacher' || userData?.role === 'teacher' || !!userData?.subject)) count++;
          else if (tg === 'students' && (effectiveRole === 'student' || userData?.role === 'student')) count++;
          else if (tg === 'parents' && (effectiveRole === 'parent' || userData?.role === 'parent')) count++;
          else if (tg === 'class') {
            const targetCls = String(msg.targetClassName || '').trim().toLowerCase();
            const userCls = String(myClass || userData?.class || userData?.className || userData?.studentClass || '').trim().toLowerCase();
            if (effectiveRole === 'student' || effectiveRole === 'parent' || userData?.role === 'student' || userData?.role === 'parent') {
              if (!targetCls || targetCls === userCls || userCls.includes(targetCls) || targetCls.includes(userCls)) {
                count++;
              }
            } else if (effectiveRole === 'admin' || effectiveRole === 'teacher' || effectiveRole === 'staff') {
              count++;
            }
          }
          else if (tg === 'staff' && (effectiveRole === 'staff' || effectiveRole === 'admin')) count++;
          else if (tg === 'supervisors' && effectiveRole === 'supervisor') count++;
        }
      });
      setUnreadMsgCount(count);
    });

    return () => unsub();
  }, [schoolId, myNid, effectiveRole, myClass, currentUser, userData]);

  const displayRole = effectiveRole === 'superadmin' ? 'الماستر' : 
                      effectiveRole === 'admin' ? (userData?.schoolName ? `مدير • ${userData.schoolName}` : 'مدير') : 
                      effectiveRole === 'staff' ? (userData?.schoolName ? `${userData?.roleTitle || 'كادر مدرسي'} • ${userData.schoolName}` : (userData?.roleTitle || 'كادر مدرسي')) :
                      effectiveRole === 'supervisor' ? (userData?.schoolName ? `مشرف تعليمي${supervisorSpecialty ? ` (${supervisorSpecialty})` : ''} • ${userData.schoolName}` : `مشرف تعليمي${supervisorSpecialty ? ` (${supervisorSpecialty})` : ''}`) :
                      effectiveRole === 'teacher' ? (extraDetail ? `معلم • ${extraDetail}` : 'معلم') : 
                      effectiveRole === 'parent' ? (userData?.studentName ? `ولي أمر • الطالب: ${userData.studentName}` : 'ولي أمر') : 
                      (extraDetail ? `طالب • ${extraDetail}` : 'طالب');

  const displayName = userData?.name || currentUser?.email?.split('@')[0] || t('header.user');

  return (
    <header className="top-header">
      <div className="header-title">{title}</div>
      
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {(userData?.role === 'superadmin' || userRole === 'superadmin') && effectiveRole !== 'superadmin' && (
          <button
            className="btn"
            onClick={async () => {
              if (switchSchoolContext) await switchSchoolContext('ALL');
              navigate('/superadmin');
            }}
            style={{
              background: 'linear-gradient(135deg, #0e7490, #0369a1)',
              color: '#ffffff',
              borderRadius: '20px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
              border: 'none',
              boxShadow: '0 2px 8px rgba(14, 116, 144, 0.3)'
            }}
            title="العودة إلى لوحة الماستر العام المركزية"
          >
            <ShieldCheck size={16} />
            <span>لوحة الماستر العام</span>
          </button>
        )}

        <button 
          className="btn" 
          onClick={toggleLanguage}
          style={{ 
            background: lang === 'ar' ? 'rgba(14, 116, 144, 0.08)' : 'rgba(16, 185, 129, 0.08)', 
            border: `1px solid ${lang === 'ar' ? '#0e7490' : '#10b981'}`,
            borderRadius: '20px',
            padding: '6px 14px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px',
            color: lang === 'ar' ? '#0e7490' : '#047857',
            transition: 'all 0.2s ease'
          }}
          title={lang === 'ar' ? 'Switch to English' : 'التحويل للغة العربية'}
        >
          <Globe size={16} color={lang === 'ar' ? '#0e7490' : '#047857'} />
          <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* Electronic Portfolio Quick Button */}
        <button
          className="btn"
          onClick={() => navigate(`/${effectiveRole}/portfolio`)}
          style={{
            background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(99, 178, 198, 0.15))',
            border: '1px solid rgba(14, 116, 144, 0.25)',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '13px',
            color: '#0e7490',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
          title="ملف الإنجاز الإلكتروني الشامل"
        >
          <Award size={16} color="#0e7490" />
          <span>ملف الإنجاز</span>
        </button>

        {/* Messaging Quick Button */}
        <button
          className="btn"
          onClick={() => navigate(`/${effectiveRole}/messages`)}
          style={{ background: 'transparent', padding: '8px', position: 'relative', cursor: 'pointer' }}
          title="المراسلات والتعاميم"
        >
          <Mail size={20} color="#0e7490" />
          {unreadMsgCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#ef4444',
              color: 'white',
              fontSize: '10px',
              fontWeight: '900',
              borderRadius: '10px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid white'
            }}>
              {unreadMsgCount}
            </span>
          )}
        </button>

        <button className="btn" style={{ background: 'transparent', padding: '8px' }}>
          <Bell size={20} color="var(--color-text-muted)" />
        </button>
        
        <div className="user-profile">
          <div className="user-info" style={{ textAlign: 'start' }}>
            <span className="user-name" style={{ color: '#0f172a', fontWeight: '700', fontSize: '15px' }}>
              {displayName}
              {extraDetail && (
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: '#0e7490', 
                  background: 'rgba(99, 178, 198, 0.15)', 
                  padding: '2px 8px', 
                  borderRadius: '10px',
                  marginInlineStart: '8px',
                  display: 'inline-block'
                }}>
                  {extraDetail}
                </span>
              )}
            </span>
            <span className="user-role" style={{ color: '#0e7490', fontWeight: '600', fontSize: '13px', display: 'block', marginTop: '2px' }}>
              {displayRole}
            </span>
          </div>
          <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #0e7490, #63B2C6)', color: 'white', fontWeight: 'bold' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
