import type {
  Course,
  FoodItem,
  Goals,
  Home,
  Job,
  LeisureActivity,
  Location,
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
  travelHoursPerTile: 0.5, // multiplied by Manhattan distance
  carTravelDiscount: 0.5, // owning a car halves travel time
};

export const DEFAULT_GOALS: Goals = {
  wealth: 6000,
  happiness: 80,
  education: 8,
  career: 5,
};

// City map -----------------------------------------------------------------
// Laid out clockwise around the board perimeter (5 columns x 4 rows).
// The hollow centre is where the opened location panel appears.
export const LOCATIONS: Location[] = [
  // top row (left -> right)
  { id: "home", name: "Your Place", short: "Home", category: "home", icon: "🏠", x: 0, y: 0, accent: "#7c5cff", blurb: "Rest, check your life goals, and sleep to end the week." },
  { id: "employment", name: "Careers Hub", short: "Careers", category: "employment", icon: "💼", x: 1, y: 0, accent: "#38bdf8", blurb: "Browse and apply for jobs that match your skills." },
  { id: "university", name: "City University", short: "Uni", category: "university", icon: "🎓", x: 2, y: 0, accent: "#f59e0b", blurb: "Enroll in courses to earn credits and unlock better careers." },
  { id: "burger", name: "Monolith Burger", short: "Burger", category: "food", icon: "🍔", x: 3, y: 0, accent: "#fb923c", blurb: "Flip burgers for a paycheck — or just grab a quick meal." },
  { id: "zmart", name: "Z-Mart", short: "Z-Mart", category: "shop", icon: "🛒", x: 4, y: 0, accent: "#60a5fa", blurb: "Everyday goods, a sharp wardrobe, and retail jobs." },

  // right column (top -> bottom)
  { id: "hitech", name: "Hi-Tech Systems", short: "Hi-Tech", category: "shop", icon: "💻", x: 4, y: 1, accent: "#22d3ee", blurb: "Buy modern gear — and the best-paying careers in town." },
  { id: "cinema", name: "The Black Hole", short: "Cinema", category: "leisure", icon: "🎬", x: 4, y: 2, accent: "#c084fc", blurb: "Movies, streaming lounges, and good vibes." },

  // bottom row (right -> left)
  { id: "club", name: "Neon Club", short: "Club", category: "leisure", icon: "🪩", x: 4, y: 3, accent: "#e879f9", blurb: "A big night out for a big happiness boost." },
  { id: "gym", name: "Pulse Gym", short: "Gym", category: "leisure", icon: "💪", x: 3, y: 3, accent: "#f472b6", blurb: "Work out to recharge energy and lift your mood." },
  { id: "grocery", name: "Pay 'n Save", short: "Grocery", category: "food", icon: "🥦", x: 2, y: 3, accent: "#4ade80", blurb: "Cheap groceries to keep your energy topped up." },
  { id: "cafe", name: "Socino's Café", short: "Café", category: "food", icon: "☕", x: 1, y: 3, accent: "#a78bfa", blurb: "Barista gigs and a decent espresso." },
  { id: "factory", name: "Apex Logistics", short: "Factory", category: "workplace", icon: "🏭", x: 0, y: 3, accent: "#f87171", blurb: "Hard, steady work. No degree required." },

  // left column
  { id: "bank", name: "Vertex Bank", short: "Bank", category: "bank", icon: "🏦", x: 0, y: 2, accent: "#34d399", blurb: "Save with interest, or borrow to get ahead." },
];

/** Non-interactive building-sized scenery that fills an empty board cell (col,row). */
export const DECORATIONS: { x: number; y: number; icon: string; name: string }[] = [
  { x: 0, y: 1, icon: "🌳", name: "City Park" },
];

