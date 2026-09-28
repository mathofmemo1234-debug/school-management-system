import React, { useState, useRef } from 'react';
import MarkdownViewer from './MarkdownViewer';
import LatexMathToolbar from './LatexMathToolbar';
import { Image as ImageIcon, Loader, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { compressImageToDataUrl } from '../utils/imageCompressor';

export default function MarkdownInput({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  height = '200px',
  compact = false,
  hideLatex = false
}) {
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
      if (textareaRef.current) {
        textareaRef.current.selectionStart = startPos + textToInsert.length;
        textareaRef.current.selectionEnd = startPos + textToInsert.length;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const uploadImage = async (file) => {
    if (!file) return;

    setIsUploading(true);
    setCompressNotice(t('markdownInput.uploading') || 'جاري معالجة وضغط الصورة من الحافظة...');
    try {
      // Direct high-quality compressed Base64 processing client-side:
      const dataUrl = await compressImageToDataUrl(file, {
        maxWidth: compact ? 900 : 1200,
        maxHeight: compact ? 900 : 1200,
        quality: 0.80
      });

      if (dataUrl) {
        const imgMarkdown = compact 
          ? ` ![${t('markdownInput.image') || 'صورة'}](${dataUrl}) `
          : `\n![${t('markdownInput.image') || 'صورة'}](${dataUrl})\n`;
        insertTextAtCursor(imgMarkdown);
      } else {
        alert('تعذر قراءة أو ضغط ملف الصورة المحدد.');
      }
    } catch (error) {
      console.error('Error processing inline image:', error);
      alert('حدث خطأ أثناء معالجة الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsUploading(false);
      setCompressNotice('');
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    let handled = false;

    // 1. Check clipboard items for image file
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            handled = true;
            uploadImage(file);
            return;
          }
        }
      }
    }

    // 2. Check files property directly (e.g. copied from desktop/file manager)
    if (!handled && e.clipboardData?.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file && file.type && file.type.startsWith('image/')) {
        e.preventDefault();
        handled = true;
        uploadImage(file);
        return;
      }
    }

    // 3. Fallback: check HTML payload for <img src="..."> (e.g. copied from browser or Office)
    if (!handled) {
      const html = e.clipboardData?.getData('text/html');
      if (html && html.includes('<img')) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          const src = match[1];
          if (src.startsWith('data:image/')) {
            e.preventDefault();
            insertTextAtCursor(`\n![${t('markdownInput.image') || 'صورة'}](${src})\n`);
            return;
          } else if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
            e.preventDefault();
            setIsUploading(true);
            setCompressNotice('جاري جلب وضغط الصورة من الحافظة...');
            try {
              const resp = await fetch(src, { mode: 'cors' });
              const blob = await resp.blob();
              const dataUrl = await compressImageToDataUrl(blob, { maxWidth: 1000, maxHeight: 1000, quality: 0.78 });
              if (dataUrl) {
                insertTextAtCursor(`\n![${t('markdownInput.image') || 'صورة'}](${dataUrl})\n`);
              } else {
                insertTextAtCursor(`\n![${t('markdownInput.image') || 'صورة'}](${src})\n`);
              }
            } catch {
              insertTextAtCursor(`\n![${t('markdownInput.image') || 'صورة'}](${src})\n`);
            } finally {
              setIsUploading(false);
              setCompressNotice('');
            }
            return;
          }
        }
      }
    }
  };

  const handleDrop = (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file && file.type && file.type.startsWith('image/')) {
        e.preventDefault();
        uploadImage(file);
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
    <div className="form-group" style={{ marginBottom: 0, width: '100%' }}>
      {/* Label and Tool Buttons Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: compact ? '4px' : '8px',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {label ? (
          <label style={{ margin: 0, fontSize: compact ? '12px' : '14px', fontWeight: 'bold' }}>
            {label} <span style={{ fontSize: '11px', color: '#0e7490', fontWeight: 'normal' }}>{t('markdownInput.latexSupport') || '✓ يدعم LaTeX والمعادلات والصور'}</span>
          </label>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#0e7490', fontWeight: 'bold' }}>
              📷 يدعم لصق الصور مباشرة (Ctrl+V) والمعادلات
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Toggle LaTeX Math & Chemistry Toolbar */}
          {!hideLatex && (
            <button
              type="button"
              onClick={() => setShowLatexToolbar(prev => !prev)}
              className="btn"
              style={{
                padding: compact ? '3px 8px' : '6px 12px',
                fontSize: compact ? '11px' : '12px',
                background: showLatexToolbar ? '#ecfeff' : '#f1f5f9',
                color: showLatexToolbar ? '#0e7490' : '#334155',
                border: showLatexToolbar ? '1.5px solid #0e7490' : '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: showLatexToolbar ? 'bold' : 'normal',
                transition: 'all 0.15s ease'
              }}
              title="إظهار أو إخفاء لوحة إدراج الرموز والمعادلات الرياضية والكيميائية (LaTeX)"
            >
              <Sparkles size={compact ? 12 : 14} color={showLatexToolbar ? '#0e7490' : '#64748b'} />
              {showLatexToolbar ? 'إخفاء LaTeX' : (compact ? 'معادلات' : '📐 معادلات ورموز (LaTeX)')}
              {showLatexToolbar ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* Insert Image Button */}
          <div style={{ position: 'relative' }}>
            <input 
              type="file" 
              accept="image/*" 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              onChange={handleFileSelect}
              title={t('markdownInput.insertImage') || 'إدراج صورة أو الصق من الحافظة مباشرة'}
            />
            <button
              type="button" 
              className="btn" 
              style={{
                padding: compact ? '3px 8px' : '6px 12px',
                fontSize: compact ? '11px' : '12px',
                background: '#e2e8f0',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              title="إدراج صورة من جهازك أو الصقها مباشرة بالحافظة Ctrl+V"
            >
              {isUploading ? <Loader size={compact ? 12 : 14} className="spin" /> : <ImageIcon size={compact ? 12 : 14} />}
              {isUploading ? t('markdownInput.uploading') : (compact ? '📷 صورة' : (t('markdownInput.insertImage') || 'إدراج صورة'))}
            </button>
          </div>
        </div>
      </div>

      {/* Conditionally rendered LaTeX Math & Chemistry Toolbar */}
      {showLatexToolbar && (
        <div style={{ marginBottom: '8px' }}>
          <LatexMathToolbar compact={compact} onInsert={(code) => insertTextAtCursor(code)} />
        </div>
      )}

      {/* Textarea + Live Preview side-by-side or stacked */}
      <div style={{
        display: 'flex',
        gap: compact ? '8px' : '14px',
        minHeight: height,
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1 1 240px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <textarea 
            ref={textareaRef}
            className="input-field" 
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: height,
              height: '100%',
              fontFamily: 'monospace',
              margin: 0,
              fontSize: compact ? '12px' : '13px',
              padding: compact ? '6px 10px' : '10px 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1'
            }}
            value={value}
            onChange={e => onChange(e.target.value)}
            onPaste={handlePaste}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            placeholder={placeholder ? (placeholder + "\n" + (t('markdownInput.pasteImageHint') || 'يمكنك لصق صورة مباشرة من الحافظة Ctrl+V')) : (t('markdownInput.pasteImageHint') || 'اكتب هنا أو الصق صورة مباشرة من الحافظة Ctrl+V')}
          />
          {isUploading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-primary)' }}>
                <Loader className="spin" size={24} style={{ marginBottom: '6px' }} />
                <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{compressNotice || t('markdownInput.uploading')}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{
          flex: '1 1 220px',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: compact ? '8px 12px' : '14px',
          background: '#fff',
          overflowY: 'auto',
          minHeight: height,
          maxHeight: compact ? '220px' : '360px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h4 style={{
            margin: '0 0 6px 0',
            fontSize: compact ? '11px' : '12px',
            color: 'var(--color-text-muted)',
            fontWeight: 'bold',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '4px'
          }}>
            {t('markdownInput.livePreview') || 'المعاينة الفورية المباشرة'}
          </h4>
          <div style={{ flex: 1 }}>
            <MarkdownViewer 
              content={value || (t('markdownInput.empty') || 'اكتب أو الصق صورة لمشاهدة المعاينة...')} 
              inline={compact}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
