import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin } from 'lucide-react';
import type { Concert } from '@/lib/data/concerts';
import { getConcertImage } from './concertImages';
import { formatConcertMonthYear } from './concertDates';
import { SectionHeading } from '@/features/ui/SectionHeading';

export interface ConcertRelatedProps {
  artist: string;
  concerts: Concert[];
}

/**
 * Other shows by the same artist. The date here is month + year (not the card's
 * full weekday date), which used to be an inline `toLocaleDateString` — the one
 * place in the section that re-implemented the IST-safe formatting by hand.
 */
export function ConcertRelated({ artist, concerts }: ConcertRelatedProps) {
  if (concerts.length === 0) return null;

  return (
    <section className="container-page pb-16">
      <SectionHeading title={`More ${artist} Concerts in India`} className="mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {concerts.map((concert) => {
          const image = getConcertImage(concert);
          return (
            <Link
              key={concert.slug}
              href={`/concerts/${concert.slug}`}
              className="group flex gap-4 bg-surface-card border border-border-default p-4 hover:border-accent/40 transition-colors"
            >
              {image ? (
                <div className="relative w-20 h-20 shrink-0 overflow-hidden">
                  <Image src={image} alt={concert.artist} fill sizes="80px" className="object-cover" />
                </div>
              ) : null}
              <div className="min-w-0">
                <h3 className="font-heading text-lg text-text-secondary group-hover:text-accent transition-colors truncate">
                  {concert.tourName}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} aria-hidden="true" /> {concert.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} aria-hidden="true" />{' '}
                    {formatConcertMonthYear(concert.date)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
