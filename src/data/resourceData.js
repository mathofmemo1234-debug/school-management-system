// Standard Resource Management Catalog & Benchmarks for MSC Schools

export const RESOURCE_STAGES = [
  { id: 'kindergarten', name: 'رياض الأطفال والتمهيدي (KG)', code: 'KG', defaultClassCapacity: 20 },
  { id: 'primary', name: 'المرحلة الابتدائية (Primary)', code: 'PRI', defaultClassCapacity: 25 },
  { id: 'middle', name: 'المرحلة المتوسطة (Middle)', code: 'MID', defaultClassCapacity: 28 },
  { id: 'high', name: 'المرحلة الثانوية (High School)', code: 'SEC', defaultClassCapacity: 30 }
];

export const RESOURCE_TRACKS = [
  { id: 'national', name: 'المسار الأهلي المطور (National Track)', badge: 'أهلي', color: '#0d9488' },
  { id: 'international', name: 'المسار الدولي / الدبلومة الأمريكية (International Track)', badge: 'دولي', color: '#7c3aed' }
];

export const RESOURCE_GENDERS = [
  { id: 'boys', name: 'قسم البنين (Boys Section)', badge: 'بنين', color: '#2563eb' },
  { id: 'girls', name: 'قسم البنات (Girls Section)', badge: 'بنات', color: '#db2777' }
];

export const BUILDING_FACILITIES_CATALOG = [
  { id: 'science_lab', name: 'معامل العلوم والفيزياء والكيمياء', icon: 'FlaskConical' },
  { id: 'computer_lab', name: 'معامل الحاسب الآلي والروبوت والذكاء الاصطناعي', icon: 'Laptop' },
  { id: 'sports_gym', name: 'صالات رياضية مغلقة ومكيفة', icon: 'Trophy' },
  { id: 'football_field', name: 'ملاعب عشبية أولمبية', icon: 'Activity' },
  { id: 'theater', name: 'مسرح مدرسي وقاعة مؤتمرات', icon: 'Film' },
  { id: 'library', name: 'مكتبة ومركز مصادر التعلم', icon: 'BookOpen' },
  { id: 'prayer_hall', name: 'مصلى المجمع', icon: 'Compass' },
  { id: 'cafeteria', name: 'كافتيريا ومطعم مدرسي', icon: 'Coffee' },
  { id: 'clinic', name: 'عيادة الصحة المدرسية', icon: 'HeartPulse' }
];

