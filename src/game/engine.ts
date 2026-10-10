import {
  CONFIG,
  DEFAULT_GOALS,
  FOODS,
  LEISURE,
  getCourse,
  getHome,
  getItem,
  getJob,
  getLocation,
} from "./data";
import type { GameState, Goals, LocationId, LogEntry } from "./types";

function getFood(id: string) {
  const f = FOODS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown food ${id}`);
  return f;
}
function getLeisure(id: string) {
  const l = LEISURE.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown leisure ${id}`);
  return l;
}

export type GameAction =
  | { type: "START"; name: string }
  | { type: "RESET" }
  | { type: "MOVE"; to: LocationId }
  | { type: "WORK"; hours: number }
  | { type: "APPLY"; jobId: string }
  | { type: "STUDY"; courseId: string }
  | { type: "BUY_ITEM"; itemId: string }
  | { type: "EAT"; foodId: string }
  | { type: "LEISURE"; activityId: string }
  | { type: "DEPOSIT"; amount: number }
  | { type: "WITHDRAW"; amount: number }
  | { type: "BORROW"; amount: number }
  | { type: "REPAY"; amount: number }
  | { type: "MOVE_HOME"; homeId: string }
  | { type: "SLEEP" };

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

let logSeq = 0;

/** Keep new log ids above anything in a restored save (avoids key collisions). */
export function seedLogSeq(entries: LogEntry[]) {
  logSeq = entries.reduce((m, e) => Math.max(m, e.id), logSeq);
}

export function initialState(): GameState {
  return {
    phase: "intro",
    week: 1,
    weekLimit: CONFIG.weekLimit,
    hours: CONFIG.hoursPerWeek,
    hoursPerWeek: CONFIG.hoursPerWeek,
    cash: CONFIG.startCash,
    savings: 0,
    debt: 0,
    happiness: 55,
    energy: 80,
    credits: 0,
    jobId: null,
    careerLevel: 0,
    homeId: "studio",
    ownedItems: [],
    hasWardrobe: false,
    location: "home",
    goals: { ...DEFAULT_GOALS },
    log: [],
    playerName: "You",
    stats: { weeksWorked: 0, totalEarned: 0 },
  };
}

export function netWorth(s: GameState): number {
  const items = s.ownedItems.reduce((sum, id) => sum + getItem(id).wealth, 0);
  return Math.round(s.cash + s.savings + items - s.debt);
}

export function goalProgress(s: GameState): Record<keyof Goals, number> {
  return {
    wealth: clamp((netWorth(s) / s.goals.wealth) * 100),
    happiness: clamp((s.happiness / s.goals.happiness) * 100),
    education: clamp((s.credits / s.goals.education) * 100),
    career: clamp((s.careerLevel / s.goals.career) * 100),
  };
}

export function goalsMet(s: GameState): boolean {
  return (
    netWorth(s) >= s.goals.wealth &&
    s.happiness >= s.goals.happiness &&
    s.credits >= s.goals.education &&
    s.careerLevel >= s.goals.career
  );
}

export function travelCost(s: GameState, to: LocationId): number {
  if (to === s.location) return 0;
  const a = getLocation(s.location);
  const b = getLocation(to);
  const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  let hours = dist * CONFIG.travelHoursPerTile;
  if (s.ownedItems.includes("car")) hours *= CONFIG.carTravelDiscount;
  return Math.max(0.5, round1(hours));
}

function log(s: GameState, text: string, kind: LogEntry["kind"] = "info") {
  s.log = [{ id: ++logSeq, week: s.week, text, kind }, ...s.log].slice(0, 60);
}

