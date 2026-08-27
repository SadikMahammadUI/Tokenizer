import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'log'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

function extOf(filename) {
  return filename.split('.').pop().toLowerCase();
}

async function fileToArrayBuffer(file) {
  return await file.arrayBuffer();
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file) {
  const buffer = await fileToArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
  }
  if (!text.trim()) {
    throw new Error(
      'No selectable text found in this PDF. It may be a scanned image — try uploading it as an image instead.'
    );
  }
  return text;
}

async function extractDocxText(file) {
  const buffer = await fileToArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

/**
 * Reads a File and returns either
 *   { kind: 'text', text }         for txt/pdf/docx/plain text
 *   { kind: 'image', mimeType, base64 } for images
 * Throws a descriptive Error for anything unsupported.
 */
export async function parseUploadedFile(file) {
  const ext = extOf(file.name);

  if (IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith('image/')) {
    const base64 = await fileToBase64(file);
    return { kind: 'image', mimeType: file.type || `image/${ext}`, base64 };
  }

  if (ext === 'pdf') {
    return { kind: 'text', text: await extractPdfText(file) };
  }

  if (ext === 'docx') {
    return { kind: 'text', text: await extractDocxText(file) };
  }

  if (ext === 'doc') {
    throw new Error(
      'Legacy .doc files are not supported client-side — please save as .docx and re-upload.'
    );
  }

  if (TEXT_EXTENSIONS.includes(ext) || file.type.startsWith('text/')) {
    return { kind: 'text', text: await file.text() };
  }

  throw new Error(`Unsupported file type: .${ext}. Try .txt, .pdf, .docx, or an image.`);
}
