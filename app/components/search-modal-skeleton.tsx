const SEARCH_MODAL_SKELETON_BAR =
  "task-details-skeleton-bar animate-pulse rounded";

export function SearchModalPreviewContentSkeleton() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      aria-hidden="true"
    >
      <div className="border-b border-zinc-100 bg-[#fcfcfe] px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className={`h-5 w-[58%] ${SEARCH_MODAL_SKELETON_BAR}`} />
        <div className={`mt-2 h-2.5 w-[32%] ${SEARCH_MODAL_SKELETON_BAR}`} />
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 bg-[#fafafc] px-3.5 py-3 dark:bg-zinc-950/40">
        <div className={`h-3 w-full ${SEARCH_MODAL_SKELETON_BAR}`} />
        <div className={`h-3 w-[94%] ${SEARCH_MODAL_SKELETON_BAR}`} />
        <div className={`h-3 w-[88%] ${SEARCH_MODAL_SKELETON_BAR}`} />
        <div className={`h-3 w-[72%] ${SEARCH_MODAL_SKELETON_BAR}`} />
        <div className={`h-3 w-[81%] ${SEARCH_MODAL_SKELETON_BAR}`} />
      </div>
    </div>
  );
}

type SearchModalResultsSkeletonProps = {
  splitLayout?: boolean;
};

export function SearchModalResultsSkeleton({
  splitLayout = true,
}: SearchModalResultsSkeletonProps) {
  if (!splitLayout) {
    return (
      <div
        className="space-y-0 px-0 py-0"
        aria-busy="true"
        aria-label="Loading search results"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800"
          >
            <div className={`size-4 shrink-0 ${SEARCH_MODAL_SKELETON_BAR}`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-3.5 w-[68%] ${SEARCH_MODAL_SKELETON_BAR}`} />
              <div className={`h-2.5 w-[38%] ${SEARCH_MODAL_SKELETON_BAR}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1"
      aria-busy="true"
      aria-label="Loading search results"
    >
      <div className="flex min-h-0 w-[42%] shrink-0 flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800"
          >
            <div className={`size-4 shrink-0 ${SEARCH_MODAL_SKELETON_BAR}`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-3.5 w-[68%] ${SEARCH_MODAL_SKELETON_BAR}`} />
              <div className={`h-2.5 w-[38%] ${SEARCH_MODAL_SKELETON_BAR}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="min-h-0 min-w-0 flex-1 bg-[#fefeff] dark:bg-zinc-950/40">
        <SearchModalPreviewContentSkeleton />
      </div>
    </div>
  );
}

export function SearchModalLoadingShell() {
  return (
    <div
      className="search-modal-overlay is-visible fixed inset-0 z-10000 flex items-start justify-center p-4 pt-[8vh]"
      aria-busy="true"
      aria-label="Loading search"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Loading search"
        className="search-modal-panel is-entered relative flex max-h-[min(75vh,600px)] w-full max-w-4xl flex-col overflow-hidden bg-white dark:bg-zinc-900"
      >
        <div className="shrink-0 border-b border-zinc-200 px-4 py-3 pr-12 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className={`size-5 shrink-0 ${SEARCH_MODAL_SKELETON_BAR}`} />
            <div className={`h-[35px] w-full ${SEARCH_MODAL_SKELETON_BAR}`} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className={`h-[26px] w-14 ${SEARCH_MODAL_SKELETON_BAR}`}
              />
            ))}
          </div>
        </div>
        <div className="search-modal-body min-h-0 flex-1">
          <div className="search-modal-body-inner flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              <SearchModalResultsSkeleton splitLayout />
            </div>
          </div>
        </div>
        <div className="h-[52px] shrink-0 border-t border-zinc-200 bg-zinc-100/40 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex h-full items-center gap-8 px-6">
            <div className={`h-3 w-24 ${SEARCH_MODAL_SKELETON_BAR}`} />
            <div className={`h-3 w-16 ${SEARCH_MODAL_SKELETON_BAR}`} />
            <div className={`h-3 w-32 ${SEARCH_MODAL_SKELETON_BAR}`} />
          </div>
        </div>
      </div>
    </div>
  );
}