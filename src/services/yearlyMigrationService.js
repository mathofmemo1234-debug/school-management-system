import { db, storage } from '../firebase';
import { 
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, query, where, orderBy 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * MSC Advanced Schools - Annual Data Migration & Academic Year Setup Service
 * خدمة ترحيل البيانات السنوية وتأسيس العام الدراسي الجديد
 * مصممة خصيصاً لمنصة "بوابة المدارس المتقدمة" بصلاحيات السوبر أدمن (Super Admin)
 */

export const MIGRATION_COLLECTIONS_CONFIG = [
  // 1. البيانات الهيكلية والأساسية (تُؤرشف وتُحمى من المسح)
  { id: 'schools', label: 'مجمعات وفروع المدارس المتقدمة', category: 'core', clearable: false },
  { id: 'users', label: 'حسابات المستخدمين والكوادر', category: 'core', clearable: false },
  { id: 'teachers', label: 'سجلات وبيانات المعلمين', category: 'staff', clearable: false },
  { id: 'students', label: 'سجلات وبيانات الطلاب', category: 'students', clearable: false },
  { id: 'parents', label: 'بيانات أولياء الأمور', category: 'parents', clearable: false },
  { id: 'staff', label: 'الكادر الإداري والوكلاء', category: 'staff', clearable: false },
  { id: 'supervisors', label: 'المشرفون التربويون والتعليميون', category: 'supervisors', clearable: false },
  { id: 'classes', label: 'الفصول والقاعات الدراسية', category: 'academic', clearable: false },

  // 2. الجداول التشغيلية السنوية (تُؤرشف وتُصفّر لبدء عام دراسي جديد)
  { id: 'attendance', label: 'سجلات الحضور والغياب اليومي', category: 'operational', clearable: true, defaultReset: true },
  { id: 'preparations', label: 'تحاضير الدروس (النماذج العامة)', category: 'academic', clearable: true, defaultReset: true },
  { id: 'lesson_preparations', label: 'تحضيرات المعلمين والمرفقات اليومية', category: 'academic', clearable: true, defaultReset: true },
  { id: 'weekly_plans', label: 'الخطط الأسبوعية المدرسية', category: 'academic', clearable: true, defaultReset: true },
  { id: 'assignments', label: 'الواجبات والتكليفات المدرسية', category: 'academic', clearable: true, defaultReset: true },
  { id: 'assignment_results', label: 'نتائج وتقييمات الواجبات', category: 'academic', clearable: true, defaultReset: true },
  { id: 'submissions', label: 'تسليمات وإجابات الطلاب للواجبات', category: 'academic', clearable: true, defaultReset: true },
  { id: 'exams', label: 'الاختبارات وبنوك الأسئلة الدورية', category: 'exams', clearable: true, defaultReset: true },
  { id: 'exam_results', label: 'نتائج الاختبارات والدرجات الدورية', category: 'exams', clearable: true, defaultReset: true },
  { id: 'exam_submissions', label: 'تسليمات الاختبارات الإلكترونية', category: 'exams', clearable: true, defaultReset: true },
  { id: 'grades', label: 'كشوف ورصد الدرجات الفصلي والنهائي', category: 'exams', clearable: true, defaultReset: true },
  { id: 'student_evaluations', label: 'سجلات تقييم سلوك ومواظبة الطلاب', category: 'evaluations', clearable: true, defaultReset: true },
  { id: 'evaluations', label: 'تقييمات الأداء المهني والإشرافي', category: 'evaluations', clearable: true, defaultReset: true },
  { id: 'classroom_visits', label: 'سجلات الزيارات الصفية للمشرفين والمدراء', category: 'evaluations', clearable: true, defaultReset: true },
  { id: 'schedules', label: 'الجداول المدرسية وحصص المعلمين', category: 'academic', clearable: true, defaultReset: true },
  { id: 'school_messages', label: 'المراسلات والتعاميم المدرسية اليومية', category: 'messaging', clearable: true, defaultReset: true },
  { id: 'announcements', label: 'الإعلانات المدرسية الدورية', category: 'messaging', clearable: true, defaultReset: true },
  { id: 'notifications', label: 'الإشعارات والتنبيهات اللحظية', category: 'messaging', clearable: true, defaultReset: true },
  { id: 'excellence_files', label: 'ملفات ومعايير التميز المؤسسي', category: 'excellence', clearable: false },
  { id: 'portfolios', label: 'ملفات الإنجاز السنوية', category: 'portfolios', clearable: false },
  { id: 'resource_transfer_requests', label: 'طلبات الندب وسد العجز السنوية', category: 'resources', clearable: true, defaultReset: true },
  { id: 'resource_directives', label: 'التوجيهات والقرارات الإدارية السنوية', category: 'resources', clearable: true, defaultReset: true }
];

/**
 * الحصول على العام الدراسي الحالي المخزن بالنظام
 */
export async function getCurrentAcademicYear() {
  try {
    const savedLocal = localStorage.getItem('msc_current_academic_year');
    if (savedLocal) return savedLocal;

    const snap = await getDoc(doc(db, 'system_settings', 'academic_year'));
    if (snap.exists() && snap.data().currentAcademicYear) {
      const year = snap.data().currentAcademicYear;
      localStorage.setItem('msc_current_academic_year', year);
      return year;
    }
  } catch (err) {
    console.warn('Could not read academic_year setting from firestore:', err);
  }
  return '1446 - 1447 هـ';
}

/**
 * حساب العام الدراسي التالي المقترح تلقائياً
 */
export function calculateNextAcademicYear(currentYearStr = '1446 - 1447 هـ') {
  try {
    const matches = currentYearStr.match(/(\d{4})/g);
    if (matches && matches.length >= 2) {
      const y1 = parseInt(matches[0], 10);
      const y2 = parseInt(matches[1], 10);
      return `${y1 + 1} - ${y2 + 1} هـ`;
    }
  } catch (e) {}
  return '1447 - 1448 هـ';
}

/**
 * جمع وأرشفة كافة البيانات من قاعدة البيانات بحسب نطاق المدرسة المحدد
 */
export async function fetchYearlyDataForArchive(schoolScope = 'ALL', onProgress = () => {}) {
  const resultData = {};
  const stats = {};
  let totalRecords = 0;

  const totalColls = MIGRATION_COLLECTIONS_CONFIG.length;

  for (let i = 0; i < totalColls; i++) {
    const config = MIGRATION_COLLECTIONS_CONFIG[i];
    const collName = config.id;

    onProgress({
      step: 'fetching',
      current: i + 1,
      total: totalColls,
      collectionName: config.label,
      percent: Math.round(((i + 1) / totalColls) * 50)
    });

    try {
      let collRef = collection(db, collName);
      let q = collRef;

      // تطبيق فلترة المدرسة إذا تم اختيار مدرسة محددة
      if (schoolScope !== 'ALL') {
        if (collName === 'schools') {
          q = query(collRef, where('__name__', '==', schoolScope));
        } else {
          // معظم الجداول ترتبط بـ schoolId
          try {
            q = query(collRef, where('schoolId', '==', schoolScope));
          } catch (e) {
            q = collRef;
          }
        }
      }

      const snap = await getDocs(q);
      const docsList = [];
      snap.forEach(d => {
        docsList.push({ id: d.id, ...d.data() });
      });

      resultData[collName] = docsList;
      stats[collName] = docsList.length;
      totalRecords += docsList.length;
    } catch (err) {
      console.warn(`Warning fetching collection ${collName}:`, err);
      resultData[collName] = [];
      stats[collName] = 0;
    }
  }

  return { data: resultData, stats, totalRecords };
}

/**
 * بناء كائن الأرشيف الرقمي الموحد والمُهيكل
 */
export function buildArchiveSnapshot({
  sourceAcademicYear,
  targetAcademicYear,
  schoolScope,
  schoolScopeName,
  user,
  data,
  stats
}) {
  const archiveId = `msc_archive_${Date.now()}`;
  const totalRecords = Object.values(data).reduce((acc, arr) => acc + (arr?.length || 0), 0);

  return {
    system: "Advanced Schools Platform (بوابة شركة المدارس المتقدمة)",
    platformCode: "MSC_ADVANCED_PORTAL",
    version: "2.0",
    archiveType: "ANNUAL_ACADEMIC_YEAR_SNAPSHOT",
    metadata: {
      archiveId,
      sourceAcademicYear,
      targetAcademicYear,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      migratedBy: {
        name: user?.name || 'الماستر العام (Super Admin)',
        email: user?.email || 'super@admin.com',
        role: 'superadmin'
      },
      schoolScope,
      schoolScopeName: schoolScope === 'ALL' 
        ? 'كافة فروع ومجمعات شركة المدارس المتقدمة (43 مجمع تعليمي معتمد)' 
        : (schoolScopeName || 'فرع مدرسي محدد'),
      totalCollections: Object.keys(data).length,
      totalRecords,
      countsByCollection: stats
    },
    data
  };
}

/**
 * 1. حفظ الأرشيف داخلياً على مستوى الموقع (Firestore + Subcollections + Local Storage Index + Firebase Storage)
 */
export async function saveArchiveInternally(archivePayload, onProgress = () => {}) {
  const archiveId = archivePayload.metadata.archiveId;
  const mainDocRef = doc(db, 'academic_year_archives', archiveId);

  onProgress({ step: 'internal_saving', message: 'جاري تسجيل بيانات الأرشيف الرئيسية في السجل السحابي...', percent: 60 });

  // 1. حفظ الميتاداتا وملخص الأرشيف في المستند الرئيسي
  const mainMeta = {
    ...archivePayload.metadata,
    savedInternally: true,
    hasSubcollections: true,
    status: 'completed',
    title: `أرشيف العام الدراسي ${archivePayload.metadata.sourceAcademicYear}`,
    summary: `نسخة مؤرشفة تشمل ${archivePayload.metadata.totalRecords} سجلاً عبر ${archivePayload.metadata.totalCollections} جدولاً.`
  };

  await setDoc(mainDocRef, mainMeta, { merge: true });

  // 2. تجزئة وتخزين بيانات كل جدول في sub-documents مستقلة لمنع تخطي حد الـ 1MB في فايرستور
  const collectionsEntries = Object.entries(archivePayload.data);
  const totalColls = collectionsEntries.length;

  for (let idx = 0; idx < totalColls; idx++) {
    const [collName, records] = collectionsEntries[idx];
    if (!records || records.length === 0) continue;

    onProgress({
      step: 'internal_saving',
      message: `جاري حفظ أرشيف جدول (${collName}) - ${records.length} سجل...`,
      percent: 60 + Math.round(((idx + 1) / totalColls) * 30)
    });

    // تقسيم السجلات إلى مجموعات (Chunks) من 200 سجل
    const CHUNK_SIZE = 200;
    for (let c = 0; c < records.length; c += CHUNK_SIZE) {
      const chunkRecords = records.slice(c, c + CHUNK_SIZE);
      const chunkDocId = `${collName}_part_${Math.floor(c / CHUNK_SIZE) + 1}`;
      const chunkRef = doc(db, 'academic_year_archives', archiveId, 'collections_data', chunkDocId);

      await setDoc(chunkRef, {
        collectionName: collName,
        chunkIndex: Math.floor(c / CHUNK_SIZE) + 1,
        totalInChunk: chunkRecords.length,
        records: chunkRecords,
        updatedAt: Date.now()
      });
    }
  }

  // 3. محاولة الرفع كملف كامل إلى Firebase Storage إن كانت الخدمة مفعلة
  try {
    if (storage) {
      const jsonBlob = new Blob([JSON.stringify(archivePayload)], { type: 'application/json' });
      const storageFileRef = ref(storage, `yearly_archives/${archiveId}.json`);
      await uploadBytes(storageFileRef, jsonBlob);
      const downloadUrl = await getDownloadURL(storageFileRef);
      await setDoc(mainDocRef, { storageDownloadUrl: downloadUrl }, { merge: true });
    }
  } catch (storageErr) {
    console.info('Firebase Storage upload notice (Firestore subcollection backup is active):', storageErr.message);
  }

  // 4. حفظ الفهرس في LocalStorage للوصول السريع
  try {
    const existingIndex = JSON.parse(localStorage.getItem('msc_yearly_archives_index') || '[]');
    const filtered = existingIndex.filter(item => item.archiveId !== archiveId);
    filtered.unshift(mainMeta);
    localStorage.setItem('msc_yearly_archives_index', JSON.stringify(filtered.slice(0, 50)));
  } catch (lsErr) {
    console.warn('LocalStorage index update notice:', lsErr);
  }

  onProgress({ step: 'internal_saving', message: 'اكتمل الحفظ الداخلي السحابي بنجاح!', percent: 95 });
  return { success: true, archiveId };
}

/**
 * 2. تحميل ملف الأرشيف محلياً على جهاز المشرف (Local Download - JSON)
 */
export function downloadArchiveLocally(archivePayload) {
  const metadata = archivePayload.metadata || {};
  const yearClean = (metadata.sourceAcademicYear || 'Year').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `MSC_AdvancedSchools_Archive_${yearClean}_${dateStr}.json`;

  const jsonString = JSON.stringify(archivePayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, fileName };
}

/**
 * 3. تصفير مؤشرات أو تهيئة الجداول ليبدأ تاريخ العام الدراسي الجديد بنظافة وسلاسة
 */
export async function cleanSlateForNewAcademicYear({
  schoolScope = 'ALL',
  resetOptions = {},
  targetAcademicYear,
  user,
  onProgress = () => {}
}) {
  const deletedCounts = {};
  let totalDeleted = 0;

  // استخراج الجداول المصرح بتصفيرها من الإعدادات
  const clearableConfigs = MIGRATION_COLLECTIONS_CONFIG.filter(
    c => c.clearable && resetOptions[c.id] === true
  );

  const totalToClear = clearableConfigs.length;

  for (let idx = 0; idx < totalToClear; idx++) {
    const config = clearableConfigs[idx];
    const collName = config.id;

    onProgress({
      step: 'cleaning',
      message: `جاري تهيئة وتصفير (${config.label})...`,
      current: idx + 1,
      total: totalToClear,
      percent: Math.round(((idx + 1) / totalToClear) * 100)
    });

    try {
      const collRef = collection(db, collName);
      let q = collRef;

      if (schoolScope !== 'ALL') {
        q = query(collRef, where('schoolId', '==', schoolScope));
      }

      const snap = await getDocs(q);
      const docs = snap.docs;

      // حذف السجلات بدفعات آمنة (Batches)
      const BATCH_SIZE = 300;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      deletedCounts[collName] = docs.length;
      totalDeleted += docs.length;
    } catch (clearErr) {
      console.warn(`Notice while clearing ${collName}:`, clearErr);
      deletedCounts[collName] = 0;
    }
  }

  // تحديث إعدادات العام الدراسي الجديد في النظام
  try {
    const settingsPayload = {
      currentAcademicYear: targetAcademicYear,
      previousAcademicYear: targetAcademicYear ? calculatePreviousAcademicYear(targetAcademicYear) : '',
      lastMigrationDate: new Date().toISOString(),
      lastMigrationTimestamp: Date.now(),
      migratedBy: user?.name || 'الماستر العام (Super Admin)',
      status: 'active',
      isCleanSlate: true
    };

    await setDoc(doc(db, 'system_settings', 'academic_year'), settingsPayload, { merge: true });
    localStorage.setItem('msc_current_academic_year', targetAcademicYear);
  } catch (setErr) {
    console.warn('Could not update system_settings/academic_year:', setErr);
  }

  return {
    success: true,
    deletedCounts,
    totalDeleted,
    newAcademicYear: targetAcademicYear
  };
}

/**
 * حساب العام الدراسي السابق
 */
function calculatePreviousAcademicYear(yearStr) {
  try {
    const matches = yearStr.match(/(\d{4})/g);
    if (matches && matches.length >= 2) {
      const y1 = parseInt(matches[0], 10);
      const y2 = parseInt(matches[1], 10);
      return `${y1 - 1} - ${y2 - 1} هـ`;
    }
  } catch (e) {}
  return '';
}

/**
 * جلب قائمة كافة النسخ المحفوظة سحابياً/داخلياً
 */
export async function listInternalArchives() {
  try {
    const snap = await getDocs(collection(db, 'academic_year_archives'));
    if (!snap.empty) {
      const archives = [];
      snap.forEach(d => archives.push({ id: d.id, ...d.data() }));
      archives.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return archives;
    }
  } catch (err) {
    console.warn('Error reading internal archives from firestore:', err);
  }

  // Fallback to local storage index
  try {
    const local = JSON.parse(localStorage.getItem('msc_yearly_archives_index') || '[]');
    return local;
  } catch (e) {
    return [];
  }
}

/**
 * حذف نسخة مؤرشفة داخلياً
 */
export async function deleteInternalArchive(archiveId) {
  try {
    // 1. حذف أجزاء المجموعات الفرعية
    const subSnap = await getDocs(collection(db, 'academic_year_archives', archiveId, 'collections_data'));
    const batch = writeBatch(db);
    subSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'academic_year_archives', archiveId));
    await batch.commit();

    // 2. تحديث LocalStorage
    try {
      const local = JSON.parse(localStorage.getItem('msc_yearly_archives_index') || '[]');
      const filtered = local.filter(item => item.archiveId !== archiveId && item.id !== archiveId);
      localStorage.setItem('msc_yearly_archives_index', JSON.stringify(filtered));
    } catch (e) {}

    return { success: true };
  } catch (err) {
    console.error('Error deleting internal archive:', err);
    throw err;
  }
}

