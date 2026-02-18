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
}

export const CONCERTS: Concert[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COLDPLAY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'coldplay-ahmedabad-january-2025',
    artist: 'Coldplay',
    artistHandle: 'coldplay',
    tourName: 'Music of the Spheres World Tour',
    venue: 'Narendra Modi Stadium',
    city: 'Ahmedabad',
    date: '2025-01-25',
    year: 2025,
    status: 'completed',
    description:
      'Coldplay brought their spectacular Music of the Spheres World Tour to Ahmedabad at the Narendra Modi Stadium. The show featured their iconic light-up wristbands, stunning visuals, and hits spanning their entire career. YORD India offers exclusive Coldplay-inspired merchandise to commemorate this historic India concert.',
    genre: 'Alternative Rock',
  },
  {
    slug: 'coldplay-mumbai-january-2025',
    artist: 'Coldplay',
    artistHandle: 'coldplay',
    tourName: 'Music of the Spheres World Tour',
    venue: 'DY Patil Stadium',
    city: 'Mumbai',
    date: '2025-01-18',
    year: 2025,
    status: 'completed',
    description:
      'Coldplay performed multiple sold-out shows at DY Patil Stadium in Navi Mumbai as part of the Music of the Spheres World Tour. The concert drew fans from across India, creating an unforgettable night of music and lights.',
    genre: 'Alternative Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DILJIT DOSANJH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'diljit-dosanjh-dil-luminati-delhi-2024',
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Dil-Luminati Tour India',
    venue: 'Jawaharlal Nehru Stadium',
    city: 'Delhi',
    date: '2024-10-26',
    year: 2024,
    status: 'completed',
    description:
      "Diljit Dosanjh kicked off the India leg of his Dil-Luminati Tour at Delhi's JLN Stadium. The concert was a celebration of Punjabi music and culture, featuring elaborate stage design and Diljit's signature high-energy performance.",
    genre: 'Punjabi Pop',
  },
  {
    slug: 'diljit-dosanjh-dil-luminati-mumbai-2024',
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Dil-Luminati Tour India',
    venue: 'Mahalaxmi Racecourse',
    city: 'Mumbai',
    date: '2024-12-19',
    year: 2024,
    status: 'completed',
    description:
      "Diljit Dosanjh's Dil-Luminati Tour hit Mumbai with back-to-back sold-out shows. The Mahalaxmi Racecourse transformed into a Punjabi music paradise.",
    genre: 'Punjabi Pop',
  },
  {
    slug: 'diljit-dosanjh-dil-luminati-bengaluru-2024',
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Dil-Luminati Tour India',
    venue: 'NICE Grounds',
    city: 'Bengaluru',
    date: '2024-12-06',
    year: 2024,
    status: 'completed',
    description:
      'Diljit Dosanjh rocked Bengaluru as part of his blockbuster Dil-Luminati India tour. The Garden City witnessed one of the biggest Punjabi concerts ever.',
    genre: 'Punjabi Pop',
  },
  {
    slug: 'diljit-dosanjh-dil-luminati-chandigarh-2024',
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Dil-Luminati Tour India',
    venue: 'Sector 34 Exhibition Ground',
    city: 'Chandigarh',
    date: '2024-12-14',
    year: 2024,
    status: 'completed',
    description:
      "Diljit Dosanjh returned to his home turf of Chandigarh for a massive homecoming show. The Dil-Luminati Tour's Chandigarh stop was one of the most emotionally charged concerts of the tour.",
    genre: 'Punjabi Pop',
  },
  {
    slug: 'diljit-dosanjh-dil-luminati-guwahati-2025',
    artist: 'Diljit Dosanjh',
    artistHandle: 'diljit-dosanjh',
    tourName: 'Dil-Luminati Tour India',
    venue: 'Sarusajai Stadium',
    city: 'Guwahati',
    date: '2025-01-18',
    year: 2025,
    status: 'completed',
    description:
      "Diljit Dosanjh's Dil-Luminati Tour reached Guwahati, marking a milestone for major concert events in Northeast India.",
    genre: 'Punjabi Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KARAN AUJLA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'karan-aujla-it-was-all-a-dream-delhi-2024',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'It Was All A Dream Tour India',
    venue: 'Jawaharlal Nehru Stadium',
    city: 'Delhi',
    date: '2024-12-07',
    year: 2024,
    status: 'completed',
    description:
      "Karan Aujla's It Was All A Dream Tour arrived at Delhi's JLN Stadium. The Tauba Tauba hitmaker delivered a powerhouse performance with his biggest Punjabi anthems.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-it-was-all-a-dream-mumbai-2024',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'It Was All A Dream Tour India',
    venue: 'MMRDA Grounds',
    city: 'Mumbai',
    date: '2024-12-21',
    year: 2024,
    status: 'completed',
    description:
      "Karan Aujla performed at MMRDA Grounds in Mumbai as part of his India tour. The concert featured tracks from his album 'Making Memories'.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-it-was-all-a-dream-chandigarh-2024',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'It Was All A Dream Tour India',
    venue: 'Exhibition Ground Sector 34',
    city: 'Chandigarh',
    date: '2024-12-13',
    year: 2024,
    status: 'completed',
    description:
      "Karan Aujla brought the house down in Chandigarh with his It Was All A Dream Tour, performing fan favorites and new releases.",
    genre: 'Punjabi Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ED SHEERAN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'ed-sheeran-mathematics-tour-mumbai-2024',
    artist: 'Ed Sheeran',
    artistHandle: 'ed-sheeran',
    tourName: 'Mathematics Tour',
    venue: 'Mahalaxmi Racecourse',
    city: 'Mumbai',
    date: '2024-03-16',
    year: 2024,
    status: 'completed',
    description:
      "Ed Sheeran performed his Mathematics Tour in Mumbai at the Mahalaxmi Racecourse. The British singer-songwriter delivered an intimate yet massive acoustic-driven show.",
    genre: 'Pop',
  },
  {
    slug: 'ed-sheeran-india-tour-2025',
    artist: 'Ed Sheeran',
    artistHandle: 'ed-sheeran',
    tourName: 'India Tour 2025',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-02-01',
    year: 2025,
    status: 'completed',
    description:
      "Ed Sheeran returned to India in 2025 for a multi-city tour, performing at major venues in Mumbai and other cities. The Sheerios came out in full force.",
    genre: 'Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BRYAN ADAMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'bryan-adams-so-happy-it-hurts-delhi-2025',
    artist: 'Bryan Adams',
    artistHandle: 'bryan-adams',
    tourName: 'So Happy It Hurts Tour',
    venue: 'Leisure Valley Ground',
    city: 'Delhi',
    date: '2025-01-17',
    year: 2025,
    status: 'completed',
    description:
      "Bryan Adams brought his So Happy It Hurts Tour to Delhi, performing classic rock anthems like Summer of '69 and (Everything I Do) I Do It For You.",
    genre: 'Rock',
  },
  {
    slug: 'bryan-adams-so-happy-it-hurts-mumbai-2025',
    artist: 'Bryan Adams',
    artistHandle: 'bryan-adams',
    tourName: 'So Happy It Hurts Tour',
    venue: 'MMRDA Grounds',
    city: 'Mumbai',
    date: '2025-01-20',
    year: 2025,
    status: 'completed',
    description:
      "Bryan Adams rocked Mumbai with a high-energy show at MMRDA Grounds. The Canadian rock legend delivered a career-spanning setlist.",
    genre: 'Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DUA LIPA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'dua-lipa-mumbai-2024',
    artist: 'Dua Lipa',
    artistHandle: 'dua-lipa',
    tourName: 'India Concert',
    venue: 'MMRDA Grounds',
    city: 'Mumbai',
    date: '2024-11-30',
    year: 2024,
    status: 'completed',
    description:
      'Dua Lipa performed a spectacular concert in Mumbai, featuring hits from Future Nostalgia and Radical Optimism. Her energetic performance and stunning stage production captivated thousands of Indian fans.',
    genre: 'Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GREEN DAY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'green-day-saviors-tour-india-2025',
    artist: 'Green Day',
    artistHandle: 'green-day',
    tourName: 'Saviors Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-03-01',
    year: 2025,
    status: 'completed',
    description:
      "Green Day brought punk rock to India with their Saviors Tour. The band performed classic anthems like American Idiot and Boulevard of Broken Dreams alongside tracks from their latest album.",
    genre: 'Punk Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MAROON 5
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'maroon-5-india-2025',
    artist: 'Maroon 5',
    artistHandle: 'maroon-5',
    tourName: 'India Concert',
    venue: 'Mahalaxmi Racecourse',
    city: 'Mumbai',
    date: '2025-03-08',
    year: 2025,
    status: 'completed',
    description:
      "Maroon 5 headlined a massive concert in Mumbai, performing chart-toppers like Sugar, Moves Like Jagger, and Payphone. Adam Levine and the band electrified the Indian crowd.",
    genre: 'Pop Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LINKIN PARK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'linkin-park-from-zero-india-2025',
    artist: 'Linkin Park',
    artistHandle: 'linkin-park',
    tourName: 'From Zero World Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-02-15',
    year: 2025,
    status: 'completed',
    description:
      "Linkin Park returned to India with their From Zero World Tour, featuring new vocalist Emily Armstrong. The band performed beloved classics alongside new material from their comeback album.",
    genre: 'Alternative Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AP DHILLON
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'ap-dhillon-brownprint-india-2024',
    artist: 'AP Dhillon',
    artistHandle: 'ap-dhillon',
    tourName: 'The Brownprint Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2024-12-07',
    year: 2024,
    status: 'completed',
    description:
      "AP Dhillon's The Brownprint Tour brought his Indo-Canadian fusion sound to India. The tour covered multiple cities including Mumbai, Delhi, Chandigarh, and Bengaluru.",
    genre: 'Punjabi Pop',
  },
  {
    slug: 'ap-dhillon-brownprint-delhi-2024',
    artist: 'AP Dhillon',
    artistHandle: 'ap-dhillon',
    tourName: 'The Brownprint Tour',
    venue: 'Jawaharlal Nehru Stadium',
    city: 'Delhi',
    date: '2024-12-14',
    year: 2024,
    status: 'completed',
    description:
      "AP Dhillon performed at JLN Stadium in Delhi as part of The Brownprint Tour. The Excuses hitmaker delivered a high-energy set of Punjabi-English fusion tracks.",
    genre: 'Punjabi Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALAN WALKER
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'alan-walker-india-tour-2025',
    artist: 'Alan Walker',
    artistHandle: 'alan-walker',
    tourName: 'Walkerverse Tour',
    venue: 'Multiple Venues',
    city: 'Bengaluru',
    date: '2025-02-22',
    year: 2025,
    status: 'completed',
    description:
      "Alan Walker brought his signature masked EDM experience to India. Performing hits like Faded, Alone, and Darkside, the Norwegian DJ electrified venues across the country.",
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // YO YO HONEY SINGH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'honey-singh-glory-tour-india-2025',
    artist: 'Yo Yo Honey Singh',
    artistHandle: 'honey-singh',
    tourName: 'Glory Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-04-15',
    year: 2025,
    status: 'upcoming',
    description:
      "Yo Yo Honey Singh is touring India with his Glory Tour, performing chart-toppers from his comeback era including Millionaire and Kalaastar alongside classics like Brown Rang and Blue Eyes.",
    genre: 'Punjabi Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARIJIT SINGH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'arijit-singh-india-tour-2025',
    artist: 'Arijit Singh',
    artistHandle: 'arijit-singh',
    tourName: 'India Live Concert Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-03-22',
    year: 2025,
    status: 'upcoming',
    description:
      "Arijit Singh, India's most beloved playback singer, continues to perform sold-out concerts across the country. His live shows feature his greatest hits including Tum Hi Ho, Channa Mereya, and Kesariya.",
    genre: 'Bollywood',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOLLAPALOOZA INDIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'lollapalooza-india-mumbai-2025',
    artist: 'Lollapalooza India',
    artistHandle: 'lollapalooza-india',
    tourName: 'Lollapalooza India 2025',
    venue: 'Mahalaxmi Racecourse',
    city: 'Mumbai',
    date: '2025-03-08',
    year: 2025,
    status: 'completed',
    description:
      "Lollapalooza India returned to Mumbai for its third edition, bringing a diverse lineup of international and Indian artists. The two-day festival at Mahalaxmi Racecourse featured multiple stages and genres.",
    genre: 'Multi-Genre Festival',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHAWN MENDES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'shawn-mendes-india-2025',
    artist: 'Shawn Mendes',
    artistHandle: 'shawn-mendes',
    tourName: 'India Concert',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-04-01',
    year: 2025,
    status: 'upcoming',
    description:
      "Shawn Mendes is bringing his intimate acoustic-driven performance to India. The Canadian singer-songwriter will perform hits like Stitches, Señorita, and tracks from his latest album.",
    genre: 'Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HANUMANKIND
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'hanumankind-big-dawgs-tour-india-2025',
    artist: 'Hanumankind',
    artistHandle: 'hanumankind',
    tourName: 'Big Dawgs India Tour',
    venue: 'Multiple Venues',
    city: 'Bengaluru',
    date: '2025-02-28',
    year: 2025,
    status: 'upcoming',
    description:
      "Hanumankind, the viral sensation behind Big Dawgs, is touring India with high-energy hip-hop shows. The Bengaluru-based rapper has become one of India's most talked-about hip-hop acts.",
    genre: 'Indian Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KRSNA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'krsna-india-live-2025',
    artist: 'KRSNA',
    artistHandle: 'krsna',
    tourName: 'India Live Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-03-15',
    year: 2025,
    status: 'upcoming',
    description:
      "KRSNA, one of India's top hip-hop lyricists, is performing live across India. Known for his technical rap skills and viral diss tracks, KRSNA draws massive crowds at every show.",
    genre: 'Indian Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUNS N' ROSES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'guns-n-roses-india-2024',
    artist: "Guns N' Roses",
    artistHandle: 'guns-and-roses',
    tourName: 'India Concert',
    venue: 'Mahalaxmi Racecourse',
    city: 'Mumbai',
    date: '2024-11-15',
    year: 2024,
    status: 'completed',
    description:
      "Guns N' Roses brought their legendary rock show to Mumbai. Axl Rose, Slash, and Duff McKagan performed classics like Sweet Child O' Mine, Welcome to the Jungle, and Paradise City.",
    genre: 'Hard Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CIGARETTES AFTER SEX
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'cigarettes-after-sex-india-2025',
    artist: 'Cigarettes After Sex',
    artistHandle: 'cigarettes-after-sex',
    tourName: 'India Tour',
    venue: 'Multiple Venues',
    city: 'Bengaluru',
    date: '2025-02-10',
    year: 2025,
    status: 'completed',
    description:
      "Cigarettes After Sex performed in India as part of their world tour. The ambient pop band delivered dreamy, atmospheric performances of hits like Apocalypse and K.",
    genre: 'Dream Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGINE DRAGONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'imagine-dragons-india-2025',
    artist: 'Imagine Dragons',
    artistHandle: 'imagine-dragons',
    tourName: 'India Concert',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-04-20',
    year: 2025,
    status: 'upcoming',
    description:
      "Imagine Dragons are set to perform in India, bringing their arena-rock anthems like Believer, Radioactive, and Thunder to Indian audiences.",
    genre: 'Pop Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOUIS TOMLINSON
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'louis-tomlinson-india-2025',
    artist: 'Louis Tomlinson',
    artistHandle: 'louis-tomlinson',
    tourName: 'India Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-01-25',
    year: 2025,
    status: 'completed',
    description:
      "Louis Tomlinson, former One Direction member, performed in India as part of his solo world tour. Fans enjoyed a mix of his solo hits and One Direction classics.",
    genre: 'Pop Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DIVINE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'divine-india-tour-2025',
    artist: 'DIVINE',
    artistHandle: 'divine',
    tourName: 'Gunehgar Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-04-05',
    year: 2025,
    status: 'upcoming',
    description:
      "DIVINE, the Gully Boy who put Indian hip-hop on the global map, continues to tour India. The pioneer of Mumbai's street rap scene performs his biggest hits live.",
    genre: 'Indian Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEEDHE MAUT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'seedhe-maut-nayaab-tour-india-2025',
    artist: 'Seedhe Maut',
    artistHandle: 'seedhe-maut',
    tourName: 'Nayaab Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-03-29',
    year: 2025,
    status: 'upcoming',
    description:
      "Seedhe Maut, India's most acclaimed hip-hop duo, are touring India with their Nayaab Tour. Encore ABJ and Calm deliver electrifying live performances of their intricate rap flows.",
    genre: 'Indian Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRATEEK KUHAD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'prateek-kuhad-india-tour-2025',
    artist: 'Prateek Kuhad',
    artistHandle: 'prateek-kuhad',
    tourName: 'India Indie Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-05-10',
    year: 2025,
    status: 'upcoming',
    description:
      "Prateek Kuhad, India's indie-folk sensation endorsed by Barack Obama, performs his intimate acoustic shows across India. Known for Cold/Mess and Kasoor.",
    genre: 'Indie Folk',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUNBURN FESTIVAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'sunburn-festival-goa-2025',
    artist: 'Sunburn Festival',
    artistHandle: 'sunburn-festival',
    tourName: 'Sunburn Festival 2025',
    venue: 'Vagator Beach',
    city: 'Goa',
    date: '2025-12-28',
    year: 2025,
    status: 'announced',
    description:
      "Sunburn Festival, Asia's largest EDM festival, returns to Goa for another year of electronic music. The festival features international and Indian DJs across multiple stages.",
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NH7 WEEKENDER
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'nh7-weekender-pune-2025',
    artist: 'NH7 Weekender',
    artistHandle: 'nh7-weekender',
    tourName: 'NH7 Weekender 2025',
    venue: 'Multiple Stages',
    city: 'Pune',
    date: '2025-11-15',
    year: 2025,
    status: 'announced',
    description:
      "NH7 Weekender, India's happiest music festival, returns with a diverse lineup spanning indie, rock, electronic, hip-hop, and Bollywood. Multiple stages showcase the best of Indian and international music.",
    genre: 'Multi-Genre Festival',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'king-india-tour-2025',
    artist: 'King',
    artistHandle: 'king',
    tourName: 'Champagne Talk Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-06-15',
    year: 2025,
    status: 'announced',
    description:
      "King, India's pop sensation known for Maan Meri Jaan, tours India with his Champagne Talk Tour. The singer-songwriter has become one of India's biggest music stars.",
    genre: 'Indian Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANUV JAIN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'anuv-jain-india-tour-2025',
    artist: 'Anuv Jain',
    artistHandle: 'anuv-jain',
    tourName: 'India Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-05-20',
    year: 2025,
    status: 'announced',
    description:
      "Anuv Jain, the indie sensation behind Baarishein and Husn, is touring India. His soulful Hindi indie-pop has built a massive following among young Indian music lovers.",
    genre: 'Indie Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MC STAN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'mc-stan-india-tour-2025',
    artist: 'MC Stan',
    artistHandle: 'mc-stan',
    tourName: 'India Live Tour',
    venue: 'Multiple Venues',
    city: 'Pune',
    date: '2025-04-25',
    year: 2025,
    status: 'upcoming',
    description:
      "MC Stan, the Bigg Boss winner and hip-hop star from Pune, tours India with his raw street rap. Known for Insaan and Amin, he brings intense energy to every show.",
    genre: 'Indian Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BADSHAH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'badshah-india-tour-2025',
    artist: 'Badshah',
    artistHandle: 'badshah',
    tourName: 'India Tour 2025',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-06-01',
    year: 2025,
    status: 'announced',
    description:
      "Badshah, one of India's highest-selling music artists, tours the country performing hits like Paagal, DJ Waale Babu, and Kala Chashma. His live shows are known for massive production and crowd energy.",
    genre: 'Bollywood Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RAFTAAR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'raftaar-india-tour-2025',
    artist: 'Raftaar',
    artistHandle: 'raftaar',
    tourName: 'India Tour 2025',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-05-05',
    year: 2025,
    status: 'announced',
    description:
      "Raftaar, the rap heavyweight behind Swag Mera Desi and numerous Bollywood hits, continues to be one of India's most in-demand live performers.",
    genre: 'Indian Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARTIN GARRIX
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'martin-garrix-india-2025',
    artist: 'Martin Garrix',
    artistHandle: 'martin-garrix',
    tourName: 'India DJ Set',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-03-15',
    year: 2025,
    status: 'upcoming',
    description:
      "Martin Garrix, one of the world's top DJs, performs his explosive EDM sets in India. Known for Animals, Scared to Be Lonely, and In the Name of Love.",
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOLLAPALOOZA INDIA 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'lollapalooza-india-mumbai-2026',
    artist: 'Lollapalooza India',
    artistHandle: 'lollapalooza-india',
    tourName: 'Lollapalooza India 2026',
    venue: 'Mahalaxmi Race Course',
    city: 'Mumbai',
    date: '2026-01-24',
    year: 2026,
    status: 'completed',
    description:
      "Lollapalooza India 2026 returned to Mumbai's Mahalaxmi Race Course on January 24–25 for its fourth edition. The two-day festival featured a massive lineup headlined by Linkin Park, Playboi Carti, YUNGBLUD, Kehlani, Fujii Kaze, and LANY, alongside top Indian and international acts across multiple stages.",
    genre: 'Multi-Genre Festival',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LINKIN PARK — 2026 Standalone
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'linkin-park-bengaluru-january-2026',
    artist: 'Linkin Park',
    artistHandle: 'linkin-park',
    tourName: 'Standalone Show',
    venue: 'Brigade Innovation Gardens',
    city: 'Bengaluru',
    date: '2026-01-23',
    year: 2026,
    status: 'completed',
    description:
      'Linkin Park performed a standalone show at Brigade Innovation Gardens in Bengaluru on January 23, 2026, separate from their Lollapalooza India headlining set. Fans experienced the full From Zero era energy with new vocalist Emily Armstrong alongside classic nu-metal anthems.',
    genre: 'Alternative Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIËSTO — India Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'tiesto-mumbai-january-2026',
    artist: 'Tiësto',
    artistHandle: 'tiesto',
    tourName: 'India Tour 2026',
    venue: 'NSCI Dome',
    city: 'Mumbai',
    date: '2026-01-23',
    year: 2026,
    status: 'completed',
    description:
      "Tiësto kicked off his India Tour 2026 at Mumbai's NSCI Dome. The Dutch DJ legend delivered a high-energy set spanning trance, progressive, and dance-pop hits including Red Lights, The Business, and 10:35.",
    genre: 'EDM',
  },
  {
    slug: 'tiesto-delhi-january-2026',
    artist: 'Tiësto',
    artistHandle: 'tiesto',
    tourName: 'India Tour 2026',
    venue: 'JLN Grounds',
    city: 'Delhi',
    date: '2026-01-24',
    year: 2026,
    status: 'completed',
    description:
      'Tiësto performed in Delhi NCR at JLN Grounds as part of his India Tour 2026. The trance and EDM icon brought his signature sound to the capital city.',
    genre: 'EDM',
  },
  {
    slug: 'tiesto-kolkata-january-2026',
    artist: 'Tiësto',
    artistHandle: 'tiesto',
    tourName: 'India Tour 2026',
    venue: 'Aquatica Ground',
    city: 'Kolkata',
    date: '2026-01-25',
    year: 2026,
    status: 'completed',
    description:
      'Tiësto wrapped up his India Tour 2026 with a show at Aquatica Ground in Kolkata. The city witnessed one of the biggest EDM events in its history.',
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DREAM THEATER — 40th Anniversary Tour
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'dream-theater-bengaluru-january-2026',
    artist: 'Dream Theater',
    artistHandle: 'dream-theater',
    tourName: '40th Anniversary Tour',
    venue: 'Phoenix Marketcity Back Arena',
    city: 'Bengaluru',
    date: '2026-01-30',
    year: 2026,
    status: 'completed',
    description:
      "Dream Theater brought their 40th Anniversary Tour to Bengaluru's Phoenix Marketcity Back Arena. The progressive metal legends performed career-spanning material featuring complex musicianship and orchestral arrangements.",
    genre: 'Progressive Metal',
  },
  {
    slug: 'dream-theater-kolkata-february-2026',
    artist: 'Dream Theater',
    artistHandle: 'dream-theater',
    tourName: '40th Anniversary Tour',
    venue: 'Aquatica Ground',
    city: 'Kolkata',
    date: '2026-02-01',
    year: 2026,
    status: 'completed',
    description:
      "Dream Theater performed their 40th Anniversary Tour at Kolkata's Aquatica Ground. The progressive metal icons delivered an epic show celebrating four decades of technical mastery.",
    genre: 'Progressive Metal',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LUMINEERS — Automatic World Tour
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'the-lumineers-gurugram-february-2026',
    artist: 'The Lumineers',
    artistHandle: 'the-lumineers',
    tourName: 'Automatic World Tour',
    venue: 'Huda Ground',
    city: 'Delhi',
    date: '2026-02-01',
    year: 2026,
    status: 'completed',
    description:
      "The Lumineers performed at Huda Ground in Gurugram (Delhi NCR) as part of their Automatic World Tour. The folk-rock band delivered an intimate, anthemic set featuring Ho Hey, Ophelia, and Stubborn Love.",
    genre: 'Folk Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DJ SNAKE — India Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'dj-snake-kolkata-february-2026',
    artist: 'DJ Snake',
    artistHandle: 'dj-snake',
    tourName: 'India Tour 2026',
    venue: 'TBA',
    city: 'Kolkata',
    date: '2026-02-06',
    year: 2026,
    status: 'completed',
    description:
      "DJ Snake kicked off his massive six-city India Tour 2026 in Kolkata. The French DJ and producer known for Turn Down for What, Lean On, and Taki Taki delivered an electrifying EDM set.",
    genre: 'EDM',
  },
  {
    slug: 'dj-snake-hyderabad-february-2026',
    artist: 'DJ Snake',
    artistHandle: 'dj-snake',
    tourName: 'India Tour 2026',
    venue: 'TBA',
    city: 'Hyderabad',
    date: '2026-02-07',
    year: 2026,
    status: 'completed',
    description:
      'DJ Snake performed in Hyderabad as part of his India Tour 2026, bringing his explosive EDM production and chart-topping hits to the city.',
    genre: 'EDM',
  },
  {
    slug: 'dj-snake-bengaluru-february-2026',
    artist: 'DJ Snake',
    artistHandle: 'dj-snake',
    tourName: 'India Tour 2026',
    venue: 'TBA',
    city: 'Bengaluru',
    date: '2026-02-08',
    year: 2026,
    status: 'completed',
    description:
      "DJ Snake's India Tour 2026 hit Bengaluru with a high-energy set. The Magenta Riddim and Let Me Love You hitmaker had the crowd going all night.",
    genre: 'EDM',
  },
  {
    slug: 'john-mayer-mumbai-february-2026',
    artist: 'John Mayer',
    artistHandle: 'john-mayer',
    tourName: 'India Debut — Solo',
    venue: 'Mahalaxmi Race Course',
    city: 'Mumbai',
    date: '2026-02-11',
    year: 2026,
    status: 'completed',
    description:
      "John Mayer made his long-awaited India debut with a solo performance at Mumbai's Mahalaxmi Race Course on February 11, 2026. The Grammy-winning singer-songwriter and guitarist performed Gravity, Slow Dancing in a Burning Room, Waiting on the World to Change, and more in a historic evening for Indian music fans.",
    genre: 'Blues Rock',
  },
  {
    slug: 'dj-snake-pune-february-2026',
    artist: 'DJ Snake',
    artistHandle: 'dj-snake',
    tourName: 'India Tour 2026',
    venue: 'TBA',
    city: 'Pune',
    date: '2026-02-13',
    year: 2026,
    status: 'completed',
    description:
      'DJ Snake brought his India Tour 2026 to Pune, delivering another night of bass-heavy EDM bangers.',
    genre: 'EDM',
  },
  {
    slug: 'dj-snake-mumbai-february-2026',
    artist: 'DJ Snake',
    artistHandle: 'dj-snake',
    tourName: 'India Tour 2026',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2026-02-14',
    year: 2026,
    status: 'completed',
    description:
      "DJ Snake's Valentine's Day show in Mumbai was a highlight of his India Tour 2026. The French DJ packed the venue for a special night of electronic music.",
    genre: 'EDM',
  },
  {
    slug: 'dj-snake-delhi-february-2026',
    artist: 'DJ Snake',
    artistHandle: 'dj-snake',
    tourName: 'India Tour 2026',
    venue: 'TBA',
    city: 'Delhi',
    date: '2026-02-15',
    year: 2026,
    status: 'completed',
    description:
      'DJ Snake closed his India Tour 2026 with a show in Delhi NCR. The six-city tour cemented his status as one of the most popular EDM acts in India.',
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KARAN AUJLA — P-Pop Culture World Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'karan-aujla-ppop-delhi-february-2026',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'P-Pop Culture World Tour',
    venue: 'Jawaharlal Nehru Stadium',
    city: 'Delhi',
    date: '2026-02-28',
    year: 2026,
    status: 'upcoming',
    description:
      "Karan Aujla kicks off the India leg of his P-Pop Culture World Tour at Delhi's Jawaharlal Nehru Stadium. The Softly hitmaker brings a stadium-sized production for his biggest India tour yet.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-ppop-mumbai-march-2026',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'P-Pop Culture World Tour',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2026-03-04',
    year: 2026,
    status: 'upcoming',
    description:
      "Karan Aujla brings his P-Pop Culture World Tour to Mumbai. The Tauba Tauba and Softly hitmaker's Mumbai show is expected to be one of the biggest Punjabi concerts the city has seen.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-ppop-pune-march-2026',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'P-Pop Culture World Tour',
    venue: 'TBA',
    city: 'Pune',
    date: '2026-03-04',
    year: 2026,
    status: 'upcoming',
    description:
      "Karan Aujla's P-Pop Culture World Tour stops in Pune. Fans can expect a high-energy performance of his biggest Punjabi hits.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-ppop-chandigarh-march-2026',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'P-Pop Culture World Tour',
    venue: 'I.S. Bindra Punjab Cricket Association Stadium',
    city: 'Chandigarh',
    date: '2026-03-14',
    year: 2026,
    status: 'upcoming',
    description:
      "Karan Aujla performs in Chandigarh at the I.S. Bindra Punjab Cricket Association Stadium for a massive homecoming show on his P-Pop Culture World Tour. Punjab's own superstar returns to his roots.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-ppop-indore-march-2026',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'P-Pop Culture World Tour',
    venue: 'TBA',
    city: 'Indore',
    date: '2026-03-21',
    year: 2026,
    status: 'upcoming',
    description:
      "Karan Aujla's P-Pop Culture World Tour reaches Indore, bringing Punjabi hip-hop to Central India.",
    genre: 'Punjabi Hip-Hop',
  },
  {
    slug: 'karan-aujla-ppop-bengaluru-march-2026',
    artist: 'Karan Aujla',
    artistHandle: 'karan-aujla',
    tourName: 'P-Pop Culture World Tour',
    venue: 'TBA',
    city: 'Bengaluru',
    date: '2026-03-29',
    year: 2026,
    status: 'upcoming',
    description:
      "Karan Aujla wraps the India leg of his P-Pop Culture World Tour in Bengaluru. The Garden City gets a taste of Punjab's biggest hip-hop star.",
    genre: 'Punjabi Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHEMOTH — Chant of the Eastern Lands Tour
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'behemoth-india-march-2026',
    artist: 'Behemoth',
    artistHandle: 'behemoth',
    tourName: 'Chant of the Eastern Lands Tour',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2026-03-03',
    year: 2026,
    status: 'upcoming',
    description:
      "Behemoth brings their Chant of the Eastern Lands Tour to India. The legendary Polish extreme metal band delivers their signature blend of blackened death metal with theatrical stage production.",
    genre: 'Extreme Metal',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEF LEPPARD — India Tour 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'def-leppard-shillong-march-2026',
    artist: 'Def Leppard',
    artistHandle: 'def-leppard',
    tourName: 'India Tour 2026',
    venue: 'JLN Stadium (Polo Ground)',
    city: 'Shillong',
    date: '2026-03-25',
    year: 2026,
    status: 'upcoming',
    description:
      "Def Leppard opens their India Tour 2026 in Shillong — the 'Rock Capital of India'. The British rock legends perform at JLN Stadium (Polo Ground), bringing Pour Some Sugar on Me, Hysteria, and Animal to Northeast India.",
    genre: 'Hard Rock',
  },
  {
    slug: 'def-leppard-mumbai-march-2026',
    artist: 'Def Leppard',
    artistHandle: 'def-leppard',
    tourName: 'India Tour 2026',
    venue: 'Jio World Garden',
    city: 'Mumbai',
    date: '2026-03-27',
    year: 2026,
    status: 'upcoming',
    description:
      "Def Leppard performs at Mumbai's Jio World Garden as part of their India Tour 2026. The multi-platinum rock band brings their iconic arena rock sound to India's entertainment capital.",
    genre: 'Hard Rock',
  },
  {
    slug: 'def-leppard-bengaluru-march-2026',
    artist: 'Def Leppard',
    artistHandle: 'def-leppard',
    tourName: 'India Tour 2026',
    venue: 'NICE Grounds',
    city: 'Bengaluru',
    date: '2026-03-29',
    year: 2026,
    status: 'upcoming',
    description:
      "Def Leppard closes their India Tour 2026 at Bengaluru's NICE Grounds. The Rock & Roll Hall of Famers deliver a career-spanning setlist of '80s rock anthems.",
    genre: 'Hard Rock',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KEINEMUSIK — India 2026
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'keinemusik-mumbai-march-2026',
    artist: 'Keinemusik',
    artistHandle: 'keinemusik',
    tourName: 'India Tour 2026',
    venue: 'Mahalaxmi Race Course',
    city: 'Mumbai',
    date: '2026-03-27',
    year: 2026,
    status: 'upcoming',
    description:
      "Keinemusik (&ME, Adam Port, Rampa) brings their boundary-pushing house and techno sound to Mumbai's Mahalaxmi Race Course. The Berlin-based collective is known for their genre-blending DJ sets and Coachella-headlining performances.",
    genre: 'House / Techno',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // YE (KANYE WEST) — India Debut
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'kanye-west-delhi-march-2026',
    artist: 'Ye (Kanye West)',
    artistHandle: 'kanye-west',
    tourName: 'India Debut',
    venue: 'Jawaharlal Nehru Stadium',
    city: 'Delhi',
    date: '2026-03-29',
    year: 2026,
    status: 'upcoming',
    description:
      "Ye (Kanye West) makes his long-awaited India debut at Delhi's Jawaharlal Nehru Stadium on March 29, 2026. One of the most influential artists of the 21st century brings Stronger, Gold Digger, Runaway, and his genre-defining discography to Indian audiences for the first time.",
    genre: 'Hip-Hop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CALVIN HARRIS — India Debut
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'calvin-harris-bengaluru-april-2026',
    artist: 'Calvin Harris',
    artistHandle: 'calvin-harris',
    tourName: 'India Debut',
    venue: 'Embassy International Riding School',
    city: 'Bengaluru',
    date: '2026-04-17',
    year: 2026,
    status: 'upcoming',
    description:
      "Calvin Harris kicks off his India Debut tour in Bengaluru at the Embassy International Riding School. The world's highest-paid DJ brings Summer, Feel So Close, One Kiss, and This Is What You Came For to India for the first time.",
    genre: 'EDM',
  },
  {
    slug: 'calvin-harris-mumbai-april-2026',
    artist: 'Calvin Harris',
    artistHandle: 'calvin-harris',
    tourName: 'India Debut',
    venue: 'Infinity Bay, Sewri',
    city: 'Mumbai',
    date: '2026-04-18',
    year: 2026,
    status: 'upcoming',
    description:
      "Calvin Harris performs at Mumbai's Infinity Bay in Sewri as part of his India Debut. The Scottish DJ-producer's first-ever Mumbai show promises a landmark night for Indian EDM fans.",
    genre: 'EDM',
  },
  {
    slug: 'calvin-harris-delhi-april-2026',
    artist: 'Calvin Harris',
    artistHandle: 'calvin-harris',
    tourName: 'India Debut',
    venue: 'Leisure Valley Ground',
    city: 'Delhi',
    date: '2026-04-19',
    year: 2026,
    status: 'upcoming',
    description:
      "Calvin Harris wraps his India Debut tour at Leisure Valley Ground in Delhi NCR. The three-city tour marks a milestone for EDM culture in India.",
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RUMOURED / UNCONFIRMED — 2026
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
  },
  {
    slug: 'fred-again-india-2026',
    artist: 'Fred Again..',
    artistHandle: 'fred-again',
    tourName: 'India Debut (Rumoured)',
    venue: 'TBA',
    city: 'Mumbai',
    date: '2026-11-01',
    year: 2026,
    status: 'announced',
    description:
      "Fred Again.. is rumoured to be making his India debut in late 2026, possibly November. The British DJ-producer behind Marea, Leavemealone, and Delilah (pull me out of this) has become one of the most in-demand live electronic acts globally.",
    genre: 'Electronic',
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
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUNBURN 2026
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
    status: 'announced',
    description:
      "Sunburn Festival 2026 is expected to return to Goa, continuing its legacy as Asia's biggest electronic dance music festival.",
    genre: 'EDM',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GLASS ANIMALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'glass-animals-india-2025',
    artist: 'Glass Animals',
    artistHandle: 'glass-animals',
    tourName: 'India Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-02-05',
    year: 2025,
    status: 'completed',
    description:
      "Glass Animals performed in India, bringing their psychedelic pop sound and the viral hit Heat Waves to Indian audiences. The Oxford band delivered a mesmerizing live show.",
    genre: 'Indie Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JACKSON WANG
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'jackson-wang-india-2025',
    artist: 'Jackson Wang',
    artistHandle: 'jackson-wang',
    tourName: 'Magic Man Tour',
    venue: 'Multiple Venues',
    city: 'Mumbai',
    date: '2025-03-20',
    year: 2025,
    status: 'upcoming',
    description:
      "Jackson Wang, the K-pop star and TEAM WANG founder, brings his Magic Man Tour to India. Known for his fusion of K-pop, hip-hop, and R&B.",
    genre: 'K-Pop',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NUCLEYA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'nucleya-india-tour-2025',
    artist: 'Nucleya',
    artistHandle: 'nucleya',
    tourName: 'Bass Rani Tour',
    venue: 'Multiple Venues',
    city: 'Delhi',
    date: '2025-04-12',
    year: 2025,
    status: 'upcoming',
    description:
      "Nucleya, India's bass music pioneer, tours the country with his signature fusion of bass, hip-hop, and Indian folk. Known for Laung Gawacha and Bass Rani.",
    genre: 'Bass Music',
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
