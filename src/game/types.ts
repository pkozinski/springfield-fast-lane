// ---- Core domain types for the Springfield life sim ----

export type LocationId =
  | "home"
  | "employment"
  | "plant"
  | "krusty"
  | "lardlad"
  | "university"
  | "bank"
  | "trynsave"
  | "globex"
  | "kwikemart"
  | "bowlarama"
  | "aztec"
  | "moes";

export type LocationCategory =
  | "home"
  | "employment"
  | "workplace"
  | "university"
  | "bank"
  | "shop"
  | "food"
  | "leisure";

export interface Location {
  id: LocationId;
  name: string;
  short: string;
  category: LocationCategory;
  blurb: string;
  /** grid position on the city map (col,row), used for travel time */
  x: number;
  y: number;
  accent: string;
}

export interface Job {
  id: string;
  title: string;
  locationId: LocationId;
  wage: number; // $ per hour
  tier: number; // career ladder level 1..6
  reqCredits: number;
  reqWardrobe: boolean;
  blurb: string;
}

export interface Course {
  id: string;
  name: string;
  credits: number;
  baseCost: number;
  hours: number;
  blurb: string;
}

export type ItemCategory = "wardrobe" | "comfort" | "tech" | "vehicle";

export interface ShopItem {
  id: string;
  name: string;
  locationId: LocationId;
  cost: number;
  happy: number; // one-time happiness bump + ongoing comfort
  wealth: number; // net-worth value retained
  category: ItemCategory;
  blurb: string;
}

export interface FoodItem {
  id: string;
  name: string;
  locationId: LocationId;
  cost: number;
  energy: number;
  happy: number;
  hours: number;
}

export interface LeisureActivity {
  id: string;
  name: string;
  locationId: LocationId;
  cost: number;
  happy: number;
  energy: number;
  hours: number;
  blurb: string;
}

export interface Home {
  id: string;
  name: string;
  rent: number; // per week
  happyPerWeek: number;
  deposit: number; // one-time move-in cost
  blurb: string;
}

export interface Goals {
  wealth: number;
  happiness: number;
  education: number;
  career: number;
}

export interface LogEntry {
  id: number;
  week: number;
  text: string;
  kind: "info" | "good" | "bad" | "money" | "rival";
}

export type Phase = "intro" | "playing" | "won" | "lost";

/** Ned Flanders, the AI neighbour racing you to the same four life goals. */
export interface Rival {
  /** index into RING where his token stands (his house is the pass-through cell) */
  cell: number;
  worth: number;
  credits: number;
  careerLevel: number;
  happiness: number;
  jobTitle: string;
  quote: string;
}

export interface GameState {
  phase: Phase;
  week: number;
  weekLimit: number;
  hours: number; // hours remaining this week
  hoursPerWeek: number;

  cash: number;
  savings: number;
  debt: number;

  happiness: number; // 0..100
  energy: number; // 0..100

  credits: number; // education
  jobId: string | null;
  careerLevel: number; // highest tier ever held

  homeId: string;
  ownedItems: string[];
  hasWardrobe: boolean;

  location: LocationId;
  goals: Goals;

  log: LogEntry[];
  playerName: string;
  avatar: string; // the player's chosen face
  stats: { weeksWorked: number; totalEarned: number };

  rival: Rival;
  /** how the game ended: ran out of weeks, or Flanders got there first */
  lostTo: "time" | "rival" | null;
  /** seeded RNG state, so the reducer stays pure (StrictMode double-invokes it) */
  seed: number;
  /** the post-naming tutorial has been finished or skipped */
  tutorialDone: boolean;
}
