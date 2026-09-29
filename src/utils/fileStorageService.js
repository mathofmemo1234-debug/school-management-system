import { db } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';

const CHUNK_SIZE = 700000; // ~525KB per chunk in Base64 (well under Firestore 1MB limit)
const INLINE_SIZE_LIMIT = 300000; // ~225KB (fits in main doc)

/**
 * Reads a File object as Base64 Data URL
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a Base64 data URL to a binary Blob
 */
export function dataUrlToBlob(dataUrl, defaultMime = 'application/octet-stream') {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('blob:')) {
    return dataUrl;
  }
  
  try {
    const parts = dataUrl.split(';base64,');
    let contentType = defaultMime;
    let byteCharacters = '';
    
    if (parts.length === 2) {
      contentType = parts[0].split(':')[1] || defaultMime;
      byteCharacters = window.atob(parts[1]);
    } else {
      byteCharacters = window.atob(dataUrl);
    }

    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  } catch (err) {
    console.error('Error converting dataUrl to Blob:', err);
    return new Blob([dataUrl], { type: defaultMime });
  }
}

/**
 * Universal file upload function that works for PDFs, Images, and Documents of any size.
 * Stores chunked data in Firestore, completely eliminating Firebase Storage bucket & CORS dependencies.
 */
export async function uploadFileToFirestore(file, options = {}) {
  const {
    category = 'general',
    onProgress = () => {},
    metadata = {}
  } = options;

  if (!file) throw new Error('لم يتم تحديد أي ملف للرفع');

  const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB limit
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 30 ميجابايت.');
  }

  onProgress(5);

  const dataUrl = await readFileAsDataUrl(file);
  onProgress(15);

  const fileId = `${category}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

  const mainDocRef = doc(db, 'system_files', fileId);

  // If small enough, store directly inline for zero chunk latency
  if (dataUrl.length <= INLINE_SIZE_LIMIT) {
    await setDoc(mainDocRef, {
      id: fileId,
      name: file.name,
      fileName: file.name,
      size: file.size,
      type: mimeType,
      category,
      totalChunks: 1,
      isChunked: false,
      inlineData: dataUrl,
      createdAt: new Date().toISOString(),
      ...metadata
    });

    onProgress(100);

    const viewerUrl = `#/file-viewer?id=${fileId}`;
    return {
      fileId,
      id: fileId,
      name: file.name,
      fileName: file.name,
      size: file.size,
      type: mimeType,
      url: viewerUrl,
      dataUrl
    };
  }

  // Chunked upload for larger files (e.g. multi-page PDFs)
  const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
  
  // 1. Write metadata doc
  await setDoc(mainDocRef, {
    id: fileId,
    name: file.name,
    fileName: file.name,
    size: file.size,
    type: mimeType,
    category,
    totalChunks,
    isChunked: true,
    createdAt: new Date().toISOString(),
    ...metadata
  });

  onProgress(25);

  // 2. Upload chunks in parallel batches of 3
  const BATCH_SIZE = 3;
  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batchPromises = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, totalChunks); j++) {
      const chunkStr = dataUrl.substring(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
      const chunkDocRef = doc(db, `system_files/${fileId}/chunks`, `chunk_${j}`);
      batchPromises.push(
        setDoc(chunkDocRef, {
          index: j,
          data: chunkStr
        })
      );
    }
    await Promise.all(batchPromises);
    const progressPercent = Math.min(95, Math.round(25 + ((i + BATCH_SIZE) / totalChunks) * 70));
    onProgress(progressPercent);
  }

  onProgress(100);

  const viewerUrl = `#/file-viewer?id=${fileId}`;
  return {
    fileId,
    id: fileId,
    name: file.name,
    fileName: file.name,
    size: file.size,
    type: mimeType,
    url: viewerUrl,
    dataUrl
  };
}

/**
 * Retrieves file metadata and reassembles all data chunks into a Blob and Object URL
 */
