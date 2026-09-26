/**
 * aiWorksheetGenerator.js
 * محرك الذكاء الاصطناعي لتوليد أوراق العمل التفاعلية والمنهجية
 * يربط الأسئلة بدقة بالأهداف السلوكية للدرس، مع التحكم في مستويات بلوم والرموز (عربية / إنجليزية).
 */

// مستويات بلوم المعرفية
export const BLOOM_LEVELS = {
  REMEMBER: { id: 'remember', ar: 'تذكر واسترجاع', en: 'Remembering', verbs: ['يعرف', 'يذكر', 'يعدد', 'يسمي', 'يسترجع', 'يحدد'] },
  UNDERSTAND: { id: 'understand', ar: 'فهم واستيعاب', en: 'Understanding', verbs: ['يوضح', 'يشرح', 'يفسر', 'يميز', 'يعلل', 'يلخص', 'يستخلص'] },
  APPLY: { id: 'apply', ar: 'تطبيق وحل مشكلات', en: 'Applying', verbs: ['يطبق', 'يحسب', 'يحل', 'يوظف', 'يمثل بيانيا', 'يستعمل', 'يركب'] },
  ANALYZE: { id: 'analyze', ar: 'تحليل وتفكير ناقد', en: 'Analyzing', verbs: ['يقارن', 'يحلل', 'يصنف', 'يستنتج', 'يفرق بين', 'يربط بين'] },
  EVALUATE: { id: 'evaluate', ar: 'تقويم وإبداع', en: 'Evaluating & Creating', verbs: ['يقيم', 'ينقد', 'يقترح', 'يصمم', 'يبتكر', 'يستنبط'] }
};

// أنماط الأسئلة
export const QUESTION_TYPES = {
  MCQ: { id: 'mcq', label: 'اختيار من متعدد', icon: 'CheckCircle2' },
  TRUE_FALSE: { id: 'true_false', label: 'صح أو خطأ', icon: 'CheckSquare' },
  FILL_BLANK: { id: 'fill_blank', label: 'إكمال الفراغ والمصطلحات', icon: 'Edit3' },
  MATCHING: { id: 'matching', label: 'المزاوجة والربط (صل بين أ و ب)', icon: 'ArrowLeftRight' },
  PROBLEM_SOLVING: { id: 'problem_solving', label: 'مسائل وتفكير ناقد (مقالي)', icon: 'HelpCircle' }
};

// تحويل الأرقام إلى أرقام عربية مشرقية (١، ٢، ٣) أو غربية (1, 2, 3)
export function formatNumberBySymbol(num, symbolLang = 'ar') {
  if (symbolLang !== 'ar') return String(num);
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, d => arabicNumerals[d]);
}

// التحقق مما إذا كانت المدرسة أو المسار يعتمد المنهج الدولي (American / British / IB / STEM)
export function isInternationalSchool({
  isInternational = false,
  curriculumTrack = 'national',
  curriculumType = '',
  schoolName = '',
  track = ''
} = {}) {
  if (isInternational === true) return true;
  if (curriculumTrack === 'international' || curriculumType === 'international' || track === 'international') return true;
  const combined = `${schoolName || ''} ${track || ''} ${curriculumType || ''}`.toLowerCase();
  return /international|american|british|diploma|igcse|ib|stem|عالمي|عالمية|الدولي|الدولية/.test(combined);
}

