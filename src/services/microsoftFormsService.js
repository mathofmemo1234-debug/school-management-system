// =========================================================================
// MICROSOFT FORMS EXPORT SERVICE
// Supports:
// 1. MSAL (Microsoft Authentication Library) with forced 'select_account' prompt
// 2. Microsoft Forms Quick Import package generation (.doc / Word XML)
// 3. Microsoft Forms direct portal launcher and institutional webhook / Forms API
// =========================================================================

import { PublicClientApplication } from "@azure/msal-browser";

// Default public client ID for education/multi-tenant Microsoft applications
const DEFAULT_MS_CLIENT_ID = "ea5a67f6-b6f3-4338-b240-c655ddc369e3"; // Standard Microsoft Office / Education client
const STORAGE_KEY_MS_CLIENT_ID = "school_system_ms_client_id";
const STORAGE_KEY_MS_WEBHOOK = "school_system_ms_webhook";

let msalInstance = null;

export const getStoredMsClientId = () => {
  return localStorage.getItem(STORAGE_KEY_MS_CLIENT_ID) || "";
};

export const setStoredMsClientId = (id) => {
  if (id) {
    localStorage.setItem(STORAGE_KEY_MS_CLIENT_ID, id.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_MS_CLIENT_ID);
  }
  msalInstance = null; // Reset instance on config change
};

export const getStoredMsWebhookUrl = () => {
  return localStorage.getItem(STORAGE_KEY_MS_WEBHOOK) || "";
};

export const setStoredMsWebhookUrl = (url) => {
  if (url) {
    localStorage.setItem(STORAGE_KEY_MS_WEBHOOK, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_MS_WEBHOOK);
  }
};

/**
 * Initialize or get MSAL instance
 */
export const getMsalInstance = async (customClientId = null) => {
  const clientId = customClientId || getStoredMsClientId() || DEFAULT_MS_CLIENT_ID;

  if (!msalInstance || msalInstance.config?.auth?.clientId !== clientId) {
    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
      }
    };

    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }

  return msalInstance;
};

/**
 * Sign in using MSAL with prompt: 'select_account'
 * Allows the teacher to select their specific school / institutional Microsoft account
 */
export const requestMicrosoftLogin = async (customClientId = null) => {
  const msal = await getMsalInstance(customClientId);

  const loginRequest = {
    scopes: ["User.Read"],
    prompt: "select_account" // Forces the Microsoft account picker
  };

  try {
    const loginResponse = await msal.loginPopup(loginRequest);
    const account = loginResponse.account || msal.getAllAccounts()[0];

    return {
      success: true,
      account: {
        name: account?.name || "مستخدم Microsoft",
        username: account?.username || "",
        tenantId: account?.tenantId || "",
        homeAccountId: account?.homeAccountId || ""
      },
      accessToken: loginResponse.accessToken,
      idToken: loginResponse.idToken
    };
  } catch (err) {
    if (err.errorCode === "user_cancelled" || err.message?.includes("User cancelled")) {
      throw new Error("تم إلغاء تسجيل الدخول إلى Microsoft من قِبل المستخدم");
    }
    if (err.errorCode === "popup_window_error" || err.message?.includes("popup")) {
      throw new Error("تم حظر النافذة المنبثقة لمصادقة Microsoft. يرجى السماح بالنوافذ المنبثقة لهذا الموقع");
    }
    throw new Error(`تعذر تسجيل الدخول إلى Microsoft: ${err.errorMessage || err.message}`);
  }
};

/**
 * Generates an official Microsoft Forms Quick-Import compliant Word document (.doc)
 * Formatted to Microsoft Forms AI Quiz parser standards:
 * - Title
 * - Numbered questions (1. 2. 3.)
 * - Lettered options (A. B. C. D.)
 * - Answer key (Answer: A)
 */
