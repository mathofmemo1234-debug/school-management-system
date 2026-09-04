import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Calendar, 
  Filter, 
  Users, 
  UserX, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Download,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Save,
  Check,
  X,
  School,
  GraduationCap
} from 'lucide-react';

export default function AttendanceSummaryExport({ schoolId }) {
  const { userData } = useAuth();
  const { t } = useLanguage();
  
  // Current Role: 'admin' | 'staff' | 'supervisor' | 'teacher'
  const role = userData?.role || 'staff';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isStaffOrDeputy = role === 'staff' || role === 'supervisor';

  // Navigation Sub-Tabs
  const [mainTab, setMainTab] = useState('summary'); // 'summary' | 'analytics' | 'record'

  // Data States
  const [students, setStudents] = useState([]);
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for Summary & Analytics
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'absent' | 'late' | 'present'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analyticsLevel, setAnalyticsLevel] = useState('school'); // 'school' | 'class' | 'student'
  const [analyticsStudentSearch, setAnalyticsStudentSearch] = useState('');

  // Recording / Editing State (For Admin & Deputy)
  const todayStr = new Date().toISOString().split('T')[0];
  const [recordDate, setRecordDate] = useState(todayStr);
  const [recordClass, setRecordClass] = useState('');
  const [recordClassStudents, setRecordClassStudents] = useState([]);
  const [currentRecords, setCurrentRecords] = useState({});
  const [currentNotes, setCurrentNotes] = useState({});
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [teachersMap, setTeachersMap] = useState({});
  const [classesMap, setClassesMap] = useState({});

  // 1. Fetch Students, Schedules, Teachers, Classes filtered by schoolId
  useEffect(() => {
    const targetSchoolId = schoolId || 'default_school_1';

    const qStudents = schoolId === 'ALL' 
      ? collection(db, 'students')
      : query(collection(db, 'students'), where('schoolId', '==', targetSchoolId));

    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(list);

      // Extract unique classes
      const clsSet = new Set();
      list.forEach(s => {
        const c = s.class || s.className;
        if (c) clsSet.add(c);
      });
      const sortedClasses = Array.from(clsSet).sort();
      setClassesList(sortedClasses);
      if (sortedClasses.length > 0 && !selectedClass) {
        // keep empty for all
      }
      if (sortedClasses.length > 0 && !recordClass) {
        setRecordClass(sortedClasses[0]);
      }
    });

    const qSchedules = schoolId === 'ALL'
      ? collection(db, 'schedules')
      : query(collection(db, 'schedules'), where('schoolId', '==', targetSchoolId));
    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qTeachers = schoolId === 'ALL'
      ? collection(db, 'teachers')
      : query(collection(db, 'teachers'), where('schoolId', '==', targetSchoolId));
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const tMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        tMap[d.id] = data.name;
        if (data.nationalId) tMap[data.nationalId] = data.name;
      });
      setTeachersMap(tMap);
    });

    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', targetSchoolId));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      const cMap = {};
      snap.docs.forEach(d => {
        cMap[d.id] = d.data().name;
      });
      setClassesMap(cMap);
    });

    return () => {
      unsubStudents();
      unsubSchedules();
      unsubTeachers();
      unsubClasses();
    };
  }, [schoolId]);

  // 2. Fetch Attendance Documents filtered by schoolId
  useEffect(() => {
    const targetSchoolId = schoolId || 'default_school_1';
    const qAttendance = schoolId === 'ALL'
      ? collection(db, 'attendance')
      : query(collection(db, 'attendance'), where('schoolId', '==', targetSchoolId));

    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendanceDocs(list);
      setLoading(false);
    });

    return () => unsubAttendance();
  }, [schoolId]);

  // 3. Sync Students & Current Records when editing attendance
  useEffect(() => {
    if (!recordClass) {
      setRecordClassStudents([]);
      setCurrentRecords({});
      setCurrentNotes({});
      return;
    }

    const filtered = students.filter(s => (s.class || s.className) === recordClass);
    setRecordClassStudents(filtered);

    // Find attendance for recordClass and recordDate
    const existingDoc = attendanceDocs.find(
      d => d.className === recordClass && d.date === recordDate
    );

    if (existingDoc && existingDoc.records) {
      setCurrentRecords({ ...existingDoc.records });
      setCurrentNotes(existingDoc.notes || {});
    } else {
      // Default all to present or empty
      const initial = {};
      filtered.forEach(s => {
        initial[s.id] = 'present';
      });
      setCurrentRecords(initial);
      setCurrentNotes({});
    }
  }, [recordClass, recordDate, attendanceDocs, students]);

  // Quick Date Preset Handler
  const handleSetDatePreset = (preset) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'week') {
      const start = new Date(now);
      const day = start.getDay(); // 0 is Sunday
      start.setDate(start.getDate() - day);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // 4. Map & Flatten Attendance Records with Student Details
  const allRecords = useMemo(() => {
    const studentById = new Map();
    const studentByNid = new Map();
    const studentByName = new Map();

    students.forEach(s => {
      if (s.id) studentById.set(s.id, s);
      if (s.nationalId) studentByNid.set(String(s.nationalId).trim(), s);
      if (s.name) studentByName.set(s.name.trim(), s);
    });

    const flattened = [];

    attendanceDocs.forEach(docData => {
      const docDate = docData.date || '';
      const docClass = docData.className || '';
      const records = docData.records || {};

      Object.entries(records).forEach(([studentKey, status]) => {
        let studentObj = studentById.get(studentKey) || 
                         studentByNid.get(String(studentKey).trim()) || 
                         studentByName.get(studentKey.trim());

        const studentName = studentObj?.name || studentKey;
        const studentNid = studentObj?.nationalId || (studentKey.match(/^\d+$/) ? studentKey : '—');
        const studentClass = studentObj?.class || studentObj?.className || docClass || '—';
        const studentId = studentObj?.id || studentKey;
        const studentNote = docData.notes?.[studentKey] || docData.notes?.[studentId] || '';

        let statusText = 'حاضر';
        let statusColor = '#16a34a';
        let statusBg = '#dcfce7';

        if (status === 'absent') {
          statusText = 'غائب';
          statusColor = '#dc2626';
          statusBg = '#fee2e2';
        } else if (status === 'late') {
          statusText = 'متأخر';
          statusColor = '#d97706';
          statusBg = '#fef3c7';
        } else if (status === 'excused') {
          statusText = 'غياب بعذر';
          statusColor = '#2563eb';
          statusBg = '#dbeafe';
        }

        flattened.push({
          id: `${docData.id}_${studentKey}`,
          studentId,
          studentName,
          nationalId: studentNid,
          className: studentClass,
          date: docDate,
          status,
          statusText,
          statusColor,
          statusBg,
          note: studentNote,
          rawDate: new Date(docDate).getTime() || 0
        });
      });
    });

    return flattened.sort((a, b) => b.rawDate - a.rawDate);
  }, [attendanceDocs, students]);

  // 5. Apply Filters
  const filteredRecords = useMemo(() => {
    return allRecords.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = item.studentName?.toLowerCase().includes(q);
        const matchNid = String(item.nationalId)?.toLowerCase().includes(q);
        if (!matchName && !matchNid) return false;
      }

      if (selectedClass && item.className !== selectedClass) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'absent' && item.status !== 'absent' && item.status !== 'excused') return false;
        if (statusFilter === 'late' && item.status !== 'late') return false;
        if (statusFilter === 'present' && item.status !== 'present') return false;
      }

      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      return true;
    });
  }, [allRecords, searchQuery, selectedClass, statusFilter, startDate, endDate]);

  // 6. Comprehensive Metrics for School, Class, & Student
  const schoolMetrics = useMemo(() => {
    const totalRecords = filteredRecords.length;
    if (totalRecords === 0) {
      return { total: 0, totalRecords: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0, absenceRate: 0, lateRate: 0 };
    }

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    filteredRecords.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
      else if (r.status === 'excused') excused++;
    });

    const attendanceRate = Math.round(((present + late) / totalRecords) * 100);
    const absenceRate = Math.round(((absent + excused) / totalRecords) * 100);
    const lateRate = Math.round((late / totalRecords) * 100);

    return { total: totalRecords, totalRecords, present, absent, late, excused, attendanceRate, absenceRate, lateRate };
  }, [filteredRecords]);

  const classMetrics = useMemo(() => {
    const map = new Map();

    classesList.forEach(cls => {
      map.set(cls, {
        className: cls,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        attendanceRate: 0,
        absenceRate: 0
      });
    });

    filteredRecords.forEach(r => {
      const cls = r.className;
      if (!map.has(cls)) {
        map.set(cls, {
          className: cls,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0,
          absenceRate: 0
        });
      }
      const entry = map.get(cls);
      entry.total++;
      if (r.status === 'present') entry.present++;
      else if (r.status === 'absent') entry.absent++;
      else if (r.status === 'late') entry.late++;
      else if (r.status === 'excused') entry.excused++;
    });

    const result = Array.from(map.values()).filter(c => c.total > 0);
    result.forEach(c => {
      c.attendanceRate = Math.round(((c.present + c.late) / c.total) * 100);
      c.absenceRate = Math.round(((c.absent + c.excused) / c.total) * 100);
    });

    return result.sort((a, b) => b.absenceRate - a.absenceRate);
  }, [filteredRecords, classesList]);

  const classStatsList = classMetrics;

  const studentMetrics = useMemo(() => {
    const map = new Map();

    filteredRecords.forEach(r => {
      const sid = r.studentId || r.studentName;
      if (!map.has(sid)) {
        map.set(sid, {
          id: sid,
          studentId: sid,
          name: r.studentName,
          nationalId: r.nationalId,
          className: r.className,
          totalDays: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          totalAbsences: 0,
          absenceRate: 0,
          attendanceRate: 0
        });
      }
      const entry = map.get(sid);
      entry.totalDays++;
      if (r.status === 'present') entry.present++;
      else if (r.status === 'absent') {
        entry.absent++;
        entry.totalAbsences++;
      } else if (r.status === 'late') {
        entry.late++;
      } else if (r.status === 'excused') {
        entry.excused++;
        entry.totalAbsences++;
      }
    });

    let list = Array.from(map.values());
    list.forEach(s => {
      s.absenceRate = s.totalDays > 0 ? Math.round((s.totalAbsences / s.totalDays) * 100) : 0;
      s.attendanceRate = s.totalDays > 0 ? Math.round(((s.present + s.late) / s.totalDays) * 100) : 0;
      let warningStatus = 'good';
      if (s.totalAbsences >= 5) warningStatus = 'danger';
      else if (s.totalAbsences >= 3) warningStatus = 'warning';
      s.warningStatus = warningStatus;
    });

    if (analyticsStudentSearch.trim()) {
      const q = analyticsStudentSearch.trim().toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || String(s.nationalId)?.toLowerCase().includes(q));
    }

    return list.sort((a, b) => b.totalAbsences - a.totalAbsences || b.late - a.late);
  }, [filteredRecords, analyticsStudentSearch]);

  const studentStatsList = studentMetrics;

  // 7. Save Attendance Record (For Admin & Deputy)
  const handleSaveAttendance = async () => {
    if (!recordClass) return;
    
    // Deputy can only edit today's attendance
    if (isStaffOrDeputy && !isAdmin && recordDate !== todayStr) {
      alert('عفواً، صلاحية الوكيل تسمح بتعديل ورصد غياب اليوم الحالي فقط.');
      return;
    }

    setIsSavingRecord(true);
    setSaveSuccessMsg('');
    try {
      const targetSchoolId = schoolId || 'default_school_1';
      const docId = `${targetSchoolId}_${recordClass.replace(/\//g, '-')}_${recordDate}`;
      const docRef = doc(db, 'attendance', docId);

      await setDoc(docRef, {
        schoolId: targetSchoolId,
        className: recordClass,
        date: recordDate,
        updatedBy: auth.currentUser?.email || userData?.name || 'admin',
        updatedByRole: role,
        records: currentRecords,
        notes: currentNotes,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveSuccessMsg('تم حفظ وتحديث سجل الحضور والغياب والملاحظات بنجاح!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert('حدث خطأ أثناء حفظ سجل الحضور: ' + err.message);
    } finally {
      setIsSavingRecord(false);
    }
  };

  // 8. Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('لا توجد بيانات غياب لتصديرها وفقاً للفلاتر الحالية');
      return;
    }

    const headers = ['م', 'اسم الطالب', 'رقم الهوية', 'الصف الدراسي', 'التاريخ', 'الحالة', 'الملاحظات'];
    const rows = filteredRecords.map((r, idx) => [
      idx + 1,
      `"${r.studentName || ''}"`,
      `"${r.nationalId || ''}"`,
      `"${r.className || ''}"`,
      `"${r.date || ''}"`,
      `"${r.statusText || ''}"`,
      `"${r.note || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ملخص_غياب_الطلاب_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Arabic day name of recordDate
  const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const recordDayArabic = dayNamesArabic[new Date(recordDate).getDay()] || 'الأحد';
  const recordClassSchedule = schedules.find(s => (classesMap[s.id] || s.className) === recordClass);

  return (
    <div className="attendance-report-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header & Tabs */}
      <div className="glass-panel no-print" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 6px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={26} color="#0e7490" /> متابعة وإحصائيات الحضور والغياب
          </h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>
            {isAdmin ? 'صلاحية المدير: إمكانية الرصد والتعديل لأي تاريخ واستعراض إحصائيات متكاملة' : 
             isStaffOrDeputy ? 'صلاحية الوكيل: إمكانية تعديل غياب أي طالب في اليوم الحالي والإحصائيات الشاملة' :
             'استعراض وتصدير كشوفات الحضور والغياب'}
          </p>
        </div>

        {/* Main Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setMainTab('summary')}
            className="btn"
            style={{
              background: mainTab === 'summary' ? 'var(--color-primary-dark)' : 'white',
              color: mainTab === 'summary' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={16} /> كشف وسجلات الغياب
          </button>

          <button
            onClick={() => setMainTab('analytics')}
            className="btn"
            style={{
              background: mainTab === 'analytics' ? 'var(--color-primary-dark)' : 'white',
              color: mainTab === 'analytics' ? 'white' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BarChart3 size={16} /> التحليل الإحصائي
          </button>

          {(isAdmin || isStaffOrDeputy) && (
            <button
              onClick={() => setMainTab('record')}
              className="btn"
              style={{
                background: mainTab === 'record' ? 'var(--color-primary-dark)' : 'white',
                color: mainTab === 'record' ? 'white' : 'var(--color-primary-dark)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck size={16} /> {isAdmin ? 'رصد وتعديل الغياب (المدير)' : 'تعديل الغياب (الوكيل)'}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: RECORD & EDIT ATTENDANCE (ADMIN & DEPUTY)           */}
      {/* ========================================================= */}
      {mainTab === 'record' && (isAdmin || isStaffOrDeputy) && (
        <div className="glass-panel" style={{ padding: '24px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#0e7490" /> 
                {isAdmin ? 'لوحة تسجيل وتعديل الحضور والغياب (صلاحية المدير العام)' : 'لوحة تعديل غياب طلاب المدرسة (صلاحية الوكيل - اليوم الحالي)'}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {isAdmin ? 'يمكنك اختيار أي تاريخ وفصل لتسجيل وتعديل الحالات وتحديث السجل فورياً' :
                 'يمكنك تعديل حالة أي طالب في المدرسة لليوم الحالي حصراً'}
              </p>
            </div>

            <button 
              onClick={handleSaveAttendance} 
              className="btn btn-primary"
              disabled={isSavingRecord || !recordClass}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '15px' }}
            >
              <Save size={18} /> {isSavingRecord ? 'جاري الحفظ...' : 'حفظ وتحديث السجل'}
            </button>
          </div>

          {saveSuccessMsg && (
            <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} /> {saveSuccessMsg}
            </div>
          )}

          {/* Control Bar: Class & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                اختر الفصل الدراسي
              </label>
              <select
                className="input-field"
                value={recordClass}
                onChange={e => setRecordClass(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                {classesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                تاريخ الرصد {isStaffOrDeputy && !isAdmin ? '(محدد باليوم الحالي)' : ''}
              </label>
              <input
                type="date"
                className="input-field"
                value={recordDate}
                disabled={isStaffOrDeputy && !isAdmin}
                onChange={e => setRecordDate(e.target.value)}
                style={{ marginBottom: 0, opacity: isStaffOrDeputy && !isAdmin ? 0.7 : 1 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                إجمالي طلاب الفصل: <strong>{recordClassStudents.length}</strong> طالب
              </div>
            </div>
          </div>

          {/* Class Daily Schedule Visualizer */}
          {recordClass && (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <Calendar size={16} /> جدول حصص فصل (<strong>{recordClass}</strong>) ليوم <strong>{recordDayArabic}</strong> ({recordDate}):
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(periodNum => {
                  const key = `${recordDayArabic}-${periodNum}`;
                  const cell = recordClassSchedule?.matrix?.[key];
                  const tName = cell?.teacherId ? (teachersMap[cell.teacherId] || 'معلم') : '';

                  return (
                    <div
                      key={periodNum}
                      style={{
                        background: cell?.subject ? 'white' : '#f1f5f9',
                        border: `1.5px solid ${cell?.subject ? '#cbd5e1' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                        الحصة {periodNum}
                      </div>
                      {cell?.subject ? (
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{cell.subject}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{tName}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attendance Table for Editing */}
          {recordClassStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              لا يوجد طلاب مسجلون في هذا الفصل
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontSize: '13px', width: '50px' }}>#</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px' }}>اسم الطالب</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px' }}>رقم الهوية</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>حاضر</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>غائب</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>متأخر</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center' }}>بعذر</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', width: '25%' }}>الملاحظات / سبب الغياب</th>
                  </tr>
                </thead>
                <tbody>
                  {recordClassStudents.map((student, idx) => {
                    const status = currentRecords[student.id] || 'present';
                    return (
                      <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#0f172a' }}>{student.name}</td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontFamily: 'monospace' }}>{student.nationalId || '—'}</td>
                        
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              name={`status_${student.id}`}
                              checked={status === 'present'}
                              onChange={() => setCurrentRecords(prev => ({ ...prev, [student.id]: 'present' }))}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                            <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: 'bold' }}>حاضر</span>
                          </label>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              name={`status_${student.id}`}
                              checked={status === 'absent'}
                              onChange={() => setCurrentRecords(prev => ({ ...prev, [student.id]: 'absent' }))}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                            <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 'bold' }}>غائب</span>
                          </label>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              name={`status_${student.id}`}
                              checked={status === 'late'}
                              onChange={() => setCurrentRecords(prev => ({ ...prev, [student.id]: 'late' }))}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                            <span style={{ color: '#d97706', fontSize: '12px', fontWeight: 'bold' }}>متأخر</span>
                          </label>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              name={`status_${student.id}`}
                              checked={status === 'excused'}
                              onChange={() => setCurrentRecords(prev => ({ ...prev, [student.id]: 'excused' }))}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                            <span style={{ color: '#2563eb', fontSize: '12px', fontWeight: 'bold' }}>بعذر</span>
                          </label>
                        </td>

                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            placeholder="اكتب ملاحظة..."
                            value={currentNotes[student.id] || ''}
                            onChange={e => setCurrentNotes(prev => ({ ...prev, [student.id]: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: COMPREHENSIVE ANALYTICS (SCHOOL / CLASS / STUDENT) */}
      {/* ========================================================= */}
      {mainTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filter Bar & Preset Buttons */}
          <div className="glass-panel" style={{ padding: '20px', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="#0e7490" /> تحديد الفترة الزمنية للتحليل الإحصائي
              </h3>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => handleSetDatePreset('today')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>اليوم</button>
                <button onClick={() => handleSetDatePreset('week')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>هذا الأسبوع</button>
                <button onClick={() => handleSetDatePreset('month')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>هذا الشهر</button>
                <button onClick={() => handleSetDatePreset('all')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>جميع السجلات</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>من تاريخ</label>
                <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ marginBottom: 0 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>إلى تاريخ</label>
                <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ marginBottom: 0 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>تصفية الفصل</label>
                <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ marginBottom: 0 }}>
                  <option value="">جميع الفصول</option>
                  {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Level Switcher: School / Class / Student */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setAnalyticsLevel('school')}
              className="btn"
              style={{
                flex: 1,
                padding: '12px',
                background: analyticsLevel === 'school' ? 'var(--color-primary-dark)' : 'white',
                color: analyticsLevel === 'school' ? 'white' : 'var(--color-primary-dark)',
                border: '1px solid var(--color-border)',
                fontWeight: 'bold',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <School size={18} /> 1. إحصائيات مستوى المدرسة
            </button>
            <button
              onClick={() => setAnalyticsLevel('class')}
              className="btn"
              style={{
                flex: 1,
                padding: '12px',
                background: analyticsLevel === 'class' ? 'var(--color-primary-dark)' : 'white',
                color: analyticsLevel === 'class' ? 'white' : 'var(--color-primary-dark)',
                border: '1px solid var(--color-border)',
                fontWeight: 'bold',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Users size={18} /> 2. إحصائيات مستوى الفصول
            </button>
            <button
              onClick={() => setAnalyticsLevel('student')}
              className="btn"
              style={{
                flex: 1,
                padding: '12px',
                background: analyticsLevel === 'student' ? 'var(--color-primary-dark)' : 'white',
                color: analyticsLevel === 'student' ? 'white' : 'var(--color-primary-dark)',
                border: '1px solid var(--color-border)',
                fontWeight: 'bold',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <GraduationCap size={18} /> 3. إحصائيات مستوى الطلاب
            </button>
          </div>

          {/* 1. School Level Analytics View */}
          {analyticsLevel === 'school' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card glass-panel" style={{ background: 'white' }}>
                  <div className="stat-icon" style={{ color: '#16a34a', background: '#dcfce7' }}>
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="stat-info">
                    <p>نسبة الحضور العامة</p>
                    <h3 style={{ color: '#16a34a' }}>{schoolMetrics.attendanceRate}%</h3>
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ background: 'white' }}>
                  <div className="stat-icon" style={{ color: '#dc2626', background: '#fee2e2' }}>
                    <UserX size={28} />
                  </div>
                  <div className="stat-info">
                    <p>نسبة الغياب الإجمالية</p>
                    <h3 style={{ color: '#dc2626' }}>{schoolMetrics.absenceRate}% ({schoolMetrics.absent + schoolMetrics.excused})</h3>
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ background: 'white' }}>
                  <div className="stat-icon" style={{ color: '#d97706', background: '#fef3c7' }}>
                    <Clock size={28} />
                  </div>
                  <div className="stat-info">
                    <p>إجمالي حالات التأخر</p>
                    <h3 style={{ color: '#d97706' }}>{schoolMetrics.late}</h3>
                  </div>
                </div>

                <div className="stat-card glass-panel" style={{ background: 'white' }}>
                  <div className="stat-icon" style={{ color: '#0e7490', background: '#e0f2fe' }}>
                    <Users size={28} />
                  </div>
                  <div className="stat-info">
                    <p>إجمالي السجلات المرصودة</p>
                    <h3 style={{ color: '#0e7490' }}>{schoolMetrics.total}</h3>
                  </div>
                </div>
              </div>

              {/* Graphical Progress Bars */}
              <div className="glass-panel" style={{ padding: '24px', background: 'white' }}>
                <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-primary-dark)' }}>مؤشرات توزيع الحضور والغياب بالمدرسة</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                      <span style={{ color: '#16a34a' }}>الحضور المنتظم ({schoolMetrics.present} طالب)</span>
                      <span>{schoolMetrics.attendanceRate}%</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '14px', overflow: 'hidden' }}>
                      <div style={{ background: '#16a34a', width: `${schoolMetrics.attendanceRate}%`, height: '100%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                      <span style={{ color: '#dc2626' }}>الغياب بدون عذر ({schoolMetrics.absent} طالب)</span>
                      <span>{schoolMetrics.total > 0 ? Math.round((schoolMetrics.absent / schoolMetrics.total) * 100) : 0}%</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '14px', overflow: 'hidden' }}>
                      <div style={{ background: '#dc2626', width: `${schoolMetrics.total > 0 ? (schoolMetrics.absent / schoolMetrics.total) * 100 : 0}%`, height: '100%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                      <span style={{ color: '#2563eb' }}>الغياب بعذر مقبول ({schoolMetrics.excused} طالب)</span>
                      <span>{schoolMetrics.total > 0 ? Math.round((schoolMetrics.excused / schoolMetrics.total) * 100) : 0}%</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '14px', overflow: 'hidden' }}>
                      <div style={{ background: '#2563eb', width: `${schoolMetrics.total > 0 ? (schoolMetrics.excused / schoolMetrics.total) * 100 : 0}%`, height: '100%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                      <span style={{ color: '#d97706' }}>التأخر الصباحي ({schoolMetrics.late} طالب)</span>
                      <span>{schoolMetrics.lateRate}%</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '8px', height: '14px', overflow: 'hidden' }}>
                      <div style={{ background: '#d97706', width: `${schoolMetrics.lateRate}%`, height: '100%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Class Level Analytics View */}
          {analyticsLevel === 'class' && (
            <div className="glass-panel" style={{ padding: '24px', background: 'white' }}>
              <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-primary-dark)' }}>مقارنة أداء وانضباط الفصول الدراسية</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px', fontSize: '13px' }}>الفصل الدراسي</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>إجمالي السجلات</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>نسبة الحضور</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>الغياب</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>التأخر</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>التقييم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStatsList.map((c, idx) => (
                      <tr key={c.className} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{c.className}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{c.total}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: c.attendanceRate >= 90 ? '#16a34a' : '#dc2626' }}>
                          {c.attendanceRate}%
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>
                          {c.absent + c.excused}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#d97706' }}>
                          {c.late}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            background: c.attendanceRate >= 90 ? '#dcfce7' : c.attendanceRate >= 75 ? '#fef3c7' : '#fee2e2',
                            color: c.attendanceRate >= 90 ? '#166534' : c.attendanceRate >= 75 ? '#92400e' : '#991b1b'
                          }}>
                            {c.attendanceRate >= 90 ? 'ممتاز' : c.attendanceRate >= 75 ? 'متوسط' : 'يحتاج متابعة'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Student Level Analytics View */}
          {analyticsLevel === 'student' && (
            <div className="glass-panel" style={{ padding: '24px', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>سجل انضباط وغياب الطلاب</h4>
                
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="بحث باسم الطالب أو الهوية..."
                    value={analyticsStudentSearch}
                    onChange={e => setAnalyticsStudentSearch(e.target.value)}
                    style={{ paddingRight: '34px', marginBottom: 0, fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px', fontSize: '13px' }}>#</th>
                      <th style={{ padding: '12px', fontSize: '13px' }}>اسم الطالب</th>
                      <th style={{ padding: '12px', fontSize: '13px' }}>الفصل</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>أيام الغياب</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>أيام التأخر</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>نسبة الحضور</th>
                      <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>حالة الإنذار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentStatsList.map((s, idx) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{s.name}</td>
                        <td style={{ padding: '12px', color: '#475569' }}>{s.className}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: s.totalAbsences > 0 ? '#dc2626' : '#16a34a' }}>
                          {s.totalAbsences}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#d97706' }}>{s.late}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{s.attendanceRate}%</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: s.warningStatus === 'good' ? '#dcfce7' : s.warningStatus === 'warning' ? '#fef3c7' : '#fee2e2',
                            color: s.warningStatus === 'good' ? '#166534' : s.warningStatus === 'warning' ? '#92400e' : '#991b1b'
                          }}>
                            {s.warningStatus === 'good' ? '🟢 منتظم' : s.warningStatus === 'warning' ? '🟡 إنذار أول (3+ أيام)' : '🔴 إنذار نهائي (5+ أيام)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SUMMARY & EXPORT REPORT (ORIGINAL FEATURE ENHANCED)*/}
      {/* ========================================================= */}
      {mainTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Actions & Export */}
          <div className="glass-panel no-print" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => handleSetDatePreset('today')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>اليوم</button>
              <button onClick={() => handleSetDatePreset('week')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>هذا الأسبوع</button>
              <button onClick={() => handleSetDatePreset('month')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>هذا الشهر</button>
              <button onClick={() => handleSetDatePreset('all')} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#f1f5f9' }}>الكل</button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleExportCSV} 
                className="btn" 
                style={{ 
                  background: '#047857', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <Download size={18} /> تصدير Excel (CSV)
              </button>
              
              <button 
                onClick={() => window.print()} 
                className="btn btn-primary" 
                style={{ 
                  background: 'linear-gradient(135deg, #0e7490, #63B2C6)', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <Printer size={18} /> طباعة / تصدير PDF
              </button>
            </div>
          </div>

          {/* Metrics Summary Cards */}
          <div className="stats-grid no-print" style={{ marginBottom: 0 }}>
            <div className="stat-card glass-panel" style={{ background: 'white' }}>
              <div className="stat-icon" style={{ color: '#dc2626', background: '#fee2e2' }}>
                <UserX size={28} />
              </div>
              <div className="stat-info">
                <p>إجمالي الغياب</p>
                <h3 style={{ color: '#dc2626' }}>{schoolMetrics.absent}</h3>
              </div>
            </div>

            <div className="stat-card glass-panel" style={{ background: 'white' }}>
              <div className="stat-icon" style={{ color: '#d97706', background: '#fef3c7' }}>
                <Clock size={28} />
              </div>
              <div className="stat-info">
                <p>إجمالي التأخر</p>
                <h3 style={{ color: '#d97706' }}>{schoolMetrics.late}</h3>
              </div>
            </div>

            <div className="stat-card glass-panel" style={{ background: 'white' }}>
              <div className="stat-icon" style={{ color: '#16a34a', background: '#dcfce7' }}>
                <CheckCircle2 size={28} />
              </div>
              <div className="stat-info">
                <p>إجمالي الحضور</p>
                <h3 style={{ color: '#16a34a' }}>{schoolMetrics.present}</h3>
              </div>
            </div>

            <div className="stat-card glass-panel" style={{ background: 'white' }}>
              <div className="stat-icon" style={{ color: '#0e7490', background: '#e0f2fe' }}>
                <Users size={28} />
              </div>
              <div className="stat-info">
                <p>إجمالي السجلات المفلترة</p>
                <h3 style={{ color: '#0e7490' }}>{schoolMetrics.total}</h3>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="glass-panel no-print" style={{ padding: '20px', background: 'white' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                  بحث بالاسم أو الهوية
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ادخل الاسم أو رقم الهوية..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingRight: '38px', marginBottom: 0 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                  الصف / الفصل الدراسي
                </label>
                <select
                  className="input-field"
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  style={{ marginBottom: 0 }}
                >
                  <option value="">جميع الفصول</option>
                  {classesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                  حالة الحضور
                </label>
                <select
                  className="input-field"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ marginBottom: 0 }}
                >
                  <option value="all">جميع الحالات</option>
                  <option value="absent">الغياب فقط (غياب / بعذر)</option>
                  <option value="late">التأخر فقط</option>
                  <option value="present">الحضور فقط</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                  من تاريخ
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '6px' }}>
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
              </div>
            </div>
          </div>

          {/* Printable Report View */}
          <div className="glass-panel print-area" style={{ padding: '24px', background: 'white' }}>
            
            {/* Official Print Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #0e7490',
              paddingBottom: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ textAlign: 'right', fontSize: '12px', lineHeight: '1.6' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0e7490' }}>المملكة العربية السعودية</div>
                <div>وزارة التعليم</div>
                <div>إدارة التعليم</div>
                <div style={{ fontWeight: 'bold' }}>{userData?.schoolName || 'المجمع التعليمي'}</div>
              </div>

              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '6px' }}>
                  <img
                    src={`${import.meta.env.BASE_URL}minst.svg`}
                    alt="وزارة التعليم"
                    style={{ height: '65px', width: 'auto', maxWidth: '110px', objectFit: 'contain', display: 'block' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                    }}
                  />
                  <div style={{ width: '1.5px', height: '38px', background: '#cbd5e1' }}></div>
                  <img
                    src={userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`}
                    alt="شعار المدرسة"
                    style={{ height: '58px', width: 'auto', maxWidth: '90px', objectFit: 'contain', display: 'block' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                    }}
                  />
                </div>
                <h2 style={{ margin: '0 0 2px 0', color: '#0e7490', fontSize: '16px' }}>
                  تقرير وكشف سجلات الحضور والغياب اليومي
                </h2>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  العام الدراسي: 1447 / 1448 هـ
                </div>
              </div>

              <div style={{ textAlign: 'left', fontSize: '12px', lineHeight: '1.6' }}>
                <div><strong>تاريخ التقرير:</strong> {new Date().toLocaleDateString('ar-SA')}</div>
                <div><strong>الفصل المحدد:</strong> {selectedClass || 'جميع الفصول'}</div>
                <div><strong>المستخرج:</strong> {userData?.name || 'وكيل شؤون الطلاب'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '15px' }}>
                كشف السجلات الميدانية ({filteredRecords.length} سجل)
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                جاري تحميل سجلات الغياب...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <AlertCircle size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '15px' }}>لا توجد سجلات مطابقة لمعايير البحث المحددة</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>#</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>اسم الطالب</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>رقم الهوية</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>الصف الدراسي</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>التاريخ</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>الحالة</th>
                      <th style={{ padding: '12px 14px', fontSize: '13px' }}>الملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((item, index) => (
                      <tr 
                        key={item.id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          background: index % 2 === 0 ? 'white' : '#fafafa'
                        }}
                      >
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                          {item.studentName}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                          {item.nationalId}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569' }}>
                          <span style={{ background: 'rgba(99, 178, 198, 0.15)', color: '#0e7490', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                            {item.className}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#475569' }}>
                          {item.date}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: item.statusColor,
                            background: item.statusBg,
                            border: `1px solid ${item.statusColor}33`
                          }}>
                            {item.statusText}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: '#64748b' }}>
                          {item.note ? (
                            <span style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'inline-block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={item.note}>
                              💬 {item.note}
                            </span>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print Styles */}
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
            font-size: 10pt !important;
          }
          body * {
            visibility: hidden;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
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
          table {
            width: 100% !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
        }
      `}</style>
    </div>
  );
}
