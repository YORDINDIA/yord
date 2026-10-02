import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="card-header">
          <div>
            <div className="brand-sub">YORD INDIA</div>
            <div className="card-title">Access denied</div>
          </div>
        </div>
        <div className="helper">This account is not registered as an admin.</div>
        <Link className="button" href="/login" style={{ marginTop: 16 }}>
          Back to login
        </Link>
      </div>
    </div>
  );
}
