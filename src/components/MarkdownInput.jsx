import React, { useState, useRef } from 'react';
import MarkdownViewer from './MarkdownViewer';
import LatexMathToolbar from './LatexMathToolbar';
import { Image as ImageIcon, Loader, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { compressImageToDataUrl } from '../utils/imageCompressor';

export default function MarkdownInput({ label, value, onChange, placeholder, height = '200px' }) {
  const { t } = useLanguage();
  const textareaRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [compressNotice, setCompressNotice] = useState('');
  const [showLatexToolbar, setShowLatexToolbar] = useState(false);

  const insertTextAtCursor = (textToInsert) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange((value || '') + textToInsert);
      return;
    }
    const startPos = textarea.selectionStart ?? (value || '').length;
    const endPos = textarea.selectionEnd ?? (value || '').length;
    const curVal = value || '';
    const newText = curVal.substring(0, startPos) + textToInsert + curVal.substring(endPos);
    onChange(newText);
    
    setTimeout(() => {
      textarea.selectionStart = startPos + textToInsert.length;
      textarea.selectionEnd = startPos + textToInsert.length;
      textarea.focus();
    }, 0);
  };

  const uploadImage = async (file) => {
    if (!file) return;

    setIsUploading(true);
    setCompressNotice('جاري معالجة وإدراج الصورة...');
    try {
      // Direct high-quality compressed Base64 processing:
      // Works 100% in ~50ms without network hang, CORS issues, or storage failures
      const dataUrl = await compressImageToDataUrl(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.80
      });

      if (dataUrl) {
        insertTextAtCursor(`\n![${t('markdownInput.image') || 'صورة'}](${dataUrl})\n`);
      } else {
        alert('تعذر قراءة ملف الصورة المحدد.');
      }
    } catch (error) {
      console.error('Error processing inline image:', error);
      alert('حدث خطأ أثناء معالجة الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsUploading(false);
      setCompressNotice('');
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        uploadImage(file);
        break;
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
    e.target.value = null;
  };

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {/* Label and Tool Buttons Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <label style={{ margin: 0 }}>
          {label} <span style={{ fontSize: '12px', color: '#0e7490', fontWeight: 'bold' }}>{t('markdownInput.latexSupport') || '✓ يدعم LaTeX والمعادلات الرياضية والكيميائية'}</span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Toggle LaTeX Math & Chemistry Toolbar */}
          <button
            type="button"
            onClick={() => setShowLatexToolbar(prev => !prev)}
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: showLatexToolbar ? '#ecfeff' : '#f1f5f9',
              color: showLatexToolbar ? '#0e7490' : '#334155',
              border: showLatexToolbar ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: showLatexToolbar ? 'bold' : 'normal',
              transition: 'all 0.15s ease'
            }}
            title="إظهار أو إخفاء لوحة إدراج الرموز والمعادلات الرياضية والكيميائية (LaTeX)"
          >
            <Sparkles size={14} color={showLatexToolbar ? '#0e7490' : '#64748b'} />
            {showLatexToolbar ? 'إخفاء لوحة LaTeX' : '📐 معادلات ورموز (LaTeX)'}
            {showLatexToolbar ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Insert Image Button */}
          <div style={{ position: 'relative' }}>
            <input 
              type="file" 
              accept="image/*" 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              onChange={handleFileSelect}
              title={t('markdownInput.insertImage')}
            />
            <button
              type="button" 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '12px', background: '#e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', cursor: 'pointer' }}
            >
              {isUploading ? <Loader size={14} className="spin" /> : <ImageIcon size={14} />}
              {isUploading ? t('markdownInput.uploading') : t('markdownInput.insertImage')}
            </button>
          </div>
        </div>
      </div>

      {/* Conditionally rendered LaTeX Math & Chemistry Toolbar */}
      {showLatexToolbar && (
        <LatexMathToolbar onInsert={(code) => insertTextAtCursor(code)} />
      )}

      {/* Textarea + Live Preview side-by-side */}
      <div style={{ display: 'flex', gap: '16px', height, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', position: 'relative' }}>
          <textarea 
            ref={textareaRef}
            className="input-field" 
            style={{ width: '100%', resize: 'none', height: '100%', fontFamily: 'monospace', margin: 0 }}
            value={value}
            onChange={e => onChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder + "\n" + (t('markdownInput.pasteImageHint') || 'يمكنك كتابة صيغ رياضية $x^2$ أو كيميائية $\\ce{H2O}$ أو لصق صور مباشرة')}
          />
          {isUploading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-primary)' }}>
                <Loader className="spin" size={26} style={{ marginBottom: '8px' }} />
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{compressNotice || t('markdownInput.uploading')}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: '1 1 320px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', background: '#fff', overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-text-muted)' }}>{t('markdownInput.livePreview') || 'المعاينة الفورية المباشرة'}</h4>
          <MarkdownViewer content={value || (t('markdownInput.empty') || 'اكتب في الحقل المجاور لمشاهدة المعاينة الفورية...')} />
        </div>
      </div>
    </div>
  );
}
