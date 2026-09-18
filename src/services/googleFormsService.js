// =========================================================================
// GOOGLE FORMS EXPORT SERVICE
// Supports:
// 1. Google Identity Services (GIS) OAuth Token Client with prompt: 'select_account'
// 2. Google Forms API v1 (POST /forms, batchUpdate with isQuiz and ChoiceQuestions)
// 3. Google Apps Script Web App Endpoint (for schools preferring script deployment)
// =========================================================================

const DEFAULT_GOOGLE_CLIENT_ID = "210401728875-r0m6g2c4a45u7j4b7fsq02g9hll3vdn3.apps.googleusercontent.com";
const STORAGE_KEY_CLIENT_ID = "school_system_google_client_id";
const STORAGE_KEY_SCRIPT_URL = "school_system_google_script_url";

export const getStoredGoogleClientId = () => {
  return localStorage.getItem(STORAGE_KEY_CLIENT_ID) || "";
};

export const setStoredGoogleClientId = (id) => {
  if (id) {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, id.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  }
};

export const getStoredGoogleScriptUrl = () => {
  return localStorage.getItem(STORAGE_KEY_SCRIPT_URL) || "";
};

export const setStoredGoogleScriptUrl = (url) => {
  if (url) {
    localStorage.setItem(STORAGE_KEY_SCRIPT_URL, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_SCRIPT_URL);
  }
};

/**
 * Load Google Identity Services (GIS) client library dynamically
 */
export const loadGoogleGsiScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      return resolve(window.google.accounts.oauth2);
    }

    const existingScript = document.getElementById("google-gsi-client");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google.accounts.oauth2));
      existingScript.addEventListener("error", () => reject(new Error("فشل تحميل مكتبة Google Identity Services")));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google.accounts.oauth2);
      } else {
        reject(new Error("لم يتم تهيئة واجهة Google Identity بشكل صحيح"));
      }
    };
    script.onerror = () => reject(new Error("تعذر الاتصال بخوادم Google لتسجيل الدخول. تأكد من اتصال الإنترنت"));
    document.head.appendChild(script);
  });
};

/**
 * Trigger Google Sign-In with forced account selection (prompt: 'select_account')
 * and request forms.body scope
 */
export const requestGoogleAccessToken = async (customClientId = null) => {
  const clientId = customClientId || getStoredGoogleClientId() || DEFAULT_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("يرجى إدخال معرّف العميل (Google Client ID) الخاص بمدرستك أو حسابك للمتابعة.");
  }

  await loadGoogleGsiScript();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/drive.file",
        prompt: "select_account",
        callback: (response) => {
          if (response.error) {
            if (response.error === "popup_closed_by_user" || response.error === "access_denied") {
              return reject(new Error("تم إلغاء عملية تسجيل الدخول أو رفض منح الصلاحيات"));
            }
            return reject(new Error(`خطأ مصادقة Google: ${response.error_description || response.error}`));
          }
          if (response.access_token) {
            resolve({
              accessToken: response.access_token,
              expiresIn: response.expires_in,
              scope: response.scope
            });
          } else {
            reject(new Error("لم يتم استلام رمز الوصول (Access Token) من Google"));
          }
        },
        error_callback: (nonOAuthErr) => {
          reject(new Error(`تعذر فتح نافذة تسجيل الدخول من Google: ${nonOAuthErr?.message || "خطأ غير متوقع"}`));
        }
      });

      client.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Create Google Form via Official Google Forms API v1
 */
export const exportToGoogleFormsApi = async (exam, accessToken, onProgress = null) => {
  if (!exam || !exam.title) {
    throw new Error("بيانات الاختبار غير مكتملة");
  }
  if (!exam.questions || exam.questions.length === 0) {
    throw new Error("لا توجد أسئلة مسجلة في هذا الاختبار للتصدير");
  }

  // Step 1: Create Form
  if (onProgress) onProgress("جاري إنشاء مسودة النموذج على Google Forms...");
  const createRes = await fetch("https://forms.googleapis.com/v1/forms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      info: {
        title: exam.title,
        documentTitle: `${exam.title} - ${exam.targetClass || ""}`
      }
    })
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    const message = errData?.error?.message || createRes.statusText;
    if (createRes.status === 401) {
      throw new Error("انتهت صلاحية الجلسة أو رمز الوصول غير صالح. يرجى إعادة تسجيل الدخول.");
    }
    if (createRes.status === 403) {
      throw new Error(`تم رفض الوصول من Google Forms API: ${message}. تأكد من تفعيل Google Forms API في مشروع Google Cloud ومنح صلاحية forms.body.`);
    }
    throw new Error(`فشل إنشاء النموذج: ${message}`);
  }

  const createdForm = await createRes.json();
  const formId = createdForm.formId;
  const responderUri = createdForm.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  // Step 2: Configure as Quiz and add Questions via batchUpdate
  if (onProgress) onProgress("جاري تعيين نمط الاختبار (Quiz) وإدراج الأسئلة والخيارات والإجابات الصحيحة...");

  const requests = [
    // Turn into a Quiz
    {
      updateSettings: {
        settings: {
          quizSettings: {
            isQuiz: true
          }
        },
        updateMask: "quizSettings.isQuiz"
      }
    }
  ];

  // Add questions
  exam.questions.forEach((q, idx) => {
    const choices = (q.options || []).map((opt) => ({
      value: (opt || "").trim() || `الخيار ${idx + 1}`
    }));

    const correctIndex = typeof q.correctOption === "number" ? q.correctOption : 0;
    const correctVal = choices[correctIndex]?.value || choices[0]?.value || "";

    requests.push({
      createItem: {
        item: {
          title: q.text || `السؤال ${idx + 1}`,
          questionItem: {
            question: {
              required: true,
              grading: {
                pointValue: 1,
                correctAnswers: {
                  answers: [{ value: correctVal }]
                }
              },
              choiceQuestion: {
                type: "RADIO",
                options: choices,
                shuffle: false
              }
            }
          }
        },
        location: {
          index: idx
        }
      }
    });
  });

  const batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requests })
  });

  if (!batchRes.ok) {
    const errData = await batchRes.json().catch(() => ({}));
    const message = errData?.error?.message || batchRes.statusText;
    throw new Error(`تم إنشاء النموذج ولكن تعذر إدراج الأسئلة تلقائياً: ${message}. يمكنك فتح النموذج وتعديله يدوياً.`);
  }

  if (onProgress) onProgress("اكتمل التصدير بنجاح! 🎉");

  return {
    success: true,
    formId,
    editUrl,
    responderUri,
    totalQuestions: exam.questions.length
  };
};

