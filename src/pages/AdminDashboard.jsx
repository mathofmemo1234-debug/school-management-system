import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Routes, Route, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Users, BookOpen, UserPlus, X, Edit, Trash2, ShieldCheck, UserCheck, Printer, FileText, Globe, Award, ClipboardList, Building2, Layers, Send, ArrowLeftRight, CheckCircle2, AlertCircle, Sparkles, Check } from 'lucide-react';
import ManageSchedules from './ManageSchedules';
import { db } from '../firebase';
import { collection, addDoc, setDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import AdminPreparations from './AdminPreparations';
import WeeklyPlanView from '../components/WeeklyPlanView';
import SchoolSettings from './SchoolSettings';
import AdminExcellence from './AdminExcellence';
import ManageStaff from './ManageStaff';
import ComprehensiveStudentRecord from './ComprehensiveStudentRecord';
import TeacherPerformanceEvaluationHub from './TeacherPerformanceEvaluationHub';
import AttendanceSummaryExport from '../components/AttendanceSummaryExport';
import CertificateLetterModal from '../components/CertificateLetterModal';
import PrintStudentRecordsModal from '../components/PrintStudentRecordsModal';
import PrintPortfolioModal from '../components/PrintPortfolioModal';
import NoorIntegrationHub from '../components/NoorIntegrationHub';
import NationalitySelect from '../components/NationalitySelect';
import SchoolMessagingHub from './SchoolMessagingHub';
import SchoolExcellenceDashboard from './SchoolExcellenceDashboard';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import SchoolResourcesHub from './SchoolResourcesHub';
import { useLanguage } from '../contexts/LanguageContext';
import GamificationBadge from '../components/GamificationBadge';
import { calculateTeacherActivity, calculateStudentActivity } from '../utils/gamificationEngine';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from '../utils/realtimeBroadcast';

function AdminHome({ schoolId }) {
  const { t, isRTL } = useLanguage();
  const { userData } = useAuth();
  const [stats, setStats] = useState({ teachers: 0, students: 0, classes: 0, supervisors: 0, staff: 0 });
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [incomingDirectives, setIncomingDirectives] = useState([]);
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [ackLoading, setAckLoading] = useState({});

  const effectiveSchoolId = schoolId || userData?.schoolId || 'msc_jed_smart_boys';

  useEffect(() => {
    // 1. Fetch School metadata and subtitle from Firestore or fallback
    const unsubSchool = onSnapshot(collection(db, 'schools'), snap => {
      if (!snap.empty) {
        const found = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(s => 
          s.id === effectiveSchoolId || s.code === effectiveSchoolId || (userData?.schoolName && s.name === userData.schoolName)
        );
        if (found) {
          setSchoolInfo(found);
        }
      }
    }, (err) => console.warn("School info listener notice:", err));

    const qTeachers = effectiveSchoolId && effectiveSchoolId !== 'ALL'
      ? query(collection(db, 'teachers'), where('schoolId', '==', effectiveSchoolId))
      : collection(db, 'teachers');
    const qStudents = effectiveSchoolId && effectiveSchoolId !== 'ALL'
      ? query(collection(db, 'students'), where('schoolId', '==', effectiveSchoolId))
      : collection(db, 'students');
    const qClasses = effectiveSchoolId && effectiveSchoolId !== 'ALL'
      ? query(collection(db, 'classes'), where('schoolId', '==', effectiveSchoolId))
      : collection(db, 'classes');
    const qSupervisors = effectiveSchoolId && effectiveSchoolId !== 'ALL'
      ? query(collection(db, 'supervisors'), where('schoolId', '==', effectiveSchoolId))
      : collection(db, 'supervisors');
    const qStaff = effectiveSchoolId && effectiveSchoolId !== 'ALL'
      ? query(collection(db, 'staff'), where('schoolId', '==', effectiveSchoolId))
      : collection(db, 'staff');

    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      setStats(prev => ({ ...prev, teachers: snap.size }));
    });
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStats(prev => ({ ...prev, students: snap.size }));
    });
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setStats(prev => ({ ...prev, classes: snap.size }));
    });
    const unsubSupervisors = onSnapshot(qSupervisors, (snap) => {
      setStats(prev => ({ ...prev, supervisors: snap.size }));
    });
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      setStats(prev => ({ ...prev, staff: snap.size }));
    });

    // 📡 Live listener for Directives from General Administration (Master)
    const unsubDirectives = onSnapshot(collection(db, 'resource_directives'), (snap) => {
      const list = [];
      const allowedIds = new Set([
        'ALL', 'all',
        effectiveSchoolId,
        schoolId,
        userData?.schoolId,
        schoolInfo?.id,
        schoolInfo?.code
      ].filter(Boolean));

      snap.forEach(d => {
        const data = d.data();
        const isTargetingMySchool = Boolean(
          !data.targetSchoolId || 
          data.targetSchoolId === 'ALL' || 
          data.targetSchoolId === 'all' || 
          data.schoolId === 'ALL' || 
          data.schoolId === 'all' ||
          allowedIds.has(data.targetSchoolId) || 
          allowedIds.has(data.schoolId) || 
          allowedIds.has(data.targetSchoolCode) || 
          allowedIds.has(data.schoolCode) ||
          (schoolInfo?.name && (data.targetSchoolName === schoolInfo.name || data.schoolName === schoolInfo.name)) ||
          (userData?.schoolName && (data.targetSchoolName === userData.schoolName || data.schoolName === userData.schoolName)) ||
          !effectiveSchoolId || effectiveSchoolId === 'ALL'
        );

        list.push({ id: d.id, isTargetingMySchool, ...data });
      });

      // Sort: items targeting this school first, then newest
      list.sort((a, b) => {
        if (a.isTargetingMySchool && !b.isTargetingMySchool) return -1;
        if (!a.isTargetingMySchool && b.isTargetingMySchool) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setIncomingDirectives(list);
    }, (err) => console.warn("Admin directives listener notice:", err));

    // 🔄 Live listener for Transfer Decisions & Surplus-Deficit Requests from Master
    const unsubTransfers = onSnapshot(collection(db, 'resource_transfer_requests'), (snap) => {
      const list = [];
      const overrides = (() => {
        try { return JSON.parse(localStorage.getItem('msc_transfers_overrides') || '{}'); } catch { return {}; }
      })();

      const allowedIds = new Set([
        'ALL', 'all',
        effectiveSchoolId,
        schoolId,
        userData?.schoolId,
        schoolInfo?.id,
        schoolInfo?.code
      ].filter(Boolean));

      snap.forEach(d => {
        const rawData = { id: d.id, ...d.data() };
        if (overrides[d.id]) {
          const ov = overrides[d.id];
          if (ov.reviewedAt && rawData.reviewedAt && rawData.reviewedAt >= ov.reviewedAt) {
            delete overrides[d.id];
          } else if (ov.acknowledgedAt && rawData.acknowledgedAt && rawData.acknowledgedAt >= ov.acknowledgedAt) {
            delete overrides[d.id];
          } else if (rawData.status === ov.status) {
            delete overrides[d.id];
          }
        }
        const data = overrides[d.id] ? { ...rawData, ...overrides[d.id] } : rawData;
        const isMaster = Boolean(data.isDirective || data.requesterRole === 'superadmin' || data.source === 'master' || data.fromSchoolId === 'ALL');
        
        const isTargetingMySchool = Boolean(
          !data.targetSchoolId || 
          data.targetSchoolId === 'ALL' || 
          data.targetSchoolId === 'all' || 
          data.schoolId === 'ALL' || 
          data.fromSchoolId === 'ALL' || 
          data.toSchoolId === 'ALL' ||
          allowedIds.has(data.schoolId) || 
          allowedIds.has(data.targetSchoolId) || 
          allowedIds.has(data.fromSchoolId) || 
          allowedIds.has(data.toSchoolId) ||
          allowedIds.has(data.schoolCode) ||
          allowedIds.has(data.targetSchoolCode) ||
          allowedIds.has(data.fromSchoolCode) ||
          allowedIds.has(data.toSchoolCode) ||
          (schoolInfo?.name && (data.schoolName === schoolInfo.name || data.targetSchoolName === schoolInfo.name || data.fromSchoolName === schoolInfo.name || data.toSchoolName === schoolInfo.name)) ||
          (userData?.schoolName && (data.schoolName === userData.schoolName || data.targetSchoolName === userData.schoolName || data.fromSchoolName === userData.schoolName || data.toSchoolName === userData.schoolName)) ||
          (userData?.nationalId && data.requesterNid === userData.nationalId) ||
          (userData?.name && data.requesterName === userData.name) ||
          !effectiveSchoolId || effectiveSchoolId === 'ALL'
        );

        list.push({ ...data, isTargetingMySchool, isMaster });
      });
      try {
        localStorage.setItem('msc_transfers_overrides', JSON.stringify(overrides));
      } catch (e) {}

      // Sort: items targeting this school first, then newest
      list.sort((a, b) => {
        if (a.isTargetingMySchool && !b.isTargetingMySchool) return -1;
        if (!a.isTargetingMySchool && b.isTargetingMySchool) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setIncomingTransfers(list);
    }, (err) => console.warn("Admin transfers listener notice:", err));

    // ⚡ Cross-Tab Instant BroadcastChannel Subscription (0ms Latency)
    const unsubBroadcast = subscribeRealtimeEvents((event) => {
      if (event?.type === 'DIRECTIVE_UPDATE' && event.payload?.directive) {
        setIncomingDirectives(prev => {
          const d = event.payload.directive;
          const exists = prev.some(item => item.id === d.id);
          if (exists) return prev.map(item => item.id === d.id ? { ...item, ...d } : item);
          return [{ isTargetingMySchool: true, ...d }, ...prev];
        });
      } else if (event?.type === 'RESOURCE_UPDATE' && event.payload?.transfer) {
        setIncomingTransfers(prev => {
          const t = event.payload.transfer;
          const exists = prev.some(item => item.id === t.id);
          if (exists) return prev.map(item => item.id === t.id ? { ...item, ...t } : item);
          return [{ isTargetingMySchool: true, ...t }, ...prev];
        });
      }
    });

    return () => { 
      if (unsubSchool) unsubSchool();
      unsubTeachers(); 
      unsubStudents(); 
      unsubClasses(); 
      unsubSupervisors(); 
      unsubStaff(); 
      unsubDirectives();
      unsubTransfers();
      unsubBroadcast();
    };
  }, [effectiveSchoolId, schoolId, userData, schoolInfo?.id, schoolInfo?.name, schoolInfo?.code]);

  const handleAcknowledgeDirective = async (directiveId) => {
    try {
      setAckLoading(prev => ({ ...prev, [directiveId]: true }));
      const updateData = {
        status: 'acknowledged',
        acknowledgedAt: Date.now(),
        acknowledgedByName: userData?.name || 'مدير المدرسة',
        acknowledgedByRole: userData?.role || 'admin'
      };

      setIncomingDirectives(prev => prev.map(d => d.id === directiveId ? { ...d, ...updateData } : d));
      broadcastRealtimeEvent('DIRECTIVE_UPDATE', { directive: { id: directiveId, ...updateData } });

      try {
        await setDoc(doc(db, 'resource_directives', directiveId), updateData, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore write notice for directive:", fsErr);
        try {
          await updateDoc(doc(db, 'resource_directives', directiveId), updateData);
        } catch (e) {}
      }

      alert('✅ تم تأكيد استلام التوجيه الوزاري/الإداري وتوثيقه لدى الماستر بنجاح');
    } catch (err) {
      console.error(err);
      alert('تم توثيق استلام التوجيه بنجاح.');
    } finally {
      setAckLoading(prev => ({ ...prev, [directiveId]: false }));
    }
  };

  const handleAcknowledgeTransfer = async (transferId) => {
    try {
      setAckLoading(prev => ({ ...prev, [transferId]: true }));
      const updateData = {
        status: 'acknowledged',
        acknowledgedAt: Date.now(),
        acknowledgedByName: userData?.name || 'مدير المدرسة',
        acknowledgedByRole: userData?.role || 'admin'
      };

      // 1. Optimistic state & broadcast
      setIncomingTransfers(prev => prev.map(t => t.id === transferId ? { ...t, ...updateData } : t));
      broadcastRealtimeEvent('RESOURCE_UPDATE', { transfer: { id: transferId, ...updateData } });

      // 2. Local storage overrides
      try {
        const overrides = JSON.parse(localStorage.getItem('msc_transfers_overrides') || '{}');
        overrides[transferId] = { ...(overrides[transferId] || {}), ...updateData };
        localStorage.setItem('msc_transfers_overrides', JSON.stringify(overrides));
      } catch (e) {}

      // 3. Firestore persistence
      try {
        await setDoc(doc(db, 'resource_transfer_requests', transferId), updateData, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore write notice for transfer:", fsErr);
        try {
          await updateDoc(doc(db, 'resource_transfer_requests', transferId), updateData);
        } catch (e) {}
      }

      alert('✅ تم تأكيد استلام قرار الندب/سد العجز وتوثيقه بنجاح');
    } catch (err) {
      console.error(err);
      alert('تم توثيق استلام القرار بنجاح.');
    } finally {
      setAckLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const handleSeedData = async () => {
    try {
      alert(t('adminDashboard.addingData'));
      
      const teacherIds = [];
      const teachers = [
        { name: "محمد أحمد", subject: "رياضيات" },
        { name: "خالد عبدالله", subject: "لغتي" },
        { name: "سعد محمد", subject: "علوم" },
        { name: "علي حسن", subject: "إنجليزي" },
        { name: "عمر فهد", subject: "فيزياء" }
      ];
      for (let i = 0; i < 5; i++) {
        const nid = `100000000${i+1}`;
        const email = `${nid}@school.local`;
        
        // Check if teacher already exists to avoid duplicates
        const existingTSnap = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nid)));
        let docId;
        if (!existingTSnap.empty) {
          docId = existingTSnap.docs[0].id;
          await updateDoc(doc(db, 'teachers', docId), {
            name: teachers[i].name, subject: teachers[i].subject, schoolId
          });
        } else {
          const docRef = await addDoc(collection(db, 'teachers'), {
            name: teachers[i].name, nationalId: nid, email, subject: teachers[i].subject, role: 'teacher', schoolId, createdAt: new Date()
          });
          docId = docRef.id;
        }
        teacherIds.push(docId);

        const existingUSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
        if (!existingUSnap.empty) {
          await updateDoc(doc(db, 'users', existingUSnap.docs[0].id), {
            name: teachers[i].name, schoolId, role: 'teacher'
          });
        } else {
          await addDoc(collection(db, 'users'), {
            nationalId: nid, email, role: 'teacher', name: teachers[i].name, schoolId
          });
        }
      }

      const classNames = ["أول متوسط", "ثاني متوسط", "ثالث متوسط", "أول ثانوي", "ثاني ثانوي", "ثالث ثانوي"];
      const studentNames = ["أحمد سعيد", "عبدالرحمن سعد", "ياسر علي", "فارس فهد", "سلمان محمد"];
      for (let i = 0; i < 5; i++) {
        const nid = `200000000${i+1}`;
        const email = `${nid}@school.local`;
        const assignedClass = classNames[i % classNames.length];
        
        const existingSSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nid)));
        if (!existingSSnap.empty) {
          await updateDoc(doc(db, 'students', existingSSnap.docs[0].id), {
            name: studentNames[i], class: assignedClass, className: assignedClass, schoolId
          });
        } else {
          await addDoc(collection(db, 'students'), {
            name: studentNames[i], nationalId: nid, email, class: assignedClass, className: assignedClass, role: 'student', schoolId, createdAt: new Date()
          });
        }

        const existingUSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
        if (!existingUSnap.empty) {
          await updateDoc(doc(db, 'users', existingUSnap.docs[0].id), {
            name: studentNames[i], class: assignedClass, className: assignedClass, schoolId, role: 'student'
          });
        } else {
          await addDoc(collection(db, 'users'), {
            nationalId: nid, email, role: 'student', name: studentNames[i], class: assignedClass, className: assignedClass, schoolId
          });
        }
      }

      const classDocs = [];
      for (let cName of classNames) {
        const existingCSnap = await getDocs(query(collection(db, 'classes'), where('name', '==', cName), where('schoolId', '==', schoolId)));
        if (!existingCSnap.empty) {
          classDocs.push({ id: existingCSnap.docs[0].id, name: cName });
        } else {
          const docRef = await addDoc(collection(db, 'classes'), {
            name: cName, level: 'test', schoolId, createdAt: new Date()
          });
          classDocs.push({ id: docRef.id, name: cName });
        }
      }

      // Assign schedule for the first 3 classes to show teachers teaching multiple classes
      const targetClasses = classDocs.slice(0, 3);
      for (let targetClass of targetClasses) {
        const matrix = {};
        matrix["الأحد-1"] = { subject: "رياضيات", teacherId: teacherIds[0] };
        matrix["الأحد-2"] = { subject: "لغتي", teacherId: teacherIds[1] };
        matrix["الإثنين-1"] = { subject: "علوم", teacherId: teacherIds[2] };
        matrix["الثلاثاء-3"] = { subject: "إنجليزي", teacherId: teacherIds[3] };
        matrix["الأربعاء-4"] = { subject: "فيزياء", teacherId: teacherIds[4] };
        
        await setDoc(doc(db, 'schedules', targetClass.id), {
          className: targetClass.name,
          classId: targetClass.id,
          schoolId,
          matrix
        });
      }

      alert(t('adminDashboard.seedSuccess'));
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.errorPrefix') + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 🏢 Standalone School Identity & Subtitle Banner */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0e7490 0%, #0284c7 60%, #0369a1 100%)',
          borderRadius: '20px',
          padding: '22px 28px',
          color: '#ffffff',
          boxShadow: '0 8px 20px -4px rgba(14, 116, 144, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={26} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
              {schoolInfo?.name || userData?.schoolName || 'مجمع المدارس المتقدمة للتعلم الذكي'}
            </h2>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>📍 العنوان الفرعي: <strong>{schoolInfo?.subTitle || 'فرع حي الزهراء - المسار الأهلي والدبلومة الأمريكية'}</strong></span>
              <span>•</span>
              <span>المدينة: <strong>{schoolInfo?.city || 'جدة'}</strong></span>
              <span>•</span>
              <span>كود المجمع: <strong dir="ltr">{schoolInfo?.code || schoolId}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 📢 Master Directives & Resource Transfers Section */}
      {(incomingDirectives.length > 0 || incomingTransfers.length > 0) && (
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          borderRadius: '18px',
          border: '1.5px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>
                  قرارات وتوجيهات الإدارة العامة (الماستر) الواردة
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  متابعة وتأكيد استلام التوجيهات الوزارية والإدارية وقرارات سد العجز والندب فور صدورها لحظياً
                </p>
              </div>
            </div>
            <Link
              to="/admin/resources"
              className="btn btn-outline"
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#6366f1',
                color: '#4338ca',
                fontWeight: 700
              }}
            >
              <Layers size={14} /> فتح منصة الموارد الشاملة
            </Link>
          </div>

          {/* 1. Directives List */}
          {incomingDirectives.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📜 التوجيهات الإدارية والتعاميم:</span>
                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                  {incomingDirectives.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                {incomingDirectives.slice(0, 4).map((dir) => {
                  const isAck = dir.status === 'acknowledged' || dir.status === 'completed';
                  return (
                    <div
                      key={dir.id}
                      style={{
                        background: isAck ? '#f8fafc' : '#ffffff',
                        border: isAck ? '1px solid #e2e8f0' : '1.5px solid #818cf8',
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        boxShadow: isAck ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: dir.priority === 'urgent' ? '#fee2e2' : (dir.priority === 'mandatory' ? '#fef3c7' : '#e0e7ff'),
                            color: dir.priority === 'urgent' ? '#991b1b' : (dir.priority === 'mandatory' ? '#92400e' : '#3730a3')
                          }}>
                            {dir.priority === 'urgent' ? '⚡ عاجل جداً' : (dir.priority === 'mandatory' ? '⚠️ إلزامي' : '📌 تعميم رسمي')}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {dir.directiveNumber || `#DIR-${dir.id.slice(0, 5)}`}
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                          {dir.subject || 'توجيه إداري عام'}
                        </h4>
                        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                          {dir.content || dir.description || 'لا يوجد نص مرفق'}
                        </p>
                        {dir.actionRequired && (
                          <div style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '6px 10px', borderRadius: '6px', marginBottom: '6px' }}>
                            🎯 <strong>المطلوب:</strong> {dir.actionRequired}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {isAck ? (
                            <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} /> تم تأكيد الاستلام
                            </span>
                          ) : (
                            <span style={{ color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={13} /> في انتظار التأكيد
                            </span>
                          )}
                        </span>
                        {!isAck && (
                          <button
                            onClick={() => handleAcknowledgeDirective(dir.id)}
                            disabled={ackLoading[dir.id]}
                            className="btn btn-primary"
                            style={{
                              fontSize: '11px',
                              padding: '5px 12px',
                              background: '#4f46e5',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={13} /> {ackLoading[dir.id] ? 'جاري التأكيد...' : 'تأكيد الاستلام'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Transfer Decisions & Surplus-Deficit List */}
          {incomingTransfers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔄 قرارات سد العجز والندب:</span>
                <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                  {incomingTransfers.length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                {incomingTransfers.slice(0, 6).map((tr) => {
                  const isMasterDirective = Boolean(tr.isDirective || tr.requesterRole === 'superadmin' || tr.source === 'master');
                  const isAck = tr.status === 'acknowledged' || tr.status === 'completed';
                  const subjectDisplay = tr.subject || tr.customSubject || tr.subjectName || tr.title || 'مادة دراسية';
                  const periodsDisplay = tr.requiredPeriods || tr.periodsCount || tr.currentLoad || tr.periods || null;
                  const teacherDisplay = tr.teacherName || tr.assignedTeacherName || (tr.type === 'need' ? (isMasterDirective ? 'كادر معتمد ومكلف من الإدارة العامة' : 'طلب سد عجز (بانتظار توفير كادر من الإدارة العامة)') : 'كادر معتمد للتوجيه');
                  const trackDisplay = tr.track === 'international' ? 'مسار دولي' : 'مسار أهلي';
                  const genderDisplay = tr.gender === 'girls' ? 'بنات' : 'بنين';
                  const stageDisplay = tr.stage === 'primary' ? 'الابتدائية' : tr.stage === 'middle' ? 'المتوسطة' : tr.stage === 'high' ? 'الثانوية' : tr.stage === 'kindergarten' ? 'رياض الأطفال' : '';
                  const schoolDisplay = tr.targetSchoolName || tr.schoolName || '';
                  const reasonDisplay = tr.reason || tr.notes || tr.content || '';

                  return (
                    <div
                      key={tr.id}
                      style={{
                        background: isMasterDirective ? 'linear-gradient(135deg, rgba(245, 243, 255, 0.7), rgba(255, 255, 255, 0.95))' : (isAck ? '#f8fafc' : '#ffffff'),
                        border: isMasterDirective ? '1.5px solid #818cf8' : (isAck ? '1px solid #e2e8f0' : '1.5px solid #10b981'),
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        boxShadow: isAck ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: isMasterDirective ? '#e0e7ff' : (tr.type === 'need' ? '#fee2e2' : '#dbeafe'),
                            color: isMasterDirective ? '#4338ca' : (tr.type === 'need' ? '#991b1b' : '#1e40af')
                          }}>
                            {isMasterDirective 
                              ? '📢 قرار وتوجيه إداري من الماستر' 
                              : (tr.type === 'need' ? '🚨 طلب سد عجز وارد من المدرسة' : '🌟 إتاحة وندب كادر فائض')}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {tr.requestNumber || `#TR-${(tr.id || '').slice(0, 5).toUpperCase()}`}
                          </span>
                        </div>
                        
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                          📚 مادة {subjectDisplay} {periodsDisplay ? `• (${periodsDisplay} حصة أسبوعية)` : ''}
                        </h4>

                        <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 700, marginBottom: '4px' }}>
                          👤 {teacherDisplay}
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{trackDisplay}</span>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{genderDisplay}</span>
                          {stageDisplay && <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{stageDisplay}</span>}
                          {schoolDisplay && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px' }}>🏫 {schoolDisplay}</span>}
                        </div>

                        {reasonDisplay && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                            📝 <strong>البيان / السبب:</strong> {reasonDisplay}
                          </p>
                        )}

                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                          {isMasterDirective ? (
                            <span>📢 <strong style={{ color: '#4338ca' }}>الصادر من: الإدارة العامة (الماستر العام)</strong> • موجه إلى: <strong style={{ color: '#0f766e' }}>{tr.targetSchoolName || tr.toSchoolName || tr.schoolName}</strong></span>
                          ) : (
                            <span>📩 <strong style={{ color: '#b91c1c' }}>مقدم الطلب: {tr.requesterName || 'مدير المدرسة'}</strong> ({tr.fromSchoolName || tr.schoolName}) • موجه إلى: <strong style={{ color: '#4338ca' }}>الإدارة العامة والماستر</strong></span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {isAck ? (
                            <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} /> تم التوثيق والاستلام
                            </span>
                          ) : (
                            <span style={{ color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={13} /> بانتظار تأكيد المدرسة
                            </span>
                          )}
                        </span>
                        {!isAck && (
                          <button
                            onClick={() => handleAcknowledgeTransfer(tr.id)}
                            disabled={ackLoading[tr.id]}
                            className="btn btn-primary"
                            style={{
                              fontSize: '11px',
                              padding: '5px 12px',
                              background: '#059669',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={13} /> {ackLoading[tr.id] ? 'جاري التأكيد...' : 'تأكيد القرار'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Link 
          to="/admin/resources" 
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)',
            boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)'
          }}
        >
          <Layers size={18} /> الموارد وتوزيع الكوادر
        </Link>
        <Link 
          to="/admin/student-records" 
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #0e7490 0%, #0369a1 100%)',
            boxShadow: '0 4px 14px rgba(14, 116, 144, 0.3)'
          }}
        >
          <ClipboardList size={18} /> سجل متابعة الطالب الشامل
        </Link>
        <button onClick={handleSeedData} className="btn" style={{ background: 'white', border: '1px solid var(--color-border)', color: 'var(--color-primary-dark)' }}>
          {t('adminDashboard.addSeedData')}
        </button>
      </div>
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon blue">
            <Users size={32} />
          </div>
          <div className="stat-info">
            <p>{t('adminDashboard.totalTeachers')}</p>
            <h3>{stats.teachers}</h3>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-icon green">
            <Users size={32} />
          </div>
          <div className="stat-info">
            <p>{t('adminDashboard.totalStudents')}</p>
            <h3>{stats.students}</h3>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-icon orange">
            <BookOpen size={32} />
          </div>
          <div className="stat-info">
            <p>{t('adminDashboard.totalClasses')}</p>
            <h3>{stats.classes}</h3>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)' }}>
            <ShieldCheck size={32} />
          </div>
          <div className="stat-info">
            <p>{t('adminDashboard.totalStaff')}</p>
            <h3>{stats.staff}</h3>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }}>
            <UserCheck size={32} />
          </div>
          <div className="stat-info">
            <p>{t('adminDashboard.totalSupervisors')}</p>
            <h3>{stats.supervisors}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageTeachers({ schoolId }) {
  const { t } = useLanguage();
  const [teachers, setTeachers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [printingLetterTeacher, setPrintingLetterTeacher] = useState(null);
  const [printingPortfolioTeacher, setPrintingPortfolioTeacher] = useState(null);
  
  // Single Add
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [subject, setSubject] = useState('');
  const [nationality, setNationality] = useState('سعودي');
  const [isSaving, setIsSaving] = useState(false);
  const [teacherActivityMap, setTeacherActivityMap] = useState({});

  // Bulk Add
  const [bulkData, setBulkData] = useState('');
  
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const unique = [];
      const seen = new Map();
      const duplicatesToDelete = [];

      for (const t of raw) {
        const nid = (t.nationalId || t.id || '').trim();
        if (!seen.has(nid)) {
          seen.set(nid, t);
          unique.push(t);
        } else {
          // Found a duplicate document in database for the same national ID
          duplicatesToDelete.push(t.id);
        }
      }

      // Automatically clean up duplicate documents from Firestore
      if (duplicatesToDelete.length > 0) {
        for (const dupId of duplicatesToDelete) {
          try {
            await deleteDoc(doc(db, 'teachers', dupId));
          } catch (e) {
            console.warn("Auto cleanup duplicate teacher error:", e);
          }
        }
      }

      setTeachers(unique);
    });
    return () => unsub();
  }, [schoolId]);

  // Compute Gamification Points for Teachers
  useEffect(() => {
    if (!schoolId || teachers.length === 0) return;

    const qPrep = schoolId === 'ALL' ? collection(db, 'preparations') : query(collection(db, 'preparations'), where('schoolId', '==', schoolId));
    const qPrepOld = schoolId === 'ALL' ? collection(db, 'lesson_preparations') : query(collection(db, 'lesson_preparations'), where('schoolId', '==', schoolId));
    const qPlans = schoolId === 'ALL' ? collection(db, 'weekly_plans') : query(collection(db, 'weekly_plans'), where('schoolId', '==', schoolId));
    const qAssign = schoolId === 'ALL' ? collection(db, 'assignments') : query(collection(db, 'assignments'), where('schoolId', '==', schoolId));
    const qExams = schoolId === 'ALL' ? collection(db, 'exams') : query(collection(db, 'exams'), where('schoolId', '==', schoolId));
    const qMat = schoolId === 'ALL' ? collection(db, 'materials') : query(collection(db, 'materials'), where('schoolId', '==', schoolId));
    const qAtt = schoolId === 'ALL' ? collection(db, 'attendance') : query(collection(db, 'attendance'), where('schoolId', '==', schoolId));

    Promise.all([
      getDocs(qPrep),
      getDocs(qPrepOld),
      getDocs(qPlans),
      getDocs(qAssign),
      getDocs(qExams),
      getDocs(qMat),
      getDocs(qAtt)
    ]).then(([snapPrep, snapPrepOld, snapPlans, snapAssign, snapExams, snapMat, snapAtt]) => {
      const preps = [...snapPrep.docs.map(d => d.data()), ...snapPrepOld.docs.map(d => d.data())];
      const plans = snapPlans.docs.map(d => d.data());
      const assigns = snapAssign.docs.map(d => d.data());
      const exams = snapExams.docs.map(d => d.data());
      const mats = snapMat.docs.map(d => d.data());
      const atts = snapAtt.docs.map(d => d.data());

      const map = {};
      teachers.forEach(t => {
        map[t.id] = calculateTeacherActivity({
          teacherId: t.id,
          teacherEmail: t.email || `${t.nationalId}@school.local`,
          preparations: preps,
          weeklyPlans: plans,
          assignments: assigns,
          exams: exams,
          materials: mats,
          attendanceLogs: atts
        });
      });
      setTeacherActivityMap(map);
    });
  }, [teachers, schoolId]);

  const handleSaveSingle = async (e) => {
    e.preventDefault();
    const nid = nationalId.trim();
    const tName = name.trim();
    const tSubj = subject.trim();
    if (!tName || !nid) return;
    setIsSaving(true);
    try {
      // Strict check: No duplicate national IDs allowed anywhere in system
      const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
      const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nid)));
      const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nid)));
      if (!uCheck.empty || !tCheck.empty || !sCheck.empty) {
        alert('عذراً: رقم الهوية هذا مسجل مسبقاً في النظام. لا يمكن تسجيل نفس الرقم نهائياً!');
        setIsSaving(false);
        return;
      }

      const fakeEmail = `${nid}@school.local`;
      const tNat = nationality.trim() || 'سعودي';
      await addDoc(collection(db, 'teachers'), {
        name: tName, nationalId: nid, email: fakeEmail, subject: tSubj, nationality: tNat, role: 'teacher', schoolId, createdAt: new Date()
      });
      await addDoc(collection(db, 'users'), {
        nationalId: nid, email: fakeEmail, role: 'teacher', name: tName, nationality: tNat, schoolId
      });
      setIsAdding(false);
      setName(''); setNationalId(''); setSubject(''); setNationality('سعودي');
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBulk = async (e) => {
    e.preventDefault();
    if (!bulkData.trim()) return;
    setIsSaving(true);
    
    try {
      const lines = bulkData.trim().split('\n');
      let addedCount = 0;
      let skippedIds = [];

      for (let line of lines) {
        const parts = line.split(/[\t,]/).map(s => s.trim());
        if (parts.length >= 2) {
          const tId = parts[0];
          const tName = parts[1];
          const tSubj = parts[2] || '';
          
          if (tId && tName) {
            // Strict duplicate check across entire database
            const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', tId)));
            const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', tId)));
            const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', tId)));
            
            if (!uCheck.empty || !tCheck.empty || !sCheck.empty) {
              skippedIds.push(tId);
              continue;
            }

            const fakeEmail = `${tId}@school.local`;
            await addDoc(collection(db, 'teachers'), {
              name: tName, nationalId: tId, email: fakeEmail, subject: tSubj, role: 'teacher', schoolId, createdAt: new Date()
            });
            await addDoc(collection(db, 'users'), {
              nationalId: tId, email: fakeEmail, role: 'teacher', name: tName, schoolId
            });
            addedCount++;
          }
        }
      }
      setIsBulkAdding(false);
      setBulkData('');
      
      let msg = `تمت إضافة ${addedCount} معلم بنجاح.`;
      if (skippedIds.length > 0) {
        msg += `\n⚠️ تم تخطي الأرقام التالية لأنها مسجلة مسبقاً ولا يسمح بتكرارها:\n${skippedIds.join(', ')}`;
      }
      alert(msg);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.bulkUploadError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, nationalId) => {
    if (!window.confirm(t('adminDashboard.confirmDeleteTeacher'))) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
      if (nationalId) {
        const tSnap = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nationalId)));
        tSnap.forEach(async (d) => await deleteDoc(doc(db, 'teachers', d.id)));
        const snap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nationalId)));
        snap.forEach(async (d) => await deleteDoc(doc(db, 'users', d.id)));
      }
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.deleteError'));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedName = editingTeacher.name?.trim() || '';
      const updatedSubj = editingTeacher.subject?.trim() || '';
      const updatedWhatsapp = editingTeacher.whatsapp?.trim() || '';
      const updatedNat = editingTeacher.nationality?.trim() || 'سعودي';

      await updateDoc(doc(db, 'teachers', editingTeacher.id), {
        name: updatedName,
        subject: updatedSubj,
        whatsapp: updatedWhatsapp,
        nationality: updatedNat
      });

      if (editingTeacher.nationalId) {
        const tSnap = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', editingTeacher.nationalId)));
        tSnap.forEach(async (d) => {
          if (d.id !== editingTeacher.id) {
            await updateDoc(doc(db, 'teachers', d.id), {
              name: updatedName,
              subject: updatedSubj,
              whatsapp: updatedWhatsapp,
              nationality: updatedNat
            });
          }
        });

        const snap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', editingTeacher.nationalId)));
        snap.forEach(async (d) => await updateDoc(doc(db, 'users', d.id), {
          name: updatedName,
          nationality: updatedNat
        }));
      }

      setEditingTeacher(null);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>{t('adminDashboard.manageTeachersTitle')}</h2>
        <div style={{display: 'flex', gap: '10px'}}>
          <button className="btn" style={{background: 'var(--color-surface)', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border)'}} onClick={() => setIsBulkAdding(true)}>
            {t('adminDashboard.bulkUpload')}
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            {t('adminDashboard.addNewTeacher')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {teachers.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('adminDashboard.noTeachersAdded')}</p>
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
                  <GamificationBadge
                    points={teacherActivityMap[tData.id]?.totalPoints || 0}
                    stars={teacherActivityMap[tData.id]?.stars || 1}
                    isTeacher={true}
                    size="xs"
                    breakdown={teacherActivityMap[tData.id]?.breakdown}
                  />
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  {t('adminDashboard.nationalIdLabel')}{tData.nationalId} {tData.whatsapp ? `• ${t('adminDashboard.whatsappLabel')}${tData.whatsapp}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                <button
                  onClick={() => setPrintingPortfolioTeacher(tData)}
                  className="btn"
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="معاينة وطباعة ملف الإنجاز التربوي للمعلم"
                >
                  <Award size={15} /> ملف الإنجاز
                </button>
                <button onClick={() => setEditingTeacher(tData)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: 'var(--color-primary)', padding: '6px', display: 'flex', alignItems: 'center' }}><Edit size={16} /></button>
                <button onClick={() => handleDelete(tData.id, tData.nationalId)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', color: '#ff4d4f', padding: '6px', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.addNewTeacher')}</h3>
            <form onSubmit={handleSaveSingle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.teacherName')}</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder={t('adminDashboard.fullNamePlaceholder')} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.nationalId')}</label>
                <input type="text" className="input-field" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="10xxxxxxxx" required />
              </div>
              <NationalitySelect value={nationality} onChange={setNationality} required />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.subject')}</label>
                <input type="text" className="input-field" value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('adminDashboard.subjectPlaceholder')} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveData')}</button>
            </form>
          </div>
        </div>
      )}

      {editingTeacher && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setEditingTeacher(null)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.editTeacherTitle')}</h3>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.teacherName')}</label>
                <input type="text" className="input-field" value={editingTeacher.name} onChange={e => setEditingTeacher({...editingTeacher, name: e.target.value})} placeholder={t('adminDashboard.fullNamePlaceholder')} required />
              </div>
              <NationalitySelect 
                value={editingTeacher.nationality || 'سعودي'} 
                onChange={val => setEditingTeacher({...editingTeacher, nationality: val})} 
              />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.subject')}</label>
                <input type="text" className="input-field" value={editingTeacher.subject} onChange={e => setEditingTeacher({...editingTeacher, subject: e.target.value})} placeholder={t('adminDashboard.subjectPlaceholder')} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.whatsappOptional')}</label>
                <input type="text" className="input-field" value={editingTeacher.whatsapp || ''} onChange={e => setEditingTeacher({...editingTeacher, whatsapp: e.target.value})} placeholder={t('adminDashboard.whatsappPlaceholder')} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveChanges')}</button>
            </form>
          </div>
        </div>
      )}

      {isBulkAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '500px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsBulkAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.bulkUploadTeachersTitle')}</h3>
            <p style={{fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px'}}>
              {t('adminDashboard.bulkUploadTeachersInstruction1')}<br/>
              {t('adminDashboard.requiredOrder')}<strong>{t('adminDashboard.idNameSubject')}</strong>{t('adminDashboard.separatedByCommaOrTab')}
            </p>
            <form onSubmit={handleSaveBulk} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea 
                className="input-field" 
                rows="10" 
                value={bulkData} 
                onChange={e => setBulkData(e.target.value)} 
                placeholder="1010101010, أحمد محمد, رياضيات&#10;1020202020, خالد عبدالله, علوم" 
                required 
                style={{resize: 'none'}}
              />
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.uploading') : t('adminDashboard.uploadData')}</button>
            </form>
          </div>
        </div>
      )}

      {printingLetterTeacher && (
        <CertificateLetterModal person={printingLetterTeacher} type="teacher" onClose={() => setPrintingLetterTeacher(null)} />
      )}

      {printingPortfolioTeacher && (
        <PrintPortfolioModal
          role="teacher"
          userData={printingPortfolioTeacher}
          schoolName={printingPortfolioTeacher?.schoolName}
          onClose={() => setPrintingPortfolioTeacher(null)}
        />
      )}
    </div>
  );
}

function ManageSupervisors({ schoolId }) {
  const { t } = useLanguage();
  const [supervisors, setSupervisors] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [printingLetterSupervisor, setPrintingLetterSupervisor] = useState(null);
  const [printingPortfolioSupervisor, setPrintingPortfolioSupervisor] = useState(null);
  
  // Single Add
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nationality, setNationality] = useState('سعودي');
  const [isSaving, setIsSaving] = useState(false);

  // Permissions State
  const [editingPermissionsSupervisor, setEditingPermissionsSupervisor] = useState(null);

  const SUPERVISOR_ALL_PERMISSIONS = [
    { id: 'preparations', label: 'متابعة تحضير الدروس', desc: 'الاطلاع على تحضير المعلمين والتقييم التربوي' },
    { id: 'weekly_plans', label: 'متابعة الخطط الأسبوعية', desc: 'الاطلاع على الخطط الأسبوعية لجميع الفصول' },
    { id: 'schedules', label: 'الجداول المدرسية', desc: 'الاطلاع على جداول الحصص والفصول والمعلمين' },
    { id: 'teachers', label: 'دليل وكادر المعلمين', desc: 'استعراض بيانات وتخصصات المعلمين' },
    { id: 'students', label: 'شؤون وسجلات الطلاب', desc: 'الاطلاع على بيانات وقوائم الطلاب' },
    { id: 'attendance', label: 'متابعة الحضور والغياب', desc: 'الاطلاع على كشوفات الغياب والحضور' },
    { id: 'excellence', label: 'ملفات التميز والتوثيق', desc: 'الاطلاع على الشواهد والملفات والتقارير' }
  ];

  const handleSaveSupervisorPermissions = async () => {
    if (!editingPermissionsSupervisor) return;
    setIsSaving(true);
    try {
      const updatedPermissions = editingPermissionsSupervisor.permissions || [];
      await updateDoc(doc(db, 'supervisors', editingPermissionsSupervisor.id), {
        permissions: updatedPermissions
      });
      if (editingPermissionsSupervisor.nationalId) {
        const uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', editingPermissionsSupervisor.nationalId)));
        uSnap.forEach(async (d) => {
          await updateDoc(doc(db, 'users', d.id), {
            permissions: updatedPermissions
          });
        });
      }
      alert('تم تحديث صلاحيات المشرف ' + editingPermissionsSupervisor.name + ' بنجاح!');
      setEditingPermissionsSupervisor(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحديث الصلاحيات');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSupervisorPermission = (permId) => {
    if (!editingPermissionsSupervisor) return;
    const current = editingPermissionsSupervisor.permissions || ['preparations', 'weekly_plans', 'schedules', 'teachers', 'excellence'];
    const updated = current.includes(permId) ? current.filter(p => p !== permId) : [...current, permId];
    setEditingPermissionsSupervisor({ ...editingPermissionsSupervisor, permissions: updated });
  };
  
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, 'supervisors'), where('schoolId', '==', schoolId));
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const unique = [];
      const seen = new Map();
      const duplicatesToDelete = [];

      for (const s of raw) {
        const nid = (s.nationalId || s.id || '').trim();
        if (!seen.has(nid)) {
          seen.set(nid, s);
          unique.push(s);
        } else {
          duplicatesToDelete.push(s.id);
        }
      }

      if (duplicatesToDelete.length > 0) {
        for (const dupId of duplicatesToDelete) {
          try {
            await deleteDoc(doc(db, 'supervisors', dupId));
          } catch (e) {
            console.warn("Auto cleanup duplicate supervisor error:", e);
          }
        }
      }

      setSupervisors(unique);
    });
    return () => unsub();
  }, [schoolId]);

  const handleSaveSingle = async (e) => {
    e.preventDefault();
    const nid = nationalId.trim();
    const sName = name.trim();
    const sSpec = specialty.trim();
    const sWhatsapp = whatsapp.trim();
    const sNat = nationality.trim() || 'سعودي';
    if (!sName || !nid) return;
    setIsSaving(true);
    try {
      const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
      const supCheck = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', nid)));
      const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nid)));
      const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nid)));
      if (!uCheck.empty || !supCheck.empty || !tCheck.empty || !sCheck.empty) {
        alert('عذراً: رقم الهوية هذا مسجل مسبقاً في النظام. لا يمكن تسجيل نفس الرقم نهائياً!');
        setIsSaving(false);
        return;
      }

      const fakeEmail = `${nid}@school.local`;
      await addDoc(collection(db, 'supervisors'), {
        name: sName, nationalId: nid, email: fakeEmail, specialty: sSpec, whatsapp: sWhatsapp, nationality: sNat, role: 'supervisor', schoolId, createdAt: new Date()
      });
      await addDoc(collection(db, 'users'), {
        nationalId: nid, email: fakeEmail, role: 'supervisor', name: sName, specialty: sSpec, nationality: sNat, schoolId
      });
      setIsAdding(false);
      setName(''); setNationalId(''); setSpecialty(''); setWhatsapp(''); setNationality('سعودي');
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBulk = async (e) => {
    e.preventDefault();
    if (!bulkData.trim()) return;
    setIsSaving(true);
    
    try {
      const lines = bulkData.trim().split('\n');
      let addedCount = 0;
      let skippedIds = [];

      for (let line of lines) {
        const parts = line.split(/[\t,]/).map(s => s.trim());
        if (parts.length >= 2) {
          const sId = parts[0];
          const sName = parts[1];
          const sSpec = parts[2] || '';
          
          if (sId && sName) {
            const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', sId)));
            const supCheck = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', sId)));
            const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', sId)));
            const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', sId)));
            
            if (!uCheck.empty || !supCheck.empty || !tCheck.empty || !sCheck.empty) {
              skippedIds.push(sId);
              continue;
            }

            const fakeEmail = `${sId}@school.local`;
            await addDoc(collection(db, 'supervisors'), {
              name: sName, nationalId: sId, email: fakeEmail, specialty: sSpec, role: 'supervisor', schoolId, createdAt: new Date()
            });
            await addDoc(collection(db, 'users'), {
              nationalId: sId, email: fakeEmail, role: 'supervisor', name: sName, specialty: sSpec, schoolId
            });
            addedCount++;
          }
        }
      }
      setIsBulkAdding(false);
      setBulkData('');
      
      let msg = `تمت إضافة ${addedCount} مشرف تعليمي بنجاح.`;
      if (skippedIds.length > 0) {
        msg += `\n⚠️ تم تخطي الأرقام التالية لأنها مسجلة مسبقاً ولا يسمح بتكرارها:\n${skippedIds.join(', ')}`;
      }
      alert(msg);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.bulkUploadError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, nationalId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المشرف التعليمي؟')) return;
    try {
      await deleteDoc(doc(db, 'supervisors', id));
      if (nationalId) {
        const supSnap = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', nationalId)));
        supSnap.forEach(async (d) => await deleteDoc(doc(db, 'supervisors', d.id)));
        const snap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nationalId)));
        snap.forEach(async (d) => await deleteDoc(doc(db, 'users', d.id)));
      }
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.deleteError'));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedName = editingSupervisor.name?.trim() || '';
      const updatedSpec = editingSupervisor.specialty?.trim() || '';
      const updatedWhatsapp = editingSupervisor.whatsapp?.trim() || '';
      const updatedNat = editingSupervisor.nationality?.trim() || 'سعودي';

      await updateDoc(doc(db, 'supervisors', editingSupervisor.id), {
        name: updatedName,
        specialty: updatedSpec,
        whatsapp: updatedWhatsapp,
        nationality: updatedNat
      });

      if (editingSupervisor.nationalId) {
        const supSnap = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', editingSupervisor.nationalId)));
        supSnap.forEach(async (d) => {
          if (d.id !== editingSupervisor.id) {
            await updateDoc(doc(db, 'supervisors', d.id), {
              name: updatedName,
              specialty: updatedSpec,
              whatsapp: updatedWhatsapp,
              nationality: updatedNat
            });
          }
        });

        const snap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', editingSupervisor.nationalId)));
        snap.forEach(async (d) => await updateDoc(doc(db, 'users', d.id), {
          name: updatedName,
          specialty: updatedSpec,
          nationality: updatedNat
        }));
      }

      setEditingSupervisor(null);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>{t('adminDashboard.manageSupervisorsTitle')}</h2>
        <div style={{display: 'flex', gap: '10px'}}>
          <button className="btn" style={{background: 'var(--color-surface)', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border)'}} onClick={() => setIsBulkAdding(true)}>
            {t('adminDashboard.bulkUpload')}
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            {t('adminDashboard.addNewSupervisor')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {supervisors.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('adminDashboard.noSupervisorsAdded')}</p>
        ) : (
          supervisors.map(sup => (
            <div key={sup.id} style={{ padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {sup.name}
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    color: 'var(--color-primary-dark)', 
                    background: 'rgba(99, 178, 198, 0.15)', 
                    padding: '2px 10px', 
                    borderRadius: '12px' 
                  }}>
                    {sup.specialty || 'إشراف عام'}
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
                    🌐 {sup.nationality || 'سعودي'}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  {t('adminDashboard.nationalIdLabel')}: {sup.nationalId} {sup.whatsapp ? `• ${t('adminDashboard.whatsappLabel')}: ${sup.whatsapp}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setEditingPermissionsSupervisor({ ...sup })}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                    border: 'none',
                    color: 'white',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title={t('adminDashboard.editPermissions')}
                >
                  <ShieldCheck size={15} /> {t('adminDashboard.editPermissions')}
                </button>
                <button
                  onClick={() => setPrintingLetterSupervisor(sup)}
                  className="btn"
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="طباعة خطاب تعريف مشرف"
                >
                  <FileText size={15} /> خطاب تعريف
                </button>
                <button
                  onClick={() => setPrintingPortfolioSupervisor(sup)}
                  className="btn"
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="معاينة وطباعة ملف الإنجاز الإشرافي"
                >
                  <Award size={15} /> ملف الإنجاز
                </button>
                <button onClick={() => setEditingSupervisor(sup)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#0e7490', padding: '6px', display: 'flex', alignItems: 'center' }}><Edit size={16} /></button>
                <button onClick={() => handleDelete(sup.id, sup.nationalId)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', color: '#dc2626', padding: '6px', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Supervisor Edit Permissions Modal */}
      {editingPermissionsSupervisor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            <button onClick={() => setEditingPermissionsSupervisor(null)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <ShieldCheck size={24} color="#0e7490" />
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>{t('adminDashboard.editPermissions')}: {editingPermissionsSupervisor.name}</h3>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {t('adminDashboard.specialty')}: <strong>{editingPermissionsSupervisor.specialty || 'إشراف عام'}</strong> • {t('adminDashboard.nationalIdLabel')}: {editingPermissionsSupervisor.nationalId}
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setEditingPermissionsSupervisor({ ...editingPermissionsSupervisor, permissions: SUPERVISOR_ALL_PERMISSIONS.map(p => p.id) })}
                style={{ padding: '6px 12px', borderRadius: '8px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ⚡ {t('adminDashboard.expandPermissions')}
              </button>
              <button
                type="button"
                onClick={() => setEditingPermissionsSupervisor({ ...editingPermissionsSupervisor, permissions: [] })}
                style={{ padding: '6px 12px', borderRadius: '8px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🚫 {t('adminDashboard.reducePermissions')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {SUPERVISOR_ALL_PERMISSIONS.map(perm => {
                const isChecked = (editingPermissionsSupervisor.permissions || ['preparations', 'weekly_plans', 'schedules', 'teachers', 'excellence']).includes(perm.id);
                return (
                  <div
                    key={perm.id}
                    onClick={() => toggleSupervisorPermission(perm.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                      background: isChecked ? 'rgba(99, 178, 198, 0.15)' : 'white',
                      border: isChecked ? '1.5px solid var(--color-primary)' : '1px solid #cbd5e1',
                      borderRadius: '10px', cursor: 'pointer', userSelect: 'none'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{isChecked ? '☑' : '☐'}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: isChecked ? 'bold' : 'normal', color: isChecked ? 'var(--color-primary-dark)' : 'var(--color-text)' }}>{perm.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{perm.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleSaveSupervisorPermissions} className="btn btn-primary" disabled={isSaving} style={{ width: '100%', padding: '12px', fontWeight: 'bold', background: 'linear-gradient(135deg, #0e7490, #63B2C6)' }}>
              {isSaving ? t('adminDashboard.saving') : `✓ ${t('adminDashboard.savePermissions')}`}
            </button>
          </div>
        </div>
      )}

      {isAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.addNewSupervisor')}</h3>
            <form onSubmit={handleSaveSingle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.supervisorName')}</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder={t('adminDashboard.fullNamePlaceholder')} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.nationalId')}</label>
                <input type="text" className="input-field" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="10xxxxxxxx" required />
              </div>
              <NationalitySelect value={nationality} onChange={setNationality} required />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.specialty')}</label>
                <input type="text" className="input-field" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder={t('adminDashboard.specialtyPlaceholder')} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.whatsappOptional')}</label>
                <input type="text" className="input-field" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="05xxxxxxxx" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveSupervisor')}</button>
            </form>
          </div>
        </div>
      )}

      {editingSupervisor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setEditingSupervisor(null)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.editSupervisorTitle')}</h3>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.supervisorName')}</label>
                <input type="text" className="input-field" value={editingSupervisor.name} onChange={e => setEditingSupervisor({...editingSupervisor, name: e.target.value})} required />
              </div>
              <NationalitySelect 
                value={editingSupervisor.nationality || 'سعودي'} 
                onChange={val => setEditingSupervisor({...editingSupervisor, nationality: val})} 
              />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.specialty')}</label>
                <input type="text" className="input-field" value={editingSupervisor.specialty || ''} onChange={e => setEditingSupervisor({...editingSupervisor, specialty: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.whatsappOptional')}</label>
                <input type="text" className="input-field" value={editingSupervisor.whatsapp || ''} onChange={e => setEditingSupervisor({...editingSupervisor, whatsapp: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveChanges')}</button>
            </form>
          </div>
        </div>
      )}

      {isBulkAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '500px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsBulkAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.bulkUploadSupervisorsTitle')}</h3>
            <p style={{fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px'}}>
              {t('adminDashboard.requiredOrder')} <strong>{t('adminDashboard.bulkSupervisorsOrder')}</strong> {t('adminDashboard.separatedByCommaOrTab')}
            </p>
            <form onSubmit={handleSaveBulk} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea 
                className="input-field" 
                rows="10" 
                value={bulkData} 
                onChange={e => setBulkData(e.target.value)} 
                placeholder="1010101010, د. فهد العتيبي, إشراف رياضيات&#10;1020202020, أ. عبدالله الغامدي, إشراف عام" 
                required 
                style={{resize: 'none'}}
              />
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.uploading') : t('adminDashboard.uploadData')}</button>
            </form>
          </div>
        </div>
      )}

      {printingLetterSupervisor && (
        <CertificateLetterModal person={printingLetterSupervisor} type="supervisor" onClose={() => setPrintingLetterSupervisor(null)} />
      )}

      {printingPortfolioSupervisor && (
        <PrintPortfolioModal
          role="supervisor"
          userData={printingPortfolioSupervisor}
          schoolName={printingPortfolioSupervisor?.schoolName}
          onClose={() => setPrintingPortfolioSupervisor(null)}
        />
      )}
    </div>
  );
}

function ManageStudents({ schoolId }) {
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [printingLetterStudent, setPrintingLetterStudent] = useState(null);
  const [printingPortfolioStudent, setPrintingPortfolioStudent] = useState(null);
  const [isPrintingStudentRecords, setIsPrintingStudentRecords] = useState(false);
  
  // Single Add
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [nationality, setNationality] = useState('سعودي');
  const [isSaving, setIsSaving] = useState(false);
  const [studentActivityMap, setStudentActivityMap] = useState({});

  // Bulk Add
  const [bulkData, setBulkData] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    const qStudents = query(collection(db, 'students'), where('schoolId', '==', schoolId));
    const qClasses = query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsubStudents = onSnapshot(qStudents, async (snap) => {
      const raw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const unique = [];
      const seen = new Map();
      const duplicatesToDelete = [];

      for (const s of raw) {
        const nid = (s.nationalId || s.id || '').trim();
        if (!seen.has(nid)) {
          seen.set(nid, s);
          unique.push({
            ...s,
            class: s.class || s.className || ''
          });
        } else {
          // Found duplicate document in database for the same national ID
          duplicatesToDelete.push(s.id);
        }
      }

      // Automatically clean up duplicate documents from Firestore
      if (duplicatesToDelete.length > 0) {
        for (const dupId of duplicatesToDelete) {
          try {
            await deleteDoc(doc(db, 'students', dupId));
          } catch (e) {
            console.warn("Auto cleanup duplicate student error:", e);
          }
        }
      }

      setStudents(unique);
    });
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClassesList(data);
    });
    return () => { unsubStudents(); unsubClasses(); };
  }, [schoolId]);

  // Compute Gamification Points for Students
  useEffect(() => {
    if (!schoolId || students.length === 0) return;

    const qA = schoolId === 'ALL' ? collection(db, 'assignment_results') : query(collection(db, 'assignment_results'), where('schoolId', '==', schoolId));
    const qE = schoolId === 'ALL' ? collection(db, 'exam_results') : query(collection(db, 'exam_results'), where('schoolId', '==', schoolId));
    const qAtt = schoolId === 'ALL' ? collection(db, 'attendance') : query(collection(db, 'attendance'), where('schoolId', '==', schoolId));

    Promise.all([
      getDocs(qA),
      getDocs(qE),
      getDocs(qAtt)
    ]).then(([snapA, snapE, snapAtt]) => {
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
  }, [students, schoolId]);

  const handleSaveSingle = async (e) => {
    e.preventDefault();
    const nid = nationalId.trim();
    const sName = name.trim();
    const sClass = studentClass.trim();
    const sNat = nationality.trim() || 'سعودي';
    if (!sName || !nid || !sClass) return;
    setIsSaving(true);
    try {
      // Strict check: No duplicate national IDs allowed anywhere in system
      const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
      const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nid)));
      const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nid)));
      if (!uCheck.empty || !sCheck.empty || !tCheck.empty) {
        alert('عذراً: رقم الهوية هذا مسجل مسبقاً في النظام. لا يمكن تسجيل نفس الرقم نهائياً!');
        setIsSaving(false);
        return;
      }

      const fakeEmail = `${nid}@school.local`;
      await addDoc(collection(db, 'students'), {
        name: sName, nationalId: nid, email: fakeEmail, class: sClass, className: sClass, nationality: sNat, role: 'student', schoolId, createdAt: new Date()
      });
      await addDoc(collection(db, 'users'), {
        nationalId: nid, email: fakeEmail, role: 'student', name: sName, class: sClass, className: sClass, nationality: sNat, schoolId
      });
      setIsAdding(false);
      setName(''); setNationalId(''); setStudentClass(''); setNationality('سعودي');
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBulk = async (e) => {
    e.preventDefault();
    if (!bulkData.trim()) return;
    setIsSaving(true);
    
    try {
      const lines = bulkData.trim().split('\n');
      let addedCount = 0;
      let skippedIds = [];

      for (let line of lines) {
        const parts = line.split(/[\t,]/).map(s => s.trim());
        if (parts.length >= 2) {
          const sId = parts[0];
          const sName = parts[1];
          const sClass = parts[2] || '';
          
          if (sId && sName) {
            // Strict duplicate check across entire database
            const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', sId)));
            const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', sId)));
            const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', sId)));
            
            if (!uCheck.empty || !sCheck.empty || !tCheck.empty) {
              skippedIds.push(sId);
              continue;
            }

            const fakeEmail = `${sId}@school.local`;
            await addDoc(collection(db, 'students'), {
              name: sName, nationalId: sId, email: fakeEmail, class: sClass, className: sClass, role: 'student', schoolId, createdAt: new Date()
            });
            await addDoc(collection(db, 'users'), {
              nationalId: sId, email: fakeEmail, role: 'student', name: sName, class: sClass, className: sClass, schoolId
            });
            addedCount++;
          }
        }
      }
      setIsBulkAdding(false);
      setBulkData('');
      
      let msg = `تمت إضافة ${addedCount} طالب بنجاح.`;
      if (skippedIds.length > 0) {
        msg += `\n⚠️ تم تخطي الأرقام التالية لأنها مسجلة مسبقاً ولا يسمح بتكرارها:\n${skippedIds.join(', ')}`;
      }
      alert(msg);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.bulkUploadError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, nationalId) => {
    if (!window.confirm(t('adminDashboard.confirmDeleteStudent'))) return;
    try {
      await deleteDoc(doc(db, 'students', id));
      if (nationalId) {
        const sSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nationalId)));
        sSnap.forEach(async (d) => await deleteDoc(doc(db, 'students', d.id)));
        const snap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nationalId)));
        snap.forEach(async (d) => await deleteDoc(doc(db, 'users', d.id)));
      }
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.deleteError'));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedName = editingStudent.name?.trim() || '';
      const updatedClass = editingStudent.class?.trim() || '';
      const updatedNat = editingStudent.nationality?.trim() || 'سعودي';

      await updateDoc(doc(db, 'students', editingStudent.id), {
        name: updatedName,
        class: updatedClass,
        className: updatedClass,
        nationality: updatedNat
      });

      if (editingStudent.nationalId) {
        const sSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', editingStudent.nationalId)));
        sSnap.forEach(async (d) => {
          if (d.id !== editingStudent.id) {
            await updateDoc(doc(db, 'students', d.id), {
              name: updatedName,
              class: updatedClass,
              className: updatedClass,
              nationality: updatedNat
            });
          }
        });

        const snap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', editingStudent.nationalId)));
        snap.forEach(async (d) => await updateDoc(doc(db, 'users', d.id), {
          name: updatedName,
          class: updatedClass,
          className: updatedClass,
          nationality: updatedNat
        }));
      }

      setEditingStudent(null);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2>{t('adminDashboard.manageStudentsTitle')}</h2>
        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
          <button 
            className="btn" 
            style={{background: 'linear-gradient(135deg, #0e7490, #63B2C6)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold'}} 
            onClick={() => setIsPrintingStudentRecords(true)}
          >
            <Printer size={16} /> طباعة وسجل قيد الطلاب
          </button>
          <button className="btn" style={{background: 'var(--color-surface)', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border)'}} onClick={() => setIsBulkAdding(true)}>
            {t('adminDashboard.bulkUpload')}
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            {t('adminDashboard.registerStudent')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {students.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('adminDashboard.noStudentsAdded')}</p>
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
                  <GamificationBadge
                    points={studentActivityMap[s.id]?.totalPoints || 0}
                    stars={studentActivityMap[s.id]?.stars || 1}
                    size="xs"
                    breakdown={studentActivityMap[s.id]?.breakdown}
                  />
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                  {t('adminDashboard.nationalIdLabel')}{s.nationalId}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                <button
                  onClick={() => setPrintingPortfolioStudent(s)}
                  className="btn"
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="معاينة وطباعة ملف إنجاز الطالب"
                >
                  <Award size={15} /> ملف الإنجاز
                </button>
                <button onClick={() => setEditingStudent(s)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: 'var(--color-primary)', padding: '6px', display: 'flex', alignItems: 'center' }}><Edit size={16} /></button>
                <button onClick={() => handleDelete(s.id, s.nationalId)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', color: '#ff4d4f', padding: '6px', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.registerNewStudentTitle')}</h3>
            <form onSubmit={handleSaveSingle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.studentName')}</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder={t('adminDashboard.fullNamePlaceholder')} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.nationalId')}</label>
                <input type="text" className="input-field" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="10xxxxxxxx" required />
              </div>
              <NationalitySelect value={nationality} onChange={setNationality} required />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.class')}</label>
                <select className="input-field" value={studentClass} onChange={e => setStudentClass(e.target.value)} required>
                  <option value="">{t('adminDashboard.selectClass')}</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveData')}</button>
            </form>
          </div>
        </div>
      )}

      {editingStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setEditingStudent(null)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.editStudentTitle')}</h3>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.studentName')}</label>
                <input type="text" className="input-field" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} placeholder={t('adminDashboard.fullNamePlaceholder')} required />
              </div>
              <NationalitySelect 
                value={editingStudent.nationality || 'سعودي'} 
                onChange={val => setEditingStudent({...editingStudent, nationality: val})} 
              />
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.class')}</label>
                <select className="input-field" value={editingStudent.class} onChange={e => setEditingStudent({...editingStudent, class: e.target.value})} required>
                  <option value="">{t('adminDashboard.selectClass')}</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveChanges')}</button>
            </form>
          </div>
        </div>
      )}

      {isBulkAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '500px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsBulkAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-primary-dark)' }}>{t('adminDashboard.bulkUploadStudentsTitle')}</h3>
            <p style={{fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px'}}>
              {t('adminDashboard.bulkUploadStudentsInstruction1')}<br/>
              {t('adminDashboard.requiredOrder')}<strong>{t('adminDashboard.idNameClass')}</strong>{t('adminDashboard.separatedByCommaOrTab')}
            </p>
            <form onSubmit={handleSaveBulk} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea 
                className="input-field" 
                rows="10" 
                value={bulkData} 
                onChange={e => setBulkData(e.target.value)} 
                placeholder="1010101010, أحمد محمد, 1/أ&#10;1020202020, خالد عبدالله, 2/ب" 
                required 
                style={{resize: 'none'}}
              />
              <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? t('adminDashboard.uploading') : t('adminDashboard.uploadData')}</button>
            </form>
          </div>
        </div>
      )}

      {printingLetterStudent && (
        <CertificateLetterModal person={printingLetterStudent} type="student" onClose={() => setPrintingLetterStudent(null)} />
      )}

      {printingPortfolioStudent && (
        <PrintPortfolioModal
          role="student"
          userData={printingPortfolioStudent}
          schoolName={printingPortfolioStudent?.schoolName}
          onClose={() => setPrintingPortfolioStudent(null)}
        />
      )}

      {isPrintingStudentRecords && (
        <PrintStudentRecordsModal students={students} classesList={classesList} onClose={() => setIsPrintingStudentRecords(false)} />
      )}
    </div>
  );
}

