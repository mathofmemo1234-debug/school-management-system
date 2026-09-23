/**
 * batchGradesParser.js
 * أداة ذكية لتحليل واستخراج مصفوفة الدرجات من الحافظة (Clipboard)
 * تدعم اللصق المباشر من Excel, Google Sheets, نور, Word, والمفكرة
 */

export function parseBatchGrades(clipboardText, maxScore = 100) {
  if (!clipboardText || typeof clipboardText !== 'string') return null;

  const trimmed = clipboardText.trim();
  if (!trimmed) return null;

  // تقسيم الأسطر
  const rawLines = trimmed.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

  let extractedTokens = [];

  if (rawLines.length > 1) {
    // لصق متعدد الأسطر (السيناريو الأكثر شيوعاً: نسخ عمود من إكسل أو نور)
    extractedTokens = rawLines.map(line => {
      // فحص إذا كان السطر يحتوي على أعمدة مفصولة بـ Tab أو فاصلة
      const columns = line.split(/[\t,]+/).map(c => c.trim()).filter(Boolean);
      if (columns.length === 1) {
        return columns[0];
      }
      // إذا تم نسخ أكثر من عمود (مثال: الاسم والدرجة)، نبحث عن العمود الذي يمثل درجة أو غياب
      const scoreCol = columns.find(c => {
        const clean = c.replace(/[/\\%]/g, '').trim();
        const num = parseFloat(clean);
        return (!isNaN(num) && num >= 0 && num <= 1000) || clean === 'غ' || clean === 'غائب' || clean.toLowerCase() === 'absent';
      });
      return scoreCol || columns[columns.length - 1]; // نفضل عمود الدرجة أو الأخير
    });
  } else if (rawLines.length === 1) {
    // سطر واحد: قد يكون مفصولاً بـ Tab أو فواصل أو مسافات متعددة
    const singleLine = rawLines[0];
    const tabCols = singleLine.split('\t').map(c => c.trim()).filter(Boolean);
    if (tabCols.length > 1) {
      extractedTokens = tabCols;
    } else {
      const commaCols = singleLine.split(/[,،]+/).map(c => c.trim()).filter(Boolean);
      if (commaCols.length > 1) {
        extractedTokens = commaCols;
      } else {
        // فحص إذا كان يحتوي على مسافات تفصل بين أرقام متعددة
        const spaceCols = singleLine.split(/\s+/).map(c => c.trim()).filter(Boolean);
        if (spaceCols.length > 1 && spaceCols.every(c => !isNaN(parseFloat(c)) || c === 'غ' || c === 'غائب')) {
          extractedTokens = spaceCols;
        }
      }
    }
  }

  // إذا لم يتم استخراج سوى عنصر واحد، نتركه للّصق العادي لحقل فردي
  if (extractedTokens.length <= 1) {
    return null;
  }

  // معالجة وتنقية كل عنصر في المصفوفة
  const sanitizedGrades = extractedTokens.map(token => {
    if (!token) return { isAbsent: false, value: '', isBlank: true };

    const t = String(token).trim();
    // فحص حالات الغياب
    if (t === 'غ' || t === 'غائب' || t.toLowerCase() === 'absent' || t.toLowerCase() === 'a') {
      return { isAbsent: true, value: 'غائب', raw: t };
    }

    // تنظيف الأرقام من أي رموز أو نصوص
    const numClean = t.replace(/[^\d.-]/g, '');
    const num = parseFloat(numClean);
    if (!isNaN(num)) {
      // ضبط الدرجة بين 0 والحد الأقصى المسموح
      const clamped = Math.max(0, Math.min(Number(maxScore) || 100, num));
      return { isAbsent: false, value: clamped, raw: t };
    }

    return { isAbsent: false, value: '', isBlank: true, raw: t };
  });

  return sanitizedGrades;
}
