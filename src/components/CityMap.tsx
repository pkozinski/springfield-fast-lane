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
// A higher B:A ratio tilts the camera toward a top-down "board" view.
const A = 76; // tile half-width
const B = 54; // tile half-height
const OX = 340;
const OY = 120;
const SCENE_W = 780;
const SCENE_H = 640;
const DEPTH = 26; // island thickness
const AF = 50; // building footprint half-width
const BF = 36; // building footprint half-height

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
interface Mass {
  h: number;
  roof: "flat" | "hip";
  fw: number;
}
function massing(loc: Location): Mass {
  switch (loc.category) {
    case "home":
      return { h: 42, roof: "hip", fw: 0.86 };
    case "food":
      return { h: 52, roof: "flat", fw: 0.96 };
    case "leisure":
      return { h: 56, roof: "flat", fw: 1.0 };
    case "employment":
      return { h: 64, roof: "flat", fw: 1.0 };
    case "university":
      return { h: 68, roof: "flat", fw: 1.03 };
    case "bank":
      return { h: 72, roof: "flat", fw: 1.03 };
    case "workplace":
      return { h: 58, roof: "flat", fw: 1.12 };
    case "shop":
    default:
      return { h: 62, roof: "flat", fw: 1.06 };
  }
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
  const { h, roof, fw } = massing(loc);
  const af = AF * fw;
  const bf = BF * fw;
  const roofY = cy - h;

  const lit = shade(loc.accent, 0.08);
  const dark = shade(loc.accent, -0.34);
  const roofC = shade(loc.accent, -0.12);
  const roofTop = shade(loc.accent, 0.16);
  const frame = shade(loc.accent, -0.46);
  const trim = shade(loc.accent, 0.22);
  const baseC = shade(loc.accent, -0.44);

  // (s,t) -> scene point on a wall face. s runs along the base edge, t is up.
  const R = (s: number, t: number) => `${cx + s * af},${cy + bf - s * bf - t * h}`;
  const L = (s: number, t: number) => `${cx - s * af},${cy + bf - s * bf - t * h}`;
  const F = (side: "R" | "L", s: number, t: number) => (side === "R" ? R(s, t) : L(s, t));
  const Fp = (side: "R" | "L", s: number, t: number) => ({
    x: cx + (side === "R" ? s * af : -s * af),
    y: cy + bf - s * bf - t * h,
  });
  const quad = (side: "R" | "L", s0: number, s1: number, t0: number, t1: number) =>
    `${F(side, s0, t0)} ${F(side, s1, t0)} ${F(side, s1, t1)} ${F(side, s0, t1)}`;

  const p: JSX.Element[] = [];
  const key = (s: string) => `${loc.id}-${s}`;

  const win = (side: "R" | "L", sc: number, tc: number, hw: number, th: number, k: string) => {
    const glass = side === "R" ? "#d9eeff" : "#a9c9e2";
    p.push(
      <polygon key={key(k + "f")} points={quad(side, sc - hw, sc + hw, tc - th, tc + th)} fill={frame} />,
      <polygon
        key={key(k + "g")}
        points={quad(side, sc - hw * 0.76, sc + hw * 0.76, tc - th * 0.76, tc + th * 0.76)}
        fill={glass}
      />,
      <polygon
        key={key(k + "h")}
        points={`${F(side, sc - hw * 0.76, tc + th * 0.05)} ${F(side, sc - hw * 0.05, tc + th * 0.76)} ${F(
          side,
          sc - hw * 0.76,
          tc + th * 0.76
        )}`}
        fill="rgba(255,255,255,0.45)"
      />
    );
  };

  // ---- walls + global shading ----
  const wallL = `${cx},${cy + bf} ${cx - af},${cy} ${cx - af},${cy - h} ${cx},${cy + bf - h}`;
  const wallR = `${cx},${cy + bf} ${cx + af},${cy} ${cx + af},${cy - h} ${cx},${cy + bf - h}`;
  p.push(<polygon key={key("wl")} points={wallL} fill={dark} />);
  p.push(<polygon key={key("wr")} points={wallR} fill={lit} />);

  // ---- floors ----
  const groundT = Math.min(0.42, 40 / h);
  const upper = Math.max(1, Math.round((h - 40) / 28));
  const upT = (1 - groundT) / upper;

  // base plinth
  p.push(<polygon key={key("plL")} points={quad("L", 0, 1, 0, 0.05)} fill={shade(loc.accent, -0.54)} />);
  p.push(<polygon key={key("plR")} points={quad("R", 0, 1, 0, 0.05)} fill={baseC} />);

  // upper-floor windows + string courses
  for (let i = 0; i < upper; i++) {
    const tc = Math.min(0.84, groundT + (i + 0.5) * upT);
    const th = Math.min(upT * 0.3, 0.09);
    [0.28, 0.72].forEach((sc, j) => {
      win("R", sc, tc, 0.1, th, `ur${i}${j}`);
      win("L", sc, tc, 0.1, th, `ul${i}${j}`);
    });
    if (i > 0) {
      const tb = groundT + i * upT;
      p.push(<polygon key={key("scR" + i)} points={quad("R", 0.05, 0.95, tb - 0.01, tb + 0.01)} fill={trim} />);
      p.push(<polygon key={key("scL" + i)} points={quad("L", 0.05, 0.95, tb - 0.01, tb + 0.01)} fill={shade(loc.accent, -0.2)} />);
    }
  }

  // ---- ground-floor storefront (front/right face) ----
  p.push(<polygon key={key("sfF")} points={quad("R", 0.12, 0.88, 0.05, groundT - 0.05)} fill={frame} />);
  p.push(<polygon key={key("sfG")} points={quad("R", 0.14, 0.86, 0.07, groundT - 0.07)} fill="#bfe0f5" />);
  // glass pane dividers
  [0.32, 0.5, 0.68].forEach((s, i) =>
    p.push(<polygon key={key("sfd" + i)} points={quad("R", s - 0.006, s + 0.006, 0.07, groundT - 0.07)} fill={frame} />)
  );
  // door
  p.push(<polygon key={key("door")} points={quad("R", 0.45, 0.6, 0, groundT - 0.09)} fill={shade(loc.accent, -0.5)} />);
  p.push(<polygon key={key("knob")} points={quad("R", 0.575, 0.59, groundT * 0.4, groundT * 0.46)} fill="#ffe08a" />);
  // side-face ground windows
  win("L", 0.3, groundT * 0.52, 0.11, groundT * 0.3, "sgl0");
  win("L", 0.7, groundT * 0.52, 0.11, groundT * 0.3, "sgl1");

  // ---- awning with stripes over the storefront ----
  const awn = shade(loc.accent, -0.05);
  for (let k = 0; k < 8; k++) {
    const s0 = 0.1 + k * 0.1;
    p.push(
      <polygon
        key={key("aw" + k)}
        points={quad("R", s0, s0 + 0.1, groundT - 0.02, groundT + 0.05)}
        fill={k % 2 ? "#ffffff" : awn}
      />
    );
  }
  p.push(<polygon key={key("awlip")} points={quad("R", 0.1, 0.9, groundT + 0.045, groundT + 0.06)} fill={shade(loc.accent, -0.25)} />);

  // ---- cornice ----
  p.push(<polygon key={key("coR")} points={quad("R", 0, 1, 0.9, 0.965)} fill={trim} />);
  p.push(<polygon key={key("coL")} points={quad("L", 0, 1, 0.9, 0.965)} fill={shade(loc.accent, -0.18)} />);

  // gloss over faces + corner highlight
  p.push(<polygon key={key("glL")} points={wallL} fill="url(#glossL)" />);
  p.push(<polygon key={key("glR")} points={wallR} fill="url(#glossR)" />);
  p.push(<line key={key("corner")} x1={cx} y1={cy + bf} x2={cx} y2={cy + bf - h} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />);

  // ---- roof ----
  if (roof === "hip") {
    const apex = `${cx},${roofY - 30}`;
    const Tp = `${cx},${roofY - bf}`;
    const Rp = `${cx + af},${roofY}`;
    const Btp = `${cx},${roofY + bf}`;
    const Lp = `${cx - af},${roofY}`;
    p.push(<polygon key={key("rk1")} points={`${Tp} ${Lp} ${apex}`} fill={shade(loc.accent, -0.3)} />);
    p.push(<polygon key={key("rk2")} points={`${Tp} ${Rp} ${apex}`} fill={roofC} />);
    p.push(<polygon key={key("rk3")} points={`${Lp} ${Btp} ${apex}`} fill={shade(loc.accent, -0.2)} />);
    p.push(<polygon key={key("rk4")} points={`${Rp} ${Btp} ${apex}`} fill={roofTop} />);
    // chimney
    p.push(<rect key={key("chim")} x={cx + af * 0.42} y={roofY - 22} width={9} height={20} fill={shade(loc.accent, -0.4)} />);
  } else {
    p.push(<polygon key={key("roof")} points={diamond(cx, roofY, af, bf)} fill={roofC} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />);
    p.push(<polygon key={key("para")} points={diamond(cx, roofY - 4, af - 8, bf - 4)} fill="none" stroke={roofTop} strokeWidth={2} />);
  }

  // ---- distinctive per-business features ----
  feature(loc, { cx, cy, roofY, af, bf, h, F, Fp, quad, p, key, colors: { lit, dark, roofC, roofTop, trim } });

  return (
    <g className={"iso-bld" + (here ? " here" : "")} onClick={onClick} role="button" aria-label={loc.name}>
      <polygon points={diamond(cx, cy + 6, af + 16, bf + 8)} fill="rgba(0,0,0,0.22)" />
      {here && (
        <polygon points={diamond(cx, cy + 2, af + 12, bf + 6)} fill="none" stroke="#ffd34d" strokeWidth={3} className="here-ring" />
      )}
      <g className="iso-bld-body">{p}</g>
    </g>
  );
}

