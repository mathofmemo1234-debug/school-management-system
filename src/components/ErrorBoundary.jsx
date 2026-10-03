import React from 'react';
import { AlertTriangle, RotateCcw, Home, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = 
      error?.name === 'ChunkLoadError' || 
      /Failed to fetch dynamically imported module/i.test(error?.message || error?.toString() || '') ||
      /Loading chunk .* failed/i.test(error?.message || error?.toString() || '');

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });

    const isChunkError = 
      error?.name === 'ChunkLoadError' || 
      /Failed to fetch dynamically imported module/i.test(error?.message || error?.toString() || '') ||
      /Loading chunk .* failed/i.test(error?.message || error?.toString() || '');

    // If dynamic chunk loading failed (e.g. after a new deployment), try auto-refreshing once
    if (isChunkError) {
      const autoReloadKey = 'eb_auto_reloaded_chunk';
      const lastReload = sessionStorage.getItem(autoReloadKey);
      const now = Date.now();

      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem(autoReloadKey, now.toString());
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    }
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('chunk_force_refreshed');
      sessionStorage.removeItem('eb_auto_reloaded_chunk');
      if ('caches' in window) {
        caches.keys().then(keys => {
          keys.forEach(k => caches.delete(k));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.update());
        });
      }
    } catch (e) {}
    window.location.reload();
  };

  handleGoLogin = () => {
    window.location.href = '#/login';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { isChunkError, error, errorInfo } = this.state;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f8fafc',
          color: '#1e293b',
          fontFamily: 'Cairo, system-ui, -apple-system, sans-serif',
          direction: 'rtl',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '36px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isChunkError ? '#e0f2fe' : '#fee2e2',
              color: isChunkError ? '#0284c7' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              {isChunkError ? <RefreshCw size={36} className="animate-spin" /> : <AlertTriangle size={36} />}
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
              {isChunkError ? 'تم تحديث ملفات النظام (إصدار جديد)' : 'حدث خطأ غير متوقع أثناء عرض هذه الصفحة'}
            </h2>

            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {isChunkError
                ? 'تم نشر تحديث جديد للنظام على الخادم، وتتطلب الصفحة إعادة تحميل خفيفة لتحديث الملفات والذاكرة المؤقتة للمتصفح.'
                : 'يرجى إعادة تحميل الصفحة أو تسجيل الدخول مرة أخرى.'}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isChunkError ? '#0284c7' : '#0e7490',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={18} /> {isChunkError ? 'تحديث وتحميل أحدث إصدار' : 'إعادة تحميل الصفحة'}
              </button>

              <button
                onClick={this.handleGoLogin}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Home size={18} /> صفحة الدخول
              </button>
            </div>

            {error && (
              <details style={{ textAlign: 'left', marginTop: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: isChunkError ? '#0284c7' : '#dc2626', overflowX: 'auto', direction: 'ltr' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#64748b', direction: 'rtl', textAlign: 'right' }}>
                  تفاصيل الخطأ الفني (Technical Details)
                </summary>
                <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {error.toString()}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
