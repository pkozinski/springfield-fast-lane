import { useGame } from "../game/store";
import { netWorth } from "../game/engine";
import { Portrait } from "./Portrait";
import { Icon, type IconName } from "./Icon";
import Clock from "./Clock";

function Pill({ icon, color, label, value, tone }: { icon: IconName; color: string; label: string; value: string; tone?: string }) {
  return (
    <div className="pill" title={label}>
      <span className="pill-icon" style={{ background: color }}>
        <Icon name={icon} size={18} strokeWidth={2.2} />
      </span>
      <span className={"pill-value " + (tone ?? "")}>{value}</span>
    </div>
  );
}

/** Floating Tapped Out-style overlay: player badge top-left, currency pills top-right, buttons bottom-right. */
export default function HUD({ onLog, logOpen }: { onLog: () => void; logOpen: boolean }) {
  const { state, dispatch } = useGame();
  const worth = netWorth(state);
  const spent = 1 - state.hours / state.hoursPerWeek;
  return (
    <>
      <div className="hud-player">
        <span className="player-face">
          <Portrait id={state.avatar} size={64} />
        </span>
        <div className="player-plate">
          <div className="player-row">
            <span className="week-star" title="Week">
              {state.week}
            </span>
            <span className="player-name">{state.playerName}</span>
          </div>
          <div className="xp" title={`Week ${state.week} of ${state.weekLimit}`}>
            <span style={{ width: `${Math.min(100, spent * 100)}%` }} />
            <em>
              Week {state.week}/{state.weekLimit} · {state.hours}h left
            </em>
          </div>
          <div className="mini-meters">
            <span title="Happiness">
              <Icon name="sun" size={13} /> <i style={{ width: `${state.happiness}%`, background: "#ff9f1c" }} />
            </span>
            <span title="Energy">
              <Icon name="bolt" size={13} /> <i style={{ width: `${state.energy}%`, background: "#52b947" }} />
            </span>
          </div>
        </div>
      </div>

      <div className="hud-pills">
        <Pill icon="coin" color="#52b947" label="Cash" value={`$${state.cash.toLocaleString()}`} />
        <Pill icon="bank" color="#2f6fd6" label="Savings" value={`$${state.savings.toLocaleString()}`} />
        {state.debt > 0 && <Pill icon="bills" color="#ef4b3c" label="Debt" value={`$${state.debt.toLocaleString()}`} tone="bad" />}
        <Pill icon="wealth" color="#f2a33a" label="Net worth" value={`$${worth.toLocaleString()}`} tone={worth < 0 ? "bad" : ""} />
        <div className="pill clock-pill" title="Hours left this week">
          <Clock hours={state.hours} total={state.hoursPerWeek} size={34} />
          <span className="pill-value">{state.hours}h</span>
        </div>
      </div>

      <div className="hud-actions">
        <button className={"round-btn" + (logOpen ? " on" : "")} onClick={onLog} aria-label="Activity log">
          <Icon name="book" size={26} strokeWidth={2} />
          <span>Log</span>
        </button>
        <button className="round-btn big" onClick={() => dispatch({ type: "SLEEP" })} aria-label="End week">
          <Icon name="moon" size={30} strokeWidth={2} />
          <span>End Week</span>
        </button>
      </div>
    </>
  );
}