/** Freely-placed greenery scattered across the grounds (percentage positions). */
export const SCENERY: { left: number; top: number; icon: string; size: number }[] = [
  { left: 30, top: 30, icon: "🌳", size: 1.1 },
  { left: 70, top: 30, icon: "🌲", size: 1 },
  { left: 50, top: 24, icon: "🌳", size: 0.9 },
  { left: 28, top: 70, icon: "🌲", size: 1 },
  { left: 72, top: 70, icon: "🌳", size: 1.1 },
  { left: 50, top: 76, icon: "🌲", size: 0.9 },
  { left: 40, top: 50, icon: "🌸", size: 0.7 },
  { left: 61, top: 50, icon: "🌷", size: 0.7 },
  { left: 50, top: 50, icon: "⛲", size: 1.2 },
];

/** Face options for the player's character. */
export const AVATARS = ["🧑", "👩", "🧔", "👱‍♀️", "👨‍🦱", "👩‍🦰", "🧓", "👨‍🦲", "👩‍🦳", "🧑‍🎤"];

/** Board dimensions derived from the furthest location coordinates. */
export const BOARD_COLS = Math.max(...LOCATIONS.map((l) => l.x)) + 1;
export const BOARD_ROWS = Math.max(...LOCATIONS.map((l) => l.y)) + 1;

export function getLocation(id: string): Location {
  const loc = LOCATIONS.find((l) => l.id === id);
  if (!loc) throw new Error(`Unknown location ${id}`);
  return loc;
}

// Career ladder ------------------------------------------------------------
export const JOBS: Job[] = [
  { id: "burger-cook", title: "Burger Cook", locationId: "burger", wage: 9, tier: 1, reqCredits: 0, reqWardrobe: false, blurb: "Entry-level. Everyone starts somewhere." },
  { id: "stocker", title: "Stock Clerk", locationId: "zmart", wage: 11, tier: 2, reqCredits: 0, reqWardrobe: false, blurb: "Keep the shelves full at Z-Mart." },
  { id: "line-worker", title: "Line Worker", locationId: "factory", wage: 14, tier: 2, reqCredits: 0, reqWardrobe: false, blurb: "Tough physical work, solid pay." },
  { id: "barista", title: "Head Barista", locationId: "cafe", wage: 15, tier: 3, reqCredits: 2, reqWardrobe: false, blurb: "Run the café bar. Needs a little training." },
  { id: "teller", title: "Bank Teller", locationId: "bank", wage: 18, tier: 3, reqCredits: 3, reqWardrobe: true, blurb: "A respectable desk job. Dress the part." },
  { id: "retail-mgr", title: "Retail Manager", locationId: "zmart", wage: 24, tier: 4, reqCredits: 5, reqWardrobe: true, blurb: "Run the store floor at Z-Mart." },
  { id: "support", title: "IT Specialist", locationId: "hitech", wage: 28, tier: 4, reqCredits: 6, reqWardrobe: true, blurb: "Keep Hi-Tech's systems running." },
  { id: "engineer", title: "Software Engineer", locationId: "hitech", wage: 40, tier: 5, reqCredits: 9, reqWardrobe: true, blurb: "The fast lane to wealth. Highly skilled." },
  { id: "cto", title: "Chief Technologist", locationId: "hitech", wage: 58, tier: 6, reqCredits: 13, reqWardrobe: true, blurb: "Top of the ladder. The dream job." },
];

export function jobsAt(locationId: string): Job[] {
  return JOBS.filter((j) => j.locationId === locationId);
}

// University ---------------------------------------------------------------
export const COURSES: Course[] = [
  { id: "foundations", name: "Foundations", credits: 1, baseCost: 180, hours: 6, blurb: "Core skills to get started." },
  { id: "business", name: "Business & Finance", credits: 2, baseCost: 420, hours: 10, blurb: "Open the door to management roles." },
  { id: "comp-sci", name: "Computer Science", credits: 3, baseCost: 780, hours: 14, blurb: "The gateway to high-paying tech careers." },
];

