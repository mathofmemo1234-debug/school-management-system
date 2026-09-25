import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MarkdownViewer from '../components/MarkdownViewer';
import { 
  Save, UploadCloud, Eye, Edit, Trash2, X, Image as ImageIcon, Loader, 
  Printer, BookOpen, Target, Sparkles, CheckSquare, Square, Plus, 
  Layers, CheckCircle2, Globe, HelpCircle, Compass, GraduationCap,
  Cpu, Atom, Laptop, Lightbulb, Box, BookmarkCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MarkdownInput from '../components/MarkdownInput';
import { useLanguage } from '../contexts/LanguageContext';
import PrintLessonPreparationModal from '../components/PrintLessonPreparationModal';
import LessonWorksheetModal from '../components/LessonWorksheetModal';
import { 
  SEMESTERS, 
  CURRICULUM_TYPES, 
  SAUDI_STAGES,
  AMERICAN_STAGES,
  detectStageFromClassName,
  detectCurriculumType, 
  getCurriculumData, 
  getAvailableCurriculumSubjects,
  getLessonsForSubject,
  groupLessonsBySubject,
  POPULAR_TEACHING_STRATEGIES,
  POPULAR_LEARNING_RESOURCES,
  formatGoalsToMarkdown,
  formatStrategiesToMarkdown,
  formatResourcesToMarkdown
} from '../data/curriculumService';

const DEFAULT_PERIODS = [
  'الحصة 1',
  'الحصة 2',
  'الحصة 3',
  'الحصة 4',
  'الحصة 5',
  'الحصة 6',
  'الحصة 7',
  'الحصة 8'
];

export default function LessonPreparation() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  
  // School & Curriculum type
  const [curriculumType, setCurriculumType] = useState(CURRICULUM_TYPES.SAUDI);
  const [isInternationalSchool, setIsInternationalSchool] = useState(false);
  const [schoolData, setSchoolData] = useState(null);

  // Tabs and History states
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'list'
  const [allPreparations, setAllPreparations] = useState([]);
  const [previewPrep, setPreviewPrep] = useState(null);
  const [printingPrep, setPrintingPrep] = useState(null);
  const [worksheetModalOpen, setWorksheetModalOpen] = useState(false);
  const [selectedWorksheetPrep, setSelectedWorksheetPrep] = useState(null);
  const [existingWorksheetData, setExistingWorksheetData] = useState(null);

  // Step 1: Semester (2 Semesters only)
  const [selectedSemester, setSelectedSemester] = useState(SEMESTERS[0]);

  // Step 2: Educational Stage (Strict Separation)
  const [selectedStage, setSelectedStage] = useState(SAUDI_STAGES.SECONDARY);

  // Step 3: Class & Subject
  const [classesList, setClassesList] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [teacherDocId, setTeacherDocId] = useState(null);

  // Step 4: Lesson Selection (Strictly segregated by stage, grade, and subject)
  const [availableLessons, setAvailableLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [isCustomLesson, setIsCustomLesson] = useState(false);
  const [customLessonTitle, setCustomLessonTitle] = useState('');
  const [showAllStageLessons, setShowAllStageLessons] = useState(false);

  // Step 5: Objectives (Curriculum auto-loaded + Custom manual additions)
  const [lessonObjectives, setLessonObjectives] = useState([]);
  const [selectedObjectives, setSelectedObjectives] = useState([]);
  const [customObjectives, setCustomObjectives] = useState([]);
  const [newGoalInput, setNewGoalInput] = useState('');

  // Step 6: Teaching Strategies (Popular list + Custom manual additions)
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [customStrategies, setCustomStrategies] = useState([]);
  const [newStrategyInput, setNewStrategyInput] = useState('');

  // Step 7: Learning Resources & Media (Popular list + Custom manual additions)
  const [selectedResources, setSelectedResources] = useState([]);
  const [customResources, setCustomResources] = useState([]);
  const [newResourceInput, setNewResourceInput] = useState('');

  // Step 8: Dates, Period, Weeks
  const [weeks] = useState(Array.from({length: 18}, (_, i) => `الأسبوع ${i + 1}`));
  const [selectedWeek, setSelectedWeek] = useState('الأسبوع 1');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availablePeriods, setAvailablePeriods] = useState(DEFAULT_PERIODS);
  const [selectedPeriod, setSelectedPeriod] = useState(DEFAULT_PERIODS[0]);

  // Form Markdown fields
  const [goals, setGoals] = useState('');
  const [priorKnowledge, setPriorKnowledge] = useState('');
  const [warmup, setWarmup] = useState('');
  const [strategy, setStrategy] = useState('');
  const [resources, setResources] = useState('');
  const [stem, setStem] = useState('');
  const [content, setContent] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [formativeEval, setFormativeEval] = useState('');
  const [summativeEval, setSummativeEval] = useState('');
  const [homework, setHomework] = useState('');

  // File upload state
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);


  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [prepDocId, setPrepDocId] = useState(null);
  const [customSubjectsList, setCustomSubjectsList] = useState([]);

  // 1. Detect School and Curriculum Type & Custom Subjects
  useEffect(() => {
    const schoolId = userData?.schoolId || 'default_school_1';
    if (!schoolId) return;

    // Load custom subjects for this school
    const qCustSubs = query(collection(db, 'subjects'), where('schoolId', '==', schoolId));
    const unsubCustSubs = onSnapshot(qCustSubs, snap => {
      setCustomSubjectsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const fetchSchoolInfo = async () => {
      try {
        const d = await getDoc(doc(db, 'schools', schoolId));
        if (d.exists()) {
          const sData = d.data();
          setSchoolData(sData);
          const detected = detectCurriculumType(sData.name || userData?.schoolName, sData.curriculumType);
          setCurriculumType(detected);
          setIsInternationalSchool(detected === CURRICULUM_TYPES.AMERICAN || (sData.name || '').includes('عالمي'));
          setSelectedStage(detected === CURRICULUM_TYPES.AMERICAN ? AMERICAN_STAGES.HIGH : SAUDI_STAGES.SECONDARY);
        } else {
          const detected = detectCurriculumType(userData?.schoolName || '');
          setCurriculumType(detected);
          setIsInternationalSchool(detected === CURRICULUM_TYPES.AMERICAN);
          setSelectedStage(detected === CURRICULUM_TYPES.AMERICAN ? AMERICAN_STAGES.HIGH : SAUDI_STAGES.SECONDARY);
        }
      } catch (err) {
        console.error('Error fetching school:', err);
      }
    };
    fetchSchoolInfo();
  }, [userData]);

  // 2. Fetch teacher doc ID based on nationalId
  useEffect(() => {
    if (userData?.nationalId) {
      const unsub = onSnapshot(query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId)), (snap) => {
        if (!snap.empty) {
          setTeacherDocId(snap.docs[0].id);
        } else if (!isNaN(userData.nationalId)) {
          const numQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)));
          getDocs(numQ).then(numSnap => {
            if (!numSnap.empty) setTeacherDocId(numSnap.docs[0].id);
            else setTeacherDocId(null);
          });
        } else {
          setTeacherDocId(null);
        }
      });
      return () => unsub();
    }
  }, [userData]);

  // 3. Fetch all preps for this teacher
  useEffect(() => {
    if (!teacherDocId && !userData?.nationalId) return;
    const effectiveId = teacherDocId || userData?.nationalId;
    const q = query(collection(db, 'preparations'), where('teacherId', '==', effectiveId));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      setAllPreparations(data);
    });
    return () => unsub();
  }, [teacherDocId, userData]);

  // 4. Detect Stage when Class changes
  useEffect(() => {
    if (selectedClass) {
      const detected = detectStageFromClassName(selectedClass, curriculumType);
      setSelectedStage(detected);
    }
  }, [selectedClass, curriculumType]);

  // 5. Fetch available classes and subjects for this teacher strictly from schedules and profile
  const [classToSubjectsMap, setClassToSubjectsMap] = useState({});

  useEffect(() => {
    const rawSchoolId = userData?.schoolId;
    const effectiveSchoolId = (rawSchoolId && rawSchoolId !== 'default_school_1') ? rawSchoolId : null;
    const isAdminOrSupervisor = userData?.role === 'admin' || userData?.role === 'superadmin' || userData?.role === 'supervisor';

    // Query classes (school specific + all fallback)
    const qClasses = effectiveSchoolId && effectiveSchoolId !== 'ALL'
      ? query(collection(db, 'classes'), where('schoolId', '==', effectiveSchoolId))
      : collection(db, 'classes');

    const unsubClasses = onSnapshot(qClasses, (classesSnap) => {
      let classDocs = classesSnap.docs;
      const classNamesMap = {};
      const allClassNames = [];

      classDocs.forEach(d => {
        const cName = d.data().name || d.data().className || d.id;
        classNamesMap[d.id] = cName;
        if (cName && !allClassNames.includes(cName)) allClassNames.push(cName);
      });

      // Query schedules (school specific + all fallback)
      const qSchedules = effectiveSchoolId && effectiveSchoolId !== 'ALL'
        ? query(collection(db, 'schedules'), where('schoolId', '==', effectiveSchoolId))
        : collection(db, 'schedules');

      const unsubSchedules = onSnapshot(qSchedules, (schedulesSnap) => {
        const myMap = {}; // { className: Set([subject1, subject2]) }
        const myIdentities = new Set([
          teacherDocId,
          userData?.nationalId,
          userData?.nationalId ? String(userData.nationalId).trim() : null,
          userData?.nationalId ? Number(userData.nationalId) : null,
          userData?.id,
          userData?.uid,
          auth.currentUser?.uid,
          auth.currentUser?.email,
          auth.currentUser?.email?.split('@')[0],
          userData?.name ? userData.name.trim().toLowerCase() : null,
          userData?.name ? userData.name.replace(/^(أستاذ|أ\.|د\.|الاستاذ|الأستاذ|المعلم)\s*/g, '').trim().toLowerCase() : null
        ].filter(Boolean));

        schedulesSnap.docs.forEach(docSnap => {
          const className = classNamesMap[docSnap.id] || docSnap.data().className || docSnap.data().name || docSnap.id;
          if (!className) return;

          const matrix = docSnap.data().matrix || {};
          Object.values(matrix).forEach(cell => {
            if (!cell || !cell.subject) return;

            const cellTid = cell.teacherId ? String(cell.teacherId).trim() : '';
            const cellTName = cell.teacherName ? String(cell.teacherName).trim().toLowerCase() : '';
            const myNameLower = userData?.name ? userData.name.trim().toLowerCase() : '';
            const cleanMyName = myNameLower.replace(/^(أستاذ|أ\.|د\.|الاستاذ|الأستاذ|المعلم)\s*/g, '').trim();

            const isMyCell = isAdminOrSupervisor || 
              (cellTid && (myIdentities.has(cellTid) || myIdentities.has(Number(cellTid)))) ||
              (cellTName && (
                myIdentities.has(cellTName) ||
                (cleanMyName && (cellTName.includes(cleanMyName) || cleanMyName.includes(cellTName)))
              ));

            if (isMyCell) {
              if (!myMap[className]) myMap[className] = new Set();
              myMap[className].add(cell.subject.trim());
            }
          });
        });

        // 1. Check teacher profile assigned classes/subject from teachers/users collection
        const profileClasses = userData?.assignedClasses || userData?.classes || (userData?.class ? [userData.class] : []) || (userData?.className ? [userData.className] : []);
        const profileSubjects = userData?.subject ? userData.subject.split(/[,،]/).map(s => s.trim()).filter(Boolean) : [];

        if (profileClasses.length > 0 && profileSubjects.length > 0) {
          profileClasses.forEach(cls => {
            if (!myMap[cls]) myMap[cls] = new Set();
            profileSubjects.forEach(sub => myMap[cls].add(sub));
          });
        }

        // 2. If teacher has a subject in profile but no schedule matrix matched yet:
        if (Object.keys(myMap).length === 0 && profileSubjects.length > 0) {
          allClassNames.forEach(cls => {
            if (!myMap[cls]) myMap[cls] = new Set();
            profileSubjects.forEach(sub => myMap[cls].add(sub));
          });
        }

        // 3. If still empty (e.g. no schedule and no profile assigned), fallback to all classes & curriculum subjects so teacher is never blocked
        if (Object.keys(myMap).length === 0) {
          allClassNames.forEach(cls => {
            myMap[cls] = new Set();
          });
        }

        setClassToSubjectsMap(myMap);

        const assignedClasses = Object.keys(myMap);
        const finalClasses = assignedClasses.length > 0 ? assignedClasses : allClassNames;

        setClassesList(finalClasses);

        // Auto-select first class if none selected or not in list
        let currentClass = selectedClass;
        if ((!currentClass || !finalClasses.includes(currentClass)) && finalClasses.length > 0) {
          currentClass = finalClasses[0];
          setSelectedClass(currentClass);
        }

        // Update subjects for current class
        if (currentClass && myMap[currentClass] && myMap[currentClass].size > 0) {
          const classSubjects = Array.from(myMap[currentClass]);
          setSubjects(classSubjects);
          if (!selectedSubject || !classSubjects.includes(selectedSubject)) {
            setSelectedSubject(classSubjects[0] || '');
          }
        } else {
          const currSubjects = getAvailableCurriculumSubjects(curriculumType, selectedSemester, currentClass, selectedStage);
          const finalSubjs = currSubjects.length > 0 ? currSubjects : profileSubjects;
          setSubjects(finalSubjs);
          if (!selectedSubject || !finalSubjs.includes(selectedSubject)) {
            setSelectedSubject(finalSubjs[0] || '');
          }
        }
      });
      return () => unsubSchedules();
    });
    return () => unsubClasses();
  }, [teacherDocId, userData, userData?.schoolId, userData?.nationalId, userData?.name, userData?.subject, curriculumType, selectedSemester, selectedStage]);

  // Update subjects whenever selectedClass or selectedStage or selectedSemester changes
  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setSelectedSubject('');
      return;
    }

    if (classToSubjectsMap[selectedClass] && classToSubjectsMap[selectedClass].size > 0) {
      const classSubjects = Array.from(classToSubjectsMap[selectedClass]);
      setSubjects(classSubjects);
      if (!selectedSubject || !classSubjects.includes(selectedSubject)) {
        setSelectedSubject(classSubjects[0] || '');
      }
    } else {
      const currSubjects = getAvailableCurriculumSubjects(curriculumType, selectedSemester, selectedClass, selectedStage);
      const profileSubjects = userData?.subject ? userData.subject.split(/[,،]/).map(s => s.trim()).filter(Boolean) : [];
      const finalSubjs = currSubjects.length > 0 ? currSubjects : profileSubjects;
      setSubjects(finalSubjs);
      if (!selectedSubject || !finalSubjs.includes(selectedSubject)) {
        setSelectedSubject(finalSubjs[0] || '');
      }
    }
  }, [selectedClass, classToSubjectsMap, curriculumType, selectedSemester, selectedStage, userData?.subject]);

  // 6. Fetch available periods based on selected class and subject
  useEffect(() => {
    if (!selectedClass || !selectedSubject) {
      setAvailablePeriods(DEFAULT_PERIODS);
      setSelectedPeriod(prev => prev || DEFAULT_PERIODS[0]);
      return;
    }

    const unsubClasses = onSnapshot(query(collection(db, 'classes'), where('name', '==', selectedClass)), (classSnap) => {
      if (classSnap.empty) {
        setAvailablePeriods(DEFAULT_PERIODS);
        setSelectedPeriod(prev => prev || DEFAULT_PERIODS[0]);
        return;
      }
      const classId = classSnap.docs[0].id;
      
      const unsubSchedule = onSnapshot(doc(db, 'schedules', classId), (docSnap) => {
        if (docSnap.exists()) {
          const matrix = docSnap.data().matrix || {};
          const periods = [];
          
          Object.entries(matrix).forEach(([key, cell]) => {
            if ((!teacherDocId || cell.teacherId === teacherDocId) && cell.subject === selectedSubject) {
              const [day, period] = key.split('-');
              periods.push(`${day} - الحصة ${period}`);
            }
          });
          
          if (periods.length > 0) {
            setAvailablePeriods(periods);
            setSelectedPeriod(prev => periods.includes(prev) ? prev : periods[0]);
          } else {
            setAvailablePeriods(DEFAULT_PERIODS);
            setSelectedPeriod(prev => DEFAULT_PERIODS.includes(prev) ? prev : DEFAULT_PERIODS[0]);
          }
        } else {
          setAvailablePeriods(DEFAULT_PERIODS);
          setSelectedPeriod(prev => DEFAULT_PERIODS.includes(prev) ? prev : DEFAULT_PERIODS[0]);
        }
      });
      return () => unsubSchedule();
    });
    return () => unsubClasses();
  }, [teacherDocId, selectedClass, selectedSubject]);

  // 7. Update Available Lessons STRICTLY filtered by Stage, Grade, Semester, and Subject
  useEffect(() => {
    if (!selectedSubject && !showAllStageLessons) {
      setAvailableLessons([]);
      setSelectedLesson('');
      setLessonObjectives([]);
      return;
    }

    const effectiveSubjectParam = showAllStageLessons ? '__ALL__' : selectedSubject;
    const lessons = getLessonsForSubject(curriculumType, selectedSemester, effectiveSubjectParam, selectedClass, selectedStage, customSubjectsList);
    setAvailableLessons(lessons);

    if (lessons.length > 0) {
      const matched = lessons.find(l => l.lesson === selectedLesson || l.displayTitle === selectedLesson || l.shortTitle === selectedLesson);
      if (!matched && !isCustomLesson) {
        setSelectedLesson(lessons[0].displayTitle);
        setLessonObjectives(lessons[0].objectives || []);
      } else if (matched) {
        setLessonObjectives(matched.objectives || []);
      }
    } else {
      setLessonObjectives([]);
    }
  }, [curriculumType, selectedSemester, selectedSubject, selectedClass, selectedStage, isCustomLesson, selectedLesson, showAllStageLessons, customSubjectsList]);

  // 8. Handle Lesson Selection Change
  const handleLessonChange = (e) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomLesson(true);
      setSelectedLesson('');
      setLessonObjectives([]);
      setSelectedObjectives([]);
    } else {
      setIsCustomLesson(false);
      setSelectedLesson(val);
      const found = availableLessons.find(l => l.displayTitle === val || l.lesson === val || l.shortTitle === val);
      if (found) {
        setLessonObjectives(found.objectives || []);
      } else {
        setLessonObjectives([]);
      }
    }
  };

  // 9. Auto-Sync Goals Markdown whenever selectedObjectives or customObjectives change
  useEffect(() => {
    const md = formatGoalsToMarkdown(selectedObjectives, customObjectives);
    if (md) {
      setGoals(md);
    }
  }, [selectedObjectives, customObjectives]);

  // 10. Auto-Sync Strategies Markdown whenever selectedStrategies or customStrategies change
  useEffect(() => {
    const md = formatStrategiesToMarkdown(selectedStrategies, customStrategies);
    if (md) {
      setStrategy(md);
    }
  }, [selectedStrategies, customStrategies]);

  // 11. Auto-Sync Learning Resources Markdown whenever selectedResources or customResources change
  useEffect(() => {
    const md = formatResourcesToMarkdown(selectedResources, customResources);
    if (md) {
      setResources(md);
    }
  }, [selectedResources, customResources]);

  // Objective Checkbox Toggle
  const toggleObjective = (obj) => {
    setSelectedObjectives(prev => 
      prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]
    );
  };

  // Add Custom Objective
  const handleAddCustomGoal = (e) => {
    e.preventDefault();
    if (!newGoalInput.trim()) return;
    setCustomObjectives(prev => [...prev, newGoalInput.trim()]);
    setNewGoalInput('');
  };

  // Remove Custom Objective
  const handleRemoveCustomGoal = (index) => {
    setCustomObjectives(prev => prev.filter((_, i) => i !== index));
  };

  // Strategy Toggle
  const toggleStrategy = (strategyName) => {
    setSelectedStrategies(prev => 
      prev.includes(strategyName) 
        ? prev.filter(s => s !== strategyName) 
        : [...prev, strategyName]
    );
  };

  // Add Custom Strategy
  const handleAddCustomStrategy = (e) => {
    e.preventDefault();
    if (!newStrategyInput.trim()) return;
    setCustomStrategies(prev => [...prev, newStrategyInput.trim()]);
    setNewStrategyInput('');
  };

  // Remove Custom Strategy
  const handleRemoveCustomStrategy = (index) => {
    setCustomStrategies(prev => prev.filter((_, i) => i !== index));
  };

  // Learning Resource Toggle
  const toggleResource = (resourceName) => {
    setSelectedResources(prev => 
      prev.includes(resourceName) 
        ? prev.filter(r => r !== resourceName) 
        : [...prev, resourceName]
    );
  };

  // Add Custom Learning Resource
  const handleAddCustomResource = (e) => {
    e.preventDefault();
    if (!newResourceInput.trim()) return;
    setCustomResources(prev => [...prev, newResourceInput.trim()]);
    setNewResourceInput('');
  };

  // Remove Custom Learning Resource
  const handleRemoveCustomResource = (index) => {
    setCustomResources(prev => prev.filter((_, i) => i !== index));
  };

  // 12. Fetch existing prep if matching class, subject, week, and period
  useEffect(() => {
    if (!teacherDocId || !selectedClass || !selectedSubject || !selectedWeek || !selectedPeriod) {
      return;
    }
    const q = query(
      collection(db, 'preparations'),
      where('teacherId', '==', teacherDocId),
      where('className', '==', selectedClass),
      where('subject', '==', selectedSubject),
      where('week', '==', selectedWeek),
      where('period', '==', selectedPeriod)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.semester) setSelectedSemester(data.semester);
        if (data.stage) setSelectedStage(data.stage);
        if (data.lessonTitle) {
          setSelectedLesson(data.lessonTitle);
          setCustomLessonTitle(data.lessonTitle);
        }
        if (data.selectedObjectives) setSelectedObjectives(data.selectedObjectives);
        if (data.customObjectives) setCustomObjectives(data.customObjectives);
        if (data.selectedStrategies) setSelectedStrategies(data.selectedStrategies);
        if (data.customStrategies) setCustomStrategies(data.customStrategies);
        if (data.selectedResources) setSelectedResources(data.selectedResources);
        if (data.customResources) setCustomResources(data.customResources);
        
        setGoals(data.goals || '');
        setPriorKnowledge(data.priorKnowledge || data.portfolio || '');
        setWarmup(data.warmup || '');
        setStrategy(data.strategy || '');
        setContent(data.content || '');
        setResources(data.resources || '');
        setStem(data.stem || '');
        setPortfolio(data.portfolio || '');
        setFormativeEval(data.formativeEval || '');
        setSummativeEval(data.summativeEval || '');
        setHomework(data.homework || '');
        setFileUrl(data.fileUrl || '');
        setFileName(data.fileName || '');
        setPrepDocId(snapshot.docs[0].id);
      } else {
        setPrepDocId(null);
      }
    });
    return () => unsub();
  }, [selectedClass, selectedSubject, teacherDocId, selectedWeek, selectedPeriod]);

  // Handle File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `preparations/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFileUrl(url);
      setFileName(file.name);
      alert('✓ تم رفع المرفق بنجاح!');
    } catch (error) {
      console.error('Upload Error:', error);
      alert('حدث خطأ أثناء رفع الملف');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Save Preparation
  const handleSave = async () => {
    if (!auth.currentUser) return alert('يرجى تسجيل الدخول');
    if (!selectedClass || !selectedSubject) return alert('يرجى اختيار الفصل والمادة');
    if (!selectedPeriod) return alert('يرجى اختيار الحصة');
    
    setIsSaving(true);
    try {
      const effectiveLessonName = isCustomLesson 
        ? customLessonTitle.trim() 
        : (selectedLesson || customLessonTitle || 'تحضير الدرس');

      const payload = {
        teacherId: teacherDocId || userData?.nationalId || auth.currentUser.uid,
        teacherName: userData?.name || 'معلم',
        teacherNationalId: userData?.nationalId || '',
        teacherEmail: auth.currentUser.email,
        schoolId: userData?.schoolId || 'default_school_1',
        curriculumType: curriculumType,
        stage: selectedStage,
        semester: selectedSemester,
        className: selectedClass,
        subject: selectedSubject,
        lessonTitle: effectiveLessonName,
        selectedObjectives,
        customObjectives,
        selectedStrategies,
        customStrategies,
        selectedResources,
        customResources,
        week: selectedWeek,
        date: selectedDate,
        period: selectedPeriod,
        goals,
        priorKnowledge,
        warmup,
        strategy,
        resources,
        stem,
        content,
        portfolio,
        formativeEval,
        summativeEval,
        homework,
        fileUrl,
        fileName,
        updatedAt: new Date().toISOString()
      };

      if (prepDocId) {
        await updateDoc(doc(db, 'preparations', prepDocId), payload);
      } else {
        const docRef = await addDoc(collection(db, 'preparations'), payload);
        setPrepDocId(docRef.id);
      }
      alert('✓ تم حفظ واعتماد بطاقة تحضير الدرس بدقة بنجاح!');
    } catch (error) {
      console.error("Error saving prep:", error);
      alert('حدث خطأ أثناء حفظ التحضير');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التحضير نهائياً؟')) {
      try {
        await deleteDoc(doc(db, 'preparations', id));
        alert('تم حذف التحضير بنجاح');
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  // Handle Edit from List
  const handleEdit = (prep) => {
    if (prep.semester) setSelectedSemester(prep.semester);
    if (prep.stage) setSelectedStage(prep.stage);
    setSelectedClass(prep.className);
    setSelectedSubject(prep.subject);
    setSelectedWeek(prep.week);
    setSelectedDate(prep.date);
    if (prep.lessonTitle) {
      setSelectedLesson(prep.lessonTitle);
      setCustomLessonTitle(prep.lessonTitle);
    }
    if (prep.selectedObjectives) setSelectedObjectives(prep.selectedObjectives);
    if (prep.customObjectives) setCustomObjectives(prep.customObjectives);
    if (prep.selectedStrategies) setSelectedStrategies(prep.selectedStrategies);
    if (prep.customStrategies) setCustomStrategies(prep.customStrategies);
    if (prep.selectedResources) setSelectedResources(prep.selectedResources);
    if (prep.customResources) setCustomResources(prep.customResources);
    
    setGoals(prep.goals || '');
    setPriorKnowledge(prep.priorKnowledge || prep.portfolio || '');
    setWarmup(prep.warmup || '');
    setStrategy(prep.strategy || '');
    setContent(prep.content || '');
    setResources(prep.resources || '');
    setStem(prep.stem || '');
    setPortfolio(prep.portfolio || '');
    setFormativeEval(prep.formativeEval || '');
    setSummativeEval(prep.summativeEval || '');
    setHomework(prep.homework || '');
    setFileUrl(prep.fileUrl || '');
    setFileName(prep.fileName || '');
    setPrepDocId(prep.id);

    setTimeout(() => {
      setSelectedPeriod(prep.period);
    }, 400);
    setActiveTab('form');
  };

  // Open Worksheet Modal for current preparation or specific prep
  const handleOpenWorksheet = async (prep = null) => {
    const effLesson = isCustomLesson 
      ? customLessonTitle.trim() 
      : (selectedLesson || customLessonTitle || '');

    const targetPrep = prep || {
      id: prepDocId,
      lessonTitle: effLesson,
      subject: selectedSubject,
      className: selectedClass,
      stage: selectedStage,
      semester: selectedSemester,
      selectedObjectives,
      customObjectives,
      goals,
      date: selectedDate,
      period: selectedPeriod,
      week: selectedWeek,
      schoolId: userData?.schoolId || 'default_school_1'
    };

    if (!targetPrep.lessonTitle) {
      alert('يرجى اختيار أو كتابة اسم الدرس أولاً لإنشاء ورقة العمل');
      return;
    }

    setSelectedWorksheetPrep(targetPrep);

    try {
      let qWs = null;
      if (targetPrep.id) {
        qWs = query(collection(db, 'worksheets'), where('prepId', '==', targetPrep.id));
      } else {
        qWs = query(
          collection(db, 'worksheets'),
          where('lessonTitle', '==', targetPrep.lessonTitle),
          where('subject', '==', targetPrep.subject || ''),
          where('className', '==', targetPrep.className || '')
        );
      }
      const snap = await getDocs(qWs);
      if (!snap.empty) {
        setExistingWorksheetData({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setExistingWorksheetData(null);
      }
    } catch (err) {
      console.error('Error fetching existing worksheet:', err);
      setExistingWorksheetData(null);
    }

    setWorksheetModalOpen(true);
  };

  const availableStages = curriculumType === CURRICULUM_TYPES.AMERICAN
    ? [AMERICAN_STAGES.ELEMENTARY, AMERICAN_STAGES.MIDDLE, AMERICAN_STAGES.HIGH]
    : [SAUDI_STAGES.PRIMARY, SAUDI_STAGES.INTERMEDIATE, SAUDI_STAGES.SECONDARY];

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      
      {/* Top Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className={`btn ${activeTab === 'form' ? 'btn-primary' : ''}`}
            style={{ 
              background: activeTab === 'form' ? 'linear-gradient(135deg, #0e7490, #63B2C6)' : 'transparent', 
              color: activeTab === 'form' ? 'white' : 'var(--color-text)',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('form')}
          >
            <Edit size={17} /> إعداد وتعديل التحضير
          </button>
          <button 
            className={`btn ${activeTab === 'list' ? 'btn-primary' : ''}`}
            style={{ 
              background: activeTab === 'list' ? 'linear-gradient(135deg, #0e7490, #63B2C6)' : 'transparent', 
              color: activeTab === 'list' ? 'white' : 'var(--color-text)',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('list')}
          >
            <BookOpen size={17} /> سجل التحاضير السابقة ({allPreparations.length})
          </button>
        </div>

        {/* Curriculum Badge / Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isInternationalSchool ? (
            <span style={{
              background: 'rgba(14, 116, 144, 0.12)',
              color: '#0e7490',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Globe size={15} /> المنهج الأمريكي المعتمد (CCSS & NGSS)
            </span>
          ) : (
            <span style={{
              background: 'rgba(22, 163, 74, 0.12)',
              color: '#16a34a',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🇸🇦 المنهج الوطني والأهلي السعودي
            </span>
          )}

          {schoolData?.curriculumType === CURRICULUM_TYPES.DUAL && (
            <select
              className="input-field"
              style={{ width: '160px', marginBottom: 0, padding: '4px 8px', fontSize: '12px' }}
              value={curriculumType}
              onChange={(e) => setCurriculumType(e.target.value)}
            >
              <option value={CURRICULUM_TYPES.SAUDI}>المنهج الوطني</option>
              <option value={CURRICULUM_TYPES.AMERICAN}>المنهج الأمريكي</option>
            </select>
          )}
        </div>
      </div>

      {activeTab === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* STEP 1: Semester & Stage Selection */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
            border: '1px solid #cbd5e1',
            borderRadius: '14px',
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* 1.1 Semester Selection (2 Semesters only) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0e7490', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <Compass size={18} /> الخطوة 1: الفصل الدراسي (نظام الفصلين الدراسيين المعتمد)
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  اختر الفصل الدراسي الأول أو الثاني
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {SEMESTERS.map(sem => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSelectedSemester(sem)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: selectedSemester === sem ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: selectedSemester === sem ? 'linear-gradient(135deg, #0e7490, #63B2C6)' : 'white',
                      color: selectedSemester === sem ? 'white' : '#334155',
                      boxShadow: selectedSemester === sem ? '0 4px 12px rgba(14, 116, 144, 0.25)' : 'none'
                    }}
                  >
                    {sem}
                  </button>
                ))}
              </div>
            </div>

            {/* 1.2 Stage Selection (Strict Separation) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <GraduationCap size={18} color="#0e7490" /> المرحلة التعليمية (فصل تام للمناهج والدروس)
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  تُحدد تلقائياً بحسب الصف أو يمكنك اختيارها لعرض الدروس المتطابقة تماماً مع مرحلتك
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {availableStages.map(stg => {
                  const isSelected = selectedStage === stg;
                  return (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => setSelectedStage(stg)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        border: isSelected ? '2px solid #0e7490' : '1px solid #cbd5e1',
                        background: isSelected ? '#0e7490' : 'white',
                        color: isSelected ? 'white' : '#475569',
                        boxShadow: isSelected ? '0 2px 8px rgba(14, 116, 144, 0.25)' : 'none'
                      }}
                    >
                      {isSelected ? '✓ ' : ''}{stg}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 2: Main Filter Bar (Class, Subject, Week, Date, Period) */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#0e7490" /> الخطوة 2: تحديد بيانات الحصة والصف والمادة
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'end' }}>
              
              {/* Class Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                  الفصل المسند في الجدول
                </label>
                <select 
                  className="input-field" 
                  style={{ width: '100%', marginBottom: 0, fontWeight: 'bold', color: '#0e7490' }}
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">-- اختر الفصل المسند --</option>
                  {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Subject Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                  المادة المسندة في هذا الفصل
                </label>
                <select 
                  className="input-field" 
                  style={{ width: '100%', marginBottom: 0, fontWeight: 'bold', color: '#0e7490' }}
                  value={selectedSubject} 
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                  <option value="">-- اختر المادة المسندة --</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Week Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                  الأسبوع
                </label>
                <select 
                  className="input-field" 
                  style={{ width: '100%', marginBottom: 0 }}
                  value={selectedWeek} 
                  onChange={(e) => setSelectedWeek(e.target.value)}
                >
                  {weeks.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              {/* Date Input */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                  تاريخ التحضير
                </label>
                <input 
                  type="date"
                  className="input-field" 
                  style={{ width: '100%', marginBottom: 0 }}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              {/* Period Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                  الحصة الدراسية
                </label>
                <select 
                  className="input-field" 
                  style={{ width: '100%', marginBottom: 0 }}
                  value={selectedPeriod} 
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">اختر الحصة...</option>
                  {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Save Prep Button */}
              <div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSave} 
                  disabled={isSaving || !selectedClass || !selectedSubject || !selectedPeriod}
                  style={{
                    width: '100%',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                    boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)'
                  }}
                >
                  <Save size={18} /> {isSaving ? 'جاري الحفظ...' : 'حفظ واعتماد التحضير'}
                </button>
              </div>

            </div>

            {classesList.length === 0 && (
              <div style={{ marginTop: '16px', padding: '14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', color: '#b45309', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="#d97706" />
                <span>لم يتم العثور على فصول مسندة لك في الجدول المدرسي حتى الآن. يرجى مراجعة إدارة المدرسة لاعتماد وإسناد جدولك الدراسي.</span>
              </div>
            )}
          </div>

          {!selectedClass || !selectedSubject ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <BookOpen size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '15px', margin: 0 }}>
                يرجى اختيار الصف والمادة للبدء في استعراض الدروس وتحضير الحصة
              </p>
            </div>
          ) : (
            <>
              {/* STEP 3: Strict Lesson Selection */}
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={18} color="#0e7490" /> الخطوة 3: اختيار الدرس المعتمد لمادة ({selectedSubject}) • ({selectedStage} • {selectedSemester})
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      الدروس مفصولة ومصنفة بدقة تامة حسب المادة والصف لمنع أي تداخل
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowAllStageLessons(prev => !prev)}
                      style={{
                        background: showAllStageLessons ? '#eff6ff' : '#f8fafc',
                        border: showAllStageLessons ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                        color: showAllStageLessons ? '#1d4ed8' : '#64748b',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Layers size={14} />
                      {showAllStageLessons ? '✓ عرض جميع المواد (مصنفة)' : 'تصفح كافة مواد المرحلة'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomLesson(prev => !prev);
                        if (!isCustomLesson) setSelectedLesson('');
                      }}
                      style={{
                        background: isCustomLesson ? '#f0fdf4' : '#f1f5f9',
                        border: isCustomLesson ? '1px solid #86efac' : '1px solid #cbd5e1',
                        color: isCustomLesson ? '#16a34a' : '#475569',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {isCustomLesson ? '✓ إدخال درس يدوي مفعل' : '+ كتابة عنوان درس مخصص'}
                    </button>
                  </div>
                </div>

                {!isCustomLesson ? (
                  <div>
                    {(() => {
                      const grouped = groupLessonsBySubject(availableLessons);
                      const groupEntries = Object.entries(grouped);

                      return (
                        <select
                          className="input-field"
                          style={{ width: '100%', marginBottom: '8px', fontWeight: 'bold', color: '#0e7490', fontSize: '13px' }}
                          value={selectedLesson}
                          onChange={handleLessonChange}
                        >
                          <option value="">
                            {showAllStageLessons 
                              ? `-- اختر الدرس من قائمة كافة المواد المعتمدة لـ ${selectedStage} --`
                              : `-- اختر الدرس من قائمة الدروس المعتمدة لـ ${selectedSubject || selectedStage} --`
                            }
                          </option>

                          {groupEntries.map(([subjName, lessonsList]) => (
                            <optgroup key={subjName} label={`📚 مادة: ${subjName} (${lessonsList.length} دروس)`}>
                              {lessonsList.map((l, i) => (
                                <option key={i} value={l.displayTitle}>
                                  {l.lesson} ({l.unit} - {l.grade})
                                </option>
                              ))}
                            </optgroup>
                          ))}

                          <option value="__CUSTOM__">✍️ درس آخر (إدخال عنوان يدوي مخصص)...</option>
                        </select>
                      );
                    })()}

                    {availableLessons.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#d97706', margin: '4px 0 0 0' }}>
                        💡 لم يتم العثور على دروس محددة مسبقاً لمادة ({selectedSubject}) في ({selectedStage})، يمكنك تفعيل "كتابة عنوان درس مخصص" أو النقر على "تصفح كافة مواد المرحلة".
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="أدخل عنوان الدرس المخصص هنا..."
                      style={{ width: '100%', marginBottom: 0, fontWeight: 'bold' }}
                      value={customLessonTitle}
                      onChange={(e) => setCustomLessonTitle(e.target.value)}
                    />
                  </div>
                )}

                {/* AI Worksheet Instant Button (Activated upon lesson selection or entry) */}
                <div style={{
                  marginTop: '14px',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(14, 116, 144, 0.05) 100%)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="#7c3aed" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                        ورقة عمل الدرس التفاعلية (AI)
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {(selectedLesson || customLessonTitle) 
                          ? `جاهز لتوليد ورقة عمل لـ: ${isCustomLesson ? customLessonTitle : (selectedLesson || customLessonTitle)}`
                          : 'اكتب اسم الدرس أو اختره لتوليد ورقة عمل ذكية متطابقة مع أهدافك'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenWorksheet()}
                    disabled={!(selectedLesson || customLessonTitle)}
                    style={{
                      background: (selectedLesson || customLessonTitle) 
                        ? 'linear-gradient(135deg, #7c3aed, #9333ea)' 
                        : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: (selectedLesson || customLessonTitle) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: (selectedLesson || customLessonTitle) ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none'
                    }}
                  >
                    <Sparkles size={16} /> ✨ إنشاء ورقة عمل للدرس (AI)
                  </button>
                </div>
              </div>

              {/* STEP 4: Objectives Selection & Manual Addition */}
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} color="#0e7490" /> الخطوة 4: الأهداف السلوكية للدرس (إضافة وصياغة الأهداف يدوياً)
                  </div>

                  {lessonObjectives.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedObjectives([...lessonObjectives])}
                        style={{ fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedObjectives([])}
                        style={{ fontSize: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  )}
                </div>

                {/* Standard Objectives from Curriculum (if any) */}
                {lessonObjectives.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {lessonObjectives.map((obj, i) => {
                      const isChecked = selectedObjectives.includes(obj);
                      return (
                        <div
                          key={i}
                          onClick={() => toggleObjective(obj)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: isChecked ? '#f0fdfa' : '#f8fafc',
                            border: isChecked ? '1px solid #5eead4' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isChecked ? <CheckSquare size={18} color="#0e7490" style={{ flexShrink: 0, marginTop: '2px' }} /> : <Square size={18} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />}
                          <span style={{ fontSize: '13px', color: isChecked ? '#0f172a' : '#64748b', fontWeight: isChecked ? '500' : 'normal', lineHeight: '1.6' }}>
                            {obj}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {lessonObjectives.length === 0 && customObjectives.length === 0 && (
                  <div style={{ padding: '14px 18px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#64748b', fontSize: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Target size={20} color="#0e7490" />
                    <span>الأهداف السلوكية فارغة لتتيح لك صياغة أهدافك الخاصة بحرية. أضف أهدافك عبر الخانة أدناه أو اكتبها مباشرة في حقل الأهداف بالأسفل.</span>
                  </div>
                )}

                {/* Custom Objectives Added List */}
                {customObjectives.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>
                      الأهداف المضافة يدوياً ({customObjectives.length}):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {customObjectives.map((cGoal, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '13px' }}>
                          <span>✦ {cGoal}</span>
                          <button type="button" onClick={() => handleRemoveCustomGoal(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Custom Objective Input */}
                <form onSubmit={handleAddCustomGoal} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="اكتب هدفاً سلوكياً إضافياً (مثال: أن يستنتج الطالب العلاقة بين...)"
                    style={{ flex: 1, marginBottom: 0, fontSize: '13px' }}
                    value={newGoalInput}
                    onChange={(e) => setNewGoalInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newGoalInput.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={16} /> إضافة الهدف
                  </button>
                </form>

                {/* AI Worksheet Generation based on objectives */}
                <div style={{
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px dashed #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    💡 الأهداف المحددة حالياً: <strong>{selectedObjectives.length + customObjectives.length} أهداف</strong> (سيقوم الذكاء الاصطناعي بربط الأسئلة بها مباشرة)
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenWorksheet()}
                    disabled={!(selectedLesson || customLessonTitle)}
                    style={{
                      background: (selectedLesson || customLessonTitle) 
                        ? 'linear-gradient(135deg, #0e7490, #63B2C6)' 
                        : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: (selectedLesson || customLessonTitle) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: (selectedLesson || customLessonTitle) ? '0 4px 12px rgba(14, 116, 144, 0.25)' : 'none'
                    }}
                  >
                    <Sparkles size={16} /> ✨ توليد ورقة عمل بالذكاء الاصطناعي مبنية على هذه الأهداف
                  </button>
                </div>
              </div>

              {/* STEP 5: Teaching Strategies (Popular List + Manual Addition) */}
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={18} color="#0e7490" /> الخطوة 5: استراتيجيات التدريس النشط وإمكانية الإضافة اليدوية
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      انقر على الاستراتيجية لتحديدها وتضمينها فوراً في خطة التحضير
                    </p>
                  </div>

                  <span style={{ fontSize: '12px', color: '#0e7490', fontWeight: 'bold' }}>
                    تم تحديد: {selectedStrategies.length + customStrategies.length} استراتيجية
                  </span>
                </div>

                {/* Strategy Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  {POPULAR_TEACHING_STRATEGIES.map(strat => {
                    const isSelected = selectedStrategies.includes(strat.nameAr);
                    return (
                      <div
                        key={strat.id}
                        onClick={() => toggleStrategy(strat.nameAr)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #0e7490' : '1px solid #e2e8f0',
                          background: isSelected ? 'linear-gradient(135deg, #f0fdfa, #e0f2fe)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          boxShadow: isSelected ? '0 2px 8px rgba(14, 116, 144, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '13px', color: isSelected ? '#0e7490' : '#1e293b' }}>
                            {strat.nameAr}
                          </span>
                          {isSelected ? <CheckCircle2 size={16} color="#0e7490" /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                          {strat.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Strategies Added */}
                {customStrategies.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>
                      الاستراتيجيات المضافة يدوياً:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {customStrategies.map((cStrat, idx) => (
                        <span key={idx} style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {cStrat}
                          <button type="button" onClick={() => handleRemoveCustomStrategy(idx)} style={{ background: 'transparent', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0 }}>
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Custom Strategy Form */}
                <form onSubmit={handleAddCustomStrategy} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="إضافة استراتيجية تدريس مخصصة..."
                    style={{ flex: 1, marginBottom: 0, fontSize: '13px' }}
                    value={newStrategyInput}
                    onChange={(e) => setNewStrategyInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newStrategyInput.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={16} /> إضافة استراتيجية
                  </button>
                </form>
              </div>

              {/* STEP 6: Learning Resources & Educational Media */}
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Laptop size={18} color="#0e7490" /> الخطوة 6: الوسائل والتقنيات ومصادر التعلم وإمكانية الإضافة اليدوية
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      حدد مصادر التعلم والوسائل التقنية المستخدمة في الحصة لإدراجها في بطاقة التحضير
                    </p>
                  </div>

                  <span style={{ fontSize: '12px', color: '#0e7490', fontWeight: 'bold' }}>
                    تم تحديد: {selectedResources.length + customResources.length} مصدر تعليمي
                  </span>
                </div>

                {/* Resources Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  {POPULAR_LEARNING_RESOURCES.map(res => {
                    const isSelected = selectedResources.includes(res.nameAr);
                    return (
                      <div
                        key={res.id}
                        onClick={() => toggleResource(res.nameAr)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #0e7490' : '1px solid #e2e8f0',
                          background: isSelected ? 'linear-gradient(135deg, #f0fdfa, #e0f2fe)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          boxShadow: isSelected ? '0 2px 8px rgba(14, 116, 144, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '13px', color: isSelected ? '#0e7490' : '#1e293b' }}>
                            {res.nameAr}
                          </span>
                          {isSelected ? <CheckCircle2 size={16} color="#0e7490" /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                          {res.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Resources Added */}
                {customResources.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>
                      مصادر التعلم المضافة يدوياً:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {customResources.map((cRes, idx) => (
                        <span key={idx} style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {cRes}
                          <button type="button" onClick={() => handleRemoveCustomResource(idx)} style={{ background: 'transparent', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0 }}>
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Custom Resource Form */}
                <form onSubmit={handleAddCustomResource} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="إضافة مصدر تعلم أو وسيلة تعليمية مخصصة..."
                    style={{ flex: 1, marginBottom: 0, fontSize: '13px' }}
                    value={newResourceInput}
                    onChange={(e) => setNewResourceInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!newResourceInput.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={16} /> إضافة مصدر
                  </button>
                </form>
              </div>

              {/* STEP 7: File Attachments */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                    إرفاق ملف التحضير أو ورقة العمل (PDF / صور)
                  </label>
                  <input type="file" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileUpload} disabled={isUploading} />
                </div>
                {isUploading && <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>جاري الرفع...</div>}
                {fileUrl && (
                  <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}>
                    المرفق الحالي: <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0369a1', fontWeight: 'bold', textDecoration: 'underline' }}>{fileName}</a>
                  </div>
                )}
              </div>

              {/* STEP 8: Full Markdown Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                <MarkdownInput 
                  label="الأهداف التعليمية والسلوكية" 
                  value={goals} 
                  onChange={setGoals} 
                  placeholder="اكتب الأهداف السلوكية والإجرائية للدرس هنا..." 
                  height="160px" 
                />

                <MarkdownInput 
                  label="حقبنة: ربط معارف الدرس بالمعارف السابقة للدرس (الخبرات السابقة)" 
                  value={priorKnowledge} 
                  onChange={setPriorKnowledge} 
                  placeholder="تحديد المفاهيم والمهارات القبلية التي يبنى عليها الدرس الجديد، وربطها بالخبرات السابقة وتطبيقات الحياة اليومية..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="التمهيد والتهيئة الحافزة" 
                  value={warmup} 
                  onChange={setWarmup} 
                  placeholder="طرح تساؤل مثير للتفكير، قصة قصيرة، أو عرض مقطع مرئي تهيئةً للدرس..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="استراتيجيات التدريس المتبعة" 
                  value={strategy} 
                  onChange={setStrategy} 
                  placeholder="استراتيجيات التدريس المحددة..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="الوسائل والتقنيات ومصادر التعلم" 
                  value={resources} 
                  onChange={setResources} 
                  placeholder="السبورة الذكية، منصة مدرستي، أوراق العمل، العروض التقديمية..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="أنشطة وتطبيقات نظام STEM (العلوم، التقنية، الهندسة، الرياضيات)" 
                  value={stem} 
                  onChange={setStem} 
                  placeholder="تكامل العلوم والتقنية والهندسة والرياضيات: الأنشطة التطبيقية، النمذجة الهندسية، والتطبيقات الحياتية المعاصرة المرتبطة بموضوع الدرس..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="المحتوى والإجراءات التعليمية" 
                  value={content} 
                  onChange={setContent} 
                  placeholder="خطوات سير الدرس والشرح والأنشطة الصفية..." 
                  height="250px" 
                />

                <MarkdownInput 
                  label="ملف الإنجاز والمخرجات المتوقعة" 
                  value={portfolio} 
                  onChange={setPortfolio} 
                  placeholder="المخرجات والمهام التي سينجزها الطلاب..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="التقويم المرحلي التكويني" 
                  value={formativeEval} 
                  onChange={setFormativeEval} 
                  placeholder="الأسئلة والأنشطة للتأكد من فهم كل هدف خلال الحصة..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="التقويم الختامي النهائي" 
                  value={summativeEval} 
                  onChange={setSummativeEval} 
                  placeholder="التطبيق الختامي أو ورقة الدقيقة الواحدة في نهاية الدرس..." 
                  height="140px" 
                />

                <MarkdownInput 
                  label="الواجبات والأنشطة الإثرائية" 
                  value={homework} 
                  onChange={setHomework} 
                  placeholder="الواجبات المنزلية والمهام الإثرائية للطلاب..." 
                  height="140px" 
                />

              </div>

              {/* Bottom Save Bar */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '16px 24px',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {prepDocId ? '✏️ تعديل تحضير محفوظ مسبقاً' : '✨ تحضير جديد جاهز للحفظ'}
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={handleSave} 
                  disabled={isSaving || !selectedClass || !selectedSubject || !selectedPeriod}
                  style={{
                    padding: '10px 28px',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #0e7490, #63B2C6)'
                  }}
                >
                  <Save size={18} /> {isSaving ? 'جاري الحفظ...' : 'حفظ واعتماد بطاقة التحضير'}
                </button>
              </div>
            </>
          )}

        </div>
      )}

      {/* Preparations Record Tab */}
      {activeTab === 'list' && (
        <div>
          {allPreparations.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '50px 20px', background: '#f8fafc', borderRadius: '12px' }}>
              لا توجد تحاضير محفوظة حتى الآن.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {allPreparations.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
                        {p.lessonTitle ? `${p.lessonTitle} - ` : ''}{p.subject}
                      </h3>
                      <span style={{ background: '#f0fdfa', color: '#0e7490', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        {p.className}
                      </span>
                      {p.stage && (
                        <span style={{ background: '#f8fafc', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                          {p.stage}
                        </span>
                      )}
                      {p.semester && (
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                          {p.semester}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--color-text-muted)', fontSize: '13px', flexWrap: 'wrap' }}>
                      <span>🗓️ {p.week}</span>
                      <span>📅 {p.date}</span>
                      <span>⏰ {p.period}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      className="btn" 
                      style={{ 
                        padding: '8px 14px', 
                        background: p.hasWorksheet ? '#ecfdf5' : '#f5f3ff', 
                        color: p.hasWorksheet ? '#047857' : '#7c3aed', 
                        border: `1px solid ${p.hasWorksheet ? '#a7f3d0' : '#ddd6fe'}`,
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }} 
                      onClick={() => handleOpenWorksheet(p)} 
                      title="ورقة عمل الدرس (AI)"
                    >
                      <Sparkles size={15} /> {p.hasWorksheet ? '📄 ورقة العمل' : '✨ ورقة عمل'}
                    </button>
                    <button className="btn" style={{ padding: '8px 14px', background: '#0e7490', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }} onClick={() => setPrintingPrep(p)} title="طباعة التحضير (PDF)">
                      <Printer size={16} /> طباعة (PDF)
                    </button>
                    <button className="btn" style={{ padding: '8px', background: '#e0f2fe', color: '#0284c7' }} onClick={() => setPreviewPrep(p)} title="معاينة">
                      <Eye size={18} />
                    </button>
                    <button className="btn" style={{ padding: '8px', background: '#fef3c7', color: '#d97706' }} onClick={() => handleEdit(p)} title="تعديل">
                      <Edit size={18} />
                    </button>
                    <button className="btn" style={{ padding: '8px', background: '#fee2e2', color: '#dc2626' }} onClick={() => handleDelete(p.id)} title="حذف">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewPrep && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: '#fff', width: '90%', maxWidth: '900px', maxHeight: '90vh',
            borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h2 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '18px' }}>
                معاينة بطاقة تحضير {previewPrep.lessonTitle ? `[${previewPrep.lessonTitle}] - ` : ''}{previewPrep.subject} - {previewPrep.className}
              </h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    background: '#f5f3ff',
                    color: '#7c3aed',
                    border: '1px solid #ddd6fe',
                    fontWeight: 'bold'
                  }}
                  onClick={() => handleOpenWorksheet(previewPrep)}
                >
                  <Sparkles size={16} /> 📄 ورقة عمل الدرس
                </button>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '13px', background: 'linear-gradient(135deg, #0e7490, #63B2C6)' }}
                  onClick={() => setPrintingPrep(previewPrep)}
                >
                  <Printer size={16} /> طباعة التحضير (PDF)
                </button>
                <button className="btn" style={{ padding: '8px', background: 'transparent' }} onClick={() => setPreviewPrep(null)}>
                  <X size={24} color="#64748b" />
                </button>
              </div>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', gap: '24px', color: 'var(--color-text-muted)', fontWeight: 'bold', fontSize: '13px', flexWrap: 'wrap' }}>
                {previewPrep.stage && <span>🏫 {previewPrep.stage}</span>}
                {previewPrep.semester && <span>📚 {previewPrep.semester}</span>}
                <span>🗓️ {previewPrep.week}</span>
                <span>⏰ {previewPrep.period}</span>
                <span>📅 {previewPrep.date}</span>
              </div>

              {previewPrep.fileUrl && (
                <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '12px 16px', borderRadius: '8px' }}>
                  <strong>الملف المرفق:</strong> <a href={previewPrep.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>{previewPrep.fileName}</a>
                </div>
              )}

              {['goals', 'priorKnowledge', 'warmup', 'strategy', 'resources', 'stem', 'content', 'portfolio', 'formativeEval', 'summativeEval', 'homework'].map(field => {
                const titles = {
                  goals: 'الأهداف التعليمية والسلوكية',
                  priorKnowledge: 'حقبنة: ربط معارف الدرس بالمعارف السابقة للدرس',
                  warmup: 'التمهيد والتهيئة الحافزة',
                  strategy: 'استراتيجيات التدريس المتبعة',
                  resources: 'الوسائل والتقنيات ومصادر التعلم',
                  stem: 'أنشطة وتطبيقات نظام STEM (العلوم، التقنية، الهندسة، الرياضيات)',
                  content: 'المحتوى والإجراءات التعليمية',
                  portfolio: 'ملف الإنجاز والمخرجات المتوقعة',
                  formativeEval: 'التقويم المرحلي التكويني',
                  summativeEval: 'التقويم الختامي النهائي',
                  homework: 'الواجبات والأنشطة الإثرائية'
                };
                if (!previewPrep[field]) return null;
                return (
                  <div key={field}>
                    <h4 style={{ color: 'var(--color-secondary-dark)', margin: '0 0 8px 0', fontSize: '14px' }}>{titles[field]}:</h4>
                    <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <MarkdownViewer content={previewPrep[field]} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printingPrep && (
        <PrintLessonPreparationModal prep={printingPrep} onClose={() => setPrintingPrep(null)} />
      )}

      {/* Lesson Worksheet Modal */}
      {worksheetModalOpen && (
        <LessonWorksheetModal
          isOpen={worksheetModalOpen}
          onClose={() => setWorksheetModalOpen(false)}
          prepData={selectedWorksheetPrep}
          existingWorksheet={existingWorksheetData}
          userRole="teacher"
          onSaveSuccess={(savedWs) => {
            setExistingWorksheetData(savedWs);
          }}
        />
      )}
    </div>
  );
}
