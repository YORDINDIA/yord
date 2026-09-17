"use client";

import { useState } from 'react';

export default function AiBlogPage() {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [draft, setDraft] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [citations, setCitations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ai/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, keywords })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Failed to generate');
        return;
      }
      setDraft(data.body_html);
      setSummary(data.summary_html);
      setCitations(data.citations || []);
    } catch {
      setMessage('Network error, try again.');
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    const response = await fetch('/api/ai/blog/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, summary_html: summary, body_html: draft, tags: keywords, citations }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to save');
      return;
    }
    setMessage('Draft saved to articles (unpublished).');
  }

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">AI Blog Research</div>
            <div className="helper">Generates a draft with citations.</div>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label className="helper">Topic</label>
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <label className="helper">Keywords</label>
            <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </div>
          <button className="button primary" type="button" onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>
      </div>
      {draft && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">Draft Preview</div>
              <div className="helper">Review before publishing.</div>
            </div>
            <button className="button" onClick={saveDraft}>Save Draft</button>
          </div>
          <div className="helper">Summary</div>
          <div dangerouslySetInnerHTML={{ __html: summary }} />
          {citations.length > 0 && (
            <>
              <div className="helper" style={{ marginTop: 12 }}>Citations</div>
              <ul className="helper">
                {citations.map((citation, idx) => (
                  <li key={idx}>{citation}</li>
                ))}
              </ul>
            </>
          )}
          <div className="helper" style={{ marginTop: 12 }}>Body</div>
          <div dangerouslySetInnerHTML={{ __html: draft }} />
        </div>
      )}
      {message && <div className="card"><div className="helper">{message}</div></div>}
    </div>
  );
}