// ---- week rollover -------------------------------------------------------
function endWeek(s: GameState) {
  const home = getHome(s.homeId);

  // Rent
  let owed = home.rent;
  const fromCash = Math.min(s.cash, owed);
  s.cash -= fromCash;
  owed -= fromCash;
  if (owed > 0) {
    const fromSavings = Math.min(s.savings, owed);
    s.savings -= fromSavings;
    owed -= fromSavings;
  }
  if (owed > 0) {
    s.debt += owed;
    s.happiness = clamp(s.happiness - 12);
    log(s, `Couldn't cover $${home.rent} rent — $${Math.round(owed)} added to debt.`, "bad");
  } else {
    log(s, `Paid $${home.rent} rent for the ${home.name}.`, "money");
  }

  // Interest
  if (s.savings > 0) {
    const interest = Math.round(s.savings * CONFIG.savingsRate);
    if (interest > 0) {
      s.savings += interest;
      log(s, `Earned $${interest} savings interest.`, "good");
    }
  }
  if (s.debt > 0) {
    const interest = Math.round(s.debt * CONFIG.loanRate);
    s.debt += interest;
    if (interest > 0) log(s, `Debt grew by $${interest} in interest.`, "bad");
  }

  // Mood + energy drift
  s.happiness = clamp(s.happiness - CONFIG.happinessDecayPerWeek + home.happyPerWeek);
  s.energy = clamp(s.energy - CONFIG.energyDecayPerWeek);
  if (s.energy < 20) {
    s.happiness = clamp(s.happiness - 6);
    log(s, "You're running on empty — eat more next week.", "bad");
  }

  s.week += 1;
  s.hours = s.hoursPerWeek;
  s.location = "home";

  if (goalsMet(s)) {
    s.phase = "won";
    log(s, "🎉 You hit every life goal. You made it to the fast lane!", "good");
  } else if (s.week > s.weekLimit) {
    s.phase = "lost";
    log(s, "⏳ Time's up. The clock ran out on your goals.", "bad");
  } else {
    log(s, `— Week ${s.week} begins —`, "info");
  }
}

