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
  const [view, setView] = useState<"map" | "location">("map");

  if (state.phase === "intro") return <Intro />;
  if (state.phase === "won" || state.phase === "lost") return <GameOver />;

  const openLocation = (id: LocationId) => {
    void id;
    setView("location");
  };

  return (
    <div className="app">
      <HUD />
      <div className="grid">
        <main>
          {view === "map" ? (
            <CityMap onEnter={openLocation} />
          ) : (
            <LocationPanel location={getLocation(state.location)} onBack={() => setView("map")} />
          )}
        </main>
        <Sidebar />
      </div>

      <div className="footer-note">
        Fast Lane — a modern homage to Jones in the Fast Lane ·{" "}
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
