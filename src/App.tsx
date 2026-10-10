import { useState } from "react";
import { useGame } from "./game/store";
import { getLocation } from "./game/data";
import type { LocationId } from "./game/types";
import HUD from "./components/HUD";
import Sidebar from "./components/Sidebar";
import CityMap from "./components/CityMap";
import LocationPanel from "./components/LocationPanel";
import Intro from "./screens/Intro";
import GameOver from "./screens/GameOver";

export default function App() {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);

  if (state.phase === "intro") return <Intro />;
  if (state.phase === "won" || state.phase === "lost") return <GameOver />;

  const openLocation = (_id: LocationId) => setOpen(true);

  return (
    <div className="app">
      <HUD />
      <div className="grid">
        <main className="board-stage">
          <CityMap onEnter={openLocation} />
          {open && (
            <div className="loc-overlay" onClick={() => setOpen(false)}>
              <div className="loc-modal" onClick={(e) => e.stopPropagation()}>
                <LocationPanel location={getLocation(state.location)} onBack={() => setOpen(false)} />
              </div>
            </div>
          )}
        </main>
        <Sidebar />
      </div>

      <div className="footer-note">
        Fast Lane — a retro homage to Jones in the Fast Lane ·{" "}
        <button
          onClick={() => {
            if (confirm("Abandon this life and start over?")) dispatch({ type: "RESET" });
          }}
        >
          Restart
        </button>
      </div>
    </div>
  );
}
