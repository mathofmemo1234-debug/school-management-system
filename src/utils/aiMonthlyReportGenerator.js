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

export function getSubjectDisplayName(subjectId, customName = '') {
  if (customName) return customName;
  const map = {
    arabic: 'اللغة العربية',
    english: 'اللغة الإنجليزية',
    math: 'الرياضيات',
    science: 'العلوم',
    social: 'الاجتماعيات',
    islamic: 'التربية الإسلامية',
    digital: 'المهارات الرقمية',
    art: 'التربية الفنية'
  };
  return map[subjectId] || subjectId;
}

/**
 * توليد خيارات صياغة الذكاء الاصطناعي المتعددة لمادة محددة بناءً على الدرجة وملحوظة المعلم
 * الخيارات تشمل:
 * 1. أكاديمية ورسمية (Academic & Formal)
 * 2. قصيرة وموجزة (Short & Concise)
 * 3. مطولة وتفصيلية (Detailed & Comprehensive)
 * 4. تحفيزية وتشجيعية (Motivational & Inspiring)
 * 5. تطويرية وعلاجية (Developmental & Action-Oriented)
 */
export function generateSubjectSummaryOptions(subjectId, score, teacherNote = '', subjectName = '') {
  const num = Number(score);
  const validScore = !isNaN(num) ? num : 10;
  const name = subjectName || getSubjectDisplayName(subjectId);
  const rawNote = (teacherNote || '').trim();

  const isHigh = validScore >= 9.5;
  const isAdvanced = validScore >= 8.8 && validScore < 9.5;
  const isGood = validScore >= 7.5 && validScore < 8.8;
  const isAverage = validScore >= 6.5 && validScore < 7.5;
  const isLow = validScore < 6.5;

  // 1. الأسلوب الأكاديمي والتربوي المعتمد (Academic & Formal)
  let academicText = '';
  if (rawNote) {
    if (isHigh) {
      academicText = `يُظهر الطالب كفاءة أكاديمية رفيعة في معايير ونواتج تعلم مادة ${name}، ويؤكد المعلم أن أداءه: "${rawNote}"، مما يعكس تمكناً معرفياً ومنهجياً مشرفاً.`;
    } else if (isAdvanced) {
      academicText = `يُحقق الطالب استيعاباً متقدماً لكفايات مادة ${name} المقررة، مع توثيق المعلم لملاحظة: "${rawNote}"، بما ينسجم مع مؤشرات التحصيل الإيجابي.`;
    } else if (isGood) {
      academicText = `أداء أكاديمي متزن ومستقر في مهارات مادة ${name}، ووفقاً لتقييم المعلم: "${rawNote}"، مما يستوجب مواصلة تدعيم نواتج التعلم المستهدفة.`;
    } else if (isAverage) {
      academicText = `مستوى دراسي مقبول في مادة ${name}، واستناداً لمرئيات المعلم: "${rawNote}"، يتطلب الطالب متابعة دورية لسد بعض الفجوات المهارية.`;
    } else {
      academicText = `تُشير التقييمات المعيارية في مادة ${name} إلى ضرورة الدعم المركز، وحسب تقرير المعلم: "${rawNote}"، يُوصى بتطبيق خطة استدراكية لمعايير المادة.`;
    }
  } else {
    if (isHigh) {
      academicText = `تمكن معرفي متميز وإتقان كامل لنواتج التعلم والمعايير التخصصية في مادة ${name}.`;
    } else if (isAdvanced) {
      academicText = `أداء أكاديمي متقدم يعكس قدرات استيعابية عالية واستجابة سريعة لمتطلبات مادة ${name}.`;
    } else if (isGood) {
      academicText = `أداء أكاديمي جيد ومستقر في المفاهيم الأساسية المقررة لمادة ${name}.`;
    } else if (isAverage) {
      academicText = `مستوى مقبول في المهارات الأساسية لمادة ${name} مع قابلية ملحوظة للتطور الإيجابي.`;
    } else {
      academicText = `يحتاج الطالب إلى برنامج مساندة أكاديمية منتظمة لسد الفجوات في المفاهيم الأساسية لمادة ${name}.`;
    }
  }

  // 2. الأسلوب القصير والموجز (Short & Concise)
  let shortText = '';
  if (rawNote) {
    if (isHigh) {
      shortText = `تميز وإتقان عالٍ في ${name} (${rawNote}).`;
    } else if (isAdvanced || isGood) {
      shortText = `أداء جيد في ${name}، والملاحظة: ${rawNote}.`;
    } else {
      shortText = `تحصيل في ${name} يحتاج متابعة، والملاحظة: ${rawNote}.`;
    }
  } else {
    if (isHigh) {
      shortText = `مستوى متفوق وإتقان تام في مهارات ${name}.`;
    } else if (isAdvanced) {
      shortText = `أداء متقدم ومشاركة صفية ممتازة في ${name}.`;
    } else if (isGood) {
      shortText = `أداء جيد ومستقر في مهارات ${name}.`;
    } else if (isAverage) {
      shortText = `أداء مقبول في ${name} مع استمرار المتابعة.`;
    } else {
      shortText = `يحتاج إلى دعم علاجي مركز في ${name}.`;
    }
  }

  // 3. الأسلوب المطول والتفصيلي (Detailed & Comprehensive)
  let detailedText = '';
  if (rawNote) {
    if (isHigh) {
      detailedText = `خلال فترة المتابعة الحالية في مادة ${name}، أظهر الطالب انضباطاً معرفياً وتفاعلاً صفياً راقياً أهله لنيل هذا التقدير الرفيع، وقد دوّن معلم المادة برؤية دقيقة أن الطالب: "${rawNote}"، وهو ما يبرهن على استعداده العالي للتفوق والمنافسة، ونحثه على مواصلة هذا الشغف الأكاديمي.`;
    } else if (isAdvanced || isGood) {
      detailedText = `يُقدم الطالب مستويات طيبة ومنتظمة في استيعاب مفردات وتطبيقات مادة ${name}، وقد رصد معلم المادة ملحوظة خاصة تفيد بأن الطالب: "${rawNote}". ويُعد هذا الأداء قاعدة انطلاق متينة يمكن البناء عليها لرفع المستوى إلى مصاف التميز الكامل بتكثيف الممارسة الصفية والمنزلية.`;
    } else {
      detailedText = `رصدت التقييمات الدورية في مادة ${name} حاجة الطالب إلى عناية تربوية وتعليمية مستمرة، حيث أوضح معلم المادة في ملحوظته أن الطالب: "${rawNote}". ويتطلب هذا الوضع تضافر جهود المدرسة مع المتابعة المنزلية لتنفيذ خطة استدراكية تعالج جوانب القصور وتضمن استقرار الأداء ونموه.`;
    }
  } else {
    if (isHigh) {
      detailedText = `يُبدي الطالب شغفاً علمياً لافتاً في مادة ${name} من خلال التفاعل الإيجابي والمشاركة الفاعلة وحل الأنشطة والواجبات بدقة وإتقان تام، مما يعكس تحصيلاً راسخاً واستعداداً واعداً للمنافسات والأنشطة الإثرائية.`;
    } else if (isAdvanced || isGood) {
      detailedText = `يُظهر الطالب التزاماً دراسياً متزناً وتفاعلاً مستمراً في حصص مادة ${name}، مع قدرة طيبة على إنجاز المهام المطلوبة وفهم التطبيقات والتدريبات الأساسية، ونوصي بالاستمرار على هذا النهج الإيجابي.`;
    } else {
      detailedText = `يتفاعل الطالب بشكل متدرج في دروس مادة ${name}، ويظهر فهماً لبعض المهارات، إلا أن تعزيز التركيز أثناء الشرح والمداومة على حل التدريبات التطبيقية سيعزز من قدرته على تحقيق درجات أعلى.`;
    }
  }

  // 4. الأسلوب التحفيزي والتشجيعي (Motivational & Inspiring)
  let motivationalText = '';
  if (rawNote) {
    if (isHigh || isAdvanced) {
      motivationalText = `ما شاء الله تبارك الله! تألق مبهر وشخصية ملهمة في ${name}؛ وسرّنا جداً إشادة المعلم: "${rawNote}". استمر في هذا الإبداع والريادة يا بطل! 🌟`;
    } else if (isGood) {
      motivationalText = `جهد رائع ومثابرة واعدة في ${name}! نثمن إيجابيتك وما أشار إليه المعلم: "${rawNote}"، ونحن على ثقة كاملة بقدرتك على الوصول إلى القمة! 👏`;
    } else {
      motivationalText = `نؤمن بقدراتك وإمكانياتك يا بطل، وتوجيه المعلم: "${rawNote}" هو مفتاحك للتألق وتخطي العقبات؛ معاً سنحقق النجاح والتفوق! 💪`;
    }
  } else {
    if (isHigh || isAdvanced) {
      motivationalText = `تألق استثنائي وعطاء مستمر يعكس طموحاً لا يرضى إلا بالريادة في مادة ${name}! فخورون بك وبإنجازك الرائع. 🌟`;
    } else if (isGood) {
      motivationalText = `أحسنت صنعاً! أداؤك في ${name} يبعث على الفخر والسرور، وإصرارك على النجاح هو سر تفوقك القادم. 👏`;
    } else {
      motivationalText = `أنت قادر على إحراز مزيد من التقدم والارتقاء في ${name}، ثق بقدراتك وركز على أهدافك وستصل إلى أعلى المراتب! ✨`;
    }
  }

  // 5. الأسلوب التطويري والإجرائي (Developmental & Action-Oriented)
  let developmentalText = '';
  if (rawNote) {
    if (isHigh || isAdvanced) {
      developmentalText = `توصية إثرائية في ${name}: استثماراً لإشادة المعلم بأن الطالب "${rawNote}"، يُقترح إشراكه في التحديات والمسابقات والمشاريع الإثرائية لتوسيع آفاق الموهبة.`;
    } else if (isGood) {
      developmentalText = `خطة تطوير في ${name}: بالاستناد إلى ملحوظة المعلم: "${rawNote}"، نوصي بتكثيف التطبيقات العملية الذاتية لترقية المستوى من الجيد إلى المتميز.`;
    } else {
      developmentalText = `خطة مساندة مركزة في ${name}: تطبيق تدريبات مكثفة على النقاط التي حددها المعلم: "${rawNote}"، مع متابعة أسبوعية مباشرة لقياس التحسن.`;
    }
  } else {
    if (isHigh || isAdvanced) {
      developmentalText = `توصية إثرائية في ${name}: تشجيع الطالب على التعلم الذاتي وحل المسائل المتقدمة والأنشطة الإثرائية المتخصصة.`;
    } else if (isGood) {
      developmentalText = `خطة تطوير في ${name}: التركيز على الدقة وتطوير المهارات التفكيرية العليا لتحقيق الدرجة الكاملة.`;
    } else {
      developmentalText = `خطة علاجية في ${name}: تخصيص وقت يومي للتدريب على المهارات الأساسية والمراجعة بإشراف ولي الأمر والمعلم.`;
    }
  }

  return [
    {
      id: 'academic',
      styleName: 'أكاديمية',
      title: 'صياغة أكاديمية ورسمية',
      badge: 'معتمدة إشرافياً',
      badgeColor: '#4f46e5',
      badgeBg: '#eef2ff',
      icon: '🎓',
      desc: 'لغة تربوية دقيقة ومعيارية تناسب التقارير الرسمية وإشراف المدارس',
      text: academicText
    },
    {
      id: 'short',
      styleName: 'قصيرة',
      title: 'صياغة قصيرة وموجزة',
      badge: 'مختصرة وسريعة',
      badgeColor: '#0284c7',
      badgeBg: '#f0f9ff',
      icon: '⚡',
      desc: 'جملة مركزة ورشيقة تناسب الجداول المدمجة والتنبيهات المباشرة',
      text: shortText
    },
    {
      id: 'detailed',
      styleName: 'مطولة',
      title: 'صياغة مطولة وتفصيلية',
      badge: 'تقرير تحليلي وافٍ',
      badgeColor: '#7c3aed',
      badgeBg: '#faf5ff',
      icon: '📝',
      desc: 'تحليل نوعي شامل يربط التفاعل الصفي بالملحوظة ورؤية المعلم',
      text: detailedText
    },
    {
      id: 'motivational',
      styleName: 'تحفيزية',
      title: 'صياغة تشجيعية وتحفيزية',
      badge: 'رفع المعنويات والطموح',
      badgeColor: '#059669',
      badgeBg: '#ecfdf5',
      icon: '🌟',
      desc: 'نبرة إيجابية ملهمة تعزز الثقة بالنفس وتثمن جهد الطالب وعطائه',
      text: motivationalText
    },
    {
      id: 'developmental',
      styleName: 'تطويرية',
      title: 'صياغة تطويرية وإجرائية',
      badge: 'خطة عمل وتوصيات',
      badgeColor: '#d97706',
      badgeBg: '#fffbeb',
      icon: '🎯',
      desc: 'خطوات إرشادية وتوصيات إجرائية عملية للمتابعة بين المدرسة والمنزل',
      text: developmentalText
    }
  ];
}

