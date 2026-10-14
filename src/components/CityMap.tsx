import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { FLANDERS_CELL, LOCATIONS, RING, ringIndex, ringPath, getJob } from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { GameState, Location, LocationId } from "../game/types";
import Clock from "./Clock";
import { avatarShirt } from "./Portrait";

/* ----------------------------------------------------------------------------
   Springfield, built procedurally with Three.js: cel-shaded (toon) materials
   plus ink outlines (OutlineEffect) for a hand-drawn cartoon look.
---------------------------------------------------------------------------- */
const COLS = 5;
const ROWS = 4;
const SP = 2.05; // spacing between board cells
const STEP = 0.2; // seconds per space hopped

const INK = "#1d1a17";
const SKIN = "#fed90f";
const TITLE_FONT = `"Luckiest Guy", "Arial Black", Impact, sans-serif`;

const cellToWorld = (gx: number, gy: number) =>
  new THREE.Vector3((gx - (COLS - 1) / 2) * SP, 0, (gy - (ROWS - 1) / 2) * SP);
/** Half-extents of the inner walkway loop that runs around the town square. */
const INNER_X = ((COLS - 1) / 2) * SP - 1.0;
const INNER_Z = ((ROWS - 1) / 2) * SP - 1.0;
/** Tokens stand on the inner walkway, on the square side of their building, so every
    walk follows the loop around the square (corner cells sit on the loop's corners). */
const tokenWorld = (gx: number, gy: number) => {
  const p = cellToWorld(gx, gy);
  const x = gx === 0 ? -INNER_X : gx === COLS - 1 ? INNER_X : p.x;
  const z = gy === 0 ? -INNER_Z : gy === ROWS - 1 ? INNER_Z : p.z;
  return new THREE.Vector3(x, 0, z);
};

/* ---- materials ------------------------------------------------------------ */
let gradientMap: THREE.DataTexture | null = null;
/** Three hard light bands: the classic cel-shaded look. */
function toonGradient() {
  if (!gradientMap) {
    gradientMap = new THREE.DataTexture(new Uint8Array([125, 195, 255]), 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}
function toon(color: string, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}
/** A self-lit material (neon, bulbs, glowing goo). */
function glow(color: string) {
  return toon(color, { emissive: color, emissiveIntensity: 0.75 });
}
function noOutline<M extends THREE.Material>(m: M): M {
  m.userData.outlineParameters = { visible: false };
  return m;
}

/** Rounded (beveled) box: soft, toy-like edges. */
function rb(w: number, h: number, d: number, radius = 0.05) {
  const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
  return new RoundedBoxGeometry(w, h, d, 3, Math.max(0.004, r));
}

/* ---- canvas text: signs + labels ----------------------------------------- */
function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

interface SignOpts {
  bg?: string;
  fg: string;
  stroke?: string;
  border?: string | null;
  vertical?: boolean;
  radius?: number;
}

function signCanvas(text: string, pxW: number, pxH: number, o: SignOpts) {
  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = pxH;
  const c = canvas.getContext("2d")!;
  if (o.bg) {
    roundRectPath(c, 4, 4, pxW - 8, pxH - 8, o.radius ?? Math.min(pxW, pxH) * 0.18);
    c.fillStyle = o.bg;
    c.fill();
    if (o.border !== null) {
      c.lineWidth = 7;
      c.strokeStyle = o.border ?? INK;
      c.stroke();
    }
  }
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  const draw = (t: string, x: number, y: number, size: number) => {
    c.font = `${size}px ${TITLE_FONT}`;
    if (o.stroke) {
      c.lineWidth = size * 0.16;
      c.strokeStyle = o.stroke;
      c.strokeText(t, x, y);
    }
    c.fillStyle = o.fg;
    c.fillText(t, x, y);
  };
  if (o.vertical) {
    const chars = [...text];
    const size = Math.min(pxW * 0.68, (pxH * 0.86) / chars.length);
    chars.forEach((ch, i) => draw(ch, pxW / 2, pxH / 2 + (i - (chars.length - 1) / 2) * size + size * 0.08, size));
  } else if (text) {
    let size = pxH * 0.62;
    c.font = `${size}px ${TITLE_FONT}`;
    const maxW = pxW * 0.86;
    const m = c.measureText(text).width;
    if (m > maxW) size *= maxW / m;
    draw(text, pxW / 2, pxH / 2 + size * 0.07, size);
  }
  return canvas;
}

/** A flat sign plane facing +z, with crisp canvas lettering. */
function signMesh(text: string, w: number, h: number, o: SignOpts) {
  const base = 128;
  const pxW = o.vertical ? base : Math.min(2048, Math.round((base * w) / h));
  const pxH = o.vertical ? Math.min(2048, Math.round((base * h) / w)) : base;
  const tex = new THREE.CanvasTexture(signCanvas(text, pxW, pxH, o));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = noOutline(new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function makeLabel(text: string, scale = 1) {
  const fs = 40;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `${fs}px ${TITLE_FONT}`;
  const w = Math.ceil(probe.measureText(text).width) + 40;
  const h = fs + 26;
  const canvas = document.createElement("canvas");
  canvas.width = w + 8;
  canvas.height = h + 8;
  const c = canvas.getContext("2d")!;
  roundRectPath(c, 4, 4, w, h, h / 2);
  c.fillStyle = "#fffdf3";
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = INK;
  c.stroke();
  c.font = `${fs}px ${TITLE_FONT}`;
  c.fillStyle = INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false })
  );
  const s = 0.00055 * scale;
  sprite.scale.set(canvas.width * s, canvas.height * s, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/* ---- shared kit for building Springfield --------------------------------- */
function kit(g: THREE.Group) {
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, r = 0.05) =>
    mesh(rb(w, h, d, r), mat, x, y, z);
  const cyl = (rt: number, rbot: number, h: number, x: number, y: number, z: number, mat: THREE.Material, seg = 20) =>
    mesh(new THREE.CylinderGeometry(rt, rbot, h, seg), mat, x, y, z);
  const ball = (r: number, x: number, y: number, z: number, mat: THREE.Material, seg = 18) =>
    mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7))), mat, x, y, z);
  /** Four-sided hip roof spanning w x d, base at y. */
  const hipRoof = (w: number, d: number, h: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4);
    geo.rotateY(Math.PI / 4);
    const m = mesh(geo, mat, x, y + h / 2, z);
    m.scale.set(w, h, d);
    return m;
  };
  /** Triangular gable roof: `span` across the slope, `len` along the ridge. */
  const gable = (span: number, len: number, h: number, x: number, y: number, z: number, mat: THREE.Material, ridgeAlongX = true) => {
    const sh = new THREE.Shape();
    sh.moveTo(-span / 2, 0);
    sh.lineTo(span / 2, 0);
    sh.lineTo(0, h);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
    geo.translate(0, 0, -len / 2);
    if (ridgeAlongX) geo.rotateY(Math.PI / 2);
    return mesh(geo, mat, x, y, z);
  };
  /** A truncated, sloped fascia (mansard band). */
  const mansard = (w: number, d: number, h: number, x: number, y: number, z: number, mat: THREE.Material, taper = 0.82) => {
    const geo = new THREE.CylinderGeometry(Math.SQRT1_2 * taper, Math.SQRT1_2, 1, 4, 1);
    geo.rotateY(Math.PI / 4);
    const m = mesh(geo, mat, x, y + h / 2, z);
    m.scale.set(w, h, d);
    return m;
  };
  /** Framed window on the front (+z) face. */
  const win = (w: number, h: number, x: number, y: number, z: number, frame: THREE.Material, glass: THREE.Material) => {
    box(w + 0.05, h + 0.05, 0.03, x, y, z, frame, 0.012);
    return box(w, h, 0.035, x, y, z + 0.012, glass, 0.01);
  };
  /** Framed window on the right (+x) face. */
  const winSide = (w: number, h: number, x: number, y: number, z: number, frame: THREE.Material, glass: THREE.Material) => {
    box(0.03, h + 0.05, w + 0.05, x, y, z, frame, 0.012);
    return box(0.035, h, w, x + 0.012, y, z, glass, 0.01);
  };
  const sign = (text: string, w: number, h: number, x: number, y: number, z: number, o: SignOpts) => {
    const s = signMesh(text, w, h, o);
    s.position.set(x, y, z);
    g.add(s);
    return s;
  };
  /** Little cartoon townsperson (no eyes at this scale). */
  const person = (x: number, z: number, shirt: string, hair: string, ry = 0) => {
    const p = new THREE.Group();
    const add = (m: THREE.Mesh) => {
      m.castShadow = true;
      p.add(m);
      return m;
    };
    const pants = toon("#3b5c99");
    for (const sx of [-0.025, 0.025]) {
      const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), pants));
      leg.position.set(sx, 0.05, 0);
    }
    const torso = add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.11, 10), toon(shirt)));
    torso.position.y = 0.155;
    const head = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.05, 4, 10), toon(SKIN)));
    head.position.y = 0.27;
    const top = add(new THREE.Mesh(new THREE.SphereGeometry(0.043, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(hair)));
    top.position.y = 0.29;
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    g.add(p);
    return p;
  };
  return { mesh, box, cyl, ball, hipRoof, gable, mansard, win, winSide, sign, person };
}