// Shop catalogue -----------------------------------------------------------
export const ITEMS: ShopItem[] = [
  { id: "wardrobe", name: "Professional Wardrobe", locationId: "zmart", cost: 220, happy: 6, wealth: 90, category: "wardrobe", icon: "👔", blurb: "Required for most professional careers." },
  { id: "microwave", name: "Microwave", locationId: "zmart", cost: 110, happy: 4, wealth: 40, category: "comfort", icon: "🍲", blurb: "Hot meals at home." },
  { id: "coffeemaker", name: "Espresso Machine", locationId: "zmart", cost: 160, happy: 6, wealth: 60, category: "comfort", icon: "☕", blurb: "Small daily luxury." },
  { id: "tv", name: "4K TV", locationId: "hitech", cost: 650, happy: 14, wealth: 300, category: "tech", icon: "📺", blurb: "Big-screen bliss." },
  { id: "console", name: "Game Console", locationId: "hitech", cost: 520, happy: 13, wealth: 240, category: "tech", icon: "🎮", blurb: "Hours of entertainment." },
  { id: "laptop", name: "Laptop", locationId: "hitech", cost: 1200, happy: 10, wealth: 650, category: "tech", icon: "💻", blurb: "Study faster and work from home." },
  { id: "phone", name: "Smartphone", locationId: "hitech", cost: 900, happy: 12, wealth: 450, category: "tech", icon: "📱", blurb: "Stay connected." },
  { id: "car", name: "Electric Car", locationId: "hitech", cost: 5200, happy: 22, wealth: 3800, category: "vehicle", icon: "🚗", blurb: "Cuts your travel time across the city in half." },
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
  { id: "burger-meal", name: "Burger Combo", locationId: "burger", cost: 12, energy: 35, happy: 4, hours: 1, icon: "🍔" },
  { id: "cafe-meal", name: "Café Lunch", locationId: "cafe", cost: 16, energy: 32, happy: 6, hours: 1, icon: "🥪" },
  { id: "groceries", name: "Week of Groceries", locationId: "grocery", cost: 55, energy: 55, happy: 3, hours: 2, icon: "🛍️" },
  { id: "snack", name: "Quick Snack", locationId: "grocery", cost: 8, energy: 15, happy: 1, hours: 1, icon: "🍎" },
];

export function foodsAt(locationId: string): FoodItem[] {
  return FOODS.filter((f) => f.locationId === locationId);
}

// Leisure ------------------------------------------------------------------
export const LEISURE: LeisureActivity[] = [
  { id: "workout", name: "Workout Session", locationId: "gym", cost: 22, happy: 9, energy: 12, hours: 2, icon: "💪", blurb: "Mood and energy boost." },
  { id: "movie", name: "Catch a Movie", locationId: "cinema", cost: 18, happy: 16, energy: -4, hours: 3, icon: "🎬", blurb: "Classic relaxation." },
  { id: "stream", name: "Streaming Lounge", locationId: "cinema", cost: 10, happy: 10, energy: -2, hours: 2, icon: "📺", blurb: "Cheap and cheerful." },
  { id: "night-out", name: "Night Out", locationId: "club", cost: 60, happy: 30, energy: -18, hours: 4, icon: "🪩", blurb: "Huge happiness hit, but it wipes you out." },
];

export function leisureAt(locationId: string): LeisureActivity[] {
  return LEISURE.filter((l) => l.locationId === locationId);
}

// Housing ------------------------------------------------------------------
export const HOMES: Home[] = [
  { id: "studio", name: "Rented Studio", rent: 180, happyPerWeek: 0, deposit: 0, icon: "🛏️", blurb: "Cramped but cheap. Your starting place." },
  { id: "apartment", name: "City Apartment", rent: 360, happyPerWeek: 4, deposit: 360, icon: "🏢", blurb: "A comfortable one-bedroom." },
  { id: "condo", name: "Modern Condo", rent: 680, happyPerWeek: 9, deposit: 680, icon: "🌆", blurb: "Stylish living with a view." },
  { id: "house", name: "Suburban House", rent: 1150, happyPerWeek: 16, deposit: 1150, icon: "🏡", blurb: "Space, comfort, and status." },
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

export function getCourse(id: string): Course {
  const c = COURSES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown course ${id}`);
  return c;
}
