/**
 * Single source of truth for the J.L. Sports Injury Services website.
 *
 * Everything the client might want to change — phone number, prices, opening
 * hours, copy — lives here. `build.js` turns this into static HTML.
 */

// ---------------------------------------------------------------------------
// Business details
// ---------------------------------------------------------------------------

const site = {
  name: 'J.L. Sports Injury Services',
  shortName: 'J.L. Sports Injury Services',
  legalName: 'J.L. Sports Injury Services',
  founded: '2018',
  practitioner: 'Jack Laurie',
  tagline: 'Sports Injury Clinic in Gosforth, Newcastle',
  // Change this to the live domain before launch — it drives canonicals,
  // Open Graph URLs and the sitemap.
  origin: 'https://www.jlsportsinjuryservices.com',

  phone: '+44 7460 937648',
  phoneHref: '+447460937648',
  email: 'info@jlsportsinjuryservices.com',

  address: {
    venue: 'Hidden Strength',
    street: 'Lansdowne Court',
    locality: 'Gosforth',
    region: 'Newcastle upon Tyne',
    postcode: 'NE3 1HR',
    country: 'GB',
    lat: 55.0006,
    lng: -1.6222,
  },

  // Live booking system. The whole site funnels into this.
  bookingUrl:
    'https://www.fresha.com/a/j-l-sports-injury-services-newcastle-upon-tyne-hidden-strength-lansdowne-court-gosforth-olaass6e',

  directionsUrl:
    'https://www.google.com/maps/dir/?api=1&destination=Hidden+Strength%2C+Lansdowne+Court%2C+Gosforth%2C+Newcastle+upon+Tyne+NE3+1HR',

  // -------------------------------------------------------------------------
  // Google
  //
  // The map embed and the Maps/reviews links work as they are. The two IDs are
  // deliberately blank: fill them in and the site wires itself up. Leave them
  // blank and no third-party script loads and no cookie banner appears.
  // -------------------------------------------------------------------------
  google: {
    // Drives the embedded map. Precise enough to land on the building.
    mapQuery: 'Hidden Strength, Lansdowne Court, Gosforth, Newcastle upon Tyne NE3 1HR',

    // How the Google map loads:
    //   'click' — styled card first, Google only loaded when asked (default).
    //             No Google cookies for anyone who does not want a map.
    //   'auto'  — the real map loads with the page, like most sites do.
    //             Simpler, but it sets Google cookies on every visit.
    mapMode: 'click',

    // Google Business Profile. Replace with the profile's own short link
    // (Google Business Profile → Read reviews → Share) once you have it —
    // this search URL resolves to the listing in the meantime.
    profileUrl:
      'https://www.google.com/maps/search/?api=1&query=J.L.+Sports+Injury+Services+Gosforth+Newcastle',

    // "Write a review" deep link. Swap in the profile's own review link when
    // available; this one opens the listing where the review button lives.
    reviewsUrl:
      'https://www.google.com/maps/search/?api=1&query=J.L.+Sports+Injury+Services+Gosforth+Newcastle',

    // GA4 measurement ID, e.g. 'G-XXXXXXXXXX'. Blank = no analytics, no
    // cookies, no consent banner.
    analyticsId: '',

    // Search Console HTML-tag verification code (the content="..." value).
    // Only needed if you verify by meta tag rather than DNS.
    searchConsoleVerification: '',
  },

  reviews: {
    rating: '5.0',
    count: 27,
    // How the count is worded on the page. Set a label like 'over 25' if you
    // would rather not update the exact figure each time a review lands;
    // null shows the exact `count`. Keep whichever you choose truthful — the
    // Google badge currently reads 27.
    countLabel: null,
    // Platforms the 5★ record lives on.
    platforms: ['Google', 'Fresha', 'Facebook'],
  },

  social: {
    facebook: 'https://www.facebook.com/JLSportsInjuryServices/',
    instagram: 'https://www.instagram.com/jlsportsinjuryservices/',
  },

  // Mon–Thu 09:00–20:00. Fri–Sun closed.
  hours: [
    { day: 'Monday', open: '09:00', close: '20:00' },
    { day: 'Tuesday', open: '09:00', close: '20:00' },
    { day: 'Wednesday', open: '09:00', close: '20:00' },
    { day: 'Thursday', open: '09:00', close: '20:00' },
    { day: 'Friday', closed: true },
    { day: 'Saturday', closed: true },
    { day: 'Sunday', closed: true },
  ],

  // Areas the clinic realistically draws from — used for local SEO copy.
  areasServed: [
    'Gosforth',
    'Jesmond',
    'Newcastle city centre',
    'Heaton',
    'Kingston Park',
    'Ponteland',
    'Wideopen',
    'Killingworth',
    'North Tyneside',
  ],
};

