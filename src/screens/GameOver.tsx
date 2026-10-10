import { useGame } from "../game/store";
import { goalsMet, netWorth } from "../game/engine";

export default function GameOver() {
  const { state, dispatch } = useGame();
  const won = state.phase === "won";
  const worth = netWorth(state);

  const cells = [
    { label: "Net worth", value: `$${worth.toLocaleString()}` },
    { label: "Career level", value: `${state.careerLevel}` },
    { label: "Education", value: `${state.credits} cr` },
    { label: "Happiness", value: `${Math.round(state.happiness)}` },
    { label: "Weeks played", value: `${Math.min(state.week, state.weekLimit)}` },
    { label: "Total earned", value: `$${state.stats.totalEarned.toLocaleString()}` },
  ];

  return (
    <div className="center-stage">
      <div className="hero">
        <div className="kicker">{won ? "You made it" : "Game over"}</div>
        <h1>{won ? "🏁 Winner" : "Time's Up"}</h1>
        <p>
          {won
            ? `${state.playerName} hit every life goal and reached the fast lane. Nicely played.`
            : `${state.playerName} ran out of weeks. ${
                goalsMet(state) ? "" : "Not every goal was met this time — the city's still here for another run."
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
