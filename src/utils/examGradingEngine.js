/**
 * examGradingEngine.js
 * محرك التحليل التلقائي وتصنيف المستويات الثمانية وتوليد البرامج العلاجية الذكية
 */

// 1. تعريف المستويات الثمانية الأكاديمية بدقة متناهية
export const ACADEMIC_LEVELS = [
  {
    code: 'level_1',
    id: 1,
    name: 'ممتاز مرتفع',
    symbol: 'A+',
    minPercentage: 95,
    maxPercentage: 100,
    color: '#059669', // Emerald
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    type: 'enrichment',
    typeLabel: 'برنامج إثرائي متقدم ورعاية موهوبين',
    defaultTitle: 'برنامج رعاية الموهوبين والتميز الأكاديمي',
    diagnosis: 'أداء استثنائي متفوق يظهر إتقاناً شاملاً لكافة المهارات والمفاهيم المعرفية والتحليلية للمادة.',
    actionPlan: [
      'تكليف الطالب بمهام وأسئلة مهارات التفكير العليا والبحث العلمي المصغر.',
      'ترشيح الطالب للمسابقات المدرسية والأولمبياد العلمي للتميز في المادة.',
      'إشراك الطالب في قيادة مجموعات التعلم التعاوني وتدريب زملائه (استراتيجية المعلم الصغير).',
      'تكريم الطالب في لوحة الشرف المدرسية والمنصات التفاعلية.'
    ],
    parentAdvice: 'نبارك لكم تفوق ابنكم المستمر، ونحثكم على مواصلة تحفيزه وإثرائه بالقراءات العلمية التخصصية وتنمية شغفه بالاستكشاف.'
  },
  {
    code: 'level_2',
    id: 2,
    name: 'ممتاز',
    symbol: 'A',
    minPercentage: 90,
    maxPercentage: 94.99,
    color: '#10b981', // Green
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    type: 'enrichment',
    typeLabel: 'برنامج إثرائي وتعزيز مهارات',
    defaultTitle: 'برنامج التميز وتعميق المهارات المعرفية',
    diagnosis: 'أداء ممتاز واستيعاب عالٍ لمفاهيم المادة، مع إتقان واضح لجميع الكفايات الأساسية.',
    actionPlan: [
      'تزويد الطالب بأنشطة إثرائية تعزز التفكير الناقد وحل المشكلات غير المألوفة.',
      'تكليف الطالب بمشروع تطبيقي يربط موضوعات المادة بالواقع العملي.',
      'تشجيع الطالب على استمرار وتيرة المذاكرة والتركيز على التفاصيل الدقيقة للوصول للامتياز المرتفع.'
    ],
    parentAdvice: 'مستوى متميز جداً. يرجى الاستمرار في توفير البيئة التحفيزية وتشجيعه على الحفاظ على هذا المستوى الرفيع.'
  },
  {
    code: 'level_3',
    id: 3,
    name: 'جيد جداً مرتفع',
    symbol: 'B+',
    minPercentage: 85,
    maxPercentage: 89.99,
    color: '#2563eb', // Blue
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    type: 'reinforcement',
    typeLabel: 'برنامج تعزيز ودعم التفوق',
    defaultTitle: 'برنامج تعزيز المهارات والارتقاء نحو الامتياز',
    diagnosis: 'مستوى متقدم واستيعاب قوي للمفاهيم الأساسية، مع وجود فرص بسيطة لرفع كفاءة الحلول والتطبيقات.',
    actionPlan: [
      'تحليل الأخطاء البسيطة في أوراق العمل والاختبارات ومعالجتها فوراً.',
      'تكثيف التدريبات على الأسئلة الاستنتاجية والمفاهيم المركبة.',
      'إعطاء تغذية راجعة دقيقة لتعزيز ثقة الطالب في معالجة المهام المتقدمة.'
    ],
    parentAdvice: 'مستوى رائع وقريب جداً من فئة الامتياز. ينصح بمراجعة الجزئيات التي فقد فيها بعض الدرجات وتحفيزه للوصول لدرجة 90%+.'
  },
  {
    code: 'level_4',
    id: 4,
    name: 'جيد جداً',
    symbol: 'B',
    minPercentage: 80,
    maxPercentage: 84.99,
    color: '#0891b2', // Cyan
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    type: 'reinforcement',
    typeLabel: 'برنامج تطوير المهارات الاستيعابية',
    defaultTitle: 'برنامج صقل المهارات وتطوير جودة الإتقان',
    diagnosis: 'أداء جيد جداً وثابت في أغلب كفايات المادة، مع حاجة طفيفة لتنظيم الوقت وسرعة الدقة في الإجابة.',
    actionPlan: [
      'تدريب الطالب على إدارة وقت الاختبار والتركيز على المطلوب بدقة.',
      'تقديم أوراق عمل تشتمل على أسئلة متنوعة التدرج المعرفي.',
      'متابعة أداء الواجبات المنزلية والمشاركة الصفية لرفع معدل النشاط اليومي.'
    ],
    parentAdvice: 'جهد مشكور ومستوى جيد جداً. يُرجى متابعة تنظيم جدول المذاكرة اليومي والتركيز على تثبيت القواعد والمفاهيم.'
  },
  {
    code: 'level_5',
    id: 5,
    name: 'جيد مرتفع',
    symbol: 'C+',
    minPercentage: 75,
    maxPercentage: 79.99,
    color: '#d97706', // Amber
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    type: 'reinforcement',
    typeLabel: 'برنامج تقوية في المهارات التأسيسية',
    defaultTitle: 'برنامج دعم المهارات الأساسية وتثبيت المفاهيم',
    diagnosis: 'استيعاب متوسط يميل للجيد للمادة، مع تذبذب في بعض المهارات المحورية التي تتطلب تثبيتاً مستمراً.',
    actionPlan: [
      'تحديد المهارات غير المتقنة بدقة وتقديم مراجعات سريعة عليها.',
      'إشراك الطالب في أنشطة صفية تفاعلية تعيد شرح الأفكار المحورية.',
      'تكليفه بمهام يومية قصيرة تضمن ترسيخ القواعد الأساسية.'
    ],
    parentAdvice: 'مستوى الطالب مقبول إلى جيد، ويحتاج إلى وقفة اهتمام منزلي للمراجعة اليومية المنتظمة وحل التدريبات الإضافية لرفع درجته.'
  },
  {
    code: 'level_6',
    id: 6,
    name: 'جيد',
    symbol: 'C',
    minPercentage: 70,
    maxPercentage: 74.99,
    color: '#ea580c', // Orange
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    type: 'remedial',
    typeLabel: 'برنامج علاجي ومراجعة دورية',
    defaultTitle: 'البرنامج العلاجي المرحلي لسد الفجوات التعليمية',
    diagnosis: 'وجود فاقد تعليمي في عدد من المهارات الجوهرية، يستدعي خطة علاجية منظمة قبل الانتقال لمفاهيم متقدمة.',
    actionPlan: [
      'تطبيق أوراق عمل علاجية تركز على المهارات الأساسية ذات الأولوية.',
      'تخصيص وقت خلال الحصة الصفية أو حصص النشاط لتقديم تغذية راجعة فردية.',
      'إعادة شرح النقاط الغامضة بأساليب تعليمية بصرية أو مبسطة.',
      'متابعة مستمرة لدفتر الطالب وحل الواجبات.'
    ],
    parentAdvice: 'تظهر النتائج حاجة الطالب إلى متابعة دراسية مكثفة في المنزل لمراجعة الدروس أولاً بأول، والتواصل مع المعلم لمتابعة خطة التحسين.'
  },
  {
    code: 'level_7',
    id: 7,
    name: 'مقبول',
    symbol: 'D',
    minPercentage: 60,
    maxPercentage: 69.99,
    color: '#dc2626', // Red
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    type: 'remedial',
    typeLabel: 'برنامج علاجي مكثف ومتابعة مستمرة',
    defaultTitle: 'البرنامج العلاجي المكثف لرفع الكفاءة الأكاديمية',
    diagnosis: 'صعوبة ملحوظة في استيعاب المفاهيم الأساسية، ومستوى يقترب من حد الخطورة يستوجب تدخلاً علاجياً عاجلاً.',
    actionPlan: [
      'إلحاق الطالب بحصص التقوية الصفية والمجموعات العلاجية المركزة.',
      'تفكيك الدروس الصعبة إلى خطوات تعليمية صغيرة وميسرة.',
      'إجراء اختبارات قصيرة متكررة لقياس مدى استجابة الطالب للبرنامج العلاجي.',
      'عقد اجتماع تنسيقي مع المرشد الطلابي وولي الأمر لوضع خطة متابعة مشتركة.'
    ],
    parentAdvice: 'نلفت انتباهكم الكريم إلى أن الطالب بحاجة ماسة لدعم دراسي منزلي مكثف وتنظيم أوقات المذاكرة والحد من المشتتات، والتعاون الوثيق مع المدرسة.'
  },
  {
    code: 'level_8',
    id: 8,
    name: 'يحتاج إلى برنامج علاجي',
    symbol: 'F',
    minPercentage: 0,
    maxPercentage: 59.99,
    color: '#991b1b', // Dark Red / Rose
    bgColor: '#fff1f2',
    borderColor: '#f43f5e',
    type: 'remedial',
    typeLabel: 'برنامج تدخلي علاجي طارئ (عالي الأولوية)',
    defaultTitle: 'خطة التدخل العلاجي الفردية لمعالجة التعثر الأكاديمي',
    diagnosis: 'تعثر دراسي واضح وفقدان لأغلب المهارات الأساسية للمادة، يتطلب تدخلاً تربوياً وتعليمياً شاملاً وفورياً.',
    actionPlan: [
      'وضع خطة علاجية فردية دقيقة بالتعاون بين معلم المادة والموجه الطلابي.',
      'إعادة بناء المهارات التأسيسية من البداية عبر حصص علاجية مخصصة ومواد مبسطة.',
      'تقييم أسبوعي مستمر لرصد مدى التقدم وتوثيق الاستجابة العلاجية.',
      'إشعار خطي واستدعاء لولي الأمر لبحث أسباب التعثر وتكامل الأدوار بين البيت والمدرسة.'
    ],
    parentAdvice: 'تنبيه هام وعاجل: مستوى الطالب يستدعي تدخلاً فورياً وإشرافاً مباشراً في المنزل بالتعاون مع المدرسة لتنفيذ خطة الدعم العلاجي وتفادي التعثر المستمر.'
  }
];

