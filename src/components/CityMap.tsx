import { useEffect, useRef, useState } from "react";
import { LOCATIONS, getJob } from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { Location, LocationId } from "../game/types";

/* ----------------------------------------------------------------------------
   Isometric diorama renderer.
   Everything is one SVG in scene coordinates so painter-ordering is automatic.
---------------------------------------------------------------------------- */
const WALK_MS = 750;

// tile + scene geometry (scene units == SVG user units)
const A = 80; // tile half-width
const B = 40; // tile half-height
const OX = 340;
const OY = 140;
const SCENE_W = 800;
const SCENE_H = 560;
const DEPTH = 36; // island thickness
const AF = 60; // building footprint half-width
const BF = 30; // building footprint half-height

const iso = (gx: number, gy: number) => ({ x: OX + (gx - gy) * A, y: OY + (gx + gy) * B });
const diamond = (cx: number, cy: number, a: number, b: number) =>
  `${cx},${cy - b} ${cx + a},${cy} ${cx},${cy + b} ${cx - a},${cy}`;

// hex colour shade: amt in [-1,1], + lightens, - darkens
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// per-category building massing
function massing(loc: Location): { h: number; ac: boolean } {
  switch (loc.category) {
    case "home":
      return { h: 64, ac: false };
    case "food":
      return { h: 78, ac: false };
    case "leisure":
      return { h: 88, ac: true };
    case "employment":
      return { h: 98, ac: true };
    case "university":
      return { h: 108, ac: true };
    case "bank":
      return { h: 116, ac: true };
    case "workplace":
      return { h: 100, ac: true };
    case "shop":
    default:
      return { h: 104, ac: true };
  }
}

// map a (s,t) coordinate on a wall face to a scene point
const faceR = (cx: number, cy: number, h: number, s: number, t: number) =>
  `${cx + s * AF},${cy + BF - s * BF - t * h}`;
const faceL = (cx: number, cy: number, h: number, s: number, t: number) =>
  `${cx - s * AF},${cy + BF - s * BF - t * h}`;

function windowPoly(
  cx: number,
  cy: number,
  h: number,
  side: "r" | "l",
  sc: number,
  tc: number,
  sw: number,
  th: number
) {
  const f = side === "r" ? faceR : faceL;
  return [
    f(cx, cy, h, sc - sw, tc - th),
    f(cx, cy, h, sc + sw, tc - th),
    f(cx, cy, h, sc + sw, tc + th),
    f(cx, cy, h, sc - sw, tc + th),
  ].join(" ");
}

function IsoBuilding({
  loc,
  here,
  onClick,
}: {
  loc: Location;
  here: boolean;
  onClick: () => void;
}) {
  const { x: cx, y: cy } = iso(loc.x, loc.y);
  const { h, ac } = massing(loc);
  const roofY = cy - h;

  const lit = shade(loc.accent, 0.08); // right face (sun)
  const dark = shade(loc.accent, -0.32); // left face (shade)
  const roof = shade(loc.accent, -0.12);
  const roofTop = shade(loc.accent, 0.14);

  const rows = h >= 96 ? [0.42, 0.74] : [0.56];
  const winR: string[] = [];
  const winL: string[] = [];
  for (const t of rows) {
    for (const s of [0.34, 0.72]) {
      winR.push(windowPoly(cx, cy, h, "r", s, t, 0.11, 0.1));
      winL.push(windowPoly(cx, cy, h, "l", s, t, 0.11, 0.1));
    }
  }
  const door = `${faceR(cx, cy, h, 0.42, 0)} ${faceR(cx, cy, h, 0.6, 0)} ${faceR(
    cx,
    cy,
    h,
    0.6,
    0.34
  )} ${faceR(cx, cy, h, 0.42, 0.34)}`;

  const wallL = `${cx},${cy + BF} ${cx - AF},${cy} ${cx - AF},${cy - h} ${cx},${cy + BF - h}`;
  const wallR = `${cx},${cy + BF} ${cx + AF},${cy} ${cx + AF},${cy - h} ${cx},${cy + BF - h}`;

  return (
    <g className={"iso-bld" + (here ? " here" : "")} onClick={onClick} role="button" aria-label={loc.name}>
      {/* contact shadow */}
      <polygon points={diamond(cx, cy + 6, AF + 16, BF + 8)} fill="rgba(0,0,0,0.22)" />
      {here && (
        <polygon
          points={diamond(cx, cy + 2, AF + 12, BF + 6)}
          fill="none"
          stroke="#ffd34d"
          strokeWidth={3}
          className="here-ring"
        />
      )}

      <g className="iso-bld-body">
        {/* walls */}
        <polygon points={wallL} fill={dark} />
        <polygon points={wallR} fill={lit} />
        {/* soft top-down light on each face */}
        <polygon points={wallL} fill="url(#glossL)" />
        <polygon points={wallR} fill="url(#glossR)" />
        {/* vertical corner highlight */}
        <line x1={cx} y1={cy + BF} x2={cx} y2={cy + BF - h} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />

        {/* windows */}
        {winL.map((p, i) => (
          <polygon key={"wl" + i} points={p} fill="#8fb4cf" stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
        ))}
        {winR.map((p, i) => (
          <polygon key={"wr" + i} points={p} fill="#d6edff" stroke="rgba(0,0,0,0.14)" strokeWidth={1} />
        ))}
        {/* door */}
        <polygon points={door} fill={shade(loc.accent, -0.5)} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />

        {/* roof */}
        <polygon points={diamond(cx, roofY, AF, BF)} fill={roof} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
        <polygon points={diamond(cx, roofY, AF - 9, BF - 4.5)} fill="none" stroke={roofTop} strokeWidth={2} />
        {ac && (
          <>
            <polygon points={diamond(cx + 14, roofY - 8, 12, 6)} fill={roofTop} />
            <polygon
              points={`${cx + 2},${roofY - 8} ${cx + 14},${roofY - 2} ${cx + 14},${roofY - 10} ${cx + 2},${roofY - 16}`}
              fill={shade(loc.accent, -0.2)}
            />
            <polygon
              points={`${cx + 26},${roofY - 2} ${cx + 14},${roofY - 8} ${cx + 14},${roofY - 16} ${cx + 26},${roofY - 10}`}
              fill={dark}
            />
          </>
        )}
      </g>
    </g>
  );
}

