import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, ShieldCheck, Download, Award, Building, FileText, UserCheck, Calendar, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NationalitySelect from './NationalitySelect';

/**
 * CertificateLetterModal
 * Generates and prints official Saudi Ministry of Education standard Identification Letters:
 * - Student (شهادة تعريف طالب منتظم)
 * - Teacher (خطاب / مشهد تعريف معلم)
 * - Staff / Supervisor / Personnel (خطاب تعريف موظف / كادر مدرسي)
 */
export default function CertificateLetterModal({ person, type = 'student', onClose }) {
  const { userData } = useAuth();
  
  const [recipient, setRecipient] = useState('إلى من يهمه الأمر');
  const [customRecipient, setCustomRecipient] = useState('');
  const [includeSalary, setIncludeSalary] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [purpose, setPurpose] = useState('تقديمها للجهات الرسمية المعنية');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [schoolYear, setSchoolYear] = useState('1447 / 1448 هـ - 2026 م');
  const [nationality, setNationality] = useState(person.nationality || 'سعودي');

  const schoolName = userData?.schoolName || 'المجمع التعليمي';
  const principalName = userData?.principalName || (userData?.role === 'admin' ? userData?.name : 'إدارة المدرسة');
  
  const finalRecipient = recipient === 'مخصص' ? (customRecipient || 'إلى من يهمه الأمر') : recipient;

  const handlePrint = () => {
    window.print();
  };

  // Determine Letter Title & Content
  let letterTitle = 'شهادة تعريف طالب منتظم';
  let badgeTitle = 'طالب';
  if (type === 'teacher') {
    letterTitle = 'مشهد تعريف معلم';
    badgeTitle = 'معلم';
  } else if (type === 'staff' || type === 'supervisor') {
    letterTitle = 'خطاب تعريف موظف / كادر مدرسي';
    badgeTitle = person.roleTitle || person.specialty || 'كادر إداري';
  }

  const modalJSX = (
    <div className="cert-modal-root" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px',
      overflowY: 'auto'
    }}>
      <div className="cert-modal-dialog glass-panel" style={{
        width: '850px',
        maxWidth: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Controls Bar (Hidden during Print) */}
        <div className="no-print" style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={22} color="#0e7490" /> {letterTitle} - {person.name}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
              معاينة وتخصيص وطباعة الخطاب الرسمي المعتمد
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0e7490, #63B2C6)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontWeight: 'bold',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <Printer size={18} /> طباعة الخطاب (PDF)
            </button>

            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={20} color="#475569" />
            </button>
          </div>
        </div>

        {/* Customization Options Toolbar (Hidden during Print) */}
        <div className="no-print" style={{ padding: '16px 24px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                الجهة الموجه إليها:
              </label>
              <select
                className="input-field"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
              >
                <option value="إلى من يهمه الأمر">إلى من يهمه الأمر</option>
                <option value="سعادة مدير الجوازات المحترم">إدارة الجوازات</option>
                <option value="سعادة مدير عام المرور المحترم">إدارة المرور</option>
                <option value="سعادة مدير البنك المحترم">البنك / المصرف</option>
                <option value="سعادة القنصل العام المحترم">السفارة / القنصلية</option>
                <option value="مخصص">جهة أخرى (كتابة يدوية)...</option>
              </select>
            </div>

            {recipient === 'مخصص' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  اسم الجهة:
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={customRecipient}
                  onChange={e => setCustomRecipient(e.target.value)}
                  placeholder="مثال: سعادة رئيس الغرفة التجارية..."
                  style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                تاريخ الإصدار:
              </label>
              <input
                type="date"
                className="input-field"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                العام الدراسي:
              </label>
              <input
                type="text"
                className="input-field"
                value={schoolYear}
                onChange={e => setSchoolYear(e.target.value)}
                style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <NationalitySelect
                value={nationality}
                onChange={setNationality}
                label="الجنسية:"
              />
            </div>

            {type !== 'student' && (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#334155', marginTop: '22px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeSalary}
                    onChange={e => setIncludeSalary(e.target.checked)}
                  />
                  تضمين الراتب الشهري
                </label>
              </div>
            )}

            {includeSalary && type !== 'student' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                  إجمالي الراتب (ريال):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={salaryAmount}
                  onChange={e => setSalaryAmount(e.target.value)}
                  placeholder="مثال: 12500 ريال"
                  style={{ fontSize: '13px', padding: '6px 10px', marginBottom: 0 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Printable Official Document Container */}
        <div className="printable-certificate-page" style={{
          padding: '48px 56px',
          background: 'white',
          minHeight: '650px',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: '#0f172a',
          position: 'relative'
        }}>
          
          {/* Watermark Logo/Pattern */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.04,
            fontSize: '120px',
            fontWeight: '900',
            pointerEvents: 'none',
            userSelect: 'none',
            textAlign: 'center',
            lineHeight: 1.2
          }}>
            المملكة العربية السعودية<br />وزارة التعليم
          </div>

          {/* Official Letterhead */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '3px double #0e7490',
            paddingBottom: '20px',
            marginBottom: '32px'
          }}>
            {/* Right Side: Kingdom Info */}
            <div style={{ textAlign: 'right', fontSize: '13px', lineHeight: '1.8', color: '#1e293b' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0e7490' }}>المملكة العربية السعودية</div>
              <div>وزارة التعليم</div>
              <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
              <div style={{ fontWeight: 'bold' }}>{schoolName}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>الرقم الوزاري المعتمد: 441029</div>
            </div>

            {/* Center: Official Ministry Logo & School Logo Side-by-Side */}
            <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <img
                src={`${import.meta.env.BASE_URL}minst.svg`}
                alt="وزارة التعليم"
                style={{
                  height: '75px',
                  width: 'auto',
                  maxWidth: '125px',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                }}
              />
              <div style={{ width: '1.5px', height: '48px', background: '#cbd5e1' }}></div>
              <img
                src={userData?.logoUrl || `${import.meta.env.BASE_URL}logo.webp`}
                alt="شعار المدرسة"
                style={{
                  height: '68px',
                  width: 'auto',
                  maxWidth: '110px',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `${import.meta.env.BASE_URL}default_logo.png`;
                }}
              />
            </div>

            {/* Left Side: Letter Metadata */}
            <div style={{ textAlign: 'left', fontSize: '13px', lineHeight: '1.8', color: '#1e293b' }}>
              <div><strong>الرقم:</strong> ت / {person.nationalId?.slice(-4) || '1029'} / {new Date().getFullYear()}</div>
              <div><strong>التاريخ:</strong> {issueDate} م</div>
              <div><strong>الموافق:</strong> {new Date(issueDate).toLocaleDateString('ar-SA')} هـ</div>
              <div><strong>المشفوعات:</strong> لا يوجد</div>
            </div>
          </div>

          {/* Letter Title */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{
              margin: '0 auto',
              display: 'inline-block',
              padding: '6px 32px',
              borderBottom: '2px solid #0e7490',
              color: '#0e7490',
              fontSize: '22px',
              fontWeight: '800'
            }}>
              {letterTitle}
            </h1>
          </div>

          {/* Recipient Address */}
          <div style={{ marginBottom: '24px', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>
            سعادة / {finalRecipient} <span style={{ float: 'left', fontWeight: 'normal', color: '#64748b' }}>حفظه الله</span>
            <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 'normal', color: '#334155' }}>
              السلام عليكم ورحمة الله وبركاته، وبعد:
            </div>
          </div>

          {/* Body Content */}
          <div style={{
            fontSize: '15px',
            lineHeight: '2.2',
            textAlign: 'justify',
            color: '#1e293b',
            marginBottom: '32px',
            background: 'rgba(248, 250, 252, 0.5)',
            padding: '20px 24px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            {type === 'student' ? (
              <>
                تشهد إدارة <strong>{schoolName}</strong> بأن الطالب: 
                <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#0e7490', margin: '0 6px' }}>{person.name}</span>
                ، {nationality ? `${nationality} الجنسية` : 'سعودي الجنسية'}، بموجب الهوية الوطنية / الإقامة رقم (<strong>{person.nationalId}</strong>)، 
                مقيد ومنتظم بالدراسة لدينا في <strong>{person.class || person.className || 'المرحلة المحددة'}</strong> 
                خلال العام الدراسي <strong>{schoolYear}</strong>، وما زال مستمراً في دراسته حتى تاريخه.
              </>
            ) : type === 'teacher' ? (
              <>
                تشهد إدارة <strong>{schoolName}</strong> بأن الأستاذ / المعلم: 
                <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#0e7490', margin: '0 6px' }}>{person.name}</span>
                ، {nationality ? `${nationality} الجنسية` : 'سعودي الجنسية'}، بموجب السجل المدني / الإقامة رقم (<strong>{person.nationalId}</strong>)، 
                يعمل لدينا كمعلم لمادة <strong>{person.subject || 'التعليم العام'}</strong> 
                وعلى رأس العمل حتى تاريخ تحرير هذا الخطاب.
                {includeSalary && salaryAmount && (
                  <span> ويتقاضى راتباً شهرياً إجمالياً قدره (<strong>{salaryAmount}</strong>).</span>
                )}
              </>
            ) : (
              <>
                تشهد إدارة <strong>{schoolName}</strong> بأن الموظف / عضو الكادر: 
                <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#0e7490', margin: '0 6px' }}>{person.name}</span>
                ، {nationality ? `${nationality} الجنسية` : 'سعودي الجنسية'}، بموجب السجل المدني / الإقامة رقم (<strong>{person.nationalId}</strong>)، 
                يعمل لدينا بمسؤولية / وظيفة <strong>{person.roleTitle || person.specialty || 'كادر إداري'}</strong> 
                وعلى رأس العمل للعام الدراسي <strong>{schoolYear}</strong>.
                {includeSalary && salaryAmount && (
                  <span> ويتقاضى راتباً شهرياً إجمالياً قدره (<strong>{salaryAmount}</strong>).</span>
                )}
              </>
            )}

            <div style={{ marginTop: '14px' }}>
              وقد أُعطي هذا المشهد بناءً على طلبه لتقديمه إلى (<strong>{finalRecipient}</strong>) لغرض {purpose}، دون أدنى مسؤولية مالية أو قانونية على المدرسة تجاه حقوق الغير.
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', color: '#0e7490', marginBottom: '40px' }}>
            شاكرين ومقدرين لكم حسن تعاونكم الدائم،،،
          </div>

          {/* Official Signatures & Stamp Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: '40px',
            paddingTop: '20px'
          }}>
            {/* Left: QR Verification Code */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              <div style={{
                width: '75px',
                height: '75px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '4px',
                background: '#f8fafc',
                margin: '0 auto 6px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldCheck size={48} color="#0e7490" />
              </div>
              <div>رمز التحقق الإلكتروني</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{person.nationalId?.slice(-6) || 'SEC-882'}</div>
            </div>

            {/* Center: Official Seal */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                border: '3px dashed #0e7490',
                color: '#0e7490',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                opacity: 0.85,
                transform: 'rotate(-8deg)'
              }}>
                <div>الختم الرسمي</div>
                <div style={{ fontSize: '9px', marginTop: '2px' }}>{schoolName}</div>
                <div style={{ fontSize: '8px' }}>معتمد رسمياً</div>
              </div>
            </div>

            {/* Right: Principal Signature */}
            <div style={{ textAlign: 'center', fontSize: '14px', minWidth: '180px' }}>
              <div style={{ color: '#475569', marginBottom: '4px' }}>مدير المجمع والمدرسة</div>
              <div style={{ fontWeight: 'bold', color: '#0e7490', fontSize: '16px', marginBottom: '8px' }}>
                {principalName}
              </div>
              <div style={{
                height: '40px',
                borderBottom: '2px solid #334155',
                width: '140px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'cursive',
                fontSize: '18px',
                color: '#0e7490',
                opacity: 0.7
              }}>
                معتمد
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '56px',
            right: '56px',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '8px',
            fontSize: '10px',
            color: '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>تم استخراج هذا الخطاب إلكترونياً من بوابة الإدارة المدرسية الموحدة</span>
            <span>صالح للاستخدام الرسمي لمدة 3 أشهر من تاريخ الإصدار</span>
          </div>

        </div>

      </div>

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11pt !important;
          }
          /* Completely hide EVERYTHING under body except the modal container so NO blank pages exist! */
          body > *:not(.cert-modal-root) {
            display: none !important;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .cert-modal-root,
          .cert-modal-dialog {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            backdrop-filter: none !important;
          }
          .printable-certificate-page, .printable-certificate-page * {
            visibility: visible !important;
          }
          .printable-certificate-page {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            display: block !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 12mm 12mm;
          }
        }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalJSX, document.body) : modalJSX;
}