// 2. قائمة التخصصات والمواد النموذجية
export const STANDARD_SPECIALIZATIONS = [
  'الرياضيات',
  'العلوم',
  'لغتي الجميلة',
  'التربية الإسلامية',
  'اللغة الإنجليزية',
  'الدراسات الاجتماعية',
  'المهارات الرقمية',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'التربية الفنية',
  'التربية البدنية والدفاع عن النفس',
  'المهارات الحياتية والأسرية'
];

// 3. المراحل والصفوف الدراسية
export const STANDARD_STAGES = [
  { id: 'primary', name: 'المرحلة الابتدائية', classes: ['الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي', 'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي'] },
  { id: 'middle', name: 'المرحلة المتوسطة', classes: ['الصف الأول المتوسط', 'الصف الثاني المتوسط', 'الصف الثالث المتوسط'] },
  { id: 'secondary', name: 'المرحلة الثانوية', classes: ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'] }
];

// 4. دالة البحث عن المستوى بناءً على النسبة المئوية
export function getLevelByPercentage(percentage, customMatrix = null) {
  let levels = customMatrix && Array.isArray(customMatrix) && customMatrix.length > 0 
    ? [...customMatrix] 
    : ACADEMIC_LEVELS;

  // ترتيب المستويات تنازلياً حسب الحد الأدنى للنسبة لضمان دقة مطابقة النطاق
  levels.sort((a, b) => (Number(b.minPercentage) || 0) - (Number(a.minPercentage) || 0));

  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));

  for (const lvl of levels) {
    const min = Number(lvl.minPercentage) ?? 0;
    const max = Number(lvl.maxPercentage) ?? 100;
    if (pct >= min && pct <= max) {
      return lvl;
    }
  }
  // Fallback to lowest level
  return levels[levels.length - 1] || ACADEMIC_LEVELS[ACADEMIC_LEVELS.length - 1];
}

