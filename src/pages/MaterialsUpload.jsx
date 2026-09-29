import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { uploadFileToFirestore, downloadFile } from '../utils/fileStorageService';
import { UploadCloud, Link as LinkIcon, Trash2, Download } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export default function MaterialsUpload() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const [classesList, setClassesList] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [teacherDocId, setTeacherDocId] = useState(null);
  const [materials, setMaterials] = useState([]);
  
  // Upload states
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'link'
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const schoolId = userData?.schoolId || 'default_school_1';

  // Fetch teacher doc ID based on nationalId
  useEffect(() => {
    if (userData?.nationalId) {
      const q = schoolId === 'ALL'
        ? query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId))
        : query(collection(db, 'teachers'), where('nationalId', '==', userData.nationalId), where('schoolId', '==', schoolId));

      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setTeacherDocId(snap.docs[0].id);
        } else if (!isNaN(userData.nationalId)) {
          const numQ = schoolId === 'ALL'
            ? query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)))
            : query(collection(db, 'teachers'), where('nationalId', '==', Number(userData.nationalId)), where('schoolId', '==', schoolId));
          getDocs(numQ).then(numSnap => {
            if (!numSnap.empty) setTeacherDocId(numSnap.docs[0].id);
          });
        }
      });
      return () => unsub();
    }
  }, [userData, schoolId]);

  // Fetch classes and subjects
  useEffect(() => {
    if (!teacherDocId) return;
    const qClasses = schoolId === 'ALL'
      ? collection(db, 'classes')
      : query(collection(db, 'classes'), where('schoolId', '==', schoolId));

    const unsubClasses = onSnapshot(qClasses, (classesSnap) => {
      const classNames = {};
      classesSnap.docs.forEach(d => classNames[d.id] = d.data().name);
      
      const qSchedules = schoolId === 'ALL'
        ? collection(db, 'schedules')
        : query(collection(db, 'schedules'), where('schoolId', '==', schoolId));

      const unsubSchedules = onSnapshot(qSchedules, (schedulesSnap) => {
        const myClassNames = new Set();
        const mySubjects = new Set();
        
        schedulesSnap.docs.forEach(docSnap => {
          const matrix = docSnap.data().matrix || {};
          let isTeaching = false;
          Object.values(matrix).forEach(cell => {
            if (cell.teacherId === teacherDocId) {
              isTeaching = true;
              if (cell.subject) mySubjects.add(cell.subject);
            }
          });
          if (isTeaching && classNames[docSnap.id]) {
            myClassNames.add(classNames[docSnap.id]);
          }
        });
        setClassesList(Array.from(myClassNames));
        setSubjects(Array.from(mySubjects));
      });
      return () => unsubSchedules();
    });
    return () => unsubClasses();
  }, [teacherDocId, schoolId]);

  // Fetch materials for selected class & subject
  useEffect(() => {
    if (!teacherDocId || !selectedClass || !selectedSubject) {
      setMaterials([]);
      return;
    }
    const q = schoolId === 'ALL'
      ? query(
          collection(db, 'materials'),
          where('teacherId', '==', teacherDocId),
          where('className', '==', selectedClass),
          where('subject', '==', selectedSubject)
        )
      : query(
          collection(db, 'materials'),
          where('schoolId', '==', schoolId),
          where('teacherId', '==', teacherDocId),
          where('className', '==', selectedClass),
          where('subject', '==', selectedSubject)
        );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setMaterials(data);
    });
    return () => unsub();
  }, [selectedClass, selectedSubject, teacherDocId, schoolId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !selectedClass || !selectedSubject) return;
    if (!title.trim()) return alert(t('materialsUpload.enterTitle'));
    
    if (uploadType === 'link' && !linkUrl.trim()) return alert(t('materialsUpload.enterLink'));
    if (uploadType === 'file' && !file) return alert(t('materialsUpload.selectFile'));

    setIsUploading(true);

    try {
      let finalUrl = linkUrl;
      let uploadedFileId = null;
      
      if (uploadType === 'file') {
        const result = await uploadFileToFirestore(file, {
          category: 'materials',
          onProgress: (p) => setProgress(p),
          metadata: {
            title,
            className: selectedClass,
            subject: selectedSubject,
            teacherEmail: auth.currentUser.email
          }
        });
        finalUrl = result.url;
        uploadedFileId = result.fileId;
      }

      await addDoc(collection(db, 'materials'), {
        teacherId: teacherDocId,
        teacherEmail: auth.currentUser.email,
        className: selectedClass,
        subject: selectedSubject,
        title,
        url: finalUrl,
        type: uploadType,
        fileName: file ? file.name : null,
        schoolId,
        createdAt: new Date().toISOString()
      });

      setTitle('');
      setLinkUrl('');
      setFile(null);
      setProgress(0);
      alert(t('materialsUpload.addedSuccess'));
    } catch (error) {
      console.error("Error adding material:", error);
      alert(t('materialsUpload.addError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm(t('materialsUpload.confirmDelete'))) {
      await deleteDoc(doc(db, 'materials', id));
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>{t('materialsUpload.title')}</h2>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <select 
          className="input-field" 
          style={{ maxWidth: '200px' }}
          value={selectedClass} 
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">{t('materialsUpload.selectClass')}</option>
          {classesList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select 
          className="input-field" 
          style={{ maxWidth: '200px' }}
          value={selectedSubject} 
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">{t('materialsUpload.selectSubject')}</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      
      {!selectedClass || !selectedSubject ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px' }}>
          {t('materialsUpload.promptSelect')}
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          
          {/* Upload Form */}
          <div style={{ flex: '1 1 300px', background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--color-primary-dark)' }}>{t('materialsUpload.addNew')}</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{t('materialsUpload.sourceType')}</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="type" checked={uploadType === 'file'} onChange={() => setUploadType('file')} />
                    {t('materialsUpload.uploadFile')}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="type" checked={uploadType === 'link'} onChange={() => setUploadType('link')} />
                    {t('materialsUpload.externalLink')}
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{t('materialsUpload.materialTitle')}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={t('materialsUpload.titlePlaceholder')} 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              {uploadType === 'file' ? (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{t('materialsUpload.chooseFile')}</label>
                  <input 
                    type="file" 
                    className="input-field" 
                    onChange={e => setFile(e.target.files[0])}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    required
                  />
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{t('materialsUpload.sourceLink')}</label>
                  <input 
                    type="url" 
                    className="input-field" 
                    placeholder="https://..." 
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    required
                  />
                </div>
              )}

              {isUploading && uploadType === 'file' && (
                <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--color-primary)', width: `${progress}%`, transition: 'width 0.3s' }}></div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={isUploading}>
                {uploadType === 'file' ? <UploadCloud size={18} /> : <LinkIcon size={18} />}
                {isUploading ? t('materialsUpload.uploading') : t('materialsUpload.addSource')}
              </button>
            </form>
          </div>

          {/* List of Materials */}
          <div style={{ flex: '2 1 400px' }}>
            {materials.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px' }}>
                {t('materialsUpload.noMaterials')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {materials.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {m.type === 'file' ? <UploadCloud color="var(--color-primary)" /> : <LinkIcon color="var(--color-secondary)" />}
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{m.title}</div>
                        {m.fileName && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{m.fileName}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '6px 12px' }}>
                        {t('materialsUpload.open')}
                      </a>
                      {m.type === 'file' && (
                        <button 
                          type="button" 
                          onClick={() => downloadFile(m.url, m.fileName || m.title)} 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px' }}
                          title="تحميل الملف"
                        >
                          <Download size={16} />
                        </button>
                      )}
                      <button className="btn btn-danger" style={{ padding: '6px 12px' }} onClick={() => handleDelete(m.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