/** Floating name sign, rendered in a top layer so a building never covers it. */
function IsoSign({ loc, hasJob }: { loc: Location; hasJob: boolean }) {
  const { x: cx, y: cy } = iso(loc.x, loc.y);
  const { h } = massing(loc);
  const topY = cy - h - BF - 16;
  const w = Math.max(44, loc.short.length * 7.6 + 14);
  return (
    <g className="iso-sign" transform={`translate(${cx} ${topY})`}>
      <polygon points={`-5,9 5,9 0,15`} fill="#ffffff" />
      <rect x={-w / 2} y={-10} width={w} height={20} rx={10} fill="#ffffff" />
      <text x={0} y={4} textAnchor="middle" className="iso-sign-text">
        {loc.short}
      </text>
      {hasJob && (
        <g transform={`translate(${w / 2 + 11} 0)`}>
          <circle r={10} fill="#ffcf33" />
          <text x={0} y={4} textAnchor="middle" className="iso-job-text">
            ★
          </text>
        </g>
      )}
    </g>
  );
}

function IsoTree({ gx, gy, scale = 1 }: { gx: number; gy: number; scale?: number }) {
  const { x, y } = iso(gx, gy);
  const s = scale;
  return (
    <g className="iso-tree" transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={2} rx={16 * s} ry={7 * s} fill="rgba(0,0,0,0.18)" />
      <rect x={-3 * s} y={-18 * s} width={6 * s} height={22 * s} rx={2} fill="#7a5433" />
      <circle cx={0} cy={-30 * s} r={16 * s} fill="#3f9b52" />
      <circle cx={-9 * s} cy={-22 * s} r={11 * s} fill="#4bb062" />
      <circle cx={9 * s} cy={-24 * s} r={10 * s} fill="#368a48" />
      <circle cx={-4 * s} cy={-34 * s} r={9 * s} fill="#58c070" />
    </g>
  );
}

function Fountain({ gx, gy }: { gx: number; gy: number }) {
  const { x, y } = iso(gx, gy);
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={diamond(0, 0, 46, 23)} fill="#d9c49a" stroke="rgba(0,0,0,0.15)" />
      <polygon points={diamond(0, 0, 34, 17)} fill="#8fd0e8" stroke="rgba(255,255,255,0.5)" />
      <polygon points={diamond(0, -4, 10, 5)} fill="#cfeaf4" />
      <rect x={-3} y={-20} width={6} height={16} rx={3} fill="#bcd9e6" />
      <circle cx={0} cy={-22} r={5} fill="#eaf6fb" />
    </g>
  );
}

