import { isCroppableImageSrc } from "@/lib/image-crop";

/**
 * A text label placed on an image. Position is the top-left of the text block in
 * natural (source) image pixels. `fontSize` is expressed relative to
 * `ANNOTATION_REFERENCE_WIDTH`, so a given size looks the same on any image.
 */
export type TextAnnotation = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
};

/** A size of N renders with a glyph height of N px on an image this wide. */
export const ANNOTATION_REFERENCE_WIDTH = 800;
export const ANNOTATION_LINE_HEIGHT = 1.2;
export const ANNOTATION_FONT_WEIGHT = 600;
export const ANNOTATION_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const ANNOTATION_FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 64, 96] as const;
export const DEFAULT_ANNOTATION_FONT_SIZE = 24;

export const ANNOTATION_COLORS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ffffff",
  "#18181b",
] as const;
export const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLORS[0];

/** Animated GIFs / SVGs cannot be annotated without flattening them. */
export function isAnnotatableImageSrc(src: string) {
  return isCroppableImageSrc(src);
}

/** Converts a relative font size to pixels for an image `imageWidth` px wide. */
export function annotationFontPx(fontSize: number, imageWidth: number) {
  return (fontSize * imageWidth) / ANNOTATION_REFERENCE_WIDTH;
}

export function annotationLines(text: string) {
  return text.split("\n");
}

export type RenderedAnnotation = {
  blob: Blob;
  width: number;
  height: number;
};

export async function renderAnnotatedImage(
  image: HTMLImageElement,
  annotations: TextAnnotation[],
  mimeType: string,
): Promise<RenderedAnnotation> {
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Annotating is not supported in this browser.");
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  context.textAlign = "left";
  // "middle" is the center of the em box, which is where the browser centers
  // text inside a line box — so the canvas output matches the on-screen text.
  context.textBaseline = "middle";

  for (const annotation of annotations) {
    if (!annotation.text.trim()) continue;

    const px = annotationFontPx(annotation.fontSize, width);
    context.font = `${ANNOTATION_FONT_WEIGHT} ${px}px ${ANNOTATION_FONT_FAMILY}`;
    context.fillStyle = annotation.color;

    annotationLines(annotation.text).forEach((line, index) => {
      context.fillText(
        line,
        annotation.x,
        annotation.y + (index + 0.5) * ANNOTATION_LINE_HEIGHT * px,
      );
    });
  }

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
    throw new Error("Could not annotate this image.");
  }

  return { blob, width, height };
}
