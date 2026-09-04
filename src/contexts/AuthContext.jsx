import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
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

      if (!data && (!roleHint || roleHint === 'teacher')) {
        let tQ = query(collection(db, 'teachers'), where('nationalId', '==', nid)); let tS = await getDocs(tQ);
        if (tS.empty && !isNaN(nid)) { tQ = query(collection(db, 'teachers'), where('nationalId', '==', Number(nid))); tS = await getDocs(tQ); }
        if (tS.empty) { tQ = query(collection(db, 'teachers'), where('email', '==', user.email)); tS = await getDocs(tQ); }
        if (!tS.empty) { const d = tS.docs[0].data(); data = { ...d, role: 'teacher', email: user.email, nationalId: String(d.nationalId || nid) }; try { await addDoc(collection(db, 'users'), { nationalId: String(d.nationalId||nid), email: user.email, role: 'teacher', name: d.name||'معلم', subject: d.subject||'', schoolId: d.schoolId||'default_school_1' }); } catch(e){} }
      }
      if (!data && (!roleHint || roleHint === 'staff')) {
        let sQ = query(collection(db, 'staff'), where('nationalId', '==', nid)); let sS = await getDocs(sQ);
        if (sS.empty && !isNaN(nid)) { sQ = query(collection(db, 'staff'), where('nationalId', '==', Number(nid))); sS = await getDocs(sQ); }
        if (sS.empty) { sQ = query(collection(db, 'staff'), where('email', '==', user.email)); sS = await getDocs(sQ); }
        if (!sS.empty) { const d = sS.docs[0].data(); data = { ...d, role: 'staff', email: user.email, nationalId: String(d.nationalId || nid) }; try { await addDoc(collection(db, 'users'), { nationalId: String(d.nationalId||nid), email: user.email, role: 'staff', name: d.name||'عضو كادر', roleTitle: d.roleTitle||'', permissions: d.permissions||[], schoolId: d.schoolId||'default_school_1' }); } catch(e){} }
      }
      if (!data && (!roleHint || roleHint === 'supervisor')) {
        let spQ = query(collection(db, 'supervisors'), where('nationalId', '==', nid)); let spS = await getDocs(spQ);
        if (spS.empty && !isNaN(nid)) { spQ = query(collection(db, 'supervisors'), where('nationalId', '==', Number(nid))); spS = await getDocs(spQ); }
        if (spS.empty) { spQ = query(collection(db, 'supervisors'), where('email', '==', user.email)); spS = await getDocs(spQ); }
        if (!spS.empty) { const d = spS.docs[0].data(); data = { ...d, role: 'supervisor', email: user.email, nationalId: String(d.nationalId || nid) }; try { await addDoc(collection(db, 'users'), { nationalId: String(d.nationalId||nid), email: user.email, role: 'supervisor', name: d.name||'مشرف تعليمي', specialty: d.specialty||'', schoolId: d.schoolId||'default_school_1' }); } catch(e){} }
      }
      if (!data && (!roleHint || roleHint === 'student')) {
        let stQ = query(collection(db, 'students'), where('nationalId', '==', nid)); let stS = await getDocs(stQ);
        if (stS.empty && !isNaN(nid)) { stQ = query(collection(db, 'students'), where('nationalId', '==', Number(nid))); stS = await getDocs(stQ); }
        if (stS.empty) { stQ = query(collection(db, 'students'), where('email', '==', user.email)); stS = await getDocs(stQ); }
        if (!stS.empty) { const d = stS.docs[0].data(); data = { ...d, role: 'student', email: user.email, nationalId: String(d.nationalId || nid) }; try { await addDoc(collection(db, 'users'), { nationalId: String(d.nationalId||nid), email: user.email, role: 'student', name: d.name||'طالب', class: d.class||d.className||'', schoolId: d.schoolId||'default_school_1' }); } catch(e){} }
      }
      if (!data && (!roleHint || roleHint === 'parent')) {
        let pQ = query(collection(db, 'parents'), where('email', '==', user.email)); let pS = await getDocs(pQ);
        if (pS.empty && user.uid) { pQ = query(collection(db, 'parents'), where('uid', '==', user.uid)); pS = await getDocs(pQ); }
        if (pS.empty && nid) { pQ = query(collection(db, 'parents'), where('nationalId', '==', nid)); pS = await getDocs(pQ); if (pS.empty && !isNaN(nid)) { pQ = query(collection(db, 'parents'), where('nationalId', '==', Number(nid))); pS = await getDocs(pQ); } }
        if (!pS.empty) { const d = pS.docs[0].data(); data = { ...d, role: 'parent', email: user.email, uid: user.uid, nationalId: String(d.nationalId || nid) }; try { await addDoc(collection(db, 'users'), { uid: user.uid, email: user.email, role: 'parent', nationalId: String(d.nationalId||nid), name: d.name||user.displayName||'ولي أمر', studentNationalId: d.studentNationalId||'', studentName: d.studentName||'', studentClass: d.studentClass||'', schoolId: d.schoolId||'default_school_1' }); } catch(e){} }
      }

      if (data) {
        if (data.role==='teacher'){try{const tQ=query(collection(db,'teachers'),where('nationalId','==',nid));const tS=await getDocs(tQ);if(!tS.empty){const td=tS.docs[0].data();data.subject=td.subject||data.subject||'';if(td.name)data.name=td.name;}}catch(e){}}
        if (data.role==='staff'){try{const sfQ=query(collection(db,'staff'),where('nationalId','==',nid));const sfS=await getDocs(sfQ);if(!sfS.empty){const sfd=sfS.docs[0].data();data.roleTitle=sfd.roleTitle||data.roleTitle||'';data.permissions=sfd.permissions||data.permissions||[];if(sfd.name)data.name=sfd.name;}}catch(e){}}
        if (data.role==='student'){try{const stQ=query(collection(db,'students'),where('nationalId','==',nid));const stS=await getDocs(stQ);if(!stS.empty){const std=stS.docs[0].data();data.class=std.class||std.className||data.class||'';if(std.name)data.name=std.name;}}catch(e){}}
        if (data.role==='supervisor'){try{const spQ=query(collection(db,'supervisors'),where('nationalId','==',nid));const spS=await getDocs(spQ);if(!spS.empty){const spd=spS.docs[0].data();data.specialty=spd.specialty||data.specialty||'';if(spd.name)data.name=spd.name;}}catch(e){}}
        if (data.role==='superadmin'){data.schoolId = data.schoolId || 'ALL'; if(!data.name) data.name='الماستر العام';}
        if (data.schoolId && data.schoolId!=='ALL'){try{const sd=await getDoc(doc(db,'schools',data.schoolId));if(sd.exists()){data.schoolName=sd.data().name;data.logoUrl=sd.data().logoUrl||null;}}catch(e){}}
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
      setCurrentUser(user);
      if (user) {
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

  const switchSchoolContext = useCallback(async (newSchoolId, newSchoolName, newLogoUrl) => {
    if (userRole !== 'superadmin' && userData?.role !== 'superadmin') return;
    
    if (newSchoolId === 'ALL' || !newSchoolId) {
      const updated = { ...userData, schoolId: 'ALL', schoolName: 'جميع المدارس (الماستر العام)', logoUrl: null, activePreviewSchoolId: null };
      setUserData(updated);
      localStorage.setItem('userData', JSON.stringify(updated));
    } else {
      let sName = newSchoolName;
      let sLogo = newLogoUrl;
      if (!sName) {
        try {
          const sd = await getDoc(doc(db, 'schools', newSchoolId));
          if (sd.exists()) {
            sName = sd.data().name;
            sLogo = sd.data().logoUrl || null;
          }
        } catch (e) {
          console.warn('Error fetching school data in switchSchoolContext:', e);
        }
      }
      const updated = { ...userData, schoolId: newSchoolId, schoolName: sName || 'المدرسة المحددة', logoUrl: sLogo || null, activePreviewSchoolId: newSchoolId };
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

  const value = { currentUser, userRole, userData, loading, setLoginRole, switchSchoolContext };

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
