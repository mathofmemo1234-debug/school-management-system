import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import MarkdownViewer from '../components/MarkdownViewer';
import { useLanguage } from '../contexts/LanguageContext';
import { Printer, Search, BookOpen, User, Calendar, Sparkles, Filter, RefreshCw, CheckCircle2, Layers } from 'lucide-react';
import PrintLessonPreparationModal from '../components/PrintLessonPreparationModal';

export default function AdminPreparations({ schoolId }) {
  const { t } = useLanguage();
  const [preparations, setPreparations] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [teachersList, setTeachersList] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [printingPrep, setPrintingPrep] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  const targetSchoolId = schoolId || 'default_school_1';

  // 1. Fetch classes in real-time
  useEffect(() => {
    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', targetSchoolId));

    const unsub = onSnapshot(qClasses, (snap) => {
      let docs = snap.docs.map(doc => doc.data());
      let names = Array.from(new Set(docs.map(d => d.name || d.className).filter(Boolean)));
      
      // Fallback: If no classes found for specific schoolId, load all classes
      if (names.length === 0 && schoolId !== 'ALL') {
        getDocs(collection(db, 'classes')).then(allSnap => {
          const allNames = Array.from(new Set(allSnap.docs.map(d => d.data().name || d.data().className).filter(Boolean)));
          setClassesList(allNames);
        });
      } else {
        setClassesList(names);
      }
    });
    return () => unsub();
  }, [schoolId, targetSchoolId]);

  // 2. Fetch teachers for name & nationalId mapping in real-time
  useEffect(() => {
    const qTeachers = schoolId === 'ALL'
      ? collection(db, 'teachers')
      : query(collection(db, 'teachers'), where('schoolId', '==', targetSchoolId));

    const unsub = onSnapshot(qTeachers, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = data.name;
        if (data.nationalId) map[data.nationalId] = data.name;
        if (data.email) map[data.email] = data.name;
      });

      // Fallback if empty
      if (Object.keys(map).length === 0 && schoolId !== 'ALL') {
        getDocs(collection(db, 'teachers')).then(allSnap => {
          const allMap = {};
          allSnap.docs.forEach(d => {
            const data = d.data();
            allMap[d.id] = data.name;
            if (data.nationalId) allMap[data.nationalId] = data.name;
            if (data.email) allMap[data.email] = data.name;
          });
          setTeachersList(allMap);
        });
      } else {
        setTeachersList(map);
      }
    });
    return () => unsub();
  }, [schoolId, targetSchoolId]);

  // 3. Fetch preparations in real-time (with 100% permeability & fallback merging)
  useEffect(() => {
    setIsLiveConnected(true);
    
    // Listen to primary preparations collection
    const qPreps = schoolId === 'ALL'
      ? collection(db, 'preparations')
      : query(collection(db, 'preparations'), where('schoolId', '==', targetSchoolId));

    const unsubPreps = onSnapshot(qPreps, (snap) => {
      const primaryData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Also listen to legacy lesson_preparations for total permeability
      const qLegacy = schoolId === 'ALL'
        ? collection(db, 'lesson_preparations')
        : query(collection(db, 'lesson_preparations'), where('schoolId', '==', targetSchoolId));

      getDocs(qLegacy).then(legacySnap => {
        const legacyData = legacySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Merge without duplicates
        const combinedMap = new Map();
        [...primaryData, ...legacyData].forEach(item => {
          combinedMap.set(item.id, item);
        });

        const merged = Array.from(combinedMap.values());
        merged.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        setPreparations(merged);
      }).catch(() => {
        primaryData.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        setPreparations(primaryData);
      });
    }, (err) => {
      console.error("Error subscribing to preparations:", err);
      setIsLiveConnected(false);
    });

    return () => unsubPreps();
  }, [schoolId, targetSchoolId]);

  // Dynamic Filtering Logic
  const filtered = useMemo(() => {
    return preparations.filter(p => {
      // 1. Class filter
      if (selectedClass && p.className !== selectedClass && p.class !== selectedClass && p.targetClass !== selectedClass) {
        return false;
      }

      // 2. Teacher filter
      if (selectedTeacher) {
        const matchTeacher = 
          p.teacherId === selectedTeacher || 
          p.teacherNationalId === selectedTeacher ||
          p.teacherName === teachersList[selectedTeacher] ||
          (teachersList[selectedTeacher] && p.teacherName && p.teacherName.includes(teachersList[selectedTeacher]));
        if (!matchTeacher) return false;
      }

      // 3. Semester filter
      if (selectedSemester && p.semester && p.semester !== selectedSemester) {
        return false;
      }

      // 4. Search Query filter (lessonTitle, subject, teacherName, content, week)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = (p.lessonTitle || '').toLowerCase().includes(q);
        const subjMatch = (p.subject || '').toLowerCase().includes(q);
        const teacherMatch = (p.teacherName || teachersList[p.teacherId] || '').toLowerCase().includes(q);
        const classMatch = (p.className || p.class || '').toLowerCase().includes(q);
        const weekMatch = (p.week || '').toLowerCase().includes(q);
        const goalsMatch = (p.goals || '').toLowerCase().includes(q);
        if (!titleMatch && !subjMatch && !teacherMatch && !classMatch && !weekMatch && !goalsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [preparations, selectedClass, selectedTeacher, selectedSemester, searchQuery, teachersList]);

  // Extract unique semesters
  const availableSemesters = useMemo(() => {
    return Array.from(new Set(preparations.map(p => p.semester).filter(Boolean)));
  }, [preparations]);

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      
      {/* Header with Title & Real-time Live Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen /> {t('adminPreparations.title')} ({filtered.length})
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            متابعة واعتماد كافة بطاقات تحضير الدروس للمواد والصفوف فور إدخالها من المعلمين
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: isLiveConnected ? '#ecfdf5' : '#fffbeb',
            color: isLiveConnected ? '#059669' : '#b45309',
            border: `1px solid ${isLiveConnected ? '#a7f3d0' : '#fde68a'}`,
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isLiveConnected ? '#10b981' : '#f59e0b',
              boxShadow: isLiveConnected ? '0 0 8px #10b981' : 'none'
            }} />
            <span>⚡ متصل لحظياً بقاعدة البيانات</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Control Bar */}
      <div style={{
        background: '#f8fafc',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Quick Search */}
          <div style={{ flex: '2 1 240px', position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="بحث سريع باسم الدرس، المادة، المعلم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingRight: '36px', marginBottom: 0, width: '100%', background: 'white' }}
            />
          </div>

          {/* Class Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <select 
              className="input-field" 
              style={{ marginBottom: 0, width: '100%', background: 'white' }}
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">{t('adminPreparations.allClasses')}</option>
              {classesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          {/* Teacher Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <select 
              className="input-field" 
              style={{ marginBottom: 0, width: '100%', background: 'white' }}
              value={selectedTeacher} 
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="">{t('adminPreparations.allTeachers')}</option>
              {Object.entries(teachersList).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          {availableSemesters.length > 0 && (
            <div style={{ flex: '1 1 150px' }}>
              <select 
                className="input-field" 
                style={{ marginBottom: 0, width: '100%', background: 'white' }}
                value={selectedSemester} 
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                <option value="">جميع الفصول</option>
                {availableSemesters.map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters */}
          {(selectedClass || selectedTeacher || selectedSemester || searchQuery) && (
            <button
              onClick={() => {
                setSelectedClass('');
                setSelectedTeacher('');
                setSelectedSemester('');
                setSearchQuery('');
              }}
              className="btn btn-outline"
              style={{ padding: '8px 14px', fontSize: '12px', height: '42px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> إعادة الضبط
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', color: '#475569' }}>لا توجد تحاضير مطابقة</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            {searchQuery || selectedClass || selectedTeacher 
              ? 'جرّب تعديل خيارات البحث أو الفلترة أعلاه'
              : t('adminPreparations.noPreparations')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '18px' }}>
                    {p.lessonTitle ? `${p.lessonTitle} - ` : ''}{t('adminPreparations.classPrefix')} {p.className || p.class} - {t('adminPreparations.subjectPrefix')} {p.subject}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                    {p.semester && (
                      <span style={{ background: '#f0f9ff', color: '#0e7490', border: '1px solid #bae6fd', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                        {p.semester}
                      </span>
                    )}
                    {p.stage && (
                      <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                        {p.stage}
                      </span>
                    )}
                    <span style={{ color: '#475569', fontSize: '13px', background: '#f8fafc', padding: '3px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      👤 {t('adminPreparations.teacherPrefix')} <strong>{p.teacherName || teachersList[p.teacherId] || teachersList[p.teacherNationalId] || p.teacherEmail || 'معلم'}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setPrintingPrep(p)}
                    className="btn btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)'
                    }}
                  >
                    <Printer size={16} /> طباعة التحضير (PDF)
                  </button>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-secondary)', fontSize: '14px' }}>
                    {p.week || t('adminPreparations.week1')} • {p.period || '-'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    📅 {t('adminPreparations.datePrefix')} {p.date || '-'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {t('adminPreparations.updatedPrefix')} {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ar-EG') : '-'}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {p.fileUrl && (
                  <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span><strong>{t('adminPreparations.attachedFile')}:</strong> {p.fileName}</span>
                    <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#0369a1', fontWeight: 'bold', textDecoration: 'underline' }}>تحميل / عرض الملف</a>
                  </div>
                )}
                
                {['goals', 'portfolio', 'warmup', 'strategy', 'content', 'resources', 'formativeEval', 'summativeEval', 'homework'].map(field => {
                  const titles = {
                    goals: t('adminPreparations.goals'),
                    portfolio: t('adminPreparations.portfolio'),
                    warmup: t('adminPreparations.warmup'),
                    strategy: t('adminPreparations.strategy'),
                    content: t('adminPreparations.content'),
                    resources: t('adminPreparations.resources'),
                    formativeEval: t('adminPreparations.formativeEval'),
                    summativeEval: t('adminPreparations.summativeEval'),
                    homework: t('adminPreparations.homework')
                  };
                  if (!p[field]) return null;
                  return (
                    <div key={field}>
                      <h4 style={{ color: 'var(--color-secondary-dark)', margin: '0 0 6px 0', fontSize: '14px' }}>{titles[field]}</h4>
                      <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}>
                        <MarkdownViewer content={p[field]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {printingPrep && (
        <PrintLessonPreparationModal prep={printingPrep} onClose={() => setPrintingPrep(null)} />
      )}
    </div>
  );
}

