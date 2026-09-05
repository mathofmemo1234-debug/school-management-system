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
  // 1. الرياضيات والحساب (Mathematics)
  { id: 'math_general', name: 'الرياضيات العامة', category: 'الرياضيات', track: 'national', periods: 5, load: 20 },
  { id: 'math_algebra', name: 'الجبر والهندسة', category: 'الرياضيات', track: 'national', periods: 5, load: 20 },
  { id: 'math_calculus', name: 'التفاضل والتكامل', category: 'الرياضيات', track: 'national', periods: 5, load: 20 },
  { id: 'math_statistics', name: 'الإحصاء والاحتمالات', category: 'الرياضيات', track: 'national', periods: 4, load: 20 },
  { id: 'math_financial', name: 'الرياضيات المالية', category: 'الرياضيات', track: 'national', periods: 3, load: 22 },
  { id: 'intl_math_general', name: 'Mathematics (General Intl)', category: 'الرياضيات', track: 'international', periods: 5, load: 20 },
  { id: 'intl_math_algebra', name: 'Algebra I & II', category: 'الرياضيات', track: 'international', periods: 5, load: 20 },
  { id: 'intl_math_geometry', name: 'Geometry', category: 'الرياضيات', track: 'international', periods: 5, load: 20 },
  { id: 'intl_math_precalculus', name: 'Pre-Calculus', category: 'الرياضيات', track: 'international', periods: 5, load: 20 },
  { id: 'intl_math_ap_calc_ab', name: 'AP Calculus AB', category: 'الرياضيات', track: 'international', periods: 5, load: 18 },
  { id: 'intl_math_ap_calc_bc', name: 'AP Calculus BC', category: 'الرياضيات', track: 'international', periods: 5, load: 18 },
  { id: 'intl_math_ap_stats', name: 'AP Statistics', category: 'الرياضيات', track: 'international', periods: 4, load: 18 },
  { id: 'intl_math_sat_prep', name: 'SAT / ACT Math Prep', category: 'الرياضيات', track: 'international', periods: 3, load: 20 },

  // 2. العلوم الطبيعية (Natural Sciences)
  { id: 'science_general', name: 'العلوم العامة', category: 'العلوم الطبيعية', track: 'national', periods: 4, load: 20 },
  { id: 'science_physics', name: 'الفيزياء', category: 'العلوم الطبيعية', track: 'national', periods: 4, load: 20 },
  { id: 'science_chemistry', name: 'الكيمياء', category: 'العلوم الطبيعية', track: 'national', periods: 4, load: 20 },
  { id: 'science_biology', name: 'الأحياء', category: 'العلوم الطبيعية', track: 'national', periods: 4, load: 20 },
  { id: 'science_earth_space', name: 'علم الأرض والفضاء والجيولوجيا', category: 'العلوم الطبيعية', track: 'national', periods: 3, load: 22 },
  { id: 'science_ecology', name: 'علم البيئة', category: 'العلوم الطبيعية', track: 'national', periods: 3, load: 22 },
  { id: 'intl_sci_general', name: 'Integrated Science', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 20 },
  { id: 'intl_sci_physics', name: 'Physics (Intl)', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 20 },
  { id: 'intl_sci_chemistry', name: 'Chemistry (Intl)', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 20 },
  { id: 'intl_sci_biology', name: 'Biology (Intl)', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 20 },
  { id: 'intl_sci_ap_physics1', name: 'AP Physics 1 & 2', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 18 },
  { id: 'intl_sci_ap_physics_c', name: 'AP Physics C (Mech / E&M)', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 18 },
  { id: 'intl_sci_ap_chemistry', name: 'AP Chemistry', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 18 },
  { id: 'intl_sci_ap_biology', name: 'AP Biology', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 18 },
  { id: 'intl_sci_ap_env', name: 'AP Environmental Science', category: 'العلوم الطبيعية', track: 'international', periods: 4, load: 18 },

  // 3. اللغة العربية وآدابها (Arabic Language)
  { id: 'lang_arabic_primary', name: 'لغتي الجميلة (المرحلة الابتدائية)', category: 'اللغة العربية', track: 'national', periods: 6, load: 20 },
  { id: 'lang_arabic_middle', name: 'لغتي الخالدة (المرحلة المتوسطة)', category: 'اللغة العربية', track: 'national', periods: 5, load: 20 },
  { id: 'lang_arabic_high', name: 'اللغة العربية والدراسات اللغوية (ثانوي)', category: 'اللغة العربية', track: 'national', periods: 4, load: 20 },
  { id: 'lang_arabic_rhetoric', name: 'البلاغة والنقد', category: 'اللغة العربية', track: 'national', periods: 3, load: 22 },
  { id: 'lang_arabic_literature', name: 'الأدب العربي وتاريخه', category: 'اللغة العربية', track: 'national', periods: 3, load: 22 },
  { id: 'lang_arabic_afl', name: 'اللغة العربية للناطقين بغيرها (AFL)', category: 'اللغة العربية', track: 'international', periods: 4, load: 20 },

  // 4. اللغة الإنجليزية واللغات الأجنبية (English & World Languages)
  { id: 'lang_english', name: 'اللغة الإنجليزية (English Language)', category: 'اللغة الإنجليزية واللغات', track: 'both', periods: 5, load: 20 },
  { id: 'intl_ela_primary', name: 'English Language Arts (ELA - Primary)', category: 'اللغة الإنجليزية واللغات', track: 'international', periods: 6, load: 20 },
  { id: 'intl_ela_middle', name: 'English Language Arts (ELA - Middle)', category: 'اللغة الإنجليزية واللغات', track: 'international', periods: 5, load: 20 },
  { id: 'intl_eng_literature', name: 'English Literature & Composition', category: 'اللغة الإنجليزية واللغات', track: 'international', periods: 5, load: 20 },
  { id: 'intl_ap_eng_lang', name: 'AP English Language & Composition', category: 'اللغة الإنجليزية واللغات', track: 'international', periods: 4, load: 18 },
  { id: 'intl_ap_eng_lit', name: 'AP English Literature', category: 'اللغة الإنجليزية واللغات', track: 'international', periods: 4, load: 18 },
  { id: 'intl_toefl_ielts_prep', name: 'IELTS / TOEFL English Prep', category: 'اللغة الإنجليزية واللغات', track: 'international', periods: 3, load: 20 },
  { id: 'lang_french', name: 'اللغة الفرنسية (French - FLE)', category: 'اللغة الإنجليزية واللغات', track: 'both', periods: 2, load: 24 },
  { id: 'lang_chinese', name: 'اللغة الصينية (Mandarin Chinese)', category: 'اللغة الإنجليزية واللغات', track: 'both', periods: 2, load: 24 },
  { id: 'lang_spanish', name: 'اللغة الإسبانية (Spanish)', category: 'اللغة الإنجليزية واللغات', track: 'both', periods: 2, load: 24 },
  { id: 'lang_german', name: 'اللغة الألمانية (German)', category: 'اللغة الإنجليزية واللغات', track: 'both', periods: 2, load: 24 },

  // 5. العلوم الشرعية والدراسات الإسلامية (Islamic Studies)
  { id: 'islamic_quran', name: 'القرآن الكريم والتجويد والتلاوة', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'both', periods: 4, load: 22 },
  { id: 'islamic_studies', name: 'الدراسات الإسلامية العامة', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'both', periods: 4, load: 22 },
  { id: 'islamic_tawheed', name: 'التوحيد والعقيدة', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'national', periods: 2, load: 24 },
  { id: 'islamic_fiqh', name: 'الفقه والسلوك', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'national', periods: 2, load: 24 },
  { id: 'islamic_tafseer', name: 'التفسير وعلوم القرآن', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'national', periods: 2, load: 24 },
  { id: 'islamic_hadith', name: 'الحديث والثقافة الإسلامية', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'national', periods: 2, load: 24 },
  { id: 'intl_islamic_en', name: 'Islamic Studies (in English)', category: 'العلوم الشرعية والدراسات الإسلامية', track: 'international', periods: 3, load: 22 },

  // 6. الحاسب والتقنية والذكاء الاصطناعي (Tech, AI & Computer Science)
  { id: 'tech_digital_skills', name: 'المهارات الرقمية', category: 'التقنية والذكاء الاصطناعي', track: 'national', periods: 2, load: 22 },
  { id: 'tech_computer', name: 'الحاسب وتقنية المعلومات', category: 'التقنية والذكاء الاصطناعي', track: 'both', periods: 3, load: 22 },
  { id: 'tech_ai_data', name: 'علم البيانات والذكاء الاصطناعي (AI & Data Science)', category: 'التقنية والذكاء الاصطناعي', track: 'both', periods: 3, load: 20 },
  { id: 'tech_cybersecurity', name: 'الأمن السيبراني (Cybersecurity)', category: 'التقنية والذكاء الاصطناعي', track: 'both', periods: 3, load: 20 },
  { id: 'tech_programming', name: 'البرمجة وتطوير التطبيقات', category: 'التقنية والذكاء الاصطناعي', track: 'both', periods: 3, load: 20 },
  { id: 'tech_robotics', name: 'الروبوت وهندسة الأنظمة الذكية', category: 'التقنية والذكاء الاصطناعي', track: 'both', periods: 2, load: 22 },
  { id: 'tech_iot', name: 'إنترنت الأشياء والأنظمة المدمجة (IoT)', category: 'التقنية والذكاء الاصطناعي', track: 'both', periods: 2, load: 22 },
  { id: 'intl_cs_ap_a', name: 'AP Computer Science A (Java)', category: 'التقنية والذكاء الاصطناعي', track: 'international', periods: 4, load: 18 },
  { id: 'intl_cs_ap_principles', name: 'AP Computer Science Principles', category: 'التقنية والذكاء الاصطناعي', track: 'international', periods: 4, load: 18 },
  { id: 'intl_stem_engineering', name: 'STEM Robotics & Engineering Design', category: 'التقنية والذكاء الاصطناعي', track: 'international', periods: 3, load: 20 },

  // 7. العلوم الاجتماعية والإنسانية (Social Studies & Humanities)
  { id: 'soc_social_studies', name: 'الدراسات الاجتماعية والمواطنة', category: 'العلوم الاجتماعية والإنسانية', track: 'national', periods: 3, load: 22 },
  { id: 'soc_history', name: 'التاريخ الوطني والعالمي', category: 'العلوم الاجتماعية والإنسانية', track: 'national', periods: 2, load: 24 },
  { id: 'soc_geography', name: 'الجغرافيا ونظم المعلومات الجغرافية', category: 'العلوم الاجتماعية والإنسانية', track: 'national', periods: 2, load: 24 },
  { id: 'soc_critical_thinking', name: 'التفكير الناقد والفلسفة', category: 'العلوم الاجتماعية والإنسانية', track: 'both', periods: 2, load: 22 },
  { id: 'soc_life_skills', name: 'المهارات الحياتية والأسرية', category: 'العلوم الاجتماعية والإنسانية', track: 'national', periods: 2, load: 24 },
  { id: 'soc_psychology', name: 'علم النفس والاجتماع', category: 'العلوم الاجتماعية والإنسانية', track: 'both', periods: 3, load: 22 },
  { id: 'intl_soc_world_history', name: 'AP World History / World History', category: 'العلوم الاجتماعية والإنسانية', track: 'international', periods: 4, load: 18 },
  { id: 'intl_soc_human_geo', name: 'AP Human Geography / Global Studies', category: 'العلوم الاجتماعية والإنسانية', track: 'international', periods: 4, load: 18 },
  { id: 'intl_soc_psychology', name: 'AP Psychology', category: 'العلوم الاجتماعية والإنسانية', track: 'international', periods: 3, load: 18 },
  { id: 'intl_soc_mun', name: 'Model United Nations (MUN) & Debate', category: 'العلوم الاجتماعية والإنسانية', track: 'international', periods: 2, load: 22 },

  // 8. العلوم الإدارية والمالية (Business, Finance & Economics)
  { id: 'soc_business', name: 'إدارة الأعمال والمشاريع', category: 'العلوم الإدارية والمالية', track: 'both', periods: 3, load: 22 },
  { id: 'soc_finance', name: 'مبادئ الاقتصاد والمالية والاستثمار', category: 'العلوم الإدارية والمالية', track: 'both', periods: 3, load: 22 },
  { id: 'soc_accounting', name: 'المحاسبة والتقارير المالية', category: 'العلوم الإدارية والمالية', track: 'both', periods: 3, load: 22 },
  { id: 'soc_law', name: 'مبادئ القانون والأنظمة', category: 'العلوم الإدارية والمالية', track: 'national', periods: 2, load: 24 },
  { id: 'soc_entrepreneurship', name: 'ريادة الأعمال والابتكار المؤسسي', category: 'العلوم الإدارية والمالية', track: 'both', periods: 2, load: 24 },
  { id: 'intl_econ_ap_macro', name: 'AP Macroeconomics', category: 'العلوم الإدارية والمالية', track: 'international', periods: 3, load: 18 },
  { id: 'intl_econ_ap_micro', name: 'AP Microeconomics', category: 'العلوم الإدارية والمالية', track: 'international', periods: 3, load: 18 },

  // 9. الفنون والتربية البدنية والتصميم (Arts, PE & Design)
  { id: 'art_fine_arts', name: 'التربية الفنية والتصميم', category: 'الفنون والتربية البدنية', track: 'both', periods: 2, load: 24 },
  { id: 'art_graphic_design', name: 'التصميم الجرافيكي والوسائط الرقمية', category: 'الفنون والتربية البدنية', track: 'both', periods: 2, load: 24 },
  { id: 'pe_physical', name: 'التربية البدنية والدفاع عن النفس', category: 'الفنون والتربية البدنية', track: 'both', periods: 2, load: 24 },
  { id: 'pe_health_fitness', name: 'اللياقة البدنية والصحة الرياضية', category: 'الفنون والتربية البدنية', track: 'both', periods: 2, load: 24 },

  // 10. خيار مخصص
  { id: 'custom_subject', name: 'مادة أخرى (تحديد يدوي)', category: 'أخرى', track: 'both', periods: 3, load: 20 }
];