export const generateMicrosoftFormsImportDocument = (exam) => {
  if (!exam || !exam.questions || exam.questions.length === 0) {
    throw new Error("لا توجد أسئلة مسجلة في هذا الاختبار للتصدير");
  }

  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  const questionsHtml = exam.questions
    .map((q, idx) => {
      const qNum = idx + 1;
      const cleanText = (q.text || "").replace(/<[^>]*>?/gm, "").trim();

      const optionsHtml = (q.options || [])
        .map((opt, optIdx) => {
          const letter = optionLetters[optIdx] || `${optIdx + 1}`;
          const cleanOpt = (opt || "").replace(/<[^>]*>?/gm, "").trim();
          return `<p style="margin: 4px 0 4px 20px; font-size: 11pt; direction: rtl; text-align: right;">${letter}. ${cleanOpt}</p>`;
        })
        .join("");

      const correctIdx = typeof q.correctOption === "number" ? q.correctOption : 0;
      const correctLetter = optionLetters[correctIdx] || "A";

      return `
        <div style="margin-bottom: 24px; padding: 12px; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
          <p style="font-size: 12pt; font-weight: bold; margin: 0 0 8px 0; direction: rtl; text-align: right;">
            ${qNum}. ${cleanText}
          </p>
          ${optionsHtml}
          <p style="font-size: 10pt; color: #008272; font-weight: bold; margin: 8px 0 0 20px; direction: ltr; text-align: left;">
            Answer: ${correctLetter}
          </p>
        </div>
      `;
    })
    .join("");

  const htmlDoc = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${exam.title || "اختبار Microsoft Forms"}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 2cm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          direction: rtl;
          text-align: right;
          color: #242424;
          line-height: 1.6;
        }
        h1 {
          font-size: 18pt;
          color: #008272;
          border-bottom: 2px solid #008272;
          padding-bottom: 8px;
          margin-bottom: 6px;
        }
        .meta-info {
          font-size: 11pt;
          color: #616161;
          margin-bottom: 24px;
        }
      </style>
    </head>
    <body>
      <h1>${exam.title || "اختبار تقويمي"}</h1>
      <div class="meta-info">
        <span>الصف: ${exam.targetClass || "عام"}</span> | 
        <span>المادة: ${exam.subject || "عام"}</span> | 
        <span>عدد الأسئلة: ${exam.questions.length}</span>
      </div>
      <div>
        ${questionsHtml}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", htmlDoc], {
    type: "application/msword;charset=utf-8"
  });

  const cleanFilename = `${(exam.title || "اختبار").replace(/[/\\?%*:|"<>]/g, "_")}_Microsoft_Forms.doc`;

  return {
    blob,
    filename: cleanFilename,
    download: () => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = cleanFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };
};

/**
 * Export to Microsoft Forms:
 * Generates the Quick Import package, triggers download, and opens Microsoft Forms
 * or sends to custom institutional webhook if configured
 */
export const exportToMicrosoftForms = async (exam, options = {}, onProgress = null) => {
  if (!exam || !exam.questions || exam.questions.length === 0) {
    throw new Error("لا توجد أسئلة مسجلة في هذا الاختبار للتصدير");
  }

  const { webhookUrl = null, autoDownload = true } = options;

  // If webhook is provided, send JSON to institutional webhook
  if (webhookUrl && webhookUrl.trim()) {
    if (onProgress) onProgress("جاري إرسال بيانات الاختبار إلى خادم Microsoft المؤسسي...");
    const payload = {
      title: exam.title,
      targetClass: exam.targetClass || "",
      subject: exam.subject || "",
      questionsCount: exam.questions.length,
      questions: exam.questions.map((q, idx) => ({
        index: idx + 1,
        text: q.text,
        options: q.options || [],
        correctIndex: typeof q.correctOption === "number" ? q.correctOption : 0
      }))
    };

    const res = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`فشل الاتصال برابط Webhook المؤسسي (رمز الخطأ ${res.status})`);
    }

    const data = await res.json().catch(() => ({}));
    if (onProgress) onProgress("اكتمل التصدير بنجاح عبر الربط المؤسسي! 🎉");

    return {
      success: true,
      formsUrl: data.formsUrl || "https://forms.office.com/pages/designpagev2.aspx",
      message: "تم إرسال الاختبار بنجاح إلى منصة Microsoft المؤسسية."
    };
  }

  // Standard Microsoft Forms Flow: Quick Import Package
  if (onProgress) onProgress("جاري توليد ملف الاستيراد السريع المتوافق مع محرك Microsoft Forms الذكي...");
  const docPackage = generateMicrosoftFormsImportDocument(exam);

  if (autoDownload) {
    docPackage.download();
  }

  if (onProgress) onProgress("تم تجهيز وثيقة الاستيراد السريع بنجاح! جاهز لفتح Microsoft Forms...");

  const msFormsPortalUrl = "https://forms.office.com/pages/designpagev2.aspx";

  return {
    success: true,
    portalUrl: msFormsPortalUrl,
    filename: docPackage.filename,
    totalQuestions: exam.questions.length,
    downloadFn: docPackage.download
  };
};
