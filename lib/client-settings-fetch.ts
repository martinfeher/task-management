function isAbortRelatedError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error && /aborted/i.test(error.message)) {
    return true;
  }

  return false;
}

export function shouldIgnoreSettingsLoadError(
  error: unknown,
  options: { cancelled?: boolean },
): boolean {
  if (options.cancelled) {
    return true;
  }

  return isAbortRelatedError(error);
}

export function runSettingsLoadEffect(
  loadSettings: (isCancelled: () => boolean) => Promise<void>,
): () => void {
  let cancelled = false;
  const isCancelled = () => cancelled;

  void loadSettings(isCancelled).catch((error) => {
    if (shouldIgnoreSettingsLoadError(error, { cancelled })) {
      return;
    }

    console.warn("Failed to load settings from server.", error);
  });

  return () => {
    cancelled = true;
  };
}
