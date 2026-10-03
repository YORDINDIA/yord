/* Pure CSS: no JS gate. The overlay hides itself at the end of its own
   animation and is never rendered for reduced-motion users, so the page
   underneath is always present and readable. */
export function Curtain() {
  return (
    <div className="poster-curtain" aria-hidden="true">
      <p className="poster-count poster-display">
        <i />
        <i />
        <i />
      </p>
    </div>
  );
}