/**
 * Export via Google Apps Script Web App Endpoint
 */
export const exportToGoogleFormsScript = async (exam, scriptUrl, onProgress = null) => {
  if (!scriptUrl || !scriptUrl.trim()) {
    throw new Error("يرجى إدخال رابط تطبيق Google Apps Script Web App المنشور أولاً");
  }

  if (!exam || !exam.questions || exam.questions.length === 0) {
    throw new Error("لا توجد أسئلة مسجلة في هذا الاختبار");
  }

  if (onProgress) onProgress("جاري إرسال بيانات الاختبار إلى Google Apps Script...");

  const payload = {
    title: exam.title,
    targetClass: exam.targetClass || "",
    subject: exam.subject || "",
    duration: exam.duration || 45,
    description: `المادة: ${exam.subject || ""} | الصف: ${exam.targetClass || ""} | مدة الاختبار: ${exam.duration || 45} دقيقة`,
    questions: exam.questions.map((q, idx) => ({
      index: idx + 1,
      text: q.text,
      options: q.options || [],
      correctIndex: typeof q.correctOption === "number" ? q.correctOption : 0,
      points: 1
    }))
  };

  try {
    const res = await fetch(scriptUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`فشل الاتصال برابط السكربت (رمز الخطأ ${res.status})`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }

    if (onProgress) onProgress("اكتمل التصدير بنجاح! 🎉");

    return {
      success: true,
      formId: data.formId || "",
      editUrl: data.editUrl || (data.formId ? `https://docs.google.com/forms/d/${data.formId}/edit` : ""),
      responderUri: data.formUrl || data.responderUri || "",
      totalQuestions: exam.questions.length
    };
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
      throw new Error("تعذر الوصول إلى رابط Google Apps Script. تأكد من نشر السكربت بصلاحية 'Anyone' وتفعيله كـ Web App.");
    }
    throw err;
  }
};

/**
 * Returns ready-to-copy Google Apps Script code for schools to deploy
 */
export const getGoogleAppsScriptTemplateCode = () => {
  return `/**
 * Google Apps Script Web App لتصدير اختبارات المدرسة إلى Google Forms
 * طريقة النشر:
 * 1. افتح https://script.google.com وانقر "مشروع جديد"
 * 2. الصق هذا الكود بالكامل
 * 3. انقر على "Deploy" (نشر) -> "New deployment" (نشر جديد)
 * 4. اختر النوع: "Web app"
 * 5. في "Who has access" اختر: "Anyone" (أي شخص)
 * 6. اضغط Deploy وانسخ رابط Web App وضعه في شاشة تصدير النظام المدرسي
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    
    var formTitle = data.title || "اختبار جديد";
    var form = FormApp.create(formTitle);
    
    // ضبط النموذج كاختبار (Quiz)
    form.setIsQuiz(true);
    if (data.description) {
      form.setDescription(data.description);
    }
    
    // إضافة الأسئلة
    var questions = data.questions || [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var item = form.addMultipleChoiceItem();
      item.setTitle((i + 1) + ". " + q.text);
      item.setPoints(q.points || 1);
      item.setRequired(true);
      
      var choices = [];
      var opts = q.options || [];
      var correctIdx = q.correctIndex || 0;
      
      for (var j = 0; j < opts.length; j++) {
        var isCorrect = (j === correctIdx);
        choices.push(item.createChoice(opts[j], isCorrect));
      }
      item.setChoices(choices);
    }
    
    var output = {
      success: true,
      formId: form.getId(),
      editUrl: form.getEditUrl(),
      formUrl: form.getPublishedUrl()
    };
    
    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
};
