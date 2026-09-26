import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

export default function LanguageSwitcher({ variant = 'header', className = '' }) {
  const { lang, changeLanguage, supportedLanguages, currentLanguage, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  // Styling presets based on variant
  const isLoginVariant = variant === 'login';

  return (
    <div 
      ref={containerRef} 
      className={`language-switcher-container ${className}`}
      style={{ position: 'relative', display: 'inline-block', zIndex: 100 }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="btn language-switcher-btn"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={isRTL ? 'تغيير لغة المنظومة (العربية / English / 中文)' : 'Switch Language (AR / EN / ZH)'}
        style={{
          background: isLoginVariant 
            ? 'rgba(255, 255, 255, 0.85)' 
            : (lang === 'ar' 
                ? 'rgba(14, 116, 144, 0.08)' 
                : (lang === 'zh' ? 'rgba(225, 29, 72, 0.08)' : 'rgba(16, 185, 129, 0.08)')),
          backdropFilter: 'blur(8px)',
          border: `1.5px solid ${isLoginVariant 
            ? 'rgba(14, 116, 144, 0.25)' 
            : (lang === 'ar' ? '#0e7490' : (lang === 'zh' ? '#e11d48' : '#10b981'))}`,
          borderRadius: '24px',
          padding: isLoginVariant ? '7px 16px' : '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontWeight: '700',
          fontSize: '13px',
          color: lang === 'ar' ? '#0e7490' : (lang === 'zh' ? '#be123c' : '#047857'),
          boxShadow: isOpen 
            ? '0 4px 14px rgba(14, 116, 144, 0.25)' 
            : '0 2px 6px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
      >
        <Globe 
          size={16} 
          className="lang-globe-icon"
          color={lang === 'ar' ? '#0e7490' : (lang === 'zh' ? '#be123c' : '#047857')}
          style={{ transition: 'transform 0.3s ease' }}
        />

        <span style={{ fontSize: '15px', lineHeight: 1 }} role="img" aria-label={currentLanguage.nativeName}>
          {currentLanguage.flag}
        </span>

        <span style={{ fontWeight: '700', letterSpacing: '-0.2px' }}>
          {currentLanguage.label}
        </span>

        {/* Short Code Badge Pill */}
        <span style={{
          background: lang === 'ar' ? '#0e7490' : (lang === 'zh' ? '#e11d48' : '#10b981'),
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1px 6px',
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '0.5px'
        }}>
          {currentLanguage.badge}
        </span>

        <ChevronDown 
          size={14} 
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
            opacity: 0.75
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="language-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            [isRTL ? 'left' : 'right']: 0,
            minWidth: '240px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            animation: 'langDropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 9999
          }}
        >
          {/* Dropdown Header */}
          <div style={{
            padding: '6px 10px 8px 10px',
            borderBottom: '1px solid #f1f5f9',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{isRTL ? '🌐 اختيار لغة المنظومة' : '🌐 Select Language'}</span>
            <span style={{ fontSize: '10px', opacity: 0.8 }}>3 Languages</span>
          </div>

          {/* Languages List */}
          {supportedLanguages.map((l) => {
            const isSelected = l.code === lang;

            return (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelectLanguage(l.code)}
                style={{
                  width: '100%',
                  background: isSelected 
                    ? (l.code === 'ar' ? '#f0fdfa' : (l.code === 'zh' ? '#fff1f2' : '#f0fdf4')) 
                    : 'transparent',
                  border: isSelected 
                    ? `1px solid ${l.code === 'ar' ? '#99f6e4' : (l.code === 'zh' ? '#fecdd3' : '#bbf7d0')}` 
                    : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: isRTL ? 'right' : 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    fontSize: '20px', 
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#f1f5f9'
                  }}>
                    {l.flag}
                  </span>

                  <div>
                    <div style={{
                      fontWeight: isSelected ? '800' : '600',
                      fontSize: '13px',
                      color: isSelected 
                        ? (l.code === 'ar' ? '#0e7490' : (l.code === 'zh' ? '#be123c' : '#15803d')) 
                        : '#1e293b'
                    }}>
                      {l.nativeName}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                      {l.englishName}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    color: isSelected ? '#ffffff' : '#64748b',
                    background: isSelected 
                      ? (l.code === 'ar' ? '#0e7490' : (l.code === 'zh' ? '#e11d48' : '#16a34a')) 
                      : '#f1f5f9',
                    padding: '2px 6px',
                    borderRadius: '6px'
                  }}>
                    {l.badge}
                  </span>

                  {isSelected && (
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: l.code === 'ar' ? '#0e7490' : (l.code === 'zh' ? '#e11d48' : '#16a34a'),
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
