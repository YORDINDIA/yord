import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import {
  Check,
  Clock,
  FileText,
  Megaphone,
  PenLine,
  PlugZap,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { agnesBaseUrl, imageModel, textModel } from '@/lib/ai/agnes';
import { AI_GUARD_LIMITS } from '@/lib/ai/guard';
import styles from '@/components/ai/ai.module.css';

export const metadata: Metadata = { title: 'AI Studio · YORD Admin' };

interface Studio {
  key: string;
  href: string;
  title: string;
  description: string;
  /** Card-level tone; the icon tile, list glyphs and chips read `--tone`. */
  tone: 'saffron' | 'violet' | 'cyan';
  icon: LucideIcon;
  /** What one run produces — the honest field list of each endpoint. */
  writes: string[];
}

const STUDIOS: Studio[] = [
  {
    key: 'listing',
    href: '/ai/listing',
    title: 'Listing studio',
    description: 'Rewrites one product listing from the copy that is already there.',
    tone: 'saffron',
    icon: FileText,
    writes: [
      'Title',
      'HTML description',
      'Tags',
      'Suggested collections (advisory)',
      'Reviewer notes',
    ],
  },
  {
    key: 'blog',
    href: '/ai/blog',
    title: 'Blog studio',
    description: 'Researches a topic and writes an article draft with citations.',
    tone: 'violet',
    icon: PenLine,
    writes: ['Summary', 'Body HTML', 'Tags from your keywords', 'Citation list'],
  },
  {
    key: 'marketing',
    href: '/ai/marketing',
    title: 'Marketing studio',
    description: 'Turns a short brief into a campaign plan and SEO angles.',
    tone: 'cyan',
    icon: Megaphone,
    writes: ['Campaign ideas', 'SEO opportunities', 'Suggested tags', 'Banner and email copy'],
  },
];

/** Host only — the full endpoint is noise, and the key must never be printed. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * AI Studio hub.
 *
 * `AGNES_AI_API_KEY` is server-only, so the configuration state is read here in
 * the server component and reduced to a status badge, the endpoint host, and the
 * effective model names (`resolveAgnesConfig` defaults) — never the key itself.
 * The studio cards stay links when the key is missing: the routes answer
 * `NOT_CONFIGURED` rather than 404, so a half-configured deploy is still
 * navigable and says what is wrong.
 */
export default function AiHomePage() {
  const configured = Boolean(process.env.AGNES_AI_API_KEY);

  return (
    <>
      <PageHeader
        icon={Sparkles}
        title="AI Studio"
        description="Draft listings, articles, and campaigns with Agnes AI."
      />

      <div className="grid-3">
        {STUDIOS.map((studio) => {
          const Icon = studio.icon;
          return (
            <div key={studio.key} className={clsx('card', `tone-${studio.tone}`)}>
              <div className={styles.capability}>
                <div className="row">
                  <span className="tone-tile lg">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div>
                    <div className="card-title">{studio.title}</div>
                    <div className="helper">{studio.description}</div>
                  </div>
                </div>

                <div className="hr" />

                <div>
                  <div className="stat-label">What it writes</div>
                  <ul className={styles.writes} style={{ marginTop: 6 }}>
                    {studio.writes.map((item) => (
                      <li key={item}>
                        <Check size={11} className="tone-icon" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="row" style={{ marginTop: 'auto', paddingTop: 4 }}>
                  <Link className="button primary" href={studio.href}>
                    Open studio
                  </Link>
                  {!configured && <StatusBadge tone="warning" label="Not configured" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">Agnes AI connection</div>
              <div className="helper">Read from the server environment; the key is never shown.</div>
            </div>
            <StatusBadge
              icon={PlugZap}
              tone={configured ? 'success' : 'warning'}
              label={configured ? 'Connected' : 'Not configured'}
              dot
              size="md"
            />
          </div>

          <dl className={styles.meta}>
            <dt>API key</dt>
            <dd>
              {configured
                ? 'AGNES_AI_API_KEY is set'
                : 'AGNES_AI_API_KEY is missing — every studio returns NOT_CONFIGURED'}
            </dd>
            <dt>Endpoint host</dt>
            <dd className="mono">{hostOf(agnesBaseUrl)}</dd>
            <dt>Text model</dt>
            <dd className="mono">{textModel}</dd>
            <dt>Image model</dt>
            <dd className="mono">{imageModel}</dd>
          </dl>

          {!configured && (
            <p className="helper" style={{ marginTop: 10 }}>
              Set <span className="mono">AGNES_AI_API_KEY</span> in the environment and redeploy. The
              studios open either way; generation is refused with the route&apos;s own message.
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">How it works</div>
              <div className="helper">Four things to know before you press generate.</div>
            </div>
          </div>

          <ul className={styles.writes}>
            <li>
              <Clock size={11} className="tone-icon" aria-hidden="true" />
              <span>
                Calls are one-shot, not streamed: the whole answer arrives at once, so expect a
                button that sits busy for a few seconds.
              </span>
            </li>
            <li>
              <Check size={11} className="tone-icon" aria-hidden="true" />
              <span>
                Everything is a draft. Nothing touches the catalog until you apply it; blog drafts are
                saved unpublished.
              </span>
            </li>
            <li>
              <ShieldCheck size={11} className="tone-icon" aria-hidden="true" />
              <span>
                Rate-limited per admin: {AI_GUARD_LIMITS.MAX_CALLS_PER_MINUTE} generations a minute,{' '}
                {AI_GUARD_LIMITS.MAX_CALLS_PER_DAY} a day, shared across all four studios.
              </span>
            </li>
            <li>
              <FileText size={11} className="tone-icon" aria-hidden="true" />
              <span>
                Applied changes and saved drafts go through audited server actions — who did it, and
                what it replaced, are both recorded.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
