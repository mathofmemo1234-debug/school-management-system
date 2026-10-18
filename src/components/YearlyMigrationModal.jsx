import React, { useState, useEffect, useRef } from 'react';
import { 
  Archive, Database, Download, UploadCloud, RefreshCw, CheckCircle2, 
  AlertCircle, Calendar, Sparkles, ShieldCheck, Layers, HardDrive, 
  X, Trash2, Eye, FileText, Check, RotateCcw, Info, Lock, Play, ArrowRightLeft,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  MIGRATION_COLLECTIONS_CONFIG,
  getCurrentAcademicYear,
  calculateNextAcademicYear,
  fetchYearlyDataForArchive,
  buildArchiveSnapshot,
  saveArchiveInternally,
  downloadArchiveLocally,
  cleanSlateForNewAcademicYear,
  listInternalArchives,
  deleteInternalArchive,
  loadFullInternalArchiveData,
  restoreFromArchivePayload
} from '../services/yearlyMigrationService';

export default function YearlyMigrationModal({ 
  isOpen = true, 
  onClose = () => {}, 
  schools = [],
  isFullPage = false 
}) {
  const { userData, currentUser } = useAuth();
  const { isRTL } = useLanguage();

  // Active Tab: 'migrate' | 'internal_archives' | 'local_restore'
  const [activeTab, setActiveTab] = useState('migrate');

  // Form State for Migration
  const [sourceAcademicYear, setSourceAcademicYear] = useState('1446 - 1447 هـ');
  const [targetAcademicYear, setTargetAcademicYear] = useState('1447 - 1448 هـ');
  const [selectedSchoolScope, setSelectedSchoolScope] = useState('ALL');

  // Storage targets (Can choose one or both)
  const [saveInternally, setSaveInternally] = useState(true);
  const [saveLocally, setSaveLocally] = useState(true);

  // Clean Slate Checklist
  const [resetOptions, setResetOptions] = useState(() => {
    const initial = {};
    MIGRATION_COLLECTIONS_CONFIG.forEach(c => {
      if (c.clearable) initial[c.id] = c.defaultReset ?? true;
    });
    return initial;
  });

  // Security Confirmation
  const [confirmInput, setConfirmInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState(null); // { step, message, percent }
  const [completedReport, setCompletedReport] = useState(null);

  // Internal Archives State
  const [internalArchives, setInternalArchives] = useState([]);
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);
  const [selectedArchivePreview, setSelectedArchivePreview] = useState(null);
  const [archiveActionLoading, setArchiveActionLoading] = useState(null);

  // Local Restore State
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileData, setUploadedFileData] = useState(null);
  const [uploadFileError, setUploadFileError] = useState('');
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const [restoreSuccessReport, setRestoreSuccessReport] = useState(null);

  const fileInputRef = useRef(null);

  // Load Current Academic Year & Archives on mount
  useEffect(() => {
    async function initData() {
      try {
        const cur = await getCurrentAcademicYear();
        if (cur) {
          setSourceAcademicYear(cur);
          setTargetAcademicYear(calculateNextAcademicYear(cur));
        }
      } catch (e) {}
      loadArchives();
    }
    if (isOpen || isFullPage) {
      initData();
    }
  }, [isOpen, isFullPage]);

  const loadArchives = async () => {
    setIsLoadingArchives(true);
    try {
      const list = await listInternalArchives();
      setInternalArchives(list || []);
    } catch (err) {
      console.warn('Error loading internal archives:', err);
    } finally {
      setIsLoadingArchives(false);
    }
  };

  const handleToggleResetOption = (collId) => {
    setResetOptions(prev => ({
      ...prev,
      [collId]: !prev[collId]
    }));
  };

  const handleSelectAllReset = (val) => {
    const updated = {};
    MIGRATION_COLLECTIONS_CONFIG.forEach(c => {
      if (c.clearable) updated[c.id] = val;
    });
    setResetOptions(updated);
  };

  // 🚀 Start Migration Execution
  const handleExecuteMigration = async () => {
    if (!saveInternally && !saveLocally) {
      alert('⚠️ يرجى تحديد مسار حفظ واحد على الأقل (داخلي سحابي أو تحميل محلي).');
      return;
    }
    if (confirmInput.trim() !== 'ترحيل') {
      alert('⚠️ يرجى كتابة كلمة "ترحيل" في حقل التأكيد للمتابعة.');
      return;
    }

    setIsProcessing(true);
    setProcessStatus({ step: 'init', message: 'جاري بدء عملية أرشفة وترحيل البيانات...', percent: 5 });
    setCompletedReport(null);

    try {
      const scopeSchoolObj = schools.find(s => s.id === selectedSchoolScope);
      const schoolScopeName = selectedSchoolScope === 'ALL' 
        ? 'كافة فروع ومجمعات شركة المدارس المتقدمة' 
        : (scopeSchoolObj?.name || 'الفرع المحدد');

      // 1. Fetching all data
      setProcessStatus({ step: 'fetching', message: 'جاري مسح وجلب بيانات كافة الجداول والمدارس...', percent: 15 });
      const { data, stats, totalRecords } = await fetchYearlyDataForArchive(
        selectedSchoolScope,
        (p) => setProcessStatus({ step: 'fetching', message: `جاري جمع بيانات جدول (${p.collectionName})...`, percent: p.percent })
      );

      // 2. Build Archive Snapshot
      setProcessStatus({ step: 'building', message: 'جاري بناء وتشفير ملف الأرشيف المهيكل...', percent: 55 });
      const archivePayload = buildArchiveSnapshot({
        sourceAcademicYear: sourceAcademicYear.trim(),
        targetAcademicYear: targetAcademicYear.trim(),
        schoolScope: selectedSchoolScope,
        schoolScopeName,
        user: userData || { name: 'الماستر العام' },
        data,
        stats
      });

      let internalArchiveId = null;
      let downloadedFileName = null;

      // 3. Save Internally (Cloud Storage / Firestore)
      if (saveInternally) {
        setProcessStatus({ step: 'internal', message: 'جاري تأمين وحفظ النسخة في الأرشيف السحابي الداخلي...', percent: 65 });
        const resInternal = await saveArchiveInternally(archivePayload, (p) => {
          setProcessStatus({ step: 'internal', message: p.message, percent: p.percent });
        });
        internalArchiveId = resInternal.archiveId;
      }

      // 4. Local Download
      if (saveLocally) {
        setProcessStatus({ step: 'download', message: 'جاري تصدير وتحميل ملف الأرشيف إلى جهازك...', percent: 85 });
        const resLocal = downloadArchiveLocally(archivePayload);
        downloadedFileName = resLocal.fileName;
      }

      // 5. Clean Slate & Resetting indicators
      setProcessStatus({ step: 'cleaning', message: 'جاري تهيئة وتصفير جداول ومؤشرات العام الدراسي الجديد...', percent: 90 });
      const cleanResult = await cleanSlateForNewAcademicYear({
        schoolScope: selectedSchoolScope,
        resetOptions,
        targetAcademicYear: targetAcademicYear.trim(),
        user: userData || { name: 'الماستر العام' },
        onProgress: (p) => setProcessStatus({ step: 'cleaning', message: p.message, percent: p.percent })
      });

      // 6. Complete
      const report = {
        archiveId: internalArchiveId || archivePayload.metadata.archiveId,
        sourceAcademicYear: sourceAcademicYear.trim(),
        targetAcademicYear: targetAcademicYear.trim(),
        schoolScope: schoolScopeName,
        totalRecords,
        stats,
        saveInternally,
        saveLocally,
        downloadedFileName,
        deletedCounts: cleanResult.deletedCounts,
        totalDeleted: cleanResult.totalDeleted,
        completedAt: new Date().toLocaleTimeString('ar-SA')
      };

      setCompletedReport(report);
      setConfirmInput('');
      loadArchives();
    } catch (err) {
      console.error('Migration execution failed:', err);
      alert('حدث خطأ أثناء تنفيذ عملية الترحيل: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessStatus(null);
    }
  };

  // 🔄 Handle Restore from an Internal Archive
  const handleRestoreInternal = async (archive) => {
    if (!window.confirm(`هل أنت متأكد من استعادة بيانات الأرشيف للعام الدراسي (${archive.sourceAcademicYear})؟\n\n⚠️ سيتم تحديث وتثبيت كافة سجلات الأرشيف في قاعدة بيانات النظام.`)) {
      return;
    }

    setArchiveActionLoading(archive.archiveId || archive.id);
    try {
      const fullArchive = await loadFullInternalArchiveData(archive.archiveId || archive.id);
      const res = await restoreFromArchivePayload(fullArchive, (p) => {
        // progress
      });
      alert(`✅ تمت استعادة بيانات العام الدراسي (${res.restoredAcademicYear}) بنجاح!\n• إجمالي السجلات المستعادة: ${res.totalRestored}`);
      window.location.reload();
    } catch (err) {
      console.error('Error restoring internal archive:', err);
      alert('حدث خطأ أثناء استعادة الأرشيف: ' + err.message);
    } finally {
      setArchiveActionLoading(null);
    }
  };

  // 📥 Download Internal Archive as JSON
  const handleDownloadInternalArchive = async (archive) => {
    setArchiveActionLoading(archive.archiveId || archive.id);
    try {
      const fullArchive = await loadFullInternalArchiveData(archive.archiveId || archive.id);
      downloadArchiveLocally(fullArchive);
    } catch (err) {
      console.error('Error downloading archive:', err);
      alert('حدث خطأ أثناء تنزيل ملف الأرشيف: ' + err.message);
    } finally {
      setArchiveActionLoading(null);
    }
  };

  // 🗑️ Delete Internal Archive
  const handleDeleteInternalArchive = async (archiveId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه النسخة المؤرشفة نهائياً من السجل الداخلي للموقع؟')) {
      return;
    }
    setArchiveActionLoading(archiveId);
    try {
      await deleteInternalArchive(archiveId);
      setInternalArchives(prev => prev.filter(a => (a.archiveId || a.id) !== archiveId));
      if (selectedArchivePreview?.archiveId === archiveId) setSelectedArchivePreview(null);
      alert('✓ تم حذف النسخة من الأرشيف بنجاح.');
    } catch (err) {
      console.error('Error deleting archive:', err);
      alert('حدث خطأ أثناء حذف النسخة: ' + err.message);
    } finally {
      setArchiveActionLoading(null);
    }
  };

  // 📁 Handle Local File Upload Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileError('');
    setUploadedFile(file);
    setUploadedFileData(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.metadata || !parsed.data) {
          throw new Error('الملف المرفوع لا يحتوي على الترويسة أو بنية البيانات المعتمدة لشركة المدارس المتقدمة.');
        }
        setUploadedFileData(parsed);
      } catch (err) {
        setUploadFileError('الملف المحدد غير صالح: ' + err.message);
        setUploadedFileData(null);
      }
    };
    reader.onerror = () => {
      setUploadFileError('تعذر قراءة الملف من جهازك.');
    };
    reader.readAsText(file);
  };

  // 🚀 Execute Restore from Uploaded Local JSON File
  const handleExecuteLocalFileRestore = async () => {
    if (!uploadedFileData) return;
    if (restoreConfirmInput.trim() !== 'استعادة') {
      alert('⚠️ يرجى كتابة كلمة "استعادة" لتأكيد الإجراء.');
      return;
    }

    setIsRestoring(true);
    setRestoreStatus({ message: 'جاري فحص وتجهيز السجلات للحقن في قاعدة البيانات...', percent: 10 });
    setRestoreSuccessReport(null);

    try {
      const res = await restoreFromArchivePayload(uploadedFileData, (p) => {
        setRestoreStatus({ message: p.message, percent: p.percent });
      });

      setRestoreSuccessReport({
        restoredYear: res.restoredAcademicYear || uploadedFileData.metadata?.sourceAcademicYear || 'المحدد بالملف',
        totalRestored: res.totalRestored,
        restoredCounts: res.restoredCounts,
        completedAt: new Date().toLocaleTimeString('ar-SA')
      });
      setRestoreConfirmInput('');
    } catch (err) {
      console.error('Restore error:', err);
      alert('حدث خطأ أثناء استعادة البيانات من الملف: ' + err.message);
    } finally {
      setIsRestoring(false);
      setRestoreStatus(null);
    }
  };

  if (!isOpen && !isFullPage) return null;

  return (
    <div style={isFullPage ? { padding: '24px' } : {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: isFullPage ? '100%' : '1080px',
        maxHeight: isFullPage ? 'none' : '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Header Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0369a1 100%)',
          color: '#ffffff',
          padding: '24px 30px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '4px solid #38bdf8'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)'
            }}>
              <Sparkles size={28} color="#38bdf8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 900, letterSpacing: '-0.5px' }}>
                  ترحيل البيانات السنوية وتأسيس السنة الدراسية الجديدة
                </h2>
                <span style={{
                  background: 'rgba(56, 189, 248, 0.25)',
                  color: '#e0f2fe',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '11px',
                  fontWeight: 800
                }}>
                  Super Admin
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
                بوابة شركة المدارس المتقدمة • الأرشفة المركزية، الحفظ السحابي والمحلي، تهيئة الجداول، والاسترداد المرن
              </p>
            </div>
          </div>

          {!isFullPage && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
              title="إغلاق النافذة"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px'
        }}>
          <button
            onClick={() => setActiveTab('migrate')}
            style={{
              padding: '16px 22px',
              border: 'none',
              borderBottom: activeTab === 'migrate' ? '3px solid #2563eb' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'migrate' ? '#1e40af' : '#64748b',
              fontWeight: activeTab === 'migrate' ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Archive size={18} color={activeTab === 'migrate' ? '#2563eb' : '#64748b'} />
            <span>ترحيل وإغلاق العام وتأسيس الجديد</span>
          </button>

          <button
            onClick={() => { setActiveTab('internal_archives'); loadArchives(); }}
            style={{
              padding: '16px 22px',
              border: 'none',
              borderBottom: activeTab === 'internal_archives' ? '3px solid #2563eb' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'internal_archives' ? '#1e40af' : '#64748b',
              fontWeight: activeTab === 'internal_archives' ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Database size={18} color={activeTab === 'internal_archives' ? '#2563eb' : '#64748b'} />
            <span>سجل الأرشيفات والاسترداد الداخلي</span>
            {internalArchives.length > 0 && (
              <span style={{
                background: '#e0e7ff',
                color: '#3730a3',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {internalArchives.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('local_restore')}
            style={{
              padding: '16px 22px',
              border: 'none',
              borderBottom: activeTab === 'local_restore' ? '3px solid #2563eb' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === 'local_restore' ? '#1e40af' : '#64748b',
              fontWeight: activeTab === 'local_restore' ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <UploadCloud size={18} color={activeTab === 'local_restore' ? '#2563eb' : '#64748b'} />
            <span>رفع واستعادة ملف محلي (.JSON)</span>
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div style={{ padding: '26px', overflowY: 'auto', flex: 1 }}>

          {/* ================= TAB 1: MIGRATION & SETUP ================= */}
          {activeTab === 'migrate' && (
            <div>
              {/* Completed Success Dialog View */}
              {completedReport ? (
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderRadius: '20px',
                  padding: '30px',
                  border: '2px solid #86efac',
                  boxShadow: '0 10px 25px rgba(22, 163, 74, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '18px',
                      background: '#16a34a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 16px rgba(22, 163, 74, 0.3)'
                    }}>
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#14532d' }}>
                        تم ترحيل البيانات وتأسيس العام الدراسي الجديد بنجاح!
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#166534' }}>
                        اكتملت أرشفة العام الدراسي ({completedReport.sourceAcademicYear}) وتم تدشين ({completedReport.targetAcademicYear}) بنظافة وسلاسة.
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>إجمالي السجلات المؤرشفة</span>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                        {completedReport.totalRecords.toLocaleString()} سجل
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>السجلات التشغيلية المصفرة</span>
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#b91c1c', marginTop: '4px' }}>
                        {completedReport.totalDeleted.toLocaleString()} سجل
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>مسار الحفظ المكتمل</span>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e40af', marginTop: '6px' }}>
                        {completedReport.saveInternally && '✓ سحابي داخلي'} {completedReport.saveLocally && '• ✓ تحميل محلي'}
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>النطاق والمجمعات</span>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '6px' }}>
                        {completedReport.schoolScope}
                      </div>
                    </div>
                  </div>

                  {completedReport.downloadedFileName && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      padding: '12px 18px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Download size={18} />
                      <span>تم تنزيل ملف الأرشيف على جهازك باسم: <strong>{completedReport.downloadedFileName}</strong></span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => setCompletedReport(null)}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      إجراء ترحيل جديد أو العودة للإعدادات
                    </button>
                    {!isFullPage && (
                      <button
                        onClick={onClose}
                        style={{
                          background: '#ffffff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '12px',
                          padding: '12px 24px',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        إغلاق والعودة للوحة التحكم
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Processing Progress Overlay */}
                  {isProcessing && (
                    <div style={{
                      background: '#eff6ff',
                      borderRadius: '18px',
                      padding: '24px',
                      marginBottom: '24px',
                      border: '2px solid #93c5fd'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                        <RefreshCw size={24} color="#2563eb" className="animate-spin" />
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e3a8a' }}>
                            {processStatus?.message || 'جاري معالجة البيانات...'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                            يرجى الانتظار وعدم إغلاق الصفحة حتى تكتمل عمليات الأرشفة والحفظ والتصفير...
                          </div>
                        </div>
                      </div>
                      <div style={{
                        height: '10px',
                        background: '#dbeafe',
                        borderRadius: '5px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${processStatus?.percent || 15}%`,
                          background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Section 1: Academic Years & Scope */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '18px',
                    padding: '22px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="#2563eb" />
                      <span>1. تحديد العام الدراسي ونطاق المجمعات المشمولة</span>
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          العام الدراسي المُنتهي (المُراد أرشفته وإغلاقه):
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={sourceAcademicYear}
                          onChange={(e) => setSourceAcademicYear(e.target.value)}
                          placeholder="مثال: 1446 - 1447 هـ"
                          style={{
                            fontWeight: 'bold',
                            fontSize: '14px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          العام الدراسي الجديد (المُراد تأسيسه وتدشينه):
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={targetAcademicYear}
                          onChange={(e) => setTargetAcademicYear(e.target.value)}
                          placeholder="مثال: 1447 - 1448 هـ"
                          style={{
                            fontWeight: 'bold',
                            fontSize: '14px',
                            background: '#ffffff',
                            border: '2px solid #2563eb',
                            color: '#1e40af'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          نطاق المدارس والمجمعات المشمولة:
                        </label>
                        <select
                          className="input-field"
                          value={selectedSchoolScope}
                          onChange={(e) => setSelectedSchoolScope(e.target.value)}
                          style={{
                            fontWeight: 'bold',
                            fontSize: '13px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1'
                          }}
                        >
                          <option value="ALL">🏢 كافة فروع ومجمعات شركة المدارس المتقدمة (الترحيل المركزي الشامل)</option>
                          {schools.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.city || 'فرع معتمد'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Storage Destinations */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '18px',
                    padding: '22px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HardDrive size={18} color="#059669" />
                      <span>2. مسارات حفظ وأرشفة البيانات (يمكن اختيار أحدهما أو كلاهما)</span>
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        padding: '16px',
                        borderRadius: '14px',
                        background: saveInternally ? '#ecfdf5' : '#ffffff',
                        border: saveInternally ? '2px solid #059669' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}>
                        <input
                          type="checkbox"
                          checked={saveInternally}
                          onChange={(e) => setSaveInternally(e.target.checked)}
                          style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: '#059669' }}
                        />
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Database size={16} />
                            <span>حفظ داخلي آمن على مستوى الموقع (Cloud Storage / Firebase)</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#047857', marginTop: '4px', lineHeight: '1.5' }}>
                            تخزين نسخة مؤرشفة متكاملة في قاعدة البيانات السحابية للرجوع إليها واستعادتها بضغطة زر في أي وقت من لوحة التحكم.
                          </div>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        padding: '16px',
                        borderRadius: '14px',
                        background: saveLocally ? '#eff6ff' : '#ffffff',
                        border: saveLocally ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}>
                        <input
                          type="checkbox"
                          checked={saveLocally}
                          onChange={(e) => setSaveLocally(e.target.checked)}
                          style={{ width: '18px', height: '18px', marginTop: '3px', accentColor: '#2563eb' }}
                        />
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Download size={16} />
                            <span>حفظ محلي بصيغة ملف يتم تحميله على جهاز المشرف (.JSON)</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '4px', lineHeight: '1.5' }}>
                            تنزيل ملف رقمي مهيكل وشامل بصيغة JSON على جهاز الكمبيوتر الخاص بك لحفظه كنسخة احتياطية خارج الموقع.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section 3: Clean Slate Options */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '18px',
                    padding: '22px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '20px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={18} color="#d97706" />
                        <span>3. خيارات تصفير المؤشرات وتهيئة الجداول للعام الدراسي الجديد</span>
                      </h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectAllReset(true)}
                          style={{ background: '#e2e8f0', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          تحديد الكل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllReset(false)}
                          style={{ background: '#e2e8f0', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '10px',
                      marginBottom: '16px'
                    }}>
                      {MIGRATION_COLLECTIONS_CONFIG.filter(c => c.clearable).map(c => (
                        <label
                          key={c.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: resetOptions[c.id] ? '#fef2f2' : '#ffffff',
                            border: resetOptions[c.id] ? '1px solid #fecaca' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: resetOptions[c.id] ? '#991b1b' : '#334155'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!resetOptions[c.id]}
                            onChange={() => handleToggleResetOption(c.id)}
                            style={{ accentColor: '#dc2626' }}
                          />
                          <span>تصفير {c.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Strict Safety Protection Box */}
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontSize: '12.5px',
                      color: '#166534',
                      lineHeight: '1.6',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <ShieldCheck size={22} color="#16a34a" style={{ flexShrink: 0 }} />
                      <div>
                        <strong>حماية مؤسسية صارمة:</strong> تظل حسابات السوبر أدمن (Super Admin)، وقائمة المدارس والمجمعات المعتمدة (43 مجمع)، وكافة حسابات الكوادر والمدراء والمشرفين والمعلمين والطلاب محفوظة ومحمية تماماً دون أي مساس بها.
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Security Confirmation & Launch Button */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '18px',
                    padding: '22px',
                    border: '2px solid #cbd5e1'
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                        لتأكيد ترحيل البيانات وتأسيس السنة الدراسية الجديدة، يرجى كتابة كلمة <strong style={{ color: '#2563eb' }}>"ترحيل"</strong> في الحقل أدناه:
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder='اكتب "ترحيل" هنا للتأكيد...'
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        style={{
                          border: confirmInput.trim() === 'ترحيل' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '16px',
                          maxWidth: '300px'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={handleExecuteMigration}
                        disabled={isProcessing || confirmInput.trim() !== 'ترحيل' || (!saveInternally && !saveLocally)}
                        style={{
                          flex: 1,
                          background: (isProcessing || confirmInput.trim() !== 'ترحيل' || (!saveInternally && !saveLocally)) 
                            ? '#cbd5e1' 
                            : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '14px',
                          padding: '14px 28px',
                          fontWeight: 900,
                          fontSize: '15px',
                          cursor: (isProcessing || confirmInput.trim() !== 'ترحيل') ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          boxShadow: confirmInput.trim() === 'ترحيل' ? '0 10px 25px rgba(37, 99, 235, 0.35)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {isProcessing ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                        <span>
                          {isProcessing ? 'جاري تنفيذ الأرشفة والترحيل...' : 'بدء ترحيل البيانات وتأسيس العام الدراسي الجديد'}
                        </span>
                      </button>

                      {!isFullPage && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={onClose}
                          disabled={isProcessing}
                          style={{ padding: '14px 24px', borderRadius: '14px', fontWeight: 700 }}
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: INTERNAL ARCHIVES & RESTORE ================= */}
          {activeTab === 'internal_archives' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    الأرشيف السحابي الداخلي للأعوام الدراسية
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    قائمة النسخ المحفوظة على مستوى النظام مع إمكانية استعادتها أو تحميلها بضغطة زر
                  </p>
                </div>
                <button
                  onClick={loadArchives}
                  disabled={isLoadingArchives}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={16} className={isLoadingArchives ? 'animate-spin' : ''} />
                  <span>تحديث السجل</span>
                </button>
              </div>

              {isLoadingArchives ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
                  <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                  <div>جاري جلب سجلات الأرشيفات السحابية...</div>
                </div>
              ) : internalArchives.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  background: '#f8fafc',
                  borderRadius: '18px',
                  border: '2px dashed #cbd5e1'
                }}>
                  <Archive size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#334155' }}>
                    لا توجد نسخ مؤرشفة داخلياً بعد
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '420px', marginInline: 'auto' }}>
                    عند قيامك بترحيل بيانات العام الدراسي واختيار مسار الحفظ السحابي الداخلي، ستظهر كافة النسخ هنا للرجوع إليها في أي وقت.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {internalArchives.map((archive, i) => {
                    const archId = archive.archiveId || archive.id;
                    const isBusy = archiveActionLoading === archId;

                    return (
                      <div
                        key={archId || i}
                        style={{
                          background: '#ffffff',
                          borderRadius: '16px',
                          padding: '20px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '16px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Calendar size={24} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                                أرشيف العام الدراسي: {archive.sourceAcademicYear || 'غير محدد'}
                              </h4>
                              {archive.targetAcademicYear && (
                                <span style={{
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  padding: '2px 8px'
                                }}>
                                  نُقل إلى {archive.targetAcademicYear}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                              <span>📅 التاريخ: {new Date(archive.createdAt || archive.timestamp).toLocaleDateString('ar-SA')}</span>
                              <span>👤 المنفذ: {archive.migratedBy?.name || 'الماستر العام'}</span>
                              <span>📊 السجلات: {archive.totalRecords?.toLocaleString() || 0}</span>
                              <span>🏢 النطاق: {archive.schoolScopeName || (archive.schoolScope === 'ALL' ? 'كافة المجمعات' : 'فرع محدد')}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleRestoreInternal(archive)}
                            disabled={isBusy}
                            style={{
                              background: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '9px 16px',
                              fontSize: '13px',
                              fontWeight: 800,
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="استعادة بيانات هذا العام الدراسي"
                          >
                            <RotateCcw size={15} />
                            <span>استعادة هذه النسخة</span>
                          </button>

                          <button
                            onClick={() => handleDownloadInternalArchive(archive)}
                            disabled={isBusy}
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '10px',
                              padding: '9px 14px',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: isBusy ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            title="تحميل كملف JSON"
                          >
                            <Download size={15} />
                            <span>تحميل JSON</span>
                          </button>

                          <button
                            onClick={() => setSelectedArchivePreview(selectedArchivePreview?.archiveId === archId ? null : archive)}
                            style={{
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '10px',
                              padding: '9px 12px',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="معاينة إحصائيات الجداول"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => handleDeleteInternalArchive(archId)}
                            disabled={isBusy}
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '9px 12px',
                              fontSize: '13px',
                              cursor: isBusy ? 'not-allowed' : 'pointer'
                            }}
                            title="حذف من الأرشيف الداخلي"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Collapsible Stats Preview */}
                        {selectedArchivePreview?.archiveId === archId && (
                          <div style={{
                            width: '100%',
                            marginTop: '12px',
                            paddingTop: '16px',
                            borderTop: '1px solid #e2e8f0'
                          }}>
                            <h5 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                              تفاصيل السجلات المؤرشفة لكل جدول:
                            </h5>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                              gap: '8px'
                            }}>
                              {Object.entries(archive.countsByCollection || {}).map(([cKey, cCount]) => (
                                <div key={cKey} style={{
                                  background: '#f8fafc',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <span style={{ color: '#475569' }}>{cKey}:</span>
                                  <strong style={{ color: '#0f172a' }}>{cCount}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: RESTORE FROM LOCAL FILE ================= */}
          {activeTab === 'local_restore' && (
            <div>
              {restoreSuccessReport ? (
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderRadius: '20px',
                  padding: '30px',
                  border: '2px solid #86efac'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '16px',
                      background: '#16a34a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckCircle2 size={30} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '21px', fontWeight: 900, color: '#14532d' }}>
                        اكتملت استعادة قاعدة البيانات من الملف المحلي بنجاح!
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#166534' }}>
                        تمت استعادة {restoreSuccessReport.totalRestored?.toLocaleString()} سجلاً للعام الدراسي ({restoreSuccessReport.restoredYear}).
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button
                      onClick={() => { setRestoreSuccessReport(null); setUploadedFileData(null); setUploadedFile(null); }}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      استعادة ملف آخر
                    </button>
                    {!isFullPage && (
                      <button
                        onClick={onClose}
                        style={{
                          background: '#ffffff',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '12px',
                          padding: '12px 24px',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        إغلاق والعودة للوحة التحكم
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {/* File Upload Box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #93c5fd',
                      background: '#eff6ff',
                      borderRadius: '20px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      marginBottom: '20px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#93c5fd'}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <UploadCloud size={46} color="#2563eb" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#1e3a8a' }}>
                      {uploadedFile ? uploadedFile.name : 'اسحب وأفلت ملف الأرشيف (.json) هنا أو اضغط للاستعراض'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#3b82f6' }}>
                      يجب أن يكون الملف بصيغة JSON ومطابقاً لمعايير النسخ الاحتياطية المعتمدة لشركة المدارس المتقدمة
                    </p>
                  </div>

                  {uploadFileError && (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '12px',
                      padding: '14px',
                      marginBottom: '20px',
                      color: '#b91c1c',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <AlertCircle size={20} />
                      <span>{uploadFileError}</span>
                    </div>
                  )}

                  {/* Restoring Progress */}
                  {isRestoring && (
                    <div style={{
                      background: '#eff6ff',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      border: '2px solid #93c5fd'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <RefreshCw size={22} color="#2563eb" className="animate-spin" />
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e3a8a' }}>
                            {restoreStatus?.message || 'جاري استعادة السجلات...'}
                          </div>
                        </div>
                      </div>
                      <div style={{ height: '8px', background: '#dbeafe', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${restoreStatus?.percent || 20}%`,
                          background: '#2563eb',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* File Inspection Summary Card */}
                  {uploadedFileData && (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '18px',
                      padding: '22px',
                      border: '1px solid #cbd5e1',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} color="#16a34a" />
                        <span>تقرير فحص ملف الأرشيف المحدد</span>
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>العام الدراسي في الملف:</span>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e40af', marginTop: '2px' }}>
                            {uploadedFileData.metadata?.sourceAcademicYear || 'غير محدد'}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>تاريخ إنشاء الأرشيف:</span>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                            {uploadedFileData.metadata?.createdAt ? new Date(uploadedFileData.metadata.createdAt).toLocaleString('ar-SA') : 'غير محدد'}
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>إجمالي السجلات:</span>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                            {uploadedFileData.metadata?.totalRecords?.toLocaleString() || Object.values(uploadedFileData.data || {}).reduce((acc, a) => acc + (a?.length || 0), 0)} سجل
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>النطاق والمجمعات:</span>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                            {uploadedFileData.metadata?.schoolScopeName || 'كافة المدارس'}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '12.5px',
                        color: '#991b1b',
                        marginBottom: '18px'
                      }}>
                        ⚠️ <strong>تنبيه:</strong> سيتم دمج واستعادة السجلات الموجودة في الملف إلى جداول المنظومة الحالية مع الحفاظ على استقلالية المدارس والمجمعات.
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                          لتأكيد الاستعادة من الملف، يرجى كتابة كلمة <strong style={{ color: '#2563eb' }}>"استعادة"</strong>:
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder='اكتب "استعادة" هنا...'
                          value={restoreConfirmInput}
                          onChange={(e) => setRestoreConfirmInput(e.target.value)}
                          style={{
                            maxWidth: '300px',
                            border: restoreConfirmInput.trim() === 'استعادة' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '15px'
                          }}
                        />
                      </div>

                      <button
                        onClick={handleExecuteLocalFileRestore}
                        disabled={isRestoring || restoreConfirmInput.trim() !== 'استعادة'}
                        style={{
                          background: (isRestoring || restoreConfirmInput.trim() !== 'استعادة')
                            ? '#cbd5e1'
                            : 'linear-gradient(135deg, #16a34a, #15803d)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '12px 24px',
                          fontWeight: 800,
                          fontSize: '14px',
                          cursor: (isRestoring || restoreConfirmInput.trim() !== 'استعادة') ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        {isRestoring ? <RefreshCw size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                        <span>{isRestoring ? 'جاري الاستعادة...' : 'تأكيد واستعادة البيانات في قاعدة البيانات الآن'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
