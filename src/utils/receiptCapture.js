import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/** @returns {boolean} */
export function isNativeReceiptCapture() {
  return Capacitor.isNativePlatform();
}

/**
 * @param {import('@capacitor/camera').Photo} photo
 * @param {string} defaultName
 * @returns {Promise<File>}
 */
async function photoToFile(photo, defaultName) {
  if (!photo?.webPath) {
    throw new Error('No photo captured.');
  }
  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const type = blob.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : 'jpg';
  const base = defaultName.replace(/\.[^.]+$/, '') || 'receipt';
  return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
}

/**
 * @param {unknown} err
 */
function formatNativeCameraError(err) {
  const message = String(err?.message ?? err ?? '').trim();
  const lower = message.toLowerCase();
  if (/cancel/i.test(lower)) return null;
  if (/permission|denied|not allowed/i.test(lower)) {
    return 'Camera permission denied. Allow camera access in device settings, then try again.';
  }
  if (message) return message.split('\n')[0];
  return 'Could not open the camera. Try choosing a photo from your gallery instead.';
}

/**
 * @param {import('@capacitor/camera').CameraSource} source
 * @param {string} fileName
 * @returns {Promise<File|null>}
 */
async function getPhotoAsFile(source, fileName) {
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source,
      saveToGallery: false,
    });
    return photoToFile(photo, fileName);
  } catch (err) {
    const friendly = formatNativeCameraError(err);
    if (!friendly) return null;
    throw new Error(friendly);
  }
}

/** Open the device camera and return a receipt photo file. */
export function captureReceiptFromCamera() {
  return getPhotoAsFile(CameraSource.Camera, 'receipt-camera.jpg');
}

/** Pick an existing receipt photo from the device gallery. */
export function pickReceiptFromGallery() {
  return getPhotoAsFile(CameraSource.Photos, 'receipt-gallery.jpg');
}
