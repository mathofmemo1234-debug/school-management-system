import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Award, 
  Printer, 
  Save, 
  Download, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  Sparkles, 
  BookOpen, 
  User, 
  Building,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  Search,
  Users,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  Zap,
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';
import { DEFAULT_PORTFOLIO_DOMAINS, PORTFOLIO_ROLES } from '../data/portfolioData';
import PrintPortfolioModal from '../components/PrintPortfolioModal';

export default function AchievementPortfolioPage({ targetRole, targetUser }) {
  const { currentUser, userRole, userData } = useAuth();
  
  const [selectedTargetUser, setSelectedTargetUser] = useState(targetUser || null);
  const [selectedTargetRole, setSelectedTargetRole] = useState(targetRole || null);

  const isAdminView = (userRole === 'admin' || userRole === 'superadmin') && !targetUser && !selectedTargetUser;

  if (isAdminView) {
    return (
      <AdminPortfoliosHub 
        schoolId={userData?.schoolId || 'default_school_1'} 
        onSelectUser={(u, r) => {
          setSelectedTargetUser(u);
          setSelectedTargetRole(r);
        }}
      />
    );
  }

  return (
    <PortfolioEditor 
      targetRole={selectedTargetRole || targetRole} 
      targetUser={selectedTargetUser || targetUser}
      onBackToHub={((userRole === 'admin' || userRole === 'superadmin') && selectedTargetUser) ? () => {
        setSelectedTargetUser(null);
        setSelectedTargetRole(null);
      } : null}
    />
  );
}

