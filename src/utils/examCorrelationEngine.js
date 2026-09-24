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
 * حساب الإحصاءات الوصفية ومستويات الأداء والتقديرات لمجموعة طلاب اختبار واحد
 */
export function computeCohortStats(results = [], maxScore = 20) {
  const valid = [];
  let absentCount = 0;

  if (Array.isArray(results)) {
    results.forEach(r => {
      const isAbsent = r.isAbsent === true || r.score === 'غ' || r.score === 'غائب';
      if (isAbsent) {
        absentCount++;
        return;
      }
      const raw = parseFloat(r.score !== undefined ? r.score : r.totalScore);
      if (!isNaN(raw)) {
        const studentMax = parseFloat(r.maxScore) || parseFloat(maxScore) || 20;
        const pct = Math.min(100, Math.max(0, Math.round((raw / studentMax) * 100)));
        valid.push({
          raw,
          pct,
          maxScore: studentMax,
          studentId: r.studentId || r.id,
          studentName: r.studentName || 'طالب'
        });
      }
    });
  }

  const n = valid.length;
  if (n === 0) {
    return {
      totalTested: 0,
      totalAbsent: absentCount,
      meanRaw: '0.0',
      meanPct: '0.0',
      meanPctNum: 0,
      medianPct: '0.0',
      maxScoreAchieved: 0,
      minScoreAchieved: 0,
      rangeScore: 0,
      stdDev: '0.0',
      stdDevNum: 0,
      variance: '0.0',
      passCount: 0,
      passRate: 0,
      masteryCount: 0,
      masteryRate: 0,
      strugglingCount: 0,
      strugglingRate: 0,
      difficultyIndex: '0.00',
      gradeDistribution: {
        excellent: { count: 0, rate: 0, label: 'ممتاز (90-100%)', color: '#16a34a' },
        veryGood: { count: 0, rate: 0, label: 'جيد جداً (80-89%)', color: '#0284c7' },
        good: { count: 0, rate: 0, label: 'جيد (70-79%)', color: '#6366f1' },
        pass: { count: 0, rate: 0, label: 'مقبول (50-69%)', color: '#d97706' },
        failed: { count: 0, rate: 0, label: 'ضعيف / غير مجتاز (< 50%)', color: '#dc2626' }
      }
    };
  }

  const sumPct = valid.reduce((s, v) => s + v.pct, 0);
  const sumRaw = valid.reduce((s, v) => s + v.raw, 0);
  const meanPctNum = parseFloat((sumPct / n).toFixed(1));
  const meanRawNum = parseFloat((sumRaw / n).toFixed(1));

  // الانحراف المعياري والتباين
  const varianceNum = n > 1 
    ? valid.reduce((s, v) => s + Math.pow(v.pct - meanPctNum, 2), 0) / (n - 1) 
    : 0;
  const stdDevNum = parseFloat(Math.sqrt(varianceNum).toFixed(1));

  // الوسيط والمدى
  const sortedPcts = [...valid.map(v => v.pct)].sort((a, b) => a - b);
  const medianPctNum = n % 2 === 1 
    ? sortedPcts[Math.floor(n / 2)] 
    : parseFloat(((sortedPcts[n / 2 - 1] + sortedPcts[n / 2]) / 2).toFixed(1));
  const maxPct = sortedPcts[n - 1];
  const minPct = sortedPcts[0];

  // التقديرات والمستويات
  let passCount = 0;
  let masteryCount = 0;
  let strugglingCount = 0;
  let excCount = 0;
  let vgCount = 0;
  let gCount = 0;
  let pCount = 0;
  let fCount = 0;

  valid.forEach(v => {
    if (v.pct >= 50) passCount++;
    else strugglingCount++;

    if (v.pct >= 85) masteryCount++;

    if (v.pct >= 90) excCount++;
    else if (v.pct >= 80) vgCount++;
    else if (v.pct >= 70) gCount++;
    else if (v.pct >= 50) pCount++;
    else fCount++;
  });

  return {
    totalTested: n,
    totalAbsent: absentCount,
    meanRaw: meanRawNum.toFixed(1),
    meanPct: meanPctNum.toFixed(1),
    meanPctNum,
    medianPct: medianPctNum.toFixed(1),
    maxScoreAchieved: maxPct,
    minScoreAchieved: minPct,
    rangeScore: maxPct - minPct,
    stdDev: stdDevNum.toFixed(1),
    stdDevNum,
    variance: varianceNum.toFixed(1),
    passCount,
    passRate: Math.round((passCount / n) * 100),
    masteryCount,
    masteryRate: Math.round((masteryCount / n) * 100),
    strugglingCount,
    strugglingRate: Math.round((strugglingCount / n) * 100),
    difficultyIndex: (meanPctNum / 100).toFixed(2),
    gradeDistribution: {
      excellent: { count: excCount, rate: Math.round((excCount / n) * 100), label: 'ممتاز (90-100%)', color: '#16a34a' },
      veryGood: { count: vgCount, rate: Math.round((vgCount / n) * 100), label: 'جيد جداً (80-89%)', color: '#0284c7' },
      good: { count: gCount, rate: Math.round((gCount / n) * 100), label: 'جيد (70-79%)', color: '#6366f1' },
      pass: { count: pCount, rate: Math.round((pCount / n) * 100), label: 'مقبول (50-69%)', color: '#d97706' },
      failed: { count: fCount, rate: Math.round((fCount / n) * 100), label: 'ضعيف / غير مجتاز (< 50%)', color: '#dc2626' }
    }
  };
}

