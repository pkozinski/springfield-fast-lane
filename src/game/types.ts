// ---- Core domain types for the Fast Lane life sim ----

export type LocationId =
  | "home"
  | "employment"
  | "factory"
  | "burger"
  | "cafe"
  | "university"
  | "bank"
  | "zmart"
  | "hitech"
  | "grocery"
  | "gym"
  | "cinema"
  | "club";

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
  icon: string;
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
  icon: string;
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
  icon: string;
}

export interface LeisureActivity {
  id: string;
  name: string;
  locationId: LocationId;
  cost: number;
  happy: number;
  energy: number;
  hours: number;
  icon: string;
  blurb: string;
}

export interface Home {
  id: string;
  name: string;
  rent: number; // per week
  happyPerWeek: number;
  deposit: number; // one-time move-in cost
  blurb: string;
  icon: string;
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
  kind: "info" | "good" | "bad" | "money";
}

export type Phase = "intro" | "playing" | "won" | "lost";

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
  stats: { weeksWorked: number; totalEarned: number };
}
