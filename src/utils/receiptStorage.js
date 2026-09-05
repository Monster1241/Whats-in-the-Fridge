import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase.js';

const MAX_WIDTH_PX = 1200;
const INITIAL_QUALITY = 0.7;
const TARGET_MAX_BYTES = 300 * 1024;

/**
 * @param {Blob|File} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try another photo.'));
    };
    img.src = url;
  });
}

/**
 * Canvas JPEG compression — aims for ≤ ~300KB.
 * @param {Blob|File} file
 * @returns {Promise<Blob>}
 */
export async function compressReceiptImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_WIDTH_PX / Math.max(img.width, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image for upload.');
  ctx.drawImage(img, 0, 0, width, height);

  let quality = INITIAL_QUALITY;
  let blob = await new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
  });

  while (blob && blob.size > TARGET_MAX_BYTES && quality > 0.35) {
    quality -= 0.1;
    blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
    });
  }

  if (!blob) throw new Error('Could not compress receipt photo.');
  return blob;
}

/**
 * Upload a compressed receipt photo to Firebase Storage.
 * Path: households/{householdId}/receipts/{filename}
 *
 * @param {string} householdId
 * @param {Blob|File} imageFile
 * @returns {Promise<string>} download URL
 */
export async function uploadReceiptPhoto(householdId, imageFile) {
  const scopedId = String(householdId ?? '').trim();
  if (!scopedId) {
    throw new Error('Household is required to save a receipt photo.');
  }
  if (!imageFile) {
    throw new Error('No receipt photo selected.');
  }

  const compressed = await compressReceiptImage(imageFile);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const path = `households/${scopedId}/receipts/${filename}`;
  const storageRef = ref(getFirebaseStorage(), path);

  try {
    await uploadBytes(storageRef, compressed, {
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000',
    });
    return await getDownloadURL(storageRef);
  } catch (err) {
    const message = String(err?.message ?? err ?? '').trim();
    if (/unauthorized|permission/i.test(message)) {
      throw new Error(
        'Could not upload receipt. Check Firebase Storage rules allow authenticated household uploads.',
      );
    }
    throw new Error(message || 'Could not upload receipt photo.');
  }
}
