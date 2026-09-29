import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getFileData, downloadFile } from '../utils/fileStorageService';
import { FileText, Download, Printer, ArrowRight, AlertCircle, Loader2, Image as ImageIcon, ExternalLink } from 'lucide-react';

export default function FileViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support both standard search params and hash-query params (#/file-viewer?id=...)
  const hash = window.location.hash || '';
  const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
  const hashParams = new URLSearchParams(hashQuery);

  const fileId = searchParams.get('id') || hashParams.get('id');
  const autoDownload = searchParams.get('download') === '1' || hashParams.get('download') === '1';

  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileId) {
      setError('لم يتم تحديد معرف الملف.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getFileData(fileId);
        if (isMounted) {
          setFileData(data);
          if (autoDownload) {
            downloadFile(fileId, data.name);
          }
        }
      } catch (err) {
        console.error('File load error:', err);
        if (isMounted) {
          setError(err.message || 'تعذر تحميل أو قراءة بيانات الملف.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
      // Note: We avoid revoking blobUrl immediately so user can print/view
    };
  }, [fileId, autoDownload]);

  const handleDownload = () => {
    if (fileData) {
      downloadFile(fileId, fileData.name);
    }
  };

  const handlePrint = () => {
    if (fileData?.blobUrl) {
      const iframe = document.getElementById('pdf-viewer-frame');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
      } else {
        window.open(fileData.blobUrl, '_blank');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isPdf = fileData?.type === 'application/pdf' || fileData?.name?.toLowerCase().endsWith('.pdf');
  const isImage = fileData?.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileData?.name || '');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', direction: 'rtl', fontFamily: 'Tajawal, Cairo, sans-serif', color: '#f8fafc' }}>
      {/* Top Navbar */}
      <header style={{
        height: '64px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: '#334155',
              border: 'none',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            title="رجوع"
          >
            <ArrowRight size={18} />
            <span>رجوع</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {isPdf ? <FileText size={24} color="#38bdf8" /> : isImage ? <ImageIcon size={24} color="#34d399" /> : <FileText size={24} color="#fbbf24" />}
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '450px'
              }}>
                {fileData?.name || 'عارض المستندات المدرسية'}
              </h1>
              {fileData?.size && (
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  الحجم: {formatFileSize(fileData.size)}
                </span>
              )}
            </div>
          </div>
        </div>

        {fileData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isPdf && (
              <button
                onClick={handlePrint}
                style={{
                  background: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold'
                }}
              >
                <Printer size={16} />
                <span>طباعة</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(2,132,199,0.4)'
              }}
            >
              <Download size={16} />
              <span>تحميل الملف</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Body */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#94a3b8' }}>
            <Loader2 size={44} className="spin-animate" color="#38bdf8" />
            <h3 style={{ margin: 0, fontSize: '16px', color: '#e2e8f0' }}>جاري استرجاع وتجهيز المستند...</h3>
            <p style={{ margin: 0, fontSize: '13px' }}>يتم تجميع أجزاء الملف والمزامنة بسرعة وأمان</p>
          </div>
        )}

        {error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '16px', padding: '32px', maxWidth: '480px', textAlign: 'center' }}>
              <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
              <h2 style={{ fontSize: '18px', marginBottom: '8px', color: '#f87171' }}>تعذر فتح الملف</h2>
              <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>{error}</p>
              <button
                onClick={() => navigate('/')}
                style={{
                  background: '#334155',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                العودة إلى الصفحة الرئيسية
              </button>
            </div>
          </div>
        )}

        {!loading && !error && fileData && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
            {isPdf && (
              <iframe
                id="pdf-viewer-frame"
                src={fileData.blobUrl}
                title={fileData.name}
                style={{
                  flex: 1,
                  width: '100%',
                  height: 'calc(100vh - 64px)',
                  border: 'none',
                  background: '#334155'
                }}
              />
            )}

            {isImage && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                overflow: 'auto',
                background: '#090d16'
              }}>
                <img
                  src={fileData.blobUrl}
                  alt={fileData.name}
                  style={{
                    maxWidth: '95%',
                    maxHeight: 'calc(100vh - 120px)',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                  }}
                />
              </div>
            )}

            {!isPdf && !isImage && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                padding: '40px'
              }}>
                <div style={{
                  background: '#1e293b',
                  borderRadius: '20px',
                  padding: '40px 32px',
                  maxWidth: '520px',
                  textAlign: 'center',
                  border: '1px solid #334155'
                }}>
                  <FileText size={64} color="#38bdf8" style={{ marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '18px', color: '#f8fafc', marginBottom: '8px' }}>{fileData.name}</h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
                    هذا النوع من الملفات يمكن تحميله واستعراضه عبر التطبيقات المخصصة على جهازك.
                  </p>
                  <button
                    onClick={handleDownload}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 28px',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(2,132,199,0.35)'
                    }}
                  >
                    <Download size={18} />
                    <span>تحميل الملف الآن ({formatFileSize(fileData.size)})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animate {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
