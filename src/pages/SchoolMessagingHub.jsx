import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, arrayUnion, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Mail, Send, Inbox, Paperclip, FileText, Image as ImageIcon, Download,
  Eye, Trash2, Reply, Check, CheckCheck, AlertCircle, AlertTriangle,
  Users, User, Search, Filter, Printer, X, Plus, Clock, Tag, ArrowRight,
  ShieldCheck, UserCheck, BookOpen, Sparkles, RefreshCw, CheckCircle2,
  BarChart2, Archive, Undo2, EyeOff
} from 'lucide-react';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from '../utils/realtimeBroadcast';
import { ADVANCED_SCHOOLS_CATALOG } from '../data/resourceData';

const ROLE_BADGES = {
  admin: { label: 'مدير المدرسة', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '👑' },
  staff: { label: 'كادر إداري', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', icon: '👔' },
  supervisor: { label: 'مشرف تربوي', bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff', icon: '🌟' },
  teacher: { label: 'معلم', bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4', icon: '👨‍🏫' },
  student: { label: 'طالب', bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: '🎓' },
  parent: { label: 'ولي أمر', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: '👨‍👩‍👧‍👦' }
};

const TARGET_GROUPS = [
  { id: 'all', label: '📢 تعميم عام لكافة منسوبي المدرسة', desc: 'يصل للمدير والمعلمين والطلاب والكادر والمشرفين وأولياء الأمور' },
  { id: 'admins', label: '👑 كافة مدراء المدارس والإدارات التعليمية', desc: 'يصل لجميع مدراء الفروع والمدارس' },
  { id: 'teachers', label: '👨‍🏫 كافة المعلمين والمعلمات', desc: 'يصل لجميع معلمي المدرسة' },
  { id: 'students', label: '🎓 كافة الطلاب والطالبات', desc: 'يصل لجميع طلاب المدرسة' },
  { id: 'parents', label: '👨‍👩‍👧‍👦 كافة أولياء الأمور', desc: 'يصل لأولياء أمور جميع طلاب المدرسة' },
  { id: 'class', label: '🏫 طلاب وفصل دراسي محدد', desc: 'تحديد فصل معين لإرسال التوجيهات أو الواجبات' },
  { id: 'staff', label: '👔 كافة أعضاء الكادر الإداري والوكلاء', desc: 'يصل للوكلاء والإداريين' },
  { id: 'supervisors', label: '🌟 كافة المشرفين التربويين', desc: 'يصل للمشرفين التعليميين' }
];

export default function SchoolMessagingHub() {
  const { userData, currentUser, userRole } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'sent' | 'compose'
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  // Directories for recipient selection
  const [adminList, setAdminList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [supervisorsList, setSupervisorsList] = useState([]);
  const [classesList, setClassesList] = useState([]);

  // Search and Filter in Feed
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'individual' | 'group' | 'urgent'

  // Search within Recipient Dropdown
  const [recipientSearch, setRecipientSearch] = useState('');

  // Composer Form State
  const [messageType, setMessageType] = useState('individual'); // 'individual' | 'group'
  const [targetGroup, setTargetGroup] = useState('all');
  const [targetClassName, setTargetClassName] = useState('');
  const [recipientNid, setRecipientNid] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('normal'); // 'normal' | 'important' | 'urgent'
  const [attachment, setAttachment] = useState(null); // { name, type: 'image' | 'pdf', size, dataUrl }
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // Read Audit Tab in Reader
  const [auditTab, setAuditTab] = useState('read'); // 'read' | 'pending'

  // Lightbox for attachment
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const schoolId = userData?.schoolId || 'main_school';
  const myNid = (userData?.nationalId || currentUser?.email?.replace('@school.local', '') || currentUser?.uid || '').trim();
  const myName = userData?.name || (userRole === 'teacher' ? 'المعلم' : userRole === 'admin' ? 'مدير المدرسة' : 'مستخدم النظام');
  const myRole = userRole || userData?.role || 'student';
  const myRoleTitle = userData?.roleTitle || (myRole === 'teacher' ? `معلم • ${userData?.subject || ''}` : ROLE_BADGES[myRole]?.label || myRole);
  const myClass = (userData?.class || userData?.className || '')?.trim();

  // All my possible identifiers for matching messages
  const myIdentities = useMemo(() => {
    const cleanName = myName.replace(/^(أستاذ|أ\.|د\.|الاستاذ|الأستاذ|المعلم|الطالب)\s*/g, '').trim().toLowerCase();
    const ids = new Set([
      myNid,
      userData?.nationalId,
      userData?.id,
      currentUser?.uid,
      currentUser?.email,
      currentUser?.email?.split('@')[0],
      myName.trim().toLowerCase(),
      cleanName
    ].filter(Boolean).map(s => String(s).trim().toLowerCase()));
    return ids;
  }, [myNid, userData, currentUser, myName]);

  // 1. Load Recipients Directory filtered by schoolId
  useEffect(() => {
    // Also load local admins from localStorage if available
    const getLocalAdmins = () => {
      try {
        const raw = localStorage.getItem('msc_custom_admins');
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    };

    const unsubAdmins = onSnapshot(collection(db, 'users'), async snap => {
      let admins = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => (d.role === 'admin' || d.role === 'superadmin') && (schoolId === 'ALL' || userRole === 'superadmin' || d.schoolId === schoolId || d.schoolId === 'ALL' || d.role === 'superadmin'))
        .map(d => ({
          ...d,
          role: d.role,
          roleTitle: d.role === 'superadmin' ? 'الإدارة العامة (الماستر العام)' : (d.roleTitle || 'مدير المدرسة'),
          name: d.role === 'superadmin' ? (d.name || 'الماستر العام') : (d.name || 'مدير المدرسة')
        }));

      // Merge local admins
      const localAdmins = getLocalAdmins();
      localAdmins.forEach(la => {
        if (!admins.some(a => a.nationalId === la.nationalId || a.id === la.id || a.email === la.email)) {
          admins.push({
            id: la.id || `local_admin_${la.nationalId}`,
            nationalId: la.nationalId,
            email: la.email,
            name: la.name || 'مدير المدرسة',
            role: 'admin',
            roleTitle: 'مدير المدرسة',
            schoolId: la.schoolId || 'main_school',
            schoolName: la.schoolName || ''
          });
        }
      });

      // Ensure each known school from Firestore and catalog has a designated principal entry
      try {
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        schoolsSnap.docs.forEach(sDoc => {
          const s = sDoc.data();
          const sid = sDoc.id;
          const hasSchoolAdmin = admins.some(a => a.role === 'admin' && (a.schoolId === sid || a.schoolId === s.code || a.id === `admin_${sid}`));
          if (!hasSchoolAdmin && (schoolId === 'ALL' || userRole === 'superadmin' || schoolId === sid)) {
            admins.push({
              id: `admin_${sid}`,
              nationalId: s.code || sid,
              email: `admin_${sid}@school.local`,
              name: `مدير ${s.name || 'المدرسة'}`,
              role: 'admin',
              roleTitle: `إدارة مدرسة • ${s.name || 'الفرع'}`,
              schoolId: sid,
              schoolName: s.name || ''
            });
          }
        });
      } catch (err) {
        console.warn("Notice loading schools for admins list:", err);
      }

      // Ensure all 43 MSC schools from ADVANCED_SCHOOLS_CATALOG have a designated principal entry
      try {
        ADVANCED_SCHOOLS_CATALOG.forEach(s => {
          const sid = s.code;
          const hasSchoolAdmin = admins.some(a => a.role === 'admin' && (a.schoolId === sid || a.schoolId === s.code || a.id === `admin_${sid}`));
          if (!hasSchoolAdmin && (schoolId === 'ALL' || userRole === 'superadmin' || schoolId === sid)) {
            admins.push({
              id: `admin_${sid}`,
              nationalId: s.code || sid,
              email: `admin_${sid}@school.local`,
              name: `مدير ${s.name}`,
              role: 'admin',
              roleTitle: `إدارة مدرسة • ${s.name}`,
              schoolId: sid,
              schoolName: s.name
            });
          }
        });
      } catch (err) {
        console.warn("Notice loading catalog schools for admins list:", err);
      }

      // Add a dedicated broadcast option for SuperAdmin to send to ALL principals at once
      if (!admins.some(a => a.id === 'all_schools_principals')) {
        admins.unshift({
          id: 'all_schools_principals',
          nationalId: 'ALL_ADMINS',
          email: 'all_admins@school.local',
          name: '👑 كافة مدراء المدارس (تعميم لكافة الفروع)',
          role: 'admin',
          roleTitle: 'إدارة كافة الفروع والمجمعات',
          schoolId: 'ALL',
          schoolName: 'جميع المدارس'
        });
      }

      // Ensure Master / SuperAdmin is always available in directory for all schools
      if (!admins.some(a => a.role === 'superadmin' || a.email === 'super@admin.com' || a.id === 'master_general_admin')) {
        admins.unshift({
          id: 'master_general_admin',
          nationalId: 'super@admin.com',
          email: 'super@admin.com',
          name: 'الإدارة العامة (الماستر العام)',
          role: 'superadmin',
          roleTitle: 'الإدارة العامة والمتابعة المركزية',
          schoolId: 'ALL'
        });
      }
      setAdminList(admins);
    });

    const unsubTeachers = onSnapshot(collection(db, 'teachers'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data(), role: 'teacher' }))
        .filter(d => schoolId === 'ALL' || userRole === 'superadmin' || d.schoolId === schoolId);
      setTeachersList(list);
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data(), role: 'student' }))
        .filter(d => schoolId === 'ALL' || userRole === 'superadmin' || d.schoolId === schoolId);
      setStudentsList(list);
    });

    const unsubStaff = onSnapshot(collection(db, 'staff'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data(), role: 'staff' }))
        .filter(d => schoolId === 'ALL' || userRole === 'superadmin' || d.schoolId === schoolId);
      setStaffList(list);
    });

    const unsubSupervisors = onSnapshot(collection(db, 'supervisors'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data(), role: 'supervisor' }))
        .filter(d => schoolId === 'ALL' || userRole === 'superadmin' || d.schoolId === schoolId);
      setSupervisorsList(list);
    });

    const unsubClasses = onSnapshot(collection(db, 'classes'), snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => schoolId === 'ALL' || userRole === 'superadmin' || d.schoolId === schoolId);
      setClassesList(list);
      if (list.length > 0 && !targetClassName) {
        setTargetClassName(list[0].name);
      }
    });

    return () => {
      unsubAdmins();
      unsubTeachers();
      unsubStudents();
      unsubStaff();
      unsubSupervisors();
      unsubClasses();
    };
  }, [schoolId, userRole]);

  // 2. Realtime listener to school_messages - Comprehensive live sync with zero barriers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'school_messages'), snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first
      msgs.sort((a, b) => {
        const timeA = new Date(b.createdAt || b.timestamp || 0).getTime();
        const timeB = new Date(a.createdAt || a.timestamp || 0).getTime();
        return timeA - timeB;
      });
      setMessages(msgs);

      // Keep selected message in sync
      if (selectedMessage) {
        const updated = msgs.find(m => m.id === selectedMessage.id);
        if (updated) setSelectedMessage(updated);
      }
    }, err => {
      console.error("Firestore onSnapshot error for school_messages:", err);
    });

    // ⚡ Cross-Tab Instant BroadcastChannel Subscription
    const unsubBroadcast = subscribeRealtimeEvents((event) => {
      if (event?.type === 'MESSAGE_UPDATE' && event.payload?.message) {
        setMessages(prev => {
          const m = event.payload.message;
          const exists = prev.some(item => item.id === m.id);
          if (exists) return prev.map(item => item.id === m.id ? { ...item, ...m } : item);
          return [m, ...prev];
        });
      }
    });

    return () => {
      unsub();
      unsubBroadcast();
    };
  }, [selectedMessage?.id]);

  // 3. Robust Identity and Delivery Verification: Is this message addressed to the current logged-in user?
  const isMessageForMe = (msg) => {
    if (!msg) return false;

    const isAdminUser = userRole === 'admin' || userData?.role === 'admin' || myRole === 'admin';
    const isSuperAdminUser = userRole === 'superadmin' || userData?.role === 'superadmin' || myRole === 'superadmin';

    // Global / Multi-school matching
    const isGlobal = (
      !msg.schoolId || 
      msg.schoolId === 'ALL' || 
      msg.schoolId === 'all' || 
      schoolId === 'ALL' || 
      schoolId === 'all' ||
      msg.targetSchoolId === 'ALL' || 
      msg.targetSchoolId === 'all' ||
      msg.targetSchoolId === schoolId || 
      msg.schoolId === schoolId ||
      isSuperAdminUser ||
      (msg.senderRole === 'superadmin' && isAdminUser)
    );

    // A. Direct / Individual Message: Delivered unconditionally if addressed to my identity or my role
    if (msg.messageType === 'individual') {
      const recNid = String(msg.receiverNationalId || '').trim().toLowerCase();
      const recId = String(msg.receiverId || '').trim().toLowerCase();
      const recEmail = String(msg.receiverEmail || '').trim().toLowerCase();
      const recName = String(msg.receiverName || '').trim().toLowerCase();
      const myNameLower = myName.trim().toLowerCase();
      const studentNidLower = String(userData?.studentNationalId || '').trim().toLowerCase();

      const isAddressedToMe = (
        (recNid && (myIdentities.has(recNid) || (studentNidLower && recNid === studentNidLower))) ||
        (recId && myIdentities.has(recId)) ||
        (recEmail && myIdentities.has(recEmail)) ||
        (recName && myIdentities.has(recName)) ||
        (recName && myNameLower && (recName.includes(myNameLower) || myNameLower.includes(recName))) ||
        (isSuperAdminUser && (recNid === 'super@admin.com' || recEmail === 'super@admin.com' || recName.includes('ماستر') || recName.includes('الإدارة العامة'))) ||
        // 👑 CRITICAL: If recipient is 'admin' and current user is Admin of the school or message is global/from Master
        (isAdminUser && (
          msg.receiverRole === 'admin' ||
          recName.includes('مدير') ||
          recName.includes('إدارة') ||
          recName.includes('الادارة') ||
          recNid === 'all_admins' ||
          recId === 'all_schools_principals' ||
          (msg.senderRole === 'superadmin' && isGlobal)
        ))
      );

      return Boolean(isAddressedToMe);
    }

    // B. Group / Broadcast Message (تعميم جماعي)
    if (!isGlobal && msg.schoolId !== schoolId) {
      return false;
    }

    if (msg.messageType === 'group') {
      // Admins and SuperAdmins receive ALL group circulars!
      if (isAdminUser || isSuperAdminUser) return true;

      const tg = msg.targetGroup || 'all';
      
      // All school community
      if (tg === 'all') return true;

      // Teachers
      if (tg === 'teachers') {
        return myRole === 'teacher' || userRole === 'teacher' || userData?.role === 'teacher' || Boolean(userData?.subject);
      }

      // Students
      if (tg === 'students') {
        return myRole === 'student' || userRole === 'student' || userData?.role === 'student';
      }

      // Parents
      if (tg === 'parents') {
        return myRole === 'parent' || userRole === 'parent' || userData?.role === 'parent';
      }

      // Specific Class (e.g. 1/أ)
      if (tg === 'class') {
        const targetCls = String(msg.targetClassName || '').trim().toLowerCase();
        const userCls = String(myClass || userData?.class || userData?.className || userData?.studentClass || '').trim().toLowerCase();
        
        if (myRole === 'student' || myRole === 'parent' || userRole === 'student' || userRole === 'parent' || userData?.role === 'student' || userData?.role === 'parent') {
          if (!targetCls || targetCls === userCls || userCls.includes(targetCls) || targetCls.includes(userCls)) return true;
        }
        if (myRole === 'teacher' || myRole === 'staff' || userRole === 'teacher' || userRole === 'staff') {
          return true;
        }
      }

      // Staff / Deputies
      if (tg === 'staff') {
        return myRole === 'staff' || userRole === 'staff';
      }

      // Supervisors
      if (tg === 'supervisors') {
        return myRole === 'supervisor' || userRole === 'supervisor';
      }
    }

    return false;
  };

  // Inbox Messages (non-archived)
  const inboxMessages = useMemo(() => {
    return messages.filter(m => !m.archived && isMessageForMe(m));
  }, [messages, isMessageForMe]);

  // Sent Messages (non-archived)
  const sentMessages = useMemo(() => {
    return messages.filter(m => {
      if (m.archived) return false;
      const sNid = String(m.senderNationalId || '').trim().toLowerCase();
      const sId = String(m.senderId || '').trim().toLowerCase();
      const sName = String(m.senderName || '').trim().toLowerCase();
      const myNameLower = myName.trim().toLowerCase();
      return myIdentities.has(sNid) || myIdentities.has(sId) || (sName && myNameLower && sName === myNameLower);
    });
  }, [messages, myIdentities, myName]);

  // Archived Messages (soft-deleted with restore capability)
  const archivedMessages = useMemo(() => {
    return messages.filter(m => {
      if (!m.archived) return false;
      const sNid = String(m.senderNationalId || '').trim().toLowerCase();
      const sId = String(m.senderId || '').trim().toLowerCase();
      const sName = String(m.senderName || '').trim().toLowerCase();
      const myNameLower = myName.trim().toLowerCase();
      const isSentByMe = myIdentities.has(sNid) || myIdentities.has(sId) || (sName && myNameLower && sName === myNameLower);
      return isSentByMe || isMessageForMe(m);
    });
  }, [messages, myIdentities, myName, isMessageForMe]);

  // Unread Count
  const unreadCount = useMemo(() => {
    return inboxMessages.filter(m => {
      if (!m.readBy || !Array.isArray(m.readBy)) return true;
      return !m.readBy.some(id => myIdentities.has(String(id).trim().toLowerCase()));
    }).length;
  }, [inboxMessages, myIdentities]);

  // Filtered List based on Search & Filter
  const currentTabList = activeTab === 'inbox' 
    ? inboxMessages 
    : (activeTab === 'sent' ? sentMessages : archivedMessages);

  const displayedMessages = useMemo(() => {
    return currentTabList.filter(m => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubj = m.subject?.toLowerCase().includes(q);
        const matchBody = m.body?.toLowerCase().includes(q);
        const matchSender = m.senderName?.toLowerCase().includes(q);
        const matchReceiver = m.receiverName?.toLowerCase().includes(q);
        if (!matchSubj && !matchBody && !matchSender && !matchReceiver) return false;
      }

      if (filterType === 'unread') {
        if (m.readBy && m.readBy.some(id => myIdentities.has(String(id).trim().toLowerCase()))) return false;
      } else if (filterType === 'individual') {
        if (m.messageType !== 'individual') return false;
      } else if (filterType === 'group') {
        if (m.messageType !== 'group') return false;
      } else if (filterType === 'urgent') {
        if (m.priority !== 'urgent') return false;
      }

      return true;
    });
  }, [currentTabList, searchQuery, filterType, myIdentities]);

  // Filtered directory for Composer select dropdown
  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    const filterFn = (item) => {
      if (!q) return true;
      const name = String(item.name || '').toLowerCase();
      const nid = String(item.nationalId || item.id || '').toLowerCase();
      const title = String(item.roleTitle || item.subject || item.class || '').toLowerCase();
      return name.includes(q) || nid.includes(q) || title.includes(q);
    };

    return {
      admins: adminList.filter(filterFn),
      staff: staffList.filter(filterFn),
      teachers: teachersList.filter(filterFn),
      supervisors: supervisorsList.filter(filterFn),
      students: studentsList.filter(filterFn)
    };
  }, [recipientSearch, adminList, staffList, teachersList, supervisorsList, studentsList]);

  // Handle Mark as Read when opening message + Record detailed Reader object
  const handleSelectMessage = async (msg) => {
    setSelectedMessage(msg);
    const hasRead = msg.readBy && Array.isArray(msg.readBy) && msg.readBy.some(id => myIdentities.has(String(id).trim().toLowerCase()));
    
    if (activeTab === 'inbox' && !hasRead) {
      try {
        const readerEntry = {
          userId: currentUser?.uid || myNid,
          nationalId: myNid,
          name: myName,
          role: myRole,
          roleTitle: myRoleTitle,
          readAt: new Date().toISOString()
        };

        await updateDoc(doc(db, 'school_messages', msg.id), {
          readBy: arrayUnion(myNid, currentUser?.uid || myNid),
          readers: arrayUnion(readerEntry)
        });
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    }
  };

  // Compute Detailed Audience & Read Audit for Selected Message
  const auditData = useMemo(() => {
    if (!selectedMessage) return { targetAudience: [], readList: [], pendingList: [], readPercentage: 0 };

    const msg = selectedMessage;
    const recordedReaders = msg.readers || [];
    const readBySet = new Set((msg.readBy || []).map(x => String(x).trim().toLowerCase()));

    // 1. Determine Target Audience List
    let targetList = [];
    if (msg.messageType === 'individual') {
      targetList = [{
        id: msg.receiverId || msg.receiverNationalId,
        nationalId: msg.receiverNationalId || '',
        name: msg.receiverName || 'المستلم',
        role: msg.receiverRole || 'user',
        roleTitle: msg.receiverRoleTitle || 'مستلم'
      }];
    } else {
      if (msg.targetGroup === 'all') {
        targetList = [...adminList, ...teachersList, ...studentsList, ...staffList, ...supervisorsList];
      } else if (msg.targetGroup === 'teachers') {
        targetList = [...teachersList];
      } else if (msg.targetGroup === 'students' || msg.targetGroup === 'parents') {
        targetList = [...studentsList];
      } else if (msg.targetGroup === 'class') {
        targetList = studentsList.filter(s => s.class === msg.targetClassName || s.className === msg.targetClassName);
      } else if (msg.targetGroup === 'staff') {
        targetList = [...staffList];
      } else if (msg.targetGroup === 'supervisors') {
        targetList = [...supervisorsList];
      }
    }

    // 2. Classify into Read vs Pending
    const readList = [];
    const pendingList = [];

    const processedNids = new Set();
    recordedReaders.forEach(r => {
      const rNid = String(r.nationalId || r.userId || '').trim().toLowerCase();
      processedNids.add(rNid);
      readList.push({
        id: r.userId || r.nationalId,
        nationalId: r.nationalId,
        name: r.name,
        role: r.role,
        roleTitle: r.roleTitle || ROLE_BADGES[r.role]?.label || r.role,
        readAt: r.readAt
      });
    });

    targetList.forEach(member => {
      const mNid = String(member.nationalId || member.id || '').trim().toLowerCase();
      const mId = String(member.id || '').trim().toLowerCase();

      if (processedNids.has(mNid) || processedNids.has(mId)) {
        return;
      }

      if (readBySet.has(mNid) || readBySet.has(mId)) {
        readList.push({
          id: member.id,
          nationalId: member.nationalId,
          name: member.name,
          role: member.role,
          roleTitle: member.roleTitle || member.subject || member.class || member.specialty || ROLE_BADGES[member.role]?.label || member.role,
          readAt: msg.createdAt
        });
      } else {
        pendingList.push({
          id: member.id,
          nationalId: member.nationalId,
          name: member.name,
          role: member.role,
          roleTitle: member.roleTitle || member.subject || member.class || member.specialty || ROLE_BADGES[member.role]?.label || member.role
        });
      }
    });

    const total = targetList.length || readList.length + pendingList.length || 1;
    const pct = Math.min(100, Math.round((readList.length / total) * 100));

    return {
      targetAudience: targetList,
      readList,
      pendingList,
      readPercentage: isNaN(pct) ? 0 : pct
    };
  }, [selectedMessage, adminList, teachersList, studentsList, staffList, supervisorsList]);

  // Handle File Attachment Upload (Images & PDFs)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الملف المرفق يجب ألا يتجاوز 3 ميجابايت لضمان سرعة الإرسال والتصفح.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      alert('عذراً، يرجى اختيار ملف صورة (JPG / PNG / WEBP) أو مستند PDF فقط.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setAttachment({
        name: file.name,
        type: isImage ? 'image' : 'pdf',
        mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        size: file.size,
        dataUrl: uploadEvent.target.result
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle Reply to message
  const handleStartReply = (msg) => {
    setReplyingTo(msg);
    setMessageType('individual');
    setRecipientNid(msg.senderNationalId || msg.senderId);
    setSubject(`رد على: ${msg.subject || 'الرسالة'}`);
    setBody(`\n\n--- رداً على رسالة: ${msg.senderName} (${msg.senderRoleTitle || ''}) ---\n> ${msg.body?.slice(0, 120)}...`);
    setActiveTab('compose');
    setSelectedMessage(null);
  };

  // Quick Test Message Generator (Sends a test circular)
  const handleSendTestMessage = async () => {
    try {
      await addDoc(collection(db, 'school_messages'), {
        schoolId: schoolId || 'main_school',
        senderId: currentUser?.uid || myNid,
        senderNationalId: myNid,
        senderName: myName,
        senderRole: myRole,
        senderRoleTitle: myRoleTitle,
        messageType: 'group',
        targetGroup: 'all',
        subject: '✨ تعميم تجريبي: تفعيل نظام المراسلات المباشرة والتعاميم',
        body: `السلام عليكم ورحمة الله وبركاته،\n\nنرحب بكافة منسوبي المدرسة (معلمين، طلاب، كادر إداري، ومشرفين).\nتم تفعيل نظام المراسلات المباشرة والتعاميم بربط فوري 100% بين جميع الحسابات.\n\nمع التحية،\n${myName}`,
        priority: 'important',
        attachment: null,
        readBy: [myNid, currentUser?.uid || myNid].filter(Boolean),
        readers: [{
          userId: currentUser?.uid || myNid,
          nationalId: myNid,
          name: myName,
          role: myRole,
          roleTitle: myRoleTitle,
          readAt: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
        replyToId: null
      });
      alert('✓ تم إرسال تعميم تجريبي بنجاح! سيظهر فوراً في البريد الوارد لكافة الحسابات.');
      setActiveTab('inbox');
    } catch (err) {
      console.error('Error sending test message:', err);
      alert('حدث خطأ أثناء إرسال الرسالة، يرجى المحاولة مرة أخرى.');
    }
  };

  // Send Message Handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      alert('يرجى ملء موضوع ونص الرسالة.');
      return;
    }

    let recData = null;
    if (messageType === 'individual') {
      if (!recipientNid) {
        alert('يرجى اختيار المستلم من القائمة.');
        return;
      }
      const allUsers = [...adminList, ...teachersList, ...studentsList, ...staffList, ...supervisorsList];
      const targetUser = allUsers.find(u => u.nationalId === recipientNid || u.id === recipientNid);
      if (targetUser) {
        recData = {
          receiverId: targetUser.id,
          receiverNationalId: targetUser.nationalId || targetUser.id,
          receiverName: targetUser.name,
          receiverRole: targetUser.role || 'user',
          receiverRoleTitle: targetUser.roleTitle || targetUser.subject || targetUser.class || ROLE_BADGES[targetUser.role]?.label || targetUser.role,
          targetSchoolId: targetUser.schoolId || 'ALL',
          targetSchoolName: targetUser.schoolName || ''
        };
      } else {
        recData = {
          receiverId: recipientNid,
          receiverNationalId: recipientNid,
          receiverName: 'المستلم المحدد',
          receiverRole: 'user',
          receiverRoleTitle: 'مستلم',
          targetSchoolId: 'ALL'
        };
      }
    }

    setIsSending(true);
    try {
      const senderReaderObj = {
        userId: currentUser?.uid || myNid,
        nationalId: myNid,
        name: myName,
        role: myRole,
        roleTitle: myRoleTitle,
        readAt: new Date().toISOString()
      };

      const effectiveSchool = (messageType === 'individual' && recData?.targetSchoolId && recData.targetSchoolId !== 'ALL')
        ? recData.targetSchoolId
        : (userRole === 'superadmin' ? 'ALL' : (schoolId || 'main_school'));

      const payload = {
        schoolId: effectiveSchool,
        targetSchoolId: recData?.targetSchoolId || (userRole === 'superadmin' ? 'ALL' : (schoolId || 'main_school')),
        targetSchoolName: recData?.targetSchoolName || '',
        senderId: currentUser?.uid || myNid,
        senderNationalId: myNid,
        senderName: myName,
        senderRole: myRole,
        senderRoleTitle: myRoleTitle,
        messageType,
        subject: subject.trim(),
        body: body.trim(),
        priority,
        attachment: attachment || null,
        readBy: [myNid, currentUser?.uid || myNid].filter(Boolean),
        readers: [senderReaderObj],
        createdAt: new Date().toISOString(),
        timestamp: Date.now(),
        replyToId: replyingTo ? replyingTo.id : null
      };

      if (messageType === 'individual' && recData) {
        Object.assign(payload, recData);
      } else {
        payload.targetGroup = targetGroup;
        payload.targetClassName = targetGroup === 'class' ? targetClassName : '';
      }

      const docRef = await addDoc(collection(db, 'school_messages'), payload);
      broadcastRealtimeEvent('MESSAGE_UPDATE', { message: { id: docRef.id, ...payload } });

      setSubject('');
      setBody('');
      setAttachment(null);
      setRecipientNid('');
      setReplyingTo(null);
      setActiveTab('sent');
      alert('✓ تم إرسال الرسالة / التعميم بنجاح.');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('حدث خطأ أثناء إرسال الرسالة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSending(false);
    }
  };

  // Archive (Soft Delete) message
  const handleArchiveMessage = async (msgId) => {
    try {
      const updateData = { archived: true, archivedAt: Date.now(), archivedBy: myName };
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...updateData } : m));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(prev => prev ? { ...prev, ...updateData } : null);
      }
      broadcastRealtimeEvent('MESSAGE_UPDATE', { message: { id: msgId, ...updateData } });
      await updateDoc(doc(db, 'school_messages', msgId), updateData);
    } catch (err) {
      console.error('Error archiving message:', err);
    }
  };

  // Restore archived message
  const handleRestoreMessage = async (msgId) => {
    try {
      const updateData = { archived: false, archivedAt: null, archivedBy: null };
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...updateData } : m));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(prev => prev ? { ...prev, ...updateData } : null);
      }
      broadcastRealtimeEvent('MESSAGE_UPDATE', { message: { id: msgId, ...updateData } });
      await updateDoc(doc(db, 'school_messages', msgId), updateData);
    } catch (err) {
      console.error('Error restoring message:', err);
    }
  };

  // Delete message
  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'school_messages', msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Bar */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 4px 14px rgba(14, 116, 144, 0.25)'
          }}>
            <Mail size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, color: 'var(--color-primary-dark)', fontSize: '20px' }}>
                نظام المراسلات والتعاميم المدرسية
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle2 size={13} /> النفاذية والتوصيل الفوري نشط
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              تواصل داخلي فوري وفردي وجماعي بين الإدارة، المعلمين، الطلاب، الكادر، والمشرفين
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleSendTestMessage}
            className="btn"
            style={{
              background: '#f8fafc',
              color: '#0e7490',
              border: '1px dashed #0e7490',
              fontSize: '13px',
              fontWeight: 'bold',
              padding: '8px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            title="إرسال تعميم تجريبي للاختبار والتأكد من فاعلية التوصيل"
          >
            <Sparkles size={16} /> تجربة إرسال تعميم فوري
          </button>

          <button
            onClick={() => {
              setReplyingTo(null);
              setSubject('');
              setBody('');
              setAttachment(null);
              setRecipientNid('');
              setActiveTab('compose');
              setSelectedMessage(null);
            }}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontWeight: 'bold',
              fontSize: '14px',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(14, 116, 144, 0.3)'
            }}
          >
            <Plus size={18} /> إنشاء رسالة / تعميم جديد
          </button>
        </div>
      </div>

      {/* Main Grid Container */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedMessage ? '1fr 1.35fr' : '1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Column: Tabs & Messages List (or Compose Form) */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'inbox' ? '#0e7490' : '#f1f5f9',
                color: activeTab === 'inbox' ? 'white' : '#475569',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Inbox size={16} /> البريد الوارد ({inboxMessages.length})
              {unreadCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: '900'
                }}>
                  {unreadCount} جديد
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('sent'); setSelectedMessage(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'sent' ? '#0e7490' : '#f1f5f9',
                color: activeTab === 'sent' ? 'white' : '#475569',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Send size={16} /> البريد الصادر ({sentMessages.length})
            </button>

            <button
              onClick={() => { setActiveTab('archived'); setSelectedMessage(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'archived' ? '#d97706' : '#f1f5f9',
                color: activeTab === 'archived' ? 'white' : '#475569',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Archive size={16} /> الأرشيف ({archivedMessages.length})
            </button>

            <button
              onClick={() => { setActiveTab('compose'); setSelectedMessage(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'compose' ? '#0e7490' : '#f1f5f9',
                color: activeTab === 'compose' ? 'white' : '#475569',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={16} /> كتابة رسالة
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1 & 2: INBOX / SENT MESSAGES LIST                                    */}
          {/* ========================================================================= */}
          {activeTab !== 'compose' && (
            <>
              {/* Search & Filter Toolbar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={18} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="البحث في موضوع الرسالة، النص، أو اسم المرسل/المستلم..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingRight: '38px', marginBottom: 0, fontSize: '13px' }}
                  />
                </div>

                {/* Filter Badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>تصفية:</span>
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'unread', label: 'غير مقروء 📩' },
                    { id: 'individual', label: 'فردي 👤' },
                    { id: 'group', label: 'تعميم جماعي 📢' },
                    { id: 'urgent', label: 'عاجل 🔴' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilterType(f.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        border: filterType === f.id ? '1px solid #0e7490' : '1px solid #e2e8f0',
                        background: filterType === f.id ? 'rgba(14, 116, 144, 0.12)' : 'white',
                        color: filterType === f.id ? '#0e7490' : '#64748b'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '620px', overflowY: 'auto' }}>
                {displayedMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Mail size={48} style={{ opacity: 0.3, marginBottom: '10px', color: '#0e7490' }} />
                    <h4 style={{ margin: '0 0 6px 0', color: '#475569', fontSize: '16px' }}>
                      {activeTab === 'inbox' ? 'صندوق الوارد فارغ حالياً' : (activeTab === 'archived' ? 'الأرشيف فارغ حالياً' : 'لم تقم بإرسال أي رسائل بعد')}
                    </h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
                      {activeTab === 'inbox' 
                        ? 'ستظهر هنا كافة الرسائل الفردية والتعاميم المدرسية الموجهة إليك فور إرسالها.' 
                        : (activeTab === 'archived'
                          ? 'لا توجد رسائل مؤرشفة حالياً. يمكنك نقل الرسائل القديمة للأرشيف واستعادتها في أي وقت.'
                          : 'يمكنك إنشاء رسالة خاصة أو تعميم جماعي من زر "إنشاء رسالة / تعميم جديد".')}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <button
                        onClick={() => setActiveTab('compose')}
                        className="btn btn-primary"
                        style={{ fontSize: '13px', padding: '8px 16px', background: 'linear-gradient(135deg, #0e7490, #63B2C6)' }}
                      >
                        <Plus size={15} /> إرسال رسالة الآن
                      </button>
                      <button
                        onClick={handleSendTestMessage}
                        className="btn"
                        style={{ fontSize: '13px', padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', color: '#0e7490' }}
                      >
                        <Sparkles size={15} /> تجربة إرسال تعميم فوري
                      </button>
                    </div>
                  </div>
                ) : (
                  displayedMessages.map(msg => {
                    const hasRead = msg.readBy && Array.isArray(msg.readBy) && msg.readBy.some(id => myIdentities.has(String(id).trim().toLowerCase()));
                    const isUnread = activeTab === 'inbox' && !hasRead;
                    const isSelected = selectedMessage?.id === msg.id;
                    const senderRoleBadge = ROLE_BADGES[msg.senderRole] || ROLE_BADGES.student;

                    // Read status check for Sent Tab
                    const isDirectReadByRecipient = msg.messageType === 'individual' && msg.readBy && (
                      msg.readBy.includes(msg.receiverNationalId) || 
                      msg.readBy.includes(msg.receiverId) ||
                      (msg.readers && msg.readers.some(r => String(r.nationalId || r.userId).toLowerCase() === String(msg.receiverNationalId || msg.receiverId).toLowerCase()))
                    );

                    const readersCount = (msg.readers?.length) || (msg.readBy?.length ? Math.max(0, msg.readBy.length - 1) : 0);

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #0e7490' : isUnread ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                          background: isSelected ? '#f0fdf4' : isUnread ? '#f0f9ff' : 'white',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: isUnread ? '0 3px 8px rgba(2, 132, 199, 0.12)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {/* Top Line: Sender, Date, Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 'bold',
                              background: senderRoleBadge.bg,
                              color: senderRoleBadge.color,
                              border: `1px solid ${senderRoleBadge.border}`,
                              padding: '2px 8px',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {senderRoleBadge.icon} {msg.senderRoleTitle || senderRoleBadge.label}
                            </span>
                            
                            <span style={{ fontWeight: isUnread ? '800' : '600', color: '#0f172a', fontSize: '14px' }}>
                              {activeTab === 'sent' ? `إلى: ${msg.messageType === 'individual' ? msg.receiverName : 'تعميم جماعي'}` : `من: ${msg.senderName}`}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {msg.priority === 'urgent' && (
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '6px' }}>
                                🔴 عاجل
                              </span>
                            )}
                            {msg.priority === 'important' && (
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '6px' }}>
                                🟡 هام
                              </span>
                            )}

                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {new Date(msg.createdAt || msg.timestamp || 0).toLocaleDateString('ar-SA')}
                            </span>
                          </div>
                        </div>

                        {/* Subject & Body Snippet */}
                        <div>
                          <div style={{
                            fontWeight: isUnread ? '800' : '700',
                            fontSize: '14px',
                            color: '#0e7490',
                            marginBottom: '3px'
                          }}>
                            {msg.subject}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {msg.body}
                          </div>
                        </div>

                        {/* Footer details: Read Receipts & Group label / Attachment */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dashed #f1f5f9', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {msg.messageType === 'group' ? (
                              <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                                📢 {msg.targetGroup === 'class' ? `فصل: ${msg.targetClassName}` : TARGET_GROUPS.find(g => g.id === msg.targetGroup)?.label || 'تعميم'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#475569' }}>
                                👤 رسالة خاصة
                              </span>
                            )}

                            {/* Read Status for Sent tab */}
                            {activeTab === 'sent' && (
                              msg.messageType === 'individual' ? (
                                isDirectReadByRecipient ? (
                                  <span style={{ fontSize: '11px', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckCheck size={13} color="#0284c7" /> تم الاطلاع
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Check size={13} color="#94a3b8" /> بانتظار الاطلاع
                                  </span>
                                )
                              ) : (
                                <span style={{ fontSize: '11px', color: '#0f766e', background: '#ccfbf1', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Eye size={12} /> اطّلع عليه: {readersCount}
                                </span>
                              )
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {msg.attachment && (
                              <span style={{ fontSize: '11px', color: '#0e7490', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}>
                                <Paperclip size={12} /> {msg.attachment.type === 'pdf' ? 'ملف PDF' : 'صورة مرفقة'}
                              </span>
                            )}
                            {isUnread && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: COMPOSE NEW MESSAGE / BROADCAST                                    */}
          {/* ========================================================================= */}
          {activeTab === 'compose' && (
            <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Type Switcher: Individual vs Group */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                  نوع المراسلة:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setMessageType('individual')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: messageType === 'individual' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: messageType === 'individual' ? '#0e7490' : 'white',
                      color: messageType === 'individual' ? 'white' : '#334155',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <User size={16} /> مراسلة فردية لشخص محدد (معلم / طالب / إدارة / كادر)
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessageType('group')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: messageType === 'group' ? '2px solid #0e7490' : '1px solid #cbd5e1',
                      background: messageType === 'group' ? '#0e7490' : 'white',
                      color: messageType === 'group' ? 'white' : '#334155',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Users size={16} /> تعميم جماعي / لفئة محددة
                  </button>
                </div>
              </div>

              {/* Recipient Selection (Individual Mode) with Quick Search */}
              {messageType === 'individual' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                      اختر المستلم (متاح مراسلة أي منسوب بالمدرسة):
                    </label>
                  </div>

                  {/* Search in Dropdown Filter */}
                  <div style={{ marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="🔍 اكتب اسم الشخص أو رقم الهوية لتصفية القائمة..."
                      value={recipientSearch}
                      onChange={e => setRecipientSearch(e.target.value)}
                      style={{ fontSize: '12px', padding: '8px 12px', marginBottom: 0 }}
                    />
                  </div>

                  <select
                    className="input-field"
                    value={recipientNid}
                    onChange={e => setRecipientNid(e.target.value)}
                    required
                    style={{ fontSize: '13px' }}
                  >
                    <option value="">-- اضغط لاختيار الشخص المستهدف --</option>
                    
                    {filteredRecipients.admins.length > 0 && (
                      <optgroup label="👑 إدارة المدرسة والوكلاء">
                        {filteredRecipients.admins.map(a => (
                          <option key={a.id} value={a.nationalId || a.id}>
                            👑 {a.name || 'مدير المدرسة'} (إدارة المدرسة) {a.nationalId ? `- هوية: ${a.nationalId}` : ''}
                          </option>
                        ))}
                        {filteredRecipients.staff.map(s => (
                          <option key={s.id} value={s.nationalId || s.id}>
                            👔 {s.name} ({s.roleTitle || 'عضو كادر'}) - هوية: {s.nationalId}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {filteredRecipients.teachers.length > 0 && (
                      <optgroup label="👨‍🏫 المعلمون والمعلمات">
                        {filteredRecipients.teachers.map(t => (
                          <option key={t.id} value={t.nationalId || t.id}>
                            👨‍🏫 {t.name} ({t.subject || 'معلم'}) - هوية: {t.nationalId}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {filteredRecipients.supervisors.length > 0 && (
                      <optgroup label="🌟 المشرفون التربويون">
                        {filteredRecipients.supervisors.map(sup => (
                          <option key={sup.id} value={sup.nationalId || sup.id}>
                            🌟 {sup.name} ({sup.specialty || 'مشرف تربوي'}) {sup.nationalId ? `- هوية: ${sup.nationalId}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {filteredRecipients.students.length > 0 && (
                      <optgroup label="🎓 الطلاب والطالبات">
                        {filteredRecipients.students.map(st => (
                          <option key={st.id} value={st.nationalId || st.id}>
                            🎓 {st.name} ({st.class || st.className || 'طالب'}) - هوية: {st.nationalId}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* Target Group Selection (Group Mode) */}
              {messageType === 'group' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                    الفئة المستهدفة بالتعميم:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    {TARGET_GROUPS.map(g => (
                      <div
                        key={g.id}
                        onClick={() => setTargetGroup(g.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: targetGroup === g.id ? '2px solid #0e7490' : '1px solid #cbd5e1',
                          background: targetGroup === g.id ? '#f0fdf4' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: targetGroup === g.id ? '#0e7490' : '#334155' }}>
                          {g.label}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {g.desc}
                        </span>
                      </div>
                    ))}
                  </div>

                  {targetGroup === 'class' && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                        اختر الفصل الدراسي المستهدف:
                      </label>
                      <select
                        className="input-field"
                        value={targetClassName}
                        onChange={e => setTargetClassName(e.target.value)}
                        required
                      >
                        {classesList.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Subject & Priority */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                    موضوع الرسالة / التعميم:
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="مثال: استفسار عن درس، موعد تسليم الواجب، تعميم الاختبارات..."
                    required
                  />
                </div>

                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                    درجة الأهمية:
                  </label>
                  <select
                    className="input-field"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    <option value="normal">🔵 عادي</option>
                    <option value="important">🟡 هام</option>
                    <option value="urgent">🔴 عاجل جداً</option>
                  </select>
                </div>
              </div>

              {/* Body Text */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>
                  نص الرسالة / التعميم:
                </label>
                <textarea
                  className="input-field"
                  rows={6}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="اكتب تفاصيل ومحتوى الرسالة هنا..."
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>

              {/* File Attachment: Image or PDF */}
              <div style={{
                padding: '14px',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '10px',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={16} color="#0e7490" /> إرفاق صورة أو مستند PDF (اختياري):
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>الحد الأقصى: 3MB</span>
                </div>

                {!attachment ? (
                  <div>
                    <input
                      type="file"
                      id="msg-attachment-input"
                      accept="image/*,.pdf,application/pdf"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="msg-attachment-input"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: '#0e7490'
                      }}
                    >
                      <Plus size={16} /> اختر صورة أو ملف PDF
                    </label>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'white',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {attachment.type === 'image' ? (
                        <img src={attachment.dataUrl} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                      ) : (
                        <FileText size={32} color="#dc2626" />
                      )}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{attachment.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {attachment.type === 'pdf' ? 'مستند PDF' : 'صورة'} • {(attachment.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      title="إزالة المرفق"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('inbox'); setReplyingTo(null); }}
                  className="btn btn-secondary"
                  disabled={isSending}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSending}
                  style={{
                    background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    fontWeight: 'bold'
                  }}
                >
                  <Send size={18} /> {isSending ? 'جاري الإرسال...' : 'إرسال الرسالة / اعتماد التعميم'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Right Column: Message Detail Viewer (when a message is selected) */}
        {selectedMessage && (
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
            
            {/* Close detail viewer */}
            <button
              onClick={() => setSelectedMessage(null)}
              style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} color="#64748b" />
            </button>

            {/* Header / Letterhead formatting */}
            <div style={{ borderBottom: '2px solid #0e7490', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    background: ROLE_BADGES[selectedMessage.senderRole]?.bg || '#f1f5f9',
                    color: ROLE_BADGES[selectedMessage.senderRole]?.color || '#0f172a',
                    border: `1px solid ${ROLE_BADGES[selectedMessage.senderRole]?.border || '#cbd5e1'}`,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    display: 'inline-block',
                    marginBottom: '4px'
                  }}>
                    {ROLE_BADGES[selectedMessage.senderRole]?.icon} {selectedMessage.senderRoleTitle || 'مرسل'}
                  </span>
                  <h3 style={{ margin: '0 0 2px 0', color: '#0f172a', fontSize: '18px' }}>
                    {selectedMessage.subject}
                  </h3>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    <strong>المرسل:</strong> {selectedMessage.senderName} • <strong>التاريخ:</strong> {new Date(selectedMessage.createdAt || selectedMessage.timestamp || 0).toLocaleString('ar-SA')}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {selectedMessage.priority === 'urgent' && (
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '8px' }}>
                      🔴 عاجل جداً
                    </span>
                  )}
                  {selectedMessage.priority === 'important' && (
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '8px' }}>
                      🟡 هام
                    </span>
                  )}
                </div>
              </div>

              {/* Target / Recipient details */}
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px' }}>
                {selectedMessage.messageType === 'individual' ? (
                  <span><strong>المستلم الموجه له:</strong> {selectedMessage.receiverName} ({selectedMessage.receiverRoleTitle || 'مستلم'})</span>
                ) : (
                  <span><strong>الفئة المستهدفة:</strong> 📢 {selectedMessage.targetGroup === 'class' ? `طلاب فصل: ${selectedMessage.targetClassName}` : TARGET_GROUPS.find(g => g.id === selectedMessage.targetGroup)?.label || 'تعميم عام'}</span>
                )}
              </div>
            </div>

            {/* Message Body Content */}
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#1e293b',
              whiteSpace: 'pre-wrap',
              minHeight: '120px'
            }}>
              {selectedMessage.body}
            </div>

            {/* Attachment Viewer / Download */}
            {selectedMessage.attachment && (
              <div style={{
                padding: '14px',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                background: 'white'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0e7490', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={16} /> الملف المرفق مع الرسالة:
                </div>

                {selectedMessage.attachment.type === 'image' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                    <img
                      src={selectedMessage.attachment.dataUrl}
                      alt={selectedMessage.attachment.name}
                      onClick={() => setPreviewAttachment(selectedMessage.attachment)}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '260px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer'
                      }}
                      title="اضغط للتكبير"
                    />
                    <a
                      href={selectedMessage.attachment.dataUrl}
                      download={selectedMessage.attachment.name}
                      className="btn"
                      style={{
                        background: '#f1f5f9',
                        color: '#0e7490',
                        fontSize: '12px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        fontWeight: 'bold'
                      }}
                    >
                      <Download size={14} /> تحميل الصورة ({selectedMessage.attachment.name})
                    </a>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={28} color="#dc2626" />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{selectedMessage.attachment.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>مستند PDF رسمي</div>
                      </div>
                    </div>

                    <a
                      href={selectedMessage.attachment.dataUrl}
                      download={selectedMessage.attachment.name}
                      className="btn"
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        fontSize: '12px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        fontWeight: 'bold'
                      }}
                    >
                      <Download size={14} /> تحميل ملف الـ PDF
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 📊 READ AUDIT & RECEIPTS SECTION (حالة الاطلاع والقراءة لجميع المستهدفين)  */}
            {/* ========================================================================= */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              border: '1.5px solid #0e7490',
              background: '#f0fdfa',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={20} color="#0e7490" />
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f766e' }}>
                    حالة الاطلاع والقراءة لجميع المستهدفين:
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0e7490' }}>
                    نسبة القراءة: {auditData.readPercentage}% ({auditData.readList.length} من {auditData.targetAudience.length || auditData.readList.length})
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: '#ccfbf1', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${auditData.readPercentage}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0e7490, #10b981)',
                  transition: 'width 0.4s ease-in-out'
                }} />
              </div>

              {/* Toggle Tabs: Read vs Pending */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setAuditTab('read')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: auditTab === 'read' ? '#0f766e' : 'white',
                    color: auditTab === 'read' ? 'white' : '#0f766e',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <CheckCircle2 size={14} /> تم الاطلاع ({auditData.readList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setAuditTab('pending')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: auditTab === 'pending' ? '#d97706' : 'white',
                    color: auditTab === 'pending' ? 'white' : '#d97706',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <Clock size={14} /> بانتظار الاطلاع ({auditData.pendingList.length})
                </button>
              </div>

              {/* Readers List Table / Badges */}
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '8px' }}>
                {auditTab === 'read' ? (
                  auditData.readList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '12px' }}>
                      لم يقم أي شخص بالاطلاع على الرسالة بعد
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {auditData.readList.map((reader, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCheck size={14} color="#10b981" />
                            <strong>{reader.name}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>({reader.roleTitle || reader.role})</span>
                          </div>

                          <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: '600' }}>
                            {reader.readAt ? new Date(reader.readAt).toLocaleString('ar-SA') : 'تم الاطلاع'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  auditData.pendingList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>
                      ✓ رائع! تم الاطلاع على الرسالة من قِبل جميع المستهدفين (100%)
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {auditData.pendingList.map((member, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          fontSize: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} color="#d97706" />
                            <strong>{member.name}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>({member.roleTitle || member.role})</span>
                          </div>

                          <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                            لم يُفتح بعد
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Quick Actions at bottom */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleStartReply(selectedMessage)}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}
                >
                  <Reply size={15} /> رد على الرسالة
                </button>

                <button
                  onClick={() => window.print()}
                  className="btn"
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} /> طباعة الرسالة وكشف الاطلاع
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedMessage.archived ? (
                  <button
                    onClick={() => handleRestoreMessage(selectedMessage.id)}
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#d97706',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    <Undo2 size={15} /> استعادة من الأرشيف
                  </button>
                ) : (
                  <button
                    onClick={() => handleArchiveMessage(selectedMessage.id)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#64748b',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    <Archive size={15} /> نقل إلى الأرشيف
                  </button>
                )}

                {(myIdentities.has(String(selectedMessage.senderNationalId || '').toLowerCase()) || myRole === 'admin' || userRole === 'superadmin') && (
                  <button
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    <Trash2 size={15} /> حذف نهائي
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Lightbox Preview Modal for Image Attachments */}
      {previewAttachment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          padding: '20px'
        }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setPreviewAttachment(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <X size={28} />
            </button>
            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.name}
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