/* ---- the landmarks --------------------------------------------------------- */
function buildBuilding(loc: Location) {
  const g = new THREE.Group();
  g.userData.locId = loc.id;
  const { mesh, box, cyl, ball, hipRoof, gable, mansard, win, winSide, sign, person } = kit(g);

  // common palette
  const white = toon("#fbfaf4");
  const frame = toon("#fbfaf4");
  const glass = toon("#8fd3f4", { emissive: "#3c8fc2", emissiveIntensity: 0.25 });
  const darkGlass = toon("#4b7c9e");
  const concrete = toon("#d6d1c4");
  const roofGrey = toon("#7b7d86");
  const metal = toon("#b9bec6");
  const ink = toon("#2b2723");
  const accent = toon(loc.accent);

  let body: THREE.Mesh;
  let topY = 1.5;
  let halfW = 0.65;

  switch (loc.id) {
    /* -------- 742 Evergreen Terrace -------- */
    case "home": {
      /* 742 Evergreen Terrace, after the show's establishing shot: peach two-storey under a
         brown hip roof with a grey eave band, two double windows upstairs, a coral arched
         door between two bay windows with brown domed caps, chimney on the left, TV antenna,
         and a front-gabled garage on the right with the pink sedan in the driveway */
      const wall = toon("#f4b98e");
      const roof = toon("#8b5a2b");
      const eave = toon("#8f8f8f");
      const brown = toon("#7a4a2a");
      const teal = toon("#82d8cc", { emissive: "#2f8f86", emissiveIntensity: 0.2 });
      const curtain = toon("#4fb3a6");
      const chimney = toon("#e8a77c");
      const brick = toon("#c46a3c");
      const hx = -0.2;
      const w = 1.14, h = 1.0, d = 0.82;
      const fz = d / 2;
      body = box(w, h, d, hx, h / 2, 0, wall, 0.03);
      box(w + 0.2, 0.06, d + 0.2, hx, h + 0.01, 0, eave, 0.01);
      hipRoof(w + 0.26, d + 0.26, 0.42, hx, h + 0.04, 0, roof);
      // chimney on the left gable end + TV antenna
      box(0.16, 0.95, 0.16, hx - w / 2 + 0.16, h + 0.1, -0.2, chimney, 0.02);
      box(0.18, 0.06, 0.18, hx - w / 2 + 0.16, h + 0.58, -0.2, brick, 0.02);
      cyl(0.008, 0.008, 0.36, hx - 0.05, h + 0.42, -0.05, ink, 6);
      for (const [y, l] of [[0.56, 0.18], [0.5, 0.12]]) box(l, 0.01, 0.01, hx - 0.05, h + y, -0.05, ink, 0.003);
      // upstairs: two double windows with teal glass and curtains
      for (const ux of [-0.28, 0.28]) {
        const x = hx + ux;
        box(0.4, 0.22, 0.03, x, 0.78, fz, brown, 0.01);
        box(0.37, 0.19, 0.035, x, 0.78, fz + 0.01, teal, 0.01);
        box(0.015, 0.19, 0.04, x, 0.78, fz + 0.015, brown, 0.003);
        for (const cx2 of [-0.16, 0.16]) box(0.04, 0.17, 0.02, x + cx2, 0.78, fz + 0.03, curtain, 0.006);
      }
      // coral arched front door in a brown arch, with a step
      const door = toon("#e57a6a");
      box(0.2, 0.3, 0.04, hx, 0.17, fz + 0.01, door, 0.02);
      const archTop = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 18, 1, false, -Math.PI / 2, Math.PI), door, hx, 0.32, fz + 0.01);
      archTop.rotation.x = Math.PI / 2;
      const archTrim = mesh(new THREE.TorusGeometry(0.115, 0.022, 6, 18, Math.PI), brown, hx, 0.32, fz + 0.03);
      void archTrim;
      for (const sx of [-0.115, 0.115]) box(0.035, 0.32, 0.04, hx + sx, 0.16, fz + 0.03, brown, 0.008);
      ball(0.016, hx - 0.06, 0.18, fz + 0.04, toon("#c9b6e8"), 8);
      box(0.3, 0.04, 0.14, hx, 0.02, fz + 0.08, concrete, 0.01);
      // two bay windows with brown domed caps
      for (const bx of [-0.36, 0.36]) {
        const x = hx + bx;
        box(0.34, 0.3, 0.12, x, 0.24, fz + 0.05, brown, 0.02);
        box(0.3, 0.26, 0.03, x, 0.24, fz + 0.105, teal, 0.01);
        for (const mx of [-0.09, 0, 0.09]) box(0.014, 0.26, 0.035, x + mx, 0.24, fz + 0.115, brown, 0.003);
        box(0.3, 0.014, 0.035, x, 0.26, fz + 0.115, brown, 0.003);
        const cap = mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), roof, x, 0.39, fz + 0.04);
        cap.scale.set(0.9, 0.55, 0.55);
      }
      // garage on the right: front-facing gable, little cross window, peach door
      const gx = 0.66;
      const gw = 0.62, gh = 0.62, gd = 0.86;
      box(gw, gh, gd, gx, gh / 2, 0.02, wall, 0.03);
      box(0.3, 0.12, 0.6, gx - gw / 2 - 0.1, h - 0.1, -0.08, roof, 0.02);
      gable(gw + 0.14, gd + 0.1, 0.32, gx, gh, 0.02, roof, false);
      box(0.11, 0.1, 0.03, gx, gh + 0.11, gd / 2 + 0.05, brown, 0.01);
      box(0.09, 0.08, 0.03, gx, gh + 0.11, gd / 2 + 0.06, teal, 0.01);
      box(0.012, 0.08, 0.035, gx, gh + 0.11, gd / 2 + 0.065, brown, 0.003);
      box(0.09, 0.012, 0.035, gx, gh + 0.11, gd / 2 + 0.065, brown, 0.003);
      box(0.48, 0.4, 0.04, gx, 0.22, gd / 2 + 0.03, toon("#f2c4a0"), 0.02);
      box(0.5, 0.025, 0.5, gx, 0.012, gd / 2 + 0.28, concrete, 0.01);
      // Homer's pink sedan in the driveway
      const pinkCar = toon("#d98ad6");
      const cz = gd / 2 + 0.3;
      box(0.3, 0.1, 0.5, gx, 0.1, cz, pinkCar, 0.04);
      box(0.24, 0.09, 0.26, gx, 0.19, cz - 0.04, pinkCar, 0.04);
      box(0.22, 0.07, 0.02, gx, 0.19, cz + 0.09, teal, 0.01);
      for (const [wx, wz] of [[-0.13, -0.15], [0.13, -0.15], [-0.13, 0.15], [0.13, 0.15]]) {
        const wheel = cyl(0.05, 0.05, 0.04, gx + wx, 0.05, cz + wz, ink, 12);
        wheel.rotation.z = Math.PI / 2;
      }
      for (const sx of [-0.11, 0.11]) box(0.04, 0.05, 0.02, gx + sx, 0.11, cz + 0.255, toon("#f08a24"), 0.01);
      // front walk, bushes, blue mailbox
      box(0.14, 0.02, 0.26, hx, 0.01, fz + 0.27, concrete, 0.005);
      box(0.72, 0.02, 0.12, hx + 0.36, 0.01, fz + 0.38, concrete, 0.005);
      const bush = toon("#56b84a");
      for (const [bx2, br] of [[-0.17, 0.07], [0.17, 0.07], [-0.62, 0.09]] as [number, number][]) ball(br, hx + bx2, br * 0.9, fz + 0.1, bush, 12);
      cyl(0.012, 0.012, 0.2, gx - 0.36, 0.1, fz + 0.46, toon("#9a6b3f"), 6);
      box(0.06, 0.06, 0.11, gx - 0.36, 0.22, fz + 0.46, toon("#2f6fd6"), 0.025);
      topY = h + 0.62;
      halfW = 0.85;
      break;
    }
    /* -------- Springfield Employment Office -------- */
    case "employment": {
      const wall = toon("#ecdcae");
      const w = 1.25, h = 1.12, d = 0.95;
      body = box(w, h, d, 0, h / 2, 0, wall);
      box(w + 0.08, 0.1, d + 0.08, 0, h + 0.05, 0, accent);
      box(w - 0.12, 0.06, d - 0.12, 0, h + 0.12, 0, roofGrey);
      // upper storey windows
      for (const wx of [-0.42, -0.14, 0.14, 0.42]) win(0.17, 0.24, wx, 0.86, d / 2, frame, glass);
      // sign band between floors
      box(1.0, 0.16, 0.04, 0, 0.6, d / 2 + 0.01, accent, 0.02);
      sign("EMPLOYMENT OFFICE", 0.94, 0.12, 0, 0.6, d / 2 + 0.035, { fg: "#ffffff", stroke: INK });
      // glass doors + awning + steps
      box(0.36, 0.42, 0.04, 0, 0.21, d / 2 + 0.01, darkGlass, 0.02);
      box(0.012, 0.42, 0.05, 0, 0.21, d / 2 + 0.02, frame, 0.004);
      const awn = box(0.56, 0.04, 0.24, 0, 0.47, d / 2 + 0.12, accent, 0.015);
      awn.rotation.x = 0.18;
      box(0.5, 0.05, 0.14, 0, 0.025, d / 2 + 0.08, concrete);
      for (const wx of [-0.42, 0.42]) win(0.2, 0.22, wx, 0.28, d / 2, frame, glass);
      winSide(0.24, 0.24, w / 2, 0.86, 0, frame, glass);
      winSide(0.24, 0.22, w / 2, 0.28, 0, frame, glass);
      // flagpole + flag
      cyl(0.014, 0.014, 0.85, 0.5, h + 0.5, 0.25, metal, 8);
      ball(0.025, 0.5, h + 0.93, 0.25, toon("#f2c14e"), 8);
      const flag = signMesh("", 0.3, 0.18, { bg: "#e23b3b", fg: "#fff", border: null, radius: 2 });
      const fc = (flag.material as THREE.MeshBasicMaterial).map!.image as HTMLCanvasElement;
      const fx = fc.getContext("2d")!;
      for (let i = 0; i < 7; i++) {
        fx.fillStyle = i % 2 ? "#fbfaf4" : "#e23b3b";
        fx.fillRect(0, (i * fc.height) / 7, fc.width, fc.height / 7 + 1);
      }
      fx.fillStyle = "#2f4fa8";
      fx.fillRect(0, 0, fc.width * 0.42, fc.height * 0.56);
      (flag.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
      flag.position.set(0.66, h + 0.8, 0.25);
      g.add(flag);
      // take a number: a little queue out front
      person(-0.52, d / 2 + 0.2, "#e8562a", "#5a3a1e");
      person(-0.36, d / 2 + 0.24, "#45a84e", "#2f63d6");
      person(-0.2, d / 2 + 0.22, "#f6f6f2", SKIN);
      topY = h + 0.3;
      halfW = w / 2;
      break;
    }

    /* -------- Springfield University -------- */
    case "university": {
      const w = 1.5, d = 1.15, h = 1.0;
      const baseH = 0.14;
      const brick = toon("#b8503a");
      const stone = toon("#efe6cf");
      const copper = toon("#5fb39a");
      box(w + 0.14, baseH, d + 0.12, 0, baseH / 2, 0, stone);
      body = box(w, h, d, 0, baseH + h / 2, 0, brick);
      // side wings
      for (const sx of [-1, 1]) {
        box(0.46, h - 0.3, 0.86, sx * (w / 2 + 0.04), baseH + (h - 0.3) / 2, -0.06, brick);
        box(0.52, 0.08, 0.92, sx * (w / 2 + 0.04), baseH + h - 0.26, -0.06, stone);
      }
      // tall arched windows
      for (const wx of [-0.5, 0.5]) {
        for (const off of [-0.12, 0.12]) {
          const x = wx + off;
          box(0.13, 0.46, 0.04, x, baseH + 0.5, d / 2 + 0.01, glass, 0.015);
          const arch = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 14, 1, false, -Math.PI / 2, Math.PI), glass, x, baseH + 0.73, d / 2 + 0.01);
          arch.rotation.x = Math.PI / 2;
          box(0.17, 0.035, 0.05, x, baseH + 0.26, d / 2 + 0.025, stone, 0.01);
        }
      }
      // portico: steps, columns, entablature, pediment
      for (let s = 0; s < 3; s++) box(0.72 - s * 0.05, 0.05, 0.14, 0, 0.025 + s * 0.05, d / 2 + 0.3 - s * 0.08, stone, 0.015);
      for (const cx2 of [-0.24, -0.08, 0.08, 0.24]) {
        cyl(0.045, 0.05, 0.62, cx2, baseH + 0.31, d / 2 + 0.17, stone, 14);
        box(0.12, 0.04, 0.12, cx2, baseH + 0.64, d / 2 + 0.17, stone, 0.01);
      }
      box(0.72, 0.1, 0.2, 0, baseH + 0.71, d / 2 + 0.17, stone, 0.02);
      sign("SPRINGFIELD U", 0.6, 0.07, 0, baseH + 0.71, d / 2 + 0.272, { fg: "#8a2f20" });
      const ped = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 3), stone, 0, baseH + 0.83, d / 2 + 0.17);
      ped.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      ped.scale.set(1, 1, 0.42);
      box(0.3, 0.42, 0.04, 0, baseH + 0.21, d / 2 + 0.01, toon("#6b3a22"), 0.02);
      // roof + clock tower + copper dome
      const roofTop = baseH + h;
      box(w + 0.08, 0.1, d + 0.08, 0, roofTop + 0.05, 0, stone);
      const tY = roofTop + 0.42;
      box(0.46, 0.76, 0.46, 0, tY, -0.05, brick);
      box(0.52, 0.06, 0.52, 0, tY + 0.4, -0.05, stone);
      const face = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 24), white, 0, tY + 0.12, 0.19);
      face.rotation.x = Math.PI / 2;
      box(0.015, 0.1, 0.012, 0, tY + 0.16, 0.215, ink, 0.004);
      box(0.075, 0.015, 0.012, 0.03, tY + 0.12, 0.215, ink, 0.004);
      for (const cx2 of [-0.15, 0.15]) cyl(0.03, 0.03, 0.26, cx2, tY + 0.56, 0.12, stone, 10);
      box(0.4, 0.26, 0.36, 0, tY + 0.56, -0.08, brick);
      mesh(new THREE.SphereGeometry(0.26, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), copper, 0, tY + 0.7, -0.05);
      cyl(0.012, 0.012, 0.22, 0, tY + 1.06, -0.05, toon("#f2c14e"), 6);
      ball(0.04, 0, tY + 1.18, -0.05, toon("#f2c14e"), 10);
      topY = tY + 1.25;
      halfW = w / 2;
      break;
    }

    /* -------- Krusty Burger -------- */
    case "krusty": {
      /* Krusty Burger, after the show: tan-orange walls under a red-orange mansard roof with
         white ribs, big teal windows, and a tall pole sign with the clown's head on top */
      const walls = toon("#efaa62");
      const roofRed = toon("#e0552b");
      const red = toon("#e0352b");
      const teal = toon("#82d8cc", { emissive: "#2f8f86", emissiveIntensity: 0.2 });
      const w = 1.14, h = 0.6, d = 0.96, bx0 = 0.12;
      body = box(w, h, d, bx0, h / 2, 0, walls);
      box(w + 0.03, 0.08, d + 0.03, bx0, 0.04, 0, toon("#c9783a"));
      const mH = 0.3, taper = 0.84;
      mansard(w + 0.2, d + 0.2, mH, bx0, h - 0.02, 0, roofRed, taper);
      box(w - 0.06, 0.05, d - 0.06, bx0, h + mH - 0.03, 0, roofGrey);
      // white ribs down the front and side slopes
      const tilt = Math.atan(((1 - taper) * (d + 0.2)) / 2 / mH);
      for (let i = 0; i < 9; i++) {
        const rib = box(0.025, mH + 0.02, 0.02, bx0 - 0.5 + i * 0.125, h - 0.02 + mH / 2, (d + 0.2) / 2 - ((1 - taper) * (d + 0.2)) / 4, white, 0.006);
        rib.rotation.x = -tilt;
      }
      for (let i = 0; i < 7; i++) {
        const rib = box(0.02, mH + 0.02, 0.025, bx0 + (w + 0.2) / 2 - ((1 - taper) * (w + 0.2)) / 4, h - 0.02 + mH / 2, -0.38 + i * 0.125, white, 0.006);
        rib.rotation.z = Math.atan(((1 - taper) * (w + 0.2)) / 2 / mH);
      }
      // big teal windows with white frames, glass doors
      for (const wx of [-0.3, 0.12]) {
        box(0.36, 0.3, 0.03, bx0 + wx, 0.34, d / 2 + 0.01, white, 0.012);
        box(0.32, 0.26, 0.035, bx0 + wx, 0.34, d / 2 + 0.02, teal, 0.01);
        box(0.015, 0.26, 0.04, bx0 + wx, 0.34, d / 2 + 0.025, white, 0.004);
      }
      box(0.2, 0.42, 0.04, bx0 + 0.43, 0.21, d / 2 + 0.01, darkGlass, 0.02);
      winSide(0.6, 0.28, bx0 + w / 2, 0.34, 0, white, teal);
      // tall pole sign: cream board, red lettering, maroon rim, the clown's head on top
      const px = -0.62, pz = 0.38;
      cyl(0.035, 0.045, 1.3, px, 0.65, pz, toon("#d9d9d9"), 10);
      const signY = 1.32;
      box(0.66, 0.26, 0.07, px, signY, pz, toon("#7a2e22"), 0.06);
      sign("KRUSTY BURGER", 0.6, 0.2, px, signY, pz + 0.037, { bg: "#fff3b0", fg: "#e0352b", border: null, radius: 22 });
      const headY = signY + 0.36;
      ball(0.24, px, headY, pz, white, 24);
      ball(0.06, px, headY - 0.02, pz + 0.24, red, 12);
      for (const sx of [-1, 1]) {
        ball(0.07, px + sx * 0.09, headY + 0.07, pz + 0.18, white, 12);
        ball(0.028, px + sx * 0.085, headY + 0.07, pz + 0.25, toon("#3d8fe0"), 8);
        ball(0.12, px + sx * 0.24, headY + 0.02, pz - 0.02, toon("#4fae4a"), 12);
        ball(0.085, px + sx * 0.19, headY + 0.15, pz - 0.05, toon("#4fae4a"), 10);
      }
      const smile = mesh(new THREE.TorusGeometry(0.105, 0.026, 8, 18, Math.PI), red, px, headY - 0.09, pz + 0.19);
      smile.rotation.set(0.35, 0, Math.PI);
      // drive-thru menu board
      cyl(0.015, 0.015, 0.3, bx0 + w / 2 + 0.14, 0.15, 0.3, metal, 6);
      box(0.06, 0.18, 0.24, bx0 + w / 2 + 0.14, 0.36, 0.3, toon("#fed90f"), 0.02);
      topY = headY + 0.3;
      halfW = 0.6;
      break;
    }
    /* -------- Try-N-Save -------- */
    case "trynsave": {
      const wall = toon("#e2e7ee");
      const w = 1.62, h = 0.86, d = 1.2;
      body = box(w, h, d, 0, h / 2, 0, wall);
      box(w + 0.05, 0.26, d + 0.05, 0, h - 0.06, 0, accent);
      box(w - 0.06, 0.04, d - 0.06, 0, h + 0.08, 0, roofGrey);
      sign("TRY-N-SAVE", 1.0, 0.2, 0, h - 0.06, d / 2 + 0.03, { bg: "#fed90f", fg: "#e0352b", stroke: INK });
      // glass entrance + canopy + carts
      box(0.5, 0.42, 0.04, 0, 0.21, d / 2 + 0.01, darkGlass, 0.02);
      for (const mx of [-0.12, 0.12]) box(0.02, 0.42, 0.05, mx, 0.21, d / 2 + 0.02, frame, 0.005);
      box(0.66, 0.05, 0.26, 0, 0.5, d / 2 + 0.13, accent, 0.015);
      for (const sx of [-0.3, 0.3]) cyl(0.015, 0.015, 0.5, sx, 0.25, d / 2 + 0.24, metal, 6);
      for (const cx2 of [0.48, 0.6]) {
        box(0.1, 0.07, 0.14, cx2, 0.09, d / 2 + 0.24, toon("#c9ced6"), 0.01);
        box(0.01, 0.08, 0.01, cx2, 0.04, d / 2 + 0.3, metal, 0.003);
      }
      // SALE banner + side windows
      box(0.38, 0.2, 0.03, -0.52, 0.3, d / 2 + 0.01, toon("#e0352b"), 0.02);
      sign("SALE!", 0.34, 0.16, -0.52, 0.3, d / 2 + 0.03, { fg: "#ffffff", stroke: INK });
      for (const wz of [-0.3, 0.2]) winSide(0.3, 0.2, w / 2, 0.3, wz, frame, glass);
      // rooftop HVAC
      for (const [hx, hz] of [[-0.4, -0.25], [0.35, -0.1]] as [number, number][]) {
        box(0.3, 0.16, 0.26, hx, h + 0.18, hz, metal, 0.03);
        cyl(0.07, 0.07, 0.03, hx, h + 0.27, hz, ink, 12);
      }
      topY = h + 0.35;
      halfW = w / 2;
      break;
    }

    /* -------- Globex Corporation -------- */
    case "globex": {
      const teal = toon("#46c2b8", { emissive: "#1d7f78", emissiveIntensity: 0.2 });
      const band = toon("#f4f4ef");
      const podH = 0.3;
      body = box(1.25, podH, 1.05, 0, podH / 2, 0, concrete);
      box(0.6, 0.24, 0.04, 0, 0.13, 0.535, darkGlass, 0.02);
      box(1.0, 0.13, 0.03, 0, 0.36, 0.42, toon("#18323a"), 0.02);
      sign("GLOBEX", 0.6, 0.11, 0, 0.36, 0.44, { fg: "#46c2b8" });
      // stacked glass floors
      const floors = 4;
      const fh = 0.26;
      for (let i = 0; i < floors; i++) {
        const y = podH + i * fh;
        box(0.82, 0.05, 0.74, 0, y + 0.025, -0.08, band, 0.015);
        box(0.76, fh - 0.05, 0.68, 0, y + 0.05 + (fh - 0.05) / 2, -0.08, teal, 0.02);
      }
      const roofY = podH + floors * fh;
      box(0.86, 0.08, 0.78, 0, roofY + 0.04, -0.08, band, 0.02);
      // the globe on top
      cyl(0.04, 0.08, 0.22, 0, roofY + 0.19, -0.08, metal, 10);
      const gY = roofY + 0.62;
      ball(0.32, 0, gY, -0.08, toon("#3d8fe0"), 26);
      for (const [lx, ly, lz, r] of [[0.12, 0.12, 0.26, 0.11], [-0.18, -0.05, 0.22, 0.09], [0.05, -0.18, 0.25, 0.08]] as number[][]) {
        const land = ball(r, lx, gY + ly, -0.08 + lz, toon("#52b947"), 12);
        land.scale.set(1, 0.7, 0.35);
      }
      const gold = toon("#f2c14e");
      const ring1 = mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 40), gold, 0, gY, -0.08);
      ring1.rotation.x = Math.PI / 2 - 0.35;
      const ring2 = mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 40), gold, 0, gY, -0.08);
      ring2.rotation.y = 0.5;
      ring2.userData.spin = true;
      ring2.castShadow = false; // spins, and the shadow map is frozen
      topY = gY + 0.38;
      halfW = 0.62;
      break;
    }

    /* -------- Aztec Theater -------- */
    case "aztec": {
      const terra = toon("#d9783a");
      const turq = toon("#2bb3a8");
      const gold = toon("#f2c14e");
      const w = 1.3, h = 1.0, d = 1.0;
      body = box(w, h, d, 0, h / 2, -0.04, terra);
      // stepped (ziggurat) crown on the facade
      const tiers: [number, THREE.Material][] = [[1.14, turq], [0.84, gold], [0.54, turq], [0.26, gold]];
      tiers.forEach(([tw, m], i) => box(tw, 0.17, 0.3, 0, h + 0.085 + i * 0.17, 0.3, m, 0.02));
      // zig-zag trim
      for (let i = 0; i < 6; i++) {
        const t = box(0.11, 0.11, 0.03, -0.5 + i * 0.2, h - 0.12, d / 2 - 0.02, gold, 0.01);
        t.rotation.z = Math.PI / 4;
      }
      // marquee with chaser bulbs
      box(1.2, 0.24, 0.38, 0, 0.62, d / 2 + 0.1, white, 0.03);
      sign("NOW SHOWING: McBAIN", 1.08, 0.13, 0, 0.64, d / 2 + 0.293, { fg: "#e0352b" });
      const bulb = glow("#ffd34d");
      for (let i = 0; i < 11; i++) ball(0.022, -0.55 + i * 0.11, 0.49, d / 2 + 0.3, bulb, 8);
      // vertical blade sign
      box(0.2, 0.92, 0.07, w / 2 - 0.1, h + 0.12, d / 2 + 0.04, turq, 0.03);
      sign("AZTEC", 0.16, 0.86, w / 2 - 0.1, h + 0.12, d / 2 + 0.08, { fg: "#fed90f", stroke: INK, vertical: true });
      // doors + posters
      for (const dx of [-0.16, 0, 0.16]) box(0.13, 0.38, 0.04, dx, 0.19, d / 2 - 0.02, darkGlass, 0.015);
      box(0.18, 0.28, 0.03, -0.46, 0.24, d / 2 - 0.02, toon("#3d8fe0"), 0.015);
      box(0.18, 0.28, 0.03, 0.46, 0.24, d / 2 - 0.02, toon("#e0352b"), 0.015);
      topY = h + 0.75;
      halfW = w / 2;
      break;
    }

    /* -------- Moe's Tavern -------- */
    case "moes": {
      /* Moe's Tavern: plain brick front, one door, a frosted Duff window, the red neon sign */
      const brick = toon("#a85a3b");
      const trim = toon("#5a2e1e");
      const w = 0.98, h = 0.78, d = 0.9;
      body = box(w, h, d, 0, h / 2, 0, brick, 0.03);
      box(w + 0.02, 0.1, d + 0.02, 0, 0.05, 0, trim, 0.02);
      box(w + 0.06, 0.09, d + 0.06, 0, h + 0.045, 0, trim, 0.02);
      // door with its little porthole
      box(0.24, 0.46, 0.04, -0.16, 0.23, d / 2 + 0.01, toon("#3b2a22"), 0.02);
      const port = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), glass, -0.16, 0.34, d / 2 + 0.035);
      port.rotation.x = Math.PI / 2;
      box(0.06, 0.03, 0.03, -0.08, 0.36, d / 2 + 0.01, trim, 0.008);
      // frosted window with a round Duff sign
      box(0.26, 0.2, 0.04, 0.24, 0.38, d / 2 + 0.01, toon("#e9dca0", { emissive: "#c9a64a", emissiveIntensity: 0.4 }), 0.015);
      const duff = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 18), white, 0.24, 0.38, d / 2 + 0.04);
      duff.rotation.x = Math.PI / 2;
      sign("DUFF", 0.12, 0.06, 0.24, 0.38, d / 2 + 0.052, { fg: "#e0352b" });
      // the big neon "MOE'S" on a dark board over the door
      box(0.74, 0.22, 0.05, 0, 0.64, d / 2 + 0.03, toon("#26160f"), 0.02);
      sign("MOE'S", 0.68, 0.19, 0, 0.64, d / 2 + 0.06, { fg: "#ff4f4f", stroke: "#ffd6d6" });
      for (const sx of [-0.33, 0.33]) box(0.02, 0.12, 0.08, sx, 0.52, d / 2 + 0.06, metal, 0.005);
      winSide(0.18, 0.16, w / 2, 0.45, -0.15, trim, toon("#e9dca0", { emissive: "#c9a64a", emissiveIntensity: 0.4 }));
      // trash cans in the alley
      cyl(0.07, 0.065, 0.16, w / 2 + 0.12, 0.08, 0.25, metal, 12);
      cyl(0.075, 0.075, 0.02, w / 2 + 0.12, 0.17, 0.25, metal, 12);
      topY = h + 0.2;
      halfW = w / 2;
      break;
    }
    /* -------- Bowl-A-Rama -------- */
    case "bowlarama": {
      const wall = toon("#f6b3d1");
      const teal = toon("#2bb3a8");
      const w = 1.38, h = 0.72, d = 1.02;
      body = box(w, h, d, 0, h / 2, 0, wall);
      // googie roof: a tilted slab
      const roof = box(w + 0.24, 0.07, d + 0.18, 0, h + 0.1, 0, teal, 0.02);
      roof.rotation.z = -0.1;
      box(w + 0.02, 0.06, d + 0.02, 0, h, 0, white, 0.02);
      // facade lettering
      box(1.06, 0.18, 0.04, 0, 0.56, d / 2 + 0.01, white, 0.04);
      sign("BOWL-A-RAMA", 1.0, 0.15, 0, 0.56, d / 2 + 0.035, { fg: "#d94f9a", stroke: INK });
      box(0.3, 0.38, 0.04, -0.3, 0.19, d / 2 + 0.01, darkGlass, 0.02);
      for (const wx of [0.12, 0.42]) win(0.2, 0.2, wx, 0.27, d / 2, frame, glass);
      // giant pin + ball on the roof
      const pinPts = [
        [0, 0], [0.09, 0], [0.13, 0.12], [0.15, 0.27], [0.12, 0.44], [0.068, 0.58],
        [0.064, 0.66], [0.088, 0.77], [0.08, 0.86], [0.04, 0.92], [0, 0.93],
      ].map(([x, y]) => new THREE.Vector2(x * 1.35, y * 1.1));
      const py = h + 0.12;
      mesh(new THREE.LatheGeometry(pinPts, 22), white, 0.18, py, -0.05);
      for (const sy of [0.66, 0.74]) {
        const stripe = mesh(new THREE.TorusGeometry(0.093, 0.016, 8, 22), toon("#e0352b"), 0.18, py + sy * 1.1 - 0.02, -0.05);
        stripe.rotation.x = Math.PI / 2;
      }
      ball(0.2, -0.3, py + 0.16, 0.02, toon("#3049a8"), 22);
      for (const [fx, fy] of [[-0.05, 0.05], [0.04, 0.06], [0, -0.04]]) ball(0.026, -0.3 + fx, py + 0.16 + fy, 0.21, ink, 8);
      topY = py + 1.05;
      halfW = w / 2;
      break;
    }

    /* -------- Kwik-E-Mart -------- */
    case "kwikemart": {
      const wall = toon("#f1e3bf");
      const brick = toon("#c46a3c");
      const green = toon("#2fa35a");
      const orange = toon("#f08a24");
      const w = 1.3, h = 0.68, d = 1.0;
      body = box(w, h, d, 0, h / 2, 0, wall);
      box(w + 0.02, 0.16, d + 0.02, 0, 0.08, 0, brick);
      // the iconic sloped fascia, with an orange stripe
      mansard(w + 0.26, d + 0.24, 0.34, 0, h - 0.02, 0, green, 0.86);
      mansard(w + 0.28, d + 0.26, 0.06, 0, h - 0.02, 0, orange, 0.97);
      box(w - 0.04, 0.05, d - 0.06, 0, h + 0.32, 0, roofGrey);
      // sign on the fascia
      const sgn = sign("KWIK-E-MART", 1.1, 0.2, 0, h + 0.16, d / 2 + 0.1, { bg: "#fffdf3", fg: "#e0352b", stroke: "#fffdf3" });
      sgn.rotation.x = -0.35;
      // big windows with posters, glass door
      box(0.7, 0.32, 0.04, -0.18, 0.4, d / 2 + 0.01, glass, 0.02);
      for (const mx of [-0.4, -0.18, 0.04]) box(0.02, 0.32, 0.05, mx, 0.4, d / 2 + 0.02, frame, 0.005);
      box(0.13, 0.17, 0.02, -0.3, 0.42, d / 2 + 0.04, toon("#f6a5c0"), 0.01);
      box(0.13, 0.17, 0.02, -0.07, 0.42, d / 2 + 0.04, toon("#7cc4f2"), 0.01);
      box(0.22, 0.44, 0.04, 0.4, 0.22, d / 2 + 0.01, darkGlass, 0.02);
      // ice chest + Squishee drum out front
      box(0.26, 0.2, 0.14, -0.38, 0.1, d / 2 + 0.14, white, 0.02);
      sign("ICE", 0.18, 0.08, -0.38, 0.12, d / 2 + 0.215, { fg: "#2f6fd6" });
      cyl(0.07, 0.07, 0.18, 0.2, 0.09, d / 2 + 0.16, toon("#e0352b"), 12);
      ball(0.075, 0.2, 0.2, d / 2 + 0.16, toon("#7fd3f7"), 12);
      // pole sign + payphone
      cyl(0.03, 0.035, 1.05, w / 2 + 0.1, 0.52, 0.42, metal, 10);
      box(0.5, 0.26, 0.08, w / 2 + 0.1, 1.15, 0.42, green, 0.03);
      sign("KWIK-E-MART", 0.46, 0.2, w / 2 + 0.1, 1.15, 0.465, { bg: "#fffdf3", fg: "#e0352b", border: "#f08a24" });
      box(0.1, 0.22, 0.08, 0.62, 0.2, d / 2 + 0.05, toon("#3a5f9a"), 0.02);
      box(0.06, 0.08, 0.02, 0.62, 0.24, d / 2 + 0.095, metal, 0.01);
      topY = h + 0.62;
      halfW = w / 2;
      break;
    }

    /* -------- Lard Lad Donuts -------- */
    case "lardlad": {
      /* Lard Lad Donuts: a small pink shop dwarfed by the giant donut-hoisting statue */
      const wall = toon("#f7c2d8");
      const pink = toon("#ef5fa7");
      const w = 0.92, h = 0.6, d = 0.84;
      const sx0 = -0.3;
      body = box(w, h, d, sx0, h / 2, 0, wall);
      box(w + 0.08, 0.12, d + 0.08, sx0, h + 0.06, 0, pink);
      sign("LARD LAD DONUTS", 0.88, 0.1, sx0, h + 0.06, d / 2 + 0.042, { fg: "#ffffff", stroke: INK });
      for (let i = 0; i < 6; i++) {
        const s2 = box(0.15, 0.035, 0.2, sx0 - 0.375 + i * 0.15, 0.44, d / 2 + 0.09, i % 2 ? white : pink, 0.01);
        s2.rotation.x = 0.35;
      }
      box(0.42, 0.24, 0.04, sx0 - 0.15, 0.26, d / 2 + 0.01, glass, 0.02);
      box(0.18, 0.38, 0.04, sx0 + 0.28, 0.19, d / 2 + 0.01, darkGlass, 0.02);
      // the statue, built at unit scale then blown up to tower over the shop
      const st = new THREE.Group();
      g.add(st);
      const K = kit(st);
      const overalls = toon("#e04646");
      const shirt = toon("#fbfaf4");
      K.box(0.3, 0.1, 0.28, 0, 0.05, 0, concrete, 0.02);
      for (const s2 of [-0.05, 0.05]) K.cyl(0.04, 0.045, 0.3, s2, 0.25, 0, overalls, 10);
      K.box(0.22, 0.26, 0.16, 0, 0.51, 0, overalls, 0.05);
      K.box(0.18, 0.1, 0.17, 0, 0.6, 0, shirt, 0.04);
      K.mesh(new THREE.CapsuleGeometry(0.09, 0.08, 4, 14), toon(SKIN), 0, 0.78, 0);
      for (const s2 of [-1, 1]) {
        K.ball(0.04, s2 * 0.035, 0.8, 0.085, white, 10);
        K.ball(0.014, s2 * 0.035, 0.8, 0.12, ink, 6);
      }
      K.ball(0.09, 0, 0.9, 0.02, toon("#6b3f1f"), 12).scale.set(1.1, 0.6, 1.2);
      K.cyl(0.035, 0.035, 0.42, 0.12, 0.82, 0, shirt, 8).rotation.z = -0.3;
      K.cyl(0.035, 0.035, 0.24, -0.13, 0.46, 0.04, shirt, 8).rotation.z = 0.25;
      const dY = 1.13;
      K.mesh(new THREE.TorusGeometry(0.17, 0.08, 14, 28), toon("#d9a35c"), 0.2, dY, 0);
      K.mesh(new THREE.TorusGeometry(0.17, 0.07, 14, 28), pink, 0.2, dY, 0.025).scale.set(1, 1, 0.7);
      const sprinkleCols = ["#fed90f", "#7cc4f2", "#52b947", "#ffffff", "#e0352b"];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.17 + (i % 2 ? 0.035 : -0.03);
        K.box(0.035, 0.012, 0.012, 0.2 + Math.cos(a) * r, dY + Math.sin(a) * r, 0.085, toon(sprinkleCols[i % 5]), 0.004).rotation.z = a * 1.7;
      }
      st.position.set(0.42, 0, 0.12);
      st.scale.setScalar(1.45);
      topY = dY * 1.45 + 0.3;
      halfW = 0.6;
      break;
    }
    /* -------- Springfield Nuclear Power Plant -------- */
    case "plant": {
      const tower = toon("#cfccc3", { side: THREE.DoubleSide });
      const reactor = toon("#a9b6c2");
      const steam = toon("#ffffff", { transparent: true, opacity: 0.9 });
      const goo = glow("#8cff3a");
      // cooling towers (hyperboloids)
      const prof = [[0.4, 0], [0.33, 0.4], [0.27, 0.82], [0.28, 1.05], [0.31, 1.3]].map(([x, y]) => new THREE.Vector2(x, y));
      for (const [tx, tz] of [[-0.42, -0.18], [0.2, -0.3]]) {
        mesh(new THREE.LatheGeometry(prof, 26), tower, tx, 0, tz);
        const stripe = mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 26), toon("#b0ada4"), tx, 1.18, tz);
        stripe.rotation.x = Math.PI / 2;
        for (let i = 0; i < 3; i++) {
          const puff = ball(0.17 + i * 0.05, tx + 0.04 * i, 1.42 + i * 0.17, tz, steam, 14);
          puff.userData.puff = i;
          puff.castShadow = false;
        }
      }
      // reactor building with dome
      body = box(0.72, 0.5, 0.55, 0.45, 0.25, 0.25, reactor);
      ball(0.22, 0.45, 0.5, 0.2, toon("#d9dde2"), 20).scale.set(1, 0.8, 1);
      box(0.18, 0.3, 0.04, 0.45, 0.15, 0.53, toon("#2f5d3a"), 0.02);
      sign("SECTOR 7-G", 0.34, 0.07, 0.45, 0.38, 0.535, { fg: INK });
      // the front sign wall
      box(1.2, 0.2, 0.08, -0.15, 0.1, 0.6, concrete, 0.02);
      sign("SPRINGFIELD NUCLEAR POWER PLANT", 1.14, 0.12, -0.15, 0.12, 0.645, { fg: "#2b2723" });
      // leaky barrels
      for (const [bx, bz] of [[-0.75, 0.42], [-0.62, 0.5]]) {
        cyl(0.07, 0.07, 0.17, bx, 0.085, bz, toon("#f2c14e"), 12);
        cyl(0.06, 0.06, 0.012, bx, 0.175, bz, goo, 12);
      }
      const stackX = 0.72, stackZ = -0.35;
      cyl(0.07, 0.1, 1.5, stackX, 0.75, stackZ, toon("#d9d6cc"), 14);
      for (const y of [1.2, 1.38]) {
        const band = mesh(new THREE.TorusGeometry(0.078, 0.025, 6, 16), toon("#e0352b"), stackX, y, stackZ);
        band.rotation.x = Math.PI / 2;
      }
      box(0.2, 0.2, 0.03, 0.14, 0.36, 0.53, toon("#fed90f"), 0.03);
      sign("\u2622", 0.18, 0.18, 0.14, 0.36, 0.547, { fg: INK });
      const puddle = cyl(0.12, 0.12, 0.008, -0.66, 0.006, 0.6, goo, 16);
      puddle.scale.z = 0.5;
      topY = 1.75;
      halfW = 0.7;
      break;
    }

    /* -------- First Bank of Springfield -------- */
    case "bank": {
      const stone = toon("#ece4cf");
      const green = toon("#4fa37a");
      const w = 1.25, h = 0.9, d = 0.95;
      for (let s = 0; s < 3; s++) box(w + 0.2 - s * 0.06, 0.05, d + 0.2 - s * 0.06, 0, 0.025 + s * 0.05, 0, stone, 0.015);
      body = box(w, h, d, 0, 0.15 + h / 2, -0.04, stone);
      // portico columns
      for (const cx2 of [-0.42, -0.14, 0.14, 0.42]) {
        cyl(0.055, 0.06, 0.7, cx2, 0.5, d / 2 + 0.06, white, 14);
        box(0.14, 0.04, 0.14, cx2, 0.87, d / 2 + 0.06, white, 0.01);
      }
      box(w + 0.06, 0.16, 0.22, 0, 0.97, d / 2 + 0.03, stone, 0.02);
      sign("FIRST BANK OF SPRINGFIELD", 1.1, 0.1, 0, 0.97, d / 2 + 0.145, { fg: "#2e6b4a" });
      const ped = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 3), stone, 0, 1.17, d / 2 - 0.02);
      ped.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      ped.scale.set(1, 1, 0.3);
      // gold $ medallion in the pediment
      const medal = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), toon("#f2c14e"), 0, 1.16, d / 2 + 0.09);
      medal.rotation.x = Math.PI / 2;
      sign("$", 0.12, 0.12, 0, 1.16, d / 2 + 0.106, { fg: "#8a6a00" });
      // green copper roof
      box(w + 0.04, 0.1, d - 0.1, 0, 0.15 + h + 0.05, -0.1, green, 0.02);
      hipRoof(w - 0.1, d - 0.25, 0.22, 0, 0.15 + h + 0.1, -0.12, green);
      // bronze doors + windows
      box(0.22, 0.42, 0.04, 0, 0.36, d / 2 - 0.08, toon("#a8743a"), 0.02);
      for (const wx of [-0.28, 0.28]) win(0.14, 0.28, wx, 0.5, d / 2 - 0.1, frame, glass);
      topY = 1.55;
      halfW = w / 2;
      break;
    }

    default: {
      body = box(1, 1, 1, 0, 0.5, 0, accent);
    }
  }

  body.userData.locId = loc.id;

  const label = makeLabel(loc.short);
  label.position.set(0, topY + 0.45, 0);
  g.add(label);

  return { group: g, body, topY, halfW };
}

