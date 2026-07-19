import type { Intensity, Mood } from "@/lib/types";

/**
 * Curated discovery catalog — acclaimed films across eras and moods, so
 * recommendations reach beyond the user's own library without scraping.
 * Tagged by hand: moods (m), intensity (i), runtime minutes (r), and
 * language (l, defaults to English). Posters resolve via the TMDB pipeline;
 * Letterboxd links go through search so they never 404.
 */
export interface CatalogEntry {
  t: string;
  y: number;
  m: Mood[];
  i: Intensity;
  r: number;
  l?: string;
}

export const CATALOG: CatalogEntry[] = [
  // Comedy / feel-good
  { t: "Airplane!", y: 1980, m: ["comedy", "easy"], i: "light", r: 88 },
  { t: "Groundhog Day", y: 1993, m: ["comedy", "feelgood", "easy"], i: "light", r: 101 },
  { t: "The Grand Budapest Hotel", y: 2014, m: ["comedy", "weird", "easy"], i: "light", r: 99 },
  { t: "Monty Python and the Holy Grail", y: 1975, m: ["comedy", "weird"], i: "light", r: 91 },
  { t: "Hot Fuzz", y: 2007, m: ["comedy", "action"], i: "medium", r: 121 },
  { t: "Superbad", y: 2007, m: ["comedy", "easy"], i: "light", r: 113 },
  { t: "School of Rock", y: 2003, m: ["comedy", "feelgood", "easy"], i: "light", r: 109 },
  { t: "Ferris Bueller's Day Off", y: 1986, m: ["comedy", "feelgood", "easy"], i: "light", r: 103 },
  { t: "The Nice Guys", y: 2016, m: ["comedy", "action"], i: "medium", r: 116 },
  { t: "Little Miss Sunshine", y: 2006, m: ["comedy", "feelgood"], i: "light", r: 101 },
  { t: "Paddington 2", y: 2017, m: ["feelgood", "comedy", "easy"], i: "light", r: 103 },
  { t: "Chef", y: 2014, m: ["feelgood", "easy"], i: "light", r: 114 },
  { t: "Amélie", y: 2001, m: ["feelgood", "romance", "weird"], i: "light", r: 122, l: "fr" },
  { t: "Sing Street", y: 2016, m: ["feelgood", "date"], i: "light", r: 106 },
  { t: "The Intouchables", y: 2011, m: ["feelgood", "comedy"], i: "light", r: 112, l: "fr" },
  { t: "Up", y: 2009, m: ["feelgood", "tearjerker", "easy"], i: "light", r: 96 },
  { t: "Ratatouille", y: 2007, m: ["feelgood", "easy"], i: "light", r: 111 },
  { t: "My Neighbor Totoro", y: 1988, m: ["feelgood", "easy"], i: "light", r: 86, l: "ja" },
  { t: "Spirited Away", y: 2001, m: ["feelgood", "weird"], i: "medium", r: 125, l: "ja" },
  { t: "Toy Story", y: 1995, m: ["feelgood", "comedy", "easy"], i: "light", r: 81 },
  { t: "Shrek", y: 2001, m: ["comedy", "feelgood", "easy"], i: "light", r: 90 },
  { t: "The Princess Bride", y: 1987, m: ["feelgood", "date", "comedy", "easy"], i: "light", r: 98 },

  // Date night / romance
  { t: "Before Sunrise", y: 1995, m: ["date", "romance"], i: "light", r: 101 },
  { t: "La La Land", y: 2016, m: ["date", "romance", "tearjerker"], i: "light", r: 128 },
  { t: "Pride & Prejudice", y: 2005, m: ["date", "romance"], i: "light", r: 127 },
  { t: "About Time", y: 2013, m: ["date", "romance", "feelgood", "tearjerker"], i: "light", r: 123 },
  { t: "10 Things I Hate About You", y: 1999, m: ["date", "romance", "comedy", "easy"], i: "light", r: 97 },
  { t: "Notting Hill", y: 1999, m: ["date", "romance", "comedy", "easy"], i: "light", r: 124 },
  { t: "Eternal Sunshine of the Spotless Mind", y: 2004, m: ["romance", "mindbender", "tearjerker"], i: "medium", r: 108 },
  { t: "Portrait of a Lady on Fire", y: 2019, m: ["romance", "date"], i: "medium", r: 122, l: "fr" },
  { t: "In the Mood for Love", y: 2000, m: ["romance", "date"], i: "medium", r: 98, l: "zh" },
  { t: "Punch-Drunk Love", y: 2002, m: ["romance", "weird"], i: "medium", r: 95 },

  // Thriller / crime
  { t: "Se7en", y: 1995, m: ["thriller"], i: "heavy", r: 127 },
  { t: "Zodiac", y: 2007, m: ["thriller"], i: "heavy", r: 157 },
  { t: "Prisoners", y: 2013, m: ["thriller"], i: "heavy", r: 153 },
  { t: "No Country for Old Men", y: 2007, m: ["thriller"], i: "heavy", r: 122 },
  { t: "Gone Girl", y: 2014, m: ["thriller", "date"], i: "heavy", r: 149 },
  { t: "Heat", y: 1995, m: ["thriller", "action"], i: "medium", r: 170 },
  { t: "Sicario", y: 2015, m: ["thriller", "action"], i: "heavy", r: 121 },
  { t: "Nightcrawler", y: 2014, m: ["thriller"], i: "heavy", r: 117 },
  { t: "The Silence of the Lambs", y: 1991, m: ["thriller", "horror"], i: "heavy", r: 118 },
  { t: "Oldboy", y: 2003, m: ["thriller", "weird"], i: "extreme", r: 120, l: "ko" },
  { t: "Parasite", y: 2019, m: ["thriller", "comedy", "mindbender"], i: "heavy", r: 132, l: "ko" },
  { t: "Memories of Murder", y: 2003, m: ["thriller"], i: "heavy", r: 131, l: "ko" },
  { t: "The Departed", y: 2006, m: ["thriller", "action"], i: "medium", r: 151 },
  { t: "Uncut Gems", y: 2019, m: ["thriller"], i: "extreme", r: 135 },
  { t: "Drive", y: 2011, m: ["thriller", "action", "date"], i: "medium", r: 100 },
  { t: "The Usual Suspects", y: 1995, m: ["thriller", "mindbender"], i: "medium", r: 106 },

  // Horror
  { t: "The Shining", y: 1980, m: ["horror", "mindbender"], i: "heavy", r: 146 },
  { t: "Hereditary", y: 2018, m: ["horror"], i: "extreme", r: 127 },
  { t: "The Thing", y: 1982, m: ["horror", "thriller"], i: "heavy", r: 109 },
  { t: "Alien", y: 1979, m: ["horror", "thriller"], i: "heavy", r: 117 },
  { t: "Get Out", y: 2017, m: ["horror", "thriller", "mindbender"], i: "medium", r: 104 },
  { t: "The Witch", y: 2015, m: ["horror", "weird"], i: "heavy", r: 92 },
  { t: "It Follows", y: 2014, m: ["horror"], i: "medium", r: 100 },
  { t: "A Quiet Place", y: 2018, m: ["horror", "thriller"], i: "medium", r: 90 },
  { t: "28 Days Later", y: 2002, m: ["horror", "action"], i: "heavy", r: 113 },
  { t: "The Exorcist", y: 1973, m: ["horror", "classic"], i: "heavy", r: 122 },
  { t: "Psycho", y: 1960, m: ["horror", "thriller", "classic"], i: "medium", r: 109 },

  // Action / adventure
  { t: "Mad Max: Fury Road", y: 2015, m: ["action"], i: "heavy", r: 120 },
  { t: "Die Hard", y: 1988, m: ["action", "easy"], i: "medium", r: 132 },
  { t: "John Wick", y: 2014, m: ["action", "easy"], i: "medium", r: 101 },
  { t: "The Raid", y: 2011, m: ["action"], i: "extreme", r: 101, l: "id" },
  { t: "Terminator 2: Judgment Day", y: 1991, m: ["action"], i: "medium", r: 137 },
  { t: "Mission: Impossible - Fallout", y: 2018, m: ["action", "easy"], i: "medium", r: 147 },
  { t: "Top Gun: Maverick", y: 2022, m: ["action", "feelgood", "easy"], i: "medium", r: 130 },
  { t: "The Dark Knight", y: 2008, m: ["action", "thriller"], i: "medium", r: 152 },
  { t: "Gladiator", y: 2000, m: ["action", "tearjerker"], i: "medium", r: 155 },
  { t: "Jurassic Park", y: 1993, m: ["action", "easy", "feelgood"], i: "medium", r: 127 },
  { t: "Back to the Future", y: 1985, m: ["action", "comedy", "feelgood", "easy"], i: "light", r: 116 },

  // Weird / mind-benders
  { t: "Everything Everywhere All at Once", y: 2022, m: ["weird", "mindbender", "action", "tearjerker"], i: "medium", r: 139 },
  { t: "Being John Malkovich", y: 1999, m: ["weird", "comedy", "mindbender"], i: "medium", r: 113 },
  { t: "Donnie Darko", y: 2001, m: ["weird", "mindbender"], i: "medium", r: 113 },
  { t: "Mulholland Drive", y: 2001, m: ["weird", "mindbender", "thriller"], i: "heavy", r: 147 },
  { t: "Brazil", y: 1985, m: ["weird", "mindbender", "comedy"], i: "medium", r: 132 },
  { t: "The Lobster", y: 2015, m: ["weird", "comedy", "romance"], i: "medium", r: 119 },
  { t: "Swiss Army Man", y: 2016, m: ["weird", "comedy"], i: "medium", r: 97 },
  { t: "Inception", y: 2010, m: ["mindbender", "action", "thriller"], i: "medium", r: 148 },
  { t: "Memento", y: 2000, m: ["mindbender", "thriller"], i: "medium", r: 113 },
  { t: "Primer", y: 2004, m: ["mindbender", "weird"], i: "medium", r: 77 },
  { t: "Coherence", y: 2013, m: ["mindbender", "thriller"], i: "medium", r: 89 },
  { t: "Predestination", y: 2014, m: ["mindbender", "thriller"], i: "medium", r: 97 },
  { t: "Arrival", y: 2016, m: ["mindbender", "tearjerker"], i: "medium", r: 116 },
  { t: "Blade Runner 2049", y: 2017, m: ["mindbender", "thriller"], i: "medium", r: 164 },
  { t: "Annihilation", y: 2018, m: ["mindbender", "horror", "weird"], i: "heavy", r: 115 },
  { t: "The Truman Show", y: 1998, m: ["mindbender", "feelgood", "comedy"], i: "light", r: 103 },
  { t: "The Matrix", y: 1999, m: ["mindbender", "action"], i: "medium", r: 136 },

  // Tearjerkers / drama
  { t: "Grave of the Fireflies", y: 1988, m: ["tearjerker"], i: "extreme", r: 89, l: "ja" },
  { t: "Manchester by the Sea", y: 2016, m: ["tearjerker"], i: "heavy", r: 137 },
  { t: "Requiem for a Dream", y: 2000, m: ["tearjerker", "weird"], i: "extreme", r: 102 },
  { t: "Schindler's List", y: 1993, m: ["tearjerker", "classic"], i: "extreme", r: 195 },
  { t: "Life Is Beautiful", y: 1997, m: ["tearjerker", "feelgood"], i: "heavy", r: 116, l: "it" },
  { t: "Coco", y: 2017, m: ["tearjerker", "feelgood", "easy"], i: "light", r: 105 },
  { t: "Dead Poets Society", y: 1989, m: ["tearjerker", "feelgood"], i: "medium", r: 128 },
  { t: "Stand by Me", y: 1986, m: ["feelgood", "tearjerker", "easy"], i: "light", r: 89 },
  { t: "Whiplash", y: 2014, m: ["thriller", "tearjerker"], i: "heavy", r: 106 },
  { t: "City of God", y: 2002, m: ["thriller", "classic"], i: "heavy", r: 130, l: "pt" },
  { t: "There Will Be Blood", y: 2007, m: ["classic", "thriller"], i: "heavy", r: 158 },

  // Classics / canon
  { t: "12 Angry Men", y: 1957, m: ["classic", "thriller"], i: "medium", r: 96 },
  { t: "Casablanca", y: 1942, m: ["classic", "romance", "date"], i: "light", r: 102 },
  { t: "Rear Window", y: 1954, m: ["classic", "thriller"], i: "medium", r: 112 },
  { t: "Sunset Boulevard", y: 1950, m: ["classic", "thriller"], i: "medium", r: 110 },
  { t: "Seven Samurai", y: 1954, m: ["classic", "action"], i: "medium", r: 207, l: "ja" },
  { t: "Dr. Strangelove", y: 1964, m: ["classic", "comedy", "weird"], i: "light", r: 95 },
  { t: "The Apartment", y: 1960, m: ["classic", "romance", "comedy", "date"], i: "light", r: 125 },
  { t: "Singin' in the Rain", y: 1952, m: ["classic", "feelgood", "date", "easy"], i: "light", r: 103 },
  { t: "North by Northwest", y: 1959, m: ["classic", "thriller", "action"], i: "medium", r: 136 },
  { t: "The Good, the Bad and the Ugly", y: 1966, m: ["classic", "action"], i: "medium", r: 178 },
  { t: "2001: A Space Odyssey", y: 1968, m: ["classic", "mindbender", "weird"], i: "medium", r: 149 },
  { t: "The Godfather", y: 1972, m: ["classic", "thriller"], i: "medium", r: 175 },
  { t: "Chinatown", y: 1974, m: ["classic", "thriller"], i: "medium", r: 130 },
  { t: "Taxi Driver", y: 1976, m: ["classic", "thriller"], i: "heavy", r: 114 },
  { t: "One Flew Over the Cuckoo's Nest", y: 1975, m: ["classic", "tearjerker"], i: "heavy", r: 133 },
  { t: "Jaws", y: 1975, m: ["classic", "thriller", "easy"], i: "medium", r: 124 },
  { t: "Apocalypse Now", y: 1979, m: ["classic", "mindbender"], i: "heavy", r: 147 },
  { t: "Goodfellas", y: 1990, m: ["classic", "thriller"], i: "medium", r: 145 },
  { t: "Pulp Fiction", y: 1994, m: ["classic", "thriller", "comedy"], i: "medium", r: 154 },
  { t: "The Shawshank Redemption", y: 1994, m: ["classic", "feelgood", "tearjerker"], i: "medium", r: 142 },
  { t: "Fight Club", y: 1999, m: ["classic", "mindbender", "thriller"], i: "heavy", r: 139 },
  { t: "The Big Lebowski", y: 1998, m: ["classic", "comedy", "weird", "easy"], i: "light", r: 117 },
  { t: "Léon: The Professional", y: 1994, m: ["classic", "action", "thriller"], i: "medium", r: 110 },
  { t: "Forrest Gump", y: 1994, m: ["classic", "feelgood", "tearjerker", "easy"], i: "light", r: 142 },
  { t: "Ocean's Eleven", y: 2001, m: ["easy", "comedy", "action"], i: "light", r: 116 },
  { t: "Knives Out", y: 2019, m: ["easy", "comedy", "thriller", "date"], i: "light", r: 130 },
];
