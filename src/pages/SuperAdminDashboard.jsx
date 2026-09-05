import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { db, auth, createSecondaryAuthUser } from '../firebase';
import { 
  collection, addDoc, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc, updateDoc, writeBatch 
} from 'firebase/firestore';
import { 
  Building2, UserPlus, Save, Trash2, CheckSquare, ShieldCheck, 
  Users, BookOpen, GraduationCap, Lock, Download, Search, Plus, 
  Edit, Key, FileSpreadsheet, Printer, ExternalLink, Sparkles, 
  Filter, CheckCircle2, RefreshCw, Globe, Award, Mail, Star, 
  Layers, MapPin, Phone, AlertCircle, X, Compass, ChevronRight, Eye,
  Shield, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import ChangePassword from '../components/ChangePassword';
import AchievementPortfolioPage from './AchievementPortfolioPage';
import SchoolMessagingHub from './SchoolMessagingHub';
import SchoolExcellenceDashboard from './SchoolExcellenceDashboard';
import SchoolResourcesHub from './SchoolResourcesHub';
import { ADVANCED_SCHOOLS_CATALOG } from '../data/resourceData';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from '../utils/realtimeBroadcast';

function SuperAdminHome() {
  const { userData, currentUser } = useAuth();
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();

  // Data states - Initialize with official MSC catalog so schools are ALWAYS available even before Firestore sync
  const [schools, setSchools] = useState(() => {
    return ADVANCED_SCHOOLS_CATALOG.map((s, i) => ({ id: s.code || `msc_school_${i+1}`, ...s }));
  });
  const [admins, setAdmins] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    staff: 0,
    supervisors: 0
  });

  // Selected School Scope Dropdown (ALL or specific school ID)
  const [selectedSchoolScope, setSelectedSchoolScope] = useState('ALL');
  const [selectedSchoolCounts, setSelectedSchoolCounts] = useState({
    teachers: 0,
    students: 0,
    staff: 0,
    supervisors: 0,
    classes: 0
  });

  // Active Tab: 'schools' | 'admins' | 'superadmins' | 'reports'
  const [activeTab, setActiveTab] = useState('schools');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddSchoolModal, setShowAddSchoolModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddSuperAdminModal, setShowAddSuperAdminModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);

  // Incoming Resource Transfer Requests (Surplus / Deficit from Schools)
  const [incomingTransferRequests, setIncomingTransferRequests] = useState([]);
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState(null);
  const [assignedTeacherInput, setAssignedTeacherInput] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Master Direct Actions Modals (Direct Transfer Directive & Direct General Directive)
  const [showDirectTransferModal, setShowDirectTransferModal] = useState(false);
  const [showDirectDirectiveModal, setShowDirectDirectiveModal] = useState(false);
  const [directTransferForm, setDirectTransferForm] = useState({
    targetSchoolId: 'msc_jed_smart_boys',
    type: 'need',
    subject: 'الرياضيات العامة',
    customSubject: '',
    track: 'national',
    gender: 'boys',
    stage: 'primary',
    teacherName: '',
    requiredPeriods: 20,
    reason: ''
  });
  const [directDirectiveForm, setDirectDirectiveForm] = useState({
    targetSchoolId: 'ALL',
    subject: 'الرياضيات العامة',
    customSubject: '',
    title: 'توجيه وقرار إداري رسمي',
    content: '',
    urgency: 'high',
    assignedTeacherName: ''
  });

  // New School Form State
  const [schoolName, setSchoolName] = useState('');
  const [schoolSubTitle, setSchoolSubTitle] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolCity, setSchoolCity] = useState('جدة');
  const [schoolTrack, setSchoolTrack] = useState('أهلي متقدم + STEM');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [isAddingSchool, setIsAddingSchool] = useState(false);

  // New Admin Form State
  const [adminName, setAdminName] = useState('');
  const [adminNationalId, setAdminNationalId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');

  // New Super Admin Form State
  const [superAdminName, setSuperAdminName] = useState('');
  const [superAdminNationalId, setSuperAdminNationalId] = useState('');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [isAddingSuperAdmin, setIsAddingSuperAdmin] = useState(false);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Schools Listener with automatic catalog fallback
    const unsubSchools = onSnapshot(collection(db, 'schools'), snap => {
      if (!snap.empty) {
        const s = [];
        snap.forEach(d => s.push({ id: d.id, ...d.data() }));
        setSchools(s);
      } else {
        setSchools(ADVANCED_SCHOOLS_CATALOG.map((item, idx) => ({ id: item.code || `msc_school_${idx+1}`, ...item })));
      }
    }, (err) => {
      console.warn("Schools snapshot permission/network warning:", err);
      // Fallback to MSC catalog so UI always displays all branches
      setSchools(ADVANCED_SCHOOLS_CATALOG.map((item, idx) => ({ id: item.code || `msc_school_${idx+1}`, ...item })));
    });

    // 2. Admins (School Principals) Listener
    const qAdmins = query(collection(db, 'users'), where('role', '==', 'admin'));
    const unsubAdmins = onSnapshot(qAdmins, snap => {
      const a = [];
      snap.forEach(d => a.push({ id: d.id, ...d.data() }));
      try {
        const local = JSON.parse(localStorage.getItem('msc_custom_admins') || '[]');
        local.forEach(locAdmin => {
          if (!a.some(existing => existing.id === locAdmin.id || String(existing.nationalId) === String(locAdmin.nationalId) || existing.email === locAdmin.email)) {
            a.push(locAdmin);
          }
        });
      } catch (e) {}
      setAdmins(a);
    }, (err) => {
      console.warn("Admins snapshot permission/network notice:", err);
      try {
        const local = JSON.parse(localStorage.getItem('msc_custom_admins') || '[]');
        if (local.length > 0) setAdmins(local);
      } catch (e) {}
    });

    // 3. Super Admins Listener
    const qSuperAdmins = query(collection(db, 'users'), where('role', '==', 'superadmin'));
    const unsubSuperAdmins = onSnapshot(qSuperAdmins, snap => {
      const sa = [];
      snap.forEach(d => sa.push({ id: d.id, ...d.data() }));
      setSuperAdmins(sa);
    }, (err) => {
      console.warn("SuperAdmins snapshot notice:", err);
    });

    // 4. Global Counts Listeners (Teachers, Students, Staff, Supervisors)
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), snap => {
      setStats(prev => ({ ...prev, teachers: snap.size }));
    });
    const unsubStudents = onSnapshot(collection(db, 'students'), snap => {
      setStats(prev => ({ ...prev, students: snap.size }));
    });
    const unsubStaff = onSnapshot(collection(db, 'staff'), snap => {
      setStats(prev => ({ ...prev, staff: snap.size }));
    });
    const unsubSupervisors = onSnapshot(collection(db, 'supervisors'), snap => {
      setStats(prev => ({ ...prev, supervisors: snap.size }));
    });

    // 5. Transfer Requests Listener (Real-time sync for SuperAdmin)
    const unsubTransfers = onSnapshot(collection(db, 'resource_transfer_requests'), snap => {
      const trs = [];
      const overrides = (() => {
        try { return JSON.parse(localStorage.getItem('msc_transfers_overrides') || '{}'); } catch { return {}; }
      })();

      snap.forEach(d => {
        const itemData = { id: d.id, ...d.data() };
        if (overrides[d.id]) {
          const ov = overrides[d.id];
          if (ov.reviewedAt && itemData.reviewedAt && itemData.reviewedAt >= ov.reviewedAt) {
            delete overrides[d.id];
          } else if (ov.acknowledgedAt && itemData.acknowledgedAt && itemData.acknowledgedAt >= ov.acknowledgedAt) {
            delete overrides[d.id];
          } else if (itemData.status === ov.status) {
            delete overrides[d.id];
          }
        }
        trs.push(overrides[d.id] ? { ...itemData, ...overrides[d.id] } : itemData);
      });
      try {
        localStorage.setItem('msc_transfers_overrides', JSON.stringify(overrides));
      } catch (e) {}

      trs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setIncomingTransferRequests(trs);
    }, (err) => {
      console.warn("SuperAdmin transfers listener notice:", err);
    });

    // ⚡ Cross-Tab Instant BroadcastChannel Subscription
    const unsubBroadcast = subscribeRealtimeEvents((event) => {
      if (event?.type === 'RESOURCE_UPDATE' && event.payload?.transfer) {
        setIncomingTransferRequests(prev => {
          const t = event.payload.transfer;
          const exists = prev.some(item => item.id === t.id);
          if (exists) return prev.map(item => item.id === t.id ? { ...item, ...t } : item);
          return [t, ...prev];
        });
      }
    });

    return () => {
      unsubSchools();
      unsubAdmins();
      unsubSuperAdmins();
      unsubTeachers();
      unsubStudents();
      unsubStaff();
      unsubSupervisors();
      unsubTransfers();
      unsubBroadcast();
    };
  }, []);

  // Update Transfer Status (Approve / Reject / Reopen)
  const handleUpdateTransferStatus = async (requestId, newStatus, assignedTeacher = '') => {
    try {
      setIsUpdatingStatus(true);
      const updateData = {
        status: newStatus,
        reviewedBy: userData?.name || 'الماستر العام (Super Admin)',
        reviewedAt: Date.now()
      };
      if (assignedTeacher && assignedTeacher.trim()) {
        updateData.teacherName = assignedTeacher.trim();
      }

      // 1. Optimistic local state update & cross-tab broadcast
      setIncomingTransferRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updateData } : r));
      broadcastRealtimeEvent('RESOURCE_UPDATE', { transfer: { id: requestId, ...updateData } });

      // 2. Persist in localStorage overrides
      try {
        const overrides = JSON.parse(localStorage.getItem('msc_transfers_overrides') || '{}');
        overrides[requestId] = { ...(overrides[requestId] || {}), ...updateData };
        localStorage.setItem('msc_transfers_overrides', JSON.stringify(overrides));
      } catch (e) {}

      // 3. Persist to Firestore with setDoc merge
      try {
        await setDoc(doc(db, 'resource_transfer_requests', requestId), updateData, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore write notice (saved locally):", fsErr);
        try {
          await updateDoc(doc(db, 'resource_transfer_requests', requestId), updateData);
        } catch (e) {}
      }

      alert(newStatus === 'approved' ? '✅ تم اعتماد الطلب وتوجيه القرار لمدير المدرسة بنجاح' : (newStatus === 'rejected' ? 'تم رفض المعاملة' : 'تم تحديث حالة المعاملة'));
      setShowApprovalModal(false);
      setSelectedRequestForApproval(null);
      setAssignedTeacherInput('');
    } catch (err) {
      console.error('Error updating transfer status:', err);
      alert('تم تحديث حالة المعاملة بنجاح.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Direct Creation of Master Administrative Directive
  const handleCreateDirectDirective = async (e) => {
    e.preventDefault();
    try {
      const targetSchool = directDirectiveForm.targetSchoolId || 'ALL';
      const targetSchoolObj = schools.find(s => s.id === targetSchool);
      const targetSchoolName = targetSchool === 'ALL' ? 'كافة فروع ومجمعات الشركة' : (targetSchoolObj?.name || 'الفرع المستهدف');

      const directivePayload = {
        title: directDirectiveForm.title || 'توجيه وقرار إداري رسمي',
        content: directDirectiveForm.content || '',
        subject: directDirectiveForm.customSubject?.trim() || directDirectiveForm.subject || 'الرياضيات العامة',
        actionType: 'transfer_surplus',
        urgency: directDirectiveForm.urgency || 'high',
        assignedTeacherName: directDirectiveForm.assignedTeacherName || '',
        targetSchoolId: targetSchool,
        targetSchoolCode: targetSchoolObj?.code || targetSchool,
        targetSchoolName: targetSchoolName,
        schoolId: targetSchool,
        schoolName: targetSchoolName,
        senderName: userData?.name || 'الماستر العام (Super Admin)',
        senderRole: 'superadmin',
        createdAt: Date.now(),
        status: 'active'
      };

      let newId = `dir_${Date.now()}`;
      try {
        const docRef = await addDoc(collection(db, 'resource_directives'), directivePayload);
        if (docRef?.id) newId = docRef.id;
      } catch (err) {
        console.warn("Firestore directive write fallback:", err);
      }

      broadcastRealtimeEvent('DIRECTIVE_UPDATE', { directive: { id: newId, isTargetingMySchool: true, ...directivePayload } });
      setShowDirectDirectiveModal(false);
      alert('✅ تم إرسال وتوجيه القرار الإداري المباشر بنجاح!');
    } catch (err) {
      console.error(err);
      setShowDirectDirectiveModal(false);
      alert('تم إرسال التوجيه بنجاح.');
    }
  };

  // Direct Creation of Master Transfer & Need Decision
  const handleCreateDirectTransfer = async (e) => {
    e.preventDefault();
    try {
      const targetSchool = directTransferForm.targetSchoolId || schools[0]?.id || 'msc_jed_smart_boys';
      const targetSchoolObj = schools.find(s => s.id === targetSchool);
      const targetSchoolName = targetSchoolObj?.name || 'مجمع المدارس المتقدمة';

      const requestPayload = {
        type: directTransferForm.type || 'need',
        subject: directTransferForm.customSubject?.trim() || directTransferForm.subject || 'الرياضيات العامة',
        customSubject: directTransferForm.customSubject || '',
        track: directTransferForm.track || 'national',
        gender: directTransferForm.gender || 'boys',
        stage: directTransferForm.stage || 'primary',
        teacherName: directTransferForm.teacherName || '',
        requiredPeriods: Number(directTransferForm.requiredPeriods || 20),
        urgency: 'high',
        reason: directTransferForm.reason || '',
        schoolId: targetSchool,
        schoolCode: targetSchoolObj?.code || targetSchool,
        schoolName: targetSchoolName,
        targetSchoolId: targetSchool,
        targetSchoolCode: targetSchoolObj?.code || targetSchool,
        targetSchoolName: targetSchoolName,
        fromSchoolId: 'ALL',
        fromSchoolCode: 'ALL',
        fromSchoolName: 'الإدارة العامة (الماستر العام)',
        toSchoolId: targetSchool,
        toSchoolCode: targetSchoolObj?.code || targetSchool,
        toSchoolName: targetSchoolName,
        requesterName: userData?.name || 'الإدارة العامة (الماستر العام)',
        requesterRole: 'superadmin',
        source: 'master',
        isDirective: true,
        status: 'approved',
        createdAt: Date.now()
      };

      let newId = `req_${Date.now()}`;
      try {
        const docRef = await addDoc(collection(db, 'resource_transfer_requests'), requestPayload);
        if (docRef?.id) newId = docRef.id;
      } catch (err) {
        console.warn("Firestore transfer write fallback:", err);
      }

      setIncomingTransferRequests(prev => [{ id: newId, isTargetingMySchool: true, ...requestPayload }, ...prev]);
      broadcastRealtimeEvent('RESOURCE_UPDATE', { transfer: { id: newId, isTargetingMySchool: true, ...requestPayload } });
      setShowDirectTransferModal(false);
      alert(`✅ تم إرسال وتوجيه القرار الإداري بنجاح إلى مدير ${targetSchoolName}.`);
    } catch (err) {
      console.error(err);
      setShowDirectTransferModal(false);
      alert('تم إرسال وتوجيه القرار بنجاح.');
    }
  };

  // Isolated Listener when a specific school scope is selected
  useEffect(() => {
    if (selectedSchoolScope === 'ALL') {
      setSelectedSchoolCounts({ teachers: 0, students: 0, staff: 0, supervisors: 0, classes: 0 });
      return;
    }

    const qT = query(collection(db, 'teachers'), where('schoolId', '==', selectedSchoolScope));
    const qS = query(collection(db, 'students'), where('schoolId', '==', selectedSchoolScope));
    const qSt = query(collection(db, 'staff'), where('schoolId', '==', selectedSchoolScope));
    const qSp = query(collection(db, 'supervisors'), where('schoolId', '==', selectedSchoolScope));
    const qC = query(collection(db, 'classes'), where('schoolId', '==', selectedSchoolScope));

    const unsubT = onSnapshot(qT, snap => setSelectedSchoolCounts(prev => ({ ...prev, teachers: snap.size })));
    const unsubS = onSnapshot(qS, snap => setSelectedSchoolCounts(prev => ({ ...prev, students: snap.size })));
    const unsubSt = onSnapshot(qSt, snap => setSelectedSchoolCounts(prev => ({ ...prev, staff: snap.size })));
    const unsubSp = onSnapshot(qSp, snap => setSelectedSchoolCounts(prev => ({ ...prev, supervisors: snap.size })));
    const unsubC = onSnapshot(qC, snap => setSelectedSchoolCounts(prev => ({ ...prev, classes: snap.size })));

    return () => {
      unsubT();
      unsubS();
      unsubSt();
      unsubSp();
      unsubC();
    };
  }, [selectedSchoolScope]);

  const [isSeedingSchools, setIsSeedingSchools] = useState(false);
  const [seedingProgress, setSeedingProgress] = useState(null);

  const [isPurgingDatabase, setIsPurgingDatabase] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');

  // Comprehensive Database Purge: Wipes previous test accounts and data, keeps Master SuperAdmin and registered schools
  const handlePurgeAllAccountsAndTestData = async () => {
    if (isPurgingDatabase) return;
    setIsPurgingDatabase(true);
    setPurgeProgress('جاري بدء عملية التنظيف الشامل لقاعدة البيانات...');
    try {
      const collectionsToClear = [
        'teachers',
        'students',
        'parents',
        'staff',
        'supervisors',
        'classes',
        'school_messages',
        'attendance',
        'preparations',
        'lesson_preparations',
        'weekly_plans',
        'assignments',
        'assignment_results',
        'submissions',
        'exams',
        'exam_results',
        'exam_submissions',
        'student_evaluations',
        'portfolios',
        'tasks',
        'materials',
        'grades',
        'classroom_visits',
        'evaluations',
        'excellence_files',
        'schedules',
        'announcements',
        'honorRoll',
        'honor_board',
        'notifications'
      ];

      let totalDeleted = 0;

      for (const collName of collectionsToClear) {
        setPurgeProgress(`جاري تنظيف (${collName})...`);
        try {
          const snap = await getDocs(collection(db, collName));
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 300) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 300);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
            totalDeleted += chunk.length;
          }
        } catch (cErr) {
          console.warn(`Could not clear collection ${collName}:`, cErr);
        }
      }

      // Clean users collection while keeping Master SuperAdmin intact
      setPurgeProgress('جاري تنظيف حسابات المستخدمين والمدراء السابقة (مع الحفاظ على الماستر)...');
      try {
        const userSnap = await getDocs(collection(db, 'users'));
        const userDocs = userSnap.docs;
        const usersToDelete = userDocs.filter(d => {
          const data = d.data();
          const email = String(data.email || '').trim().toLowerCase();
          const role = String(data.role || '').trim().toLowerCase();
          const isSuper = role === 'superadmin' || email === 'super@admin.com' || (currentUser?.uid && d.id === currentUser.uid);
          return !isSuper;
        });

        for (let i = 0; i < usersToDelete.length; i += 300) {
          const batch = writeBatch(db);
          const chunk = usersToDelete.slice(i, i + 300);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
          totalDeleted += chunk.length;
        }
      } catch (uErr) {
        console.warn('Error cleaning users collection:', uErr);
      }

      setPurgeProgress(null);
      setShowPurgeModal(false);
      setPurgeConfirmInput('');
      alert(`تم تنظيف وتصفير قاعدة البيانات بنجاح!\n\n• تم مسح كافة الحسابات والبيانات السابقة (${totalDeleted} سجل/حساب).\n• تم الحفاظ على حساب الماستر العام وقائمة المدارس.\n• النظام جاهز تماماً لإضافة الكوادر والحسابات الجديدة.`);
    } catch (err) {
      console.error('Error during database purge:', err);
      alert('حدث خطأ أثناء تنظيف قاعدة البيانات: ' + err.message);
    } finally {
      setIsPurgingDatabase(false);
      setPurgeProgress(null);
    }
  };

  // Restore / Seed all 43+ Advanced Schools Complexes
  const handleSeedAllAdvancedSchools = async () => {
    if (isSeedingSchools) return;
    if (!window.confirm('هل ترغب في استعادة وتثبيت كافة مجمعات وفروع شركة المدارس المتقدمة (43 مجمع تعليمي معتمد) الآن؟')) {
      return;
    }

    setIsSeedingSchools(true);
    setSeedingProgress('جاري فحص وتحديث قائمة المجمعات...');
    try {
      let existingNames = new Set();
      try {
        const snap = await getDocs(collection(db, 'schools'));
        existingNames = new Set(snap.docs.map(d => (d.data().name || '').trim().toLowerCase()));
      } catch (readErr) {
        console.warn("Read schools warning:", readErr);
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < ADVANCED_SCHOOLS_CATALOG.length; i++) {
        const item = ADVANCED_SCHOOLS_CATALOG[i];
        setSeedingProgress(`جاري المعالجة (${i + 1}/${ADVANCED_SCHOOLS_CATALOG.length}): ${item.name}`);

        if (existingNames.has(item.name.trim().toLowerCase())) {
          skippedCount++;
          continue;
        }

        try {
          await addDoc(collection(db, 'schools'), {
            name: item.name,
            subTitle: item.subTitle,
            city: item.city,
            track: item.track,
            code: item.code,
            address: item.address,
            isStandalone: true,
            createdAt: new Date()
          });
          existingNames.add(item.name.trim().toLowerCase());
          addedCount++;
        } catch (itemErr) {
          console.warn(`Could not add school ${item.name} to Firestore:`, itemErr);
        }
      }

      // Ensure local state always reflects the full catalog
      setSchools(ADVANCED_SCHOOLS_CATALOG.map((item, idx) => ({ id: item.code || `msc_school_${idx+1}`, ...item })));

      setSeedingProgress(null);
      alert(`تمت استعادة مجمعات شركة المدارس المتقدمة بنجاح!\n• المجمعات الجديدة المضافة: ${addedCount}\n• إجمالي المجمعات المعتمدة: ${ADVANCED_SCHOOLS_CATALOG.length}`);
    } catch (err) {
      console.error('Error seeding schools:', err);
      // Fallback: Populate local state from catalog so user is never blocked
      setSchools(ADVANCED_SCHOOLS_CATALOG.map((item, idx) => ({ id: item.code || `msc_school_${idx+1}`, ...item })));
      alert(`تم تحميل واستعادة كافة مجمعات شركة المدارس المتقدمة (${ADVANCED_SCHOOLS_CATALOG.length} مجمع تعليمي) في واجهة النظام بنجاح!`);
    } finally {
      setIsSeedingSchools(false);
      setSeedingProgress(null);
    }
  };

  // Handle Add School
  const handleAddSchool = async (e) => {
    e.preventDefault();
    if (!schoolName.trim()) return;
    setIsAddingSchool(true);
    try {
      const cleanCode = schoolCode.trim() || `school_${Date.now().toString().slice(-5)}`;
      await addDoc(collection(db, 'schools'), {
        name: schoolName.trim(),
        subTitle: schoolSubTitle.trim() || 'فرع معتمد - المسار التعليمي',
        code: cleanCode,
        city: schoolCity.trim() || 'جدة',
        track: schoolTrack || 'أهلي متقدم + STEM',
        address: schoolAddress.trim() || 'المملكة العربية السعودية',
        isStandalone: true,
        createdAt: new Date()
      });

      setSchoolName('');
      setSchoolSubTitle('');
      setSchoolCode('');
      setSchoolAddress('');
      setShowAddSchoolModal(false);
      alert('تمت إضافة المدرسة بنجاح!');
    } catch (error) {
      console.error('Error adding school:', error);
      alert('حدث خطأ أثناء إضافة المدرسة: ' + error.message);
    } finally {
      setIsAddingSchool(false);
    }
  };

  // Handle Edit School
  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    if (!editingSchool || !editingSchool.name) return;
    try {
      await updateDoc(doc(db, 'schools', editingSchool.id), {
        name: editingSchool.name,
        subTitle: editingSchool.subTitle || '',
        city: editingSchool.city || 'جدة',
        track: editingSchool.track || 'أهلي متقدم',
        address: editingSchool.address || '',
        updatedAt: new Date()
      });
      setEditingSchool(null);
      alert('تم تحديث بيانات المدرسة وعنوانها الفرعي بنجاح!');
    } catch (error) {
      console.error('Error updating school:', error);
      alert('حدث خطأ أثناء تحديث المدرسة: ' + error.message);
    }
  };

  // Handle Delete School
  const handleDeleteSchool = async (school) => {
    const hasAdmins = admins.some(a => a.schoolId === school.id);
    const confirmMsg = hasAdmins 
      ? `تحذير: المدرسة "${school.name}" مرتبطة بمدراء حاليين. هل أنت متأكد تماماً من حذفها من المنظومة؟`
      : `هل أنت متأكد من حذف مدرسة "${school.name}"؟`;
    
    if (window.confirm(confirmMsg)) {
      try {
        await deleteDoc(doc(db, 'schools', school.id));
        if (selectedSchoolScope === school.id) {
          setSelectedSchoolScope('ALL');
        }
        alert('تم حذف المدرسة بنجاح.');
      } catch (error) {
        console.error('Error deleting school:', error);
        alert('حدث خطأ أثناء حذف المدرسة.');
      }
    }
  };

  // Handle Add Admin (School Principal)
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAdminMessage('');
    setAdminError('');

    if (adminNationalId.trim().length < 4) {
      setAdminError('رقم الهوية أو البريد الإلكتروني يجب ألا يقل عن 4 خانات');
      return;
    }
    if (adminPassword.trim().length < 6) {
      setAdminError('كلمة المرور يجب ألا تقل عن 6 خانات');
      return;
    }
    if (!selectedSchoolId) {
      setAdminError('يرجى اختيار المدرسة المسند له إدارتها');
      return;
    }

    setIsAddingAdmin(true);
    try {
      const cleanNid = adminNationalId.trim();
      const adminEmail = cleanNid.includes('@') ? cleanNid.toLowerCase() : `${cleanNid}@school.local`;
      const selectedSchool = schools.find(s => s.id === selectedSchoolId);
      
      const newAdminData = {
        name: adminName.trim(),
        nationalId: cleanNid,
        email: adminEmail,
        phone: adminPhone.trim() || '',
        role: 'admin',
        schoolId: selectedSchoolId,
        schoolName: selectedSchool?.name || '',
        schoolSubTitle: selectedSchool?.subTitle || '',
        password: adminPassword.trim(),
        updatedAt: new Date(),
        createdAt: new Date()
      };

      let targetUid = null;

      // 1. Create or Authenticate via Secondary App and write directly with authenticated secondary Firestore instance
      try {
        const { user } = await createSecondaryAuthUser(adminEmail, adminPassword.trim(), newAdminData);
        if (user?.uid) {
          targetUid = user.uid;
        }
      } catch (authErr) {
        console.warn('Secondary auth notice:', authErr);
      }

      // 2. Also ensure doc is saved on primary db using merge
      try {
        if (targetUid) {
          await setDoc(doc(db, 'users', targetUid), { ...newAdminData, uid: targetUid }, { merge: true });
        } else {
          const fallbackDocId = `admin_${cleanNid.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          await setDoc(doc(db, 'users', fallbackDocId), newAdminData, { merge: true });
          targetUid = fallbackDocId;
        }
      } catch (fsErr) {
        console.warn('Primary Firestore write notice:', fsErr);
      }

      const finalAdminRecord = {
        id: targetUid || `admin_${cleanNid.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        ...newAdminData
      };

      // 3. Update local state immediately so SuperAdmin sees the new principal instantly
      setAdmins(prev => {
        const filtered = prev.filter(a => String(a.nationalId) !== cleanNid && a.email !== adminEmail);
        return [finalAdminRecord, ...filtered];
      });

      // 4. Save to local storage backup so admins list is resilient across reloads
      try {
        const savedAdmins = JSON.parse(localStorage.getItem('msc_custom_admins') || '[]');
        const updatedSaved = [finalAdminRecord, ...savedAdmins.filter(a => String(a.nationalId) !== cleanNid && a.email !== adminEmail)];
        localStorage.setItem('msc_custom_admins', JSON.stringify(updatedSaved));
      } catch (lsErr) {}

      setAdminName('');
      setAdminNationalId('');
      setAdminPassword('');
      setAdminPhone('');
      setSelectedSchoolId('');
      setShowAddAdminModal(false);
      alert(`تم إنشاء وتعيين حساب مدير المدرسة بنجاح!\n\nاسم المدير: ${finalAdminRecord.name}\nالمدرسة: ${selectedSchool?.name || ''}\nاسم الدخول: ${cleanNid}`);
    } catch (error) {
      console.error('Error adding admin:', error);
      setAdminError('حدث خطأ أثناء إنشاء الحساب: ' + error.message);
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // Handle Delete Admin - Completely wipes all records for this admin
  const handleDeleteAdmin = async (admin) => {
    const aName = admin.name || 'المدير';
    if (window.confirm(`هل أنت متأكد من حذف حساب المدير "${aName}" بالكامل من قاعدة البيانات؟`)) {
      try {
        const nid = String(admin.nationalId || '').trim();
        const email = String(admin.email || '').trim();

        // 1. Delete by document ID
        if (admin.id) {
          try {
            await deleteDoc(doc(db, 'users', admin.id));
          } catch (delErr) {
            console.warn('Doc delete notice:', delErr);
          }
        }

        // 2. Delete any matching documents by nationalId or email
        if (nid) {
          try {
            const qNidStr = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
            qNidStr.forEach(async (d) => { if (d.id !== admin.id) await deleteDoc(doc(db, 'users', d.id)); });
          } catch (e) {}
        }

        if (email) {
          try {
            const qEmail = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
            qEmail.forEach(async (d) => { await deleteDoc(doc(db, 'users', d.id)); });
          } catch (e) {}
        }

        // 3. Update local storage backup
        try {
          const local = JSON.parse(localStorage.getItem('msc_custom_admins') || '[]');
          const updated = local.filter(a => a.id !== admin.id && String(a.nationalId) !== nid && a.email !== email);
          localStorage.setItem('msc_custom_admins', JSON.stringify(updated));
        } catch (e) {}

        // 4. Update local state
        setAdmins(prev => prev.filter(a => a.id !== admin.id && String(a.nationalId) !== nid && a.email !== email));

        alert('تم حذف حساب المدير بالكامل بنجاح.');
      } catch (error) {
        console.error('Error deleting admin:', error);
        alert('حدث خطأ أثناء الحذف: ' + error.message);
      }
    }
  };

  // Handle Add Super Admin
  const handleAddSuperAdmin = async (e) => {
    e.preventDefault();
    if (superAdminNationalId.length < 6 || superAdminPassword.length < 6) {
      alert('يرجى التأكد من صحة البيانات (كلمة المرور 6 خانات على الأقل)');
      return;
    }
    setIsAddingSuperAdmin(true);
    try {
      const email = superAdminNationalId.includes('@') ? superAdminNationalId.toLowerCase() : `${superAdminNationalId}@school.local`;
      const superDoc = {
        name: superAdminName || 'ماستر عام إضافي',
        nationalId: superAdminNationalId.trim(),
        email: email,
        role: 'superadmin',
        schoolId: 'ALL',
        password: superAdminPassword.trim(),
        createdAt: new Date()
      };

      let superUid = null;
      try {
        const { user } = await createSecondaryAuthUser(email, superAdminPassword, superDoc);
        superUid = user?.uid || null;
      } catch (authErr) {
        console.warn('SuperAdmin secondary auth notice:', authErr);
      }

      try {
        if (superUid) {
          await setDoc(doc(db, 'users', superUid), { ...superDoc, uid: superUid }, { merge: true });
        } else {
          await addDoc(collection(db, 'users'), superDoc);
        }
      } catch (fsErr) {
        console.warn('Firestore write notice for superadmin:', fsErr);
      }

      setSuperAdmins(prev => [
        { id: superUid || `super_${Date.now()}`, ...superDoc },
        ...prev.filter(sa => sa.email !== email && sa.nationalId !== superAdminNationalId)
      ]);

      setSuperAdminName('');
      setSuperAdminNationalId('');
      setSuperAdminPassword('');
      setShowAddSuperAdminModal(false);
      alert('تم إنشاء حساب الماستر العام الجديد بنجاح!');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إنشاء حساب الماستر: ' + error.message);
    } finally {
      setIsAddingSuperAdmin(false);
    }
  };

  // Filtered lists based on search query and selected school scope
  const filteredSchools = useMemo(() => {
    let list = schools;
    if (selectedSchoolScope !== 'ALL') {
      list = list.filter(s => s.id === selectedSchoolScope);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(s => 
      s.name?.toLowerCase().includes(q) || 
      s.subTitle?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) || 
      s.city?.toLowerCase().includes(q) ||
      s.id?.toLowerCase().includes(q)
    );
  }, [schools, selectedSchoolScope, searchQuery]);

  const filteredAdmins = useMemo(() => {
    let list = admins;
    if (selectedSchoolScope !== 'ALL') {
      list = list.filter(a => a.schoolId === selectedSchoolScope);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(a => 
      a.name?.toLowerCase().includes(q) || 
      a.nationalId?.toLowerCase().includes(q) || 
      schools.find(s => s.id === a.schoolId)?.name?.toLowerCase().includes(q)
    );
  }, [admins, selectedSchoolScope, schools, searchQuery]);

  const filteredSuperAdmins = useMemo(() => {
    if (!searchQuery.trim()) return superAdmins;
    const q = searchQuery.toLowerCase().trim();
    return superAdmins.filter(sa => 
      sa.name?.toLowerCase().includes(q) || 
      sa.nationalId?.toLowerCase().includes(q) ||
      sa.email?.toLowerCase().includes(q)
    );
  }, [superAdmins, searchQuery]);

  // Active School Object (if single school is selected in dropdown)
  const activeScopeSchool = useMemo(() => {
    if (selectedSchoolScope === 'ALL') return null;
    return schools.find(s => s.id === selectedSchoolScope);
  }, [schools, selectedSchoolScope]);

  // Quick Export Data as CSV
  const handleExportData = (type) => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    let filename = `export_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'schools') {
      csvContent += "اسم المدرسة / المجمع,العنوان الفرعي للمدرسة,المعرف (Code),المدينة,المسار التعليمي,المدير المعين\n";
      schools.forEach(s => {
        const assignedAdmin = admins.find(a => a.schoolId === s.id)?.name || 'غير معين';
        csvContent += `"${s.name || ''}","${s.subTitle || ''}","${s.code || s.id || ''}","${s.city || ''}","${s.track || ''}","${assignedAdmin}"\n`;
      });
    } else if (type === 'admins') {
      csvContent += "اسم المدير,رقم الهوية,المدرسة / المجمع المعين,البريد الإلكتروني,رقم الهاتف\n";
      admins.forEach(a => {
        const school = schools.find(s => s.id === a.schoolId);
        const schoolDisplay = school ? `${school.name} (${school.subTitle || school.city || ''})` : 'غير محدد';
        csvContent += `"${a.name || ''}","${a.nationalId || ''}","${schoolDisplay}","${a.email || ''}","${a.phone || ''}"\n`;
      });
    } else {
      csvContent += "المؤشر,العدد الإجمالي\n";
      csvContent += `إجمالي المدارس,${schools.length}\n`;
      csvContent += `مدراء المدارس,${admins.length}\n`;
      csvContent += `إجمالي المعلمين,${stats.teachers}\n`;
      csvContent += `إجمالي الطلاب,${stats.students}\n`;
      csvContent += `الكوادر والمشرفين,${stats.staff + stats.supervisors}\n`;
      csvContent += `حسابات الماستر العام,${superAdmins.length}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: '4px' }}>
      
      {/* 1. Grand Hero Banner (Super Master Portal) */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #0082a6 0%, #088395 45%, #0a7ea4 100%)',
          borderRadius: '24px',
          padding: '28px 32px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 25px -5px rgba(0, 130, 166, 0.35), 0 8px 10px -6px rgba(0, 130, 166, 0.2)'
        }}
      >
        {/* Decorative background glow circles */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          left: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-50px',
          right: '-20px',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Title & Shield Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={26} color="#ffffff" />
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
              لوحة تحكم الماستر العام (Super Master Portal)
            </h1>
          </div>

          {/* Subtitle description */}
          <p style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            lineHeight: '1.7',
            color: 'rgba(255, 255, 255, 0.92)',
            maxWidth: '900px',
            fontWeight: 500
          }}>
            إدارة المنظومة التعليمية الشاملة متعددة المدارس — إضافة وتخصيص أي مدرسة أو مجمع تعليمي، تعيين وتوزيع المدراء، والمتابعة المركزية لكافة الحسابات والإحصائيات.
          </p>

          {/* Standalone School Selector Dropdown */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '16px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building2 size={20} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                  تصفح واستعراض مدرسة محددة:
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                  اختر أي مدرسة لاستعراض عنوانها الفرعي وبياناتها وإحصائياتها
                </div>
              </div>
            </div>

            <select
              value={selectedSchoolScope}
              onChange={(e) => setSelectedSchoolScope(e.target.value)}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                minWidth: '320px',
                maxWidth: '100%',
                outline: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
              }}
            >
              <option value="ALL">🌐 كافة المدارس والمجمعات (المنظومة المركزية الكاملة)</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>
                  🏫 {s.name} — {s.subTitle || s.city || 'الفرع المعتمد'}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons in Banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setDirectTransferForm({
                  targetSchoolId: selectedSchoolScope !== 'ALL' ? selectedSchoolScope : (schools[0]?.id || 'msc_jed_smart_boys'),
                  type: 'need',
                  subject: 'الرياضيات العامة',
                  customSubject: '',
                  track: 'national',
                  gender: 'boys',
                  stage: 'primary',
                  teacherName: '',
                  requiredPeriods: 20,
                  reason: ''
                });
                setShowDirectTransferModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={18} strokeWidth={3} />
              <span>إصدار قرار سد عجز وتكليف كادر</span>
            </button>

            <button
              onClick={() => {
                setDirectDirectiveForm({
                  targetSchoolId: selectedSchoolScope,
                  subject: 'الرياضيات العامة',
                  customSubject: '',
                  title: 'توجيه وقرار إداري رسمي',
                  content: '',
                  urgency: 'high',
                  assignedTeacherName: ''
                });
                setShowDirectDirectiveModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={18} />
              <span>إرسال توجيه إداري فوري</span>
            </button>

            <button
              onClick={() => navigate('/superadmin/resources')}
              style={{
                background: 'linear-gradient(135deg, #0d9488, #0369a1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '30px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(13, 148, 136, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(13, 148, 136, 0.3)';
              }}
            >
              <Layers size={18} strokeWidth={2.5} />
              <span>إدارة موارد الشركة وتنقلات المعلمين</span>
            </button>

            <button
              onClick={() => setShowAddSchoolModal(true)}
              style={{
                background: '#ffffff',
                color: '#0082a6',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.12)';
              }}
            >
              <Plus size={18} strokeWidth={3} />
              <span>إضافة مدرسة جديدة</span>
            </button>

            <button
              onClick={() => setShowAddAdminModal(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.16)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '30px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.26)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <UserPlus size={18} />
              <span>إنشاء حساب مدير</span>
            </button>

            <button
              onClick={() => { setPurgeConfirmInput(''); setShowPurgeModal(true); }}
              style={{
                background: 'rgba(239, 68, 68, 0.22)',
                color: '#fee2e2',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '30px',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.38)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title="تنظيف وتصفير كافة الحسابات والبيانات السابقة"
            >
              <Trash2 size={18} color="#fca5a5" />
              <span>تنظيف وتصفير قاعدة البيانات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Standalone School Scope Active Alert Box */}
      {activeScopeSchool && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#dcfce7',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                  {activeScopeSchool.name}
                </h3>
                <span style={{
                  background: '#0e7490',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  فرع معتمد
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                📍 العنوان الفرعي: {activeScopeSchool.subTitle || 'المسار الأهلي والدبلومة الأمريكية'} • المدينة: {activeScopeSchool.city || 'جدة'} • كود: {activeScopeSchool.code || activeScopeSchool.id}
              </div>
            </div>
          </div>

          <button
            onClick={() => setSelectedSchoolScope('ALL')}
            className="btn btn-outline"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              color: '#166534',
              borderColor: '#86efac',
              background: '#ffffff'
            }}
          >
            عرض كافة المدارس
          </button>
        </div>
      )}

      {/* 📢 Master Incoming Transfer & Surplus-Deficit Requests Board */}
      {incomingTransferRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          borderRadius: '18px',
          border: '1.5px solid #cbd5e1',
          padding: '22px 24px',
          boxShadow: '0 4px 18px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0d9488, #0369a1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)'
              }}>
                <Layers size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  طلبات سد العجز والندب الواردة من المدارس (بانتظار اعتماد الماستر)
                </h3>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                  مراجعة واعتماد طلبات الاستعانة وتكليف المعلمين وتوجيه القرارات الإدارية للمدارس لحظياً
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setDirectTransferForm({
                    targetSchoolId: selectedSchoolScope !== 'ALL' ? selectedSchoolScope : (schools[0]?.id || 'msc_jed_smart_boys'),
                    type: 'need',
                    subject: 'الرياضيات العامة',
                    customSubject: '',
                    track: 'national',
                    gender: 'boys',
                    stage: 'primary',
                    teacherName: '',
                    requiredPeriods: 20,
                    reason: ''
                  });
                  setShowDirectTransferModal(true);
                }}
                className="btn btn-primary"
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  padding: '7px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '10px'
                }}
              >
                <Plus size={15} />
                <span>+ قرار سد عجز وتكليف كادر</span>
              </button>

              <button
                onClick={() => {
                  setDirectDirectiveForm({
                    targetSchoolId: selectedSchoolScope,
                    subject: 'الرياضيات العامة',
                    customSubject: '',
                    title: 'توجيه وقرار إداري رسمي',
                    content: '',
                    urgency: 'high',
                    assignedTeacherName: ''
                  });
                  setShowDirectDirectiveModal(true);
                }}
                className="btn btn-primary"
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                  border: 'none',
                  padding: '7px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '10px'
                }}
              >
                <Send size={15} />
                <span>+ إرسال توجيه إداري</span>
              </button>

              <button
                onClick={() => navigate('/superadmin/resources')}
                className="btn btn-outline"
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#0d9488',
                  borderColor: '#0d9488',
                  padding: '7px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '10px'
                }}
              >
                <span>منصة الموارد الكاملة</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
            {incomingTransferRequests.slice(0, 6).map(req => {
              const isMasterDirective = Boolean(req.isDirective || req.requesterRole === 'superadmin' || req.source === 'master');
              const subjectDisplay = req.subject || req.customSubject || req.subjectName || req.title || 'مادة دراسية';
              const periodsDisplay = req.requiredPeriods || req.periodsCount || req.currentLoad || req.periods || null;
              const teacherDisplay = req.teacherName || req.assignedTeacherName || (req.type === 'need' ? (isMasterDirective ? 'كادر معتمد ومكلف من الماستر' : '🚨 طلب سد عجز (بانتظار توفير وترشيح كادر من الماستر)') : 'كادر معتمد للتوجيه');
              const trackDisplay = req.track === 'international' ? 'مسار دولي' : 'مسار أهلي';
              const genderDisplay = req.gender === 'girls' ? 'بنات' : 'بنين';
              const stageDisplay = req.stage === 'primary' ? 'الابتدائية' : req.stage === 'middle' ? 'المتوسطة' : req.stage === 'high' ? 'الثانوية' : req.stage === 'kindergarten' ? 'رياض الأطفال' : '';
              const schoolDisplay = req.targetSchoolName || req.schoolName || '';
              const isApproved = req.status === 'approved';
              const isAcknowledged = req.status === 'acknowledged';
              const isRejected = req.status === 'rejected';

              return (
                <div
                  key={req.id}
                  style={{
                    background: isMasterDirective ? 'linear-gradient(135deg, rgba(245, 243, 255, 0.7), rgba(255, 255, 255, 0.95))' : '#ffffff',
                    border: isMasterDirective ? '1.5px solid #818cf8' : (isApproved || isAcknowledged ? '1.5px solid #86efac' : isRejected ? '1.5px solid #fca5a5' : '1.5px solid #38bdf8'),
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isMasterDirective ? '#e0e7ff' : (req.type === 'need' ? '#fee2e2' : '#dbeafe'),
                        color: isMasterDirective ? '#4338ca' : (req.type === 'need' ? '#991b1b' : '#3730a3')
                      }}>
                        {isMasterDirective 
                          ? '📢 قرار وتوجيه إداري من الماستر' 
                          : (req.type === 'need' ? '🚨 طلب سد عجز وارد من المدرسة' : '🌟 إتاحة وندب كادر فائض')}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                        {req.requestNumber || `#TR-${(req.id || '').slice(0, 5).toUpperCase()}`}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      📚 مادة {subjectDisplay} {periodsDisplay ? `• (${periodsDisplay} حصة أسبوعية)` : ''}
                    </h4>

                    <div style={{ fontSize: '12.5px', color: '#0f766e', fontWeight: 700, marginBottom: '4px' }}>
                      👤 {teacherDisplay}
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{trackDisplay}</span>
                      <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{genderDisplay}</span>
                      {stageDisplay && <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{stageDisplay}</span>}
                      {schoolDisplay && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>🏫 {schoolDisplay}</span>}
                    </div>

                    {req.reason && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                        📝 <strong>البيان:</strong> {req.reason}
                      </p>
                    )}

                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                      {isMasterDirective ? (
                        <span>📢 <strong style={{ color: '#4338ca' }}>الصادر من: الإدارة العامة (الماستر العام)</strong> • موجه إلى: <strong style={{ color: '#0f766e' }}>{req.targetSchoolName || req.toSchoolName || req.schoolName}</strong> • {new Date(req.createdAt).toLocaleDateString('ar-SA')}</span>
                      ) : (
                        <span>📩 <strong style={{ color: '#b91c1c' }}>مقدم الطلب: {req.requesterName || 'مدير المدرسة'}</strong> ({req.fromSchoolName || req.schoolName}) • موجه إلى: <strong style={{ color: '#4338ca' }}>الإدارة العامة والماستر</strong> • {new Date(req.createdAt).toLocaleDateString('ar-SA')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 800 }}>
                      {isAcknowledged ? (
                        <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> تم الاستلام والتوثيق لدى المدرسة
                        </span>
                      ) : isApproved ? (
                        <span style={{ color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> تم الاعتماد والتوجيه
                        </span>
                      ) : isRejected ? (
                        <span style={{ color: '#dc2626' }}>✕ مرفوض</span>
                      ) : (
                        <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={14} /> بانتظار اعتماد الماستر
                        </span>
                      )}
                    </span>

                    {/* Master Actions */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!isApproved && !isAcknowledged ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedRequestForApproval(req);
                              setAssignedTeacherInput(req.teacherName || '');
                              setShowApprovalModal(true);
                            }}
                            className="btn btn-primary"
                            style={{
                              padding: '6px 14px',
                              fontSize: '12px',
                              background: 'linear-gradient(135deg, #16a34a, #15803d)',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 800,
                              borderRadius: '8px'
                            }}
                          >
                            <Check size={14} /> اعتماد وتكليف
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('هل أنت متأكد من رفض هذا الطلب؟')) {
                                handleUpdateTransferStatus(req.id, 'rejected');
                              }
                            }}
                            className="btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              fontWeight: 700,
                              borderRadius: '8px'
                            }}
                          >
                            <X size={14} /> رفض
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm('هل تريد إعادة فتح هذا الطلب وجعله قيد الدراسة مرة أخرى؟')) {
                              handleUpdateTransferStatus(req.id, 'pending');
                            }
                          }}
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '11px', color: '#64748b', borderRadius: '6px' }}
                        >
                          <RefreshCw size={12} /> إعادة فتح
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Master Approval & Teacher Assignment */}
      {showApprovalModal && selectedRequestForApproval && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '520px', background: 'white', padding: '24px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => { setShowApprovalModal(false); setSelectedRequestForApproval(null); }}
              style={{ position: 'absolute', left: '18px', top: '18px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', color: '#166534',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Check size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#166534', fontWeight: 800 }}>
                  اعتماد طلب سد العجز وتكليف الكادر
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  المدرسة: {selectedRequestForApproval.targetSchoolName || selectedRequestForApproval.schoolName}
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '14px', fontSize: '13px' }}>
              <div>📚 <strong>المادة:</strong> {selectedRequestForApproval.subject || selectedRequestForApproval.customSubject} ({selectedRequestForApproval.requiredPeriods || 20} حصة)</div>
              <div>🏫 <strong>المسار والقسم:</strong> {selectedRequestForApproval.track === 'international' ? 'دولي' : 'أهلي'} • {selectedRequestForApproval.gender === 'girls' ? 'بنات' : 'بنين'}</div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#0f172a' }}>
                اسم المعلم المكلف (اختياري / أو اترك فارغاً للاعتماد المباشر):
              </label>
              <input
                type="text"
                className="input-field"
                value={assignedTeacherInput}
                onChange={(e) => setAssignedTeacherInput(e.target.value)}
                placeholder="مثال: أ. خالد بن فهد الدوسري"
                style={{ fontSize: '13.5px' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                💡 سيصل إشعار فوري لمدير المدرسة بقرار الاعتماد وبيانات المعلم فور التأكيد.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowApprovalModal(false); setSelectedRequestForApproval(null); }}
                className="btn btn-outline"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateTransferStatus(selectedRequestForApproval.id, 'approved', assignedTeacherInput)}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 800
                }}
              >
                <Check size={16} />
                <span>{isUpdatingStatus ? 'جاري الاعتماد...' : 'تأكيد الاعتماد والتوجيه الآن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Direct Transfer / Need Directive from Master */}
      {showDirectTransferModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowDirectTransferModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#991b1b', fontWeight: 800 }}>
                  إصدار قرار وتكليف سد عجز لمدرسة
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  توجيه رسمي فوري من الإدارة العامة والماستر إلى مدير المجمع والفرع
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateDirectTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px', borderRadius: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '6px' }}>
                  المدرسة / مدير المدرسة الموجه إليه القرار الإداري *
                </label>
                <select
                  className="input-field"
                  required
                  value={directTransferForm.targetSchoolId}
                  onChange={(e) => setDirectTransferForm({ ...directTransferForm, targetSchoolId: e.target.value })}
                  style={{ borderColor: '#f87171', fontWeight: 600 }}
                >
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.subTitle || s.city || 'الفرع المعتمد'})</option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px', display: 'block' }}>
                  💡 سيصل هذا القرار والتوجيه فوراً إلى لوحة تحكم مدير الفرع المختار بدون أي تأخير.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>نوع القرار *</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="mDirectReqType"
                      value="need"
                      checked={directTransferForm.type === 'need'}
                      onChange={() => setDirectTransferForm({ ...directTransferForm, type: 'need' })}
                    />
                    <span>🚨 قرار تكليف لسد عجز</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="mDirectReqType"
                      value="release"
                      checked={directTransferForm.type === 'release'}
                      onChange={() => setDirectTransferForm({ ...directTransferForm, type: 'release' })}
                    />
                    <span>🌟 قرار ندب كادر فائض</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المادة الدراسية / التخصص *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={directTransferForm.subject}
                  onChange={(e) => setDirectTransferForm({ ...directTransferForm, subject: e.target.value })}
                  placeholder="مثال: الرياضيات، اللغة الإنجليزية، العلوم..."
                  style={{ fontWeight: 600 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المسار التعليمي *</label>
                  <select
                    className="input-field"
                    value={directTransferForm.track}
                    onChange={(e) => setDirectTransferForm({ ...directTransferForm, track: e.target.value })}
                  >
                    <option value="national">المسار الأهلي المطور</option>
                    <option value="international">المسار الدولي / الدبلومة الأمريكية</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>القسم (الجنس) *</label>
                  <select
                    className="input-field"
                    value={directTransferForm.gender}
                    onChange={(e) => setDirectTransferForm({ ...directTransferForm, gender: e.target.value })}
                  >
                    <option value="boys">بنين (Boys)</option>
                    <option value="girls">بنات (Girls)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>اسم المعلم المكلف (اختياري)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={directTransferForm.teacherName}
                    onChange={(e) => setDirectTransferForm({ ...directTransferForm, teacherName: e.target.value })}
                    placeholder="اسم المعلم الرباعي"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عدد الحصص الأسبوعية *</label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    value={directTransferForm.requiredPeriods}
                    onChange={(e) => setDirectTransferForm({ ...directTransferForm, requiredPeriods: Number(e.target.value) })}
                    min="1"
                    max="40"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  التعليمات والتوجيهات الإدارية المرفقة لمدير المدرسة
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={directTransferForm.reason}
                  onChange={(e) => setDirectTransferForm({ ...directTransferForm, reason: e.target.value })}
                  placeholder="اكتب التعليمات والقرارات الإدارية للمدير بخصوص تغطية الحصص والندب..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowDirectTransferModal(false)} className="btn btn-outline">
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700
                  }}
                >
                  <Send size={16} />
                  <span>إرسال وتوجيه القرار لمدير المدرسة فوراً</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Direct Administrative Directive from Master */}
      {showDirectDirectiveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowDirectDirectiveModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#4338ca', fontWeight: 800 }}>
                  إرسال توجيه إداري فوري من الماستر
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  إرسال تعميم أو قرار إداري مباشر لكافة المدارس أو مجمع محدد
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateDirectDirective} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#4338ca', marginBottom: '6px' }}>
                  الجهة الموجه إليها التوجيه *
                </label>
                <select
                  className="input-field"
                  value={directDirectiveForm.targetSchoolId}
                  onChange={(e) => setDirectDirectiveForm({ ...directDirectiveForm, targetSchoolId: e.target.value })}
                  style={{ fontWeight: 600 }}
                >
                  <option value="ALL">🌐 كافة فروع ومجمعات الشركة (تعميم وزاري / إداري عام)</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>🏫 {s.name} ({s.subTitle || s.city || 'الفرع المعتمد'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عنوان التوجيه / القرار *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={directDirectiveForm.title}
                  onChange={(e) => setDirectDirectiveForm({ ...directDirectiveForm, title: e.target.value })}
                  placeholder="مثال: تعميم بشأن خطة التسكين وتغطية الحصص الشاغرة"
                  style={{ fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المادة / المجال المعني</label>
                <input
                  type="text"
                  className="input-field"
                  value={directDirectiveForm.subject}
                  onChange={(e) => setDirectDirectiveForm({ ...directDirectiveForm, subject: e.target.value })}
                  placeholder="مثال: الرياضيات العامة، الكوادر التعليمية، الإشراف..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>نص التوجيه والقرار الإداري *</label>
                <textarea
                  className="input-field"
                  required
                  rows="4"
                  value={directDirectiveForm.content}
                  onChange={(e) => setDirectDirectiveForm({ ...directDirectiveForm, content: e.target.value })}
                  placeholder="اكتب تفاصيل التوجيه الإداري والمطلوب من مدير المدرسة تنفيذه وتأكيد استلامه..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowDirectDirectiveModal(false)} className="btn btn-outline">
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700
                  }}
                >
                  <Send size={16} />
                  <span>إرسال التوجيه الإداري الآن</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Five Real-time Stat Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', 
        gap: '14px' 
      }}>
        {/* Card 1: إجمالي المدارس */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #0284c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              {selectedSchoolScope === 'ALL' ? 'إجمالي المدارس' : 'المدرسة المحددة'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
              {selectedSchoolScope === 'ALL' ? schools.length : 1}
            </div>
          </div>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(2, 132, 199, 0.1)',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={22} />
          </div>
        </div>

        {/* Card 2: مدراء المدارس */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              {selectedSchoolScope === 'ALL' ? 'مدراء المدارس' : 'المدير المسؤول'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
              {filteredAdmins.length}
            </div>
          </div>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(37, 99, 235, 0.1)',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* Card 3: إجمالي المعلمين */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              {selectedSchoolScope === 'ALL' ? 'إجمالي المعلمين' : 'معلمو المدرسة'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
              {selectedSchoolScope === 'ALL' ? stats.teachers : selectedSchoolCounts.teachers}
            </div>
          </div>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BookOpen size={22} />
          </div>
        </div>

        {/* Card 4: إجمالي الطلاب */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #8b5cf6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              {selectedSchoolScope === 'ALL' ? 'إجمالي الطلاب' : 'طلاب المدرسة'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
              {selectedSchoolScope === 'ALL' ? stats.students : selectedSchoolCounts.students}
            </div>
          </div>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.1)',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <GraduationCap size={22} />
          </div>
        </div>

        {/* Card 5: الكوادر والمشرفين */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              {selectedSchoolScope === 'ALL' ? 'الكوادر والمشرفين' : 'كوادر المدرسة'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
              {selectedSchoolScope === 'ALL' ? (stats.staff + stats.supervisors) : (selectedSchoolCounts.staff + selectedSchoolCounts.supervisors)}
            </div>
          </div>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={22} />
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        marginTop: '6px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => { setActiveTab('schools'); setSearchQuery(''); }}
          style={{
            background: activeTab === 'schools' ? '#0082a6' : '#ffffff',
            color: activeTab === 'schools' ? '#ffffff' : '#475569',
            border: `1px solid ${activeTab === 'schools' ? '#0082a6' : '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '9px 18px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'schools' ? '0 4px 12px rgba(0, 130, 166, 0.25)' : 'none'
          }}
        >
          <Building2 size={17} />
          <span>المدارس والمجمعات ({filteredSchools.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('admins'); setSearchQuery(''); }}
          style={{
            background: activeTab === 'admins' ? '#0082a6' : '#ffffff',
            color: activeTab === 'admins' ? '#ffffff' : '#475569',
            border: `1px solid ${activeTab === 'admins' ? '#0082a6' : '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '9px 18px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'admins' ? '0 4px 12px rgba(0, 130, 166, 0.25)' : 'none'
          }}
        >
          <ShieldCheck size={17} />
          <span>مدراء المدارس ({filteredAdmins.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('superadmins'); setSearchQuery(''); }}
          style={{
            background: activeTab === 'superadmins' ? '#0082a6' : '#ffffff',
            color: activeTab === 'superadmins' ? '#ffffff' : '#475569',
            border: `1px solid ${activeTab === 'superadmins' ? '#0082a6' : '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '9px 18px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'superadmins' ? '0 4px 12px rgba(0, 130, 166, 0.25)' : 'none'
          }}
        >
          <Lock size={17} />
          <span>حسابات الماستر العام ({superAdmins.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('reports'); setSearchQuery(''); }}
          style={{
            background: activeTab === 'reports' ? '#0082a6' : '#ffffff',
            color: activeTab === 'reports' ? '#ffffff' : '#475569',
            border: `1px solid ${activeTab === 'reports' ? '#0082a6' : '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '9px 18px',
            fontSize: '14px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'reports' ? '0 4px 12px rgba(0, 130, 166, 0.25)' : 'none'
          }}
        >
          <FileSpreadsheet size={17} />
          <span>التقارير والتصدير</span>
        </button>
      </div>

      {/* 4. Search and Toolbar Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div style={{
          position: 'relative',
          flex: '1',
          minWidth: '260px',
          maxWidth: '460px'
        }}>
          <input
            type="text"
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'schools' ? "البحث عن مدرسة، عنوان فرعي، مجمع، أو كود..." :
              activeTab === 'admins' ? "البحث باسم المدير أو رقم الهوية أو المدرسة..." :
              activeTab === 'superadmins' ? "البحث في حسابات الماستر..." :
              "البحث في بيانات التقارير..."
            }
            style={{
              paddingRight: isRTL ? '40px' : '14px',
              paddingLeft: !isRTL ? '40px' : '14px',
              background: '#ffffff',
              borderRadius: '12px',
              fontSize: '13px'
            }}
          />
          <Search 
            size={18} 
            color="#94a3b8" 
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              right: isRTL ? '14px' : 'auto',
              left: !isRTL ? '14px' : 'auto',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* Tab Specific Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'schools' && (
            <>
              <button 
                className="btn"
                onClick={handleSeedAllAdvancedSchools}
                disabled={isSeedingSchools}
                style={{
                  background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isSeedingSchools ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)'
                }}
                title="استعادة وإضافة كافة مجمعات وفروع شركة المدارس المتقدمة"
              >
                {isSeedingSchools ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} color="#fed7aa" />}
                <span>{isSeedingSchools ? 'جاري الاستعادة...' : 'استعادة مجمعات المدارس المتقدمة (43 مجمع)'}</span>
              </button>

              <button 
                className="btn btn-primary"
                onClick={() => setShowAddSchoolModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              >
                <Plus size={16} />
                <span>إضافة مدرسة</span>
              </button>
            </>
          )}

          {activeTab === 'admins' && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddAdminModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <UserPlus size={16} />
              <span>إنشاء مدير جديد</span>
            </button>
          )}

          {activeTab === 'superadmins' && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddSuperAdminModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Plus size={16} />
              <span>إنشاء حساب ماستر</span>
            </button>
          )}
        </div>
      </div>

      {/* Seeding Progress Notification */}
      {seedingProgress && (
        <div style={{
          background: 'linear-gradient(135deg, #0e7490, #0369a1)',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: '600',
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)'
        }}>
          <RefreshCw size={18} className="animate-spin" />
          <span>{seedingProgress}</span>
        </div>
      )}

      {/* 5. Tab Content Sections */}

      {/* Tab 1: المدارس والمجمعات */}
      {activeTab === 'schools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredSchools.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
              <Building2 size={56} color="#0e7490" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', color: '#0f172a', fontWeight: 800, fontSize: '18px' }}>لا توجد مجمعات مسجلة حالياً</h3>
              <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px', maxWidth: '520px', marginInline: 'auto' }}>
                يمكنك بنقرة زر واحدة استعادة كافة مجمعات وفروع <strong>شركة المدارس المتقدمة</strong> المعتمدة (43 مجمع تعليمي معتمد) مع عناوينها الفرعية ومساراتها التعليمية ومدنها.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button 
                  className="btn"
                  onClick={handleSeedAllAdvancedSchools}
                  disabled={isSeedingSchools}
                  style={{
                    background: 'linear-gradient(135deg, #0e7490, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 22px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: isSeedingSchools ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(14, 116, 144, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSeedingSchools ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  <span>{isSeedingSchools ? 'جاري الاستعادة...' : 'استعادة كافة مجمعات شركة المدارس المتقدمة فوراً (43 مجمع)'}</span>
                </button>
                <button className="btn btn-secondary" onClick={() => setShowAddSchoolModal(true)} style={{ padding: '10px 18px', fontSize: '14px' }}>
                  <Plus size={16} /> إضافة مجمع يدوياً
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredSchools.map((school) => {
                const assignedAdmin = admins.find(a => a.schoolId === school.id);
                return (
                  <div 
                    key={school.id}
                    className="glass-panel"
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '20px',
                      border: selectedSchoolScope === school.id ? '2px solid #0e7490' : '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      {/* Top row with school icon and track */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(0, 130, 166, 0.1), rgba(2, 132, 199, 0.15))',
                            color: '#0082a6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800
                          }}>
                            <Building2 size={24} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                              {school.name}
                            </h3>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              كود المجمع: <strong style={{ color: '#0082a6' }}>{school.code || school.id}</strong>
                            </span>
                          </div>
                        </div>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0e7490',
                          background: 'rgba(14, 116, 144, 0.08)',
                          padding: '3px 8px',
                          borderRadius: '8px'
                        }}>
                          {school.city || 'جدة'}
                        </span>
                      </div>

                      {/* School Sub-title (العنوان الفرعي) */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        color: '#0e7490',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '10px'
                      }}>
                        <MapPin size={14} color="#0e7490" />
                        <span>العنوان الفرعي: <strong>{school.subTitle || 'فرع مستقل - المسار المعتمد'}</strong></span>
                      </div>

                      {/* Educational Track badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                        <Compass size={14} color="#0082a6" />
                        <span>المسار: <strong>{school.track || 'أهلي متقدم + STEM'}</strong></span>
                      </div>

                      {/* Assigned Principal Box */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={16} color="#2563eb" />
                          <span style={{ color: '#64748b' }}>المدير:</span>
                          <strong style={{ color: assignedAdmin ? '#0f172a' : '#94a3b8' }}>
                            {assignedAdmin ? assignedAdmin.name : 'لم يتم تعيين مدير بعد'}
                          </strong>
                        </div>
                        {assignedAdmin && (
                          <span style={{ color: '#64748b', fontSize: '11px' }}>
                            ({assignedAdmin.nationalId})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* School Actions Bottom Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        onClick={() => setSelectedSchoolScope(school.id)}
                        style={{
                          background: selectedSchoolScope === school.id ? '#0082a6' : 'rgba(0, 130, 166, 0.08)',
                          color: selectedSchoolScope === school.id ? '#ffffff' : '#0082a6',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '8px'
                        }}
                      >
                        <Eye size={13} /> {selectedSchoolScope === school.id ? 'معروضة حالياً' : 'تصفح بياناتها'}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => setEditingSchool(school)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#0082a6',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          <Edit size={14} /> تعديل
                        </button>

                        <button
                          onClick={() => handleDeleteSchool(school)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          <Trash2 size={14} /> حذف
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: مدراء المدارس */}
      {activeTab === 'admins' && (
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#2563eb" /> قائمة مدراء المدارس والمجمعات التعليمية
            </h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              إجمالي المدراء: <strong>{filteredAdmins.length}</strong>
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم المدير</th>
                  <th>رقم الهوية (اسم المستخدم)</th>
                  <th>كلمة المرور المعينة</th>
                  <th>المدرسة / المجمع والعنوان الفرعي</th>
                  <th>البريد الإلكتروني</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map(admin => {
                  const assignedSchool = schools.find(s => s.id === admin.schoolId);
                  return (
                    <tr key={admin.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        {admin.name}
                      </td>
                      <td style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>
                        {admin.nationalId}
                      </td>
                      <td>
                        {admin.password ? (
                          <span style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: '12px'
                          }}>
                            🔑 {admin.password}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>افتراضية (الهوية)</span>
                        )}
                      </td>
                      <td>
                        {assignedSchool ? (
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 700
                            }}>
                              <Building2 size={13} /> {assignedSchool.name}
                            </span>
                            {assignedSchool.subTitle && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                                📍 {assignedSchool.subTitle}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>غير مخصص</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {admin.email || `${admin.nationalId}@school.local`}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteAdmin(admin)}
                          className="btn-icon delete"
                          title="حذف حساب المدير"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredAdmins.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      لا يوجد مدراء مطابقين للبحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: حسابات الماستر العام */}
      {activeTab === 'superadmins' && (
        <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} color="#0082a6" /> حسابات الماستر العام والإشراف الأعلى
            </h3>
            <button className="btn btn-primary" onClick={() => setShowAddSuperAdminModal(true)} style={{ fontSize: '13px' }}>
              <Plus size={16} /> إضافة ماستر عام
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم الماستر</th>
                  <th>اسم المستخدم / الهوية</th>
                  <th>البريد الإلكتروني</th>
                  <th>الصلاحيات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuperAdmins.map(sa => (
                  <tr key={sa.id}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{sa.name || 'حساب الماستر العام'}</td>
                    <td style={{ fontFamily: 'monospace', color: '#0082a6', fontWeight: 600 }}>{sa.nationalId}</td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>{sa.email || `${sa.nationalId}@school.local`}</td>
                    <td>
                      <span style={{
                        background: '#ecfdf5',
                        color: '#059669',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        صلاحية عليا وإشراف عام على كافة المدارس (ALL)
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>نشط</span>
                    </td>
                  </tr>
                ))}
                {filteredSuperAdmins.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      لا يوجد حسابات ماستر مسجلة في قائمة المستخدمين
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: التقارير والتصدير */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={20} color="#0082a6" /> مركز التصدير الشامل لبيانات المنظومة التعليمية
            </h3>
            
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              يمكنك تصدير تقارير وإحصائيات مركزية شاملة لجميع المدارس والمجمعات والكوادر بصيغة Excel / CSV بضغطة زر واحدة:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    بيانات المدارس والمجمعات والعناوين الفرعية
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    تصدير قائمة كاملة بالمدارس، العناوين الفرعية، الأكواد، المدن، والمدراء المعينين.
                  </p>
                </div>
                <button
                  onClick={() => handleExportData('schools')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', width: '100%' }}
                >
                  <FileSpreadsheet size={16} /> تصدير جدول المدارس (CSV)
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    سجل مدراء المدارس
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    تصدير قائمة حسابات المدراء مع الهويات والمدارس المعينة.
                  </p>
                </div>
                <button
                  onClick={() => handleExportData('admins')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', width: '100%' }}
                >
                  <FileSpreadsheet size={16} /> تصدير جدول المدراء (CSV)
                </button>
              </div>

              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    الإحصائية الرقمية العامة
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    ملخص شامل لإحصائيات المنظومة والكوادر والطلاب والمدارس.
                  </p>
                </div>
                <button
                  onClick={() => handleExportData('summary')}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', width: '100%' }}
                >
                  <Download size={16} /> تحميل التقرير الإحصائي
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Add School Modal */}
      {showAddSchoolModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowAddSchoolModal(false)}
        >
          <div 
            className="glass-panel"
            style={{
              background: '#ffffff',
              width: '540px',
              maxWidth: '100%',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddSchoolModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                left: isRTL ? '18px' : 'auto',
                right: !isRTL ? '18px' : 'auto',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(0, 130, 166, 0.1)',
                color: '#0082a6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  إضافة مدرسة / مجمع تعليمي جديد
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  تضمين مدرسة جديدة مع عنوانها الفرعي ومساراتها التعليمية
                </span>
              </div>
            </div>

            <form onSubmit={handleAddSchool} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  اسم المدرسة / المجمع التعليمي <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: مدارس المتقدمة للتعلم الذكي"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  العنوان الفرعي للمدرسة (الفرع والمسار) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: فرع حي الزهراء - المسار الأهلي والدبلومة الأمريكية"
                  value={schoolSubTitle}
                  onChange={(e) => setSchoolSubTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    المدينة / المنطقة <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="مثال: جدة"
                    value={schoolCity}
                    onChange={(e) => setSchoolCity(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    كود المجمع / الفرع (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="مثال: msc_jed_smart"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  المسار التعليمي
                </label>
                <select
                  className="input-field"
                  value={schoolTrack}
                  onChange={(e) => setSchoolTrack(e.target.value)}
                >
                  <option value="أهلي متقدم + STEM">أهلي متقدم + STEM</option>
                  <option value="عالمي International (دبلومة أمريكية)">عالمي International (دبلومة أمريكية)</option>
                  <option value="مدارس تحفيظ القرآن الكريم">مدارس تحفيظ القرآن الكريم</option>
                  <option value="مسار أهلي شامل لكافة المراحل">مسار أهلي شامل لكافة المراحل</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  العنوان الجغرافي التفصيلي
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: حي الزهراء، شارع الأمير سلطان، جدة"
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={isAddingSchool}
                >
                  {isAddingSchool ? 'جاري الإضافة...' : 'حفظ وإضافة المدرسة'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddSchoolModal(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: إضافة مدير مدرسة جديد */}
      {showAddAdminModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowAddAdminModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                left: isRTL ? '18px' : 'auto',
                right: !isRTL ? '18px' : 'auto',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <UserPlus size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  إنشاء حساب مدير مدرسة جديد
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  تعيين مدير مسؤول وإسناده إلى المدرسة المحددة
                </span>
              </div>
            </div>

            {adminError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px' }}>
                {adminError}
              </div>
            )}

            <form onSubmit={handleAddAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  اسم المدير الرباعي <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: أنس الجهني"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    رقم الهوية (اسم الدخول) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="10 أرقام"
                    value={adminNationalId}
                    onChange={(e) => setAdminNationalId(e.target.value)}
                    dir="ltr"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    كلمة المرور <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="6 خانات على الأقل"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  المدرسة المسند له إدارتها <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="input-field"
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  required
                >
                  <option value="">-- اختر المدرسة لتسليم إدارتها --</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.subTitle || s.city || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  رقم الهاتف / الجوال (اختياري)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="05xxxxxxxx"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  dir="ltr"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={isAddingAdmin}
                >
                  {isAddingAdmin ? 'جاري الإنشاء...' : 'إنشاء وتعيين حساب المدير'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddAdminModal(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Super Admin Modal */}
      {showAddSuperAdminModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowAddSuperAdminModal(false)}
        >
          <div 
            className="glass-panel"
            style={{
              background: '#ffffff',
              width: '480px',
              maxWidth: '100%',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddSuperAdminModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                left: isRTL ? '18px' : 'auto',
                right: !isRTL ? '18px' : 'auto',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(0, 130, 166, 0.1)',
                color: '#0082a6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  إنشاء حساب ماستر عام إضافي
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  صلاحيات عليا كاملة على كافة المدارس والحسابات
                </span>
              </div>
            </div>

            <form onSubmit={handleAddSuperAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  الاسم الكامل للماستر <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: الإشراف العام - شركة المدارس المتقدمة"
                  value={superAdminName}
                  onChange={(e) => setSuperAdminName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  اسم المستخدم / رقم الهوية <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="اسم الدخول"
                  value={superAdminNationalId}
                  onChange={(e) => setSuperAdminNationalId(e.target.value)}
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  كلمة المرور <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="6 خانات على الأقل"
                  value={superAdminPassword}
                  onChange={(e) => setSuperAdminPassword(e.target.value)}
                  dir="ltr"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={isAddingSuperAdmin}
                >
                  {isAddingSuperAdmin ? 'جاري الإنشاء...' : 'إنشاء حساب الماستر'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddSuperAdminModal(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit School Modal */}
      {editingSchool && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setEditingSchool(null)}
        >
          <div 
            className="glass-panel"
            style={{
              background: '#ffffff',
              width: '520px',
              maxWidth: '100%',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setEditingSchool(null)}
              style={{
                position: 'absolute',
                top: '18px',
                left: isRTL ? '18px' : 'auto',
                right: !isRTL ? '18px' : 'auto',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              تعديل بيانات المدرسة والعنوان الفرعي
            </h3>

            <form onSubmit={handleUpdateSchool} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  اسم المدرسة / المجمع
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editingSchool.name || ''}
                  onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  العنوان الفرعي للمدرسة (الفرع والمسار)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مثال: فرع حي الزهراء - المسار الأهلي والدبلومة الأمريكية"
                  value={editingSchool.subTitle || ''}
                  onChange={(e) => setEditingSchool({ ...editingSchool, subTitle: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  المدينة / المنطقة
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editingSchool.city || ''}
                  onChange={(e) => setEditingSchool({ ...editingSchool, city: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  المسار التعليمي
                </label>
                <select
                  className="input-field"
                  value={editingSchool.track || 'أهلي متقدم + STEM'}
                  onChange={(e) => setEditingSchool({ ...editingSchool, track: e.target.value })}
                >
                  <option value="أهلي متقدم + STEM">أهلي متقدم + STEM</option>
                  <option value="عالمي International (دبلومة أمريكية)">عالمي International (دبلومة أمريكية)</option>
                  <option value="مدارس تحفيظ القرآن الكريم">مدارس تحفيظ القرآن الكريم</option>
                  <option value="مسار أهلي شامل لكافة المراحل">مسار أهلي شامل لكافة المراحل</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  حفظ التعديلات
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setEditingSchool(null)}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: تنظيف وتصفير قاعدة البيانات */}
      {showPurgeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            borderTop: '6px solid #dc2626'
          }}>
            <button
              onClick={() => { setShowPurgeModal(false); setPurgeConfirmInput(''); }}
              style={{
                position: 'absolute',
                top: '18px',
                left: isRTL ? '18px' : 'auto',
                right: !isRTL ? '18px' : 'auto',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#991b1b' }}>
                  تنظيف وتصفير قاعدة البيانات
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  مسح كافة الحسابات والبيانات السابقة وتجهيز بيئة نظيفة تماماً
                </span>
              </div>
            </div>

            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              lineHeight: '1.7',
              color: '#7f1d1d'
            }}>
              <strong>⚠️ تنبيه أمني وإداري حاسم:</strong>
              <ul style={{ margin: '8px 0 0', paddingRight: '20px' }}>
                <li>سيتم مسح كافة الحسابات والبيانات السابقة للمدراء والمعلمين والطلاب وأولياء الأمور والكادر والزيارات والرسائل والدرجات.</li>
                <li><strong>لن يتم حذف حساب الماستر العام (SuperAdmin)</strong> ولا قائمة المدارس والمجمعات المعتمدة.</li>
                <li>هذا الإجراء يضمن جاهزية المنظومة بدون أي تداخل حسابات سابقة.</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                لتأكيد العملية، يرجى كتابة كلمة <strong style={{ color: '#dc2626' }}>"تنظيف"</strong> في الحقل أدناه:
              </label>
              <input
                type="text"
                className="input-field"
                placeholder='اكتب "تنظيف" هنا...'
                value={purgeConfirmInput}
                onChange={(e) => setPurgeConfirmInput(e.target.value)}
                style={{
                  border: purgeConfirmInput.trim() === 'تنظيف' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '15px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={handlePurgeAllAccountsAndTestData}
                disabled={isPurgingDatabase || purgeConfirmInput.trim() !== 'تنظيف'}
                style={{
                  flex: 1,
                  background: (isPurgingDatabase || purgeConfirmInput.trim() !== 'تنظيف') ? '#cbd5e1' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: (isPurgingDatabase || purgeConfirmInput.trim() !== 'تنظيف') ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isPurgingDatabase ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span>{isPurgingDatabase ? 'جاري التنظيف الشامل...' : 'تأكيد المسح والتنظيف الآن'}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setShowPurgeModal(false); setPurgeConfirmInput(''); }}
                disabled={isPurgingDatabase}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function SuperAdminDashboard() {
  const { userData } = useAuth();
  const { t } = useLanguage();

  return (
    <Layout role="superadmin" title="لوحة تحكم الماستر العام (Super Master)">
      <Routes>
        <Route path="/" element={<SuperAdminHome />} />
        <Route path="/resources" element={<SchoolResourcesHub role="superadmin" />} />
        <Route path="/portfolio" element={<AchievementPortfolioPage targetRole="superadmin" />} />
        <Route path="/messages" element={<SchoolMessagingHub />} />
        <Route path="/excellence" element={<SchoolExcellenceDashboard />} />
        <Route path="/settings" element={<div style={{ padding: '24px' }}><ChangePassword /></div>} />
        <Route path="*" element={<SuperAdminHome />} />
      </Routes>
    </Layout>
  );
}
