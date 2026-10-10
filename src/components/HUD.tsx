import { useGame } from "../game/store";
import { netWorth } from "../game/engine";

export default function HUD() {
  const { state } = useGame();
  const worth = netWorth(state);
  return (
    <header className="hud">
      <div className="brand">🏁 Fast Lane</div>

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
        <span className={"value " + (worth >= 0 ? "good" : "bad")}>
          ${worth.toLocaleString()}
        </span>
      </div>
    </header>
  );
}
