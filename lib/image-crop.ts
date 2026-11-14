/** Crop rectangle in natural (source) image pixels. */
export type CropRect = { x: number; y: number; w: number; h: number };

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type CropBounds = { w: number; h: number };

export const MIN_CROP_SIZE = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function fullCrop(bounds: CropBounds): CropRect {
  return { x: 0, y: 0, w: bounds.w, h: bounds.h };
}

export function isFullCrop(crop: CropRect, bounds: CropBounds) {
  return (
    crop.x <= 0.5 &&
    crop.y <= 0.5 &&
    crop.w >= bounds.w - 1 &&
    crop.h >= bounds.h - 1
  );
}

export function moveCrop(
  start: CropRect,
  dx: number,
  dy: number,
  bounds: CropBounds,
): CropRect {
  return {
    ...start,
    x: clamp(start.x + dx, 0, bounds.w - start.w),
    y: clamp(start.y + dy, 0, bounds.h - start.h),
  };
}

/**
 * Resizes `start` by dragging `handle` by (dx, dy) source pixels. The edge/corner
 * opposite the handle stays fixed. When `ratio` (width / height) is set the
 * aspect ratio is preserved.
 */
export function resizeCrop(
  start: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  bounds: CropBounds,
  ratio: number | null,
): CropRect {
  const min = Math.min(MIN_CROP_SIZE, bounds.w, bounds.h);
  const hasW = handle.includes("w");
  const hasE = handle.includes("e");
  const hasN = handle.includes("n");
  const hasS = handle.includes("s");

  if (ratio === null) {
    let left = start.x;
    let top = start.y;
    let right = start.x + start.w;
    let bottom = start.y + start.h;

    if (hasW) left = clamp(start.x + dx, 0, right - min);
    if (hasE) right = clamp(right + dx, left + min, bounds.w);
    if (hasN) top = clamp(start.y + dy, 0, bottom - min);
    if (hasS) bottom = clamp(bottom + dy, top + min, bounds.h);

    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  const minW = Math.max(min, min * ratio);

  if (handle.length === 2) {
    const anchorX = hasE ? start.x : start.x + start.w;
    const anchorY = hasS ? start.y : start.y + start.h;
    const proposedW = start.w + (hasE ? dx : -dx);
    const proposedH = start.h + (hasS ? dy : -dy);

    const maxW = Math.min(
      hasE ? bounds.w - anchorX : anchorX,
      (hasS ? bounds.h - anchorY : anchorY) * ratio,
    );
    const w = clamp(
      (proposedW + proposedH * ratio) / 2,
      Math.min(minW, maxW),
      maxW,
    );
    const h = w / ratio;

    return {
      x: hasE ? anchorX : anchorX - w,
      y: hasS ? anchorY : anchorY - h,
      w,
      h,
    };
  }

  if (handle === "e" || handle === "w") {
    const anchorX = handle === "e" ? start.x : start.x + start.w;
    const centerY = start.y + start.h / 2;
    const maxW = Math.min(
      handle === "e" ? bounds.w - anchorX : anchorX,
      2 * Math.min(centerY, bounds.h - centerY) * ratio,
    );
    const w = clamp(
      start.w + (handle === "e" ? dx : -dx),
      Math.min(minW, maxW),
      maxW,
    );
    const h = w / ratio;

    return {
      x: handle === "e" ? anchorX : anchorX - w,
      y: centerY - h / 2,
      w,
      h,
    };
  }

  const anchorY = handle === "s" ? start.y : start.y + start.h;
  const centerX = start.x + start.w / 2;
  const minH = Math.max(min, min / ratio);
  const maxH = Math.min(
    handle === "s" ? bounds.h - anchorY : anchorY,
    (2 * Math.min(centerX, bounds.w - centerX)) / ratio,
  );
  const h = clamp(
    start.h + (handle === "s" ? dy : -dy),
    Math.min(minH, maxH),
    maxH,
  );
  const w = h * ratio;

  return {
    x: centerX - w / 2,
    y: handle === "s" ? anchorY : anchorY - h,
    w,
    h,
  };
}

/**
 * Re-fits the crop to a new aspect ratio, keeping roughly the same area and
 * center, and keeping it inside the image.
 */
export function fitCropToRatio(
  current: CropRect,
  ratio: number,
  bounds: CropBounds,
): CropRect {
  let w = Math.sqrt(current.w * current.h * ratio);
  let h = w / ratio;

  const scale = Math.min(1, bounds.w / w, bounds.h / h);
  w *= scale;
  h *= scale;

  const centerX = current.x + current.w / 2;
  const centerY = current.y + current.h / 2;

  return {
    x: clamp(centerX - w / 2, 0, bounds.w - w),
    y: clamp(centerY - h / 2, 0, bounds.h - h),
    w,
    h,
  };
}

export function getCropOutputMimeType(src: string) {
  const lower = src.toLowerCase();

  if (lower.startsWith("data:image/png") || /\.png(?:[?#]|$)/.test(lower)) {
    return "image/png";
  }

  if (lower.startsWith("data:image/webp") || /\.webp(?:[?#]|$)/.test(lower)) {
    return "image/webp";
  }

  return "image/jpeg";
}

export function isCroppableImageSrc(src: string) {
  const lower = src.toLowerCase();
  return !(
    lower.startsWith("data:image/gif") ||
    lower.startsWith("data:image/svg") ||
    /\.(?:gif|svg)(?:[?#]|$)/.test(lower)
  );
}

export type RenderedCrop = {
  blob: Blob;
  /** Output size in source pixels. */
  width: number;
  height: number;
  /** Cropped fraction of the original width/height. */
  fractionX: number;
  fractionY: number;
};

export async function renderCroppedImage(
  image: HTMLImageElement,
  crop: CropRect,
  mimeType: string,
): Promise<RenderedCrop> {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  const sx = clamp(Math.round(crop.x), 0, naturalWidth - 1);
  const sy = clamp(Math.round(crop.y), 0, naturalHeight - 1);
  const width = clamp(Math.round(crop.w), 1, naturalWidth - sx);
  const height = clamp(Math.round(crop.h), 1, naturalHeight - sy);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Cropping is not supported in this browser.");
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(image, sx, sy, width, height, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(
        resolve,
        mimeType,
        mimeType === "image/jpeg" ? 0.92 : undefined,
      );
    } catch {
      resolve(null);
    }
  });

  if (!blob) {
    throw new Error("Could not crop this image.");
  }

  return {
    blob,
    width,
    height,
    fractionX: width / naturalWidth,
    fractionY: height / naturalHeight,
  };
}
