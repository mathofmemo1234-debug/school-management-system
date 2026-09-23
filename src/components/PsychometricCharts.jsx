import React from 'react';
import { BarChart3, TrendingUp, Award, AlertTriangle, CheckCircle, Percent } from 'lucide-react';

/**
 * PsychometricCharts Component
 * رسوم بيانية تفاعلية ومجهزة للطباعة لتحليل نتائج الاختبارات والمؤشرات السيكومترية
 */
export default function PsychometricCharts({ psychometrics, printMode = false }) {
  if (!psychometrics) return null;

  const {
    totalStudents = 0,
    totalRegistered = 0,
    absentCount = 0,
    maxScore = 20,
    meanScore = '0.0',
    stdDev = '0.00',
    kr20 = '0.00',
    validity = '0.00',
    sem = '0.00',
    meanDifficulty = '0.00',
    discriminationIndex = '0.00',
    passRate = 0,
    formulaUsed = 'KR-21',
    reliabilityAssessment = '',
    reliabilityColor = '#16a34a',
    difficultyAssessment = '',
    scoreDistribution = [],
    upperLowerComparison = null
  } = psychometrics;

  // إيجاد أقصى تكرار في التوزيع لتحديد ارتفاع الأعمدة البيانية
  const maxCountInDist = Math.max(1, ...scoreDistribution.map(d => d.count || 0), absentCount);

  const numericKr = parseFloat(kr20) || 0;
  const numericValidity = parseFloat(validity) || 0;
  const numericDiff = parseFloat(meanDifficulty) || 0;
  const numericDisc = parseFloat(discriminationIndex) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', direction: 'rtl', width: '100%' }}>
      
      {/* 1. مخطط توزيع درجات الطلاب (Score Distribution Histogram) */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: printMode ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#0e7490" />
            الرسم البياني لتوزيع درجات الطلاب عبر الفئات التحصيلية
          </h4>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            إجمالي المختبرين الفعليين: <strong>{totalStudents}</strong> {absentCount > 0 && `| الغائبين: ${absentCount}`}
          </span>
        </div>

        {/* Histogram Columns Container */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          height: '180px',
          padding: '10px 0 30px 0',
          borderBottom: '2px solid #cbd5e1',
          position: 'relative',
          gap: '8px'
        }}>
          {scoreDistribution.map((item, idx) => {
            const count = item.count || 0;
            const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
            const heightPercent = maxCountInDist > 0 ? Math.max(8, Math.round((count / maxCountInDist) * 100)) : 8;

            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                {/* Count Badge on Top */}
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: item.color, marginBottom: '4px' }}>
                  {count} ({pct}%)
                </span>

                {/* Bar */}
                <div style={{
                  width: '100%',
                  maxWidth: '54px',
                  height: `${heightPercent}%`,
                  background: `linear-gradient(180deg, ${item.color}dd, ${item.color})`,
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.4s ease',
                  border: `1px solid ${item.color}`
                }} />

                {/* X-Axis Label */}
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#475569',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {item.label.split('(')[0]}
                </span>
              </div>
            );
          })}

          {/* عمود الطلاب الغائبين إن وجدوا */}
          {absentCount > 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626', marginBottom: '4px' }}>
                {absentCount}
              </span>
              <div style={{
                width: '100%',
                maxWidth: '54px',
                height: `${Math.max(8, Math.round((absentCount / maxCountInDist) * 100))}%`,
                background: 'linear-gradient(180deg, #f87171, #dc2626)',
                borderRadius: '6px 6px 0 0',
                border: '1px solid #b91c1c'
              }} />
              <span style={{ position: 'absolute', bottom: '2px', fontSize: '11px', fontWeight: '600', color: '#dc2626' }}>
                غائب
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. مخطط المقارنة العليا والدنيا ومؤشرات القياس السيكومترية */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: printMode ? '1fr 1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        
        {/* مقارنة الفئة العليا والدنيا (Kelly's Upper/Lower 27%) */}
        {upperLowerComparison && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '18px',
            border: '1px solid #e2e8f0',
            boxShadow: printMode ? 'none' : '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="#0284c7" />
              مقارنة الفئتين العليا والدنيا (التمييز التربوي 27%)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Upper Group Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#166534' }}>⭐ الفئة العليا (أعلى 27%):</span>
                  <strong style={{ color: '#166534' }}>{upperLowerComparison.upperMean} من {maxScore}</strong>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (parseFloat(upperLowerComparison.upperMean) / maxScore) * 100)}%`,
                    height: '100%',
                    background: '#16a34a',
                    borderRadius: '5px'
                  }} />
                </div>
              </div>

              {/* Class Average Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0284c7' }}>📊 متوسط درجات الفصل:</span>
                  <strong style={{ color: '#0284c7' }}>{meanScore} من {maxScore}</strong>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (parseFloat(meanScore) / maxScore) * 100)}%`,
                    height: '100%',
                    background: '#0284c7',
                    borderRadius: '5px'
                  }} />
                </div>
              </div>

              {/* Lower Group Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#dc2626' }}>⚠️ الفئة الدنيا (أدنى 27%):</span>
                  <strong style={{ color: '#dc2626' }}>{upperLowerComparison.lowerMean} من {maxScore}</strong>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (parseFloat(upperLowerComparison.lowerMean) / maxScore) * 100)}%`,
                    height: '100%',
                    background: '#dc2626',
                    borderRadius: '5px'
                  }} />
                </div>
              </div>

              {/* Discrimination Badge */}
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: numericDisc >= 0.30 ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${numericDisc >= 0.30 ? '#bbf7d0' : '#fde68a'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px'
              }}>
                <span style={{ fontWeight: 'bold', color: numericDisc >= 0.30 ? '#166534' : '#92400e' }}>
                  معامل التمييز العام للاختبار (D):
                </span>
                <span style={{ fontWeight: '900', fontSize: '14px', color: numericDisc >= 0.30 ? '#15803d' : '#b45309' }}>
                  {discriminationIndex} ({upperLowerComparison.discriminationRate})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* مقاييس جودة القياس السيكومتري (Psychometric Meters) */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: printMode ? 'none' : '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="#0e7490" />
            مؤشرات الجودة السيكومترية للاختبار
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Reliability Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span><strong>معامل الثبات ({formulaUsed}):</strong> {kr20}</span>
                <span style={{ fontWeight: 'bold', color: reliabilityColor }}>{reliabilityAssessment}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.round(numericKr * 100))}%`,
                  height: '100%',
                  background: reliabilityColor,
                  borderRadius: '4px'
                }} />
              </div>
            </div>

            {/* Validity Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span><strong>معامل الصدق الذاتي (√r):</strong> {validity}</span>
                <span style={{ fontSize: '11px', color: '#0d9488', fontWeight: 'bold' }}>
                  {numericValidity >= 0.70 ? 'صدق مرتفع ✅' : 'صدق متوسط'}
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.round(numericValidity * 100))}%`,
                  height: '100%',
                  background: '#0d9488',
                  borderRadius: '4px'
                }} />
              </div>
            </div>

            {/* Difficulty Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span><strong>متوسط الصعوبة (P):</strong> {meanDifficulty}</span>
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold' }}>{difficultyAssessment}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.round(numericDiff * 100))}%`,
                  height: '100%',
                  background: (numericDiff >= 0.40 && numericDiff <= 0.75) ? '#16a34a' : '#d97706',
                  borderRadius: '4px'
                }} />
              </div>
            </div>

            {/* Pass Rate Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span><strong>نسبة النجاح العامة:</strong> {passRate}%</span>
                <span style={{ fontSize: '11px', color: passRate >= 70 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                  {passRate >= 70 ? 'نسبة إتقان ممتازة' : 'تحتاج متابعة'}
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${passRate}%`,
                  height: '100%',
                  background: passRate >= 70 ? '#16a34a' : '#ea580c',
                  borderRadius: '4px'
                }} />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
