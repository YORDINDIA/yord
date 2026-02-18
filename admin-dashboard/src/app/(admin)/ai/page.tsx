import Link from 'next/link';

export default function AiHomePage() {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Improve Listing</div>
            <div className="helper">Enhance product copy, tags, and images.</div>
          </div>
        </div>
        <Link className="button primary" href="/ai/listing">Open Studio</Link>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blog Research</div>
            <div className="helper">Generate articles with citations.</div>
          </div>
        </div>
        <Link className="button primary" href="/ai/blog">Open Studio</Link>
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Marketing Ops</div>
            <div className="helper">Campaign ideas and SEO refreshers.</div>
          </div>
        </div>
        <Link className="button primary" href="/ai/marketing">Open Studio</Link>
      </div>
    </div>
  );
}
