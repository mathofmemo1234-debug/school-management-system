/**
 * examCorrelationEngine.js
 * محرك القياس والتحليل الإحصائي لحساب معاملات الارتباط (بيرسون وسبيرمان)
 * ومؤشرات نماء التعلم، الصدق التلازمي، وحجم الأثر (Cohen's d) بين اختبارين
 */

/**
 * مطابقة درجات الطلاب المشتركين بين الاختبارين
 * @param {Array} results1 - نتائج الاختبار الأول
 * @param {Array} results2 - نتائج الاختبار الثاني
 * @param {Number} max1 - الدرجة العظمى للاختبار الأول
 * @param {Number} max2 - الدرجة العظمى للاختبار الثاني
 */
export function matchAndPairExamStudents(results1 = [], results2 = [], max1 = 20, max2 = 20) {
  if (!Array.isArray(results1) || !Array.isArray(results2)) return [];

  // بناء خريطة لنتائج الاختبار الثاني بالمطابقة بمعرف الطالب أو رقم الهوية أو الاسم
  const map2 = new Map();
  results2.forEach(r => {
    const isAbsent = r.isAbsent === true || r.score === 'غ' || r.score === 'غائب';
    if (isAbsent) return; // استبعاد الغائبين

    const sId = r.studentId ? String(r.studentId).trim() : '';
    const nid = r.nationalId ? String(r.nationalId).trim() : '';
    const name = r.studentName ? String(r.studentName).trim().toLowerCase() : '';

    if (sId) map2.set(`id:${sId}`, r);
    if (nid) map2.set(`nid:${nid}`, r);
    if (name) map2.set(`name:${name}`, r);
  });

  const pairs = [];
  const processedStudents = new Set();

  results1.forEach(r1 => {
    const isAbsent1 = r1.isAbsent === true || r1.score === 'غ' || r1.score === 'غائب';
    if (isAbsent1) return;

    const sId = r1.studentId ? String(r1.studentId).trim() : '';
    const nid = r1.nationalId ? String(r1.nationalId).trim() : '';
    const name = r1.studentName ? String(r1.studentName).trim().toLowerCase() : '';

    let match = null;
    if (sId && map2.has(`id:${sId}`)) match = map2.get(`id:${sId}`);
    else if (nid && map2.has(`nid:${nid}`)) match = map2.get(`nid:${nid}`);
    else if (name && map2.has(`name:${name}`)) match = map2.get(`name:${name}`);

    if (match) {
      const studentKey = sId || nid || name;
      if (processedStudents.has(studentKey)) return;
      processedStudents.add(studentKey);

      const score1 = parseFloat(r1.score) || 0;
      const score2 = parseFloat(match.score) || 0;
      const studentMax1 = parseFloat(r1.maxScore) || max1 || 20;
      const studentMax2 = parseFloat(match.maxScore) || max2 || 20;

      // حساب النسب المئوية المتكافئة للتعامل مع اختلاف الدرجة العظمى
      const pct1 = Math.min(100, Math.max(0, Math.round((score1 / studentMax1) * 100)));
      const pct2 = Math.min(100, Math.max(0, Math.round((score2 / studentMax2) * 100)));
      const diffPct = pct2 - pct1;
      const diffRaw = score2 - score1;

      let status = 'stable'; // 'improved' | 'stable' | 'declined'
      let statusLabel = 'مستقر ⚖️';
      let statusColor = '#d97706';

      if (diffPct >= 5) {
        status = 'improved';
        statusLabel = 'متحسن 🚀';
        statusColor = '#16a34a';
      } else if (diffPct <= -5) {
        status = 'declined';
        statusLabel = 'متراجع ⚠️';
        statusColor = '#dc2626';
      }

      pairs.push({
        studentId: sId || match.studentId,
        studentName: r1.studentName || match.studentName || 'طالب',
        nationalId: nid || match.nationalId || '',
        score1,
        score2,
        pct1,
        pct2,
        max1: studentMax1,
        max2: studentMax2,
        diffRaw,
        diffPct,
        status,
        statusLabel,
        statusColor
      });
    }
  });

  return pairs;
}

