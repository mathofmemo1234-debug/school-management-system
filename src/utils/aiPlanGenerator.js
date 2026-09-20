/**
 * aiPlanGenerator.js
 * محرك الذكاء الاصطناعي لتوليد البرامج العلاجية والإثرائية وتوجيهات أولياء الأمور
 * يدعم اللغتين العربية والإنجليزية، ويدمج ملاحظات المعلم المخصصة لإعادة الصياغة والتوجيه.
 */

// قاموس المصطلحات والموضوعات التخصصية للمواد
const SUBJECT_SPECIALTIES = {
  'الرياضيات': {
    en: 'Mathematics',
    enrichmentKeywords: ['التفكير المجرد', 'حل المشكلات المركبة', 'الاستدلال الرياضي', 'التحليل المنطقي'],
    remedialKeywords: ['العمليات الحسابية الأساسية', 'استيعاب المسائل اللفظية', 'القوانين الرياضية والتطبيق المباشر']
  },
  'العلوم': {
    en: 'Science',
    enrichmentKeywords: ['الاستقصاء العلمي', 'التفكير الناقد والبحثي', 'تفسير الظواهر الطبيعية', 'التجارب المعملية'],
    remedialKeywords: ['المفاهيم العلمية الأساسية', 'الربط بين السبب والنتيجة', 'حفظ وتطبيق المصطلحات العلمية']
  },
  'لغتي الجميلة': {
    en: 'Arabic Language',
    enrichmentKeywords: ['التذوق البلاغي', 'التحليل الأدبي للنصوص', 'مهارات التعبير الإبداعي', 'التراكيب النحوية المتقدمة'],
    remedialKeywords: ['القراءة الجهرية السليمة', 'قواعد الإملاء ورسم الحروف', 'التمييز بين الأزمنة والأساليب النحوية']
  },
  'اللغة الإنجليزية': {
    en: 'English Language',
    enrichmentKeywords: ['Advanced vocabulary usage', 'Creative writing & fluency', 'Critical reading comprehension', 'Grammar mastery'],
    remedialKeywords: ['Basic phonics & spelling', 'Simple sentence structure', 'Everyday vocabulary', 'Reading fluency']
  },
  'التربية الإسلامية': {
    en: 'Islamic Studies',
    enrichmentKeywords: ['الاستنباط الفقهي', 'فهم مقاصد الشريعة', 'تدبر الآيات والأحاديث', 'التمثل السلوكي والقيمي'],
    remedialKeywords: ['حفظ الآيات المقررة مع التجويد', 'معرفة الأحكام الفقهية الميسرة', 'معاني المفردات القرآنية الأساسية']
  },
  'الدراسات الاجتماعية': {
    en: 'Social Studies',
    enrichmentKeywords: ['التحليل الجغرافي والتاريخي', 'قراءة الخرائط الرقمية', 'استقراء الأحداث التاريخية', 'الوعي الحضاري'],
    remedialKeywords: ['التعرف على التواريخ والأحداث الهامة', 'تحديد المواقع الجغرافية الأساسية', 'المفاهيم الوطنية']
  },
  'المهارات الرقمية': {
    en: 'Digital Skills',
    enrichmentKeywords: ['التفكير الخوارزمي والبرمجة', 'تصميم النظم الرقمية', 'حل المشكلات التقنية المتقدمة', 'الأمن السيبراني'],
    remedialKeywords: ['أساسيات استخدام الحاسب والإنترنت', 'التعامل مع التطبيقات المكتبية', 'إدخال البيانات والتنسيق']
  },
  'الفيزياء': {
    en: 'Physics',
    enrichmentKeywords: ['الاستنتاج الرياضي للقوانين الفيزيائية', 'حل مسائل الحركة والطاقة المركبة', 'النمذجة الرياضية والفيزيائية'],
    remedialKeywords: ['تحويل الوحدات الفيزيائية', 'فهم المفاهيم الأساسية للسرعة والقوة', 'تطبيق القوانين المباشرة']
  },
  'الكيمياء': {
    en: 'Chemistry',
    enrichmentKeywords: ['موازنة المعادلات المعقدة', 'الحسابات الكيميائية الدقيقة', 'التراكيب الجزيئية والديناميكا الحرارية'],
    remedialKeywords: ['حفظ رموز العناصر والتكافؤ', 'التمييز بين التفاعلات الكيميائية الأساسية', 'قواعد السلامة المعملية']
  },
  'الأحياء': {
    en: 'Biology',
    enrichmentKeywords: ['التحليل الوراثي والبيولوجي المتقدم', 'مقارنة الوظائف الحيوية الخلوية', 'فهم النظم البيئية المعقدة'],
    remedialKeywords: ['تصنيف الكائنات الحية', 'أجزاء الخلية ووظائفها الأساسية', 'استيعاب الدورات الحيوية']
  }
};

