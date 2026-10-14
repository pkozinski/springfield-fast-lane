import type {
  Degree,
  FoodItem,
  Goals,
  Home,
  Job,
  LeisureActivity,
  Location,
  LocationId,
  ShopItem,
} from "./types";

// Global tuning knobs ------------------------------------------------------
export const CONFIG = {
  hoursPerWeek: 55,
  weekLimit: 24,
  startCash: 250,
  savingsRate: 0.015, // weekly interest on savings
  loanRate: 0.05, // weekly interest on debt
  loanLimit: 8000,
  happinessDecayPerWeek: 9,
  energyDecayPerWeek: 10,
  travelHoursPerTile: 0.5, // multiplied by spaces moved
  carTravelDiscount: 0.5, // owning a car halves travel time
  /** Flanders' average weekly gain in net worth (his pace sets the difficulty) */
  rivalWeeklyIncome: 300,
  /** chance per week that Flanders attends 0 / 1 / 2 classes (about 1.1 a week) */
  rivalClassOdds: [0.2, 0.5, 0.3],
  /** classes needed to graduate, and hours per class (a laptop cuts class time 20%) */
  classesPerDegree: 5,
  classHours: 6,
};

export const DEFAULT_GOALS: Goals = {
  wealth: 6000,
  happiness: 80,
  education: 4, // degrees
  career: 5,
};

// Springfield --------------------------------------------------------------
// Laid out clockwise around the board perimeter (5 columns x 4 rows).
// The hollow centre is the town square; the opened location card appears over it.
export const LOCATIONS: Location[] = [
  // top row (left -> right)
  { id: "home", name: "Evergreen Terrace", short: "Home", category: "home", x: 0, y: 0, accent: "#e8826b", blurb: "Plop down on the couch, check your goals, and sleep to end the week." },
  { id: "employment", name: "Springfield Employment Office", short: "Jobs", category: "employment", x: 1, y: 0, accent: "#4a8fd9", blurb: "Take a number. Browse every job in town that'll have you." },
  { id: "university", name: "Springfield University", short: "Uni", category: "university", x: 2, y: 0, accent: "#b8503a", blurb: "Enroll in a degree, attend classes, graduate, and unlock better careers. Nerds welcome." },
  { id: "krusty", name: "Krusty Burger", short: "Krusty", category: "food", x: 3, y: 0, accent: "#e0352b", blurb: "Flip burgers for a paycheck, or grab a combo. Hey hey!" },
  { id: "trynsave", name: "Try-N-Save", short: "Try-N-Save", category: "shop", x: 4, y: 0, accent: "#2f6fd6", blurb: "Discount everything: a sharp suit, home comforts, and retail shifts." },

  // right column (top -> bottom)
  { id: "globex", name: "Globex Corporation", short: "Globex", category: "shop", x: 4, y: 1, accent: "#14a39a", blurb: "Gadgets, gear, and the best-paying careers in town. Don't ask about the volcano." },
  { id: "aztec", name: "Aztec Theater", short: "Aztec", category: "leisure", x: 4, y: 2, accent: "#e08a1e", blurb: "Catch a flick. Tonight: an action-movie double feature." },

  // bottom row (right -> left)
  { id: "moes", name: "Moe's Tavern", short: "Moe's", category: "leisure", x: 4, y: 3, accent: "#7a4b2a", blurb: "Dim, sticky, and always open. A cold Duff will lift your spirits." },
  { id: "bowlarama", name: "Bowl-A-Rama", short: "Bowling", category: "leisure", x: 3, y: 3, accent: "#d94f9a", blurb: "Bowl a few frames to lift your mood and stretch your legs." },
  { id: "kwikemart", name: "Kwik-E-Mart", short: "Kwik-E-Mart", category: "food", x: 2, y: 3, accent: "#2fa35a", blurb: "Thank you, come again! Groceries, Squishees, and day-old hot dogs." },
  { id: "lardlad", name: "Lard Lad Donuts", short: "Lard Lad", category: "food", x: 1, y: 3, accent: "#ef5fa7", blurb: "Mmm... donuts. Counter shifts available." },
  { id: "plant", name: "Springfield Nuclear Power Plant", short: "Power Plant", category: "workplace", x: 0, y: 3, accent: "#7bbf3a", blurb: "Sector 7-G is hiring. No degree required, and it shows." },

  // left column
  { id: "bank", name: "First Bank of Springfield", short: "Bank", category: "bank", x: 0, y: 2, accent: "#2e8b57", blurb: "Save with interest, or borrow to get ahead." },
];

