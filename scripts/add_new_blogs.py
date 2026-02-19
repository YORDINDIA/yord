#!/usr/bin/env python3
"""
Add New Blog Articles to YORD India Supabase Database.
Inserts 10 new articles via Supabase REST API.
"""

import os
import json
import requests
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
BLOG_ID = 89876988081

HEADERS = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

ARTICLES = [
    {
        'id': 900000001,
        'blog_id': BLOG_ID,
        'title': "Karan Aujla's P-Pop Culture World Tour: Your Ultimate Guide to India 2026",
        'handle': 'karan-aujla-ppop-culture-world-tour-india-2026-guide',
        'author': 'YORD India',
        'tags': 'Karan Aujla, P-Pop Culture, concert guide, Punjabi, India tour',
        'published': True,
        'published_at': '2026-02-16T10:00:00+05:30',
        'created_at': '2026-02-16T10:00:00+05:30',
        'updated_at': '2026-02-16T10:00:00+05:30',
        'summary_html': "<p>Karan Aujla is bringing his massive P-Pop Culture World Tour to six cities across India. Here's everything you need to know — dates, cities, venues, and what to expect from Punjab's biggest hip-hop star.</p>",
        'body_html': """
<h2>The Biggest Punjabi Tour of 2026</h2>
<p>Karan Aujla — the voice behind <em>Tauba Tauba</em>, <em>Softly</em>, and <em>52 Bars</em> — is bringing his <strong>P-Pop Culture World Tour</strong> to India with six massive stadium shows across the country. After his blockbuster <em>It Was All A Dream</em> tour in 2024, this is set to be even bigger.</p>

<h2>India Tour Dates &amp; Cities</h2>
<p>Here's the confirmed schedule for the India leg:</p>
<ul>
<li><strong>February 28, 2026</strong> — Jawaharlal Nehru Stadium, <strong>Delhi</strong></li>
<li><strong>March 3, 2026</strong> — TBA, <strong>Mumbai</strong></li>
<li><strong>March 3, 2026</strong> — TBA, <strong>Pune</strong></li>
<li><strong>March 14, 2026</strong> — I.S. Bindra PCA Stadium, <strong>Chandigarh</strong></li>
<li><strong>March 21, 2026</strong> — TBA, <strong>Indore</strong></li>
<li><strong>March 29, 2026</strong> — TBA, <strong>Bengaluru</strong></li>
</ul>

<h2>What to Expect</h2>
<p>Karan Aujla has evolved from a Punjabi lyricist to a global phenomenon. His P-Pop Culture World Tour promises a stadium-sized production with massive LED screens, pyrotechnics, and a setlist spanning his entire catalogue — from early bangers like <em>Don't Worry</em> and <em>Chitta Kurta</em> to recent chart-toppers like <em>Tauba Tauba</em> (from the Bollywood film <em>Bad Newz</em>) and tracks from his latest album.</p>
<p>The Chandigarh show on March 14 is expected to be the emotional highlight — a homecoming for Punjab's own superstar at the I.S. Bindra PCA Stadium.</p>

<h2>Concert Fashion: What to Wear</h2>
<p>Karan Aujla concerts are all about swagger. Think oversized streetwear, statement sneakers, and bold accessories. Whether you go with a classic black tee or a printed concert merch piece, make sure you're comfortable enough to dance through his three-hour setlists. Check out <strong>YORD India's Karan Aujla collection</strong> for exclusive merch that'll have you looking fresh for the show.</p>

<h2>Tips for First-Time Concert-Goers</h2>
<ul>
<li>Book your tickets early — his Delhi and Chandigarh shows are expected to sell out fast</li>
<li>Arrive at least 90 minutes before gates open for the best spots</li>
<li>Stay hydrated — Indian stadium concerts can get hot, even in March</li>
<li>Wear comfortable shoes — you'll be standing and jumping for hours</li>
</ul>
"""
    },
    {
        'id': 900000002,
        'blog_id': BLOG_ID,
        'title': "John Mayer's India Debut: A Night Mumbai Will Never Forget",
        'handle': 'john-mayer-india-debut-mumbai-february-2026',
        'author': 'YORD India',
        'tags': 'John Mayer, India debut, Mumbai, live music, blues rock, concert review',
        'published': True,
        'published_at': '2026-02-14T10:00:00+05:30',
        'created_at': '2026-02-14T10:00:00+05:30',
        'updated_at': '2026-02-14T10:00:00+05:30',
        'summary_html': "<p>John Mayer made his long-awaited India debut at Mumbai's Mahalaxmi Race Course on February 11, 2026. Here's our recap of a historic night that left thousands in awe.</p>",
        'body_html': """
<h2>A Decade of Waiting, One Unforgettable Night</h2>
<p>For years, Indian fans of John Mayer had one question: <em>when will he come to India?</em> On February 11, 2026, that question was finally answered. The Grammy-winning singer-songwriter and guitar virtuoso took the stage at Mumbai's <strong>Mahalaxmi Race Course</strong> for his very first performance on Indian soil.</p>

<h2>The Setlist</h2>
<p>Mayer delivered a career-spanning performance that leaned into his blues-rock roots while touching every era of his discography. The evening opened with the lush tones of <em>Belief</em> before building through fan favorites:</p>
<ul>
<li><em>Gravity</em> — the emotional peak of the night, with the entire crowd singing along</li>
<li><em>Slow Dancing in a Burning Room</em> — guitar work that left the audience breathless</li>
<li><em>Waiting on the World to Change</em> — a sing-along moment for the ages</li>
<li><em>New Light</em> — proving Mayer's pop sensibilities are as sharp as ever</li>
<li><em>Free Fallin'</em> (Tom Petty cover) — a tribute that brought tears to many eyes</li>
</ul>

<h2>The Guitar Work</h2>
<p>What separates a John Mayer concert from any other is the guitar. Mayer's improvisational blues solos — honed through years of playing with Dead & Company — were on full display. His PRS Silver Sky sang through extended jams on <em>Slow Dancing</em> and a jaw-dropping blues improvisation that lasted nearly eight minutes.</p>

<h2>The Mumbai Crowd</h2>
<p>If there was any doubt about John Mayer's fanbase in India, it was erased that night. The crowd — a mix of die-hard guitar enthusiasts, Berklee-dreaming musicians, and casual fans who grew up on <em>Your Body Is a Wonderland</em> — knew every word. The energy was intimate despite the massive venue, a testament to the personal connection Mayer's music creates.</p>

<h2>A Historic Milestone</h2>
<p>John Mayer's India debut adds to the incredible wave of international artists choosing India as a tour destination. From Coldplay's stadium shows to Ed Sheeran's return visits, India's live music scene has never been stronger. And if Mayer's Mumbai reception is anything to go by, this won't be his last visit.</p>
"""
    },
    {
        'id': 900000003,
        'blog_id': BLOG_ID,
        'title': "Calvin Harris Announces India Debut: Three Cities, One Legend",
        'handle': 'calvin-harris-india-debut-2026-bengaluru-mumbai-delhi',
        'author': 'YORD India',
        'tags': 'Calvin Harris, India debut, EDM, Bengaluru, Mumbai, Delhi, electronic music',
        'published': True,
        'published_at': '2026-02-12T10:00:00+05:30',
        'created_at': '2026-02-12T10:00:00+05:30',
        'updated_at': '2026-02-12T10:00:00+05:30',
        'summary_html': "<p>Calvin Harris — the world's highest-paid DJ — is making his India debut in April 2026 with shows in Bengaluru, Mumbai, and Delhi. Here's everything you need to know.</p>",
        'body_html': """
<h2>The World's Biggest DJ Is Finally Coming to India</h2>
<p>It's official. <strong>Calvin Harris</strong> — the Scottish DJ and producer who has dominated the global electronic music scene for over a decade — is making his <strong>India debut in April 2026</strong>. The man behind <em>Summer</em>, <em>Feel So Close</em>, <em>One Kiss</em>, <em>This Is What You Came For</em>, and countless other chart-toppers will perform three shows across India.</p>

<h2>Tour Dates</h2>
<ul>
<li><strong>April 17, 2026</strong> — Embassy International Riding School, <strong>Bengaluru</strong></li>
<li><strong>April 18, 2026</strong> — Infinity Bay, Sewri, <strong>Mumbai</strong></li>
<li><strong>April 19, 2026</strong> — Leisure Valley Ground, <strong>Delhi</strong></li>
</ul>

<h2>Why This Matters</h2>
<p>Calvin Harris is not just any DJ. He holds the record for the most number-one hits on Billboard's Dance/Electronic Songs chart. He's collaborated with Rihanna, Dua Lipa, The Weeknd, Sam Smith, and Frank Ocean. He headlined Coachella. And until now, he had never performed in India.</p>
<p>His debut marks a watershed moment for India's EDM scene. Coming after successful India tours by Martin Garrix, Tiësto, and DJ Snake, Calvin Harris's arrival confirms India as a must-stop destination on the global festival circuit.</p>

<h2>What to Expect</h2>
<p>Calvin Harris live shows are known for their massive production — towering LED walls, immersive light rigs, and a setlist that moves seamlessly from deep house to euphoric dance-pop. Expect hits spanning his entire career:</p>
<ul>
<li><em>Summer</em> — the song that defined festival summers worldwide</li>
<li><em>Feel So Close</em> — the anthem that made him a household name</li>
<li><em>One Kiss</em> (with Dua Lipa) — a modern classic</li>
<li><em>This Is What You Came For</em> (with Rihanna) — stadium energy guaranteed</li>
<li><em>Acceptable in the 80s</em> — for the OG fans</li>
</ul>

<h2>Getting Ready</h2>
<p>Three cities in three days means limited capacity at each venue. Tickets are expected to sell out rapidly. If you're planning to attend, book early and keep an eye on official ticketing platforms. And don't forget to gear up with <strong>YORD India's festival-ready merch</strong> — because showing up to Calvin Harris in style is non-negotiable.</p>
"""
    },
    {
        'id': 900000004,
        'blog_id': BLOG_ID,
        'title': "Kanye West Is Coming to India: Everything We Know About Ye's Delhi Show",
        'handle': 'kanye-west-ye-india-debut-delhi-march-2026',
        'author': 'YORD India',
        'tags': 'Kanye West, Ye, Delhi, India debut, hip-hop, concert preview',
        'published': True,
        'published_at': '2026-02-10T10:00:00+05:30',
        'created_at': '2026-02-10T10:00:00+05:30',
        'updated_at': '2026-02-10T10:00:00+05:30',
        'summary_html': "<p>Ye (Kanye West) is making his long-awaited India debut at Delhi's Jawaharlal Nehru Stadium on March 29, 2026. Here's everything we know about what could be the biggest concert in Indian history.</p>",
        'body_html': """
<h2>Ye Comes to Delhi</h2>
<p>In what might be the most talked-about concert announcement of 2026, <strong>Ye (formerly Kanye West)</strong> is set to perform at Delhi's <strong>Jawaharlal Nehru Stadium on March 29, 2026</strong>. This marks the first time one of the most influential artists of the 21st century will perform on Indian soil.</p>

<h2>Why This Is Historic</h2>
<p>Kanye West is not just a musician — he's a cultural force. From <em>The College Dropout</em> (2004) to <em>Donda</em> (2021), he has redefined hip-hop, fashion, and popular culture multiple times over. His discography includes some of the most acclaimed albums in music history: <em>My Beautiful Dark Twisted Fantasy</em>, <em>808s & Heartbreak</em>, <em>Yeezus</em>, and <em>The Life of Pablo</em>.</p>
<p>For Indian fans — many of whom discovered hip-hop through Kanye — this concert represents a once-in-a-lifetime opportunity.</p>

<h2>What We Know So Far</h2>
<ul>
<li><strong>Date:</strong> March 29, 2026</li>
<li><strong>Venue:</strong> Jawaharlal Nehru Stadium, New Delhi</li>
<li><strong>Capacity:</strong> The stadium holds over 60,000 — making this potentially the largest hip-hop concert in Indian history</li>
<li><strong>Tickets:</strong> Expected to go on sale via major Indian ticketing platforms</li>
</ul>

<h2>The Songs We're Hoping to Hear</h2>
<p>A Kanye setlist is always unpredictable, but here are the tracks Indian fans are praying for:</p>
<ul>
<li><em>Stronger</em> — the ultimate concert opener</li>
<li><em>Gold Digger</em> — the crowd will lose their minds</li>
<li><em>Runaway</em> — the 9-minute masterpiece that defines live Kanye</li>
<li><em>Flashing Lights</em> — cinematic and beautiful</li>
<li><em>All of the Lights</em> — pure stadium energy</li>
<li><em>Power</em> — goosebumps guaranteed</li>
<li><em>Heartless</em> — the 808s era anthem</li>
</ul>

<h2>Getting Ready for Ye</h2>
<p>A Kanye concert demands commitment — both emotional and sartorial. Ye's influence on streetwear is unmatched, and Indian fans will undoubtedly bring their fashion A-game. From oversized silhouettes to minimalist earth tones, expect JLN Stadium to look like a runway. Browse <strong>YORD India</strong> for concert-ready streetwear that channels the Ye aesthetic.</p>
"""
    },
    {
        'id': 900000005,
        'blog_id': BLOG_ID,
        'title': "Lollapalooza India 2026 Recap: The Best Moments from Mumbai",
        'handle': 'lollapalooza-india-2026-recap-mumbai-best-moments',
        'author': 'YORD India',
        'tags': 'Lollapalooza, music festival, Mumbai, Linkin Park, Playboi Carti, YUNGBLUD, concert recap',
        'published': True,
        'published_at': '2026-02-08T10:00:00+05:30',
        'created_at': '2026-02-08T10:00:00+05:30',
        'updated_at': '2026-02-08T10:00:00+05:30',
        'summary_html': "<p>Lollapalooza India returned to Mumbai's Mahalaxmi Race Course for its fourth edition on January 24-25, 2026. From Linkin Park's headlining set to Playboi Carti's chaos — here are the best moments.</p>",
        'body_html': """
<h2>India's Biggest Music Festival Returns</h2>
<p><strong>Lollapalooza India 2026</strong> took over Mumbai's Mahalaxmi Race Course on January 24-25 for its fourth edition, and it was the biggest one yet. With a lineup headlined by <strong>Linkin Park</strong>, <strong>Playboi Carti</strong>, <strong>YUNGBLUD</strong>, <strong>Kehlani</strong>, <strong>Fujii Kaze</strong>, and <strong>LANY</strong>, the two-day festival drew tens of thousands of music fans from across India.</p>

<h2>Day 1 Highlights</h2>

<h3>Linkin Park Closes the Night</h3>
<p>The most anticipated set of the festival delivered in every way. Linkin Park — with new vocalist <strong>Emily Armstrong</strong> — headlined Day 1 with a performance that honored Chester Bennington's legacy while firmly establishing the band's new era. <em>In the End</em>, <em>Numb</em>, and <em>Crawling</em> had the entire venue singing in unison, while new tracks from <em>From Zero</em> showed a band with renewed purpose.</p>

<h3>Fujii Kaze's Breakout</h3>
<p>Japanese singer-songwriter Fujii Kaze was a revelation. His blend of R&B, soul, and jazz — performed with infectious joy — won over a crowd that may not have known his name walking in but left as devoted fans.</p>

<h2>Day 2 Highlights</h2>

<h3>Playboi Carti's Controlled Chaos</h3>
<p>If Linkin Park was the emotional heart of the festival, Playboi Carti was its adrenaline shot. The rapper's set was pure energy — mosh pits erupted, the bass shook the ground, and tracks like <em>Magnolia</em> and <em>Sky</em> sent the crowd into a frenzy.</p>

<h3>Kehlani's Smooth Set</h3>
<p>Kehlani brought R&B excellence to the festival with a smooth, vocally stunning performance. Tracks like <em>Gangsta</em> and <em>Nights Like This</em> provided a welcome contrast to the day's heavier acts.</p>

<h2>The Festival Fashion</h2>
<p>Lollapalooza India has become as much about fashion as it is about music. This year's trends included oversized band tees (Linkin Park merch was everywhere), cargo pants, bucket hats, and layered accessories. The festival grounds were a masterclass in Indian street style meeting global festival fashion.</p>

<h2>Looking Ahead</h2>
<p>With each edition, Lollapalooza India cements its position as the country's premier multi-genre music festival. If 2026 is any indication, next year's edition will be even bigger. Stay tuned to <strong>YORD India</strong> for festival merch and style inspiration.</p>
"""
    },
    {
        'id': 900000006,
        'blog_id': BLOG_ID,
        'title': "Linkin Park's From Zero Era: How Emily Armstrong Revived a Legacy",
        'handle': 'linkin-park-from-zero-era-emily-armstrong-legacy',
        'author': 'YORD India',
        'tags': 'Linkin Park, Emily Armstrong, From Zero, alternative rock, nu-metal, band feature',
        'published': True,
        'published_at': '2026-02-05T10:00:00+05:30',
        'created_at': '2026-02-05T10:00:00+05:30',
        'updated_at': '2026-02-05T10:00:00+05:30',
        'summary_html': "<p>Linkin Park's comeback with vocalist Emily Armstrong and the 'From Zero' album has been one of rock's greatest revival stories. From their 2025 India debut to headlining Lollapalooza India 2026 — here's how LP came back.</p>",
        'body_html': """
<h2>A Band Reborn</h2>
<p>When Chester Bennington passed away in 2017, many thought Linkin Park was over. The band that defined a generation — the band behind <em>Hybrid Theory</em>, <em>Meteora</em>, and <em>Minutes to Midnight</em> — seemed impossible to imagine without Chester's voice. For seven years, the remaining members explored solo projects, compiled legacy releases, and grieved alongside millions of fans.</p>
<p>Then, in 2024, everything changed.</p>

<h2>Enter Emily Armstrong</h2>
<p><strong>Emily Armstrong</strong>, formerly of the band Dead Sara, was announced as Linkin Park's new co-vocalist alongside Mike Shinoda. The decision was met with the full spectrum of reactions — excitement, skepticism, and emotional resistance. But when she performed for the first time, the conversation shifted.</p>
<p>Armstrong doesn't try to be Chester. She brings her own raw power, grit, and emotional intensity to Linkin Park's music. Her voice — aggressive yet vulnerable — proved to be the missing piece that allowed the band to move forward without erasing what came before.</p>

<h2>From Zero: The Album</h2>
<p>The aptly titled <em>From Zero</em> marked Linkin Park's first studio album since 2017's <em>One More Light</em>. The album is a deliberate reset — returning to the heavy, electronic-infused rock that made the band famous while incorporating the maturity of everything they've lived through.</p>
<p>Tracks like <em>The Emptiness Machine</em> became instant anthems, while deeper cuts showed a band willing to experiment within their signature sound. The album debuted at #1 in multiple countries.</p>

<h2>India Shows: 2025 and 2026</h2>
<p>Linkin Park chose India as a key stop on their comeback. Their <strong>February 2025 From Zero World Tour</strong> shows in Delhi were their first Indian performances in the new era. Then in January 2026, they returned for a <strong>standalone show at Brigade Innovation Gardens in Bengaluru</strong> on January 23, followed by <strong>headlining Lollapalooza India 2026</strong> in Mumbai on January 24-25.</p>
<p>For Indian fans — many of whom grew up screaming <em>In the End</em> and <em>Numb</em> — seeing Linkin Park live was a pilgrimage. Emily Armstrong earned the crowd's trust by the second song, and by the time <em>Crawling</em> played, the entire venue was united in both grief and celebration.</p>

<h2>The Legacy Continues</h2>
<p>Linkin Park's return proves that legacy bands can evolve without betraying their roots. Emily Armstrong hasn't replaced Chester — she's given the band a future while honoring its past. And for millions of fans in India and around the world, that's more than enough.</p>
<p>Explore <strong>YORD India's Linkin Park collection</strong> for exclusive merch celebrating the From Zero era.</p>
"""
    },
    {
        'id': 900000007,
        'blog_id': BLOG_ID,
        'title': "Def Leppard India Tour 2026: Rock Legends Hit Indian Shores",
        'handle': 'def-leppard-india-tour-2026-shillong-mumbai-bengaluru',
        'author': 'YORD India',
        'tags': 'Def Leppard, India tour, classic rock, hard rock, Shillong, Mumbai, Bengaluru',
        'published': True,
        'published_at': '2026-02-03T10:00:00+05:30',
        'created_at': '2026-02-03T10:00:00+05:30',
        'updated_at': '2026-02-03T10:00:00+05:30',
        'summary_html': "<p>Def Leppard are bringing their legendary rock anthems to India in March 2026 with shows in Shillong, Mumbai, and Bengaluru. Here's why this tour is unmissable for rock fans.</p>",
        'body_html': """
<h2>The Legends Are Coming</h2>
<p><strong>Def Leppard</strong> — the British rock icons behind <em>Pour Some Sugar on Me</em>, <em>Hysteria</em>, <em>Animal</em>, and <em>Love Bites</em> — are set to perform in India for the first time in March 2026. The Rock &amp; Roll Hall of Famers will play three shows across the country as part of their <strong>India Tour 2026</strong>.</p>

<h2>Tour Dates</h2>
<ul>
<li><strong>March 25, 2026</strong> — JLN Stadium (Polo Ground), <strong>Shillong</strong></li>
<li><strong>March 27, 2026</strong> — Jio World Garden, <strong>Mumbai</strong></li>
<li><strong>March 29, 2026</strong> — NICE Grounds, <strong>Bengaluru</strong></li>
</ul>

<h2>Why Shillong First?</h2>
<p>The decision to open the tour in Shillong is brilliant and deeply meaningful. Known as the <strong>"Rock Capital of India"</strong>, Shillong has a decades-long love affair with Western rock music. The city's music culture — rooted in blues, rock, and metal — makes it the perfect launchpad for Def Leppard's Indian adventure. For the people of Northeast India, this is more than a concert — it's validation of a musical legacy that has thrived far from the mainstream.</p>

<h2>What to Expect</h2>
<p>Def Leppard's live shows are a celebration of '80s arena rock at its finest. With over 100 million records sold worldwide and a catalogue that defined a generation, expect a setlist packed with anthems:</p>
<ul>
<li><em>Pour Some Sugar on Me</em> — the ultimate crowd-pleaser</li>
<li><em>Hysteria</em> — the title track from one of the best-selling albums of all time</li>
<li><em>Animal</em> — pure adrenaline</li>
<li><em>Photograph</em> — timeless power balladry</li>
<li><em>Love Bites</em> — emotional perfection</li>
<li><em>Rock of Ages</em> — because no Def Leppard show is complete without it</li>
</ul>

<h2>For the Classic Rock Fan</h2>
<p>If you grew up on cassette tapes of <em>Pyromania</em> and <em>Hysteria</em>, if you've air-guitared to Joe Elliott's vocals in your bedroom, if you believe rock music peaked in the 1980s — this tour is for you. Def Leppard in India is a moment decades in the making.</p>
<p>Get concert-ready with <strong>YORD India's rock collection</strong> — classic band tees, vintage-inspired fits, and merch that pays homage to the golden era of rock.</p>
"""
    },
    {
        'id': 900000008,
        'blog_id': BLOG_ID,
        'title': "DJ Snake's Valentine's Week India Tour: Six Cities of Bass",
        'handle': 'dj-snake-india-tour-february-2026-six-cities-recap',
        'author': 'YORD India',
        'tags': 'DJ Snake, India tour, EDM, electronic music, Valentine Day, concert recap',
        'published': True,
        'published_at': '2026-02-18T10:00:00+05:30',
        'created_at': '2026-02-18T10:00:00+05:30',
        'updated_at': '2026-02-18T10:00:00+05:30',
        'summary_html': "<p>DJ Snake just wrapped up a massive six-city India Tour spanning Kolkata, Hyderabad, Bengaluru, Pune, Mumbai, and Delhi — culminating on Valentine's Day weekend. Here's our recap of the bass-heavy tour.</p>",
        'body_html': """
<h2>Six Cities, Ten Days, One Snake</h2>
<p><strong>DJ Snake</strong> — the French DJ-producer behind <em>Turn Down for What</em>, <em>Lean On</em>, <em>Taki Taki</em>, and <em>Let Me Love You</em> — just completed one of the most ambitious EDM tours India has ever seen. His <strong>India Tour 2026</strong> spanned six cities in ten days, wrapping up with a special Valentine's Day weekend finale.</p>

<h2>The Tour Route</h2>
<ul>
<li><strong>February 6</strong> — <strong>Kolkata</strong></li>
<li><strong>February 7</strong> — <strong>Hyderabad</strong></li>
<li><strong>February 8</strong> — <strong>Bengaluru</strong></li>
<li><strong>February 13</strong> — <strong>Pune</strong></li>
<li><strong>February 14</strong> — <strong>Mumbai</strong> (Valentine's Day special)</li>
<li><strong>February 15</strong> — <strong>Delhi</strong></li>
</ul>

<h2>Highlights</h2>

<h3>Kolkata: The Grand Opening</h3>
<p>DJ Snake kicked off the tour in Kolkata — a city that's rapidly emerging as a major destination for international music acts. The crowd's energy from the first drop set the tone for the entire tour.</p>

<h3>Mumbai: Valentine's Day Edition</h3>
<p>The Valentine's Day show in Mumbai was the tour's crown jewel. Couples and groups alike packed the venue for a night where <em>Let Me Love You</em> hit different. The French DJ leaned into the romantic energy while still delivering his signature bass-heavy bangers. <em>Middle</em> and <em>A Different Way</em> became unexpected Valentine's anthems.</p>

<h3>Delhi: The Grand Finale</h3>
<p>Delhi brought the tour to a massive close. The capital city's EDM community — one of the most passionate in India — gave DJ Snake a farewell that matched the energy of an entire festival.</p>

<h2>India's Love Affair with EDM</h2>
<p>DJ Snake's six-city tour is the latest proof that India has become a global EDM powerhouse. Following Tiësto's three-city tour in January and ahead of Calvin Harris's April debut, India's appetite for world-class electronic music shows no signs of slowing down.</p>
<p>The production quality at Indian EDM events has risen dramatically — from sound systems to lighting rigs to venue management. International DJs are noticing, and they're coming back for more.</p>
"""
    },
    {
        'id': 900000009,
        'blog_id': BLOG_ID,
        'title': "The Rise of Concert Culture in India: Why 2024-2026 Changed Everything",
        'handle': 'rise-of-concert-culture-india-2024-2026',
        'author': 'YORD India',
        'tags': 'concert culture, India, live music, festivals, music industry, Coldplay, Diljit Dosanjh',
        'published': True,
        'published_at': '2026-01-30T10:00:00+05:30',
        'created_at': '2026-01-30T10:00:00+05:30',
        'updated_at': '2026-01-30T10:00:00+05:30',
        'summary_html': "<p>From Coldplay's stadium shows to Diljit's Dil-Luminati mania, from Lollapalooza's growth to Kanye's India debut — the 2024-2026 period has transformed India into a global live music destination.</p>",
        'body_html': """
<h2>The Golden Age of Live Music in India</h2>
<p>Something remarkable has happened to India's music landscape between 2024 and 2026. What was once a market that international artists occasionally visited has become one of the most dynamic and lucrative live music markets in the world. The numbers, the artists, and the cultural impact tell a story of a nation finding its voice — and its rhythm.</p>

<h2>The Catalysts</h2>

<h3>Coldplay's Game-Changing 2025 Shows</h3>
<p>When <strong>Coldplay</strong> performed at Mumbai's DY Patil Stadium and Ahmedabad's Narendra Modi Stadium in January 2025, they didn't just play concerts — they created a cultural moment. Ticket demand crashed servers. Resale prices hit astronomical figures. Social media exploded. Coldplay proved that Indian audiences would show up in massive numbers for world-class live experiences.</p>

<h3>Diljit Dosanjh's Dil-Luminati Revolution</h3>
<p><strong>Diljit Dosanjh's Dil-Luminati Tour</strong> in late 2024 was equally transformative, but for different reasons. Here was an Indian artist — a Punjabi singer — filling stadiums across Delhi, Mumbai, Bengaluru, Chandigarh, and Guwahati with the same production quality as any international act. Diljit proved that Indian artists could command the same scale, the same ticket prices, and the same cultural excitement as global superstars.</p>

<h3>Karan Aujla and the Punjabi Wave</h3>
<p><strong>Karan Aujla's It Was All A Dream Tour</strong> (2024) and his upcoming <strong>P-Pop Culture World Tour</strong> (2026) represent the next evolution. Punjabi music has gone from regional to national to global, and its concert culture has followed suit.</p>

<h2>The International Wave</h2>
<p>The list of international artists who have performed in India between 2024 and 2026 reads like a music festival poster:</p>
<ul>
<li><strong>Ed Sheeran</strong> (2024, 2025)</li>
<li><strong>Dua Lipa</strong> (2024)</li>
<li><strong>Bryan Adams</strong> (2025)</li>
<li><strong>Green Day</strong> (2025)</li>
<li><strong>Linkin Park</strong> (2025, 2026)</li>
<li><strong>Maroon 5</strong> (2025)</li>
<li><strong>Imagine Dragons</strong> (2025)</li>
<li><strong>John Mayer</strong> (2026 — India debut)</li>
<li><strong>DJ Snake</strong> (2026)</li>
<li><strong>Tiësto</strong> (2026)</li>
<li><strong>Dream Theater</strong> (2026)</li>
<li><strong>The Lumineers</strong> (2026)</li>
</ul>
<p>And with <strong>Calvin Harris</strong>, <strong>Kanye West</strong>, <strong>Def Leppard</strong>, and <strong>Keinemusik</strong> all confirmed for 2026, the pipeline shows no signs of slowing.</p>

<h2>What Changed?</h2>
<p>Several factors converged to create this boom:</p>
<ul>
<li><strong>Rising disposable income</strong> among India's urban youth</li>
<li><strong>Improved venues and infrastructure</strong> — from Delhi's JLN Stadium to Mumbai's Mahalaxmi Race Course</li>
<li><strong>Professional event management</strong> companies that can handle international-scale productions</li>
<li><strong>Social media</strong> amplifying the FOMO factor</li>
<li><strong>Streaming platforms</strong> creating deeper connections between Indian fans and international artists</li>
<li><strong>India's sheer market size</strong> — 1.4 billion people with a median age under 30</li>
</ul>

<h2>Concert Fashion Follows</h2>
<p>With concert culture booming, concert fashion has emerged as its own subculture. Indian fans are increasingly invested in what they wear to shows — from artist-specific merch to curated festival outfits. This is exactly where <strong>YORD India</strong> sits: at the intersection of music, fashion, and culture.</p>

<h2>What's Next?</h2>
<p>If the rumours are true, 2026 could see <strong>BTS</strong>, <strong>The Weeknd</strong>, and <strong>Fred Again..</strong> making their India debuts. India's concert scene isn't just growing — it's becoming one of the most exciting live music markets on the planet.</p>
"""
    },
    {
        'id': 900000010,
        'blog_id': BLOG_ID,
        'title': "What to Wear to a Concert in India: The Ultimate Style Guide",
        'handle': 'what-to-wear-concert-india-style-guide-2026',
        'author': 'YORD India',
        'tags': 'concert fashion, style guide, merch, outfit ideas, festival fashion, what to wear',
        'published': True,
        'published_at': '2026-01-28T10:00:00+05:30',
        'created_at': '2026-01-28T10:00:00+05:30',
        'updated_at': '2026-01-28T10:00:00+05:30',
        'summary_html': "<p>Heading to a concert in India? From stadium rock shows to EDM festivals, here's the ultimate guide to nailing your concert outfit — comfort, style, and everything in between.</p>",
        'body_html': """
<h2>Dress for the Show, Not Just the 'Gram</h2>
<p>Concert fashion in India has evolved from "whatever's comfortable" to a full-blown subculture. Whether you're heading to a Karan Aujla stadium show, a Calvin Harris EDM night, or a Linkin Park rock concert, what you wear is part of the experience. Here's your definitive guide to concert style in India.</p>

<h2>Rule #1: Know Your Genre</h2>
<p>Different concerts call for different vibes:</p>

<h3>Rock &amp; Alternative (Linkin Park, Def Leppard, Green Day)</h3>
<ul>
<li>Classic band tee — vintage or current tour merch</li>
<li>Black jeans or ripped denim</li>
<li>Combat boots or chunky sneakers</li>
<li>Leather or denim jacket (for evening shows)</li>
<li>Layered chains or studded accessories</li>
</ul>

<h3>Punjabi &amp; Hip-Hop (Karan Aujla, Diljit, AP Dhillon)</h3>
<ul>
<li>Oversized graphic tee or streetwear brand</li>
<li>Cargo pants or joggers</li>
<li>Fresh sneakers (think Air Jordan or Dunks)</li>
<li>Chain, watch, and cap combo</li>
<li>Bold colors — don't be afraid to stand out</li>
</ul>

<h3>EDM &amp; Electronic (Calvin Harris, DJ Snake, Tiësto)</h3>
<ul>
<li>Lightweight, breathable fabrics (you'll be dancing for hours)</li>
<li>Neon or UV-reactive accessories</li>
<li>Tank tops or crop tops for warmer venues</li>
<li>Comfortable sneakers with good cushioning</li>
<li>Bucket hats or visors</li>
</ul>

<h3>Pop &amp; Indie (John Mayer, Prateek Kuhad, Anuv Jain)</h3>
<ul>
<li>Smart casual — think linen shirts, clean denim</li>
<li>Minimal accessories</li>
<li>Loafers or clean white sneakers</li>
<li>Light layers for outdoor evening shows</li>
</ul>

<h2>Rule #2: India-Specific Tips</h2>
<ul>
<li><strong>Weather check:</strong> India's climate varies wildly. A February Delhi show can be cold (bring a jacket), while a March Mumbai show will be humid (dress light)</li>
<li><strong>Dust factor:</strong> Many Indian venues are open grounds. Your white sneakers will get dirty. Accept it or choose darker shoes</li>
<li><strong>Pockets matter:</strong> Keep your phone, wallet, and tickets secure. Cargo pants or crossbody bags are your best friends</li>
<li><strong>Layering:</strong> Outdoor concerts can go from warm to cold quickly after sunset. A light jacket or hoodie tied around your waist is clutch</li>
</ul>

<h2>Rule #3: Merch Is Always a Move</h2>
<p>Wearing the artist's merch to their own concert is always a power move. It shows dedication, and you'll feel like you're part of something bigger. But here's the upgrade: <strong>premium merch</strong>. Instead of the basic event tee, invest in quality pieces that you'll actually wear again — well-designed, comfortable, and stylish beyond the concert.</p>
<p>That's exactly what <strong>YORD India</strong> offers. Our artist-inspired collections are designed to be worn at the concert and beyond — quality fabrics, thoughtful designs, and a fit that flatters. Browse our collections for merch that's a level above.</p>

<h2>Rule #4: Comfort Is Non-Negotiable</h2>
<p>You're going to be on your feet for 3-5 hours. You'll jump, dance, push through crowds, and walk long distances in venue grounds. No matter how good an outfit looks, if it's not comfortable, you'll hate it by hour two.</p>
<ul>
<li><strong>Shoes:</strong> This is the most important item. Broken-in sneakers with good support. Never debut new shoes at a concert</li>
<li><strong>Fabrics:</strong> Breathable cotton or moisture-wicking materials. Avoid heavy denim at hot outdoor venues</li>
<li><strong>Fit:</strong> You need to move freely. Slightly oversized fits work better than skin-tight clothes in a crowd</li>
</ul>

<h2>The Essentials Checklist</h2>
<ul>
<li>Comfortable, broken-in shoes</li>
<li>Artist merch or genre-appropriate outfit</li>
<li>Light jacket or hoodie (for outdoor evening shows)</li>
<li>Crossbody bag or fanny pack</li>
<li>Portable phone charger</li>
<li>Sunscreen (for daytime festivals)</li>
<li>Earplugs (protect your hearing — seriously)</li>
<li>Cash + UPI-ready phone</li>
</ul>

<p>Concert fashion is about expressing yourself while being ready for anything the show throws at you. Get it right, and you'll look back at those concert photos with pride for years to come.</p>
"""
    },
]


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        return

    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Blog ID: {BLOG_ID}")
    print(f"Articles to insert: {len(ARTICLES)}")
    print("=" * 60)

    url = f"{SUPABASE_URL}/rest/v1/articles"

    response = requests.post(url, headers=HEADERS, json=ARTICLES)

    if response.status_code in [200, 201, 204]:
        print(f"SUCCESS: {len(ARTICLES)} articles inserted/upserted")
    else:
        print(f"FAILED: {response.status_code}")
        print(f"Response: {response.text}")
        return

    # Verify insertion
    print("\n" + "=" * 60)
    print("VERIFYING INSERTION...")

    ids = ','.join(str(a['id']) for a in ARTICLES)
    verify_url = f"{SUPABASE_URL}/rest/v1/articles?id=in.({ids})&select=id,title,handle,published"
    verify_headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    }
    verify_response = requests.get(verify_url, headers=verify_headers)

    if verify_response.status_code == 200:
        results = verify_response.json()
        print(f"Found {len(results)} articles in database:")
        for article in results:
            status = "LIVE" if article.get('published') else "DRAFT"
            print(f"  [{status}] {article['title']}")
            print(f"         /blog/{article['handle']}")
    else:
        print(f"Verification failed: {verify_response.status_code}")
        print(verify_response.text)


if __name__ == '__main__':
    main()
