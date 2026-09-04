import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const resolveRole = useCallback(async (user, roleHint) => {
    try {
      if (user.email === 'super@admin.com') {
        const superData = { name: 'حساب الماستر العام', role: 'superadmin', schoolId: 'ALL' };
        setUserRole('superadmin');
        setUserData(superData);
        localStorage.setItem('userRole', 'superadmin');
        localStorage.setItem('userData', JSON.stringify(superData));
        return superData;
      }

      const nid = user.email.replace('@school.local', '').trim();
      const isNum = !isNaN(nid) && nid !== '';
      const numNid = isNum ? Number(nid) : null;
      const email = user.email.toLowerCase();

      const queryCollectionFast = async (collName, defaultRole) => {
        try {
          const promises = [
            getDocs(query(collection(db, collName), where('nationalId', '==', nid))),
            getDocs(query(collection(db, collName), where('email', '==', user.email))),
            getDocs(query(collection(db, collName), where('email', '==', email)))
          ];
          if (numNid !== null) {
            promises.push(getDocs(query(collection(db, collName), where('nationalId', '==', numNid))));
          }
          if (user.uid) {
            promises.push(getDocs(query(collection(db, collName), where('uid', '==', user.uid))));
          }
          const snapshots = await Promise.all(promises);
          for (const s of snapshots) {
            if (!s.empty) {
              const d = s.docs[0].data();
              return { ...d, id: s.docs[0].id, role: defaultRole || d.role || collName, nationalId: String(d.nationalId || nid), email: user.email };
            }
          }
        } catch (e) {}
        return null;
      };

      // Query all candidate collections in parallel for maximum speed
      const [tData, sData, stData, spData, pData, uData] = await Promise.all([
        queryCollectionFast('teachers', 'teacher'),
        queryCollectionFast('students', 'student'),
        queryCollectionFast('staff', 'staff'),
        queryCollectionFast('supervisors', 'supervisor'),
        queryCollectionFast('parents', 'parent'),
        queryCollectionFast('users', null)
      ]);

      const candidates = [
        tData && { data: tData, role: 'teacher' },
        sData && { data: sData, role: 'student' },
        stData && { data: stData, role: 'staff' },
        spData && { data: spData, role: 'supervisor' },
        pData && { data: pData, role: 'parent' },
        uData && { data: uData, role: uData.role || 'admin' }
      ].filter(Boolean);

      let data = null;
      if (candidates.length > 0) {
        if (roleHint) {
          const matched = candidates.find(c => c.role === roleHint || (roleHint === 'staff' && (c.role === 'staff' || c.role === 'supervisor')));
          data = matched ? matched.data : candidates[0].data;
        } else {
          data = candidates[0].data;
        }
      }

      if (data) {
        if (data.role === 'superadmin') {
          data.schoolId = data.schoolId || 'ALL';
          if (!data.name) data.name = 'الماستر العام';
        }
        if (data.schoolId && data.schoolId !== 'ALL' && !data.schoolName) {
          try {
            const sd = await getDoc(doc(db, 'schools', data.schoolId));
            if (sd.exists()) {
              data.schoolName = sd.data().name;
              data.schoolSubTitle = sd.data().subTitle || '';
              data.logoUrl = sd.data().logoUrl || null;
            }
          } catch (e) {}
        }
        setUserRole(data.role);
        setUserData(data);
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userData', JSON.stringify(data));
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error in resolveRole:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        if (!initializedRef.current) {
          initializedRef.current = true;
          const cachedRole = localStorage.getItem('userRole');
          const cachedData = (() => { try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch { return null; } })();
          if (cachedRole && cachedData) {
            setUserRole(cachedRole);
            setUserData(cachedData);
            setLoading(false);
            resolveRole(user, cachedRole);
          } else {
            const result = await resolveRole(user, null);
            if (!result) { setUserRole(null); setUserData(null); }
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } else {
        // Check if there is an active local verified session
        const cachedRole = localStorage.getItem('userRole');
        const cachedData = (() => { try { return JSON.parse(localStorage.getItem('userData') || 'null'); } catch { return null; } })();
        if (cachedRole && cachedData) {
          const sessionUser = {
            email: cachedData.email || (cachedData.nationalId ? `${cachedData.nationalId}@school.local` : 'user@school.local'),
            uid: cachedData.uid || cachedData.id || `session_${cachedRole}`,
            displayName: cachedData.name || 'مستخدم'
          };
          setCurrentUser(sessionUser);
          setUserRole(cachedRole);
          setUserData(cachedData);
          setLoading(false);
          return;
        }

        // Otherwise, completely cleared
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        localStorage.removeItem('userRole');
        localStorage.removeItem('userData');
        initializedRef.current = false;
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [resolveRole]);

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userData');
      setCurrentUser(null);
      setUserRole(null);
      setUserData(null);
      initializedRef.current = false;
      await signOut(auth);
    } catch (e) {
      console.warn('Error in logout:', e);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userData');
      setCurrentUser(null);
      setUserRole(null);
      setUserData(null);
    }
  }, []);

  const loginAsSuperAdmin = useCallback((customData) => {
    const superData = {
      name: customData?.name || 'حساب الماستر العام',
      email: customData?.email || 'super@admin.com',
      role: 'superadmin',
      schoolId: 'ALL',
      schoolName: 'جميع المدارس (الماستر العام)',
      schoolSubTitle: ''
    };
    setCurrentUser({ email: superData.email, uid: 'superadmin_master', displayName: superData.name });
    setUserRole('superadmin');
    setUserData(superData);
    localStorage.setItem('userRole', 'superadmin');
    localStorage.setItem('userData', JSON.stringify(superData));
  }, []);

  const loginWithUserData = useCallback((data, explicitRole) => {
    const finalRole = explicitRole || data?.role || 'student';
    const userObj = {
      email: data.email || (data.nationalId ? `${data.nationalId}@school.local` : 'user@school.local'),
      uid: data.uid || data.id || `user_${data.nationalId || Date.now()}`,
      displayName: data.name || 'مستخدم'
    };
    setCurrentUser(userObj);
    setUserRole(finalRole);
    const enrichedData = { ...data, role: finalRole };
    setUserData(enrichedData);
    localStorage.setItem('userRole', finalRole);
    localStorage.setItem('userData', JSON.stringify(enrichedData));
  }, []);

  const switchSchoolContext = useCallback(async (newSchoolId, newSchoolName, newLogoUrl, newSubTitle) => {
    if (userRole !== 'superadmin' && userData?.role !== 'superadmin') return;
    
    if (newSchoolId === 'ALL' || !newSchoolId) {
      const updated = { ...userData, schoolId: 'ALL', schoolName: 'جميع المدارس (الماستر العام)', schoolSubTitle: '', logoUrl: null, activePreviewSchoolId: null };
      setUserData(updated);
      localStorage.setItem('userData', JSON.stringify(updated));
    } else {
      let sName = newSchoolName;
      let sLogo = newLogoUrl;
      let sSubTitle = newSubTitle || '';
      if (!sName || !sSubTitle) {
        try {
          const sd = await getDoc(doc(db, 'schools', newSchoolId));
          if (sd.exists()) {
            if (!sName) sName = sd.data().name;
            if (!sLogo) sLogo = sd.data().logoUrl || null;
            if (!sSubTitle) sSubTitle = sd.data().subTitle || '';
          }
        } catch (e) {
          console.warn('Error fetching school data in switchSchoolContext:', e);
        }
      }
      const updated = { ...userData, schoolId: newSchoolId, schoolName: sName || 'المدرسة المحددة', schoolSubTitle: sSubTitle, logoUrl: sLogo || null, activePreviewSchoolId: newSchoolId };
      setUserData(updated);
      localStorage.setItem('userData', JSON.stringify(updated));
    }
  }, [userRole, userData]);

  const setLoginRole = useCallback((role) => {
    setUserRole(role);
    localStorage.setItem('userRole', role);
  }, []);

  const cachedUserData = (() => {
    try {
      return userData || JSON.parse(localStorage.getItem('userData') || 'null');
    } catch {
      return userData || null;
    }
  })();

  const value = { currentUser, userRole, userData, loading, setLoginRole, switchSchoolContext, loginAsSuperAdmin, loginWithUserData, logout };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--color-bg,#F4F8F9)', fontFamily:'Cairo,sans-serif', direction:'rtl', padding:'24px', textAlign:'center' }}>
          <div style={{ width:'52px', height:'52px', border:'4px solid rgba(99,178,198,0.2)', borderTopColor:'#63B2C6', borderRadius:'50%', animation:'spin 1s linear infinite', marginBottom:'20px' }} />
          <h2 style={{ margin:'0 0 8px 0', color:'#0e7490', fontWeight:800, fontSize:'1.35rem' }}>
            {cachedUserData?.name ? `مرحباً بعودتك، ${cachedUserData.name}` : 'مرحباً بعودتك'}
          </h2>
          <p style={{ margin:0, color:'#4A93A6', fontWeight:600, fontSize:'1.05rem' }}>
            في {cachedUserData?.schoolName || 'المنظومة التعليمية الذكية'}
          </p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}
