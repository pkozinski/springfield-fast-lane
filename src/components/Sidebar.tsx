import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/store";
import { goalProgress, netWorth, rivalProgress } from "../game/engine";
import { getJob } from "../game/data";
import type { LogEntry } from "../game/types";
import { Icon, type IconName } from "./Icon";
import { RivalPortrait } from "./Portrait";

function Bar({ pct, meterColor }: { pct: number; meterColor?: string }) {
  return (
    <div className={"bar" + (pct >= 100 ? " full" : "")}>
      <span style={{ width: `${Math.min(100, pct)}%`, background: meterColor }} />
    </div>
  );
}

/** Left-hand quest dock: your four goals as tasks, plus Ned's race. */
export default function Sidebar() {
  const { state } = useGame();
  const [open, setOpen] = useState(() => window.innerWidth > 720);
  const gp = goalProgress(state);
  const rp = rivalProgress(state);
  const worth = netWorth(state);
  const job = state.jobId ? getJob(state.jobId) : null;
  const r = state.rival;

  const goals: { key: keyof typeof gp; icon: IconName; name: string; now: string; target: string; color: string }[] = [
    { key: "wealth", icon: "wealth", name: "Get rich", now: `$${worth.toLocaleString()}`, target: `$${state.goals.wealth.toLocaleString()}`, color: "#f2a33a" },
    { key: "career", icon: "career", name: "Climb the ladder", now: `Lvl ${state.careerLevel}`, target: `Lvl ${state.goals.career}`, color: "#2f6fd6" },
    { key: "education", icon: "book", name: "Hit the books", now: `${state.credits} cr`, target: `${state.goals.education} cr`, color: "#b8503a" },
    { key: "happiness", icon: "sun", name: "Be happy", now: `${Math.round(state.happiness)}`, target: `${state.goals.happiness}`, color: "#ff9f1c" },
  ];

  return (
    <aside className={"dock" + (open ? " open" : "")}>
      <button className="dock-tab" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="star" size={18} /> Goals {open ? "‹" : "›"}
      </button>
      {open && (
        <div className="dock-body">
          {goals.map((g) => (
            <div className={"quest" + (gp[g.key] >= 100 ? " done" : "")} key={g.key}>
              <span className="quest-icon" style={{ background: g.color }}>
                <Icon name={g.icon} size={20} strokeWidth={2.2} />
              </span>
              <div className="quest-text">
                <div className="quest-top">
                  <b>{g.name}</b>
                  <span>
                    {g.now} / {g.target}
                  </span>
                </div>
                <Bar pct={gp[g.key]} />
              </div>
            </div>
          ))}

          <div className="rival-card">
            <div className="rival-head">
              <span className="rival-face">
                <RivalPortrait size={46} />
              </span>
              <div className="rival-meta">
                <span className="rival-name">Ned Flanders</span>
                <span className="rival-job">{r.jobTitle}</span>
              </div>
            </div>
            <p className="rival-quote">“{r.quote}”</p>
            <div className="race">
              {goals.map((g) => (
                <div className="race-row" key={g.key}>
                  <Icon name={g.icon} size={14} />
                  <div className="race-bars">
                    <Bar pct={gp[g.key]} />
                    <Bar pct={rp[g.key]} meterColor="#3f9142" />
                  </div>
                </div>
              ))}
              <div className="race-key">
                <span>
                  <i className="you" /> You
                </span>
                <span>
                  <i className="ned" /> Ned
                </span>
              </div>
            </div>
          </div>

          <p className="job-chip">{job ? `${job.title} · $${job.wage}/hr` : "Unemployed. Visit the Employment Office."}</p>
        </div>
      )}
    </aside>
  );
}

/** Slide-in activity log (with the restart button tucked away in it). */
export function LogPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useGame();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="log-panel card">
      <h3>
        Activity Log
        <button className="deed-close" onClick={onClose} aria-label="Close log">
          ✕
        </button>
      </h3>
      <div className="log">
        {state.log.length === 0 && <div className="log-item">Your story starts here...</div>}
        {state.log.map((e) => (
          <div className={"log-item " + e.kind} key={e.id}>
            <span className="wk">W{e.week}</span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>
      <div className="log-foot">
        {confirm ? (
          <>
            <span>Abandon this life?</span>
            <button className="btn ghost" onClick={() => setConfirm(false)}>
              No
            </button>
            <button className="btn" onClick={() => dispatch({ type: "RESET" })}>
              Restart
            </button>
          </>
        ) : (
          <button className="link-btn" onClick={() => setConfirm(true)}>
            Restart game
          </button>
        )}
      </div>
      <p className="footer-note">Springfield Fast Lane · a private fan-made homage to Jones in the Fast Lane</p>
    </div>
  );
}

/** Notification banners for fresh log entries, like Tapped Out's pop-ups. */
export function Toasts() {
  const { state } = useGame();
  const seen = useRef(state.log[0]?.id ?? 0);
  const [items, setItems] = useState<LogEntry[]>([]);
  useEffect(() => {
    const fresh = state.log.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = state.log[0].id;
    setItems((cur) => [...fresh.slice(0, 3).reverse(), ...cur].slice(0, 3));
    const ids = fresh.map((e) => e.id);
    const t = setTimeout(() => setItems((cur) => cur.filter((e) => !ids.includes(e.id))), 4200);
    return () => clearTimeout(t);
  }, [state.log]);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((e) => (
        <div className={"toast " + e.kind} key={e.id}>
          {e.text}
        </div>
      ))}
    </div>
  );
}
