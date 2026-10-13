import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { CONFIG, DEFAULT_GOALS } from "../game/data";
import { RivalPortrait } from "./Portrait";

interface Step {
  title: string;
  body: string;
  /** data-tut name of the element to spotlight, if any */
  target?: string;
}

function steps(name: string): Step[] {
  return [
    {
      title: `Welcome to Springfield, ${name}!`,
      body: `You've got ${CONFIG.weekLimit} weeks to make something of yourself. Here's a quick tour. You can skip it any time.`,
    },
    {
      title: "Your life goals",
      body: `Hit all four to win: $${DEFAULT_GOALS.wealth.toLocaleString()} net worth, a level ${DEFAULT_GOALS.career} career, ${DEFAULT_GOALS.education} education credits, and ${DEFAULT_GOALS.happiness} happiness.`,
      target: "goals",
    },
    {
      title: "Keep up with the Flanderses",
      body: "Ned next door is chasing the same goals. Your bars are yellow, his are green. If he fills all four first, you lose. Stupid Flanders.",
      target: "rival",
    },
    {
      title: "Get around town",
      body: "Click a building to walk there and head inside. Every step around the square costs time, so plan your route.",
      target: "board",
    },
    {
      title: "Watch the clock",
      body: `You get ${CONFIG.hoursPerWeek} hours a week. Working, studying, eating and fun all use them up. Your cash, savings and net worth live up here too.`,
      target: "hud",
    },
    {
      title: "Your first moves",
      body: "Get a job at the Employment Office (Krusty Burger hires anyone). Eat to keep your energy up. Take courses at Springfield U to unlock better jobs, and bank your savings to earn interest.",
    },
    {
      title: "End the week",
      body: "Done for the week? Hit End Week to sleep. Rent is due every week, so don't spend it all on Duff!",
      target: "endweek",
    },
  ];
}

/** Step-by-step intro shown once, right after you name your character. */
export default function Tutorial() {
  const { state, dispatch } = useGame();
  const [i, setI] = useState(0);
  const list = steps(state.playerName);
  const step = list[i];
  const last = i === list.length - 1;
  const done = () => dispatch({ type: "TUTORIAL_DONE" });

  // spotlight: a fixed cut-out over the target (works through sticky/stacked parents)
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tut="${step.target}"]`) : null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "nearest" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") done();
      if (e.key === "ArrowRight" || e.key === "Enter") (last ? done() : setI((v) => v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className={rect ? "tut-block" : "tut-dim"} />
      {rect && (
        <div
          className="tut-hole"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div className="tut-card" role="dialog" aria-modal="true" aria-labelledby="tut-title">
        {i === 2 && (
          <span className="tut-face">
            <RivalPortrait size={54} />
          </span>
        )}
        <div className="tut-kicker">
          Tutorial · {i + 1} of {list.length}
        </div>
        <h2 id="tut-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tut-dots" aria-hidden="true">
          {list.map((_, k) => (
            <i key={k} className={k === i ? "on" : ""} />
          ))}
        </div>
        <div className="tut-actions">
          <button className="link-btn" onClick={done}>
            Skip tutorial
          </button>
          <span className="tut-nav">
            {i > 0 && (
              <button className="btn ghost" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            <button className="btn" onClick={() => (last ? done() : setI(i + 1))} autoFocus>
              {last ? "Let's go!" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
