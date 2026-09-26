import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { isClassOrStageMatch } from '../utils/classMatcher';
import LessonWorksheetModal from './LessonWorksheetModal';
import { 
  Sparkles, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Award, 
  Printer, 
  Search, 
  Filter, 
  User, 
  Layers, 
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function StudentWorksheets({ studentClassOverride = null, schoolIdOverride = null, initialOpenId = null }) {
  const { userData, currentUser } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  const effectiveClass = (studentClassOverride || userData?.class || userData?.className || userData?.studentClass || '')?.trim();
  const effectiveSchoolId = schoolIdOverride || userData?.schoolId || 'default_school_1';
  const targetOpenId = searchParams.get('open') || searchParams.get('id') || initialOpenId;

  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWorksheet, setActiveWorksheet] = useState(null);

  // Fetch all published worksheets for this school or globally
  useEffect(() => {
    const q = query(
      collection(db, 'worksheets'),
      where('status', '==', 'published')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const ws = { id: docSnap.id, ...docSnap.data() };
        
        // Smart matching algorithm that accounts for variations like '3 متوسط' vs 'ثالث متوسط'
        const matches = isClassOrStageMatch(
          effectiveClass,
          ws.className,
          ws.stage,
          ws.schoolId,
          effectiveSchoolId,
          ws.lessonTitle
        );

        if (matches) {
          list.push(ws);
        }
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      setWorksheets(list);
      setLoading(false);

      if (targetOpenId) {
        const target = list.find(w => w.id === targetOpenId);
        if (target) setActiveWorksheet(target);
      }
    }, (err) => {
      console.error('Error fetching student worksheets:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [effectiveClass, effectiveSchoolId, targetOpenId]);

  // Unique subjects for filter tabs
  const subjects = useMemo(() => {
    return Array.from(new Set(worksheets.map(w => w.subject).filter(Boolean)));
  }, [worksheets]);

  // Filtered worksheets
  const filteredWorksheets = useMemo(() => {
    return worksheets.filter(w => {
      const matchSubject = !selectedSubject || w.subject === selectedSubject;
      const matchSearch = !searchQuery || 
        (w.lessonTitle && w.lessonTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (w.subject && w.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (w.teacherName && w.teacherName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSubject && matchSearch;
    });
  }, [worksheets, selectedSubject, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0e7490 0%, #155e75 50%, #1e1b4b 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <Sparkles size={28} color="#67e8f9" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
              📄 أوراق العمل التفاعلية المعتمدة
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#cffafe', opacity: 0.9 }}>
              أوراق عمل إثرائية وتدريبية معتمدة للحل الذكي، المراجعة، والتصحيح الفوري والطباعة
            </p>
          </div>
        </div>

        {effectiveClass && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#fde047'
          }}>
            <Layers size={16} />
            <span>الصف: {effectiveClass}</span>
            <span style={{
              background: '#0284c7',
              color: 'white',
              borderRadius: '20px',
              padding: '2px 8px',
              fontSize: '11px',
              marginInlineStart: '4px'
            }}>
              {worksheets.length} ورقة عمل
            </span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Subject Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setSelectedSubject('')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: selectedSubject === '' ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
              background: selectedSubject === '' ? '#0e7490' : '#ffffff',
              color: selectedSubject === '' ? '#ffffff' : '#475569',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            جميع المواد ({worksheets.length})
          </button>
          {subjects.map(s => {
            const count = worksheets.filter(w => w.subject === s).length;
            const isSel = selectedSubject === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSubject(s)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isSel ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
                  background: isSel ? '#0e7490' : '#ffffff',
                  color: isSel ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {s} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', top: '10px', right: '12px' }} />
          <input
            type="text"
            className="input-field"
            placeholder="بحث في أوراق العمل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              margin: 0,
              paddingRight: '36px',
              fontSize: '12px',
              borderRadius: '20px',
              background: '#f8fafc'
            }}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          جاري تحميل أوراق العمل المعتمدة...
        </div>
      ) : filteredWorksheets.length === 0 ? (
        /* Empty State */
        <div className="glass-panel" style={{
          padding: '48px 24px',
          textAlign: 'center',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#e0f2fe',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '4px'
          }}>
            <FileText size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
            لا توجد أوراق عمل منشورة تطابق البحث حالياً
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '480px', lineHeight: 1.6 }}>
            يقوم معلمو المواد بنشر أوراق العمل الإثرائية والتدريبية بانتظام؛ وسيظهر لك إشعار فوري في الجرس 🔔 أعلى الشاشة فور اعتماد ونشر أي ورقة عمل جديدة.
          </p>
        </div>
      ) : (
        /* Worksheets Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '20px'
        }}>
          {filteredWorksheets.map((ws) => {
            const qCount = ws.questions?.length || 0;
            const points = ws.totalMarks || (qCount * 2);
            const timeEst = ws.estimatedMinutes || '20 دقيقة';

            return (
              <div
                key={ws.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1.5px solid #e2e8f0',
                  padding: '20px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Card Top Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #0e7490, #0369a1)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '8px'
                  }}>
                    {ws.subject || 'مادة عامة'}
                  </span>

                  <span style={{
                    background: '#f0fdf4',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    fontWeight: 700,
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle2 size={12} /> معتمدة للنشر
                  </span>
                </div>

                {/* Lesson Title */}
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#0f172a',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }} title={ws.lessonTitle}>
                    {ws.lessonTitle}
                  </h3>

                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <User size={13} color="#94a3b8" />
                    <span>إعداد المعلم: <strong>{ws.teacherName || 'معلم المادة'}</strong></span>
                  </div>
                </div>

                {/* Specs Pill Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '8px',
                  textAlign: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>الأسئلة</span>
                    <strong style={{ fontSize: '13px', color: '#0e7490' }}>{qCount} أسئلة</strong>
                  </div>
                  <div style={{ borderRight: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>الدرجة</span>
                    <strong style={{ fontSize: '13px', color: '#15803d' }}>{points} درجة</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>الزمن</span>
                    <strong style={{ fontSize: '12px', color: '#6366f1' }}>{timeEst}</strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveWorksheet(ws)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #0e7490, #0891b2)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 3px 8px rgba(14, 116, 144, 0.25)',
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <BookOpen size={16} />
                    <span>حل وتفاعل الآن</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveWorksheet(ws)}
                    style={{
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                    title="معاينة الطباعة وتصدير Word"
                  >
                    <Printer size={15} />
                    <span>طباعة</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Modal for Solving & Printing */}
      {activeWorksheet && (
        <LessonWorksheetModal
          isOpen={Boolean(activeWorksheet)}
          onClose={() => setActiveWorksheet(null)}
          existingWorksheet={activeWorksheet}
          readOnly={true}
          userRole="student"
        />
      )}
    </div>
  );
}
