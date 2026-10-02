export interface Concert {
  slug: string;
  artist: string;
  artistHandle: string;
  tourName: string;
  venue: string;
  city: string;
  date: string;
  year: number;
  status: 'completed' | 'upcoming' | 'announced';
  description: string;
  genre: string;
  /** Official ticketing URL (BookMyShow, Skillbox, …). Omitted when unverified. */
  ticketUrl?: string;
  /** Lowest listed ticket price in INR. Omitted when unverified. */
  ticketPriceFrom?: number;
  /** Supporting acts announced for the show. */
  supportActs?: string[];
  /** Signature songs fans can expect to hear. */
  keySongs?: string[];
  /** Door/gate info, e.g. 'Gates 4:00 PM'. */
  startTime?: string;
  /** Per-concert artwork (`/concert-art/<slug>.png`); falls back to the artist hero. */
  image?: string;
  /** Credit line for `image` (photo source + licence, or 'AI-generated artwork'). */
  imageCredit?: string;
}

// Upcoming concerts in India — verified October 2026.
// Past shows are removed from this list; only upcoming and announced
// (unconfirmed) entries live here.
export const CONCERTS: Concert[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DILJIT DOSANJH — Aura World Tour
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'diljit-dosanjh-aura-ahmedabad-2026',
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Aura World Tour',
    venue: 'Narendra Modi Stadium',
    city: 'Ahmedabad',
    date: '2026-11-21',
    year: 2026,
    status: 'upcoming',
    description:
      "Diljit Dosanjh brings his Aura World Tour to the Narendra Modi Stadium in Ahmedabad, the world's largest stadium. Expect Born to Shine, Lover, Naina, and his biggest Punjabi anthems in a historic stadium-scale Punjabi music spectacle.",
    genre: 'Punjabi Pop',
    image: '/concert-art/diljit-dosanjh-aura-ahmedabad-2026.png',
    imageCredit: 'AI-generated artwork',
    ticketUrl:
      'https://in.bookmyshow.com/events/diljit-dosanjh-aura-india-tour-2026-ahmedabad/et42470qp8/',
    ticketPriceFrom: 999,
    keySongs: ['Born to Shine', 'Lover', '5 Taara', 'Do You Know', 'Kinni Kinni'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUNS N' ROSES — India Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'guns-n-roses-bengaluru-november-2026',
    artist: "Guns N' Roses",
    artistHandle: 'guns-and-roses',
    tourName: 'India Tour 2026',
    venue: 'NICE Grounds',
    city: 'Bengaluru',
    date: '2026-11-14',
    year: 2026,
    status: 'upcoming',
    description:
      "Guns N' Roses return to India with a show at Bengaluru's NICE Grounds. Axl Rose, Slash, and Duff McKagan perform Sweet Child O' Mine, Welcome to the Jungle, Paradise City, and November Rain for Indian rock fans.",
    genre: 'Hard Rock',
    image: '/concert-art/guns-n-roses-bengaluru-november-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — Ian Hughes',
    ticketPriceFrom: 4500,
    keySongs: ["Sweet Child O' Mine", 'Welcome to the Jungle', 'Paradise City', 'November Rain'],
  },
  {
    slug: 'guns-n-roses-guwahati-november-2026',
    artist: "Guns N' Roses",
    artistHandle: 'guns-and-roses',
    tourName: 'India Tour 2026',
    venue: 'Khanapara Veterinary Ground',
    city: 'Guwahati',
    date: '2026-11-17',
    year: 2026,
    status: 'upcoming',
    description:
      "Guns N' Roses bring their legendary rock show to Guwahati's Khanapara Veterinary Ground. A landmark night for Northeast India as the band performs its career-spanning set of hard rock anthems.",
    genre: 'Hard Rock',
    image: '/concert-art/guns-n-roses-guwahati-november-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY-SA 4.0) — Heylenny',
    ticketUrl:
      'https://in.bookmyshow.com/events/guns-n-roses-india-2026-guwahati/ET00501963',
    ticketPriceFrom: 2500,
    keySongs: ["Sweet Child O' Mine", 'Welcome to the Jungle', 'Paradise City', 'November Rain'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANYMA — ÆDEN World Tour
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'anyma-aeden-mumbai-2026',
    artist: 'Anyma',
    artistHandle: 'anyma',
    tourName: 'ÆDEN World Tour',
    venue: 'Mahalaxmi Racecourse',
    city: 'Mumbai',
    date: '2026-11-21',
    year: 2026,
    status: 'upcoming',
    description:
      "Anyma brings his brand-new ÆDEN audiovisual show to Mumbai's Mahalaxmi Racecourse. The melodic techno visionary delivers immersive visuals, new music, and a cinematic live experience following his Coachella headline debut of the show.",
    genre: 'Melodic Techno',
    image: '/concert-art/anyma-aeden-mumbai-2026.png',
    imageCredit: 'Wikimedia Commons (CC0) — ObAnyma',
    ticketUrl: 'https://in.bookmyshow.com/events/anyma-presents-aeden-mumbai/ET00480995',
    keySongs: ['Eternity', 'Genesys', 'Welcome to the Opera'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRED AGAIN.. — India Debut Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'fred-again-delhi-december-2026',
    artist: 'Fred again..',
    artistHandle: 'fred-again',
    tourName: 'India Tour 2026',
    venue: 'Leisure Valley Ground',
    city: 'Delhi',
    date: '2026-12-05',
    year: 2026,
    status: 'upcoming',
    description:
      'Fred again.. makes his long-awaited India debut at Leisure Valley Ground in Delhi NCR. The Grammy-winning producer brings his spontaneous live-production style with Marea, Delilah (pull me out of this), and Leavemealone. Tickets via BookMyShow.',
    genre: 'Electronic',
    image: '/concert-art/fred-again-delhi-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 4.0) — Raph_PH',
    ticketUrl:
      'https://in.bookmyshow.com/events/fred-again-india-tour-2026-delhi-ncr/ET00503974',
    keySongs: ['Marea', 'Delilah (pull me out of this)', 'Jungle'],
  },
  {
    slug: 'fred-again-mumbai-december-8-2026',
    artist: 'Fred again..',
    artistHandle: 'fred-again',
    tourName: 'India Tour 2026',
    venue: 'Mahalaxmi Race Course',
    city: 'Mumbai',
    date: '2026-12-08',
    year: 2026,
    status: 'upcoming',
    description:
      'Fred again.. brings his India debut tour to Mumbai for the first of two nights at Mahalaxmi Race Course. Expect an ever-changing set built from voice notes, samples, and live production.',
    genre: 'Electronic',
    image: '/concert-art/fred-again-mumbai-december-8-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 4.0) — Raph_PH',
    keySongs: ['Marea', 'Delilah (pull me out of this)', 'Jungle'],
  },
  {
    slug: 'fred-again-mumbai-december-9-2026',
    artist: 'Fred again..',
    artistHandle: 'fred-again',
    tourName: 'India Tour 2026',
    venue: 'Mahalaxmi Race Course',
    city: 'Mumbai',
    date: '2026-12-09',
    year: 2026,
    status: 'upcoming',
    description:
      'Fred again.. plays a second Mumbai night at Mahalaxmi Race Course. No two Fred again.. shows are the same, so back-to-back nights promise two completely different live experiences.',
    genre: 'Electronic',
    image: '/concert-art/fred-again-mumbai-december-9-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 4.0) — Raph_PH',
    keySongs: ['Marea', 'Delilah (pull me out of this)', 'Jungle'],
  },
  {
    slug: 'fred-again-bengaluru-december-12-2026',
    artist: 'Fred again..',
    artistHandle: 'fred-again',
    tourName: 'India Tour 2026',
    venue: 'NICE Grounds',
    city: 'Bengaluru',
    date: '2026-12-12',
    year: 2026,
    status: 'upcoming',
    description:
      "Fred again.. closes his India debut tour with two nights at Bengaluru's NICE Grounds. The Garden City gets the finale of one of the most in-demand electronic tours in the world.",
    genre: 'Electronic',
    image: '/concert-art/fred-again-bengaluru-december-12-2026.png',
    imageCredit: 'Wikimedia Commons (CC0) — Kiqmah',
    ticketUrl:
      'https://in.bookmyshow.com/events/fred-again-india-tour-2026-bengaluru/ET00503976',
    keySongs: ['Marea', 'Delilah (pull me out of this)', 'Jungle'],
  },
  {
    slug: 'fred-again-bengaluru-december-13-2026',
    artist: 'Fred again..',
    artistHandle: 'fred-again',
    tourName: 'India Tour 2026',
    venue: 'NICE Grounds',
    city: 'Bengaluru',
    date: '2026-12-13',
    year: 2026,
    status: 'upcoming',
    description:
      "Fred again.. wraps his India Tour 2026 with a second night at Bengaluru's NICE Grounds. The closing show of a landmark debut tour for electronic music in India.",
    genre: 'Electronic',
    image: '/concert-art/fred-again-bengaluru-december-13-2026.png',
    imageCredit: 'Wikimedia Commons (CC0) — Kiqmah',
    ticketUrl:
      'https://in.bookmyshow.com/events/fred-again-india-tour-2026-bengaluru/ET00503976',
    keySongs: ['Marea', 'Delilah (pull me out of this)', 'Jungle'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KHALID — It's Always Summer Somewhere World Tour (India debut)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'khalid-gurugram-december-2026',
    artist: 'Khalid',
    artistHandle: 'khalid',
    tourName: "It's Always Summer Somewhere World Tour",
    venue: 'HUDA Gymkhana Club',
    city: 'Delhi',
    date: '2026-12-13',
    year: 2026,
    status: 'upcoming',
    description:
      "Khalid finally makes his India debut in Delhi NCR (Gurugram) after his planned 2020 shows were cancelled. The R&B superstar performs Young, Dumb & Broke, Location, Better, and Talk. Tickets via Skillbox.",
    genre: 'R&B',
    image: '/concert-art/khalid-gurugram-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 3.0) — MTV UK',
    keySongs: ['Young, Dumb & Broke', 'Talk', 'Location'],
  },
  {
    slug: 'khalid-bengaluru-december-2026',
    artist: 'Khalid',
    artistHandle: 'khalid',
    tourName: "It's Always Summer Somewhere World Tour",
    venue: 'Bhartiya Mall',
    city: 'Bengaluru',
    date: '2026-12-15',
    year: 2026,
    status: 'upcoming',
    description:
      "Khalid brings his It's Always Summer Somewhere World Tour to Bengaluru. Six years after his cancelled 2020 visit, Indian fans finally get the Young, Dumb & Broke hitmaker live.",
    genre: 'R&B',
    image: '/concert-art/khalid-bengaluru-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 3.0) — DIM K',
    keySongs: ['Young, Dumb & Broke', 'Talk', 'Location'],
  },
  {
    slug: 'khalid-mumbai-december-2026',
    artist: 'Khalid',
    artistHandle: 'khalid',
    tourName: "It's Always Summer Somewhere World Tour",
    venue: 'Nesco Center',
    city: 'Mumbai',
    date: '2026-12-17',
    year: 2026,
    status: 'upcoming',
    description:
      "Khalid closes his three-city India debut in Mumbai. Expect a smooth R&B night with Better, Talk, Eastside, and his chart-topping collaborations.",
    genre: 'R&B',
    image: '/concert-art/khalid-mumbai-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 4.0) — Thesavagenorwegian',
    keySongs: ['Young, Dumb & Broke', 'Talk', 'Location'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CHAINSMOKERS — India Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'the-chainsmokers-mumbai-december-2026',
    artist: 'The Chainsmokers',
    artistHandle: 'the-chainsmokers',
    tourName: 'India Tour 2026',
    venue: 'Sunburn Festival',
    city: 'Mumbai',
    date: '2026-12-18',
    year: 2026,
    status: 'upcoming',
    description:
      'The Chainsmokers return to India for the first time since 2023, headlining Sunburn in Mumbai. Drew Taggart and Alex Pall bring Closer, Something Just Like This, Roses, and their festival-sized EDM-pop production.',
    genre: 'EDM',
    image: '/concert-art/the-chainsmokers-mumbai-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — The Come Up Show',
    keySongs: ['Closer', 'Something Just Like This', 'Roses'],
  },
  {
    slug: 'the-chainsmokers-delhi-december-2026',
    artist: 'The Chainsmokers',
    artistHandle: 'the-chainsmokers',
    tourName: 'India Tour 2026',
    venue: 'Indian Sneaker Festival',
    city: 'Delhi',
    date: '2026-12-19',
    year: 2026,
    status: 'upcoming',
    description:
      'The Chainsmokers perform in Delhi NCR at the Indian Sneaker Festival as part of their three-city India tour. A mix of EDM, pop, and dance hits in the capital.',
    genre: 'EDM',
    image: '/concert-art/the-chainsmokers-delhi-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — Julio Enriquez',
    keySongs: ['Closer', 'Something Just Like This', 'Roses'],
  },
  {
    slug: 'the-chainsmokers-bengaluru-december-2026',
    artist: 'The Chainsmokers',
    artistHandle: 'the-chainsmokers',
    tourName: 'India Tour 2026',
    venue: 'Sunburn Arena',
    city: 'Bengaluru',
    date: '2026-12-20',
    year: 2026,
    status: 'upcoming',
    description:
      'The Chainsmokers close their India Tour 2026 at Sunburn Arena in Bengaluru. The Grammy-winning duo wraps a massive December run across three Indian cities.',
    genre: 'EDM',
    image: '/concert-art/the-chainsmokers-bengaluru-december-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — The Come Up Show',
    ticketUrl:
      'https://in.bookmyshow.com/events/sunburn-arena-ft-the-chainsmokers/ET00498933',
    keySongs: ['Closer', 'Something Just Like This', 'Roses'],
    startTime: 'Gates 4:00 PM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUNBURN FESTIVAL 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'sunburn-festival-goa-2026',
    artist: 'Sunburn Festival',
    artistHandle: 'sunburn-festival',
    tourName: 'Sunburn Festival 2026',
    venue: 'Vagator Beach',
    city: 'Goa',
    date: '2026-12-28',
    year: 2026,
    status: 'upcoming',
    description:
      "Sunburn Festival 2026 returns to Vagator Beach in Goa, continuing its legacy as Asia's biggest electronic dance music festival with international and Indian DJs across multiple stages.",
    genre: 'EDM',
    image: '/concert-art/sunburn-festival-goa-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 4.0) — Vyacheslav Argenberg',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GORILLAZ — India Tour 2027
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'gorillaz-bengaluru-january-2027',
    artist: 'Gorillaz',
    artistHandle: 'gorillaz',
    tourName: 'India Tour 2027',
    venue: 'TBA',
    city: 'Bengaluru',
    date: '2027-01-23',
    year: 2027,
    status: 'upcoming',
    description:
      'Gorillaz bring their distinctive mix of music and visual storytelling to Bengaluru. Fans can expect Feel Good Inc, Clint Eastwood, and On Melancholy Hill alongside the animated visual world that defines the band.',
    genre: 'Alternative',
    image: '/concert-art/gorillaz-bengaluru-january-2027.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — wonker',
    keySongs: ['Feel Good Inc', 'Clint Eastwood', 'On Melancholy Hill'],
  },
  {
    slug: 'gorillaz-mumbai-january-2027',
    artist: 'Gorillaz',
    artistHandle: 'gorillaz',
    tourName: 'India Tour 2027',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2027-01-27',
    year: 2027,
    status: 'upcoming',
    description:
      "Gorillaz perform in Mumbai as part of their India Tour 2027. Damon Albarn's virtual band delivers one of the most visually ambitious live shows in modern music.",
    genre: 'Alternative',
    image: '/concert-art/gorillaz-mumbai-january-2027.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — leonardo samrani',
    keySongs: ['Feel Good Inc', 'Clint Eastwood', 'On Melancholy Hill'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOO FIGHTERS — India Debut 2027
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'foo-fighters-bengaluru-january-2027',
    artist: 'Foo Fighters',
    artistHandle: 'foo-fighters',
    tourName: 'India Debut 2027',
    venue: 'TBA',
    city: 'Bengaluru',
    date: '2027-01-29',
    year: 2027,
    status: 'upcoming',
    description:
      'Foo Fighters make their long-awaited India debut in Bengaluru, with The Pretty Reckless as supporting act. Everlong, Best of You, and Learn to Fly finally land on an Indian stage.',
    genre: 'Rock',
    image: '/concert-art/foo-fighters-bengaluru-january-2027.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — Raph_PH',
    supportActs: ['The Pretty Reckless'],
    keySongs: ['Everlong', 'Best of You', 'Learn to Fly'],
  },
  {
    slug: 'foo-fighters-mumbai-january-2027',
    artist: 'Foo Fighters',
    artistHandle: 'foo-fighters',
    tourName: 'India Debut 2027',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2027-01-31',
    year: 2027,
    status: 'upcoming',
    description:
      'Foo Fighters close their India debut run in Mumbai. For rock fans, these shows could become some of the biggest live music events of the season.',
    genre: 'Rock',
    image: '/concert-art/foo-fighters-mumbai-january-2027.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — Richard Riley',
    supportActs: ['The Pretty Reckless'],
    keySongs: ['Everlong', 'Best of You', 'Learn to Fly'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUMOURED / UNCONFIRMED
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'bts-india-2026',
    artist: 'BTS',
    artistHandle: 'bts',
    tourName: 'India Concert (Rumoured)',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2026-09-01',
    year: 2026,
    status: 'announced',
    description:
      "BTS are rumoured to be planning their India return in 2026. The global K-pop phenomenon has a massive Indian fanbase (ARMY), and an India concert would be one of the biggest music events in the country's history. No official dates confirmed yet.",
    genre: 'K-Pop',
    image: '/concert-art/bts-india-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 3.0) — NenehTrainer',
  },
  {
    slug: 'the-weeknd-india-2026',
    artist: 'The Weeknd',
    artistHandle: 'the-weeknd',
    tourName: 'India Debut (Rumoured)',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2026-10-01',
    year: 2026,
    status: 'announced',
    description:
      "The Weeknd's India debut is rumoured for 2026. Abel Tesfaye, the global superstar behind Blinding Lights, Starboy, and Save Your Tears, would bring one of the most anticipated concerts in Indian music history.",
    genre: 'R&B',
    image: '/concert-art/the-weeknd-india-2026.png',
    imageCredit: 'Wikimedia Commons (CC BY 2.0) — Kayla Johnson',
  },
];

// Helper to get concerts by artist handle
export function getConcertsByArtist(artistHandle: string): Concert[] {
  return CONCERTS.filter((c) => c.artistHandle === artistHandle);
}

// Helper to get concerts by city
export function getConcertsByCity(city: string): Concert[] {
  return CONCERTS.filter((c) => c.city.toLowerCase() === city.toLowerCase());
}

// Helper to get concerts by year
export function getConcertsByYear(year: number): Concert[] {
  return CONCERTS.filter((c) => c.year === year);
}

// Helper to get upcoming concerts
export function getUpcomingConcerts(): Concert[] {
  return CONCERTS.filter((c) => c.status === 'upcoming' || c.status === 'announced');
}

// Helper to get a single concert by slug
export function getConcertBySlug(slug: string): Concert | undefined {
  return CONCERTS.find((c) => c.slug === slug);
}

// Get unique cities from concerts
export function getConcertCities(): string[] {
  return [...new Set(CONCERTS.map((c) => c.city))].sort();
}

// Get unique artists from concerts
export function getConcertArtists(): string[] {
  return [...new Set(CONCERTS.map((c) => c.artist))].sort();
}

// Helper to get upcoming concerts grouped by artist, sorted by soonest date
export interface UpcomingArtistConcert {
  artistHandle: string;
  artist: string;
  tourName: string;
  nextShow: Concert;
  allUpcoming: Concert[];
}

export function getUpcomingConcertsByArtist(): UpcomingArtistConcert[] {
  const now = new Date();
  const upcoming = CONCERTS.filter(
    (c) => (c.status === 'upcoming' || c.status === 'announced') && new Date(c.date) > now
  );

  const artistMap = new Map<string, Concert[]>();
  for (const concert of upcoming) {
    const existing = artistMap.get(concert.artistHandle) || [];
    existing.push(concert);
    artistMap.set(concert.artistHandle, existing);
  }

  const result: UpcomingArtistConcert[] = [];
  for (const [handle, concerts] of artistMap) {
    const sorted = [...concerts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    result.push({
      artistHandle: handle,
      artist: sorted[0].artist,
      tourName: sorted[0].tourName,
      nextShow: sorted[0],
      allUpcoming: sorted,
    });
  }

  return result.sort(
    (a, b) => new Date(a.nextShow.date).getTime() - new Date(b.nextShow.date).getTime()
  );
}