// 5. دالة احتساب المجموع، النسبة، وتوليد البرنامج العلاجي
export function calculateStudentGradeResult({
  coreScore = 0,
  customScores = {},
  exam,
  customMatrix = null,
  teacherCustomNotes = '',
  skillsToTarget = []
}) {
  const safeExam = exam || {
    coreSubjectMaxScore: 20,
    customColumns: [],
    totalMaxScore: 20
  };

  const cScore = Number(coreScore) || 0;
  
  // احتساب مجموع الأعمدة المخصصة
  let customTotal = 0;
  const sanitizedCustomScores = {};

  if (Array.isArray(safeExam.customColumns)) {
    safeExam.customColumns.forEach(col => {
      const val = Number(customScores[col.key]) || 0;
      sanitizedCustomScores[col.key] = Math.min(col.maxScore, Math.max(0, val));
      customTotal += sanitizedCustomScores[col.key];
    });
  }

  const totalScore = cScore + customTotal;
  const maxTotalScore = safeExam.totalMaxScore || (
    (safeExam.coreSubjectMaxScore || 20) + 
    (safeExam.customColumns || []).reduce((acc, col) => acc + (Number(col.maxScore) || 0), 0)
  );

  const percentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
  const roundedPercentage = Number(percentage.toFixed(2));

  // استخراج المستوى من مصفوفة المستويات
  const levelObj = getLevelByPercentage(roundedPercentage, customMatrix);

  // توليد البرنامج العلاجي / الإثرائي ثنائي اللغة
  const remedialProgram = {
    levelCode: levelObj.code || `level_${levelObj.id || 1}`,
    levelName: levelObj.name,
    levelSymbol: levelObj.symbol,
    programType: levelObj.type,
    programTypeLabel: levelObj.typeLabel || '',
    title: levelObj.defaultTitle || '',
    diagnosis: levelObj.diagnosis || '',
    actionPlan: Array.isArray(levelObj.actionPlan) ? [...levelObj.actionPlan] : [],
    teacherNotes: teacherCustomNotes || '',
    parentAdvice: levelObj.parentAdvice || '',
    skillsToTarget: skillsToTarget && skillsToTarget.length > 0 ? skillsToTarget : [],
    parentLanguageDisplay: 'both', // 'ar' | 'en' | 'both'
    ar: {
      title: levelObj.defaultTitle || '',
      diagnosis: levelObj.diagnosis || '',
      actionPlan: Array.isArray(levelObj.actionPlan) ? [...levelObj.actionPlan] : [],
      parentAdvice: levelObj.parentAdvice || '',
      teacherNotes: teacherCustomNotes || ''
    },
    en: {
      title: levelObj.enTitle || `Academic Development Program (${levelObj.symbol || 'Plan'})`,
      diagnosis: levelObj.enDiagnosis || `Educational diagnosis: Academic performance classified at ${levelObj.name || ''} (${levelObj.symbol || ''}).`,
      actionPlan: Array.isArray(levelObj.enActionPlan) && levelObj.enActionPlan.length > 0
        ? [...levelObj.enActionPlan]
        : ['Follow up closely with teacher recommendations.', 'Review lesson worksheets regularly at home.', 'Practice targeted skill reinforcement exercises.'],
      parentAdvice: levelObj.enParentAdvice || 'We kindly request regular home monitoring of study time and close coordination with the subject teacher.',
      teacherNotes: teacherCustomNotes || ''
    }
  };

  return {
    coreScore: cScore,
    customScores: sanitizedCustomScores,
    customTotal,
    totalScore: Number(totalScore.toFixed(2)),
    maxScore: maxTotalScore,
    percentage: roundedPercentage,
    levelCode: levelObj.code || `level_${levelObj.id || 1}`,
    levelName: levelObj.name,
    levelSymbol: levelObj.symbol,
    levelColor: levelObj.color || '#0284c7',
    levelBgColor: levelObj.bgColor || '#f0f9ff',
    levelBorderColor: levelObj.borderColor || '#bae6fd',
    levelType: levelObj.type || 'reinforcement',
    remedialProgram
  };
}

