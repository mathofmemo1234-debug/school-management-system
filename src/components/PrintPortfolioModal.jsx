import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { 
  Printer, 
  Download, 
  X, 
  Award, 
  BookOpen, 
  CheckCircle2, 
  User, 
  Sparkles, 
  Building, 
  Calendar,
  Layers,
  FileText,
  Eye,
  Settings,
  ShieldCheck,
  RefreshCw,
  Zap
} from 'lucide-react';
import { DEFAULT_PORTFOLIO_DOMAINS, PORTFOLIO_ROLES } from '../data/portfolioData';

export default function PrintPortfolioModal({
  role = 'teacher',
  userData = {},
  portfolioData = {},
  schoolName = '',
  onClose
}) {
  const [reportTitle, setReportTitle] = useState(
    role === 'superadmin'
      ? 'ملف إنجاز الإدارة العامة والماستر العام'
      : role === 'student' 
      ? 'ملف الإنجاز الأكاديمي والأنشطة الطلابية'
      : role === 'supervisor'
      ? 'ملف الإنجاز والتميز الإشرافي المهني'
      : role === 'staff'
      ? 'ملف الإنجاز والتطوير الإداري المدرسي'
      : role === 'admin'
      ? 'ملف إنجاز القيادة المدرسية والاعتماد'
      : 'ملف الإنجاز المهني والتربوي للمعلم'
  );

  const [livePortfolioData, setLivePortfolioData] = useState(portfolioData || {});
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Live real-time Firestore sync with onSnapshot & LocalStorage cache
  useEffect(() => {
    // 1. Try LocalStorage for immediate zero-latency load
    const idToTry = userData?.id || userData?.nationalId;
    const nidToTry = userData?.nationalId;
    if (idToTry || nidToTry) {
      const cacheKey1 = `portfolio_${role}_${idToTry}`;
      const cacheKey2 = nidToTry ? `portfolio_${role}_${nidToTry}` : null;
      const cached = localStorage.getItem(cacheKey1) || (cacheKey2 ? localStorage.getItem(cacheKey2) : null);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Object.keys(parsed).length > 0) {
            setLivePortfolioData(parsed);
          }
        } catch (e) {}
      }
    }

    if (portfolioData && Object.keys(portfolioData).length > 0) {
      setLivePortfolioData(prev => ({ ...(prev || {}), ...portfolioData }));
    }

    if (!db) return;
    if (!idToTry && !nidToTry) return;

    setIsLoadingLive(true);
    let unsubPrimary = null;
    let unsubSecondary = null;

    try {
      if (idToTry) {
        const docRef = doc(db, 'portfolios', `${role}_${idToTry}`);
        unsubPrimary = onSnapshot(docRef, (snap) => {
          if (snap.exists() && snap.data()?.portfolioData) {
            setLivePortfolioData(snap.data().portfolioData);
            setLastSyncTime(snap.data().updatedAt || new Date().toISOString());
            setIsLoadingLive(false);
          }
        }, (err) => {
          console.warn('Live portfolio snapshot error:', err);
        });
      }

      if (nidToTry && nidToTry !== idToTry) {
        const docRef2 = doc(db, 'portfolios', `${role}_${nidToTry}`);
        unsubSecondary = onSnapshot(docRef2, (snap) => {
          if (snap.exists() && snap.data()?.portfolioData) {
            setLivePortfolioData(snap.data().portfolioData);
            setLastSyncTime(snap.data().updatedAt || new Date().toISOString());
            setIsLoadingLive(false);
          }
        });
      }

      // Also fallback initial fetch by nationalId query if not found
      if (nidToTry) {
        const q = query(collection(db, 'portfolios'), where('nationalId', '==', String(nidToTry).trim()));
        getDocs(q).then((qSnap) => {
          if (!qSnap.empty && qSnap.docs[0].data()?.portfolioData) {
            setLivePortfolioData(qSnap.docs[0].data().portfolioData);
            setLastSyncTime(qSnap.docs[0].data().updatedAt || new Date().toISOString());
          }
        }).catch(err => console.warn(err)).finally(() => setIsLoadingLive(false));
      }
    } catch (err) {
      console.warn('Error setting up live portfolio listener:', err);
      setIsLoadingLive(false);
    }

    return () => {
      if (unsubPrimary) unsubPrimary();
      if (unsubSecondary) unsubSecondary();
    };
  }, [role, userData, portfolioData]);

  // Combined and fully merged portfolio data
  const effectivePortfolioData = useMemo(() => {
    const merged = {};
    if (livePortfolioData && typeof livePortfolioData === 'object') {
      Object.keys(livePortfolioData).forEach(domainKey => {
        merged[domainKey] = { ...(livePortfolioData[domainKey] || {}) };
      });
    }
    if (portfolioData && typeof portfolioData === 'object') {
      Object.keys(portfolioData).forEach(domainKey => {
        merged[domainKey] = {
          ...(merged[domainKey] || {}),
          ...(portfolioData[domainKey] || {})
        };
      });
    }
    return merged;
  }, [livePortfolioData, portfolioData]);

  const [customSchoolName, setCustomSchoolName] = useState(
    schoolName || userData?.schoolName || 'المجمع التعليمي'
  );
  const [academicYear, setAcademicYear] = useState('1447 - 1448 هـ');
  const [personName, setPersonName] = useState(
    userData?.name || 
    portfolioData?.profile?.fullName || 
    livePortfolioData?.profile?.fullName || 
    'عضو الكادر التعليمي'
  );
  const [principalName, setPrincipalName] = useState(userData?.principalName || 'إدارة المدرسة');
  const [supervisorName, setSupervisorName] = useState('المشرف التربوي المعتمد');
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'settings'

  // Update name if loaded asynchronously
  useEffect(() => {
    const loadedName = effectivePortfolioData?.profile?.fullName || userData?.name;
    if (loadedName && (!personName || personName === 'عضو الكادر التعليمي')) {
      setPersonName(loadedName);
    }
  }, [effectivePortfolioData, userData, personName]);

  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeBadges, setIncludeBadges] = useState(true);
  const [includeTables, setIncludeTables] = useState(true);

  // Domains for this role
  const domains = useMemo(() => {
    return DEFAULT_PORTFOLIO_DOMAINS[role] || DEFAULT_PORTFOLIO_DOMAINS[PORTFOLIO_ROLES.TEACHER];
  }, [role]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      role,
      user: userData,
      portfolio: portfolioData,
      exportDate: new Date().toISOString()
    }, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `ملف_الإنجاز_${personName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const modalJSX = (
    <div className="portfolio-modal-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px',
      overflowY: 'auto'
    }} dir="rtl">
      
      {/* Printable CSS Injection */}
      <style>{`
        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-size: 11pt !important;
          }
          /* Completely hide EVERYTHING on body except the portfolio-modal-root so 0 blank pages exist! */
          body > *:not(.portfolio-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }

          .portfolio-modal-root,
          .portfolio-modal-dialog,
          .portfolio-modal-preview-scroll {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            min-height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            backdrop-filter: none !important;
          }

          #portfolio-printable-document,
          #portfolio-printable-document * {
            visibility: visible !important;
          }

          #portfolio-printable-document {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            box-sizing: border-box !important;
          }

          .portfolio-section-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 22px !important;
          }

          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 12mm 12mm 12mm 12mm;
          }
        }
      `}</style>

      <div className="portfolio-modal-dialog glass-panel" style={{
        width: '1150px',
        maxWidth: '100%',
        maxHeight: '94vh',
        background: '#f8fafc',
        borderRadius: '24px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        
        {/* ================= MODAL TOP CONTROLS (SCREEN ONLY) ================= */}
        <div className="no-print" style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          borderBottom: '1px solid #334155'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                padding: '10px',
                borderRadius: '14px',
                color: '#fff',
                display: 'flex',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}>
                <Award size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>
                    طباعة وتصدير ملف الإنجاز الإلكتروني الشامل
                  </h3>
                  <span style={{ 
                    background: '#059669', 
                    color: '#ecfdf5', 
                    padding: '2px 8px', 
                    borderRadius: '8px', 
                    fontSize: '0.72rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}>
                    <Zap size={12} /> متصل لحظياً
                  </span>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  وثيقة إنجاز رسمية موثقة وفق المعايير العالمية وهيئة تقويم التعليم والتدريب (ETEC)
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportJSON}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid #475569',
                  color: '#f1f5f9',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                <span>نسخة JSON</span>
              </button>

              <button
                onClick={handlePrint}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                }}
              >
                <Printer size={18} />
                <span>طباعة المستند (PDF)</span>
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '8px',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Settings Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
            <button
              onClick={() => setActiveTab('preview')}
              style={{
                background: activeTab === 'preview' ? '#0284c7' : 'transparent',
                color: activeTab === 'preview' ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Eye size={16} />
              <span>معاينة المستند المطبوع</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                background: activeTab === 'settings' ? '#0284c7' : 'transparent',
                color: activeTab === 'settings' ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Settings size={16} />
              <span>تخصيص الترويسة والخيارات</span>
            </button>
          </div>

          {/* Quick Customization Row */}
          {activeTab === 'settings' && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>عنوان الملف / التقرير:</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>اسم المدرسة / المجمع:</label>
                <input
                  type="text"
                  value={customSchoolName}
                  onChange={e => setCustomSchoolName(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>صاحب الملف:</label>
                <input
                  type="text"
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>مدير المدرسة:</label>
                <input
                  type="text"
                  value={principalName}
                  onChange={e => setPrincipalName(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeSignatures} onChange={e => setIncludeSignatures(e.target.checked)} style={{ accentColor: '#0284c7' }} />
                  <span>تضمين جدول التوقيعات والختم المعتمد</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeBadges} onChange={e => setIncludeBadges(e.target.checked)} style={{ accentColor: '#0284c7' }} />
                  <span>تضمين الشارات والوسوم التخصصية</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeTables} onChange={e => setIncludeTables(e.target.checked)} style={{ accentColor: '#0284c7' }} />
                  <span>تضمين الجداول التفصيلية</span>
                </label>
              </div>
            </div>
          )}

        </div>

        {/* ================= DOCUMENT PREVIEW AREA (PRINTABLE) ================= */}
        <div className="portfolio-modal-preview-scroll" style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          background: '#e2e8f0',
          display: 'flex',
          justifyContent: 'center'
        }}>
          
          <div
            id="portfolio-printable-document"
            style={{
              width: '210mm',
              minHeight: '297mm',
              background: '#fff',
              color: '#0f172a',
              padding: '18mm 15mm',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              borderRadius: '4px',
              fontFamily: "'Cairo', 'Traditional Arabic', sans-serif"
            }}
          >
            
            {/* Header: Kingdom & Ministry Dual Logo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0284c7', paddingBottom: '14px', marginBottom: '18px' }}>
              
              <div style={{ textAlign: 'right', fontSize: '0.85rem', lineHeight: '1.5', color: '#1e293b' }}>
                <strong style={{ fontSize: '0.95rem', color: '#0369a1' }}>المملكة العربية السعودية</strong><br />
                <span>وزارة التعليم</span><br />
                <span>الإدارة العامة للتعليم بمنطقة مكة المكرمة</span><br />
                <strong>{customSchoolName}</strong>
              </div>

              {/* Center: Ministry & School Logos Side-by-Side */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '4px' }}>
                  <img
                    src={`${import.meta.env.BASE_URL}minst.svg`}
                    alt="وزارة التعليم"
                    style={{
                      height: '66px',
                      width: 'auto',
                      maxWidth: '115px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                    }}
                  />
                  <div style={{ width: '1.5px', height: '42px', background: '#cbd5e1' }}></div>
                  <img
                    src={userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`}
                    alt="شعار المدرسة"
                    style={{
                      height: '62px',
                      width: 'auto',
                      maxWidth: '95px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 'bold' }}>منظومة ملفات الإنجاز والتميز الرقمية</span>
              </div>

              <div style={{ textAlign: 'left', fontSize: '0.82rem', lineHeight: '1.5', color: '#1e293b' }}>
                <span>العام الدراسي: <strong>{academicYear}</strong></span><br />
                <span>صاحب الملف: <strong>{personName}</strong></span><br />
                <span>الصفة: <strong>{role === 'student' ? 'طالب' : role === 'supervisor' ? 'مشرف تربوي' : role === 'staff' ? 'كادر إداري' : role === 'admin' ? 'مدير المدرسة' : 'معلم'}</strong></span><br />
                <span>تاريخ الطباعة: <strong>{new Date().toLocaleDateString('ar-SA')}</strong></span>
              </div>

            </div>

            {/* Document Title Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#fff',
              textAlign: 'center',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)'
            }}>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.3px' }}>
                📁 {reportTitle}
              </h1>
              <div style={{ fontSize: '0.82rem', marginTop: '4px', opacity: 0.95 }}>
                وثيقة الشواهد والأدلة المهنية والأكاديمية المعيارية — {customSchoolName}
              </div>
            </div>

            {/* Render All Portfolio Domains */}
            {domains.map((domain, dIdx) => (
              <div key={domain.id} className="portfolio-section-break" style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                background: '#ffffff'
              }}>
                
                {/* Domain Title Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '2px solid #e0f2fe',
                  paddingBottom: '8px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    background: '#0284c7',
                    color: '#fff',
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {dIdx + 1}
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#0369a1', fontWeight: '800' }}>
                    {domain.title}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginInlineStart: 'auto' }}>
                    {domain.description}
                  </span>
                </div>

                {/* Domain Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {domain.items.map((item) => {
                    const domainObj = effectivePortfolioData?.[domain.id] || {};
                    const savedVal = domainObj[item.key];
                    
                    let val = savedVal;
                    if (val === undefined || val === null || val === '') {
                      if (item.key === 'fullName') {
                        val = userData?.name || personName || '';
                      } else if (item.key === 'nationalId') {
                        val = userData?.nationalId || '';
                      } else if (item.key === 'schoolName') {
                        val = customSchoolName || userData?.schoolName || 'المجمع التعليمي';
                      } else if (item.key === 'specialty' && (userData?.subject || userData?.specialty)) {
                        val = userData.subject || userData.specialty;
                      } else if (item.key === 'class' && (userData?.className || userData?.class)) {
                        val = userData.className || userData.class;
                      } else if (item.key === 'roleTitle' && userData?.roleTitle) {
                        val = userData.roleTitle;
                      } else {
                        val = item.defaultValue || '';
                      }
                    }

                    if (item.type === 'table') {
                      if (!includeTables) return null;
                      const rows = (Array.isArray(savedVal) && savedVal.length > 0) 
                        ? savedVal 
                        : (Array.isArray(item.defaultRows) ? item.defaultRows : []);
                      return (
                        <div key={item.key} style={{ marginTop: '4px' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                            📊 {item.label}:
                          </strong>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'right' }}>
                            <thead>
                              <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #86efac' }}>
                                {item.columns.map((col, cIdx) => (
                                  <th key={cIdx} style={{ padding: '6px 8px', color: '#166534', fontWeight: 'bold' }}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, rIdx) => (
                                <tr key={rIdx} style={{ borderBottom: '1px solid #e2e8f0', background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                  {item.columns.map((_, cIdx) => (
                                    <td key={cIdx} style={{ padding: '6px 8px', color: '#334155' }}>
                                      {row[`col${cIdx}`] || row[cIdx] || '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    if (item.type === 'badges') {
                      if (!includeBadges) return null;
                      const badges = (Array.isArray(savedVal) && savedVal.length > 0) 
                        ? savedVal 
                        : (Array.isArray(item.defaultBadges) ? item.defaultBadges : []);
                      return (
                        <div key={item.key} style={{ marginTop: '4px' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: '6px' }}>
                            🏷️ {item.label}:
                          </strong>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {badges.map((badge, bIdx) => (
                              <span key={bIdx} style={{
                                background: '#f0f9ff',
                                border: '1px solid #bae6fd',
                                color: '#0369a1',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '700'
                              }}>
                                ✓ {badge}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (item.type === 'textarea') {
                      return (
                        <div key={item.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px' }}>
                          <strong style={{ fontSize: '0.82rem', color: '#0369a1', display: 'block', marginBottom: '3px' }}>
                            📌 {item.label}:
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                            {val || '—'}
                          </p>
                        </div>
                      );
                    }

                    // Simple Text Field
                    return (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                        <span style={{ color: '#64748b', fontWeight: 'bold', minWidth: '140px' }}>• {item.label}:</span>
                        <span style={{ color: '#0f172a', fontWeight: '700' }}>{val || '—'}</span>
                      </div>
                    );
                  })}
                </div>

              </div>
            ))}

            {/* Official Signatures & Seal Table */}
            {includeSignatures && (
              <div className="avoid-break" style={{ marginTop: '22px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                
                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderBottom: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', fontSize: '0.82rem', color: '#334155' }}>
                  ✍️ الاعتماد والتوثيق الرسمي لملف الإنجاز المهني / الأكاديمي
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px', borderInlineEnd: '1px solid #e2e8f0', width: '33.33%' }}>صاحب ملف الإنجاز</th>
                      <th style={{ padding: '8px', borderInlineEnd: '1px solid #e2e8f0', width: '33.33%' }}>المشرف التربوي / رئيس القسم</th>
                      <th style={{ padding: '8px', width: '33.33%' }}>مدير مجمع المدارس</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '14px 8px', borderInlineEnd: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>{personName}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>التوقيع: .....................</span>
                      </td>
                      <td style={{ padding: '14px 8px', borderInlineEnd: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>{supervisorName}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>التوقيع: .....................</span>
                      </td>
                      <td style={{ padding: '14px 8px', verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>{principalName}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>الختم والتوقيع: .....................</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

              </div>
            )}

            {/* Official Running Stamp */}
            <div style={{
              marginTop: '20px',
              paddingTop: '10px',
              borderTop: '1px solid #cbd5e1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '0.72rem',
              color: '#64748b'
            }}>
              <span>🏛️ <strong>وثيقة ملف الإنجاز الإلكتروني المعتمدة</strong> — {customSchoolName}</span>
              <span>العام الدراسي: <strong>{academicYear}</strong></span>
              <span>تاريخ الإصدار: <strong>{new Date().toLocaleDateString('ar-SA')} م</strong></span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