/**
 * توليد خلاصة الأداء لمادة محددة بناء على درجتها وملحوظة المعلم الخاصة والأسلوب المختار
 */
export function generateSubjectSummary(subjectId, score, teacherNote = '', style = 'academic', subjectName = '') {
  const options = generateSubjectSummaryOptions(subjectId, score, teacherNote, subjectName);
  const found = options.find(o => o.id === style || o.styleName === style);
  return found ? found.text : options[0].text;
}

/**
 * توليد ملخص التقرير الذكي العام بأسلوب مدارس المتقدمة التركيبي
 * مثال: "يُظهر الطالب تميزًا في الاجتماعيات والإسلاميات والعلوم واللغة الإنجليزية، واجتهادًا في الرياضيات، وأداءً جيدًا في العربية والمهارات الرقمية."
 */
export function generateSmartReportSummary({
  studentName = 'الطالب',
  subjectsData = {}, // { [subjectId]: { name, score, summary } }
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

  const notableTeacherNotes = entries
    .filter(([_, item]) => item.teacherNote && item.teacherNote.trim())
    .map(([_, item]) => `${item.name}: ${item.teacherNote.trim()}`);

  if (notableTeacherNotes.length > 0) {
    closingNote += ` مرئيات وتوجيهات معلمي المواد: [${notableTeacherNotes.join(' • ')}].`;
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

export const DEFAULT_BEHAVIORAL_NOTES = 'لم تُسجَّل ملاحظات سلوكية هذا الشهر، ونكتفي بالإشارة إلى أن الطالب يُتابَع ضمن السياق الصفي المعتاد ويسير وفق الضوابط المدرسية المعتمدة.';

/**
 * توليد خطة الدعم والتحسين الذكية المتكاملة (4 أبعاد) بناء على مستوى درجات المواد
 * مطابقة تماماً للمنصة التشخيصية المعتمدة (dignosticreport.online)
 */
export function generateSupportAndImprovementPlan({
  studentName = 'الطالب',
  subjectsData = {},
  overallPercentage = 90
}) {
  const entries = Object.entries(subjectsData).filter(([_, data]) => data && data.score !== '' && !isNaN(data.score));
  
  const needSupport = [];
  const excelling = [];

  entries.forEach(([_, item]) => {
    const s = Number(item.score);
    const subName = item.name || item.id;
    if (s < 8.5) needSupport.push(subName);
    else if (s >= 9.5) excelling.push(subName);
  });

  const needStr = needSupport.length > 0 ? needSupport.join(' و') : 'كافة المواد';
  const excelStr = excelling.length > 0 ? excelling.join(' و') : 'العلوم والرياضيات والمهارات الرقمية';

  // 1. خطة إجراءات داخل الصف (دور المربي والمعلمين)
  const inClassActionPlan = [
    needSupport.length > 0
      ? `تخصيص تدريبات إثرائية وعلاجية في ${needStr} لرفع مستوى الإتقان، مع متابعة تقدمه عبر مهام أدائية قصيرة.`
      : `تخصيص تدريبات إثرائية وتحديات متقدمة لرفع مستوى الإتقان، مع تعزيز الدافعية عبر مهام أدائية قصيرة.`,
    `إشراك الطالب في أنشطة استقصائية ومشاريع تطبيقية في ${excelStr} لتعميق فهمه وتوظيف تميزه.`
  ];

  // 2. خطة إجراءات داخل المنزل (مساندة عملية من الأسرة)
  const atHomeActionPlan = [
    `يُفضّل أن يتابع ولي الأمر قراءة الطالب اليومية لمدة عشرين دقيقة لتعزيز مهاراته اللغوية والاستيعابية.`,
    `من المفيد للأسرة أن تشجّع الطالب على استثمار مهاراته الرقمية في مشاريع صغيرة مفيدة وربطها بالواقع.`
  ];

  // 3. أهداف قصيرة المدى (أسبوع إلى أسبوعين)
  const shortTermGoals = [
    needSupport.length > 0
      ? `إنجاز المهام الأدائية ورفع مستوى التحصيل في ${needStr} خلال الأسبوعين القادمين.`
      : `إنجاز المهام الأدائية المتقدمة والأنشطة الإثرائية في المواعيد المحددة بدقة.`,
    `المشاركة الفاعلة في المناقشات الصفية وحل التطبيقات اليومية بانتظام.`
  ];

  // 4. أهداف طويلة المدى (تُراجع مع المتابعات الشهرية القادمة)
  const longTermGoals = [
    `رفع مستوى الإتقان في كافة المواد خلال الفترات القادمة للوصول إلى مرتبة (متقدم ومتميز).`,
    `ترسيخ الاستقلالية الأكاديمية والمهارات الرقمية وتوظيف أدوات التعلم الذكي في جميع المساقات.`
  ];

  return {
    inClassActionPlan,
    atHomeActionPlan,
    shortTermGoals,
    longTermGoals
  };
}
