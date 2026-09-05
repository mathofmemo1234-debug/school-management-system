import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, setDoc, 
  deleteDoc, arrayUnion, query, where, getDocs 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Mail, Send, Inbox, Paperclip, FileText, Image as ImageIcon, Download,
  Eye, Trash2, Reply, Check, CheckCheck, AlertCircle, AlertTriangle,
  Users, User, Search, Filter, Printer, X, Plus, Clock, Tag, ArrowRight,
  ShieldCheck, UserCheck, BookOpen, Sparkles, RefreshCw, CheckCircle2,
  BarChart2, Archive, Undo2, EyeOff, Building2, Landmark, CheckSquare,
  MessageSquare, PhoneCall, ChevronDown, ChevronRight, Award, Zap,
  BellRing, Share2, ShieldAlert, CheckCircle
} from 'lucide-react';
import { broadcastRealtimeEvent, subscribeRealtimeEvents } from '../utils/realtimeBroadcast';
import { ADVANCED_SCHOOLS_CATALOG } from '../data/resourceData';

// Official Circular Categories
const DECREE_CATEGORIES = [
  { id: 'mandatory_decision', label: '⚡ قرار إداري ملزم وفوري', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { id: 'ministerial_circular', label: '🏛️ تعميم وزاري / توجيه رئاسي', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { id: 'curriculum_directive', label: '📚 توجيه مناهج واعتماد أكاديمي', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'urgent_inquiry', label: '🚨 طلب إفادة واستبانة عاجلة', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'staff_transfer', label: '🔄 توجيهات الموارد والنقل والكوادر', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'general_notice', label: '📢 إشعار إداري عام للمجمعات', color: '#475569', bg: '#f8fafc', border: '#cbd5e1' }
];

// Target Scope Options
const TARGET_SCOPES = [
  { id: 'ALL', label: '🌐 كافة الفروع والمجمعات (جميع الـ 45+ مدرسة)', desc: 'يصل لجميع مدراء المدارس في كافة المدن والمسارات' },
  { id: 'diploma', label: '🇺🇸 مدارس ومسارات الدبلومة الأمريكية فقط', desc: 'يصل لمدراء المسار الدولي والـ American Diploma' },
  { id: 'national', label: '🇸🇦 مدارس المسار الأهلي المطور فقط', desc: 'يصل لمدراء المدارس الأهلية الوطنية المطورة' },
  { id: 'boys', label: '👦 مجمعات البنين فقط (كافة المدن)', desc: 'يصل لمدراء فروع ومدارس البنين' },
  { id: 'girls', label: '👧 مجمعات البنات فقط (كافة المدن)', desc: 'يصل لمديرات فروع ومدارس البنات' },
  { id: 'city', label: '📍 مجمعات مدينة محددة (جدة، الرياض، ...)', desc: 'توجيه تعميم لفرع منطقة أو مدينة جغرافية بعينها' },
  { id: 'specific', label: '🏫 مجمع أو مدرسة محددة بعينها', desc: 'إرسال قرار خاص لمدير مجمع بعينه' }
];

export default function MasterMessagingHub() {
  const { userData, currentUser } = useAuth();
  const { t } = useLanguage();

  // Primary Tabs
  // 'decrees' (إصدار ومتابعة القرارات والتعاميم)
  // 'compliance' (لوحة الرقابة ونسب الإقرار والاستلام)
  // 'hotline' (الخط الساخن 1-on-1 مع مدراء المدارس)
  // 'incoming' (صندوق الردود والتقارير المرفوعة من المدراء)
  // 'archive' (الأرشيف الرئاسي)
  const [activeTab, setActiveTab] = useState('decrees');

  // Messages & Directives State
  const [allMessages, setAllMessages] = useState([]);
  const [selectedDecree, setSelectedDecree] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [dbRepairStatus, setDbRepairStatus] = useState(null);

  // Form State: Decree Issuer
  const [decreeNumber, setDecreeNumber] = useState(() => `ق-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
  const [decreeCategory, setDecreeCategory] = useState('mandatory_decision');
  const [targetScope, setTargetScope] = useState('ALL');
  const [selectedCity, setSelectedCity] = useState('جدة');
  const [selectedSchoolCode, setSelectedSchoolCode] = useState('msc_jed_smart_boys_national');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('urgent');
  const [requiresAck, setRequiresAck] = useState(true);
  const [ackDeadline, setAckDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [attachment, setAttachment] = useState(null);

  // Hotline: 1-on-1 Principal Chat State
  const [hotlineSearch, setHotlineSearch] = useState('');
  const [hotlineTrackFilter, setHotlineTrackFilter] = useState('all'); // 'all' | 'diploma' | 'national'
  const [selectedPrincipal, setSelectedPrincipal] = useState(null);
  const [hotlineChatInput, setHotlineChatInput] = useState('');
  const [hotlineAttachment, setHotlineAttachment] = useState(null);
  const [sendingHotline, setSendingHotline] = useState(false);
  const hotlineEndRef = useRef(null);

  // Search in decrees feed
  const [decreeSearch, setDecreeSearch] = useState('');

  // 1. Build List of Principals from ADVANCED_SCHOOLS_CATALOG
  const principalsDirectory = useMemo(() => {
    return ADVANCED_SCHOOLS_CATALOG.map(school => {
      // Determine Track category
      const isDiploma = school.trackCategory === 'diploma' || school.track?.toLowerCase().includes('دبلوم') || school.track?.toLowerCase().includes('دولي') || school.track?.toLowerCase().includes('عالمي');
      const trackCat = isDiploma ? 'diploma' : 'national';
      const isBoys = school.gender === 'boys' || school.name.includes('بنين');
      
      // Designated principal details
      let pName = `مدير ${school.name}`;
      let pNid = `admin_${school.code}`;
      let pEmail = `admin_${school.code}@school.local`;

      // Specific known principals for Jeddah
      if (school.code === 'msc_jed_smart_boys_national') {
        pName = 'أ. محمد بن خالد الغامدي (مدير المسار الأهلي)';
        pNid = '1098765431';
        pEmail = 'admin_jed_national_boys@school.local';
      } else if (school.code === 'msc_jed_smart_boys_diploma') {
        pName = 'د. طارق بن عبد العزيز السالم (مدير الدبلومة الأمريكية)';
        pNid = '1098765432';
        pEmail = 'admin_jed_diploma_boys@school.local';
      } else if (school.code === 'msc_jed_smart_girls_national') {
        pName = 'أ. نورة بنت عبد الله الشهري (مديرة المسار الأهلي)';
        pNid = '1098765433';
        pEmail = 'admin_jed_national_girls@school.local';
      } else if (school.code === 'msc_jed_smart_girls_diploma') {
        pName = 'د. ريم بنت إبراهيم المنصور (مديرة الدبلومة الأمريكية)';
        pNid = '1098765434';
        pEmail = 'admin_jed_diploma_girls@school.local';
      }

      return {
        id: school.code,
        schoolCode: school.code,
        legacyCode: school.legacyCode || null,
        schoolName: school.name,
        schoolSubTitle: school.subTitle,
        city: school.city,
        track: school.track,
        trackCategory: trackCat,
        gender: school.gender || (isBoys ? 'boys' : 'girls'),
        principalName: pName,
        principalNid: pNid,
        principalEmail: pEmail,
        principalTitle: `مدير مدرسة • ${school.name}`
      };
    });
  }, []);

  // Unique Cities List
  const citiesList = useMemo(() => {
    return Array.from(new Set(ADVANCED_SCHOOLS_CATALOG.map(s => s.city))).filter(Boolean);
  }, []);

  // 2. Realtime listener for all messages
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'school_messages'), snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      msgs.sort((a, b) => {
        const timeA = new Date(b.createdAt || b.timestamp || 0).getTime();
        const timeB = new Date(a.createdAt || a.timestamp || 0).getTime();
        return timeA - timeB;
      });
      setAllMessages(msgs);

      if (selectedDecree) {
        const updated = msgs.find(m => m.id === selectedDecree.id);
        if (updated) setSelectedDecree(updated);
      }
    }, err => {
      console.error("Firestore onSnapshot error in MasterMessagingHub:", err);
    });

    const unsubBroadcast = subscribeRealtimeEvents((event) => {
      if (event?.type === 'MESSAGE_UPDATE' && event.payload?.message) {
        setAllMessages(prev => {
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
  }, [selectedDecree?.id]);

  // Scroll hotline chat to bottom when updated
  useEffect(() => {
    if (activeTab === 'hotline' && selectedPrincipal) {
      setTimeout(() => {
        hotlineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [allMessages, selectedPrincipal, activeTab]);

  // Master Issued Decrees & Circulars (Non-archived)
  const masterDecrees = useMemo(() => {
    return allMessages.filter(m => {
      if (m.archived) return false;
      return m.senderRole === 'superadmin' || m.isDirective || (m.senderName && m.senderName.includes('الماستر'));
    });
  }, [allMessages]);

  // Incoming Replies & Reports from Principals to Master
  const incomingReplies = useMemo(() => {
    return allMessages.filter(m => {
      if (m.archived) return false;
      const isAddressedToMaster = m.receiverRole === 'superadmin' || 
                                  m.receiverNationalId === 'super@admin.com' || 
                                  (m.receiverName && m.receiverName.includes('الماستر')) ||
                                  Boolean(m.replyToDecreeNumber) ||
                                  (m.senderRole === 'admin' && m.messageType === 'individual' && m.targetSchoolId === 'ALL');
      const isFromPrincipal = m.senderRole === 'admin';
      return isAddressedToMaster && isFromPrincipal;
    });
  }, [allMessages]);

  // Archived Decrees
  const archivedDecrees = useMemo(() => {
    return allMessages.filter(m => m.archived && (m.senderRole === 'superadmin' || m.isDirective));
  }, [allMessages]);

  // Target Schools for a given Decree
  const getTargetSchoolsForDecree = (decree) => {
    if (!decree) return [];
    const scope = decree.targetScope || 'ALL';

    if (scope === 'ALL') return principalsDirectory;
    if (scope === 'diploma') return principalsDirectory.filter(p => p.trackCategory === 'diploma');
    if (scope === 'national') return principalsDirectory.filter(p => p.trackCategory === 'national');
    if (scope === 'boys') return principalsDirectory.filter(p => p.gender === 'boys');
    if (scope === 'girls') return principalsDirectory.filter(p => p.gender === 'girls');
    if (scope === 'city') return principalsDirectory.filter(p => p.city === decree.targetCity);
    if (scope === 'specific') {
      return principalsDirectory.filter(p => 
        p.schoolCode === decree.targetSchoolId || 
        p.id === decree.targetSchoolId || 
        p.legacyCode === decree.targetSchoolId
      );
    }
    return principalsDirectory;
  };

  // 3. Send Official Decree / Circular from Master
  const handleIssueDecree = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      alert('يرجى ملء عنوان ونص القرار الرئاسي.');
      return;
    }

    setIsSending(true);
    try {
      // Determine target schools
      let targetName = 'كافة الفروع والمجمعات (45+ مدرسة)';
      let targetSchoolId = 'ALL';
      let targetCity = null;

      if (targetScope === 'diploma') targetName = 'مدارس ومسارات الدبلومة الأمريكية والمسار الدولي';
      if (targetScope === 'national') targetName = 'مدارس المسار الأهلي المطور';
      if (targetScope === 'boys') targetName = 'مجمعات وفروع البنين';
      if (targetScope === 'girls') targetName = 'مجمعات وفروع البنات';
      if (targetScope === 'city') {
        targetCity = selectedCity;
        targetName = `مجمعات وفروع مدينة ${selectedCity}`;
      }
      if (targetScope === 'specific') {
        const found = principalsDirectory.find(p => p.schoolCode === selectedSchoolCode);
        targetSchoolId = selectedSchoolCode;
        targetName = found ? found.schoolName : selectedSchoolCode;
      }

      const payload = {
        decreeNumber: decreeNumber.trim(),
        decreeCategory,
        targetScope,
        targetCity,
        targetSchoolId,
        targetSchoolName: targetName,
        schoolId: targetSchoolId,
        senderId: currentUser?.uid || 'superadmin',
        senderNationalId: 'super@admin.com',
        senderName: 'الإدارة العامة (الماستر العام)',
        senderRole: 'superadmin',
        senderRoleTitle: 'الرئاسة العامة والإشراف المركزي المباشر',
        messageType: 'group',
        targetGroup: 'admins',
        subject: subject.trim(),
        body: body.trim(),
        priority,
        isDirective: true,
        requiresAcknowledgment: requiresAck,
        acknowledgmentDeadline: requiresAck ? ackDeadline : null,
        acknowledgments: [], // Array of { schoolId, schoolName, principalName, nationalId, acknowledgedAt }
        attachment: attachment || null,
        readBy: ['super@admin.com'],
        readers: [{
          userId: currentUser?.uid || 'superadmin',
          nationalId: 'super@admin.com',
          name: 'الماستر العام',
          role: 'superadmin',
          readAt: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      const docRef = await addDoc(collection(db, 'school_messages'), payload);
      broadcastRealtimeEvent('MESSAGE_UPDATE', { message: { id: docRef.id, ...payload } });

      // Reset form
      setSubject('');
      setBody('');
      setAttachment(null);
      setDecreeNumber(`ق-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
      alert(`✓ تم إصدار وتعميم القرار الرئاسي [${payload.decreeNumber}] بنجاح، ووصل فورياً لكافة مدراء المدارس المستهدفة!`);
      setActiveTab('compliance');
      setSelectedDecree({ id: docRef.id, ...payload });
    } catch (err) {
      console.error('Error issuing decree:', err);
      alert('حدث خطأ أثناء إصدار القرار: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // 4. Hotline 1-on-1 Messages
  const hotlineMessages = useMemo(() => {
    if (!selectedPrincipal) return [];
    const pNid = String(selectedPrincipal.principalNid || '').toLowerCase();
    const pId = String(selectedPrincipal.schoolCode || '').toLowerCase();
    const pLegacy = String(selectedPrincipal.legacyCode || '').toLowerCase();

    return allMessages.filter(m => {
      if (m.archived) return false;
      const sNid = String(m.senderNationalId || '').toLowerCase();
      const rNid = String(m.receiverNationalId || '').toLowerCase();
      const sRole = m.senderRole;
      const rRole = m.receiverRole;
      const sSch = String(m.schoolId || '').toLowerCase();
      const tSch = String(m.targetSchoolId || '').toLowerCase();

      // Sent by Master to this principal
      const masterToPrincipal = (sRole === 'superadmin') && (
        rNid === pNid || 
        tSch === pId || 
        (pLegacy && tSch === pLegacy) ||
        (m.receiverId && m.receiverId === `admin_${pId}`)
      );

      // Sent by this principal to Master
      const principalToMaster = (sRole === 'admin') && (
        rRole === 'superadmin' || 
        rNid === 'super@admin.com' ||
        sNid === pNid || 
        sSch === pId || 
        (pLegacy && sSch === pLegacy)
      );

      return masterToPrincipal || principalToMaster;
    }).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  }, [allMessages, selectedPrincipal]);

  // Send message in 1-on-1 Hotline
  const handleSendHotlineMessage = async (e) => {
    e?.preventDefault();
    if (!hotlineChatInput.trim() && !hotlineAttachment) return;
    if (!selectedPrincipal) return;

    setSendingHotline(true);
    try {
      const payload = {
        messageType: 'individual',
        senderId: currentUser?.uid || 'superadmin',
        senderNationalId: 'super@admin.com',
        senderName: 'الإدارة العامة (الماستر العام)',
        senderRole: 'superadmin',
        senderRoleTitle: 'الرئاسة العامة والإشراف المركزي',
        receiverId: `admin_${selectedPrincipal.schoolCode}`,
        receiverNationalId: selectedPrincipal.principalNid,
        receiverName: selectedPrincipal.principalName,
        receiverRole: 'admin',
        receiverRoleTitle: selectedPrincipal.principalTitle,
        targetSchoolId: selectedPrincipal.schoolCode,
        targetSchoolName: selectedPrincipal.schoolName,
        schoolId: selectedPrincipal.schoolCode,
        subject: `توجيه خاص ومباشر: ${selectedPrincipal.schoolName}`,
        body: hotlineChatInput.trim(),
        priority: 'urgent',
        attachment: hotlineAttachment || null,
        isHotline: true,
        readBy: ['super@admin.com'],
        readers: [{
          userId: currentUser?.uid || 'superadmin',
          nationalId: 'super@admin.com',
          name: 'الماستر العام',
          role: 'superadmin',
          readAt: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      const docRef = await addDoc(collection(db, 'school_messages'), payload);
      broadcastRealtimeEvent('MESSAGE_UPDATE', { message: { id: docRef.id, ...payload } });

      setHotlineChatInput('');
      setHotlineAttachment(null);
    } catch (err) {
      console.error('Error sending hotline message:', err);
      alert('خطأ في إرسال الرسالة: ' + err.message);
    } finally {
      setSendingHotline(false);
    }
  };

  // Send Instant Reminder Alert to Pending Principals for a Decree
  const handleSendReminderToPending = async (decree) => {
    if (!decree) return;
    const targetSchools = getTargetSchoolsForDecree(decree);
    const ackedNids = new Set((decree.acknowledgments || []).map(a => String(a.nationalId || a.schoolId).toLowerCase()));
    const pendingSchools = targetSchools.filter(s => !ackedNids.has(s.principalNid.toLowerCase()) && !ackedNids.has(s.schoolCode.toLowerCase()));

    if (pendingSchools.length === 0) {
      alert('جميع المدارس المستهدفة قامت بتوثيق الاستلام رسمياً بالفعل! لا توجد مدارس متأخرة.');
      return;
    }

    const conf = window.confirm(`هل أنت متأكد من إرسال إشعار تذكيري عاجل لـ (${pendingSchools.length}) مدرسة متأخرة عن توثيق الاستلام؟`);
    if (!conf) return;

    try {
      const reminderPayload = {
        decreeNumber: `تنبيه-${decree.decreeNumber}`,
        decreeCategory: 'urgent_inquiry',
        targetScope: decree.targetScope,
        targetSchoolId: decree.targetSchoolId,
        targetSchoolName: decree.targetSchoolName,
        schoolId: decree.schoolId,
        senderId: currentUser?.uid || 'superadmin',
        senderNationalId: 'super@admin.com',
        senderName: 'الإدارة العامة (الماستر العام)',
        senderRole: 'superadmin',
        senderRoleTitle: 'متابعة الالتزام وتوثيق القرارات',
        messageType: 'group',
        targetGroup: 'admins',
        subject: `🚨 تذكير رئاسي عاجل: يلزم توثيق استلام القرار [${decree.decreeNumber}]`,
        body: `تود الإدارة العامة التأكيد على مدراء المدارس المستهدفة بضرورة الدخول وتوثيق الاستلام رسمياً للقرار:\n"${decree.subject}"\nالموعد النهائي لتوثيق الإقرار: ${decree.acknowledgmentDeadline || 'فوراً'}.\nيرجى فتح القرار والضغط على زر (✅ توثيق وتأكيد الاستلام والاطلاع رسمياً).`,
        priority: 'urgent',
        isDirective: true,
        referenceDecreeId: decree.id,
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      const docRef = await addDoc(collection(db, 'school_messages'), reminderPayload);
      broadcastRealtimeEvent('MESSAGE_UPDATE', { message: { id: docRef.id, ...reminderPayload } });

      alert(`✓ تم إرسال التنبيه الرئاسي العاجل بنجاح لكافة المدارس الـ (${pendingSchools.length}) المتأخرة!`);
    } catch (err) {
      console.error('Error sending reminder:', err);
      alert('خطأ في إرسال التذكير: ' + err.message);
    }
  };

  // 5. Database Repair & Sync Function (Self-healing Firestore synchronizer)
  const handleRepairDatabase = async () => {
    setDbRepairStatus('running');
    try {
      // A. Write/Update 4 distinct Jeddah schools to Firestore 'schools' collection
      const jeddahSchools = [
        {
          id: 'msc_jed_smart_boys_national',
          code: 'msc_jed_smart_boys_national',
          legacyCode: 'msc_jed_smart_boys',
          name: 'مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (المسار الأهلي)',
          subTitle: 'فرع حي الزهراء - المسار الأهلي المطور',
          city: 'جدة',
          track: 'أهلي متقدم',
          trackCategory: 'national',
          gender: 'boys',
          address: 'حي الزهراء، جدة',
          principalName: 'أ. محمد بن خالد الغامدي',
          principalTitle: 'مدير مجمع التعلم الذكي للبنين - المسار الأهلي',
          phone: '0126543210'
        },
        {
          id: 'msc_jed_smart_boys_diploma',
          code: 'msc_jed_smart_boys_diploma',
          name: 'مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (الدبلومة الأمريكية)',
          subTitle: 'فرع حي الزهراء - مسار الدبلومة الأمريكية والمسار الدولي',
          city: 'جدة',
          track: 'مسار دولي / دبلومة أمريكية',
          trackCategory: 'diploma',
          gender: 'boys',
          address: 'حي الزهراء، جدة',
          principalName: 'د. طارق بن عبد العزيز السالم',
          principalTitle: 'مدير مجمع التعلم الذكي للبنين - مسار الدبلومة الأمريكية',
          phone: '0126543211'
        },
        {
          id: 'msc_jed_smart_girls_national',
          code: 'msc_jed_smart_girls_national',
          legacyCode: 'msc_jed_smart_girls',
          name: 'مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (المسار الأهلي)',
          subTitle: 'فرع حي الزهراء - المسار الأهلي المطور',
          city: 'جدة',
          track: 'أهلي متقدم',
          trackCategory: 'national',
          gender: 'girls',
          address: 'حي الزهراء، جدة',
          principalName: 'أ. نورة بنت عبد الله الشهري',
          principalTitle: 'مديرة مجمع التعلم الذكي للبنات - المسار الأهلي',
          phone: '0126543212'
        },
        {
          id: 'msc_jed_smart_girls_diploma',
          code: 'msc_jed_smart_girls_diploma',
          name: 'مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (الدبلومة الأمريكية)',
          subTitle: 'فرع حي الزهراء - مسار الدبلومة الأمريكية والمسار الدولي',
          city: 'جدة',
          track: 'مسار دولي / دبلومة أمريكية',
          trackCategory: 'diploma',
          gender: 'girls',
          address: 'حي الزهراء، جدة',
          principalName: 'د. ريم بنت إبراهيم المنصور',
          principalTitle: 'مديرة مجمع التعلم الذكي للبنات - مسار الدبلومة الأمريكية',
          phone: '0126543213'
        }
      ];

      for (const s of jeddahSchools) {
        await setDoc(doc(db, 'schools', s.id), s, { merge: true });
      }

      // B. Write/Update 4 distinct Principal accounts in Firestore 'users' collection
      const principalsUsers = [
        {
          id: 'user_admin_jed_national_boys',
          nationalId: '1098765431',
          email: 'admin_jed_national_boys@school.local',
          name: 'أ. محمد بن خالد الغامدي',
          role: 'admin',
          roleTitle: 'مدير مجمع التعلم الذكي للبنين (المسار الأهلي)',
          schoolId: 'msc_jed_smart_boys_national',
          schoolName: 'مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (المسار الأهلي)',
          trackCategory: 'national',
          gender: 'boys'
        },
        {
          id: 'user_admin_jed_diploma_boys',
          nationalId: '1098765432',
          email: 'admin_jed_diploma_boys@school.local',
          name: 'د. طارق بن عبد العزيز السالم',
          role: 'admin',
          roleTitle: 'مدير مجمع التعلم الذكي للبنين (الدبلومة الأمريكية)',
          schoolId: 'msc_jed_smart_boys_diploma',
          schoolName: 'مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (الدبلومة الأمريكية)',
          trackCategory: 'diploma',
          gender: 'boys'
        },
        {
          id: 'user_admin_jed_national_girls',
          nationalId: '1098765433',
          email: 'admin_jed_national_girls@school.local',
          name: 'أ. نورة بنت عبد الله الشهري',
          role: 'admin',
          roleTitle: 'مديرة مجمع التعلم الذكي للبنات (المسار الأهلي)',
          schoolId: 'msc_jed_smart_girls_national',
          schoolName: 'مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (المسار الأهلي)',
          trackCategory: 'national',
          gender: 'girls'
        },
        {
          id: 'user_admin_jed_diploma_girls',
          nationalId: '1098765434',
          email: 'admin_jed_diploma_girls@school.local',
          name: 'د. ريم بنت إبراهيم المنصور',
          role: 'admin',
          roleTitle: 'مديرة مجمع التعلم الذكي للبنات (الدبلومة الأمريكية)',
          schoolId: 'msc_jed_smart_girls_diploma',
          schoolName: 'مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (الدبلومة الأمريكية)',
          trackCategory: 'diploma',
          gender: 'girls'
        }
      ];

      for (const u of principalsUsers) {
        await setDoc(doc(db, 'users', u.id), u, { merge: true });
      }

      // C. Ensure SuperAdmin user record exists in 'users'
      await setDoc(doc(db, 'users', 'master_general_admin'), {
        nationalId: 'super@admin.com',
        email: 'super@admin.com',
        name: 'الإدارة العامة (الماستر العام)',
        role: 'superadmin',
        roleTitle: 'الإدارة العامة والمتابعة المركزية لكافة الفروع',
        schoolId: 'ALL',
        schoolName: 'الإدارة العامة لشركة المدارس المتقدمة'
      }, { merge: true });

      // D. Seed Initial Directives if none exist
      const qCheck = await getDocs(query(collection(db, 'school_messages'), where('isDirective', '==', true)));
      if (qCheck.empty) {
        await addDoc(collection(db, 'school_messages'), {
          decreeNumber: 'ق-2026/0411',
          decreeCategory: 'mandatory_decision',
          targetScope: 'ALL',
          targetSchoolId: 'ALL',
          targetSchoolName: 'كافة الفروع والمجمعات (جميع الـ 45+ مدرسة)',
          schoolId: 'ALL',
          senderId: currentUser?.uid || 'superadmin',
          senderNationalId: 'super@admin.com',
          senderName: 'الإدارة العامة (الماستر العام)',
          senderRole: 'superadmin',
          senderRoleTitle: 'الرئاسة العامة والإشراف المركزي',
          messageType: 'group',
          targetGroup: 'admins',
          subject: 'قرار إداري ملزم: تنظيم ومتابعة اختبارات الفصل الدراسي وتوثيق الإقرار رسمياً',
          body: 'السلام عليكم ورحمة الله وبركاته،\n\nتؤكد الإدارة العامة على كافة السادة مدراء ومديرات المدارس والمجمعات المعتمدة (بنين وبنات - مسار أهلي ودولي) ضرورة استكمال خطط الجداول والاختبارات وتوثيق الاستلام فورياً.\n\nمع التحية،\nالرئاسة العامة لشركة المدارس المتقدمة',
          priority: 'urgent',
          isDirective: true,
          requiresAcknowledgment: true,
          acknowledgmentDeadline: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          acknowledgments: [],
          readBy: ['super@admin.com'],
          createdAt: new Date().toISOString(),
          timestamp: Date.now()
        });
      }

      setDbRepairStatus('success');
      setTimeout(() => setDbRepairStatus(null), 5000);
      alert('✓ تم بنجاح فحص وإصلاح قاعدة البيانات:\n1. فصل مجمع التعلم الذكي بجدة إلى 4 مدارس مستقلة (بنين أهلي، بنين دبلومة، بنات أهلي، بنات دبلومة).\n2. تسجيل حسابات المدراء الرسمية المستقلة لكل مسار في Firestore.\n3. مزامنة بيانات الماستر والتعاميم الرئاسية.');
    } catch (err) {
      console.error('Error repairing DB:', err);
      setDbRepairStatus('error');
      alert('حدث خطأ أثناء إصلاح قاعدة البيانات: ' + err.message);
    }
  };

  // Filtered Hotline Principals
  const filteredHotlinePrincipals = useMemo(() => {
    return principalsDirectory.filter(p => {
      if (hotlineTrackFilter === 'diploma' && p.trackCategory !== 'diploma') return false;
      if (hotlineTrackFilter === 'national' && p.trackCategory !== 'national') return false;
      if (hotlineSearch.trim()) {
        const q = hotlineSearch.toLowerCase();
        return p.schoolName.toLowerCase().includes(q) || 
               p.principalName.toLowerCase().includes(q) || 
               p.city.toLowerCase().includes(q) ||
               p.schoolCode.toLowerCase().includes(q);
      }
      return true;
    });
  }, [principalsDirectory, hotlineTrackFilter, hotlineSearch]);

  // File Upload Helper
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الملف يجب ألا يتجاوز 5 ميجابايت.');
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      alert('يرجى إرفاق صورة (JPG/PNG) أو مستند PDF فقط.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({
        name: file.name,
        type: isImage ? 'image' : 'pdf',
        size: file.size,
        dataUrl: ev.target.result
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '24px', direction: 'rtl', fontFamily: 'Tajawal, sans-serif', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ─── 1. EXECUTIVE HEADER ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%)',
        borderRadius: '20px',
        padding: '24px 30px',
        color: '#ffffff',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            padding: '14px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.15)'
          }}>
            <Landmark size={36} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#dc2626',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.5px'
              }}>
                SUPER MASTER CONTROL
              </span>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                بث لحظي 100%
              </span>
            </div>
            <h1 style={{ margin: '6px 0 2px 0', fontSize: '24px', fontWeight: 900 }}>
              منظومة المراسلات والقرارات الرئاسية المركزية (الماستر العام)
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              إصدار التعاميم والقرارات الملزمة • لوحة الرقابة ونسب توثيق الاستلام • الخط الساخن المباشر مع كافة مدراء المدارس الـ (45+ مجمع)
            </p>
          </div>
        </div>

        {/* Database Auto-Fix Button */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRepairDatabase}
            disabled={dbRepairStatus === 'running'}
            style={{
              background: dbRepairStatus === 'success' ? '#16a34a' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              padding: '10px 16px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)'
            }}
          >
            <RefreshCw size={16} className={dbRepairStatus === 'running' ? 'animate-spin' : ''} />
            <span>{dbRepairStatus === 'running' ? 'جارٍ فحص قاعدة البيانات...' : '🔧 فحص وإصلاح قاعدة البيانات والمدراء'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. NAVIGATION TABS ─── */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: '#ffffff',
        padding: '8px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        overflowX: 'auto'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('decrees')}
          style={{
            flex: 1,
            minWidth: '170px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'decrees' ? 'linear-gradient(135deg, #0f172a, #1e293b)' : 'transparent',
            color: activeTab === 'decrees' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Send size={18} color={activeTab === 'decrees' ? '#38bdf8' : '#64748b'} />
          <span>إصدار قرار / تعميم رئاسي</span>
          <span style={{
            background: activeTab === 'decrees' ? 'rgba(56, 189, 248, 0.2)' : '#f1f5f9',
            color: activeTab === 'decrees' ? '#38bdf8' : '#475569',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {masterDecrees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compliance')}
          style={{
            flex: 1,
            minWidth: '170px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'compliance' ? 'linear-gradient(135deg, #0f766e, #0d9488)' : 'transparent',
            color: activeTab === 'compliance' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <BarChart2 size={18} color={activeTab === 'compliance' ? '#a7f3d0' : '#64748b'} />
          <span>لوحة الرقابة ونسب الإقرار</span>
          <span style={{
            background: activeTab === 'compliance' ? 'rgba(167, 243, 208, 0.2)' : '#f1f5f9',
            color: activeTab === 'compliance' ? '#a7f3d0' : '#475569',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            مصفوفة الالتزام
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hotline')}
          style={{
            flex: 1,
            minWidth: '170px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'hotline' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
            color: activeTab === 'hotline' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <PhoneCall size={18} color={activeTab === 'hotline' ? '#93c5fd' : '#64748b'} />
          <span>الخط الساخن مع المدراء</span>
          <span style={{
            background: activeTab === 'hotline' ? 'rgba(147, 197, 253, 0.2)' : '#f1f5f9',
            color: activeTab === 'hotline' ? '#93c5fd' : '#475569',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {principalsDirectory.length} مدير
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incoming')}
          style={{
            flex: 1,
            minWidth: '170px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'incoming' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
            color: activeTab === 'incoming' ? '#ffffff' : '#64748b',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Inbox size={18} color={activeTab === 'incoming' ? '#ddd6fe' : '#64748b'} />
          <span>الردود والتقارير المرفوعة</span>
          <span style={{
            background: activeTab === 'incoming' ? 'rgba(221, 214, 254, 0.2)' : '#f1f5f9',
            color: activeTab === 'incoming' ? '#ddd6fe' : '#475569',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {incomingReplies.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          style={{
            padding: '12px 20px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'archive' ? '#475569' : 'transparent',
            color: activeTab === 'archive' ? '#ffffff' : '#64748b',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Archive size={16} />
          <span>الأرشيف</span>
          {archivedDecrees.length > 0 && (
            <span style={{ background: '#cbd5e1', color: '#0f172a', fontSize: '10px', padding: '1px 6px', borderRadius: '8px' }}>
              {archivedDecrees.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── TAB 1: ISSUE DECREE / CIRCULAR ─── */}
      {activeTab === 'decrees' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
          {/* Form Area */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '28px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                  🏛️ تحرير وإصدار قرار رئاسي / تعميم إداري جديد
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  سيتم بث القرار فورياً إلى البريد الوارد لمدراء المدارس مع توثيق الختم الرئاسي
                </p>
              </div>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Award size={16} color="#0284c7" />
                <span>رقم القيد: {decreeNumber}</span>
              </div>
            </div>

            <form onSubmit={handleIssueDecree}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Decree Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                    تصنيف وطبيعة القرار
                  </label>
                  <select
                    value={decreeCategory}
                    onChange={(e) => setDecreeCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: '#f8fafc',
                      color: '#0f172a'
                    }}
                  >
                    {DECREE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* Urgency Priority */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                    درجة الأهمية والأولوية
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPriority('urgent')}
                      style={{
                        flex: 1,
                        padding: '9px 10px',
                        borderRadius: '8px',
                        border: priority === 'urgent' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                        background: priority === 'urgent' ? '#fef2f2' : '#ffffff',
                        color: priority === 'urgent' ? '#dc2626' : '#64748b',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      🚨 عاجل جداً وملزم
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('important')}
                      style={{
                        flex: 1,
                        padding: '9px 10px',
                        borderRadius: '8px',
                        border: priority === 'important' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: priority === 'important' ? '#f0f9ff' : '#ffffff',
                        color: priority === 'important' ? '#0284c7' : '#64748b',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ هام
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('normal')}
                      style={{
                        flex: 1,
                        padding: '9px 10px',
                        borderRadius: '8px',
                        border: priority === 'normal' ? '2px solid #64748b' : '1px solid #cbd5e1',
                        background: priority === 'normal' ? '#f8fafc' : '#ffffff',
                        color: priority === 'normal' ? '#0f172a' : '#64748b',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      عادي
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Scope Selection */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '18px'
              }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}>
                  🎯 النطاق المستهدف بالقرار (المسار / المدينة / المجمع)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  {TARGET_SCOPES.map(scope => (
                    <div
                      key={scope.id}
                      onClick={() => setTargetScope(scope.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: targetScope === scope.id ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: targetScope === scope.id ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 800, color: targetScope === scope.id ? '#0369a1' : '#1e293b' }}>
                        {scope.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {scope.desc}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scope: City Dropdown */}
                {targetScope === 'city' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      اختر المدينة المستهدفة:
                    </label>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      {citiesList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scope: Specific School Dropdown (Separated Tracks in Jeddah & Everywhere) */}
                {targetScope === 'specific' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      اختر المجمع / الفرع والمسار التعليمي المحدد:
                    </label>
                    <select
                      value={selectedSchoolCode}
                      onChange={(e) => setSelectedSchoolCode(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                    >
                      <optgroup label="🌟 مجمعات جدة (فصل المسار الأهلي عن الدبلومة الأمريكية)">
                        {principalsDirectory.filter(p => p.city === 'جدة').map(p => (
                          <option key={p.schoolCode} value={p.schoolCode}>
                            {p.schoolName} • {p.track} ({p.principalName})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="📍 باقي المجمعات والفروع المعتمدة">
                        {principalsDirectory.filter(p => p.city !== 'جدة').map(p => (
                          <option key={p.schoolCode} value={p.schoolCode}>
                            [{p.city}] {p.schoolName} ({p.principalName})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                  موضوع القرار / التعميم الرئاسي *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قرار إداري ملزم بشأن موعد رفع تقارير التحصيل الدراسي واعتماد الخطط..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Body */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                  نص القرار والتوجيهات التنفيذية *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="اكتب التوجيهات الرسمية الصادرة من الإدارة العامة بدقة ووضوح..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Mandatory Acknowledgment & Deadline */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '18px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#92400e' }}>
                  <input
                    type="checkbox"
                    checked={requiresAck}
                    onChange={(e) => setRequiresAck(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>إلزام مدراء المدارس بتوثيق الاستلام والإقرار رسمياً (Sign & Acknowledge)</span>
                </label>

                {requiresAck && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#78350f' }}>الموعد النهائي للإقرار:</span>
                    <input
                      type="date"
                      value={ackDeadline}
                      onChange={(e) => setAckDeadline(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d97706', fontSize: '12px', fontWeight: 700 }}
                    />
                  </div>
                )}
              </div>

              {/* Attachment */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                    المرفقات الرسمية (خطاب القرار PDF أو صورة معتمدة)
                  </label>
                  {attachment && (
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}
                    >
                      إلغاء المرفق
                    </button>
                  )}
                </div>
                {attachment ? (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    fontSize: '12px',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FileText size={16} />
                    <span>تم إرفاق: <strong>{attachment.name}</strong> ({(attachment.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    style={{ fontSize: '12px', color: '#64748b' }}
                  />
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSending}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  fontSize: '15px',
                  fontWeight: 900,
                  cursor: isSending ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 15px rgba(15, 23, 42, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <Send size={18} />
                <span>{isSending ? 'جارٍ بث وتعميم القرار...' : 'إصدار وتعميم القرار الرئاسي الآن'}</span>
              </button>
            </form>
          </div>

          {/* Side: Recently Issued Decrees */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
            maxHeight: '720px',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
              📜 آخر القرارات والتعاميم الصادرة
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {masterDecrees.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '13px' }}>
                  لا توجد قرارات مصدرة بعد.
                </div>
              ) : (
                masterDecrees.slice(0, 10).map(decree => {
                  const targetSchools = getTargetSchoolsForDecree(decree);
                  const acks = decree.acknowledgments || [];
                  const pct = targetSchools.length > 0 ? Math.round((acks.length / targetSchools.length) * 100) : 0;

                  return (
                    <div
                      key={decree.id}
                      onClick={() => {
                        setSelectedDecree(decree);
                        setActiveTab('compliance');
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>
                          {decree.decreeNumber || 'قرار رئاسي'}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {new Date(decree.createdAt || 0).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', lineHeight: '1.4' }}>
                        {decree.subject}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#475569' }}>
                        <span>المستهدف: {decree.targetSchoolName || 'كافة المدارس'}</span>
                        <span style={{
                          background: pct === 100 ? '#dcfce7' : pct > 50 ? '#fef3c7' : '#fee2e2',
                          color: pct === 100 ? '#166534' : pct > 50 ? '#92400e' : '#b91c1c',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          fontWeight: 800
                        }}>
                          {pct}% إقرار ({acks.length}/{targetSchools.length})
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: AUDIT & COMPLIANCE MATRIX ─── */}
      {activeTab === 'compliance' && (
        <div>
          {/* Top Selector: Choose Decree to Audit */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '18px 24px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                اختر القرار / التعميم المراد متابعة إقرار المدارس له:
              </label>
              <select
                value={selectedDecree ? selectedDecree.id : (masterDecrees[0]?.id || '')}
                onChange={(e) => {
                  const found = masterDecrees.find(m => m.id === e.target.value);
                  if (found) setSelectedDecree(found);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#0f172a',
                  background: '#f8fafc'
                }}
              >
                {masterDecrees.map(d => (
                  <option key={d.id} value={d.id}>
                    [{d.decreeNumber || 'قرار'}] {d.subject} ({new Date(d.createdAt || 0).toLocaleDateString('ar-SA')})
                  </option>
                ))}
              </select>
            </div>

            {selectedDecree && (
              <button
                type="button"
                onClick={() => handleSendReminderToPending(selectedDecree)}
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '11px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
                }}
              >
                <BellRing size={16} />
                <span>إرسال تنبيه عاجل للمدارس المتأخرة</span>
              </button>
            )}
          </div>

          {/* Live Compliance Stats Card */}
          {selectedDecree ? (() => {
            const targetSchools = getTargetSchoolsForDecree(selectedDecree);
            const acks = selectedDecree.acknowledgments || [];
            const ackNids = new Set(acks.map(a => String(a.nationalId || a.schoolId).toLowerCase()));
            const ackCount = acks.length;
            const totalCount = targetSchools.length;
            const pendingCount = Math.max(0, totalCount - ackCount);
            const pct = totalCount > 0 ? Math.round((ackCount / totalCount) * 100) : 0;

            return (
              <div>
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '24px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '24px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                          {selectedDecree.decreeNumber || 'قرار إداري'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          النطاق: <strong>{selectedDecree.targetSchoolName || 'كافة المدارس'}</strong>
                        </span>
                      </div>
                      <h2 style={{ margin: '6px 0 0 0', fontSize: '19px', fontWeight: 900, color: '#0f172a' }}>
                        {selectedDecree.subject}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', textAlign: 'center' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '10px 18px' }}>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: '#166534' }}>{ackCount}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d' }}>تم توثيق الاستلام</div>
                      </div>
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '10px 18px' }}>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626' }}>{pendingCount}</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c' }}>قيد الانتظار</div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 18px' }}>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: '#0284c7' }}>{pct}%</div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1' }}>نسبة الالتزام</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: pct === 100 ? '#16a34a' : 'linear-gradient(90deg, #0284c7, #10b981)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Audit Grid of Targeted Schools */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                      📋 بيان المدارس المستهدفة وحالة توثيق الإقرار لكل مدير
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      إجمالي المدارس المستهدفة: {targetSchools.length} مجمع
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>#</th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>المجمع / الفرع التعليمي</th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>المسار والاعتماد</th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>المدينة</th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>مدير المجمع</th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>حالة توثيق الاستلام</th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#334155' }}>توقيت الإقرار الرسمي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetSchools.map((school, idx) => {
                          const ack = acks.find(a => 
                            String(a.nationalId).toLowerCase() === school.principalNid.toLowerCase() ||
                            String(a.schoolId).toLowerCase() === school.schoolCode.toLowerCase() ||
                            (school.legacyCode && String(a.schoolId).toLowerCase() === school.legacyCode.toLowerCase())
                          );
                          const isAcked = Boolean(ack);

                          return (
                            <tr key={school.schoolCode} style={{ borderBottom: '1px solid #f1f5f9', background: isAcked ? '#fcfdfd' : '#fff9f9' }}>
                              <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                              <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0f172a' }}>
                                <div>{school.schoolName}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>كود: {school.schoolCode}</div>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{
                                  background: school.trackCategory === 'diploma' ? '#f5f3ff' : '#eff6ff',
                                  color: school.trackCategory === 'diploma' ? '#6d28d9' : '#1d4ed8',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  fontSize: '11px'
                                }}>
                                  {school.track}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#475569' }}>{school.city}</td>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b' }}>
                                {school.principalName}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {isAcked ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '12px'
                                  }}>
                                    <CheckCheck size={16} />
                                    <span>تم توثيق الاستلام رسمياً</span>
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '12px'
                                  }}>
                                    <Clock size={16} />
                                    <span>قيد الانتظار (لم يؤكد)</span>
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>
                                {ack ? new Date(ack.acknowledgedAt || 0).toLocaleString('ar-SA') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
              يرجى اختيار قرار من القائمة أعلاه لمتابعة لوحة إقراره.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: HOTLINE 1-ON-1 PRINCIPALS CHAT ─── */}
      {activeTab === 'hotline' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', height: '720px' }}>
          {/* Principals Directory */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                📞 دليل مدراء المدارس والمجمعات
              </h3>
              <input
                type="text"
                placeholder="بحث بالاسم، المدينة، أو المجمع..."
                value={hotlineSearch}
                onChange={(e) => setHotlineSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                  marginBottom: '8px'
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setHotlineTrackFilter('all')}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: hotlineTrackFilter === 'all' ? '#0f172a' : '#f1f5f9',
                    color: hotlineTrackFilter === 'all' ? '#fff' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  الكل ({principalsDirectory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHotlineTrackFilter('diploma')}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: hotlineTrackFilter === 'diploma' ? '#6d28d9' : '#f1f5f9',
                    color: hotlineTrackFilter === 'diploma' ? '#fff' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  دبلومة أمريكية
                </button>
                <button
                  type="button"
                  onClick={() => setHotlineTrackFilter('national')}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: hotlineTrackFilter === 'national' ? '#1d4ed8' : '#f1f5f9',
                    color: hotlineTrackFilter === 'national' ? '#fff' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  مسار أهلي
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {filteredHotlinePrincipals.map(p => {
                const isSelected = selectedPrincipal?.schoolCode === p.schoolCode;
                return (
                  <div
                    key={p.schoolCode}
                    onClick={() => setSelectedPrincipal(p)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #f1f5f9',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        {p.principalName}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: p.trackCategory === 'diploma' ? '#f5f3ff' : '#eff6ff',
                        color: p.trackCategory === 'diploma' ? '#6d28d9' : '#1d4ed8',
                        fontWeight: 700
                      }}>
                        {p.trackCategory === 'diploma' ? 'دبلومة' : 'أهلي'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.3' }}>
                      {p.schoolName}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      📍 {p.city} • كود: {p.schoolCode}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat / Direct Thread Panel */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {selectedPrincipal ? (
              <>
                {/* Thread Header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                      {selectedPrincipal.principalName}
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      {selectedPrincipal.schoolName} • المسار: <strong>{selectedPrincipal.track}</strong>
                    </p>
                  </div>
                  <span style={{
                    background: '#dcfce7',
                    color: '#166534',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                    خط مباشر نشط
                  </span>
                </div>

                {/* Messages Stream */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {hotlineMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8', fontSize: '13px' }}>
                      لا توجد رسائل سابقة في هذا الخط المباشر. يمكنك كتابة توجيه أو استفسار فوري للمدير أدناه.
                    </div>
                  ) : (
                    hotlineMessages.map(msg => {
                      const isMaster = msg.senderRole === 'superadmin';
                      return (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: isMaster ? 'flex-start' : 'flex-end',
                            maxWidth: '75%',
                            background: isMaster ? '#0f172a' : '#f1f5f9',
                            color: isMaster ? '#ffffff' : '#0f172a',
                            borderRadius: '16px',
                            padding: '12px 16px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: isMaster ? '#38bdf8' : '#2563eb' }}>
                              {isMaster ? 'الماستر العام' : msg.senderName}
                            </span>
                            <span style={{ fontSize: '10px', color: isMaster ? '#94a3b8' : '#64748b' }}>
                              {new Date(msg.createdAt || 0).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {msg.body}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={hotlineEndRef} />
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendHotlineMessage} style={{ padding: '14px', borderTop: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="اكتب رسالة أو توجيهاً مباشراً للمدير..."
                    value={hotlineChatInput}
                    onChange={(e) => setHotlineChatInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sendingHotline || !hotlineChatInput.trim()}
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 20px',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: sendingHotline ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Send size={16} />
                    <span>إرسال</span>
                  </button>
                </form>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '14px' }}>
                👈 اختر مديراً من القائمة لبدء المحادثة المباشرة الفورية معه.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: INCOMING PRINCIPAL REPLIES & REPORTS ─── */}
      {activeTab === 'incoming' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
            📥 صندوق الردود والتقارير الرسمية المرفوعة من مدراء المدارس
          </h2>

          {incomingReplies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', fontSize: '14px' }}>
              لا توجد ردود جديدة مرفوعة من مدراء المدارس حالياً.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {incomingReplies.map(reply => (
                <div
                  key={reply.id}
                  style={{
                    padding: '18px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#7c3aed', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                        رد من مدير مدرسة
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                        {reply.senderName} ({reply.senderRoleTitle || 'مدير مدرسة'})
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(reply.createdAt || 0).toLocaleString('ar-SA')}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
                    الموضوع: {reply.subject}
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    {reply.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: PRESIDENTIAL ARCHIVE ─── */}
      {activeTab === 'archive' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
            🗄️ الأرشيف الرئاسي للقرارات والتعاميم المؤرشفة
          </h2>
          {archivedDecrees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
              الأرشيف فارغ حالياً.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {archivedDecrees.map(d => (
                <div key={d.id} style={{ padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>[{d.decreeNumber}] {d.subject}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{d.body?.slice(0, 150)}...</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
