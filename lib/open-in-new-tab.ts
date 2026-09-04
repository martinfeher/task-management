type ModifierMouseEvent = Pick<MouseEvent, "metaKey" | "ctrlKey">;

export function isModifiedNavigationClick(event: ModifierMouseEvent) {
  return Boolean(event.metaKey || event.ctrlKey);
}

export function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openInNewTabFromClick(event: ModifierMouseEvent, url: string) {
  if (!isModifiedNavigationClick(event)) return false;

  openInNewTab(url);
  return true;
}