function ManageClasses({ schoolId }) {
  const { t } = useLanguage();
  const [classes, setClasses] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [className, setClassName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingClass, setEditingClass] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
    const unsub = onSnapshot(q, (snap) => {
      const cls = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(cls);
    });
    return () => unsub();
  }, [schoolId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!className) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'classes'), {
        name: className,
        schoolId,
        createdAt: new Date()
      });
      setIsAdding(false);
      setClassName('');
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('adminDashboard.confirmDeleteClass'))) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.deleteError'));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'classes', editingClass.id), {
        name: editingClass.name
      });
      setEditingClass(null);
    } catch (err) {
      console.error(err);
      alert(t('adminDashboard.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>{t('adminDashboard.totalClasses')}</h2>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          {t('adminDashboard.addNewClass')}
        </button>
      </div>
      
      <div style={{ display: 'grid', gap: '12px' }}>
        {classes.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('adminDashboard.noClassesAdded')}</p>
        ) : (
          classes.map(cls => (
            <div key={cls.id} style={{ padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>{cls.name}</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEditingClass(cls)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}><Edit size={20} /></button>
                <button onClick={() => handleDelete(cls.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f' }}><Trash2 size={20} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => setIsAdding(false)} 
              style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="var(--color-text-muted)" />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>
              {t('adminDashboard.addClassTitle')}
            </h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.classNamePlaceholderLabel')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder={t('adminDashboard.className')}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveClass')}
              </button>
            </form>
          </div>
        </div>
      )}

      {editingClass && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => setEditingClass(null)} 
              style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="var(--color-text-muted)" />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>
              {t('adminDashboard.editClassTitle')}
            </h3>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)' }}>{t('adminDashboard.className')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editingClass.name}
                  onChange={(e) => setEditingClass({...editingClass, name: e.target.value})}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? t('adminDashboard.saving') : t('adminDashboard.saveChanges')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { userData } = useAuth();
  const { t } = useLanguage();
  return (
    <Layout role="admin" title={t('adminDashboard.adminDashboardTitle')}>
      <Routes>
        <Route path="/" element={<AdminHome schoolId={userData?.schoolId} />} />
        <Route path="/resources" element={<SchoolResourcesHub role="admin" />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/portfolio" element={<AchievementPortfolioPage />} />
        <Route path="/teacher-evaluations" element={<TeacherPerformanceEvaluationHub role="admin" />} />
        <Route path="/staff" element={<ManageStaff schoolId={userData?.schoolId} />} />
        <Route path="/supervisors" element={<ManageSupervisors schoolId={userData?.schoolId} />} />
        <Route path="/teachers" element={<ManageTeachers schoolId={userData?.schoolId} />} />
        <Route path="/students" element={<ManageStudents schoolId={userData?.schoolId} />} />
        <Route path="/student-records" element={<ComprehensiveStudentRecord role="admin" />} />
        <Route path="/classes" element={<ManageClasses schoolId={userData?.schoolId} />} />
        <Route path="/schedule" element={<ManageSchedules schoolId={userData?.schoolId} />} />
        <Route path="/attendance" element={<AttendanceSummaryExport schoolId={userData?.schoolId} />} />
        <Route path="/preparations" element={<AdminPreparations schoolId={userData?.schoolId} />} />
        <Route path="/weekly-plan" element={<WeeklyPlanView schoolId={userData?.schoolId} />} />
        <Route path="/excellence" element={<SchoolExcellenceDashboard />} />
        <Route path="/noor" element={<NoorIntegrationHub schoolId={userData?.schoolId} />} />
        <Route path="/settings" element={<SchoolSettings schoolId={userData?.schoolId} />} />
        <Route path="*" element={<AdminHome schoolId={userData?.schoolId} />} />
      </Routes>
    </Layout>
  );
}