// ---------------------------------------------------------------------------
// Treatments
//
// Prices are taken from the clinic's published price list. Change a number
// here and it updates everywhere: service pages, the price list, the booking
// flow, the share images and the structured data.
// ---------------------------------------------------------------------------

const treatments = [
  {
    slug: 'injury-assessment',
    nav: 'Initial Assessment',
    title: 'Initial Assessment',
    kicker: 'Start here',
    metaTitle: 'Injury Assessment Newcastle | Gosforth Sports Clinic',
    metaDescription:
      'A full 60-minute injury assessment in Gosforth, Newcastle. Physical testing, a clear diagnosis and hands-on treatment in the same appointment. Book online.',
    summary:
      'A thorough, hands-on assessment that finds the actual cause of your pain — then treats it in the same appointment.',
    duration: 60,
    price: 55,
    priceNote: 'Assessment and first treatment included',
    icon: 'clipboard',
    featured: true,
    intro:
      'Every new client starts with an initial assessment. It is the difference between chasing symptoms and fixing the problem — and it means the treatment you get is built around your injury rather than a standard routine.',
    body: [
      {
        h: 'What happens in the appointment',
        p: 'We begin by gathering your personal details, training history and a full picture of the problem: when it started, what aggravates it, what you have already tried and what you need to get back to. That conversation usually tells us more than any single test.',
      },
      {
        h: 'Physical testing',
        p: 'A thorough injury assessment is then carried out using a series of physical tests — range of movement, strength, joint stability, muscle length and functional movement — to identify the injured structures and, just as importantly, the movement patterns that led to the injury in the first place.',
      },
      {
        h: 'Diagnosis and a plan',
        p: 'You will leave knowing what is wrong, how long it is likely to take, and exactly what happens next. Where treatment is appropriate it is delivered in the same session, and you go home with a rehabilitation plan you can actually follow.',
      },
      {
        h: 'Referral when it is needed',
        p: 'If your symptoms suggest something that sits outside the scope of the clinic, you will be told plainly and pointed towards the right professional. Honest advice is part of the service.',
      },
    ],
    goodFor: [
      'New or unexplained pain',
      'A niggle that keeps coming back',
      'Injuries that have stopped responding to rest',
      'Getting a clear diagnosis before you commit to treatment',
    ],
  },
  {
    slug: 'sports-massage',
    nav: 'Sports Massage',
    title: 'Sports Massage',
    kicker: 'Most booked',
    metaTitle: 'Sports Massage Newcastle | Gosforth Massage Therapist',
    metaDescription:
      'Sports massage in Gosforth, Newcastle upon Tyne. Targeted deep tissue work for muscle tightness, trigger points and DOMS. 30 and 60-minute appointments. Book online.',
    summary:
      'Targeted soft tissue work that releases tight muscle, eases post-training soreness and gets you moving properly again.',
    duration: 60,
    price: 50,
    priceOptions: [
      { duration: 30, price: 30, label: '30 minutes — one or two areas' },
      { duration: 60, price: 50, label: '60 minutes — full treatment' },
    ],
    icon: 'hands',
    featured: true,
    intro:
      'Sports massage is used to target specific muscle groups with the aim of aiding healing of the surrounding tissues, reducing muscle tension, improving muscle performance and accelerating recovery time after exercise.',
    body: [
      {
        h: 'What it helps with',
        p: 'Sports massage is highly effective for muscular discomfort arising from delayed onset muscle soreness (DOMS), trigger points, muscle tightness and muscle imbalances. If you finish a session or a match feeling locked up, this is the treatment that unlocks it.',
      },
      {
        h: 'Recovery between sessions',
        p: 'Used regularly, sports massage speeds up recovery after exercise. That matters most when your training load is high — pre-season, marathon blocks, a run of fixtures — and the time between sessions is the thing limiting your progress.',
      },
      {
        h: 'Healing and prevention',
        p: 'It is equally effective for accelerating the healing of soft tissue injuries and for preventing them. Addressing tightness and imbalance before it becomes a strain is the cheapest treatment there is.',
      },
      {
        h: 'It is not a spa massage',
        p: 'This is targeted, purposeful work at a depth appropriate to you and your injury. It can be intense in places, and it is always adjustable — you set the pressure, and nothing happens without you knowing why.',
      },
    ],
    goodFor: [
      'Muscle tightness and restricted movement',
      'DOMS after hard training',
      'Trigger points and knots that keep returning',
      'Maintenance through a heavy training block',
    ],
  },
  {
    slug: 'deep-tissue-massage',
    nav: 'Full Body Massage',
    title: 'Full Body Massage',
    metaTitle: 'Full Body & Deep Tissue Massage Newcastle | Gosforth',
    metaDescription:
      'Full body deep tissue massage in Gosforth, Newcastle. The same techniques as sports massage delivered across the whole body. 60-minute appointments, book online.',
    summary:
      'The same techniques as sports massage, delivered across the whole body rather than one area.',
    duration: 90,
    price: 80,
    icon: 'wave',
    featured: true,
    intro:
      'Deep tissue massage is similar to sports massage in technique, but it is delivered as a full body massage rather than taking a targeted approach to one area.',
    body: [
      {
        h: 'Whole body, not one area',
        p: 'Rather than spending the appointment on a single problem area, the treatment works through the body as a whole — back, shoulders, hips, legs — releasing accumulated tension wherever it has settled.',
      },
      {
        h: 'Who it suits',
        p: 'It is the right choice if you are generally tight rather than specifically injured, if stress and desk work have left you stiff through the neck and shoulders, or if you simply want a full reset after a demanding block of training.',
      },
      {
        h: 'Pressure that suits you',
        p: 'Deep does not have to mean painful. The depth is matched to your tolerance and to what the tissue actually needs on the day, and it is adjusted throughout.',
      },
    ],
    goodFor: [
      'General, all-over muscular tightness',
      'Desk-related neck, shoulder and back tension',
      'A full reset after a hard training block',
      'Anyone who wants recovery work without a specific injury',
    ],
  },
  {
    slug: 'follow-up-treatment',
    nav: 'Injury Treatment',
    title: 'Injury Treatment',
    metaTitle: 'Sports Injury Treatment & Rehab | Gosforth, Newcastle',
    metaDescription:
      'Follow-up injury treatment in Gosforth, Newcastle: acupuncture, joint mobilisation, ultrasound, electrotherapy and gym-based rehab. Book online.',
    summary:
      'Follow-up appointments that combine hands-on treatment with gym-based rehabilitation until you are properly back.',
    duration: 60,
    price: 55,
    priceOptions: [
      { duration: 30, price: 35, label: '30 minutes — focused treatment' },
      { duration: 60, price: 55, label: '60 minutes — treatment and rehab' },
    ],
    icon: 'pulse',
    featured: true,
    intro:
      'Once your injury has been assessed, follow-up appointments are where the recovery actually happens. Each session combines the treatment your injury needs on the day with progressive rehabilitation you can keep building on.',
    body: [
      {
        h: 'Treatment options',
        p: 'Follow-up treatments can include medical acupuncture, joint mobilisation, ultrasound therapy, electrotherapy, soft tissue work and kinesiotaping. Which of those you receive depends entirely on your injury and where you are in your recovery.',
      },
      {
        h: 'Gym-based rehabilitation',
        p: 'This is the part most clinics skip. Using Hidden Strength Gosforth\'s gym floor and equipment, your rehab is loaded, coached and progressed properly — so you rebuild strength in the movements you actually need rather than working through a printed sheet at home.',
      },
      {
        h: 'Progress you can measure',
        p: 'Each appointment starts by re-testing what we measured last time. You should be able to see your range, strength and pain changing week to week, and the plan is adjusted to match.',
      },
      {
        h: 'Discharged, not strung along',
        p: 'The goal is to get you back to full training and out the door. You will be told when you no longer need to come in.',
      },
    ],
    goodFor: [
      'Continuing care after an initial assessment',
      'Rebuilding strength after a strain or sprain',
      'Returning to sport safely after time out',
      'Long-standing injuries that never fully settled',
    ],
  },
  {
    slug: 'medical-acupuncture',
    nav: 'Medical Acupuncture',
    title: 'Medical Acupuncture',
    metaTitle: 'Medical Acupuncture Newcastle | Gosforth Clinic',
    metaDescription:
      'Evidence-based medical acupuncture in Gosforth, Newcastle upon Tyne. Administered following a full injury assessment for pain relief and muscle tension.',
    summary:
      'An evidence-based approach to needling for pain and muscular tension, always following a proper assessment.',
    duration: 60,
    price: 55,
    priceNote: 'Included within assessment and treatment appointments',
    icon: 'needle',
    intro:
      'Medical acupuncture takes a more evidence based approach than traditional acupuncture, and is only ever administered following an initial assessment.',
    body: [
      {
        h: 'Assessment first, always',
        p: 'An initial acupuncture session is preceded by an initial assessment. That appointment lasts from 30 minutes to an hour and involves an assessment of your general health, your medical history and a physical examination, before any needles are used.',
      },
      {
        h: 'How the treatment works',
        p: 'Fine, single-use needles are inserted into specific points in the muscle and surrounding tissue. The aim is to reduce pain, release trigger points and lower the tone of muscle that will not relax with hands-on work alone.',
      },
      {
        h: 'What it feels like',
        p: 'Most people feel very little on insertion — often a dull ache or a brief twitch in the muscle, which is exactly what we are looking for. Needles are sterile, single-use and disposed of immediately afterwards.',
      },
      {
        h: 'When it is not appropriate',
        p: 'Acupuncture is not suitable for everyone. Your medical history is screened at assessment, and if it is not the right treatment for you, it will not be used.',
      },
    ],
    goodFor: [
      'Stubborn trigger points',
      'Muscle tension that has not responded to massage',
      'Persistent pain alongside a rehab programme',
      'Reducing muscle tone before loading work',
    ],
  },
  {
    slug: 'electrotherapy',
    nav: 'Electrotherapy',
    title: 'Electrotherapy',
    metaTitle: 'Electrotherapy Newcastle | EMS & TENS in Gosforth',
    metaDescription:
      'EMS and TENS electrotherapy at our Gosforth, Newcastle sports injury clinic — re-activating weak muscle, reducing swelling and relieving pain after injury.',
    summary:
      'EMS and TENS used to re-activate weak muscle, reduce swelling and manage pain during recovery.',
    duration: 60,
    price: 55,
    priceNote: 'Used within injury treatment appointments',
    icon: 'bolt',
    intro:
      'The clinic offers both Electrical Muscle Stimulation (EMS) and Transcutaneous Electrical Nerve Stimulation (TENS) as part of a wider treatment plan.',
    body: [
      {
        h: 'Electrical Muscle Stimulation (EMS)',
        p: 'EMS stimulates muscle contractions using electrical impulses. It is used to re-activate or strengthen weak muscles following injury, to reduce swelling, to relieve pain and to aid the healing process — particularly useful in the early stages when a muscle has effectively switched off.',
      },
      {
        h: 'Transcutaneous Electrical Nerve Stimulation (TENS)',
        p: 'TENS is used primarily for pain relief, altering the pain signals travelling to the brain and providing a window in which you can move more comfortably and get on with your rehabilitation.',
      },
      {
        h: 'Part of a plan, not a substitute for one',
        p: 'Electrotherapy is a tool used alongside hands-on treatment and loaded rehabilitation. It is at its most useful when it makes the rest of your programme possible.',
      },
    ],
    goodFor: [
      'Muscle that has shut down after injury or surgery',
      'Swelling in the early stages of recovery',
      'Pain that is limiting your rehab',
      'Re-establishing a proper muscle contraction',
    ],
  },
  {
    slug: 'ultrasound-therapy',
    nav: 'Ultrasound Therapy',
    title: 'Ultrasound Therapy',
    metaTitle: 'Ultrasound Therapy Newcastle | Gosforth Clinic',
    metaDescription:
      'Therapeutic ultrasound in Gosforth, Newcastle upon Tyne — increasing blood flow, accelerating soft tissue healing and remodelling scar tissue after injury.',
    summary:
      'Therapeutic sound waves used to accelerate soft tissue repair and remodel scar tissue.',
    duration: 60,
    price: 55,
    priceNote: 'Used within injury treatment appointments',
    icon: 'sound',
    intro:
      'Ultrasound therapy is used to aid soft tissue repair and to reduce scar tissue following injury.',
    body: [
      {
        h: 'How it works',
        p: 'Sound waves are emitted through the soft tissue, causing micro-vibrations with a thermal effect. That increases blood flow to the area, accelerates healing and helps remodel scar tissue so it lays down in a more functional pattern.',
      },
      {
        h: 'Where it fits',
        p: 'It is most valuable in the middle stages of healing — once the acute phase has settled and the priority becomes getting good quality tissue laid down before you load it properly.',
      },
      {
        h: 'Comfortable and passive',
        p: 'Treatment is painless. You will feel a gentle warmth and the movement of the applicator head, and nothing more.',
      },
    ],
    goodFor: [
      'Soft tissue injuries in the healing phase',
      'Scar tissue from an older injury',
      'Tendon and ligament repair',
      'Areas that need blood flow before loading',
    ],
  },
];