export default function CityMap({ onEnter }: { onEnter: (id: LocationId) => void }) {
  const { state, dispatch } = useGame();
  const [walking, setWalking] = useState(false);
  const timer = useRef<number | null>(null);
  const job = state.jobId ? getJob(state.jobId) : null;
  const token = state.ownedItems.includes("car") ? "🚗" : state.avatar;

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  function go(id: LocationId) {
    if (walking) return;
    if (id === state.location) {
      onEnter(id);
      return;
    }
    const cost = travelCost(state, id);
    if (cost > state.hours) {
      dispatch({ type: "MOVE", to: id });
      return;
    }
    dispatch({ type: "MOVE", to: id });
    setWalking(true);
    timer.current = window.setTimeout(() => {
      setWalking(false);
      onEnter(id);
    }, WALK_MS);
  }

  // ground tiles: path under buildings, grass elsewhere
  const buildingCells = new Set(LOCATIONS.map((l) => `${l.x},${l.y}`));
  const tiles: JSX.Element[] = [];
  for (let gx = 0; gx < 5; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const { x, y } = iso(gx, gy);
      const isPath = buildingCells.has(`${gx},${gy}`);
      tiles.push(
        <polygon
          key={`t${gx}-${gy}`}
          points={diamond(x, y, A, B)}
          fill={isPath ? "#e4d3a7" : gx % 2 === gy % 2 ? "#79c154" : "#72bb4d"}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />
      );
    }
  }

  // island outline corners
  const A0 = iso(0, 0),
    B0 = iso(4, 0),
    C0 = iso(4, 3),
    D0 = iso(0, 3);
  const top = `${A0.x},${A0.y - B}`;
  const right = `${B0.x + A},${B0.y}`;
  const bottom = `${C0.x},${C0.y + B}`;
  const left = `${D0.x - A},${D0.y}`;

  // depth-sorted props (trees, fountain, buildings)
  type Prop = { key: string; sum: number; gx: number; el: JSX.Element };
  const props: Prop[] = [];
  const trees: [number, number, number][] = [
    [0, 1, 1.05], // park
    [1, 1, 0.8],
    [3, 1, 0.85],
    [1, 2, 0.8],
    [3, 2, 0.9],
  ];
  trees.forEach(([gx, gy, s], i) =>
    props.push({ key: "tr" + i, sum: gx + gy, gx, el: <IsoTree gx={gx} gy={gy} scale={s} /> })
  );
  props.push({ key: "fountain", sum: 3.5, gx: 2, el: <Fountain gx={2} gy={1.5} /> });
  LOCATIONS.forEach((loc) =>
    props.push({
      key: loc.id,
      sum: loc.x + loc.y,
      gx: loc.x,
      el: <IsoBuilding loc={loc} here={loc.id === state.location} onClick={() => go(loc.id)} />,
    })
  );
  props.sort((a, b) => a.sum - b.sum || a.gx - b.gx);

  const tokenPos = iso(getLoc(state.location).x, getLoc(state.location).y);

  return (
    <div className="card stage board-card">
      <div className="map-head">
        <div>
          <h2>Fast Lane City</h2>
          <p>Pick a spot — your character strolls over, then you head inside.</p>
        </div>
        <span className="tag">{state.hours}h left</span>
      </div>

      <div className="board">
        <svg
          className={"iso-scene" + (walking ? " walking" : "")}
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
          width="100%"
          role="img"
          aria-label="Isometric city map"
        >
          <defs>
            <linearGradient id="islandSide" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8a6b43" />
              <stop offset="1" stopColor="#6b5132" />
            </linearGradient>
            <radialGradient id="sceneGlow" cx="0.5" cy="0.32" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="glossR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="0.65" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="glossL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="0.65" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* big soft ground shadow */}
          <ellipse cx={SCENE_W / 2 + 10} cy={SCENE_H - 70} rx={360} ry={58} fill="rgba(20,30,15,0.28)" />

          {/* island sides (extrusion) */}
          <polygon points={`${right} ${bottom} ${bottom.split(",")[0]},${C0.y + B + DEPTH} ${B0.x + A},${B0.y + DEPTH}`} fill="url(#islandSide)" />
          <polygon points={`${bottom} ${left} ${D0.x - A},${D0.y + DEPTH} ${C0.x},${C0.y + B + DEPTH}`} fill="url(#islandSide)" />

          {/* ground surface */}
          <polygon points={`${top} ${right} ${bottom} ${left}`} fill="#79c154" />
          {tiles}
          {/* subtle top light */}
          <polygon points={`${top} ${right} ${bottom} ${left}`} fill="url(#sceneGlow)" pointerEvents="none" />

          {props.map((p) => (
            <g key={p.key}>{p.el}</g>
          ))}

          {/* name signs: a top layer so buildings never cover them */}
          <g style={{ pointerEvents: "none" }}>
            {[...LOCATIONS]
              .sort((a, b) => a.x + a.y - (b.x + b.y))
              .map((loc) => (
                <IsoSign key={"sign" + loc.id} loc={loc} hasJob={job?.locationId === loc.id} />
              ))}
          </g>

          {/* character token */}
          <g
            className={"iso-token" + (walking ? " walking" : "")}
            style={{ transform: `translate(${tokenPos.x}px, ${tokenPos.y}px)` }}
          >
            <ellipse cx={0} cy={2} rx={15} ry={6} fill="rgba(0,0,0,0.28)" />
            <g className="iso-token-bob">
              <path d="M 0,-52 C 16,-52 20,-34 0,-16 C -20,-34 -16,-52 0,-52 Z" fill="#7c5cff" stroke="#fff" strokeWidth="2.5" />
              <circle cx={0} cy={-40} r={13} fill="#fff" />
              <text x={0} y={-34} textAnchor="middle" className="iso-token-face">
                {token}
              </text>
            </g>
          </g>
        </svg>

        <div className="week-plate">
          <span className="wp-week">Week {state.week}</span>
          <span className="wp-sep">·</span>
          <span className="wp-hours">{state.hours}h left</span>
        </div>
      </div>
    </div>
  );
}

function getLoc(id: LocationId) {
  return LOCATIONS.find((l) => l.id === id)!;
}