/**
 * توليد برنامج وخطة بالذكاء الاصطناعي مع الأخذ بعين الاعتبار ملاحظات المعلم
 */
export async function generateRemedialPlanAI({
  studentName = 'الطالب',
  subject = 'المادة',
  percentage = 80,
  totalScore = 80,
  maxScore = 100,
  levelName = 'جيد جداً',
  levelSymbol = 'B',
  levelType = 'reinforcement', // 'enrichment' | 'reinforcement' | 'remedial'
  teacherNotes = '',
  customMatrixLevel = null
}) {
  const spec = SUBJECT_SPECIALTIES[subject] || {
    en: subject,
    enrichmentKeywords: ['التفكير المتقدم', 'المشاريع التطبيقية', 'الإتقان المعرفي'],
    remedialKeywords: ['المفاهيم التأسيسية', 'المراجعة المنتظمة', 'التدريبات المكثفة']
  };

  const subjectEn = spec.en || subject;
  const pct = Number(percentage) || 0;
  const hasTeacherNotes = Boolean(teacherNotes && teacherNotes.trim().length > 0);
  const cleanTeacherNotes = teacherNotes ? teacherNotes.trim() : '';

  // 1. توليد المحتوى باللغة العربية
  let arTitle = '';
  let arDiagnosis = '';
  let arActionPlan = [];
  let arParentAdvice = '';
  let arTeacherRecommendation = '';

  // 2. توليد المحتوى باللغة الإنجليزية
  let enTitle = '';
  let enDiagnosis = '';
  let enActionPlan = [];
  let enParentAdvice = '';
  let enTeacherRecommendation = '';

  if (levelType === 'enrichment' || pct >= 90) {
    // المستوى الإثرائي والمتفوقين
    arTitle = `برنامج رعاية الموهوبين والتميز الأكاديمي في ${subject}`;
    arDiagnosis = `أظهر الطالب (${studentName}) أداءً استثنائياً محققاً نسبة (${pct}%) في ${subject}. يتمتع بقدرة فائقة على الاستيعاب والتحليل السريع للمفاهيم المتقدمة.`;
    
    if (hasTeacherNotes) {
      arDiagnosis += ` وبناءً على ملاحظة معلم المادة: "${cleanTeacherNotes}"، تم توجيه الخطة لتعزيز هذه النقاط البارزة وتوظيفها بالشكل الأمثل.`;
    }

    arActionPlan = [
      `تكليف الطالب بمهام تفكير عليا وحل مشكلات مركبة في موضوعات ${subject}.`,
      `ترشيح الطالب للمسابقات المدرسية والأولمبياد العلمي لتمثيل المدرسة.`,
      `إشراك الطالب في قيادة المجموعات التعلمية (استراتيجية المعلم الصغير) لدعم زملائه.`,
      `إعداد مشروع بحثي تطبيقي مصغر يربط مفاهيم ${subject} بالواقع العملي.`
    ];

    arParentAdvice = `نبارك لكم هذا التفوق المشرف لابنكم (${studentName}). نوصي بالاستمرار في توفير البيئة التحفيزية، وتشجيعه على القراءة الإثرائية، ومساندته في المشاريع العلمية المستقلة.`;
    arTeacherRecommendation = hasTeacherNotes 
      ? `استجابة لملاحظة المعلم: تم التركيز على استثمار طاقات الطالب في ${cleanTeacherNotes}.`
      : `يوصى بتكثيف التحديات المعرفية للطالب للحفاظ على شغفه الأكاديمي.`;

    // English
    enTitle = `Academic Excellence & Gifted Enrichment Program in ${subjectEn}`;
    enDiagnosis = `Student (${studentName}) demonstrated exceptional performance achieving (${pct}%) in ${subjectEn}. Shows profound understanding and rapid analytical reasoning in advanced topics.`;
    if (hasTeacherNotes) {
      enDiagnosis += ` Following the teacher's observation: "${cleanTeacherNotes}", the enrichment plan is customized to leverage these specific strengths.`;
    }

    enActionPlan = [
      `Assign advanced higher-order thinking tasks and complex problem-solving in ${subjectEn}.`,
      `Nominate the student for academic olympiads and inter-school competitions.`,
      `Engage the student in peer tutoring and cooperative group leadership (Junior Teacher strategy).`,
      `Encourage a research-oriented project applying ${subjectEn} concepts to real-world scenarios.`
    ];

    enParentAdvice = `Congratulations on (${studentName})'s outstanding academic achievement! We recommend continuing to foster a stimulating environment and encouraging independent exploratory reading.`;
    enTeacherRecommendation = hasTeacherNotes
      ? `Tailored to teacher's feedback: Focus on sustaining high engagement around ${cleanTeacherNotes}.`
      : `Recommended to provide progressive cognitive challenges to sustain academic enthusiasm.`;

  } else if (levelType === 'reinforcement' || (pct >= 70 && pct < 90)) {
    // المستوى المتوسط / تعزيز ودعم
    arTitle = `برنامج تعزيز الكفايات والارتقاء نحو الامتياز في ${subject}`;
    arDiagnosis = `حقق الطالب (${studentName}) نتيجة جيدة جداً بنسبة (${pct}%) في ${subject}. يستوعب المفاهيم الأساسية بكفاءة، وتوجد فرص تطويرية في بعض المهارات الجزئية للوصول لفئة الامتياز المرتفع.`;
    
    if (hasTeacherNotes) {
      arDiagnosis += ` كما أشار معلم المادة إلى: "${cleanTeacherNotes}"، وهو ما يركز عليه هذا البرنامج لمعالجة تلك الجوانب بعناية.`;
    }

    arActionPlan = [
      `مراجعة الأخطاء المحددة في اختبارات وأوراق عمل ${subject} والتدريب على الأسئلة المشابهة لها.`,
      `تقديم تدريبات إضافية تركز على التطبيق العملي وسرعة ودقة الحل.`,
      `تحفيز المشاركة الصفية الفعالة وطرح الأسئلة الاستيضاحية عند عدم وضوح أي فكرة.`,
      `تنظيم جدول مذاكرة أسبوعي يخصص وقتاً كافياً لمراجعة وتثبيت موضوعات المادة.`
    ];

    arParentAdvice = `أداء الطالب (${studentName}) جيد ومبشر ويفصله القليل عن فئة الامتياز. نرجو منكم متابعة تنظيم أوقات المذاكرة في المنزل، ومراجعة أوراق العمل، وتشجيعه للوصول إلى أعلى الدرجات.`;
    arTeacherRecommendation = hasTeacherNotes 
      ? `وفق ملاحظات المعلم: التركيز العلاجي الجزئي موجه نحو "${cleanTeacherNotes}".`
      : `يوصى بتقديم تغذية راجعة مستمرة بعد كل وحدة دراسية لضمان سد الفجوات الطفيفة.`;

    // English
    enTitle = `Competency Reinforcement & Mastery Program in ${subjectEn}`;
    enDiagnosis = `Student (${studentName}) achieved a commendable score of (${pct}%) in ${subjectEn}. Shows a solid grasp of core concepts with identifiable opportunities to attain top-tier distinction.`;
    if (hasTeacherNotes) {
      enDiagnosis += ` Addressing the teacher's note: "${cleanTeacherNotes}", this program targets those precise areas for optimal progress.`;
    }

    enActionPlan = [
      `Review specific mistakes in ${subjectEn} quizzes and worksheets with guided practice on similar problems.`,
      `Provide targeted exercises focusing on application speed, accuracy, and detailed problem-solving.`,
      `Encourage active classroom participation and clarifying questions during instructional sessions.`,
      `Establish a structured weekly home study schedule dedicated to reinforcing lesson objectives.`
    ];

    enParentAdvice = `(${studentName})'s performance is strong and very close to top distinction. Please assist in maintaining regular home review routines and celebrating every step of improvement.`;
    enTeacherRecommendation = hasTeacherNotes
      ? `Reflecting teacher's note: Priority focus is given to "${cleanTeacherNotes}".`
      : `Recommended to provide consistent formative feedback following each curriculum module.`;

  } else {
    // المستوى العلاجي والتدخل السريع (أقل من 70% أو نوع remedial)
    arTitle = `خطة التدخل العلاجي والدعم المكثف في ${subject}`;
    arDiagnosis = `أظهر تقييم الطالب (${studentName}) نسبة (${pct}%) في ${subject}، مما يعكس وجود فاقد تعليمي في عدد من المهارات التأسيسية التي تتطلب تدخلاً علاجياً عاجلاً ومنظماً.`;
    
    if (hasTeacherNotes) {
      arDiagnosis += ` وأكد معلم المادة في تقريره: "${cleanTeacherNotes}"، وتعتبر هذه النقطة الركيزة الأساسية لخطة التحسين الفردية.`;
    }

    arActionPlan = [
      `إلحاق الطالب بحصص الدعم والتقوية الصفية المخصصة لسد الفجوات التأسيسية في ${subject}.`,
      `تفكيك المفاهيم المعقدة إلى خطوات تعليمية مبسطة ومدعومة بأوراق عمل علاجية متدرجة.`,
      `متابعة أسبوعية دقيقة للواجبات والمهام الأدائية لضمان تثبيت المفاهيم أولاً بأول.`,
      `عقد جلسات تقييم قصيرة متكررة لقياس مدى استجابة الطالب للخطة العلاجية.`
    ];

    arParentAdvice = `تنبيه هام ومتابعة مشتركة: نلفت انتباهكم الكريم إلى أن ابنكم (${studentName}) بحاجة ماسة لوقفة مساندة مكثفة في المنزل لمراجعة الدروس اليومية، وحل التدريبات، والتواصل المستمر مع معلم المادة لتجاوز هذا التعثر.`;
    arTeacherRecommendation = hasTeacherNotes 
      ? `بناءً على تشخيص المعلم المباشر: الخطة العلاجية تعطي الأولوية لمعالجة "${cleanTeacherNotes}".`
      : `يوصى بتقديم الدعم الفردي وتيسير المهام حتى يستعيد الطالب ثقته ومهاراته الأساسية.`;

    // English
    enTitle = `Intensive Remedial & Academic Intervention Plan in ${subjectEn}`;
    enDiagnosis = `Student (${studentName}) obtained (${pct}%) in ${subjectEn}, indicating essential learning gaps in foundational skills that require immediate and structured academic intervention.`;
    if (hasTeacherNotes) {
      enDiagnosis += ` As highlighted by the teacher: "${cleanTeacherNotes}", this area serves as the central focal point of this individual intervention plan.`;
    }

    enActionPlan = [
      `Enroll the student in targeted remedial support sessions to bridge foundational gaps in ${subjectEn}.`,
      `Break down complex concepts into bite-sized, step-by-step instructional tasks with tiered worksheets.`,
      `Conduct close weekly monitoring of homework, class activities, and basic skill retention.`,
      `Implement regular short formative check-ins to monitor the student's responsive progress.`
    ];

    enParentAdvice = `Important Notice: (${studentName}) requires dedicated academic support and regular daily review at home. Close cooperation between home and school is crucial to ensure rapid recovery and success.`;
    enTeacherRecommendation = hasTeacherNotes
      ? `Directly aligned with teacher's feedback: Intervention prioritized on "${cleanTeacherNotes}".`
      : `Recommended to provide personalized encouragement and scaffolded tasks to rebuild student confidence.`;
  }

  return {
    ar: {
      title: arTitle,
      diagnosis: arDiagnosis,
      actionPlan: arActionPlan,
      parentAdvice: arParentAdvice,
      teacherNotes: cleanTeacherNotes || arTeacherRecommendation
    },
    en: {
      title: enTitle,
      diagnosis: enDiagnosis,
      actionPlan: enActionPlan,
      parentAdvice: enParentAdvice,
      teacherNotes: cleanTeacherNotes ? `Teacher note incorporated: ${cleanTeacherNotes}` : enTeacherRecommendation
    },
    aiGenerated: true,
    generatedAt: new Date().toISOString()
  };
}