/**
 * حساب معامل ارتباط بيرسون الخطي (Pearson Correlation Coefficient)
 * r = Σ( (x - x̄)(y - ȳ) ) / sqrt( Σ(x - x̄)² * Σ(y - ȳ)² )
 */
export function computePearsonCorrelation(pairs = []) {
  const n = pairs.length;
  if (n < 2) {
    return {
      r: '0.00',
      rSquared: '0.00',
      tStat: '0.00',
      isSignificant: false,
      significanceText: 'عدد الطلاب غير كافٍ للتحليل الإحصائي (الحد الأدنى طالبان)',
      level: 'none',
      interpretation: 'غير محدد',
      color: '#64748b'
    };
  }

  const mean1 = pairs.reduce((sum, p) => sum + p.pct1, 0) / n;
  const mean2 = pairs.reduce((sum, p) => sum + p.pct2, 0) / n;

  let num = 0;
  let den1 = 0;
  let den2 = 0;

  pairs.forEach(p => {
    const dx = p.pct1 - mean1;
    const dy = p.pct2 - mean2;
    num += dx * dy;
    den1 += dx * dx;
    den2 += dy * dy;
  });

  const den = Math.sqrt(den1 * den2);
  let r = den === 0 ? 0 : num / den;
  r = Math.max(-1, Math.min(1, r)); // ضبط النطاق بين -1 و +1

  const rSquared = r * r;

  // اختبار ت للدلالة الإحصائية t = r * sqrt((n - 2) / (1 - r^2))
  let tStat = 0;
  let isSignificant = false;
  let significanceText = 'لا توجد دلالة إحصائية كافية';

  if (n > 2 && Math.abs(r) < 1) {
    tStat = Math.abs(r) * Math.sqrt((n - 2) / (1 - rSquared));
    // القيمة الحرجة التقريبية عند مستوى α = 0.05 لدرجات الحرية العادية هي حوالي 2.0
    if (tStat >= 2.0) {
      isSignificant = true;
      significanceText = `دال إحصائياً عند مستوى ثقة 95% (t = ${tStat.toFixed(2)}, df = ${n - 2})`;
    } else {
      significanceText = `غير دال إحصائياً عند مستوى ثقة 95% (t = ${tStat.toFixed(2)})`;
    }
  } else if (Math.abs(r) === 1) {
    isSignificant = true;
    significanceText = 'ارتباط تام ومثالي';
  }

  const interpretation = interpretCorrelation(r);

  return {
    r: r.toFixed(2),
    rawR: r,
    rSquared: (rSquared * 100).toFixed(1) + '%',
    rSquaredNum: rSquared,
    tStat: tStat.toFixed(2),
    isSignificant,
    significanceText,
    mean1: mean1.toFixed(1),
    mean2: mean2.toFixed(1),
    ...interpretation
  };
}

/**
 * تفسير قوة واتجاه معامل الارتباط لفظياً وتربوياً
 */
