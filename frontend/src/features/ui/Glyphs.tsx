/** The house up-right arrow (Stagelight). Square caps, 16 grid. */
export function ArrowDiag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" aria-hidden="true" focusable="false">
      <path d="M3.5 12.5L12 4M5.5 3.8H12.2V10.5" />
    </svg>
  );
}
