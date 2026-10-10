import { useState } from "react";
import { useGame } from "../game/store";
import { CONFIG, DEFAULT_GOALS } from "../game/data";

export default function Intro() {
  const { dispatch } = useGame();
  const [name, setName] = useState("");

  return (
    <div className="center-stage">
      <div className="hero">
        <div className="kicker">Life, in the fast lane</div>
        <h1>Fast Lane</h1>
        <p>
          A modern life sim inspired by the 1990 classic. You've got {CONFIG.weekLimit} weeks to build
          wealth, climb a career, earn your education, and actually be happy. Work, study, shop, invest,
          and manage your time — the clock never stops.
        </p>

        <form
          className="name-row"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "START", name });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={18}
            autoFocus
          />
          <button className="btn" type="submit">
            Start →
          </button>
        </form>

        <div className="goal-chips">
          <span className="chip">
            Goal: <b>${DEFAULT_GOALS.wealth.toLocaleString()}</b> net worth
          </span>
          <span className="chip">
            <b>Level {DEFAULT_GOALS.career}</b> career
          </span>
          <span className="chip">
            <b>{DEFAULT_GOALS.education}</b> credits
          </span>
          <span className="chip">
            <b>{DEFAULT_GOALS.happiness}</b> happiness
          </span>
        </div>
      </div>
    </div>
  );
}
