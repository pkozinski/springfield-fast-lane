import { useState } from "react";
import { useGame } from "../game/store";
import { CONFIG, DEFAULT_GOALS } from "../game/data";
import { AVATAR_IDS as AVATARS, Portrait, avatarName } from "../components/Portrait";

export default function Intro() {
  const { dispatch } = useGame();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);

  return (
    <div className="center-stage">
      <div className="hero">
        <div className="kicker">Keeping up with the Flanderses</div>
        <h1>
          Springfield <span>Fast Lane</span>
        </h1>
        <p>
          You've got {CONFIG.weekLimit} weeks to build wealth, climb a career, earn your education, and
          actually be happy. Ned Flanders next door is chasing the same goals. Beat him to all four, or
          it's "Stupid Flanders" for the rest of your life.
        </p>

        <div className="avatar-pick">
          <div className="avatar-preview">
            <Portrait id={avatar} size={84} />
          </div>
          <div className="avatar-row">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                className={"avatar-opt" + (a === avatar ? " sel" : "")}
                onClick={() => setAvatar(a)}
                aria-label={"Choose " + avatarName(a)}
                title={avatarName(a)}
              >
                <Portrait id={a} size={44} />
              </button>
            ))}
          </div>
        </div>

        <form
          className="name-row"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "START", name, avatar, seed: Date.now() });
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
            Start
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
