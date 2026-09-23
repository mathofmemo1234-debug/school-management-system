/**
 * studentSorting.js
 * أدوات فرز الطلاب المعيارية تدعم اللغة العربية وأرقام الهوية والدرجات
 */

// دالة استخراج اسم الطالب بمرونة من أي هيكل بيانات
function extractStudentName(item) {
  if (!item) return '';
  return item.student?.name || item.studentName || item.name || '';
}

// دالة استخراج رقم هوية / رقم الطالب بمرونة
function extractStudentId(item) {
  if (!item) return '';
  return item.student?.nationalId || item.studentNationalId || item.nationalId || item.id || '';
}

// دالة استخراج الدرجة إن وجدت
function extractStudentScore(item) {
  if (!item) return 0;
  if (item.actualRecordedTotalScore !== undefined) {
    return parseFloat(item.actualRecordedTotalScore) || 0;
  }
  if (item.overall && item.overall.percentage !== undefined) {
    return parseFloat(item.overall.percentage) || 0;
  }
  if (item.calculation && item.calculation.totalScore !== undefined) {
    return parseFloat(item.calculation.totalScore) || 0;
  }
  if (item.score !== undefined) {
    return parseFloat(item.score) || 0;
  }
  if (item.totalScore !== undefined) {
    return parseFloat(item.totalScore) || 0;
  }
  return 0;
}

/**
 * دالة فرز قائمة الطلاب
 * @param {Array} list - مصفوفة العناصر
 * @param {String} sortType - نوع الفرز: 'name_asc' | 'name_desc' | 'id_asc' | 'id_desc' | 'score_desc' | 'score_asc' | 'default'
 */
export function sortStudentList(list = [], sortType = 'default') {
  if (!Array.isArray(list) || list.length <= 1) return list;
  if (!sortType || sortType === 'default') return [...list];

  const sorted = [...list];

  sorted.sort((a, b) => {
    if (sortType === 'name_asc') {
      const nameA = extractStudentName(a);
      const nameB = extractStudentName(b);
      return nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' });
    }
    if (sortType === 'name_desc') {
      const nameA = extractStudentName(a);
      const nameB = extractStudentName(b);
      return nameB.localeCompare(nameA, 'ar', { sensitivity: 'base' });
    }
    if (sortType === 'id_asc') {
      const idA = String(extractStudentId(a));
      const idB = String(extractStudentId(b));
      return idA.localeCompare(idB, undefined, { numeric: true });
    }
    if (sortType === 'id_desc') {
      const idA = String(extractStudentId(a));
      const idB = String(extractStudentId(b));
      return idB.localeCompare(idA, undefined, { numeric: true });
    }
    if (sortType === 'score_desc') {
      return extractStudentScore(b) - extractStudentScore(a);
    }
    if (sortType === 'score_asc') {
      return extractStudentScore(a) - extractStudentScore(b);
    }
    return 0;
  });

  return sorted;
}

// خيارات الفرز المعيارية لعرضها في القوائم المنسدلة وشاشات النظام
export const STUDENT_SORT_OPTIONS = [
  { value: 'default', label: 'الترتيب الافتراضي' },
  { value: 'name_asc', label: 'اسم الطالب أبجدياً (أ - ي)' },
  { value: 'name_desc', label: 'اسم الطالب عكسياً (ي - أ)' },
  { value: 'id_asc', label: 'رقم الهوية / السجل (تصاعدي)' },
  { value: 'id_desc', label: 'رقم الهوية / السجل (تنازلي)' },
  { value: 'score_desc', label: 'الدرجة الكلية (الأعلى أولاً)' },
  { value: 'score_asc', label: 'الدرجة الكلية (الأدنى أولاً)' }
];