/**
 * مقارنة مستقلة وشاملة بين أي اختبارين (سواء لنفس المعلم أو معلمين مختلفين)
 */
export function computeIndependentComparison(results1 = [], results2 = [], exam1Meta = {}, exam2Meta = {}) {
  const max1 = parseFloat(exam1Meta.maxScore) || 20;
  const max2 = parseFloat(exam2Meta.maxScore) || 20;

  const c1 = computeCohortStats(results1, max1);
  const c2 = computeCohortStats(results2, max2);

  // فروق الأداء بين الاختبار الثاني والاختبار الأول
  const meanDiff = parseFloat((c2.meanPctNum - c1.meanPctNum).toFixed(1));
  const passDiff = c2.passRate - c1.passRate;
  const masteryDiff = c2.masteryRate - c1.masteryRate;
  const strugglingDiff = c2.strugglingRate - c1.strugglingRate;
  const stdDevDiff = parseFloat((c2.stdDevNum - c1.stdDevNum).toFixed(1));

  // اختبار ت للعينات المستقلة (Welch's t-test)
  let tValue = 0;
  let df = 0;
  let isSignificant = false;
  let tVerdict = 'عدد الطلاب غير كافٍ للاختبار الإحصائي';

  const n1 = c1.totalTested;
  const n2 = c2.totalTested;

  if (n1 >= 2 && n2 >= 2) {
    const s1Sq = Math.pow(c1.stdDevNum, 2);
    const s2Sq = Math.pow(c2.stdDevNum, 2);
    const se = Math.sqrt((s1Sq / n1) + (s2Sq / n2));

    if (se > 0) {
      tValue = (c2.meanPctNum - c1.meanPctNum) / se;
      const numDf = Math.pow((s1Sq / n1) + (s2Sq / n2), 2);
      const denDf = (Math.pow(s1Sq / n1, 2) / (n1 - 1)) + (Math.pow(s2Sq / n2, 2) / (n2 - 1));
      df = denDf > 0 ? Math.round(numDf / denDf) : n1 + n2 - 2;

      if (Math.abs(tValue) >= 2.0) {
        isSignificant = true;
        tVerdict = `الفرق دال إحصائياً عند مستوى ثقة 95% (t = ${tValue.toFixed(2)}, df = ${df})`;
      } else {
        tVerdict = `الفروق متقاربة وغير دالة إحصائياً عند مستوى ثقة 95% (t = ${tValue.toFixed(2)}, df = ${df})`;
      }
    }
  }

  // حساب حجم الأثر كوهين للعينات المستقلة (Cohen's d)
  let cohensD = 0;
  let effectLabel = 'لا يوجد أثر ملحوظ';
  if (n1 >= 2 && n2 >= 2) {
    const pooledSd = Math.sqrt((((n1 - 1) * Math.pow(c1.stdDevNum, 2)) + ((n2 - 1) * Math.pow(c2.stdDevNum, 2))) / (n1 + n2 - 2 || 1));
    if (pooledSd > 0) {
      cohensD = (c2.meanPctNum - c1.meanPctNum) / pooledSd;
      const absD = Math.abs(cohensD);
      if (absD >= 0.8) effectLabel = 'فارق وفجوة أثر كبيرة جداً 🌟 (Large Effect)';
      else if (absD >= 0.5) effectLabel = 'فارق متوسط ملحوظ 📈 (Medium Effect)';
      else if (absD >= 0.2) effectLabel = 'فارق طفيف محدود 🌱 (Small Effect)';
      else effectLabel = 'فارق ضئيل جداً / أداء متكافئ ⚖️ (Negligible Effect)';
    }
  }

  // السياق والمعلومات
  const teacher1 = exam1Meta.teacherName || 'معلم 1';
  const teacher2 = exam2Meta.teacherName || 'معلم 2';
  const isSameTeacher = (exam1Meta.teacherId && exam2Meta.teacherId && exam1Meta.teacherId === exam2Meta.teacherId) ||
                        (exam1Meta.teacherName && exam2Meta.teacherName && exam1Meta.teacherName.trim() === exam2Meta.teacherName.trim());

  // التقرير والتوصية القيادية للمدير
  const verdict = generateLeadershipVerdict({
    isSameTeacher,
    teacher1,
    teacher2,
    exam1Title: exam1Meta.title || 'الاختبار الأول',
    exam2Title: exam2Meta.title || 'الاختبار الثاني',
    c1,
    c2,
    meanDiff,
    passDiff,
    masteryDiff,
    isSignificant,
    tValue,
    cohensD
  });

  return {
    cohort1: c1,
    cohort2: c2,
    meanDiff,
    passDiff,
    masteryDiff,
    strugglingDiff,
    stdDevDiff,
    tTest: {
      tValue: tValue.toFixed(2),
      df,
      isSignificant,
      verdict: tVerdict
    },
    cohensD: cohensD.toFixed(2),
    effectLabel,
    isSameTeacher,
    teacher1,
    teacher2,
    verdict
  };
}