/** The Flanders place next door, after the show: salmon two-storey under a lavender
    side-gabled roof, a forward garage with a red door, a tall brick chimney on the right,
    a purple front door under a striped awning, and a wooden fence. */
function buildFlandersHouse() {
  const g = new THREE.Group();
  const { box, gable, cyl, ball, sign } = kit(g);
  const wall = toon("#e08a6e");
  const roof = toon("#b18ad9");
  const frameG = toon("#2f7f62");
  const teal = toon("#82d8cc", { emissive: "#2f8f86", emissiveIntensity: 0.2 });
  const brick = toon("#c9584a");
  const wood = toon("#c98a4a");
  const concrete = toon("#d6d1c4");
  const hx = -0.08;
  const w = 1.1, h = 0.92, d = 0.78;
  const fz = d / 2;
  box(w, h, d, hx, h / 2, -0.06, wall, 0.03);
  gable(d + 0.22, w + 0.12, 0.4, hx, h, -0.06, roof);
  // tall brick chimney on the right gable end
  box(0.16, 1.5, 0.2, hx + w / 2 + 0.02, 0.75, -0.08, brick, 0.02);
  box(0.2, 0.06, 0.24, hx + w / 2 + 0.02, 1.52, -0.08, brick, 0.02);
  // TV antenna
  cyl(0.008, 0.008, 0.3, hx - 0.3, h + 0.36, -0.1, toon("#2b2723"), 6);
  box(0.16, 0.01, 0.01, hx - 0.3, h + 0.48, -0.1, toon("#2b2723"), 0.003);
  // windows: teal glass in dark green frames
  const win2 = (x: number, y: number, ww: number, hh: number, z: number) => {
    box(ww + 0.05, hh + 0.05, 0.03, x, y, z, frameG, 0.01);
    box(ww, hh, 0.035, x, y, z + 0.012, teal, 0.008);
    box(0.012, hh, 0.04, x, y, z + 0.016, frameG, 0.003);
  };
  win2(hx - 0.4, 0.72, 0.16, 0.16, fz - 0.06);
  win2(hx - 0.12, 0.72, 0.16, 0.16, fz - 0.06);
  win2(hx - 0.48, 0.3, 0.14, 0.2, fz - 0.06);
  for (const zz of [-0.3, 0.1]) {
    box(0.03, 0.2, 0.2, hx + w / 2 + 0.02, 0.72, zz, frameG, 0.01);
    box(0.035, 0.16, 0.16, hx + w / 2 + 0.03, 0.72, zz, teal, 0.008);
  }
  // purple door with teal sidelights, striped awning, round step, flower box
  const dx = hx - 0.22;
  box(0.3, 0.42, 0.03, dx, 0.22, fz - 0.06, frameG, 0.01);
  box(0.15, 0.36, 0.04, dx, 0.2, fz - 0.05, toon("#8a6bc4"), 0.015);
  for (const sx of [-0.1, 0.1]) box(0.04, 0.32, 0.04, dx + sx, 0.2, fz - 0.05, teal, 0.008);
  for (let i = 0; i < 5; i++) {
    const st = box(0.07, 0.03, 0.16, dx - 0.14 + i * 0.07, 0.46, fz + 0.02, toon(i % 2 ? "#ffffff" : "#e0352b"), 0.006);
    st.rotation.x = 0.4;
  }
  cyl(0.16, 0.17, 0.05, dx, 0.025, fz + 0.06, concrete, 20);
  box(0.18, 0.06, 0.07, dx - 0.26, 0.12, fz - 0.02, toon("#c0392b"), 0.01);
  ball(0.05, dx - 0.26, 0.17, fz - 0.02, toon("#52b947"), 10);
  // the garage pushes forward on the right with its own little gable
  const gx = hx + 0.27;
  const gw = 0.5, gh = 0.5, gd = 0.42;
  const gz = fz + gd / 2 - 0.08;
  box(gw, gh, gd, gx, gh / 2, gz, wall, 0.02);
  gable(gw + 0.12, gd + 0.06, 0.2, gx, gh, gz, roof, false);
  box(0.09, 0.07, 0.03, gx, gh + 0.06, gz + gd / 2 + 0.02, frameG, 0.01);
  box(0.07, 0.05, 0.035, gx, gh + 0.06, gz + gd / 2 + 0.025, teal, 0.008);
  box(0.4, 0.34, 0.04, gx, 0.18, gz + gd / 2 + 0.01, toon("#c4524a"), 0.015);
  for (let i = 1; i <= 4; i++) box(0.38, 0.01, 0.02, gx, 0.02 + i * 0.07, gz + gd / 2 + 0.035, toon("#9a3a34"), 0.003);
  box(0.42, 0.02, 0.3, gx, 0.01, gz + gd / 2 + 0.16, concrete, 0.005);
  // stepping stones, purple mailbox, wooden fence along the side
  for (let i = 0; i < 3; i++) cyl(0.045, 0.045, 0.015, dx - 0.05 + i * 0.03, 0.008, fz + 0.2 + i * 0.1, concrete, 12);
  cyl(0.012, 0.012, 0.2, dx - 0.36, 0.1, fz + 0.32, wood, 6);
  box(0.06, 0.06, 0.1, dx - 0.36, 0.22, fz + 0.32, toon("#8a6bc4"), 0.025);
  for (let i = 0; i < 7; i++) box(0.035, 0.22, 0.02, hx + w / 2 + 0.16, 0.11, -0.35 + i * 0.11, wood, 0.008);
  box(0.02, 0.03, 0.7, hx + w / 2 + 0.16, 0.16, -0.02, wood, 0.006);
  void sign;
  const label = makeLabel("Flanders", 0.8);
  label.position.set(0, h + 0.75, 0);
  g.add(label);
  return g;
}

