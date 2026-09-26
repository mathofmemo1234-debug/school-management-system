import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../translations';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const SUPPORTED_LANGUAGES = [
  {
    code: 'ar',
    label: 'العربية',
    nativeName: 'العربية',
    englishName: 'Arabic',
    dir: 'rtl',
    flag: '🇸🇦',
    badge: 'AR',
    googleCode: 'ar'
  },
  {
    code: 'en',
    label: 'English',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
    flag: '🇬🇧',
    badge: 'EN',
    googleCode: 'en'
  },
  {
    code: 'zh',
    label: '中文',
    nativeName: '中文 (简体)',
    englishName: 'Mandarin Chinese',
    dir: 'ltr',
    flag: '🇨🇳',
    badge: 'ZH',
    googleCode: 'zh-CN'
  }
];

export function syncGoogleTranslate(targetLangCode) {
  if (typeof window === 'undefined') return;
  const targetObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode) || SUPPORTED_LANGUAGES[0];
  const gCode = targetObj.googleCode;
  const hostname = window.location.hostname;

  try {
    if (targetLangCode === 'ar') {
      // Clear translation cookies to return to original Arabic
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${hostname}; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${hostname}; path=/;`;
    } else {
      document.cookie = `googtrans=/ar/${gCode}; path=/;`;
      document.cookie = `googtrans=/ar/${gCode}; domain=${hostname}; path=/;`;
      document.cookie = `googtrans=/ar/${gCode}; domain=.${hostname}; path=/;`;
    }

    // Try finding the Google Translate combo box and dispatching change
    const applyToCombo = () => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        combo.value = targetLangCode === 'ar' ? 'ar' : gCode;
        combo.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    };

    if (!applyToCombo()) {
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (applyToCombo() || tries > 12) {
          clearInterval(interval);
        }
      }, 250);
    }
  } catch (err) {
    console.warn('Google Translate sync note:', err);
  }
}

const LanguageContext = createContext();

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }) {
  const { userData } = useAuth();
  
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('appLang');
    if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
      return saved;
    }
    return 'ar';
  });

  const isRTL = lang === 'ar';
  const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0];

  // Auto-detect school default IF user has not explicitly set a preference
  useEffect(() => {
    const hasExplicitChoice = localStorage.getItem('appLang_userExplicit');
    if (hasExplicitChoice) return;

    const schoolId = userData?.schoolId;
    const rawSchoolName = userData?.schoolName || '';
    const isInternationalName = (name) => {
      const lower = (name || '').toLowerCase();
      return (
        lower.includes('عالمي') || 
        lower.includes('عالمية') || 
        lower.includes('international') || 
        lower.includes('american') ||
        lower.includes('intl')
      );
    };

    if (!schoolId || schoolId === 'ALL') {
      if (isInternationalName(rawSchoolName)) {
        changeLanguage('en', false);
      }
      return;
    }

    const unsub = onSnapshot(doc(db, 'schools', schoolId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.defaultLanguage && SUPPORTED_LANGUAGES.some(l => l.code === data.defaultLanguage)) {
          changeLanguage(data.defaultLanguage, false);
        } else if (isInternationalName(data.name || rawSchoolName)) {
          changeLanguage('en', false);
        }
      }
    }, (err) => {
      console.warn('LanguageContext school listener error:', err);
    });

    return () => unsub();
  }, [userData?.schoolId, userData?.schoolName]);

  // Sync DOM attributes and localStorage on language change
  useEffect(() => {
    const targetObj = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0];
    document.documentElement.dir = targetObj.dir;
    document.documentElement.lang = targetObj.code;
    localStorage.setItem('appLang', lang);
    syncGoogleTranslate(lang);
  }, [lang]);

  const changeLanguage = (newLangCode, isUserExplicit = true) => {
    const target = SUPPORTED_LANGUAGES.find(l => l.code === newLangCode);
    if (!target) return;
    setLang(target.code);
    if (isUserExplicit) {
      localStorage.setItem('appLang_userExplicit', 'true');
    }
    document.documentElement.dir = target.dir;
    document.documentElement.lang = target.code;
    localStorage.setItem('appLang', target.code);
    syncGoogleTranslate(target.code);
  };

  const toggleLanguage = () => {
    const idx = SUPPORTED_LANGUAGES.findIndex(l => l.code === lang);
    const nextIdx = (idx + 1) % SUPPORTED_LANGUAGES.length;
    changeLanguage(SUPPORTED_LANGUAGES[nextIdx].code, true);
  };

  const t = (key) => {
    return translations[lang]?.[key] || 
           translations['en']?.[key] || 
           translations['ar']?.[key] || 
           key;
  };

  return (
    <LanguageContext.Provider value={{ 
      lang, 
      setLang, 
      changeLanguage, 
      toggleLanguage, 
      supportedLanguages: SUPPORTED_LANGUAGES, 
      currentLanguage, 
      isRTL, 
      t 
    }}>
      {children}
    </LanguageContext.Provider>
  );
}