/**
 * The perimeter track, clockwise. Tokens hop from cell to cell along this
 * loop (shortest direction), so movement reads directionally like a board.
 * The cell without an `id` is the Flanders house, a walk-through space.
 */
export const RING: { x: number; y: number; id?: LocationId }[] = [
  { x: 0, y: 0, id: "home" },
  { x: 1, y: 0, id: "employment" },
  { x: 2, y: 0, id: "university" },
  { x: 3, y: 0, id: "krusty" },
  { x: 4, y: 0, id: "trynsave" },
  { x: 4, y: 1, id: "globex" },
  { x: 4, y: 2, id: "aztec" },
  { x: 4, y: 3, id: "moes" },
  { x: 3, y: 3, id: "bowlarama" },
  { x: 2, y: 3, id: "kwikemart" },
  { x: 1, y: 3, id: "lardlad" },
  { x: 0, y: 3, id: "plant" },
  { x: 0, y: 2, id: "bank" },
  { x: 0, y: 1 }, // the Flanders house: pass-through
];

/** Ring index of the Flanders house (where Ned starts and sleeps). */
export const FLANDERS_CELL = RING.length - 1;

export const ringIndex = (id: LocationId) => RING.findIndex((c) => c.id === id);

/** Minimum number of steps around the loop between two locations. */
export function ringDistance(fromId: LocationId, toId: LocationId): number {
  const i = ringIndex(fromId);
  const j = ringIndex(toId);
  if (i < 0 || j < 0) return 0;
  const d = Math.abs(i - j);
  return Math.min(d, RING.length - d);
}

/** The sequence of cells to walk (shortest direction), excluding the start. */
export function ringPath(fromId: LocationId, toId: LocationId): { x: number; y: number }[] {
  const n = RING.length;
  const i = ringIndex(fromId);
  const j = ringIndex(toId);
  if (i < 0 || j < 0 || i === j) return [];
  const fwd = (j - i + n) % n;
  const bwd = (i - j + n) % n;
  const cells: { x: number; y: number }[] = [];
  if (fwd <= bwd) {
    for (let k = 1; k <= fwd; k++) cells.push(RING[(i + k) % n]);
  } else {
    for (let k = 1; k <= bwd; k++) cells.push(RING[(i - k + n) % n]);
  }
  return cells.map((c) => ({ x: c.x, y: c.y }));
}

export function getLocation(id: string): Location {
  const loc = LOCATIONS.find((l) => l.id === id);
  if (!loc) throw new Error(`Unknown location ${id}`);
  return loc;
}

// Career ladder ------------------------------------------------------------
export const JOBS: Job[] = [
  { id: "fry-cook", title: "Krusty Burger Fry Cook", locationId: "krusty", wage: 9, tier: 1, reqDegree: null, reqWardrobe: false, blurb: "Entry level. Don't ask what's in the sauce." },
  { id: "stocker", title: "Stock Clerk", locationId: "trynsave", wage: 11, tier: 2, reqDegree: null, reqWardrobe: false, blurb: "Keep the bargain bins full at Try-N-Save." },
  { id: "safety", title: "Safety Inspector, Sector 7-G", locationId: "plant", wage: 14, tier: 2, reqDegree: null, reqWardrobe: false, blurb: "Mostly involves napping at a console. Solid pay." },
  { id: "donut-chef", title: "Head Donut Chef", locationId: "lardlad", wage: 15, tier: 3, reqDegree: "trade", reqWardrobe: false, blurb: "Run the fryer at Lard Lad. Needs a little training." },
  { id: "teller", title: "Bank Teller", locationId: "bank", wage: 18, tier: 3, reqDegree: "college", reqWardrobe: true, blurb: "A respectable desk job. Dress the part." },
  { id: "store-mgr", title: "Store Manager", locationId: "trynsave", wage: 24, tier: 4, reqDegree: "business", reqWardrobe: true, blurb: "Run the floor at Try-N-Save." },
  { id: "it", title: "Globex IT Specialist", locationId: "globex", wage: 28, tier: 4, reqDegree: "electronics", reqWardrobe: true, blurb: "Keep Globex's systems (and secret lairs) running." },
  { id: "engineer", title: "Globex Engineer", locationId: "globex", wage: 40, tier: 5, reqDegree: "engineering", reqWardrobe: true, blurb: "The fast lane to wealth. Hammocks in the office." },
  { id: "vp", title: "VP of World Domination", locationId: "globex", wage: 58, tier: 6, reqDegree: "grad", reqWardrobe: true, blurb: "Top of the ladder. Great boss, odd hobbies." },
];