/* ---- character tokens ------------------------------------------------------ */
type HairStyle = "bald" | "beehive" | "spikes" | "star" | "cap" | "curly";
interface FigureLook {
  shirt: string;
  pants: string;
  hair: HairStyle;
  hairColor?: string;
  glasses?: boolean;
  mustache?: boolean;
  collar?: string;
}

const TOKEN_LOOK: Record<string, Omit<FigureLook, "shirt">> = {
  p0: { hair: "bald", pants: "#3b6fb6" },
  p1: { hair: "beehive", hairColor: "#2f63d6", pants: "#45a84e" },
  p2: { hair: "spikes", pants: "#2f63d6" },
  p3: { hair: "star", pants: "#e8432a" },
  p4: { hair: "cap", hairColor: "#2e5bd6", pants: "#3b4f8f", glasses: true },
  p5: { hair: "cap", hairColor: "#55524d", pants: "#3a3a3a" },
  p6: { hair: "curly", hairColor: "#9c8fc0", pants: "#5d6e98" },
  p7: { hair: "cap", hairColor: "#6b3f1f", pants: "#4a4a5a" },
};

const NED_LOOK: FigureLook = {
  shirt: "#3f9142",
  pants: "#6d6f78",
  hair: "cap",
  hairColor: "#7a4a22",
  glasses: true,
  mustache: true,
  collar: "#f4a7c4",
};

