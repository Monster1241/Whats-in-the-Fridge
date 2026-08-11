const MAX_DIMENSION_PX = 1600;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const JPEG_QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

/**
 * @param {File} file
 */
function isPdfFile(file) {
  return (
    file.type === 'application/pdf'
    || file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * @param {File} file
 */
function isImageFile(file) {
  return (
    file.type.startsWith('image/')
    || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  );
}

/**
 * @param {File} file
 * @returns {Promise<Blob>}
 */
function loadImageBlob(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).then((bitmap) => ({ bitmap, revoke: () => bitmap.close?.() }));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        bitmap: image,
        revoke: () => {},
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this photo.'));
    };
    image.src = url;
  });
}

/**
 * @param {ImageBitmap | HTMLImageElement} source
 * @param {number} maxDimension
 */
function scaledDimensions(source, maxDimension) {
  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * @param {ImageBitmap | HTMLImageElement} source
 * @param {number} width
 * @param {number} height
 * @param {number} quality
 * @returns {Promise<Blob|null>}
 */
function canvasToJpegBlob(source, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

/**
 * @param {File} file
 * @returns {Promise<File>}
 */
async function compressImageFile(file) {
  let loaded;
  try {
    loaded = await loadImageBlob(file);
  } catch {
    if (
      file.size <= MAX_UPLOAD_BYTES
      && /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type)
    ) {
      return file;
    }
    throw new Error(
      'Could not read this photo. Save it as JPG/PNG or take a new photo in your camera app.',
    );
  }

  const { bitmap, revoke } = loaded;
  const { width, height } = scaledDimensions(bitmap, MAX_DIMENSION_PX);

  try {
    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToJpegBlob(bitmap, width, height, quality);
      if (!blob) continue;
      if (blob.size <= MAX_UPLOAD_BYTES || quality === JPEG_QUALITY_STEPS.at(-1)) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'receipt';
        return new File([blob], `${baseName}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }
    }
  } finally {
    revoke();
  }

  throw new Error('Receipt photo is too large. Try a closer crop or lower-resolution photo.');
}

/**
 * Compress photos for upload and pass PDFs through unchanged.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function prepareReceiptFileForUpload(file) {
  if (!file) {
    throw new Error('No file selected.');
  }

  if (isPdfFile(file)) {
    if (file.size > 12 * 1024 * 1024) {
      throw new Error('PDF is too large (max 12 MB).');
    }
    return file;
  }

  if (!isImageFile(file)) {
    throw new Error('Use JPG, PNG, WEBP, HEIC, or PDF.');
  }

  return compressImageFile(file);
}
