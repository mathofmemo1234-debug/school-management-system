import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download, Calendar, Users, BookOpen, Layers, UserCheck, ShieldCheck, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

// Curated colorful palette for school subjects
const SUBJECT_COLORS = {
  'القرآن الكريم': { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', badge: '#10b981' },
  'الدراسات الإسلامية': { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#22c55e' },
  'التفسير': { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#22c55e' },
  'التوحيد': { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#22c55e' },
  'الفقه': { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#22c55e' },
  'الحديث': { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#22c55e' },
  'اللغة العربية': { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#ef4444' },
  'لغتي': { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#ef4444' },
  'لغتي الخالدة': { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#ef4444' },
  'الرياضيات': { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: '#3b82f6' },
  'العلوم': { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', badge: '#14b8a6' },
  'الفيزياء': { bg: '#e0f2fe', border: '#7dd3fc', text: '#0369a1', badge: '#0284c7' },
  'الكيمياء': { bg: '#fdf4ff', border: '#f5d0fe', text: '#86198f', badge: '#d946ef' },
  'الأحياء': { bg: '#f7fee7', border: '#d9f99d', text: '#3f6212', badge: '#84cc16' },
  'الدراسات الاجتماعية': { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#f59e0b' },
  'الاجتماعيات': { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#f59e0b' },
  'التاريخ': { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#f59e0b' },
  'الجغرافيا': { bg: '#fefce8', border: '#fef08a', text: '#854d0e', badge: '#eab308' },
  'اللغة الإنجليزية': { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', badge: '#a855f7' },
  'English': { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', badge: '#a855f7' },
  'التربية الفنية': { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', badge: '#ec4899' },
  'الفنية': { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', badge: '#ec4899' },
  'التربية البدنية': { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', badge: '#f97316' },
  'البدنية': { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', badge: '#f97316' },
  'المهارات الرقمية': { bg: '#f0f9ff', border: '#bae6fd', text: '#075985', badge: '#0284c7' },
  'الحاسب الآلي': { bg: '#f0f9ff', border: '#bae6fd', text: '#075985', badge: '#0284c7' },
  'التفكير الناقد': { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', badge: '#8b5cf6' },
  'المهارات الحياتية': { bg: '#fefce8', border: '#fef08a', text: '#854d0e', badge: '#eab308' }
};

const DEFAULT_COLOR = { bg: '#f8fafc', border: '#cbd5e1', text: '#334155', badge: '#64748b' };

export default function PrintScheduleModal({
  classes = [],
  teachers = [],
  schedules = [],
  defaultLevel = 'class', // 'class' | 'teacher' | 'general'
  initialClassId = '',
  initialTeacherId = '',
  academicYear = '1447 / 1448 هـ',
  semester = 'الفصل الدراسي الأول',
  onClose
}) {
  const { userData } = useAuth();
  
  // Tab/Level Mode: 'class' (جدول فصل) | 'teacher' (جدول معلم) | 'general' (جدول عام شامل)
  const [level, setLevel] = useState(defaultLevel);
  
  // Selection States
  const [selectedClassId, setSelectedClassId] = useState(initialClassId || (classes[0]?.id || ''));
  const [selectedTeacherId, setSelectedTeacherId] = useState(initialTeacherId || (teachers[0]?.id || ''));
  const [generalDay, setGeneralDay] = useState('all'); // 'all' or specific day
  
  const [isColorMode, setIsColorMode] = useState(true);

  const schoolName = userData?.schoolName || 'المجمع التعليمي';
  const principalName = userData?.principalName || 'إدارة المدرسة';

  // Lookup Maps
  const teacherMap = useMemo(() => {
    const map = {};
    teachers.forEach(t => {
      map[t.id] = t.name;
      if (t.nationalId) map[t.nationalId] = t.name;
    });
    return map;
  }, [teachers]);

  const classMap = useMemo(() => {
    const map = {};
    classes.forEach(c => {
      map[c.id] = c.name;
    });
    return map;
  }, [classes]);

  // Master schedule indexed by classId -> { 'الأحد-1': { subject, teacherId } }
  const schedulesByClass = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
      const cId = s.id || s.classId;
      if (cId) {
        map[cId] = s.matrix || {};
      }
    });
    return map;
  }, [schedules]);

  // Helper to get cell color
  const getSubjectColor = (subj) => {
    if (!isColorMode || !subj) return DEFAULT_COLOR;
    return SUBJECT_COLORS[subj.trim()] || DEFAULT_COLOR;
  };

  // Helper: Get Teacher cell info for a given day & period
  const getTeacherCell = (tId, day, period) => {
    if (!tId) return null;
    const key = `${day}-${period}`;
    for (const s of schedules) {
      const cId = s.id || s.classId;
      const matrix = s.matrix || {};
      const cell = matrix[key];
      if (cell && (cell.teacherId === tId || (teachers.find(t => t.id === tId)?.nationalId && cell.teacherId === teachers.find(t => t.id === tId)?.nationalId))) {
        return {
          subject: cell.subject,
          className: classMap[cId] || s.className || 'فصل محدد',
          classId: cId
        };
      }
    }
    return null;
  };

  // Compute teacher total weekly load
  const getTeacherWeeklyLoad = (tId) => {
    let count = 0;
    DAYS.forEach(d => {
      PERIODS.forEach(p => {
        if (getTeacherCell(tId, d, p)) count++;
      });
    });
    return count;
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Word Export (.doc) Handler
  const handleExportWord = () => {
    const content = document.getElementById('printable-schedule-area');
    if (!content) return;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='rtl'>
      <head>
        <meta charset='utf-8'>
        <title>الجدول المدرسي الرسمي</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 11pt; }
          th { background-color: #0e7490; color: white; }
          .header-box { text-align: center; border-bottom: 2px solid #0e7490; padding-bottom: 12px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h2 style="color: #0e7490; margin: 0;">المملكة العربية السعودية - وزارة التعليم</h2>
          <h3>${schoolName}</h3>
          <h4>الجدول المدرسي للعام الدراسي ${academicYear} - ${semester}</h4>
        </div>
        ${content.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const title = level === 'class' ? `جدول_فصل_${classMap[selectedClassId] || 'مدرسي'}` : level === 'teacher' ? `جدول_المعلم_${teacherMap[selectedTeacherId] || 'مدرسي'}` : `الجدول_المدرسي_العام_الشامل`;
    link.download = `${title}_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    let rows = [];
    if (level === 'class') {
      const cName = classMap[selectedClassId] || 'فصل';
      rows.push(['اليوم', 'الحصة', 'المادة', 'المعلم', 'الصف']);
      const matrix = schedulesByClass[selectedClassId] || {};
      DAYS.forEach(day => {
        PERIODS.forEach(p => {
          const cell = matrix[`${day}-${p}`];
          if (cell && (cell.subject || cell.teacherId)) {
            rows.push([day, `الحصة ${p}`, cell.subject || '', teacherMap[cell.teacherId] || '', cName]);
          }
        });
      });
    } else if (level === 'teacher') {
      const tName = teacherMap[selectedTeacherId] || 'معلم';
      rows.push(['اليوم', 'الحصة', 'المادة', 'الصف', 'المعلم']);
      DAYS.forEach(day => {
        PERIODS.forEach(p => {
          const cell = getTeacherCell(selectedTeacherId, day, p);
          if (cell) {
            rows.push([day, `الحصة ${p}`, cell.subject || '', cell.className || '', tName]);
          }
        });
      });
    } else {
      rows.push(['اليوم', 'الحصة', 'الصف', 'المادة', 'المعلم']);
      classes.forEach(c => {
        const matrix = schedulesByClass[c.id] || {};
        DAYS.forEach(day => {
          PERIODS.forEach(p => {
            const cell = matrix[`${day}-${p}`];
            if (cell && (cell.subject || cell.teacherId)) {
              rows.push([day, `الحصة ${p}`, c.name, cell.subject || '', teacherMap[cell.teacherId] || '']);
            }
          });
        });
      });
    }

    const csvContent = rows.map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `الجدول_المدرسي_${level}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalJSX = (
    <div className="schedule-modal-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '16px',
      overflowY: 'auto'
    }}>
      {/* Print CSS Injection */}
      <style>{`
        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Completely hide EVERYTHING under body except the modal container so NO blank pages exist! */
          body > *:not(.schedule-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .schedule-modal-root,
          .schedule-modal-dialog {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            backdrop-filter: none !important;
          }
          #printable-schedule-area,
          #printable-schedule-area * {
            visibility: visible !important;
          }
          #printable-schedule-area {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            display: block !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm 10mm 10mm 10mm;
          }
        }
      `}</style>
      <div className="schedule-modal-dialog glass-panel" style={{
        width: '1100px',
        maxWidth: '100%',
        maxHeight: '94vh',
        overflowY: 'auto',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>

        {/* TOP TOOLBAR & CONTROLS (Hidden during Print) */}
        <div className="no-print" style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={22} color="#0e7490" /> طباعة وتصدير الجداول المدرسية الرسمية
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                طباعة رسمية بألوان مميزة وتنسيق معتمد مع شعار الوزارة وشعار المدرسة
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handlePrint}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                <Printer size={16} /> طباعة / تصدير PDF
              </button>

              <button
                onClick={handleExportWord}
                className="btn"
                style={{
                  background: '#2563eb',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="تصدير بصيغة Word DOC"
              >
                <Download size={16} /> Word
              </button>

              <button
                onClick={handleExportCSV}
                className="btn"
                style={{
                  background: '#047857',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="تصدير بصيغة Excel CSV"
              >
                <Download size={16} /> Excel
              </button>

              <button
                onClick={onClose}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>
          </div>

          {/* Mode Selector Tabs (3 Levels: Class / Teacher / General) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setLevel('class')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: level === 'class' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                  background: level === 'class' ? '#0e7490' : 'white',
                  color: level === 'class' ? 'white' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <Users size={16} /> 🏫 جدول على مستوى فصل
              </button>

              <button
                type="button"
                onClick={() => setLevel('teacher')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: level === 'teacher' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                  background: level === 'teacher' ? '#0e7490' : 'white',
                  color: level === 'teacher' ? 'white' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <UserCheck size={16} /> 👨‍🏫 جدول على مستوى معلم
              </button>

              <button
                type="button"
                onClick={() => setLevel('general')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: level === 'general' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                  background: level === 'general' ? '#0e7490' : 'white',
                  color: level === 'general' ? 'white' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <Layers size={16} /> 📊 الجدول العام الشامل للمدرسة
              </button>
            </div>

            {/* Filter Dropdowns according to active level */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {level === 'class' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>اختر الفصل:</label>
                  <select
                    className="input-field"
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    style={{ marginBottom: 0, padding: '6px 12px', fontSize: '13px', minWidth: '160px' }}
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {level === 'teacher' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>اختر المعلم:</label>
                  <select
                    className="input-field"
                    value={selectedTeacherId}
                    onChange={e => setSelectedTeacherId(e.target.value)}
                    style={{ marginBottom: 0, padding: '6px 12px', fontSize: '13px', minWidth: '180px' }}
                  >
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.subject ? `(${t.subject})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {level === 'general' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>اليوم المعروض:</label>
                  <select
                    className="input-field"
                    value={generalDay}
                    onChange={e => setGeneralDay(e.target.value)}
                    style={{ marginBottom: 0, padding: '6px 12px', fontSize: '13px', minWidth: '140px' }}
                  >
                    <option value="all">كافة أيام الأسبوع</option>
                    {DAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isColorMode}
                  onChange={e => setIsColorMode(e.target.checked)}
                />
                🎨 تلوين المواد
              </label>
            </div>
          </div>
        </div>

        {/* PRINTABLE OFFICIAL SCHEDULE DOCUMENT AREA */}
        <div id="printable-schedule-area" className="printable-certificate-page" style={{
          padding: '36px 44px',
          background: 'white',
          position: 'relative',
          color: '#0f172a',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
          
          {/* Watermark Background */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.03,
            fontSize: '110px',
            fontWeight: '900',
            pointerEvents: 'none',
            userSelect: 'none',
            textAlign: 'center',
            lineHeight: 1.2
          }}>
            المملكة العربية السعودية<br />وزارة التعليم
          </div>

          {/* Official Formal Header with Dual Logos */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '3px double #0e7490',
            paddingBottom: '16px',
            marginBottom: '20px'
          }}>
            {/* Right: Kingdom Info */}
            <div style={{ textAlign: 'right', fontSize: '12px', lineHeight: '1.7', color: '#1e293b' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0e7490' }}>المملكة العربية السعودية</div>
              <div>وزارة التعليم</div>
              <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
              <div style={{ fontWeight: 'bold' }}>{schoolName}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>الرقم الوزاري المعتمد: 441029</div>
            </div>

            {/* Center: Ministry & School Logos Side-by-Side */}
            <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
              <img
                src={`${import.meta.env.BASE_URL}minst.svg`}
                alt="وزارة التعليم"
                style={{
                  height: '70px',
                  width: 'auto',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                }}
              />
              <div style={{ width: '1.5px', height: '44px', background: '#cbd5e1' }}></div>
              <img
                src={userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`}
                alt="شعار المدرسة"
                style={{
                  height: '64px',
                  width: 'auto',
                  maxWidth: '100px',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                }}
              />
            </div>

            {/* Left: Schedule Metadata */}
            <div style={{ textAlign: 'left', fontSize: '12px', lineHeight: '1.7', color: '#1e293b' }}>
              <div><strong>العام الدراسي:</strong> {academicYear}</div>
              <div><strong>الفصل الدراسي:</strong> {semester}</div>
              <div><strong>تاريخ الإصدار:</strong> {new Date().toLocaleDateString('ar-SA')} م</div>
              <div><strong>حالة الاعتماد:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>معتمد رسمياً ✓</span></div>
            </div>
          </div>

          {/* Schedule Title Banner */}
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(99, 178, 198, 0.15))',
              border: '1.5px solid #0e7490',
              padding: '8px 32px',
              borderRadius: '30px'
            }}>
              <h2 style={{ margin: 0, color: '#0e7490', fontSize: '18px', fontWeight: '800' }}>
                {level === 'class' && `الجدول المدرسي لفصل: ${classMap[selectedClassId] || 'الفصل المحدد'}`}
                {level === 'teacher' && `جدول الحصص الأسبوعي للأستاذ / المعلم: ${teacherMap[selectedTeacherId] || 'المعلم المحدد'}`}
                {level === 'general' && `الجدول العام الشامل لكافة فصول المدرسة`}
              </h2>
            </div>
            {level === 'teacher' && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>
                التخصص: {teachers.find(t => t.id === selectedTeacherId)?.subject || 'تعليم عام'} • إجمالي النصاب الأسبوعي: ({getTeacherWeeklyLoad(selectedTeacherId)}) حصة
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* LEVEL 1: CLASS SCHEDULE VIEW                                            */}
          {/* ========================================================================= */}
          {level === 'class' && (
            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0e7490', color: 'white' }}>
                    <th style={{ padding: '12px 14px', border: '1px solid #083344', width: '110px', fontSize: '14px' }}>اليوم / الحصة</th>
                    {PERIODS.map(p => (
                      <th key={p} style={{ padding: '12px 8px', border: '1px solid #083344', fontSize: '13px', fontWeight: 'bold' }}>
                        الحصة {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => {
                    const matrix = schedulesByClass[selectedClassId] || {};
                    return (
                      <tr key={day} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{
                          padding: '12px 10px',
                          fontWeight: 'bold',
                          background: '#f1f5f9',
                          color: '#0e7490',
                          border: '1px solid #cbd5e1'
                        }}>
                          {day}
                        </td>
                        {PERIODS.map(p => {
                          const cell = matrix[`${day}-${p}`];
                          const hasContent = cell && (cell.subject || cell.teacherId);
                          const color = getSubjectColor(cell?.subject);

                          return (
                            <td key={p} style={{
                              padding: '8px',
                              height: '75px',
                              verticalAlign: 'middle',
                              border: '1px solid #cbd5e1',
                              background: hasContent ? color.bg : '#ffffff'
                            }}>
                              {hasContent ? (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '3px',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <span style={{
                                    fontWeight: '800',
                                    fontSize: '13px',
                                    color: color.text
                                  }}>
                                    {cell.subject}
                                  </span>
                                  {cell.teacherId && (
                                    <span style={{
                                      fontSize: '11px',
                                      color: '#475569',
                                      background: 'rgba(255, 255, 255, 0.85)',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      border: `1px solid ${color.border}`
                                    }}>
                                      {teacherMap[cell.teacherId] || 'معلم'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: '16px' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LEVEL 2: TEACHER SCHEDULE VIEW                                          */}
          {/* ========================================================================= */}
          {level === 'teacher' && (
            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0e7490', color: 'white' }}>
                    <th style={{ padding: '12px 14px', border: '1px solid #083344', width: '110px', fontSize: '14px' }}>اليوم / الحصة</th>
                    {PERIODS.map(p => (
                      <th key={p} style={{ padding: '12px 8px', border: '1px solid #083344', fontSize: '13px', fontWeight: 'bold' }}>
                        الحصة {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => {
                    return (
                      <tr key={day} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{
                          padding: '12px 10px',
                          fontWeight: 'bold',
                          background: '#f1f5f9',
                          color: '#0e7490',
                          border: '1px solid #cbd5e1'
                        }}>
                          {day}
                        </td>
                        {PERIODS.map(p => {
                          const cell = getTeacherCell(selectedTeacherId, day, p);
                          const color = getSubjectColor(cell?.subject);

                          return (
                            <td key={p} style={{
                              padding: '8px',
                              height: '75px',
                              verticalAlign: 'middle',
                              border: '1px solid #cbd5e1',
                              background: cell ? color.bg : '#ffffff'
                            }}>
                              {cell ? (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '3px',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <span style={{
                                    fontWeight: '800',
                                    fontSize: '13px',
                                    color: color.text
                                  }}>
                                    {cell.subject}
                                  </span>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: '#0e7490',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    padding: '1px 8px',
                                    borderRadius: '6px',
                                    border: `1px solid ${color.border}`
                                  }}>
                                    فصل: {cell.className}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: '16px' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* LEVEL 3: GENERAL MASTER SCHEDULE (ALL CLASSES & TEACHERS)               */}
          {/* ========================================================================= */}
          {level === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '24px' }}>
              {(generalDay === 'all' ? DAYS : [generalDay]).map(day => (
                <div key={day} style={{ pageBreakInside: 'avoid', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #0e7490, #155e75)',
                    color: 'white',
                    padding: '10px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>📅 جدول يوم: {day}</h3>
                    <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: '12px' }}>
                      عدد الفصول: ({classes.length})
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                          <th style={{ padding: '10px', border: '1px solid #cbd5e1', color: '#0e7490', width: '120px' }}>الفصل الدراسي</th>
                          {PERIODS.map(p => (
                            <th key={p} style={{ padding: '10px 6px', border: '1px solid #cbd5e1', color: '#0e7490', fontWeight: 'bold' }}>
                              الحصة {p}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classes.length === 0 ? (
                          <tr>
                            <td colSpan="9" style={{ padding: '20px', color: '#94a3b8' }}>لا توجد فصول مضافة</td>
                          </tr>
                        ) : (
                          classes.map((cls, idx) => {
                            const matrix = schedulesByClass[cls.id] || {};
                            return (
                              <tr key={cls.id} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <td style={{
                                  padding: '10px 8px',
                                  fontWeight: 'bold',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1',
                                  background: 'rgba(99, 178, 198, 0.1)'
                                }}>
                                  {cls.name}
                                </td>
                                {PERIODS.map(p => {
                                  const cell = matrix[`${day}-${p}`];
                                  const hasContent = cell && (cell.subject || cell.teacherId);
                                  const color = getSubjectColor(cell?.subject);

                                  return (
                                    <td key={p} style={{
                                      padding: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: hasContent ? color.bg : 'transparent',
                                      minWidth: '95px'
                                    }}>
                                      {hasContent ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontWeight: 'bold', color: color.text, fontSize: '11px' }}>
                                            {cell.subject}
                                          </span>
                                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                                            {teacherMap[cell.teacherId] || '—'}
                                          </span>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Official Notes and Instructions */}
          <div style={{
            margin: '18px 0 24px 0',
            padding: '12px 18px',
            background: 'rgba(248, 250, 252, 0.8)',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#475569',
            lineHeight: '1.7'
          }}>
            <strong>📌 تعليمات وضوابط الجدول المدرسي:</strong>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span>• زمن الحصة الدراسية: 45 دقيقة كاملة.</span>
              <span>• يبدأ الاصطفاف الصباحي الساعة 06:45 صباحاً وتبدأ الحصة الأولى 07:00 صباحاً.</span>
              <span>• يمنع إجراء أي تعديل أو تبديل للحصص دون الرجوع المسبق لإدارة المدرسة ووكيلي الشؤون المدرسية والتعليمية.</span>
            </div>
          </div>

          {/* Official Signatures & Official Stamp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '32px',
            paddingTop: '16px',
            borderTop: '2px dashed #cbd5e1',
            pageBreakInside: 'avoid'
          }}>
            <div style={{ textAlign: 'center', minWidth: '160px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>وكيل الشؤون التعليمية والمدرسية</div>
              <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>إعداد وتنسيق الجدول</div>
              <div style={{ height: '30px', borderBottom: '1px solid #94a3b8', margin: '4px auto', width: '130px' }}></div>
            </div>

            <div style={{ textAlign: 'center', minWidth: '150px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>الختم الرسمي للمدرسة</div>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: '2px dashed #0e7490',
                margin: '4px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0e7490',
                fontSize: '10px',
                fontWeight: 'bold',
                textAlign: 'center',
                lineHeight: '1.2'
              }}>
                ختم الإدارة<br />المعتمد
              </div>
            </div>

            <div style={{ textAlign: 'center', minWidth: '160px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>مدير مجمع المدارس</div>
              <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>{principalName}</div>
              <div style={{ height: '30px', borderBottom: '1px solid #94a3b8', margin: '4px auto', width: '130px' }}></div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
