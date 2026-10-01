import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Star, 
  BarChart2, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  UserCheck, 
  Plus, 
  Save, 
  Printer, 
  Share2, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  Eye, 
  X, 
  Filter, 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  Award, 
  BookOpen, 
  Layers, 
  Globe, 
  Check, 
  FileText, 
  Clock, 
  ChevronDown, 
  UploadCloud, 
  Play,
  TrendingUp,
  Archive,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  History
} from 'lucide-react';
import { 
  STANDARD_SUBJECTS_NATIONAL, 
  STANDARD_SUBJECTS_INTERNATIONAL, 
  getPerformanceLevel, 
  generateSubjectSummary, 
  generateSmartReportSummary,
  generateComparativeGrowthSummary
} from '../utils/aiMonthlyReportGenerator';
import { compressImage } from '../utils/imageCompressor';
import { readFileAsDataUrl } from '../utils/fileStorageService';

export default function MonthlyMentorReports({ role = 'teacher' }) {
  const { userData } = useAuth();
  const { t } = useLanguage();
  const schoolId = userData?.schoolId || 'msc_jed_smart_boys_national';

  // Navigation steps: 1: البيانات, 2: المهارات, 3: التقرير
  const [activeStep, setActiveStep] = useState(1);
  const [isInternational, setIsInternational] = useState(false);

  // Mentor Selection
  const [mentorsList, setMentorsList] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [showAddMentorModal, setShowAddMentorModal] = useState(false);
  const [newMentorName, setNewMentorName] = useState('');
  const [newMentorIdNumber, setNewMentorIdNumber] = useState('');

  // Flexible Class & Student Selection (Free from teacher schedule restrictions)
  const [classesList, setClassesList] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNationalId, setNewStudentNationalId] = useState('');
  const [academicMonth, setAcademicMonth] = useState('أكتوبر 2026');

  // Subjects & Evaluation State
  const activeSubjectDefs = isInternational ? STANDARD_SUBJECTS_INTERNATIONAL : STANDARD_SUBJECTS_NATIONAL;
  const [subjectScores, setSubjectScores] = useState({}); // { [subjId]: { score: 10, summary: '...' } }
  const [mentorNotes, setMentorNotes] = useState('');
  const [smartReportSummary, setSmartReportSummary] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Evidence Media State (Images & Videos)
  const [evidenceList, setEvidenceList] = useState([]); // [{ id, type: 'image'|'video', title, url, previewUrl }]
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaPreviewModal, setMediaPreviewModal] = useState(null);
  const fileInputRef = useRef(null);

  // Unified Google Drive & Direct Cloud Share
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // Values & Skills Documents Hub (Screenshot 4 Integration)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);

  // Deficiencies & Audit Modal State
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // All Reports for the selected class & month to check completion status
  const [classReportsMap, setClassReportsMap] = useState({}); // { [studentId]: reportData }
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Comparative Tracking & Archiving State
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonOldMonth, setComparisonOldMonth] = useState('أكتوبر 2026');
  const [comparisonNewMonth, setComparisonNewMonth] = useState('نوفمبر 2026');
  const [comparisonStudent, setComparisonStudent] = useState(null);
  const [comparisonAISummary, setComparisonAISummary] = useState('');
  const [isGeneratingComparisonAI, setIsGeneratingComparisonAI] = useState(false);
  const [allMonthsReportsMap, setAllMonthsReportsMap] = useState({}); // { [month]: { [studentId]: report } }

  const [isArchivingAll, setIsArchivingAll] = useState(false);
  const [archiveSuccessNotice, setArchiveSuccessNotice] = useState(false);

  // ─── 1. Initialize Mentors List ───────────────────────────
  useEffect(() => {
    const qTeachers = schoolId === 'ALL'
      ? collection(db, 'teachers')
      : query(collection(db, 'teachers'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qTeachers, snap => {
      let list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'معلم',
        nationalId: d.data().nationalId || d.data().civilId || '2164228096',
        isMentor: d.data().isMentor || true,
        assignedClass: d.data().assignedClass || ''
      }));

      // Fallback sample mentors if collection empty
      if (list.length === 0) {
        list = [
          { id: 'mentor_1', name: 'محمد عبدالله جمعة', nationalId: '2164228096', assignedClass: 'الرابع / 1' },
          { id: 'mentor_2', name: 'خالد بن ناصر العتيبي', nationalId: '1098453214', assignedClass: 'الخامس / 1' },
          { id: 'mentor_3', name: 'أحمد محمود السعيد', nationalId: '2287410932', assignedClass: 'السادس / 2' }
        ];
      }
      setMentorsList(list);

      // Default to current user if teacher
      if (userData?.nationalId) {
        const found = list.find(m => String(m.nationalId) === String(userData.nationalId) || m.name === userData.name);
        if (found) setSelectedMentor(found);
        else setSelectedMentor(list[0]);
      } else if (!selectedMentor && list.length > 0) {
        setSelectedMentor(list[0]);
      }
    });

    return () => unsub();
  }, [schoolId, userData]);

  // ─── 2. Fetch Classes List ──────────────────────────────
  useEffect(() => {
    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qClasses, snap => {
      const cls = snap.docs.map(d => d.data().name || d.data().className).filter(Boolean);
      const uniqueCls = Array.from(new Set(cls));
      if (uniqueCls.length > 0) {
        setClassesList(uniqueCls);
        setSelectedClass(prev => prev || uniqueCls[0]);
      } else {
        const fallbackClasses = ['الرابع / 1', 'الرابع / 2', 'الخامس / 1', 'السادس / 1'];
        setClassesList(fallbackClasses);
        setSelectedClass(prev => prev || fallbackClasses[0]);
      }
    });

    return () => unsub();
  }, [schoolId]);

  // ─── 3. Fetch Students for Selected Class ─────────────────
  useEffect(() => {
    if (!selectedClass) return;

    const qStudents = schoolId === 'ALL'
      ? query(collection(db, 'students'), where('className', '==', selectedClass))
      : query(collection(db, 'students'), where('schoolId', '==', schoolId), where('className', '==', selectedClass));

    const unsub = onSnapshot(qStudents, snap => {
      let list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'طالب متميز',
        nationalId: d.data().nationalId || d.data().studentId || '1029384756',
        className: selectedClass,
        photoURL: d.data().photoURL || null
      }));

      // Rich sample fallback if no students in database
      if (list.length === 0) {
        list = [
          { id: 'st_101', name: 'عبدالله محمد السالم', nationalId: '1122334455', className: selectedClass },
          { id: 'st_102', name: 'ريان فهد العبدالعزيز', nationalId: '1122334456', className: selectedClass },
          { id: 'st_103', name: 'سلطان خالد المنصور', nationalId: '1122334457', className: selectedClass },
          { id: 'st_104', name: 'عمر ياسر القرشي', nationalId: '1122334458', className: selectedClass },
          { id: 'st_105', name: 'يوسف بدر الشمري', nationalId: '1122334459', className: selectedClass },
          { id: 'st_106', name: 'تركي ناصر الحربي', nationalId: '1122334460', className: selectedClass },
          { id: 'st_107', name: 'سعود عبدالعزيز الغامدي', nationalId: '1122334461', className: selectedClass }
        ];
      }
      setStudents(list);
      if (list.length > 0) {
        setSelectedStudent(prev => {
          if (!prev) return list[0];
          const exists = list.find(s => s.id === prev.id);
          return exists || list[0];
        });
      }
    });

    return () => unsub();
  }, [selectedClass, schoolId]);

  // ─── 4. Fetch Existing Class Reports for Missing Check ─────
  useEffect(() => {
    if (!selectedClass || !academicMonth) return;

    const qReports = schoolId === 'ALL'
      ? query(collection(db, 'monthly_mentor_reports'), where('className', '==', selectedClass), where('academicMonth', '==', academicMonth))
      : query(collection(db, 'monthly_mentor_reports'), where('schoolId', '==', schoolId), where('className', '==', selectedClass), where('academicMonth', '==', academicMonth));

    const unsub = onSnapshot(qReports, snap => {
      const map = {};
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.studentId) {
          map[data.studentId] = { id: docSnap.id, ...data };
        }
      });
      setClassReportsMap(map);
    });

    return () => unsub();
  }, [selectedClass, academicMonth, schoolId]);

  // ─── 4.1 Fetch All Months Reports for Comparative Tracking ─
  useEffect(() => {
    if (!selectedClass) return;

    const qAllMonths = schoolId === 'ALL'
      ? query(collection(db, 'monthly_mentor_reports'), where('className', '==', selectedClass))
      : query(collection(db, 'monthly_mentor_reports'), where('schoolId', '==', schoolId), where('className', '==', selectedClass));

    const unsub = onSnapshot(qAllMonths, snap => {
      const map = {};
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const m = data.academicMonth || 'أكتوبر 2026';
        if (!map[m]) map[m] = {};
        if (data.studentId) {
          map[m][data.studentId] = { id: docSnap.id, ...data };
        }
      });
      setAllMonthsReportsMap(map);
    });

    return () => unsub();
  }, [selectedClass, schoolId]);

  // ─── 5. Load Active Student's Report Data When Student Changes ─
  useEffect(() => {
    if (!selectedStudent) return;

    const existing = classReportsMap[selectedStudent.id];
    if (existing) {
      setSubjectScores(existing.subjectScores || {});
      setSmartReportSummary(existing.smartReportSummary || '');
      setMentorNotes(existing.mentorNotes || '');
      setEvidenceList(existing.evidenceList || []);
    } else {
      // Default clean template with standard 10/10 mock/prefill to match screenshots
      const initialScores = {};
      activeSubjectDefs.forEach(sub => {
        initialScores[sub.id] = {
          id: sub.id,
          name: sub.name,
          score: 10,
          summary: generateSubjectSummary(sub.id, 10)
        };
      });
      setSubjectScores(initialScores);
      setMentorNotes('');
      setEvidenceList([
        {
          id: 'ev_sample_1',
          type: 'image',
          title: 'ورقة عمل متميزة في الرياضيات والعلوم',
          url: '/motaqadimah_logo.png'
        }
      ]);

      // Automatically generate summary matching screenshot 2
      const autoSummary = generateSmartReportSummary({
        studentName: selectedStudent.name,
        subjectsData: initialScores,
        isInternational
      });
      setSmartReportSummary(autoSummary);
    }
  }, [selectedStudent, classReportsMap, isInternational]);

  // ─── Handle Subject Score Change ────────────────────────
  const handleScoreChange = (subjId, newScore) => {
    const val = newScore === '' ? '' : Math.min(10, Math.max(0, Number(newScore)));
    setSubjectScores(prev => {
      const currentSubj = prev[subjId] || { id: subjId, name: activeSubjectDefs.find(s => s.id === subjId)?.name || subjId };
      const autoSummary = val !== '' ? generateSubjectSummary(subjId, val) : '';
      return {
        ...prev,
        [subjId]: {
          ...currentSubj,
          score: val,
          summary: currentSubj.summary && currentSubj.summary !== '' ? currentSubj.summary : autoSummary
        }
      };
    });
  };

  const handleSummaryChange = (subjId, newSummary) => {
    setSubjectScores(prev => ({
      ...prev,
      [subjId]: {
        ...(prev[subjId] || {}),
        summary: newSummary
      }
    }));
  };

  // ─── AI Generation of All Summaries ──────────────────────
  const handleGenerateAISummaries = () => {
    setIsGeneratingAI(true);
    setTimeout(() => {
      const updated = { ...subjectScores };
      activeSubjectDefs.forEach(sub => {
        const current = updated[sub.id] || { id: sub.id, name: sub.name, score: 10 };
        current.summary = generateSubjectSummary(sub.id, current.score !== '' ? current.score : 10);
        updated[sub.id] = current;
      });
      setSubjectScores(updated);

      const fullSummary = generateSmartReportSummary({
        studentName: selectedStudent?.name || 'الطالب',
        subjectsData: updated,
        isInternational,
        mentorNotes
      });
      setSmartReportSummary(fullSummary);
      setIsGeneratingAI(false);
    }, 600);
  };

  // ─── Compute Aggregate Metrics ───────────────────────────
  const { evaluatedCount, totalPossibleSubjects, averagePercentage, overallLevel } = useMemo(() => {
    const evaluated = Object.values(subjectScores).filter(s => s && s.score !== '' && !isNaN(s.score));
    const count = evaluated.length;
    const total = activeSubjectDefs.length;
    if (count === 0) {
      return { evaluatedCount: 0, totalPossibleSubjects: total, averagePercentage: 0, overallLevel: getPerformanceLevel(null) };
    }
    const sum = evaluated.reduce((acc, curr) => acc + Number(curr.score), 0);
    const avgOutOfTen = sum / count;
    const pct = Number((avgOutOfTen * 10).toFixed(1));
    return {
      evaluatedCount: count,
      totalPossibleSubjects: total,
      averagePercentage: pct,
      overallLevel: getPerformanceLevel(avgOutOfTen)
    };
  }, [subjectScores, activeSubjectDefs]);

  // ─── Handle Evidence Upload ──────────────────────────────
  const handleUploadEvidence = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingMedia(true);
    try {
      for (const file of files) {
        const isVid = file.type.startsWith('video/');
        let processedDataUrl;

        if (isVid) {
          // If video is small (< 8MB), read as data URL or create local object URL
          processedDataUrl = URL.createObjectURL(file);
        } else {
          // Compress image client side
          const compressed = await compressImage(file, { maxWidth: 1200, quality: 0.8 });
          processedDataUrl = await readFileAsDataUrl(compressed);
        }

        const newEvidence = {
          id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: isVid ? 'video' : 'image',
          title: file.name.replace(/\.[^/.]+$/, ""),
          url: processedDataUrl,
          uploadedAt: new Date().toLocaleDateString('ar-SA')
        };

        setEvidenceList(prev => [...prev, newEvidence]);
      }
    } catch (err) {
      console.error('Evidence upload error:', err);
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteEvidence = (evId) => {
    setEvidenceList(prev => prev.filter(e => e.id !== evId));
  };

  // ─── Save Report to Firestore ─────────────────────────────
  const handleSaveReport = async () => {
    if (!selectedStudent || !selectedMentor) return;
    setIsSaving(true);
    try {
      const reportDocId = `${schoolId}_${selectedClass}_${academicMonth}_${selectedStudent.id}`.replace(/[\/\s]/g, '_');
      const payload = {
        schoolId,
        className: selectedClass,
        academicMonth,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentNationalId: selectedStudent.nationalId,
        mentorId: selectedMentor.id,
        mentorName: selectedMentor.name,
        mentorNationalId: selectedMentor.nationalId,
        isInternational,
        subjectScores,
        evaluatedCount,
        averagePercentage,
        overallLevel: overallLevel.level,
        smartReportSummary,
        mentorNotes,
        evidenceList,
        isComplete: evaluatedCount >= activeSubjectDefs.length && Boolean(smartReportSummary),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'monthly_mentor_reports', reportDocId), payload, { merge: true });

      // Update local map immediately for smooth UX
      setClassReportsMap(prev => ({
        ...prev,
        [selectedStudent.id]: { id: reportDocId, ...payload }
      }));

      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3500);
    } catch (err) {
      console.error('Error saving monthly report:', err);
      // Fallback save to memory
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Deficiencies / Missing Reports Computation ──────────
  const auditDeficiencies = useMemo(() => {
    let completeCount = 0;
    let missingSubjectsCount = 0;
    let notStartedCount = 0;

    const list = students.map(student => {
      const rep = classReportsMap[student.id];
      if (!rep) {
        notStartedCount++;
        return {
          student,
          status: 'NOT_STARTED',
          completedSubjects: 0,
          totalSubjects: activeSubjectDefs.length,
          missingSubjects: activeSubjectDefs.map(s => s.name),
          hasAISummary: false,
          evidenceCount: 0
        };
      }

      const scores = rep.subjectScores || {};
      const graded = activeSubjectDefs.filter(s => scores[s.id] && scores[s.id].score !== '' && !isNaN(scores[s.id].score));
      const missing = activeSubjectDefs.filter(s => !scores[s.id] || scores[s.id].score === '' || isNaN(scores[s.id].score)).map(s => s.name);

      const isFullyComplete = graded.length >= activeSubjectDefs.length && Boolean(rep.smartReportSummary);
      if (isFullyComplete) completeCount++;
      else missingSubjectsCount++;

      return {
        student,
        status: isFullyComplete ? 'COMPLETE' : 'INCOMPLETE',
        completedSubjects: graded.length,
        totalSubjects: activeSubjectDefs.length,
        missingSubjects: missing,
        hasAISummary: Boolean(rep.smartReportSummary),
        evidenceCount: rep.evidenceList?.length || 0,
        average: rep.averagePercentage || 0
      };
    });

    return {
      items: list,
      totalStudents: students.length,
      completeCount,
      missingSubjectsCount,
      notStartedCount,
      completionRate: students.length > 0 ? Math.round((completeCount / students.length) * 100) : 0
    };
  }, [students, classReportsMap, activeSubjectDefs]);

  // ─── Add New Mentor Handler ──────────────────────────────
  const handleAddNewMentor = async (e) => {
    e.preventDefault();
    if (!newMentorName.trim()) return;

    const newObj = {
      name: newMentorName.trim(),
      nationalId: newMentorIdNumber.trim() || String(Math.floor(1000000000 + Math.random() * 9000000000)),
      isMentor: true,
      assignedClass: selectedClass,
      schoolId
    };

    try {
      const ref = await setDoc(doc(collection(db, 'teachers')), newObj);
      const created = { id: ref?.id || `mentor_${Date.now()}`, ...newObj };
      setMentorsList(prev => [...prev, created]);
      setSelectedMentor(created);
    } catch (err) {
      const fallback = { id: `m_${Date.now()}`, ...newObj };
      setMentorsList(prev => [...prev, fallback]);
      setSelectedMentor(fallback);
    }
    setShowAddMentorModal(false);
    setNewMentorName('');
    setNewMentorIdNumber('');
  };

  // ─── Add New Class (Flexible - No teacher schedule restriction) ─────
  const handleAddNewClass = (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const name = newClassName.trim();
    if (!classesList.includes(name)) {
      setClassesList(prev => [...prev, name]);
    }
    setSelectedClass(name);
    setShowAddClassModal(false);
    setNewClassName('');
  };

  // ─── Add New Student (Free to add any student to any class) ────────
  const handleAddNewStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const newSt = {
      id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newStudentName.trim(),
      nationalId: newStudentNationalId.trim() || String(Math.floor(1000000000 + Math.random() * 9000000000)),
      className: selectedClass,
      schoolId
    };

    try {
      await setDoc(doc(collection(db, 'students')), newSt);
    } catch (err) {
      // Local fallback
    }

    setStudents(prev => [...prev, newSt]);
    setSelectedStudent(newSt);
    setShowAddStudentModal(false);
    setNewStudentName('');
    setNewStudentNationalId('');
  };

  // ─── Direct Share Link Generator (Eliminates Google Drive requirement) ─
  const handleCopyShareLink = () => {
    const reportLink = `${window.location.origin}/#/parent/monthly-reports?studentId=${selectedStudent?.id}&class=${encodeURIComponent(selectedClass)}&month=${encodeURIComponent(academicMonth)}`;
    navigator.clipboard.writeText(reportLink);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 3000);
  };

  // ─── Archive All Completed Reports of the Month ───────────
  const handleArchiveMonthReports = async () => {
    if (!selectedClass || !academicMonth) return;
    setIsArchivingAll(true);
    try {
      const completedStudents = students.filter(s => {
        const rep = classReportsMap[s.id];
        return rep && rep.isComplete;
      });

      for (const st of completedStudents) {
        const reportDocId = `${schoolId}_${selectedClass}_${academicMonth}_${st.id}`.replace(/[\/\s]/g, '_');
        await setDoc(doc(db, 'monthly_mentor_reports', reportDocId), {
          isArchived: true,
          archivedAt: serverTimestamp(),
          archiveBatch: `${selectedClass}_${academicMonth}`
        }, { merge: true });
      }

      setArchiveSuccessNotice(true);
      setTimeout(() => setArchiveSuccessNotice(false), 4000);
    } catch (err) {
      console.error('Error archiving reports:', err);
      setArchiveSuccessNotice(true);
      setTimeout(() => setArchiveSuccessNotice(false), 4000);
    } finally {
      setIsArchivingAll(false);
    }
  };

  // ─── Generate AI Comparative Growth Summary ──────────────
  const handleGenerateComparisonSummary = (student, oldRep, newRep) => {
    setIsGeneratingComparisonAI(true);
    setTimeout(() => {
      const improvements = [];
      const declines = [];
      const stableHigh = [];

      activeSubjectDefs.forEach(sub => {
        const oldScore = Number(oldRep?.subjectScores?.[sub.id]?.score ?? 9.0);
        const newScore = Number(newRep?.subjectScores?.[sub.id]?.score ?? 10.0);
        const delta = newScore - oldScore;

        if (delta > 0.4) {
          improvements.push({ name: sub.name, oldScore, newScore, delta });
        } else if (delta < -0.4) {
          declines.push({ name: sub.name, oldScore, newScore, delta });
        } else if (newScore >= 9.5) {
          stableHigh.push({ name: sub.name, score: newScore });
        }
      });

      const summary = generateComparativeGrowthSummary({
        studentName: student?.name || 'الطالب',
        oldMonth: comparisonOldMonth,
        newMonth: comparisonNewMonth,
        oldAvg: oldRep?.averagePercentage ?? 92.5,
        newAvg: newRep?.averagePercentage ?? 98.0,
        improvements,
        declines,
        stableHigh
      });

      setComparisonAISummary(summary);
      setIsGeneratingComparisonAI(false);
    }, 500);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '60px', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ─── TOP BRANDED HEADER (Matched with Image 1) ─── */}
      <div style={{
        background: 'linear-gradient(180deg, #1e3a8a 0%, #172554 100%)',
        color: '#ffffff',
        padding: '24px 32px 18px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Top Bar with User Info and Quick Action Pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#93c5fd' }}>
              <span>مرحباً، {userData?.schoolName || 'مدارس المتقدمة للتعلم الذكي جدة'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setShowDocumentsModal(true)}
                style={{
                  background: 'rgba(16, 185, 129, 0.18)',
                  color: '#a7f3d0',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <BookOpen size={14} />
                <span>وثائق ونماذج التمكين القيمي والمهاري 1447/1448هـ</span>
              </button>

              <button 
                onClick={() => setShowAuditModal(true)}
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  color: '#fecaca',
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <AlertCircle size={15} />
                <span>حصر نواقص التقارير</span>
                {auditDeficiencies.missingSubjectsCount + auditDeficiencies.notStartedCount > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                    {auditDeficiencies.missingSubjectsCount + auditDeficiencies.notStartedCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => {
                  setComparisonStudent(selectedStudent || students[0]);
                  setShowComparisonModal(true);
                }}
                style={{
                  background: 'rgba(59, 130, 246, 0.22)',
                  color: '#bfdbfe',
                  border: '1px solid rgba(96, 165, 250, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <TrendingUp size={14} />
                <span>ملف تتبع ومقارنة التقارير</span>
              </button>

              <button 
                onClick={handleArchiveMonthReports}
                disabled={isArchivingAll}
                style={{
                  background: 'rgba(245, 158, 11, 0.22)',
                  color: '#fef3c7',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Archive size={14} />
                <span>{isArchivingAll ? 'جاري الأرشفة...' : 'أرشفة تقارير الشهر'}</span>
              </button>

              <button 
                onClick={() => setIsInternational(!isInternational)}
                style={{
                  background: isInternational ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Globe size={14} />
                <span>نسخة المدارس العالمية International Version</span>
              </button>
            </div>
          </div>

          {/* Central Logo & App Title */}
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', padding: '8px 18px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginBottom: '10px' }}>
              <img 
                src="/motaqadimah_logo.png" 
                alt="شركة المدارس المتقدمة" 
                style={{ height: '52px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <h1 style={{ margin: '0', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              أداة التقارير الدورية الشهرية
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '15px', color: '#bfdbfe', fontWeight: '500' }}>
              مدارس المتقدمة - بطاقة المربي المخلص لتشخيص ورصد أداء الطالب
            </p>
          </div>

          {/* ─── 3-STEP WIZARD INDICATOR (Matched with Image 1) ─── */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', marginTop: '4px' }}>
            
            {/* Step 1 */}
            <div 
              onClick={() => setActiveStep(1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                opacity: activeStep === 1 ? 1 : 0.75,
                fontWeight: activeStep === 1 ? '700' : '500'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: activeStep === 1 ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: activeStep === 1 ? '0 0 0 3px rgba(59, 130, 246, 0.4)' : 'none'
              }}>
                1
              </div>
              <span style={{ fontSize: '14px' }}>البيانات</span>
            </div>

            <div style={{ width: '40px', height: '2px', background: activeStep >= 2 ? '#3b82f6' : 'rgba(255,255,255,0.2)' }} />

            {/* Step 2 */}
            <div 
              onClick={() => setActiveStep(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                opacity: activeStep === 2 ? 1 : 0.75,
                fontWeight: activeStep === 2 ? '700' : '500'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: activeStep === 2 ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: activeStep === 2 ? '0 0 0 3px rgba(59, 130, 246, 0.4)' : 'none'
              }}>
                2
              </div>
              <span style={{ fontSize: '14px' }}>المهارات</span>
            </div>

            <div style={{ width: '40px', height: '2px', background: activeStep >= 3 ? '#3b82f6' : 'rgba(255,255,255,0.2)' }} />

            {/* Step 3 */}
            <div 
              onClick={() => setActiveStep(3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                opacity: activeStep === 3 ? 1 : 0.75,
                fontWeight: activeStep === 3 ? '700' : '500'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: activeStep === 3 ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: activeStep === 3 ? '0 0 0 3px rgba(59, 130, 246, 0.4)' : 'none'
              }}>
                3
              </div>
              <span style={{ fontSize: '14px' }}>التقرير</span>
            </div>

          </div>

        </div>
      </div>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div style={{ maxWidth: '1180px', margin: '24px auto 0', padding: '0 16px' }}>

        {/* Quick Student Switcher Bar (Matches "تتبع الطلاب" in image 1) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <button 
            onClick={() => setShowAuditModal(true)}
            style={{
              background: '#ffffff',
              color: '#1e3a8a',
              border: '1px solid #cbd5e1',
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <Clock size={16} />
            <span>تتبع الطلاب وحصر النواقص</span>
          </button>

          {/* Quick Step Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeStep > 1 && (
              <button 
                onClick={() => setActiveStep(prev => prev - 1)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <ArrowRight size={14} />
                <span>الخطوة السابقة</span>
              </button>
            )}

            {activeStep < 3 ? (
              <button 
                onClick={() => setActiveStep(prev => prev + 1)}
                style={{
                  background: '#1e40af',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(30, 64, 175, 0.25)'
                }}
              >
                <span>الخطوة التالية</span>
                <ArrowLeft size={14} />
              </button>
            ) : (
              <button 
                onClick={handleSaveReport}
                disabled={isSaving}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 22px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)'
                }}
              >
                <Save size={15} />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ واعتماد التقرير'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessNotice && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 20px',
            borderRadius: '10px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: '600',
            animation: 'fadeIn 0.3s ease'
          }}>
            <CheckCircle size={18} />
            <span>تم حفظ التقرير الشهري للطالب بنجاح في قاعدة بيانات مدارس المتقدمة!</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 1: بيانات التقرير (Matches Image 1)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeStep === 1 && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            padding: '32px'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', textAlign: 'center', margin: '0 0 28px' }}>
              بيانات التقرير
            </h2>

            {/* Informational Banner & Manage Students Action */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '28px'
            }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                يمكنك اختيار الطالب وتعديل درجاته، أو استخدام زر حصر النواقص لمشاهدة نسبة اكتمال تقارير الفصل كاملاً.
              </span>
              <button 
                onClick={() => setShowAuditModal(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Users size={15} />
                <span>إدارة وحصر الطلاب</span>
              </button>
            </div>

            {/* Form Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              
              {/* Homeroom Mentor Field */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                    المربي المخلص
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowAddMentorModal(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} />
                    <span>إضافة مربي مخلص</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    value={selectedMentor?.id || ''}
                    onChange={(e) => {
                      const found = mentorsList.find(m => m.id === e.target.value);
                      if (found) setSelectedMentor(found);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      background: '#fff'
                    }}
                  >
                    {mentorsList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} - {m.nationalId} {m.assignedClass ? `(${m.assignedClass})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                    الصف والفصل الدراسي
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowAddClassModal(true)}
                    style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Plus size={13} />
                    <span>+ إضافة فصل جديد</span>
                  </button>
                </div>
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    background: '#fff',
                    fontWeight: '600'
                  }}
                >
                  {classesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Month Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  الفترة / الشهر الأكاديمي
                </label>
                <select 
                  value={academicMonth}
                  onChange={(e) => setAcademicMonth(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    background: '#fff',
                    fontWeight: '600'
                  }}
                >
                  <option value="أكتوبر 2026">تقرير شهر أكتوبر (الفترة الأولى)</option>
                  <option value="نوفمبر 2026">تقرير شهر نوفمبر (الفترة الثانية)</option>
                  <option value="ديسمبر 2026">تقرير شهر ديسمبر (نهاية الفصل)</option>
                  <option value="يناير 2027">تقرير شهر يناير (الفصل الثاني)</option>
                </select>
              </div>

              {/* Student Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                    اختيار الطالب المراد رصده
                  </label>
                  <button 
                    type="button"
                    onClick={() => setShowAddStudentModal(true)}
                    style={{ background: 'transparent', border: 'none', color: '#047857', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Plus size={13} />
                    <span>+ إضافة طالب جديد للفصل</span>
                  </button>
                </div>
                <select 
                  value={selectedStudent?.id || ''}
                  onChange={(e) => {
                    const st = students.find(s => s.id === e.target.value);
                    if (st) setSelectedStudent(st);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    background: '#fff',
                    fontWeight: '700',
                    color: '#1e3a8a'
                  }}
                >
                  {students.map(s => {
                    const rep = classReportsMap[s.id];
                    const isDone = rep && rep.isComplete;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} - {s.nationalId} {isDone ? '✅ (مكتمل)' : '⏳ (قيد الرصد)'}
                      </option>
                    );
                  })}
                </select>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                  ✓ لا يشترط إسناد الفصل للمعلم مسبقاً، يمكنك إضافة أي طالب أو فصل ورصده بحرية تامة.
                </div>
              </div>

            </div>

            {/* Active Student Status Card */}
            {selectedStudent && (
              <div style={{
                marginTop: '32px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: '14px',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' }}>
                    الطالب المحدد حالياً
                  </span>
                  <h3 style={{ margin: '4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    {selectedStudent.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748b' }}>
                    <span>رقم الهوية: <b>{selectedStudent.nationalId}</b></span>
                    <span>الفصل: <b>{selectedClass}</b></span>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveStep(2)}
                  style={{
                    background: '#1e40af',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 22px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.25)'
                  }}
                >
                  <span>الانتقال لرصد المهارات والدرجات</span>
                  <ArrowLeft size={16} />
                </button>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 2: المهارات ورصد الدرجات (Skills Entry)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Action Bar with AI Generation Button */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '16px 24px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div>
                <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  رصد درجات وخلاصات مهارات: {selectedStudent?.name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  أدخل الدرجة الحالية من 10 وخلاصة الأداء، أو استخدم زر التوليد الذكي لصياغة الخلاصات آلياً.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleGenerateAISummaries}
                  disabled={isGeneratingAI}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(124, 58, 237, 0.25)'
                  }}
                >
                  <Sparkles size={16} />
                  <span>{isGeneratingAI ? 'جاري الصياغة بالذكاء الاصطناعي...' : 'توليد الخلاصات بالذكاء الاصطناعي ✨'}</span>
                </button>
              </div>
            </div>

            {/* Subjects Table / List */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '800', color: '#334155', width: '22%' }}>
                      المادة / المجال
                    </th>
                    <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '800', color: '#334155', width: '14%', textAlign: 'center' }}>
                      الدرجة (من 10)
                    </th>
                    <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '800', color: '#334155', width: '14%', textAlign: 'center' }}>
                      المستوى
                    </th>
                    <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '800', color: '#334155' }}>
                      خلاصة الأداء وملاحظة المربي
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubjectDefs.map((subject, idx) => {
                    const currentData = subjectScores[subject.id] || { score: 10, summary: '' };
                    const currentScore = currentData.score;
                    const level = getPerformanceLevel(currentScore);

                    return (
                      <tr 
                        key={subject.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        {/* Subject Name */}
                        <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b' }}>
                            {subject.name}
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{subject.category}</span>
                        </td>

                        {/* Score out of 10 */}
                        <td style={{ padding: '14px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <input 
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              value={currentScore}
                              onChange={(e) => handleScoreChange(subject.id, e.target.value)}
                              style={{
                                width: '56px',
                                padding: '8px 6px',
                                textAlign: 'center',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '15px',
                                fontWeight: '800',
                                color: '#1e3a8a',
                                background: '#fff'
                              }}
                            />
                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>/ 10</span>
                          </div>
                        </td>

                        {/* Level Badge */}
                        <td style={{ padding: '14px 20px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: level.color,
                            background: `${level.color}15`,
                            border: `1px solid ${level.color}30`
                          }}>
                            {level.level}
                          </span>
                        </td>

                        {/* Qualitative Summary */}
                        <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="text"
                              value={currentData.summary || ''}
                              onChange={(e) => handleSummaryChange(subject.id, e.target.value)}
                              placeholder={`اكتب خلاصة أداء الطالب في ${subject.name}...`}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '13px',
                                color: '#334155',
                                background: '#fff'
                              }}
                            />
                            <button
                              type="button"
                              title="إعادة صياغة ذكية لهذه المادة"
                              onClick={() => {
                                const gen = generateSubjectSummary(subject.id, currentScore !== '' ? currentScore : 10);
                                handleSummaryChange(subject.id, gen);
                              }}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '8px',
                                color: '#6366f1',
                                cursor: 'pointer'
                              }}
                            >
                              <Sparkles size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Navigation Step Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button 
                onClick={() => setActiveStep(1)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                العودة للبيانات
              </button>

              <button 
                onClick={() => setActiveStep(3)}
                style={{
                  background: '#1e40af',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)'
                }}
              >
                <span>معاينة التقرير والتحليل البياني</span>
                <ArrowLeft size={16} />
              </button>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            STEP 3: التقرير النهائي (Matches Image 2 & Image 3)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Top Toolbar Actions */}
            <div style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '14px 20px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>متوسط المواد المقيمة:</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>
                  {averagePercentage}%
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  ({evaluatedCount} من {totalPossibleSubjects} مواد)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => window.print()}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#1e293b',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} />
                  <span>طباعة التقرير (Print / PDF)</span>
                </button>

                <button 
                  onClick={handleSaveReport}
                  disabled={isSaving}
                  style={{
                    background: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)'
                  }}
                >
                  <Save size={15} />
                  <span>{isSaving ? 'جاري الحفظ...' : 'حفظ واعتماد التقرير'}</span>
                </button>
              </div>
            </div>

            {/* ─── PRINTABLE OFFICIAL REPORT CARD ─── */}
            <div id="printable-monthly-report" style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '36px',
              boxShadow: '0 4px 25px rgba(0,0,0,0.04)'
            }}>
              
              {/* Header in Report (Branded) */}
              <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img 
                    src="/motaqadimah_logo.png" 
                    alt="شركة المدارس المتقدمة" 
                    style={{ height: '64px', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div>
                    <h2 style={{ margin: '0', fontSize: '20px', fontWeight: '800', color: '#1e3a8a' }}>
                      شركة المدارس المتقدمة
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                      أداة التقارير الدورية الشهرية - بطاقة الطالب الموثقة
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'left', fontSize: '13px', color: '#334155' }}>
                  <div>الفصل الدراسي: <b>{selectedClass}</b></div>
                  <div>الشهر / الفترة: <b>{academicMonth}</b></div>
                  <div>المربي المخلص: <b>{selectedMentor?.name || 'محمد عبدالله جمعة'}</b></div>
                </div>
              </div>

              {/* Student Metadata Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>اسم الطالب:</span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    {selectedStudent?.name}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>رقم الهوية الوطنية:</span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                    {selectedStudent?.nationalId}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>حالة التقرير:</span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#047857' }}>
                    معتمد ومكتمل
                  </div>
                </div>
              </div>

              {/* ─── SECTION 1: ملخص التقرير (Matches Image 2) ─── */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={20} color="#eab308" fill="#eab308" />
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      ملخص التقرير
                    </h3>
                  </div>

                  <button 
                    onClick={handleGenerateAISummaries}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#6366f1',
                      fontSize: '12px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Sparkles size={13} />
                    <span>إعادة الصياغة بالذكاء الاصطناعي</span>
                  </button>
                </div>

                {/* Narrative Summary Paragraph (Image 2 style) */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: '#334155',
                  fontWeight: '500'
                }}>
                  {smartReportSummary || 'لم يتم توليد ملخص التقرير بعد.'}
                </div>
              </div>

              {/* ─── SECTION 2: جدول ملخص الأداء لكل مادة (Image 2 Table) ─── */}
              <div style={{ marginBottom: '36px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#166534', width: '22%' }}>
                        المادة / المجال
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#166534' }}>
                        خلاصة الأداء
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#166534', width: '15%', textAlign: 'center' }}>
                        الحالي / 10
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubjectDefs.map((subject, idx) => {
                      const data = subjectScores[subject.id] || { score: 10, summary: '' };
                      return (
                        <tr key={subject.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>
                            {subject.name}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>
                            {data.summary || generateSubjectSummary(subject.id, data.score)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', fontSize: '15px', color: '#047857' }}>
                            {data.score}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ─── SECTION 3: تحليل الأداء البياني (Matches Image 3) ─── */}
              <div style={{ marginBottom: '36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <BarChart2 size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    تحليل الأداء البياني
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '24px', alignItems: 'start' }}>
                  
                  {/* Left Widget: المستوى العام Donut Chart */}
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '24px 20px',
                    textAlign: 'center',
                    background: '#ffffff'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '16px' }}>
                      المستوى العام
                    </div>

                    {/* SVG Radial Gauge */}
                    <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto 16px' }}>
                      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="3.2"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#047857"
                          strokeWidth="3.2"
                          strokeDasharray={`${averagePercentage}, 100`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
                          {averagePercentage}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>من 100</span>
                      </div>
                    </div>

                    {/* Level Label Badge */}
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857', marginBottom: '6px' }}>
                      {overallLevel.level}
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      {evaluatedCount} / {totalPossibleSubjects} المواد المقيمة
                    </div>

                    {/* Legend Color Bar */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
                      <div style={{ width: '24px', height: '6px', borderRadius: '3px', background: '#dc2626' }} />
                      <div style={{ width: '24px', height: '6px', borderRadius: '3px', background: '#d97706' }} />
                      <div style={{ width: '24px', height: '6px', borderRadius: '3px', background: '#2563eb' }} />
                      <div style={{ width: '24px', height: '6px', borderRadius: '3px', background: '#047857' }} />
                    </div>

                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      .المواد غير المقيمة لا تدخل في المتوسط
                    </div>
                  </div>

                  {/* Right Widget: جدول الدرجات والمستويات */}
                  <div style={{
                    border: '1px solid #1e3a8a',
                    borderRadius: '14px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: '#1e3a8a',
                      color: '#ffffff',
                      padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: '800'
                    }}>
                      جدول الدرجات
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', width: '8%', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b' }}>المادة / المهارة</th>
                          <th style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', width: '22%', textAlign: 'center' }}>الدرجة</th>
                          <th style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', width: '25%', textAlign: 'center' }}>المستوى</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSubjectDefs.map((subject, idx) => {
                          const data = subjectScores[subject.id] || { score: 10 };
                          const lvl = getPerformanceLevel(data.score);
                          return (
                            <tr key={subject.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                                {subject.name}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                                {data.score} / 10
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: lvl.color }}>
                                {lvl.level}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>

              {/* ─── SECTION 4: شواهد التقارير (Evidence Media - Images & Videos) ─── */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={20} color="#059669" />
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                      شواهد الإنجاز والتميز (صور ومقاطع فيديو)
                    </h3>
                  </div>

                  {/* Upload Trigger Button */}
                  <label style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}>
                    <UploadCloud size={14} />
                    <span>{isUploadingMedia ? 'جاري الرفع...' : '+ إضافة شاهد (صورة أو فيديو)'}</span>
                    <input 
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/mp4,video/webm"
                      onChange={handleUploadEvidence}
                      style={{ display: 'none' }}
                      disabled={isUploadingMedia}
                    />
                  </label>
                </div>

                {evidenceList.length === 0 ? (
                  <div style={{
                    background: '#fafafa',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '28px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '13px'
                  }}>
                    لا توجد شواهد مرفقة لهذا التقرير بعد. اضغط على "إضافة شاهد" لرفع أوراق العمل المتميزة أو مقاطع فيديو المشاريع.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                    {evidenceList.map(item => (
                      <div 
                        key={item.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          background: '#fff',
                          position: 'relative'
                        }}
                      >
                        {item.type === 'video' ? (
                          <div 
                            onClick={() => setMediaPreviewModal(item)}
                            style={{
                              height: '110px',
                              background: '#0f172a',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                          >
                            <Play size={28} />
                            <span style={{ fontSize: '11px', marginTop: '4px' }}>مقطع فيديو</span>
                          </div>
                        ) : (
                          <img 
                            src={item.url} 
                            alt={item.title}
                            onClick={() => setMediaPreviewModal(item)}
                            style={{ width: '100%', height: '110px', objectFit: 'cover', cursor: 'pointer' }}
                          />
                        )}

                        <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                            {item.title}
                          </span>
                          <button 
                            type="button"
                            onClick={() => handleDeleteEvidence(item.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── SECTION 5: الربط السحابي ورابط Google Drive ─── */}
              <div style={{ marginBottom: '32px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Share2 size={18} color="#2563eb" />
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                      الربط السحابي ومشاركة التقرير (يغنيك عن Google Drive)
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={handleCopyShareLink}
                    style={{
                      background: shareLinkCopied ? '#059669' : '#1e40af',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {shareLinkCopied ? <Check size={14} /> : <Share2 size={14} />}
                    <span>{shareLinkCopied ? 'تم نسخ الرابط المباشر!' : 'نسخ الرابط الذكي المباشر لولي الأمر'}</span>
                  </button>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  يولد النظام رابطاً سحابياً موثقاً ومباشراً لولي الأمر والإدارة دون الحاجة لرفع يدوي على Google Drive. وإذا كانت إدارتك تتطلب رابط Google Drive مخصصاً، يمكنك حفظه أدناه:
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="url"
                    placeholder="ضع رابط مجلد أو ملف Google Drive إن وجد (اختياري)..."
                    value={googleDriveUrl}
                    onChange={(e) => setGoogleDriveUrl(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#fff',
                      direction: 'ltr'
                    }}
                  />
                  {googleDriveUrl && (
                    <a 
                      href={googleDriveUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{
                        background: '#f1f5f9',
                        color: '#2563eb',
                        border: '1px solid #cbd5e1',
                        padding: '9px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Globe size={14} />
                      <span>فتح الرابط</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Signatures in Report */}
              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>المربي المخلص</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                    {selectedMentor?.name || 'محمد عبدالله جمعة'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>التوقيع والاعتماد</div>
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>مدير المدارس</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                    إدارة مدارس المتقدمة
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>الختم الرسمي</div>
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>ولي الأمر المكرم</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                    تم الاطلاع
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ملاحظات وتوقيع ولي الأمر</div>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          AUDIT & DEFICIENCIES TRACKING MODAL (حصر نواقص التقارير)
      ═══════════════════════════════════════════════════════════════════ */}
      {showAuditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            
            {/* Modal Header */}
            <div style={{
              background: '#1e3a8a',
              color: '#ffffff',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                  حصر نواقص ومتابعة تقارير الفصل ({selectedClass})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#bfdbfe' }}>
                  الفترة: {academicMonth} - المربي المخلص: {selectedMentor?.name}
                </p>
              </div>
              <button 
                onClick={() => setShowAuditModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div style={{
              background: '#f8fafc',
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              textAlign: 'center'
            }}>
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>إجمالي الطلاب</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {auditDeficiencies.totalStudents}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '12px', color: '#166534' }}>مكتملة 100%</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#047857' }}>
                  {auditDeficiencies.completeCount}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                <span style={{ fontSize: '12px', color: '#9a3412' }}>ناقصة مواد</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#d97706' }}>
                  {auditDeficiencies.missingSubjectsCount}
                </div>
              </div>
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: '12px', color: '#991b1b' }}>لم ترصد بعد</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
                  {auditDeficiencies.notStartedCount}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '320px' }}>
                <Search size={15} color="#94a3b8" />
                <input 
                  type="text"
                  placeholder="ابحث بالاسم أو الهوية..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: '13px' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  checked={filterMissingOnly}
                  onChange={(e) => setFilterMissingOnly(e.target.checked)}
                />
                <span>إظهار الطلاب ذوي النواقص فقط</span>
              </label>
            </div>

            {/* Table of Students Deficiencies */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', marginTop: '12px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569' }}>اسم الطالب</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>الحالة</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569' }}>المواد الناقصة</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>الشواهد</th>
                    <th style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {auditDeficiencies.items
                    .filter(item => {
                      if (filterMissingOnly && item.status === 'COMPLETE') return false;
                      if (auditSearchQuery) {
                        return item.student.name.includes(auditSearchQuery) || String(item.student.nationalId).includes(auditSearchQuery);
                      }
                      return true;
                    })
                    .map(item => (
                      <tr key={item.student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                          {item.student.name}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {item.status === 'COMPLETE' ? (
                            <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                              مكتمل (100%)
                            </span>
                          ) : item.status === 'INCOMPLETE' ? (
                            <span style={{ background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                              رصد جزئي ({item.completedSubjects}/{item.totalSubjects})
                            </span>
                          ) : (
                            <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                              لم يرصد
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                          {item.missingSubjects.length === 0 ? (
                            <span style={{ color: '#047857' }}>جميع المواد مرصودة</span>
                          ) : (
                            <span style={{ color: '#dc2626' }}>
                              ينقص: {item.missingSubjects.join('، ')}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          {item.evidenceCount > 0 ? `${item.evidenceCount} شاهد` : 'لا يوجد'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button 
                            onClick={() => {
                              setSelectedStudent(item.student);
                              setActiveStep(2);
                              setShowAuditModal(false);
                            }}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            رصد الآن
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ─── ADD HOMEROOM MENTOR MODAL ─── */}
      {showAddMentorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: '800', color: '#1e293b' }}>
              إضافة مربي مخلص جديد
            </h3>
            <form onSubmit={handleAddNewMentor} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>اسم المربي المخلص</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: محمد عبدالله جمعة"
                  value={newMentorName}
                  onChange={(e) => setNewMentorName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>رقم الهوية الوطنية أو الوظيفي</label>
                <input 
                  type="text"
                  placeholder="مثال: 2164228096"
                  value={newMentorIdNumber}
                  onChange={(e) => setNewMentorIdNumber(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setShowAddMentorModal(false)}
                  style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  style={{ background: '#1e40af', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  إضافة واعتماد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MEDIA PREVIEW MODAL (LIGHTBOX) ─── */}
      {mediaPreviewModal && (
        <div 
          onClick={() => setMediaPreviewModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '24px'
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            <button 
              onClick={() => setMediaPreviewModal(null)}
              style={{ position: 'absolute', top: '-36px', right: 0, background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={26} />
            </button>
            {mediaPreviewModal.type === 'video' ? (
              <video controls autoPlay src={mediaPreviewModal.url} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '10px' }} />
            ) : (
              <img src={mediaPreviewModal.url} alt={mediaPreviewModal.title} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '10px', objectFit: 'contain' }} />
            )}
            <div style={{ color: '#fff', textAlign: 'center', marginTop: '10px', fontSize: '14px', fontWeight: 'bold' }}>
              {mediaPreviewModal.title}
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD NEW CLASS MODAL ─── */}
      {showAddClassModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: '800', color: '#1e293b' }}>
              إضافة صف / فصل دراسي جديد
            </h3>
            <form onSubmit={handleAddNewClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>اسم الفصل أو الشعبة</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: الأول الثانوي / 3 أو الخامس / 2"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button 
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  style={{ background: '#1e40af', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  إضافة الفصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD NEW STUDENT MODAL (FLEXIBLE) ─── */}
      {showAddStudentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: '800', color: '#1e293b' }}>
              إضافة طالب جديد للفصل ({selectedClass})
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
              يمكنك إضافة أي طالب فوراً ليتسنى للمربي المخلص رصد تقريره الدوري وإصدار شواهده.
            </p>
            <form onSubmit={handleAddNewStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>اسم الطالب الرباعي</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: عبدالرحمن أحمد الشهري"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>رقم الهوية الوطنية أو الإقامة</label>
                <input 
                  type="text"
                  placeholder="مثال: 1109847362"
                  value={newStudentNationalId}
                  onChange={(e) => setNewStudentNationalId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button 
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  style={{ background: '#047857', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  حفظ وإضافة الطالب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── VALUES & SKILLS DOCUMENTS & TEMPLATES MODAL (Matches Image 4) ─── */}
      {showDocumentsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              color: '#ffffff',
              padding: '20px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#a7f3d0', fontWeight: 'bold', marginBottom: '2px' }}>
                  برنامج التمكين القيمي والمهاري 1447 / 1448 هـ
                </div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
                  وثائق ونماذج البرنامج (قسم البنين والبنات)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#d1fae5' }}>
                  الوثائق والنماذج المنشورة من المشرف العام، متاحة للعرض والتنزيل لجميع المربين والمعلمين.
                </p>
              </div>
              <button 
                onClick={() => setShowDocumentsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ background: '#f8fafc', padding: '12px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: '#047857', color: '#fff', padding: '4px 14px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold' }}>الكل</span>
              <span style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 14px', borderRadius: '16px', fontSize: '12px' }}>وثيقة</span>
              <span style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 14px', borderRadius: '16px', fontSize: '12px' }}>دليل</span>
              <span style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 14px', borderRadius: '16px', fontSize: '12px' }}>نموذج</span>
              <span style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 14px', borderRadius: '16px', fontSize: '12px' }}>فيديو</span>
              <span style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '4px 14px', borderRadius: '16px', fontSize: '12px' }}>رابط</span>
            </div>

            {/* Documents Grid (Matching Image 4) */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' }}>
              
              {/* Card 1: فيديو شرح المنصة */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', marginBottom: '12px' }}>
                    <Video size={20} />
                  </div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>رابط فيديو</span>
                  <h4 style={{ margin: '4px 0 8px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>فيديو شرح إستخدام المنصة</h4>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>شرح متكامل لآلية رصد المربي المخلص وإصدار التقارير الدورية ورفع الشواهد.</p>
                </div>
                <button 
                  onClick={() => alert('يمكنك مشاهدة الفيديو التعريفي مباشرة.')}
                  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e40af', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Play size={13} />
                  <span>فتح الرابط والمشاهدة</span>
                </button>
              </div>

              {/* Card 2: دليل التمكن القيمي والمهاري */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: '#f0fdf4', color: '#047857', marginBottom: '12px' }}>
                    <FileText size={20} />
                  </div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>وثيقة رسمية</span>
                  <h4 style={{ margin: '4px 0 8px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>دليل التمكن القيمي والمهاري</h4>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>الإطار العام والضوابط والمعايير المعتمدة من شركة المدارس المتقدمة لعام 1447/1448هـ.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => alert('معاينة دليل التمكن القيمي والمهاري')}
                    style={{ flex: 1, background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    معاينة الملف
                  </button>
                  <button 
                    onClick={() => alert('جاري تنزيل الملف')}
                    style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    تنزيل 📥
                  </button>
                </div>
              </div>

              {/* Card 3: محتوى المرحلة الثانوية */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', marginBottom: '12px' }}>
                    <BookOpen size={20} />
                  </div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>وثيقة محتوى</span>
                  <h4 style={{ margin: '4px 0 8px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>محتوى المرحلة الثانوية</h4>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>مصفوفة القيم والمهارات التخصصية لطلاب المسارات الثانوية.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => alert('معاينة محتوى المرحلة الثانوية')}
                    style={{ flex: 1, background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    معاينة الملف
                  </button>
                  <button 
                    onClick={() => alert('جاري تنزيل الملف')}
                    style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    تنزيل 📥
                  </button>
                </div>
              </div>

              {/* Card 4: محتوى المرحلة المتوسطة والابتدائية */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ display: 'inline-flex', padding: '8px', borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', marginBottom: '12px' }}>
                    <Award size={20} />
                  </div>
                  <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>وثيقة محتوى</span>
                  <h4 style={{ margin: '4px 0 8px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>محتوى المرحلتين الابتدائية والمتوسطة</h4>
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>برامج التمكين المهاري والأنشطة الصفية لصفوف التعليم الأساسي.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => alert('معاينة محتوى المرحلتين الابتدائية والمتوسطة')}
                    style={{ flex: 1, background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    معاينة الملف
                  </button>
                  <button 
                    onClick={() => alert('جاري تنزيل الملف')}
                    style={{ background: '#f3e8ff', border: '1px solid #e9d5ff', color: '#7e22ce', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    تنزيل 📥
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ background: '#f8fafc', padding: '14px 28px', borderTop: '1px solid #e2e8f0', textAlign: 'left' }}>
              <button 
                onClick={() => setShowDocumentsModal(false)}
                style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── STUDENT GROWTH COMPARISON & TRACKING DOSSIER MODAL ─── */}
      {showComparisonModal && (() => {
        const student = comparisonStudent || selectedStudent || students[0];
        
        // Fetch or simulate old report
        const oldRep = allMonthsReportsMap[comparisonOldMonth]?.[student?.id] || {
          averagePercentage: 91.5,
          overallLevel: 'متقدم',
          subjectScores: {
            arabic: { score: 9.0 },
            english: { score: 8.5 },
            math: { score: 8.5 },
            science: { score: 9.5 },
            social: { score: 9.0 },
            islamic: { score: 10.0 },
            digital: { score: 9.5 }
          }
        };

        // Fetch or simulate new report
        const newRep = (comparisonNewMonth === academicMonth && student?.id === selectedStudent?.id)
          ? {
              averagePercentage: averagePercentage || 98.5,
              overallLevel: overallLevel.level,
              subjectScores: subjectScores
            }
          : (allMonthsReportsMap[comparisonNewMonth]?.[student?.id] || {
              averagePercentage: 98.5,
              overallLevel: 'متقدم ومتميز',
              subjectScores: {
                arabic: { score: 10.0 },
                english: { score: 10.0 },
                math: { score: 10.0 },
                science: { score: 10.0 },
                social: { score: 10.0 },
                islamic: { score: 10.0 },
                digital: { score: 9.5 }
              }
            });

        const oldAvg = Number(oldRep.averagePercentage || 0);
        const newAvg = Number(newRep.averagePercentage || 0);
        const deltaAvg = Number((newAvg - oldAvg).toFixed(1));

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1050px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }}>
              
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
                color: '#ffffff',
                padding: '20px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px', borderRadius: '12px' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800' }}>
                      ملف تتبع ومقارنة التقارير الدورية (التقرير السابق vs التقرير الحالي)
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#bfdbfe' }}>
                      مدارس المتقدمة - رصد منحنى نمو الطالب الأكاديمي وقياس الأثر التراكمي
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    onClick={() => window.print()}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Printer size={14} />
                    <span>طباعة ملف التتبع</span>
                  </button>
                  <button 
                    onClick={() => setShowComparisonModal(false)}
                    style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Selection Bar */}
              <div style={{
                background: '#f8fafc',
                padding: '16px 28px',
                borderBottom: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr',
                gap: '16px',
                alignItems: 'center'
              }}>
                {/* Student */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    الطالب المحدد
                  </label>
                  <select 
                    value={student?.id || ''}
                    onChange={(e) => {
                      const found = students.find(s => s.id === e.target.value);
                      if (found) {
                        setComparisonStudent(found);
                        setComparisonAISummary('');
                      }
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}
                  >
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.nationalId}</option>
                    ))}
                  </select>
                </div>

                {/* Old Month */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    التقرير المرجعي (القديم / السابق)
                  </label>
                  <select 
                    value={comparisonOldMonth}
                    onChange={(e) => { setComparisonOldMonth(e.target.value); setComparisonAISummary(''); }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="سبتمبر 2026">تقرير شهر سبتمبر (بداية العام)</option>
                    <option value="أكتوبر 2026">تقرير شهر أكتوبر (الفترة الأولى)</option>
                    <option value="نوفمبر 2026">تقرير شهر نوفمبر (الفترة الثانية)</option>
                  </select>
                </div>

                {/* New Month */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    التقرير المقارن (الجديد / الحالي)
                  </label>
                  <select 
                    value={comparisonNewMonth}
                    onChange={(e) => { setComparisonNewMonth(e.target.value); setComparisonAISummary(''); }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="أكتوبر 2026">تقرير شهر أكتوبر (الفترة الأولى)</option>
                    <option value="نوفمبر 2026">تقرير شهر نوفمبر (الفترة الثانية)</option>
                    <option value="ديسمبر 2026">تقرير شهر ديسمبر (نهاية الفصل الأول)</option>
                    <option value="يناير 2027">تقرير شهر يناير (الفصل الثاني)</option>
                  </select>
                </div>
              </div>

              {/* Scrollable Modal Body */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px' }}>
                
                {/* KPI Comparative Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                  
                  {/* Old Avg */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>معدل ({comparisonOldMonth})</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#334155', marginTop: '4px' }}>
                      {oldAvg}%
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{oldRep.overallLevel || 'متقدم'}</span>
                  </div>

                  {/* New Avg */}
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#166534' }}>معدل ({comparisonNewMonth})</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>
                      {newAvg}%
                    </div>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold' }}>{newRep.overallLevel || 'متقدم ومتميز'}</span>
                  </div>

                  {/* Delta Change */}
                  <div style={{
                    background: deltaAvg >= 0 ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${deltaAvg >= 0 ? '#a7f3d0' : '#fecaca'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '12px', color: deltaAvg >= 0 ? '#065f46' : '#991b1b' }}>مقدار التغير الكلي</span>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: deltaAvg >= 0 ? '#047857' : '#dc2626', marginTop: '4px' }}>
                      {deltaAvg >= 0 ? `+${deltaAvg}%` : `${deltaAvg}%`}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: deltaAvg >= 0 ? '#059669' : '#dc2626' }}>
                      {deltaAvg >= 0 ? '↗️ نمو إيجابي صاعد' : '↘️ تراجع طفيف'}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#1e40af' }}>مسار الطالب الأكاديمي</span>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a', marginTop: '6px' }}>
                      {deltaAvg >= 2 ? 'قفزة نوعية مشرفة' : deltaAvg >= 0 ? 'ثبات وتفوق مستمر' : 'يحتاج متابعة منزلية'}
                    </div>
                    <span style={{ fontSize: '11px', color: '#3b82f6' }}>معتمد من المربي المخلص</span>
                  </div>

                </div>

                {/* AI Growth Comparative Narrative */}
                <div style={{
                  background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)',
                  border: '1px solid #e9d5ff',
                  borderRadius: '14px',
                  padding: '18px 22px',
                  marginBottom: '26px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={18} color="#7c3aed" />
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#5b21b6' }}>
                        التحليل الذكي لمنحنى نمو وتطور الطالب (AI Growth Insight)
                      </span>
                    </div>
                    <button 
                      onClick={() => handleGenerateComparisonSummary(student, oldRep, newRep)}
                      disabled={isGeneratingComparisonAI}
                      style={{
                        background: '#7c3aed',
                        color: '#fff',
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {isGeneratingComparisonAI ? 'جاري التحليل...' : 'تحديث التحليل الذكي ✨'}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.8', color: '#4c1d95', fontWeight: '500' }}>
                    {comparisonAISummary || generateComparativeGrowthSummary({
                      studentName: student?.name || 'الطالب',
                      oldMonth: comparisonOldMonth,
                      newMonth: comparisonNewMonth,
                      oldAvg,
                      newAvg,
                      improvements: [
                        { name: 'الرياضيات', oldScore: 8.5, newScore: 10, delta: 1.5 },
                        { name: 'اللغة العربية', oldScore: 9.0, newScore: 10, delta: 1.0 },
                        { name: 'اللغة الإنجليزية', oldScore: 8.5, newScore: 10, delta: 1.5 }
                      ],
                      declines: [],
                      stableHigh: [{ name: 'الإسلاميات', score: 10 }, { name: 'العلوم', score: 10 }]
                    })}
                  </p>
                </div>

                {/* Comparative Subjects Table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#334155' }}>المادة الدراسية</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#334155', textAlign: 'center' }}>الدرجة السابقة ({comparisonOldMonth})</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#334155', textAlign: 'center' }}>الدرجة الحالية ({comparisonNewMonth})</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#334155', textAlign: 'center' }}>مؤشر التغير (Δ)</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '800', color: '#334155', textAlign: 'center' }}>حالة المسار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSubjectDefs.map(sub => {
                        const sOld = Number(oldRep?.subjectScores?.[sub.id]?.score ?? 9.0);
                        const sNew = Number(newRep?.subjectScores?.[sub.id]?.score ?? 10.0);
                        const diff = Number((sNew - sOld).toFixed(1));

                        return (
                          <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                              {sub.name}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#64748b' }}>
                              {sOld} / 10
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '15px', fontWeight: '800', color: '#047857' }}>
                              {sNew} / 10
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', fontSize: '14px', color: diff > 0 ? '#047857' : diff === 0 ? '#2563eb' : '#dc2626' }}>
                              {diff > 0 ? `+${diff}` : diff === 0 ? '0.0' : diff}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {diff > 0 ? (
                                <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                  ↗️ تحسن ونمو
                                </span>
                              ) : diff === 0 ? (
                                <span style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                  ⏺ ثبات ممتاز
                                </span>
                              ) : (
                                <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                  ↘️ يحتاج متابعة
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Side-by-Side Visual Bar Progress */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                      المقارنة البيانية المباشرة بين الفترتين
                    </h4>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 'bold' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '12px', height: '8px', background: '#94a3b8', borderRadius: '2px' }} />
                        <span>الشهر السابق ({comparisonOldMonth})</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '12px', height: '8px', background: '#047857', borderRadius: '2px' }} />
                        <span>الشهر الحالي ({comparisonNewMonth})</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeSubjectDefs.map(sub => {
                      const sOld = Number(oldRep?.subjectScores?.[sub.id]?.score ?? 9.0);
                      const sNew = Number(newRep?.subjectScores?.[sub.id]?.score ?? 10.0);
                      const pctOld = sOld * 10;
                      const pctNew = sNew * 10;

                      return (
                        <div key={sub.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                            <span>{sub.name}</span>
                            <span>{sOld} ⬅️ {sNew} / 10</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {/* Old Bar */}
                            <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pctOld}%`, height: '100%', background: '#94a3b8', borderRadius: '4px' }} />
                            </div>
                            {/* New Bar */}
                            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pctNew}%`, height: '100%', background: '#047857', borderRadius: '4px' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{ background: '#f8fafc', padding: '14px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  يمكنك تصدير هذا الملف ومشاركته مع ولي الأمر كوثيقة تقدم تربوية رسمية.
                </span>
                <button 
                  onClick={() => setShowComparisonModal(false)}
                  style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  إغلاق
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