// ---------------------------------------------------------------------------
// Reusable page furniture
// ---------------------------------------------------------------------------

const { conditions } = require('./conditions');

const nav = [
  { label: 'Home', href: 'index.html' },
  { label: 'About', href: 'about-us.html' },
  {
    label: 'Services',
    href: 'services.html',
    megaLabel: 'Treatments',
    megaAll: { label: 'All treatments & prices', href: 'services.html' },
    children: treatments.map((t) => ({
      label: t.nav,
      href: `${t.slug}.html`,
      summary: t.summary,
      icon: t.icon,
    })),
  },
  {
    label: 'Conditions',
    href: 'conditions.html',
    megaLabel: 'Conditions we treat',
    megaAll: { label: 'All conditions we treat', href: 'conditions.html' },
    children: conditions.map((c) => ({
      label: c.nav,
      href: `${c.slug}.html`,
      summary: c.blurb,
      icon: c.icon,
    })),
  },
  { label: 'Prices', href: 'price-list.html' },
  { label: 'Reviews', href: 'reviews.html' },
  { label: 'Offers', href: 'offers.html' },
  { label: 'Contact', href: 'contact.html' },
];

// ---------------------------------------------------------------------------
// Extras that sit alongside the treatments — sold, but not treatments as such.
// ---------------------------------------------------------------------------