// Comprehensive Individual Subjects Catalog (National + International)
export const ALL_SCHOOL_SUBJECTS = [
  // الرياضيات
  { id: 'math_general', name: 'الرياضيات', category: 'الرياضيات', periods: 5, load: 20 },
  { id: 'math_algebra', name: 'الجبر والهندسة', category: 'الرياضيات', periods: 5, load: 20 },
  { id: 'math_calculus', name: 'التفاضل والتكامل', category: 'الرياضيات', periods: 5, load: 20 },
  { id: 'math_ap', name: 'الرياضيات المتقدمة (AP Calculus / SAT Math)', category: 'الرياضيات', periods: 5, load: 18 },

  // العلوم الطبيعية
  { id: 'science_general', name: 'العلوم العامة', category: 'العلوم الطبيعية', periods: 4, load: 20 },
  { id: 'science_physics', name: 'الفيزياء (Physics)', category: 'العلوم الطبيعية', periods: 4, load: 20 },
  { id: 'science_chemistry', name: 'الكيمياء (Chemistry)', category: 'العلوم الطبيعية', periods: 4, load: 20 },
  { id: 'science_biology', name: 'الأحياء (Biology)', category: 'العلوم الطبيعية', periods: 4, load: 20 },
  { id: 'science_earth', name: 'علم الأرض والفضاء والجيولوجيا', category: 'العلوم الطبيعية', periods: 3, load: 22 },
  { id: 'science_ecology', name: 'علم البيئة', category: 'العلوم الطبيعية', periods: 3, load: 22 },

  // اللغة العربية
  { id: 'lang_arabic_primary', name: 'لغتي الجميلة (ابتدائي)', category: 'اللغة العربية', periods: 6, load: 20 },
  { id: 'lang_arabic_middle', name: 'لغتي الخالدة (متوسط)', category: 'اللغة العربية', periods: 5, load: 20 },
  { id: 'lang_arabic_high', name: 'اللغة العربية والدراسات اللغوية (ثانوي)', category: 'اللغة العربية', periods: 4, load: 20 },
  { id: 'lang_arabic_rhetoric', name: 'البلاغة والنقد والأدب العربي', category: 'اللغة العربية', periods: 3, load: 22 },

  // اللغة الإنجليزية واللغات
  { id: 'lang_english', name: 'اللغة الإنجليزية (English Language)', category: 'اللغة الإنجليزية واللغات', periods: 5, load: 20 },
  { id: 'lang_english_lit', name: 'الأدب الإنجليزي (English Literature)', category: 'اللغة الإنجليزية واللغات', periods: 4, load: 20 },
  { id: 'lang_french', name: 'اللغة الفرنسية (French)', category: 'اللغة الإنجليزية واللغات', periods: 2, load: 24 },
  { id: 'lang_chinese', name: 'اللغة الصينية (Chinese)', category: 'اللغة الإنجليزية واللغات', periods: 2, load: 24 },

  // العلوم الشرعية والدراسات الإسلامية
  { id: 'islamic_quran', name: 'القرآن الكريم والتجويد والتلاوة', category: 'العلوم الشرعية والدراسات الإسلامية', periods: 4, load: 22 },
  { id: 'islamic_studies', name: 'الدراسات الإسلامية', category: 'العلوم الشرعية والدراسات الإسلامية', periods: 4, load: 22 },
  { id: 'islamic_tawheed', name: 'التوحيد والعقيدة', category: 'العلوم الشرعية والدراسات الإسلامية', periods: 2, load: 24 },
  { id: 'islamic_fiqh', name: 'الفقه والسلوك', category: 'العلوم الشرعية والدراسات الإسلامية', periods: 2, load: 24 },
  { id: 'islamic_tafseer', name: 'التفسير', category: 'العلوم الشرعية والدراسات الإسلامية', periods: 2, load: 24 },
  { id: 'islamic_hadith', name: 'الحديث والثقافة الإسلامية', category: 'العلوم الشرعية والدراسات الإسلامية', periods: 2, load: 24 },

  // الحاسب والتقنية والذكاء الاصطناعي
  { id: 'tech_digital_skills', name: 'المهارات الرقمية', category: 'التقنية والذكاء الاصطناعي', periods: 2, load: 22 },
  { id: 'tech_computer', name: 'الحاسب وتقنية المعلومات', category: 'التقنية والذكاء الاصطناعي', periods: 3, load: 22 },
  { id: 'tech_ai_data', name: 'علم البيانات والذكاء الاصطناعي (AI & Data Science)', category: 'التقنية والذكاء الاصطناعي', periods: 3, load: 20 },
  { id: 'tech_cybersecurity', name: 'الأمن السيبراني (Cybersecurity)', category: 'التقنية والذكاء الاصطناعي', periods: 3, load: 20 },
  { id: 'tech_programming', name: 'البرمجة وتطوير التطبيقات', category: 'التقنية والذكاء الاصطناعي', periods: 3, load: 20 },
  { id: 'tech_robotics', name: 'الروبوت وهندسة الأنظمة الذكية', category: 'التقنية والذكاء الاصطناعي', periods: 2, load: 22 },

  // العلوم الاجتماعية والإدارية
  { id: 'soc_social_studies', name: 'الدراسات الاجتماعية والمواطنة', category: 'العلوم الاجتماعية والإنسانية', periods: 3, load: 22 },
  { id: 'soc_history', name: 'التاريخ الوطني والعالمي', category: 'العلوم الاجتماعية والإنسانية', periods: 2, load: 24 },
  { id: 'soc_geography', name: 'الجغرافيا ونظم المعلومات الجغرافية', category: 'العلوم الاجتماعية والإنسانية', periods: 2, load: 24 },
  { id: 'soc_critical_thinking', name: 'التفكير الناقد والفلسفة', category: 'العلوم الاجتماعية والإنسانية', periods: 2, load: 22 },
  { id: 'soc_life_skills', name: 'المهارات الحياتية والأسرية', category: 'العلوم الاجتماعية والإنسانية', periods: 2, load: 24 },
  { id: 'soc_business', name: 'إدارة الأعمال والمشاريع', category: 'العلوم الإدارية والمالية', periods: 3, load: 22 },
  { id: 'soc_finance', name: 'مبادئ الاقتصاد والمالية والاستثمار', category: 'العلوم الإدارية والمالية', periods: 3, load: 22 },

  // الفنون والرياضة
  { id: 'art_fine_arts', name: 'التربية الفنية والتصميم', category: 'الفنون والتربية البدنية', periods: 2, load: 24 },
  { id: 'pe_physical', name: 'التربية البدنية والدفاع عن النفس', category: 'الفنون والتربية البدنية', periods: 2, load: 24 },

  // الدبلومة الدولية والمسار الأمريكي
  { id: 'intl_ap_physics', name: 'AP Physics (فيزياء متقدمة دولي)', category: 'المسار الدولي والدبلومة الأمريكية', periods: 4, load: 18 },
  { id: 'intl_ap_chem', name: 'AP Chemistry (كيمياء متقدمة دولي)', category: 'المسار الدولي والدبلومة الأمريكية', periods: 4, load: 18 },
  { id: 'intl_ap_bio', name: 'AP Biology (أحياء متقدمة دولي)', category: 'المسار الدولي والدبلومة الأمريكية', periods: 4, load: 18 },
  { id: 'intl_sat_prep', name: 'SAT / ACT Test Preparation', category: 'المسار الدولي والدبلومة الأمريكية', periods: 3, load: 20 },
  { id: 'intl_toefl_ielts', name: 'IELTS / TOEFL English Prep', category: 'المسار الدولي والدبلومة الأمريكية', periods: 3, load: 20 },
  { id: 'intl_stem', name: 'STEM Engineering Projects', category: 'المسار الدولي والدبلومة الأمريكية', periods: 3, load: 20 },

  // خيار مخصص
  { id: 'custom_subject', name: 'مادة أخرى (تحديد يدوي)', category: 'أخرى', periods: 3, load: 20 }
];

