/**
 * aiMonthlyReportGenerator.js
 * محرك الذكاء الاصطناعي لتوليد التقارير الدورية الشهرية للمربي المخلص
 * مدارس المتقدمة
 */

export const STANDARD_SUBJECTS_NATIONAL = [
  { id: 'arabic', name: 'اللغة العربية', maxScore: 10, category: 'أكاديمي' },
  { id: 'english', name: 'اللغة الإنجليزية', maxScore: 10, category: 'لغات' },
  { id: 'math', name: 'الرياضيات', maxScore: 10, category: 'علمي' },
  { id: 'science', name: 'العلوم', maxScore: 10, category: 'علمي' },
  { id: 'social', name: 'الاجتماعيات', maxScore: 10, category: 'إنساني' },
  { id: 'islamic', name: 'الإسلاميات', maxScore: 10, category: 'شرعي' },
  { id: 'digital', name: 'المهارات الرقمية', maxScore: 10, category: 'تقني' }
];

export const STANDARD_SUBJECTS_INTERNATIONAL = [
  { id: 'english', name: 'English Language Arts', maxScore: 10, category: 'Languages' },
  { id: 'math', name: 'Mathematics', maxScore: 10, category: 'STEM' },
  { id: 'science', name: 'Science', maxScore: 10, category: 'STEM' },
  { id: 'social', name: 'Social Studies & Global Perspectives', maxScore: 10, category: 'Humanities' },
  { id: 'arabic', name: 'اللغة العربية (AFL / Native)', maxScore: 10, category: 'Languages' },
  { id: 'islamic', name: 'Islamic Studies / القيم والأخلاق', maxScore: 10, category: 'Values' },
  { id: 'digital', name: 'ICT & Computer Science', maxScore: 10, category: 'Technology' },
  { id: 'art', name: 'Visual Arts & Activities', maxScore: 10, category: 'Creative' }
];

