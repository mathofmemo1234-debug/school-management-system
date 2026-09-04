import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Users, Search, BookOpen, Download, Building, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function PrintStudentRecordsModal({ students = [], classesList = [], onClose }) {
  const { userData } = useAuth();
  
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' (كشف مجمع) | 'cards' (بطاقات فردية)

  const schoolName = userData?.schoolName || 'المجمع التعليمي';
  const principalName = userData?.principalName || 'إدارة المدرسة';

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedClass && (s.class !== selectedClass && s.className !== selectedClass)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchNid = String(s.nationalId)?.toLowerCase().includes(q);
        if (!matchName && !matchNid) return false;
      }
      return true;
    });
  }, [students, selectedClass, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;
    const headers = ['م', 'اسم الطالب', 'رقم الهوية', 'الجنسية', 'الصف الدراسي', 'رقم ولي الأمر / واتساب'];
    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.name || ''}"`,
      `"${s.nationalId || ''}"`,
      `"${s.nationality || 'سعودي'}"`,
      `"${s.class || s.className || ''}"`,
      `"${s.parentPhone || s.whatsapp || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `سجل_قيد_الطلاب_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalJSX = (
    <div className="students-modal-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div className="students-modal-dialog glass-panel" style={{
        width: '950px',
        maxWidth: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Controls Bar (Hidden during Print) */}
        <div className="no-print" style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} color="#0e7490" /> طباعة سجلات وقوائم قيد الطلاب
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
              إمكانية طباعة كشف عام أو بطاقات فردية أو تصدير Excel
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSV}
              className="btn"
              style={{
                background: '#047857',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Download size={16} /> تصدير Excel
            </button>

            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                fontWeight: 'bold',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Printer size={18} /> طباعة السجل (PDF)
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
              <X size={20} color="#475569" />
            </button>
          </div>
        </div>

        {/* Filters Toolbar (Hidden during Print) */}
        <div className="no-print" style={{ padding: '14px 24px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                تصفية حسب الفصل:
              </label>
              <select
                className="input-field"
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
              >
                <option value="">جميع الفصول ({students.length} طالب)</option>
                {classesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                بحث بالاسم أو رقم الهوية:
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="ابحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                نمط العرض والطباعة:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: viewMode === 'list' ? '#0e7490' : 'white',
                    color: viewMode === 'list' ? 'white' : '#334155',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  كشف مسرد
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: viewMode === 'cards' ? '#0e7490' : 'white',
                    color: viewMode === 'cards' ? 'white' : '#334155',
                    border: '1px solid #cbd5e1'
                  }}
                >
                  بطاقات فردية
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Printable Area */}
        <div className="printable-students-page" style={{
          padding: '36px 44px',
          background: 'white',
          color: '#0f172a',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
          
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #0e7490',
            paddingBottom: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ textAlign: 'right', fontSize: '12px', lineHeight: '1.6' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0e7490' }}>المملكة العربية السعودية - وزارة التعليم</div>
              <div>الإدارة العامة للتعليم بمحافظة جدة</div>
              <div style={{ fontWeight: 'bold' }}>{schoolName}</div>
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
              <h2 style={{ margin: '0 0 4px 0', color: '#0e7490', fontSize: '17px' }}>
                {selectedClass ? `سجل وقيد طلاب فصل: ${selectedClass}` : 'سجل وقيد طلاب المدرسة'}
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                إجمالي الطلاب المدرجين: ({filteredStudents.length}) طالب • العام الدراسي: 1447 / 1448 هـ
              </div>
            </div>

            <div style={{ textAlign: 'left', fontSize: '12px', lineHeight: '1.6' }}>
              <div><strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString('ar-SA')}</div>
              <div><strong>المستخرج:</strong> {userData?.name || 'وكيل شؤون الطلاب'}</div>
            </div>
          </div>

          {/* List Mode View */}
          {viewMode === 'list' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 12px', color: '#0e7490', width: '40px' }}>#</th>
                    <th style={{ padding: '10px 12px', color: '#0e7490' }}>اسم الطالب الرباعي</th>
                    <th style={{ padding: '10px 12px', color: '#0e7490' }}>رقم الهوية الوطنية</th>
                    <th style={{ padding: '10px 12px', color: '#0e7490' }}>الجنسية</th>
                    <th style={{ padding: '10px 12px', color: '#0e7490' }}>الصف الدراسي</th>
                    <th style={{ padding: '10px 12px', color: '#0e7490' }}>رقم ولي الأمر / واتساب</th>
                    <th style={{ padding: '10px 12px', color: '#0e7490', textAlign: 'center' }}>ملاحظات القيد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        لا توجد سجلات مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, idx) => (
                      <tr key={student.id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{student.name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#334155' }}>{student.nationalId}</td>
                        <td style={{ padding: '10px 12px', color: '#0e7490', fontWeight: '600' }}>{student.nationality || 'سعودي'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: 'rgba(99, 178, 198, 0.15)', color: '#0e7490', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>
                            {student.class || student.className || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>{student.parentPhone || student.whatsapp || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#16a34a', fontWeight: '600' }}>منتظم</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Individual Cards Mode */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {filteredStudents.map((student, idx) => (
                <div key={student.id || idx} style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '16px',
                  background: '#f8fafc',
                  pageBreakInside: 'avoid'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#0e7490', fontSize: '15px' }}>{student.name}</h4>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>#{idx + 1}</span>
                  </div>
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#334155' }}>
                    <div><strong>الهوية:</strong> {student.nationalId}</div>
                    <div><strong>الجنسية:</strong> {student.nationality || 'سعودي'}</div>
                    <div><strong>الصف:</strong> {student.class || student.className || '—'}</div>
                    <div><strong>رقم ولي الأمر:</strong> {student.parentPhone || student.whatsapp || '—'}</div>
                    <div><strong>حالة القيد:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>منتظم بالدراسة</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Signatures */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '40px',
            paddingTop: '20px',
            borderTop: '2px dashed #cbd5e1',
            pageBreakInside: 'avoid'
          }}>
            <div style={{ textAlign: 'center', minWidth: '150px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>وكيل شؤون الطلاب</div>
              <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>إعداد وتدقيق</div>
              <div style={{ height: '35px', borderBottom: '1px solid #94a3b8', margin: '4px auto', width: '120px' }}></div>
            </div>

            <div style={{ textAlign: 'center', minWidth: '150px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>الختم الرسمي</div>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '2px dashed #0e7490',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#0e7490',
                fontWeight: 'bold'
              }}>
                معتمد
              </div>
            </div>

            <div style={{ textAlign: 'center', minWidth: '150px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>مدير المجمع والمدرسة</div>
              <div style={{ fontWeight: 'bold', color: '#0e7490', fontSize: '14px' }}>{principalName}</div>
              <div style={{ height: '35px', borderBottom: '1px solid #94a3b8', margin: '4px auto', width: '120px' }}></div>
            </div>
          </div>

        </div>

      </div>

      {/* Print CSS */}
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
            font-size: 10.5pt !important;
          }
          /* Completely hide EVERYTHING under body except the modal container so NO blank pages exist! */
          body > *:not(.students-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .students-modal-root,
          .students-modal-dialog {
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
          .printable-students-page, .printable-students-page * {
            visibility: visible !important;
          }
          .printable-students-page {
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

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