const extras = [
  {
    slug: 'block-bookings',
    title: 'Block Bookings & Subscriptions',
    summary:
      'Five or ten sessions bought together, for anyone working through a rehabilitation plan or keeping on top of things month to month.',
    priceText: 'Price depends on the service',
    icon: 'calendar',
    detail:
      'If your recovery needs a run of appointments, or you come in regularly for maintenance, booking a block works out cheaper than paying session by session. Blocks are available in fives and tens across the treatments, and subscriptions can be set up monthly. Ask at your appointment or get in touch and it will be arranged around what you actually need.',
  },
  {
    slug: 'gift-vouchers',
    title: 'Gift Vouchers',
    summary:
      'A voucher towards any treatment — for the runner, lifter or desk-bound relative who will not book it for themselves.',
    priceText: '£25 minimum spend',
    icon: 'tag',
    detail:
      'Vouchers can be bought as a physical certificate collected from the clinic, or as an e-voucher sent straight to your inbox. They can be put towards any appointment and there is a £25 minimum spend.',
  },
];

// ---------------------------------------------------------------------------
// Current offer. Set `active: false` to take the promo bar down everywhere.
// ---------------------------------------------------------------------------

const offer = {
  active: true,
  code: 'JLNEW0029',
  headline: '10% off your first appointment',
  short: 'Get 10% off your first appointment',
  detail:
    'New to the clinic? Use the code at online checkout and 10% comes off your first appointment, whichever treatment you book.',
  terms: [
    'One use per person, for first-time clients.',
    'Applied at online checkout — the code needs entering before payment.',
    'Cannot be combined with block booking or subscription rates.',
  ],
};

