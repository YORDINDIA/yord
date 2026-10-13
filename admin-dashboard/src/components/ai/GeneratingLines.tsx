import styles from './ai.module.css';

/**
 * Generating placeholder for a model call.
 *
 * A label swap on the button ("Generating…") tells the admin *what* is
 * happening but not *where the answer will appear*, and the wait is seconds
 * long. This draws the shape of the artefact underneath, and the label says
 * which model call is in flight.
 */
export default function GeneratingLines({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <div className={styles.lines} aria-hidden="true">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-line" style={{ width: '88%' }} />
        <span className="skeleton skeleton-line" style={{ width: '72%' }} />
        <span className="skeleton skeleton-line" style={{ width: '80%' }} />
      </div>
      <p className="helper" style={{ marginTop: 8 }}>
        {label}
      </p>
    </div>
  );
}
