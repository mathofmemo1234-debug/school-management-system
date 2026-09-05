// ==============================================================================
// سكريبت تصحيح وتهيئة قاعدة بيانات منظومة المراسلات والمدارس (MSC Schools)
// الموقع: يوضع في المجلد الرئيسي للمشروع ويُشغل بواسطة Node.js
// الأمر: node fix_database_messaging.js
// ==============================================================================

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  initializeFirestore, doc, setDoc, addDoc, collection, getDocs, 
  query, where, terminate 
} from "firebase/firestore";

// إعدادات الاتصال المباشر بقاعدة بيانات المدارس المتقدمة
const firebaseConfig = {
  apiKey: "AIzaSyA-BaaAqrzeFzHiZpmNEwAeEB6Igd6QWKc",
  authDomain: "advanced-smart-learning-3dfbf.firebaseapp.com",
  databaseURL: "https://advanced-smart-learning-3dfbf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "advanced-smart-learning-3dfbf",
  storageBucket: "advanced-smart-learning-3dfbf.firebasestorage.app",
  messagingSenderId: "210401728875",
  appId: "1:210401728875:web:e7bf2d6626ac6d4d85542e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

console.log("=================================================================");
console.log("🚀 بدء فحص وتصحيح قاعدة البيانات لشركة المدارس المتقدمة...");
console.log("=================================================================\n");

async function fixDatabase() {
  try {
    console.log("🔍 فحص إمكانية القراءة من Firestore (Read Test)...");
    try {
      const snap = await getDocs(collection(db, "school_messages"));
      console.log(`   ✓ نجحت القراءة من school_messages! عدد الوثائق الحالية: ${snap.size}`);
    } catch (readErr) {
      console.error("   ❌ فشلت القراءة من Firestore:", readErr.message);
    }
    // --------------------------------------------------------------------------
    // 1. فصل وتوثيق مدارس مجمع التعلم الذكي بجدة (4 مجمعات مستقلة تماماً)
    // --------------------------------------------------------------------------
    console.log("1️⃣ [الخطوة الأولى]: توثيق وفصل مجمعات جدة (المسار الأهلي vs الدبلومة الأمريكية)...");

    const jeddahSchools = [
      {
        id: "msc_jed_smart_boys_national",
        code: "msc_jed_smart_boys_national",
        legacyCode: "msc_jed_smart_boys",
        name: "مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (المسار الأهلي)",
        subTitle: "فرع حي الزهراء - المسار الأهلي المطور",
        city: "جدة",
        track: "أهلي متقدم",
        trackCategory: "national",
        gender: "boys",
        address: "حي الزهراء، جدة",
        principalName: "أ. محمد بن خالد الغامدي",
        principalTitle: "مدير مجمع التعلم الذكي للبنين - المسار الأهلي",
        phone: "0126543210",
        updatedAt: new Date().toISOString()
      },
      {
        id: "msc_jed_smart_boys_diploma",
        code: "msc_jed_smart_boys_diploma",
        name: "مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (الدبلومة الأمريكية)",
        subTitle: "فرع حي الزهراء - مسار الدبلومة الأمريكية والمسار الدولي",
        city: "جدة",
        track: "مسار دولي / دبلومة أمريكية",
        trackCategory: "diploma",
        gender: "boys",
        address: "حي الزهراء، جدة",
        principalName: "د. طارق بن عبد العزيز السالم",
        principalTitle: "مدير مجمع التعلم الذكي للبنين - مسار الدبلومة الأمريكية",
        phone: "0126543211",
        updatedAt: new Date().toISOString()
      },
      {
        id: "msc_jed_smart_girls_national",
        code: "msc_jed_smart_girls_national",
        legacyCode: "msc_jed_smart_girls",
        name: "مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (المسار الأهلي)",
        subTitle: "فرع حي الزهراء - المسار الأهلي المطور",
        city: "جدة",
        track: "أهلي متقدم",
        trackCategory: "national",
        gender: "girls",
        address: "حي الزهراء، جدة",
        principalName: "أ. نورة بنت عبد الله الشهري",
        principalTitle: "مديرة مجمع التعلم الذكي للبنات - المسار الأهلي",
        phone: "0126543212",
        updatedAt: new Date().toISOString()
      },
      {
        id: "msc_jed_smart_girls_diploma",
        code: "msc_jed_smart_girls_diploma",
        name: "مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (الدبلومة الأمريكية)",
        subTitle: "فرع حي الزهراء - مسار الدبلومة الأمريكية والمسار الدولي",
        city: "جدة",
        track: "مسار دولي / دبلومة أمريكية",
        trackCategory: "diploma",
        gender: "girls",
        address: "حي الزهراء، جدة",
        principalName: "د. ريم بنت إبراهيم المنصور",
        principalTitle: "مديرة مجمع التعلم الذكي للبنات - مسار الدبلومة الأمريكية",
        phone: "0126543213",
        updatedAt: new Date().toISOString()
      }
    ];

    for (const school of jeddahSchools) {
      await setDoc(doc(db, "schools", school.id), school, { merge: true });
      console.log(`   ✓ تم تثبيت مدرسة: [${school.code}] ${school.name}`);
    }

    // --------------------------------------------------------------------------
    // 2. إنشاء وتحديث حسابات المدراء المستقلة لكل مسار في مجموعة 'users'
    // --------------------------------------------------------------------------
    console.log("\n2️⃣ [الخطوة الثانية]: تثبيت حسابات مدراء المسار الأهلي والدبلومة الأمريكية...");

    const principals = [
      {
        id: "user_admin_jed_national_boys",
        nationalId: "1098765431",
        email: "admin_jed_national_boys@school.local",
        name: "أ. محمد بن خالد الغامدي",
        role: "admin",
        roleTitle: "مدير مجمع التعلم الذكي للبنين (المسار الأهلي)",
        schoolId: "msc_jed_smart_boys_national",
        schoolName: "مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (المسار الأهلي)",
        trackCategory: "national",
        gender: "boys",
        status: "active",
        updatedAt: new Date().toISOString()
      },
      {
        id: "user_admin_jed_diploma_boys",
        nationalId: "1098765432",
        email: "admin_jed_diploma_boys@school.local",
        name: "د. طارق بن عبد العزيز السالم",
        role: "admin",
        roleTitle: "مدير مجمع التعلم الذكي للبنين (الدبلومة الأمريكية)",
        schoolId: "msc_jed_smart_boys_diploma",
        schoolName: "مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة (الدبلومة الأمريكية)",
        trackCategory: "diploma",
        gender: "boys",
        status: "active",
        updatedAt: new Date().toISOString()
      },
      {
        id: "user_admin_jed_national_girls",
        nationalId: "1098765433",
        email: "admin_jed_national_girls@school.local",
        name: "أ. نورة بنت عبد الله الشهري",
        role: "admin",
        roleTitle: "مديرة مجمع التعلم الذكي للبنات (المسار الأهلي)",
        schoolId: "msc_jed_smart_girls_national",
        schoolName: "مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (المسار الأهلي)",
        trackCategory: "national",
        gender: "girls",
        status: "active",
        updatedAt: new Date().toISOString()
      },
      {
        id: "user_admin_jed_diploma_girls",
        nationalId: "1098765434",
        email: "admin_jed_diploma_girls@school.local",
        name: "د. ريم بنت إبراهيم المنصور",
        role: "admin",
        roleTitle: "مديرة مجمع التعلم الذكي للبنات (الدبلومة الأمريكية)",
        schoolId: "msc_jed_smart_girls_diploma",
        schoolName: "مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة (الدبلومة الأمريكية)",
        trackCategory: "diploma",
        gender: "girls",
        status: "active",
        updatedAt: new Date().toISOString()
      },
      {
        // حساب الماستر العام (Super Admin)
        id: "master_general_admin",
        nationalId: "super@admin.com",
        email: "super@admin.com",
        name: "الإدارة العامة (الماستر العام)",
        role: "superadmin",
        roleTitle: "الرئاسة العامة والإشراف المركزي المباشر",
        schoolId: "ALL",
        schoolName: "الإدارة العامة لشركة المدارس المتقدمة",
        status: "active",
        updatedAt: new Date().toISOString()
      }
    ];

    for (const p of principals) {
      await setDoc(doc(db, "users", p.id), p, { merge: true });
      console.log(`   ✓ تم تثبيت حساب المدير: [${p.nationalId}] ${p.name} -> ${p.roleTitle}`);
    }

    // --------------------------------------------------------------------------
    // 3. زرع قرارات وتوجيهات وزارية ورئاسية معيارية في 'school_messages'
    // --------------------------------------------------------------------------
    console.log("\n3️⃣ [الخطوة الثالثة]: تهيئة التعاميم والقرارات الرئاسية المستهدفة...");

    const sampleDirectives = [
      {
        decreeNumber: "ق-2026/0411",
        decreeCategory: "mandatory_decision",
        targetScope: "ALL",
        targetSchoolId: "ALL",
        targetSchoolName: "كافة الفروع والمجمعات (جميع الـ 45+ مدرسة)",
        schoolId: "ALL",
        senderId: "superadmin",
        senderNationalId: "super@admin.com",
        senderName: "الإدارة العامة (الماستر العام)",
        senderRole: "superadmin",
        senderRoleTitle: "الرئاسة العامة والإشراف المركزي المباشر",
        messageType: "group",
        targetGroup: "admins",
        subject: "قرار إداري ملزم: تنظيم ومتابعة خطط الاختبارات وجداول الحصص للفصل الدراسي",
        body: "السلام عليكم ورحمة الله وبركاته،\n\nتؤكد الإدارة العامة على كافة السادة مدراء ومديرات المدارس والمجمعات المعتمدة (بنين وبنات - مسار أهلي ودولي) ضرورة استكمال رفع خطط التحصيل والجداول المعتمدة.\nيرجى التكرم بالاطلاع وتوثيق الاستلام رسمياً عبر المنظومة.\n\nمع التحية،\nالرئاسة العامة لشركة المدارس المتقدمة",
        priority: "urgent",
        isDirective: true,
        requiresAcknowledgment: true,
        acknowledgmentDeadline: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        acknowledgments: [],
        readBy: ["super@admin.com"],
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      },
      {
        decreeNumber: "د-2026/0104",
        decreeCategory: "curriculum_directive",
        targetScope: "diploma",
        targetSchoolId: "ALL",
        targetSchoolName: "مدارس ومسارات الدبلومة الأمريكية والمسار الدولي",
        schoolId: "ALL",
        senderId: "superadmin",
        senderNationalId: "super@admin.com",
        senderName: "الإدارة العامة (الماستر العام)",
        senderRole: "superadmin",
        senderRoleTitle: "الرئاسة العامة والإشراف المركزي المباشر",
        messageType: "group",
        targetGroup: "admins",
        subject: "تعميم خاص بمسار الدبلومة الأمريكية: استيفاء معايير الاعتماد الأكاديمي الدولي (Cognia)",
        body: "سعادة مدراء ومديرات مسار الدبلومة الأمريكية والمسار الدولي المحترمين،\n\nالسلام عليكم ورحمة الله وبركاته،\nبناءً على خطة الجودة والاعتماد الأكاديمي الدولي لمدارس الدبلومة الأمريكية (Cognia)، يرجى سرعة مراجعة ملفات الأدلة والشواهد لجميع الفصول الدراسية وتوثيق الإقرار رسمياً.\n\nشاكرين حرصكم واهتمامكم،\nإدارة المسار الدولي والاعتماد الأكاديمي",
        priority: "important",
        isDirective: true,
        requiresAcknowledgment: true,
        acknowledgmentDeadline: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
        acknowledgments: [],
        readBy: ["super@admin.com"],
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      },
      {
        decreeNumber: "أ-2026/0205",
        decreeCategory: "ministerial_circular",
        targetScope: "national",
        targetSchoolId: "ALL",
        targetSchoolName: "مدارس المسار الأهلي المطور",
        schoolId: "ALL",
        senderId: "superadmin",
        senderNationalId: "super@admin.com",
        senderName: "الإدارة العامة (الماستر العام)",
        senderRole: "superadmin",
        senderRoleTitle: "الرئاسة العامة والإشراف المركزي المباشر",
        messageType: "group",
        targetGroup: "admins",
        subject: "تعميم خاص بالمسار الأهلي المطور: خطة تعزيز نواتج التعلم والاختبارات المعيارية (نافس)",
        body: "سعادة مدراء ومديرات مدارس المسار الأهلي المطور المحترمين،\n\nالسلام عليكم ورحمة الله وبركاته،\nتؤكد الإدارة العامة على تنفيذ الحصص الإثرائية وتطبيق نماذج الاختبارات المعيارية (نافس) وفق الخطة الوزارية المعتمدة وتوثيق الاستلام رسمياً.\n\nمع التحية والتقدير،\nالإدارة العامة للتعليم الأهلي",
        priority: "important",
        isDirective: true,
        requiresAcknowledgment: true,
        acknowledgmentDeadline: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
        acknowledgments: [],
        readBy: ["super@admin.com"],
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      }
    ];

    for (const d of sampleDirectives) {
      const q = query(
        collection(db, "school_messages"), 
        where("decreeNumber", "==", d.decreeNumber)
      );
      const existing = await getDocs(q);
      if (existing.empty) {
        await addDoc(collection(db, "school_messages"), d);
        console.log(`   ✓ تم إصدار القرار: [${d.decreeNumber}] -> ${d.subject}`);
      } else {
        console.log(`   ℹ القرار [${d.decreeNumber}] موجود مسبقاً في قاعدة البيانات.`);
      }
    }

    console.log("\n=================================================================");
    console.log("🎉 اكتمل فحص وتصحيح قاعدة البيانات بنجاح 100%!");
    console.log("=================================================================");
    console.log("الملخص النهائي:");
    console.log("1. تم فصل مدارس جدة إلى (4) كيانات رسمية مستقلة لكل مسار.");
    console.log("2. تم تعيين مدراء مستقلين لكل مسار (الأهلي المطور vs الدبلومة الأمريكية).");
    console.log("3. تم توفير قرارات رئاسية تستهدف كل مسار بدقة متناهية.");
    console.log("=================================================================\n");

  } catch (error) {
    console.error("❌ حدث خطأ أثناء تنفيذ السكريبت:", error);
  } finally {
    try {
      await terminate(db);
    } catch (e) {}
    process.exit(0);
  }
}

fixDatabase();
