import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import { initialState, reducer, seedLogSeq, type GameAction } from "./engine";
import type { GameState } from "./types";

const KEY = "fastlane.save.v1";

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      // guard against stale saves from older versions
      if (parsed && typeof parsed.week === "number" && parsed.goals) {
        // migrate pre-portrait saves (old emoji avatars) to a portrait id
        if (!parsed.avatar || !parsed.avatar.startsWith("p")) parsed.avatar = "p0";
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
