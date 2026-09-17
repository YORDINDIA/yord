export interface City {
  slug: string;
  name: string;
  state: string;
  description: string;
  venues: string[];
}

export const CITIES: City[] = [
  {
    slug: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    description:
      "Mumbai is India's entertainment capital and the country's biggest concert destination. Major venues include DY Patil Stadium, MMRDA Grounds, Mahalaxmi Racecourse, and NESCO Centre. The city hosts international acts, Bollywood concerts, and music festivals like Lollapalooza India.",
    venues: ['DY Patil Stadium', 'MMRDA Grounds', 'Mahalaxmi Race Course', 'NESCO Centre', 'Jio World Convention Centre', 'NSCI Dome', 'Jio World Garden', 'Infinity Bay, Sewri'],
  },
  {
    slug: 'delhi',
    name: 'Delhi',
    state: 'Delhi NCR',
    description:
      "Delhi NCR is one of India's top concert destinations, hosting major international and Indian artists. Key venues include Jawaharlal Nehru Stadium, Leisure Valley Ground in Gurugram, and India Gate Lawns. The city has a thriving indie and hip-hop scene.",
    venues: ['Jawaharlal Nehru Stadium', 'Leisure Valley Ground', 'Thyagaraj Stadium', 'India Expo Mart', 'JLN Grounds', 'Huda Ground'],
  },
  {
    slug: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    description:
      "Bengaluru, India's Silicon Valley, has a vibrant live music scene. The city hosts international tours, indie festivals, and EDM events at venues like NICE Grounds, Palace Grounds, and Phoenix Marketcity.",
    venues: ['NICE Grounds', 'Palace Grounds', 'Phoenix Marketcity', 'Jayamahal Palace', 'Brigade Innovation Gardens', 'Embassy International Riding School'],
  },
  {
    slug: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    description:
      "Hyderabad's growing concert scene attracts major Indian and international artists. Key venues include Hitex Exhibition Centre, GMR Arena, and LB Stadium.",
    venues: ['Hitex Exhibition Centre', 'GMR Arena', 'LB Stadium'],
  },
  {
    slug: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    description:
      "Chennai has a rich musical heritage and hosts concerts ranging from Carnatic music to international pop and rock at venues like YMCA Grounds and Trade Centre.",
    venues: ['YMCA Grounds', 'Trade Centre', 'Nehru Indoor Stadium'],
  },
  {
    slug: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    description:
      "Kolkata, the cultural capital of India, hosts concerts and music festivals at venues like Eco Park, Salt Lake Stadium, and Science City Auditorium.",
    venues: ['Eco Park', 'Salt Lake Stadium', 'Science City Auditorium', 'Aquatica Ground'],
  },
  {
    slug: 'ahmedabad',
    name: 'Ahmedabad',
    state: 'Gujarat',
    description:
      "Ahmedabad gained global attention as the venue for Coldplay's Music of the Spheres Tour at the Narendra Modi Stadium, the world's largest cricket stadium. The city is emerging as a major concert destination.",
    venues: ['Narendra Modi Stadium', 'Sabarmati Riverfront', 'Gujarat University Convention Centre'],
  },
  {
    slug: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    description:
      "Pune is a major hub for indie music, rock, and EDM in India. The city hosts NH7 Weekender and VH1 Supersonic, and has a thriving college music scene.",
    venues: ['Pune International Exhibition Centre', 'Amanora Park Town', 'Kothrud Ground'],
  },
  {
    slug: 'goa',
    name: 'Goa',
    state: 'Goa',
    description:
      "Goa is India's EDM capital, hosting Asia's biggest electronic music festival, Sunburn. The state's beach venues provide a unique concert experience with international and Indian DJs.",
    venues: ['Vagator Beach', 'Hilltop', 'Club Cubana', 'Tito\'s Lane'],
  },
  {
    slug: 'chandigarh',
    name: 'Chandigarh',
    state: 'Chandigarh',
    description:
      "Chandigarh is the heart of Punjabi music and hosts major Punjabi artists like Diljit Dosanjh, Karan Aujla, and AP Dhillon. The Sector 34 Exhibition Ground is a key concert venue.",
    venues: ['Sector 34 Exhibition Ground', 'Sukhna Lake Ground', 'Tagore Theatre', 'I.S. Bindra Punjab Cricket Association Stadium'],
  },
  {
    slug: 'jaipur',
    name: 'Jaipur',
    state: 'Rajasthan',
    description:
      "Jaipur, the Pink City, hosts concerts and music festivals including the boutique Magnetic Fields festival. The city blends heritage venues with modern concert infrastructure.",
    venues: ['Jaipur Exhibition Centre', 'Albert Hall Museum Grounds', 'Birla Auditorium'],
  },
  {
    slug: 'lucknow',
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    description:
      "Lucknow's growing concert scene is attracting more Indian and international artists. The city's cultural heritage makes it a unique concert destination.",
    venues: ['Awadh Shilpgram', 'Indira Gandhi Pratishthan', 'KD Singh Babu Stadium'],
  },
  {
    slug: 'guwahati',
    name: 'Guwahati',
    state: 'Assam',
    description:
      "Guwahati is Northeast India's premier concert city, recently hosting Diljit Dosanjh's Dil-Luminati Tour. The city is becoming an important stop for major India tours.",
    venues: ['Sarusajai Stadium', 'Veterinary Ground', 'ITA Centre'],
  },
  {
    slug: 'indore',
    name: 'Indore',
    state: 'Madhya Pradesh',
    description:
      "Indore is emerging as a concert destination in Central India, hosting music festivals and Bollywood concerts. The city's young population drives demand for live music events.",
    venues: ['Brilliant Convention Centre', 'Labh Ganga Garden', 'Daly College Grounds'],
  },
  {
    slug: 'shillong',
    name: 'Shillong',
    state: 'Meghalaya',
    description:
      "Shillong, the 'Rock Capital of India', has a deep-rooted love for live music and rock culture. The hill station hosted Def Leppard's India Tour 2026 at JLN Stadium (Polo Ground), cementing its reputation as a premier concert destination in Northeast India.",
    venues: ['JLN Stadium (Polo Ground)', 'Shillong Golf Course'],
  },
];

// Helper to get city by slug (tolerates case/whitespace/encoding differences)
export function getCityBySlug(slug: string): City | undefined {
  let normalized: string;
  try {
    // Route params arrive decoded, so a stray '%' throws URIError here.
    // Treat that as "no such city" instead of a 500.
    normalized = decodeURIComponent(slug).toLowerCase().trim();
  } catch {
    return undefined;
  }
  return CITIES.find((c) => c.slug === normalized);
}

// Resolve a display city name (e.g. from concert data) to its page slug
export function getCitySlugByName(name: string): string {
  const match = CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase().trim());
  if (match) return match.slug;
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}