// قوالب متخصصة للمواد لتوليد أسئلة واقعية ذات صلة بالدرس والأهداف
const SUBJECT_GENERATION_MATRICES = {
  math: {
    keywords: ['رياضيات', 'جبر', 'هندسة', 'حساب', 'تفاضل', 'تكامل', 'مثلثات', 'إحصاء', 'احتمالات', 'Math'],
    generateQuestion: (objective, bloomLevel, type, symbolLang, qIndex, isInternational = false, showObjectives = false) => {
      const isAr = symbolLang === 'ar';
      const isFullEn = Boolean(isInternational);
      const varX = isAr ? 'س' : 'x';
      const varY = isAr ? 'ص' : 'y';
      const varZ = isAr ? 'ع' : 'z';
      const objPrefix = showObjectives ? (isFullEn ? `[Objective: ${objective}] ` : `[الهدف: ${objective}] `) : '';
      const objTag = showObjectives ? (isFullEn ? ` [Objective: ${objective}]` : ` [الهدف: ${objective}]`) : '';

      if (type === 'mcq') {
        if (bloomLevel.id === 'remember' || bloomLevel.id === 'understand') {
          return {
            question: isFullEn 
              ? `${objPrefix}Which mathematical expression represents a linear equation in variables (${varX}) and (${varY})?`
              : `${objPrefix}ما هو التعبير الرياضي الصحيح الذي يمثل العلاقة الخطية بالمتغيرين (${varX}) و (${varY})؟`,
            options: isFullEn ? [
              `A) $${varY} = m${varX} + b$ (where m is slope, b is y-intercept)`,
              `B) $${varY} = ${varX}^2 + 4$`,
              `C) $\\frac{${varY}}{${varX}} = \\sqrt{${varX}}$`,
              `D) $${varY} = \\frac{1}{${varX} - 1}$`
            ] : [
              `أ) $${varY} = m${varX} + b$ (حيث m يمثل الميل، و b المقطع من المحور ${varY})`,
              `ب) $${varY} = ${varX}^2 + 4$`,
              `جـ) $\\frac{${varY}}{${varX}} = \\sqrt{${varX}}$`,
              `د) $${varY} = \\frac{1}{${varX} - 1}$`
            ],
            correctOption: 0,
            correctAnswer: `$${varY} = m${varX} + b$`,
            explanation: isFullEn 
              ? `A linear equation is of degree one where the power of variable (${varX}) equals 1.`
              : `المعادلة الخطية تكون من الدرجة الأولى بحيث يكون أس المتغير (${varX}) مساوياً لواحد.`,
            points: 1
          };
        } else {
          // تطبيق / تحليل
          const valA = (qIndex + 2) * 3;
          const valB = (qIndex + 1) * 2;
          const sol = valA - valB;
          const numA = isAr ? formatNumberBySymbol(valA, 'ar') : valA;
          const numB = isAr ? formatNumberBySymbol(valB, 'ar') : valB;
          const numSol = isAr ? formatNumberBySymbol(sol, 'ar') : sol;
          const numSol2 = isAr ? formatNumberBySymbol(sol + 2, 'ar') : (sol + 2);
          const numSolSub1 = isAr ? formatNumberBySymbol(sol - 1, 'ar') : (sol - 1);
          const numSum = isAr ? formatNumberBySymbol(valA + valB, 'ar') : (valA + valB);

          return {
            question: isFullEn
              ? `${objPrefix}Given the equation: $${varX} + ${valB} = ${valA}$, what is the exact value of variable (${varX})?`
              : `${objPrefix}إذا كانت المعادلة الرياضية هي: $${varX} + ${valB} = ${valA}$، فما هي قيمة المتغير (${varX})؟`,
            options: isFullEn ? [
              `A) $${varX} = ${sol}$`,
              `B) $${varX} = ${sol + 2}$`,
              `C) $${varX} = ${sol - 1}$`,
              `D) $${varX} = ${valA + valB}$`
            ] : [
              `أ) $${varX} = ${sol}$`,
              `ب) $${varX} = ${sol + 2}$`,
              `جـ) $${varX} = ${sol - 1}$`,
              `د) $${varX} = ${valA + valB}$`
            ],
            correctOption: 0,
            correctAnswer: `$${varX} = ${sol}$`,
            explanation: isFullEn
              ? `Subtracting ${valB} from both sides yields: $${varX} = ${valA} - ${valB} = ${sol}$.`
              : `بطرح ${valB} من طرفي المعادلة نجد أن: $${varX} = ${valA} - ${valB} = ${sol}$.`,
            points: 2
          };
        }
      } else if (type === 'true_false') {
        const isTrue = qIndex % 2 === 0;
        return {
          question: isFullEn
            ? (isTrue
                ? `${objPrefix}In a function, each input in the domain maps to exactly one output in the range.`
                : `${objPrefix}In a linear relation, the slope can never equal zero under any conditions.`)
            : (isTrue 
                ? `${objPrefix}في أي دالة رياضية، لكل مدخلة في المجال (${varX}) قيمة مخرجة واحدة فقط في المدى (${varY}).`
                : `${objPrefix}في أي علاقة خطية، لا يمكن أن يكون ميل المستقيم (${varX} أو ${varY}) مساوياً للصفر مطلقاً.`),
          options: isFullEn ? ['True', 'False'] : ['صح (True)', 'خطأ (False)'],
          correctOption: isTrue ? 0 : 1,
          correctAnswer: isFullEn ? (isTrue ? 'True' : 'False') : (isTrue ? 'صح' : 'خطأ'),
          explanation: isFullEn
            ? (isTrue ? 'Statement is true: this is the fundamental definition of a function.' : 'Statement is false: horizontal lines have a slope of zero.')
            : (isTrue ? 'العبارة صحيحة؛ هذا هو التعريف الرياضي الدقيق للدالة.' : `العبارة خاطئة؛ المستقيم الأفقي له ميل يساوي صفراً (${isAr ? 'م = ٠' : 'm = 0'}).`),
          points: 1
        };
      } else if (type === 'fill_blank') {
        return {
          question: isFullEn
            ? `${objPrefix}Fill in the blank: The point where the graph intersects the (${varY})-axis is termed the .................... .`
            : `${objPrefix}أكمل الفراغ بما يناسبه: يُطلق على النقطة التي يتقاطع عندها التمثيل البياني للمعادلة مع المحور (${varY}) اسم .................... .`,
          correctAnswer: isFullEn ? 'y-intercept' : (isAr ? 'المقطع الصادي' : `المقطع من المحور ${varY} (${varY}-intercept)`),
          explanation: isFullEn 
            ? 'The y-intercept represents the value of y when x = 0.'
            : (isAr ? 'المقطع الصادي هو قيمة (ص) عندما تكون س = ٠.' : `المقطع الصادي هو قيمة المتغير (${varY}) عندما تكون ${varX} = 0.`),
          points: 1
        };
      } else if (type === 'matching') {
        return {
          question: isFullEn
            ? `Match each mathematical concept in Column (A) with its corresponding definition in Column (B)${objTag}:`
            : `زاوج بين كل مفهوم رياضي في العمود (أ) وما يطابقه من تعريف أو صيغة في العمود (ب)${objTag}:`,
          columnA: isFullEn ? [
            { id: '1', num: '1', text: `Slope of a line (m)` },
            { id: '2', num: '2', text: `Linear Equation` },
            { id: '3', num: '3', text: `y-intercept (${varY})` },
            { id: '4', num: '4', text: `Coordinate Plane` }
          ] : (isAr ? [
            { id: '1', num: '١', text: `ميل المستقيم (${varX}، ${varY})` },
            { id: '2', num: '٢', text: `المعادلة الخطية` },
            { id: '3', num: '٣', text: `المقطع الصادي (${varY})` },
            { id: '4', num: '٤', text: `المستوى الإحداثي` }
          ] : [
            { id: '1', num: '1', text: `ميل المستقيم (Slope: m)` },
            { id: '2', num: '2', text: `المعادلة الخطية (Linear Equation: ${varY} = m${varX} + b)` },
            { id: '3', num: '3', text: `المقطع من المحور (${varY}-intercept)` },
            { id: '4', num: '4', text: `المستوى الإحداثي (${varX}-${varY} Plane)` }
          ]),
          columnB: isFullEn ? [
            { id: 'a', label: 'A', text: `The value of ${varY} at intersection when ${varX} = 0.` },
            { id: 'b', label: 'B', text: `Ratio of vertical change (Δ${varY}) to horizontal change (Δ${varX}).` },
            { id: 'c', label: 'C', text: `Grid formed by two perpendicular axes (${varX} and ${varY}).` },
            { id: 'd', label: 'D', text: `An algebraic equation of degree one that graphs as a straight line.` }
          ] : (isAr ? [
            { id: 'a', label: 'أ', text: `قيمة (${varY}) عند نقطة التقاطع عندما تكون ${varX} = ٠.` },
            { id: 'b', label: 'ب', text: `نسبة التغير الرأسي (دلتا ${varY}) إلى التغير الأفقي (دلتا ${varX}).` },
            { id: 'c', label: 'جـ', text: `نظام يتكون من تقاطع مستقيمين متعامدين (محور ${varX} ومحور ${varY}).` },
            { id: 'd', label: 'د', text: `معادلة جبرية من الدرجة الأولى تُمثَّل بيانياً بمستقيم.` }
          ] : [
            { id: 'a', label: 'أ', text: `قيمة (${varY}) عند نقطة التقاطع عندما تكون ${varX} = 0.` },
            { id: 'b', label: 'ب', text: `نسبة التغير الرأسي (Δ${varY}) إلى التغير الأفقي (Δ${varX}).` },
            { id: 'c', label: 'جـ', text: `نظام محاور متعامدة يتكون من المحور (${varX}) والمحور (${varY}).` },
            { id: 'd', label: 'د', text: `معادلة جبرية من الدرجة الأولى تُمثَّل بيانياً بمستقيم.` }
          ]),
          correctAnswer: isFullEn
            ? 'Matching Key:\n(1 ➔ B), (2 ➔ D), (3 ➔ A), (4 ➔ C)'
            : (isAr ? 'دليل المزاوجة الصحيح:\n(١ ➔ ب)، (٢ ➔ د)، (٣ ➔ أ)، (٤ ➔ جـ)' : 'دليل المزاوجة الصحيح:\n(1 ➔ ب)، (2 ➔ د)، (3 ➔ أ)، (4 ➔ جـ)'),
          explanation: isFullEn
            ? `Slope = Δ${varY}/Δ${varX}, linear equation graphs as line, y-intercept is value at ${varX}=0.`
            : `الميل = التغير الرأسي/الأفقي (Δ${varY}/Δ${varX})، المعادلة الخطية تمثل بمستقيم، المقطع الصادي قيمة ${varY} عند ${varX} = ${isAr ? '٠' : '0'}.`,
          points: 2
        };
      } else {
        // Problem Solving
        return {
          question: isFullEn
            ? `Application Problem${objTag}:\n` +
              `Find the solution set for the following equation, showing step-by-step mathematical working:\n` +
              `$$2(${varX} - 3) + 4 = 14$$`
            : `مسألة تطبيقية (تفكير وحل مشكلات)${objTag}:\n` +
              `أوجد مجموعة حل المعادلة التالية موضحاً خطوات الحل الرياضي بدقة:\n` +
              `$$2(${varX} - 3) + 4 = 14$$`,
          correctAnswer: isFullEn 
            ? `Step-by-step Solution:\n1) Expand brackets: $2${varX} - 6 + 4 = 14$\n2) Simplify: $2${varX} - 2 = 14$\n3) Add 2 to both sides: $2${varX} = 16$\n4) Divide by 2: $${varX} = 8$`
            : `خطوات الحل النموذجي:\n1) فك الأقواس: $2${varX} - 6 + 4 = 14$\n2) التبسيط: $2${varX} - 2 = 14$\n3) إضافة 2 للطرفين: $2${varX} = 16$\n4) القسمة على 2: $${varX} = 8$`,
          explanation: isFullEn 
            ? 'Apply the distributive property, combine like terms, and isolate the variable.'
            : 'تطبيق خاصية التوزيع ثم جمع الحدود المتشابهة ثم عزل المتغير.',
          points: 3
        };
      }
    }
  },

  chemistry: {
    keywords: ['كيمياء', 'الكيمياء', 'Chemistry', 'كيميائي', 'تفاعلات', 'مركبات'],
    generateQuestion: (objective, bloomLevel, type, symbolLang, qIndex, isInternational = false, showObjectives = false) => {
      const isFullEn = Boolean(isInternational);
      const objPrefix = showObjectives ? (isFullEn ? `[Objective: ${objective}] ` : `[الهدف: ${objective}] `) : '';
      const objTag = showObjectives ? (isFullEn ? ` [Objective: ${objective}]` : ` [الهدف: ${objective}]`) : '';

      if (type === 'mcq') {
        return {
          question: isFullEn
            ? `${objPrefix}Which of the following balanced chemical equations correctly represents the combustion of methane in oxygen?`
            : `${objPrefix}أي المعادلات الكيميائية الموزونة التالية تمثل تفاعل احتراق غاز الميثان في الأكسجين بشكل صحيح ودقيق؟`,
          options: isFullEn ? [
            `A) $\\ce{CH4 + 2O2 -> CO2 + 2H2O}$`,
            `B) $\\ce{CH4 + O2 -> CO + H2O}$`,
            `C) $\\ce{2CH4 + 3O2 -> 2CO2 + 4H2}$`,
            `D) $\\ce{CH4 + 4O2 -> CO4 + 2H2O}$`
          ] : [
            `أ) $\\ce{CH4 + 2O2 -> CO2 + 2H2O}$`,
            `ب) $\\ce{CH4 + O2 -> CO + H2O}$`,
            `جـ) $\\ce{2CH4 + 3O2 -> 2CO2 + 4H2}$`,
            `د) $\\ce{CH4 + 4O2 -> CO4 + 2H2O}$`
          ],
          correctOption: 0,
          correctAnswer: `$\\ce{CH4 + 2O2 -> CO2 + 2H2O}$`,
          explanation: isFullEn
            ? `Combustion of methane consumes 1 molecule of CH4 and 2 molecules of O2 to form 1 molecule of CO2 and 2 molecules of H2O.`
            : `احتراق غاز الميثان يستهلك جزيئاً واحداً من الميثان وجزيئين من الأكسجين لإنتاج جزيء ثاني أكسيد الكربون وجزيئين ماء طبقاً لحفظ الكتلة.`,
          points: 1
        };
      } else if (type === 'true_false') {
        const isTrue = qIndex % 2 === 0;
        return {
          question: isFullEn
            ? (isTrue
                ? `${objPrefix}In pure water at 25°C, $[\\ce{H3O+}] = [\\ce{OH-}] = 1.0 \\times 10^{-7} \\text{ M}$, indicating a neutral solution.`
                : `${objPrefix}The decomposition of limestone, $\\ce{CaCO3 ->[\\Delta] CaO + CO2 ^}$, results in no gas production.`)
            : (isTrue
                ? `${objPrefix}في الماء النقي عند درجة حرارة $25^\\circ\\text{C}$، يكون $[\\ce{H3O+}] = [\\ce{OH-}] = 1.0 \\times 10^{-7} \\text{ M}$ مما يدل على تعادل المحلول.`
                : `${objPrefix}عند تفكك كربونات الكالسيوم بالحرارة $\\ce{CaCO3 ->[\\Delta] CaO + CO2 ^}$ لا ينتج أي غاز.`),
          options: isFullEn ? ['True', 'False'] : ['صح (True)', 'خطأ (False)'],
          correctOption: isTrue ? 0 : 1,
          correctAnswer: isFullEn ? (isTrue ? 'True' : 'False') : (isTrue ? 'صح' : 'خطأ'),
          explanation: isFullEn
            ? (isTrue ? 'Pure water is neutral with pH = 7.' : 'Statement is false: carbon dioxide gas is evolved (CO2 ^).')
            : (isTrue ? 'الماء النقي متعادل وقيمة الرقم الهيدروجيني pH = 7.' : 'العبارة خاطئة؛ التفاعل ينتج غاز ثاني أكسيد الكربون $\\ce{CO2 ^}$.'),
          points: 1
        };
      } else if (type === 'fill_blank') {
        return {
          question: isFullEn
            ? `Fill in the chemical blank${objTag}:\nIn the acid-base neutralization reaction: $\\ce{HCl (aq) + NaOH (aq) -> ............ + H2O (l)}$, the produced salt is:`
            : `أكمل الفراغ بالصيغة الكيميائية المناسبة${objTag}:\nفي تفاعل التعادل بين حمض الهيدروكلوريك وهيدروكسيد الصوديوم: $\\ce{HCl (aq) + NaOH (aq) -> ............ + H2O (l)}$، الملح الناتج هو:`,
          correctAnswer: `$\\ce{NaCl (aq)}$`,
          explanation: isFullEn
            ? 'Reaction of hydrochloric acid with sodium hydroxide produces sodium chloride (table salt) and water.'
            : 'تفاعل حمض الهيدروكلوريك مع هيدروكسيد الصوديوم ينتج كلوريد الصوديوم $\\ce{NaCl}$ والماء.',
          points: 1
        };
      } else if (type === 'matching') {
        return {
          question: isFullEn
            ? `Match each chemical formula in Column (A) with its property or use in Column (B)${objTag}:`
            : `صل بين كل صيغة كيميائية في العمود (أ) وما يناسبها من استخدام أو خاصية في العمود (ب)${objTag}:`,
          columnA: isFullEn ? [
            { id: '1', num: '1', text: `$\\ce{H2SO4}$` },
            { id: '2', num: '2', text: `$\\ce{CaCO3}$` },
            { id: '3', num: '3', text: `$\\ce{C6H12O6}$` },
            { id: '4', num: '4', text: `$\\ce{NaOH}$` }
          ] : [
            { id: '1', num: '١', text: `حمض الكبريتيك $\\ce{H2SO4}$` },
            { id: '2', num: '٢', text: `كربونات الكالسيوم $\\ce{CaCO3}$` },
            { id: '3', num: '٣', text: `الجلوكوز $\\ce{C6H12O6}$` },
            { id: '4', num: '٤', text: `هيدروكسيد الصوديوم $\\ce{NaOH}$` }
          ],
          columnB: isFullEn ? [
            { id: 'a', label: 'A', text: 'Strong mineral acid used in lead-acid automotive batteries.' },
            { id: 'b', label: 'B', text: 'Primary chemical component of limestone, marble, and eggshells.' },
            { id: 'c', label: 'C', text: 'Essential monosaccharide sugar powering cellular respiration.' },
            { id: 'd', label: 'D', text: 'Caustic alkaline base widely used in soap and paper manufacturing.' }
          ] : [
            { id: 'a', label: 'أ', text: 'حمض قوي مركز يدخل في صناعة بطاريات السيارات والأسمدة.' },
            { id: 'b', label: 'ب', text: 'المكون الرئيسي للحجر الجيري والرخام وأصداف الكائنات الحية.' },
            { id: 'c', label: 'جـ', text: 'سكر أحادي يمثل المصدر الأساسي للطاقة في التنفس الخلوي.' },
            { id: 'd', label: 'د', text: 'قاعدة قلوية كاوية تستخدم في صناعة الصابون والمنظفات.' }
          ],
          correctAnswer: isFullEn
            ? 'Matching Key:\n(1 ➔ A), (2 ➔ B), (3 ➔ C), (4 ➔ D)'
            : 'دليل المزاوجة الصحيح:\n(١ ➔ أ)، (٢ ➔ ب)، (٣ ➔ جـ)، (٤ ➔ د)',
          explanation: isFullEn
            ? 'Chemical compounds mapped to their verified scientific roles.'
            : 'ربط كل صيغة كيميائية باستخداماتها وخواصها العلمية الدقيقة.',
          points: 2
        };
      } else {
        return {
          question: isFullEn
            ? `Chemical Reaction Problem & Balancing${objTag}:\nBalance the following iron oxidation reaction in oxygen:\n$$\\ce{Fe + O2 -> Fe2O3}$$`
            : `مسألة كيميائية في وزن المعادلات والتكافؤ${objTag}:\nقم بوزن معادلة أكسدة الحديد التالية بالتفصيل:\n$$\\ce{Fe + O2 -> Fe2O3}$$`,
          correctAnswer: isFullEn
            ? `Balanced Equation:\n$$\\ce{4Fe (s) + 3O2 (g) -> 2Fe2O3 (s)}$$\nAtom Count: 4 Fe, 6 O on both sides.`
            : `المعادلة الموزونة نموذجياً:\n$$\\ce{4Fe (s) + 3O2 (g) -> 2Fe2O3 (s)}$$\nخطوات الحل: ضبط معاملات المتفاعلات والنواتج ليتساوى عدد ذرات الحديد (4) والأكسجين (6) في الطرفين.`,
          explanation: isFullEn
            ? 'Apply the law of conservation of mass so that atoms of each element are equal.'
            : 'تطبيق قانون حفظ الكتلة لمساواة أعداد ذرات كل عنصر في طرفي التفاعل.',
          points: 3
        };
      }
    }
  },

  science: {
    keywords: ['علوم', 'فيزياء', 'أحياء', 'علم بيئة', 'جيولوجيا', 'طبيعة', 'Science', 'Physics', 'Biology'],
    generateQuestion: (objective, bloomLevel, type, symbolLang, qIndex, isInternational = false, showObjectives = false) => {
      const isAr = symbolLang === 'ar';
      const isFullEn = Boolean(isInternational);
      const unitSpeed = isAr ? 'م/ث' : 'm/s';
      const unitAcc = isAr ? 'م/ث²' : 'm/s²';
      const objPrefix = showObjectives ? (isFullEn ? `[Objective: ${objective}] ` : `[الهدف: ${objective}] `) : '';
      const objTag = showObjectives ? (isFullEn ? ` [Objective: ${objective}]` : ` [الهدف: ${objective}]`) : '';

      if (type === 'mcq') {
        return {
          question: isFullEn
            ? `${objPrefix}What is the scientifically accurate explanation for the phenomenon studied in this lesson?`
            : `${objPrefix}ما هو التفسير العلمي الصحيح للظاهرة المرتبطة بموضوع الدرس؟`,
          options: isFullEn ? [
            `A) Occurrence of state change while total mass is strictly conserved according to Conservation of Mass.`,
            `B) Complete vanishing of energy during transformation without thermal exchange.`,
            `C) Molecules accelerate when temperatures fall below absolute zero.`,
            `D) Spontaneous matter conversion without external applied forces.`
          ] : [
            `أ) حدوث تغير في الحالة الفيزيائية أو الكيميائية مع بقاء الكتلة الكلية محفوظة طبقاً لقانون حفظ المادة.`,
            `ب) تلاشي الطاقة كلياً أثناء التحول دون انبعاث أو امتصاص حراري.`,
            `جـ) زيادة سرعة الجزيئات عند انخفاض درجة الحرارة إلى ما دون الصفر المئوي.`,
            `د) تحول المادة إلى طاقة دون وجود أي قوى مؤثرة.`
          ],
          correctOption: 0,
          correctAnswer: isFullEn 
            ? 'Occurrence of state change while total mass is conserved.'
            : 'حدوث تغير في الحالة الفيزيائية أو الكيميائية مع بقاء الكتلة محفوظة.',
          explanation: isFullEn 
            ? 'The law of conservation of mass and energy states that matter is neither created nor destroyed.'
            : 'قانون حفظ الكتلة والطاقة ينص على أن المادة لا تفنى ولا تستحدث من العدم.',
          points: 1
        };
      } else if (type === 'true_false') {
        const isTrue = qIndex % 2 === 0;
        return {
          question: isFullEn
            ? (isTrue
                ? `${objPrefix}In the International System of Units (SI), the target quantity is measured in standard SI units.`
                : `${objPrefix}Kinetic energy is inversely proportional to mass and velocity.`)
            : (isTrue
                ? `${objPrefix}في النظام الدولي للوحدات (SI)، تقاس الكمية الفيزيائية المستهدفة بالوحدة القياسية المعتمدة عالمياً (${unitSpeed}).`
                : `${objPrefix}تتناسب طاقة الحركة لجسم ما عكسياً مع كتلته وسرعته.`),
          options: isFullEn ? ['True', 'False'] : ['صح (True)', 'خطأ (False)'],
          correctOption: isTrue ? 0 : 1,
          correctAnswer: isFullEn ? (isTrue ? 'True' : 'False') : (isTrue ? 'صح' : 'خطأ'),
          explanation: isFullEn
            ? (isTrue ? 'Statement is true according to international scientific standards.' : 'Statement is false: kinetic energy is directly proportional: $KE = \\frac{1}{2} m v^2$.')
            : (isTrue ? 'العبارة صحيحة ومتوافقة مع المعايير العلمية الدولية.' : `العبارة خاطئة؛ التناسب طردي: $KE = \\frac{1}{2} m v^2$.`),
          points: 1
        };
      } else if (type === 'fill_blank') {
        return {
          question: isFullEn
            ? `Write the accurate scientific term${objTag}:\n(............................): The rate of change of velocity per unit of elapsed time ($a = \\frac{\\Delta v}{\\Delta t}$).`
            : `اكتب المصطلح العلمي المناسب مكان النقط${objTag}:\n(............................): مقدار التغير في السرعة المتجهة مقسوماً على الفترة الزمنية التي حدث خلالها هذا التغير ($a = \\frac{\\Delta v}{\\Delta t}$).`,
          correctAnswer: isFullEn ? 'Acceleration' : (isAr ? 'التسارع (العجلة)' : 'التسارع (Acceleration - a)'),
          explanation: isFullEn
            ? 'Acceleration: $a = \\frac{\\Delta v}{\\Delta t}$.'
            : (isAr ? 'التسارع = التغير في السرعة / التغير في الزمن ($a = \\frac{\\Delta v}{\\Delta t}$).' : 'التسارع = التغير في السرعة / التغير في الزمن ($a = \\frac{\\Delta v}{\\Delta t}$).'),
          points: 1
        };
      } else if (type === 'matching') {
        return {
          question: isFullEn
            ? `Match each scientific concept in Column (A) with its description or SI unit in Column (B)${objTag}:`
            : `صل بين كل مفهوم علمي في العمود (أ) وما يناسبه من دلالة أو وحدة قياس في العمود (ب)${objTag}:`,
          columnA: isFullEn ? [
            { id: '1', num: '1', text: 'Velocity' },
            { id: '2', num: '2', text: 'Acceleration' },
            { id: '3', num: '3', text: 'Conservation of Mass' },
            { id: '4', num: '4', text: 'Kinetic Energy' }
          ] : (isAr ? [
            { id: '1', num: '١', text: 'السرعة المتجهة' },
            { id: '2', num: '٢', text: 'التسارع (العجلة)' },
            { id: '3', num: '٣', text: 'قانون حفظ الكتلة' },
            { id: '4', num: '٤', text: 'الطاقة الحركية' }
          ] : [
            { id: '1', num: '1', text: 'السرعة المتجهة (Velocity: v)' },
            { id: '2', num: '2', text: 'التسارع (Acceleration: a)' },
            { id: '3', num: '3', text: 'قانون حفظ الكتلة (Mass: m)' },
            { id: '4', num: '4', text: 'الطاقة الحركية (Kinetic Energy: KE)' }
          ]),
          columnB: isFullEn ? [
            { id: 'a', label: 'A', text: 'Rate of change of velocity per unit time (m/s²).' },
            { id: 'b', label: 'B', text: 'Energy possessed by an object due to its motion.' },
            { id: 'c', label: 'C', text: 'Displacement per unit time in a specified direction (m/s).' },
            { id: 'd', label: 'D', text: 'Mass is neither created nor destroyed during chemical reaction.' }
          ] : (isAr ? [
            { id: 'a', label: 'أ', text: 'معدل التغير في السرعة المتجهة مقسوماً على زمن التغير (م/ث²).' },
            { id: 'b', label: 'ب', text: 'الطاقة التي يمتلكها الجسم بسبب حركته وتساوي ($KE = \\frac{1}{2} m v^2$).' },
            { id: 'c', label: 'جـ', text: 'الإزاحة المقطوعة خلال وحدة الزمن في اتجاه محدد (م/ث).' },
            { id: 'd', label: 'د', text: 'المادة لا تفنى ولا تستحدث في التفاعل الكيميائي بل تتحول.' }
          ] : [
            { id: 'a', label: 'أ', text: 'معدل التغير في السرعة المتجهة مقسوماً على زمن التغير (m/s²).' },
            { id: 'b', label: 'ب', text: 'الطاقة التي يمتلكها الجسم بسبب حركته وتساوي ($KE = \\frac{1}{2} m v^2$).' },
            { id: 'c', label: 'جـ', text: 'الإزاحة المقطوعة خلال وحدة الزمن في اتجاه محدد (m/s).' },
            { id: 'd', label: 'د', text: 'المادة لا تفنى ولا تستحدث في التفاعل الكيميائي بل تتحول.' }
          ]),
          correctAnswer: isFullEn
            ? 'Matching Key:\n(1 ➔ C), (2 ➔ A), (3 ➔ D), (4 ➔ B)'
            : (isAr ? 'دليل المزاوجة الصحيح:\n(١ ➔ جـ)، (٢ ➔ أ)، (٣ ➔ د)، (٤ ➔ ب)' : 'دليل المزاوجة الصحيح:\n(1 ➔ جـ)، (2 ➔ أ)، (3 ➔ د)، (4 ➔ ب)'),
          explanation: isFullEn
            ? 'Velocity is m/s, Acceleration is m/s², mass is conserved, Kinetic Energy is $KE = \\frac{1}{2}mv^2$.'
            : (isAr ? 'السرعة المتجهة تقاس بـ م/ث، والتسارع بـ م/ث²، وحفظ الكتلة ثبات كتلة المواد، والطاقة الحركية $KE = \\frac{1}{2} m v^2$.' : 'السرعة المتجهة تقاس بـ m/s، والتسارع بـ m/s²، وحفظ الكتلة ثبات كتلة المواد، والطاقة الحركية $KE = \\frac{1}{2} m v^2$.'),
          points: 2
        };
      } else {
        return {
          question: isFullEn
            ? `Inquiry & Scientific Application Question${objTag}:\nExplain the scientific mechanism of this experiment, identifying independent and dependent variables and the final conclusion.`
            : `سؤال التفكير الاستقصائي والتطبيق العملي${objTag}:\nفسر علمياً ما يحدث في التجربة موضحاً العوامل المؤثرة والمتغير المستقل والمتغير التابع، مع ذكر الاستنتاج النهائي.`,
          correctAnswer: isFullEn
            ? 'Model Answer:\n1) Independent variable: Controlled test factor.\n2) Dependent variable: Measured outcome.\n3) Conclusion: Validates hypothesis based on empirical evidence.'
            : 'نموذج الإجابة:\n1) المتغير المستقل: العامل الذي يتحكم فيه الباحث.\n2) المتغير التابع: الظاهرة الناتجة المقاسة.\n3) الاستنتاج: تأكيد صحة الفرضية العلمية استناداً إلى البيانات التجريبية.',
          explanation: isFullEn 
            ? 'Applies rigorous scientific method and controlled inquiry.'
            : 'تطبيق خطوات المنهج العلمي والاستقصاء المقنن.',
          points: 3
        };
      }
    }
  },

  languages: {
    keywords: ['لغتي', 'عربي', 'لغة عربية', 'نحو', 'صرف', 'بلاغة', 'إملاء', 'English', 'اللغة الإنجليزية', 'قراءة', 'نصوص'],
    generateQuestion: (objective, bloomLevel, type, symbolLang, qIndex, isInternational = false, showObjectives = false) => {
      const isEnglishSubject = /english|انجليزي/i.test(objective) || Boolean(isInternational);
      const objPrefix = showObjectives ? (isEnglishSubject ? `[Objective: ${objective}] ` : `[الهدف: ${objective}] `) : '';
      const objTag = showObjectives ? (isEnglishSubject ? ` [Objective: ${objective}]` : ` [الهدف: ${objective}]`) : '';

      if (isEnglishSubject) {
        if (type === 'mcq') {
          return {
            question: `Choose the correct linguistic structure${showObjectives ? ` related to: "${objective}"` : ''}:`,
            options: [
              'A) The student has completed the required assignment successfully.',
              'B) The student have complete the required assignment successfully.',
              'C) The student completed have the required assignment successfully.',
              'D) The student was complete the required assignment successfully.'
            ],
            correctOption: 0,
            correctAnswer: 'A) The student has completed the required assignment successfully.',
            explanation: 'Subject-verb agreement: singular subject "student" takes "has + V3" in present perfect.',
            points: 1
          };
        } else if (type === 'true_false') {
          return {
            question: `${objPrefix}Adjectives always follow the noun in standard English syntax.`,
            options: ['True', 'False'],
            correctOption: 1,
            correctAnswer: 'False',
            explanation: 'In English, attributive adjectives typically precede the noun they modify (e.g., "a brilliant student").',
            points: 1
          };
        } else if (type === 'fill_blank') {
          return {
            question: `Fill in the blank with the appropriate transition word${objTag}:\n"The weather was stormy; ...................., the school continued its interactive digital classes without interruption."`,
            correctAnswer: 'However / Nevertheless',
            explanation: 'Shows contrast between two independent clauses.',
            points: 1
          };
        } else if (type === 'matching') {
          return {
            question: `Match each part of speech in Column (A) with its correct syntactic role in Column (B)${objTag}:`,
            columnA: [
              { id: '1', num: '1', text: 'Noun' },
              { id: '2', num: '2', text: 'Verb' },
              { id: '3', num: '3', text: 'Adjective' },
              { id: '4', num: '4', text: 'Preposition' }
            ],
            columnB: [
              { id: 'a', label: 'A', text: 'Expresses an action, state, or event in a predicate.' },
              { id: 'b', label: 'B', text: 'Modifies or attributes qualities to a noun or pronoun.' },
              { id: 'c', label: 'C', text: 'Identifies a person, place, object, or concept.' },
              { id: 'd', label: 'D', text: 'Links nouns to indicate temporal, spatial, or logical relations.' }
            ],
            correctAnswer: 'Matching Key:\n(1 ➔ C), (2 ➔ A), (3 ➔ B), (4 ➔ D)',
            explanation: 'Accurate classification of fundamental English parts of speech and roles.',
            points: 2
          };
        } else {
          return {
            question: `Language Application and Writing${objTag}:\nConstruct two complete, grammatically accurate sentences that demonstrate the core concept of the lesson.`,
            correctAnswer: 'Teacher evaluates grammar accuracy, lexical variety, and semantic clarity.',
            explanation: 'Assesses written communicative competence and syntactic mastery.',
            points: 3
          };
        }
      } else {
        // Arabic Language
        if (type === 'mcq') {
          return {
            question: `حدد الخيار الإعرابي أو الدلالي الصحيح للجملة التالية${objTag}:`,
            options: [
              'أ) تُعرب الكلمة المستهدفة فاعلاً مرفوعاً وعلامة رفعه الضمة الظاهرة على آخره.',
              'ب) تُعرب الكلمة مفعولاً به منصوباً بالكسرة نيابة عن الفتحة لأنه جمع مؤنث سالم.',
              'جـ) تُعرب اسماً مجروراً بحرف الجر وعلامة جره الياء لأنه مثنى.',
              'د) تُعرب خبراً مقدماً وجوباً في الجملة الاسمية.'
            ],
            correctOption: 0,
            correctAnswer: 'أ) فاعلاً مرفوعاً وعلامة رفعه الضمة الظاهرة.',
            explanation: 'الفاعل هو الاسم المرفوع الذي دل على من قام بالفعل أو اتصف به.',
            points: 1
          };
        } else if (type === 'true_false') {
          const isTrue = qIndex % 2 === 0;
          return {
            question: isTrue
              ? `${objPrefix}الفعل المضارع يُبنى في حالتين فقط: إذا اتصلت به نون النسوة أو نون التوكيد المباشرة.`
              : `${objPrefix}كان وأخواتها تدخل على الجملة الاسمية فتنصب المبتدأ وترفع الخبر.`,
            options: ['صح', 'خطأ'],
            correctOption: isTrue ? 0 : 1,
            correctAnswer: isTrue ? 'صح' : 'خطأ',
            explanation: isTrue 
              ? 'صحيح؛ الفعل المضارع معرب دائماً إلا في حالتي اتصاله بنون النسوة (مبني على السكون) أو نون التوكيد (مبني على الفتح).'
              : 'خطأ؛ كان وأخواتها أفعال ناسخة ترفع المبتدأ وتنصب الخبر.',
            points: 1
          };
        } else if (type === 'fill_blank') {
          return {
            question: `أكمل الفراغ بالقاعدة الإملائية أو النحوية السليمة${objTag}:\nتُكتب الهمزة المتوسطة على الواو إذا كانت مضمومة وما قبلها .................... أو ساكن.`,
            correctAnswer: 'مفتوح (أو مضموم)',
            explanation: 'قاعدة قوة الحركات في الهمزة المتوسطة (الكسرة ثم الضمة ثم الفتحة ثم السكون).',
            points: 1
          };
        } else if (type === 'matching') {
          return {
            question: `صل بين المصطلح النحوي في العمود (أ) وما يطابقه من حكم أو وظيفة إعرابية في العمود (ب)${objTag}:`,
            columnA: [
              { id: '1', num: '١', text: 'الفاعل' },
              { id: '2', num: '٢', text: 'المفعول به' },
              { id: '3', num: '٣', text: 'كان وأخواتها' },
              { id: '4', num: '٤', text: 'حروف الجر' }
            ],
            columnB: [
              { id: 'a', label: 'أ', text: 'أفعال ناسخة تدخل على الجملة الاسمية فترفع المبتدأ وتنصب الخبر.' },
              { id: 'b', label: 'ب', text: 'اسم منصوب وقع عليه فعل الفاعل في الجملة الفعلية.' },
              { id: 'c', label: 'جـ', text: 'حروف تدخل على الأسماء فتجرها بالكسرة أو الياء.' },
              { id: 'd', label: 'د', text: 'اسم مرفوع يدل على من قام بالفعل أو اتصف به.' }
            ],
            correctAnswer: 'دليل المزاوجة الصحيح:\n(١ ➔ د)، (٢ ➔ ب)، (٣ ➔ أ)، (٤ ➔ جـ)',
            explanation: 'الفاعل مرفوع، المفعول به منصوب، كان ترفع المبتدأ وتنصب الخبر، حروف الجر تجر ما بعدها.',
            points: 2
          };
        } else {
          return {
            question: `سؤال التحليل اللغوي والتعبير الإبداعي${objTag}:\nاستخرج من النص السابق الأسلوب البلاغي الموظف، مبيناً نوعه، وسر جماله، وأثره في المعنى.`,
            correctAnswer: 'نموذج الإجابة:\n1) الأسلوب: استعارة مكنية أو تشبيه بليغ.\n2) سر الجمال: التشخيص أو التجسيم وتوضيح الفكرة في صورة محسوسة.\n3) الأثر: إبراز المعنى وإثارة ذهن القارئ.',
            explanation: 'تحليل بلاغي يقيس مهارة التذوق الأدبي والفهم العميق.',
            points: 3
          };
        }
      }
    }
  },

  islamic: {
    keywords: ['إسلامية', 'توحيد', 'فقه', 'تفسير', 'حديث', 'قرآن', 'دين', 'عقيدة'],
    generateQuestion: (objective, bloomLevel, type, symbolLang, qIndex, isInternational = false, showObjectives = false) => {
      const objPrefix = showObjectives ? `[الهدف: ${objective}] ` : '';
      const objTag = showObjectives ? ` [الهدف: ${objective}]` : '';

      if (type === 'mcq') {
        return {
          question: `ما هو الحكم أو التوجيه الإسلامي الصحيح المستنبط من الدليل الشرعي لموضوع الدرس${objTag}؟`,
          options: [
            'أ) واجب شرعاً دل عليه الكتاب والسنة وإجماع الأمة.',
            'ب) مستحب يثاب فاعله ولا يعاقب تاركه.',
            'جـ) مباح يستوي فيه الفعل والترك في أصله.',
            'د) مكروه يفضل تركه تنزيهاً للعبادة.'
          ],
          correctOption: 0,
          correctAnswer: 'أ) واجب شرعاً دل عليه الكتاب والسنة.',
          explanation: 'الأصل في الأوامر الشرعية المطلقة الوجوب ما لم تصرفها قرينة.',
          points: 1
        };
      } else if (type === 'true_false') {
        return {
          question: `${objPrefix}النية شرط أساسي لصحة العبادات وتعيينها لقول النبي ﷺ: "إنما الأعمال بالنيات".`,
          options: ['صح', 'خطأ'],
          correctOption: 0,
          correctAnswer: 'صح',
          explanation: 'النية تميز العبادات عن العادات وتميز مراتب العبادات بعضها عن بعض.',
          points: 1
        };
      } else if (type === 'fill_blank') {
        return {
          question: `أكمل العبارة الشريفة التالية${objTag}:\nقال رسول الله ﷺ: "من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى ....................".`,
          correctAnswer: 'الجنة',
          explanation: 'حديث صحيح رواه مسلم، يحث على فضل طلب العلم الشرعي والنافع.',
          points: 1
        };
      } else if (type === 'matching') {
        return {
          question: `صل بين المصطلح الشرعي في العمود (أ) وما يناسبه من تعريف فقهي في العمود (ب)${objTag}:`,
          columnA: [
            { id: '1', num: '١', text: 'الركن' },
            { id: '2', num: '٢', text: 'الشرط' },
            { id: '3', num: '٣', text: 'الواجب' },
            { id: '4', num: '٤', text: 'السنة (المستحب)' }
          ],
          columnB: [
            { id: 'a', label: 'أ', text: 'ما يثاب فاعله امتثالاً ولا يعاقب تاركه، ويجبر النقص في العمل.' },
            { id: 'b', label: 'ب', text: 'جزء لا يتجزأ من حقيقة العبادة وتبطل بتركه عمداً أو سهواً.' },
            { id: 'c', label: 'جـ', text: 'ما يلزم من عدمه العدم ويكون سابقاً للعبادة وخارجاً عنها كالطهارة.' },
            { id: 'd', label: 'د', text: 'ما أمر به الشارع حتماً وتبطل بتركه عمداً ويجبر بسجود السهو إن نسي.' }
          ],
          correctAnswer: 'دليل المزاوجة الصحيح:\n(١ ➔ ب)، (٢ ➔ جـ)، (٣ ➔ د)، (٤ ➔ أ)',
          explanation: 'الركن داخل الماهية ويبطل العبادة سهواً، والشرط خارجها، والواجب يجبر بالسجود، والسنة مستحبة.',
          points: 2
        };
      } else {
        return {
          question: `سؤال الاستنباط والتطبيق القيمي${objTag}:\nبين كيف يطبق الطالب المسلم هذا الهدي النبوي في حياته اليومية وتعاملاته المدرسية والأسرية؟`,
          correctAnswer: 'نموذج الإجابة:\n1) الإخلاص واستشعار رقابة الله تعالى.\n2) حسن الخلق والصدق في القول والعمل.\n3) الإحسان إلى الزملاء وبر الوالدين.',
          explanation: 'ربط المعارف الإسلامية بالسلوك العملي وبناء الشخصية المتوازنة.',
          points: 3
        };
      }
    }
  },

  social: {
    keywords: ['اجتماعيات', 'تاريخ', 'جغرافيا', 'وطنية', 'دراسات اجتماعية'],
    generateQuestion: (objective, bloomLevel, type, symbolLang, qIndex, isInternational = false, showObjectives = false) => {
      const objPrefix = showObjectives ? `[الهدف: ${objective}] ` : '';
      const objTag = showObjectives ? ` [الهدف: ${objective}]` : '';

      if (type === 'mcq') {
        return {
          question: `حدد الحدث التاريخي أو الموقع الجغرافي الدقيق المرتبط بموضوع الدرس${objTag}:`,
          options: [
            'أ) تحقيق الإنجاز الوطني الاستراتيجي وتوحيد البلاد وفق رؤية تنموية رائدة.',
            'ب) تأسيس أول المراكز التجارية على الساحل الغربي في القرن التاسع عشر.',
            'جـ) توقيع المعاهدات الإقليمية المشتركة في العاصمة.',
            'د) تدشين أول خطوط الملاحة البحرية الدولية عبر المضيق.'
          ],
          correctOption: 0,
          correctAnswer: 'أ) تحقيق الإنجاز الوطني الاستراتيجي.',
          explanation: 'يعكس الركائز التاريخية والجغرافية الوطنية المعتمدة في المناهج.',
          points: 1
        };
      } else if (type === 'true_false') {
        return {
          question: `${objPrefix}تقع المملكة العربية السعودية في الركن الجنوبي الغربي من قارة آسيا، وتشغل الجزء الأكبر من شبه الجزيرة العربية.`,
          options: ['صح', 'خطأ'],
          correctOption: 0,
          correctAnswer: 'صح',
          explanation: 'الموقع الجغرافي الاستراتيجي للمملكة العربية السعودية.',
          points: 1
        };
      } else if (type === 'fill_blank') {
        return {
          question: `أكمل الفراغ بالمعلومة الجغرافية أو التاريخية الدقيقة${objTag}:\nتعتبر عاصمة المملكة العربية السعودية ومركز ثقلها السياسي والاقتصادي هي مدينة .................... .`,
          correctAnswer: 'الرياض',
          explanation: 'مدينة الرياض هي عاصمة المملكة العربية السعودية ومقر الحكم والوزارات.',
          points: 1
        };
      } else if (type === 'matching') {
        return {
          question: `زاوج بين المفاهيم الجغرافية في العمود (أ) وما يطابقها من دلالات في العمود (ب)${objTag}:`,
          columnA: [
            { id: '1', num: '١', text: 'خط الاستواء' },
            { id: '2', num: '٢', text: 'خط غرينتش' },
            { id: '3', num: '٣', text: 'شبه الجزيرة العربية' },
            { id: '4', num: '٤', text: 'التضاريس' }
          ],
          columnB: [
            { id: 'a', label: 'أ', text: 'خط الطول الرئيسي ودرجته صفر، ويقسم الأرض إلى نصفين شرقي وغربي.' },
            { id: 'b', label: 'ب', text: 'أكبر شبه جزيرة في العالم وتقع في الركن الجنوبي الغربي لقارة آسيا.' },
            { id: 'c', label: 'جـ', text: 'الأشكال السطحية المختلفة لليابسة من جبال وهضاب وأودية وسهول.' },
            { id: 'd', label: 'د', text: 'دائرة العرض الرئيسية ودرجتها صفر، وتقسم الأرض لنصفين شمالي وجنوبي.' }
          ],
          correctAnswer: 'دليل المزاوجة الصحيح:\n(١ ➔ د)، (٢ ➔ أ)، (٣ ➔ ب)، (٤ ➔ جـ)',
          explanation: 'خط الاستواء دائرة عرض رئيسية (صفر)، خط غرينتش خط طول رئيسي (صفر)، التضاريس أشكال السطح.',
          points: 2
        };
      } else {
        return {
          question: `سؤال التحليل الحضاري والجغرافي${objTag}:\nعلل: الأهمية الجيوسياسية والاقتصادية للموقع الجغرافي المتميز لموضوع الدرس.`,
          correctAnswer: 'نموذج الإجابة:\n1) وقوعه على ملتقى طرق التجارة العالمية وثلاث قارات.\n2) الإشراف على ممرات مائية حيوية (البحر الأحمر والخليج العربي).\n3) الثروات الطبيعية والمكانة الحضارية.',
          explanation: 'مهارات التفكير المكاني والتحليل الجغرافي والتاريخي.',
          points: 3
        };
      }
    }
  }
};