const steps = [
  {
    n: '01',
    h: 'Book in two minutes',
    p: 'Pick a treatment and a time that works. Instant confirmation, no waiting for a callback, no deposit.',
  },
  {
    n: '02',
    h: 'Get assessed properly',
    p: 'A full hands-on assessment finds the cause, not just the sore bit. You get a clear diagnosis and a realistic timescale.',
  },
  {
    n: '03',
    h: 'Treat and rehabilitate',
    p: 'Hands-on treatment plus loaded, coached rehab on the gym floor — so the fix holds when you go back to training.',
  },
  {
    n: '04',
    h: 'Back to full training',
    p: 'We re-test as you go and discharge you when you are ready. The aim is to get you out the door, not to keep you coming back.',
  },
];

const credentials = [
  'Castleford Tigers R.L.F.C.',
  'Leicester Tigers',
  'Elite Rugby Union',
  'Neuromusculoskeletal Specialism',
  'Medical Acupuncture',
  'Gym-Based Rehabilitation',
  'Practising Since 2015',
];

const faqs = [
  {
    q: 'Do I need a referral to be seen?',
    a: 'No. You can book directly online and be seen without a GP referral or any paperwork. If your problem turns out to need onward referral, you will be told at your assessment and pointed in the right direction.',
  },
  {
    q: 'Do I have to play sport to come here?',
    a: 'Not at all. Most clients are not athletes. Desk-related neck and back pain, gardening injuries, running niggles and general stiffness are treated in exactly the same way — the assessment and the rehab simply reflect what your day actually involves.',
  },
  {
    q: 'Should I book an assessment or a sports massage?',
    a: 'If you are in pain, have an injury or something keeps returning, book the initial assessment — it includes treatment in the same appointment. If you are not injured and want maintenance work or recovery after training, book a sports massage.',
  },
  {
    q: 'What should I wear?',
    a: 'Comfortable sports clothing you can move and be assessed in. Shorts are ideal for lower limb problems, and a vest or t-shirt for shoulders and back. There is space to change at the clinic.',
  },
  {
    q: 'How many sessions will I need?',
    a: 'That depends entirely on the injury, how long you have had it and what you need to get back to. You will be given a realistic estimate at the end of your assessment rather than an open-ended commitment.',
  },
  {
    q: 'Will the treatment hurt?',
    a: 'Some techniques are intense, but nothing happens without your say-so. Pressure is matched to you and adjusted throughout, and you are told what is coming and why before it happens.',
  },
  {
    q: 'Where exactly are you and is there parking?',
    a: `The clinic is inside Hidden Strength on ${site.address.street}, ${site.address.locality} — a short walk from Gosforth High Street, with parking available on site and on the surrounding streets.`,
  },
  {
    q: 'What is your cancellation policy?',
    a: 'Please give as much notice as you can if you need to move or cancel an appointment so the slot can be offered to someone else. Appointments can be rescheduled through the confirmation email you receive when you book.',
  },
];

const trustPoints = [
  {
    h: 'Elite sport experience',
    p: 'Over a decade in practice, including time in elite Rugby Union and Rugby League with Leicester Tigers and Castleford Tigers R.L.F.C.',
    icon: 'shield',
  },
  {
    h: 'A proper gym, not a treatment room',
    p: 'Based inside Hidden Strength Gosforth, so your rehabilitation is loaded and coached on real equipment rather than prescribed on paper.',
    icon: 'dumbbell',
  },
  {
    h: 'Elite treatment, affordable price',
    p: 'The standard of care found in professional sport, priced for the general public. That has been the point of the clinic since 2018.',
    icon: 'tag',
  },
  {
    h: 'Rated 5.0 from over 30 reviews',
    p: 'A five star record across Google, Fresha and Facebook from clients across Newcastle and North Tyneside.',
    icon: 'star',
  },
];

// How the review count reads on the page, e.g. "over 30 reviews".
const reviewCount = site.reviews.countLabel
  ? `${site.reviews.countLabel} reviews`
  : `${site.reviews.count} reviews`;

module.exports = {
  site,
  reviewCount,
  treatments,
  extras,
  offer,
  conditions,
  nav,
  steps,
  credentials,
  faqs,
  trustPoints,
};
