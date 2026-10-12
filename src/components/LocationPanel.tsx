import { useState } from "react";
import { useGame } from "../game/store";
import {
  COURSES,
  HOMES,
  JOBS,
  foodsAt,
  getHome,
  getJob,
  itemsAt,
  jobsAt,
  leisureAt,
} from "../game/data";
import type { Location } from "../game/types";
import { Icon, itemIcon, leisureIcon, locationIcon } from "./Icon";
import { Portrait } from "./Portrait";

/* ---- generic building blocks ---- */
function Row({
  icon,
  title,
  sub,
  tags,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  tags?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="action-row">
      <span className="ai">{icon}</span>
      <div className="atext">
        <div className="atitle">
          {title} {tags}
        </div>
        {sub && <div className="asub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/* ---- work section (shown wherever your job is) ---- */
function WorkSection() {
  const { state, dispatch } = useGame();
  const [hours, setHours] = useState(4);
  const job = state.jobId ? getJob(state.jobId) : null;
  if (!job || job.locationId !== state.location) return null;
  const max = Math.max(1, Math.floor(state.hours));
  const h = Math.min(hours, max);
  return (
    <Row
      icon={<Icon name="briefcase" />}
      title={`Work your shift — ${job.title}`}
      sub={`$${job.wage}/hr · earns $${h * job.wage} for ${h}h · uses energy`}
      tags={<span className="tag ok">Your job</span>}
    >
      <div className="work-controls">
        <div className="stepper">
          <button onClick={() => setHours((v) => Math.max(1, v - 1))}>−</button>
          <span className="n">{h}h</span>
          <button onClick={() => setHours((v) => Math.min(max, v + 1))}>+</button>
        </div>
        <button
          className="btn"
          disabled={state.hours < 1 || state.energy < 10}
          onClick={() => dispatch({ type: "WORK", hours: h })}
        >
          Work
        </button>
      </div>
    </Row>
  );
}

/* ---- per-category content ---- */
function Employment() {
  const { state, dispatch } = useGame();
  return (
    <div className="action-list">
      {[...JOBS]
        .sort((a, b) => a.tier - b.tier)
        .map((job) => {
          const eduOk = state.credits >= job.reqCredits;
          const wardrobeOk = !job.reqWardrobe || state.hasWardrobe;
          const qualified = eduOk && wardrobeOk;
          const current = state.jobId === job.id;
          return (
            <Row
              key={job.id}
              icon={<Icon name="briefcase" />}
              title={job.title}
              sub={`$${job.wage}/hr · Tier ${job.tier} · ${job.blurb}`}
              tags={
                <>
                  {job.reqCredits > 0 && (
                    <span className={"tag " + (eduOk ? "ok" : "")}>{job.reqCredits} cr</span>
                  )}
                  {job.reqWardrobe && (
                    <span className={"tag " + (wardrobeOk ? "ok" : "")}>wardrobe</span>
                  )}
                </>
              }
            >
              <button
                className="btn"
                disabled={!qualified || current}
                onClick={() => dispatch({ type: "APPLY", jobId: job.id })}
              >
                {current ? "Current" : qualified ? "Apply" : "Locked"}
              </button>
            </Row>
          );
        })}
    </div>
  );
}

function University() {
  const { state, dispatch } = useGame();
  return (
    <div className="action-list">
      <p className="list-note">You have {state.credits} credits. Courses cost more as you advance.</p>
      {COURSES.map((c) => {
        const cost = c.baseCost + state.credits * 40;
        const hours = state.ownedItems.includes("laptop") ? Math.ceil(c.hours * 0.8) : c.hours;
        return (
          <Row
            key={c.id}
            icon={<Icon name="book" />}
            title={c.name}
            sub={`+${c.credits} credits · ${hours}h · ${c.blurb}`}
          >
            <button
              className="btn"
              disabled={state.cash < cost || hours > state.hours}
              onClick={() => dispatch({ type: "STUDY", courseId: c.id })}
            >
              ${cost}
            </button>
          </Row>
        );
      })}
    </div>
  );
}

function Shop({ location }: { location: Location }) {
  const { state, dispatch } = useGame();
  const items = itemsAt(location.id);
  return (
    <div className="action-list">
      {items.map((it) => {
        const owned = state.ownedItems.includes(it.id);
        return (
          <Row
            key={it.id}
            icon={<Icon name={itemIcon(it.category)} />}
            title={it.name}
            sub={`+${it.happy} happiness · ${it.blurb}`}
            tags={owned ? <span className="tag owned">Owned</span> : undefined}
          >
            <button
              className="btn"
              disabled={owned || state.cash < it.cost}
              onClick={() => dispatch({ type: "BUY_ITEM", itemId: it.id })}
            >
              {owned ? "✓" : `$${it.cost}`}
            </button>
          </Row>
        );
      })}
    </div>
  );
}

function FoodAndLeisure({ location }: { location: Location }) {
  const { state, dispatch } = useGame();
  const foods = foodsAt(location.id);
  const acts = leisureAt(location.id);
  return (
    <div className="action-list">
      {foods.map((f) => (
        <Row
          key={f.id}
          icon={<Icon name="food" />}
          title={f.name}
          sub={`+${f.energy} energy · +${f.happy} happiness · ${f.hours}h`}
        >
          <button
            className="btn"
            disabled={state.cash < f.cost || f.hours > state.hours}
            onClick={() => dispatch({ type: "EAT", foodId: f.id })}
          >
            ${f.cost}
          </button>
        </Row>
      ))}
      {acts.map((a) => (
        <Row
          key={a.id}
          icon={<Icon name={leisureIcon(a.id)} />}
          title={a.name}
          sub={`+${a.happy} happiness · ${a.energy >= 0 ? "+" : ""}${a.energy} energy · ${a.hours}h`}
        >
          <button
            className="btn"
            disabled={state.cash < a.cost || a.hours > state.hours}
            onClick={() => dispatch({ type: "LEISURE", activityId: a.id })}
          >
            ${a.cost}
          </button>
        </Row>
      ))}
    </div>
  );
}

function Bank() {
  const { state, dispatch } = useGame();
  const [amt, setAmt] = useState("");
  const n = Math.max(0, Math.floor(Number(amt) || 0));
  const act = (type: "DEPOSIT" | "WITHDRAW" | "BORROW" | "REPAY") => {
    dispatch({ type, amount: n } as never);
    setAmt("");
  };
  return (
    <div className="action-list">
      <Row icon={<Icon name="coin" />} title={`Savings: $${state.savings.toLocaleString()}`} sub="Earns 1.5% interest each week." />
      <Row
        icon={<Icon name="bills" />}
        title={`Debt: $${state.debt.toLocaleString()}`}
        sub="Loans accrue 5% interest each week. Pay it down fast."
      />
      <div className="card">
        <div className="bank-input">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Amount ($)"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
        </div>
        <div className="bank-grid">
          <button className="btn ghost" disabled={n <= 0 || n > state.cash} onClick={() => act("DEPOSIT")}>
            Deposit
          </button>
          <button className="btn ghost" disabled={n <= 0 || n > state.savings} onClick={() => act("WITHDRAW")}>
            Withdraw
          </button>
          <button className="btn ghost" disabled={n <= 0} onClick={() => act("BORROW")}>
            Borrow
          </button>
          <button
            className="btn ghost"
            disabled={n <= 0 || state.debt <= 0 || n > state.cash}
            onClick={() => act("REPAY")}
          >
            Repay
          </button>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { state, dispatch } = useGame();
  const current = getHome(state.homeId);
  return (
    <div className="action-list">
      <Row
        icon={<Icon name="moon" />}
        title="Hit the hay & end the week"
        sub="Recover energy, collect pay, then rent and interest are settled."
      >
        <button className="btn" onClick={() => dispatch({ type: "SLEEP" })}>
          Sleep →
        </button>
      </Row>
      <p className="list-note" style={{ marginTop: 6 }}>
        Housing — currently the {current.name} (${current.rent}/wk)
      </p>
      {HOMES.map((h) => {
        const isCurrent = h.id === state.homeId;
        return (
          <Row
            key={h.id}
            icon={<Icon name="home" />}
            title={h.name}
            sub={`Rent $${h.rent}/wk · +${h.happyPerWeek} happiness/wk · ${h.blurb}`}
            tags={isCurrent ? <span className="tag owned">Living here</span> : undefined}
          >
            <button
              className="btn"
              disabled={isCurrent || state.cash < h.deposit}
              onClick={() => dispatch({ type: "MOVE_HOME", homeId: h.id })}
            >
              {isCurrent ? "✓" : h.deposit > 0 ? `$${h.deposit}` : "Move in"}
            </button>
          </Row>
        );
      })}
    </div>
  );
}

export default function LocationPanel({
  location,
  onBack,
}: {
  location: Location;
  onBack: () => void;
}) {
  const { state } = useGame();
  const { category } = location;
  return (
    <div className="card stage deed" style={{ ["--tile-accent" as string]: location.accent } as React.CSSProperties}>
      <div className="deed-band">
        <span className="deed-emoji">
          <Icon name={locationIcon(location)} size={26} strokeWidth={1.7} />
        </span>
        <div className="deed-title">
          <span className="deed-kicker">Springfield</span>
          <h2>{location.name}</h2>
        </div>
        <button className="deed-close" onClick={onBack} aria-label="Done">
          ✕
        </button>
      </div>

      <div className="deed-sub">
        <p className="deed-blurb">{location.blurb}</p>
        <div className="loc-portrait" title={state.playerName}>
          <span className="portrait-face">
            <Portrait id={state.avatar} size={46} />
          </span>
          <span className="portrait-name">{state.playerName}</span>
        </div>
      </div>

      <div className="deed-body">
        <WorkSection />
        {category === "employment" && <Employment />}
        {category === "university" && <University />}
        {category === "bank" && <Bank />}
        {category === "shop" && <Shop location={location} />}
        {(category === "food" || category === "leisure") && <FoodAndLeisure location={location} />}
        {category === "workplace" && <WorkplaceEmptyState location={location} />}
        {category === "home" && <Home />}
      </div>
    </div>
  );
}

/** A pure workplace (e.g. the factory): if you don't work here, point you to hiring. */
function WorkplaceEmptyState({ location }: { location: Location }) {
  const { state } = useGame();
  const job = state.jobId ? getJob(state.jobId) : null;
  if (job && job.locationId === location.id) return null;
  const openings = jobsAt(location.id);
  return (
    <p className="list-note" style={{ marginTop: 4 }}>
      {openings.length > 0
        ? `${location.name} is hiring (${openings
            .map((j) => j.title)
            .join(", ")}). Apply at the Employment Office, then come back to clock in.`
        : "You don't work here. Find a job at the Employment Office."}
    </p>
  );
}