/** A chunky cartoon townsperson game piece (~1 unit tall). */
function makeFigure(look: FigureLook, ringColor: string) {
  const f = new THREE.Group();
  const skin = toon(SKIN);
  const shirt = toon(look.shirt);
  const pants = toon(look.pants);
  const ink = toon("#2b2723");
  const white = toon("#ffffff");
  const hairMat = toon(look.hairColor ?? "#5a3a1e");
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    f.add(m);
    return m;
  };

  // base ring so the piece reads on the board
  const base = add(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 28), toon(ringColor), 0, 0.025, 0);
  base.receiveShadow = true;

  for (const sx of [-0.065, 0.065]) {
    add(rb(0.1, 0.06, 0.16, 0.025), ink, sx, 0.08, 0.025);
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 10), pants, sx, 0.22, 0);
  }
  add(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 16), shirt, 0, 0.48, 0);
  add(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), shirt, 0, 0.62, 0).scale.y = 0.4;
  if (look.collar) add(new THREE.ConeGeometry(0.05, 0.08, 3), toon(look.collar), 0, 0.6, 0.1).rotation.x = Math.PI;
  for (const sx of [-1, 1]) {
    const arm = add(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), shirt, sx * 0.16, 0.49, 0);
    arm.rotation.z = sx * 0.22;
    add(new THREE.SphereGeometry(0.04, 10, 8), skin, sx * 0.19, 0.35, 0);
  }

  // tall cartoon head + big eyes + nose
  add(new THREE.CapsuleGeometry(0.115, 0.17, 6, 18), skin, 0, 0.84, 0);
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.055, 14, 10), white, sx * 0.05, 0.88, 0.09);
    add(new THREE.SphereGeometry(0.017, 8, 6), ink, sx * 0.05, 0.88, 0.143);
  }
  add(new THREE.CapsuleGeometry(0.024, 0.05, 4, 8), skin, 0, 0.82, 0.13).rotation.x = Math.PI / 2;
  if (look.glasses) {
    for (const sx of [-1, 1]) add(new THREE.TorusGeometry(0.062, 0.011, 6, 16), ink, sx * 0.05, 0.88, 0.1);
  }
  if (look.mustache) add(rb(0.12, 0.03, 0.03, 0.012), hairMat, 0, 0.77, 0.12);

  // hair
  switch (look.hair) {
    case "bald":
      for (const sx of [-0.025, 0.025]) {
        const h = add(new THREE.TorusGeometry(0.035, 0.006, 4, 12, Math.PI), ink, sx, 1.02, 0);
        h.rotation.y = Math.PI / 2;
      }
      break;
    case "beehive":
      add(new THREE.CapsuleGeometry(0.12, 0.3, 6, 16), hairMat, 0, 1.18, -0.01);
      break;
    case "spikes":
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const s = add(new THREE.ConeGeometry(0.035, 0.1, 6), skin, Math.cos(a) * 0.085, 1.04, Math.sin(a) * 0.085);
        s.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      }
      break;
    case "star":
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const s = add(new THREE.ConeGeometry(0.035, 0.12, 6), skin, Math.cos(a) * 0.11, 1.0, Math.sin(a) * 0.11);
        s.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      }
      break;
    case "cap":
      add(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), hairMat, 0, 0.93, -0.005);
      break;
    case "curly":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.06, 10, 8), hairMat, Math.cos(a) * 0.08, 1.0, Math.sin(a) * 0.08);
      }
      add(new THREE.SphereGeometry(0.07, 10, 8), hairMat, 0, 1.06, 0);
      break;
  }
  return f;
}

