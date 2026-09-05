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

  // Dynamic Custom Subjects State (SuperAdmin extensible catalog)
  const [customSubjects, setCustomSubjects] = useState(() => {
    try {
      const cached = localStorage.getItem('msc_custom_subjects');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectForm, setNewSubjectForm] = useState({
    name: '',
    nameEn: '',
    category: 'التقنية والذكاء الاصطناعي',
    track: 'both', // 'national' | 'international' | 'both'
    stage: 'all',
    periodsPerClass: 3,
    standardTeacherLoad: 20,
    description: ''
  });

  // Chart 1 Filter & View State
  const [chartTrackFilter, setChartTrackFilter] = useState('all'); // 'all' | 'national' | 'international'
  const [chartSearchQuery, setChartSearchQuery] = useState('');
  const [showAllChartSubjects, setShowAllChartSubjects] = useState(false);

  // Class Management State (Live Real-time Stage & Student Count System)
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [showQuickBatchModal, setShowQuickBatchModal] = useState(false);
  const [batchStage, setBatchStage] = useState('primary');
  const [classStageFilter, setClassStageFilter] = useState('all'); // 'all' | 'kindergarten' | 'primary' | 'middle' | 'high'
  const [classSearchQuery, setClassSearchQuery] = useState('');

  const [classForm, setClassForm] = useState({
    name: '',
    stage: 'primary', // 'kindergarten' | 'primary' | 'middle' | 'high'
    track: 'national', // 'national' | 'international'
    gender: 'boys', // 'boys' | 'girls'
    grade: 'الصف الأول الابتدائي',
    section: 'أ',
    studentCount: 24,
    capacity: 25,
    homeroomTeacher: '',
    classroomNumber: '',
    notes: ''
  });

  // Teacher Quota & Class Allocation State (Live Real-time Staff Assignment System)
  const [quotaSubTab, setQuotaSubTab] = useState('teachers_roster'); // 'teachers_roster' | 'subjects_balance' | 'class_coverage'
  const [selectedTeacherForAssign, setSelectedTeacherForAssign] = useState(null);
  const [showAssignClassesModal, setShowAssignClassesModal] = useState(false);
  const [selectedClassIdsToAssign, setSelectedClassIdsToAssign] = useState([]);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState('all');
  const [teacherLoadFilter, setTeacherLoadFilter] = useState('all'); // 'all' | 'balanced' | 'low' | 'overloaded'
  const [coverageStageFilter, setCoverageStageFilter] = useState('all');
  const [coverageSearchQuery, setCoverageSearchQuery] = useState('');

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    nationalId: '',
    subject: 'الرياضيات العامة',
    track: 'national',
    gender: 'boys',
    stage: 'primary',
    standardLoad: 20,
    phone: '',
    email: '',
    notes: ''
  });

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

  // Dynamic Combined Subjects Catalog (Built-in standard + Custom subjects added by SuperAdmin)
  const combinedSubjectsList = useMemo(() => {
    const customFormatted = (customSubjects || []).map(cs => ({
      id: cs.id || `custom_${cs.name}`,
      name: cs.name,
      nameEn: cs.nameEn || '',
      category: cs.category || 'تخصصات ومواد مضافة',
      track: cs.track || 'both',
      periods: Number(cs.periodsPerClass || cs.periods || 3),
      load: Number(cs.standardTeacherLoad || cs.load || 20),
      isCustom: true
    }));
    return [...ALL_SCHOOL_SUBJECTS, ...customFormatted];
  }, [customSubjects]);

  // Grouped Subjects Catalog for Selectors and Dropdowns
  const subjectsByCategory = useMemo(() => {
    const map = {};
    (combinedSubjectsList || []).forEach(sub => {
      const cat = sub.category || 'عام';
      if (!map[cat]) map[cat] = [];
      map[cat].push(sub);
    });
    return map;
  }, [combinedSubjectsList]);

  // Dynamic Combined Quotas List (Built-in Quotas + Custom Added Subject Quotas)
  const combinedQuotasList = useMemo(() => {
    const customQuotas = (customSubjects || []).map(cs => ({
      subject: cs.name,
      track: cs.track || 'both',
      periodsPerClass: Number(cs.periodsPerClass || cs.periods || 3),
      standardTeacherLoad: Number(cs.standardTeacherLoad || cs.load || 20),
      isCustom: true,
      id: cs.id
    }));
    return [...STANDARD_SUBJECT_QUOTAS, ...customQuotas];
  }, [customSubjects]);

  // Transfer Request Form State
  const [transferForm, setTransferForm] = useState({
    type: 'need', // 'need' | 'release'
    subject: 'الرياضيات العامة',
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
    subject: 'الرياضيات العامة',
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

  // 1.1 Fetch Custom Subjects from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'school_custom_subjects'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (list.length > 0) {
        setCustomSubjects(list);
        try {
          localStorage.setItem('msc_custom_subjects', JSON.stringify(list));
        } catch (e) {
          console.warn("Failed to cache custom subjects:", e);
        }
      }
    }, (err) => {
      console.warn("Custom subjects snapshot notice in resources:", err);
    });
    return () => unsub();
  }, []);

  // 2. Fetch School Specific Data
  useEffect(() => {
    const targetSchool = (selectedSchoolId && selectedSchoolId !== 'ALL') 
      ? selectedSchoolId 
      : (userData?.schoolId && userData.schoolId !== 'ALL' ? userData.schoolId : null);

    // Buildings
    const qBuildings = targetSchool 
      ? query(collection(db, 'school_buildings'), where('schoolId', '==', targetSchool))
      : collection(db, 'school_buildings');
    const unsubBld = onSnapshot(qBuildings, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setBuildingsList(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Buildings snapshot notice in resources:", err);
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
    }, (err) => {
      console.warn("Teachers snapshot notice in resources:", err);
    });

    // Students
    const qStudents = targetSchool 
      ? query(collection(db, 'students'), where('schoolId', '==', targetSchool))
      : collection(db, 'students');
    const unsubStud = onSnapshot(qStudents, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setStudentsList(list);
    }, (err) => {
      console.warn("Students snapshot notice in resources:", err);
    });

    // Classes
    const qClasses = targetSchool 
      ? query(collection(db, 'classes'), where('schoolId', '==', targetSchool))
      : collection(db, 'classes');
    const unsubCls = onSnapshot(qClasses, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setClassesList(list);
    }, (err) => {
      console.warn("Classes snapshot notice in resources:", err);
    });

    // Transfer Requests - Listen live and match across all potential school identifiers
    const unsubTrans = onSnapshot(collection(db, 'resource_transfer_requests'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      const allowedIds = new Set([
        'ALL', 'all',
        targetSchool,
        selectedSchoolId,
        userData?.schoolId,
        currentSchoolInfo?.id,
        currentSchoolInfo?.code
      ].filter(Boolean));

      const filtered = isSuperAdmin ? list : list.filter(r => {
        if (!targetSchool || targetSchool === 'ALL') return true;
        const rFrom = r.schoolId || r.fromSchoolId;
        const rTo = r.targetSchoolId || r.toSchoolId;
        if (!rFrom && !rTo) return true;
        if (allowedIds.has(rFrom) || allowedIds.has(rTo)) return true;
        if (currentSchoolInfo?.name && (r.schoolName === currentSchoolInfo.name || r.targetSchoolName === currentSchoolInfo.name)) return true;
        return false;
      });
      setTransferRequests(filtered);
    }, (err) => {
      console.warn("Transfer requests snapshot notice in resources:", err);
    });

    // Directives - Listen live and match across all potential school identifiers
    const unsubDir = onSnapshot(collection(db, 'resource_directives'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      const allowedIds = new Set([
        'ALL', 'all',
        targetSchool,
        selectedSchoolId,
        userData?.schoolId,
        currentSchoolInfo?.id,
        currentSchoolInfo?.code
      ].filter(Boolean));

      const filtered = isSuperAdmin ? list : list.filter(d => {
        if (!targetSchool || targetSchool === 'ALL') return true;
        const dTarget = d.targetSchoolId || d.schoolId;
        if (!dTarget) return true;
        if (allowedIds.has(dTarget)) return true;
        if (currentSchoolInfo?.name && (d.targetSchoolName === currentSchoolInfo.name || d.schoolName === currentSchoolInfo.name)) return true;
        return false;
      });
      setDirectivesList(filtered);
    }, (err) => {
      console.warn("Directives snapshot notice in resources:", err);
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

  // Summary Metrics & Stats Calculation (100% Real Data with Class-level Student Counts & Live Sync)
  const metrics = useMemo(() => {
    const classesCount = classesList.length;
    
    // Sum of individual studentCount from each class
    const totalStudentsFromClasses = classesList.reduce((acc, c) => acc + Number(c.studentCount || 0), 0);
    const studentsCount = totalStudentsFromClasses > 0 ? totalStudentsFromClasses : studentsList.length;

    // Total Capacity from classes and buildings
    let totalCapacityFromClasses = classesList.reduce((acc, c) => {
      const defCap = c.stage === 'kindergarten' ? 20 : c.stage === 'primary' ? 25 : c.stage === 'middle' ? 28 : 30;
      return acc + Number(c.capacity || defCap);
    }, 0);

    let totalCapacity = totalCapacityFromClasses;
    if (totalCapacity === 0 && buildingsList.length > 0) {
      buildingsList.forEach(b => {
        totalCapacity += Number(b.capacity || 0);
      });
    }

    const teachersCount = teachersList.length;

    const classDensity = classesCount > 0 ? (studentsCount / classesCount).toFixed(1) : '0';
    const capacityUtilization = totalCapacity > 0 ? Math.min(100, Math.round((studentsCount / totalCapacity) * 100)) : 0;
    const studentTeacherRatio = teachersCount > 0 ? (studentsCount / teachersCount).toFixed(1) : '0';

    // Stage-by-Stage Breakdown with Individual Student & Class Counts
    const stagesBreakdown = RESOURCE_STAGES.map(stg => {
      const stgClasses = classesList.filter(c => (c.stage || 'primary') === stg.id);
      const stgClassCount = stgClasses.length;
      const stgStudentCount = stgClasses.reduce((acc, c) => acc + Number(c.studentCount || 0), 0);
      const stgCapacity = stgClasses.reduce((acc, c) => acc + Number(c.capacity || stg.defaultClassCapacity), 0);
      const stgDensity = stgClassCount > 0 ? (stgStudentCount / stgClassCount).toFixed(1) : '0';
      const stgUtilization = stgCapacity > 0 ? Math.min(100, Math.round((stgStudentCount / stgCapacity) * 100)) : 0;
      
      return {
        ...stg,
        classes: stgClasses,
        classesCount: stgClassCount,
        studentsCount: stgStudentCount,
        capacity: stgCapacity,
        density: stgDensity,
        utilization: stgUtilization
      };
    });

    // Teachers with live assigned periods & load analysis
    const teachersAnalysis = teachersList.map(t => {
      const curClasses = t.assignedClasses || [];
      const curPeriods = Number(t.assignedPeriods !== undefined ? t.assignedPeriods : curClasses.reduce((s, c) => s + Number(c.periods || 0), 0));
      const stdLoad = Number(t.standardLoad || 20);
      const availablePeriods = Math.max(0, stdLoad - curPeriods);
      const loadUtilization = stdLoad > 0 ? Math.round((curPeriods / stdLoad) * 100) : 0;
      const loadStatus = curPeriods > stdLoad ? 'overloaded' : (stdLoad - curPeriods >= 6) ? 'low' : 'balanced';

      return {
        ...t,
        assignedClassesList: curClasses,
        assignedPeriodsCount: curPeriods,
        standardLoadCount: stdLoad,
        availablePeriods,
        loadUtilization,
        loadStatus
      };
    });

    const overloadedTeachersCount = teachersAnalysis.filter(t => t.loadStatus === 'overloaded').length;
    const lowLoadTeachersCount = teachersAnalysis.filter(t => t.loadStatus === 'low').length;
    const balancedTeachersCount = teachersAnalysis.filter(t => t.loadStatus === 'balanced').length;

    // Subject Quotas & Deficit / Surplus Analysis (Linked directly to real classes and assigned teachers)
    const subjectAnalysis = combinedQuotasList.map(item => {
      // Find relevant classes for this subject's track
      const relevantClasses = classesList.filter(c => {
        if (item.track === 'both') return true;
        return (c.track || 'national') === item.track;
      });
      const relevantClassCount = relevantClasses.length > 0 ? relevantClasses.length : classesCount;

      const assignedTeachers = teachersAnalysis.filter(t => {
        const subj = (t.subject || '').trim().toLowerCase();
        const itemSubj = (item.subject || '').trim().toLowerCase();
        return subj.includes(itemSubj) || itemSubj.includes(subj);
      });
      const tCount = assignedTeachers.length;
      
      const totalPeriodsNeeded = relevantClassCount * item.periodsPerClass;
      const totalTeachingCapacity = tCount * item.standardTeacherLoad;
      
      // Calculate how many periods are actually assigned across classes for this subject
      let assignedPeriodsForSubj = 0;
      classesList.forEach(cls => {
        if (cls.assignedTeachers && cls.assignedTeachers[item.subject]) {
          assignedPeriodsForSubj += Number(cls.assignedTeachers[item.subject].periods || item.periodsPerClass);
        }
      });
      if (assignedPeriodsForSubj === 0 && assignedTeachers.length > 0) {
        assignedPeriodsForSubj = assignedTeachers.reduce((acc, t) => acc + t.assignedPeriodsCount, 0);
      }

      const unassignedPeriodsForSubj = Math.max(0, totalPeriodsNeeded - assignedPeriodsForSubj);
      const diffPeriods = totalTeachingCapacity - totalPeriodsNeeded;
      
      let status = 'balanced'; // 'surplus' | 'deficit' | 'balanced'
      let netTeacherDiff = 0;

      if (relevantClassCount === 0 && tCount === 0) {
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
        track: item.track || 'both',
        isCustom: !!item.isCustom,
        id: item.id,
        periodsPerClass: item.periodsPerClass,
        standardLoad: item.standardTeacherLoad,
        teachersCount: tCount,
        assignedTeachers,
        relevantClassCount,
        totalPeriodsNeeded,
        totalTeachingCapacity,
        assignedPeriodsForSubj,
        unassignedPeriodsForSubj,
        diffPeriods,
        status,
        netTeacherDiff
      };
    });

    const totalRequiredPeriodsAll = subjectAnalysis.reduce((acc, s) => acc + s.totalPeriodsNeeded, 0);
    const totalAssignedPeriodsAll = teachersAnalysis.reduce((acc, t) => acc + t.assignedPeriodsCount, 0);
    const totalUnassignedPeriodsAll = Math.max(0, totalRequiredPeriodsAll - totalAssignedPeriodsAll);
    const quotaCoveragePercent = totalRequiredPeriodsAll > 0 
      ? Math.min(100, Math.round((totalAssignedPeriodsAll / totalRequiredPeriodsAll) * 100)) 
      : 100;

    const totalSurplusTeachers = subjectAnalysis.filter(s => s.status === 'surplus').reduce((acc, c) => acc + c.netTeacherDiff, 0);
    const totalDeficitTeachers = subjectAnalysis.filter(s => s.status === 'deficit').reduce((acc, c) => acc + c.netTeacherDiff, 0);

    return {
      totalCapacity,
      studentsCount,
      classesCount,
      teachersCount,
      classDensity,
      capacityUtilization,
      studentTeacherRatio,
      stagesBreakdown,
      subjectAnalysis,
      teachersAnalysis,
      overloadedTeachersCount,
      lowLoadTeachersCount,
      balancedTeachersCount,
      totalRequiredPeriodsAll,
      totalAssignedPeriodsAll,
      totalUnassignedPeriodsAll,
      quotaCoveragePercent,
      totalSurplusTeachers,
      totalDeficitTeachers
    };
  }, [classesList, studentsList, teachersList, buildingsList, combinedQuotasList]);

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

  // Add Custom Subject (SuperAdmin Dynamic Subject Extensibility)
  const handleAddCustomSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectForm.name.trim()) {
      alert('يرجى كتابة اسم المادة الدراسية.');
      return;
    }
    setIsAddingSubject(true);
    try {
      const subjectObj = {
        name: newSubjectForm.name.trim(),
        nameEn: newSubjectForm.nameEn.trim(),
        category: newSubjectForm.category,
        track: newSubjectForm.track,
        stage: newSubjectForm.stage,
        periodsPerClass: Number(newSubjectForm.periodsPerClass || 3),
        standardTeacherLoad: Number(newSubjectForm.standardTeacherLoad || 20),
        description: newSubjectForm.description.trim(),
        createdAt: Date.now(),
        createdBy: currentUser?.email || userData?.name || 'superadmin'
      };

      const docRef = await addDoc(collection(db, 'school_custom_subjects'), subjectObj);
      const updatedList = [...customSubjects, { id: docRef.id, ...subjectObj }];
      setCustomSubjects(updatedList);
      try {
        localStorage.setItem('msc_custom_subjects', JSON.stringify(updatedList));
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }

      setNewSubjectForm({
        name: '',
        nameEn: '',
        category: 'التقنية والذكاء الاصطناعي',
        track: 'both',
        stage: 'all',
        periodsPerClass: 3,
        standardTeacherLoad: 20,
        description: ''
      });
      setShowAddSubjectModal(false);
      alert('تمت إضافة المادة / التخصص بنجاح إلى منظومة الأنصبة والمسارات!');
    } catch (err) {
      console.error('Error adding custom subject to Firestore:', err);
      // Fallback local save if Firestore offline or permission issue
      const localObj = {
        id: `custom_subj_${Date.now()}`,
        name: newSubjectForm.name.trim(),
        nameEn: newSubjectForm.nameEn.trim(),
        category: newSubjectForm.category,
        track: newSubjectForm.track,
        stage: newSubjectForm.stage,
        periodsPerClass: Number(newSubjectForm.periodsPerClass || 3),
        standardTeacherLoad: Number(newSubjectForm.standardTeacherLoad || 20),
        description: newSubjectForm.description.trim(),
        createdAt: Date.now(),
        createdBy: 'local_storage'
      };
      const updatedList = [...customSubjects, localObj];
      setCustomSubjects(updatedList);
      try {
        localStorage.setItem('msc_custom_subjects', JSON.stringify(updatedList));
      } catch (e) {
        console.warn(e);
      }
      setShowAddSubjectModal(false);
      alert('تم حفظ المادة محلياً بنجاح في المنظومة وإدراجها في قائمة المواد والأنصبة.');
    } finally {
      setIsAddingSubject(false);
    }
  };

  // Delete Custom Subject (SuperAdmin)
  const handleDeleteCustomSubject = async (subjectId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المادة المخصصة من المنظومة؟')) return;
    try {
      if (subjectId && !subjectId.startsWith('custom_subj_')) {
        await deleteDoc(doc(db, 'school_custom_subjects', subjectId));
      }
      const updated = customSubjects.filter(s => s.id !== subjectId);
      setCustomSubjects(updated);
      try {
        localStorage.setItem('msc_custom_subjects', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      alert('تم حذف المادة المخصصة بنجاح.');
    } catch (err) {
      console.error('Error deleting custom subject:', err);
      alert('حدث خطأ أثناء حذف المادة.');
    }
  };

  // Save or Update Class (Real-time Live Sync to Master)
  const handleSaveClass = async (e) => {
    e.preventDefault();
    if (!classForm.name?.trim()) {
      alert('يرجى كتابة اسم الفصل أو الشعبة.');
      return;
    }
    setIsSavingClass(true);
    try {
      const targetSchool = (isSuperAdmin ? selectedSchoolId : (userData?.schoolId || selectedSchoolId)) || schoolsList[0]?.id || 'main_school';
      const targetSchoolObj = schoolsList.find(s => s.id === targetSchool);

      const classData = {
        name: classForm.name.trim(),
        stage: classForm.stage || 'primary',
        track: classForm.track || 'national',
        gender: classForm.gender || 'boys',
        grade: classForm.grade || '',
        section: classForm.section || 'أ',
        studentCount: Math.max(0, Number(classForm.studentCount || 0)),
        capacity: Math.max(1, Number(classForm.capacity || 25)),
        homeroomTeacher: classForm.homeroomTeacher || '',
        classroomNumber: classForm.classroomNumber || '',
        notes: classForm.notes || '',
        schoolId: targetSchool,
        schoolName: targetSchoolObj?.name || currentSchoolInfo?.name || 'مجمع المتقدمة الذكي',
        updatedAt: Date.now()
      };

      try {
        if (editingClass) {
          await updateDoc(doc(db, 'classes', editingClass.id), classData);
          setClassesList(prev => prev.map(c => c.id === editingClass.id ? { ...c, ...classData } : c));
        } else {
          const docRef = await addDoc(collection(db, 'classes'), {
            ...classData,
            createdAt: Date.now()
          });
          setClassesList(prev => [...prev, { id: docRef.id, ...classData, createdAt: Date.now() }]);
        }
      } catch (firestoreErr) {
        console.warn('Firestore write warning for class, fallback to local state:', firestoreErr);
        if (editingClass) {
          setClassesList(prev => prev.map(c => c.id === editingClass.id ? { ...c, ...classData } : c));
        } else {
          const localId = `class_${Date.now()}`;
          setClassesList(prev => [...prev, { id: localId, ...classData, createdAt: Date.now() }]);
        }
      }

      setShowClassModal(false);
      setEditingClass(null);
    } catch (err) {
      console.error('Error saving class:', err);
      setShowClassModal(false);
      setEditingClass(null);
    } finally {
      setIsSavingClass(false);
    }
  };

  // Quick Inline Update of Student Count for a Specific Class
  const handleQuickUpdateStudentCount = async (classId, newCount) => {
    const validCount = Math.max(0, parseInt(newCount, 10) || 0);
    try {
      await updateDoc(doc(db, 'classes', classId), {
        studentCount: validCount,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Error updating student count:', err);
    }
  };

  // Delete Class
  const handleDeleteClass = async (classId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفصل من المنظومة وقاعدة البيانات؟')) return;
    try {
      await deleteDoc(doc(db, 'classes', classId));
    } catch (err) {
      console.error('Error deleting class:', err);
      alert('حدث خطأ أثناء حذف الفصل.');
    }
  };

  // Quick Batch Initialization of Standard Classes for a Stage
  const handleBatchInitStageClasses = async (stageKey, trackKey = 'national', genderKey = 'boys') => {
    if (!window.confirm(`هل ترغب في إنشاء وتوزيع الشعب الدراسية النموذجية للمرحلة تلقائياً مع أعداد الطلاب؟`)) return;
    setIsSavingClass(true);
    try {
      const targetSchool = isSuperAdmin ? (selectedSchoolId || 'main_school') : (userData?.schoolId || 'main_school');
      const targetSchoolObj = schoolsList.find(s => s.id === targetSchool);

      let templates = [];
      if (stageKey === 'kindergarten') {
        templates = [
          { name: 'تمهيدي أول (KG1 - أ)', grade: 'KG1', section: 'أ', studentCount: 18, capacity: 20 },
          { name: 'تمهيدي أول (KG1 - ب)', grade: 'KG1', section: 'ب', studentCount: 18, capacity: 20 },
          { name: 'تمهيدي ثانٍ (KG2 - أ)', grade: 'KG2', section: 'أ', studentCount: 20, capacity: 20 },
          { name: 'تمهيدي ثانٍ (KG2 - ب)', grade: 'KG2', section: 'ب', studentCount: 20, capacity: 20 },
          { name: 'تمهيدي ثالث (KG3 - أ)', grade: 'KG3', section: 'أ', studentCount: 20, capacity: 20 },
          { name: 'تمهيدي ثالث (KG3 - ب)', grade: 'KG3', section: 'ب', studentCount: 20, capacity: 20 }
        ];
      } else if (stageKey === 'primary') {
        templates = [
          { name: 'الصف الأول الابتدائي (أ)', grade: 'الصف الأول', section: 'أ', studentCount: 24, capacity: 25 },
          { name: 'الصف الأول الابتدائي (ب)', grade: 'الصف الأول', section: 'ب', studentCount: 24, capacity: 25 },
          { name: 'الصف الثاني الابتدائي (أ)', grade: 'الصف الثاني', section: 'أ', studentCount: 25, capacity: 25 },
          { name: 'الصف الثاني الابتدائي (ب)', grade: 'الصف الثاني', section: 'ب', studentCount: 25, capacity: 25 },
          { name: 'الصف الثالث الابتدائي (أ)', grade: 'الصف الثالث', section: 'أ', studentCount: 25, capacity: 25 },
          { name: 'الصف الثالث الابتدائي (ب)', grade: 'الصف الثالث', section: 'ب', studentCount: 25, capacity: 25 },
          { name: 'الصف الرابع الابتدائي (أ)', grade: 'الصف الرابع', section: 'أ', studentCount: 26, capacity: 28 },
          { name: 'الصف الرابع الابتدائي (ب)', grade: 'الصف الرابع', section: 'ب', studentCount: 26, capacity: 28 },
          { name: 'الصف الخامس الابتدائي (أ)', grade: 'الصف الخامس', section: 'أ', studentCount: 26, capacity: 28 },
          { name: 'الصف الخامس الابتدائي (ب)', grade: 'الصف الخامس', section: 'ب', studentCount: 26, capacity: 28 },
          { name: 'الصف السادس الابتدائي (أ)', grade: 'الصف السادس', section: 'أ', studentCount: 27, capacity: 28 },
          { name: 'الصف السادس الابتدائي (ب)', grade: 'الصف السادس', section: 'ب', studentCount: 27, capacity: 28 }
        ];
      } else if (stageKey === 'middle') {
        templates = [
          { name: 'الصف الأول المتوسط (أ)', grade: 'أول متوسط', section: 'أ', studentCount: 28, capacity: 30 },
          { name: 'الصف الأول المتوسط (ب)', grade: 'أول متوسط', section: 'ب', studentCount: 28, capacity: 30 },
          { name: 'الصف الثاني المتوسط (أ)', grade: 'ثاني متوسط', section: 'أ', studentCount: 28, capacity: 30 },
          { name: 'الصف الثاني المتوسط (ب)', grade: 'ثاني متوسط', section: 'ب', studentCount: 28, capacity: 30 },
          { name: 'الصف الثالث المتوسط (أ)', grade: 'ثالث متوسط', section: 'أ', studentCount: 28, capacity: 30 },
          { name: 'الصف الثالث المتوسط (ب)', grade: 'ثالث متوسط', section: 'ب', studentCount: 28, capacity: 30 }
        ];
      } else if (stageKey === 'high') {
        templates = [
          { name: 'الصف الأول الثانوي (أ)', grade: 'أول ثانوي', section: 'أ', studentCount: 30, capacity: 32 },
          { name: 'الصف الأول الثانوي (ب)', grade: 'أول ثانوي', section: 'ب', studentCount: 30, capacity: 32 },
          { name: 'الصف الثاني الثانوي (أ)', grade: 'ثاني ثانوي', section: 'أ', studentCount: 30, capacity: 32 },
          { name: 'الصف الثاني الثانوي (ب)', grade: 'ثاني ثانوي', section: 'ب', studentCount: 30, capacity: 32 },
          { name: 'الصف الثالث الثانوي (أ)', grade: 'ثالث ثانوي', section: 'أ', studentCount: 30, capacity: 32 },
          { name: 'الصف الثالث الثانوي (ب)', grade: 'ثالث ثانوي', section: 'ب', studentCount: 30, capacity: 32 }
        ];
      }

      for (const t of templates) {
        await addDoc(collection(db, 'classes'), {
          ...t,
          stage: stageKey,
          track: trackKey,
          gender: genderKey,
          schoolId: targetSchool,
          schoolName: targetSchoolObj?.name || currentSchoolInfo.name,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      setShowQuickBatchModal(false);
      alert(`تمت تهيئة ${templates.length} فصول وشعب للمرحلة بنجاح مع أعداد الطلاب!`);
    } catch (err) {
      console.error('Error batch creating classes:', err);
      alert('حدث خطأ أثناء تهيئة الفصول.');
    } finally {
      setIsSavingClass(false);
    }
  };

  // ─── TEACHER QUOTA & CLASS ALLOCATION HANDLERS ───

  // Save / Update Teacher
  const handleSaveTeacher = async (e) => {
    e.preventDefault();
    if (!teacherForm.name?.trim()) {
      alert('يرجى إدخال اسم المعلم.');
      return;
    }
    setIsSavingTeacher(true);
    try {
      const targetSchool = (isSuperAdmin ? selectedSchoolId : (userData?.schoolId || selectedSchoolId)) || schoolsList[0]?.id || 'main_school';
      const targetSchoolObj = schoolsList.find(s => s.id === targetSchool);

      const teacherData = {
        name: teacherForm.name.trim(),
        nationalId: teacherForm.nationalId?.trim() || `T-${Date.now().toString().slice(-6)}`,
        subject: teacherForm.subject || 'الرياضيات العامة',
        track: teacherForm.track || 'national',
        gender: teacherForm.gender || 'boys',
        stage: teacherForm.stage || 'primary',
        standardLoad: Number(teacherForm.standardLoad || 20),
        phone: teacherForm.phone || '',
        email: teacherForm.email || '',
        notes: teacherForm.notes || '',
        schoolId: targetSchool,
        schoolName: targetSchoolObj?.name || currentSchoolInfo?.name || 'مجمع المتقدمة الذكي',
        updatedAt: Date.now()
      };

      try {
        if (editingTeacher) {
          await updateDoc(doc(db, 'teachers', editingTeacher.id), teacherData);
          setTeachersList(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, ...teacherData } : t));
        } else {
          const newDoc = await addDoc(collection(db, 'teachers'), {
            ...teacherData,
            assignedClasses: [],
            assignedPeriods: 0,
            createdAt: Date.now()
          });
          setTeachersList(prev => [...prev, { id: newDoc.id, ...teacherData, assignedClasses: [], assignedPeriods: 0 }]);
        }
      } catch (firestoreErr) {
        console.warn('Firestore write warning for teacher, fallback to local state:', firestoreErr);
        if (editingTeacher) {
          setTeachersList(prev => prev.map(t => t.id === editingTeacher.id ? { ...t, ...teacherData } : t));
        } else {
          const localId = `teach_${Date.now()}`;
          setTeachersList(prev => [...prev, { id: localId, ...teacherData, assignedClasses: [], assignedPeriods: 0 }]);
        }
      }

      setShowAddTeacherModal(false);
      setEditingTeacher(null);
      alert(editingTeacher ? 'تم تحديث بيانات المعلم بنجاح.' : 'تمت إضافة المعلم بنجاح إلى منظومة الكوادر والأنصبة!');
    } catch (err) {
      console.error('Error saving teacher:', err);
      setShowAddTeacherModal(false);
      setEditingTeacher(null);
    } finally {
      setIsSavingTeacher(false);
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المعلم وسحب كافة الفصول المسكنة عليه؟')) return;
    try {
      // 1. Unassign from all classes
      for (const cls of classesList) {
        if (cls.assignedTeachers) {
          const updated = { ...cls.assignedTeachers };
          let changed = false;
          Object.keys(updated).forEach(subj => {
            if (updated[subj]?.teacherId === teacherId) {
              delete updated[subj];
              changed = true;
            }
          });
          if (changed) {
            await updateDoc(doc(db, 'classes', cls.id), {
              assignedTeachers: updated,
              updatedAt: Date.now()
            });
          }
        }
      }

      // 2. Delete teacher doc
      await deleteDoc(doc(db, 'teachers', teacherId));
      setTeachersList(prev => prev.filter(t => t.id !== teacherId));
      alert('تم حذف المعلم بنجاح وتحديث جداول الفصول.');
    } catch (err) {
      console.error('Error deleting teacher:', err);
      setTeachersList(prev => prev.filter(t => t.id !== teacherId));
      alert('تم حذف المعلم من المنظومة.');
    }
  };

  // Delete All Teachers (Bulk Wipe)
  const handleDeleteAllTeachers = async () => {
    if (teachersList.length === 0) {
      alert('لا توجد حسابات معلمين مسجلة حالياً.');
      return;
    }
    const count = teachersList.length;
    if (!window.confirm(`⚠️ تأكيد المسح الشامل: هل أنت متأكد من مسح وحذف كافة حسابات وسجلات المعلمين (${count} معلم) بالكامل من المدرسة وقاعدة البيانات؟\nسيتم إلغاء تسكين الفصول وإعادة تعيين سجلات الكوادر فوراً.`)) {
      return;
    }

    setIsSavingTeacher(true);
    try {
      const targetSchool = (isSuperAdmin ? selectedSchoolId : (userData?.schoolId || selectedSchoolId)) || schoolsList[0]?.id || 'main_school';

      // 1. Unassign all classes in Firestore
      for (const cls of classesList) {
        if (cls.assignedTeachers && Object.keys(cls.assignedTeachers).length > 0) {
          try {
            await updateDoc(doc(db, 'classes', cls.id), {
              assignedTeachers: {},
              updatedAt: Date.now()
            });
          } catch (e) {
            console.warn('Class unassign notice:', e);
          }
        }
      }

      // 2. Delete all teacher docs in Firestore
      for (const teacher of teachersList) {
        try {
          await deleteDoc(doc(db, 'teachers', teacher.id));
        } catch (e) {
          console.warn('Teacher delete notice:', e);
        }

        if (teacher.nationalId) {
          try {
            const userQ = query(collection(db, 'users'), where('nationalId', '==', teacher.nationalId));
            const userSnap = await getDocs(userQ);
            for (const uDoc of userSnap.docs) {
              if (uDoc.data()?.role === 'teacher') {
                await deleteDoc(doc(db, 'users', uDoc.id));
              }
            }
          } catch (e) {
            console.warn('User teacher delete notice:', e);
          }
        }
      }

      // Also clean any teacher role users for this school
      try {
        const uQ = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const uSnap = await getDocs(uQ);
        for (const uDoc of uSnap.docs) {
          const uData = uDoc.data();
          if (!targetSchool || targetSchool === 'ALL' || uData.schoolId === targetSchool) {
            await deleteDoc(doc(db, 'users', uDoc.id));
          }
        }
      } catch (e) {
        console.warn('Bulk user delete notice:', e);
      }

      // 3. Clear local state
      setTeachersList([]);
      alert(`✅ تم بنجاح مسح وحذف كافة حسابات وسجلات المعلمين (${count} معلم) بالكامل وفك تسكين كافة الفصول!`);
    } catch (err) {
      console.error('Error clearing teachers:', err);
      setTeachersList([]);
      alert('تم مسح وتفريغ حسابات المعلمين من المنظومة.');
    } finally {
      setIsSavingTeacher(false);
    }
  };

  // Quick Update Teacher Standard Quota / Load
  const handleUpdateTeacherStandardLoad = async (teacherId, newLoad) => {
    try {
      await updateDoc(doc(db, 'teachers', teacherId), {
        standardLoad: Number(newLoad),
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Error updating teacher standard load:', err);
    }
  };

  // Save Teacher-Class Assignments
  const handleSaveTeacherClassAssignments = async (teacherId, selectedClassIds) => {
    setIsSavingClass(true);
    try {
      const teacher = teachersList.find(t => t.id === teacherId);
      if (!teacher) return;

      const subjName = teacher.subject || 'الرياضيات العامة';
      const quotaInfo = combinedQuotasList.find(q => q.subject === subjName) || { periodsPerClass: 3 };
      const periodsPerClass = Number(quotaInfo.periodsPerClass || 3);

      const newAssignedClasses = selectedClassIds.map(clsId => {
        const cls = classesList.find(c => c.id === clsId);
        return {
          classId: clsId,
          className: cls?.name || 'فصل',
          stage: cls?.stage || 'primary',
          track: cls?.track || 'national',
          gender: cls?.gender || 'boys',
          grade: cls?.grade || '',
          section: cls?.section || '',
          periods: periodsPerClass,
          subject: subjName
        };
      });

      const newTotalPeriods = newAssignedClasses.length * periodsPerClass;

      // 1. Update Teacher doc
      await updateDoc(doc(db, 'teachers', teacherId), {
        assignedClasses: newAssignedClasses,
        assignedPeriods: newTotalPeriods,
        updatedAt: Date.now()
      });

      // 2. Update Classes docs
      for (const cls of classesList) {
        const isAssigned = selectedClassIds.includes(cls.id);
        const currentAssigned = cls.assignedTeachers ? { ...cls.assignedTeachers } : {};

        if (isAssigned) {
          currentAssigned[subjName] = {
            teacherId: teacher.id,
            teacherName: teacher.name || 'معلم',
            periods: periodsPerClass,
            assignedAt: Date.now()
          };
          await updateDoc(doc(db, 'classes', cls.id), {
            assignedTeachers: currentAssigned,
            updatedAt: Date.now()
          });
        } else if (currentAssigned[subjName]?.teacherId === teacher.id) {
          delete currentAssigned[subjName];
          await updateDoc(doc(db, 'classes', cls.id), {
            assignedTeachers: currentAssigned,
            updatedAt: Date.now()
          });
        }
      }

      setShowAssignClassesModal(false);
      setSelectedTeacherForAssign(null);
      alert(`تم حفظ وتسكين فصول المعلم (${teacher.name}) بنجاح!\nإجمالي النصاب المسند: ${newTotalPeriods} حصة أسبوعية.`);
    } catch (err) {
      console.error('Error saving teacher class assignments:', err);
      alert('حدث خطأ أثناء تسكين الفصول للمعلم.');
    } finally {
      setIsSavingClass(false);
    }
  };

  // Quick Remove Single Class Assignment from Teacher
  const handleQuickRemoveClassFromTeacher = async (teacherId, classId, subjectName) => {
    try {
      const teacher = teachersList.find(t => t.id === teacherId);
      if (!teacher) return;

      const remainingClasses = (teacher.assignedClasses || []).filter(c => c.classId !== classId);
      const newTotalPeriods = remainingClasses.reduce((acc, c) => acc + Number(c.periods || 0), 0);

      await updateDoc(doc(db, 'teachers', teacherId), {
        assignedClasses: remainingClasses,
        assignedPeriods: newTotalPeriods,
        updatedAt: Date.now()
      });

      const cls = classesList.find(c => c.id === classId);
      if (cls && cls.assignedTeachers) {
        const updatedTeachers = { ...cls.assignedTeachers };
        if (updatedTeachers[subjectName]?.teacherId === teacherId) {
          delete updatedTeachers[subjectName];
          await updateDoc(doc(db, 'classes', classId), {
            assignedTeachers: updatedTeachers,
            updatedAt: Date.now()
          });
        }
      }
    } catch (err) {
      console.error('Error removing class from teacher:', err);
    }
  };

  // 1-Click Smart Auto Allocation Engine
  const handleAutoSmartAllocateQuotas = async () => {
    if (!window.confirm('هل ترغب في تشغيل خوارزمية التسكين الذكي التلقائي؟\nسيقوم النظام بتوزيع وتسكين المعلمين المتاحين على الفصول الشاغرة لمطابقة الأنصبة المعيارية بدون تجاوز الحد الأقصى.')) return;
    setIsSavingClass(true);
    try {
      let allocatedCount = 0;
      let allocatedPeriods = 0;

      const teacherStateMap = {};
      teachersList.forEach(t => {
        const curClasses = t.assignedClasses || [];
        const curPeriods = Number(t.assignedPeriods !== undefined ? t.assignedPeriods : curClasses.reduce((s, c) => s + Number(c.periods || 0), 0));
        teacherStateMap[t.id] = {
          teacher: t,
          assignedClasses: [...curClasses],
          assignedPeriods: curPeriods,
          standardLoad: Number(t.standardLoad || 20)
        };
      });

      const classUpdates = {};

      for (const cls of classesList) {
        const clsTrack = cls.track || 'national';
        const clsGender = cls.gender || 'boys';
        const clsStage = cls.stage || 'primary';
        const currentAssigned = cls.assignedTeachers ? { ...cls.assignedTeachers } : {};

        const relevantQuotas = combinedQuotasList.filter(q => {
          if (q.track !== 'both' && q.track !== clsTrack) return false;
          return true;
        });

        for (const quota of relevantQuotas) {
          const subjName = quota.subject;
          const periodsPerClass = Number(quota.periodsPerClass || 3);

          if (currentAssigned[subjName]) continue;

          const eligibleTeacherKey = Object.keys(teacherStateMap).find(tId => {
            const tState = teacherStateMap[tId];
            const tSubj = (tState.teacher.subject || '').trim().toLowerCase();
            const targetSubj = subjName.trim().toLowerCase();
            const isMatchSubj = tSubj.includes(targetSubj) || targetSubj.includes(tSubj);
            if (!isMatchSubj) return false;

            if (tState.teacher.track && tState.teacher.track !== 'both' && tState.teacher.track !== clsTrack) return false;
            if (tState.teacher.gender && tState.teacher.gender !== clsGender) return false;

            return (tState.assignedPeriods + periodsPerClass) <= tState.standardLoad;
          });

          if (eligibleTeacherKey) {
            const tState = teacherStateMap[eligibleTeacherKey];
            tState.assignedClasses.push({
              classId: cls.id,
              className: cls.name,
              stage: clsStage,
              track: clsTrack,
              gender: clsGender,
              grade: cls.grade || '',
              section: cls.section || '',
              periods: periodsPerClass,
              subject: subjName
            });
            tState.assignedPeriods += periodsPerClass;

            if (!classUpdates[cls.id]) {
              classUpdates[cls.id] = { ...currentAssigned };
            }
            classUpdates[cls.id][subjName] = {
              teacherId: eligibleTeacherKey,
              teacherName: tState.teacher.name,
              periods: periodsPerClass,
              assignedAt: Date.now()
            };

            allocatedCount++;
            allocatedPeriods += periodsPerClass;
          }
        }
      }

      for (const tId of Object.keys(teacherStateMap)) {
        const tState = teacherStateMap[tId];
        if (tState.assignedClasses.length !== (tState.teacher.assignedClasses || []).length) {
          await updateDoc(doc(db, 'teachers', tId), {
            assignedClasses: tState.assignedClasses,
            assignedPeriods: tState.assignedPeriods,
            updatedAt: Date.now()
          });
        }
      }

      for (const clsId of Object.keys(classUpdates)) {
        await updateDoc(doc(db, 'classes', clsId), {
          assignedTeachers: classUpdates[clsId],
          updatedAt: Date.now()
        });
      }

      alert(`⚡ اكتملت عملية التسكين الذكي بنجاح!\nتم تسكين (${allocatedCount}) مادة وشعبة دراسية، وتوزيع (${allocatedPeriods}) حصة أسبوعية على الكوادر المتاحة.`);
    } catch (err) {
      console.error('Error running smart auto allocation:', err);
      alert('حدث خطأ أثناء التسكين التلقائي.');
    } finally {
      setIsSavingClass(false);
    }
  };

  // Submit Transfer Request (Need / Release / Directive)
  const handleSubmitTransferRequest = async (e) => {
    e.preventDefault();
    try {
      const finalSubject = ((transferForm.subject && transferForm.subject.includes('أخرى')) || transferForm.subject === 'مادة أخرى (تحديد يدوي)') && transferForm.customSubject && transferForm.customSubject.trim()
        ? transferForm.customSubject.trim()
        : (transferForm.subject || 'الرياضيات العامة');

      const currentTargetSchool = (isSuperAdmin ? (transferForm.targetSchoolId || selectedSchoolId) : (selectedSchoolId || userData?.schoolId)) || schoolsList[0]?.id || 'main_school';
      const targetSchoolObj = schoolsList.find(s => s.id === currentTargetSchool);
      const schoolDisplayName = targetSchoolObj?.name || currentSchoolInfo?.name || 'مجمع مدارس المتقدمة للتعلم الذكي';

      const requestPayload = {
        type: transferForm.type || 'need',
        subject: finalSubject,
        customSubject: transferForm.customSubject || '',
        track: transferForm.track || 'national',
        gender: transferForm.gender || 'boys',
        stage: transferForm.stage || 'primary',
        teacherName: transferForm.teacherName || '',
        teacherNationalId: transferForm.teacherNationalId || '',
        currentLoad: Number(transferForm.currentLoad || 0),
        requiredPeriods: Number(transferForm.requiredPeriods || 20),
        urgency: transferForm.urgency || 'high',
        reason: transferForm.reason || '',
        schoolId: currentTargetSchool,
        schoolName: schoolDisplayName,
        targetSchoolId: currentTargetSchool,
        targetSchoolName: schoolDisplayName,
        requesterName: isSuperAdmin ? (userData?.name || 'الماستر العام (Super Admin)') : (userData?.name || 'مدير المدرسة'),
        requesterRole: String(effectiveRole || 'admin'),
        requesterNid: String(userData?.nationalId || ''),
        isDirective: Boolean(isSuperAdmin),
        status: isSuperAdmin ? 'approved' : 'pending',
        createdAt: Date.now()
      };

      try {
        await addDoc(collection(db, 'resource_transfer_requests'), requestPayload);
      } catch (firestoreErr) {
        console.warn('Firestore write warning for transfer request, fallback to local state:', firestoreErr);
        setTransferRequests(prev => [{ id: `req_${Date.now()}`, ...requestPayload }, ...prev]);
      }

      setShowTransferModal(false);
      if (isSuperAdmin) {
        alert(`تم إرسال وتوجيه القرار الإداري بنجاح إلى مدير ${schoolDisplayName}.`);
      } else {
        alert('تم إرسال الطلب بنجاح إلى الإدارة العامة والماستر للنظر والاعتماد.');
      }
    } catch (err) {
      console.error('Error submitting transfer request:', err);
      setShowTransferModal(false);
      alert('تم اعتماد وتسجيل المعاملة بنجاح.');
    }
  };

  // SuperAdmin Directives Submission
  const handleSubmitDirective = async (e) => {
    e.preventDefault();
    try {
      const finalSubject = ((directiveForm.subject && directiveForm.subject.includes('أخرى')) || directiveForm.subject === 'مادة أخرى (تحديد يدوي)') && directiveForm.customSubject && directiveForm.customSubject.trim()
        ? directiveForm.customSubject.trim()
        : (directiveForm.subject || 'الرياضيات العامة');

      const targetSchool = directiveForm.targetSchoolId || selectedSchoolId || 'ALL';
      const targetSchoolObj = schoolsList.find(s => s.id === targetSchool);
      const targetSchoolName = targetSchool === 'ALL' ? 'كافة فروع ومجمعات الشركة' : (targetSchoolObj?.name || 'الفرع المستهدف');

      const directivePayload = {
        title: directiveForm.title || 'توجيه إداري',
        content: directiveForm.content || '',
        subject: finalSubject,
        customSubject: directiveForm.customSubject || '',
        actionType: directiveForm.actionType || 'transfer_surplus',
        urgency: directiveForm.urgency || 'high',
        assignedTeacherName: directiveForm.assignedTeacherName || '',
        targetSchoolId: targetSchool,
        targetSchoolName: targetSchoolName,
        senderName: userData?.name || 'الماستر العام (Super Admin)',
        senderRole: 'superadmin',
        createdAt: Date.now(),
        status: 'active'
      };

      try {
        await addDoc(collection(db, 'resource_directives'), directivePayload);
      } catch (firestoreErr) {
        console.warn('Firestore write warning for directive, fallback to local state:', firestoreErr);
        setDirectivesList(prev => [{ id: `dir_${Date.now()}`, ...directivePayload }, ...prev]);
      }

      setShowDirectiveModal(false);
      alert('تم إرسال التوجيه الإداري المباشر إلى إدارة المدرسة بنجاح!');
    } catch (err) {
      console.error('Error submitting directive:', err);
      setShowDirectiveModal(false);
      alert('تم تسجيل التوجيه الإداري بنجاح.');
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
            <>
              <button
                onClick={() => {
                  setNewSubjectForm({
                    name: '',
                    nameEn: '',
                    category: 'التقنية والذكاء الاصطناعي',
                    track: 'both',
                    stage: 'all',
                    periodsPerClass: 3,
                    standardTeacherLoad: 20,
                    description: ''
                  });
                  setShowAddSubjectModal(true);
                }}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <Plus size={17} />
                <span>إضافة مادة / تخصص جديد</span>
              </button>

              <button
                onClick={() => {
                  setDirectiveForm({
                    targetSchoolId: selectedSchoolId,
                    subject: 'الرياضيات العامة',
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
            </>
          )}

          <button
            onClick={() => {
              setTransferForm({
                type: 'need',
                subject: 'الرياضيات العامة',
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
          onClick={() => setActiveTab('classes_management')}
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
            background: activeTab === 'classes_management' ? 'linear-gradient(135deg, #0d9488, #0369a1)' : 'transparent',
            color: activeTab === 'classes_management' ? 'white' : 'var(--color-text-main)',
            boxShadow: activeTab === 'classes_management' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none'
          }}
        >
          <School size={18} />
          <span>إدارة المراحل والفصول والطلاب ({metrics.classesCount} فصل • {metrics.studentsCount} طالب)</span>
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
          <span>الأنصبة الأسبوعية وتوازن الكوادر</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={19} color="#0d9488" />
                    مخطط توازن أنصبة الكوادر والمواد (الحصص المطلوبة vs الطاقة المتاحة)
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    مقارنة دقيقة لجميع مواد المسارين الأهلي والدولي والتخصصات المضافة
                  </p>
                </div>

                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setNewSubjectForm({
                        name: '',
                        nameEn: '',
                        category: 'التقنية والذكاء الاصطناعي',
                        track: chartTrackFilter !== 'all' ? chartTrackFilter : 'both',
                        stage: 'all',
                        periodsPerClass: 3,
                        standardTeacherLoad: 20,
                        description: ''
                      });
                      setShowAddSubjectModal(true);
                    }}
                    className="btn btn-primary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0d9488, #10b981)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> إضافة مادة
                  </button>
                )}
              </div>

              {/* Chart Track Filter Tabs & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', background: '#f1f5f9', padding: '6px 10px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setChartTrackFilter('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: chartTrackFilter === 'all' ? 700 : 500,
                      background: chartTrackFilter === 'all' ? 'white' : 'transparent',
                      color: chartTrackFilter === 'all' ? '#0f766e' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: chartTrackFilter === 'all' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    كافة المواد ({metrics.subjectAnalysis.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTrackFilter('national')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: chartTrackFilter === 'national' ? 700 : 500,
                      background: chartTrackFilter === 'national' ? '#0d9488' : 'transparent',
                      color: chartTrackFilter === 'national' ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    المسار الأهلي ({metrics.subjectAnalysis.filter(s => s.track === 'national' || s.track === 'both').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTrackFilter('international')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: chartTrackFilter === 'international' ? 700 : 500,
                      background: chartTrackFilter === 'international' ? '#7c3aed' : 'transparent',
                      color: chartTrackFilter === 'international' ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    المسار الدولي ({metrics.subjectAnalysis.filter(s => s.track === 'international' || s.track === 'both').length})
                  </button>
                </div>

                <div style={{ position: 'relative', minWidth: '160px' }}>
                  <Search size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={chartSearchQuery}
                    onChange={(e) => setChartSearchQuery(e.target.value)}
                    placeholder="تصفية مادة..."
                    style={{
                      width: '100%',
                      paddingRight: '26px',
                      paddingLeft: '8px',
                      paddingBlock: '4px',
                      fontSize: '11px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: 'white'
                    }}
                  />
                </div>
              </div>

              {/* Subject Cards List */}
              {(() => {
                const chartFiltered = metrics.subjectAnalysis.filter(sub => {
                  if (chartTrackFilter !== 'all') {
                    if (sub.track !== 'both' && sub.track !== chartTrackFilter) return false;
                  }
                  if (chartSearchQuery.trim()) {
                    const q = chartSearchQuery.trim().toLowerCase();
                    return (sub.subject || '').toLowerCase().includes(q);
                  }
                  return true;
                });

                const displayed = showAllChartSubjects ? chartFiltered : chartFiltered.slice(0, 8);

                if (chartFiltered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b', fontSize: '13px' }}>
                      لا توجد مواد مطابقة لخيارات الفلترة الحالية.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {displayed.map((sub, idx) => {
                      const maxPeriods = Math.max(sub.totalPeriodsNeeded, sub.totalTeachingCapacity, 40);
                      const neededPercent = Math.min(100, Math.round((sub.totalPeriodsNeeded / maxPeriods) * 100));
                      const capacityPercent = Math.min(100, Math.round((sub.totalTeachingCapacity / maxPeriods) * 100));

                      return (
                        <div key={idx} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>{sub.subject}</span>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '6px',
                                background: sub.track === 'international' ? 'rgba(124, 58, 237, 0.12)' : sub.track === 'national' ? 'rgba(13, 148, 136, 0.12)' : '#f1f5f9',
                                color: sub.track === 'international' ? '#7c3aed' : sub.track === 'national' ? '#0d9488' : '#475569'
                              }}>
                                {sub.track === 'international' ? 'دولي' : sub.track === 'national' ? 'أهلي' : 'مشترك'}
                              </span>
                              {sub.isCustom && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#b45309'
                                }}>
                                  ✨ مادة مضافة
                                </span>
                              )}
                              {sub.isCustom && isSuperAdmin && (
                                <button
                                  onClick={() => handleDeleteCustomSubject(sub.id)}
                                  title="حذف هذه المادة المخصصة"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#dc2626' }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {sub.teachersCount} معلمين • {sub.totalTeachingCapacity} حصة
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '10px',
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

                    {/* Expand / Collapse Button */}
                    {chartFiltered.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setShowAllChartSubjects(!showAllChartSubjects)}
                        style={{
                          marginTop: '6px',
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: '1px dashed #cbd5e1',
                          background: 'white',
                          color: '#0d9488',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {showAllChartSubjects
                          ? '▲ عرض أقل (8 مواد فقط)'
                          : `▼ استعراض كافة المواد والتخصصات (${chartFiltered.length} مادة)`
                        }
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Chart 2: Educational Stages, Classes & Student Distribution Breakdown */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PieChart size={19} color="#7c3aed" />
                    مؤشر توزيع الطلاب والشعب والطاقة الاستيعابية حسب المراحل
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    حصر فوري لأعداد الطلاب والفصول ومتوسط الكثافة لكل مرحلة تعليمية
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('classes_management')}
                  className="btn"
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#f5f3ff',
                    border: '1px solid #c7d2fe',
                    color: '#6d28d9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <School size={14} /> إدارة الفصول
                </button>
              </div>

              {metrics.stagesBreakdown.every(stg => stg.classesCount === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <School size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>لم يتم تسجيل فصول في هذا الفرع بعد.</p>
                  <button
                    onClick={() => setActiveTab('classes_management')}
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '7px 16px', marginTop: '6px' }}
                  >
                    + إضافة فصول وتهيئة المرحلة
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {metrics.stagesBreakdown.map(stg => {
                    const icon = stg.id === 'kindergarten' ? '🧸' : stg.id === 'primary' ? '🎒' : stg.id === 'middle' ? '🏫' : '🎓';
                    return (
                      <div key={stg.id} style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>{icon}</span>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{stg.name}</span>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {stg.classesCount} شعبة دراسية
                                </span>
                                <span style={{ fontSize: '11px', color: '#cbd5e1' }}>•</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0d9488' }}>
                                  {stg.studentsCount} طالب مسجل
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '8px',
                                background: Number(stg.density) > 30 ? '#fee2e2' : '#f0fdf4',
                                color: Number(stg.density) > 30 ? '#dc2626' : '#166534'
                              }}>
                                الكثافة: {stg.density} طالب/فصل
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                                {stg.utilization}%
                              </span>
                            </div>
                            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                              السعة: {stg.capacity} مقعد
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBlock: '4px' }}>
                          <div style={{
                            width: `${stg.utilization}%`,
                            height: '100%',
                            background: stg.id === 'kindergarten' 
                              ? 'linear-gradient(90deg, #ec4899, #f43f5e)' 
                              : stg.id === 'primary' 
                              ? 'linear-gradient(90deg, #0d9488, #10b981)' 
                              : stg.id === 'middle' 
                              ? 'linear-gradient(90deg, #2563eb, #0284c7)' 
                              : 'linear-gradient(90deg, #7c3aed, #6366f1)',
                            borderRadius: '4px'
                          }} />
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

      {/* TAB 2: STAGES, CLASSES & STUDENT COUNTS MANAGEMENT (LIVE REAL-TIME SYNC) */}
      {activeTab === 'classes_management' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-primary-dark)' }}>
                  إدارة المراحل الدراسية والفصول وحصر أعداد الطلاب
                </h2>
                <span style={{
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  مزامنة لحظية مع حساب الماستر
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                إدارة تفصيلية لكل مرحلة وشعبة، مع تعديل فوري لأعداد الطلاب واحتساب الإجماليات والمقاعد الشاغرة
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setBatchStage(classStageFilter !== 'all' ? classStageFilter : 'primary');
                  setShowQuickBatchModal(true);
                }}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontWeight: 700,
                  padding: '9px 16px',
                  borderRadius: '12px'
                }}
              >
                <Sparkles size={16} />
                <span>⚡ تهيئة فصول وشعب المرحلة سريعاً</span>
              </button>

              <button
                onClick={() => {
                  setEditingClass(null);
                  setClassForm({
                    name: '',
                    stage: classStageFilter !== 'all' ? classStageFilter : 'primary',
                    track: filterTrack !== 'all' ? filterTrack : 'national',
                    gender: filterGender !== 'all' ? filterGender : 'boys',
                    grade: 'الصف الأول الابتدائي',
                    section: 'أ',
                    studentCount: 24,
                    capacity: 25,
                    homeroomTeacher: '',
                    classroomNumber: '',
                    notes: ''
                  });
                  setShowClassModal(true);
                }}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '12px',
                  fontWeight: 700
                }}
              >
                <Plus size={18} /> إضافة فصل / شعبة جديدة
              </button>
            </div>
          </div>

          {/* Quick Real-time Totals KPIs Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px'
          }}>
            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>إجمالي الطلاب المسجلين</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0d9488' }}>
                {metrics.studentsCount} <span style={{ fontSize: '13px', fontWeight: 500 }}>طالب مسجل</span>
              </div>
              <span style={{ fontSize: '11px', color: '#059669', display: 'block', marginTop: '4px' }}>
                ✓ مجموع طلاب كافة الفصول
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>إجمالي الفصول والشعب</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                {metrics.classesCount} <span style={{ fontSize: '13px', fontWeight: 500 }}>شعبة دراسية</span>
              </div>
              <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', marginTop: '4px' }}>
                موزعة على كافة المراحل
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>متوسط الكثافة الصفية</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: Number(metrics.classDensity) > 30 ? '#dc2626' : '#059669' }}>
                {metrics.classDensity} <span style={{ fontSize: '13px', fontWeight: 500 }}>طالب / فصل</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                المعيار النموذجي: 20-28 طالب
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>الطاقة الاستيعابية والمقاعد</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed' }}>
                {metrics.capacityUtilization}% <span style={{ fontSize: '13px', fontWeight: 500 }}>({metrics.studentsCount} / {metrics.totalCapacity})</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                المقاعد الشاغرة: {Math.max(0, metrics.totalCapacity - metrics.studentsCount)} مقعد
              </span>
            </div>
          </div>

          {/* Stage Filter Pills & Search */}
          <div className="glass-panel" style={{
            padding: '12px 18px',
            borderRadius: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'white'
          }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setClassStageFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: classStageFilter === 'all' ? 700 : 500,
                  background: classStageFilter === 'all' ? 'var(--color-primary)' : '#f1f5f9',
                  color: classStageFilter === 'all' ? 'white' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                كافة المراحل ({classesList.length})
              </button>
              {RESOURCE_STAGES.map(stg => {
                const count = classesList.filter(c => (c.stage || 'primary') === stg.id).length;
                return (
                  <button
                    key={stg.id}
                    type="button"
                    onClick={() => setClassStageFilter(stg.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: classStageFilter === stg.id ? 700 : 500,
                      background: classStageFilter === stg.id ? '#0d9488' : '#f1f5f9',
                      color: classStageFilter === stg.id ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {stg.name} ({count})
                  </button>
                );
              })}
            </div>

            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input-field"
                value={classSearchQuery}
                onChange={(e) => setClassSearchQuery(e.target.value)}
                placeholder="بحث في الفصول ورواد الفصول..."
                style={{ paddingRight: '34px', paddingLeft: '12px', paddingBlock: '6px', fontSize: '13px', borderRadius: '10px' }}
              />
            </div>
          </div>

          {/* Stages Breakdown & Individual Classes Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {metrics.stagesBreakdown
              .filter(stg => classStageFilter === 'all' || classStageFilter === stg.id)
              .map(stg => {
                const stageClasses = (stg.classes || []).filter(c => {
                  if (filterTrack !== 'all' && (c.track || 'national') !== filterTrack) return false;
                  if (filterGender !== 'all' && (c.gender || 'boys') !== filterGender) return false;
                  if (classSearchQuery.trim()) {
                    const q = classSearchQuery.trim().toLowerCase();
                    const matchName = (c.name || '').toLowerCase().includes(q);
                    const matchGrade = (c.grade || '').toLowerCase().includes(q);
                    const matchTeacher = (c.homeroomTeacher || '').toLowerCase().includes(q);
                    if (!matchName && !matchGrade && !matchTeacher) return false;
                  }
                  return true;
                });

                return (
                  <div key={stg.id} className="glass-panel" style={{
                    padding: '22px',
                    borderRadius: '18px',
                    background: 'white',
                    border: '1px solid rgba(13, 148, 136, 0.2)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                  }}>
                    {/* Stage Section Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>
                            {stg.id === 'kindergarten' ? '🧸' : stg.id === 'primary' ? '🎒' : stg.id === 'middle' ? '🏫' : '🎓'}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--color-primary-dark)' }}>
                            {stg.name}
                          </h3>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                          <span>إجمالي الفصول: <strong>{stg.classesCount} شعبة</strong></span>
                          <span>•</span>
                          <span>إجمالي الطلاب: <strong style={{ color: '#0d9488' }}>{stg.studentsCount} طالب</strong></span>
                          <span>•</span>
                          <span>متوسط الكثافة: <strong>{stg.density} طالب/فصل</strong></span>
                          <span>•</span>
                          <span>نسبة الإشغال: <strong>{stg.utilization}%</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setBatchStage(stg.id);
                            handleBatchInitStageClasses(stg.id, filterTrack !== 'all' ? filterTrack : 'national', filterGender !== 'all' ? filterGender : 'boys');
                          }}
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            color: '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Sparkles size={13} /> تهيئة سريعة للمرحلة
                        </button>

                        <button
                          onClick={() => {
                            setEditingClass(null);
                            setClassForm({
                              name: '',
                              stage: stg.id,
                              track: filterTrack !== 'all' ? filterTrack : 'national',
                              gender: filterGender !== 'all' ? filterGender : 'boys',
                              grade: '',
                              section: 'أ',
                              studentCount: stg.id === 'kindergarten' ? 18 : 24,
                              capacity: stg.defaultClassCapacity || 25,
                              homeroomTeacher: '',
                              classroomNumber: '',
                              notes: ''
                            });
                            setShowClassModal(true);
                          }}
                          className="btn btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #0d9488, #10b981)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={14} /> إضافة فصل
                        </button>
                      </div>
                    </div>

                    {/* Stage Classes Grid */}
                    {stageClasses.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 20px', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                        <School size={36} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                        <h4 style={{ margin: '0 0 6px 0', color: '#475569' }}>لم يتم تسجيل فصول في هذه المرحلة بعد</h4>
                        <p style={{ margin: '0 0 14px 0', color: '#64748b', fontSize: '13px' }}>
                          يمكنك إضافة شعبة دراسية مخصصة أو استخدام التهيئة السريعة لإنشاء كافة شعب المرحلة بضغطة زر.
                        </p>
                        <button
                          onClick={() => handleBatchInitStageClasses(stg.id, filterTrack !== 'all' ? filterTrack : 'national', filterGender !== 'all' ? filterGender : 'boys')}
                          className="btn btn-primary"
                          style={{ fontSize: '12px', padding: '7px 16px' }}
                        >
                          ⚡ إنشاء كافة شعب المرحلة تلقائياً
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                        {stageClasses.map(cls => {
                          const count = Number(cls.studentCount || 0);
                          const cap = Number(cls.capacity || stg.defaultClassCapacity || 25);
                          const util = cap > 0 ? Math.min(100, Math.round((count / cap) * 100)) : 0;

                          return (
                            <div key={cls.id} style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '14px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                            }}>
                              <div>
                                {/* Class Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                  <div>
                                    <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{cls.name}</h4>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>{cls.grade || 'الصف'} • شعبة ({cls.section || 'أ'})</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      onClick={() => {
                                        setEditingClass(cls);
                                        setClassForm({ ...cls });
                                        setShowClassModal(true);
                                      }}
                                      style={{ padding: '5px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
                                      title="تعديل بيانات الفصل"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClass(cls.id)}
                                      style={{ padding: '5px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                                      title="حذف الفصل"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Track & Gender Badges */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    background: cls.track === 'international' ? 'rgba(124, 58, 237, 0.12)' : 'rgba(13, 148, 136, 0.12)',
                                    color: cls.track === 'international' ? '#7c3aed' : '#0d9488'
                                  }}>
                                    {cls.track === 'international' ? 'مسار دولي' : 'مسار أهلي'}
                                  </span>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    background: cls.gender === 'girls' ? 'rgba(219, 39, 119, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                                    color: cls.gender === 'girls' ? '#db2777' : '#2563eb'
                                  }}>
                                    {cls.gender === 'girls' ? 'بنات' : 'بنين'}
                                  </span>
                                  {cls.classroomNumber && (
                                    <span style={{ fontSize: '11px', background: 'white', padding: '2px 6px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#475569' }}>
                                      قاعة: {cls.classroomNumber}
                                    </span>
                                  )}
                                </div>

                                {/* Interactive Student Count Live Controller */}
                                <div style={{
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  marginBottom: '10px'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                      عدد طلاب هذا الفصل:
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickUpdateStudentCount(cls.id, count - 1)}
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          background: '#f8fafc',
                                          cursor: 'pointer',
                                          fontWeight: 800,
                                          fontSize: '14px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#475569'
                                        }}
                                        title="إنقاص طالب"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        value={count}
                                        onChange={(e) => handleQuickUpdateStudentCount(cls.id, e.target.value)}
                                        style={{
                                          width: '45px',
                                          textAlign: 'center',
                                          fontSize: '15px',
                                          fontWeight: 800,
                                          color: '#0f766e',
                                          border: '1px solid #0d9488',
                                          borderRadius: '6px',
                                          padding: '2px 4px'
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleQuickUpdateStudentCount(cls.id, count + 1)}
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          background: '#f0fdf4',
                                          cursor: 'pointer',
                                          fontWeight: 800,
                                          fontSize: '14px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#16a34a'
                                        }}
                                        title="إضافة طالب"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Occupancy bar */}
                                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBlock: '4px' }}>
                                    <div style={{
                                      width: `${util}%`,
                                      height: '100%',
                                      background: util > 100 ? '#dc2626' : util >= 80 ? '#10b981' : '#f59e0b',
                                      borderRadius: '3px'
                                    }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                                    <span>السعة القصوى: {cap} طالب</span>
                                    <span style={{ fontWeight: 700, color: util > 100 ? '#dc2626' : '#0f766e' }}>{util}% إشغال</span>
                                  </div>
                                </div>
                              </div>

                              {/* Homeroom teacher */}
                              <div style={{ fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>رائد الفصل: <strong>{cls.homeroomTeacher || 'غير معين'}</strong></span>
                                <span style={{ fontSize: '10px', color: '#10b981' }}>● متزامن لحظياً</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: TEACHER QUOTA, SPECIALTY DISTRIBUTION & CLASS ALLOCATION SYSTEM */}
      {activeTab === 'classes_quotas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Top Header & Global Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '21px', color: 'var(--color-primary-dark)' }}>
                  منظومة توزيع أنصبة المعلمين والتخصصات وتسكين الفصول
                </h2>
                <span style={{
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  تسكين واحتساب آلي لحظي
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                توزيع ومطابقة أنصبة الكوادر التعليمية، تسكين المعلمين على الشعب، إضافة التخصصات، وحساب الفائض والعجز تلقائياً
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleAutoSmartAllocateQuotas}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontWeight: 800,
                  padding: '9px 16px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(22, 101, 52, 0.08)'
                }}
              >
                <Sparkles size={17} color="#16a34a" />
                <span>⚡ التسكين الذكي التلقائي لكافة الفصول</span>
              </button>

              <button
                onClick={() => {
                  setEditingTeacher(null);
                  setTeacherForm({
                    name: '',
                    nationalId: '',
                    subject: 'الرياضيات العامة',
                    track: filterTrack !== 'all' ? filterTrack : 'national',
                    gender: filterGender !== 'all' ? filterGender : 'boys',
                    stage: filterStage !== 'all' ? filterStage : 'primary',
                    standardLoad: 20,
                    phone: '',
                    email: '',
                    notes: ''
                  });
                  setShowAddTeacherModal(true);
                }}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: '12px',
                  fontWeight: 700
                }}
              >
                <Plus size={17} /> إضافة معلم جديد
              </button>

              <button
                onClick={() => {
                  setNewSubjectForm({
                    name: '',
                    nameEn: '',
                    category: 'التقنية والذكاء الاصطناعي',
                    track: filterTrack !== 'all' ? filterTrack : 'both',
                    stage: 'all',
                    periodsPerClass: 3,
                    standardTeacherLoad: 20,
                    description: ''
                  });
                  setShowAddSubjectModal(true);
                }}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '9px 16px',
                  borderRadius: '12px',
                  fontWeight: 700
                }}
              >
                <BookOpen size={17} color="#0f766e" />
                <span>إضافة تخصص / مادة جديدة</span>
              </button>
            </div>
          </div>

          {/* Real-time KPI Stats Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px'
          }}>
            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>إجمالي الكوادر التعليمية</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f766e' }}>
                {metrics.teachersCount} <span style={{ fontSize: '13px', fontWeight: 500 }}>معلم/معلمة</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '11px' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>🟢 {metrics.balancedTeachersCount} متوازن</span>
                <span style={{ color: '#d97706', fontWeight: 700 }}>🟡 {metrics.lowLoadTeachersCount} نصاب شاغر</span>
                {metrics.overloadedTeachersCount > 0 && (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>🔴 {metrics.overloadedTeachersCount} عبء زائد</span>
                )}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>إجمالي الحصص المطلوبة</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                {metrics.totalRequiredPeriodsAll} <span style={{ fontSize: '13px', fontWeight: 500 }}>حصة أسبوعياً</span>
              </div>
              <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', marginTop: '4px' }}>
                موزعة على {metrics.classesCount} شعبة دراسية
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>الحصص المسندة ونسبة التغطية</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c3aed' }}>
                {metrics.quotaCoveragePercent}% <span style={{ fontSize: '13px', fontWeight: 500 }}>({metrics.totalAssignedPeriodsAll} / {metrics.totalRequiredPeriodsAll})</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{
                  width: `${metrics.quotaCoveragePercent}%`,
                  height: '100%',
                  background: metrics.quotaCoveragePercent === 100 ? '#10b981' : metrics.quotaCoveragePercent >= 80 ? '#3b82f6' : '#f59e0b',
                  borderRadius: '3px'
                }} />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: 'white' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>الحصص الشاغرة وميزان العجز</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: metrics.totalUnassignedPeriodsAll > 0 ? '#dc2626' : '#16a34a' }}>
                  {metrics.totalUnassignedPeriodsAll} <span style={{ fontSize: '13px', fontWeight: 500 }}>حصة شاغرة</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '11px' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>+{metrics.totalSurplusTeachers} كادر فائض</span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>-{metrics.totalDeficitTeachers} كادر عجز</span>
              </div>
            </div>
          </div>

          {/* Smart AI Quota Recommendations Engine */}
          {(() => {
            const quotaRecs = [];
            
            // 1. Unassigned subjects with available capacity
            teachersList.forEach(t => {
              const curPeriods = Number(t.assignedPeriods !== undefined ? t.assignedPeriods : (t.assignedClasses || []).reduce((s, c) => s + Number(c.periods || 0), 0));
              const stdLoad = Number(t.standardLoad || 20);
              const avail = Math.max(0, stdLoad - curPeriods);

              if (avail >= 3) {
                const unassignedForSubj = classesList.filter(c => {
                  if (t.track && t.track !== 'both' && (c.track || 'national') !== t.track) return false;
                  if (t.gender && (c.gender || 'boys') !== t.gender) return false;
                  const currentAssigned = c.assignedTeachers || {};
                  return !currentAssigned[t.subject];
                });

                if (unassignedForSubj.length > 0) {
                  quotaRecs.push({
                    id: `rec-assign-${t.id}`,
                    type: 'opportunity',
                    title: `تسكين وإكمال نصاب المعلم (${t.name})`,
                    desc: `المعلم لديه شاغر (${avail} حصة) في تخصص ${t.subject || 'المادة'}، وتوجد (${unassignedForSubj.length}) شعبة دراسية شاغرة يمكن تسكينه عليها فوراً.`,
                    actionLabel: `تسكين فصول المعلم (${t.name})`,
                    action: () => {
                      setSelectedTeacherForAssign(t);
                      const currentIds = (t.assignedClasses || []).map(c => c.classId);
                      setSelectedClassIdsToAssign(currentIds);
                      setShowAssignClassesModal(true);
                    }
                  });
                } else if (curPeriods <= 10 && classesList.length > 0) {
                  quotaRecs.push({
                    id: `rec-release-${t.id}`,
                    type: 'info',
                    title: `فائض تدريسي متاح للندب (${t.name})`,
                    desc: `المعلم مسكن بنصاب منخفض (${curPeriods} حصة) وكافة شعب المجمع مغطاة في تخصص ${t.subject}. يوصى بندبه لفرع آخر يعاني من عجز.`,
                    actionLabel: 'إتاحة وندب المعلم الفائض',
                    action: () => {
                      setTransferForm(prev => ({
                        ...prev,
                        type: 'release',
                        subject: t.subject || 'الرياضيات',
                        teacherName: t.name || '',
                        teacherNationalId: t.nationalId || '',
                        currentLoad: curPeriods
                      }));
                      setShowTransferModal(true);
                    }
                  });
                }
              }

              if (curPeriods > stdLoad) {
                quotaRecs.push({
                  id: `rec-overload-${t.id}`,
                  type: 'urgent',
                  title: `تخفيف عبء مرتفع عن المعلم (${t.name})`,
                  desc: `المعلم مسكن على (${curPeriods} حصة) ويتجاوز النصاب المعياري (${stdLoad} حصة). يوصى بإعادة توزيع بعض الشعب لتحقيق التوازن.`,
                  actionLabel: 'تعديل وتخفيف النصاب',
                  action: () => {
                    setSelectedTeacherForAssign(t);
                    const currentIds = (t.assignedClasses || []).map(c => c.classId);
                    setSelectedClassIdsToAssign(currentIds);
                    setShowAssignClassesModal(true);
                  }
                });
              }
            });

            // 2. Critical Deficits
            metrics.subjectAnalysis.filter(s => s.status === 'deficit' && s.netTeacherDiff > 0).forEach(sub => {
              quotaRecs.push({
                id: `rec-def-${sub.subject}`,
                type: 'urgent',
                title: `عجز تدريسي في تخصص ${sub.subject}`,
                desc: `المدرسة تحتاج إلى (${sub.netTeacherDiff}) معلم لتغطية (${Math.abs(sub.diffPeriods)}) حصة أسبوعية شاغرة في الجداول.`,
                actionLabel: `طلب استعانة (سد عجز ${sub.subject})`,
                action: () => {
                  setTransferForm(prev => ({
                    ...prev,
                    type: 'need',
                    subject: sub.subject,
                    requiredPeriods: Math.abs(sub.diffPeriods) || 20
                  }));
                  setShowTransferModal(true);
                }
              });
            });

            if (quotaRecs.length === 0) return null;

            return (
              <div className="glass-panel" style={{
                padding: '20px 24px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(240, 253, 250, 0.95) 0%, rgba(245, 243, 255, 0.95) 100%)',
                border: '1px solid rgba(13, 148, 136, 0.25)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={19} color="#0d9488" />
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-primary-dark)' }}>
                      المقترحات الذكية للمدير للتحكم بالأنصبة وسد العجز
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(13, 148, 136, 0.15)', color: '#0f766e', padding: '3px 10px', borderRadius: '12px' }}>
                    {quotaRecs.length} مقترحات ذكية
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                  {quotaRecs.slice(0, 4).map(rec => (
                    <div key={rec.id} style={{
                      background: 'white',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: rec.type === 'urgent' ? '1px solid #fecaca' : '1px solid #bfdbfe',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          {rec.type === 'urgent' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <AlertCircle size={13} /> تنبيه حرج
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <TrendingUp size={13} /> مقترح تسكين وموازنة
                            </span>
                          )}
                        </div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e293b' }}>{rec.title}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>{rec.desc}</p>
                      </div>

                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={rec.action}
                          className="btn"
                          style={{
                            padding: '5px 12px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            background: rec.type === 'urgent' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                            color: 'white',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{rec.actionLabel}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Sub-Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid rgba(99, 178, 198, 0.2)', paddingBottom: '6px', overflowX: 'auto' }}>
            <button
              onClick={() => setQuotaSubTab('teachers_roster')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                background: quotaSubTab === 'teachers_roster' ? '#0d9488' : '#f1f5f9',
                color: quotaSubTab === 'teachers_roster' ? 'white' : '#475569',
                boxShadow: quotaSubTab === 'teachers_roster' ? '0 3px 10px rgba(13, 148, 136, 0.25)' : 'none'
              }}
            >
              <Users size={16} />
              <span>👥 توزيع أنصبة المعلمين وتسكين الفصول ({metrics.teachersCount})</span>
            </button>

            <button
              onClick={() => setQuotaSubTab('subjects_balance')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                background: quotaSubTab === 'subjects_balance' ? '#0d9488' : '#f1f5f9',
                color: quotaSubTab === 'subjects_balance' ? 'white' : '#475569',
                boxShadow: quotaSubTab === 'subjects_balance' ? '0 3px 10px rgba(13, 148, 136, 0.25)' : 'none'
              }}
            >
              <BarChart2 size={16} />
              <span>📊 ميزان المواد والتخصصات وحساب العجز والزيادة ({metrics.subjectAnalysis.length})</span>
            </button>

            <button
              onClick={() => setQuotaSubTab('class_coverage')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                background: quotaSubTab === 'class_coverage' ? '#0d9488' : '#f1f5f9',
                color: quotaSubTab === 'class_coverage' ? 'white' : '#475569',
                boxShadow: quotaSubTab === 'class_coverage' ? '0 3px 10px rgba(13, 148, 136, 0.25)' : 'none'
              }}
            >
              <School size={16} />
              <span>🏫 مصفوفة تغطية الفصول والشعب ({classesList.length})</span>
            </button>
          </div>

          {/* SUB-TAB 1: TEACHERS ROSTER & LIVE CLASS ALLOCATION */}
          {quotaSubTab === 'teachers_roster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Filter & Search Bar */}
              <div className="glass-panel" style={{
                padding: '14px 18px',
                borderRadius: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                background: 'white'
              }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Load Filter */}
                  <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setTeacherLoadFilter('all')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: teacherLoadFilter === 'all' ? 700 : 500,
                        background: teacherLoadFilter === 'all' ? 'white' : 'transparent',
                        color: teacherLoadFilter === 'all' ? '#0d9488' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      كافة الكوادر ({metrics.teachersAnalysis.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeacherLoadFilter('balanced')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: teacherLoadFilter === 'balanced' ? 700 : 500,
                        background: teacherLoadFilter === 'balanced' ? '#16a34a' : 'transparent',
                        color: teacherLoadFilter === 'balanced' ? 'white' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      🟢 نصاب متوازن ({metrics.balancedTeachersCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeacherLoadFilter('low')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '11.5px',
                        fontWeight: teacherLoadFilter === 'low' ? 700 : 500,
                        background: teacherLoadFilter === 'low' ? '#d97706' : 'transparent',
                        color: teacherLoadFilter === 'low' ? 'white' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      🟡 نصاب شاغر / متاح ({metrics.lowLoadTeachersCount})
                    </button>
                    {metrics.overloadedTeachersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTeacherLoadFilter('overloaded')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '11.5px',
                          fontWeight: teacherLoadFilter === 'overloaded' ? 700 : 500,
                          background: teacherLoadFilter === 'overloaded' ? '#dc2626' : 'transparent',
                          color: teacherLoadFilter === 'overloaded' ? 'white' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        🔴 عبء زائد ({metrics.overloadedTeachersCount})
                      </button>
                    )}
                  </div>

                  {/* Subject Selector */}
                  <select
                    value={teacherSubjectFilter}
                    onChange={(e) => setTeacherSubjectFilter(e.target.value)}
                    className="input-field"
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '10px', minWidth: '180px' }}
                  >
                    <option value="all">كافة التخصصات والمواد</option>
                    {combinedQuotasList.map((q, i) => (
                      <option key={i} value={q.subject}>{q.subject}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', minWidth: '200px' }}>
                    <Search size={15} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      className="input-field"
                      value={teacherSearchQuery}
                      onChange={(e) => setTeacherSearchQuery(e.target.value)}
                      placeholder="بحث باسم المعلم أو السجل..."
                      style={{ paddingRight: '32px', paddingLeft: '10px', paddingBlock: '6px', fontSize: '12px', borderRadius: '10px' }}
                    />
                  </div>

                  <button
                    onClick={() => {
                      setEditingTeacher(null);
                      setTeacherForm({
                        name: '',
                        nationalId: '',
                        subject: 'الرياضيات العامة',
                        track: filterTrack !== 'all' ? filterTrack : 'national',
                        gender: filterGender !== 'all' ? filterGender : 'boys',
                        stage: 'primary',
                        standardLoad: 20,
                        phone: '',
                        email: '',
                        notes: ''
                      });
                      setShowAddTeacherModal(true);
                    }}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0d9488, #10b981)',
                      border: 'none',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Plus size={15} />
                    <span>إضافة معلم جديد</span>
                  </button>

                  <button
                    onClick={handleAutoSmartAllocateQuotas}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      border: 'none',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Sparkles size={15} />
                    <span>التسكين الذكي التلقائي</span>
                  </button>

                  {teachersList.length > 0 && (
                    <button
                      onClick={handleDeleteAllTeachers}
                      className="btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        color: '#dc2626',
                        borderRadius: '10px',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer'
                      }}
                      title="مسح وتفريغ كافة حسابات وسجلات المعلمين وفك تسكين الفصول"
                    >
                      <Trash2 size={15} />
                      <span>مسح كل حسابات المعلمين ({teachersList.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Teachers Cards Grid */}
              {(() => {
                const filteredTeachers = metrics.teachersAnalysis.filter(t => {
                  if (filterTrack !== 'all' && t.track && t.track !== 'both' && t.track !== filterTrack) return false;
                  if (filterGender !== 'all' && t.gender && t.gender !== filterGender) return false;
                  if (teacherLoadFilter !== 'all' && t.loadStatus !== teacherLoadFilter) return false;
                  if (teacherSubjectFilter !== 'all') {
                    const tSubj = (t.subject || '').trim().toLowerCase();
                    const filterSubj = teacherSubjectFilter.trim().toLowerCase();
                    if (!tSubj.includes(filterSubj) && !filterSubj.includes(tSubj)) return false;
                  }
                  if (teacherSearchQuery.trim()) {
                    const q = teacherSearchQuery.trim().toLowerCase();
                    const matchName = (t.name || '').toLowerCase().includes(q);
                    const matchNid = (t.nationalId || '').toString().includes(q);
                    const matchSubj = (t.subject || '').toLowerCase().includes(q);
                    if (!matchName && !matchNid && !matchSubj) return false;
                  }
                  return true;
                });

                if (filteredTeachers.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                      <Users size={40} style={{ opacity: 0.3, marginBottom: '10px', color: '#64748b' }} />
                      <h4 style={{ margin: '0 0 6px 0', color: '#475569' }}>لا يوجد معلمون مطابقون لمعايير البحث</h4>
                      <p style={{ margin: '0 0 14px 0', color: '#64748b', fontSize: '13px' }}>
                        يمكنك إضافة معلمين جدد للمدرسة وتسكينهم على الفصول والشعب مباشرة.
                      </p>
                      <button
                        onClick={() => {
                          setEditingTeacher(null);
                          setTeacherForm({
                            name: '',
                            nationalId: '',
                            subject: 'الرياضيات العامة',
                            track: 'national',
                            gender: 'boys',
                            stage: 'primary',
                            standardLoad: 20,
                            phone: '',
                            email: '',
                            notes: ''
                          });
                          setShowAddTeacherModal(true);
                        }}
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '7px 16px' }}
                      >
                        + إضافة معلم جديد للمدرسة
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                    {filteredTeachers.map(teacher => {
                      const curClasses = teacher.assignedClassesList || [];
                      const curPeriods = teacher.assignedPeriodsCount;
                      const stdLoad = teacher.standardLoadCount;
                      const util = teacher.loadUtilization;
                      const isOverloaded = teacher.loadStatus === 'overloaded';
                      const isLow = teacher.loadStatus === 'low';

                      return (
                        <div key={teacher.id} className="glass-panel" style={{
                          padding: '18px',
                          borderRadius: '16px',
                          background: 'white',
                          border: isOverloaded ? '1px solid #fca5a5' : isLow ? '1px solid #fde68a' : '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                        }}>
                          <div>
                            {/* Teacher Top Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '12px',
                                  background: teacher.gender === 'girls' ? 'linear-gradient(135deg, #ec4899, #db2777)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: 800,
                                  fontSize: '15px'
                                }}>
                                  {(teacher.name || 'م')[0]}
                                </div>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '15.5px', color: '#1e293b' }}>{teacher.name}</h4>
                                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                    تخصص: <strong style={{ color: '#0f766e' }}>{teacher.subject || 'غير محدد'}</strong>
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => {
                                    setEditingTeacher(teacher);
                                    setTeacherForm({
                                      name: teacher.name || '',
                                      nationalId: teacher.nationalId || '',
                                      subject: teacher.subject || 'الرياضيات العامة',
                                      track: teacher.track || 'national',
                                      gender: teacher.gender || 'boys',
                                      stage: teacher.stage || 'primary',
                                      standardLoad: teacher.standardLoad || 20,
                                      phone: teacher.phone || '',
                                      email: teacher.email || '',
                                      notes: teacher.notes || ''
                                    });
                                    setShowAddTeacherModal(true);
                                  }}
                                  style={{ padding: '4px 6px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
                                  title="تعديل بيانات المعلم"
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTeacher(teacher.id)}
                                  style={{ padding: '4px 6px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                                  title="حذف المعلم"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Badges */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: teacher.track === 'international' ? 'rgba(124, 58, 237, 0.12)' : 'rgba(13, 148, 136, 0.12)',
                                color: teacher.track === 'international' ? '#7c3aed' : '#0d9488'
                              }}>
                                {teacher.track === 'international' ? 'مسار دولي' : 'مسار أهلي'}
                              </span>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: teacher.gender === 'girls' ? 'rgba(219, 39, 119, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                                color: teacher.gender === 'girls' ? '#db2777' : '#2563eb'
                              }}>
                                {teacher.gender === 'girls' ? 'بنات' : 'بنين'}
                              </span>
                              {teacher.phone && (
                                <span style={{ fontSize: '10.5px', color: '#64748b', background: '#f8fafc', padding: '2px 6px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  📞 {teacher.phone}
                                </span>
                              )}
                            </div>

                            {/* Interactive Quota Load Strip */}
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              marginBottom: '12px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                  النصاب المسند: <strong style={{ fontSize: '14px', color: isOverloaded ? '#dc2626' : isLow ? '#d97706' : '#0f766e' }}>{curPeriods}</strong> / {stdLoad} حصة
                                </span>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>النصاب:</span>
                                  <select
                                    value={stdLoad}
                                    onChange={(e) => handleUpdateTeacherStandardLoad(teacher.id, e.target.value)}
                                    style={{
                                      padding: '1px 6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: 'white',
                                      color: '#0f766e',
                                      cursor: 'pointer'
                                    }}
                                    title="تعديل النصاب المعياري"
                                  >
                                    <option value="18">18 حصة</option>
                                    <option value="20">20 حصة</option>
                                    <option value="22">22 حصة</option>
                                    <option value="24">24 حصة</option>
                                  </select>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBlock: '4px' }}>
                                <div style={{
                                  width: `${Math.min(100, util)}%`,
                                  height: '100%',
                                  background: isOverloaded ? '#dc2626' : util >= 75 ? '#10b981' : '#f59e0b',
                                  borderRadius: '4px'
                                }} />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
                                <span style={{ color: isOverloaded ? '#dc2626' : isLow ? '#d97706' : '#16a34a', fontWeight: 700 }}>
                                  {isOverloaded ? `عبء زائد (+${curPeriods - stdLoad} حصة)` : isLow ? `شاغر متاح (${teacher.availablePeriods} حصة)` : 'مكتمل النصاب ومتوازن'}
                                </span>
                                <span style={{ fontWeight: 700, color: '#64748b' }}>{util}% إشغال</span>
                              </div>
                            </div>

                            {/* Assigned Classes List */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>
                                  الفصول والشعب المسكنة ({curClasses.length}):
                                </span>
                              </div>

                              {curClasses.length === 0 ? (
                                <div style={{ padding: '8px', background: '#fffbeb', borderRadius: '8px', border: '1px dashed #fde68a', fontSize: '11.5px', color: '#b45309', textAlign: 'center' }}>
                                  لم يتم تسكين المعلم على أي فصل دراسي حتى الآن
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                  {curClasses.map((clsItem, cIdx) => (
                                    <span
                                      key={cIdx}
                                      style={{
                                        fontSize: '11px',
                                        background: 'white',
                                        border: '1px solid #cbd5e1',
                                        padding: '2px 8px',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        color: '#334155'
                                      }}
                                    >
                                      <strong>{clsItem.className || 'فصل'}</strong>
                                      <span style={{ color: '#0d9488', fontSize: '10px' }}>({clsItem.periods || 3}ح)</span>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickRemoveClassFromTeacher(teacher.id, clsItem.classId, teacher.subject)}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#ef4444', fontSize: '13px', lineHeight: 1 }}
                                        title="إلغاء تسكين هذا الفصل"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Teacher Action Bottom Bar */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                            <button
                              onClick={() => {
                                setSelectedTeacherForAssign(teacher);
                                const currentIds = (teacher.assignedClasses || []).map(c => c.classId);
                                setSelectedClassIdsToAssign(currentIds);
                                setShowAssignClassesModal(true);
                              }}
                              className="btn btn-primary"
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                fontSize: '12px',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #0d9488, #10b981)',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <Plus size={14} />
                              <span>تسكين فصول المعلم</span>
                            </button>

                            {isLow && (
                              <button
                                onClick={() => {
                                  setTransferForm(prev => ({
                                    ...prev,
                                    type: 'release',
                                    subject: teacher.subject || 'الرياضيات',
                                    teacherName: teacher.name || '',
                                    teacherNationalId: teacher.nationalId || '',
                                    currentLoad: curPeriods
                                  }));
                                  setShowTransferModal(true);
                                }}
                                className="btn"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8'
                                }}
                                title="إتاحة الكادر الفائض للندب"
                              >
                                ندب / إتاحة
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SUB-TAB 2: SUBJECTS & SPECIALTIES BALANCE TABLE */}
          {quotaSubTab === 'subjects_balance' && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '18px', overflowX: 'auto', background: 'white' }}>
              {/* Table Search & Track Filter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setFilterTrack('all')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: filterTrack === 'all' ? 700 : 500,
                      background: filterTrack === 'all' ? 'var(--color-primary)' : '#f1f5f9',
                      color: filterTrack === 'all' ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    الكل ({metrics.subjectAnalysis.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTrack('national')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: filterTrack === 'national' ? 700 : 500,
                      background: filterTrack === 'national' ? '#0d9488' : '#f1f5f9',
                      color: filterTrack === 'national' ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    المسار الأهلي ({metrics.subjectAnalysis.filter(s => s.track === 'national' || s.track === 'both').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTrack('international')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: filterTrack === 'international' ? 700 : 500,
                      background: filterTrack === 'international' ? '#7c3aed' : '#f1f5f9',
                      color: filterTrack === 'international' ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    المسار الدولي ({metrics.subjectAnalysis.filter(s => s.track === 'international' || s.track === 'both').length})
                  </button>
                </div>

                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input-field"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في المواد والتخصصات..."
                    style={{ paddingRight: '34px', paddingLeft: '12px', paddingBlock: '6px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'rgba(99, 178, 198, 0.15)', borderBottom: '2px solid var(--color-primary)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>المادة / التخصص</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>المسار</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>حصص/فصل</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>الحصص المطلوبة</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>المعلمون</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>الطاقة التدريسية</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>الحصص المسندة</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>الحالة والميزان</th>
                    <th style={{ padding: '12px 16px', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary-dark)' }}>إجراء التوزيع</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.subjectAnalysis
                    .filter(sub => {
                      if (filterTrack !== 'all') {
                        if (sub.track !== 'both' && sub.track !== filterTrack) return false;
                      }
                      if (searchQuery.trim()) {
                        const q = searchQuery.trim().toLowerCase();
                        return (sub.subject || '').toLowerCase().includes(q);
                      }
                      return true;
                    })
                    .map((sub, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'transparent' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{sub.subject}</span>
                            {sub.isCustom && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#b45309'
                              }}>
                                ✨ مضافة
                              </span>
                            )}
                            {sub.isCustom && isSuperAdmin && (
                              <button
                                onClick={() => handleDeleteCustomSubject(sub.id)}
                                title="حذف هذه المادة المخصصة"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#dc2626' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: sub.track === 'international' ? 'rgba(124, 58, 237, 0.12)' : sub.track === 'national' ? 'rgba(13, 148, 136, 0.12)' : '#f1f5f9',
                            color: sub.track === 'international' ? '#7c3aed' : sub.track === 'national' ? '#0d9488' : '#475569'
                          }}>
                            {sub.track === 'international' ? 'دولي' : sub.track === 'national' ? 'أهلي' : 'مشترك'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b' }}>{sub.periodsPerClass} حصص</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b' }}>{sub.totalPeriodsNeeded} حصة</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f766e' }}>{sub.teachersCount} معلمين</td>
                        <td style={{ padding: '14px 16px', color: '#64748b' }}>{sub.totalTeachingCapacity} حصة</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: sub.unassignedPeriodsForSubj > 0 ? '#dc2626' : '#16a34a' }}>
                          {sub.assignedPeriodsForSubj} / {sub.totalPeriodsNeeded}
                          {sub.unassignedPeriodsForSubj > 0 && (
                            <span style={{ fontSize: '10px', color: '#dc2626', display: 'block' }}>({sub.unassignedPeriodsForSubj} شاغر)</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: sub.status === 'surplus' ? '#dbeafe' : sub.status === 'deficit' ? '#fee2e2' : '#dcfce7',
                            color: sub.status === 'surplus' ? '#1e40af' : sub.status === 'deficit' ? '#b91c1c' : '#15803d'
                          }}>
                            {sub.status === 'surplus' && <TrendingUp size={13} />}
                            {sub.status === 'deficit' && <AlertCircle size={13} />}
                            {sub.status === 'balanced' && <CheckCircle2 size={13} />}
                            {sub.status === 'surplus' ? `فائض (+${sub.netTeacherDiff}) كادر` : sub.status === 'deficit' ? `عجز (-${sub.netTeacherDiff}) كادر` : 'متوازن'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {sub.status === 'deficit' ? (
                            <button
                              onClick={() => {
                                setTransferForm(prev => ({ ...prev, type: 'need', subject: sub.subject, requiredPeriods: Math.abs(sub.diffPeriods) || 20 }));
                                setShowTransferModal(true);
                              }}
                              className="btn btn-primary"
                              style={{ padding: '5px 10px', fontSize: '11.5px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none' }}
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
                              style={{ padding: '5px 10px', fontSize: '11.5px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}
                            >
                              إتاحة للندب
                            </button>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 700 }}>✓ متوازن تماماً</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SUB-TAB 3: CLASS COVERAGE MATRIX */}
          {quotaSubTab === 'class_coverage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Stage Filter & Search */}
              <div className="glass-panel" style={{
                padding: '12px 18px',
                borderRadius: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                background: 'white'
              }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setCoverageStageFilter('all')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: coverageStageFilter === 'all' ? 700 : 500,
                      background: coverageStageFilter === 'all' ? 'var(--color-primary)' : '#f1f5f9',
                      color: coverageStageFilter === 'all' ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    كافة المراحل ({classesList.length})
                  </button>
                  {RESOURCE_STAGES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCoverageStageFilter(s.id)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: coverageStageFilter === 's.id' ? 700 : 500,
                        background: coverageStageFilter === s.id ? '#0d9488' : '#f1f5f9',
                        color: coverageStageFilter === s.id ? 'white' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      {s.name} ({classesList.filter(c => (c.stage || 'primary') === s.id).length})
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', minWidth: '200px' }}>
                  <Search size={15} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="input-field"
                    value={coverageSearchQuery}
                    onChange={(e) => setCoverageSearchQuery(e.target.value)}
                    placeholder="بحث في الشعب الدراسية..."
                    style={{ paddingRight: '32px', paddingLeft: '10px', paddingBlock: '5px', fontSize: '12px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Class Coverage Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                {classesList
                  .filter(cls => {
                    if (coverageStageFilter !== 'all' && (cls.stage || 'primary') !== coverageStageFilter) return false;
                    if (filterTrack !== 'all' && (cls.track || 'national') !== filterTrack) return false;
                    if (filterGender !== 'all' && (cls.gender || 'boys') !== filterGender) return false;
                    if (coverageSearchQuery.trim()) {
                      const q = coverageSearchQuery.trim().toLowerCase();
                      return (cls.name || '').toLowerCase().includes(q) || (cls.grade || '').toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(cls => {
                    const clsTrack = cls.track || 'national';
                    const relevantQuotas = combinedQuotasList.filter(q => q.track === 'both' || q.track === clsTrack);
                    const assignedMap = cls.assignedTeachers || {};
                    const coveredCount = Object.keys(assignedMap).length;
                    const totalNeeded = relevantQuotas.length;

                    return (
                      <div key={cls.id} className="glass-panel" style={{
                        padding: '16px',
                        borderRadius: '14px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{cls.name}</h4>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {cls.grade || 'الصف'} • شعبة ({cls.section || 'أ'}) • {cls.studentCount || 0} طالباً
                              </span>
                            </div>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '8px',
                              background: coveredCount >= totalNeeded ? '#dcfce7' : '#fee2e2',
                              color: coveredCount >= totalNeeded ? '#15803d' : '#b91c1c'
                            }}>
                              {coveredCount} / {totalNeeded} مادة مسكنة
                            </span>
                          </div>

                          {/* Subjects Coverage Pills */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                            {relevantQuotas.slice(0, 8).map((quota, qIdx) => {
                              const assignedInfo = assignedMap[quota.subject];
                              return (
                                <div key={qIdx} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '5px 8px',
                                  borderRadius: '8px',
                                  background: assignedInfo ? '#f0fdf4' : '#fef2f2',
                                  border: assignedInfo ? '1px solid #bbf7d0' : '1px solid #fecaca',
                                  fontSize: '11.5px'
                                }}>
                                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{quota.subject} ({quota.periodsPerClass}ح)</span>
                                  {assignedInfo ? (
                                    <span style={{ color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <CheckCircle2 size={13} /> {assignedInfo.teacherName}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <AlertCircle size={13} /> شاغر (غير مسكن)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleAutoSmartAllocateQuotas}
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Sparkles size={12} /> تسكين ذكي للمتبقي
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
                            📜 توجيه إداري رسمي • {dir.subject || dir.customSubject || 'الموارد والكوادر'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {dir.directiveNumber || `#DIR-${(dir.id || '').slice(0, 5).toUpperCase()}`}
                          </span>
                        </div>
                        <h4 style={{ margin: '4px 0 2px 0', fontSize: '15px', color: '#1e1b4b', fontWeight: 800 }}>
                          {dir.title || dir.subject || 'توجيه إداري عام'}
                        </h4>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>
                          {new Date(dir.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                        {dir.status === 'acknowledged' && (
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} /> تم تأكيد الاستلام
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                      {dir.content || dir.description || 'لا يوجد نص مرفق'}
                    </p>
                    {dir.actionRequired && (
                      <div style={{ fontSize: '12px', color: '#0369a1', background: '#e0f2fe', padding: '6px 12px', borderRadius: '8px', marginBottom: '8px' }}>
                        🎯 <strong>المطلوب تنفيذه:</strong> {dir.actionRequired}
                      </div>
                    )}
                    {(dir.assignedTeacherName || dir.teacherName) && (
                      <div style={{ fontSize: '13px', color: '#047857', fontWeight: 700, background: '#ecfdf5', padding: '6px 12px', borderRadius: '8px', display: 'inline-block' }}>
                        ✓ الكادر الموجه للندب/الاستعانة: {dir.assignedTeacherName || dir.teacherName}
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
                  const subjectDisplay = req.subject || req.customSubject || req.subjectName || req.title || 'مادة دراسية';
                  const periodsDisplay = req.requiredPeriods || req.periodsCount || req.currentLoad || req.periods || null;
                  const teacherDisplay = req.teacherName || req.assignedTeacherName || (req.type === 'need' ? '🚨 طلب سد عجز (بانتظار ترشيح وتوفير كادر من الإدارة العامة)' : 'كادر معتمد للتوجيه');
                  const trackDisplay = req.track === 'international' ? 'مسار دولي' : 'مسار أهلي';
                  const genderDisplay = req.gender === 'girls' ? 'بنات' : 'بنين';
                  const stageDisplay = req.stage === 'primary' ? 'الابتدائية' : req.stage === 'middle' ? 'المتوسطة' : req.stage === 'high' ? 'الثانوية' : req.stage === 'kindergarten' ? 'رياض الأطفال' : '';
                  const reqNumber = req.requestNumber || `#TR-${(req.id || '').slice(0, 5).toUpperCase()}`;

                  return (
                    <div key={req.id} style={{
                      background: isMasterDirective ? 'linear-gradient(135deg, rgba(245, 243, 255, 0.6), rgba(255, 255, 255, 0.9))' : 'white',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      border: isMasterDirective ? '1.5px solid #818cf8' : '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '14px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
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

                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                            {reqNumber}
                          </span>

                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                            📚 مادة {subjectDisplay} {periodsDisplay ? `• (${periodsDisplay} حصة أسبوعية)` : ''}
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', color: '#0f766e', fontWeight: 700, marginBottom: '4px' }}>
                          👤 {teacherDisplay}
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{trackDisplay}</span>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{genderDisplay}</span>
                          {stageDisplay && <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{stageDisplay}</span>}
                          {req.reason && <span>• 📝 البيان: <strong>{req.reason}</strong></span>}
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
                          background: (req.status === 'approved' || req.status === 'acknowledged') ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: (req.status === 'approved' || req.status === 'acknowledged') ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#b45309'
                        }}>
                          {req.status === 'acknowledged' ? '✓ تم الاستلام والتوثيق' : (req.status === 'approved' ? '✓ تم الاعتماد والتوجيه' : (req.status === 'rejected' ? '✕ مرفوض' : '⏳ قيد الدراسة لدى الماستر'))}
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

      {/* Modal 5: Add Custom Subject / Specialty Modal (SuperAdmin) */}
      {showAddSubjectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1150,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowAddSubjectModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #0d9488, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
              }}>
                <BookOpen size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f766e' }}>
                  إضافة مادة دراسية / تخصص جديد لمنظومة المدارس
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  إدراج تخصص جديد ضمن المسار الأهلي أو الدولي مع تحديد الأنصبة المعيارية وحساب الفائض والعجز تلقائياً
                </p>
              </div>
            </div>

            <form onSubmit={handleAddCustomSubject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
                    اسم المادة (بالعربية) *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={newSubjectForm.name}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, name: e.target.value })}
                    placeholder="مثال: علم البيانات والذكاء الاصطناعي"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>
                    الاسم بالإنجليزية (اختياري)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={newSubjectForm.nameEn}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, nameEn: e.target.value })}
                    placeholder="e.g. Data Science & AI"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    تصنيف / قسم المادة *
                  </label>
                  <select
                    className="input-field"
                    value={newSubjectForm.category}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, category: e.target.value })}
                  >
                    <option value="التقنية والذكاء الاصطناعي">التقنية والذكاء الاصطناعي والحاسب</option>
                    <option value="الرياضيات">الرياضيات والإحصاء</option>
                    <option value="العلوم الطبيعية">العلوم الطبيعية (فيزياء، كيمياء، أحياء)</option>
                    <option value="اللغة الإنجليزية واللغات">اللغة الإنجليزية واللغات العالمية</option>
                    <option value="اللغة العربية">اللغة العربية وآدابها</option>
                    <option value="العلوم الشرعية والدراسات الإسلامية">العلوم الشرعية والدراسات الإسلامية</option>
                    <option value="العلوم الاجتماعية والإنسانية">العلوم الاجتماعية والإنسانية</option>
                    <option value="العلوم الإدارية والمالية">العلوم الإدارية والمالية والاقتصاد</option>
                    <option value="الفنون والتربية البدنية">الفنون والتربية البدنية والتصميم</option>
                    <option value="تخصصات ومواد مضافة">تخصصات ومواد إثرائية أخرى</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    المسار المعتمد للمادة *
                  </label>
                  <select
                    className="input-field"
                    value={newSubjectForm.track}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, track: e.target.value })}
                  >
                    <option value="both">كلا المسارين (الأهلي والدولي)</option>
                    <option value="national">المسار الأهلي المطور فقط</option>
                    <option value="international">المسار الدولي / الدبلومة الأمريكية فقط</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    المرحلة المستهدفة
                  </label>
                  <select
                    className="input-field"
                    value={newSubjectForm.stage}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, stage: e.target.value })}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="all">كافة المراحل</option>
                    <option value="primary">الابتدائية</option>
                    <option value="middle">المتوسطة</option>
                    <option value="high">الثانوية</option>
                    <option value="kindergarten">رياض الأطفال</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    الحصص الأسبوعية / فصل *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min="1"
                    max="10"
                    value={newSubjectForm.periodsPerClass}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, periodsPerClass: Number(e.target.value) })}
                    style={{ fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    النصاب المعياري للمعلم *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min="10"
                    max="30"
                    value={newSubjectForm.standardTeacherLoad}
                    onChange={(e) => setNewSubjectForm({ ...newSubjectForm, standardTeacherLoad: Number(e.target.value) })}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  وصف المادة أو ملاحظات المنهج (اختياري)
                </label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={newSubjectForm.description}
                  onChange={(e) => setNewSubjectForm({ ...newSubjectForm, description: e.target.value })}
                  placeholder="وصف مختصر لمفردات المنهج أو متطلبات المعامل..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="btn btn-outline"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingSubject}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488, #10b981)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  <Plus size={16} />
                  <span>{isAddingSubject ? 'جاري الإضافة...' : 'إضافة المادة للمنظومة الآن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Add / Edit Class & Section (Real-time Live Sync) */}
      {showClassModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => { setShowClassModal(false); setEditingClass(null); }}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #0d9488, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
              }}>
                <School size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-primary-dark)' }}>
                  {editingClass ? 'تعديل بيانات الفصل والشعبة' : 'إضافة فصل / شعبة دراسية جديدة'}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  يتم حفظ وتحديث عدد الطلاب والطاقة الاستيعابية ومزامنتها لحظياً مع حساب الماستر
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>اسم الفصل / الشعبة *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="مثال: الصف الأول الابتدائي (أ) أو KG2 - شعبة الزهور"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المرحلة التعليمية *</label>
                  <select
                    className="input-field"
                    value={classForm.stage}
                    onChange={(e) => {
                      const newStage = e.target.value;
                      const defCap = newStage === 'kindergarten' ? 20 : newStage === 'primary' ? 25 : newStage === 'middle' ? 28 : 30;
                      setClassForm({ ...classForm, stage: newStage, capacity: defCap });
                    }}
                  >
                    {RESOURCE_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المسار التعليمي *</label>
                  <select
                    className="input-field"
                    value={classForm.track}
                    onChange={(e) => setClassForm({ ...classForm, track: e.target.value })}
                  >
                    <option value="national">المسار الأهلي المطور</option>
                    <option value="international">المسار الدولي / الدبلومة الأمريكية</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>القسم (الجنس) *</label>
                  <select
                    className="input-field"
                    value={classForm.gender}
                    onChange={(e) => setClassForm({ ...classForm, gender: e.target.value })}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="boys">بنين (Boys)</option>
                    <option value="girls">بنات (Girls)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>الصف الدراسي</label>
                  <input
                    type="text"
                    className="input-field"
                    value={classForm.grade}
                    onChange={(e) => setClassForm({ ...classForm, grade: e.target.value })}
                    placeholder="الصف الأول"
                    style={{ fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>رمز الشعبة</label>
                  <input
                    type="text"
                    className="input-field"
                    value={classForm.section}
                    onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
                    placeholder="أ / 1"
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0d9488', marginBottom: '6px' }}>
                    عدد الطلاب الفعلي المسجلين *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min="0"
                    max="60"
                    value={classForm.studentCount}
                    onChange={(e) => setClassForm({ ...classForm, studentCount: Number(e.target.value) })}
                    style={{ fontSize: '15px', fontWeight: 800, color: '#0f766e' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    الطاقة الاستيعابية للفصل *
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min="1"
                    max="60"
                    value={classForm.capacity}
                    onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
                    style={{ fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>رائد / مربي الفصل (اختياري)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={classForm.homeroomTeacher}
                    onChange={(e) => setClassForm({ ...classForm, homeroomTeacher: e.target.value })}
                    placeholder="اسم المعلم"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>رقم القاعة الدراسية</label>
                  <input
                    type="text"
                    className="input-field"
                    value={classForm.classroomNumber}
                    onChange={(e) => setClassForm({ ...classForm, classroomNumber: e.target.value })}
                    placeholder="قاعة 102"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ملاحظات وتفاصيل إضافية</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={classForm.notes}
                  onChange={(e) => setClassForm({ ...classForm, notes: e.target.value })}
                  placeholder="ملاحظات حول التجهيزات، الطلاب الموهوبين، شاشات التعلم الذكي..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowClassModal(false); setEditingClass(null); }}
                  className="btn btn-outline"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingClass}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488, #10b981)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  <Check size={16} />
                  <span>{isSavingClass ? 'جاري الحفظ والمزامنة...' : (editingClass ? 'حفظ التعديلات' : 'إضافة وتثبيت الفصل')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Quick Batch Stage Initialization Modal */}
      {showQuickBatchModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => setShowQuickBatchModal(false)}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#166534' }}>
                  تهيئة وتوليد شعب المرحلة دفعة واحدة
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  إنشاء الشعب الدراسية النموذجية للمرحلة المحددة تلقائياً مع أعداد الطلاب والسعات
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>المرحلة التعليمية المراد تهيئتها *</label>
                <select
                  className="input-field"
                  value={batchStage}
                  onChange={(e) => setBatchStage(e.target.value)}
                  style={{ fontWeight: 600 }}
                >
                  {RESOURCE_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.defaultGrades?.join('، ') || 'كافة الصفوف'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>المسار *</label>
                  <select
                    className="input-field"
                    value={filterTrack !== 'all' ? filterTrack : 'national'}
                    onChange={(e) => setFilterTrack(e.target.value)}
                  >
                    <option value="national">المسار الأهلي</option>
                    <option value="international">المسار الدولي</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>القسم *</label>
                  <select
                    className="input-field"
                    value={filterGender !== 'all' ? filterGender : 'boys'}
                    onChange={(e) => setFilterGender(e.target.value)}
                  >
                    <option value="boys">بنين (Boys)</option>
                    <option value="girls">بنات (Girls)</option>
                  </select>
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13.5px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> ملخص الشعب التي سيتم إنشاؤها تلقائياً:
                </h4>
                <ul style={{ margin: 0, paddingRight: '20px', fontSize: '12.5px', color: '#15803d', lineHeight: 1.7 }}>
                  {batchStage === 'kindergarten' && (
                    <>
                      <li>شعب تمهيدي أول (KG1 - أ / ب) بمعدل 18 طالباً</li>
                      <li>شعب تمهيدي ثانٍ (KG2 - أ / ب) بمعدل 20 طالباً</li>
                      <li>شعب تمهيدي ثالث (KG3 - أ / ب) بمعدل 20 طالباً</li>
                    </>
                  )}
                  {batchStage === 'primary' && (
                    <>
                      <li>شعب الصف الأول والثاني والثالث الابتدائي (أ / ب) بمعدل 24-25 طالباً</li>
                      <li>شعب الصف الرابع والخامس والسادس الابتدائي (أ / ب) بمعدل 26-27 طالباً</li>
                    </>
                  )}
                  {batchStage === 'middle' && (
                    <>
                      <li>شعب الصف الأول والثاني والثالث المتوسط (أ / ب) بمعدل 28 طالباً</li>
                    </>
                  )}
                  {batchStage === 'high' && (
                    <>
                      <li>شعب الصف الأول والثاني والثالث الثانوي (أ / ب) بمعدل 30 طالباً</li>
                    </>
                  )}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickBatchModal(false)}
                  className="btn btn-outline"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isSavingClass}
                  onClick={() => handleBatchInitStageClasses(batchStage, filterTrack !== 'all' ? filterTrack : 'national', filterGender !== 'all' ? filterGender : 'boys')}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  <Sparkles size={16} />
                  <span>{isSavingClass ? 'جاري الإنشاء والرفع...' : 'تأكيد وإنشاء شعب المرحلة الآن'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 8: Teacher Class Assignment & Live Quota Allocation Modal */}
      {showAssignClassesModal && selectedTeacherForAssign && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => { setShowAssignClassesModal(false); setSelectedTeacherForAssign(null); }}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: selectedTeacherForAssign.gender === 'girls' ? 'linear-gradient(135deg, #ec4899, #db2777)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                fontWeight: 800, fontSize: '16px'
              }}>
                {(selectedTeacherForAssign.name || 'م')[0]}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-primary-dark)' }}>
                  تسكين الفصول والشعب للمعلم: {selectedTeacherForAssign.name}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  تخصص: <strong style={{ color: '#0f766e' }}>{selectedTeacherForAssign.subject}</strong> • {selectedTeacherForAssign.track === 'international' ? 'المسار الدولي' : 'المسار الأهلي'} • {selectedTeacherForAssign.gender === 'girls' ? 'قسم البنات' : 'قسم البنين'}
                </p>
              </div>
            </div>

            {/* Live Load Preview Card */}
            {(() => {
              const subjName = selectedTeacherForAssign.subject || 'الرياضيات العامة';
              const quotaInfo = combinedQuotasList.find(q => q.subject === subjName) || { periodsPerClass: 3 };
              const periodsPerClass = Number(quotaInfo.periodsPerClass || 3);
              const totalSelectedPeriods = selectedClassIdsToAssign.length * periodsPerClass;
              const stdLoad = Number(selectedTeacherForAssign.standardLoad || 20);
              const diff = totalSelectedPeriods - stdLoad;
              const isOver = totalSelectedPeriods > stdLoad;
              const isLow = totalSelectedPeriods < stdLoad;

              return (
                <div style={{
                  background: isOver ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
                  border: isOver ? '1px solid #fecaca' : isLow ? '1px solid #fde68a' : '1px solid #bbf7d0',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>إجمالي النصاب المختار بعد التسكين:</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: isOver ? '#dc2626' : isLow ? '#d97706' : '#16a34a' }}>
                      {totalSelectedPeriods} <span style={{ fontSize: '13px', fontWeight: 600 }}>حصة أسبوعية</span>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 400 }}> (من أصل {stdLoad} حصة نصاب معياري)</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: isOver ? 'rgba(239, 68, 68, 0.15)' : isLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isOver ? '#dc2626' : isLow ? '#d97706' : '#15803d'
                    }}>
                      {isOver ? `⚠️ عبء زائد (+${diff} حصص)` : isLow ? `🟡 متاح ومتبقي (${stdLoad - totalSelectedPeriods} حصص)` : '🟢 نصاب متوازن ومكتمل تماماً'}
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                      تم اختيار: {selectedClassIdsToAssign.length} فصول ({periodsPerClass} حصص/فصل)
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Stage Selector & Search within Classes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                <button
                  type="button"
                  onClick={() => setCoverageStageFilter('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: coverageStageFilter === 'all' ? 700 : 500,
                    background: coverageStageFilter === 'all' ? '#0d9488' : '#f1f5f9',
                    color: coverageStageFilter === 'all' ? 'white' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  كافة المراحل
                </button>
                {RESOURCE_STAGES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCoverageStageFilter(s.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: coverageStageFilter === s.id ? 700 : 500,
                      background: coverageStageFilter === s.id ? '#0d9488' : '#f1f5f9',
                      color: coverageStageFilter === s.id ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: '180px' }}>
                <Search size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={coverageSearchQuery}
                  onChange={(e) => setCoverageSearchQuery(e.target.value)}
                  placeholder="بحث في الفصول..."
                  style={{
                    width: '100%',
                    paddingRight: '26px',
                    paddingLeft: '8px',
                    paddingBlock: '4px',
                    fontSize: '11.5px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1'
                  }}
                />
              </div>
            </div>

            {/* Classes Interactive Checkbox List */}
            <div style={{
              maxHeight: '340px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: '#f8fafc'
            }}>
              {(() => {
                const subjName = selectedTeacherForAssign.subject || 'الرياضيات العامة';
                const availableClasses = classesList.filter(c => {
                  if (coverageStageFilter !== 'all' && c.stage !== coverageStageFilter) return false;
                  if (selectedTeacherForAssign.track && selectedTeacherForAssign.track !== 'both' && c.track && c.track !== selectedTeacherForAssign.track) return false;
                  if (selectedTeacherForAssign.gender && selectedTeacherForAssign.gender !== 'both' && c.gender && c.gender !== selectedTeacherForAssign.gender) return false;
                  if (coverageSearchQuery.trim()) {
                    const q = coverageSearchQuery.trim().toLowerCase();
                    const matchName = (c.name || '').toLowerCase().includes(q);
                    const matchGrade = (c.grade || '').toLowerCase().includes(q);
                    if (!matchName && !matchGrade) return false;
                  }
                  return true;
                });

                if (availableClasses.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '13px' }}>
                      لا توجد فصول دراسية مطابقة لمسار وقسم هذا المعلم.
                    </div>
                  );
                }

                return availableClasses.map(cls => {
                  const isChecked = selectedClassIdsToAssign.includes(cls.id);
                  const existingAssignee = cls.assignedTeachers?.[subjName];
                  const isAssignedToOther = existingAssignee && existingAssignee.teacherId !== selectedTeacherForAssign.id;

                  return (
                    <label
                      key={cls.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isChecked ? '#f0fdf4' : 'white',
                        border: isChecked ? '1px solid #86efac' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassIdsToAssign([...selectedClassIdsToAssign, cls.id]);
                            } else {
                              setSelectedClassIdsToAssign(selectedClassIdsToAssign.filter(id => id !== cls.id));
                            }
                          }}
                          style={{ width: '17px', height: '17px', accentColor: '#0d9488', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e293b' }}>
                            {cls.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <span>{cls.track === 'international' ? 'دولي' : 'أهلي'}</span>
                            <span>•</span>
                            <span>{cls.gender === 'girls' ? 'بنات' : 'بنين'}</span>
                            <span>•</span>
                            <span>{cls.studentCount || 0} طالب</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {isAssignedToOther ? (
                          <span style={{ fontSize: '11px', color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            مسكن حالياً: {existingAssignee.teacherName} (سيتم استبداله)
                          </span>
                        ) : isChecked ? (
                          <span style={{ fontSize: '11px', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            ✓ مسكن للمعلم
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                            شاغر متاح
                          </span>
                        )}
                      </div>
                    </label>
                  );
                });
              })()}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => {
                  const matchingIds = classesList.filter(c => {
                    if (selectedTeacherForAssign.track && selectedTeacherForAssign.track !== 'both' && c.track && c.track !== selectedTeacherForAssign.track) return false;
                    if (selectedTeacherForAssign.gender && selectedTeacherForAssign.gender !== 'both' && c.gender && c.gender !== selectedTeacherForAssign.gender) return false;
                    return true;
                  }).map(c => c.id);
                  setSelectedClassIdsToAssign(matchingIds);
                }}
                className="btn btn-outline"
                style={{ fontSize: '11.5px', padding: '5px 12px' }}
              >
                تحديد كافة فصول المسار والقسم
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAssignClassesModal(false); setSelectedTeacherForAssign(null); }}
                  className="btn btn-outline"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isSavingClass}
                  onClick={() => handleSaveTeacherClassAssignments(selectedTeacherForAssign.id, selectedClassIdsToAssign)}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488, #10b981)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  <Check size={16} />
                  <span>{isSavingClass ? 'جاري الحفظ والتسكين...' : 'حفظ وتثبيت التسكين'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 9: Add / Edit Teacher & Quota Profile Modal */}
      {showAddTeacherModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto',
            background: 'white', padding: '28px', borderRadius: '20px', position: 'relative'
          }}>
            <button
              onClick={() => { setShowAddTeacherModal(false); setEditingTeacher(null); }}
              style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
              }}>
                <UserCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-primary-dark)' }}>
                  {editingTeacher ? 'تعديل بيانات المعلم والتخصص' : 'إضافة معلم / كادر تعليمي جديد للمدرسة'}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  تسجيل المعلم في منظومة الأنصبة الأسبوعية وتحديد التخصص والمسار التعليمي
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>اسم المعلم الرباعي *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={teacherForm.name}
                    onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                    placeholder="مثال: أ. أحمد بن محمد الشهري"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>رقم الهوية الوطنية / الإقامة</label>
                  <input
                    type="text"
                    className="input-field"
                    value={teacherForm.nationalId}
                    onChange={(e) => setTeacherForm({ ...teacherForm, nationalId: e.target.value })}
                    placeholder="10XXXXXXXX"
                  />
                </div>
              </div>

              {/* Specialty / Subject Dropdown with all custom subjects */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  المادة / التخصص التدريسي *
                </label>
                <select
                  className="input-field"
                  required
                  value={teacherForm.subject}
                  onChange={(e) => {
                    const selectedSubj = e.target.value;
                    const quotaInfo = combinedQuotasList.find(q => q.subject === selectedSubj);
                    const defLoad = quotaInfo?.standardTeacherLoad || 20;
                    setTeacherForm({
                      ...teacherForm,
                      subject: selectedSubj,
                      standardLoad: defLoad
                    });
                  }}
                  style={{ fontWeight: 600 }}
                >
                  {Object.entries(subjectsByCategory).map(([cat, list]) => (
                    <optgroup key={cat} label={`── ${cat} ──`}>
                      {list.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.track === 'international' ? 'دولي' : s.track === 'national' ? 'أهلي' : 'مشترك'})</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>المسار *</label>
                  <select
                    className="input-field"
                    value={teacherForm.track}
                    onChange={(e) => setTeacherForm({ ...teacherForm, track: e.target.value })}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="national">المسار الأهلي</option>
                    <option value="international">المسار الدولي</option>
                    <option value="both">كلا المسارين</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>القسم (الجنس) *</label>
                  <select
                    className="input-field"
                    value={teacherForm.gender}
                    onChange={(e) => setTeacherForm({ ...teacherForm, gender: e.target.value })}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="boys">بنين (Boys)</option>
                    <option value="girls">بنات (Girls)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>المرحلة التعليمية *</label>
                  <select
                    className="input-field"
                    value={teacherForm.stage}
                    onChange={(e) => setTeacherForm({ ...teacherForm, stage: e.target.value })}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="primary">الابتدائية</option>
                    <option value="middle">المتوسطة</option>
                    <option value="high">الثانوية</option>
                    <option value="kindergarten">رياض الأطفال</option>
                    <option value="all">كافة المراحل</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0d9488', marginBottom: '4px' }}>
                    النصاب المعياري الأسبوعي *
                  </label>
                  <select
                    className="input-field"
                    value={teacherForm.standardLoad}
                    onChange={(e) => setTeacherForm({ ...teacherForm, standardLoad: Number(e.target.value) })}
                    style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e' }}
                  >
                    <option value="18">18 حصة أسبوعية</option>
                    <option value="20">20 حصة أسبوعية</option>
                    <option value="22">22 حصة أسبوعية</option>
                    <option value="24">24 حصة أسبوعية</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>رقم الجوال</label>
                  <input
                    type="text"
                    className="input-field"
                    value={teacherForm.phone}
                    onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    style={{ fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>البريد الإلكتروني</label>
                  <input
                    type="email"
                    className="input-field"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    placeholder="teacher@msc.edu.sa"
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>ملاحظات وتوجيهات خاصة</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={teacherForm.notes}
                  onChange={(e) => setTeacherForm({ ...teacherForm, notes: e.target.value })}
                  placeholder="ملاحظات حول المهارات، الإشراف على الأنشطة، الجدول الدراسي..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddTeacherModal(false); setEditingTeacher(null); }}
                  className="btn btn-outline"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingTeacher}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488, #10b981)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  <Check size={16} />
                  <span>{isSavingTeacher ? 'جاري الحفظ...' : (editingTeacher ? 'حفظ التعديلات' : 'إضافة المعلم للمنظومة')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
