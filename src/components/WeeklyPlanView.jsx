import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { Printer, LayoutGrid, Table as TableIcon, BookOpen, Calendar, MessageCircle, Sparkles } from 'lucide-react';
import LessonWorksheetModal from './LessonWorksheetModal';

export default function WeeklyPlanView({ studentClass = null, schoolId }) {
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [weeklyPlansList, setWeeklyPlansList] = useState([]);
  const [publishedWorksheets, setPublishedWorksheets] = useState({});
  const [activeWorksheet, setActiveWorksheet] = useState(null);
  const [activePrepData, setActivePrepData] = useState(null);
  const [scheduleData, setScheduleData] = useState({});
  const [teachers, setTeachers] = useState({});
  
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedClassName, setSelectedClassName] = useState('');
  const [viewMode, setViewMode] = useState('schedule'); // 'schedule' or 'table'

  const DAYS = [
    t('days.sunday') || 'الأحد', 
    t('days.monday') || 'الإثنين', 
    t('days.tuesday') || 'الثلاثاء', 
    t('days.wednesday') || 'الأربعاء', 
    t('days.thursday') || 'الخميس'
  ];
  
  const dayKeyMap = {
    [t('days.sunday')]: 'sunday',
    [t('days.monday')]: 'monday',
    [t('days.tuesday')]: 'tuesday',
    [t('days.wednesday')]: 'wednesday',
    [t('days.thursday')]: 'thursday',
    'الأحد': 'sunday',
    'الإثنين': 'monday',
    'الثلاثاء': 'tuesday',
    'الأربعاء': 'wednesday',
    'الخميس': 'thursday'
  };

  const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
  const WEEKS = Array.from({length: 18}, (_, i) => `${t('weeklyPlan.week') || 'الأسبوع'} ${i + 1}`);
  
  const [selectedWeek, setSelectedWeek] = useState(WEEKS[0]);
  const [selectedYear, setSelectedYear] = useState('1447/1448');
  const [selectedSemester, setSelectedSemester] = useState(t('weeklyPlan.semesterOne') || 'الفصل الدراسي الأول');

  // 1. Fetch Classes
  useEffect(() => {
    if (studentClass) {
      setSelectedClassName(studentClass);
    }
    const targetSchoolId = schoolId || 'default_school_1';
    const q = query(collection(db, 'classes'), where('schoolId', '==', targetSchoolId));
    const unsub = onSnapshot(q, (snap) => {
      const cls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClasses(cls);
      if (studentClass) {
        const found = cls.find(c => c.name === studentClass);
        if (found) {
          setSelectedClassId(found.id);
          setSelectedClassName(found.name);
        } else {
          setSelectedClassName(studentClass);
        }
      } else if (cls.length > 0 && !selectedClassId) {
        setSelectedClassId(cls[0].id);
        setSelectedClassName(cls[0].name);
      }
    });
    return () => unsub();
  }, [studentClass, schoolId]);

  const handleClassChange = (e) => {
    const cid = e.target.value;
    const cls = classes.find(c => c.id === cid);
    setSelectedClassId(cid);
    if(cls) setSelectedClassName(cls.name);
  };

  // 2. Fetch Preparations and Weekly Plans
  useEffect(() => {
    if (!selectedClassName) return;
    const targetSchoolId = schoolId || 'default_school_1';
    const clsName = selectedClassName.trim();

    // 2a. Fetch Preparations
    const qPrep = query(collection(db, 'preparations'), where('schoolId', '==', targetSchoolId));
    const unsubPrep = onSnapshot(qPrep, (snapshot) => {
      const data = [];
      snapshot.forEach(docSnap => {
        const p = docSnap.data();
        const pCls = (p.className || p.class || p.targetClass || '').trim();
        const matchesClass = pCls === clsName || (pCls && clsName.includes(pCls)) || (pCls && pCls.includes(clsName));
        
        if (matchesClass) {
          if (!p.week || p.week === selectedWeek) {
            data.push({ id: docSnap.id, ...p });
          }
        }
      });
      setPlans(data);
    });

    // 2b. Fetch Weekly Plans
    const qWeekly = collection(db, 'weekly_plans');
    const unsubWeekly = onSnapshot(qWeekly, (snapshot) => {
      const wData = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const dCls = (d.className || '').trim();
        const matchesClass = dCls === clsName || (dCls && clsName.includes(dCls)) || (dCls && dCls.includes(clsName));
        if (matchesClass && (!d.week || d.week === selectedWeek)) {
          wData.push({ id: docSnap.id, ...d });
        }
      });
      setWeeklyPlansList(wData);
    });

    // 2c. Fetch Published Worksheets
    const qWs = query(
      collection(db, 'worksheets'),
      where('status', '==', 'published')
    );
    const unsubWs = onSnapshot(qWs, (snapshot) => {
      const wsMap = {};
      snapshot.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() };
        const dCls = (d.className || '').trim();
        const matchesClass = !dCls || dCls === clsName || clsName.includes(dCls) || dCls.includes(clsName);
        if (matchesClass) {
          if (d.prepId) wsMap[d.prepId] = d;
          const k1 = `${(d.subject || '').trim()}_${(d.lessonTitle || '').trim()}`;
          wsMap[k1] = d;
        }
      });
      setPublishedWorksheets(wsMap);
    });

    return () => {
      unsubPrep();
      unsubWeekly();
      unsubWs();
    };
  }, [selectedClassName, selectedWeek, schoolId]);

  // 3. Fetch Teachers and Schedules
  useEffect(() => {
    const targetSchoolId = schoolId || 'default_school_1';
    const qTeachers = query(collection(db, 'teachers'), where('schoolId', '==', targetSchoolId));
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const tMap = {};
      snap.docs.forEach(docSnap => {
        tMap[docSnap.id] = { name: docSnap.data().name, whatsapp: docSnap.data().whatsapp };
      });
      setTeachers(tMap);
    });

    const qSchedules = query(collection(db, 'schedules'), where('schoolId', '==', targetSchoolId));
    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      if (!snap.empty && (selectedClassId || selectedClassName)) {
        const clsName = selectedClassName ? selectedClassName.trim() : '';
        const foundDoc = snap.docs.find(d => {
          const data = d.data();
          const dClsName = (data.className || data.class || data.name || '').trim();
          return (selectedClassId && (d.id === selectedClassId || data.classId === selectedClassId)) ||
                 (clsName && (
                   dClsName === clsName || 
                   (dClsName && clsName.includes(dClsName)) ||
                   (dClsName && dClsName.includes(clsName))
                 ));
        });

        if (foundDoc) {
          setScheduleData(foundDoc.data().matrix || foundDoc.data().schedule || {});
        } else {
          setScheduleData({});
        }
      } else {
        setScheduleData({});
      }
    });

    return () => {
      unsubTeachers();
      unsubSchedules();
    };
  }, [selectedClassId, selectedClassName, schoolId]);

  // Helper to extract period plan data
  const getCellPlanData = (day, period, cell) => {
    if (!cell || !cell.subject) return null;
    const dayKey = dayKeyMap[day] || 'sunday';
    const prepPeriodKey = `${day} - ${period}`;

    // Find from preparations
    const dayPrep = plans.find(p => p.teacherId === cell.teacherId && p.period === prepPeriodKey) || {};
    
    // Find from weekly_plans
    const teacherWeeklyDoc = weeklyPlansList.find(w => w.teacherId === cell.teacherId);
    const dayWeeklyPlan = teacherWeeklyDoc?.plan?.[dayKey] || {};

    const topic = dayWeeklyPlan.topic || dayPrep.title || dayPrep.topic || dayPrep.lessonTitle || '';
    const homework = dayWeeklyPlan.homework || dayWeeklyPlan.goals || dayPrep.homework || dayPrep.goals || '';
    const notes = dayWeeklyPlan.notes || dayWeeklyPlan.extraTasks || dayPrep.notes || dayPrep.extraTasks || dayPrep.content || '';

    const effectivePrepId = dayPrep.id || dayPrep.worksheetId;
    const normKey = `${(cell.subject || '').trim()}_${(topic || dayPrep.lessonTitle || '').trim()}`;
    const worksheet = publishedWorksheets[effectivePrepId] || publishedWorksheets[normKey] || null;

    return {
      subject: cell.subject,
      teacherId: cell.teacherId,
      teacherName: teachers[cell.teacherId]?.name || t('weeklyPlan.notSpecified'),
      whatsapp: teachers[cell.teacherId]?.whatsapp,
      topic,
      homework,
      notes,
      worksheet,
      prepData: dayPrep
    };
  };

  // Build flattened rows for Detailed Table View
  const detailedRows = useMemo(() => {
    const rows = [];
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        const key = `${day}-${period}`;
        const cell = scheduleData[key];
        if (cell && cell.subject) {
          const planData = getCellPlanData(day, period, cell);
          if (planData) {
            rows.push({
              day,
              period,
              ...planData
            });
          }
        }
      });
    });
    return rows;
  }, [scheduleData, plans, weeklyPlansList, teachers, DAYS, publishedWorksheets]);

  const handlePrint = () => {
    window.print();
  };

  if (studentClass && !selectedClassName) {
    return <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}><p style={{color: 'var(--color-text-muted)'}}>{t('weeklyPlan.notRegistered')}</p></div>;
  }

  return (
    <div className="glass-panel weekly-plan-container" style={{ padding: '24px' }}>
      {/* Header controls - Hidden on Print */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
              {t('weeklyPlan.title')} {selectedClassName ? `- ${t('weeklyPlan.classWord')} ${selectedClassName}` : ''}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              {t('weeklyPlan.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '3px' }}>
              <button
                onClick={() => setViewMode('schedule')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'schedule' ? '#ffffff' : 'transparent',
                  color: viewMode === 'schedule' ? '#0e7490' : '#64748b',
                  boxShadow: viewMode === 'schedule' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <LayoutGrid size={15} /> {t('weeklyPlan.viewSchedule') || 'جدول الحصص'}
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#0e7490' : '#64748b',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <TableIcon size={15} /> {t('weeklyPlan.viewTable') || 'جدول تفصيلي'}
              </button>
            </div>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0e7490',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> {t('weeklyPlan.print') || 'طباعة الخطة'}
            </button>
          </div>
        </div>
        
        {/* Filters Bar */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.7)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85em', color: '#334155' }}>
              {t('weeklyPlan.academicYear')}
            </label>
            <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={{ marginBottom: 0 }}>
              <option value="1447/1448">1447/1448</option>
              <option value="1448/1449">1448/1449</option>
            </select>
          </div>
          
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85em', color: '#334155' }}>
              {t('weeklyPlan.semester')}
            </label>
            <select className="input-field" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} style={{ marginBottom: 0 }}>
              <option value={t('weeklyPlan.semesterOne')}>{t('weeklyPlan.semesterOne')}</option>
              <option value={t('weeklyPlan.semesterTwo')}>{t('weeklyPlan.semesterTwo')}</option>
              <option value={t('weeklyPlan.semesterThree')}>{t('weeklyPlan.semesterThree')}</option>
            </select>
          </div>

          {!studentClass && (
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85em', color: '#334155' }}>
                {t('weeklyPlan.classLabel')}
              </label>
              <select className="input-field" value={selectedClassId || ''} onChange={handleClassChange} style={{ marginBottom: 0 }}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85em', color: '#334155' }}>
              {t('weeklyPlan.weekLabel')}
            </label>
            <select className="input-field" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} style={{ marginBottom: 0 }}>
              {WEEKS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="only-print" style={{ display: 'none', marginBottom: '20px', borderBottom: '2px solid #0e7490', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0e7490', fontSize: '1.4rem' }}>الخطة الأسبوعية للدروس والواجبات</h2>
            <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '4px' }}>
              {selectedClassName && `الفصل: ${selectedClassName} | `} {selectedWeek} | {selectedSemester} | {selectedYear}
            </div>
          </div>
        </div>
      </div>

      {Object.keys(scheduleData).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          {t('weeklyPlan.noSchedule')}
        </div>
      ) : viewMode === 'table' ? (
        /* Detailed Table View (الجدول التفصيلي) */
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '100px' }}>اليوم</th>
                <th style={{ width: '80px', textAlign: 'center' }}>الحصة</th>
                <th style={{ width: '140px' }}>المادة</th>
                <th style={{ width: '140px' }}>المعلم</th>
                <th style={{ minWidth: '180px' }}>موضوع الدرس</th>
                <th style={{ minWidth: '220px', background: '#f0fdf4', color: '#15803d' }}>📝 الواجب</th>
                <th style={{ minWidth: '220px', background: '#fefce8', color: '#854d0e' }}>📌 ملاحظات أو مهام إضافية</th>
              </tr>
            </thead>
            <tbody>
              {detailedRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    لا توجد بيانات مسجلة في هذا الأسبوع
                  </td>
                </tr>
              ) : (
                detailedRows.map((r, idx) => (
                  <tr key={`${r.day}-${r.period}-${idx}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ fontWeight: 'bold', color: 'var(--color-primary-dark)' }}>{r.day}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>حصة {r.period}</td>
                    <td style={{ fontWeight: 'bold', color: '#0f172a' }}>{r.subject}</td>
                    <td style={{ fontSize: '0.9rem', color: '#475569' }}>
                      {r.teacherName}
                      {r.whatsapp && (
                        <a 
                          href={`https://wa.me/${r.whatsapp}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="no-print"
                          style={{ marginRight: '6px', color: '#25D366', textDecoration: 'none', display: 'inline-flex', verticalAlign: 'middle' }}
                          title="تواصل واتساب"
                        >
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </td>
                    <td style={{ color: '#334155' }}>
                      <div style={{ fontWeight: 500 }}>{r.topic || '-'}</div>
                      {r.worksheet && (
                        <button
                          type="button"
                          className="no-print"
                          onClick={() => {
                            setActiveWorksheet(r.worksheet);
                            setActivePrepData({
                              lessonTitle: r.worksheet.lessonTitle || r.topic,
                              subject: r.subject,
                              className: selectedClassName,
                              teacherName: r.teacherName
                            });
                          }}
                          style={{
                            marginTop: '6px',
                            background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 6px rgba(14, 116, 144, 0.2)'
                          }}
                        >
                          <Sparkles size={12} /> 📄 ورقة العمل
                        </button>
                      )}
                    </td>
                    <td style={{ background: '#f0fdf4', color: '#166534', fontWeight: 500 }}>
                      {r.homework ? (
                        <span>{r.homework}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>لا يوجد واجب</span>
                      )}
                    </td>
                    <td style={{ background: '#fefce8', color: '#854d0e' }}>
                      {r.notes ? (
                        <span>{r.notes}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Schedule Matrix View (عرض جدول الحصص الأسبوعي) */
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '950px' }}>
            <thead>
              <tr>
                <th style={{ width: '90px' }}>{t('weeklyPlan.day')}</th>
                {PERIODS.map(p => (
                  <th key={p} style={{ textAlign: 'center', minWidth: '170px' }}>
                    {t('weeklyPlan.period')} {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td style={{ fontWeight: 'bold', color: 'var(--color-primary-dark)', verticalAlign: 'middle' }}>
                    {day}
                  </td>
                  {PERIODS.map(period => {
                    const key = `${day}-${period}`;
                    const cell = scheduleData[key];
                    let cellContent = <span style={{ color: '#cbd5e1' }}>-</span>;

                    if (cell && cell.subject) {
                      const planData = getCellPlanData(day, period, cell);
                      
                      cellContent = (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '6px', 
                          background: 'rgba(99,178,198,0.06)', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          textAlign: 'right', 
                          border: '1px solid rgba(99,178,198,0.25)' 
                        }}>
                          {/* Subject & Teacher Header */}
                          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--color-primary-dark)', display: 'block', fontSize: '0.95rem' }}>
                              {cell.subject}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {t('weeklyPlan.teacherPrefix')} {planData.teacherName}
                              </span>
                              {planData.whatsapp && (
                                <a 
                                  href={`https://wa.me/${planData.whatsapp}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="no-print"
                                  style={{ 
                                    fontSize: '10px', 
                                    color: '#25D366', 
                                    textDecoration: 'none', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '3px', 
                                    background: '#fff', 
                                    padding: '1px 5px', 
                                    borderRadius: '4px', 
                                    border: '1px solid #25D366' 
                                  }}
                                >
                                  <MessageCircle size={10} /> {t('weeklyPlan.contact')}
                                </a>
                              )}
                            </div>
                          </div>
                          
                          {/* Details: Topic, Homework, Notes */}
                          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {planData.topic && (
                              <div style={{ background: '#ffffff', padding: '5px 7px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                  <strong style={{ color: '#0e7490', fontSize: '11px' }}>📖 {t('weeklyPlan.lessonTopic') || 'موضوع الدرس'}:</strong>
                                  {planData.worksheet && (
                                    <button
                                      type="button"
                                      className="no-print"
                                      onClick={() => {
                                        setActiveWorksheet(planData.worksheet);
                                        setActivePrepData({
                                          lessonTitle: planData.worksheet.lessonTitle || planData.topic,
                                          subject: cell.subject,
                                          className: selectedClassName,
                                          teacherName: planData.teacherName
                                        });
                                      }}
                                      style={{
                                        padding: '2px 6px',
                                        background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                      title="استعراض ورقة عمل الدرس المعتمدة"
                                    >
                                      <Sparkles size={10} /> 📄 ورقة العمل
                                    </button>
                                  )}
                                </div>
                                <span style={{ color: '#334155', display: 'block', marginTop: '2px' }}>{planData.topic}</span>
                              </div>
                            )}
                            
                            {/* Homework Box (بدلاً من الأهداف) */}
                            <div style={{ background: '#f0fdf4', padding: '5px 7px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                              <strong style={{ color: '#15803d', display: 'block', fontSize: '11px' }}>📝 {t('weeklyPlan.homework') || 'الواجب'}:</strong>
                              <span style={{ color: '#166534', fontWeight: 500 }}>
                                {planData.homework || t('weeklyPlan.notSpecified')}
                              </span>
                            </div>

                            {/* Notes / Additional Tasks Box (بجانب الواجب) */}
                            <div style={{ background: '#fefce8', padding: '5px 7px', borderRadius: '6px', border: '1px solid #fef08a' }}>
                              <strong style={{ color: '#a16207', display: 'block', fontSize: '11px' }}>📌 {t('weeklyPlan.notes') || 'ملاحظات أو مهام إضافية'}:</strong>
                              <span style={{ color: '#854d0e' }}>
                                {planData.notes || t('weeklyPlan.notSpecified')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <td key={period} style={{ padding: '6px', verticalAlign: 'top' }}>
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lesson Worksheet Modal for Parents / Students */}
      {activeWorksheet && (
        <LessonWorksheetModal
          isOpen={Boolean(activeWorksheet)}
          onClose={() => {
            setActiveWorksheet(null);
            setActivePrepData(null);
          }}
          prepData={activePrepData}
          existingWorksheet={activeWorksheet}
          readOnly={true}
          userRole="parent"
        />
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .only-print {
            display: block !important;
          }
          .weekly-plan-container {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
          }
        }
      `}</style>
    </div>
  );
}