/* ---- scene ---------------------------------------------------------------- */
interface Api {
  dispose: () => void;
  sync: (s: GameState) => void;
  /** Stop rendering while the board is covered (e.g. a location card is open). */
  setPaused: (paused: boolean) => void;
}

function initScene(
  mount: HTMLDivElement,
  deps: { dispatch: (a: any) => void; onEnter: () => (id: LocationId) => void; getState: () => GameState }
): Api {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#7cc6f0");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // the city is static, so only redraw the shadow map when a caster moves (hover bob)
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.11, 0.1, 0.09], defaultAlpha: 1 });

  const camera = new THREE.PerspectiveCamera(41, 1, 0.1, 100);
  camera.position.set(0, 10.2, 8.3);
  camera.lookAt(0, 0.5, -0.35);

  // lights: bright cartoon daylight
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9ccf7a, 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff6e0, 1.9);
  sun.position.set(5, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -9;
  sc.right = 9;
  sc.top = 9;
  sc.bottom = -9;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // island slab
  const islW = COLS * SP + 1.1;
  const islD = ROWS * SP + 1.1;
  const base = new THREE.Mesh(rb(islW, 0.9, islD, 0.2), toon("#a36b3f"));
  base.position.y = -0.47;
  base.receiveShadow = true;
  scene.add(base);
  const grassTop = new THREE.Mesh(rb(islW - 0.06, 0.16, islD - 0.06, 0.14), toon("#79c64e"));
  grassTop.position.y = -0.04;
  grassTop.receiveShadow = true;
  scene.add(grassTop);

  // sidewalk tiles on ring cells
  const walk = toon("#e3ded2");
  RING.forEach((c) => {
    const tile = new THREE.Mesh(rb(SP * 0.92, 0.07, SP * 0.92, 0.08), walk);
    const p = cellToWorld(c.x, c.y);
    tile.position.set(p.x, 0.035, p.z);
    tile.receiveShadow = true;
    scene.add(tile);
  });

  // the walkway loop around the square that tokens walk along
  const pathMat = toon("#efe6cf");
  const pathW = 0.5;
  for (const [x, z, w, d] of [
    [0, -INNER_Z, 2 * INNER_X + pathW, pathW],
    [0, INNER_Z, 2 * INNER_X + pathW, pathW],
    [-INNER_X, 0, pathW, 2 * INNER_Z + pathW],
    [INNER_X, 0, pathW, 2 * INNER_Z + pathW],
  ]) {
    const strip = new THREE.Mesh(rb(w, 0.05, d, 0.02), pathMat);
    strip.position.set(x, 0.045, z);
    strip.receiveShadow = true;
    scene.add(strip);
  }

  // town square: plaza + the founder's statue
  const plazaZ = (1.5 - (ROWS - 1) / 2) * SP;
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.07, 40), toon("#efe2bd"));
  plaza.position.set(0, 0.035, plazaZ);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const statue = new THREE.Group();
  const bronze = toon("#7f9a86");
  const plinth = toon("#d9d2c0");
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    statue.add(m);
    return m;
  };
  put(rb(0.7, 0.16, 0.7, 0.04), plinth, 0, 0.08, 0);
  put(rb(0.44, 0.44, 0.44, 0.04), plinth, 0, 0.38, 0);
  put(rb(0.52, 0.06, 0.52, 0.02), plinth, 0, 0.62, 0);
  for (const sx of [-0.05, 0.05]) put(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 10), bronze, sx, 0.8, 0);
  put(new THREE.CylinderGeometry(0.1, 0.13, 0.36, 14), bronze, 0, 1.12, 0);
  put(new THREE.CapsuleGeometry(0.075, 0.08, 4, 14), bronze, 0, 1.4, 0);
  put(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14), toon("#6a5a44"), 0, 1.52, 0);
  put(new THREE.CylinderGeometry(0.02, 0.012, 0.22, 8), toon("#6a5a44"), -0.06, 1.48, -0.08).rotation.z = 1.2;
  const arm = put(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), bronze, 0.14, 1.32, 0);
  arm.rotation.z = -0.9;
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), toon("#6a5a44"), -0.13, 1.1, 0.02);
  statue.position.set(0, 0.07, plazaZ);
  scene.add(statue);

  // round cartoon trees around the square
  const trunkMat = toon("#7a4a2a");
  const leafMat = toon("#4fae4a");
  const leafLt = toon("#6cc95a");
  const treeSpots: [number, number][] = [
    [-2.3, -0.7], [-1.6, 1.1], [2.3, -0.7], [1.6, 1.1], [-0.9, -1.0], [0.9, -1.0], [-2.4, 0.4], [2.4, 0.4],
  ];
  treeSpots.forEach(([x, z], i) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), trunkMat);
    trunk.position.y = 0.2;
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), i % 2 ? leafMat : leafLt);
    crown.position.y = 0.58;
    crown.castShadow = true;
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), i % 2 ? leafLt : leafMat);
    crown2.position.set(0.14, 0.48, 0.08);
    crown2.castShadow = true;
    t.add(trunk, crown, crown2);
    t.position.set(x, 0.05, z);
    scene.add(t);
  });

  // fluffy clouds drifting behind the island
  const cloudMat = noOutline(toon("#ffffff"));
  const clouds: THREE.Group[] = [];
  [[-6.5, 2.6, -7.5], [1.5, 3.4, -9], [7, 2.2, -7]].forEach(([x, y, z], i) => {
    const c = new THREE.Group();
    [[0, 0, 0, 0.9], [0.9, -0.15, 0.1, 0.65], [-0.9, -0.2, 0.1, 0.6], [0.35, 0.4, -0.1, 0.6]].forEach(([cx, cy, cz, r]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudMat);
      puff.position.set(cx, cy, cz);
      c.add(puff);
    });
    c.position.set(x, y, z);
    c.userData.drift = i;
    scene.add(c);
    clouds.push(c);
  });

  // buildings
  const pickables: THREE.Object3D[] = [];
  const bodies: { id: LocationId; body: THREE.Mesh }[] = [];
  const jobMarkers: Record<string, THREE.Mesh> = {};
  LOCATIONS.forEach((loc) => {
    const { group, body, topY, halfW } = buildBuilding(loc);
    const p = cellToWorld(loc.x, loc.y);
    group.position.set(p.x, 0, p.z);
    // side-column buildings face the town square
    if (loc.y > 0 && loc.y < ROWS - 1) group.rotation.y = loc.x === 0 ? Math.PI / 2 : loc.x === COLS - 1 ? -Math.PI / 2 : 0;
    scene.add(group);
    pickables.push(group);
    bodies.push({ id: loc.id, body });

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), toon("#fed90f", { emissive: "#b88a00", emissiveIntensity: 0.4 }));
    star.position.set(p.x + halfW, topY + 0.35, p.z + halfW);
    star.visible = false;
    star.userData.spin = true;
    scene.add(star);
    jobMarkers[loc.id] = star;
  });
  const fh = buildFlandersHouse();
  const fp = cellToWorld(RING[FLANDERS_CELL].x, RING[FLANDERS_CELL].y);
  fh.position.set(fp.x, 0, fp.z);
  fh.rotation.y = Math.PI / 2; // face the town square
  scene.add(fh);

  // name labels render in a final overlay pass (above the tokens)
  const labelScene = new THREE.Scene();
  const sprites: THREE.Sprite[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Sprite).isSprite) sprites.push(o as THREE.Sprite);
  });
  sprites.forEach((sp) => labelScene.attach(sp));

  // tokens: you, and Ned
  const st0 = deps.getState();
  const look = TOKEN_LOOK[st0.avatar] ?? TOKEN_LOOK.p0;
  const token = makeFigure({ ...look, shirt: avatarShirt(st0.avatar) }, "#fed90f");
  const ned = makeFigure(NED_LOOK, "#7fcf6d");
  ned.scale.setScalar(0.92);
  const tokenScene = new THREE.Scene();
  tokenScene.add(token, ned);
  tokenScene.add(new THREE.HemisphereLight(0xffffff, 0x9ccf7a, 1.1));
  tokenScene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const tokenSun = new THREE.DirectionalLight(0xfff6e0, 1.9);
  tokenSun.position.copy(sun.position);
  tokenScene.add(tokenSun);
  // soft contact shadows on the board (the tokens can't cast real ones from their own scene)
  const blobMat = noOutline(new THREE.MeshBasicMaterial({ color: 0x1d1a17, transparent: true, opacity: 0.28, depthWrite: false }));
  const blobGeo = new THREE.CircleGeometry(0.34, 24);
  blobGeo.rotateX(-Math.PI / 2);
  const tokenBlob = new THREE.Mesh(blobGeo, blobMat);
  const nedBlob = new THREE.Mesh(blobGeo, blobMat);
  scene.add(tokenBlob, nedBlob);

  let curIndex = ringIndex(st0.location);
  if (curIndex < 0) curIndex = 0;
  const startP = tokenWorld(RING[curIndex].x, RING[curIndex].y);
  token.position.set(startP.x, 0, startP.z);

  const nedTarget = new THREE.Vector3();
  function placeNed(snap: boolean) {
    const s = deps.getState();
    const cell = s.rival?.cell ?? FLANDERS_CELL;
    const p = tokenWorld(RING[cell].x, RING[cell].y);
    // share the space politely when you're both at the same spot
    if (cell === curIndex) {
      // step aside along the walkway
      const c = RING[cell];
      if (c.y === 0 || c.y === ROWS - 1) p.x += 0.5;
      else p.z += 0.5;
    }
    nedTarget.copy(p);
    if (snap) ned.position.copy(p);
  }
  placeNed(true);

  // ---- interaction + animation ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverId: LocationId | null = null;

  const walkState = {
    active: false,
    cells: [] as THREE.Vector3[],
    seg: 0,
    t: 0,
    target: null as LocationId | null,
  };

  function setHover(id: LocationId | null) {
    if (hoverId === id) return;
    if (hoverId) {
      const prev = bodies.find((b) => b.id === hoverId);
      if (prev) (prev.body.material as THREE.MeshToonMaterial).emissive.setHex(0x000000);
    }
    hoverId = id;
    if (id) {
      const b = bodies.find((x) => x.id === id);
      if (b) (b.body.material as THREE.MeshToonMaterial).emissive.setHex(0x4a3c10);
    }
    renderer.domElement.style.cursor = id ? "pointer" : "default";
  }

  function pick(ev: PointerEvent): LocationId | null {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.locId) return o.userData.locId as LocationId;
        o = o.parent;
      }
    }
    return null;
  }

  function startWalk(toId: LocationId) {
    const st = deps.getState();
    if (walkState.active) return;
    if (toId === st.location) {
      deps.onEnter()(toId);
      return;
    }
    if (travelCost(st, toId) > st.hours) {
      deps.dispatch({ type: "MOVE", to: toId });
      return;
    }
    const path = ringPath(st.location, toId);
    if (path.length === 0) {
      deps.dispatch({ type: "MOVE", to: toId });
      deps.onEnter()(toId);
      return;
    }
    walkState.cells = [tokenWorld(RING[curIndex].x, RING[curIndex].y), ...path.map((c) => tokenWorld(c.x, c.y))];
    walkState.seg = 0;
    walkState.t = 0;
    walkState.active = true;
    walkState.target = toId;
    setHover(null);
  }

  const onMove = (e: PointerEvent) => {
    if (walkState.active) return;
    setHover(pick(e));
  };
  const onClick = (e: PointerEvent) => {
    const id = pick(e);
    if (id) startWalk(id);
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onClick);

  function refreshMarkers() {
    const st = deps.getState();
    const job = st.jobId ? getJob(st.jobId) : null;
    Object.entries(jobMarkers).forEach(([id, m]) => (m.visible = job?.locationId === id));
  }
  refreshMarkers();

  function sync(s: GameState) {
    refreshMarkers();
    const idx = ringIndex(s.location);
    if (idx >= 0 && idx !== curIndex && !walkState.active) {
      // snap the token to the new location (e.g. after a week rolls over)
      curIndex = idx;
      const p = tokenWorld(RING[idx].x, RING[idx].y);
      token.position.set(p.x, 0, p.z);
    }
    placeNed(false);
  }

  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  const spinners: THREE.Object3D[] = [];
  const puffs: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.spin) spinners.push(o);
    if (o.userData.puff !== undefined) puffs.push(o);
  });

  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    spinners.forEach((o) => (o.rotation.y += dt * 1.5));
    puffs.forEach((o) => {
      const k = o.userData.puff as number;
      o.scale.setScalar(1 + Math.sin(time * 1.6 + k * 1.3) * 0.08);
    });
    clouds.forEach((c) => (c.position.x += Math.sin(time * 0.15 + c.userData.drift * 2) * dt * 0.08));

    // hover bob (buildings cast shadows, so refresh the shadow map while one moves)
    bodies.forEach((b) => {
      const g = b.body.parent!;
      const want = b.id === hoverId && !walkState.active ? 0.12 : 0;
      const d = want - g.position.y;
      if (Math.abs(d) < 1e-4) return;
      g.position.y = Math.abs(d) < 2e-3 ? want : g.position.y + d * Math.min(1, dt * 12);
      renderer.shadowMap.needsUpdate = true;
    });

    if (walkState.active) {
      walkState.t += dt / STEP;
      while (walkState.t >= 1 && walkState.seg < walkState.cells.length - 1) {
        walkState.t -= 1;
        walkState.seg += 1;
      }
      if (walkState.seg >= walkState.cells.length - 1) {
        const end = walkState.cells[walkState.cells.length - 1];
        token.position.set(end.x, 0, end.z);
        walkState.active = false;
        const toId = walkState.target!;
        curIndex = ringIndex(toId);
        deps.dispatch({ type: "MOVE", to: toId });
        deps.onEnter()(toId);
      } else {
        const a = walkState.cells[walkState.seg];
        const b = walkState.cells[walkState.seg + 1];
        token.position.x = a.x + (b.x - a.x) * walkState.t;
        token.position.z = a.z + (b.z - a.z) * walkState.t;
        token.position.y = Math.sin(walkState.t * Math.PI) * 0.45; // hop arc
        token.rotation.z = Math.sin(walkState.t * Math.PI * 2) * 0.12; // waddle
      }
    } else {
      token.position.y += (0 - token.position.y) * Math.min(1, dt * 10);
      token.rotation.z *= 0.8;
    }

    // Ned strolls (with a little bounce) toward wherever he's headed
    const dx = nedTarget.x - ned.position.x;
    const dz = nedTarget.z - ned.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const stepLen = Math.min(dist, dt * 3.2);
      ned.position.x += (dx / dist) * stepLen;
      ned.position.z += (dz / dist) * stepLen;
      ned.position.y = Math.abs(Math.sin(time * 14)) * 0.12;
    } else {
      ned.position.y *= 0.8;
    }
    // idle sway, so both pieces feel alive
    token.rotation.y = walkState.active ? 0 : Math.sin(time * 1.4) * 0.12;
    ned.rotation.y = Math.sin(time * 1.2 + 1) * 0.14;

    tokenBlob.position.set(token.position.x, 0.075, token.position.z);
    nedBlob.position.set(ned.position.x, 0.075, ned.position.z);
    tokenBlob.scale.setScalar(1 - token.position.y * 0.6);

    outline.autoClear = true;
    outline.render(scene, camera);
    outline.autoClear = false;
    renderer.clearDepth();
    outline.render(tokenScene, camera);
    renderer.autoClear = false;
    renderer.render(labelScene, camera);
    renderer.autoClear = true;
    raf = paused ? 0 : requestAnimationFrame(tick);
  };
  let paused = false;
  tick();

  return {
    setPaused(p: boolean) {
      if (p === paused) return;
      paused = p;
      if (!paused && !raf) {
        clock.getDelta(); // don't jump animations by the paused time
        raf = requestAnimationFrame(tick);
      }
    },
    dispose() {
      paused = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onClick);
      [scene, tokenScene, labelScene].forEach((root) => root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as any).material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }));
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
    sync,
  };
}