// قوالب وصف الأداء للمواد حسب الدرجة (مطابقة لأسلوب مدارس المتقدمة في النماذج)
const SUBJECT_OBSERVATIONS = {
  arabic: {
    10: [
      'أداء جيد في المهارات الأساسية للقراءة والكتابة.',
      'مستوى متميز يعكس تمكناً لغوياً وبلاغياً رفيعاً.',
      'إتقان كامل لمهارات الفهم القرائي ورسم الحروف والتعبير.'
    ],
    9: [
      'أداء متقدم في القراءة والاستيعاب مع تميز ملحوظ في التعبير الكتابي.',
      'مستوى متقدم يعكس قدرات لغوية واعدة واستجابة سريعة.'
    ],
    8: [
      'أداء جيد ومستقر في المهارات اللغوية مع التزام مستمر بالتطوير.',
      'مستوى متمكن في القراءة والكتابة مع إمكانات طيبة للتوسع.'
    ],
    7: [
      'أداء مقبول ويحتاج إلى تعزيز مهارات القراءة الجهرية وقواعد الإملاء.',
      'يحتاج إلى متابعة إضافية في الفهم القرائي وتطبيق القواعد.'
    ],
    low: [
      'يحتاج إلى برنامج مساندة مكثف في المهارات القرائية والكتابية الأساسية.'
    ]
  },
  english: {
    10: [
      'مستوى ممتاز يعكس تمكّنا من المهارات اللغوية.',
      'Outstanding proficiency in vocabulary, reading comprehension and verbal fluency.',
      'تميز استثنائي في الاستيعاب والتحدث والتعبير باللغة الإنجليزية.'
    ],
    9: [
      'مستوى متقدم واستيعاب سريع للمفردات والقواعد الأساسية.',
      'High competency with noticeable progression in spoken and written skills.'
    ],
    8: [
      'أداء جيد ومشاركة إيجابية في الأنشطة الصفية اللغوية.',
      'Good engagement in reading tasks and functional language.'
    ],
    7: [
      'أداء مقبول، يُنصح بتكثيف الاستماع وزيادة حصيلة الكلمات اليومية.',
      'Requires regular vocabulary review and guided reading practice.'
    ],
    low: [
      'يحتاج إلى خطة علاجية لتعزيز الحروف والمفردات وقواعد القراءة الأولية.'
    ]
  },
  math: {
    10: [
      'اجتهاد ملحوظ في أداء المهام وحل المسائل.',
      'مهارات تحليلية واستدلالية متفوقة في العمليات الحسابية والمسائل اللفظية.',
      'سرعة بديهة ودقة عالية في استيعاب المفاهيم الرياضية المعقدة.'
    ],
    9: [
      'تفكير منطقي متقدم ودقة عالية في إجراء العمليات الرياضية.',
      'أداء متقدم واهتمام مستمر بالتحقق من صحة الحلول.'
    ],
    8: [
      'أداء جيد ومتمكن في تطبيق القوانين والمسائل الرياضية الأساسية.',
      'تفاعل إيجابي مع خطوات الحل واجتهاد مقدر.'
    ],
    7: [
      'مستوى مقبول، ويحتاج مزيداً من التدريب على العمليات الحسابية المتعددة.',
      'يحتاج إلى تعزيز التركيز أثناء قراءة المسائل اللفظية وتطبيق الخطوات.'
    ],
    low: [
      'يحتاج إلى مراجعة مستمرة للحقائق والعمليات الحسابية الأساسية مع المربي وولي الأمر.'
    ]
  },
  science: {
    10: [
      'أداء رائع وفهم جيد للمفاهيم العلمية.',
      'شغف علمي وقدرة متميزة على الاستقصاء وربط الأسباب بالنتائج.',
      'فهم عميق للتجارب العلمية والظواهر الطبيعية والتفكير الاستكشافي.'
    ],
    9: [
      'استيعاب علمي متقدم ومشاركة فاعلة في التجارب والأنشطة.',
      'دقة في استنتاج المفاهيم وربطها بالبيئة المحيطة.'
    ],
    8: [
      'أداء جيد وفهم متزن لمفردات المنهج العلمي والأنشطة الصفية.',
      'مشاركة منتظمة ومتابعة طيبة للمفاهيم العلمية.'
    ],
    7: [
      'مستوى مقبول، ويحتاج إلى مراجعة دورية للمصطلحات والرسوم العلمية.',
      'يوصى بتشجيعه على التساؤل والبحث لتعميق الفهم العملي.'
    ],
    low: [
      'يحتاج إلى تعزيز المبادئ العلمية الأولية والمتابعة المشتركة مع المنزل.'
    ]
  },
  social: {
    10: [
      'مستوى متميز في استيعاب المفاهيم الاجتماعية والتاريخية.',
      'وعي وطني وحضاري رائد وإتقان ممتاز لقراءة الخرائط والأحداث.',
      'تميز في ربط المعارف الجغرافية والتاريخية بالقيم المجتمعية.'
    ],
    9: [
      'فهم متقدم للموضوعات الوطنية والتاريخية ومشاركة صفية ثرية.',
      'اهتمام لافت بالأحداث الوطنية والمعالم الجغرافية.'
    ],
    8: [
      'أداء جيد وإلمام مناسب بالمفاهيم الاجتماعية والجغرافية المقررة.',
      'حضور ذهني وتفاعل منتظم في الحصة.'
    ],
    7: [
      'مستوى مقبول، ويحتاج لتعزيز مهارات ربط التواريخ والمواقع بالأحداث.',
      'يُنصح بمطالعة الأطالس والقصص التاريخية لترسيخ المعلومات.'
    ],
    low: [
      'يحتاج إلى مساندة في حفظ وتحديد المواقع والأحداث الأساسية.'
    ]
  },
  islamic: {
    10: [
      'مستوى متميز يعكس فهمًا جيدًا للمحتوى الشرعي والقيمي.',
      'تمثل رائع للقيم والأخلاق الإسلامية مع إتقان ممتاز للتلاوة والحفظ.',
      'استيعاب راقٍ للأحكام الفقهية وتطبيقها السلوكي في البيئة المدرسية.'
    ],
    9: [
      'أداء متقدم في الحفظ والتلاوة مع وعي قيمي وسلوكي مشرف.',
      'انضباط عالي وتفاعل وقور مع الدروس الشرعية.'
    ],
    8: [
      'أداء جيد وحرص ملموس على التلاوة والمشاركة الصفية الهادفة.',
      'فهم مناسب للأحكام والقيم الدينية المقررة.'
    ],
    7: [
      'مستوى مقبول، ويحتاج إلى مداومة التسميع والمراجعة اليومية للآيات.',
      'يوصى بتكثيف الاستماع لقراء المصحف المرتل لضبط مخارج الحروف.'
    ],
    low: [
      'يحتاج إلى خطة متابعة منزلية يومية لضبط حفظ الآيات والأذكار المقررة.'
    ]
  },
  digital: {
    10: [
      'أداء جيد في التعامل مع الأدوات والتطبيقات الرقمية.',
      'إبداع تقني ملحوظ وقدرة متميزة على توظيف البرمجيات والأجهزة بذكاء.',
      'مهارات حاسوبية وبرمجية متقدمة تعكس تفكيراً منطقياً واعداً.'
    ],
    9: [
      'تمكن عملي متقدم في تنفيذ التطبيقات الرقمية وحل المشكلات البرمجية.',
      'تفاعل ذكي ومبتكر مع الأدوات التقنية والأنشطة الرقمية.'
    ],
    8: [
      'أداء جيد وقدرة ملائمة على إنجاز المهام الرقمية المطلوبة في المعمل.',
      'إلمام سليم بقواعد استخدام التقنية والبرامج المكتبية.'
    ],
    7: [
      'مستوى مقبول، ويحتاج لمزيد من التطبيق العملي والممارسة على الحاسب.',
      'يوصى بالتدريب على سرعة التعامل مع لوحة المفاتيح والبرامج الأساسية.'
    ],
    low: [
      'يحتاج إلى ممارسة عملية إضافية للتعامل مع البرامج الرقمية المبتدئة.'
    ]
  }
};