export function interpretCorrelation(r) {
  if (r >= 0.90) {
    return {
      level: 'very_strong_positive',
      label: 'ارتباط طردي موجب قوي جداً',
      color: '#15803d',
      bg: '#f0fdf4',
      pedagogicalMeaning: 'اتساق استثنائي بين الاختبارين؛ أداء الطالب في الاختبار الأول يتطابق بدقة عالية مع مستواه في الاختبار الثاني.'
    };
  }
  if (r >= 0.70) {
    return {
      level: 'strong_positive',
      label: 'ارتباط طردي موجب قوي',
      color: '#16a34a',
      bg: '#f0fdf4',
      pedagogicalMeaning: 'علاقة خطية قوية وموثوقة؛ الطلاب المتفوقون في الاختبار الأول يميلون للتفوق بثقة في الاختبار الثاني (صدق تلازمي ممتاز).'
    };
  }
  if (r >= 0.40) {
    return {
      level: 'moderate_positive',
      label: 'ارتباط طردي موجب متوسط',
      color: '#0284c7',
      bg: '#f0f9ff',
      pedagogicalMeaning: 'علاقة إيجابية مقبولة تربوياً؛ هناك اتساق عام مع وجود بعض الفروق الفردية في استجابة الطلاب بين الاختبارين.'
    };
  }
  if (r >= 0.20) {
    return {
      level: 'weak_positive',
      label: 'ارتباط طردي موجب ضعيف',
      color: '#d97706',
      bg: '#fffbeb',
      pedagogicalMeaning: 'علاقة ضعيفة؛ يشير إلى أن الاختبارين يقيسان مهارات متباينة نسبياً، أو وجود فجوة زمنية أو تدريبية بين التطبيقين.'
    };
  }
  if (r > -0.20) {
    return {
      level: 'negligible',
      label: 'ارتباط شبه منعدم / لا توجد علاقة خطية',
      color: '#64748b',
      bg: '#f8fafc',
      pedagogicalMeaning: 'لا توجد علاقة ارتباطية واضحة؛ درجات الطلاب في الاختبار الأول لا تتنبأ إطلاقاً بدرجاتهم في الاختبار الثاني.'
    };
  }
  return {
    level: 'negative',
    label: 'ارتباط عكسي / سالب',
    color: '#dc2626',
    bg: '#fef2f2',
    pedagogicalMeaning: 'علاقة عكسية شاذة؛ الطلاب الذين حصلوا على درجات مرتفعة في الاختبار الأول انخفضت درجاتهم في الثاني (يستدعي مراجعة محتوى أحد الاختبارين).'
  };
}

/**
 * حساب معامل ارتباط الرتب لسبيرمان (Spearman Rank Correlation)
 * rs = 1 - (6 * Σ d²) / (n * (n² - 1))
 */
export function computeSpearmanCorrelation(pairs = []) {
  const n = pairs.length;
  if (n < 2) return { rs: '0.00', interpretation: 'غير محدد' };

  // استخراج رتب المتغير الأول
  const sortedBy1 = [...pairs].sort((a, b) => b.pct1 - a.pct1);
  const ranks1 = new Map();
  sortedBy1.forEach((p, idx) => ranks1.set(p.studentId, idx + 1));

  // استخراج رتب المتغير الثاني
  const sortedBy2 = [...pairs].sort((a, b) => b.pct2 - a.pct2);
  const ranks2 = new Map();
  sortedBy2.forEach((p, idx) => ranks2.set(p.studentId, idx + 1));

  let sumD2 = 0;
  pairs.forEach(p => {
    const r1 = ranks1.get(p.studentId) || 1;
    const r2 = ranks2.get(p.studentId) || 1;
    const d = r1 - r2;
    sumD2 += d * d;
  });

  const rs = 1 - ((6 * sumD2) / (n * (n * n - 1)));
  const clampedRs = Math.max(-1, Math.min(1, rs));

  return {
    rs: clampedRs.toFixed(2),
    rawRs: clampedRs,
    interpretation: interpretCorrelation(clampedRs).label
  };
}

/**
 * حساب معادلة الانحدار الخطي البسيط (Simple Linear Regression)
 * y_hat = beta0 + beta1 * x
 */
export function computeLinearRegression(pairs = []) {
  const n = pairs.length;
  if (n < 2) return { slope: 0, intercept: 0, formula: 'y = x' };

  const meanX = pairs.reduce((sum, p) => sum + p.pct1, 0) / n;
  const meanY = pairs.reduce((sum, p) => sum + p.pct2, 0) / n;

  let num = 0;
  let den = 0;

  pairs.forEach(p => {
    const dx = p.pct1 - meanX;
    const dy = p.pct2 - meanY;
    num += dx * dy;
    den += dx * dx;
  });

  const slope = den === 0 ? 1 : num / den;
  const intercept = meanY - (slope * meanX);

  return {
    slope: parseFloat(slope.toFixed(3)),
    intercept: parseFloat(intercept.toFixed(2)),
    formula: `Y = ${intercept >= 0 ? '+' : ''}${intercept.toFixed(1)} + ${slope.toFixed(2)}X`,
    predict: (x) => Math.min(100, Math.max(0, intercept + slope * x))
  };
}

