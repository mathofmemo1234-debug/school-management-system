import React, { useState, useEffect } from 'react';
import { db, createSecondaryAuthUser } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { Users, UserPlus, X, Edit, Trash2, Shield, ShieldCheck, CheckSquare, Square, Phone, Award, Star, BookOpen, Calendar, CheckCircle, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import CertificateLetterModal from '../components/CertificateLetterModal';
import PrintPortfolioModal from '../components/PrintPortfolioModal';
import NationalitySelect from '../components/NationalitySelect';

export const ALL_PERMISSIONS = [
  { id: 'preparations', label: 'متابعة تحضير الدروس', icon: BookOpen, desc: 'الاطلاع على تحضير المعلمين والتقييم التربوي' },
  { id: 'weekly_plans', label: 'متابعة الخطط الأسبوعية', icon: Calendar, desc: 'الاطلاع على الخطط الأسبوعية لجميع الفصول' },
  { id: 'schedules', label: 'الجداول المدرسية', icon: Calendar, desc: 'الاطلاع على جداول الحصص والفصول والمعلمين' },
  { id: 'students', label: 'شؤون وسجلات الطلاب', icon: Users, desc: 'الاطلاع على بيانات وقوائم الطلاب وفصولهم' },
  { id: 'attendance', label: 'متابعة الحضور والغياب', icon: CheckSquare, desc: 'الاطلاع على كشوفات الغياب والحضور اليومي' },
  { id: 'teachers', label: 'دليل وكادر المعلمين', icon: Users, desc: 'استعراض بيانات وتخصصات المعلمين' },
  { id: 'classes', label: 'الفصول والمراحل', icon: BookOpen, desc: 'الاطلاع على الفصول الدراسية وتوزيعها' },
  { id: 'excellence', label: 'ملفات التميز والتوثيق', icon: Star, desc: 'الاطلاع على الشواهد والملفات والتقارير' }
];

export const ROLE_PRESETS = [
  {
    title: 'وكيل الشؤون التعليمية',
    category: 'deputy',
    defaultPermissions: ['preparations', 'weekly_plans', 'schedules', 'teachers', 'classes', 'excellence']
  },
  {
    title: 'وكيل شؤون الطلاب',
    category: 'deputy',
    defaultPermissions: ['students', 'attendance', 'schedules', 'classes']
  },
  {
    title: 'وكيل الشؤون المدرسية',
    category: 'deputy',
    defaultPermissions: ['schedules', 'teachers', 'classes', 'excellence']
  },
  {
    title: 'المرشد الطلابي',
    category: 'counselor',
    defaultPermissions: ['students', 'attendance', 'weekly_plans']
  },
  {
    title: 'مشرف النشاط المدرسي',
    category: 'activity',
    defaultPermissions: ['students', 'excellence', 'teachers']
  },
  {
    title: 'مشرف تعليمي / تربوي',
    category: 'supervisor',
    defaultPermissions: ['preparations', 'weekly_plans', 'schedules', 'teachers', 'excellence']
  },
  {
    title: 'مسمى مخصص...',
    category: 'custom',
    defaultPermissions: ['preparations', 'weekly_plans']
  }
];

export default function ManageStaff({ schoolId }) {
  const { t } = useLanguage();
  const [staffList, setStaffList] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'deputy' | 'counselor' | 'activity' | 'supervisor' | 'custom'
  
  // Modals
  const [isAdding, setIsAdding] = useState(false);
  const [editingPermissionsStaff, setEditingPermissionsStaff] = useState(null);
  const [editingStaffInfo, setEditingStaffInfo] = useState(null);
  const [printingLetterStaff, setPrintingLetterStaff] = useState(null);
  const [printingPortfolioStaff, setPrintingPortfolioStaff] = useState(null);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [nationality, setNationality] = useState('سعودي');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState(ROLE_PRESETS[0].defaultPermissions);
  const [whatsapp, setWhatsapp] = useState('');
  const [bulkData, setBulkData] = useState('');

  // Fetch staff list & Auto-clean duplicates
  useEffect(() => {
    if (!schoolId) return;

    const q = query(collection(db, 'staff'), where('schoolId', '==', schoolId));
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Merge with custom staff from localStorage for offline/immediate resilience
      let localCustom = [];
      try {
        localCustom = JSON.parse(localStorage.getItem('msc_custom_staff') || '[]');
      } catch (e) {}

      const combined = [...raw];
      for (const loc of localCustom) {
        if (!loc.schoolId || loc.schoolId === schoolId) {
          const exists = combined.some(item => (item.nationalId && String(item.nationalId).trim() === String(loc.nationalId).trim()));
          if (!exists) combined.push({ id: `local_${loc.nationalId}`, ...loc });
        }
      }

      const unique = [];
      const seen = new Map();
      const duplicatesToDelete = [];

      for (const s of combined) {
        const nid = (s.nationalId || s.id || '').trim();
        if (!seen.has(nid)) {
          seen.set(nid, s);
          unique.push(s);
        } else {
          if (s.id && !s.id.startsWith('local_')) duplicatesToDelete.push(s.id);
        }
      }

      if (duplicatesToDelete.length > 0) {
        for (const dupId of duplicatesToDelete) {
          try {
            await deleteDoc(doc(db, 'staff', dupId));
          } catch (e) {
            console.warn("Auto cleanup duplicate staff error:", e);
          }
        }
      }

      setStaffList(unique);
    });

    return () => unsub();
  }, [schoolId]);

  // When preset changes in Add Modal
  const handlePresetChange = (idx) => {
    setSelectedPresetIndex(idx);
    const preset = ROLE_PRESETS[idx];
    if (preset.category !== 'custom') {
      setSelectedPermissions([...preset.defaultPermissions]);
      setCustomRoleTitle('');
    } else {
      setCustomRoleTitle('');
    }
  };

  const togglePermission = (permId) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  const toggleEditPermission = (permId) => {
    if (!editingPermissionsStaff) return;
    const current = editingPermissionsStaff.permissions || [];
    const updated = current.includes(permId)
      ? current.filter(p => p !== permId)
      : [...current, permId];
    
    setEditingPermissionsStaff({
      ...editingPermissionsStaff,
      permissions: updated
    });
  };

  const handleSaveSingle = async (e) => {
    e.preventDefault();
    const nid = nationalId.trim();
    const sName = name.trim();
    const sWhatsapp = whatsapp.trim();
    const preset = ROLE_PRESETS[selectedPresetIndex];
    const finalRoleTitle = preset.category === 'custom' ? (customRoleTitle.trim() || 'كادر مدرسي') : preset.title;

    if (!sName || !nid) return;
    setIsSaving(true);

    try {
      // Strict duplicate check across all collections
      const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nid)));
      const staffCheck = await getDocs(query(collection(db, 'staff'), where('nationalId', '==', nid)));
      const supCheck = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', nid)));
      const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', nid)));
      const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', nid)));

      if (!uCheck.empty || !staffCheck.empty || !supCheck.empty || !tCheck.empty || !sCheck.empty) {
        alert('عذراً: رقم الهوية هذا مسجل مسبقاً في النظام. لا يمكن تسجيل نفس الرقم نهائياً!');
        setIsSaving(false);
        return;
      }

      const fakeEmail = `${nid}@school.local`;
      const sNat = nationality.trim() || 'سعودي';
      const staffData = {
        name: sName,
        nationalId: nid,
        email: fakeEmail,
        roleTitle: finalRoleTitle,
        roleCategory: preset.category,
        permissions: selectedPermissions,
        whatsapp: sWhatsapp,
        nationality: sNat,
        role: 'staff',
        schoolId,
        password: nid,
        createdAt: new Date()
      };

      // 1. Create or ensure Firebase Auth user in secondary app
      try {
        const passToSet = nid.length >= 6 ? nid : `${nid}00`;
        await createSecondaryAuthUser(fakeEmail, passToSet, staffData);
      } catch (authErr) {
        console.warn('Staff secondary auth notice:', authErr);
      }

      // 2. Save to Firestore staff and users
      await addDoc(collection(db, 'staff'), staffData);
      await addDoc(collection(db, 'users'), {
        nationalId: nid,
        email: fakeEmail,
        role: 'staff',
        name: sName,
        roleTitle: finalRoleTitle,
        permissions: selectedPermissions,
        nationality: sNat,
        password: nid,
        schoolId
      });

      // 3. Save to localStorage backup for immediate resilient login
      try {
        const saved = JSON.parse(localStorage.getItem('msc_custom_staff') || '[]');
        const updated = [staffData, ...saved.filter(s => String(s.nationalId).trim() !== nid)];
        localStorage.setItem('msc_custom_staff', JSON.stringify(updated));
      } catch (lsErr) {
        console.warn('Could not save staff to localStorage:', lsErr);
      }

      setIsAdding(false);
      setName('');
      setNationalId('');
      setWhatsapp('');
      setNationality('سعودي');
      setCustomRoleTitle('');
      setSelectedPresetIndex(0);
      setSelectedPermissions(ROLE_PRESETS[0].defaultPermissions);
      alert('تمت إضافة عضو الكادر وتعيين صلاحياته بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ البيانات: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingPermissionsStaff) return;
    setIsSaving(true);
    try {
      const updatedPermissions = editingPermissionsStaff.permissions || [];
      await updateDoc(doc(db, 'staff', editingPermissionsStaff.id), {
        permissions: updatedPermissions
      });

      if (editingPermissionsStaff.nationalId) {
        const uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', editingPermissionsStaff.nationalId)));
        uSnap.forEach(async (d) => {
          await updateDoc(doc(db, 'users', d.id), {
            permissions: updatedPermissions
          });
        });
      }

      alert('تم تحديث صلاحيات ' + editingPermissionsStaff.name + ' بنجاح!');
      setEditingPermissionsStaff(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحديث الصلاحيات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStaffInfo = async (e) => {
    e.preventDefault();
    if (!editingStaffInfo) return;
    setIsSaving(true);
    try {
      const updatedName = editingStaffInfo.name?.trim() || '';
      const updatedRoleTitle = editingStaffInfo.roleTitle?.trim() || '';
      const updatedWhatsapp = editingStaffInfo.whatsapp?.trim() || '';
      const updatedNat = editingStaffInfo.nationality?.trim() || 'سعودي';

      await updateDoc(doc(db, 'staff', editingStaffInfo.id), {
        name: updatedName,
        roleTitle: updatedRoleTitle,
        whatsapp: updatedWhatsapp,
        nationality: updatedNat
      });

      if (editingStaffInfo.nationalId) {
        const uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', editingStaffInfo.nationalId)));
        uSnap.forEach(async (d) => {
          await updateDoc(doc(db, 'users', d.id), {
            name: updatedName,
            roleTitle: updatedRoleTitle,
            nationality: updatedNat
          });
        });
      }

      setEditingStaffInfo(null);
      alert('تم تحديث بيانات العضو بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStaff = async (id, nationalId, staffName) => {
    if (!window.confirm(`هل أنت متأكد من حذف (${staffName}) من الكادر الإداري؟`)) return;
    try {
      if (id && !id.startsWith('local_')) {
        await deleteDoc(doc(db, 'staff', id));
      }
      if (nationalId) {
        const staffSnap = await getDocs(query(collection(db, 'staff'), where('nationalId', '==', nationalId)));
        staffSnap.forEach(async (d) => await deleteDoc(doc(db, 'staff', d.id)));
        const uSnap = await getDocs(query(collection(db, 'users'), where('nationalId', '==', nationalId)));
        uSnap.forEach(async (d) => await deleteDoc(doc(db, 'users', d.id)));

        try {
          const saved = JSON.parse(localStorage.getItem('msc_custom_staff') || '[]');
          const updated = saved.filter(s => String(s.nationalId).trim() !== String(nationalId).trim());
          localStorage.setItem('msc_custom_staff', JSON.stringify(updated));
        } catch (e) {}
      }
      alert('تم حذف العضو بنجاح');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handleSaveBulk = async (e) => {
    e.preventDefault();
    if (!bulkData.trim()) return;
    setIsSaving(true);

    try {
      const lines = bulkData.trim().split('\n');
      let addedCount = 0;
      let skippedIds = [];
      const newStaffList = [];

      for (let line of lines) {
        const parts = line.split(/[\t,]/).map(s => s.trim());
        if (parts.length >= 2) {
          const sId = parts[0];
          const sName = parts[1];
          const sRoleTitle = parts[2] || 'وكيل / كادر مدرسي';

          if (sId && sName) {
            // Uniqueness check
            const uCheck = await getDocs(query(collection(db, 'users'), where('nationalId', '==', sId)));
            const staffCheck = await getDocs(query(collection(db, 'staff'), where('nationalId', '==', sId)));
            const supCheck = await getDocs(query(collection(db, 'supervisors'), where('nationalId', '==', sId)));
            const tCheck = await getDocs(query(collection(db, 'teachers'), where('nationalId', '==', sId)));
            const sCheck = await getDocs(query(collection(db, 'students'), where('nationalId', '==', sId)));

            if (!uCheck.empty || !staffCheck.empty || !supCheck.empty || !tCheck.empty || !sCheck.empty) {
              skippedIds.push(sId);
              continue;
            }

            const fakeEmail = `${sId}@school.local`;
            // Default full basic permissions for bulk added staff
            const defPerms = ['preparations', 'weekly_plans', 'schedules', 'students', 'attendance'];

            const staffData = {
              name: sName,
              nationalId: sId,
              email: fakeEmail,
              roleTitle: sRoleTitle,
              roleCategory: 'custom',
              permissions: defPerms,
              role: 'staff',
              schoolId,
              password: sId,
              createdAt: new Date()
            };

            try {
              const passToSet = sId.length >= 6 ? sId : `${sId}00`;
              await createSecondaryAuthUser(fakeEmail, passToSet, staffData);
            } catch (authErr) {
              console.warn('Bulk staff secondary auth notice:', authErr);
            }

            await addDoc(collection(db, 'staff'), staffData);

            await addDoc(collection(db, 'users'), {
              nationalId: sId,
              email: fakeEmail,
              role: 'staff',
              name: sName,
              roleTitle: sRoleTitle,
              permissions: defPerms,
              password: sId,
              schoolId
            });

            newStaffList.push(staffData);
            addedCount++;
          }
        }
      }

      if (newStaffList.length > 0) {
        try {
          const saved = JSON.parse(localStorage.getItem('msc_custom_staff') || '[]');
          const updated = [...newStaffList, ...saved];
          localStorage.setItem('msc_custom_staff', JSON.stringify(updated));
        } catch (lsErr) {}
      }

      setIsBulkAdding(false);
      setBulkData('');
      let msg = `تمت إضافة ${addedCount} من أعضاء الكادر بنجاح.`;
      if (skippedIds.length > 0) {
        msg += `\n⚠️ تم تخطي الأرقام التالية لأنها مسجلة مسبقاً:\n${skippedIds.join(', ')}`;
      }
      alert(msg);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الرفع الجماعي');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter staff
  const filteredStaff = staffList.filter(s => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'deputy') return s.roleCategory === 'deputy' || s.roleTitle?.includes('وكيل');
    if (activeFilter === 'counselor') return s.roleCategory === 'counselor' || s.roleTitle?.includes('مرشد') || s.roleTitle?.includes('موجه');
    if (activeFilter === 'activity') return s.roleCategory === 'activity' || s.roleTitle?.includes('نشاط');
    if (activeFilter === 'supervisor') return s.roleCategory === 'supervisor' || s.roleTitle?.includes('مشرف');
    if (activeFilter === 'custom') return s.roleCategory === 'custom';
    return true;
  });

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={26} color="var(--color-primary)" /> {t('staff.title')}
          </h2>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>
            {t('staff.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" style={{ background: 'var(--color-surface)', color: 'var(--color-primary-dark)', border: '1px solid var(--color-border)' }} onClick={() => setIsBulkAdding(true)}>
            {t('staff.bulkUpload')}
          </button>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={18} /> {t('staff.addNew')}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '6px' }}>
        {[
          { id: 'all', label: `${t('staff.tabAll')} (${staffList.length})` },
          { id: 'deputy', label: t('staff.tabDeputies') },
          { id: 'counselor', label: t('staff.tabCounselor') },
          { id: 'activity', label: t('staff.tabActivity') },
          { id: 'supervisor', label: t('staff.tabSupervisors') },
          { id: 'custom', label: t('staff.tabCustom') }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: activeFilter === tab.id ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
              background: activeFilter === tab.id ? 'rgba(99, 178, 198, 0.15)' : 'white',
              color: activeFilter === tab.id ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
              fontWeight: activeFilter === tab.id ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '13px',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Staff Cards List */}
      <div style={{ display: 'grid', gap: '14px' }}>
        {filteredStaff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', background: 'white', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <Shield size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p style={{ margin: 0, fontSize: '15px' }}>{t('staff.noStaff')}</p>
          </div>
        ) : (
          filteredStaff.map(staff => {
            const userPerms = staff.permissions || [];
            return (
              <div key={staff.id} style={{
                padding: '18px 20px',
                background: 'white',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '17px' }}>{staff.name}</h3>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'var(--color-primary-dark)',
                      background: 'rgba(99, 178, 198, 0.18)',
                      padding: '3px 10px',
                      borderRadius: '12px'
                    }}>
                      {staff.roleTitle || 'عضو كادر'}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#0e7490',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      🌐 {staff.nationality || 'سعودي'}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    الهوية: <strong>{staff.nationalId}</strong> {staff.whatsapp ? `• واتساب: ${staff.whatsapp}` : ''}
                  </p>

                  {/* Active Permissions Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', alignSelf: 'center', marginInlineEnd: '4px' }}>الصلاحيات الممنوحة:</span>
                    {userPerms.length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px' }}>بدون صلاحيات</span>
                    ) : (
                      userPerms.map(pId => {
                        const permObj = ALL_PERMISSIONS.find(p => p.id === pId);
                        return (
                          <span key={pId} style={{
                            fontSize: '11px',
                            background: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✓ {permObj?.label || pId}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setPrintingLetterStaff(staff)}
                    className="btn"
                    style={{
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                    title="طباعة خطاب تعريف موظف"
                  >
                    <FileText size={15} /> خطاب تعريف
                  </button>

                  <button
                    onClick={() => setPrintingPortfolioStaff(staff)}
                    className="btn"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                    title="طباعة وتصدير ملف الإنجاز الإداري"
                  >
                    <Award size={15} /> ملف الإنجاز
                  </button>

                  <button
                    onClick={() => setEditingPermissionsStaff({ ...staff })}
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                      border: 'none',
                      color: 'white',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: '700',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <ShieldCheck size={17} /> تعديل الصلاحيات
                  </button>

                  <button
                    onClick={() => setEditingStaffInfo({ ...staff })}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#0e7490', padding: '8px', display: 'flex', alignItems: 'center' }}
                    title="تعديل البيانات"
                  >
                    <Edit size={16} />
                  </button>

                  <button
                    onClick={() => handleDeleteStaff(staff.id, staff.nationalId, staff.name)}
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', color: '#dc2626', padding: '8px', display: 'flex', alignItems: 'center' }}
                    title="حذف"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Add New Staff Member */}
      {isAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', position: 'relative' }}>
            <button onClick={() => setIsAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--color-primary-dark)' }}>إضافة عضو كادر إداري وتعيين الدور والصلاحيات</h3>

            <form onSubmit={handleSaveSingle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>اسم العضو / الموظف</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الثلاثي أو الرباعي" required />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>رقم الهوية الوطنية</label>
                <input type="text" className="input-field" value={nationalId} onChange={e => setNationalId(e.target.value)} placeholder="10xxxxxxxx" required />
              </div>

              <NationalitySelect value={nationality} onChange={setNationality} required />

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>المسمى الوظيفي / الدور</label>
                <select
                  className="input-field"
                  value={selectedPresetIndex}
                  onChange={e => handlePresetChange(Number(e.target.value))}
                >
                  {ROLE_PRESETS.map((preset, idx) => (
                    <option key={idx} value={idx}>{preset.title}</option>
                  ))}
                </select>
              </div>

              {ROLE_PRESETS[selectedPresetIndex].category === 'custom' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>اكتب المسمى الوظيفي المخصص</label>
                  <input
                    type="text"
                    className="input-field"
                    value={customRoleTitle}
                    onChange={e => setCustomRoleTitle(e.target.value)}
                    placeholder="مثال: أمين مصادر التعلم، رائد النشاط، مسؤول الموهوبين..."
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>رقم الواتساب / الجوال (اختياري)</label>
                <input type="text" className="input-field" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="05xxxxxxxx" />
              </div>

              {/* Permissions Checkboxes Matrix */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ color: 'var(--color-primary-dark)', fontWeight: 'bold' }}>
                    تحديد صلاحيات الوصول الممنوحة لهذا الحساب:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions(ALL_PERMISSIONS.map(p => p.id))}
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', cursor: 'pointer' }}
                    >
                      توسيع (منح الكل)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPermissions([])}
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', cursor: 'pointer' }}
                    >
                      تقليص (سحب الكل)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {ALL_PERMISSIONS.map(perm => {
                    const isChecked = selectedPermissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => togglePermission(perm.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          background: isChecked ? 'rgba(99, 178, 198, 0.15)' : 'white',
                          border: isChecked ? '1px solid var(--color-primary)' : '1px solid #cbd5e1',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        {isChecked ? <CheckSquare size={18} color="var(--color-primary)" /> : <Square size={18} color="#94a3b8" />}
                        <span style={{ fontSize: '13px', fontWeight: isChecked ? 'bold' : 'normal', color: isChecked ? 'var(--color-primary-dark)' : 'var(--color-text)' }}>
                          {perm.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ marginTop: '10px' }}>
                {isSaving ? 'جاري الحفظ...' : 'حفظ وإضافة العضو'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Permissions (تعديل الصلاحيات - توسيع وتقليص) */}
      {editingPermissionsStaff && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', position: 'relative' }}>
            <button onClick={() => setEditingPermissionsStaff(null)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <ShieldCheck size={26} color="#0e7490" />
              <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>
                تعديل الصلاحيات: {editingPermissionsStaff.name}
              </h3>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                المسمى: <strong style={{ color: '#0e7490' }}>{editingPermissionsStaff.roleTitle}</strong> • الهوية: {editingPermissionsStaff.nationalId}
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '3px 10px',
                borderRadius: '12px',
                background: (editingPermissionsStaff.permissions || []).length > 0 ? '#dcfce7' : '#fee2e2',
                color: (editingPermissionsStaff.permissions || []).length > 0 ? '#166534' : '#991b1b'
              }}>
                الصلاحيات المفعلة: {(editingPermissionsStaff.permissions || []).length} من {ALL_PERMISSIONS.length}
              </span>
            </div>

            {/* Quick Actions: Expand & Reduce */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)', marginBottom: '8px' }}>إجراءات سريعة لتوسيع أو تقليص الصلاحيات:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setEditingPermissionsStaff({ ...editingPermissionsStaff, permissions: ALL_PERMISSIONS.map(p => p.id) })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ توسيع الصلاحيات (منح كافة الصلاحيات)
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPermissionsStaff({ ...editingPermissionsStaff, permissions: [] })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🚫 تقليص الصلاحيات (سحب كافة الصلاحيات)
                </button>
              </div>

              {/* Template shortcuts */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>تطبيق نموذج:</span>
                {ROLE_PRESETS.filter(p => p.category !== 'custom').map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEditingPermissionsStaff({ ...editingPermissionsStaff, permissions: [...p.defaultPermissions] })}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: 'var(--color-primary-dark)',
                      cursor: 'pointer'
                    }}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Granular Permission Toggles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {ALL_PERMISSIONS.map(perm => {
                const isChecked = (editingPermissionsStaff.permissions || []).includes(perm.id);
                return (
                  <div
                    key={perm.id}
                    onClick={() => toggleEditPermission(perm.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      background: isChecked ? 'rgba(99, 178, 198, 0.15)' : 'white',
                      border: isChecked ? '1.5px solid var(--color-primary)' : '1px solid #cbd5e1',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isChecked ? <CheckSquare size={20} color="var(--color-primary)" /> : <Square size={20} color="#94a3b8" />}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: isChecked ? 'bold' : 'normal', color: isChecked ? 'var(--color-primary-dark)' : 'var(--color-text)' }}>
                        {perm.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{perm.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSavePermissions}
              className="btn btn-primary"
              disabled={isSaving}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '15px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)'
              }}
            >
              {isSaving ? 'جاري الحفظ والاعتماد...' : '✓ اعتماد وحفظ تعديلات الصلاحيات'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Staff Basic Info */}
      {editingStaffInfo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setEditingStaffInfo(null)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--color-primary-dark)' }}>تعديل بيانات العضو</h3>

            <form onSubmit={handleUpdateStaffInfo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)' }}>الاسم</label>
                <input type="text" className="input-field" value={editingStaffInfo.name} onChange={e => setEditingStaffInfo({ ...editingStaffInfo, name: e.target.value })} required />
              </div>
              <NationalitySelect 
                value={editingStaffInfo.nationality || 'سعودي'} 
                onChange={val => setEditingStaffInfo({ ...editingStaffInfo, nationality: val })} 
              />
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)' }}>المسمى الوظيفي / الدور</label>
                <input type="text" className="input-field" value={editingStaffInfo.roleTitle} onChange={e => setEditingStaffInfo({ ...editingStaffInfo, roleTitle: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)' }}>رقم الواتساب</label>
                <input type="text" className="input-field" value={editingStaffInfo.whatsapp || ''} onChange={e => setEditingStaffInfo({ ...editingStaffInfo, whatsapp: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Bulk Upload */}
      {isBulkAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '520px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsBulkAdding(false)} style={{ position: 'absolute', top: '15px', left: '15px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--color-text-muted)" /></button>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-primary-dark)' }}>رفع قائمة الكادر الإداري</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '15px' }}>
              الترتيب المطلوب: <strong>رقم الهوية، اسم العضو، المسمى الوظيفي</strong> مفصولة بفاصلة
            </p>
            <form onSubmit={handleSaveBulk} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea
                className="input-field"
                rows="10"
                value={bulkData}
                onChange={e => setBulkData(e.target.value)}
                placeholder="1010101010, أ. عبدالله الزهراني, وكيل شؤون الطلاب&#10;1020202020, أ. سعد القحطاني, المرشد الطلابي&#10;1030303030, أ. ماجد الشهري, مشرف النشاط"
                required
                style={{ resize: 'none' }}
              />
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'جاري الرفع...' : 'رفع البيانات'}
              </button>
            </form>
          </div>
        </div>
      )}

      {printingLetterStaff && (
        <CertificateLetterModal person={printingLetterStaff} type="staff" onClose={() => setPrintingLetterStaff(null)} />
      )}

      {printingPortfolioStaff && (
        <PrintPortfolioModal
          role="staff"
          userData={printingPortfolioStaff}
          schoolName={printingPortfolioStaff?.schoolName}
          onClose={() => setPrintingPortfolioStaff(null)}
        />
      )}
    </div>
  );
}