export async function getFileData(fileId) {
  if (!fileId) throw new Error('معرف الملف غير صحيح');

  // Check system_files
  let metaSnap = await getDoc(doc(db, 'system_files', fileId));
  let isLegacyExcellence = false;

  if (!metaSnap.exists()) {
    // Check if it's from legacy excellence_files
    metaSnap = await getDoc(doc(db, 'excellence_files', fileId));
    if (metaSnap.exists()) {
      isLegacyExcellence = true;
    } else {
      throw new Error('لم يتم العثور على الملف المطلوب أو ربما تم حذفه');
    }
  }

  const meta = metaSnap.data();

  // If inline data is present
  if (meta.inlineData) {
    const blob = dataUrlToBlob(meta.inlineData, meta.type || 'application/pdf');
    const blobUrl = URL.createObjectURL(blob);
    return {
      ...meta,
      blob,
      blobUrl,
      dataUrl: meta.inlineData
    };
  }

  // If chunked
  const collectionPath = isLegacyExcellence 
    ? `excellence_files/${fileId}/chunks`
    : `system_files/${fileId}/chunks`;

  const chunksRef = collection(db, collectionPath);
  const q = query(chunksRef, orderBy('index'));
  const snap = await getDocs(q);

  let fullData = '';
  snap.forEach(docSnap => {
    fullData += docSnap.data().data || '';
  });

  if (!fullData && meta.attachmentBase64) {
    fullData = meta.attachmentBase64;
  }

  if (!fullData) {
    throw new Error('بيانات الملف فارغة أو غير مكتملة');
  }

  const mimeType = meta.type || meta.mimeType || (meta.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  const blob = dataUrlToBlob(fullData, mimeType);
  const blobUrl = URL.createObjectURL(blob);

  return {
    ...meta,
    blob,
    blobUrl,
    dataUrl: fullData
  };
}

/**
 * Universal download helper that handles fileId, hash URLs, external URLs, and Data URLs
 */
export async function downloadFile(fileIdOrUrl, fileName = 'document.pdf') {
  try {
    let resolvedBlobUrl = null;
    let resolvedName = fileName;

    if (typeof fileIdOrUrl === 'string') {
      if (fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://')) {
        // If it contains #/file-viewer?id=
        const match = fileIdOrUrl.match(/id=([^&]+)/);
        if (match) {
          const fileData = await getFileData(match[1]);
          resolvedBlobUrl = fileData.blobUrl;
          resolvedName = fileData.name || fileData.fileName || fileName;
        } else {
          // Standard external URL
          window.open(fileIdOrUrl, '_blank');
          return;
        }
      } else if (fileIdOrUrl.includes('#/file-viewer?id=')) {
        const match = fileIdOrUrl.match(/id=([^&]+)/);
        if (match) {
          const fileData = await getFileData(match[1]);
          resolvedBlobUrl = fileData.blobUrl;
          resolvedName = fileData.name || fileData.fileName || fileName;
        }
      } else if (fileIdOrUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(fileIdOrUrl);
        resolvedBlobUrl = URL.createObjectURL(blob);
      } else {
        // Direct fileId
        const fileData = await getFileData(fileIdOrUrl);
        resolvedBlobUrl = fileData.blobUrl;
        resolvedName = fileData.name || fileData.fileName || fileName;
      }
    } else if (fileIdOrUrl && fileIdOrUrl.fileId) {
      const fileData = await getFileData(fileIdOrUrl.fileId);
      resolvedBlobUrl = fileData.blobUrl;
      resolvedName = fileData.name || fileData.fileName || fileName;
    }

    if (!resolvedBlobUrl) {
      throw new Error('تعذر إيجاد رابط التحميل');
    }

    const a = document.createElement('a');
    a.href = resolvedBlobUrl;
    a.download = resolvedName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 150);
  } catch (err) {
    console.error('Download error:', err);
    alert('حدث خطأ أثناء تحميل الملف: ' + err.message);
  }
}