/**
 * حساب مؤشر نماء التعلم وحجم الأثر (Learning Gain & Effect Size / Cohen's d)
 */
export function computeLearningGain(pairs = []) {
  const n = pairs.length;
  if (n === 0) {
    return {
      improvedCount: 0,
      improvedRate: 0,
      stableCount: 0,
      stableRate: 0,
      declinedCount: 0,
      declinedRate: 0,
      avgGainPct: '0.0%',
      cohensD: '0.00',
      effectSizeLabel: 'غير محدد'
    };
  }

  let improvedCount = 0;
  let stableCount = 0;
  let declinedCount = 0;
  let totalDiff = 0;

  pairs.forEach(p => {
    totalDiff += p.diffPct;
    if (p.status === 'improved') improvedCount++;
    else if (p.status === 'declined') declinedCount++;
    else stableCount++;
  });

  const avgGainPct = (totalDiff / n).toFixed(1);

  // حساب الانحراف المعياري المشترك وحجم الأثر كوهين (Cohen's d)
  const mean1 = pairs.reduce((s, p) => s + p.pct1, 0) / n;
  const mean2 = pairs.reduce((s, p) => s + p.pct2, 0) / n;

  const var1 = pairs.reduce((s, p) => s + Math.pow(p.pct1 - mean1, 2), 0) / (n - 1 || 1);
  const var2 = pairs.reduce((s, p) => s + Math.pow(p.pct2 - mean2, 2), 0) / (n - 1 || 1);
  const pooledSd = Math.sqrt((var1 + var2) / 2);

  const cohensD = pooledSd === 0 ? 0 : (mean2 - mean1) / pooledSd;

  let effectSizeLabel = 'تأثير مهمل / لا يوجد تغير ملحوظ';
  if (Math.abs(cohensD) >= 0.80) effectSizeLabel = 'حجم أثر تدريسي كبير جداً 🌟 (Large Effect)';
  else if (Math.abs(cohensD) >= 0.50) effectSizeLabel = 'حجم أثر متوسط وملحوظ 📈 (Medium Effect)';
  else if (Math.abs(cohensD) >= 0.20) effectSizeLabel = 'حجم أثر صغير وبداية تقدم 🌱 (Small Effect)';

  return {
    improvedCount,
    improvedRate: Math.round((improvedCount / n) * 100),
    stableCount,
    stableRate: Math.round((stableCount / n) * 100),
    declinedCount,
    declinedRate: Math.round((declinedCount / n) * 100),
    avgGainPct: (parseFloat(avgGainPct) >= 0 ? `+${avgGainPct}%` : `${avgGainPct}%`),
    cohensD: cohensD.toFixed(2),
    effectSizeLabel
  };
}

/**
 * التحليل التكاملي الشامل بين اختبارين (Bivariate Comprehensive Analysis)
 */
export function computeBivariateAnalysis(results1 = [], results2 = [], exam1Meta = {}, exam2Meta = {}) {
  const max1 = parseFloat(exam1Meta.maxScore) || 20;
  const max2 = parseFloat(exam2Meta.maxScore) || 20;

  const pairedStudents = matchAndPairExamStudents(results1, results2, max1, max2);
  const pearson = computePearsonCorrelation(pairedStudents);
  const spearman = computeSpearmanCorrelation(pairedStudents);
  const regression = computeLinearRegression(pairedStudents);
  const growth = computeLearningGain(pairedStudents);

  return {
    totalPaired: pairedStudents.length,
    totalExam1: results1.length,
    totalExam2: results2.length,
    pairedStudents,
    pearson,
    spearman,
    regression,
    growth,
    exam1Meta,
    exam2Meta
  };
}
