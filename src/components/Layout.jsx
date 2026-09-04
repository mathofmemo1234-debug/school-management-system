import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLanguage } from '../contexts/LanguageContext';
import { Building2, Sparkles } from 'lucide-react';
import AboutSchoolModal from './AboutSchoolModal';
import './Layout.css';

export default function Layout({ role, title, children }) {
  const { t } = useLanguage();
  const [showAboutModal, setShowAboutModal] = useState(false);

  return (
    <div className="layout-container" style={{ position: 'relative' }}>
      <Sidebar role={role} />
      <div className="main-content">
        <Header title={title} role={role} />
        <div className="page-container">
          {children}
        </div>
      </div>

      {/* Global Floating Action Button: من نحن (فلاش يومض) */}
      <button
        type="button"
        className="floating-about-btn"
        onClick={() => setShowAboutModal(true)}
        title="عن المدرسة والمنظومة التعليمية - من نحن"
      >
        <span className="flash-dot-indicator" />
        <Building2 size={18} className="flash-icon" />
        <span>من نحن</span>
        <Sparkles size={14} color="#38bdf8" />
      </button>

      {/* Global About School Modal */}
      <AboutSchoolModal 
        isOpen={showAboutModal} 
        onClose={() => setShowAboutModal(false)} 
      />

      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '15px',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        opacity: 0.7,
        zIndex: 1000,
        pointerEvents: 'none',
        direction: 'rtl'
      }}>
        {t('layout.designerInfo')}
      </div>
    </div>
  );
}
