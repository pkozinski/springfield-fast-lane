import { useGame } from "../game/store";
import { goalProgress, netWorth, rivalProgress } from "../game/engine";
import { getJob } from "../game/data";
import { Icon, type IconName } from "./Icon";
import { RivalPortrait } from "./Portrait";

function Bar({ pct, meterColor }: { pct: number; meterColor?: string }) {
  const full = pct >= 100;
  return (
    <div className={"bar" + (full ? " full" : "")}>
      <span style={{ width: `${Math.min(100, pct)}%`, background: meterColor }} />
    </div>
  );
}

export default function Sidebar() {
  const { state } = useGame();
  const gp = goalProgress(state);
  const worth = netWorth(state);
  const job = state.jobId ? getJob(state.jobId) : null;
  const rp = rivalProgress(state);
  const r = state.rival;

  const goals: { key: keyof typeof gp; icon: IconName; name: string; now: string; target: string }[] = [
    { key: "wealth", icon: "wealth", name: "Wealth", now: `$${worth.toLocaleString()}`, target: `$${state.goals.wealth.toLocaleString()}` },
    { key: "career", icon: "career", name: "Career", now: `Lvl ${state.careerLevel}`, target: `Lvl ${state.goals.career}` },
    { key: "education", icon: "book", name: "Education", now: `${state.credits} cr`, target: `${state.goals.education} cr` },
    { key: "happiness", icon: "sun", name: "Happiness", now: `${Math.round(state.happiness)}`, target: `${state.goals.happiness}` },
  ];

  return (
    <aside className="sidebar">
      <section className="card" data-tut="goals">
        <h3>Life Goals</h3>
        {goals.map((g) => (
          <div className="goal" key={g.key}>
            <div className="goal-top">
              <span className="gname">
                <Icon name={g.icon} size={16} /> {g.name}
              </span>
              <span className="gval">
                {g.now} <span style={{ color: "var(--faint)" }}>/ {g.target}</span>
              </span>
            </div>
            <Bar pct={gp[g.key]} />
          </div>
        ))}
      </section>

      <section className="card rival-card" data-tut="rival">
        <h3>Keeping Up with the Flanderses</h3>
        <div className="rival-head">
          <span className="rival-face">
            <RivalPortrait size={50} />
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
              <span className="race-label">
                <Icon name={g.icon} size={14} /> {g.name}
              </span>
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
      </section>

      <section className="card">
        <h3>Condition</h3>
        <div className="meters">
          <div className="meter">
            <div className="goal-top">
              <span className="gname">
                <Icon name="sun" size={16} /> Happiness
              </span>
              <span className="gval">{Math.round(state.happiness)}/100</span>
            </div>
            <Bar pct={state.happiness} meterColor="#ff9f1c" />
          </div>
          <div className="meter">
            <div className="goal-top">
              <span className="gname">
                <Icon name="bolt" size={16} /> Energy
              </span>
              <span className="gval">{Math.round(state.energy)}/100</span>
            </div>
            <Bar pct={state.energy} meterColor="#52b947" />
          </div>
        </div>
        <p className="list-note" style={{ marginTop: 14, marginBottom: 0 }}>
          {job ? `Employed as ${job.title} ($${job.wage}/hr)` : "Unemployed. Visit the Employment Office."}
        </p>
      </section>

      <section className="card">
        <h3>Activity Log</h3>
        <div className="log">
          {state.log.length === 0 && <div className="log-item">Your story starts here...</div>}
          {state.log.map((e) => (
            <div className={"log-item " + e.kind} key={e.id}>
              <span className="wk">W{e.week}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
