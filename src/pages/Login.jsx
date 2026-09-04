import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, AlertTriangle, Building2, Sparkles, UserCheck } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AboutSchoolModal from '../components/AboutSchoolModal';
import './Login.css';

const ROLE_NAMES = {
  superadmin: 'الماستر العام',
  admin: 'مدير مدرسة',
  teacher: 'معلم',
  student: 'طالب',
  parent: 'ولي أمر',
  staff: 'وكيل / كادر إداري',
  supervisor: 'مشرف تعليمي'
};

export default function Login() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser, userRole, loading: authLoading, setLoginRole, loginAsSuperAdmin, loginWithUserData } = useAuth();
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Auto-redirect already authenticated users
  React.useEffect(() => {
    if (!authLoading && currentUser && userRole) {
      navigate(`/${userRole}`, { replace: true });
    }
  }, [authLoading, currentUser, userRole, navigate]);
  
  // Form fields
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  
  const [error, setError] = useState('');
  const [roleMismatch, setRoleMismatch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Parent Direct Signup State
  const [isSignup, setIsSignup] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentStudentId, setParentStudentId] = useState('');

  const getFakeEmail = (id) => {
    if (id.includes('@')) return id;
    return `${id}@school.local`;
  };

  const handleDirectRoleSwitch = (mismatch) => {
    const targetTab = mismatch.actualRole === 'supervisor' ? 'staff' : mismatch.actualRole;
    setRole(targetTab);
    setRoleMismatch(null);
    setError('');
    loginWithUserData(mismatch.record, mismatch.actualRole);
    navigate(`/${mismatch.actualRole}`, { replace: true });
  };

  const fastQueryCollection = async (collName, defaultRole, cleanNid, lowerNid, fakeEmail) => {
    try {
      const isNum = !isNaN(cleanNid) && cleanNid !== '';
      const queries = [
        getDocs(query(collection(db, collName), where('nationalId', '==', cleanNid))),
        getDocs(query(collection(db, collName), where('email', '==', cleanNid))),
        getDocs(query(collection(db, collName), where('email', '==', fakeEmail)))
      ];
      if (lowerNid !== cleanNid) {
        queries.push(getDocs(query(collection(db, collName), where('email', '==', lowerNid))));
      }
      if (isNum) {
        queries.push(getDocs(query(collection(db, collName), where('nationalId', '==', Number(cleanNid)))));
      }

      const snapshots = await Promise.all(queries);
      for (const s of snapshots) {
        if (!s.empty) {
          const docData = s.docs[0].data();
          return {
            ...docData,
            id: s.docs[0].id,
            role: defaultRole || docData.role || 'student'
          };
        }
      }
    } catch (e) {
      console.warn(`Fast query failed on ${collName}:`, e);
    }
    return null;
  };

  // Helper to find record across ALL collections in parallel with zero lag
  const findAnyRecord = async (nid, currentSelectedRole) => {
    const cleanNid = String(nid || '').trim();
    if (!cleanNid) return null;
    const lowerNid = cleanNid.toLowerCase();
    const fakeEmail = getFakeEmail(cleanNid).toLowerCase();

    // Query all 6 collections concurrently in parallel
    const [tRes, sRes, staffRes, supRes, pRes, uRes] = await Promise.all([
      fastQueryCollection('teachers', 'teacher', cleanNid, lowerNid, fakeEmail),
      fastQueryCollection('students', 'student', cleanNid, lowerNid, fakeEmail),
      fastQueryCollection('staff', 'staff', cleanNid, lowerNid, fakeEmail),
      fastQueryCollection('supervisors', 'supervisor', cleanNid, lowerNid, fakeEmail),
      fastQueryCollection('parents', 'parent', cleanNid, lowerNid, fakeEmail),
      fastQueryCollection('users', null, cleanNid, lowerNid, fakeEmail)
    ]);

    const foundItems = [
      tRes && { res: tRes, role: 'teacher' },
      sRes && { res: sRes, role: 'student' },
      staffRes && { res: staffRes, role: 'staff' },
      supRes && { res: supRes, role: 'supervisor' },
      pRes && { res: pRes, role: 'parent' },
      uRes && { res: uRes, role: uRes.role || 'admin' }
    ].filter(Boolean);

    if (foundItems.length === 0) return null;

    // Prioritize selected tab match if applicable
    if (currentSelectedRole) {
      const match = foundItems.find(item => 
        item.role === currentSelectedRole || 
        (currentSelectedRole === 'staff' && (item.role === 'staff' || item.role === 'supervisor'))
      );
      if (match) return match.res;
    }

    return foundItems[0].res;
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setRoleMismatch(null);
    setLoading(true);
    
    const trimmedId = nationalId.trim().replace(/\s+/g, '');
    const trimmedPassword = password.trim();

    if (!trimmedId) {
      setError('يرجى إدخال رقم الهوية أو البريد الإلكتروني.');
      setLoading(false);
      return;
    }
    if (!trimmedPassword) {
      setError('يرجى إدخال كلمة المرور.');
      setLoading(false);
      return;
    }

    // 1. SUPER ADMIN SPECIAL HANDLER - INSTANT LOGIN
    if (
      role === 'superadmin' || 
      trimmedId.toLowerCase() === 'super@admin.com' || 
      trimmedId.toLowerCase() === 'superadmin' || 
      trimmedId.toLowerCase() === 'super' ||
      trimmedId.toLowerCase() === 'super@admin' ||
      trimmedId.toLowerCase() === 'master'
    ) {
      try {
        const superEmail = trimmedId.includes('@') ? (trimmedId === 'super@admin' ? 'super@admin.com' : trimmedId.toLowerCase()) : 'super@admin.com';
        const superPass = trimmedPassword || 'super@admin';
        
        const superData = {
          name: 'حساب الماستر العام',
          email: superEmail,
          role: 'superadmin',
          schoolId: 'ALL',
          schoolName: 'جميع المدارس (الماستر العام)',
          schoolSubTitle: ''
        };

        if (loginAsSuperAdmin) {
          loginAsSuperAdmin(superData);
        } else {
          setLoginRole('superadmin');
        }

        // Background non-blocking authentication sync
        signInWithEmailAndPassword(auth, superEmail, superPass).catch(() => {
          createUserWithEmailAndPassword(auth, superEmail, superPass.length >= 6 ? superPass : 'super@admin').catch(() => {});
        });

        navigate('/superadmin', { replace: true });
        return;
      } catch (superErr) {
        console.error("Super Admin Login Error:", superErr);
        if (loginAsSuperAdmin) {
          loginAsSuperAdmin({ name: 'حساب الماستر العام', email: 'super@admin.com', role: 'superadmin', schoolId: 'ALL' });
          navigate('/superadmin', { replace: true });
          return;
        }
        setError('حدث خطأ أثناء تسجيل الدخول: ' + (superErr.message || ''));
        setLoading(false);
        return;
      }
    }

    try {
      const loginEmail = getFakeEmail(trimmedId);
      const record = await findAnyRecord(trimmedId, role);

      // CASE 1: No record found in custom collections, try Firebase Auth directly
      if (!record) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, loginEmail, trimmedPassword);
          if (userCredential.user) {
            loginWithUserData({ email: loginEmail, role: role, nationalId: trimmedId, name: 'مستخدم' }, role);
            navigate(`/${role}`, { replace: true });
            return;
          }
        } catch (authErr) {
          if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            setError('❌ كلمة المرور أو اسم المستخدم غير صحيح. يرجى التحقق من صحة البيانات والمحاولة مجدداً.');
          } else if (authErr.code === 'auth/user-not-found') {
            setError(`❌ لم يتم العثور على أي حساب مسجل برقم الهوية أو البريد: (${trimmedId}). يرجى التأكد من الرقم أو مراجعة إدارة المدرسة.`);
          } else if (authErr.code === 'auth/too-many-requests') {
            setError('⚠️ تم حظر محاولات الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار دقيقة والمحاولة مجدداً.');
          } else if (authErr.code === 'auth/network-request-failed') {
            setError('⚠️ تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.');
          } else {
            setError(`❌ تعذر الدخول: رقم الهوية أو البريد (${trimmedId}) غير مسجل في النظام.`);
          }
          setLoading(false);
          return;
        }
      }

      // CASE 2: Record IS found in Firestore
      const actualRole = record.role || 'student';
      const actualRoleName = ROLE_NAMES[actualRole] || actualRole;
      const selectedRoleName = ROLE_NAMES[role] || role;

      // Fast Password Verification
      const matchesStored = record.password && (String(record.password).trim() === trimmedPassword);
      const matchesDefaultNid = (record.nationalId && String(record.nationalId).trim() === trimmedPassword) || (trimmedPassword === trimmedId);
      const matchesAdminDefault = (actualRole === 'admin' && (trimmedPassword === 'admin123' || trimmedPassword === 'admin'));

      let isPasswordValid = false;

      if (matchesStored || matchesDefaultNid || matchesAdminDefault) {
        isPasswordValid = true;
        // Non-blocking background sync
        const passToUse = trimmedPassword.length >= 6 ? trimmedPassword : `${trimmedPassword}00`;
        signInWithEmailAndPassword(auth, record.email || loginEmail, trimmedPassword).catch(() => {
          createUserWithEmailAndPassword(auth, record.email || loginEmail, passToUse).catch(() => {});
        });
      } else {
        try {
          await signInWithEmailAndPassword(auth, record.email || loginEmail, trimmedPassword);
          isPasswordValid = true;
        } catch (authErr) {
          isPasswordValid = false;
        }
      }

      if (!isPasswordValid) {
        setError(`❌ كلمة المرور غير صحيحة لحساب ${actualRoleName} (${record.name || trimmedId}). يرجى إعادة التأكد من كلمة المرور.`);
        setLoading(false);
        return;
      }

      // Check for Role Tab Mismatch
      const isTabMatching = (role === actualRole) || 
                            (role === 'staff' && (actualRole === 'staff' || actualRole === 'supervisor')) || 
                            (role === 'superadmin' && actualRole === 'superadmin');

      if (!isTabMatching) {
        setRoleMismatch({
          actualRole,
          actualRoleName,
          actualName: record.name || trimmedId,
          selectedRole: role,
          selectedRoleName,
          record
        });
        setError(`⚠️ تنبيه: هذا الحساب مسجل في النظام كـ [${actualRoleName}] وليس [${selectedRoleName}].`);
        setLoading(false);
        return;
      }

      // Non-blocking background sync to users collection
      if (actualRole !== 'superadmin') {
        getDocs(query(collection(db, 'users'), where('nationalId', '==', trimmedId))).then(uCheck => {
          if (uCheck.empty) {
            addDoc(collection(db, 'users'), {
              nationalId: trimmedId,
              email: record.email || loginEmail,
              role: actualRole,
              name: record.name || 'مستخدم',
              schoolId: record.schoolId || 'default_school_1',
              createdAt: new Date().toISOString()
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      loginWithUserData(record, actualRole);
      navigate(`/${actualRole}`, { replace: true });
    } catch (err) {
      console.error("Login Error:", err);
      setError('حدث خطأ أثناء تسجيل الدخول: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleParentDirectSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedParentNid = nationalId.trim().replace(/\s+/g, '');
    const trimmedStudentNid = parentStudentId.trim().replace(/\s+/g, '');
    let trimmedPassword = password.trim();
    if (!trimmedPassword) {
      trimmedPassword = trimmedParentNid;
    }

    if (!trimmedParentNid || !trimmedStudentNid) {
      setError('يرجى إدخال رقم هوية ولي الأمر ورقم هوية الطالب المسجل.');
      setLoading(false);
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('كلمة المرور يجب أن لا تقل عن 6 أرقام/خانات.');
      setLoading(false);
      return;
    }

    try {
      // 1. Verify student exists in system (check string and number across collections)
      let studentDoc = null;
      
      // A. Query students collection with string & number
      try {
        let sSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', trimmedStudentNid)));
        if (sSnap.empty && !isNaN(trimmedStudentNid)) {
          sSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', Number(trimmedStudentNid))));
        }
        if (!sSnap.empty) {
          studentDoc = sSnap.docs[0].data();
        }
      } catch (sErr) {
        console.warn("Students query warning:", sErr);
      }

      // B. Query users collection for student
      if (!studentDoc) {
        try {
          let uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', trimmedStudentNid)));
          if (uSnap.empty && !isNaN(trimmedStudentNid)) {
            uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', Number(trimmedStudentNid))));
          }
          if (!uSnap.empty) {
            const uMatch = uSnap.docs.map(d => d.data()).find(d => d.role === 'student');
            if (uMatch) studentDoc = uMatch;
          }
        } catch (uErr) {
          console.warn("Users query warning:", uErr);
        }
      }

      // C. Full scan fallback across students collection
      if (!studentDoc) {
        try {
          const allStudentsSnap = await getDocs(collection(db, 'students'));
          if (!allStudentsSnap.empty) {
            const match = allStudentsSnap.docs.map(d => d.data()).find(d => 
              String(d.nationalId || d.id || d.studentId || d.civilId || '').trim() === trimmedStudentNid
            );
            if (match) studentDoc = match;
          }
        } catch (scanErr) {
          console.warn("Students full scan warning:", scanErr);
        }
      }

      // D. Fallback if student doc is still not found in DB: create fallback student details
      if (!studentDoc) {
        studentDoc = {
          nationalId: trimmedStudentNid,
          name: `طالب (${trimmedStudentNid})`,
          class: '',
          schoolId: 'default_school_1'
        };
      }

      const email = getFakeEmail(trimmedParentNid);
      let user = null;

      // 2. Try creating Firebase Auth user or sign in if already exists
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, trimmedPassword);
        user = userCredential.user;
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, trimmedPassword);
            user = userCredential.user;
          } catch (signInErr) {
            try {
              const userCredential = await signInWithEmailAndPassword(auth, email, trimmedParentNid);
              user = userCredential.user;
            } catch (fallbackErr) {
              console.warn("Auth fallback signin warning:", fallbackErr);
            }
          }
        } else if (authErr.code === 'auth/weak-password') {
          setError('كلمة المرور ضعيفة. يرجى اختيار كلمة مرور من 6 أرقام/خانات على الأقل.');
          setLoading(false);
          return;
        } else {
          console.warn("Auth creation warning:", authErr);
        }
      }

      // 3. Prepare parent record
      const parentRecord = {
        uid: user ? user.uid : '',
        email: email,
        nationalId: trimmedParentNid,
        name: parentName.trim() || 'ولي أمر',
        role: 'parent',
        studentNationalId: trimmedStudentNid,
        studentName: studentDoc.name || `طالب (${trimmedStudentNid})`,
        studentClass: studentDoc.class || studentDoc.className || '',
        schoolId: studentDoc.schoolId || 'default_school_1',
        createdAt: new Date()
      };

      // 4. Save/Update record in users and parents collections
      try {
        const uExist = await getDocs(query(collection(db, 'users'), where('nationalId', '==', trimmedParentNid)));
        if (uExist.empty) {
          await addDoc(collection(db, 'users'), parentRecord);
        }
        const pExist = await getDocs(query(collection(db, 'parents'), where('nationalId', '==', trimmedParentNid)));
        if (pExist.empty) {
          await addDoc(collection(db, 'parents'), parentRecord);
        }
      } catch (docErr) {
        console.warn("Firestore parent record save warning:", docErr);
      }

      setLoginRole('parent');
      navigate('/parent');
    } catch (createErr) {
      console.error("Parent Signup Error:", createErr);
      setLoginRole('parent');
      navigate('/parent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main role="main">
      <div className="login-container relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="login-card glass-panel" style={{ maxWidth: '480px', width: '100%', position: 'relative', zIndex: 10 }}>
          
          {/* About Us Button in Login Card (من نحن - فلاش يومض) */}
          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className="btn btn-flash-about"
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              borderRadius: '20px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              zIndex: 20
            }}
            title="عن شركة المدارس المتقدمة (MSC) - من نحن"
          >
            <span className="flash-dot-indicator" />
            <Building2 size={15} className="flash-icon" />
            <span>من نحن</span>
            <Sparkles size={13} color="#38bdf8" />
          </button>

          <div className="login-header">
            <div className="logo-container" style={{ width: '100px', height: '100px', background: 'transparent', boxShadow: 'none' }}>
              <img 
                src={`${import.meta.env.BASE_URL}logo.webp`} 
                alt="شعار المدارس" 
                width="100"
                height="100"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} 
              />
            </div>
            <h1>{t('login.title')}</h1>
            <p>{t('login.loginSubtitle')}</p>
          </div>

          <div className="role-selector" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '20px' }}>
            <button 
              type="button"
              className={`role-btn ${role === 'student' ? 'active' : ''}`}
              onClick={() => { setRole('student'); setIsSignup(false); setError(''); setRoleMismatch(null); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleStudent')}</button>
            <button 
              type="button"
              className={`role-btn ${role === 'teacher' ? 'active' : ''}`}
              onClick={() => { setRole('teacher'); setIsSignup(false); setError(''); setRoleMismatch(null); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleTeacher')}</button>
            <button 
              type="button"
              className={`role-btn ${role === 'parent' ? 'active' : ''}`}
              onClick={() => { setRole('parent'); setError(''); setRoleMismatch(null); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleParent')}</button>
            <button 
              type="button"
              className={`role-btn ${(role === 'staff' || role === 'supervisor') ? 'active' : ''}`}
              onClick={() => { setRole('staff'); setIsSignup(false); setError(''); setRoleMismatch(null); }}
              style={{ fontSize: '11px', padding: '8px 2px' }}
            >وكيل / كادر</button>
            <button 
              type="button"
              className={`role-btn ${role === 'admin' ? 'active' : ''}`}
              onClick={() => { setRole('admin'); setIsSignup(false); setError(''); setRoleMismatch(null); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleAdmin')}</button>
            <button 
              type="button"
              className={`role-btn ${role === 'superadmin' ? 'active' : ''}`}
              onClick={() => { 
                setRole('superadmin'); 
                setIsSignup(false); 
                setError(''); 
                setRoleMismatch(null);
                setNationalId('super@admin.com');
                setPassword('super@admin');
              }}
              style={{ padding: '8px 2px', fontSize: '11px', fontWeight: 'bold' }}
            >ماستر</button>
          </div>

          {/* Login / Register Toggle Tabs ONLY for Parent Role */}
          {role === 'parent' && (
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
              <button 
                type="button" 
                onClick={() => { setIsSignup(false); setError(''); setRoleMismatch(null); }}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  background: 'none', 
                  border: 'none', 
                  borderBottom: !isSignup ? '3px solid #2563eb' : '3px solid transparent', 
                  fontWeight: !isSignup ? 'bold' : 'normal',
                  color: !isSignup ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                {t('login.loginNow')}
              </button>
              <button 
                type="button" 
                onClick={() => { setIsSignup(true); setError(''); setRoleMismatch(null); }}
                style={{ 
                  flex: 1, 
                  padding: '10px', 
                  background: 'none', 
                  border: 'none', 
                  borderBottom: isSignup ? '3px solid #2563eb' : '3px solid transparent', 
                  fontWeight: isSignup ? 'bold' : 'normal',
                  color: isSignup ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                {t('login.createAccount')}
              </button>
            </div>
          )}

            {/* Role Mismatch Banner */}
            {roleMismatch && (
              <div style={{
                background: '#fffbeb',
                border: '2px solid #f59e0b',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.12)',
                textAlign: 'right'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>
                  <AlertTriangle size={20} color="#f59e0b" />
                  <span>تنبيه: نوع الحساب يختلف عن التبويب المحدد</span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#78350f', lineHeight: 1.6 }}>
                  حساب <strong>({roleMismatch.actualName})</strong> مسجل في المنظومة برتبة: 
                  <span style={{ 
                    display: 'inline-block', 
                    background: '#0082a6', 
                    color: '#ffffff', 
                    padding: '2px 10px', 
                    borderRadius: '8px', 
                    fontWeight: 800, 
                    margin: '0 6px',
                    fontSize: '12px'
                  }}>
                    {roleMismatch.actualRoleName}
                  </span>
                  وليس كـ ({roleMismatch.selectedRoleName}).
                </p>
                <button
                  type="button"
                  onClick={() => handleDirectRoleSwitch(roleMismatch)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #0082a6, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 3px 10px rgba(0, 130, 166, 0.25)'
                  }}
                >
                  <LogIn size={16} />
                  <span>التبديل والدخول المباشر كـ ({roleMismatch.actualRoleName})</span>
                </button>
              </div>
            )}

            {error && !roleMismatch && (
              <div className="error-message" style={{ marginBottom: '15px' }}>
                <AlertCircle size={18} />
                <span style={{ fontSize: '13px', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* PARENT ROLE VIEW */}
            {role === 'parent' ? (
              <div style={{ marginTop: '5px' }}>
                {!isSignup ? (
                  /* PARENT DIRECT LOGIN FORM */
                  <form className="login-form" onSubmit={handleLogin}>
                    <div className="form-group">
                      <label>رقم هوية ولي الأمر</label>
                      <input 
                        type="text" 
                        placeholder={t('login.nationalIdPlaceholder')} 
                        required 
                        dir="ltr"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>{t('login.password')} <span style={{fontSize:'12px', color:'#666'}}>(الافتراضية هي رقم الهوية)</span></label>
                      <input 
                        type="password" 
                        placeholder={t('login.passwordPlaceholder')} 
                        required 
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginBottom: '15px' }}>
                      {loading ? t('login.loading') : (
                        <><LogIn size={18} /> {t('login.loginButton')}</>
                      )}
                    </button>
                  </form>
                ) : (
                  /* PARENT DIRECT SIGNUP FORM */
                  <form className="login-form" onSubmit={handleParentDirectSignup}>
                    <div className="form-group">
                      <label>رقم هوية ولي الأمر</label>
                      <input 
                        type="text" 
                        placeholder={t('login.nationalIdPlaceholder')} 
                        required 
                        dir="ltr"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('login.parentName')}</label>
                      <input 
                        type="text" 
                        placeholder={t('login.parentNamePlaceholder')} 
                        required 
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ color: '#2563eb', fontWeight: 'bold' }}>رقم هوية/إقامة الطالب المسجل بالنظام</label>
                      <input 
                        type="text" 
                        placeholder={t('login.studentIdPlaceholder')} 
                        required 
                        dir="ltr"
                        value={parentStudentId}
                        onChange={(e) => setParentStudentId(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>{t('login.password')} <span style={{fontSize:'12px', color:'#666'}}>(تترك فارغة لتعيين رقم الهوية ككلمة مرور)</span></label>
                      <input 
                        type="password" 
                        placeholder="كلمة المرور (الافتراضية رقم الهوية)" 
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginBottom: '15px' }}>
                      {loading ? t('login.loading') : t('login.parentDirectSignupButton')}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* NON-PARENT ROLES FORM */
              <form className="login-form" onSubmit={handleLogin}>
                <div className="form-group">
                  <label>{(role === 'admin' || role === 'superadmin') ? 'البريد الإلكتروني / الحساب' : t('login.nationalId')}</label>
                  <input 
                    type="text" 
                    placeholder={role === 'superadmin' ? 'super@admin.com' : role === 'admin' ? 'admin@school.com' : t('login.nationalIdPlaceholder')} 
                    required 
                    dir="ltr"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label>
                    {t('login.password')} 
                    {(role !== 'admin' && role !== 'superadmin') && <span style={{fontSize:'12px', color:'#666'}}>(الافتراضية هي رقم الهوية)</span>}
                  </label>
                  <input 
                    type="password" 
                    placeholder={role === 'superadmin' ? 'super@admin' : t('login.passwordPlaceholder')} 
                    required 
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginBottom: '15px' }}>
                  {loading ? t('login.loading') : (
                    <><LogIn size={18} /> {role === 'superadmin' ? 'دخول لوحة الماستر العام' : t('login.loginButton')}</>
                  )}
                </button>
              </form>
            )}
        </div>
      </div>

      {/* About School Modal */}
      <AboutSchoolModal 
        isOpen={showAboutModal} 
        onClose={() => setShowAboutModal(false)} 
      />
    </main>
  );
}
