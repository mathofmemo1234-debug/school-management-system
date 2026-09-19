import React, { useState } from 'react';
import { X, Plus, BookOpen } from 'lucide-react';

export const STANDARD_SCHOOL_SUBJECTS = [
  'القرآن الكريم',
  'الدراسات الإسلامية',
  'التفسير',
  'الحديث',
  'الفقه',
  'التوحيد',
  'اللغة العربية',
  'لغتي الجميلة',
  'لغتي الخالدة',
  'الكفايات اللغوية',
  'البلاغة والنقد',
  'الأدب العربي',
  'الرياضيات',
  'الرياضيات المتقدمة',
  'العلوم',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'علم البيئة',
  'الجيولوجيا والعلوم والبيئة',
  'الدراسات الاجتماعية',
  'التاريخ',
  'الجغرافيا',
  'المواطنة الرقمية',
  'اللغة الإنجليزية',
  'English Language',
  'المهارات الرقمية',
  'الحاسب وتقنية المعلومات',
  'علم البيانات',
  'الذكاء الاصطناعي',
  'هندسة البرمجيات',
  'التربية الفنية',
  'التربية البدنية والدفاع عن النفس',
  'المهارات الحياتية والأسرية',
  'التفكير الناقد',
  'التربية المهنية',
  'إدارة الفعاليات',
  'مبادئ الإدارة',
  'صناعة القرار في الأعمال'
];

export default function TeacherSubjectSelector({
  selectedSubjects = [],
  onChange,
  availableSubjects = [],
  label = 'المواد المسندة للمعلم'
}) {
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Combine standard subjects with any school-specific custom subjects
  const allAvailableSubjects = Array.from(
    new Set([
      ...availableSubjects.filter(Boolean),
      ...STANDARD_SCHOOL_SUBJECTS
    ])
  );

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    if (!selectedSubjects.includes(val)) {
      onChange([...selectedSubjects, val]);
    }
    e.target.value = '';
  };

  const handleAddCustom = () => {
    const trimmed = customSubjectInput.trim();
    if (!trimmed) return;
    if (!selectedSubjects.includes(trimmed)) {
      onChange([...selectedSubjects, trimmed]);
    }
    setCustomSubjectInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const handleRemove = (subjectToRemove) => {
    onChange(selectedSubjects.filter(s => s !== subjectToRemove));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: '500', margin: 0 }}>
        <BookOpen size={16} color="var(--color-primary)" />
        {label} <span style={{ fontSize: '12px', color: '#888' }}>(يمكنك اختيار أكثر من مادة أو كتابتها يدوياً)</span>
      </label>

      {/* Selected subjects tags */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        minHeight: '38px',
        padding: '6px 10px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        alignItems: 'center'
      }}>
        {selectedSubjects.length === 0 ? (
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            لم يتم إسناد أي مادة بعد. اختر من القائمة أو اكتب أدناه:
          </span>
        ) : (
          selectedSubjects.map((subj, idx) => (
            <span
              key={idx}
              style={{
                background: 'rgba(99, 178, 198, 0.18)',
                color: 'var(--color-primary-dark)',
                border: '1px solid rgba(99, 178, 198, 0.4)',
                borderRadius: '16px',
                padding: '3px 10px',
                fontSize: '13px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {subj}
              <button
                type="button"
                onClick={() => handleRemove(subj)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e11d48',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="إزالة المادة"
              >
                <X size={14} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Controls: Dropdown & Manual Input */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* Dropdown */}
        <select
          className="input-field"
          style={{ flex: 1, minWidth: '180px', margin: 0, padding: '8px 12px' }}
          onChange={handleSelectChange}
          defaultValue=""
        >
          <option value="" disabled>-- اختر مادة من القائمة --</option>
          {allAvailableSubjects.map((s, idx) => (
            <option key={idx} value={s} disabled={selectedSubjects.includes(s)}>
              {s} {selectedSubjects.includes(s) ? '(تمت إضافتها)' : ''}
            </option>
          ))}
        </select>

        {/* Manual Input */}
        <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="input-field"
            style={{ flex: 1, margin: 0, padding: '8px 12px' }}
            placeholder="أو اكتب اسم مادة يدوياً..."
            value={customSubjectInput}
            onChange={(e) => setCustomSubjectInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="btn"
            style={{
              background: '#0e7490',
              color: 'white',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              borderRadius: '8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={handleAddCustom}
            title="إضافة المادة المكتوبة"
          >
            <Plus size={16} /> إضافة
          </button>
        </div>
      </div>
    </div>
  );
}
