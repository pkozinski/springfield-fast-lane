import { useState } from "react";
import { useGame } from "./game/store";
import { getLocation } from "./game/data";
import type { LocationId } from "./game/types";
import HUD from "./components/HUD";
import Sidebar, { LogPanel, Toasts } from "./components/Sidebar";
import CityMap from "./components/CityMap";
import LocationPanel from "./components/LocationPanel";
import { PortraitDefs } from "./components/Portrait";
import Intro from "./screens/Intro";
import GameOver from "./screens/GameOver";

export default function App() {
  const { state } = useGame();
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const openLocation = (_id: LocationId) => setOpen(true);

  let body: React.ReactNode;
  if (state.phase === "intro") {
    body = <Intro />;
  } else if (state.phase === "won" || state.phase === "lost") {
    body = <GameOver />;
  } else {
    body = (
      <div className="game">
        <CityMap onEnter={openLocation} />
        <HUD onLog={() => setLogOpen((v) => !v)} logOpen={logOpen} />
        <Sidebar />
        <Toasts />
        {logOpen && <LogPanel onClose={() => setLogOpen(false)} />}
        {open && (
          <div className="loc-overlay" onClick={() => setOpen(false)}>
            <div className="loc-modal" onClick={(e) => e.stopPropagation()}>
              <LocationPanel location={getLocation(state.location)} onBack={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PortraitDefs />
      {body}
    </>
  );
}