/**
 * تقييم المستوى الأكاديمي بناء على الدرجة من 10
 */
export function getPerformanceLevel(score) {
  const num = Number(score);
  if (isNaN(num)) return { level: 'غير مقيم', color: '#64748b', badgeClass: 'bg-slate-100 text-slate-700' };
  if (num >= 9.8) {
    return { level: 'متقدم ومتميز', color: '#047857', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  } else if (num >= 9.0) {
    return { level: 'متقدم', color: '#0284c7', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' };
  } else if (num >= 8.0) {
    return { level: 'متمكن', color: '#4f46e5', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  } else if (num >= 6.5) {
    return { level: 'يحتاج دعم', color: '#d97706', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
  } else {
    return { level: 'علاجي مكثف', color: '#dc2626', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
}

/**
 * توليد خلاصة الأداء لمادة محددة بناء على درجتها
 */
export function generateSubjectSummary(subjectId, score) {
  const num = Number(score);
  if (isNaN(num)) return 'لم يتم رصد درجة المادة بعد.';

  const sMap = SUBJECT_OBSERVATIONS[subjectId] || SUBJECT_OBSERVATIONS.arabic;
  let pool;
  if (num >= 9.8) pool = sMap[10];
  else if (num >= 9.0) pool = sMap[9];
  else if (num >= 8.0) pool = sMap[8];
  else if (num >= 6.5) pool = sMap[7];
  else pool = sMap.low;

  if (!pool || pool.length === 0) pool = sMap[10] || ['أداء متميز وجهد مقدر.'];
  // اختيار جملة مميزة
  return pool[0];
}

/**
 * توليد ملخص التقرير الذكي العام بأسلوب مدارس المتقدمة التركيبي
 * مثال: "يُظهر الطالب تميزًا في الاجتماعيات والإسلاميات والعلوم واللغة الإنجليزية، واجتهادًا في الرياضيات، وأداءً جيدًا في العربية والمهارات الرقمية."
 */
export function generateSmartReportSummary({
  studentName = 'الطالب',
  subjectsData = {}, // { [subjectId]: { name, score, summary } }
  isInternational = false,
  mentorNotes = ''
}) {
  const entries = Object.entries(subjectsData).filter(([_, data]) => data && data.score !== '' && !isNaN(data.score));
  
  if (entries.length === 0) {
    return `لم يتم رصد درجات كافية لـ ${studentName} لتوليد ملخص التقرير الدوري بعد.`;
  }

  const distinguished = []; // 9.5 - 10
  const advanced = [];      // 9.0 - 9.4
  const good = [];          // 8.0 - 8.9
  const developing = [];    // < 8.0

  entries.forEach(([_, item]) => {
    const s = Number(item.score);
    const subName = item.name || item.id;
    if (s >= 9.5) distinguished.push(subName);
    else if (s >= 9.0) advanced.push(subName);
    else if (s >= 8.0) good.push(subName);
    else developing.push(subName);
  });

  const joinListAr = (list) => {
    if (list.length === 0) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} و${list[1]}`;
    return `${list.slice(0, -1).join(' و')} و${list[list.length - 1]}`;
  };

  let summaryParts = [];

  if (distinguished.length > 0) {
    summaryParts.push(`يُظهر ${studentName} تميزًا في ${joinListAr(distinguished)}`);
  } else if (advanced.length > 0) {
    summaryParts.push(`يُظهر ${studentName} تقدماً ملحوظاً في ${joinListAr(advanced)}`);
  }

  if (advanced.length > 0 && distinguished.length > 0) {
    summaryParts.push(`واجتهادًا في ${joinListAr(advanced)}`);
  } else if (good.length > 0) {
    const prefix = summaryParts.length > 0 ? 'واجتهادًا وأداءً طيباً في' : `يُظهر ${studentName} أداءً طيباً في`;
    summaryParts.push(`${prefix} ${joinListAr(good)}`);
  }

  if (developing.length > 0) {
    summaryParts.push(`مع الحاجة إلى تعزيز المتابعة والتركيز في ${joinListAr(developing)} للوصول إلى أعلى درجات الإتقان`);
  }

  let finalSummary = summaryParts.join('، ') + '.';

  // إضافة فقرة التحليل الشامل
  const overallAvg = entries.reduce((acc, curr) => acc + Number(curr[1].score), 0) / entries.length;
  let closingNote = '';
  if (overallAvg >= 9.5) {
    closingNote = ' التنوع في المستويات يعكس قدرات متميزة وشخصية أكاديمية واعدة يمكن البناء عليها في مسارات التفوق والموهبة.';
  } else if (overallAvg >= 8.5) {
    closingNote = ' التنوع في المستويات يعكس قدرات متعددة يمكن البناء عليها، ونحث الطالب على استثمار شغفه لرفع معدل التحصيل العام.';
  } else {
    closingNote = ' التعاون المستمر بين المربي المخلص والأسرة الكريمة كفيل بدفع الطالب لتحقيق قفزات نوعية في الفترة القادمة.';
  }

  if (mentorNotes && mentorNotes.trim()) {
    closingNote += ` إشادة المربي المخلص: "${mentorNotes.trim()}"`;
  }

  return finalSummary + closingNote;
}

/**
 * توليد ملخص التتبع والمقارنة الذكي بين تقريرين دوريين (الجديد والقديم)
 */
export function generateComparativeGrowthSummary({
  studentName = 'الطالب',
  oldMonth = 'الفترة السابقة',
  newMonth = 'الفترة الحالية',
  oldAvg = 0,
  newAvg = 0,
  improvements = [], // [{ name, oldScore, newScore, delta }]
  declines = [],     // [{ name, oldScore, newScore, delta }]
  stableHigh = []    // [{ name, score }]
}) {
  const diffAvg = (newAvg - oldAvg).toFixed(1);
  const isPositiveGrowth = newAvg >= oldAvg;

  let intro = '';
  if (isPositiveGrowth && Math.abs(diffAvg) > 0) {
    intro = `يُظهر ملف تتبع نمو ${studentName} تطوراً إيجابياً ملحوظاً خلال (${newMonth}) مقارنة بـ (${oldMonth})، حيث ارتفع المعدل العام بمقدار (+${diffAvg} نقطة) ليصل إلى (${newAvg}%).`;
  } else if (Math.abs(diffAvg) === 0) {
    intro = `يُظهر ملف التتبع استقراراً ممتازاً وثابتاً في مستوى ${studentName} الأكاديمي بين (${oldMonth}) و(${newMonth}) بمعدل عام ثابت (${newAvg}%).`;
  } else {
    intro = `يُظهر ملف التتبع تراجعاً طفيفاً في المعدل العام لـ ${studentName} بمقدار (${diffAvg} نقطة) بين (${oldMonth}) و(${newMonth})، مما يستدعي التدخل الوقائي السريع والمساندة المركزة.`;
  }

  let bodyParts = [];
  if (improvements.length > 0) {
    const list = improvements.map(i => `${i.name} (+${i.delta.toFixed(1)})`).join('، ');
    bodyParts.push(`سُجل تحسن بارز وقفزة نوعية في: ${list}`);
  }

  if (stableHigh.length > 0) {
    const list = stableHigh.map(s => s.name).join('، ');
    bodyParts.push(`مع الحفاظ على التميز الراسخ والإتقان الكامل في: ${list}`);
  }

  if (declines.length > 0) {
    const list = declines.map(d => `${d.name} (${d.delta.toFixed(1)})`).join('، ');
    bodyParts.push(`ويُنصح بتكثيف المتابعة وتقديم الدعم الإضافي في: ${list}`);
  }

  const recommendation = isPositiveGrowth
    ? ' نثمن جهود الطالب والمربي المخلص وندعو الأسرة الكريمة لمواصلة هذا الزخم الإيجابي والتحفيز المستمر.'
    : ' نوصي بوضع خطة عمل مشتركة بين المربي المخلص والأسرة لتعزيز نقاط التحسين واستعادة وتيرة التفوق السابقة.';

  return `${intro} ${bodyParts.join('، ')}.${recommendation}`;
}
