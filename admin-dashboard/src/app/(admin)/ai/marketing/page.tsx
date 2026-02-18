"use client";

import { useState } from 'react';

export default function AiMarketingPage() {
  const [brief, setBrief] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const response = await fetch('/api/ai/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief })
    });
    const data = await response.json();
    setLoading(false);
    setOutput(data.output || '');
  }

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Marketing Ops</div>
            <div className="helper">Generate campaign ideas and SEO refreshers.</div>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label className="helper">Brief</label>
            <input className="input" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Boost IPL collection sales" />
          </div>
          <button className="button primary" type="button" onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
      {output && (
        <div className="card">
          <div className="section-title">Suggestions</div>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{output}</pre>
        </div>
      )}
    </div>
  );
}