export const STANDARD_SUBJECT_QUOTAS = [
  { subject: 'الرياضيات', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'الفيزياء', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'الكيمياء', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'الأحياء والعلوم', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'اللغة العربية ولغتي', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'اللغة الإنجليزية / English', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'الدراسات الإسلامية والقرآن الكريم', periodsPerClass: 4, standardTeacherLoad: 22 },
  { subject: 'المهارات الرقمية والحاسب والذكاء الاصطناعي', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'الدراسات الاجتماعية والتاريخ', periodsPerClass: 2, standardTeacherLoad: 22 },
  { subject: 'إدارة الأعمال والاقتصاد', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'التفكير الناقد والمهارات الحياتية', periodsPerClass: 2, standardTeacherLoad: 22 },
  { subject: 'التربية الفنية والتصميم', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'التربية البدنية والدفاع عن النفس', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'المسار الدولي والدبلومة الأمريكية (AP / SAT)', periodsPerClass: 4, standardTeacherLoad: 18 }
];

// Comprehensive Official Catalog for MSC (شركة المدارس المتقدمة - 43 مجمع وفروع معتمدة)
export const ADVANCED_SCHOOLS_CATALOG = [
  {
    name: "مجمع مدارس المتقدمة للتعلم الذكي للبنين - جدة",
    subTitle: "فرع حي الزهراء - المسار الأهلي والدبلومة الأمريكية",
    city: "جدة",
    track: "أهلي متقدم + STEM",
    code: "msc_jed_smart_boys",
    address: "حي الزهراء، جدة"
  },
  {
    name: "مجمع مدارس المتقدمة للتعلم الذكي للبنات - جدة",
    subTitle: "فرع حي الزهراء - المسار الأهلي والدبلومة الأمريكية",
    city: "جدة",
    track: "أهلي متقدم + STEM",
    code: "msc_jed_smart_girls",
    address: "حي الزهراء، جدة"
  },
  {
    name: "مجمع مدارس المتقدمة العالمية - جدة",
    subTitle: "فرع حي الشاطئ - المسار العالمي والدولي",
    city: "جدة",
    track: "مسار عالمي ودولي",
    code: "msc_jed_intl",
    address: "حي الشاطئ، جدة"
  },
  {
    name: "مجمع مدارس العقيق الأهلية للبنين - المدينة المنورة",
    subTitle: "فرع حي الهجرة - المسار الأهلي المتقدم",
    city: "المدينة المنورة",
    track: "أهلي متقدم",
    code: "msc_med_aqeeq_boys",
    address: "حي الهجرة، المدينة المنورة"
  },
  {
    name: "مجمع مدارس العقيق الأهلية للبنات - المدينة المنورة",
    subTitle: "فرع حي الهجرة - المسار الأهلي المتقدم",
    city: "المدينة المنورة",
    track: "أهلي متقدم",
    code: "msc_med_aqeeq_girls",
    address: "حي الهجرة، المدينة المنورة"
  },
  {
    name: "مجمع مدارس العقيق العالمية - المدينة المنورة",
    subTitle: "فرع طريق السلام - المسار العالمي",
    city: "المدينة المنورة",
    track: "مسار عالمي",
    code: "msc_med_aqeeq_intl",
    address: "طريق السلام، المدينة المنورة"
  },
  {
    name: "مجمع مدارس المتقدمة للتعلم الذكي - حي القيروان",
    subTitle: "فرع شمال الرياض - مسار STEM والتعلم الذكي",
    city: "الرياض",
    track: "أهلي متقدم + STEM",
    code: "msc_ruh_qairawan",
    address: "حي القيروان، الرياض"
  },
  {
    name: "مجمع مدارس أمجاد قرطبة الأهلية للبنين - حي قرطبة",
    subTitle: "فرع شرق الرياض - المسار الأهلي المطور",
    city: "الرياض",
    track: "أهلي مطور",
    code: "msc_ruh_qurtuba_boys",
    address: "حي قرطبة، الرياض"
  },
  {
    name: "مجمع مدارس أمجاد قرطبة الأهلية للبنات - حي قرطبة",
    subTitle: "فرع شرق الرياض - المسار الأهلي المطور",
    city: "الرياض",
    track: "أهلي مطور",
    code: "msc_ruh_qurtuba_girls",
    address: "حي قرطبة، الرياض"
  },
  {
    name: "مجمع مدارس أمجاد قرطبة العالمية - حي قرطبة",
    subTitle: "فرع شرق الرياض - المسار الدولي والعالمي",
    city: "الرياض",
    track: "مسار عالمي ودولي",
    code: "msc_ruh_qurtuba_intl",
    address: "حي قرطبة، الرياض"
  },
  {
    name: "مجمع مدارس نيار الأهلية للبنين - حي الرائد",
    subTitle: "فرع وسط الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_niyar_boys",
    address: "حي الرائد، الرياض"
  },
  {
    name: "مجمع مدارس نيار الأهلية للبنات - حي الرائد",
    subTitle: "فرع وسط الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_niyar_girls",
    address: "حي الرائد، الرياض"
  },
  {
    name: "مجمع مدارس نيار العالمية - حي الرائد",
    subTitle: "فرع وسط الرياض - المسار العالمي",
    city: "الرياض",
    track: "مسار عالمي",
    code: "msc_ruh_niyar_intl",
    address: "حي الرائد، الرياض"
  },
  {
    name: "مجمع مدارس علوم الرياض الأهلية - حي الصحافة",
    subTitle: "فرع شمال الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_oloum_sahafa",
    address: "حي الصحافة، الرياض"
  },
  {
    name: "مجمع مدارس علوم الرياض الأهلية - حي الملز",
    subTitle: "فرع وسط الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_oloum_malaz",
    address: "حي الملز، الرياض"
  },
  {
    name: "مجمع مدارس علوم الرياض العالمية - حي الصحافة",
    subTitle: "فرع شمال الرياض - المسار العالمي",
    city: "الرياض",
    track: "مسار عالمي",
    code: "msc_ruh_oloum_intl",
    address: "حي الصحافة، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي العقيق",
    subTitle: "فرع شمال الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_aqeeq_local",
    address: "حي العقيق، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة العالمية - حي العقيق",
    subTitle: "فرع شمال الرياض - المسار العالمي",
    city: "الرياض",
    track: "مسار عالمي",
    code: "msc_ruh_aqeeq_intl",
    address: "حي العقيق، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي حطين",
    subTitle: "فرع شمال الرياض - المسار الأهلي المتقدم",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_hittin",
    address: "حي حطين، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي النرجس",
    subTitle: "فرع شمال الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_narjis_local",
    address: "حي النرجس، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة العالمية - حي النرجس",
    subTitle: "فرع شمال الرياض - المسار العالمي",
    city: "الرياض",
    track: "مسار عالمي",
    code: "msc_ruh_narjis_intl",
    address: "حي النرجس، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي الياسمين",
    subTitle: "فرع شمال الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_yasmin",
    address: "حي الياسمين، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي المونسية",
    subTitle: "فرع شرق الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_mounsiya_local",
    address: "حي المونسية، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة العالمية - حي المونسية",
    subTitle: "فرع شرق الرياض - المسار العالمي",
    city: "الرياض",
    track: "مسار عالمي",
    code: "msc_ruh_mounsiya_intl",
    address: "حي المونسية، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي اليرموك",
    subTitle: "فرع شرق الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_yarmouk",
    address: "حي اليرموك، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي الشهداء (غرناطة)",
    subTitle: "فرع شرق الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_shuhada",
    address: "حي الشهداء، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي النهضة",
    subTitle: "فرع شرق الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_nahda",
    address: "حي النهضة، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية - حي الروابي",
    subTitle: "فرع شرق الرياض - المسار الأهلي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_rawabi",
    address: "حي الروابي، الرياض"
  },
  {
    name: "مجمع مدارس التضامن الأهلية للبنين - الرياض",
    subTitle: "فرع جنوب الرياض - حي الشفا",
    city: "الرياض",
    track: "أهلي مطور",
    code: "msc_ruh_tadamun_boys",
    address: "حي الشفا، الرياض"
  },
  {
    name: "مجمع مدارس التضامن الأهلية للبنات - الرياض",
    subTitle: "فرع جنوب الرياض - حي الشفا",
    city: "الرياض",
    track: "أهلي مطور",
    code: "msc_ruh_tadamun_girls",
    address: "حي الشفا، الرياض"
  },
  {
    name: "مجمع مدارس الركائز الأهلية - الرياض",
    subTitle: "فرع جنوب الرياض - حي السويدي",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_rakaez",
    address: "حي السويدي، الرياض"
  },
  {
    name: "مجمع مدارس المطورون الأهلية - الرياض",
    subTitle: "فرع شمال الرياض - حي الملقا",
    city: "الرياض",
    track: "أهلي مطور",
    code: "msc_ruh_motaweroon_local",
    address: "حي الملقا، الرياض"
  },
  {
    name: "مجمع مدارس المطورون العالمية - الرياض",
    subTitle: "فرع شمال الرياض - حي الملقا",
    city: "الرياض",
    track: "مسار عالمي",
    code: "msc_ruh_motaweroon_intl",
    address: "حي الملقا، الرياض"
  },
  {
    name: "مجمع مدارس الإبداع الأهلية - الرياض",
    subTitle: "فرع شرق الرياض - حي الروضة",
    city: "الرياض",
    track: "أهلي متقدم",
    code: "msc_ruh_ibda",
    address: "حي الروضة، الرياض"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية للبنين - الخرج",
    subTitle: "فرع محافظة الخرج - المسار الأهلي المتقدم",
    city: "الخرج",
    track: "أهلي متقدم",
    code: "msc_kharj_boys",
    address: "محافظة الخرج"
  },
  {
    name: "مجمع مدارس المتقدمة الأهلية للبنات - الخرج",
    subTitle: "فرع محافظة الخرج - المسار الأهلي المتقدم",
    city: "الخرج",
    track: "أهلي متقدم",
    code: "msc_kharj_girls",
    address: "محافظة الخرج"
  },
  {
    name: "مجمع مدارس دار العلوم الأهلية - الخرج",
    subTitle: "فرع محافظة الخرج - المسار الأهلي",
    city: "الخرج",
    track: "أهلي متقدم",
    code: "msc_kharj_dar_uloom",
    address: "محافظة الخرج"
  },
  {
    name: "مجمع مدارس جواثا الأهلية للبنين - الأحساء",
    subTitle: "فرع مدينة الهفوف - المسار الأهلي",
    city: "الأحساء",
    track: "أهلي متقدم",
    code: "msc_ahsa_jawatha_boys",
    address: "الهفوف، الأحساء"
  },
  {
    name: "مجمع مدارس جواثا الأهلية للبنات - الأحساء",
    subTitle: "فرع مدينة الهفوف - المسار الأهلي",
    city: "الأحساء",
    track: "أهلي متقدم",
    code: "msc_ahsa_jawatha_girls",
    address: "الهفوف، الأحساء"
  },
  {
    name: "مجمع مدارس جواثا العالمية - الأحساء",
    subTitle: "فرع مدينة الهفوف - المسار الدولي",
    city: "الأحساء",
    track: "مسار عالمي ودولي",
    code: "msc_ahsa_jawatha_intl",
    address: "الهفوف، الأحساء"
  },
  {
    name: "مجمع مدارس المتقدمة - الدمام",
    subTitle: "فرع المنطقة الشرقية - المسار الأهلي والعالمي",
    city: "الدمام",
    track: "أهلي متقدم + عالمي",
    code: "msc_dammam",
    address: "الدمام، المنطقة الشرقية"
  },
  {
    name: "مجمع مدارس مناهل البكيرية الأهلية للبنين - البكيرية",
    subTitle: "فرع منطقة القصيم - المسار الأهلي",
    city: "البكيرية",
    track: "أهلي متقدم",
    code: "msc_buk_manahel_boys",
    address: "البكيرية، القصيم"
  },
  {
    name: "مجمع مدارس مناهل البكيرية الأهلية للبنات - البكيرية",
    subTitle: "فرع منطقة القصيم - المسار الأهلي",
    city: "البكيرية",
    track: "أهلي متقدم",
    code: "msc_buk_manahel_girls",
    address: "البكيرية، القصيم"
  }
];