interface FeatureCtx {
  cx: number;
  cy: number;
  roofY: number;
  af: number;
  bf: number;
  h: number;
  F: (side: "R" | "L", s: number, t: number) => string;
  Fp: (side: "R" | "L", s: number, t: number) => { x: number; y: number };
  quad: (side: "R" | "L", s0: number, s1: number, t0: number, t1: number) => string;
  p: JSX.Element[];
  key: (s: string) => string;
  colors: { lit: string; dark: string; roofC: string; roofTop: string; trim: string };
}

function feature(loc: Location, c: FeatureCtx) {
  const { cx, roofY, p, key, Fp, quad } = c;
  switch (loc.id) {
    case "factory": {
      [-24, 4].forEach((ox, i) => {
        const sx = cx + ox;
        const top = roofY - 44;
        p.push(<rect key={key("st" + i)} x={sx - 5} y={top} width={10} height={46} fill="#9aa0a6" />);
        p.push(<rect key={key("st2" + i)} x={sx} y={top} width={5} height={46} fill="#777d83" />);
        p.push(<ellipse key={key("stc" + i)} cx={sx} cy={top} rx={6} ry={3} fill="#5f656b" />);
        p.push(<circle key={key("sm1" + i)} className="smoke" cx={sx} cy={top - 10} r={7} fill="rgba(255,255,255,0.85)" />);
        p.push(<circle key={key("sm2" + i)} className="smoke" cx={sx + 5} cy={top - 20} r={9} fill="rgba(255,255,255,0.6)" />);
      });
      break;
    }
    case "bank": {
      // columns + pediment on the front face
      [0.22, 0.4, 0.58, 0.76].forEach((s, i) =>
        p.push(<polygon key={key("col" + i)} points={quad("R", s - 0.03, s + 0.03, 0.06, 0.64)} fill="#efe7d2" />)
      );
      p.push(<polygon key={key("ent")} points={quad("R", 0.14, 0.86, 0.64, 0.72)} fill="#f3ecda" />);
      const a0 = Fp("R", 0.14, 0.72);
      const a1 = Fp("R", 0.86, 0.72);
      p.push(
        <polygon
          key={key("ped")}
          points={`${a0.x},${a0.y} ${a1.x},${a1.y} ${(a0.x + a1.x) / 2},${Math.min(a0.y, a1.y) - 22}`}
          fill="#f6efdf"
          stroke="rgba(0,0,0,0.18)"
        />
      );
      break;
    }
    case "university": {
      const ty = roofY - 58;
      p.push(<rect key={key("tw")} x={cx - 14} y={ty} width={28} height={62} fill={c.colors.lit} />);
      p.push(<rect key={key("tw2")} x={cx} y={ty} width={14} height={62} fill={c.colors.dark} />);
      p.push(<polygon key={key("twr")} points={`${cx - 16},${ty} ${cx + 16},${ty} ${cx},${ty - 18}`} fill={c.colors.roofC} />);
      p.push(<circle key={key("clk")} cx={cx} cy={ty + 20} r={10} fill="#fff" stroke="#2a2f45" strokeWidth={2} />);
      p.push(<line key={key("ch1")} x1={cx} y1={ty + 20} x2={cx} y2={ty + 13} stroke="#2a2f45" strokeWidth={2} />);
      p.push(<line key={key("ch2")} x1={cx} y1={ty + 20} x2={cx + 6} y2={ty + 20} stroke="#2a2f45" strokeWidth={2} />);
      break;
    }
    case "hitech": {
      p.push(<line key={key("ant")} x1={cx + 12} y1={roofY} x2={cx + 12} y2={roofY - 48} stroke="#8b94a3" strokeWidth={3} />);
      p.push(<circle key={key("antb")} className="blink" cx={cx + 12} cy={roofY - 50} r={4} fill="#ff5a6a" />);
      p.push(<ellipse key={key("dish")} cx={cx - 18} cy={roofY - 14} rx={12} ry={6} fill="#dde3ea" stroke="#9aa3b0" transform={`rotate(-28 ${cx - 18} ${roofY - 14})`} />);
      p.push(<line key={key("dishs")} x1={cx - 18} y1={roofY - 14} x2={cx - 18} y2={roofY} stroke="#9aa3b0" strokeWidth={2} />);
      break;
    }
    case "cinema": {
      // marquee band with bulbs over the entrance
      p.push(<polygon key={key("mq")} points={quad("R", 0.08, 0.92, 0.46, 0.62)} fill="#2a1540" stroke="#ff5bd0" strokeWidth={1.5} />);
      for (let k = 0; k < 7; k++) {
        const pt = Fp("R", 0.14 + k * 0.12, 0.47);
        p.push(<circle key={key("bulb" + k)} className="blink" cx={pt.x} cy={pt.y} r={2.6} fill="#ffd36a" style={{ animationDelay: `${k * 0.12}s` }} />);
      }
      break;
    }
    case "club": {
      p.push(<line key={key("dbp")} x1={cx} y1={roofY} x2={cx} y2={roofY - 26} stroke="#9aa3b0" strokeWidth={2} />);
      p.push(<circle key={key("db")} className="spin" cx={cx} cy={roofY - 36} r={11} fill="#c7d2e0" stroke="#8b94a3" />);
      p.push(<circle key={key("dbh")} cx={cx - 3} cy={roofY - 40} r={3} fill="#ffffff" />);
      break;
    }
    case "gym": {
      const m = Fp("R", 0.5, 0.52);
      p.push(<rect key={key("db1")} x={m.x - 14} y={m.y - 2.5} width={28} height={5} fill="#2a2f45" />);
      p.push(<circle key={key("dbL")} cx={m.x - 14} cy={m.y} r={6} fill="#2a2f45" />);
      p.push(<circle key={key("dbR")} cx={m.x + 14} cy={m.y} r={6} fill="#2a2f45" />);
      break;
    }
    case "burger": {
      p.push(
        <path
          key={key("arch")}
          d={`M ${cx - 20} ${roofY - 6} Q ${cx - 11} ${roofY - 34} ${cx - 2} ${roofY - 6} M ${cx + 2} ${roofY - 6} Q ${cx + 11} ${roofY - 34} ${cx + 20} ${roofY - 6}`}
          stroke="#ffb400"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
        />
      );
      break;
    }
    default:
      break;
  }
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
            <ellipse cx={0} cy={2} rx={13} ry={5} fill="rgba(0,0,0,0.28)" />
            <g className="iso-token-bob">
              <path d="M 0,-44 C 13,-44 17,-29 0,-14 C -17,-29 -13,-44 0,-44 Z" fill="#7c5cff" stroke="#fff" strokeWidth="2.5" />
              <circle cx={0} cy={-34} r={11} fill="#fff" />
              <text x={0} y={-29} textAnchor="middle" className="iso-token-face">
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
