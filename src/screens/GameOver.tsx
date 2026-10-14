import { useGame } from "../game/store";
import { goalsMet, netWorth } from "../game/engine";

export default function GameOver() {
  const { state, dispatch } = useGame();
  const won = state.phase === "won";
  const worth = netWorth(state);
  const beaten = state.lostTo === "rival";

  const cells = [
    { label: "Net worth", value: `$${worth.toLocaleString()}` },
    { label: "Career level", value: `${state.careerLevel}` },
    { label: "Education", value: `${state.degrees.length} degree${state.degrees.length === 1 ? "" : "s"}` },
    { label: "Happiness", value: `${Math.round(state.happiness)}` },
    { label: "Weeks played", value: `${Math.min(state.week, state.weekLimit)}` },
    { label: "Total earned", value: `$${state.stats.totalEarned.toLocaleString()}` },
  ];

  return (
    <div className="center-stage">
      <div className="hero">
        <div className="kicker">{won ? "You made it" : "Game over"}</div>
        <h1>{won ? "Woo-hoo!" : beaten ? "Stupid Flanders" : "D'oh!"}</h1>
        <p>
          {won
            ? `${state.playerName} hit every life goal before Ned Flanders did. Take that, neighborino.`
            : beaten
              ? `Ned Flanders hit all four goals first. "Better luck next time, neighbor!" he says, sincerely. Ugh.`
              : `${state.playerName} ran out of weeks. ${
                  goalsMet(state) ? "" : "Not every goal was met this time, but Springfield's still here for another run."
                }`}
        </p>

        <div className="result-grid">
          {cells.map((c) => (
            <div className="result-cell" key={c.label}>
              <div className="rl">{c.label}</div>
              <div className="rv">{c.value}</div>
            </div>
          ))}
        </div>

        <button className="btn wide" onClick={() => dispatch({ type: "RESET" })}>
          Play again
        </button>
      </div>
    </div>
  );
}
