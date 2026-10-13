import Link from 'next/link';

export interface MarqueeItem {
  handle: string;
  name: string;
}

/* Two identical groups scroll by -50%. The copy is inert so keyboard and
   screen-reader users meet each artist once. */
export function Marquee({ items }: { items: MarqueeItem[] }) {
  const group = (copy: boolean) => (
    <ul className="poster-marquee-group" aria-hidden={copy || undefined} inert={copy || undefined}>
      {items.map((item) => (
        <li key={item.handle}>
          <Link href={`/artist/${item.handle}`} className="poster-display">
            {item.name}
          </Link>
          <i className="poster-diamond" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Artists" className="poster-marquee">
      <div className="poster-marquee-track">
        {group(false)}
        {group(true)}
      </div>
    </section>
  );
}
