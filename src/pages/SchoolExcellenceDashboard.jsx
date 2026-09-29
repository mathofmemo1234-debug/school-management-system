import React, { useState, useEffect, useMemo } from 'react';
import { excellenceData, SCHOOL_NAME, PAGE_TITLE } from '../data/excellenceData';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { uploadFileToFirestore, downloadFile } from '../utils/fileStorageService';

import { 
  Award, 
  Search, 
  ChevronDown, 
  ChevronLeft, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Upload, 
  Link as LinkIcon, 
  Save, 
  Trash2, 
  Printer, 
  Shield, 
  Lock, 
  Unlock,
  Users,
  Sparkles,
  ExternalLink,
  Calendar,
  Layers,
  PieChart,
  X,
  FileCheck,
  Check
} from 'lucide-react';

import ExcellencePermissionsModal from '../components/ExcellencePermissionsModal';
import PrintExcellenceModal from '../components/PrintExcellenceModal';

export default function SchoolExcellenceDashboard() {
  const { userData, userRole } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'pending'

  // Expand all 4 domains and 11 criteria by default so all 54 indicators show up
  const [expandedDomains, setExpandedDomains] = useState(() => {
    const map = {};
    excellenceData.forEach(d => { map[d.id] = true; });
    return map;
  });

  const [expandedCriteria, setExpandedCriteria] = useState(() => {
    const map = {};
    excellenceData.forEach(d => {
      d.criteria.forEach(c => { map[c.id] = true; });
    });
    return map;
  });

  // Selected indicator (default to first indicator)
  const [selectedIndicator, setSelectedIndicator] = useState(
    excellenceData[0].criteria[0].indicators[0]
  );

  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Evidences store: { [indicatorId]: { description, targetGroup, linkUrl, fileName, fileData, fileType, docDate, isCompleted, teacherName, teacherId } }
  const [evidences, setEvidences] = useState({});

  // Current Form state for selected indicator
  const [formData, setFormData] = useState({
    description: '',
    targetGroup: '',
    linkUrl: '',
    fileName: '',
    fileData: '',
    fileType: '',
    fileUrl: '',
    docDate: new Date().toISOString().split('T')[0]
  });

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const schoolId = userData?.schoolId || 'default_school_1';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  // Allowed domains & criteria for current teacher
  const allowedDomains = userData?.excellenceAllowedDomains || [];
  const allowedCriteria = userData?.excellenceAllowedCriteria || [];

  // Check if current user has permission to edit selected domain/criteria
  const canEditSelectedIndicator = useMemo(() => {
    if (isAdmin) return true;
    if (!selectedIndicator) return false;
    
    // If no specific restrictions set for teacher, default to allowed
    if (allowedDomains.length === 0 && allowedCriteria.length === 0) return true;

    // Find domain and criterion for selected indicator
    for (const domain of excellenceData) {
      for (const criteria of domain.criteria) {
        for (const ind of criteria.indicators) {
          if (ind.id === selectedIndicator.id) {
            if (allowedDomains.includes(domain.id) || allowedCriteria.includes(criteria.id)) {
              return true;
            }
            return false;
          }
        }
      }
    }
    return true;
  }, [isAdmin, selectedIndicator, allowedDomains, allowedCriteria]);

  // Sync with Firestore collection 'excellence_evidences'
  useEffect(() => {
    if (!schoolId) {
      setEvidences({});
      return;
    }

    let q = query(collection(db, 'excellence_evidences'), where('schoolId', '==', schoolId));
    
    const unsub = onSnapshot(q, (snap) => {
      const remoteData = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.indicatorId) {
          remoteData[data.indicatorId] = data;
        }
      });
      setEvidences(remoteData);
    }, (err) => {
      console.warn('Firestore onSnapshot error', err);
    });

    return () => unsub();
  }, [schoolId]);

  // Sync form when selected indicator changes or evidence store updates
  useEffect(() => {
    if (!selectedIndicator) return;
    const existing = evidences[selectedIndicator.id];
    if (existing && (existing.description || existing.targetGroup || existing.fileName || existing.linkUrl || existing.fileUrl)) {
      setFormData({
        description: existing.description || selectedIndicator.defaultEvidence || '',
        targetGroup: existing.targetGroup || selectedIndicator.defaultTargetGroup || '',
        linkUrl: existing.linkUrl || '',
        fileName: existing.fileName || '',
        fileData: existing.fileData || '',
        fileType: existing.fileType || '',
        fileUrl: existing.fileUrl || '',
        docDate: existing.docDate || new Date().toISOString().split('T')[0]
      });
    } else {
      setFormData({
        description: selectedIndicator.defaultEvidence || '',
        targetGroup: selectedIndicator.defaultTargetGroup || '',
        linkUrl: '',
        fileName: '',
        fileData: '',
        fileType: '',
        fileUrl: '',
        docDate: new Date().toISOString().split('T')[0]
      });
    }
    setSaveSuccessMsg('');
  }, [selectedIndicator, evidences]);

  // Toggle domain accordion
  const toggleDomain = (domainId) => {
    setExpandedDomains(prev => ({
      ...prev,
      [domainId]: !prev[domainId]
    }));
  };

  // Toggle criteria accordion
  const toggleCriteria = (criteriaId) => {
    setExpandedCriteria(prev => ({
      ...prev,
      [criteriaId]: !prev[criteriaId]
    }));
  };

  const toggleAllExpand = (expand) => {
    const dMap = {};
    const cMap = {};
    excellenceData.forEach(d => {
      dMap[d.id] = expand;
      d.criteria.forEach(c => { cMap[c.id] = expand; });
    });
    setExpandedDomains(dMap);
    setExpandedCriteria(cMap);
  };

  // Calculate overall stats
  const totalIndicatorsCount = useMemo(() => {
    return excellenceData.reduce((acc, d) => acc + d.criteria.reduce((cAcc, c) => cAcc + c.indicators.length, 0), 0);
  }, []);
  const officialCount = useMemo(() => {
    let cnt = 0;
    excellenceData.forEach(d => d.criteria.forEach(c => c.indicators.forEach(i => { if (i.isOfficial) cnt++; })));
    return cnt;
  }, []);
  const reserveCount = useMemo(() => {
    let cnt = 0;
    excellenceData.forEach(d => d.criteria.forEach(c => c.indicators.forEach(i => { if (i.isReserve) cnt++; })));
    return cnt;
  }, []);
  const completedCount = useMemo(() => {
    return Object.values(evidences).filter(item => item && item.isCompleted).length;
  }, [evidences]);
  
  const completionPercentage = totalIndicatorsCount > 0 ? Math.round((completedCount / totalIndicatorsCount) * 100) : 0;

  // Handle search & expansion
  useEffect(() => {
    if (searchQuery.trim() === '') return;
    const queryStr = searchQuery.toLowerCase();
    
    const newExpandedDomains = { ...expandedDomains };
    const newExpandedCriteria = { ...expandedCriteria };

    excellenceData.forEach(domain => {
      let domainMatches = false;
      domain.criteria.forEach(criteria => {
        let criteriaMatches = false;
        criteria.indicators.forEach(ind => {
          if (
            ind.title.toLowerCase().includes(queryStr) ||
            ind.description.toLowerCase().includes(queryStr) ||
            (ind.code && ind.code.toLowerCase().includes(queryStr)) ||
            `مؤشر ${ind.id}`.includes(queryStr)
          ) {
            criteriaMatches = true;
            domainMatches = true;
          }
        });
        if (criteriaMatches) {
          newExpandedCriteria[criteria.id] = true;
        }
      });
      if (domainMatches) {
        newExpandedDomains[domain.id] = true;
      }
    });

    setExpandedDomains(newExpandedDomains);
    setExpandedCriteria(newExpandedCriteria);
  }, [searchQuery]);

  // Find parent domain & criterion for an indicator
  const getIndicatorContext = (indicatorId) => {
    for (const domain of excellenceData) {
      for (const criteria of domain.criteria) {
        for (const ind of criteria.indicators) {
          if (ind.id === indicatorId) {
            return { domain, criteria, indicator: ind };
          }
        }
      }
    }
    return null;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('حجم الملف كبير جداً. يرجى اختيار ملف بحجم أقل من 25 ميجابايت.');
      return;
    }

    setIsUploadingFile(true);
    setUploadProgress(15);
    try {
      const isImg = file.type.startsWith('image/');
      const result = await uploadFileToFirestore(file, {
        category: 'excellence',
        onProgress: (p) => setUploadProgress(p),
        metadata: {
          indicatorId: selectedIndicator?.id,
          schoolId
        }
      });

      // Keep inline thumbnail only if small enough (<200KB) to ensure Firestore document limits are never breached
      const inlinePreview = (isImg && result.dataUrl && result.dataUrl.length < 200000) ? result.dataUrl : '';

      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        fileUrl: result.url,
        fileData: inlinePreview,
        fileType: isImg ? 'image' : (file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'document')
      }));
    } catch (err) {
      console.error('Evidence file upload error:', err);
      alert('حدث خطأ أثناء رفع الشاهد: ' + (err.message || ''));
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!selectedIndicator || !canEditSelectedIndicator) return;

    setIsSavingFirestore(true);

    const isCompleted = Boolean(
      formData.description.trim() || formData.fileName || formData.linkUrl.trim()
    );

    const updatedRecord = {
      indicatorId: selectedIndicator.id,
      schoolId: schoolId,
      teacherId: userData?.nationalId || 'admin',
      teacherName: userData?.name || 'المدير',
      description: formData.description,
      targetGroup: formData.targetGroup,
      linkUrl: formData.linkUrl,
      fileName: formData.fileName,
      fileUrl: formData.fileUrl || '',
      fileData: formData.fileData || '',
      fileType: formData.fileType,
      docDate: formData.docDate,
      isCompleted,
      updatedAt: new Date().toISOString()
    };

    // 1. Update local state & localStorage
    setEvidences(prev => ({
      ...prev,
      [selectedIndicator.id]: updatedRecord
    }));

    // 2. Persist to Firestore
    try {
      await setDoc(
        doc(db, 'excellence_evidences', `${schoolId}_ind_${selectedIndicator.id}`),
        updatedRecord,
        { merge: true }
      );
      setSaveSuccessMsg('تم حفظ ومزامنة الشواهد والأدلة بنجاح!');
    } catch (err) {
      console.error('Error saving to Firestore', err);
      setSaveSuccessMsg('تم حفظ الشواهد محلياً وفي انتظار المزامنة.');
    } finally {
      setIsSavingFirestore(false);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  const handleClearForm = async () => {
    if (!selectedIndicator || !canEditSelectedIndicator) return;
    if (window.confirm('هل أنت تأكد من إزالة جميع الشواهد المرفقة لهذا المؤشر؟')) {
      setEvidences(prev => {
        const next = { ...prev };
        delete next[selectedIndicator.id];
        return next;
      });

      try {
        await deleteDoc(
          doc(db, 'excellence_evidences', `${schoolId}_ind_${selectedIndicator.id}`)
        );
      } catch (err) {
        console.warn('Could not delete from Firestore', err);
      }

      setFormData({
        description: '',
        targetGroup: '',
        linkUrl: '',
        fileName: '',
        fileData: '',
        fileType: '',
        fileUrl: '',
        docDate: new Date().toISOString().split('T')[0]
      });
      setSaveSuccessMsg('تم مسح الشواهد بنجاح.');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    }
  };

  const currentContext = getIndicatorContext(selectedIndicator?.id);

  return (
    <div dir="rtl" style={{ minHeight: '100%', fontFamily: "'Cairo', sans-serif" }} className="space-y-6">
      
      {/* Top Banner Header */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(99, 178, 198, 0.3)' }}>
              <Award size={30} />
            </div>
            <div>
              <h1 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '1.5rem', fontWeight: '800' }}>
                {PAGE_TITLE}
              </h1>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                {SCHOOL_NAME}
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(99, 178, 198, 0.1)', border: '1px solid rgba(99, 178, 198, 0.25)', borderRadius: '14px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--color-primary-dark)" />
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>إجمالي المؤشرات</span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-primary-dark)' }}>{totalIndicatorsCount}</strong>
              </div>
            </div>

            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '14px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#2563eb" />
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>المعتمدة الرسمية</span>
                <strong style={{ fontSize: '1rem', color: '#2563eb' }}>{officialCount}</strong>
              </div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '14px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#d97706" />
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>المساندة الاحتياطية</span>
                <strong style={{ fontSize: '1rem', color: '#d97706' }}>{reserveCount}</strong>
              </div>
            </div>

            <div style={{ background: 'rgba(180, 211, 150, 0.2)', border: '1px solid rgba(154, 191, 120, 0.4)', borderRadius: '14px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="var(--color-secondary-dark)" />
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block' }}>المكتملة</span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-secondary-dark)' }}>{completedCount} ({completionPercentage}%)</strong>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && (
              <button
                onClick={() => setShowPermissionsModal(true)}
                className="btn btn-secondary"
                style={{ borderRadius: '12px', fontSize: '0.85rem' }}
              >
                <Shield size={18} />
                <span>صلاحيات المعلمين</span>
              </button>
            )}

            <button 
              onClick={() => setShowPrintModal(true)}
              className="btn btn-primary"
              style={{ borderRadius: '12px', fontSize: '0.85rem' }}
            >
              <Printer size={18} />
              <span>معاينة وطباعة التقرير</span>
            </button>
          </div>

        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', background: 'rgba(0,0,0,0.06)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${completionPercentage}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary-dark))',
              transition: 'width 0.5s ease'
            }} 
          />
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Sidebar Accordion Panel */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مؤشر أو معيار..."
              style={{
                width: '100%',
                padding: '10px 40px 10px 14px',
                border: '1px solid rgba(99, 178, 198, 0.4)',
                borderRadius: '12px',
                background: '#fff',
                fontSize: '0.9rem'
              }}
            />
            <Search size={18} color="var(--color-text-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', left: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Status Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', background: 'rgba(0,0,0,0.04)', padding: '4px', borderRadius: '12px', fontSize: '0.75rem' }}>
            <button
              onClick={() => setFilterStatus('all')}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === 'all' ? 'var(--color-primary)' : 'transparent',
                color: filterStatus === 'all' ? '#fff' : 'var(--color-text-muted)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              الكل ({totalIndicatorsCount})
            </button>
            <button
              onClick={() => setFilterStatus('official')}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === 'official' ? '#2563eb' : 'transparent',
                color: filterStatus === 'official' ? '#fff' : 'var(--color-text-muted)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              المعتمدة ({officialCount})
            </button>
            <button
              onClick={() => setFilterStatus('reserve')}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === 'reserve' ? '#d97706' : 'transparent',
                color: filterStatus === 'reserve' ? '#fff' : 'var(--color-text-muted)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              الاحتياطية ({reserveCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === 'completed' ? 'var(--color-secondary-dark)' : 'transparent',
                color: filterStatus === 'completed' ? '#fff' : 'var(--color-text-muted)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              المكتملة ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              style={{
                padding: '6px 2px',
                gridColumn: 'span 2',
                borderRadius: '8px',
                border: 'none',
                background: filterStatus === 'pending' ? 'rgba(99, 178, 198, 0.2)' : 'transparent',
                color: filterStatus === 'pending' ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              المتبقية ({totalIndicatorsCount - completedCount})
            </button>
          </div>

          {/* Quick Expand / Collapse */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span>عرض القائمة:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => toggleAllExpand(true)}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary-dark)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
              >
                توسيع الكل
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => toggleAllExpand(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                طي الكل
              </button>
            </div>
          </div>

          {/* Accordion Tree */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {excellenceData.map(domain => {
              const isDomainExpanded = expandedDomains[domain.id];
              const isDomainAllowed = isAdmin || allowedDomains.length === 0 || allowedDomains.includes(domain.id);
              
              let domainCompleted = 0;
              let domainTotal = 0;
              domain.criteria.forEach(c => {
                c.indicators.forEach(ind => {
                  domainTotal++;
                  if (evidences[ind.id]?.isCompleted) domainCompleted++;
                });
              });

              return (
                <div key={domain.id} style={{ background: '#fff', border: '1px solid rgba(99, 178, 198, 0.25)', borderRadius: '14px', overflow: 'hidden' }}>
                  
                  {/* Domain Header */}
                  <button
                    onClick={() => toggleDomain(domain.id)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(99, 178, 198, 0.08)',
                      border: 'none',
                      borderBottom: '1px solid rgba(99, 178, 198, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'right'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDomainAllowed ? 'var(--color-primary)' : '#cbd5e1' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-primary-dark)', truncate: true }}>
                        {domain.title}
                      </span>
                      {!isDomainAllowed && <Lock size={14} color="#94a3b8" title="عرض فقط" />}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', background: '#fff', padding: '2px 8px', borderRadius: '10px', color: 'var(--color-text-muted)', border: '1px solid rgba(0,0,0,0.06)' }}>
                        {domainCompleted}/{domainTotal}
                      </span>
                      <ChevronDown size={16} color="var(--color-primary-dark)" style={{ transform: isDomainExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </button>

                  {/* Criteria list */}
                  {isDomainExpanded && (
                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(244, 248, 249, 0.5)' }}>
                      {domain.criteria.map(criteria => {
                        const isCriteriaExpanded = expandedCriteria[criteria.id];
                        const critCompleted = criteria.indicators.filter(ind => evidences[ind.id]?.isCompleted).length;

                        return (
                          <div key={criteria.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                            
                            <button
                              onClick={() => toggleCriteria(criteria.id)}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                background: 'transparent',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                color: 'var(--color-text-main)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ChevronLeft size={14} color="var(--color-primary)" style={{ transform: isCriteriaExpanded ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                                <span>{criteria.title}</span>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                {critCompleted}/{criteria.indicators.length}
                              </span>
                            </button>

                            {/* Indicators list */}
                            {isCriteriaExpanded && (
                              <div style={{ padding: '4px 8px 8px 8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                                {criteria.indicators
                                  .filter(ind => {
                                    const isDone = evidences[ind.id]?.isCompleted;
                                    if (filterStatus === 'completed') return isDone;
                                    if (filterStatus === 'pending') return !isDone;
                                    if (filterStatus === 'official') return ind.isOfficial;
                                    if (filterStatus === 'reserve') return ind.isReserve;
                                    if (searchQuery.trim()) {
                                      const q = searchQuery.toLowerCase();
                                      return (
                                        ind.title.toLowerCase().includes(q) ||
                                        ind.description.toLowerCase().includes(q) ||
                                        (ind.code && ind.code.toLowerCase().includes(q)) ||
                                        `مؤشر ${ind.id}`.includes(q)
                                      );
                                    }
                                    return true;
                                  })
                                  .map(ind => {
                                    const isSelected = selectedIndicator?.id === ind.id;
                                    const isDone = evidences[ind.id]?.isCompleted;

                                    return (
                                      <button
                                        key={ind.id}
                                        onClick={() => setSelectedIndicator(ind)}
                                        style={{
                                          width: '100%',
                                          textAlign: 'right',
                                          padding: '8px 10px',
                                          borderRadius: '8px',
                                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                                          background: isSelected ? 'rgba(99, 178, 198, 0.15)' : 'transparent',
                                          color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text-main)',
                                          fontWeight: isSelected ? 'bold' : 'normal',
                                          fontSize: '0.8rem',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '6px'
                                        }}
                                      >
                                        <div style={{ marginTop: '2px' }}>
                                          {isDone ? (
                                            <CheckCircle2 size={14} color="var(--color-secondary-dark)" />
                                          ) : (
                                            <Clock size={14} color="#94a3b8" />
                                          )}
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                          <span style={{ lineHeight: '1.4' }}>{ind.title}</span>
                                          {ind.isReserve && (
                                            <span style={{ alignSelf: 'flex-start', fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                              احتياطي مساند
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Display Area */}
        <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {selectedIndicator && currentContext ? (
            <>
              {/* Breadcrumb & Header */}
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--color-primary-dark)', fontWeight: 'bold' }}>
                  <span style={{ background: 'rgba(99, 178, 198, 0.12)', padding: '4px 10px', borderRadius: '8px' }}>
                    {currentContext.domain.title}
                  </span>
                  <span>/</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{currentContext.criteria.title}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-primary-dark)' }}>
                    {selectedIndicator.title}
                  </h2>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedIndicator.isReserve ? (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        مؤشر مساند احتياطي ⭐
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(99, 178, 198, 0.15)', color: 'var(--color-primary-dark)', border: '1px solid rgba(99, 178, 198, 0.4)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        مؤشر رسمي معتمد (56) 🎖️
                      </span>
                    )}

                    {canEditSelectedIndicator ? (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        مسموح بالتحرير ✍️
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', border: '1px solid rgba(100, 116, 139, 0.3)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        عرض فقط 🔒
                      </span>
                    )}

                    {evidences[selectedIndicator.id]?.isCompleted ? (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(180, 211, 150, 0.3)', color: 'var(--color-secondary-dark)', border: '1px solid var(--color-secondary-dark)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        تم رفع الشواهد
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                        في انتظار الإرفاق
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(99, 178, 198, 0.2)', padding: '14px', borderRadius: '12px' }}>
                  <p style={{ margin: 0, color: 'var(--color-text-main)', fontSize: '0.95rem' }}>
                    {selectedIndicator.description}
                  </p>
                </div>
              </div>

              {!canEditSelectedIndicator && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Lock size={20} color="#d97706" />
                  <span>عفواً، تحرير هذا المجال/المعيار مخصص للمعلمين المصرح لهم فقط من قِبل إدارة المدرسة. يمكنك الاطلاع على البيانات دون تعديل.</span>
                </div>
              )}

              {saveSuccessMsg && (
                <div style={{ background: 'rgba(56, 161, 105, 0.15)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '12px 16px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} />
                    <span>{saveSuccessMsg}</span>
                  </div>
                  <button onClick={() => setSaveSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--color-primary-dark)' }}>
                    <FileCheck size={20} />
                    <span>نموذج توثيق وتعبئة الشواهد والأدلة</span>
                  </div>

                  {canEditSelectedIndicator && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          description: selectedIndicator.defaultEvidence || '',
                          targetGroup: selectedIndicator.defaultTargetGroup || ''
                        }));
                      }}
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.8rem',
                        padding: '5px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(99, 178, 198, 0.12)',
                        color: 'var(--color-primary-dark)',
                        border: '1px solid rgba(99, 178, 198, 0.4)',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                      title="استيراد أو استعادة الشواهد والمستهدفين النموذجية"
                    >
                      <Sparkles size={15} color="#0e7490" />
                      <span>استيراد الشواهد والمستهدفين النموذجية</span>
                    </button>
                  )}
                </div>

                <div style={{ background: 'rgba(14, 116, 144, 0.06)', border: '1px solid rgba(14, 116, 144, 0.2)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', color: '#0e7490', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ flexShrink: 0 }} />
                  <span>تم تضمين الشواهد والمستهدفين النموذجية المعتمدة تلقائياً، مع إمكانية التحرير والتعديل والإضافة بحرية تامة قبل الحفظ.</span>
                </div>

                <fieldset disabled={!canEditSelectedIndicator} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                      تفاصيل ووصف الإنجاز الشواهد *
                    </label>
                    <textarea
                      rows={6}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="أدخل الخطوات والإنجازات والشواهد الميدانية المنفذة لتحقيق هذا المؤشر..."
                      disabled={!canEditSelectedIndicator}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid rgba(99, 178, 198, 0.4)',
                        borderRadius: '12px',
                        background: '#fff',
                        fontFamily: "'Cairo', sans-serif",
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                        الفئة المستهدفة / الجهة
                      </label>
                      <input
                        type="text"
                        value={formData.targetGroup}
                        onChange={e => setFormData({ ...formData, targetGroup: e.target.value })}
                        placeholder="مثال: المعلمون، الطلاب، أولياء الأمور"
                        disabled={!canEditSelectedIndicator}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                        تاريخ التوثيق
                      </label>
                      <input
                        type="date"
                        value={formData.docDate}
                        onChange={e => setFormData({ ...formData, docDate: e.target.value })}
                        disabled={!canEditSelectedIndicator}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                      رابط خارجي للشواهد (Google Drive / Cloud Link)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        value={formData.linkUrl}
                        onChange={e => setFormData({ ...formData, linkUrl: e.target.value })}
                        placeholder="https://drive.google.com/..."
                        disabled={!canEditSelectedIndicator}
                        style={{ textDirection: 'ltr', textAlign: 'left' }}
                      />
                      {formData.linkUrl && (
                        <a
                          href={formData.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0 16px', fontSize: '0.85rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
                        >
                          <ExternalLink size={16} />
                          <span>فتح الرابط</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                      رفع ملفات الأدلة (صور أو مستندات PDF)
                    </label>
                    
                    <div style={{ background: '#fff', border: '2px dashed rgba(99, 178, 198, 0.4)', padding: '16px', borderRadius: '14px', display: 'flex', itemsCenter: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {canEditSelectedIndicator && (
                        <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, fontSize: '0.85rem' }}>
                          <Upload size={18} />
                          <span>اختيار ملف</span>
                          <input
                            type="file"
                            onChange={handleFileChange}
                            accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx"
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}

                      <div style={{ flex: 1, minWidth: '200px' }}>
                        {isUploadingFile ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            <span>جاري رفع الشاهد والمزامنة... {uploadProgress}%</span>
                          </div>
                        ) : formData.fileName ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99, 178, 198, 0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText size={16} color="var(--color-primary-dark)" />
                              <span style={{ fontWeight: 'bold', color: 'var(--color-primary-dark)' }}>{formData.fileName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {formData.fileUrl && (
                                <>
                                  <a 
                                    href={formData.fileUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    style={{ background: '#0284c7', color: '#fff', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    معاينة
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => downloadFile(formData.fileUrl, formData.fileName)}
                                    style={{ background: '#0f766e', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    تحميل
                                  </button>
                                </>
                              )}
                              {canEditSelectedIndicator && (
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, fileName: '', fileData: '', fileType: '', fileUrl: '' })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}
                                  title="إزالة الملف"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>لم يتم اختيار ملف بعد (يدعم PDF، الصور، والمستندات حتى 25 ميجابايت)</span>
                        )}
                      </div>
                    </div>
                  </div>

                </fieldset>

                {canEditSelectedIndicator && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <button
                      type="submit"
                      disabled={isSavingFirestore}
                      className="btn btn-primary"
                      style={{ padding: '12px 28px' }}
                    >
                      <Save size={18} />
                      <span>{isSavingFirestore ? 'جاري الحفظ...' : 'حفظ ومصادقة الشاهد'}</span>
                    </button>

                    {evidences[selectedIndicator.id]?.isCompleted && (
                      <button
                        type="button"
                        onClick={handleClearForm}
                        style={{ background: 'rgba(229, 62, 62, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(229, 62, 62, 0.3)', padding: '10px 18px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                      >
                        <Trash2 size={16} />
                        <span>إزالة الشواهد لهذا المؤشر</span>
                      </button>
                    )}
                  </div>
                )}

              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-muted)' }}>
              <Award size={48} color="var(--color-primary)" style={{ marginBottom: '12px' }} />
              <p>اختر مؤشراً من القائمة الجانبية لإدارة وتعبئة الشواهد والأدلة.</p>
            </div>
          )}

        </div>

      </div>

      {/* Permissions Modal */}
      {showPermissionsModal && (
        <ExcellencePermissionsModal
          schoolId={schoolId}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}

      {/* Print & Preview Modal */}
      {showPrintModal && (
        <PrintExcellenceModal
          excellenceData={excellenceData}
          evidences={evidences}
          schoolName={SCHOOL_NAME}
          userData={userData}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