/**
 * اكتشاف تصنيف المادة المناسب
 */
function detectSubjectCategory(subject = '') {
  const s = subject.toLowerCase();
  for (const [catKey, catData] of Object.entries(SUBJECT_GENERATION_MATRICES)) {
    if (catData.keywords.some(kw => s.includes(kw.toLowerCase()))) {
      return catKey;
    }
  }
  // Fallback default
  if (/علم|كيم|فيز|أحي|طب/i.test(s)) return 'science';
  if (/رياض|حساب|هندس/i.test(s)) return 'math';
  if (/لغ|عرب|انج|eng/i.test(s)) return 'languages';
  if (/دين|إسلام|قرآن|فقه|توحيد/i.test(s)) return 'islamic';
  if (/تاريخ|جغراف|اجتماع/i.test(s)) return 'social';
  return 'science'; // Generates solid analytical inquiry questions
}

/**
 * المحرك الرئيسي لتوليد ورقة العمل بالذكاء الاصطناعي
 */
export async function generateWorksheetAI({
  lessonTitle = 'عنوان الدرس',
  subject = 'المادة',
  stage = 'المرحلة الدراسية',
  className = 'الفصل',
  semester = 'الفصل الدراسي الأول',
  objectives = [],
  questionCount = 5,
  cognitiveDistribution = 'balanced', // 'balanced' | 'remember' | 'understand' | 'apply' | 'analyze'
  symbolLanguage = 'ar', // 'ar' (س، ص، ١، ٢) | 'en' (x, y, 1, 2)
  questionTypes = ['mcq', 'true_false', 'fill_blank', 'matching', 'problem_solving'],
  customInstructions = '',
  isInternational = false,
  curriculumTrack = 'national', // 'national' | 'international'
  schoolName = '',
  track = '',
  showObjectives = false
}) {
  // التحقق الحاسم من اعتماد المدرسة للمنهج الدولي
  const effectiveIsInternational = isInternationalSchool({
    isInternational,
    curriculumTrack,
    schoolName,
    track
  });

  // 1. تنقية وتجهيز الأهداف
  let cleanObjectives = Array.isArray(objectives) 
    ? objectives.map(o => String(o).trim()).filter(Boolean)
    : [];

  // إذا لم يكتب المعلم أهدافاً، يتم توليد أهداف ذكية فورية من واقع عنوان الدرس والمادة
  if (cleanObjectives.length === 0) {
    cleanObjectives = effectiveIsInternational ? [
      `Students will identify core concepts and terminology of (${lessonTitle}) accurately.`,
      `Students will comprehend scientific and quantitative relations in (${lessonTitle}).`,
      `Students will apply learned formulas and principles to solve analytical problems.`,
      `Students will analyze outcomes and draw verified conclusions for (${lessonTitle}).`
    ] : [
      `أن يتعرف الطالب على المفاهيم والمصطلحات الأساسية لدرس (${lessonTitle}) بدقة.`,
      `أن يستوعب الطالب العلاقات والروابط العلمية المتعلقة بموضوع (${lessonTitle}).`,
      `أن يطبق الطالب القوانين والمهارات المكتسبة في حل مسائل وتمارين الدرس.`,
      `أن يحلل الطالب النتائج والمواقف المرتبطة بـ (${lessonTitle}) مستنتجاً الدلالات بدقة.`
    ];
  }

  const effectiveTypes = (questionTypes && questionTypes.length > 0)
    ? questionTypes
    : ['mcq', 'true_false', 'fill_blank', 'matching', 'problem_solving'];

  const categoryKey = detectSubjectCategory(subject);
  const generator = SUBJECT_GENERATION_MATRICES[categoryKey] || SUBJECT_GENERATION_MATRICES.science;

  // 2. توزيع مستويات بلوم حسب التفضيل المطلوب
  const bloomLevelsList = [
    BLOOM_LEVELS.REMEMBER,
    BLOOM_LEVELS.UNDERSTAND,
    BLOOM_LEVELS.APPLY,
    BLOOM_LEVELS.ANALYZE,
    BLOOM_LEVELS.EVALUATE
  ];

  let targetLevels = [];
  if (cognitiveDistribution === 'remember') {
    targetLevels = [BLOOM_LEVELS.REMEMBER, BLOOM_LEVELS.REMEMBER, BLOOM_LEVELS.UNDERSTAND];
  } else if (cognitiveDistribution === 'understand') {
    targetLevels = [BLOOM_LEVELS.UNDERSTAND, BLOOM_LEVELS.UNDERSTAND, BLOOM_LEVELS.APPLY];
  } else if (cognitiveDistribution === 'apply') {
    targetLevels = [BLOOM_LEVELS.APPLY, BLOOM_LEVELS.APPLY, BLOOM_LEVELS.ANALYZE];
  } else if (cognitiveDistribution === 'analyze') {
    targetLevels = [BLOOM_LEVELS.ANALYZE, BLOOM_LEVELS.ANALYZE, BLOOM_LEVELS.EVALUATE];
  } else {
    // متوازن ومتدرج تدرجاً تربوياً من الأسهل للأعمق
    targetLevels = bloomLevelsList;
  }

  // 3. بناء الأسئلة
  const count = Math.max(1, Math.min(25, Number(questionCount) || 5));
  const generatedQuestions = [];
  let totalPoints = 0;

  for (let i = 0; i < count; i++) {
    const targetObj = cleanObjectives[i % cleanObjectives.length];
    const bloom = targetLevels[i % targetLevels.length];
    const qType = effectiveTypes[i % effectiveTypes.length];

    const qData = generator.generateQuestion(targetObj, bloom, qType, symbolLanguage, i, effectiveIsInternational, showObjectives);

    const questionItem = {
      id: `q_${Date.now()}_${i + 1}`,
      number: i + 1,
      type: qType,
      typeLabel: QUESTION_TYPES[qType.toUpperCase()]?.label || 'سؤال تفاعلي',
      bloomLevel: bloom.ar,
      bloomLevelEn: bloom.en,
      targetObjective: targetObj,
      question: qData.question,
      image: null,
      options: qData.options || null,
      correctOption: qData.correctOption !== undefined ? qData.correctOption : null,
      columnA: qData.columnA || null,
      columnB: qData.columnB || null,
      correctAnswer: qData.correctAnswer,
      explanation: qData.explanation,
      points: qData.points || 1
    };

    totalPoints += questionItem.points;
    generatedQuestions.push(questionItem);
  }

  // 4. لمسة إبداعية: سؤال التحدي والتفكير الناقد (Bonus Question)
  // لا يكون بالإنجليزية إلا إذا كانت المدرسة تعتمد المنهج الدولي
  const bonusQuestion = {
    title: effectiveIsInternational ? '⭐ Higher-Order Thinking Challenge (Bonus)' : '⭐ مسألة التحدي والمهارات العليا (Bonus Challenge)',
    question: effectiveIsInternational
      ? `Creative Challenge: Connecting "${lessonTitle}" with modern real-world applications; How can you apply the principles learned today to invent or optimize a solution for an engineering or scientific problem? Justify your rationale.`
      : `تحدّي المبدعين: بالربط بين موضوع الدرس "${lessonTitle}" وتطبيقات الحياة اليومية ورؤية المستقبل؛ كيف يمكنك توظيف المفاهيم التي تعلمتها لتصميم حل أو ابتكار يحل مشكلة معاصرة؟ برر إجابتك علمياً.`,
    modelAnswer: effectiveIsInternational
      ? 'Evaluated based on originality, scientific rigor, and conceptual coherence with lesson themes.'
      : 'يقوم المعلم بتقييم إجابة الطالب الإبداعية بناءً على: أصالة الفكرة، وسلامة التطبيق العلمي، ودقة الربط بمفاهيم الدرس.',
    points: 2
  };

  // 5. زمن الاختبار المقترح
  const estimatedMinutes = count <= 4 ? 15 : count <= 8 ? 20 : count <= 12 ? 30 : 45;

  return {
    lessonTitle,
    subject,
    stage,
    className,
    semester,
    symbolLanguage,
    curriculumTrack: effectiveIsInternational ? 'international' : 'national',
    isInternational: effectiveIsInternational,
    showObjectives,
    estimatedMinutes: `${estimatedMinutes} دقيقة`,
    totalPoints: totalPoints + bonusQuestion.points,
    questionsCount: generatedQuestions.length,
    objectives: cleanObjectives,
    questions: generatedQuestions,
    bonusQuestion,
    instructions: effectiveIsInternational ? [
      'Read all questions thoroughly before answering.',
      'For multiple choice questions, fill in the correct option circle clearly.',
      'Show your step-by-step working for mathematical and scientific problems.',
      'Review all your responses carefully before submitting.'
    ] : [
      'اقرأ جميع الأسئلة بعناية قبل البدء في الإجابة.',
      'في أسئلة الاختيار من متعدد، اختر الإجابة الأصح وظللها بدقة.',
      'في المسائل الرياضية والعلمية، وضّح خطوات الحل والقوانين المستخدمة.',
      'راجع إجاباتك جيداً ولا تتردد في الإجابة عن سؤال التحدي الإضافي.'
    ],
    generatedAt: new Date().toISOString()
  };
}
