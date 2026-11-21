const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1400;
const IMAGE_FILE_NAME_PATTERN = /\.(png|jpe?g|gif|webp|svg|bmp|heic|heif)$/i;

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_FILE_NAME_PATTERN.test(file.name);
}

export function hasImageFilesInDataTransfer(dataTransfer: DataTransfer) {
  if (getImageFilesFromDataTransfer(dataTransfer).length > 0) {
    return true;
  }

  const html = dataTransfer.getData("text/html");
  return /<img\b/i.test(html);
}

function imageFileIdentity(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

function extensionForImageMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/svg+xml") return "svg";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

function mimeTypeFromFileName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (/\.jpe?g$/i.test(lower)) return "image/jpeg";
  return null;
}

function normalizeClipboardImageFile(file: File) {
  const mime =
    (file.type.startsWith("image/") ? file.type : null) ??
    mimeTypeFromFileName(file.name) ??
    "image/png";

  let name = file.name?.trim() ?? "";
  if (!name || name === "blob" || name.toLowerCase() === "image.png") {
    name = `pasted-image.${extensionForImageMime(mime)}`;
  } else if (!IMAGE_FILE_NAME_PATTERN.test(name)) {
    const stem = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
    name = `${stem || "pasted-image"}.${extensionForImageMime(mime)}`;
  }

  if (name === file.name && mime === file.type) {
    return file;
  }

  return new File([file], name, { type: mime });
}

export function getImageFilesFromDataTransfer(dataTransfer: DataTransfer) {
  const filesByIdentity = new Map<string, File>();

  const addFile = (file: File | null) => {
    if (!file || !isImageFile(file) || file.size > MAX_IMAGE_BYTES) return;

    const normalized = normalizeClipboardImageFile(file);
    filesByIdentity.set(imageFileIdentity(normalized), normalized);
  };

  for (const file of Array.from(dataTransfer.files ?? [])) {
    addFile(file);
  }

  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file") continue;
    if (item.type && !item.type.startsWith("image/")) continue;
    addFile(item.getAsFile());
  }

  return Array.from(filesByIdentity.values());
}

export async function getClipboardImageFiles(dataTransfer: DataTransfer) {
  const direct = getImageFilesFromDataTransfer(dataTransfer);
  if (direct.length > 0) return direct;

  const html = dataTransfer.getData("text/html");
  if (!html.trim() || !/<img\b/i.test(html)) return [];

  const doc = new DOMParser().parseFromString(html, "text/html");
  const sources = Array.from(doc.querySelectorAll("img[src]"))
    .map((img) => img.getAttribute("src"))
    .filter((src): src is string => Boolean(src));

  const files: File[] = [];
  const seenSources = new Set<string>();

  for (const src of sources) {
    if (seenSources.has(src)) continue;
    seenSources.add(src);

    try {
      const file = await fileFromEmbeddedImageSrc(src);
      if (!file || !isImageFile(file) || file.size > MAX_IMAGE_BYTES) continue;
      files.push(normalizeClipboardImageFile(file));
    } catch {
      // Skip sources that cannot be fetched (e.g. blocked cross-origin URLs).
    }
  }

  return files;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

async function readImageFileAsDataUrl(file: File) {
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return originalDataUrl;
  }

  try {
    const image = await loadImage(originalDataUrl);
    const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    if (scale >= 1 && file.size <= 1024 * 1024) {
      return originalDataUrl;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return originalDataUrl;

    context.drawImage(image, 0, 0, width, height);

    const outputType =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";

    return canvas.toDataURL(
      outputType,
      outputType === "image/jpeg" ? 0.9 : undefined,
    );
  } catch {
    return originalDataUrl;
  }
}

function dataUrlToUploadFile(dataUrl: string, originalName: string) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : mimeType === "image/svg+xml"
            ? "svg"
            : "jpg";

  return new File([bytes], originalName || `image.${extension}`, {
    type: mimeType,
  });
}

async function prepareImageUploadFile(file: File) {
  const dataUrl = await readImageFileAsDataUrl(file);
  return dataUrlToUploadFile(dataUrl, file.name);
}

export function extractTaskImageFilename(taskId: string, src: string) {
  const pattern = new RegExp(
    `/api/task-images/${taskId}/([a-z0-9-]+\\.(?:jpe?g|png|gif|webp|svg))`,
    "i",
  );
  return src.match(pattern)?.[1] ?? null;
}

export async function deleteUploadedTaskImage(taskId: string, filename: string) {
  const response = await fetch(`/api/tasks/${taskId}/images/${filename}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorBody?.error ?? "Failed to delete image");
  }
}
export async function uploadImageFile(taskId: string, file: File) {
  const uploadFile = await prepareImageUploadFile(file);
  const formData = new FormData();
  formData.append("file", uploadFile);

  const response = await fetch(`/api/tasks/${taskId}/images`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorBody?.error ?? "Image upload failed");
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

export async function uploadImageFiles(taskId: string, files: File[]) {
  const urls: string[] = [];

  for (const file of files) {
    urls.push(await uploadImageFile(taskId, file));
  }

  return urls;
}

async function blobToUploadFile(blob: Blob, name: string) {
  const type = blob.type.startsWith("image/") ? blob.type : "image/png";
  return new File([blob], name, { type });
}

async function fileFromEmbeddedImageSrc(src: string) {
  if (src.startsWith("data:")) {
    const mimeType = src.match(/data:(.*?);/)?.[1] ?? "image/png";
    return dataUrlToUploadFile(
      src,
      `pasted-image.${extensionForImageMime(mimeType)}`,
    );
  }

  if (src.startsWith("blob:") || src.startsWith("http://") || src.startsWith("https://")) {
    const response = await fetch(src);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/") && blob.size === 0) return null;

    const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png";
    return blobToUploadFile(blob, `pasted-image.${extensionForImageMime(mimeType)}`);
  }

  return null;
}

export async function uploadEmbeddedImagesInHtml(html: string, taskId: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images = Array.from(doc.querySelectorAll("img"));

  if (images.length === 0) return html;

  for (const image of images) {
    const src = image.getAttribute("src");
    if (!src || src.includes("/api/task-images/")) continue;

    try {
      const file = await fileFromEmbeddedImageSrc(src);
      if (!file || file.size > MAX_IMAGE_BYTES) continue;

      const url = await uploadImageFile(taskId, file);
      image.setAttribute("src", url);
    } catch {
      image.remove();
    }
  }

  return doc.body.innerHTML;
}
