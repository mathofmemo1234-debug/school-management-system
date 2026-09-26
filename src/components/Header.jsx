import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Bell, Globe, Mail, Award, ShieldCheck, Building2,
  Sparkles, BookOpen, FileText, CheckCircle2, Clock, 
  ChevronLeft, ExternalLink, X, AlertCircle, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { subscribeRealtimeEvents } from '../utils/realtimeBroadcast';
import LanguageSwitcher from './LanguageSwitcher';
import { isClassOrStageMatch } from '../utils/classMatcher';

export default function Header({ title, role }) {
  const { currentUser, userRole, userData, switchSchoolContext } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [schoolMeta, setSchoolMeta] = useState(null);
  
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

  // Listen to active school metadata for subtitle and standalone status
  useEffect(() => {
    if (!schoolId || schoolId === 'ALL') {
      setSchoolMeta(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'schools', schoolId), snap => {
      if (snap.exists()) {
        setSchoolMeta({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [schoolId]);

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

    const msgQuery = collection(db, 'school_messages');

    const unsub = onSnapshot(msgQuery, (snap) => {
      let count = 0;
      const isAdminUser = effectiveRole === 'admin' || userData?.role === 'admin';
      const isSuperAdminUser = effectiveRole === 'superadmin' || userData?.role === 'superadmin';

      snap.docs.forEach(docSnap => {
        const msg = docSnap.data();
        if (msg.archived) return;

        // Multi-school isolation with global override for SuperAdmin messages and global broadcasts
        const isGlobal = (
          !msg.schoolId || 
          msg.schoolId === 'ALL' || 
          msg.schoolId === 'all' || 
          schoolId === 'ALL' || 
          schoolId === 'all' || 
          msg.targetSchoolId === 'ALL' || 
          msg.targetSchoolId === 'all' ||
          msg.targetSchoolId === schoolId || 
          msg.schoolId === schoolId ||
          isSuperAdminUser ||
          (msg.senderRole === 'superadmin' && isAdminUser)
        );

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
            (recName && myNameLower && (recName.includes(myNameLower) || myNameLower.includes(recName))) ||
            (isSuperAdminUser && (recNid === 'super@admin.com' || recEmail === 'super@admin.com' || recName.includes('ماستر') || recName.includes('الإدارة العامة'))) ||
            // 👑 Admin always receives individual messages directed to 'admin' or school principal
            (isAdminUser && (
              msg.receiverRole === 'admin' ||
              recName.includes('مدير') ||
              recName.includes('إدارة') ||
              recName.includes('الادارة') ||
              recName.includes('أنس') ||
              recName.includes('الجهني') ||
              recNid === 'all_admins' ||
              recNid === 'anas@school.edu.sa' ||
              recId === 'all_schools_principals' ||
              (msg.senderRole === 'superadmin')
            )) ||
            // 🏫 Acting School Management / Staff / Supervisors in schools without an assigned principal
            ((effectiveRole === 'staff' || effectiveRole === 'supervisor' || userData?.role === 'staff' || userData?.role === 'supervisor') && (
              msg.receiverRole === 'school_management' ||
              msg.allowStaffAndSupervisors === true ||
              (msg.senderRole === 'superadmin' && (recName.includes('إدارة') || recName.includes('الادارة') || recName.includes('الكادر المكلف') || msg.isDirective || msg.isResourceChat))
            ))
          );

          if (isToMe) count++;
        } else if (msg.messageType === 'group') {
          if (!isGlobal && msg.schoolId !== schoolId) return;

          const tg = msg.targetGroup || 'all';

          // Admins & SuperAdmins see ALL broadcasts/circulars targeting their school
          if (isAdminUser || isSuperAdminUser) {
            count++;
          } else if (tg === 'all' || tg === 'admins') {
            count++;
          } else if (tg === 'teachers' && (effectiveRole === 'teacher' || userData?.role === 'teacher' || !!userData?.subject)) {
            count++;
          } else if (tg === 'students' && (effectiveRole === 'student' || userData?.role === 'student')) {
            count++;
          } else if (tg === 'parents' && (effectiveRole === 'parent' || userData?.role === 'parent')) {
            count++;
          } else if (tg === 'class') {
            const targetCls = String(msg.targetClassName || '').trim().toLowerCase();
            const userCls = String(myClass || userData?.class || userData?.className || userData?.studentClass || '').trim().toLowerCase();
            if (effectiveRole === 'student' || effectiveRole === 'parent' || userData?.role === 'student' || userData?.role === 'parent') {
              if (!targetCls || targetCls === userCls || userCls.includes(targetCls) || targetCls.includes(userCls)) {
                count++;
              }
            } else if (effectiveRole === 'admin' || effectiveRole === 'teacher' || effectiveRole === 'staff') {
              count++;
            }
          } else if (tg === 'staff' && (effectiveRole === 'staff' || effectiveRole === 'admin')) {
            count++;
          } else if (tg === 'supervisors' && effectiveRole === 'supervisor') {
            count++;
          }
        }
      });
      setUnreadMsgCount(count);
    });

    return () => unsub();
  }, [schoolId, myNid, effectiveRole, myClass, currentUser, userData]);

  const [unreadDirectivesCount, setUnreadDirectivesCount] = useState(0);

  // Listen to incoming directives and resource decisions for Admin/SuperAdmin
  useEffect(() => {
    if (effectiveRole !== 'admin' && effectiveRole !== 'superadmin') {
      setUnreadDirectivesCount(0);
      return;
    }

    let dCount = 0;
    let tCount = 0;

    const recalc = () => {
      setUnreadDirectivesCount(dCount + tCount);
    };

    const unsubD = onSnapshot(collection(db, 'resource_directives'), (snap) => {
      dCount = 0;
      snap.forEach(d => {
        const data = d.data();
        if (!data.archived && effectiveRole === 'admin' && data.status !== 'acknowledged') {
          dCount++;
        }
      });
      recalc();
    }, (err) => console.warn(err));

    const unsubT = onSnapshot(collection(db, 'resource_transfer_requests'), (tSnap) => {
      tCount = 0;
      tSnap.forEach(td => {
        const tData = td.data();
        if (!tData.archived) {
          if (effectiveRole === 'admin' && (tData.status === 'approved' || tData.isDirective)) {
            if (tData.status !== 'acknowledged') tCount++;
          } else if (effectiveRole === 'superadmin' && tData.status === 'pending') {
            tCount++;
          }
        }
      });
      recalc();
    }, (err) => console.warn(err));

    // Instant broadcast subscription
    const unsubBroadcast = subscribeRealtimeEvents((event) => {
      if (event?.type === 'DIRECTIVE_UPDATE' || event?.type === 'RESOURCE_UPDATE') {
        if (effectiveRole === 'admin') {
          setUnreadDirectivesCount(prev => prev + 1);
        }
      }
    });

    return () => {
      unsubD();
      unsubT();
      unsubBroadcast();
    };
  }, [effectiveRole]);

  // --- Student & Parent Task Center in Notification Bell ---
  const [resolvedStudentClass, setResolvedStudentClass] = useState(
    effectiveRole === 'parent' ? (userData?.studentClass || '') : (userData?.class || userData?.className || '')
  );

  useEffect(() => {
    if (effectiveRole === 'parent') {
      setResolvedStudentClass(userData?.studentClass || '');
      return;
    }
    if (userData?.class || userData?.className) {
      setResolvedStudentClass(userData.class || userData.className);
      return;
    }
    const nid = (userData?.nationalId || currentUser?.email?.replace('@school.local', '') || '').trim();
    if (!nid && !currentUser?.email) return;

    const q = nid
      ? query(collection(db, 'students'), where('nationalId', '==', nid))
      : query(collection(db, 'students'), where('email', '==', currentUser.email));

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(d => d.data());
        const validDoc = docs.find(d => (d.class || d.className)?.trim()) || docs[0];
        setResolvedStudentClass(validDoc?.class || validDoc?.className || '');
      }
    });
    return () => unsub();
  }, [effectiveRole, userData, currentUser]);

  const [studentWorksheetsList, setStudentWorksheetsList] = useState([]);
  const [studentAssignmentsList, setStudentAssignmentsList] = useState([]);
  const [studentExamsList, setStudentExamsList] = useState([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState({});
  const [examSubmissions, setExamSubmissions] = useState({});

  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [bellFilter, setBellFilter] = useState('all'); // 'all' | 'worksheets' | 'assignments' | 'exams' | 'messages'
  const bellContainerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellContainerRef.current && !bellContainerRef.current.contains(e.target)) {
        setShowBellDropdown(false);
      }
    };
    if (showBellDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBellDropdown]);

  // Real-time task listener for Student and Parent
  useEffect(() => {
    if (effectiveRole !== 'student' && effectiveRole !== 'parent') return;

    const targetClass = resolvedStudentClass?.trim();
    const effectiveSchoolId = userData?.schoolId || 'default_school_1';
    const targetNid = (effectiveRole === 'parent' ? (userData?.studentNationalId || '') : (userData?.nationalId || currentUser?.email?.replace('@school.local', '') || '')).trim();

    // 1. Published Worksheets
    const qWorksheets = query(
      collection(db, 'worksheets'),
      where('status', '==', 'published')
    );

    const unsubWs = onSnapshot(qWorksheets, (snapshot) => {
      const list = [];
      snapshot.forEach(d => {
        const ws = { id: d.id, ...d.data() };
        if (isClassOrStageMatch(targetClass, ws.className, ws.stage, ws.schoolId, effectiveSchoolId, ws.lessonTitle)) {
          list.push(ws);
        }
      });
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      setStudentWorksheetsList(list);
    }, (err) => console.warn('Error fetching worksheets for header:', err));

    // 2. Published Assignments
    const qAssignments = effectiveSchoolId === 'ALL'
      ? collection(db, 'assignments')
      : query(collection(db, 'assignments'), where('schoolId', '==', effectiveSchoolId));

    const unsubAssign = onSnapshot(qAssignments, (snapshot) => {
      const list = [];
      snapshot.forEach(d => {
        const a = { id: d.id, ...d.data() };
        if (isClassOrStageMatch(targetClass, a.targetClass || a.className || a.class, '', a.schoolId, effectiveSchoolId, a.title)) {
          list.push(a);
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setStudentAssignmentsList(list);
    }, (err) => console.warn('Error fetching assignments for header:', err));

    // 3. Published Exams
    const qExams = effectiveSchoolId === 'ALL'
      ? collection(db, 'exams')
      : query(collection(db, 'exams'), where('schoolId', '==', effectiveSchoolId));

    const unsubExams = onSnapshot(qExams, (snapshot) => {
      const list = [];
      snapshot.forEach(d => {
        const ex = { id: d.id, ...d.data() };
        if (isClassOrStageMatch(targetClass, ex.targetClass || ex.className || ex.class, '', ex.schoolId, effectiveSchoolId, ex.title)) {
          list.push(ex);
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setStudentExamsList(list);
    }, (err) => console.warn('Error fetching exams for header:', err));

    // 4. Submissions tracking
    const qSubmissions = query(collection(db, 'assignment_results'));
    const unsubSub = onSnapshot(qSubmissions, (snapshot) => {
      const map = {};
      snapshot.forEach(d => {
        const sub = d.data();
        if (sub.nationalId === targetNid || sub.studentId === targetNid || (currentUser?.uid && sub.studentId === currentUser.uid)) {
          map[sub.assignmentId] = true;
        }
      });
      setAssignmentSubmissions(map);
    });

    const qExamResults = query(collection(db, 'exam_results'));
    const unsubExResults = onSnapshot(qExamResults, (snapshot) => {
      const map = {};
      snapshot.forEach(d => {
        const sub = d.data();
        if (sub.nationalId === targetNid || sub.studentId === targetNid || (currentUser?.uid && sub.studentId === currentUser.uid)) {
          map[sub.examId] = true;
        }
      });
      setExamSubmissions(map);
    });

    return () => {
      unsubWs();
      unsubAssign();
      unsubExams();
      unsubSub();
      unsubExResults();
    };
  }, [effectiveRole, resolvedStudentClass, userData, currentUser]);

  // Unified Aggregated Tasks for Bell Center
  const aggregatedTasks = useMemo(() => {
    const list = [];

    if (effectiveRole === 'student' || effectiveRole === 'parent') {
      // 1. Worksheets
      studentWorksheetsList.forEach(ws => {
        list.push({
          id: `ws_${ws.id}`,
          rawId: ws.id,
          type: 'worksheet',
          category: 'أوراق العمل',
          title: ws.lessonTitle || ws.title || 'ورقة عمل تفاعلية',
          subject: ws.subject || 'المادة الدراسية',
          meta: `${ws.questions?.length || 0} أسئلة • ${ws.totalMarks || 10} درجات`,
          badge: effectiveRole === 'parent' ? 'ورقة عمل للابن' : 'ورقة عمل معتمدة',
          color: '#9333ea',
          bgLight: '#faf5ff',
          border: '#e9d5ff',
          date: ws.updatedAt || ws.createdAt,
          actionLabel: effectiveRole === 'parent' ? 'معاينة ورقة العمل 👁️' : 'حل وتفاعل الآن ⚡',
          actionUrl: effectiveRole === 'parent' ? `/parent/worksheets?open=${ws.id}` : `/student/worksheets?open=${ws.id}`
        });
      });

      // 2. Pending Assignments (not yet submitted)
      studentAssignmentsList.forEach(assign => {
        const isDone = !!assignmentSubmissions[assign.id];
        if (!isDone) {
          list.push({
            id: `assign_${assign.id}`,
            rawId: assign.id,
            type: 'assignment',
            category: 'الواجبات',
            title: assign.title || 'واجب مدرسي إلكتروني',
            subject: assign.subject || 'المادة الدراسية',
            meta: assign.dueDate ? `موعد التسليم: ${assign.dueDate}` : 'واجب مستحق للحل',
            badge: 'واجب مطلوب',
            color: '#0284c7',
            bgLight: '#f0f9ff',
            border: '#bae6fd',
            date: assign.createdAt,
            actionLabel: effectiveRole === 'parent' ? 'متابعة الواجب 📝' : 'بدء حل الواجب 📝',
            actionUrl: effectiveRole === 'parent' ? '/parent/assignments' : '/student/assignments'
          });
        }
      });

      // 3. Pending Exams (not yet taken)
      studentExamsList.forEach(exam => {
        const isDone = !!examSubmissions[exam.id];
        if (!isDone) {
          list.push({
            id: `exam_${exam.id}`,
            rawId: exam.id,
            type: 'exam',
            category: 'الاختبارات',
            title: exam.title || 'اختبار مدرسي إلكتروني',
            subject: exam.subject || 'المادة الدراسية',
            meta: exam.examDate ? `التاريخ: ${exam.examDate}` : 'اختبار متاح',
            badge: 'اختبار متاح',
            color: '#0d9488',
            bgLight: '#f0fdfa',
            border: '#99f6e4',
            date: exam.createdAt,
            actionLabel: effectiveRole === 'parent' ? 'تقرير الاختبارات 📊' : 'دخول الاختبار 🎯',
            actionUrl: effectiveRole === 'parent' ? '/parent/exams' : '/student/exams'
          });
        }
      });

      // 4. Circulars & Messages
      if (unreadMsgCount > 0) {
        list.push({
          id: 'msg_summary',
          type: 'message',
          category: 'التعاميم',
          title: `يوجد لديك (${unreadMsgCount}) رسائل أو تعاميم مدرسية جديدة`,
          subject: 'التواصل والتعاميم',
          meta: 'انقر للاطلاع على المراسلات والتعاميم الرسمية',
          badge: 'تعميم جديد',
          color: '#ea580c',
          bgLight: '#fff7ed',
          border: '#fed7aa',
          actionLabel: 'فتح الرسائل والتعاميم 📬',
          actionUrl: `/${effectiveRole}/messages`
        });
      }
    } else {
      // For Admin, SuperAdmin, Teacher, Staff, Supervisor
      if (unreadDirectivesCount > 0) {
        list.push({
          id: 'directives_summary',
          type: 'directive',
          category: 'التوجيهات والقرارات',
          title: `يوجد (${unreadDirectivesCount}) توجيهات وقرارات بانتظار المراجعة والإجراء`,
          subject: 'إدارة الموارد والتوجيهات',
          meta: 'قرارات الماستر العام وتنقلات الكوادر المعتمدة',
          badge: 'قرار إداري',
          color: '#ea580c',
          bgLight: '#fff7ed',
          border: '#fed7aa',
          actionLabel: 'مراجعة القرارات 📋',
          actionUrl: `/${effectiveRole}/resources`
        });
      }
      if (unreadMsgCount > 0) {
        list.push({
          id: 'msg_summary_admin',
          type: 'message',
          category: 'التعاميم',
          title: `يوجد (${unreadMsgCount}) رسائل وتعاميم جديدة غير مقروءة`,
          subject: 'المراسلات والتعاميم',
          meta: 'انقر لفتح صندوق المراسلات',
          badge: 'رسائل جديدة',
          color: '#0284c7',
          bgLight: '#f0f9ff',
          border: '#bae6fd',
          actionLabel: 'فتح صندوق المراسلات 📬',
          actionUrl: `/${effectiveRole}/messages`
        });
      }
    }

    return list;
  }, [
    effectiveRole, 
    studentWorksheetsList, 
    studentAssignmentsList, 
    studentExamsList, 
    assignmentSubmissions, 
    examSubmissions, 
    unreadMsgCount, 
    unreadDirectivesCount
  ]);

  const totalTasksCount = aggregatedTasks.length;

  const filteredTasks = useMemo(() => {
    if (bellFilter === 'all') return aggregatedTasks;
    if (bellFilter === 'worksheets') return aggregatedTasks.filter(t => t.type === 'worksheet');
    if (bellFilter === 'assignments') return aggregatedTasks.filter(t => t.type === 'assignment');
    if (bellFilter === 'exams') return aggregatedTasks.filter(t => t.type === 'exam');
    if (bellFilter === 'messages') return aggregatedTasks.filter(t => t.type === 'message' || t.type === 'directive');
    return aggregatedTasks;
  }, [aggregatedTasks, bellFilter]);

  const activeSchoolName = schoolMeta?.name || userData?.schoolName || '';
  const activeSubTitle = schoolMeta?.subTitle || userData?.schoolSubTitle || '';

  const displayRole = effectiveRole === 'superadmin' ? 'الماستر العام' : 
                      effectiveRole === 'admin' ? (activeSchoolName ? `مدير • ${activeSchoolName}` : 'مدير') : 
                      effectiveRole === 'staff' ? (activeSchoolName ? `${userData?.roleTitle || 'كادر مدرسي'} • ${activeSchoolName}` : (userData?.roleTitle || 'كادر مدرسي')) :
                      effectiveRole === 'supervisor' ? (activeSchoolName ? `مشرف تعليمي${supervisorSpecialty ? ` (${supervisorSpecialty})` : ''} • ${activeSchoolName}` : `مشرف تعليمي${supervisorSpecialty ? ` (${supervisorSpecialty})` : ''}`) :
                      effectiveRole === 'teacher' ? (extraDetail ? `معلم • ${extraDetail}` : 'معلم') : 
                      effectiveRole === 'parent' ? (userData?.studentName ? `ولي أمر • الطالب: ${userData.studentName}` : 'ولي أمر') : 
                      (extraDetail ? `طالب • ${extraDetail}` : 'طالب');

  const displayName = userData?.name || 
                      currentUser?.displayName || 
                      (effectiveRole === 'superadmin' ? 'الماستر العام' : 
                       effectiveRole === 'admin' ? (userData?.schoolName ? `مدير ${userData.schoolName}` : 'مدير المدرسة') : 
                       effectiveRole === 'staff' ? (userData?.roleTitle || 'كادر مدرسي') :
                       effectiveRole === 'supervisor' ? 'مشرف تعليمي' :
                       effectiveRole === 'teacher' ? 'معلم' :
                       effectiveRole === 'parent' ? 'ولي أمر' :
                       effectiveRole === 'student' ? 'طالب' :
                       currentUser?.email?.split('@')[0]) || 
                      t('header.user');

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

        {/* Modern Multi-Language Switcher (AR / EN / ZH) */}
        <LanguageSwitcher variant="header" />

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

        {/* Task Center Notification Bell with Dropdown Popover */}
        <div ref={bellContainerRef} style={{ position: 'relative' }}>
          <button 
            className="btn" 
            onClick={() => setShowBellDropdown(prev => !prev)}
            style={{ 
              background: showBellDropdown ? 'rgba(14, 116, 144, 0.12)' : 'transparent', 
              padding: '8px', 
              position: 'relative', 
              cursor: 'pointer',
              borderRadius: '10px',
              border: showBellDropdown ? '1px solid rgba(14, 116, 144, 0.25)' : '1px solid transparent',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={totalTasksCount > 0 ? `مركز المهام والتنبيهات: لديك (${totalTasksCount}) مهام بانتظار الإجراء` : 'مركز المهام والتنبيهات'}
          >
            <Bell size={20} color={totalTasksCount > 0 ? '#ea580c' : 'var(--color-text-muted)'} />
            {totalTasksCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                background: '#ea580c',
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
                border: '2px solid white',
                boxShadow: '0 0 8px rgba(234, 88, 12, 0.6)'
              }}>
                {totalTasksCount}
              </span>
            )}
          </button>

          {/* Luxury Floating Dropdown Popover */}
          {showBellDropdown && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '380px',
              maxWidth: '90vw',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #0e7490 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '15px' }}>
                    <Bell size={18} color="#facc15" />
                    <span>مركز المهام والتنبيهات</span>
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
                    {effectiveRole === 'student' ? 'مهامك الدراسية المطلوبة وأوراق العمل' : 
                     effectiveRole === 'parent' ? (userData?.studentName ? `مهام ومتابعة الابن: ${userData.studentName}` : 'مهام ومتابعة الأبناء') : 
                     'التوجيهات والقرارات والإشعارات'}
                  </div>
                </div>

                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backdropFilter: 'blur(4px)'
                }}>
                  {totalTasksCount} مهام
                </span>
              </div>

              {/* Filter Tabs if multiple tasks */}
              {aggregatedTasks.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  overflowX: 'auto',
                  scrollbarWidth: 'none'
                }}>
                  {[
                    { id: 'all', label: `الكل (${aggregatedTasks.length})` },
                    ...(studentWorksheetsList.length > 0 ? [{ id: 'worksheets', label: `أوراق عمل (${studentWorksheetsList.length})` }] : []),
                    ...(studentAssignmentsList.length > 0 ? [{ id: 'assignments', label: `واجبات` }] : []),
                    ...(studentExamsList.length > 0 ? [{ id: 'exams', label: `اختبارات` }] : []),
                    ...(unreadMsgCount > 0 ? [{ id: 'messages', label: `تعاميم (${unreadMsgCount})` }] : [])
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setBellFilter(tab.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        background: bellFilter === tab.id ? '#0e7490' : '#ffffff',
                        color: bellFilter === tab.id ? '#ffffff' : '#64748b',
                        boxShadow: bellFilter === tab.id ? '0 2px 4px rgba(14, 116, 144, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Tasks List */}
              <div style={{
                maxHeight: '340px',
                overflowY: 'auto',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {filteredTasks.length === 0 ? (
                  <div style={{
                    padding: '30px 16px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckCircle2 size={28} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>
                        لا توجد مهام معلقة لديك حالياً 🎉
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        جميع أوراق العمل والواجبات والاختبارات تم إنجازها بنجاح!
                      </div>
                    </div>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setShowBellDropdown(false);
                        if (task.actionUrl) {
                          navigate(task.actionUrl);
                        }
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: task.bgLight || '#ffffff',
                        border: `1px solid ${task.border || '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: task.color,
                          background: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${task.border}`
                        }}>
                          {task.badge}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          {task.subject}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0f172a',
                        lineHeight: '1.3'
                      }}>
                        {task.title}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {task.meta}
                        </span>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: task.color,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>{task.actionLabel}</span>
                          <ChevronLeft size={13} />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px'
              }}>
                <span style={{ color: '#64748b' }}>
                  {effectiveRole === 'student' ? 'لوحة الطالب التفاعلية' : 'لوحة المتابعة'}
                </span>
                <button
                  onClick={() => {
                    setShowBellDropdown(false);
                    if (effectiveRole === 'student') navigate('/student/worksheets');
                    else if (effectiveRole === 'parent') navigate('/parent/worksheets');
                    else navigate(`/${effectiveRole}/resources`);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#0e7490',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>عرض الكل</span>
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
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
            <span className="user-role" style={{ color: '#0e7490', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              <span>{displayRole}</span>
              {activeSubTitle && effectiveRole !== 'superadmin' && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#0369a1',
                  background: 'rgba(14, 116, 144, 0.08)',
                  border: '1px solid rgba(14, 116, 144, 0.2)',
                  padding: '1px 7px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Building2 size={11} />
                  {activeSubTitle}
                </span>
              )}
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
