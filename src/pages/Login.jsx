import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Building2, Sparkles } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AboutSchoolModal from '../components/AboutSchoolModal';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser, userRole, loading: authLoading, setLoginRole } = useAuth();
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
  const [loading, setLoading] = useState(false);

  // Parent Direct Signup State
  const [isSignup, setIsSignup] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentStudentId, setParentStudentId] = useState('');

  const getFakeEmail = (id) => {
    if (id.includes('@')) return id;
    return `${id}@school.local`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const trimmedId = nationalId.trim().replace(/\s+/g, '');
    const trimmedPassword = password.trim();

    // 1. SUPER ADMIN SPECIAL HANDLER
    if (trimmedId.toLowerCase() === 'super@admin.com' || trimmedId.toLowerCase() === 'superadmin' || trimmedId.toLowerCase() === 'super') {
      try {
        const superEmail = 'super@admin.com';
        const superPass = trimmedPassword || 'admin123';
        
        try {
          await signInWithEmailAndPassword(auth, superEmail, superPass);
        } catch (signInErr) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
            // Auto-create superadmin account if doesn't exist yet on fresh db
            await createUserWithEmailAndPassword(auth, superEmail, superPass.length >= 6 ? superPass : 'admin123');
          } else if (signInErr.code === 'auth/wrong-password') {
            setError('كلمة المرور غير صحيحة لحساب السوبر ماستر.');
            setLoading(false);
            return;
          } else {
            throw signInErr;
          }
        }

        // Ensure user document exists in Firestore
        try {
          const uSnap = await getDocs(query(collection(db, 'users'), where('email', '==', superEmail)));
          if (uSnap.empty) {
            await addDoc(collection(db, 'users'), {
              name: 'حساب الماستر العام',
              email: superEmail,
              role: 'superadmin',
              schoolId: 'ALL',
              schoolName: 'جميع المدارس (الماستر العام)',
              createdAt: new Date().toISOString()
            });
          }
        } catch (dbErr) {
          console.warn("Could not sync superadmin user doc:", dbErr);
        }

        setLoginRole('superadmin');
        navigate('/superadmin');
        return;
      } catch (superErr) {
        console.error("Super Admin Login Error:", superErr);
        if (superErr.code === 'auth/weak-password') {
          setError('كلمة المرور يجب أن لا تقل عن 6 خانات.');
        } else if (superErr.code === 'auth/email-already-in-use') {
          setError('كلمة المرور غير صحيحة لحساب السوبر ماستر.');
        } else {
          setError('حدث خطأ أثناء تسجيل الدخول: ' + (superErr.message || ''));
        }
        setLoading(false);
        return;
      }
    }

    // Helper to find record across ALL collections with string/number matches
    const findAnyRecord = async (nid) => {
      // 1. Check users (admins & others)
      try {
        let uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
        if (uSnap.empty && !isNaN(nid)) uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', Number(nid))));
        if (uSnap.empty) uSnap = await getDocs(query(collection(db, 'users'), where('email', '==', getFakeEmail(nid))));
        if (!uSnap.empty) return uSnap.docs[0].data();
      } catch (err) { console.warn("Error querying users:", err); }

      // 2. Check teachers
      try {
        let tSnap = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nid)));
        if (tSnap.empty && !isNaN(nid)) tSnap = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', Number(nid))));
        if (tSnap.empty) tSnap = await getDocs(query(collection(db, 'teachers'), where('email', '==', getFakeEmail(nid))));
        if (!tSnap.empty) return { ...tSnap.docs[0].data(), role: 'teacher' };
      } catch (err) { console.warn("Error querying teachers:", err); }

      // 3. Check students
      try {
        let sSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nid)));
        if (sSnap.empty && !isNaN(nid)) sSnap = await getDocs(query(collection(db, 'students'), where('nationalId', '==', Number(nid))));
        if (sSnap.empty) sSnap = await getDocs(query(collection(db, 'students'), where('email', '==', getFakeEmail(nid))));
        if (!sSnap.empty) return { ...sSnap.docs[0].data(), role: 'student' };
      } catch (err) { console.warn("Error querying students:", err); }

      // 4. Check staff
      try {
        let staffSnap = await getDocs(query(collection(db, 'staff'), where('nationalId', '==', nid)));
        if (staffSnap.empty && !isNaN(nid)) staffSnap = await getDocs(query(collection(db, 'staff'), where('nationalId', '==', Number(nid))));
        if (staffSnap.empty) staffSnap = await getDocs(query(collection(db, 'staff'), where('email', '==', getFakeEmail(nid))));
        if (!staffSnap.empty) return { ...staffSnap.docs[0].data(), role: 'staff' };
      } catch (err) { console.warn("Error querying staff:", err); }

      // 5. Check supervisors
      try {
        let supSnap = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', nid)));
        if (supSnap.empty && !isNaN(nid)) supSnap = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', Number(nid))));
        if (supSnap.empty) supSnap = await getDocs(query(collection(db, 'supervisors'), where('email', '==', getFakeEmail(nid))));
        if (!supSnap.empty) return { ...supSnap.docs[0].data(), role: 'supervisor' };
      } catch (err) { console.warn("Error querying supervisors:", err); }

      // 6. Check parents
      try {
        let pSnap = await getDocs(query(collection(db, 'parents'), where('nationalId', '==', nid)));
        if (pSnap.empty && !isNaN(nid)) pSnap = await getDocs(query(collection(db, 'parents'), where('nationalId', '==', Number(nid))));
        if (pSnap.empty) pSnap = await getDocs(query(collection(db, 'parents'), where('email', '==', getFakeEmail(nid))));
        if (!pSnap.empty) return { ...pSnap.docs[0].data(), role: 'parent' };
      } catch (err) { console.warn("Error querying parents:", err); }

      return null;
    };

    try {
      const loginEmail = getFakeEmail(trimmedId);
      const record = await findAnyRecord(trimmedId);
      
      // Auto-bootstrap first admin on a fresh new database if admin collection is empty
      if (!record && (role === 'admin' || trimmedId.includes('admin'))) {
        try {
          const adminCheck = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
          if (adminCheck.empty) {
            await createUserWithEmailAndPassword(auth, loginEmail, trimmedPassword.length >= 6 ? trimmedPassword : 'admin123');
            await addDoc(collection(db, 'users'), {
              nationalId: trimmedId,
              email: loginEmail,
              role: 'admin',
              name: 'مدير المدرسة',
              schoolId: 'default_school_1',
              createdAt: new Date().toISOString()
            });
            setLoginRole('admin');
            navigate('/admin');
            return;
          }
        } catch (bootstrapErr) {
          console.warn("Admin bootstrap check failed:", bootstrapErr);
        }
      }

      // Step 1: Sign in or Auto-provision user in Firebase Auth
      let authUser = null;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, trimmedPassword);
        authUser = userCredential.user;
      } catch (authErr) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          // If user exists in directory or matches default password, create auth account
          if (record || trimmedPassword === trimmedId || role === 'parent' || role === 'admin') {
            try {
              const passToUse = trimmedPassword.length >= 6 ? trimmedPassword : `${trimmedPassword}00`;
              const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, passToUse);
              authUser = userCredential.user;
            } catch (createErr) {
              console.warn("Auto user creation failed:", createErr);
            }
          }
        } else if (authErr.code === 'auth/wrong-password') {
          setError('كلمة المرور غير صحيحة.');
          setLoading(false);
          return;
        }
      }

      // Step 2: Determine correct role (Auto-detect role if record exists)
      const targetRole = record?.role || (authUser ? role : null);
      if (!targetRole && !authUser) {
        setError('رقم الهوية غير مسجل في النظام. يرجى التواصل مع إدارة المدرسة.');
        setLoading(false);
        return;
      }

      const finalRole = targetRole || role;

      // Auto sync user to users collection if missing
      if (record && finalRole !== 'superadmin') {
        try {
          const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', trimmedId)));
          if (uCheck.empty) {
            await addDoc(collection(db, 'users'), {
              nationalId: trimmedId,
              email: loginEmail,
              role: finalRole,
              name: record.name || 'مستخدم',
              schoolId: record.schoolId || 'default_school_1'
            });
          }
        } catch (syncErr) {
          console.warn("Could not sync to users:", syncErr);
        }
      }

      setLoginRole(finalRole);
      if (finalRole === 'superadmin') navigate('/superadmin');
      else if (finalRole === 'admin') navigate('/admin');
      else if (finalRole === 'staff') navigate('/staff');
      else if (finalRole === 'supervisor') navigate('/supervisor');
      else if (finalRole === 'teacher') navigate('/teacher');
      else if (finalRole === 'student') navigate('/student');
      else if (finalRole === 'parent') navigate('/parent');
      else navigate(`/${finalRole}`);
    } catch (err) {
      console.error("Login Error:", err);
      setError('رقم الهوية أو كلمة المرور غير صحيحة');
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
              onClick={() => { setRole('student'); setIsSignup(false); setError(''); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleStudent')}</button>
            <button 
              type="button"
              className={`role-btn ${role === 'teacher' ? 'active' : ''}`}
              onClick={() => { setRole('teacher'); setIsSignup(false); setError(''); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleTeacher')}</button>
            <button 
              type="button"
              className={`role-btn ${role === 'parent' ? 'active' : ''}`}
              onClick={() => { setRole('parent'); setError(''); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleParent')}</button>
            <button 
              type="button"
              className={`role-btn ${(role === 'staff' || role === 'supervisor') ? 'active' : ''}`}
              onClick={() => { setRole('staff'); setIsSignup(false); setError(''); }}
              style={{ fontSize: '11px', padding: '8px 2px' }}
            >وكيل / كادر</button>
            <button 
              type="button"
              className={`role-btn ${role === 'admin' ? 'active' : ''}`}
              onClick={() => { setRole('admin'); setIsSignup(false); setError(''); }}
              style={{ padding: '8px 2px', fontSize: '11px' }}
            >{t('login.roleAdmin')}</button>
            <button 
              type="button"
              className={`role-btn ${role === 'superadmin' ? 'active' : ''}`}
              onClick={() => { 
                setRole('superadmin'); 
                setIsSignup(false); 
                setError(''); 
                if (!nationalId || nationalId.length === 10) setNationalId('super@admin.com');
              }}
              style={{ padding: '8px 2px', fontSize: '11px', fontWeight: 'bold' }}
            >ماستر</button>
          </div>

          {/* Login / Register Toggle Tabs ONLY for Parent Role */}
          {role === 'parent' && (
            <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
              <button 
                type="button" 
                onClick={() => { setIsSignup(false); setError(''); }}
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
                onClick={() => { setIsSignup(true); setError(''); }}
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

            {error && (
              <div className="error-message" style={{ marginBottom: '15px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
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
                    type={(role === 'admin' || role === 'superadmin') ? 'text' : 'text'} 
                    placeholder={role === 'superadmin' ? 'super@admin.com' : role === 'admin' ? 'admin@school.com' : t('login.nationalIdPlaceholder')} 
                    required 
                    dir="ltr"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label>{t('login.password')} {(role !== 'admin' && role !== 'superadmin') && <span style={{fontSize:'12px', color:'#666'}}>(الافتراضية هي رقم الهوية)</span>}</label>
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