function PortfolioEditor({ targetRole, targetUser, onBackToHub }) {
  const { currentUser, userRole, userData } = useAuth();
  
  // Effective role and user
  const effectiveRole = targetRole || userData?.role || userRole || 'teacher';
  const effectiveUser = targetUser || userData || {};
  const userId = effectiveUser?.id || effectiveUser?.nationalId || currentUser?.uid || 'default_user';

  const defaultDomains = useMemo(() => {
    return DEFAULT_PORTFOLIO_DOMAINS[effectiveRole] || DEFAULT_PORTFOLIO_DOMAINS[PORTFOLIO_ROLES.TEACHER];
  }, [effectiveRole]);

  // State for active domain tab
  const [activeDomainId, setActiveDomainId] = useState(defaultDomains[0]?.id || 'profile');
  
  // Portfolio form data state (keyed by domainId -> itemKey -> value)
  const [portfolioData, setPortfolioData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Initialize data from localStorage or Firestore
  useEffect(() => {
    async function loadPortfolio() {
      setLoading(true);
      try {
        // Try local storage first
        const cacheKey = `portfolio_${effectiveRole}_${userId}`;
        const cached = localStorage.getItem(cacheKey);
        let initialData = cached ? JSON.parse(cached) : null;

        // Try Firestore
        if (!initialData && db) {
          try {
            const docRef = doc(db, 'portfolios', `${effectiveRole}_${userId}`);
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data()?.portfolioData) {
              initialData = snap.data().portfolioData;
            } else if (effectiveUser?.nationalId) {
              const docRef2 = doc(db, 'portfolios', `${effectiveRole}_${effectiveUser.nationalId}`);
              const snap2 = await getDoc(docRef2);
              if (snap2.exists() && snap2.data()?.portfolioData) {
                initialData = snap2.data().portfolioData;
              }
            }
          } catch (e) {
            console.warn('Firestore load portfolio warning:', e);
          }
        }

        // If no data, populate with default structure
        if (!initialData) {
          initialData = {};
          defaultDomains.forEach(domain => {
            initialData[domain.id] = {};
            domain.items.forEach(item => {
              if (item.key === 'fullName') {
                initialData[domain.id][item.key] = effectiveUser.name || '';
              } else if (item.key === 'nationalId') {
                initialData[domain.id][item.key] = effectiveUser.nationalId || '';
              } else if (item.key === 'schoolName') {
                initialData[domain.id][item.key] = effectiveUser.schoolName || userData?.schoolName || 'المجمع التعليمي';
              } else if (item.key === 'specialty' && effectiveUser.subject) {
                initialData[domain.id][item.key] = effectiveUser.subject;
              } else if (item.key === 'roleTitle' && effectiveUser.roleTitle) {
                initialData[domain.id][item.key] = effectiveUser.roleTitle;
              } else if (item.key === 'class' && (effectiveUser.class || effectiveUser.className)) {
                initialData[domain.id][item.key] = effectiveUser.class || effectiveUser.className;
              } else if (item.type === 'table') {
                initialData[domain.id][item.key] = [...item.defaultRows];
              } else if (item.type === 'badges') {
                initialData[domain.id][item.key] = [...item.defaultBadges];
              } else {
                initialData[domain.id][item.key] = item.defaultValue || '';
              }
            });
          });
        }

        setPortfolioData(initialData);
      } catch (err) {
        console.error('Error loading portfolio:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPortfolio();
  }, [effectiveRole, userId, defaultDomains, effectiveUser, userData]);

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const cacheKey = `portfolio_${effectiveRole}_${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify(portfolioData));

      if (db) {
        try {
          const payload = {
            portfolioData,
            role: effectiveRole,
            userId,
            nationalId: effectiveUser.nationalId || userData?.nationalId || '',
            userName: effectiveUser.name || userData?.name || '',
            schoolId: effectiveUser.schoolId || userData?.schoolId || '',
            schoolName: effectiveUser.schoolName || userData?.schoolName || '',
            subject: effectiveUser.subject || portfolioData?.profile?.specialty || '',
            className: effectiveUser.className || effectiveUser.class || portfolioData?.profile?.class || '',
            roleTitle: effectiveUser.roleTitle || '',
            updatedAt: new Date().toISOString(),
            isCompleted: true
          };

          const docRef = doc(db, 'portfolios', `${effectiveRole}_${userId}`);
          await setDoc(docRef, payload, { merge: true });

          if (effectiveUser.nationalId && effectiveUser.nationalId !== userId) {
            const docRef2 = doc(db, 'portfolios', `${effectiveRole}_${effectiveUser.nationalId}`);
            await setDoc(docRef2, payload, { merge: true });
          }
        } catch (e) {
          console.warn('Firestore save warning:', e);
        }
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving portfolio:', error);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default standard exemplars
  const handleResetToDefault = () => {
    if (!window.confirm('هل أنت متأكد من استعادة كافة الشواهد والبيانات النموذجية العالمية الافتراضية؟')) {
      return;
    }
    const freshData = {};
    defaultDomains.forEach(domain => {
      freshData[domain.id] = {};
      domain.items.forEach(item => {
        if (item.key === 'fullName') {
          freshData[domain.id][item.key] = effectiveUser.name || '';
        } else if (item.key === 'nationalId') {
          freshData[domain.id][item.key] = effectiveUser.nationalId || '';
        } else if (item.type === 'table') {
          freshData[domain.id][item.key] = [...item.defaultRows];
        } else if (item.type === 'badges') {
          freshData[domain.id][item.key] = [...item.defaultBadges];
        } else {
          freshData[domain.id][item.key] = item.defaultValue || '';
        }
      });
    });
    setPortfolioData(freshData);
  };

  // Field change handler
  const handleFieldChange = (domainId, itemKey, value) => {
    setPortfolioData(prev => ({
      ...prev,
      [domainId]: {
        ...(prev[domainId] || {}),
        [itemKey]: value
      }
    }));
  };

  // Table row change handler
  const handleTableRowChange = (domainId, itemKey, rowIndex, colKey, val) => {
    setPortfolioData(prev => {
      const currentRows = prev[domainId]?.[itemKey] || [];
      const updatedRows = [...currentRows];
      updatedRows[rowIndex] = { ...updatedRows[rowIndex], [colKey]: val };
      return {
        ...prev,
        [domainId]: {
          ...(prev[domainId] || {}),
          [itemKey]: updatedRows
        }
      };
    });
  };

  // Add new table row
  const handleAddTableRow = (domainId, itemKey, columns) => {
    setPortfolioData(prev => {
      const currentRows = prev[domainId]?.[itemKey] || [];
      const newRow = {};
      columns.forEach((_, idx) => {
        newRow[`col${idx}`] = '';
      });
      return {
        ...prev,
        [domainId]: {
          ...(prev[domainId] || {}),
          [itemKey]: [...currentRows, newRow]
        }
      };
    });
  };

  // Delete table row
  const handleDeleteTableRow = (domainId, itemKey, rowIndex) => {
    setPortfolioData(prev => {
      const currentRows = prev[domainId]?.[itemKey] || [];
      const updatedRows = currentRows.filter((_, idx) => idx !== rowIndex);
      return {
        ...prev,
        [domainId]: {
          ...(prev[domainId] || {}),
          [itemKey]: updatedRows
        }
      };
    });
  };

  // Add badge/tag
  const handleAddBadge = (domainId, itemKey, newBadgeText) => {
    if (!newBadgeText.trim()) return;
    setPortfolioData(prev => {
      const currentBadges = prev[domainId]?.[itemKey] || [];
      if (currentBadges.includes(newBadgeText.trim())) return prev;
      return {
        ...prev,
        [domainId]: {
          ...(prev[domainId] || {}),
          [itemKey]: [...currentBadges, newBadgeText.trim()]
        }
      };
    });
  };

  // Remove badge/tag
  const handleRemoveBadge = (domainId, itemKey, badgeText) => {
    setPortfolioData(prev => {
      const currentBadges = prev[domainId]?.[itemKey] || [];
      return {
        ...prev,
        [domainId]: {
          ...(prev[domainId] || {}),
          [itemKey]: currentBadges.filter(b => b !== badgeText)
        }
      };
    });
  };

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    let totalItems = 0;
    let filledItems = 0;
    defaultDomains.forEach(domain => {
      domain.items.forEach(item => {
        totalItems++;
        const val = portfolioData[domain.id]?.[item.key];
        if (Array.isArray(val) && val.length > 0) filledItems++;
        else if (typeof val === 'string' && val.trim().length > 0) filledItems++;
      });
    });
    return totalItems > 0 ? Math.round((filledItems / totalItems) * 100) : 100;
  }, [defaultDomains, portfolioData]);

  const activeDomain = defaultDomains.find(d => d.id === activeDomainId) || defaultDomains[0];

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '60px' }} dir="rtl">
      
      {/* Top Banner & Actions Header */}
      <div className="glass-panel" style={{
        padding: '24px 30px',
        borderRadius: '20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.08), rgba(99, 178, 198, 0.15))',
        border: '1px solid rgba(14, 116, 144, 0.2)'
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '10px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#0e7490',
                fontWeight: 'bold',
                fontSize: '0.88rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
              }}
              title="العودة إلى مركز القيادة والمتابعة"
            >
              <ArrowRight size={18} />
              <span>العودة للمركز</span>
            </button>
          )}
          <div style={{
            background: 'linear-gradient(135deg, #0e7490, #0284c7)',
            padding: '14px',
            borderRadius: '16px',
            color: '#fff',
            display: 'flex',
            boxShadow: '0 8px 16px rgba(14, 116, 144, 0.25)'
          }}>
            <Award size={32} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
                ملف الإنجاز الإلكتروني الشامل (E-Portfolio)
              </h1>
              <span style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                معايير ETEC و UNESCO
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '0.9rem' }}>
              توثيق الشواهد والأدلة المهنية، الأداء الأكاديمي، والمبادرات لـ: <strong>{effectiveUser.name || 'منسوب الصرح التعليمي'}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleResetToDefault}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}
            title="استعادة الشواهد النموذجية العالمية"
          >
            <RotateCcw size={16} />
            <span>استعادة النماذج</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.88rem',
              background: savedSuccess ? '#16a34a' : 'var(--color-primary, #0e7490)'
            }}
          >
            {savedSuccess ? <CheckCircle size={16} /> : <Save size={16} />}
            <span>{saving ? 'جاري الحفظ...' : savedSuccess ? 'تم الحفظ بنجاح!' : 'حفظ التعديلات'}</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowPrintModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.92rem',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}
          >
            <Printer size={18} />
            <span>معاينة وطباعة (PDF)</span>
          </button>
        </div>

      </div>

      {/* Completion Progress Bar */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: '16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
            <span style={{ fontWeight: 'bold', color: '#1e293b' }}>🎯 مؤشر اكتمال وتوثيق ملف الإنجاز</span>
            <span style={{ fontWeight: '800', color: completionPercentage >= 90 ? '#16a34a' : '#0284c7' }}>
              {completionPercentage}%
            </span>
          </div>
          <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{
              width: `${completionPercentage}%`,
              height: '100%',
              background: completionPercentage >= 90 
                ? 'linear-gradient(90deg, #10b981, #22c55e)' 
                : 'linear-gradient(90deg, #0e7490, #38bdf8)',
              borderRadius: '8px',
              transition: 'width 0.4s ease'
            }}></div>
          </div>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
          إجمالي الأقسام: <strong>{defaultDomains.length}</strong> مجالات معيارية
        </div>
      </div>

      {/* Main Workspace Layout (Domain Tabs + Active Domain Form) */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Domain Navigation Sidebar */}
        <div className="glass-panel" style={{ padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ padding: '8px 12px', fontWeight: 'bold', fontSize: '0.9rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', marginBottom: '4px' }}>
            مجالات ملف الإنجاز
          </div>
          {defaultDomains.map((domain, index) => {
            const isActive = domain.id === activeDomainId;
            return (
              <button
                key={domain.id}
                onClick={() => setActiveDomainId(domain.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, #0e7490, #0284c7)' : 'transparent',
                  color: isActive ? '#fff' : '#334155',
                  fontWeight: isActive ? '800' : '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 4px 12px rgba(14, 116, 144, 0.25)' : 'none'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                  color: isActive ? '#fff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {index + 1}
                </div>
                <span style={{ flex: 1 }}>{domain.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Domain Form Area */}
        <div className="glass-panel" style={{ padding: '24px 28px', borderRadius: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                {activeDomain.title}
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                {activeDomain.description}
              </p>
            </div>
            <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              جاهز للتحرير والتوثيق
            </span>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {activeDomain.items.map((item) => {
              const savedVal = portfolioData[activeDomain.id]?.[item.key];
              const currentValue = savedVal !== undefined ? savedVal : item.defaultValue;

              // Table Item
              if (item.type === 'table') {
                const rows = Array.isArray(savedVal) ? savedVal : item.defaultRows;
                return (
                  <div key={item.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <label style={{ fontWeight: '700', fontSize: '0.92rem', color: '#1e293b' }}>
                        📊 {item.label}
                      </label>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleAddTableRow(activeDomain.id, item.key, item.columns)}
                        style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus size={14} />
                        <span>إضافة صف جديد</span>
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#e2e8f0', borderBottom: '2px solid #cbd5e1' }}>
                            {item.columns.map((col, cIdx) => (
                              <th key={cIdx} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>
                                {col}
                              </th>
                            ))}
                            <th style={{ width: '40px', padding: '8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                              {item.columns.map((_, cIdx) => {
                                const colKey = `col${cIdx}`;
                                return (
                                  <td key={cIdx} style={{ padding: '6px 8px' }}>
                                    <input
                                      type="text"
                                      value={row[colKey] || ''}
                                      onChange={e => handleTableRowChange(activeDomain.id, item.key, rIdx, colKey, e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '0.82rem',
                                        background: '#f8fafc'
                                      }}
                                    />
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center', padding: '6px' }}>
                                <button
                                  onClick={() => handleDeleteTableRow(activeDomain.id, item.key, rIdx)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                  title="حذف الصف"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // Badges / Tags Item
              if (item.type === 'badges') {
                const badges = Array.isArray(savedVal) ? savedVal : item.defaultBadges;
                return (
                  <div key={item.key} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                    <label style={{ fontWeight: '700', fontSize: '0.92rem', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                      🏷️ {item.label}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      {badges.map((badge, bIdx) => (
                        <span key={bIdx} style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          border: '1px solid #bae6fd',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>{badge}</span>
                          <button
                            onClick={() => handleRemoveBadge(activeDomain.id, item.key, badge)}
                            style={{ background: 'transparent', border: 'none', color: '#0284c7', cursor: 'pointer', padding: '0', display: 'flex' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="أدخل مهارة / استراتيجية / عضوية جديدة..."
                        id={`badge-input-${item.key}`}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddBadge(activeDomain.id, item.key, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const inp = document.getElementById(`badge-input-${item.key}`);
                          if (inp) {
                            handleAddBadge(activeDomain.id, item.key, inp.value);
                            inp.value = '';
                          }
                        }}
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                );
              }

              // Textarea
              if (item.type === 'textarea') {
                return (
                  <div key={item.key}>
                    <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#1e293b', marginBottom: '6px' }}>
                      📝 {item.label}:
                    </label>
                    <textarea
                      rows={4}
                      value={currentValue || ''}
                      onChange={e => handleFieldChange(activeDomain.id, item.key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                );
              }

              // Default Text Input
              return (
                <div key={item.key}>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#1e293b', marginBottom: '6px' }}>
                    • {item.label}:
                  </label>
                  <input
                    type="text"
                    value={currentValue || ''}
                    onChange={e => handleFieldChange(activeDomain.id, item.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '0.9rem',
                      background: '#ffffff'
                    }}
                  />
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* Print / PDF Modal */}
      {showPrintModal && (
        <PrintPortfolioModal
          role={effectiveRole}
          userData={effectiveUser}
          portfolioData={portfolioData}
          schoolName={effectiveUser.schoolName || userData?.schoolName}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
}

// -------------------------------------------------------------
// 1. Admin & Principal Real-time Portfolios Command Center Hub
// -------------------------------------------------------------
function AdminPortfoliosHub({ schoolId, onSelectUser }) {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('teachers'); // 'teachers' | 'students' | 'staff' | 'supervisors' | 'admin_personal'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassOrSubj, setFilterClassOrSubj] = useState('');
  
  // Real-time collections state
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [portfoliosMap, setPortfoliosMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Printing modal state
  const [printingPerson, setPrintingPerson] = useState(null);
  const [printingRole, setPrintingRole] = useState('teacher');

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);

    const qTeachers = query(collection(db, 'teachers'), where('schoolId', '==', schoolId));
    const qStudents = query(collection(db, 'students'), where('schoolId', '==', schoolId));
    const qStaff = query(collection(db, 'staff'), where('schoolId', '==', schoolId));
    const qSupervisors = query(collection(db, 'supervisors'), where('schoolId', '==', schoolId));
    const qPortfolios = collection(db, 'portfolios');

    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubStaff = onSnapshot(qStaff, (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSupervisors = onSnapshot(qSupervisors, (snap) => {
      setSupervisors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPortfolios = onSnapshot(qPortfolios, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = data;
        if (data.nationalId) map[data.nationalId] = data;
        if (data.userId) map[data.userId] = data;
      });
      setPortfoliosMap(map);
      setLoading(false);
    });

    return () => {
      unsubTeachers();
      unsubStudents();
      unsubStaff();
      unsubSupervisors();
      unsubPortfolios();
    };
  }, [schoolId]);

  // Helper to check if a user has a saved live portfolio
  const getPortfolioStatus = (role, user) => {
    const key1 = `${role}_${user.id}`;
    const key2 = `${role}_${user.nationalId}`;
    const key3 = user.nationalId ? String(user.nationalId).trim() : null;
    const key4 = user.id;

    const entry = portfoliosMap[key1] || portfoliosMap[key2] || (key3 ? portfoliosMap[key3] : null) || portfoliosMap[key4];
    return entry || null;
  };

  // Compute Metrics
  const teacherPortfoliosCount = teachers.filter(t => getPortfolioStatus('teacher', t)).length;
  const studentPortfoliosCount = students.filter(s => getPortfolioStatus('student', s)).length;
  const staffPortfoliosCount = staff.filter(s => getPortfolioStatus('staff', s)).length;
  const supervisorPortfoliosCount = supervisors.filter(s => getPortfolioStatus('supervisor', s)).length;

  // Filter lists based on tab and search
  const currentList = useMemo(() => {
    let list = [];
    if (activeTab === 'teachers') list = teachers;
    else if (activeTab === 'students') list = students;
    else if (activeTab === 'staff') list = staff;
    else if (activeTab === 'supervisors') list = supervisors;

    return list.filter(item => {
      const matchSearch = !searchQuery.trim() || 
        (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.nationalId && item.nationalId.includes(searchQuery)) ||
        (item.subject && item.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.class && item.class.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.className && item.className.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.roleTitle && item.roleTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchFilter = !filterClassOrSubj || 
        (item.class === filterClassOrSubj || item.className === filterClassOrSubj || item.subject === filterClassOrSubj);

      return matchSearch && matchFilter;
    });
  }, [activeTab, teachers, students, staff, supervisors, searchQuery, filterClassOrSubj]);

  // Unique Classes or Subjects for Filter Dropdown
  const filterOptions = useMemo(() => {
    if (activeTab === 'students') {
      return Array.from(new Set(students.map(s => s.class || s.className).filter(Boolean)));
    }
    if (activeTab === 'teachers') {
      return Array.from(new Set(teachers.map(t => t.subject).filter(Boolean)));
    }
    return [];
  }, [activeTab, students, teachers]);

  const formatUpdateTime = (isoString) => {
    if (!isoString) return 'غير محدد';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '60px' }} dir="rtl">
      
      {/* Hub Top Banner */}
      <div className="glass-panel" style={{
        padding: '24px 30px',
        borderRadius: '20px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.12), rgba(99, 178, 198, 0.2))',
        border: '1px solid rgba(14, 116, 144, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0e7490, #0284c7)',
            padding: '16px',
            borderRadius: '16px',
            color: '#fff',
            display: 'flex',
            boxShadow: '0 8px 20px rgba(14, 116, 144, 0.3)'
          }}>
            <Award size={36} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>
                مركز القيادة والمتابعة اللحظية لملفات الإنجاز (E-Portfolio Hub)
              </h1>
              <span style={{
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Zap size={13} /> نفاذية ومزامنة لحظية مباشرة
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#475569', fontSize: '0.92rem' }}>
              الاطلاع الفوري، المتابعة، والتوثيق المعتمد لكافة ملفات إنجاز المعلمين والطلاب والكادر التعليمي والإداري.
            </p>
          </div>
        </div>

        {/* Quick Personal Portfolio Action */}
        <button
          onClick={() => setActiveTab('admin_personal')}
          className="btn"
          style={{
            background: activeTab === 'admin_personal' ? '#0f172a' : '#ffffff',
            color: activeTab === 'admin_personal' ? '#ffffff' : '#0e7490',
            border: '1px solid rgba(14, 116, 144, 0.3)',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <Award size={18} />
          <span>ملف إنجاز الإدارة والقيادة الخاص بي</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Teachers Metric */}
        <div 
          onClick={() => setActiveTab('teachers')}
          style={{
            background: activeTab === 'teachers' ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : '#ffffff',
            border: activeTab === 'teachers' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e40af' }}>ملفات إنجاز المعلمين</span>
            <Users size={20} color="#3b82f6" />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a' }}>{teacherPortfoliosCount}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>من إجمالي {teachers.length} معلم</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#2563eb', fontWeight: '600' }}>
            {teachers.length > 0 ? `${Math.round((teacherPortfoliosCount / teachers.length) * 100)}% تم التوثيق` : 'لا يوجد معلمون'}
          </div>
        </div>

        {/* Students Metric */}
        <div 
          onClick={() => setActiveTab('students')}
          style={{
            background: activeTab === 'students' ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : '#ffffff',
            border: activeTab === 'students' ? '2px solid #22c55e' : '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#166534' }}>ملفات إنجاز الطلاب</span>
            <GraduationCap size={20} color="#22c55e" />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a' }}>{studentPortfoliosCount}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>من إجمالي {students.length} طالب</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#16a34a', fontWeight: '600' }}>
            {students.length > 0 ? `${Math.round((studentPortfoliosCount / students.length) * 100)}% تم التوثيق` : 'لا يوجد طلاب'}
          </div>
        </div>

        {/* Staff Metric */}
        <div 
          onClick={() => setActiveTab('staff')}
          style={{
            background: activeTab === 'staff' ? 'linear-gradient(135deg, #faf5ff, #f3e8ff)' : '#ffffff',
            border: activeTab === 'staff' ? '2px solid #a855f7' : '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#6b21a8' }}>ملفات الكادر الإداري</span>
            <Briefcase size={20} color="#a855f7" />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a' }}>{staffPortfoliosCount}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>من إجمالي {staff.length} إداري</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#9333ea', fontWeight: '600' }}>
            {staff.length > 0 ? `${Math.round((staffPortfoliosCount / staff.length) * 100)}% تم التوثيق` : 'لا يوجد كادر إداري'}
          </div>
        </div>

        {/* Supervisors Metric */}
        <div 
          onClick={() => setActiveTab('supervisors')}
          style={{
            background: activeTab === 'supervisors' ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#ffffff',
            border: activeTab === 'supervisors' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#92400e' }}>ملفات المشرفين التربويين</span>
            <ShieldCheck size={20} color="#f59e0b" />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a' }}>{supervisorPortfoliosCount}</span>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>من إجمالي {supervisors.length} مشرف</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#d97706', fontWeight: '600' }}>
            {supervisors.length > 0 ? `${Math.round((supervisorPortfoliosCount / supervisors.length) * 100)}% تم التوثيق` : 'لا يوجد مشرفون'}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'admin_personal' ? (
        <PortfolioEditor 
          targetRole="admin" 
          targetUser={userData} 
          onBackToHub={() => setActiveTab('teachers')} 
        />
      ) : (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '18px' }}>
          
          {/* Tabs bar and filters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '16px'
          }}>
            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setActiveTab('teachers'); setFilterClassOrSubj(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'teachers' ? '#0e7490' : '#f1f5f9',
                  color: activeTab === 'teachers' ? '#ffffff' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Users size={16} />
                <span>ملفات المعلمين ({teachers.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('students'); setFilterClassOrSubj(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'students' ? '#0e7490' : '#f1f5f9',
                  color: activeTab === 'students' ? '#ffffff' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <GraduationCap size={16} />
                <span>ملفات الطلاب ({students.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('staff'); setFilterClassOrSubj(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'staff' ? '#0e7490' : '#f1f5f9',
                  color: activeTab === 'staff' ? '#ffffff' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Briefcase size={16} />
                <span>الكادر الإداري ({staff.length})</span>
              </button>

              <button
                onClick={() => { setActiveTab('supervisors'); setFilterClassOrSubj(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'supervisors' ? '#0e7490' : '#f1f5f9',
                  color: activeTab === 'supervisors' ? '#ffffff' : '#334155',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ShieldCheck size={16} />
                <span>المشرفين التربويين ({supervisors.length})</span>
              </button>
            </div>

            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={16} style={{ position: 'absolute', right: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="input-field"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم أو الهوية..."
                  style={{ paddingRight: '32px', marginBottom: 0, fontSize: '0.85rem' }}
                />
              </div>

              {filterOptions.length > 0 && (
                <select
                  className="input-field"
                  value={filterClassOrSubj}
                  onChange={e => setFilterClassOrSubj(e.target.value)}
                  style={{ width: '160px', marginBottom: 0, fontSize: '0.85rem' }}
                >
                  <option value="">{activeTab === 'students' ? 'كافة الفصول' : 'كافة التخصصات'}</option>
                  {filterOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* List of Persons Table/Cards */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>جاري تحميل وتحديث ملفات الإنجاز لحظياً...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <p style={{ fontSize: '1rem', fontWeight: '600' }}>لم يتم العثور على سجلات مطابقة للبحث.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {currentList.map(item => {
                const effectiveItemRole = activeTab === 'teachers' ? 'teacher' : activeTab === 'students' ? 'student' : activeTab === 'staff' ? 'staff' : 'supervisor';
                const pStatus = getPortfolioStatus(effectiveItemRole, item);
                const isCompleted = !!pStatus;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Person Details */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                          {item.name}
                        </h3>
                        
                        {(item.subject || item.class || item.className || item.roleTitle || item.specialty) && (
                          <span style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 10px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}>
                            {item.subject || item.class || item.className || item.roleTitle || item.specialty}
                          </span>
                        )}

                        {/* Real-time Status Badge */}
                        {isCompleted ? (
                          <span style={{
                            background: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            padding: '3px 10px',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <CheckCircle2 size={13} />
                            <span>مكتمل وموثق ({formatUpdateTime(pStatus.updatedAt)})</span>
                          </span>
                        ) : (
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            padding: '3px 10px',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <Clock size={13} />
                            <span>قيد الإعداد والتحديث</span>
                          </span>
                        )}
                      </div>

                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                        الهوية الوطنية: <strong>{item.nationalId || 'غير مسجل'}</strong> 
                        {item.nationality ? ` • الجنسية: ${item.nationality}` : ''}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setPrintingPerson(item);
                          setPrintingRole(effectiveItemRole);
                        }}
                        className="btn"
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          padding: '7px 14px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                        title="معاينة وطباعة وتصدير ملف الإنجاز"
                      >
                        <Printer size={15} />
                        <span>معاينة وطباعة</span>
                      </button>

                      <button
                        onClick={() => onSelectUser(item, effectiveItemRole)}
                        className="btn btn-primary"
                        style={{
                          padding: '7px 14px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                        title="فتح ملف الإنجاز الكامل للمراجعة والتوثيق والتحرير"
                      >
                        <Edit3 size={15} />
                        <span>مراجعة وتوثيق</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Live Print Portfolio Modal */}
      {printingPerson && (
        <PrintPortfolioModal
          role={printingRole}
          userData={printingPerson}
          schoolName={printingPerson.schoolName || userData?.schoolName}
          onClose={() => setPrintingPerson(null)}
        />
      )}

    </div>
  );
}
