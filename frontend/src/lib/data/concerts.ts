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
  /** Per-concert artwork (`/concert-art/<slug>.webp`); falls back to the artist hero. */
  image?: string;
  /** Credit line for `image` (photo source + licence, or 'AI-generated artwork'). */
  imageCredit?: string;
}

/** Fields shared by every date of one tour. */
type TourFields = 'artist' | 'artistHandle' | 'tourName' | 'genre' | 'supportActs' | 'keySongs';

/** One show of a tour: everything that changes from date to date. */
export type ConcertDate = Omit<Concert, TourFields | 'year'>;

/** One concert (an artist's tour) with its dates nested under it. */
export interface ConcertTour extends Pick<Concert, TourFields> {
  /** Highlighted concert: listed first and given the spotlight. */
  featured?: boolean;
  dates: ConcertDate[];
}

// Upcoming concerts in India — verified 13 October 2026.
// Past shows are removed from this list; only upcoming and announced
// (unconfirmed) entries live here.
export const TOURS: ConcertTour[] = [
  {
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Aura World Tour',
    genre: 'Punjabi Pop',
    featured: true,
    keySongs: ['Born to Shine', 'Lover', '5 Taara', 'Do You Know', 'Kinni Kinni'],
    dates: [
      {
        slug: 'diljit-dosanjh-aura-ahmedabad-2026',
        venue: 'Narendra Modi Stadium',
        city: 'Ahmedabad',
        date: '2026-11-21',
        status: 'upcoming',
        description:
          "Diljit Dosanjh brings his Aura World Tour to the Narendra Modi Stadium in Ahmedabad, the world's largest stadium. Expect Born to Shine, Lover, Naina, and his biggest Punjabi anthems in a historic stadium-scale Punjabi music spectacle.",
        image: '/concert-art/diljit-dosanjh-aura-ahmedabad-2026.webp',
        imageCredit: 'AI-generated artwork',
        ticketUrl:
          'https://in.bookmyshow.com/events/diljit-dosanjh-aura-india-tour-2026-ahmedabad/et42470qp8/',
        ticketPriceFrom: 999,
      },
      {
        slug: 'diljit-dosanjh-aura-delhi-november-2026',
        venue: 'Jawaharlal Nehru Stadium',
        city: 'Delhi',
        date: '2026-11-01',
        status: 'upcoming',
        description:
          'Diljit Dosanjh opens the India leg of his Aura World Tour at Jawaharlal Nehru Stadium in Delhi. Expect Born to Shine, Lover, and 5 Taara in a full stadium production.',
        image: '/concert-art/diljit-dosanjh-aura-delhi-november-2026.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'diljit-dosanjh-aura-indore-november-2026',
        venue: 'C21 Estate',
        city: 'Indore',
        date: '2026-11-15',
        status: 'upcoming',
        description:
          'Diljit Dosanjh brings the Aura World Tour to C21 Estate in Indore, his stop in Central India. The set includes Lover, Do You Know, and Kinni Kinni.',
        image: '/concert-art/diljit-dosanjh-aura-indore-november-2026.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'diljit-dosanjh-aura-mumbai-november-2026',
        venue: 'Mahalaxmi Race Course',
        city: 'Mumbai',
        date: '2026-11-27',
        status: 'upcoming',
        description:
          'Diljit Dosanjh plays the Aura World Tour at Mahalaxmi Race Course in Mumbai. Expect Born to Shine, 5 Taara, and his biggest Punjabi hits.',
        image: '/concert-art/diljit-dosanjh-aura-mumbai-november-2026.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'diljit-dosanjh-aura-bengaluru-november-2026',
        venue: 'NICE Grounds',
        city: 'Bengaluru',
        date: '2026-11-29',
        status: 'upcoming',
        description:
          "Diljit Dosanjh brings the Aura World Tour to Bengaluru's NICE Grounds. The set includes Lover, Do You Know, and Born to Shine.",
        image: '/concert-art/diljit-dosanjh-aura-bengaluru-november-2026.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'diljit-dosanjh-aura-chandigarh-december-2026',
        venue: 'TBA',
        city: 'Chandigarh',
        date: '2026-12-01',
        status: 'announced',
        description:
          'A Chandigarh show on the Aura World Tour is announced, with the date and venue still to be confirmed. One report gives 1 December 2026.',
        image: '/concert-art/diljit-dosanjh-aura-chandigarh-december-2026.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'diljit-dosanjh-aura-lucknow-december-2026',
        venue: '19th National Jamboree Ground',
        city: 'Lucknow',
        date: '2026-12-05',
        status: 'upcoming',
        description:
          'Diljit Dosanjh plays the 19th National Jamboree Ground in Lucknow on the Aura World Tour. Expect 5 Taara, Kinni Kinni, and Lover.',
        image: '/concert-art/diljit-dosanjh-aura-lucknow-december-2026.webp',
        imageCredit: 'AI-generated artwork',
      },
    ],
  },
  {
    artist: "Guns N' Roses",
    artistHandle: 'guns-and-roses',
    tourName: 'India Tour 2026',
    genre: 'Hard Rock',
    keySongs: ["Sweet Child O' Mine", 'Welcome to the Jungle', 'Paradise City', 'November Rain'],
    dates: [
      {
        slug: 'guns-n-roses-bengaluru-november-2026',
        venue: 'NICE Grounds',
        city: 'Bengaluru',
        date: '2026-11-14',
        status: 'upcoming',
        description:
          "Guns N' Roses return to India with a show at Bengaluru's NICE Grounds. Axl Rose, Slash, and Duff McKagan perform Sweet Child O' Mine, Welcome to the Jungle, Paradise City, and November Rain for Indian rock fans.",
        image: '/concert-art/guns-n-roses-bengaluru-november-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — Ian Hughes',
        ticketPriceFrom: 4500,
      },
      {
        slug: 'guns-n-roses-guwahati-november-2026',
        venue: 'Khanapara Veterinary Ground',
        city: 'Guwahati',
        date: '2026-11-17',
        status: 'upcoming',
        description:
          "Guns N' Roses bring their legendary rock show to Guwahati's Khanapara Veterinary Ground. A landmark night for Northeast India as the band performs its career-spanning set of hard rock anthems.",
        image: '/concert-art/guns-n-roses-guwahati-november-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY-SA 4.0) — Heylenny',
        ticketUrl: 'https://in.bookmyshow.com/events/guns-n-roses-india-2026-guwahati/ET00501963',
        ticketPriceFrom: 2500,
      },
    ],
  },
  {
    artist: 'Anyma',
    artistHandle: 'anyma',
    tourName: 'ÆDEN World Tour',
    genre: 'Melodic Techno',
    keySongs: ['Eternity', 'Genesys', 'Welcome to the Opera'],
    dates: [
      {
        slug: 'anyma-aeden-mumbai-2026',
        venue: 'Mahalaxmi Racecourse',
        city: 'Mumbai',
        date: '2026-11-21',
        status: 'upcoming',
        description:
          "Anyma brings his brand-new ÆDEN audiovisual show to Mumbai's Mahalaxmi Racecourse. The melodic techno visionary delivers immersive visuals, new music, and a cinematic live experience following his Coachella headline debut of the show.",
        image: '/concert-art/anyma-aeden-mumbai-2026.webp',
        imageCredit: 'Wikimedia Commons (CC0) — ObAnyma',
        ticketUrl: 'https://in.bookmyshow.com/events/anyma-presents-aeden-mumbai/ET00480995',
      },
    ],
  },
  {
    artist: 'Fred again..',
    artistHandle: 'fred-again',
    tourName: 'India Tour 2026',
    genre: 'Electronic',
    keySongs: ['Marea', 'Delilah (pull me out of this)', 'Jungle'],
    dates: [
      {
        slug: 'fred-again-delhi-december-2026',
        venue: 'Leisure Valley Ground',
        city: 'Delhi',
        date: '2026-12-05',
        status: 'upcoming',
        description:
          'Fred again.. makes his long-awaited India debut at Leisure Valley Ground in Delhi NCR. The Grammy-winning producer brings his spontaneous live-production style with Marea, Delilah (pull me out of this), and Leavemealone. Tickets via BookMyShow.',
        image: '/concert-art/fred-again-delhi-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 4.0) — Raph_PH',
        ticketUrl: 'https://in.bookmyshow.com/events/fred-again-india-tour-2026-delhi-ncr/ET00503974',
      },
      {
        slug: 'fred-again-mumbai-december-8-2026',
        venue: 'Mahalaxmi Race Course',
        city: 'Mumbai',
        date: '2026-12-08',
        status: 'upcoming',
        description:
          'Fred again.. brings his India debut tour to Mumbai for the first of two nights at Mahalaxmi Race Course. Expect an ever-changing set built from voice notes, samples, and live production.',
        image: '/concert-art/fred-again-mumbai-december-8-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 4.0) — Raph_PH',
      },
      {
        slug: 'fred-again-mumbai-december-9-2026',
        venue: 'Mahalaxmi Race Course',
        city: 'Mumbai',
        date: '2026-12-09',
        status: 'upcoming',
        description:
          'Fred again.. plays a second Mumbai night at Mahalaxmi Race Course. No two Fred again.. shows are the same, so back-to-back nights promise two completely different live experiences.',
        image: '/concert-art/fred-again-mumbai-december-9-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 4.0) — Raph_PH',
      },
      {
        slug: 'fred-again-bengaluru-december-12-2026',
        venue: 'NICE Grounds',
        city: 'Bengaluru',
        date: '2026-12-12',
        status: 'upcoming',
        description:
          "Fred again.. closes his India debut tour with two nights at Bengaluru's NICE Grounds. The Garden City gets the finale of one of the most in-demand electronic tours in the world.",
        image: '/concert-art/fred-again-bengaluru-december-12-2026.webp',
        imageCredit: 'Wikimedia Commons (CC0) — Kiqmah',
        ticketUrl: 'https://in.bookmyshow.com/events/fred-again-india-tour-2026-bengaluru/ET00503976',
      },
      {
        slug: 'fred-again-bengaluru-december-13-2026',
        venue: 'NICE Grounds',
        city: 'Bengaluru',
        date: '2026-12-13',
        status: 'upcoming',
        description:
          "Fred again.. wraps his India Tour 2026 with a second night at Bengaluru's NICE Grounds. The closing show of a landmark debut tour for electronic music in India.",
        image: '/concert-art/fred-again-bengaluru-december-13-2026.webp',
        imageCredit: 'Wikimedia Commons (CC0) — Kiqmah',
        ticketUrl: 'https://in.bookmyshow.com/events/fred-again-india-tour-2026-bengaluru/ET00503976',
      },
    ],
  },
  {
    artist: 'Khalid',
    artistHandle: 'khalid',
    tourName: "It's Always Summer Somewhere World Tour",
    genre: 'R&B',
    keySongs: ['Young, Dumb & Broke', 'Talk', 'Location'],
    dates: [
      {
        slug: 'khalid-gurugram-december-2026',
        venue: 'HUDA Gymkhana Club',
        city: 'Delhi',
        date: '2026-12-13',
        status: 'upcoming',
        description:
          'Khalid finally makes his India debut in Delhi NCR (Gurugram) after his planned 2020 shows were cancelled. The R&B superstar performs Young, Dumb & Broke, Location, Better, and Talk. Tickets via Skillbox.',
        image: '/concert-art/khalid-gurugram-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 3.0) — MTV UK',
        ticketPriceFrom: 2549,
      },
      {
        slug: 'khalid-bengaluru-december-2026',
        venue: 'Bhartiya Mall',
        city: 'Bengaluru',
        date: '2026-12-15',
        status: 'upcoming',
        description:
          "Khalid brings his It's Always Summer Somewhere World Tour to Bengaluru. Six years after his cancelled 2020 visit, Indian fans finally get the Young, Dumb & Broke hitmaker live.",
        image: '/concert-art/khalid-bengaluru-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 3.0) — DIM K',
        ticketPriceFrom: 2549,
      },
      {
        slug: 'khalid-mumbai-december-2026',
        venue: 'Nesco Center',
        city: 'Mumbai',
        date: '2026-12-17',
        status: 'upcoming',
        description:
          'Khalid closes his three-city India debut in Mumbai. Expect a smooth R&B night with Better, Talk, Eastside, and his chart-topping collaborations.',
        image: '/concert-art/khalid-mumbai-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 4.0) — Thesavagenorwegian',
        ticketPriceFrom: 2549,
      },
    ],
  },
  {
    artist: 'The Chainsmokers',
    artistHandle: 'the-chainsmokers',
    tourName: 'India Tour 2026',
    genre: 'EDM',
    keySongs: ['Closer', 'Something Just Like This', 'Roses'],
    dates: [
      {
        slug: 'the-chainsmokers-mumbai-december-2026',
        venue: 'Mahalaxmi Race Course',
        city: 'Mumbai',
        date: '2026-12-18',
        status: 'upcoming',
        description:
          'The Chainsmokers return to India for the first time since 2023, headlining Sunburn in Mumbai. Drew Taggart and Alex Pall bring Closer, Something Just Like This, Roses, and their festival-sized EDM-pop production.',
        image: '/concert-art/the-chainsmokers-mumbai-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — The Come Up Show',
      },
      {
        slug: 'the-chainsmokers-delhi-december-2026',
        venue: 'Indian Sneaker Festival',
        city: 'Delhi',
        date: '2026-12-19',
        status: 'upcoming',
        description:
          'The Chainsmokers perform in Delhi NCR at the Indian Sneaker Festival as part of their three-city India tour. A mix of EDM, pop, and dance hits in the capital.',
        image: '/concert-art/the-chainsmokers-delhi-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — Julio Enriquez',
      },
      {
        slug: 'the-chainsmokers-bengaluru-december-2026',
        venue: 'Sunburn Arena',
        city: 'Bengaluru',
        date: '2026-12-20',
        status: 'upcoming',
        description:
          'The Chainsmokers close their India Tour 2026 at Sunburn Arena in Bengaluru. The Grammy-winning duo wraps a massive December run across three Indian cities.',
        image: '/concert-art/the-chainsmokers-bengaluru-december-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — The Come Up Show',
        ticketUrl: 'https://in.bookmyshow.com/events/sunburn-arena-ft-the-chainsmokers/ET00498933',
        startTime: 'Gates 4:00 PM',
      },
    ],
  },
  {
    artist: 'Sunburn Festival',
    artistHandle: 'sunburn-festival',
    tourName: 'Sunburn Festival 2026',
    genre: 'EDM',
    dates: [
      {
        slug: 'sunburn-festival-goa-2026',
        venue: 'Vagator Beach',
        city: 'Goa',
        date: '2026-12-28',
        status: 'upcoming',
        description:
          "Sunburn Festival 2026 returns to Vagator Beach in Goa, continuing its legacy as Asia's biggest electronic dance music festival with international and Indian DJs across multiple stages.",
        image: '/concert-art/sunburn-festival-goa-2026.webp',
        imageCredit: 'Wikimedia Commons (CC BY 4.0) — Vyacheslav Argenberg',
      },
    ],
  },
  {
    artist: 'Gorillaz',
    artistHandle: 'gorillaz',
    tourName: 'The Mountain Tour',
    genre: 'Alternative',
    keySongs: ['Feel Good Inc', 'Clint Eastwood', 'On Melancholy Hill'],
    dates: [
      {
        slug: 'gorillaz-bengaluru-january-2027',
        venue: 'District Arena @ Terraform',
        city: 'Bengaluru',
        date: '2027-01-23',
        status: 'upcoming',
        description:
          'Gorillaz bring their distinctive mix of music and visual storytelling to Bengaluru. Fans can expect Feel Good Inc, Clint Eastwood, and On Melancholy Hill alongside the animated visual world that defines the band.',
        image: '/concert-art/gorillaz-bengaluru-january-2027.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — wonker',
        ticketPriceFrom: 5000,
      },
      {
        slug: 'gorillaz-mumbai-january-2027',
        venue: 'Jio World Garden',
        city: 'Mumbai',
        date: '2027-01-27',
        status: 'upcoming',
        description:
          "Gorillaz perform at Jio World Garden in Mumbai on The Mountain Tour. Damon Albarn's virtual band delivers one of the most visually ambitious live shows in modern music.",
        image: '/concert-art/gorillaz-mumbai-january-2027.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — leonardo samrani',
        ticketPriceFrom: 5000,
      },
      {
        slug: 'gorillaz-guwahati-january-2027',
        venue: 'Sarusajai Stadium',
        city: 'Guwahati',
        date: '2027-01-31',
        status: 'upcoming',
        description:
          'Gorillaz close their India debut at Sarusajai Stadium in Guwahati, presented with Assam Tourism. Expect Feel Good Inc, Clint Eastwood, and On Melancholy Hill.',
        image: '/concert-art/gorillaz-guwahati-january-2027.webp',
        imageCredit: 'AI-generated artwork',
        ticketUrl: 'https://www.district.in/events/gorillaz-india-tour-guwahati-2027-buy-tickets',
        ticketPriceFrom: 2500,
        startTime: 'Gates 4:00 PM',
      },
    ],
  },
  {
    artist: 'Foo Fighters',
    artistHandle: 'foo-fighters',
    tourName: 'India Debut 2027',
    genre: 'Rock',
    supportActs: ['The Pretty Reckless', 'Die Spitz'],
    keySongs: ['Everlong', 'Best of You', 'Learn to Fly'],
    dates: [
      {
        slug: 'foo-fighters-bengaluru-january-2027',
        venue: 'Bengaluru LIVE',
        city: 'Bengaluru',
        date: '2027-01-29',
        status: 'upcoming',
        description:
          'Foo Fighters make their long-awaited India debut in Bengaluru, with The Pretty Reckless and Die Spitz in support. Everlong, Best of You, and Learn to Fly finally land on an Indian stage.',
        image: '/concert-art/foo-fighters-bengaluru-january-2027.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — Raph_PH',
      },
      {
        slug: 'foo-fighters-mumbai-january-2027',
        venue: 'Mahalaxmi Race Course',
        city: 'Mumbai',
        date: '2027-01-31',
        status: 'upcoming',
        description:
          'Foo Fighters close their India debut run at Mahalaxmi Race Course in Mumbai. For rock fans, these shows could become some of the biggest live music events of the season.',
        image: '/concert-art/foo-fighters-mumbai-january-2027.webp',
        imageCredit: 'Wikimedia Commons (CC BY 2.0) — Richard Riley',
      },
    ],
  },

  {
    artist: 'Arijit Singh',
    artistHandle: 'arijit-singh',
    tourName: 'India Tour 2027',
    genre: 'Bollywood',
    keySongs: ['Tum Hi Ho', 'Kesariya', 'Channa Mereya', 'Ae Dil Hai Mushkil'],
    dates: [
      {
        slug: 'arijit-singh-ahmedabad-january-2027',
        venue: 'TBA',
        city: 'Ahmedabad',
        date: '2027-01-09',
        status: 'upcoming',
        description:
          'Arijit Singh opens his biggest India tour in Ahmedabad, marking 20 years in music. A runway stage takes him deep into the stadium crowd for Tum Hi Ho, Kesariya, and Channa Mereya.',
        image: '/concert-art/arijit-singh-ahmedabad-january-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-chandigarh-january-2027',
        venue: 'TBA',
        city: 'Chandigarh',
        date: '2027-01-23',
        status: 'upcoming',
        description:
          'Arijit Singh brings his 2027 India tour to Chandigarh. Expect Tum Hi Ho, Ae Dil Hai Mushkil, and Kesariya on a stage built to reach far into the crowd.',
        image: '/concert-art/arijit-singh-chandigarh-january-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-jaipur-february-2027',
        venue: 'TBA',
        city: 'Jaipur',
        date: '2027-02-07',
        status: 'upcoming',
        description:
          'Arijit Singh plays Jaipur on his nine-city 2027 India tour. The set spans two decades, from Tum Hi Ho to Kesariya and Channa Mereya.',
        image: '/concert-art/arijit-singh-jaipur-february-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-mumbai-february-2027',
        venue: 'TBA',
        city: 'Mumbai',
        date: '2027-02-20',
        status: 'upcoming',
        description:
          'Arijit Singh performs in Mumbai on his 2027 India tour, his first major run since stepping back from playback singing. Expect Tum Hi Ho, Kesariya, and Ae Dil Hai Mushkil.',
        image: '/concert-art/arijit-singh-mumbai-february-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-bengaluru-march-2027',
        venue: 'TBA',
        city: 'Bengaluru',
        date: '2027-03-13',
        status: 'upcoming',
        description:
          'Arijit Singh brings his 2027 India tour to Bengaluru. A long runway stage puts him close to the crowd for Channa Mereya, Kesariya, and Tum Hi Ho.',
        image: '/concert-art/arijit-singh-bengaluru-march-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-delhi-march-2027',
        venue: 'TBA',
        city: 'Delhi',
        date: '2027-03-27',
        status: 'upcoming',
        description:
          'Arijit Singh plays New Delhi on his nine-city 2027 India tour. Expect Tum Hi Ho, Ae Dil Hai Mushkil, and Kesariya in a stadium-scale show.',
        image: '/concert-art/arijit-singh-delhi-march-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-pune-april-2027',
        venue: 'TBA',
        city: 'Pune',
        date: '2027-04-10',
        status: 'upcoming',
        description:
          'Arijit Singh performs in Pune on his 2027 India tour. The set covers 20 years of songs, including Channa Mereya, Kesariya, and Tum Hi Ho.',
        image: '/concert-art/arijit-singh-pune-april-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-indore-may-2027',
        venue: 'TBA',
        city: 'Indore',
        date: '2027-05-01',
        status: 'upcoming',
        description:
          'Arijit Singh brings his 2027 India tour to Indore. Expect Tum Hi Ho, Kesariya, and Ae Dil Hai Mushkil on a runway stage built into the crowd.',
        image: '/concert-art/arijit-singh-indore-may-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
      {
        slug: 'arijit-singh-hyderabad-may-2027',
        venue: 'TBA',
        city: 'Hyderabad',
        date: '2027-05-15',
        status: 'upcoming',
        description:
          'Arijit Singh closes his nine-city 2027 India tour in Hyderabad. The final show spans Tum Hi Ho, Channa Mereya, and Kesariya.',
        image: '/concert-art/arijit-singh-hyderabad-may-2027.webp',
        imageCredit: 'AI-generated artwork',
      },
    ],
  },
];

/** Flat per-show view of TOURS. Detail pages, the sitemap and city pages read this. */
export const CONCERTS: Concert[] = TOURS.flatMap(({ dates, ...tour }) =>
  dates.map((d) => ({ ...tour, ...d, year: Number(d.date.slice(0, 4)) }))
);

const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

/** Featured first, rumoured (all dates `announced`) last. */
const tourRank = (t: ConcertTour) =>
  t.featured ? 0 : t.dates.every((d) => d.status === 'announced') ? 2 : 1;

/** Tours with their dates sorted; featured first, rumours last, else by first show. */
export function getConcertTours(): ConcertTour[] {
  return TOURS.map((t) => ({ ...t, dates: [...t.dates].sort(byDate) })).sort(
    (a, b) => tourRank(a) - tourRank(b) || byDate(a.dates[0], b.dates[0])
  );
}

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

// Upcoming shows grouped by artist: featured first, then soonest date.
export interface UpcomingArtistConcert {
  artistHandle: string;
  artist: string;
  tourName: string;
  featured: boolean;
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

  const featured = new Set(TOURS.filter((t) => t.featured).map((t) => t.artistHandle));
  const result: UpcomingArtistConcert[] = [];
  for (const [handle, concerts] of artistMap) {
    const sorted = [...concerts].sort(byDate);
    result.push({
      artistHandle: handle,
      artist: sorted[0].artist,
      tourName: sorted[0].tourName,
      featured: featured.has(handle),
      nextShow: sorted[0],
      allUpcoming: sorted,
    });
  }

  return result.sort(
    (a, b) => Number(b.featured) - Number(a.featured) || byDate(a.nextShow, b.nextShow)
  );
}
