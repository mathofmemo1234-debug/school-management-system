import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, setDoc
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Building2, Users, BookOpen, Layers, Send, AlertTriangle, AlertCircle, CheckCircle2,
  TrendingUp, TrendingDown, ArrowLeftRight, Sparkles, Filter, Plus, Edit, Trash2,
  Printer, RefreshCw, X, Check, Search, ShieldCheck, UserCheck, Activity, Award,
  BarChart2, PieChart, Shield, Calendar, Phone, Mail, Compass, Coffee, Trophy,
  Film, Laptop, HeartPulse, FlaskConical, MapPin, School, ArrowRight, Eye
} from 'lucide-react';
import {
  RESOURCE_STAGES,
  RESOURCE_TRACKS,
  RESOURCE_GENDERS,
  BUILDING_FACILITIES_CATALOG,
  STANDARD_SUBJECT_QUOTAS,
  ALL_SCHOOL_SUBJECTS,
  ADVANCED_SCHOOLS_CATALOG
} from '../data/resourceData';

export default function SchoolResourcesHub({ role = 'admin' }) {
  const { userData, currentUser, userRole } = useAuth();
  const { t, isRTL } = useLanguage();

  const effectiveRole = role || userRole || 'admin';
  const isSuperAdmin = effectiveRole === 'superadmin' || userRole === 'superadmin';

  // Navigation Tabs: 'analytics' | 'buildings' | 'classes_quotas' | 'transfers_directives'
  const [activeTab, setActiveTab] = useState('analytics');

  // Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState(userData?.schoolId || 'msc_jed_smart_boys');
  const [filterTrack, setFilterTrack] = useState('all'); // 'all' | 'national' | 'international'
  const [filterGender, setFilterGender] = useState('all'); // 'all' | 'boys' | 'girls'
  const [filterStage, setFilterStage] = useState('all'); // 'all' | 'kindergarten' | 'primary' | 'middle' | 'high'
  const [searchQuery, setSearchQuery] = useState('');

  // Data Collections State - Always initialized with MSC 43 Approved Schools Catalog
  const [schoolsList, setSchoolsList] = useState(() => {
    return ADVANCED_SCHOOLS_CATALOG.map((s, i) => ({ id: s.code || `msc_school_${i+1}`, ...s }));
  });
  const [buildingsList, setBuildingsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [transferRequests, setTransferRequests] = useState([]);
  const [directivesList, setDirectivesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState('need'); // 'need' (استعانة/سد عجز) | 'release' (استغناء/إتاحة كادر فائض)
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);

  // Building Form State
  const [buildingForm, setBuildingForm] = useState({
    buildingName: '',
    code: '',
    track: 'national',
    gender: 'boys',
    stages: ['primary', 'middle', 'high'],
    floors: 3,
    totalRooms: 30,
    activeClassrooms: 20,
    capacity: 600,
    areaSqMeters: 3500,
    condition: 'ممتاز',
    facilities: ['science_lab', 'computer_lab', 'sports_gym', 'library', 'prayer_hall'],
    notes: ''
  });

  // Grouped Subjects Catalog for Selectors
  const subjectsByCategory = useMemo(() => {
    const map = {};
    (ALL_SCHOOL_SUBJECTS || []).forEach(sub => {
      const cat = sub.category || 'عام';
      if (!map[cat]) map[cat] = [];
      map[cat].push(sub);
    });
    return map;
  }, []);

  // Transfer Request Form State
  const [transferForm, setTransferForm] = useState({
    type: 'need', // 'need' | 'release'
    subject: 'الرياضيات',
    customSubject: '',
    track: 'national',
    gender: 'boys',
    stage: 'primary',
    teacherName: '',
    teacherNationalId: '',
    currentLoad: 8,
    requiredPeriods: 20,
    urgency: 'high', // 'urgent' | 'high' | 'normal'
    reason: '',
    targetSchoolId: ''
  });

  // SuperAdmin Directive Form State
  const [directiveForm, setDirectiveForm] = useState({
    targetSchoolId: '',
    subject: 'الرياضيات',
    customSubject: '',
    actionType: 'transfer_surplus', // 'transfer_surplus' | 'fill_deficit' | 'optimize_density' | 'custom'
    title: '',
    content: '',
    urgency: 'high',
    assignedTeacherName: ''
  });

  // 1. Fetch Schools List (for SuperAdmin & selector)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schools'), (snap) => {
      if (!snap.empty) {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setSchoolsList(list);
        if (!selectedSchoolId && list.length > 0) {
          setSelectedSchoolId(list[0].id);
        }
      } else {
        const fallback = ADVANCED_SCHOOLS_CATALOG.map((s, i) => ({ id: s.code || `msc_school_${i+1}`, ...s }));
        setSchoolsList(fallback);
        if (!selectedSchoolId && fallback.length > 0) {
          setSelectedSchoolId(fallback[0].id);
        }
      }
    }, (err) => {
      console.warn("Schools snapshot notice in resources:", err);
      const fallback = ADVANCED_SCHOOLS_CATALOG.map((s, i) => ({ id: s.code || `msc_school_${i+1}`, ...s }));
      setSchoolsList(fallback);
      if (!selectedSchoolId && fallback.length > 0) {
        setSelectedSchoolId(fallback[0].id);
      }
    });
    return () => unsub();
  }, []);

  // 2. Fetch School Specific Data
  useEffect(() => {
    const targetSchool = isSuperAdmin && selectedSchoolId === 'ALL' ? null : (selectedSchoolId || userData?.schoolId || 'main_school');

    // Buildings
    const qBuildings = targetSchool 
      ? query(collection(db, 'school_buildings'), where('schoolId', '==', targetSchool))
      : collection(db, 'school_buildings');
    const unsubBld = onSnapshot(qBuildings, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setBuildingsList(list);
      setIsLoading(false);
    });

    // Teachers
    const qTeachers = targetSchool 
      ? query(collection(db, 'teachers'), where('schoolId', '==', targetSchool))
      : collection(db, 'teachers');
    const unsubTeach = onSnapshot(qTeachers, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTeachersList(list);
    });

    // Students
    const qStudents = targetSchool 
      ? query(collection(db, 'students'), where('schoolId', '==', targetSchool))
      : collection(db, 'students');
    const unsubStud = onSnapshot(qStudents, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setStudentsList(list);
    });

    // Classes
    const qClasses = targetSchool 
      ? query(collection(db, 'classes'), where('schoolId', '==', targetSchool))
      : collection(db, 'classes');
    const unsubCls = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setClassesList(list);
    });

    // Transfer Requests
    const qTransfers = targetSchool 
      ? query(collection(db, 'resource_transfer_requests'), where('schoolId', '==', targetSchool))
      : collection(db, 'resource_transfer_requests');
    const unsubTrans = onSnapshot(qTransfers, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTransferRequests(list);
    });

    // Directives
    const qDirectives = targetSchool 
      ? query(collection(db, 'resource_directives'), where('targetSchoolId', 'in', [targetSchool, 'ALL']))
      : collection(db, 'resource_directives');
    const unsubDir = onSnapshot(qDirectives, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setDirectivesList(list);
    });

    return () => {
      unsubBld();
      unsubTeach();
      unsubStud();
      unsubCls();
      unsubTrans();
      unsubDir();
    };
  }, [selectedSchoolId, isSuperAdmin, userData]);

  // Current School Metadata
  const currentSchoolInfo = useMemo(() => {
    return schoolsList.find(s => s.id === selectedSchoolId) || {
      name: userData?.schoolName || 'مجمع مدارس المتقدمة للتعلم الذكي',
      subTitle: 'المسار الأهلي والدولي - بنين وبنات'
    };
  }, [schoolsList, selectedSchoolId, userData]);

  // Filtered Buildings
  const filteredBuildings = useMemo(() => {
    return buildingsList.filter(b => {
      if (filterTrack !== 'all' && b.track !== filterTrack) return false;
      if (filterGender !== 'all' && b.gender !== filterGender) return false;
      if (searchQuery) {
        const queryStr = searchQuery.toLowerCase();
        const matchName = (b.buildingName || '').toLowerCase().includes(queryStr);
        const matchCode = (b.code || '').toLowerCase().includes(queryStr);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [buildingsList, filterTrack, filterGender, searchQuery]);

  // Summary Metrics & Stats Calculation (100% Real Data Strictly - No Dummy Fallbacks)
  const metrics = useMemo(() => {
    let totalCapacity = 0;
    let totalRooms = 0;
    let totalActiveRooms = 0;

    buildingsList.forEach(b => {
      totalCapacity += Number(b.capacity || 0);
      totalRooms += Number(b.totalRooms || 0);
      totalActiveRooms += Number(b.activeClassrooms || 0);
    });

    const studentsCount = studentsList.length;
    const classesCount = classesList.length;
    const teachersCount = teachersList.length;

    const classDensity = classesCount > 0 ? (studentsCount / classesCount).toFixed(1) : '0';
    const capacityUtilization = totalCapacity > 0 ? Math.min(100, Math.round((studentsCount / totalCapacity) * 100)) : 0;
    const studentTeacherRatio = teachersCount > 0 ? (studentsCount / teachersCount).toFixed(1) : '0';

    // Subject Quotas & Deficit / Surplus Analysis (Strictly from real database)
    const subjectAnalysis = STANDARD_SUBJECT_QUOTAS.map(item => {
      const assignedTeachers = teachersList.filter(t => {
        const subj = (t.subject || '').trim();
        return subj.includes(item.subject) || item.subject.includes(subj);
      });
      const tCount = assignedTeachers.length;
      
      const totalPeriodsNeeded = classesCount * item.periodsPerClass;
      const totalTeachingCapacity = tCount * item.standardTeacherLoad;
      const diffPeriods = totalTeachingCapacity - totalPeriodsNeeded;
      
      let status = 'balanced'; // 'surplus' | 'deficit' | 'balanced'
      let netTeacherDiff = 0;

      if (classesCount === 0 && tCount === 0) {
        status = 'balanced';
        netTeacherDiff = 0;
      } else if (diffPeriods >= item.standardTeacherLoad) {
        status = 'surplus';
        netTeacherDiff = Math.floor(diffPeriods / item.standardTeacherLoad);
      } else if (diffPeriods <= -item.standardTeacherLoad) {
        status = 'deficit';
        netTeacherDiff = Math.abs(Math.ceil(diffPeriods / item.standardTeacherLoad));
      } else if (diffPeriods < 0) {
        status = 'deficit';
        netTeacherDiff = 1;
      }

      return {
        subject: item.subject,
        periodsPerClass: item.periodsPerClass,
        standardLoad: item.standardTeacherLoad,
        teachersCount: tCount,
        totalPeriodsNeeded,
        totalTeachingCapacity,
        diffPeriods,
        status,
        netTeacherDiff
      };
    });

    const totalSurplusTeachers = subjectAnalysis.filter(s => s.status === 'surplus').reduce((acc, c) => acc + c.netTeacherDiff, 0);
    const totalDeficitTeachers = subjectAnalysis.filter(s => s.status === 'deficit').reduce((acc, c) => acc + c.netTeacherDiff, 0);

    return {
      totalCapacity,
      totalRooms,
      totalActiveRooms,
      studentsCount,
      classesCount,
      teachersCount,
      classDensity,
      capacityUtilization,
      studentTeacherRatio,
      subjectAnalysis,
      totalSurplusTeachers,
      totalDeficitTeachers
    };
  }, [buildingsList, studentsList, classesList, teachersList]);

  // Smart Recommendations Engine (Real Data Driven)
  const recommendations = useMemo(() => {
    const list = [];

    // If completely empty school
    if (metrics.totalCapacity === 0 && metrics.studentsCount === 0 && metrics.teachersCount === 0 && metrics.classesCount === 0) {
      return [{
        id: 'rec-no-data',
        type: 'info',
        title: 'بانتظار إدخال بيانات المدرسة الحقيقية',
        desc: 'لا توجد مباني أو فصول أو طلاب مسجلين في هذا المجمع حالياً. يرجى البدء بإضافة المباني والقاعات وتعيين الكوادر لحساب مؤشرات الاستغلال بدقة.',
        actionLabel: 'إضافة مبنى للمجمع',
        actionType: 'view_buildings'
      }];
    }

    // 1. Deficit alert
    const deficitSubjects = metrics.subjectAnalysis.filter(s => s.status === 'deficit' && s.netTeacherDiff > 0);
    if (deficitSubjects.length > 0) {
      deficitSubjects.forEach(sub => {
        list.push({
          id: `rec-def-${sub.subject}`,
          type: 'urgent',
          title: `عجز في كوادر ${sub.subject}`,
          desc: `المدرسة تحتاج إلى (${sub.netTeacherDiff}) معلم/معلمة لتغطية (${Math.abs(sub.diffPeriods)}) حصة أسبوعية شاغرة في مادة ${sub.subject}.`,
          actionLabel: 'تقديم طلب استعانة فوري',
          actionType: 'create_need_request',
          subject: sub.subject
        });
      });
    }

    // 2. Surplus alert
    const surplusSubjects = metrics.subjectAnalysis.filter(s => s.status === 'surplus' && s.netTeacherDiff > 0);
    if (surplusSubjects.length > 0) {
      surplusSubjects.forEach(sub => {
        list.push({
          id: `rec-sur-${sub.subject}`,
          type: 'opportunity',
          title: `فائض قابل للندب في ${sub.subject}`,
          desc: `يوجد فائض تشغيلي بمقدار (${sub.netTeacherDiff}) كادر بنصاب منخفض. يوصى بإتاحتهم لمدارس الشركة الشقيقة التي تعاني من عجز لتقليل تكاليف التوظيف.`,
          actionLabel: 'إتاحة وندب الكادر الفائض',
          actionType: 'create_release_request',
          subject: sub.subject
        });
      });
    }

    // 3. Class Density Optimization
    if (metrics.classesCount > 0 && Number(metrics.classDensity) > 30) {
      list.push({
        id: 'rec-density-high',
        type: 'warning',
        title: 'كثافة صفية مرتفعة (تكدس طلاب)',
        desc: `متوسط الكثافة الصفية (${metrics.classDensity} طالب/فصل) يتجاوز المعيار المعتمد. يوصى بفتح قاعة إضافية من القاعات المتاحة في المبنى.`,
        actionLabel: 'توسيع الفصول من القاعات المتاحة',
        actionType: 'view_buildings'
      });
    } else if (metrics.classesCount > 5 && Number(metrics.classDensity) < 16 && Number(metrics.classDensity) > 0) {
      list.push({
        id: 'rec-density-low',
        type: 'info',
        title: 'فرصة دمج فصول لترشيد الموارد',
        desc: `الكثافة الصفية (${metrics.classDensity} طالب/فصل) منخفضة، مما يتيح دمج بعض الشعب وتوفير قاعات وكوادر تدريسية للمسار الدولي.`,
        actionLabel: 'مراجعة تشكيل الفصول',
        actionType: 'view_classes'
      });
    }

    // 4. Infrastructure capacity alert
    if (metrics.totalCapacity > 0 && metrics.capacityUtilization < 60 && metrics.capacityUtilization > 0) {
      list.push({
        id: 'rec-cap-low',
        type: 'info',
        title: 'استغلال الطاقة الاستيعابية للمبنى',
        desc: `نسبة الإشغال الحالية (${metrics.capacityUtilization}%) توفر مساحات يمكن استثمارها في تدشين مسار الدبلومة الأمريكية أو نوادي الموهبة والروبوت.`,
        actionLabel: 'استعراض المرافق المتاحة',
        actionType: 'view_buildings'
      });
    }

    return list;
  }, [metrics]);

  // Save / Update Building
  const handleSaveBuilding = async (e) => {
    e.preventDefault();
    try {
      const currentTargetSchool = selectedSchoolId || userData?.schoolId || 'main_school';
      if (editingBuilding) {
        await updateDoc(doc(db, 'school_buildings', editingBuilding.id), {
          ...buildingForm,
          capacity: Number(buildingForm.capacity),
          totalRooms: Number(buildingForm.totalRooms),
          activeClassrooms: Number(buildingForm.activeClassrooms),
          floors: Number(buildingForm.floors),
          areaSqMeters: Number(buildingForm.areaSqMeters),
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'school_buildings'), {
          ...buildingForm,
          schoolId: currentTargetSchool,
          capacity: Number(buildingForm.capacity),
          totalRooms: Number(buildingForm.totalRooms),
          activeClassrooms: Number(buildingForm.activeClassrooms),
          floors: Number(buildingForm.floors),
          areaSqMeters: Number(buildingForm.areaSqMeters),
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      setShowBuildingModal(false);
      setEditingBuilding(null);
    } catch (err) {
      console.error('Error saving building:', err);
      alert('حدث خطأ أثناء حفظ بيانات المبنى.');
    }
  };

  // Delete Building
  const handleDeleteBuilding = async (id) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المبنى من سجلات المدرسة؟')) return;
    try {
      await deleteDoc(doc(db, 'school_buildings', id));
    } catch (err) {
      console.error('Error deleting building:', err);
    }
  };

  // Submit Transfer Request (Need / Release / Directive)
  const handleSubmitTransferRequest = async (e) => {
    e.preventDefault();
    try {
      const finalSubject = (transferForm.subject.includes('أخرى') || transferForm.subject === 'مادة أخرى (تحديد يدوي)') && transferForm.customSubject.trim()
        ? transferForm.customSubject.trim()
        : transferForm.subject;

      const currentTargetSchool = isSuperAdmin 
        ? (transferForm.targetSchoolId || selectedSchoolId || 'main_school')
        : (selectedSchoolId || userData?.schoolId || 'main_school');

      const targetSchoolObj = schoolsList.find(s => s.id === currentTargetSchool);

      await addDoc(collection(db, 'resource_transfer_requests'), {
        ...transferForm,
        subject: finalSubject,
        schoolId: currentTargetSchool,
        schoolName: targetSchoolObj?.name || currentSchoolInfo.name,
        targetSchoolId: currentTargetSchool,
        targetSchoolName: targetSchoolObj?.name || currentSchoolInfo.name,
        requesterName: isSuperAdmin ? (userData?.name || 'الماستر العام (Super Admin)') : (userData?.name || 'مدير المدرسة'),
        requesterRole: effectiveRole,
        requesterNid: userData?.nationalId || '',
        isDirective: isSuperAdmin,
        status: isSuperAdmin ? 'approved' : 'pending', // 'pending' | 'approved' | 'rejected' | 'completed'
        createdAt: Date.now()
      });
      setShowTransferModal(false);
      if (isSuperAdmin) {
        alert(`تم إرسال وتوجيه القرار الإداري بنجاح إلى مدير ${targetSchoolObj?.name || 'المدرسة'}.`);
      } else {
        alert('تم إرسال الطلب بنجاح إلى الإدارة العامة والماستر للنظر والاعتماد.');
      }
    } catch (err) {
      console.error('Error submitting transfer request:', err);
      alert('حدث خطأ أثناء إرسال الطلب.');
    }
  };

  // SuperAdmin Directives Submission
  const handleSubmitDirective = async (e) => {
    e.preventDefault();
    try {
      const finalSubject = (directiveForm.subject.includes('أخرى') || directiveForm.subject === 'مادة أخرى (تحديد يدوي)') && directiveForm.customSubject.trim()
        ? directiveForm.customSubject.trim()
        : directiveForm.subject;

      const targetSchool = directiveForm.targetSchoolId || selectedSchoolId || 'ALL';
      const targetSchoolObj = schoolsList.find(s => s.id === targetSchool);

      await addDoc(collection(db, 'resource_directives'), {
        ...directiveForm,
        subject: finalSubject,
        targetSchoolId: targetSchool,
        targetSchoolName: targetSchool === 'ALL' ? 'كافة فروع ومجمعات الشركة' : (targetSchoolObj?.name || 'الفرع المستهدف'),
        senderName: userData?.name || 'الماستر العام (Super Admin)',
        senderRole: 'superadmin',
        createdAt: Date.now(),
        status: 'active'
      });
      setShowDirectiveModal(false);
      alert('تم إرسال التوجيه الإداري المباشر إلى إدارة المدرسة بنجاح!');
    } catch (err) {
      console.error('Error submitting directive:', err);
      alert('حدث خطأ أثناء إرسال التوجيه.');
    }
  };

  // Update Request Status (SuperAdmin Approval)
  const handleUpdateTransferStatus = async (requestId, newStatus) => {
    try {
      await updateDoc(doc(db, 'resource_transfer_requests', requestId), {
        status: newStatus,
        reviewedBy: userData?.name || 'الماستر العام',
        reviewedAt: Date.now()
      });
    } catch (err) {
      console.error('Error updating request status:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '85vh' }}>
      {/* 1. Header Banner & Top Controls */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(99, 178, 198, 0.25) 0%, rgba(180, 211, 150, 0.25) 100%)',
        borderRadius: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        border: '1px solid rgba(255, 255, 255, 0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 8px 20px rgba(13, 148, 136, 0.3)'
          }}>
            <Layers size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--color-primary-dark)' }}>
                منظومة إدارة الموارد واستغلال الأصول وتنقلات المعلمين
              </h1>
              <span style={{
                background: 'rgba(13, 148, 136, 0.15)',
                color: '#0f766e',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={13} /> ذكاء الموارد والكوادر
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: '14px' }}>
              {currentSchoolInfo.name} • {currentSchoolInfo.subTitle || 'إدارة الطاقة الاستيعابية والأنصبة والتنقلات'}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {isSuperAdmin && (
            <button
              onClick={() => {
                setDirectiveForm({
                  targetSchoolId: selectedSchoolId,
                  subject: 'الرياضيات',
                  actionType: 'transfer_surplus',
                  title: 'توجيه بسد العجز واستغلال الكادر الفائض',
                  content: '',
                  urgency: 'high',
                  assignedTeacherName: ''
                });
                setShowDirectiveModal(true);
              }}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '12px',
                fontWeight: 700
              }}
            >
              <Send size={17} />
              <span>إرسال توجيه إداري للمدير</span>
            </button>
          )}

          <button
            onClick={() => {
              setTransferForm({
                type: 'need',
                subject: 'الرياضيات',
                customSubject: '',
                track: 'national',
                gender: 'boys',
                stage: 'primary',
                teacherName: '',
                teacherNationalId: '',
                currentLoad: 8,
                requiredPeriods: 20,
                urgency: 'high',
                reason: '',
                targetSchoolId: selectedSchoolId || ''
              });
              setShowTransferModal(true);
            }}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isSuperAdmin ? 'linear-gradient(135deg, #0f766e 0%, #0369a1 100%)' : 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: 700
            }}
          >
            <ArrowLeftRight size={17} />
            <span>{isSuperAdmin ? 'إصدار قرار ندب / سد عجز لمدرسة' : 'طلب استعانة / ندب معلمين'}</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'white',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '10px 16px',
              borderRadius: '12px',
              fontWeight: 600
            }}
          >
            <Printer size={17} />
            <span>طباعة تقرير الموارد</span>
          </button>
        </div>
      </div>

      {/* 2. Top Filter Bar (Track, Gender, Stage, School Selector) */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Branch / School Selector for SuperAdmin */}
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <School size={18} color="var(--color-primary-dark)" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-primary-dark)' }}>الفرع/المجمع:</span>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="input-field"
              style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '13px', width: '260px' }}
            >
              {schoolsList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Track Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>المسار:</span>
          <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setFilterTrack('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: filterTrack === 'all' ? 700 : 500,
                background: filterTrack === 'all' ? 'white' : 'transparent',
                color: filterTrack === 'all' ? 'var(--color-primary-dark)' : '#64748b',
                cursor: 'pointer',
                boxShadow: filterTrack === 'all' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setFilterTrack('national')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: filterTrack === 'national' ? 700 : 500,
                background: filterTrack === 'national' ? '#0d9488' : 'transparent',
                color: filterTrack === 'national' ? 'white' : '#64748b',
                cursor: 'pointer'
              }}
            >
              المسار الأهلي
            </button>
            <button
              type="button"
              onClick={() => setFilterTrack('international')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: filterTrack === 'international' ? 700 : 500,
                background: filterTrack === 'international' ? '#7c3aed' : 'transparent',
                color: filterTrack === 'international' ? 'white' : '#64748b',
                cursor: 'pointer'
              }}
            >
              المسار الدولي
            </button>
          </div>
        </div>

        {/* Gender / Section Switcher with Strict Separation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>القسم:</span>
          <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setFilterGender('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: filterGender === 'all' ? 700 : 500,
                background: filterGender === 'all' ? 'white' : 'transparent',
                color: filterGender === 'all' ? 'var(--color-primary-dark)' : '#64748b',
                cursor: 'pointer',
                boxShadow: filterGender === 'all' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              القسمين
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('boys')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: filterGender === 'boys' ? 700 : 500,
                background: filterGender === 'boys' ? '#2563eb' : 'transparent',
                color: filterGender === 'boys' ? 'white' : '#64748b',
                cursor: 'pointer'
              }}
            >
              بنين (Boys)
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('girls')}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: filterGender === 'girls' ? 700 : 500,
                background: filterGender === 'girls' ? '#db2777' : 'transparent',
                color: filterGender === 'girls' ? 'white' : '#64748b',
                cursor: 'pointer'
              }}
            >
              بنات (Girls)
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في المباني والمرافق..."
            style={{ paddingRight: '34px', paddingLeft: '12px', paddingBlock: '6px', fontSize: '13px', borderRadius: '10px' }}
          />
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid rgba(99, 178, 198, 0.2)', paddingBottom: '8px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'analytics' ? 'linear-gradient(135deg, #0d9488, #0369a1)' : 'transparent',
            color: activeTab === 'analytics' ? 'white' : 'var(--color-text-main)',
            boxShadow: activeTab === 'analytics' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none'
          }}
        >
          <Activity size={18} />
          <span>المؤشرات والرسوم البيانية والتوصيات</span>
        </button>

        <button
          onClick={() => setActiveTab('buildings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'buildings' ? 'linear-gradient(135deg, #0d9488, #0369a1)' : 'transparent',
            color: activeTab === 'buildings' ? 'white' : 'var(--color-text-main)',
            boxShadow: activeTab === 'buildings' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none'
          }}
        >
          <Building2 size={18} />
          <span>إدارة المباني والمرافق ({buildingsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('classes_quotas')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'classes_quotas' ? 'linear-gradient(135deg, #0d9488, #0369a1)' : 'transparent',
            color: activeTab === 'classes_quotas' ? 'white' : 'var(--color-text-main)',
            boxShadow: activeTab === 'classes_quotas' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none'
          }}
        >
          <BookOpen size={18} />
          <span>الفصول والأنصبة وتوازن الكوادر</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers_directives')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'transfers_directives' ? 'linear-gradient(135deg, #0d9488, #0369a1)' : 'transparent',
            color: activeTab === 'transfers_directives' ? 'white' : 'var(--color-text-main)',
            boxShadow: activeTab === 'transfers_directives' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none',
            position: 'relative'
          }}
        >
          <ArrowLeftRight size={18} />
          <span>تنقلات المعلمين وتوجيهات الماستر</span>
          {transferRequests.filter(r => r.status === 'pending').length > 0 && (
            <span style={{
              background: '#ef4444',
              color: 'white',
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '10px',
              fontWeight: 800
            }}>
              {transferRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: ANALYTICS & SMART RECOMMENDATIONS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            {/* Card 1: Total Capacity & Utilization */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>إجمالي الطاقة الاستيعابية</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 178, 198, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <Building2 size={20} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                {metrics.totalCapacity} <span style={{ fontSize: '14px', fontWeight: 500 }}>طالب</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>نسبة الإشغال الكلية:</span>
                <span style={{
                  fontWeight: 700,
                  color: metrics.capacityUtilization > 90 ? '#dc2626' : metrics.capacityUtilization > 75 ? '#16a34a' : '#d97706'
                }}>
                  {metrics.capacityUtilization}%
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${metrics.capacityUtilization}%`,
                  height: '100%',
                  background: metrics.capacityUtilization > 90 ? '#dc2626' : metrics.capacityUtilization > 75 ? '#16a34a' : '#d97706',
                  borderRadius: '3px'
                }} />
              </div>
            </div>

            {/* Card 2: Students & Class Density */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>الطلاب والكثافة الصفية</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Users size={20} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f766e' }}>
                {metrics.studentsCount} <span style={{ fontSize: '14px', fontWeight: 500 }}>طالب مسجل</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>متوسط الكثافة:</span>
                <span style={{
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: Number(metrics.classDensity) > 30 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: Number(metrics.classDensity) > 30 ? '#dc2626' : '#059669'
                }}>
                  {metrics.classDensity} طالب / فصل
                </span>
              </div>
            </div>

            {/* Card 3: Teaching Staff & Ratio */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>الكوادر التعليمية</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <UserCheck size={20} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#6d28d9' }}>
                {metrics.teachersCount} <span style={{ fontSize: '14px', fontWeight: 500 }}>معلم/معلمة</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>معدل معلم لكل طالب:</span>
                <span style={{ fontWeight: 700, color: '#6d28d9' }}>1 : {metrics.studentTeacherRatio}</span>
              </div>
            </div>

            {/* Card 4: Surplus / Deficit Balance */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>مؤشر الفائض والعجز</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                  <ArrowLeftRight size={20} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>فائض متاح: </span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>+{metrics.totalSurplusTeachers}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>عجز مطلوب: </span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>-{metrics.totalDeficitTeachers}</span>
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {metrics.totalDeficitTeachers > 0 ? '🔴 يتطلب تحريك تنقلات أو تعاقد' : '🟢 المنظومة في حالة توازن تشغيلي'}
              </div>
            </div>
          </div>

          {/* Smart AI Recommendations Card */}
          <div className="glass-panel" style={{
            padding: '24px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(240, 253, 250, 0.9) 0%, rgba(245, 243, 255, 0.9) 100%)',
            border: '1px solid rgba(13, 148, 136, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0d9488, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--color-primary-dark)' }}>
                    محرك التوصيات واقتراحات النظام الذكية للاستغلال الأمثل
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    تحليل آلي للبيانات لاقتراح تنقلات الكوادر وترشيد النفقات وتحسين الكثافة الصفية
                  </p>
                </div>
              </div>
              <span style={{
                background: 'rgba(13, 148, 136, 0.15)',
                color: '#0f766e',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '16px'
              }}>
                {recommendations.length} توصيات مقترحة
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {recommendations.map(rec => (
                <div key={rec.id} style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '16px',
                  border: rec.type === 'urgent' ? '1px solid #fecaca' : rec.type === 'opportunity' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {rec.type === 'urgent' ? (
                        <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
                          <AlertCircle size={16} /> تنبيه عجز حرج
                        </span>
                      ) : rec.type === 'opportunity' ? (
                        <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
                          <TrendingUp size={16} /> فرصة توفير واستغلال فائض
                        </span>
                      ) : (
                        <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700 }}>
                          <AlertTriangle size={16} /> مقترح تنظيمي
                        </span>
                      )}
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#1e293b' }}>{rec.title}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{rec.desc}</p>
                  </div>

                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        if (rec.actionType === 'create_need_request') {
                          setTransferForm(prev => ({ ...prev, type: 'need', subject: rec.subject || 'الرياضيات' }));
                          setShowTransferModal(true);
                        } else if (rec.actionType === 'create_release_request') {
                          setTransferForm(prev => ({ ...prev, type: 'release', subject: rec.subject || 'الرياضيات' }));
                          setShowTransferModal(true);
                        } else if (rec.actionType === 'view_buildings') {
                          setActiveTab('buildings');
                        } else {
                          setActiveTab('classes_quotas');
                        }
                      }}
                      className="btn"
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: rec.type === 'urgent' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{rec.actionLabel}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Visual Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
            {/* Chart 1: Teacher Load & Balance by Subject */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={19} color="#0d9488" />
                  مخطط توازن أنصبة الكوادر والمواد (الحصص المطلوبة vs الطاقة المتاحة)
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {metrics.subjectAnalysis.slice(0, 6).map((sub, idx) => {
                  const maxPeriods = Math.max(sub.totalPeriodsNeeded, sub.totalTeachingCapacity, 100);
                  const neededPercent = Math.round((sub.totalPeriodsNeeded / maxPeriods) * 100);
                  const capacityPercent = Math.round((sub.totalTeachingCapacity / maxPeriods) * 100);

                  return (
                    <div key={idx} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{sub.subject}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {sub.teachersCount} معلمين • {sub.totalTeachingCapacity} حصة طاقة
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: sub.status === 'surplus' ? '#dbeafe' : sub.status === 'deficit' ? '#fee2e2' : '#dcfce7',
                            color: sub.status === 'surplus' ? '#1e40af' : sub.status === 'deficit' ? '#b91c1c' : '#15803d'
                          }}>
                            {sub.status === 'surplus' ? `فائض +${sub.netTeacherDiff}` : sub.status === 'deficit' ? `عجز -${sub.netTeacherDiff}` : 'متوازن'}
                          </span>
                        </div>
                      </div>

                      {/* Visual Bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                          <span style={{ width: '85px' }}>الحصص المطلوبة:</span>
                          <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${neededPercent}%`, height: '100%', background: '#64748b', borderRadius: '4px' }} />
                          </div>
                          <span style={{ width: '45px', textAlign: 'left', fontWeight: 600 }}>{sub.totalPeriodsNeeded} ح</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#0f766e' }}>
                          <span style={{ width: '85px' }}>الطاقة المتوفرة:</span>
                          <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${capacityPercent}%`,
                              height: '100%',
                              background: sub.status === 'surplus' ? '#3b82f6' : sub.status === 'deficit' ? '#ef4444' : '#10b981',
                              borderRadius: '4px'
                            }} />
                          </div>
                          <span style={{ width: '45px', textAlign: 'left', fontWeight: 700 }}>{sub.totalTeachingCapacity} ح</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Buildings & Facilities Capacity Utilization Breakdown */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={19} color="#7c3aed" />
                  مؤشر إشغال المباني والمرافق وتوزيع الطلاب
                </h3>
              </div>

              {buildingsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <Building2 size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>لم يتم تسجيل مباني في هذا الفرع بعد.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {buildingsList.map(bld => {
                    const bldStudents = studentsList.filter(s => s.buildingId === bld.id).length;
                    const bldCap = Number(bld.capacity || 0);
                    const util = bldCap > 0 ? Math.min(100, Math.round((bldStudents / bldCap) * 100)) : 0;

                    return (
                      <div key={bld.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{bld.buildingName}</span>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '1px 8px',
                                borderRadius: '10px',
                                background: bld.track === 'international' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(13, 148, 136, 0.15)',
                                color: bld.track === 'international' ? '#7c3aed' : '#0d9488'
                              }}>
                                {bld.track === 'international' ? 'مسار دولي' : 'مسار أهلي'}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '1px 8px',
                                borderRadius: '10px',
                                background: bld.gender === 'girls' ? 'rgba(219, 39, 119, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                                color: bld.gender === 'girls' ? '#db2777' : '#2563eb'
                              }}>
                                {bld.gender === 'girls' ? 'قسم البنات' : 'قسم البنين'}
                              </span>
                            </div>
                          </div>

                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>{util}%</div>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>إشغال السعة ({bldStudents} / {bldCap || 0})</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBlock: '8px' }}>
                          <div style={{
                            width: `${util}%`,
                            height: '100%',
                            background: bld.gender === 'girls' ? 'linear-gradient(90deg, #ec4899, #db2777)' : 'linear-gradient(90deg, #3b82f6, #0284c7)',
                            borderRadius: '4px'
                          }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                          <span>الطاقة: <strong>{bld.capacity || 0} طالب</strong></span>
                          <span>القاعات المستغلة: <strong>{bld.activeClassrooms || 0} / {bld.totalRooms || 0}</strong></span>
                          <span>المساحة: <strong>{bld.areaSqMeters || 0} م²</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUILDINGS & FACILITIES MANAGEMENT */}
      {activeTab === 'buildings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-primary-dark)' }}>
                سجل المباني والمرافق التعليمية والتجهيزات
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                إدارة الطاقة الاستيعابية، القاعات الدراسية، المعامل، وحالة البنية التحتية
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setEditingBuilding(null);
                  setBuildingForm({
                    buildingName: '',
                    code: `BLD-${Date.now().toString().slice(-4)}`,
                    track: filterTrack !== 'all' ? filterTrack : 'national',
                    gender: filterGender !== 'all' ? filterGender : 'boys',
                    stages: ['primary', 'middle', 'high'],
                    floors: 3,
                    totalRooms: 30,
                    activeClassrooms: 20,
                    capacity: 600,
                    areaSqMeters: 3500,
                    condition: 'ممتاز',
                    facilities: ['science_lab', 'computer_lab', 'sports_gym', 'library', 'prayer_hall'],
                    notes: ''
                  });
                  setShowBuildingModal(true);
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={18} /> إضافة مبنى أو مرفق جديد
              </button>
            </div>
          </div>

          {filteredBuildings.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '16px' }}>
              <Building2 size={48} style={{ color: 'var(--color-primary)', opacity: 0.5, marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary-dark)' }}>لا توجد مباني مطابقة لخيارات الفلترة</h3>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>يمكنك إضافة مبنى جديد أو تغيير محددات التصفية في الأعلى.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {filteredBuildings.map(bld => (
                <div key={bld.id} className="glass-panel" style={{
                  padding: '24px',
                  borderRadius: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid rgba(255, 255, 255, 0.7)'
                }}>
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>{bld.code || 'BLD-01'}</span>
                        <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', color: 'var(--color-primary-dark)' }}>{bld.buildingName}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setEditingBuilding(bld);
                            setBuildingForm({ ...bld });
                            setShowBuildingModal(true);
                          }}
                          style={{ padding: '6px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#475569' }}
                          title="تعديل المبنى"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBuilding(bld.id)}
                          style={{ padding: '6px', background: '#fee2e2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#dc2626' }}
                          title="حذف المبنى"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        background: bld.track === 'international' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(13, 148, 136, 0.15)',
                        color: bld.track === 'international' ? '#7c3aed' : '#0d9488'
                      }}>
                        {bld.track === 'international' ? 'المسار الدولي' : 'المسار الأهلي'}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        background: bld.gender === 'girls' ? 'rgba(219, 39, 119, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                        color: bld.gender === 'girls' ? '#db2777' : '#2563eb'
                      }}>
                        {bld.gender === 'girls' ? 'قسم البنات' : 'قسم البنين'}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        background: '#ecfdf5',
                        color: '#059669'
                      }}>
                        حالة المبنى: {bld.condition || 'ممتاز'}
                      </span>
                    </div>

                    {/* Stats Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      background: '#f8fafc',
                      padding: '14px',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>الطاقة القصوى</div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: '#1e293b' }}>{bld.capacity}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>الفصول المستغلة</div>
                        <div style={{ fontSize: '17px', fontWeight: 800, color: '#0d9488' }}>{bld.activeClassrooms} / {bld.totalRooms}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>الأدوار / المساحة</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{bld.floors} د • {bld.areaSqMeters}م²</div>
                      </div>
                    </div>

                    {/* Facilities Pills */}
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>المرافق والتجهيزات المتوفرة:</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(bld.facilities || []).map(facKey => {
                          const facItem = BUILDING_FACILITIES_CATALOG.find(f => f.id === facKey);
                          return (
                            <span key={facKey} style={{
                              fontSize: '11px',
                              background: 'white',
                              border: '1px solid #cbd5e1',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              color: '#334155'
                            }}>
                              ✓ {facItem?.name || facKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {bld.notes && (
                    <div style={{ marginTop: '14px', fontSize: '12px', color: '#64748b', fontStyle: 'italic', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                      ملاحظة: {bld.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CLASSES, STUDENTS & TEACHER QUOTAS */}
      {activeTab === 'classes_quotas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-primary-dark)' }}>
              إدارة الفصول والطلاب والأنصبة الأسبوعية وحساب الفائض والعجز
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
              المطابقة بين الأنصبة المعيارية للمواد وأعداد المعلمين المتاحين لكل تخصص ومسار
            </p>
          </div>

          {/* Subject Quotas Table */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '18px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(99, 178, 198, 0.15)', borderBottom: '2px solid var(--color-primary)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>المادة الدراسية</th>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>حصص/فصل</th>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>إجمالي الحصص المطلوبة</th>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>المعلمون المتوفرون</th>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>الطاقة التدريسية المتاحة</th>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>الحالة (فائض / عجز)</th>
                  <th style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>إجراء التوزيع</th>
                </tr>
              </thead>
              <tbody>
                {metrics.subjectAnalysis.map((sub, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'transparent' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>{sub.subject}</td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>{sub.periodsPerClass} حصص</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>{sub.totalPeriodsNeeded} حصة</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f766e' }}>{sub.teachersCount} معلمين</td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>{sub.totalTeachingCapacity} حصة (نصاب {sub.standardLoad})</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        padding: '4px 12px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: sub.status === 'surplus' ? '#dbeafe' : sub.status === 'deficit' ? '#fee2e2' : '#dcfce7',
                        color: sub.status === 'surplus' ? '#1e40af' : sub.status === 'deficit' ? '#b91c1c' : '#15803d'
                      }}>
                        {sub.status === 'surplus' && <TrendingUp size={14} />}
                        {sub.status === 'deficit' && <AlertCircle size={14} />}
                        {sub.status === 'balanced' && <CheckCircle2 size={14} />}
                        {sub.status === 'surplus' ? `فائض (${sub.netTeacherDiff}) كادر` : sub.status === 'deficit' ? `عجز (${sub.netTeacherDiff}) كادر` : 'متوازن تماماً'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {sub.status === 'deficit' ? (
                        <button
                          onClick={() => {
                            setTransferForm(prev => ({ ...prev, type: 'need', subject: sub.subject, requiredPeriods: Math.abs(sub.diffPeriods) }));
                            setShowTransferModal(true);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none' }}
                        >
                          + طلب استعانة
                        </button>
                      ) : sub.status === 'surplus' ? (
                        <button
                          onClick={() => {
                            setTransferForm(prev => ({ ...prev, type: 'release', subject: sub.subject, currentLoad: 8 }));
                            setShowTransferModal(true);
                          }}
                          className="btn"
                          style={{ padding: '6px 12px', fontSize: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}
                        >
                          إتاحة للندب
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>مكتمل</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSFERS & DIRECTIVES HUB */}
      {activeTab === 'transfers_directives' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-primary-dark)' }}>
                منظومة تنقلات المعلمين وتوجيهات الإدارة العامة (الماستر)
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
                إدارة طلبات الاستعانة لسد العجز، إتاحة الكوادر الفائضة، والتوجيهات المباشرة بين السوبر أدمن والمدراء
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setTransferForm({
                    type: 'need',
                    subject: 'الرياضيات',
                    customSubject: '',
                    track: 'national',
                    gender: 'boys',
                    stage: 'primary',
                    teacherName: '',
                    teacherNationalId: '',
                    currentLoad: 8,
                    requiredPeriods: 20,
                    urgency: 'high',
                    reason: '',
                    targetSchoolId: selectedSchoolId || ''
                  });
                  setShowTransferModal(true);
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none' }}
              >
                <Plus size={17} /> {isSuperAdmin ? 'إصدار قرار سد عجز وتكليف كادر لمدرسة' : 'تقديم طلب استعانة (سد عجز)'}
              </button>

              <button
                onClick={() => {
                  setTransferForm({
                    type: 'release',
                    subject: 'الرياضيات',
                    customSubject: '',
                    track: 'national',
                    gender: 'boys',
                    stage: 'primary',
                    teacherName: '',
                    teacherNationalId: '',
                    currentLoad: 8,
                    requiredPeriods: 20,
                    urgency: 'normal',
                    reason: '',
                    targetSchoolId: selectedSchoolId || ''
                  });
                  setShowTransferModal(true);
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none' }}
              >
                <TrendingUp size={17} /> {isSuperAdmin ? 'إصدار قرار ندب كادر فائض لمدرسة أخرى' : 'إتاحة / ندب معلم فائض'}
              </button>
            </div>
          </div>

          {/* Super Admin Directives Section */}
          {directivesList.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(245, 243, 255, 0.95), rgba(238, 242, 255, 0.95))', border: '1px solid #c7d2fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Send size={20} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '17px', color: '#3730a3' }}>توجيهات الماستر والإدارة العامة للمدرسة</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {directivesList.map(dir => (
                  <div key={dir.id} style={{ background: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0e7ff', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
                          توجيه إداري رسمي • {dir.subject || 'الموارد'}
                        </span>
                        <h4 style={{ margin: '6px 0 2px 0', fontSize: '15px', color: '#1e1b4b' }}>{dir.title}</h4>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(dir.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>{dir.content}</p>
                    {dir.assignedTeacherName && (
                      <div style={{ fontSize: '13px', color: '#047857', fontWeight: 700, background: '#ecfdf5', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
                        ✓ الكادر الموجه للندب/الاستعانة: {dir.assignedTeacherName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transfer Requests Board */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '18px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', color: 'var(--color-primary-dark)' }}>
              سجل طلبات التنقل والاستعانة والاستغناء والتوجيهات ({transferRequests.length})
            </h3>

            {transferRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                <ArrowLeftRight size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p>لا توجد طلبات تنقل أو استعانة مسجلة حالياً.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {transferRequests.map(req => {
                  const isMasterDirective = req.isDirective || req.requesterRole === 'superadmin';
                  return (
                    <div key={req.id} style={{
                      background: isMasterDirective ? 'linear-gradient(135deg, rgba(245, 243, 255, 0.6), rgba(255, 255, 255, 0.9))' : 'white',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      border: isMasterDirective ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '14px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: isMasterDirective ? '#e0e7ff' : req.type === 'need' ? '#fee2e2' : '#dbeafe',
                            color: isMasterDirective ? '#4338ca' : req.type === 'need' ? '#b91c1c' : '#1e40af'
                          }}>
                            {isMasterDirective 
                              ? '📢 قرار وتوجيه إداري من الماستر' 
                              : req.type === 'need' ? '🚨 طلب استعانة (سد عجز)' : '🌟 طلب إتاحة / ندب كادر فائض'}
                          </span>

                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                            مادة {req.subject} • {req.track === 'international' ? 'مسار دولي' : 'مسار أهلي'} • {req.gender === 'girls' ? 'بنات' : 'بنين'}
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                          {req.teacherName ? `المعلم المرشح: ${req.teacherName} (نصاب ${req.currentLoad || 8} حصص)` : `الحصص المطلوبة: ${req.requiredPeriods || 20} حصة أسبوعية`}
                          {req.reason && ` • البيان: ${req.reason}`}
                        </div>

                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          {isMasterDirective ? (
                            <span>📢 الصادر من: <strong>{req.requesterName}</strong> • موجه إلى: <strong style={{ color: '#4338ca' }}>{req.targetSchoolName || req.schoolName}</strong> • {new Date(req.createdAt).toLocaleDateString('ar-SA')}</span>
                          ) : (
                            <span>📩 مقدم الطلب: <strong>{req.requesterName}</strong> ({req.schoolName}) • موجه إلى: <strong>الإدارة العامة والماستر</strong> • {new Date(req.createdAt).toLocaleDateString('ar-SA')}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Status Badge */}
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '5px 12px',
                          borderRadius: '10px',
                          background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: req.status === 'approved' ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#b45309'
                        }}>
                          {req.status === 'approved' ? '✓ تم الاعتماد والتوجيه' : req.status === 'rejected' ? '✕ مرفوض' : '⏳ قيد الدراسة لدى الماستر'}
                        </span>

                      {/* SuperAdmin Action Buttons */}
                      {isSuperAdmin && req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleUpdateTransferStatus(req.id, 'approved')}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '12px', background: '#16a34a', border: 'none' }}
                          >
                            اعتماد التوجيه
                          </button>
                          <button
                            onClick={() => handleUpdateTransferStatus(req.id, 'rejected')}
                            className="btn"
                            style={{ padding: '6px 12px', fontSize: '12px', background: '#fee2e2', color: '#dc2626', border: 'none' }}
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODALS */}

      {/* Modal 1: Add / Edit Building */}
      {showBuildingModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowBuildingModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <h3 style={{ margin: '0 0 20px 0', fontSize: '19px', color: 'var(--color-primary-dark)' }}>
              {editingBuilding ? 'تعديل بيانات المبنى والمرفق' : 'إضافة مبنى أو مجمع تعليمي جديد'}
            </h3>

            <form onSubmit={handleSaveBuilding} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>اسم المبنى / المرفق *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={buildingForm.buildingName}
                    onChange={(e) => setBuildingForm({ ...buildingForm, buildingName: e.target.value })}
                    placeholder="مثال: مبنى المرحلة الثانوية والدبلومة الدولية"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>رمز المبنى</label>
                  <input
                    type="text"
                    className="input-field"
                    value={buildingForm.code}
                    onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })}
                    placeholder="BLD-01"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المسار التعليمي *</label>
                  <select
                    className="input-field"
                    value={buildingForm.track}
                    onChange={(e) => setBuildingForm({ ...buildingForm, track: e.target.value })}
                  >
                    <option value="national">المسار الأهلي المطور</option>
                    <option value="international">المسار الدولي / الدبلومة الأمريكية</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>القسم (الجنس) *</label>
                  <select
                    className="input-field"
                    value={buildingForm.gender}
                    onChange={(e) => setBuildingForm({ ...buildingForm, gender: e.target.value })}
                  >
                    <option value="boys">قسم البنين (Boys)</option>
                    <option value="girls">قسم البنات (Girls)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>عدد الأدوار</label>
                  <input
                    type="number"
                    className="input-field"
                    value={buildingForm.floors}
                    onChange={(e) => setBuildingForm({ ...buildingForm, floors: Number(e.target.value) })}
                    min="1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>إجمالي القاعات</label>
                  <input
                    type="number"
                    className="input-field"
                    value={buildingForm.totalRooms}
                    onChange={(e) => setBuildingForm({ ...buildingForm, totalRooms: Number(e.target.value) })}
                    min="1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>فصول مستغلة</label>
                  <input
                    type="number"
                    className="input-field"
                    value={buildingForm.activeClassrooms}
                    onChange={(e) => setBuildingForm({ ...buildingForm, activeClassrooms: Number(e.target.value) })}
                    min="1"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>السعة القصوى</label>
                  <input
                    type="number"
                    className="input-field"
                    value={buildingForm.capacity}
                    onChange={(e) => setBuildingForm({ ...buildingForm, capacity: Number(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المرافق والتجهيزات المتوفرة:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {BUILDING_FACILITIES_CATALOG.map(fac => {
                    const isChecked = (buildingForm.facilities || []).includes(fac.id);
                    return (
                      <label key={fac.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newFacs = e.target.checked
                              ? [...(buildingForm.facilities || []), fac.id]
                              : (buildingForm.facilities || []).filter(f => f !== fac.id);
                            setBuildingForm({ ...buildingForm, facilities: newFacs });
                          }}
                        />
                        <span>{fac.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ملاحظات وتجهيزات خاصة</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={buildingForm.notes}
                  onChange={(e) => setBuildingForm({ ...buildingForm, notes: e.target.value })}
                  placeholder="ملاحظات حول الصيانة أو شاشات التعلم الذكي..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowBuildingModal(false)} className="btn btn-outline">
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBuilding ? 'حفظ التعديلات' : 'إضافة المبنى الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Transfer / Need Request & SuperAdmin Directives */}
      {showTransferModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowTransferModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: isSuperAdmin ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                {isSuperAdmin ? <Send size={20} /> : <ArrowLeftRight size={20} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: isSuperAdmin ? '#4338ca' : 'var(--color-primary-dark)' }}>
                  {isSuperAdmin
                    ? (transferForm.type === 'need' ? 'توجيه وقرار إداري بسد عجز وتكليف كادر لمدرسة' : 'قرار إداري بنقل وندب معلم فائض لفرع آخر')
                    : (transferForm.type === 'need' ? 'طلب استعانة بمعلم جديد لسد العجز (للإدارة العامة والماستر)' : 'طلب إتاحة / ندب معلم فائض (للإدارة العامة والماستر)')
                  }
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  {isSuperAdmin ? 'توجيه رسمي مباشر صادر من الإدارة العامة إلى مدير المجمع والفرع' : 'رفع طلب رسمي للإدارة العامة وسوبر أدمن المدارس لاتخاذ قرار التوزيع'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitTransferRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Target School Selector for SuperAdmin */}
              {isSuperAdmin && (
                <div style={{ background: '#f5f3ff', border: '1px solid #c7d2fe', padding: '12px 14px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#4338ca', marginBottom: '6px' }}>
                    المدرسة / مدير المدرسة الموجه إليه القرار الإداري *
                  </label>
                  <select
                    className="input-field"
                    required
                    value={transferForm.targetSchoolId || selectedSchoolId}
                    onChange={(e) => setTransferForm({ ...transferForm, targetSchoolId: e.target.value })}
                    style={{ borderColor: '#818cf8', fontWeight: 600 }}
                  >
                    {schoolsList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: '#6366f1', marginTop: '4px', display: 'block' }}>
                    💡 سيصل هذا القرار والتوجيه فوراً إلى لوحة تحكم مدير الفرع المختار.
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>نوع المعاملة *</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="reqType"
                      value="need"
                      checked={transferForm.type === 'need'}
                      onChange={() => setTransferForm({ ...transferForm, type: 'need' })}
                    />
                    <span>🚨 {isSuperAdmin ? 'قرار تكليف لسد عجز' : 'طلب استعانة (سد عجز)'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="reqType"
                      value="release"
                      checked={transferForm.type === 'release'}
                      onChange={() => setTransferForm({ ...transferForm, type: 'release' })}
                    />
                    <span>🌟 {isSuperAdmin ? 'قرار ندب كادر فائض' : 'إتاحة وندب كادر فائض'}</span>
                  </label>
                </div>
              </div>

              {/* Comprehensive Subjects Dropdown */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  المادة الدراسية / التخصص (جميع المواد والمسارات) *
                </label>
                <select
                  className="input-field"
                  value={transferForm.subject}
                  onChange={(e) => setTransferForm({ ...transferForm, subject: e.target.value })}
                  style={{ fontWeight: 600 }}
                >
                  {Object.entries(subjectsByCategory).map(([cat, list]) => (
                    <optgroup key={cat} label={`── ${cat} ──`}>
                      {list.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Custom Subject Text Input if 'أخرى' is selected */}
              {(transferForm.subject.includes('أخرى') || transferForm.subject === 'مادة أخرى (تحديد يدوي)') && (
                <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '4px', color: '#166534' }}>
                    اكتب اسم المادة أو التخصص بالتفصيل *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={transferForm.customSubject}
                    onChange={(e) => setTransferForm({ ...transferForm, customSubject: e.target.value })}
                    placeholder="مثال: علم البيانات والذكاء الاصطناعي، AP Microeconomics، الروبوت..."
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المسار التعليمي *</label>
                  <select
                    className="input-field"
                    value={transferForm.track}
                    onChange={(e) => setTransferForm({ ...transferForm, track: e.target.value })}
                  >
                    <option value="national">المسار الأهلي المطور</option>
                    <option value="international">المسار الدولي / الدبلومة الأمريكية</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>القسم (الجنس) *</label>
                  <select
                    className="input-field"
                    value={transferForm.gender}
                    onChange={(e) => setTransferForm({ ...transferForm, gender: e.target.value })}
                  >
                    <option value="boys">بنين (Boys)</option>
                    <option value="girls">بنات (Girls)</option>
                  </select>
                </div>
              </div>

              {transferForm.type === 'release' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>اسم المعلم المرشح للندب / النقل *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={transferForm.teacherName}
                    onChange={(e) => setTransferForm({ ...transferForm, teacherName: e.target.value })}
                    placeholder="اسم المعلم الرباعي"
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عدد الحصص الأسبوعية الشاغرة *</label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    value={transferForm.requiredPeriods}
                    onChange={(e) => setTransferForm({ ...transferForm, requiredPeriods: Number(e.target.value) })}
                    min="1"
                    max="40"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  {isSuperAdmin ? 'التوجيهات والقرارات المرفقة لمدير المدرسة' : 'مبررات وتفاصيل الطلب'}
                </label>
                <textarea
                  className="input-field"
                  rows="3"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder={isSuperAdmin ? 'اكتب التعليمات والقرارات الإدارية للمدير بخصوص تغطية الحصص والندب...' : 'بيان سبب العجز أو ظروف الندب المقترح...'}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowTransferModal(false)} className="btn btn-outline">
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: isSuperAdmin ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700
                  }}
                >
                  <Send size={16} />
                  <span>
                    {isSuperAdmin ? 'إرسال وتوجيه القرار لمدير المدرسة' : 'إرسال الطلب للإدارة العامة والماستر'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: SuperAdmin Directive Modal */}
      {showDirectiveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowDirectiveModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
              }}>
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#4338ca' }}>
                  إرسال توجيه إداري رسمي لمدير المدرسة بخصوص الفائض والعجز
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  قرارات وتعاميم الإدارة العامة للمدارس بخصوص الكوادر والفصول
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitDirective} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المدرسة المستهدفة *</label>
                <select
                  className="input-field"
                  value={directiveForm.targetSchoolId}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, targetSchoolId: e.target.value })}
                >
                  <option value="ALL">📢 تعميم لكافة مدراء فروع ومجمعات الشركة</option>
                  {schoolsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Subject Dropdown for Directives */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المادة / التخصص المعني بالتوجيه *</label>
                <select
                  className="input-field"
                  value={directiveForm.subject}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, subject: e.target.value })}
                >
                  {Object.entries(subjectsByCategory).map(([cat, list]) => (
                    <optgroup key={cat} label={`── ${cat} ──`}>
                      {list.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {(directiveForm.subject.includes('أخرى') || directiveForm.subject === 'مادة أخرى (تحديد يدوي)') && (
                <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '4px', color: '#166534' }}>
                    اكتب اسم المادة أو التخصص بالتفصيل *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={directiveForm.customSubject}
                    onChange={(e) => setDirectiveForm({ ...directiveForm, customSubject: e.target.value })}
                    placeholder="مثال: علم البيانات، الروبوت والذكاء الاصطناعي..."
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عنوان التوجيه الإداري *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={directiveForm.title}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, title: e.target.value })}
                  placeholder="مثال: توجيه بندب معلم الرياضيات لسد العجز في الفرع المجاور"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>نص التوجيه والتعليمات *</label>
                <textarea
                  className="input-field"
                  rows="4"
                  required
                  value={directiveForm.content}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, content: e.target.value })}
                  placeholder="اكتب التوجيه والقرارات الإدارية الخاصة بالكوادر والفصول..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>اسم المعلم الموجه للنقل / الندب (إن وجد)</label>
                <input
                  type="text"
                  className="input-field"
                  value={directiveForm.assignedTeacherName}
                  onChange={(e) => setDirectiveForm({ ...directiveForm, assignedTeacherName: e.target.value })}
                  placeholder="اسم المعلم المنقول لسد العجز"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowDirectiveModal(false)} className="btn btn-outline">
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#4f46e5', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <Send size={16} />
                  <span>إرسال التوجيه لمدير المدرسة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Official Printable Resources Report */}
      {showPrintModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '900px', maxHeight: '92vh', overflowY: 'auto',
            background: 'white', padding: '36px', borderRadius: '20px', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #0d9488', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: '#0f766e', fontSize: '22px' }}>
                  تقرير حصر الموارد واستغلال الأصول وتوازن الكوادر التعليمية
                </h2>
                <div style={{ fontSize: '14px', color: '#64748b' }}>
                  {currentSchoolInfo.name} • شركة المدارس المتقدمة للتعلم الذكي
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => window.print()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Printer size={16} /> طباعة التقرير
                </button>
                <button onClick={() => setShowPrintModal(false)} className="btn btn-outline">
                  إغلاق
                </button>
              </div>
            </div>

            {/* Print Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>إجمالي المباني</span>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{buildingsList.length} مباني</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>الطاقة الاستيعابية</span>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{metrics.totalCapacity} طالب</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>الطلاب المسجلون</span>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{metrics.studentsCount} طالب</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>نسبة الإشغال</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0d9488' }}>{metrics.capacityUtilization}%</div>
              </div>
            </div>

            {/* Buildings Summary Table */}
            <h4 style={{ color: '#0f766e', marginBottom: '10px' }}>أولاً: حصر المباني والمرافق والقاعات</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '8px', textAlign: 'right' }}>اسم المبنى</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>المسار / القسم</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>القاعات المستغلة</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>السعة القصوى</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>حالة المبنى</th>
                </tr>
              </thead>
              <tbody>
                {buildingsList.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{b.buildingName}</td>
                    <td style={{ padding: '8px' }}>{b.track === 'international' ? 'دولي' : 'أهلي'} • {b.gender === 'girls' ? 'بنات' : 'بنين'}</td>
                    <td style={{ padding: '8px' }}>{b.activeClassrooms} / {b.totalRooms}</td>
                    <td style={{ padding: '8px' }}>{b.capacity} طالب</td>
                    <td style={{ padding: '8px' }}>{b.condition || 'ممتاز'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quotas & Staff Balance Table */}
            <h4 style={{ color: '#0f766e', marginBottom: '10px' }}>ثانياً: توازن الكوادر وحصر الفائض والعجز في الأنصبة</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '8px', textAlign: 'right' }}>المادة</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>الحصص المطلوبة</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>المعلمون الحاليون</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>الطاقة المتوفرة</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>صافي الفائض / العجز</th>
                </tr>
              </thead>
              <tbody>
                {metrics.subjectAnalysis.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{s.subject}</td>
                    <td style={{ padding: '8px' }}>{s.totalPeriodsNeeded} حصة</td>
                    <td style={{ padding: '8px' }}>{s.teachersCount}</td>
                    <td style={{ padding: '8px' }}>{s.totalTeachingCapacity} حصة</td>
                    <td style={{ padding: '8px', fontWeight: 700, color: s.status === 'surplus' ? '#16a34a' : s.status === 'deficit' ? '#dc2626' : '#64748b' }}>
                      {s.status === 'surplus' ? `+${s.netTeacherDiff} فائض` : s.status === 'deficit' ? `-${s.netTeacherDiff} عجز` : 'متوازن'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '30px' }}>مدير المجمع والمدرسة</div>
                <div style={{ color: '#64748b' }}>الاسم والتوقيع: .....................</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '30px' }}>المشرف التعليمي المتابع</div>
                <div style={{ color: '#64748b' }}>الاسم والتوقيع: .....................</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '30px' }}>اعتماد الإدارة العامة (الماستر)</div>
                <div style={{ color: '#64748b' }}>الختم والاعتماد الرسمي</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
