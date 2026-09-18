import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Download, 
  RotateCw, 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  Code, 
  FileText,
  HelpCircle,
  Sparkles,
  UserCheck
} from 'lucide-react';
import {
  requestGoogleAccessToken,
  exportToGoogleFormsApi,
  exportToGoogleFormsScript,
  getStoredGoogleClientId,
  setStoredGoogleClientId,
  getStoredGoogleScriptUrl,
  setStoredGoogleScriptUrl,
  getGoogleAppsScriptTemplateCode
} from '../services/googleFormsService';
import {
  requestMicrosoftLogin,
  exportToMicrosoftForms,
  getStoredMsClientId,
  setStoredMsClientId,
  getStoredMsWebhookUrl,
  setStoredMsWebhookUrl
} from '../services/microsoftFormsService';

export default function FormsExportModal({
  isOpen,
  onClose,
  exam,
  initialPlatform = 'google' // 'google' | 'microsoft'
}) {
  const [platform, setPlatform] = useState(initialPlatform); // 'google' | 'microsoft'
  const [googleMethod, setGoogleMethod] = useState('script'); // 'script' | 'api'
  
  // Loading & Progress State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Auth state
  const [googleToken, setGoogleToken] = useState(null);
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [msAccount, setMsAccount] = useState(null);
  
  // Success / Results State
  const [successResult, setSuccessResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  
  // Error State
  const [errorMessage, setErrorMessage] = useState('');
  
  // Advanced Settings Accordion
  const [showSettings, setShowSettings] = useState(false);
  const [showScriptCodeModal, setShowScriptCodeModal] = useState(false);
  
  // Form Settings Inputs
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [msClientId, setMsClientId] = useState('');
  const [msWebhookUrl, setMsWebhookUrl] = useState('');

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setPlatform(initialPlatform || 'google');
      setSuccessResult(null);
      setErrorMessage('');
      setIsLoading(false);
      setLoadingMessage('');
      setGoogleClientId(getStoredGoogleClientId());
      setGoogleScriptUrl(getStoredGoogleScriptUrl());
      setMsClientId(getStoredMsClientId());
      setMsWebhookUrl(getStoredMsWebhookUrl());
    }
  }, [isOpen, initialPlatform]);

  if (!isOpen || !exam) return null;

  // ==========================================
  // GOOGLE ACTIONS
  // ==========================================
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);
    setLoadingMessage('جاري فتح نافذة اختيار حساب Google (Select Account)...');

    try {
      const authResult = await requestGoogleAccessToken(googleClientId);
      setGoogleToken(authResult.accessToken);
      setGoogleUserEmail('تم ربط الحساب بنجاح ✅');
      setIsLoading(false);
      setLoadingMessage('');
    } catch (err) {
      setIsLoading(false);
      setLoadingMessage('');
      setErrorMessage(err.message || 'تعذر تسجيل الدخول بحساب Google');
    }
  };

  const handleExportGoogle = async () => {
    setErrorMessage('');
    setSuccessResult(null);
    setIsLoading(true);

    try {
      if (googleMethod === 'api') {
        let token = googleToken;
        if (!token) {
          setLoadingMessage('يرجى تحديد حساب Google الخاص بك أولاً...');
          const authResult = await requestGoogleAccessToken(googleClientId);
          token = authResult.accessToken;
          setGoogleToken(token);
          setGoogleUserEmail('تم اعتماد الحساب ✅');
        }

        const result = await exportToGoogleFormsApi(exam, token, (msg) => setLoadingMessage(msg));
        setSuccessResult({
          platform: 'google',
          ...result
        });
      } else {
        // Via Apps Script Web App
        const url = googleScriptUrl || getStoredGoogleScriptUrl();
        if (!url) {
          setShowSettings(true);
          throw new Error('يرجى إدخال رابط Google Apps Script Web App في الإعدادات أدناه للبدء');
        }

        const result = await exportToGoogleFormsScript(exam, url, (msg) => setLoadingMessage(msg));
        setSuccessResult({
          platform: 'google',
          ...result
        });
      }
    } catch (err) {
      console.error('Google Forms Export Error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء تصدير الاختبار إلى Google Forms');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // ==========================================
  // MICROSOFT ACTIONS
  // ==========================================
  const handleMicrosoftSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);
    setLoadingMessage('جاري فتح نافذة اختيار الحساب المؤسسي لمايكروسوفت (MSAL)...');

    try {
      const res = await requestMicrosoftLogin(msClientId);
      setMsAccount(res.account);
      setIsLoading(false);
      setLoadingMessage('');
    } catch (err) {
      setIsLoading(false);
      setLoadingMessage('');
      setErrorMessage(err.message || 'تعذر تسجيل الدخول إلى حساب Microsoft');
    }
  };

  const handleExportMicrosoft = async () => {
    setErrorMessage('');
    setSuccessResult(null);
    setIsLoading(true);
    setLoadingMessage('جاري إعداد وثيقة وتنسيق بنود الاختبار لمنصة Microsoft Forms...');

    try {
      const webhook = msWebhookUrl || getStoredMsWebhookUrl();
      const result = await exportToMicrosoftForms(
        exam,
        { webhookUrl: webhook, autoDownload: true },
        (msg) => setLoadingMessage(msg)
      );

      setSuccessResult({
        platform: 'microsoft',
        ...result
      });
    } catch (err) {
      console.error('Microsoft Forms Export Error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء تصدير الاختبار إلى Microsoft Forms');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveSettings = () => {
    setStoredGoogleClientId(googleClientId);
    setStoredGoogleScriptUrl(googleScriptUrl);
    setStoredMsClientId(msClientId);
    setStoredMsWebhookUrl(msWebhookUrl);
    alert('✅ تم حفظ الإعدادات بنجاح!');
  };

  const handleCopyLink = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyScriptCode = () => {
    const code = getGoogleAppsScriptTemplateCode();
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      direction: 'rtl'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: platform === 'google' ? 'linear-gradient(135deg, #fbf7ff 0%, #ffffff 100%)' : 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)'
        }}>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: '800',
              color: platform === 'google' ? '#673ab7' : '#008272',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {platform === 'google' ? (
                <>
                  <span style={{ fontSize: '22px' }}>📝</span>
                  تصدير الاختبار إلى Google Forms
                </>
              ) : (
                <>
                  <span style={{ fontSize: '22px' }}>📋</span>
                  تصدير الاختبار إلى Microsoft Forms
                </>
              )}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              الاختبار: <strong>{exam.title}</strong> | الصف: <strong>{exam.targetClass || 'عام'}</strong> | عدد الأسئلة: <strong>{exam.questions?.length || 0} أسئلة</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              color: '#64748b',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Platform Tabs Selector */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '6px'
        }}>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setPlatform('google');
              setSuccessResult(null);
              setErrorMessage('');
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: platform === 'google' ? '#ffffff' : 'transparent',
              color: platform === 'google' ? '#673ab7' : '#64748b',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: platform === 'google' ? '0 2px 8px rgba(103, 58, 183, 0.15)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px' }}>🟣</span>
            Google Forms
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setPlatform('microsoft');
              setSuccessResult(null);
              setErrorMessage('');
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: platform === 'microsoft' ? '#ffffff' : 'transparent',
              color: platform === 'microsoft' ? '#008272' : '#64748b',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: platform === 'microsoft' ? '0 2px 8px rgba(0, 130, 114, 0.15)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px' }}>🔷</span>
            Microsoft Forms
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Error Alert Box */}
          {errorMessage && (
            <div style={{
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              color: '#991b1b',
              fontSize: '13.5px',
              lineHeight: '1.5'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', marginBottom: '3px' }}>تعذر إتمام العملية:</strong>
                {errorMessage}
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Success Result View */}
          {successResult ? (
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '14px',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                background: '#22c55e',
                color: 'white',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(34, 197, 94, 0.25)'
              }}>
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#166534', fontWeight: '800' }}>
                  {successResult.platform === 'google' 
                    ? '🎉 تم إنشاء نموذج Google Forms بنجاح!' 
                    : '🎉 تم تجهيز حزمة Microsoft Forms بنجاح!'}
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: '#15803d' }}>
                  تم تصدير ({successResult.totalQuestions}) سؤالاً مع الاختيارات وتحديد الإجابات الصحيحة.
                </p>
              </div>

              {/* Google Links */}
              {successResult.platform === 'google' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {successResult.editUrl && (
                    <div style={{
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}>
                      <div style={{ textAlign: 'right', overflow: 'hidden' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>رابط التعديل للمعلم:</span>
                        <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', direction: 'ltr', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {successResult.editUrl}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleCopyLink(successResult.editUrl)}
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {copiedLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                          نسخ
                        </button>
                        <a
                          href={successResult.editUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', background: '#673ab7', borderColor: '#673ab7' }}
                        >
                          <ExternalLink size={14} />
                          فتح
                        </a>
                      </div>
                    </div>
                  )}

                  {successResult.responderUri && (
                    <div style={{
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}>
                      <div style={{ textAlign: 'right', overflow: 'hidden' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>رابط الطلاب لحل الاختبار:</span>
                        <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', direction: 'ltr', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {successResult.responderUri}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleCopyLink(successResult.responderUri)}
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Copy size={14} />
                          نسخ الرابط
                        </button>
                        <a
                          href={successResult.responderUri}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        >
                          <ExternalLink size={14} />
                          معاينة
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Microsoft Quick Import Flow */}
              {successResult.platform === 'microsoft' && (
                <div style={{ width: '100%', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    lineHeight: '1.7',
                    color: '#334155'
                  }}>
                    <strong style={{ color: '#008272', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                      📋 خطوات إكمال إنشاء الاختبار في Microsoft Forms في 10 ثوانٍ:
                    </strong>
                    <ol style={{ margin: 0, paddingInlineStart: '20px' }}>
                      <li>
                        تم تنزيل ملف الاختبار <strong>({successResult.filename})</strong> المجهز كلياً لمحرك الذكاء الاصطناعي للاستيراد السريع.
                      </li>
                      <li>
                        انقر على الزر أدناه لفتح بوابة <strong>Microsoft Forms</strong> مباشرة.
                      </li>
                      <li>
                        في أعلى الصفحة اضغط على خيار <strong>"استيراد سريع" (Quick Import)</strong> ثم اختر <strong>"تحميل من هذا الجهاز"</strong> وحدد الملف المنزّل.
                      </li>
                      <li>
                        سيقوم Microsoft Forms بتحويل كافة الأسئلة والخيارات والإجابات الصحيحة إلى نموذج تفاعلي فوري!
                      </li>
                    </ol>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {successResult.downloadFn && (
                      <button
                        type="button"
                        onClick={successResult.downloadFn}
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                      >
                        <Download size={16} />
                        إعادة تحميل ملف الأسئلة (.doc)
                      </button>
                    )}

                    <a
                      href={successResult.portalUrl || 'https://forms.office.com/pages/designpagev2.aspx'}
                      target="_blank"
                      rel="noreferrer"
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #008272, #00a896)',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13.5px',
                        fontWeight: 'bold',
                        padding: '10px 20px',
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(0, 130, 114, 0.3)'
                      }}
                    >
                      <ExternalLink size={16} />
                      فتح Microsoft Forms الآن
                    </a>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSuccessResult(null)}
                className="btn btn-outline"
                style={{ marginTop: '8px', fontSize: '13px' }}
              >
                تصدير مرة أخرى أو تعديل الخيارات
              </button>
            </div>
          ) : (
            <>
              {/* PLATFORM 1: GOOGLE FORMS VIEW */}
              {platform === 'google' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Account Selection Banner */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        background: '#673ab7',
                        color: 'white',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        G
                      </div>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#1e293b', display: 'block' }}>
                          الحساب المستهدف للتصدير:
                        </strong>
                        <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {googleUserEmail || 'يمكنك تحديد الحساب الشخصي أو حساب المدرسة عند النقر'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleGoogleSignIn}
                      className="btn btn-outline"
                      style={{
                        borderColor: '#673ab7',
                        color: '#673ab7',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px'
                      }}
                    >
                      <UserCheck size={15} />
                      {googleToken ? 'تبديل حساب Google' : 'اختيار حساب Google (Sign-In)'}
                    </button>
                  </div>

                  {/* Export Method Choice */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                  }}>
                    <div
                      onClick={() => !isLoading && setGoogleMethod('script')}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: `2px solid ${googleMethod === 'script' ? '#673ab7' : '#e2e8f0'}`,
                        background: googleMethod === 'script' ? '#fbf7ff' : '#ffffff',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '14px', color: googleMethod === 'script' ? '#673ab7' : '#0f172a' }}>
                          ⚡ خادم Google Apps Script (موصى به للمدارس)
                        </strong>
                        <input
                          type="radio"
                          name="google_method"
                          checked={googleMethod === 'script'}
                          onChange={() => setGoogleMethod('script')}
                        />
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                        طريقة موثوقة وفورية بدون شاشات تحقق معقدة، تنشئ النموذج تلقائياً في حساب المدرسة.
                      </p>
                    </div>

                    <div
                      onClick={() => !isLoading && setGoogleMethod('api')}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: `2px solid ${googleMethod === 'api' ? '#673ab7' : '#e2e8f0'}`,
                        background: googleMethod === 'api' ? '#fbf7ff' : '#ffffff',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '14px', color: googleMethod === 'api' ? '#673ab7' : '#0f172a' }}>
                          🔑 Google Forms API v1 المباشر
                        </strong>
                        <input
                          type="radio"
                          name="google_method"
                          checked={googleMethod === 'api'}
                          onChange={() => setGoogleMethod('api')}
                        />
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                        تصدير مباشر عبر OAuth 2.0 API مع نافذة اختيار الحساب (يتطلب تفعيل API).
                      </p>
                    </div>
                  </div>

                  {/* Web App URL Helper if script method selected */}
                  {googleMethod === 'script' && (
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                          رابط Google Apps Script Web App للمدرسة:
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowScriptCodeModal(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#673ab7',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <Code size={14} />
                          نسخ كود السكربت الجاهز
                        </button>
                      </div>
                      <input
                        type="url"
                        className="input-field"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={googleScriptUrl}
                        onChange={(e) => {
                          setGoogleScriptUrl(e.target.value);
                          setStoredGoogleScriptUrl(e.target.value);
                        }}
                        style={{ marginBottom: '4px', fontSize: '13px', direction: 'ltr', textAlign: 'left' }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        يتم حفظ هذا الرابط تلقائياً في متصفحك ولن تضطر لإدخاله في كل مرة.
                      </span>
                    </div>
                  )}

                  {/* Action Button */}
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleExportGoogle}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: isLoading ? '#cbd5e1' : 'linear-gradient(135deg, #673ab7, #7e57c2)',
                        color: 'white',
                        fontWeight: '800',
                        fontSize: '15px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: isLoading ? 'none' : '0 4px 14px rgba(103, 58, 183, 0.35)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isLoading ? (
                        <>
                          <RotateCw size={18} className="spin" />
                          <span>{loadingMessage || 'جاري التصدير...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          بدء تصدير الأسئلة إلى Google Forms الآن
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* PLATFORM 2: MICROSOFT FORMS VIEW */}
              {platform === 'microsoft' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Account Selection Banner (MSAL) */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        background: '#008272',
                        color: 'white',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        MS
                      </div>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#1e293b', display: 'block' }}>
                          حساب Microsoft المستهدف:
                        </strong>
                        <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {msAccount ? `${msAccount.name} (${msAccount.username})` : 'حساب منصة مدرستي أو Office 365 التعليمي'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleMicrosoftSignIn}
                      className="btn btn-outline"
                      style={{
                        borderColor: '#008272',
                        color: '#008272',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px'
                      }}
                    >
                      <UserCheck size={15} />
                      {msAccount ? 'تبديل الحساب المؤسسي' : 'تسجيل دخول Microsoft (MSAL)'}
                    </button>
                  </div>

                  {/* Explanation card */}
                  <div style={{
                    background: '#f0fdfa',
                    border: '1.5px solid #99f6e4',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                    color: '#134e4a'
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#0f766e' }}>
                      <FileText size={16} /> آلية التصدير الذكية الرسمية لـ Microsoft Forms:
                    </strong>
                    يقوم النظام برمجياً بتنسيق بنود الاختبار وإجاباتها النموذجية بدقة متناهية متوافقة مع محرك 
                    <strong> Quick Import الرسمي</strong> من Microsoft، وتنزيل الوثيقة فوراً وفتح بوابة Microsoft Forms لتسجيل الدخول وإنشاء الاختبار في ثوانٍ.
                  </div>

                  {/* Action Button */}
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleExportMicrosoft}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: isLoading ? '#cbd5e1' : 'linear-gradient(135deg, #008272, #0f766e)',
                        color: 'white',
                        fontWeight: '800',
                        fontSize: '15px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: isLoading ? 'none' : '0 4px 14px rgba(0, 130, 114, 0.35)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isLoading ? (
                        <>
                          <RotateCw size={18} className="spin" />
                          <span>{loadingMessage || 'جاري التصدير...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          تصدير الأسئلة وتجهيز نموذج Microsoft Forms
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Advanced Settings Accordion */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '4px 0'
              }}
            >
              <Settings size={15} />
              إعدادات الاتصال المتقدمة (Client IDs & Webhooks)
              {showSettings ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showSettings && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Google OAuth Client ID مخصص (اختياري لـ Google Forms API):
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="مثال: 123456-abc.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    style={{ fontSize: '12px', direction: 'ltr', textAlign: 'left', marginBottom: 0 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Microsoft Application (Client) ID مخصص (اختياري لـ Azure AD):
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="مثال: ea5a67f6-b6f3-4338-b240-c655ddc369e3"
                    value={msClientId}
                    onChange={(e) => setMsClientId(e.target.value)}
                    style={{ fontSize: '12px', direction: 'ltr', textAlign: 'left', marginBottom: 0 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Microsoft Power Automate / Webhook المؤسسي (اختياري):
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://prod-xx.westus.logic.azure.com/workflows/..."
                    value={msWebhookUrl}
                    onChange={(e) => setMsWebhookUrl(e.target.value)}
                    style={{ fontSize: '12px', direction: 'ltr', textAlign: 'left', marginBottom: 0 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    حفظ الإعدادات المخصصة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Modal for Google Apps Script */}
      {showScriptCodeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <strong style={{ fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="#673ab7" />
                كود Google Apps Script الجاهز للنشر
              </strong>
              <button
                type="button"
                onClick={() => setShowScriptCodeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                انسخ هذا الكود والصقه في مشروع جديد في <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: '#673ab7', fontWeight: 'bold' }}>script.google.com</a> ثم انقر على Deploy &gt; New deployment &gt; Web app واختر الصلاحية Anyone:
              </p>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  padding: '16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: '320px',
                  direction: 'ltr',
                  textAlign: 'left'
                }}>
                  {getGoogleAppsScriptTemplateCode()}
                </pre>
              </div>
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={handleCopyScriptCode}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: '#673ab7', borderColor: '#673ab7' }}
              >
                {copiedScript ? <Check size={16} /> : <Copy size={16} />}
                {copiedScript ? 'تم نسخ الكود بنجاح!' : 'نسخ الكود بالكامل'}
              </button>

              <button
                type="button"
                onClick={() => setShowScriptCodeModal(false)}
                className="btn btn-outline"
                style={{ fontSize: '13px' }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
