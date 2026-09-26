/**
 * Class and Stage Normalization & Fuzzy Matcher Utility
 * Accurately aligns diverse naming conventions across schools:
 * e.g., '3 متوسط' <-> 'ثالث متوسط' <-> 'الثالث متوسط' <-> '3م'
 * 'أول ثانوي' <-> '1ث' <-> 'الصف الأول الثانوي' <-> '1-1' <-> '1/1' <-> 'G10'
 */

export function normalizeClassName(raw) {
  if (!raw) return '';
  let str = String(raw).trim();

  // Convert Arabic-Indic numerals to Western numerals
  str = str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  // Normalize alef and taa marbuta
  str = str.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

  // Remove common prefix words like "الصف", "مرحلة", "فصل"
  str = str.replace(/\b(الصف|مرحلة|فصل)\b/g, '').trim();

  return str.toLowerCase();
}

/**
 * Checks if a target item (worksheet, assignment, exam, prep) matches a student's class, stage, or grade.
 */
export function isClassOrStageMatch(studentClass, targetClass, targetStage = '', targetSchoolId = '', studentSchoolId = '', itemTitle = '') {
  // 1. School Isolation Check
  if (targetSchoolId && studentSchoolId && 
      targetSchoolId !== 'ALL' && targetSchoolId !== 'all' && 
      studentSchoolId !== 'ALL' && studentSchoolId !== 'all') {
    if (targetSchoolId !== studentSchoolId) return false;
  }

  // 2. Global broadcasts or open items
  if (!targetClass || targetClass === 'ALL' || targetClass === 'all' || targetClass === 'الكل' || targetClass === 'عام') {
    return true;
  }

  if (!studentClass) {
    // If student has no class set yet, but is in the same school, allow matching
    return true;
  }

  const sNorm = normalizeClassName(studentClass);
  const tNorm = normalizeClassName(targetClass);
  const titleNorm = normalizeClassName(itemTitle);
  const stageNorm = normalizeClassName(targetStage);

  // Direct normalized match
  if (sNorm === tNorm || sNorm.includes(tNorm) || tNorm.includes(sNorm)) {
    return true;
  }

  // Equivalence mapping for Saudi K-12 stages and grades
  const equivalences = [
    // Elementary
    ['1 ابتدائي', 'اول ابتدائي', 'الاول الابتدائي', '1ب', 'g1', 'grade 1'],
    ['2 ابتدائي', 'ثاني ابتدائي', 'الثاني الابتدائي', '2ب', 'g2', 'grade 2'],
    ['3 ابتدائي', 'ثالث ابتدائي', 'الثالث الابتدائي', '3ب', 'g3', 'grade 3'],
    ['4 ابتدائي', 'رابع ابتدائي', 'الرابع الابتدائي', '4ب', 'g4', 'grade 4', 'g4a', 'g4b'],
    ['5 ابتدائي', 'خامس ابتدائي', 'الخامس الابتدائي', '5ب', 'g5', 'grade 5', 'g5a', 'g5b'],
    ['6 ابتدائي', 'سادس ابتدائي', 'السادس الابتدائي', '6ب', 'g6', 'grade 6', 'g6a', 'g6b'],

    // Intermediate
    ['1 متوسط', 'اول متوسط', 'الاول المتوسط', '1م', 'g7', 'grade 7', 'g7a', 'g7b'],
    ['2 متوسط', 'ثاني متوسط', 'الثاني المتوسط', '2م', 'g8', 'grade 8', 'g8a', 'g8b'],
    ['3 متوسط', 'ثالث متوسط', 'الثالث متوسط', '3م', 'g9', 'grade 9', 'g9a', 'g9b', '3-1', '3/1', '3-2', '3/2'],

    // Secondary / High School
    ['1 ثانوي', 'اول ثانوي', 'الاول الثانوي', '1ث', 'g10', 'grade 10', 'g10a', 'g10b', '1-1', '1/1', 'مسارات 1', 'الرياضيات 1-1'],
    ['2 ثانوي', 'ثاني ثانوي', 'الثاني الثانوي', '2ث', 'g11', 'grade 11', 'g11a', 'g11b', '2-1', '2/1', 'مسارات 2', 'الرياضيات 2-1'],
    ['3 ثانوي', 'ثالث ثانوي', 'الثالث الثانوي', '3ث', 'g12', 'grade 12', 'g12a', 'g12b', '3-1', '3/2', 'مسارات 3']
  ];

  for (const group of equivalences) {
    const sMatches = group.some(term => {
      const termNorm = normalizeClassName(term);
      return sNorm === termNorm || sNorm.includes(termNorm) || termNorm.includes(sNorm);
    });

    if (sMatches) {
      // Check if targetClass matches this group
      const tMatches = group.some(term => {
        const termNorm = normalizeClassName(term);
        return tNorm === termNorm || tNorm.includes(termNorm) || termNorm.includes(tNorm);
      });
      if (tMatches) return true;

      // Check if itemTitle contains keywords from this group
      const titleMatches = group.some(term => {
        const termNorm = normalizeClassName(term);
        return titleNorm.includes(termNorm);
      });
      if (titleMatches) return true;
    }
  }

  // Broad Stage matching fallback (e.g. if item is labeled "المرحلة الثانوية" and student is "أول ثانوي")
  if (stageNorm) {
    if (stageNorm.includes('ثانوي') && (sNorm.includes('ثانوي') || sNorm.includes('ث') || sNorm.includes('g10') || sNorm.includes('g11') || sNorm.includes('g12'))) {
      return true;
    }
    if (stageNorm.includes('متوسط') && (sNorm.includes('متوسط') || sNorm.includes('م') || sNorm.includes('g7') || sNorm.includes('g8') || sNorm.includes('g9'))) {
      return true;
    }
    if (stageNorm.includes('ابتدائي') && (sNorm.includes('ابتدائي') || sNorm.includes('ب') || sNorm.includes('g1') || sNorm.includes('g2') || sNorm.includes('g3') || sNorm.includes('g4') || sNorm.includes('g5') || sNorm.includes('g6'))) {
      return true;
    }
  }

  return false;
}