/**
 * استخراج كامل بيانات الأرشيف المحفوظ داخلياً بما فيها المستندات الفرعية
 */
export async function loadFullInternalArchiveData(archiveId) {
  const mainSnap = await getDoc(doc(db, 'academic_year_archives', archiveId));
  if (!mainSnap.exists()) {
    throw new Error('لم يتم العثور على وثيقة الأرشيف المحددة في النظام.');
  }

  const mainData = mainSnap.data();
  const restoredCollections = {};

  // جلب كافة أجزاء المجموعات من subcollection
  const subSnap = await getDocs(collection(db, 'academic_year_archives', archiveId, 'collections_data'));
  subSnap.forEach(d => {
    const part = d.data();
    const cName = part.collectionName;
    if (!restoredCollections[cName]) {
      restoredCollections[cName] = [];
    }
    if (Array.isArray(part.records)) {
      restoredCollections[cName].push(...part.records);
    }
  });

  return {
    metadata: mainData,
    data: restoredCollections
  };
}

/**
 * 4. استعادة بيانات عام دراسي سابق (Restore)
 * سواء من كائن مرفوع من جهاز المشرف أو مسترجع من الأرشيف الداخلي
 */
export async function restoreFromArchivePayload(archivePayload, onProgress = () => {}) {
  if (!archivePayload || !archivePayload.data) {
    throw new Error('ملف الأرشيف غير صالح أو تالف أو لا يحتوي على بنية بيانات معتمدة.');
  }

  const data = archivePayload.data;
  const entries = Object.entries(data);
  const totalColls = entries.length;
  let totalRestored = 0;
  const restoredCounts = {};

  for (let idx = 0; idx < totalColls; idx++) {
    const [collName, records] = entries[idx];
    if (!Array.isArray(records) || records.length === 0) continue;

    onProgress({
      step: 'restoring',
      message: `جاري استعادة سجلات جدول (${collName}) - ${records.length} سجل...`,
      current: idx + 1,
      total: totalColls,
      percent: Math.round(((idx + 1) / totalColls) * 100)
    });

    const BATCH_SIZE = 250;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = records.slice(i, i + BATCH_SIZE);

      chunk.forEach(record => {
        const { id, ...docData } = record;
        if (id) {
          const docRef = doc(db, collName, String(id));
          batch.set(docRef, docData, { merge: true });
        }
      });

      await batch.commit();
    }

    restoredCounts[collName] = records.length;
    totalRestored += records.length;
  }

  // إعادة تثبيت العام الدراسي المستعاد
  const restoredYear = archivePayload.metadata?.sourceAcademicYear;
  if (restoredYear) {
    try {
      await setDoc(doc(db, 'system_settings', 'academic_year'), {
        currentAcademicYear: restoredYear,
        restoredAt: new Date().toISOString(),
        restoredFromArchiveId: archivePayload.metadata?.archiveId || 'external_upload',
        status: 'restored'
      }, { merge: true });
      localStorage.setItem('msc_current_academic_year', restoredYear);
    } catch (e) {}
  }

  return {
    success: true,
    totalRestored,
    restoredCounts,
    restoredAcademicYear: restoredYear
  };
}