export default function CityMap({ onEnter, paused = false }: { onEnter: (id: LocationId) => void; paused?: boolean }) {
  const { state, dispatch } = useGame();
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const stateRef = useRef(state);
  const onEnterRef = useRef(onEnter);
  stateRef.current = state;
  onEnterRef.current = onEnter;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    // wait (briefly) for the cartoon font so canvas signs + labels letter correctly
    const fontReady = Promise.race([
      document.fonts ? document.fonts.load(`40px "Luckiest Guy"`) : Promise.resolve(),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    const start = () => {
      if (cancelled || !mountRef.current) return;
      apiRef.current = initScene(mountRef.current, {
        dispatch,
        onEnter: () => onEnterRef.current,
        getState: () => stateRef.current,
      });
      apiRef.current.setPaused(pausedRef.current);
    };
    fontReady.then(start, start);
    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to external changes (week rollover sends you home, Ned wanders)
  useEffect(() => {
    apiRef.current?.sync(state);
  }, [state.location, state.jobId, state.rival.cell]);

  useEffect(() => {
    apiRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <div className="card stage board-card">
      <div className="map-head">
        <div>
          <h2>Springfield</h2>
          <p>Pick a spot. You walk the board, then head inside.</p>
        </div>
        <span className="tag">{state.hours}h left</span>
      </div>

      <div className="board board-3d" data-tut="board">
        <div ref={mountRef} className="board-canvas" />
        <div className="clock-plate">
          <Clock hours={state.hours} total={state.hoursPerWeek} size={58} />
          <div className="clock-meta">
            <span className="wp-week">Week {state.week}</span>
            <span className="wp-hours">
              {state.hours}h of {state.hoursPerWeek}h left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