// 6. دالة فحص والتحقق من القيمة المدخلة
export function validateInputScore(value, maxScore) {
  if (value === '' || value === null || value === undefined) {
    return { isValid: true, numVal: 0 };
  }
  const num = Number(value);
  if (isNaN(num)) {
    return { isValid: false, message: 'القيمة المدخلة ليست رقماً صالحاً' };
  }
  if (num < 0) {
    return { isValid: false, message: 'لا يمكن إدخال درجة سالبة' };
  }
  if (num > maxScore) {
    return { isValid: false, message: `الدرجة تتجاوز الحد الأقصى (${maxScore})` };
  }
  return { isValid: true, numVal: num };
}

// 7. دالة الإحصائيات الشاملة لكشف درجات فصل أو مادة
export function computeClassExamStats(gradesRecords = [], totalMaxScore = 100) {
  if (!gradesRecords || gradesRecords.length === 0) {
    return {
      totalCount: 0,
      averageScore: 0,
      averagePercentage: 0,
      passCount: 0,
      remedialCount: 0,
      passRate: 0,
      remedialRate: 0,
      levelsDistribution: ACADEMIC_LEVELS.map(lvl => ({ ...lvl, count: 0, percentage: 0 }))
    };
  }

  let totalScoreSum = 0;
  let passCount = 0;
  let remedialCount = 0;

  const distributionMap = {};
  ACADEMIC_LEVELS.forEach(lvl => {
    distributionMap[lvl.code] = { ...lvl, count: 0, percentage: 0 };
  });

  gradesRecords.forEach(rec => {
    const score = Number(rec.totalScore) || 0;
    const pct = Number(rec.percentage) || (totalMaxScore > 0 ? (score / totalMaxScore) * 100 : 0);
    totalScoreSum += score;

    if (pct >= 60) {
      passCount += 1;
    } else {
      remedialCount += 1;
    }

    const matchedLevel = getLevelByPercentage(pct);
    if (distributionMap[matchedLevel.code]) {
      distributionMap[matchedLevel.code].count += 1;
    }
  });

  const totalCount = gradesRecords.length;
  const avgScore = totalCount > 0 ? (totalScoreSum / totalCount) : 0;
  const avgPct = totalMaxScore > 0 ? (avgScore / totalMaxScore) * 100 : 0;

  const levelsDistribution = ACADEMIC_LEVELS.map(lvl => {
    const count = distributionMap[lvl.code].count;
    const percentage = totalCount > 0 ? Number(((count / totalCount) * 100).toFixed(1)) : 0;
    return {
      ...lvl,
      count,
      percentage
    };
  });

  return {
    totalCount,
    averageScore: Number(avgScore.toFixed(2)),
    averagePercentage: Number(avgPct.toFixed(1)),
    passCount,
    remedialCount,
    passRate: Number(((passCount / totalCount) * 100).toFixed(1)),
    remedialRate: Number(((remedialCount / totalCount) * 100).toFixed(1)),
    levelsDistribution
  };
}
