import { useState } from "react";
import { useGame } from "./game/store";
import { getLocation } from "./game/data";
import type { LocationId } from "./game/types";
import HUD from "./components/HUD";
import Sidebar from "./components/Sidebar";
import Board from "./components/Board";
import LocationPanel from "./components/LocationPanel";
import { PortraitDefs } from "./components/Portrait";
import Intro from "./screens/Intro";
import GameOver from "./screens/GameOver";
import Tutorial from "./components/Tutorial";

export default function App() {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(false);

  const openLocation = (_id: LocationId) => setOpen(true);

  let body: React.ReactNode;
  if (state.phase === "intro") {
    body = <Intro />;
  } else if (state.phase === "won" || state.phase === "lost") {
    body = <GameOver />;
  } else {
    body = (
      <div className="app">
        <HUD />
        <div className="grid">
          <main className="board-stage">
            <Board onEnter={openLocation} paused={open} />
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
        {!state.tutorialDone && <Tutorial />}

        <div className="footer-note">
          Springfield Fast Lane · a fan-made homage to Jones in the Fast Lane ·{" "}
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

  return (
    <>
      <PortraitDefs />
      {body}
    </>
  );
}