// Comprehensive Subject Quotas for Resource Allocation & Staff Balance Analysis
export const STANDARD_SUBJECT_QUOTAS = [
  // مسار أهلي ومواد مشتركة
  { subject: 'الرياضيات العامة', track: 'national', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'الجبر والهندسة', track: 'national', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'التفاضل والتكامل', track: 'national', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'الإحصاء والاحتمالات', track: 'national', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'الفيزياء', track: 'national', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'الكيمياء', track: 'national', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'الأحياء والعلوم', track: 'national', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'علم الأرض والفضاء والجيولوجيا', track: 'national', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'علم البيئة', track: 'national', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'لغتي الجميلة (ابتدائي)', track: 'national', periodsPerClass: 6, standardTeacherLoad: 20 },
  { subject: 'لغتي الخالدة (متوسط)', track: 'national', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'اللغة العربية والدراسات اللغوية', track: 'national', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'البلاغة والنقد والأدب', track: 'national', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'اللغة الإنجليزية (English)', track: 'both', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'اللغة الفرنسية (French)', track: 'both', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'اللغة الصينية (Chinese)', track: 'both', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'القرآن الكريم والتجويد', track: 'both', periodsPerClass: 4, standardTeacherLoad: 22 },
  { subject: 'الدراسات الإسلامية (توحيد/فقه/حديث/تفسير)', track: 'both', periodsPerClass: 4, standardTeacherLoad: 22 },
  { subject: 'المهارات الرقمية والحاسب', track: 'both', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'علم البيانات والذكاء الاصطناعي', track: 'both', periodsPerClass: 3, standardTeacherLoad: 20 },
  { subject: 'الأمن السيبراني والبرمجة', track: 'both', periodsPerClass: 3, standardTeacherLoad: 20 },
  { subject: 'الروبوت وهندسة الأنظمة الذكية', track: 'both', periodsPerClass: 2, standardTeacherLoad: 22 },
  { subject: 'الدراسات الاجتماعية والمواطنة والتاريخ', track: 'national', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'الجغرافيا ونظم المعلومات', track: 'national', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'التفكير الناقد والفلسفة', track: 'both', periodsPerClass: 2, standardTeacherLoad: 22 },
  { subject: 'المهارات الحياتية والأسرية', track: 'national', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'إدارة الأعمال والمشاريع', track: 'both', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'مبادئ الاقتصاد والمالية والاستثمار', track: 'both', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'المحاسبة والتقارير المالية', track: 'both', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'القانون والأنظمة', track: 'national', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'ريادة الأعمال والابتكار', track: 'both', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'التربية الفنية والتصميم', track: 'both', periodsPerClass: 2, standardTeacherLoad: 24 },
  { subject: 'التربية البدنية والدفاع عن النفس', track: 'both', periodsPerClass: 2, standardTeacherLoad: 24 },

  // مسار دولي (International & AP Tracks)
  { subject: 'English Language Arts (ELA)', track: 'international', periodsPerClass: 6, standardTeacherLoad: 20 },
  { subject: 'English Literature & Composition', track: 'international', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'AP English Language & Literature', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'Mathematics (Intl / Algebra & Geometry)', track: 'international', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'Pre-Calculus & Calculus', track: 'international', periodsPerClass: 5, standardTeacherLoad: 20 },
  { subject: 'AP Calculus (AB / BC)', track: 'international', periodsPerClass: 5, standardTeacherLoad: 18 },
  { subject: 'AP Statistics', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'SAT / ACT Test Prep (Math & English)', track: 'international', periodsPerClass: 3, standardTeacherLoad: 20 },
  { subject: 'IELTS / TOEFL English Prep', track: 'international', periodsPerClass: 3, standardTeacherLoad: 20 },
  { subject: 'Integrated Science (Intl)', track: 'international', periodsPerClass: 4, standardTeacherLoad: 20 },
  { subject: 'Physics (Intl / AP Physics 1, 2, C)', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'Chemistry (Intl / AP Chemistry)', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'Biology (Intl / AP Biology)', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'AP Environmental Science', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'AP Computer Science (A & Principles)', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'STEM Robotics & Engineering Design', track: 'international', periodsPerClass: 3, standardTeacherLoad: 20 },
  { subject: 'AP World History & Human Geography', track: 'international', periodsPerClass: 4, standardTeacherLoad: 18 },
  { subject: 'AP Macroeconomics & Microeconomics', track: 'international', periodsPerClass: 3, standardTeacherLoad: 18 },
  { subject: 'AP Psychology', track: 'international', periodsPerClass: 3, standardTeacherLoad: 18 },
  { subject: 'Model United Nations (MUN) & Debate', track: 'international', periodsPerClass: 2, standardTeacherLoad: 22 },
  { subject: 'Islamic Studies (in English)', track: 'international', periodsPerClass: 3, standardTeacherLoad: 22 },
  { subject: 'Arabic as a Foreign Language (AFL)', track: 'international', periodsPerClass: 4, standardTeacherLoad: 20 }
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