// ---- reducer -------------------------------------------------------------
export function reducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESET") return initialState();
  if (action.type === "START") {
    const s = initialState();
    s.phase = "playing";
    s.playerName = action.name.trim() || "You";
    log(s, `Week 1. ${s.playerName} arrives in the city with $${s.cash}. Time to make it.`, "info");
    return s;
  }

  if (state.phase !== "playing") return state;
  const s: GameState = {
    ...state,
    ownedItems: [...state.ownedItems],
    log: state.log,
    goals: state.goals,
    stats: { ...state.stats },
  };

  switch (action.type) {
    case "MOVE": {
      const cost = travelCost(s, action.to);
      if (cost > s.hours) {
        log(s, "Not enough hours left this week to travel there. Head home and sleep.", "bad");
        break;
      }
      s.hours = round1(s.hours - cost);
      s.location = action.to;
      break;
    }

    case "WORK": {
      const job = s.jobId ? getJob(s.jobId) : null;
      if (!job) {
        log(s, "You don't have a job yet. Visit the Careers Hub.", "bad");
        break;
      }
      if (s.location !== job.locationId) break;
      const want = Math.max(1, Math.floor(action.hours));
      const can = Math.min(want, Math.floor(s.hours));
      if (can <= 0) {
        log(s, "No hours left to work this week.", "bad");
        break;
      }
      if (s.energy < 10) {
        log(s, "You're too exhausted to work. Grab some food first.", "bad");
        break;
      }
      const pay = can * job.wage;
      s.cash += pay;
      s.hours = round1(s.hours - can);
      s.energy = clamp(s.energy - can * 3);
      s.happiness = clamp(s.happiness - can * 0.6);
      s.stats.totalEarned += pay;
      s.stats.weeksWorked += 1;
      log(s, `Worked ${can}h as ${job.title} — earned $${pay}.`, "money");
      break;
    }

    case "APPLY": {
      const job = getJob(action.jobId);
      if (s.credits < job.reqCredits) {
        log(s, `${job.title} needs ${job.reqCredits} credits. You have ${s.credits}.`, "bad");
        break;
      }
      if (job.reqWardrobe && !s.hasWardrobe) {
        log(s, `${job.title} requires a professional wardrobe (buy one at Z-Mart).`, "bad");
        break;
      }
      if (s.jobId === job.id) {
        log(s, `You already work as ${job.title}.`, "info");
        break;
      }
      s.jobId = job.id;
      s.careerLevel = Math.max(s.careerLevel, job.tier);
      s.happiness = clamp(s.happiness + 4);
      log(s, `Hired as ${job.title} at $${job.wage}/hr! (Career level ${job.tier})`, "good");
      break;
    }

    case "STUDY": {
      const course = getCourse(action.courseId);
      const cost = course.baseCost + s.credits * 40;
      const discount = s.ownedItems.includes("laptop") ? 0.8 : 1;
      const hours = Math.ceil(course.hours * discount);
      if (s.cash < cost) {
        log(s, `Need $${cost} for ${course.name}. You have $${s.cash}.`, "bad");
        break;
      }
      if (hours > s.hours) {
        log(s, `${course.name} takes ${hours}h — not enough time left this week.`, "bad");
        break;
      }
      s.cash -= cost;
      s.hours = round1(s.hours - hours);
      s.energy = clamp(s.energy - hours * 2);
      s.credits += course.credits;
      log(s, `Completed ${course.name}: +${course.credits} credits (now ${s.credits}). Paid $${cost}.`, "good");
      break;
    }

    case "BUY_ITEM": {
      const item = getItem(action.itemId);
      if (s.ownedItems.includes(item.id)) {
        log(s, `You already own a ${item.name}.`, "info");
        break;
      }
      if (s.cash < item.cost) {
        log(s, `Need $${item.cost} for the ${item.name}.`, "bad");
        break;
      }
      s.cash -= item.cost;
      s.ownedItems.push(item.id);
      if (item.category === "wardrobe") s.hasWardrobe = true;
      s.happiness = clamp(s.happiness + item.happy);
      log(s, `Bought a ${item.name} for $${item.cost}. +${item.happy} happiness.`, "money");
      break;
    }

    case "EAT": {
      const food = getFood(action.foodId);
      if (s.cash < food.cost) {
        log(s, `Need $${food.cost} for ${food.name}.`, "bad");
        break;
      }
      if (food.hours > s.hours) {
        log(s, "No time left to eat this week.", "bad");
        break;
      }
      s.cash -= food.cost;
      s.hours = round1(s.hours - food.hours);
      s.energy = clamp(s.energy + food.energy);
      s.happiness = clamp(s.happiness + food.happy);
      log(s, `Ate ${food.name}: +${food.energy} energy.`, "money");
      break;
    }

    case "LEISURE": {
      const act = getLeisure(action.activityId);
      if (s.cash < act.cost) {
        log(s, `Need $${act.cost} for ${act.name}.`, "bad");
        break;
      }
      if (act.hours > s.hours) {
        log(s, `${act.name} takes ${act.hours}h — not enough time left.`, "bad");
        break;
      }
      s.cash -= act.cost;
      s.hours = round1(s.hours - act.hours);
      s.happiness = clamp(s.happiness + act.happy);
      s.energy = clamp(s.energy + act.energy);
      log(s, `${act.name}: +${act.happy} happiness.`, "money");
      break;
    }

    case "DEPOSIT": {
      const amt = Math.floor(action.amount);
      if (amt <= 0 || s.cash < amt) break;
      s.cash -= amt;
      s.savings += amt;
      log(s, `Deposited $${amt} into savings.`, "money");
      break;
    }

    case "WITHDRAW": {
      const amt = Math.floor(action.amount);
      if (amt <= 0 || s.savings < amt) break;
      s.savings -= amt;
      s.cash += amt;
      log(s, `Withdrew $${amt} from savings.`, "money");
      break;
    }

    case "BORROW": {
      const amt = Math.floor(action.amount);
      if (amt <= 0) break;
      if (s.debt + amt > CONFIG.loanLimit) {
        log(s, `Loan limit is $${CONFIG.loanLimit}. Request denied.`, "bad");
        break;
      }
      s.debt += amt;
      s.cash += amt;
      log(s, `Borrowed $${amt} at ${Math.round(CONFIG.loanRate * 100)}%/wk.`, "money");
      break;
    }

    case "REPAY": {
      const amt = Math.min(Math.floor(action.amount), s.debt, s.cash);
      if (amt <= 0) break;
      s.cash -= amt;
      s.debt -= amt;
      log(s, `Repaid $${amt} of debt.`, "money");
      break;
    }

    case "MOVE_HOME": {
      const home = getHome(action.homeId);
      if (home.id === s.homeId) break;
      if (s.cash < home.deposit) {
        log(s, `Need a $${home.deposit} deposit to move into the ${home.name}.`, "bad");
        break;
      }
      s.cash -= home.deposit;
      s.homeId = home.id;
      s.happiness = clamp(s.happiness + 6);
      log(s, `Moved into the ${home.name} (rent $${home.rent}/wk).`, "good");
      break;
    }

    case "SLEEP": {
      if (s.location !== "home") {
        log(s, "You can only sleep at home. Head back first.", "bad");
        break;
      }
      s.energy = clamp(s.energy + 18);
      endWeek(s);
      break;
    }
  }

  return s;
}
