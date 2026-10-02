import Link from 'next/link';
import { Arrow } from './Arrow';
import { tankerEm } from './metrics';

const VALUES = [
  { title: 'Premium Quality', text: 'Every piece crafted with the finest materials and attention to detail.' },
  { title: 'Fan Made', text: 'Artist-inspired designs made by fans, for fans.' },
  { title: 'Pan-India Delivery', text: 'Fast, secure shipping to every corner of the country.' },
  { title: 'Fan-First', text: 'Designed by fans, for fans. Every purchase celebrates your passion.' },
];

export function Story({ photo }: { photo: string }) {
  return (
    <section aria-labelledby="poster-story" className="poster-sect poster-story" data-tone="card" data-from="page">
      <div className="poster-pad poster-story-head">
        <h2
          id="poster-story"
          className="poster-story-title poster-display"
          style={{ '--w': tankerEm('Merchandise') } as React.CSSProperties}
        >
          <span>More Than</span>
          <span>Merchandise</span>
        </h2>
      </div>

      <div className="poster-pad poster-story-main">
        <p
          className="poster-established poster-display"
          style={{ '--photo': `url(${photo})` } as React.CSSProperties}
        >
          <span>Established</span>
          <b>2024</b>
        </p>

        <div className="poster-story-copy">
          <p className="poster-pull poster-display">Where Every Thread Tells a Story</p>
          <p>
            YORD India was born from a simple belief: concert merchandise should be as memorable as
            the music itself. We craft premium apparel that captures the magic of live performances
            and transforms it into wearable art.
          </p>
          <p>
            From the electric energy of a Coldplay show to the poetic grace of Taylor Swift, from the
            vibrant celebration of Diljit Dosanjh, each piece tells a story of unforgettable moments
            shared between artists and their devoted fans.
          </p>
          <Link href="/about" className="poster-textlink" data-cursor="pointer">
            Discover our story
            <Arrow className="poster-textlink-arrow" />
          </Link>
        </div>
      </div>

      <ol className="poster-pad poster-values">
        {VALUES.map((v, i) => (
          <li key={v.title}>
            <span className="poster-display poster-value-num">{String(i + 1).padStart(2, '0')}</span>
            <h3>{v.title}</h3>
            <p>{v.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
