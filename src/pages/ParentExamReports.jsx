import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
  Award, 
  FileSpreadsheet, 
  Printer, 
  Sparkles,
  Globe,
  Languages,
  BookOpen,
  MessageSquare
} from 'lucide-react';
import { ACADEMIC_LEVELS, getLevelByPercentage } from '../utils/examGradingEngine';

export default function ParentExamReports({ targetStudentNationalId, targetStudentName }) {
  const { userData } = useAuth();

  const studentNid = targetStudentNationalId || userData?.studentNationalId || '';
  const studentName = targetStudentName || userData?.studentName || 'الطالب';
  const schoolName = userData?.schoolName || 'المدارس المتقدمة للتعلم الذكي';
  const studentClass = userData?.studentClass || 'غير محدد';
  const schoolId = userData?.schoolId || 'default_school_1';

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [gradesRecords, setGradesRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectTab, setSelectedSubjectTab] = useState(null);
  const [parentViewLang, setParentViewLang] = useState('both'); // 'both' | 'ar' | 'en'

  // 1. Fetch available exams
  useEffect(() => {
    const qExams = schoolId === 'ALL'
      ? collection(db, 'school_exams')
      : query(collection(db, 'school_exams'), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(qExams, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a) => (a.status === 'active' ? -1 : 1));
      setExams(list);
      if (list.length > 0) {
        setSelectedExamId(prev => prev || list[0].id);
      }
    });

    return () => unsub();
  }, [schoolId]);

  // 2. Fetch student's grades for all or selected exam
  useEffect(() => {
    if (!studentNid && !studentName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let qGrades;

    if (studentNid) {
      qGrades = query(
        collection(db, 'exam_grades_records'),
        where('studentNationalId', '==', String(studentNid))
      );
    } else {
      qGrades = query(
        collection(db, 'exam_grades_records'),
        where('studentName', '==', studentName)
      );
    }

    const unsub = onSnapshot(qGrades, snap => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGradesRecords(records);
      setLoading(false);
    }, err => {
      console.warn('Grades for parent error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [studentNid, studentName]);

  // Selected Exam Object
  const currentExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Filter grades for the selected exam
  const examGrades = useMemo(() => {
    if (!selectedExamId) return gradesRecords;
    return gradesRecords.filter(r => r.examId === selectedExamId);
  }, [gradesRecords, selectedExamId]);

  // Set default subject for remedial tab
  useEffect(() => {
    if (examGrades.length > 0 && !selectedSubjectTab) {
      setSelectedSubjectTab(examGrades[0].subject);
    }
  }, [examGrades, selectedSubjectTab]);

  // Overall Cumulative Performance
  const overallStats = useMemo(() => {
    if (examGrades.length === 0) {
      return { totalScore: 0, maxScore: 0, percentage: 0, level: ACADEMIC_LEVELS[0] };
    }

    let tScore = 0;
    let mScore = 0;
    examGrades.forEach(g => {
      tScore += Number(g.totalScore) || 0;
      mScore += Number(g.maxScore) || 100;
    });

    const pct = mScore > 0 ? Number(((tScore / mScore) * 100).toFixed(2)) : 0;
    const level = getLevelByPercentage(pct);

    return {
      totalScore: Number(tScore.toFixed(2)),
      maxScore: mScore,
      percentage: pct,
      level
    };
  }, [examGrades]);

  // Active Subject Detail
  const activeSubjectRecord = useMemo(() => {
    return examGrades.find(g => g.subject === selectedSubjectTab) || examGrades[0] || null;
  }, [examGrades, selectedSubjectTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', direction: 'rtl' }}>
      
      {/* ─── OFFICIAL REPORT HEADER & PROFILE BANNER ─── */}
      <div className="glass-panel" style={{ 
        padding: '24px', 
        borderRadius: '16px', 
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', 
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(30, 27, 75, 0.3)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '16px', 
              background: 'rgba(255, 255, 255, 0.12)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <Award size={32} color="#a5b4fc" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>
                  تقرير الدرجات والبرنامج العلاجي للطالب
                </h1>
                <span style={{ 
                  background: 'rgba(165, 180, 252, 0.2)', 
                  color: '#a5b4fc', 
                  padding: '2px 10px', 
                  borderRadius: '20px', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  border: '1px solid rgba(165, 180, 252, 0.3)'
                }}>
                  إشعار ولي الأمر
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#c7d2fe' }}>
                تحليل تفصيلي لدرجات الطالب في جميع المواد مع الخطة العلاجية والتوجيهات الإرشادية للمنزل.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Printer size={16} />
              <span>طباعة إشعار الدرجات الرسمي</span>
            </button>
          </div>
        </div>

        {/* Student Metadata Card Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '22px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '11px', color: '#a5b4fc', marginBottom: '2px' }}>اسم الطالب</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{studentName}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '11px', color: '#a5b4fc', marginBottom: '2px' }}>الصف الدراسي</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{studentClass}</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '11px', color: '#a5b4fc', marginBottom: '2px' }}>المعدل العام للاختبار</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#86efac' }}>
              {overallStats.percentage}% 
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#c7d2fe', marginRight: '6px' }}>
                ({overallStats.totalScore} / {overallStats.maxScore})
              </span>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: '11px', color: '#a5b4fc', marginBottom: '2px' }}>التصنيف الأكاديمي العام</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fde047' }}>
              {overallStats.level.name} ({overallStats.level.symbol})
            </div>
          </div>
        </div>
      </div>

      {/* Exam Selector Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '14px', background: 'var(--color-bg-card)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>عرض درجات الاختبار:</span>
          <select 
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: '220px', fontWeight: 'bold', color: '#1e293b' }}
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '12px', color: '#64748b' }}>
          المدرسة: <strong>{schoolName}</strong>
        </div>
      </div>

      {/* ─── DETAILED GRADES TABLE BREAKDOWN ─── */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--color-bg-card)', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: '#0f172a' }}>
              كشف درجات المواد والأعمدة المخصصة
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              تفصيل دقيق يوضح درجة الاختبار التحريري والمشاركة والحضور والواجبات وأوراق العمل لكل مادة.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            جاري تحميل نتائج الطالب...
          </div>
        ) : examGrades.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#334155' }}>لم يتم رصد درجات لهذا الاختبار حتى الآن</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>سيقوم معلمو المواد برصد الدرجات والبرامج العلاجية قريباً فور الانتهاء من التصحيح.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 14px' }}>المادة</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center', background: '#f0f9ff', color: '#0369a1' }}>
                    اختبار المادة (تحريري)
                  </th>
                  
                  {/* Dynamic Headers from Exam if exists */}
                  {(currentExam?.customColumns || []).map(col => (
                    <th key={col.id} style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {col.label}
                    </th>
                  ))}

                  <th style={{ padding: '12px 10px', textAlign: 'center', background: '#f1f5f9' }}>
                    المجموع
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>النسبة المئوية</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>المستوى (من 8)</th>
                  <th style={{ padding: '12px 12px', textAlign: 'center' }}>البرنامج المخصص</th>
                </tr>
              </thead>

              <tbody>
                {examGrades.map(rec => (
                  <tr 
                    key={rec.id} 
                    onClick={() => setSelectedSubjectTab(rec.subject)}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: selectedSubjectTab === rec.subject ? '#f0fdf4' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: rec.levelColor || '#3b82f6' }} />
                        <span>{rec.subject}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>المعلم: {rec.teacherName}</div>
                    </td>

                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0284c7', background: selectedSubjectTab === rec.subject ? '#e0f2fe' : '#f8fafc' }}>
                      {rec.coreScore} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>/ {currentExam?.coreSubjectMaxScore || 20}</span>
                    </td>

                    {(currentExam?.customColumns || []).map(col => (
                      <td key={col.id} style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <strong>{rec.customScores?.[col.key] || 0}</strong>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}> / {col.maxScore}</span>
                      </td>
                    ))}

                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '900', fontSize: '14px', color: '#0f172a', background: '#f8fafc' }}>
                      {rec.totalScore} <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>/ {rec.maxScore}</span>
                    </td>

                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{rec.percentage}%</div>
                      <div style={{ width: '60px', height: '6px', borderRadius: '4px', background: '#e2e8f0', margin: '0 auto', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, rec.percentage)}%`, height: '100%', background: rec.levelColor || '#22c55e', borderRadius: '4px' }} />
                      </div>
                    </td>

                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '3px 10px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        background: rec.levelBgColor || '#f1f5f9', 
                        color: rec.levelColor || '#334155',
                        border: `1px solid ${rec.levelBorderColor || '#cbd5e1'}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {rec.levelName} ({rec.levelSymbol})
                      </span>
                    </td>

                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        color: rec.levelType === 'remedial' ? '#b91c1c' : '#15803d',
                        fontWeight: 'bold',
                        background: rec.levelType === 'remedial' ? '#fef2f2' : '#f0fdf4',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${rec.levelType === 'remedial' ? '#fecaca' : '#bbf7d0'}`
                      }}>
                        {rec.levelType === 'remedial' ? 'برنامج علاجي' : 'برنامج إثرائي'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── SMART REMEDIAL / ENRICHMENT PROGRAM DETAILS CARD FOR PARENTS ─── */}
      {activeSubjectRecord && (() => {
        const rem = activeSubjectRecord.remedialProgram || {};
        const teacherVisibility = rem.parentLanguageDisplay || 'both'; // 'ar' | 'en' | 'both'
        
        // Determine effective view language for parent
        let effectiveLang = parentViewLang;
        if (teacherVisibility === 'ar') effectiveLang = 'ar';
        else if (teacherVisibility === 'en') effectiveLang = 'en';

        const arData = rem.ar || {
          title: rem.title || 'خطة التطوير الأكاديمي',
          diagnosis: rem.diagnosis || '',
          actionPlan: rem.actionPlan || [],
          parentAdvice: rem.parentAdvice || '',
          teacherNotes: rem.teacherNotes || ''
        };

        const enData = rem.en || {
          title: rem.enTitle || 'Academic Development Plan',
          diagnosis: rem.enDiagnosis || '',
          actionPlan: rem.enActionPlan || [],
          parentAdvice: rem.enParentAdvice || '',
          teacherNotes: rem.teacherNotes || ''
        };

        const showAr = effectiveLang === 'ar' || effectiveLang === 'both';
        const showEn = effectiveLang === 'en' || effectiveLang === 'both';

        return (
          <div className="glass-panel" style={{ 
            padding: '24px', 
            borderRadius: '16px', 
            background: activeSubjectRecord.levelType === 'remedial' ? '#fff1f2' : '#f0fdf4',
            border: `2px solid ${activeSubjectRecord.levelType === 'remedial' ? '#f43f5e' : '#22c55e'}`,
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
          }}>
            
            {/* Header of Remedial Box */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '10px', 
                  background: activeSubjectRecord.levelColor, 
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: activeSubjectRecord.levelColor }}>
                    {showAr && !showEn ? arData.title : (!showAr && showEn ? enData.title : `${arData.title} / ${enData.title}`)}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#475569' }}>
                    مادة: <strong>{activeSubjectRecord.subject}</strong> | المستوى: <strong>{activeSubjectRecord.levelName} ({activeSubjectRecord.levelSymbol})</strong>
                    {rem.aiGenerated && (
                      <span style={{ marginRight: '8px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                        ✨ موصى به بالذكاء الاصطناعي
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                {/* Subject Selector Tabs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {examGrades.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedSubjectTab(g.subject)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        background: selectedSubjectTab === g.subject ? activeSubjectRecord.levelColor : 'white',
                        color: selectedSubjectTab === g.subject ? 'white' : '#475569',
                        border: `1px solid ${selectedSubjectTab === g.subject ? activeSubjectRecord.levelColor : '#cbd5e1'}`
                      }}
                    >
                      {g.subject}
                    </button>
                  ))}
                </div>

                {/* Parent Language Switcher (Only if teacher allowed 'both') */}
                {teacherVisibility === 'both' && (
                  <div style={{ display: 'flex', background: 'white', padding: '3px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                    <button
                      onClick={() => setParentViewLang('both')}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '7px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        border: 'none',
                        background: effectiveLang === 'both' ? '#0f172a' : 'transparent',
                        color: effectiveLang === 'both' ? 'white' : '#64748b'
                      }}
                    >
                      🌐 اللغتان معاً
                    </button>
                    <button
                      onClick={() => setParentViewLang('ar')}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '7px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        border: 'none',
                        background: effectiveLang === 'ar' ? '#0284c7' : 'transparent',
                        color: effectiveLang === 'ar' ? 'white' : '#64748b'
                      }}
                    >
                      🇸🇦 العربية
                    </button>
                    <button
                      onClick={() => setParentViewLang('en')}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '7px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        border: 'none',
                        background: effectiveLang === 'en' ? '#6366f1' : 'transparent',
                        color: effectiveLang === 'en' ? 'white' : '#64748b'
                      }}
                    >
                      🇬🇧 English
                    </button>
                  </div>
                )}
                {teacherVisibility === 'ar' && (
                  <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    🇸🇦 العرض بالعربية
                  </span>
                )}
                {teacherVisibility === 'en' && (
                  <span style={{ fontSize: '11px', color: '#4338ca', background: '#e0e7ff', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    🇬🇧 English Only
                  </span>
                )}
              </div>
            </div>

            {/* Content Display: Arabic & English Side-by-Side or Selected */}
            <div style={{ display: 'grid', gridTemplateColumns: effectiveLang === 'both' ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '16px' }}>
              
              {/* Arabic Section */}
              {showAr && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {effectiveLang === 'both' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0369a1', fontWeight: 'bold', fontSize: '13px' }}>
                      <span>🇸🇦 النسخة العربية</span>
                    </div>
                  )}

                  {/* Educational Diagnosis (AR) */}
                  <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                      التشخيص التربوي للأداء:
                    </div>
                    <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.6' }}>
                      {arData.diagnosis || 'لا يوجد تشخيص مسجل.'}
                    </div>
                  </div>

                  {/* Action Items (AR) */}
                  <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <strong style={{ fontSize: '13px', color: activeSubjectRecord.levelColor, display: 'block', marginBottom: '8px' }}>
                      خطة المدرسة لرفع المستوى وتطوير الأداء:
                    </strong>
                    <ul style={{ margin: 0, paddingRight: '18px', fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.5' }}>
                      {(arData.actionPlan || []).map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Parent Advice & Home Role (AR) */}
                  <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <strong style={{ fontSize: '13px', color: '#0369a1', display: 'block', marginBottom: '8px' }}>
                      دور ولي الأمر في المنزل لدعم الطالب:
                    </strong>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#334155', lineHeight: '1.6' }}>
                      {arData.parentAdvice || 'متابعة الطالب المستمرة والتواصل مع معلم المادة.'}
                    </p>

                    {(arData.teacherNotes || rem.teacherNotes) && (
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderRight: `3px solid ${activeSubjectRecord.levelColor}`, fontSize: '12px' }}>
                        <strong style={{ display: 'block', color: '#0f172a', marginBottom: '2px' }}>ملاحظة المعلم المباشرة:</strong>
                        <span style={{ color: '#475569' }}>{arData.teacherNotes || rem.teacherNotes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* English Section */}
              {showEn && (
                <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                  {effectiveLang === 'both' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4338ca', fontWeight: 'bold', fontSize: '13px' }}>
                      <span>🇬🇧 English Version</span>
                    </div>
                  )}

                  {/* Educational Diagnosis (EN) */}
                  <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                      Educational Diagnosis:
                    </div>
                    <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: '1.6' }}>
                      {enData.diagnosis || 'No educational diagnosis recorded.'}
                    </div>
                  </div>

                  {/* Action Items (EN) */}
                  <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <strong style={{ fontSize: '13px', color: activeSubjectRecord.levelColor, display: 'block', marginBottom: '8px' }}>
                      School & Teacher Action Plan:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.5' }}>
                      {(enData.actionPlan || []).map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Parent Advice & Home Role (EN) */}
                  <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <strong style={{ fontSize: '13px', color: '#4338ca', display: 'block', marginBottom: '8px' }}>
                      Parent's Role at Home:
                    </strong>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#334155', lineHeight: '1.6' }}>
                      {enData.parentAdvice || 'Consistent follow-up at home and regular communication with the teacher.'}
                    </p>

                    {(enData.teacherNotes || rem.teacherNotes) && (
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderLeft: `3px solid ${activeSubjectRecord.levelColor}`, fontSize: '12px' }}>
                        <strong style={{ display: 'block', color: '#0f172a', marginBottom: '2px' }}>Teacher's Direct Observation:</strong>
                        <span style={{ color: '#475569' }}>{enData.teacherNotes || rem.teacherNotes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>
        );
      })()}

    </div>
  );
}
