import { useGame } from "../game/store";
import { goalProgress, netWorth } from "../game/engine";
import { getJob } from "../game/data";

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

  const goals: { key: keyof typeof gp; name: string; now: string; target: string }[] = [
    { key: "wealth", name: "💰 Wealth", now: `$${worth.toLocaleString()}`, target: `$${state.goals.wealth.toLocaleString()}` },
    { key: "career", name: "📈 Career", now: `Lvl ${state.careerLevel}`, target: `Lvl ${state.goals.career}` },
    { key: "education", name: "🎓 Education", now: `${state.credits} cr`, target: `${state.goals.education} cr` },
    { key: "happiness", name: "😊 Happiness", now: `${Math.round(state.happiness)}`, target: `${state.goals.happiness}` },
  ];

  return (
    <aside className="sidebar">
      <section className="card">
        <h3>Life Goals</h3>
        {goals.map((g) => (
          <div className="goal" key={g.key}>
            <div className="goal-top">
              <span className="gname">{g.name}</span>
              <span className="gval">
                {g.now} <span style={{ color: "var(--faint)" }}>/ {g.target}</span>
              </span>
            </div>
            <Bar pct={gp[g.key]} />
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Condition</h3>
        <div className="meters">
          <div className="meter">
            <div className="goal-top">
              <span className="gname">😊 Happiness</span>
              <span className="gval">{Math.round(state.happiness)}/100</span>
            </div>
            <Bar pct={state.happiness} meterColor="linear-gradient(90deg,#f472b6,#fbbf24)" />
          </div>
          <div className="meter">
            <div className="goal-top">
              <span className="gname">⚡ Energy</span>
              <span className="gval">{Math.round(state.energy)}/100</span>
            </div>
            <Bar pct={state.energy} meterColor="linear-gradient(90deg,#34d399,#22d3ee)" />
          </div>
        </div>
        <p className="list-note" style={{ marginTop: 14, marginBottom: 0 }}>
          {job ? `Employed as ${job.title} ($${job.wage}/hr)` : "Unemployed — visit the Careers Hub"}
        </p>
      </section>

      <section className="card">
        <h3>Activity Log</h3>
        <div className="log">
          {state.log.length === 0 && <div className="log-item">Your story starts here…</div>}
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