/**
 * توليد خلاصة قيادية ذكية وتوصيات تربوية للمدير حول نتائج المقارنة
 */
export function generateLeadershipVerdict({
  isSameTeacher,
  teacher1,
  teacher2,
  exam1Title,
  exam2Title,
  c1,
  c2,
  meanDiff,
  passDiff,
  masteryDiff,
  isSignificant,
  tValue,
  cohensD
}) {
  let title = '';
  let statusBadge = '';
  let statusColor = '#0284c7';
  let points = [];
  let recommendations = [];

  const effectDesc = Math.abs(cohensD) >= 0.8 ? 'كبير جداً' : Math.abs(cohensD) >= 0.5 ? 'متوسط' : 'صغير / محدود';

  if (isSameTeacher) {
    title = `تحليل مقارن لاختباري (${exam1Title}) و (${exam2Title}) للمعلم (${teacher1})`;
    if (Math.abs(meanDiff) < 3.5) {
      statusBadge = 'أداء متوازن ومستقر عبر الفصول/الفترات ⚖️';
      statusColor = '#16a34a';
      points.push(`أظهر طلاب المعلم استقراراً ممتازاً في المستوى بمتوسط (${c1.meanPct}%) لاختبار [${exam1Title}] و (${c2.meanPct}%) لاختبار [${exam2Title}] بفارق بسيط (${meanDiff >= 0 ? '+' : ''}${meanDiff}%).`);
      points.push(`تقارب نسب الاجتياز (${c1.passRate}% مقابل ${c2.passRate}%، فارق ${passDiff}%) يعكس عدالة توزيع المعايير واتساق بيئة التدريس.`);
      recommendations.push('الحفاظ على استراتيجيات التدريس الحالية وتكثيف برامج الإثراء للطلاب المتميزين.');
    } else if (meanDiff > 0) {
      statusBadge = 'تقدم وتحسن ملحوظ في الأداء 🚀';
      statusColor = '#16a34a';
      points.push(`حقق اختبار [${exam2Title}] تفوقاً بمقدار (+${meanDiff}%) في متوسط الدرجات مقارنة باختبار [${exam1Title}] (${c2.meanPct}% مقابل ${c1.meanPct}%).`);
      points.push(`ارتفعت نسبة الإتقان من (${c1.masteryRate}%) إلى (${c2.masteryRate}%) بفارق (+${masteryDiff}%)، مع فارق اجتياز (+${passDiff}%).`);
      if (isSignificant) points.push(`التحسن دال إحصائياً (t = ${tValue.toFixed(2)}، بحجم أثر ${effectDesc} d = ${cohensD}) ومؤشر موثوق على نجاح الخطط التدريسية المنفذة.`);
      recommendations.push('توثيق الممارسات التدريسية الناجحة التي ساهمت في رفع نواتج التعلم وتعميمها.');
    } else {
      statusBadge = 'فجوة تراجع تستدعي الدعم والمتابعة ⚠️';
      statusColor = '#dc2626';
      points.push(`سجل اختبار [${exam2Title}] انخفاضاً بمقدار (${meanDiff}%) في متوسط الدرجات (${c2.meanPct}% مقارنة بـ ${c1.meanPct}% لاختبار [${exam1Title}]).`);
      points.push(`ارتفعت نسبة التعثر من (${c1.strugglingRate}%) إلى (${c2.strugglingRate}%)، وتراجع الاجتياز بنسبة (${passDiff}%).`);
      if (isSignificant) points.push(`الفارق دال إحصائياً (حجم الأثر ${effectDesc} d = ${cohensD}) ويشير إلى وجود فجوة حقيقية.`);
      recommendations.push('عقد جلسة مراجعة لمفردات الاختبار وبحث أسباب الصعوبة أو الفجوة المفاهيمية وتطبيق برنامج علاجي فوري.');
    }
  } else {
    // معلمان مختلفان
    title = `تحليل مقارن: الأستاذ (${teacher1}) [${exam1Title}] مقابل الأستاذ (${teacher2}) [${exam2Title}]`;
    if (Math.abs(meanDiff) < 3.5) {
      statusBadge = 'تكافؤ وتناغم تدريسي عالٍ بين المعلمين 🤝';
      statusColor = '#16a34a';
      points.push(`يوجد تقارب كبير وممتاز بين نتائج فصول المعلمين؛ متوسط فصول الأستاذ (${teacher1}) بلغ [${c1.meanPct}%] ومتوسط فصول الأستاذ (${teacher2}) [${c2.meanPct}%].`);
      points.push(`نسبة الاجتياز متقاربة جداً (${c1.passRate}% مقابل ${c2.passRate}%، فارق ${passDiff}%)، مما يعكس توحيد معايير الشرح والتقويم.`);
      recommendations.push('الإشادة بالتناغم والتكامل بين معلمي المادة وتشجيع استمرار تبادل بنوك الأسئلة المشتركة.');
    } else if (meanDiff > 0) {
      statusBadge = `تفوق أداء فصول الأستاذ (${teacher2}) 📈`;
      statusColor = '#0284c7';
      points.push(`حققت فصول الأستاذ (${teacher2}) متوسطاً أعلى بنسبة (+${meanDiff}%) مقارنة بفصول الأستاذ (${teacher1}) (${c2.meanPct}% مقابل ${c1.meanPct}%).`);
      points.push(`نسبة الإتقان لدى فصول (${teacher2}) بلغت (${c2.masteryRate}%) مقابل (${c1.masteryRate}%) لدى (${teacher1})، مع فارق اجتياز (+${passDiff}%).`);
      if (isSignificant) {
        points.push(`الفارق دال إحصائياً (t = ${tValue.toFixed(2)}، بحجم أثر ${effectDesc} d = ${cohensD}) ويشير إلى وجود فجوة حقيقية في تحصيل الطلاب.`);
      }
      recommendations.push(`تشجيع تبادل الزيارات الصفية ونقل الخبرات التعليمية بين الأستاذ (${teacher2}) والأستاذ (${teacher1}).`);
      recommendations.push(`تحليل الفروق في أساليب التقويم والأنشطة وتوحيد خطط التدريس ونواتج التعلم.`);
    } else {
      statusBadge = `تفوق أداء فصول الأستاذ (${teacher1}) 📈`;
      statusColor = '#0284c7';
      points.push(`حققت فصول الأستاذ (${teacher1}) متوسطاً أعلى بنسبة (+${Math.abs(meanDiff)}%) مقارنة بفصول الأستاذ (${teacher2}) (${c1.meanPct}% مقابل ${c2.meanPct}%).`);
      points.push(`نسبة الإتقان لدى فصول (${teacher1}) بلغت (${c1.masteryRate}%) مقابل (${c2.masteryRate}%) لدى (${teacher2})، مع فارق اجتياز (${passDiff}%).`);
      if (isSignificant) {
        points.push(`الفارق دال إحصائياً (t = ${Math.abs(tValue).toFixed(2)}، بحجم أثر ${effectDesc} d = ${cohensD}) ويعكس تبايناً ملحوظاً في مخرجات التعلم بين الفصول.`);
      }
      recommendations.push(`تشجيع تبادل الزيارات الصفية ونقل الخبرات التعليمية من الأستاذ (${teacher1}) إلى الأستاذ (${teacher2}).`);
      recommendations.push(`مراجعة مخرجات فصول الأستاذ (${teacher2}) وبحث أسباب انخفاض الدرجات وتقديم الدعم الإشرافي والتوجيهي.`);
    }
  }

  return {
    title,
    statusBadge,
    statusColor,
    points,
    recommendations
  };
}

/**
 * التحليل التكاملي الشامل بين اختبارين (Bivariate & Comparative Comprehensive Analysis)
 */
export function computeBivariateAnalysis(results1 = [], results2 = [], exam1Meta = {}, exam2Meta = {}) {
  const max1 = parseFloat(exam1Meta.maxScore) || 20;
  const max2 = parseFloat(exam2Meta.maxScore) || 20;

  const pairedStudents = matchAndPairExamStudents(results1, results2, max1, max2);
  const pearson = computePearsonCorrelation(pairedStudents);
  const spearman = computeSpearmanCorrelation(pairedStudents);
  const regression = computeLinearRegression(pairedStudents);
  const growth = computeLearningGain(pairedStudents);
  const independent = computeIndependentComparison(results1, results2, exam1Meta, exam2Meta);

  return {
    totalPaired: pairedStudents.length,
    hasPaired: pairedStudents.length > 0,
    totalExam1: results1.length,
    totalExam2: results2.length,
    pairedStudents,
    pearson,
    spearman,
    regression,
    growth,
    independent,
    exam1Meta,
    exam2Meta
  };
}
