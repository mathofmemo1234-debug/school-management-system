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
        const superData = { name: 'حساب الماستر', role: 'superadmin', schoolId: 'ALL' };
        setUserRole('superadmin');
        setUserData(superData);
        localStorage.setItem('userRole', 'superadmin');
        localStorage.setItem('userData', JSON.stringify(superData));
        return superData;
      }

      const nid = user.email.replace('@school.local', '');
      let data = null;

      // 1. Check teachers collection FIRST
      try {
        let tQ = query(collection(db, 'teachers'), where('nationalId', '==', nid));
        let tS = await getDocs(tQ);
        if (tS.empty && !isNaN(nid)) { tQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(nid))); tS = await getDocs(tQ); }
        if (tS.empty) { tQ = query(collection(db, 'teachers'), where('email', '==', user.email)); tS = await getDocs(tQ); }
        if (!tS.empty) {
          const d = tS.docs[0].data();
          data = { ...d, role: 'teacher', email: user.email, nationalId: String(d.nationalId || nid) };
        }
      } catch (e) {}

      // 2. Check students collection
      if (!data) {
        try {
          let stQ = query(collection(db, 'students'), where('nationalId', '==', nid));
          let stS = await getDocs(stQ);
          if (stS.empty && !isNaN(nid)) { stQ = query(collection(db, 'students'), where('nationalId', '==', Number(nid))); stS = await getDocs(stQ); }
          if (stS.empty) { stQ = query(collection(db, 'students'), where('email', '==', user.email)); stS = await getDocs(stQ); }
          if (!stS.empty) {
            const d = stS.docs[0].data();
            data = { ...d, role: 'student', email: user.email, nationalId: String(d.nationalId || nid) };
          }
        } catch (e) {}
      }

      // 3. Check staff collection
      if (!data) {
        try {
          let sQ = query(collection(db, 'staff'), where('nationalId', '==', nid));
          let sS = await getDocs(sQ);
          if (sS.empty && !isNaN(nid)) { sQ = query(collection(db, 'staff'), where('nationalId', '==', Number(nid))); sS = await getDocs(sQ); }
          if (sS.empty) { sQ = query(collection(db, 'staff'), where('email', '==', user.email)); sS = await getDocs(sQ); }
          if (!sS.empty) {
            const d = sS.docs[0].data();
            data = { ...d, role: 'staff', email: user.email, nationalId: String(d.nationalId || nid) };
          }
        } catch (e) {}
      }

      // 4. Check supervisors collection
      if (!data) {
        try {
          let spQ = query(collection(db, 'supervisors'), where('nationalId', '==', nid));
          let spS = await getDocs(spQ);
          if (spS.empty && !isNaN(nid)) { spQ = query(collection(db, 'supervisors'), where('nationalId', '==', Number(nid))); spS = await getDocs(spQ); }
          if (spS.empty) { spQ = query(collection(db, 'supervisors'), where('email', '==', user.email)); spS = await getDocs(spQ); }
          if (!spS.empty) {
            const d = spS.docs[0].data();
            data = { ...d, role: 'supervisor', email: user.email, nationalId: String(d.nationalId || nid) };
          }
        } catch (e) {}
      }

      // 5. Check parents collection
      if (!data) {
        try {
          let pQ = query(collection(db, 'parents'), where('email', '==', user.email));
          let pS = await getDocs(pQ);
          if (pS.empty && user.uid) { pQ = query(collection(db, 'parents'), where('uid', '==', user.uid)); pS = await getDocs(pQ); }
          if (pS.empty && nid) {
            pQ = query(collection(db, 'parents'), where('nationalId', '==', nid));
            pS = await getDocs(pQ);
            if (pS.empty && !isNaN(nid)) { pQ = query(collection(db, 'parents'), where('nationalId', '==', Number(nid))); pS = await getDocs(pQ); }
          }
          if (!pS.empty) {
            const d = pS.docs[0].data();
            data = { ...d, role: 'parent', email: user.email, uid: user.uid, nationalId: String(d.nationalId || nid) };
          }
        } catch (e) {}
      }

      // 6. Check users collection (admins & others)
      if (!data) {
        try {
          let q = query(collection(db, 'users'), where('email', '==', user.email));
          let snap = await getDocs(q);
          if (snap.empty && user.uid) { q = query(collection(db, 'users'), where('uid', '==', user.uid)); snap = await getDocs(q); }
          if (snap.empty && nid) {
            q = query(collection(db, 'users'), where('nationalId', '==', nid)); snap = await getDocs(q);
            if (snap.empty && !isNaN(nid)) { q = query(collection(db, 'users'), where('nationalId', '==', Number(nid))); snap = await getDocs(q); }
          }
          if (!snap.empty) {
            const allDocs = snap.docs.map(d => d.data());
            data = (allDocs.length > 1 && roleHint) ? (allDocs.find(d => d.role === roleHint) || allDocs[0]) : allDocs[0];
          }
        } catch (e) {}
      }

      if (data) {
        if (data.role==='teacher'){try{const tQ=query(collection(db,'teachers'),where('nationalId','==',nid));const tS=await getDocs(tQ);if(!tS.empty){const td=tS.docs[0].data();data.subject=td.subject||data.subject||'';if(td.name)data.name=td.name;}}catch(e){}}
        if (data.role==='staff'){try{const sfQ=query(collection(db,'staff'),where('nationalId','==',nid));const sfS=await getDocs(sfQ);if(!sfS.empty){const sfd=sfS.docs[0].data();data.roleTitle=sfd.roleTitle||data.roleTitle||'';data.permissions=sfd.permissions||data.permissions||[];if(sfd.name)data.name=sfd.name;}}catch(e){}}
        if (data.role==='student'){try{const stQ=query(collection(db,'students'),where('nationalId','==',nid));const stS=await getDocs(stQ);if(!stS.empty){const std=stS.docs[0].data();data.class=std.class||std.className||data.class||'';if(std.name)data.name=std.name;}}catch(e){}}
        if (data.role==='supervisor'){try{const spQ=query(collection(db,'supervisors'),where('nationalId','==',nid));const spS=await getDocs(spQ);if(!spS.empty){const spd=spS.docs[0].data();data.specialty=spd.specialty||data.specialty||'';if(spd.name)data.name=spd.name;}}catch(e){}}
        if (data.role==='superadmin'){data.schoolId = data.schoolId || 'ALL'; if(!data.name) data.name='الماستر العام';}
        if (data.schoolId && data.schoolId!=='ALL'){try{const sd=await getDoc(doc(db,'schools',data.schoolId));if(sd.exists()){data.schoolName=sd.data().name;data.schoolSubTitle=sd.data().subTitle||'';data.logoUrl=sd.data().logoUrl||null;}}catch(e){}}
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
