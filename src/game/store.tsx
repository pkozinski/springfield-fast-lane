import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { initialState, reducer, seedLogSeq, type GameAction } from "./engine";
import type { GameState } from "./types";
import { DEFAULT_GOALS } from "./data";

const KEY = "springfield.save.v1";

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      // guard against stale saves from older versions
      if (parsed && typeof parsed.week === "number" && parsed.goals && parsed.rival) {
        // saves from before the tutorial existed skip it
        if (parsed.tutorialDone === undefined) parsed.tutorialDone = true;
        // Globex became the Springfield Mall
        if ((parsed.location as string) === "globex") parsed.location = "mall";
        // saves from the old credits system start the degree track fresh
        if (!Array.isArray(parsed.degrees)) {
          const old = parsed as GameState & { credits?: number; rival: { credits?: number } };
          delete old.credits;
          delete old.rival.credits;
          parsed.degrees = [];
          parsed.enrolled = {};
          parsed.rival.degrees = 0;
          parsed.rival.sessions = 0;
          parsed.goals.education = DEFAULT_GOALS.education;
        }
        seedLogSeq(parsed.log ?? []);
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt saves */
  }
  return initialState();
}

interface Ctx {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [state]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): Ctx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
