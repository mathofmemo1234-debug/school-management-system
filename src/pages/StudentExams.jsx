import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Clock, Play, CheckCircle, Printer, Wifi, WifiOff, Download, AlertTriangle, RotateCcw, Check, Save } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import { useLanguage } from '../contexts/LanguageContext';
import PrintExamModal from '../components/PrintExamModal';
import { parseExamDateTime, formatArabicTime, calculateDefaultCutoff } from '../utils/dateTimeUtils';

export default function StudentExams() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [exams, setExams] = useState([]);
  const [studentClass, setStudentClass] = useState('');
  const [studentDocId, setStudentDocId] = useState(null);
  const [examResults, setExamResults] = useState({});
  
  const [activeExam, setActiveExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [examTimeLeft, setExamTimeLeft] = useState(null); // in seconds
  const [recoveredNotice, setRecoveredNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoreView, setScoreView] = useState(null);
  const [printingExamResult, setPrintingExamResult] = useState(null);
  const [printingExamPaper, setPrintingExamPaper] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Network Online/Offline Listeners & Live Session status sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (activeExam && studentDocId) {
        setDoc(doc(db, 'exam_sessions', `${activeExam.id}_${studentDocId}`), {
          status: 'in_progress',
          isOnline: true,
          lastHeartbeat: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (activeExam && studentDocId) {
        setDoc(doc(db, 'exam_sessions', `${activeExam.id}_${studentDocId}`), {
          status: 'interrupted',
          isOnline: false,
          lastHeartbeat: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeExam, studentDocId]);

  // Periodic Heartbeat while exam is in progress
  useEffect(() => {
    if (!activeExam || !studentDocId) return;

    const hbInterval = setInterval(() => {
      if (navigator.onLine) {
        setDoc(doc(db, 'exam_sessions', `${activeExam.id}_${studentDocId}`), {
          status: 'in_progress',
          isOnline: true,
          lastHeartbeat: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    }, 15000);

    return () => clearInterval(hbInterval);
  }, [activeExam, studentDocId]);

  // 1-second live clock for reactive countdown & automatic unlocking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Active Exam Countdown Timer with Freeze on Offline
  useEffect(() => {
    if (!activeExam || examTimeLeft === null || examTimeLeft <= 0) return;

    const timer = setInterval(() => {
      if (isOnline) {
        setExamTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Time expired
            return 0;
          }
          const next = prev - 1;
          // Auto-save checkpoint
          if (studentDocId && activeExam) {
            localStorage.setItem(
              `exam_checkpoint_${activeExam.id}_${studentDocId}`,
              JSON.stringify({
                answers,
                remainingSeconds: next,
                lastSavedAt: new Date().toISOString()
              })
            );
          }
          return next;
        });
      }
      // When offline: DO NOTHING! Time remains completely frozen and preserved!
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, isOnline, answers, examTimeLeft, studentDocId]);

  // Fetch student info
  useEffect(() => {
    const isParent = userData?.role === 'parent';
    const nid = (isParent ? (userData?.studentNationalId || userData?.nationalId) : userData?.nationalId || '').trim();

    if (isParent && userData?.studentClass) {
      setStudentClass(userData.studentClass);
    }

    if (nid) {
      let q = query(collection(db, 'students'), where('nationalId', '==', nid));
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          const dData = snap.docs[0].data();
          setStudentClass(dData.class || dData.className || userData?.studentClass);
          setStudentDocId(snap.docs[0].id);
        } else if (!isNaN(nid)) {
          getDocs(query(collection(db, 'students'), where('nationalId', '==', Number(nid)))).then(numSnap => {
            if (!numSnap.empty) {
              const dData = numSnap.docs[0].data();
              setStudentClass(dData.class || dData.className || userData?.studentClass);
              setStudentDocId(numSnap.docs[0].id);
            }
          });
        }
      });
      return () => unsub();
    }
  }, [userData]);

  // Fetch exams for this class
  useEffect(() => {
    if (!studentClass) return;
    const schoolId = userData?.schoolId || 'default_school_1';
    const q = schoolId === 'ALL'
      ? query(collection(db, 'exams'), where('targetClass', '==', studentClass))
      : query(collection(db, 'exams'), where('targetClass', '==', studentClass), where('schoolId', '==', schoolId));

    const unsub = onSnapshot(q, snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      // Sort by date descending using robust datetime parser
      data.sort((a, b) => {
        const timeB = parseExamDateTime(b.examDate, b.startTime)?.getTime() || 0;
        const timeA = parseExamDateTime(a.examDate, a.startTime)?.getTime() || 0;
        return timeB - timeA;
      });
      setExams(data);
    });
    return () => unsub();
  }, [studentClass, userData?.schoolId]);

  // Fetch student's past results
  useEffect(() => {
    if (!studentDocId) return;
    const q = query(collection(db, 'exam_results'), where('studentId', '==', studentDocId));
    const unsub = onSnapshot(q, snap => {
      const resultsMap = {};
      snap.forEach(d => {
        const data = d.data();
        resultsMap[data.examId] = data;
      });
      setExamResults(resultsMap);
    });
    return () => unsub();
  }, [studentDocId]);

  const getExamTimeDetails = (exam) => {
    const cutoffStr = exam.entryDeadline || calculateDefaultCutoff(exam.startTime);
    if (examResults[exam.id]) {
      return { status: 'taken', cutoffTime: cutoffStr, diffSeconds: 0, formattedCountdown: '' };
    }

    const examStart = parseExamDateTime(exam.examDate, exam.startTime);
    const examCutoff = parseExamDateTime(exam.examDate, cutoffStr);
    
    if (!examStart || !examCutoff) {
      return { status: 'open', cutoffTime: cutoffStr, diffSeconds: 0, formattedCountdown: '' };
    }

    const nowTime = currentTime.getTime();
    const startTimeMs = examStart.getTime();
    const cutoffTimeMs = examCutoff.getTime();
    
    const diffMs = startTimeMs - nowTime;
    const diffSeconds = Math.floor(diffMs / 1000);

    if (nowTime > cutoffTimeMs) {
      return { status: 'expired', cutoffTime: cutoffStr, diffSeconds: 0, formattedCountdown: '' };
    }

    if (nowTime >= startTimeMs && nowTime <= cutoffTimeMs) {
      return { status: 'open', cutoffTime: cutoffStr, diffSeconds: 0, formattedCountdown: '' };
    }

    // If upcoming and within 5 minutes (300 seconds), activate countdown
    if (diffSeconds > 0 && diffSeconds <= 300) {
      const mins = Math.floor(diffSeconds / 60);
      const secs = diffSeconds % 60;
      const formattedCountdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      return { status: 'countdown', cutoffTime: cutoffStr, diffSeconds, formattedCountdown };
    }

    return { status: 'upcoming', cutoffTime: cutoffStr, diffSeconds, formattedCountdown: '' };
  };

  const canTakeExam = (exam) => {
    return getExamTimeDetails(exam).status === 'open';
  };

  const startExam = async (exam) => {
    if (!canTakeExam(exam)) {
      alert(t('studentExams.cannotEnterNow'));
      return;
    }

    setActiveExam(exam);
    setScoreView(null);

    // Register active session in Firestore for live teacher monitoring
    if (studentDocId) {
      const now = new Date();
      const sessionId = `${exam.id}_${studentDocId}`;
      try {
        await setDoc(doc(db, 'exam_sessions', sessionId), {
          examId: exam.id,
          studentId: studentDocId,
          studentName: userData?.name || 'طالب',
          nationalId: userData?.nationalId || '',
          className: studentClass,
          schoolId: userData?.schoolId || 'default_school_1',
          status: 'in_progress',
          enteredAt: now.toISOString(),
          enteredAtArabic: formatArabicTime(now),
          lastHeartbeat: now.toISOString(),
          isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Error creating exam session:", err);
      }
    }

    // Check for previous checkpoint
    const checkpointKey = `exam_checkpoint_${exam.id}_${studentDocId}`;
    const savedCheckpointStr = localStorage.getItem(checkpointKey);

    if (savedCheckpointStr) {
      try {
        const checkpoint = JSON.parse(savedCheckpointStr);
        setAnswers(checkpoint.answers || {});
        setExamTimeLeft(checkpoint.remainingSeconds !== undefined ? checkpoint.remainingSeconds : (exam.duration * 60));
        setRecoveredNotice(true);
        return;
      } catch (err) {
        console.error("Error reading exam checkpoint:", err);
      }
    }

    // Initial fresh start
    setAnswers({});
    setExamTimeLeft(exam.duration * 60);
    setRecoveredNotice(false);
  };

  const handleAnswerChange = (qIndex, optIndex) => {
    setAnswers(prev => {
      const next = { ...prev, [qIndex]: optIndex };
      if (activeExam && studentDocId) {
        localStorage.setItem(
          `exam_checkpoint_${activeExam.id}_${studentDocId}`,
          JSON.stringify({
            answers: next,
            remainingSeconds: examTimeLeft !== null ? examTimeLeft : (activeExam.duration * 60),
            lastSavedAt: new Date().toISOString()
          })
        );
      }
      return next;
    });
  };

  const submitExam = async () => {
    if (!activeExam || !studentDocId) return;

    if (!isOnline) {
      alert('⚠️ أنت غير متصل بالإنترنت حالياً. تم حفظ إجاباتك محلياً بشكل آمن. يرجى الاتصال بالإنترنت لتسليم إجاباتك أو استخراج الاختبار للحل الورقي.');
      return;
    }
    
    // Check if all answered
    if (Object.keys(answers).length < activeExam.questions.length) {
      if (!window.confirm(t('studentExams.confirmIncompleteSubmit'))) {
        return;
      }
    }

    setIsSubmitting(true);
    let correctCount = 0;
    activeExam.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctOption) {
        correctCount++;
      }
    });

    const now = new Date();
    const resultData = {
      examId: activeExam.id,
      studentId: studentDocId,
      score: correctCount,
      totalQuestions: activeExam.questions.length,
      answers: answers,
      schoolId: userData?.schoolId || 'default_school_1',
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'exam_results'), resultData);
      
      // Update session to 'submitted' for teacher live monitoring
      const sessionId = `${activeExam.id}_${studentDocId}`;
      await setDoc(doc(db, 'exam_sessions', sessionId), {
        status: 'submitted',
        submittedAt: now.toISOString(),
        submittedAtArabic: formatArabicTime(now),
        score: correctCount,
        totalQuestions: activeExam.questions.length,
        isOnline: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Remove local checkpoint
      localStorage.removeItem(`exam_checkpoint_${activeExam.id}_${studentDocId}`);
      
      setScoreView({
        score: correctCount,
        total: activeExam.questions.length
      });
    } catch (err) {
      console.error(err);
      alert(t('studentExams.submitFail'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatExamTime = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return '--:--';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (scoreView) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
        <CheckCircle size={64} color="#25D366" style={{ margin: '0 auto 20px auto' }} />
        <h2 style={{ color: 'var(--color-primary-dark)' }}>{t('studentExams.examDelivered')}</h2>
        <div style={{ fontSize: '24px', margin: '20px 0', background: 'rgba(255,255,255,0.5)', padding: '20px', borderRadius: '12px', display: 'inline-block' }}>
          {t('studentExams.grade')} <strong style={{ color: scoreView.score === scoreView.total ? '#25D366' : 'var(--color-primary)' }}>{scoreView.score}</strong> / {scoreView.total}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '10px' }}>
          <button 
            className="btn" 
            style={{ background: 'linear-gradient(135deg, #0e7490, #63B2C6)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setPrintingExamResult({
              exam: activeExam,
              results: [{
                studentId: studentDocId,
                score: scoreView.score,
                totalQuestions: scoreView.total,
                studentClass: studentClass,
                timestamp: new Date()
              }]
            })}
          >
            <Printer size={18} /> طباعة إشعار وشهادة النتيجة (Word/PDF)
          </button>
          <button className="btn btn-outline" onClick={() => { setActiveExam(null); setScoreView(null); }}>{t('studentExams.backToList')}</button>
        </div>

        {printingExamResult && (
          <PrintExamModal 
            exam={printingExamResult.exam} 
            results={printingExamResult.results}
            studentsCache={{ [studentDocId]: userData?.name || 'الطالب' }}
            mode="results"
            onClose={() => setPrintingExamResult(null)} 
          />
        )}
      </div>
    );
  }

  if (activeExam) {
    return (
      <div className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
        {/* Offline Banner & Timer Freeze Notice */}
        {!isOnline && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            color: '#991b1b',
            padding: '14px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <WifiOff size={24} color="#dc2626" />
              <div>
                <strong style={{ fontSize: '15px' }}>تنبيه: انقطع الاتصال بالإنترنت!</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7f1d1d' }}>
                  تم تجميد عداد الوقت وحفظ إجاباتك تلقائياً بنقطة الاسترجاع. لن يتم خصم أي ثانية حتى تعود للاتصال.
                </p>
              </div>
            </div>
            <button
              className="btn"
              onClick={() => setPrintingExamPaper(activeExam)}
              style={{
                background: '#991b1b',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} /> استخراج ورقة الاختبار للحل خارج المنصة (Word / PDF)
            </button>
          </div>
        )}

        {/* Checkpoint Restored Banner */}
        {recoveredNotice && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            color: '#166534',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>
              ✅ تم استرجاع إجاباتك السابقة والوقت المتبقي المحفوظ تلقائياً بنجاح!
            </span>
            <button
              onClick={() => setRecoveredNotice(false)}
              style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>{activeExam.title}</h2>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              المادة: <strong>{activeExam.subject}</strong> | عدد الأسئلة: <strong>{activeExam.questions.length}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Live Active Timer with Online/Offline indicator */}
            <div style={{
              background: !isOnline ? '#fee2e2' : examTimeLeft < 300 ? '#fef3c7' : '#f0fdf4',
              border: `1.5px solid ${!isOnline ? '#f87171' : examTimeLeft < 300 ? '#f59e0b' : '#86efac'}`,
              color: !isOnline ? '#991b1b' : examTimeLeft < 300 ? '#b45309' : '#166534',
              padding: '8px 16px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              <Clock size={18} />
              <span>الوقت المتبقي:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '18px', letterSpacing: '1px' }}>
                {formatExamTime(examTimeLeft)}
              </span>
              {!isOnline && (
                <span style={{ fontSize: '11px', background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: '6px' }}>
                  مجمد ⏸️
                </span>
              )}
            </div>

            {/* Extract Offline Paper Button */}
            <button
              className="btn btn-outline"
              onClick={() => setPrintingExamPaper(activeExam)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
              title="استخراج نموذج ورقي من الاختبار"
            >
              <Download size={15} /> استخراج ورقة الاختبار (Word/PDF)
            </button>
          </div>
        </div>

        {/* Questions List with Image Protection */}
        <div 
          className="no-save-image" 
          onContextMenu={(e) => e.preventDefault()} 
          style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
        >
          {activeExam.questions.map((q, qIndex) => (
            <div key={q.id || qIndex} style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 'bold', flexShrink: 0 }}>
                  {qIndex + 1}
                </div>
                <div style={{ flex: 1, fontSize: '16px' }}>
                  <MarkdownViewer content={q.text} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', paddingRight: '48px' }}>
                {q.options.map((optText, optIndex) => (
                  <label key={optIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', borderRadius: '8px', border: answers[qIndex] === optIndex ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', background: answers[qIndex] === optIndex ? 'rgba(99,178,198,0.05)' : '#f8fafc', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    <input 
                      type="radio" 
                      name={`q_${qIndex}`} 
                      checked={answers[qIndex] === optIndex}
                      onChange={() => handleAnswerChange(qIndex, optIndex)}
                      style={{ marginTop: '4px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <MarkdownViewer content={optText} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button className="btn btn-primary" style={{ padding: '12px 40px', fontSize: '18px' }} onClick={submitExam} disabled={isSubmitting}>
            {isSubmitting ? t('studentExams.submitting') : t('studentExams.submitExam')}
          </button>
        </div>

        {/* Offline Paper Modal if opened */}
        {printingExamPaper && (
          <PrintExamModal
            exam={printingExamPaper}
            mode="exam"
            onClose={() => setPrintingExamPaper(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}><FileText style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> {t('studentExams.exams')}</h2>
        
        {/* Network Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          background: isOnline ? '#dcfce7' : '#fee2e2',
          color: isOnline ? '#166534' : '#991b1b',
          border: `1px solid ${isOnline ? '#86efac' : '#fca5a5'}`
        }}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnline ? 'متصل بالإنترنت' : 'غير متصل (الوضع الآمن)'}</span>
        </div>
      </div>
      
      {exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          {t('studentExams.noExamsAvailable')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {exams.map(exam => {
            const timeDetails = getExamTimeDetails(exam);
            const { status, cutoffTime, formattedCountdown } = timeDetails;
            
            return (
              <div key={exam.id} style={{ background: 'rgba(255,255,255,0.7)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-primary-dark)' }}>{exam.title}</h3>
                <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>{t('studentExams.subjectLabel')} {exam.subject}</div>
                  <div>{t('studentExams.startTimeLabel')} {exam.examDate} {t('studentExams.hourLabel')} {exam.startTime}</div>
                  <div style={{ fontSize: '13px', color: '#0e7490', background: 'rgba(14, 116, 144, 0.08)', padding: '4px 8px', borderRadius: '6px' }}>
                    ⏳ آخر موعد لسماح الدخول: <strong>{cutoffTime}</strong>
                  </div>
                  <div>{t('studentExams.durationMins')} {exam.duration} {t('studentExams.minutes')}</div>
                  <div>{t('studentExams.numQuestionsLabel')} {exam.questions.length}</div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {status === 'taken' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                        {t('studentExams.deliveredGrade')} {examResults[exam.id].score} / {examResults[exam.id].totalQuestions}
                      </div>
                      <button
                        className="btn"
                        style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setPrintingExamResult({
                          exam,
                          results: [{
                            studentId: studentDocId,
                            score: examResults[exam.id].score,
                            totalQuestions: examResults[exam.id].totalQuestions,
                            studentClass: studentClass,
                            timestamp: examResults[exam.id].timestamp || new Date()
                          }]
                        })}
                      >
                        <Printer size={15} /> طباعة إشعار النتيجة (Word/PDF)
                      </button>
                    </div>
                  ) : status === 'countdown' ? (
                    <div style={{
                      background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                      border: '2px solid #3b82f6',
                      borderRadius: '10px',
                      padding: '14px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Clock size={16} /> العد التنازلي لبدء الاختبار (استعد):
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#1d4ed8', letterSpacing: '2px', fontFamily: 'monospace' }}>
                        ⏱️ {formattedCountdown}
                      </div>
                      <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '500' }}>
                        سيفتح زر الدخول تلقائياً فور انتهاء العد التنازلي
                      </div>
                    </div>
                  ) : status === 'open' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#f0fdf4', color: '#166534', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>
                        ✅ متاح الآن للدخول حتى {cutoffTime}
                      </div>
                      <button className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', fontSize: '15px' }} onClick={() => startExam(exam)}>
                        <Play size={18} /> {t('studentExams.startExam')} (الدخول مباشرة)
                      </button>
                    </div>
                  ) : status === 'upcoming' ? (
                    <div style={{ background: '#f1f5f9', color: '#64748b', padding: '12px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <Clock size={18} /> {t('studentExams.availableSoon')}
                      </div>
                      <small style={{ color: '#0e7490' }}>يبدأ عند {exam.startTime} (مهلة الدخول حتى {cutoffTime})</small>
                    </div>
                  ) : status === 'expired' ? (
                    <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                      ⚠️ انتهى وقت السماح بالدخول للاختبار (كان آخر موعد: {cutoffTime})
                    </div>
                  ) : null}

                  {/* Extract Paper Option in List */}
                  {status !== 'taken' && (
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}
                      onClick={() => setPrintingExamPaper(exam)}
                    >
                      <Download size={14} /> استخراج ورقة الاختبار (Word/PDF)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {printingExamResult && (
        <PrintExamModal 
          exam={printingExamResult.exam} 
          results={printingExamResult.results}
          studentsCache={{ [studentDocId]: userData?.name || 'الطالب' }}
          mode="results"
          onClose={() => setPrintingExamResult(null)} 
        />
      )}

      {printingExamPaper && (
        <PrintExamModal
          exam={printingExamPaper}
          mode="exam"
          onClose={() => setPrintingExamPaper(null)}
        />
      )}
    </div>
  );
}
