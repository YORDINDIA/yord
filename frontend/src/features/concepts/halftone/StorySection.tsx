import { ArrowLink } from './Arrow';
import { DitherImage } from './DitherImage';
import { RevealText } from './Reveal';

const VALUES = [
  { title: 'Premium Quality', text: 'Every piece crafted with the finest materials and attention to detail.' },
  { title: 'Fan Made', text: 'Artist-inspired designs made by fans, for fans.' },
  { title: 'Pan-India Delivery', text: 'Fast, secure shipping to every corner of the country.' },
  { title: 'Fan-First', text: 'Designed by fans, for fans. Every purchase celebrates your passion.' },
];

export function StorySection() {
  return (
    <section aria-labelledby="ht-story-title" className="ht-section ht-stage ht-story">
      <div className="ht-wrap">
        <h2 id="ht-story-title" className="ht-display ht-story__title">
          More Than <em>Merchandise</em>
        </h2>

        <div className="ht-story__copy">
          <RevealText
            className="ht-display ht-story__p"
            segments={[
              { t: 'YORD India was born from a simple belief: concert merchandise should be' },
              { t: 'as memorable as the music itself.', em: true },
              { t: 'We craft premium apparel that captures the magic of live performances and transforms it into wearable art.' },
            ]}
          />
          <RevealText
            className="ht-display ht-story__p ht-story__p--late"
            segments={[
              {
                t: 'From the electric energy of a Coldplay show to the poetic grace of Taylor Swift, from the vibrant celebration of Diljit Dosanjh, each piece tells a story of',
              },
              { t: 'unforgettable moments', em: true },
              { t: 'shared between artists and their devoted fans.' },
            ]}
          />
        </div>

        <DitherImage
          src="/artists/taylor-hero.png"
          alt="Taylor Swift on stage"
          sizes="(min-width: 1440px) 1312px, 92vw"
          className="ht-story__band"
          cell={4}
          lens={110}
          pos={[0.5, 0.42]}
        />

        <div className="ht-story__sign">
          <p className="ht-display ht-story__pull">
            Where Every Thread Tells a <em>Story</em>
          </p>
          <p className="ht-wide ht-story__est">Established 2024</p>
        </div>

        <ol className="ht-values">
          {VALUES.map((v, i) => (
            <li key={v.title}>
              <span className="ht-display ht-values__n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{v.title}</h3>
              <p>{v.text}</p>
            </li>
          ))}
        </ol>

        <ArrowLink href="/about">Discover our story</ArrowLink>
      </div>
    </section>
  );
}
