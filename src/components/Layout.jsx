import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLanguage } from '../contexts/LanguageContext';
import './Layout.css';

export default function Layout({ role, title, children }) {
  const { t } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="layout-container" style={{ position: 'relative' }}>
      {/* Mobile Sidebar Backdrop Overlay */}
      <div
        className={`sidebar-overlay no-print ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <Sidebar
        role={role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="main-content">
        <Header
          title={title}
          role={role}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />
        <div className="page-container">
          {children}
        </div>
      </div>

      <div className="designer-footer no-print" style={{
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