export function jobsAt(locationId: string): Job[] {
  return JOBS.filter((j) => j.locationId === locationId);
}

// University ---------------------------------------------------------------
// Like Jones' Hi-Tech U: pay to enroll, attend classes over several visits, then graduate.
// Degrees build on each other, and better jobs ask for a specific one.
export const DEGREES: Degree[] = [
  { id: "trade", name: "Trade School Certificate", short: "Trade School", cost: 150, prereqs: [], blurb: "Hands-on basics. Lard Lad's fryers await." },
  { id: "college", name: "Community College", short: "Community College", cost: 200, prereqs: [], blurb: "General studies. Banks like a diploma on the wall." },
  { id: "electronics", name: "Electronics", short: "Electronics", cost: 300, prereqs: ["trade"], blurb: "Circuits and soldering. Globex IT is hiring." },
  { id: "business", name: "Business Administration", short: "Business Admin", cost: 350, prereqs: ["college"], blurb: "Spreadsheets and synergy, for management roles." },
  { id: "engineering", name: "Nuclear Engineering", short: "Nuclear Eng.", cost: 450, prereqs: ["electronics"], blurb: "The gateway to Globex's engineering jobs." },
  { id: "grad", name: "Graduate School", short: "Grad School", cost: 600, prereqs: ["business", "engineering"], blurb: "The top rung. World domination needs a master's." },
];

// Shop catalogue -----------------------------------------------------------
export const ITEMS: ShopItem[] = [
  { id: "suit", name: "Business Suit", locationId: "trynsave", cost: 220, happy: 6, wealth: 90, category: "wardrobe", blurb: "Required for most professional careers." },
  { id: "couch", name: "New Couch", locationId: "trynsave", cost: 110, happy: 4, wealth: 40, category: "comfort", blurb: "Every family needs a good couch." },
  { id: "massage", name: "Massage Chair", locationId: "trynsave", cost: 160, happy: 6, wealth: 60, category: "comfort", blurb: "Small daily luxury." },
  { id: "tv", name: "Big-Screen TV", locationId: "globex", cost: 650, happy: 14, wealth: 300, category: "tech", blurb: "Cartoon marathons in glorious widescreen." },
  { id: "console", name: "Bonestorm Console", locationId: "globex", cost: 520, happy: 13, wealth: 240, category: "tech", blurb: "The game everyone's talking about." },
  { id: "laptop", name: "Laptop", locationId: "globex", cost: 1200, happy: 10, wealth: 650, category: "tech", blurb: "Study faster: classes take 20% less time." },
  { id: "phone", name: "Smartphone", locationId: "globex", cost: 900, happy: 12, wealth: 450, category: "tech", blurb: "Stay connected." },
  { id: "car", name: "The Homer", locationId: "globex", cost: 5200, happy: 22, wealth: 3800, category: "vehicle", blurb: "Bubble dome, three horns, and half the travel time." },
];

export function itemsAt(locationId: string): ShopItem[] {
  return ITEMS.filter((i) => i.locationId === locationId);
}

export function getItem(id: string): ShopItem {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) throw new Error(`Unknown item ${id}`);
  return it;
}

// Food ---------------------------------------------------------------------
export const FOODS: FoodItem[] = [
  { id: "krusty-combo", name: "Krusty Burger Combo", locationId: "krusty", cost: 12, energy: 35, happy: 4, hours: 1 },
  { id: "donuts", name: "Box of Donuts", locationId: "lardlad", cost: 16, energy: 32, happy: 6, hours: 1 },
  { id: "groceries", name: "Week of Groceries", locationId: "kwikemart", cost: 55, energy: 55, happy: 3, hours: 2 },
  { id: "squishee", name: "Squishee", locationId: "kwikemart", cost: 8, energy: 15, happy: 1, hours: 1 },
];

