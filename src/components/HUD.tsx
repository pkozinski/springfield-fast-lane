import { useGame } from "../game/store";
import { netWorth } from "../game/engine";
import { Portrait } from "./Portrait";
import Clock from "./Clock";

export default function HUD() {
  const { state, dispatch } = useGame();
  const worth = netWorth(state);
  return (
    <header className="hud">
      <div className="player">
        <span className="player-face">
          <Portrait id={state.avatar} size={48} />
        </span>
        <div className="player-meta">
          <span className="player-name">{state.playerName}</span>
          <span className="player-tag">Springfield</span>
        </div>
      </div>

      <div className="hud-clock" title="Hours left this week">
        <Clock hours={state.hours} total={state.hoursPerWeek} size={52} />
      </div>
      <div className="hud-stat">
        <span className="label">Week</span>
        <span className="value">
          {state.week} / {state.weekLimit}
        </span>
      </div>
      <div className="hud-stat">
        <span className="label">Hours left</span>
        <span className="value">{state.hours}h</span>
      </div>
      <div className="hud-stat">
        <span className="label">Cash</span>
        <span className="value money">${state.cash.toLocaleString()}</span>
      </div>
      <div className="hud-stat">
        <span className="label">Savings</span>
        <span className="value">${state.savings.toLocaleString()}</span>
      </div>
      {state.debt > 0 && (
        <div className="hud-stat">
          <span className="label">Debt</span>
          <span className="value bad">${state.debt.toLocaleString()}</span>
        </div>
      )}
      <div className="hud-stat">
        <span className="label">Net worth</span>
        <span className={"value " + (worth >= 0 ? "good" : "bad")}>${worth.toLocaleString()}</span>
      </div>

      <button className="btn ghost end-week" onClick={() => dispatch({ type: "SLEEP" })}>
        End Week
      </button>
    </header>
  );
}