export function foodsAt(locationId: string): FoodItem[] {
  return FOODS.filter((f) => f.locationId === locationId);
}

// Leisure ------------------------------------------------------------------
export const LEISURE: LeisureActivity[] = [
  { id: "bowling", name: "Bowl a Few Frames", locationId: "bowlarama", cost: 22, happy: 9, energy: 12, hours: 2, blurb: "Mood and energy boost." },
  { id: "movie", name: "Catch a Movie", locationId: "aztec", cost: 18, happy: 16, energy: -4, hours: 3, blurb: "Explosions, one-liners, popcorn." },
  { id: "matinee", name: "Cartoon Matinee", locationId: "aztec", cost: 10, happy: 10, energy: -2, hours: 2, blurb: "Cheap and cheerful." },
  { id: "flaming", name: "Flaming Moe", locationId: "moes", cost: 15, happy: 10, energy: -4, hours: 2, blurb: "The house special. Secret recipe." },
  { id: "night-out", name: "Night Out at Moe's", locationId: "moes", cost: 60, happy: 30, energy: -18, hours: 4, blurb: "Huge happiness hit, but it wipes you out." },
];

export function leisureAt(locationId: string): LeisureActivity[] {
  return LEISURE.filter((l) => l.locationId === locationId);
}

// Housing ------------------------------------------------------------------
export const HOMES: Home[] = [
  { id: "room", name: "Room Above Moe's", rent: 180, happyPerWeek: 0, deposit: 0, blurb: "Cramped, cheap, and it smells like Duff." },
  { id: "apartment", name: "Springfield Apartment", rent: 360, happyPerWeek: 4, deposit: 360, blurb: "A comfortable one-bedroom." },
  { id: "condo", name: "Gorge-View Condo", rent: 680, happyPerWeek: 9, deposit: 680, blurb: "Stylish living with a view of Springfield Gorge." },
  { id: "house", name: "742 Evergreen Terrace", rent: 1150, happyPerWeek: 16, deposit: 1150, blurb: "The dream: a two-car garage, a couch, and Flanders next door." },
];

export function getHome(id: string): Home {
  const h = HOMES.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown home ${id}`);
  return h;
}

export function getJob(id: string): Job {
  const j = JOBS.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown job ${id}`);
  return j;
}

export function getDegree(id: string): Degree {
  const d = DEGREES.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown degree ${id}`);
  return d;
}

// Ned Flanders -------------------------------------------------------------
/** Ned's own career ladder, climbed as his degrees pile up. */
export const RIVAL_JOBS: { tier: number; reqDegrees: number; title: string }[] = [
  { tier: 1, reqDegrees: 0, title: "Leftorium Clerk" },
  { tier: 2, reqDegrees: 1, title: "Leftorium Shift Lead" },
  { tier: 3, reqDegrees: 2, title: "Leftorium Owner" },
  { tier: 4, reqDegrees: 3, title: "Leftorium Franchiser" },
  { tier: 5, reqDegrees: 4, title: "Left-Handed Tycoon" },
];
/** The degrees Ned works through, in order (he's a model student, so no prerequisites to juggle). */
export const RIVAL_DEGREES = ["Sunday School Teaching", "Left-Handed Retail", "Bookkeeping", "Theology", "Pastoral Counseling", "Divinity"];

export const RIVAL_QUOTES = [
  "Hi-diddly-ho, neighborino!",
  "Okily-dokily!",
  "Well, sweet baby lima beans!",
  "Hidely-ho! Just popped a little extra in the ol' savings!",
  "Diddly-darn good week down at the Leftorium!",
  "Feeling scrumdiddlyumptious today!",
  "Another course done. Learning is fun-diddly-un!",
  "Thank you, Lord, for this fine week!",
  "Mmm-diddly-mmm, Maude's casserole fuels the soul!",
  "Don't you worry, neighbor, slow and steady wins the race!",
];
