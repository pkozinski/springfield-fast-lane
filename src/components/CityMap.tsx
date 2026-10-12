import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { FLANDERS_CELL, LOCATIONS, RING, ringIndex, ringPath, getJob } from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { GameState, Location, LocationId } from "../game/types";
import { avatarShirt } from "./Portrait";

/* ----------------------------------------------------------------------------
   Springfield, built procedurally with Three.js: cel-shaded (toon) materials
   plus ink outlines (OutlineEffect) for a hand-drawn cartoon look.
---------------------------------------------------------------------------- */
const INK = "#1d1a17";
const SKIN = "#fed90f";
const TITLE_FONT = `"Luckiest Guy", "Arial Black", Impact, sans-serif`;

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
  return { mesh, box, cyl, ball, hipRoof, mansard, win, winSide, sign, person };
}

/* ---- the landmarks --------------------------------------------------------- */
function buildBuilding(loc: Location) {
  const g = new THREE.Group();
  g.userData.locId = loc.id;
  const { mesh, box, cyl, ball, hipRoof, mansard, win, winSide, sign, person } = kit(g);

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
      const wall = toon("#f0a07c");
      const roof = toon("#9a4f33");
      const brick = toon("#b5533c");
      const door = toon("#8a5a34");
      const hx = 0.2;
      const w = 1.05, h = 1.02, d = 0.88;
      body = box(w, h, d, hx, h / 2, 0, wall);
      hipRoof(w + 0.16, d + 0.16, 0.52, hx, h, 0, roof);
      box(0.15, 0.5, 0.15, hx + 0.32, h + 0.3, -0.16, brick);
      // ground floor: door + porch roof + steps, windows either side
      box(0.24, 0.42, 0.04, hx, 0.21, d / 2 + 0.01, door);
      ball(0.018, hx + 0.07, 0.21, d / 2 + 0.04, toon("#f2c14e"), 8);
      box(0.44, 0.04, 0.2, hx, 0.47, d / 2 + 0.09, roof);
      box(0.38, 0.05, 0.14, hx, 0.025, d / 2 + 0.08, concrete);
      for (const wx of [-0.27, 0.27]) win(0.2, 0.22, hx + wx, 0.3, d / 2, frame, glass);
      for (const wx of [-0.3, 0, 0.3]) win(0.18, 0.2, hx + wx, 0.76, d / 2, frame, glass);
      winSide(0.2, 0.2, hx + w / 2, 0.76, 0.05, frame, glass);
      winSide(0.2, 0.2, hx + w / 2, 0.3, 0.05, frame, glass);
      // attached garage
      const gx = -0.6;
      box(0.62, 0.56, 0.84, gx, 0.28, 0.02, wall);
      hipRoof(0.74, 0.96, 0.28, gx, 0.56, 0.02, roof);
      box(0.48, 0.4, 0.04, gx, 0.2, 0.45, white);
      for (let i = 1; i <= 3; i++) box(0.46, 0.012, 0.02, gx, 0.04 + i * 0.1, 0.475, toon("#d8d0bf"), 0.004);
      // driveway, hedge, mailbox
      box(0.5, 0.025, 0.42, gx, 0.012, 0.66, concrete, 0.01);
      box(0.32, 0.14, 0.12, hx + 0.36, 0.07, d / 2 + 0.22, toon("#4f9a3c"));
      cyl(0.012, 0.012, 0.2, hx - 0.38, 0.1, d / 2 + 0.3, ink, 6);
      box(0.08, 0.06, 0.1, hx - 0.38, 0.22, d / 2 + 0.3, toon("#4a7bd0"), 0.02);
      topY = h + 0.62;
      halfW = 0.75;
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
      const red = toon("#e0352b");
      const yellow = toon("#fed90f");
      const w = 1.2, h = 0.74, d = 1.0;
      body = box(w, h, d, 0, h / 2, 0, white);
      box(w + 0.03, 0.15, d + 0.03, 0, 0.075, 0, red);
      box(w + 0.1, 0.2, d + 0.1, 0, h + 0.08, 0, red);
      box(w - 0.04, 0.05, d - 0.04, 0, h + 0.2, 0, roofGrey);
      sign("KRUSTY BURGER", 1.1, 0.15, 0, h + 0.08, d / 2 + 0.056, { fg: "#fed90f", stroke: INK });
      // big front windows + glass door
      box(0.66, 0.34, 0.04, -0.16, 0.42, d / 2 + 0.01, glass, 0.02);
      for (const mx of [-0.38, -0.16, 0.06]) box(0.025, 0.34, 0.05, mx, 0.42, d / 2 + 0.02, white, 0.006);
      box(0.22, 0.44, 0.04, 0.38, 0.22, d / 2 + 0.01, darkGlass, 0.02);
      winSide(0.5, 0.3, w / 2, 0.42, 0, white, glass);
      // drive-thru menu board
      cyl(0.015, 0.015, 0.3, w / 2 + 0.16, 0.15, 0.25, metal, 6);
      box(0.06, 0.18, 0.24, w / 2 + 0.16, 0.36, 0.25, red, 0.02);
      // the giant clown head on the roof
      const px = 0, pz = -0.08;
      cyl(0.06, 0.08, 0.3, px, h + 0.35, pz, metal, 10);
      const headY = h + 0.78;
      ball(0.25, px, headY, pz, white, 24);
      ball(0.065, px, headY - 0.01, pz + 0.25, red, 12);
      for (const sx of [-1, 1]) {
        ball(0.075, px + sx * 0.09, headY + 0.08, pz + 0.19, white, 12);
        ball(0.03, px + sx * 0.085, headY + 0.08, pz + 0.26, ink, 8);
        ball(0.12, px + sx * 0.25, headY + 0.04, pz - 0.02, toon("#4fae4a"), 12);
        ball(0.085, px + sx * 0.2, headY + 0.17, pz - 0.04, toon("#4fae4a"), 10);
      }
      const smile = mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 18, Math.PI), red, px, headY - 0.09, pz + 0.2);
      smile.rotation.set(0.35, 0, Math.PI);
      box(0.2, 0.08, 0.16, px, headY + 0.27, pz, yellow, 0.03);
      topY = headY + 0.4;
      halfW = w / 2;
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
      const brick = toon("#a65a3c");
      const trim = toon("#5a2e1e");
      const w = 1.02, h = 0.78, d = 0.92;
      body = box(w, h, d, 0, h / 2, 0, brick);
      box(w + 0.02, 0.1, d + 0.02, 0, 0.05, 0, trim);
      box(w + 0.06, 0.1, d + 0.06, 0, h + 0.05, 0, trim);
      winSide(0.16, 0.16, w / 2, 0.45, -0.15, trim, toon("#e9dca0", { emissive: "#c9a64a", emissiveIntensity: 0.4 }));
      // the door + tiny frosted window
      box(0.24, 0.44, 0.04, -0.12, 0.22, d / 2 + 0.01, toon("#2f5d3a"), 0.02);
      ball(0.018, -0.04, 0.22, d / 2 + 0.04, toon("#f2c14e"), 8);
      box(0.22, 0.16, 0.04, 0.26, 0.4, d / 2 + 0.01, toon("#e9dca0", { emissive: "#c9a64a", emissiveIntensity: 0.4 }), 0.015);
      box(0.13, 0.13, 0.02, 0.26, 0.4, d / 2 + 0.035, white, 0.06);
      sign("DUFF", 0.12, 0.06, 0.26, 0.4, d / 2 + 0.047, { fg: "#e0352b" });
      // neon sign over the door
      box(0.62, 0.17, 0.05, 0, 0.6, d / 2 + 0.02, toon("#2a1a12"), 0.02);
      sign("MOE'S", 0.56, 0.14, 0, 0.6, d / 2 + 0.05, { fg: "#ff5a5a", stroke: "#ffe3e3" });
      // rooftop sign on posts
      for (const sx of [-0.25, 0.25]) cyl(0.015, 0.015, 0.3, sx, h + 0.24, -0.05, metal, 6);
      box(0.72, 0.24, 0.05, 0, h + 0.46, -0.05, toon("#2a1a12"), 0.02);
      sign("MOE'S TAVERN", 0.66, 0.18, 0, h + 0.46, -0.02, { fg: "#ff7a3a", stroke: "#3a1408" });
      // trash cans by the side
      cyl(0.07, 0.065, 0.16, w / 2 + 0.12, 0.08, 0.25, metal, 12);
      cyl(0.075, 0.075, 0.02, w / 2 + 0.12, 0.17, 0.25, metal, 12);
      topY = h + 0.6;
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
      topY = h + 0.55;
      halfW = w / 2;
      break;
    }

    /* -------- Lard Lad Donuts -------- */
    case "lardlad": {
      const wall = toon("#f7c2d8");
      const pink = toon("#ef5fa7");
      const w = 0.98, h = 0.7, d = 0.86;
      const sx0 = -0.22;
      body = box(w, h, d, sx0, h / 2, 0, wall);
      box(w + 0.08, 0.12, d + 0.08, sx0, h + 0.06, 0, pink);
      sign("LARD LAD DONUTS", 0.94, 0.11, sx0, h + 0.06, d / 2 + 0.042, { fg: "#ffffff", stroke: INK });
      // striped awning
      for (let i = 0; i < 6; i++) {
        const s = box(0.16, 0.035, 0.22, sx0 - 0.4 + i * 0.16, 0.52, d / 2 + 0.1, i % 2 ? white : pink, 0.01);
        s.rotation.x = 0.35;
      }
      box(0.46, 0.3, 0.04, sx0 - 0.15, 0.3, d / 2 + 0.01, glass, 0.02);
      box(0.2, 0.42, 0.04, sx0 + 0.3, 0.21, d / 2 + 0.01, darkGlass, 0.02);
      // the statue: a giant donut held high
      const lx = 0.5, lz = 0.2;
      box(0.32, 0.12, 0.3, lx, 0.06, lz, concrete, 0.02);
      const overalls = toon("#e04646");
      const shirt = toon("#fbfaf4");
      for (const s of [-0.05, 0.05]) cyl(0.04, 0.045, 0.3, lx + s, 0.27, lz, overalls, 10);
      box(0.22, 0.26, 0.16, lx, 0.53, lz, overalls, 0.05);
      box(0.18, 0.1, 0.17, lx, 0.62, lz, shirt, 0.04);
      mesh(new THREE.CapsuleGeometry(0.09, 0.08, 4, 14), toon(SKIN), lx, 0.8, lz);
      for (const s of [-1, 1]) {
        ball(0.04, lx + s * 0.035, 0.82, lz + 0.085, white, 10);
        ball(0.014, lx + s * 0.035, 0.82, lz + 0.12, ink, 6);
      }
      const quiff = ball(0.09, lx, 0.92, lz + 0.02, toon("#6b3f1f"), 12);
      quiff.scale.set(1.1, 0.6, 1.2);
      const arm = cyl(0.035, 0.035, 0.42, lx + 0.12, 0.84, lz, shirt, 8);
      arm.rotation.z = -0.3;
      cyl(0.035, 0.035, 0.24, lx - 0.13, 0.48, lz + 0.04, shirt, 8).rotation.z = 0.25;
      const dY = 1.15;
      mesh(new THREE.TorusGeometry(0.17, 0.08, 14, 28), toon("#d9a35c"), lx + 0.2, dY, lz);
      const icing = mesh(new THREE.TorusGeometry(0.17, 0.07, 14, 28), pink, lx + 0.2, dY, lz + 0.025);
      icing.scale.set(1, 1, 0.7);
      const sprinkleCols = ["#fed90f", "#7cc4f2", "#52b947", "#ffffff", "#e0352b"];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.17 + (i % 2 ? 0.035 : -0.03);
        const sp = box(0.035, 0.012, 0.012, lx + 0.2 + Math.cos(a) * r, dY + Math.sin(a) * r, lz + 0.085, toon(sprinkleCols[i % 5]), 0.004);
        sp.rotation.z = a * 1.7;
      }
      topY = dY + 0.3;
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

/** The Flanders place next door: tidy, beige, white picket fence. */
function buildFlandersHouse() {
  const g = new THREE.Group();
  const { box, hipRoof, win, cyl, ball } = kit(g);
  const wall = toon("#e2d3a6");
  const roof = toon("#6f8f4a");
  const frame = toon("#fbfaf4");
  const glass = toon("#8fd3f4", { emissive: "#3c8fc2", emissiveIntensity: 0.25 });
  const w = 1.15, h = 0.62, d = 0.86;
  box(w, h, d, 0, h / 2, -0.05, wall);
  hipRoof(w + 0.16, d + 0.16, 0.36, 0, h, -0.05, roof);
  box(0.22, 0.42, 0.04, 0, 0.21, d / 2 - 0.04, toon("#5a8f3a"), 0.02);
  for (const wx of [-0.36, 0.36]) win(0.24, 0.2, wx, 0.34, d / 2 - 0.05, frame, glass);
  // white picket fence
  for (let i = 0; i < 13; i++) {
    const x = -0.75 + i * 0.125;
    if (Math.abs(x) < 0.14) continue;
    box(0.04, 0.16, 0.02, x, 0.08, d / 2 + 0.24, frame, 0.01);
  }
  for (const y of [0.05, 0.12]) {
    box(0.6, 0.02, 0.015, -0.47, y, d / 2 + 0.23, frame, 0.004);
    box(0.6, 0.02, 0.015, 0.47, y, d / 2 + 0.23, frame, 0.004);
  }
  // a neat little tree
  cyl(0.04, 0.05, 0.3, 0.7, 0.15, -0.3, toon("#7a4a2a"), 8);
  ball(0.2, 0.7, 0.45, -0.3, toon("#52b947"), 14);
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
function makeFigure(look: FigureLook, ringColor: string, withBase = true) {
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
  if (withBase) add(new THREE.CylinderGeometry(0.3, 0.32, 0.05, 28), toon(ringColor), 0, 0.025, 0).receiveShadow = true;

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

/* ---- town layout ------------------------------------------------------------
   A rectangular road loop runs through the ring. Buildings only ever face the
   camera (+z or +x), Tapped Out style: the north row and west column sit outside
   the loop, the south row and east column sit inside it, all fronting the road.
---------------------------------------------------------------------------- */
const SPX = 2.6; // column spacing
const SPZ = 2.5; // row spacing
const RX = 2 * SPX; // road loop half-extent (x)
const RZ = 1.5 * SPZ; // road loop half-extent (z)
const LOT = 1.2; // building centre offset from the road's centre line
const ROAD_W = 1.0;
/** small per-building nudges so the tight inside corners don't collide */
const NUDGE: Partial<Record<LocationId, number>> = { lardlad: 0.3, bowlarama: -0.15 };

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const colX = (gx: number) => (gx - 2) * SPX;
const rowZ = (gy: number) => (gy - 1.5) * SPZ;

function lotFor(gx: number, gy: number, id?: LocationId) {
  const n = (id && NUDGE[id]) || 0;
  if (gy === 0) return { pos: V(colX(gx) + n, -RZ - LOT), rotY: 0 };
  if (gy === 3) {
    const inset = gx === 0 ? 1.45 : gx === 4 ? -1.45 : 0;
    return { pos: V(colX(gx) + inset + n, RZ - LOT), rotY: 0 };
  }
  if (gx === 0) return { pos: V(-RX - LOT, rowZ(gy)), rotY: Math.PI / 2 };
  return { pos: V(RX - LOT, rowZ(gy)), rotY: Math.PI / 2 };
}

/** Where a token stands for a ring cell: on the road in front of the building. */
function tokenPos(cell: number) {
  const c = RING[cell];
  if (c.y === 0) return V(colX(c.x), -RZ);
  if (c.y === 3) return V(lotFor(c.x, c.y, c.id).pos.x, RZ);
  if (c.x === 0) return V(-RX, rowZ(c.y));
  return V(RX, rowZ(c.y));
}

/** Insert road corners so tokens follow the street instead of cutting across lawns. */
function roadPath(points: THREE.Vector3[]) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.z - b.z) > 0.01) {
      const onCorner = (p: THREE.Vector3) => Math.abs(Math.abs(p.x) - RX) < 0.01 && Math.abs(Math.abs(p.z) - RZ) < 0.01;
      const c1 = V(a.x, b.z);
      out.push(onCorner(c1) ? c1 : V(b.x, a.z));
    }
    out.push(b);
  }
  return out;
}

/** A point on the road loop's sidewalk, by distance travelled around it. */
function loopPoint(s: number, inset: number) {
  const w = 2 * RX, h = 2 * RZ, per = 2 * (w + h);
  let t = ((s % per) + per) % per;
  const x0 = -RX - inset, z0 = -RZ - inset, x1 = RX + inset, z1 = RZ + inset;
  const sw = x1 - x0, sh = z1 - z0;
  t = (t / per) * 2 * (sw + sh);
  if (t < sw) return { p: V(x0 + t, z0), dir: 0 };
  t -= sw;
  if (t < sh) return { p: V(x1, z0 + t), dir: 1 };
  t -= sh;
  if (t < sw) return { p: V(x1 - t, z1), dir: 2 };
  t -= sw;
  return { p: V(x0, z1 - t), dir: 3 };
}

/* ---- floating bubbles + popups (canvas sprites, drawn in the overlay pass) --- */
function bubbleSprite(glyph: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 132;
  const c = canvas.getContext("2d")!;
  c.beginPath();
  c.arc(60, 56, 50, 0, Math.PI * 2);
  c.moveTo(48, 100);
  c.lineTo(60, 126);
  c.lineTo(72, 100);
  c.fillStyle = "#ffffff";
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.beginPath();
  c.arc(60, 56, 50, 0.62 * Math.PI, 0.38 * Math.PI);
  c.lineTo(60, 126);
  c.closePath();
  c.stroke();
  c.font = `${glyph.length > 1 ? 40 : 66}px ${TITLE_FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.strokeText(glyph, 60, 62);
  c.fillStyle = color;
  c.fillText(glyph, 60, 62);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  sp.scale.set(0.052, 0.057, 1);
  sp.center.set(0.5, 0);
  return sp;
}

function popupSprite(text: string, color: string) {
  const fs = 56;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `${fs}px ${TITLE_FONT}`;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(probe.measureText(text).width) + 30;
  canvas.height = fs + 30;
  const c = canvas.getContext("2d")!;
  c.font = `${fs}px ${TITLE_FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.lineWidth = 10;
  c.strokeStyle = INK;
  c.strokeText(text, canvas.width / 2, canvas.height / 2 + 3);
  c.fillStyle = color;
  c.fillText(text, canvas.width / 2, canvas.height / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  const s = 0.00045;
  sp.scale.set(canvas.width * s, canvas.height * s, 1);
  return sp;
}

/* ---- scene ---------------------------------------------------------------- */
interface Api {
  dispose: () => void;
  sync: (s: GameState) => void;
}

function initScene(
  mount: HTMLDivElement,
  deps: { dispatch: (a: any) => void; onEnter: () => (id: LocationId) => void; getState: () => GameState }
): Api {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#6cbd47");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block", touchAction: "none" });

  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.11, 0.1, 0.09], defaultAlpha: 1 });

  // isometric orthographic camera, Tapped Out style
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const camDir = new THREE.Vector3(1, 1.25, 1).normalize();
  const elev = Math.asin(camDir.y);
  const bounds = { x0: -7.2, x1: 6.4, z0: -6.0, z1: 4.8 };
  const target = V((bounds.x0 + bounds.x1) / 2, (bounds.z0 + bounds.z1) / 2);
  let fitH = 12;
  let zoom = 0.82; // fraction of the "whole town" view height

  function fitView() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    camera.position.copy(target).addScaledVector(camDir, 40);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    let rx = 0, uy = 0;
    for (const x of [bounds.x0, bounds.x1]) for (const z of [bounds.z0, bounds.z1]) for (const y of [0, 2.4]) {
      const d = new THREE.Vector3(x, y, z).sub(target);
      rx = Math.max(rx, Math.abs(d.dot(right)));
      uy = Math.max(uy, Math.abs(d.dot(up)));
    }
    fitH = Math.max(uy * 2, (rx * 2) / (w / h)) * 1.04;
  }
  function updateCamera() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    const vh = fitH * zoom;
    camera.left = (-vh * (w / h)) / 2;
    camera.right = (vh * (w / h)) / 2;
    camera.top = vh / 2;
    camera.bottom = -vh / 2;
    camera.position.copy(target).addScaledVector(camDir, 40);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  // lights: bright cartoon daylight
  const lights = () => {
    const g = new THREE.Group();
    g.add(new THREE.HemisphereLight(0xffffff, 0x9ccf7a, 1.1));
    g.add(new THREE.AmbientLight(0xffffff, 0.35));
    return g;
  };
  scene.add(lights());
  const sun = new THREE.DirectionalLight(0xfff6e0, 1.9);
  sun.position.set(7, 14, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -12;
  sc.right = 12;
  sc.top = 12;
  sc.bottom = -12;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ground: endless lawn with a few darker grass patches
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), toon("#79c64e"));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const patchMat = noOutline(toon("#6db944"));
  for (let i = 0; i < 26; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 1.1, 20), patchMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(-13 + rnd() * 26, 0.004, -12 + rnd() * 22);
    p.receiveShadow = true;
    scene.add(p);
  }

  // the road loop: sidewalks, asphalt, dashed yellow centre line
  const asphalt = toon("#5d6168");
  const walkMat = toon("#e3ded2");
  const dash = noOutline(toon("#fed90f"));
  const strip = (x: number, z: number, w: number, d: number, y: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(rb(w, 0.04, d, 0.015), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  const side = ROAD_W + 0.5;
  strip(0, -RZ, 2 * RX + side, side, 0.02, walkMat);
  strip(0, RZ, 2 * RX + side, side, 0.02, walkMat);
  strip(-RX, 0, side, 2 * RZ + side, 0.02, walkMat);
  strip(RX, 0, side, 2 * RZ + side, 0.02, walkMat);
  strip(0, -RZ, 2 * RX + ROAD_W, ROAD_W, 0.045, asphalt);
  strip(0, RZ, 2 * RX + ROAD_W, ROAD_W, 0.045, asphalt);
  strip(-RX, 0, ROAD_W, 2 * RZ + ROAD_W, 0.046, asphalt);
  strip(RX, 0, ROAD_W, 2 * RZ + ROAD_W, 0.046, asphalt);
  for (let x = -RX + 0.7; x < RX - 0.5; x += 0.7) {
    strip(x, -RZ, 0.34, 0.06, 0.07, dash);
    strip(x, RZ, 0.34, 0.06, 0.07, dash);
  }
  for (let z = -RZ + 0.7; z < RZ - 0.5; z += 0.7) {
    strip(-RX, z, 0.06, 0.34, 0.07, dash);
    strip(RX, z, 0.06, 0.34, 0.07, dash);
  }

  // street lamps on the inner corners and mid-sides
  const lampPost = toon("#3a4a5a");
  const lampGlow = glow("#fff2a8");
  [[-RX + 0.85, -RZ + 0.85], [RX - 0.85 - 1.4, -RZ + 0.85], [-RX + 0.85, 0.2], [0.6, -RZ + 0.85]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), lampPost);
    pole.position.set(x, 0.45, z);
    pole.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), lampGlow);
    head.position.set(x, 0.95, z);
    scene.add(pole, head);
  });

  // town square: plaza + the founder's statue
  const plazaX = -0.8, plazaZ = -0.55;
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 40), toon("#efe2bd"));
  plaza.position.set(plazaX, 0.03, plazaZ);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const statue = new THREE.Group();
  const bronze = toon("#7f9a86");
  const plinth = toon("#d9d2c0");
  const hat = toon("#6a5a44");
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
  put(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14), hat, 0, 1.52, 0);
  put(new THREE.CylinderGeometry(0.02, 0.012, 0.22, 8), hat, -0.06, 1.48, -0.08).rotation.z = 1.2;
  put(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), bronze, 0.14, 1.32, 0).rotation.z = -0.9;
  put(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), hat, -0.13, 1.1, 0.02);
  statue.position.set(plazaX, 0.06, plazaZ);
  scene.add(statue);

  // round cartoon trees: a few in the square, a dense forest around the town
  const trunkMat = toon("#7a4a2a");
  const leafA = toon("#4fae4a");
  const leafB = toon("#6cc95a");
  const tree = (x: number, z: number, s: number, alt: boolean) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), trunkMat);
    trunk.position.y = 0.2;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), alt ? leafA : leafB);
    crown.position.y = 0.58;
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), alt ? leafB : leafA);
    crown2.position.set(0.14, 0.48, 0.08);
    [trunk, crown, crown2].forEach((m) => (m.castShadow = true));
    t.add(trunk, crown, crown2);
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    scene.add(t);
  };
  [[-2.6, -1.8], [1.1, -1.9], [-2.7, 0.9], [1.0, 0.8], [2.3, -0.6], [-3.6, -0.5]].forEach(([x, z], i) => tree(x, z, 1, i % 2 === 0));
  for (let i = 0; i < 110; i++) {
    const x = -16 + rnd() * 32;
    const z = -14 + rnd() * 26;
    const inTown = x > -7.6 && x < 6.6 && z > -6.4 && z < 5.0;
    if (!inTown) tree(x, z, 0.9 + rnd() * 0.7, rnd() > 0.5);
  }

  // buildings, each on its lot, facing the road
  const pickables: THREE.Object3D[] = [];
  const bodies: { id: LocationId; body: THREE.Mesh }[] = [];
  const tops: Record<string, THREE.Vector3> = {};
  LOCATIONS.forEach((loc) => {
    const { group, body, topY } = buildBuilding(loc);
    const lot = lotFor(loc.x, loc.y, loc.id);
    group.position.copy(lot.pos);
    group.rotation.y = lot.rotY;
    scene.add(group);
    pickables.push(group);
    bodies.push({ id: loc.id, body });
    tops[loc.id] = lot.pos.clone().setY(topY + 0.15);
  });
  const fh = buildFlandersHouse();
  const flot = lotFor(RING[FLANDERS_CELL].x, RING[FLANDERS_CELL].y);
  fh.position.copy(flot.pos);
  fh.rotation.y = flot.rotY;
  scene.add(fh);

  // name labels render in a final overlay pass (above everything)
  const labelScene = new THREE.Scene();
  const sprites: THREE.Sprite[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Sprite).isSprite) sprites.push(o as THREE.Sprite);
  });
  sprites.forEach((sp) => {
    labelScene.attach(sp);
    sp.userData.base = sp.scale.clone().multiplyScalar(0.85);
  });

  // Tapped Out-style bubbles: $ over your workplace, Zzz over home late in the week
  const jobBubble = bubbleSprite("$", "#3fae3f");
  const sleepBubble = bubbleSprite("Zzz", "#4a8fd9");
  labelScene.add(jobBubble, sleepBubble);
  jobBubble.userData.base = jobBubble.scale.clone();
  sleepBubble.userData.base = sleepBubble.scale.clone();

  // ambient townsfolk strolling the sidewalks
  const walkers = [
    { look: { shirt: "#e8562a", pants: "#2f63d6", hair: "spikes" as const }, s: 3, v: 0.55, inset: -0.62 },
    { look: { shirt: "#45a84e", pants: "#45a84e", hair: "beehive" as const, hairColor: "#2f63d6" }, s: 14, v: -0.45, inset: 0.62 },
    { look: { shirt: "#7a6bb5", pants: "#4a4a5a", hair: "cap" as const, hairColor: "#55524d" }, s: 22, v: 0.4, inset: 0.62 },
    { look: { shirt: "#d8433a", pants: "#3b4f8f", hair: "cap" as const, hairColor: "#2e5bd6", glasses: true }, s: 30, v: -0.6, inset: -0.62 },
  ].map((w) => {
    const fig = makeFigure(w.look, "", false);
    fig.scale.setScalar(0.5);
    scene.add(fig);
    return { ...w, fig };
  });

  // tokens: you, and Ned (own scene, drawn after the city so nothing hides them)
  const st0 = deps.getState();
  const look = TOKEN_LOOK[st0.avatar] ?? TOKEN_LOOK.p0;
  const token = makeFigure({ ...look, shirt: avatarShirt(st0.avatar) }, "#fed90f");
  const ned = makeFigure(NED_LOOK, "#7fcf6d");
  ned.scale.setScalar(0.92);
  const tokenScene = new THREE.Scene();
  tokenScene.add(token, ned, lights());
  const tokenSun = new THREE.DirectionalLight(0xfff6e0, 1.9);
  tokenSun.position.copy(sun.position);
  tokenScene.add(tokenSun);
  const blobMat = noOutline(new THREE.MeshBasicMaterial({ color: 0x1d1a17, transparent: true, opacity: 0.28, depthWrite: false }));
  const blobGeo = new THREE.CircleGeometry(0.34, 24);
  blobGeo.rotateX(-Math.PI / 2);
  const tokenBlob = new THREE.Mesh(blobGeo, blobMat);
  const nedBlob = new THREE.Mesh(blobGeo, blobMat);
  scene.add(tokenBlob, nedBlob);

  let curIndex = ringIndex(st0.location);
  if (curIndex < 0) curIndex = 0;
  token.position.copy(tokenPos(curIndex));

  const nedTarget = new THREE.Vector3();
  function placeNed(snap: boolean) {
    const cell = deps.getState().rival?.cell ?? FLANDERS_CELL;
    const p = tokenPos(cell);
    if (cell === curIndex) {
      // share the space politely, along the street
      if (RING[cell].y === 0 || RING[cell].y === 3) p.x += 0.55;
      else p.z += 0.55;
    }
    nedTarget.copy(p);
    if (snap) ned.position.copy(p);
  }
  placeNed(true);

  // ---- interaction: tap a building, drag to pan, wheel / pinch to zoom ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverId: LocationId | null = null;

  const walk = { active: false, pts: [] as THREE.Vector3[], seg: 0, t: 0, target: null as LocationId | null };

  function setHover(id: LocationId | null) {
    if (hoverId === id) return;
    const prev = bodies.find((b) => b.id === hoverId);
    if (prev) (prev.body.material as THREE.MeshToonMaterial).emissive.setHex(0x000000);
    hoverId = id;
    const b = bodies.find((x) => x.id === id);
    if (b) (b.body.material as THREE.MeshToonMaterial).emissive.setHex(0x4a3c10);
    renderer.domElement.style.cursor = id ? "pointer" : "grab";
  }

  function pick(clientX: number, clientY: number): LocationId | null {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    for (const h of raycaster.intersectObjects(pickables, true)) {
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
    if (walk.active) return;
    if (toId === st.location) return deps.onEnter()(toId);
    if (travelCost(st, toId) > st.hours) return deps.dispatch({ type: "MOVE", to: toId });
    const path = ringPath(st.location, toId);
    if (path.length === 0) {
      deps.dispatch({ type: "MOVE", to: toId });
      return deps.onEnter()(toId);
    }
    const cells = path.map((c) => RING.findIndex((r) => r.x === c.x && r.y === c.y));
    walk.pts = roadPath([tokenPos(curIndex), ...cells.map(tokenPos)]);
    walk.seg = 0;
    walk.t = 0;
    walk.active = true;
    walk.target = toId;
    setHover(null);
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let dragged = false;
  let pinchDist = 0;

  const panBy = (dx: number, dy: number) => {
    const h = mount.clientHeight || 1;
    const perPx = (fitH * zoom) / h;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    const fwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).setY(0).normalize();
    target.addScaledVector(right, -dx * perPx).addScaledVector(fwd, (dy * perPx) / Math.sin(elev));
    target.x = Math.min(bounds.x1, Math.max(bounds.x0, target.x));
    target.z = Math.min(bounds.z1, Math.max(bounds.z0, target.z));
    updateCamera();
  };
  const setZoom = (z: number) => {
    zoom = Math.min(1.1, Math.max(0.4, z));
    updateCamera();
  };

  const el = renderer.domElement;
  const onDown = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY };
      dragged = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      dragged = true;
    }
  };
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (!walk.active) setHover(pick(e.clientX, e.clientY));
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) setZoom(zoom * (pinchDist / d));
      pinchDist = d;
      return;
    }
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) dragged = true;
    if (dragged) {
      panBy(e.clientX - prev.x, e.clientY - prev.y);
      el.style.cursor = "grabbing";
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (!dragged) {
        const id = pick(e.clientX, e.clientY);
        if (id) startWalk(id);
      }
      downAt = null;
      pinchDist = 0;
      el.style.cursor = hoverId ? "pointer" : "grab";
    }
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(zoom * Math.exp(e.deltaY * 0.0012));
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("wheel", onWheel, { passive: false });

  // ---- state sync: bubbles, money popups, token snaps ----
  const popups: { sp: THREE.Sprite; age: number; base: THREE.Vector3 }[] = [];
  const popup = (text: string, color: string, at: THREE.Vector3, delay = 0) => {
    const sp = popupSprite(text, color);
    const base = at.clone().setY(1.25);
    sp.position.copy(base);
    sp.visible = false;
    sp.userData.base = sp.scale.clone();
    labelScene.add(sp);
    popups.push({ sp, age: -delay, base });
  };
  let last = { cash: st0.cash + st0.savings, credits: st0.credits, career: st0.careerLevel, week: st0.week };

  function refreshBubbles() {
    const st = deps.getState();
    const job = st.jobId ? getJob(st.jobId) : null;
    jobBubble.visible = !!job;
    if (job) jobBubble.position.copy(tops[job.locationId]);
    sleepBubble.visible = st.hours <= 10;
    sleepBubble.position.copy(tops.home);
  }
  refreshBubbles();

  function sync(s: GameState) {
    refreshBubbles();
    const idx = ringIndex(s.location);
    if (idx >= 0 && idx !== curIndex && !walk.active) {
      curIndex = idx;
      token.position.copy(tokenPos(idx));
    }
    placeNed(false);
    const at = token.position;
    const money = s.cash + s.savings;
    if (s.week !== last.week) popup(`Week ${s.week}!`, "#ffffff", at);
    else if (money !== last.cash) {
      const d = Math.round(money - last.cash);
      popup(d > 0 ? `+$${d.toLocaleString()}` : `-$${Math.abs(d).toLocaleString()}`, d > 0 ? "#5fd35f" : "#ff6b5a", at);
    }
    if (s.credits > last.credits) popup(`+${s.credits - last.credits} credits`, "#7cc4f2", at, 0.35);
    if (s.careerLevel > last.career) popup("Level up!", "#fed90f", at, 0.7);
    last = { cash: money, credits: s.credits, career: s.careerLevel, week: s.week };
  }

  const ro = new ResizeObserver(() => {
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);
    fitView();
    updateCamera();
  });
  ro.observe(mount);
  renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1, false);
  fitView();
  updateCamera();
  if ((mount.clientWidth || 0) > 900) panBy(80, 10);

  const spinners: THREE.Object3D[] = [];
  const puffs: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.spin) spinners.push(o);
    if (o.userData.puff !== undefined) puffs.push(o);
  });

  const SPEED = 9; // world units per second along the road
  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    spinners.forEach((o) => (o.rotation.y += dt * 1.5));
    puffs.forEach((o) => o.scale.setScalar(1 + Math.sin(time * 1.6 + (o.userData.puff as number) * 1.3) * 0.08));
    jobBubble.center.y = -Math.abs(Math.sin(time * 3)) * 0.25;
    sleepBubble.center.y = -Math.abs(Math.sin(time * 2 + 1)) * 0.2;

    bodies.forEach((b) => {
      const g = b.body.parent!;
      const want = b.id === hoverId && !walk.active ? 0.12 : 0;
      g.position.y += (want - g.position.y) * Math.min(1, dt * 12);
    });

    walkers.forEach((w) => {
      w.s += w.v * dt;
      const { p, dir } = loopPoint(w.s, w.inset);
      w.fig.position.set(p.x, Math.abs(Math.sin(time * 9 + w.s)) * 0.04, p.z);
      const heading = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][dir] + (w.v < 0 ? Math.PI : 0);
      w.fig.rotation.y = heading;
    });

    if (walk.active) {
      const a = walk.pts[walk.seg];
      const b = walk.pts[walk.seg + 1];
      const len = Math.max(0.001, a.distanceTo(b));
      walk.t += (dt * SPEED) / len;
      if (walk.t >= 1) {
        walk.t = 0;
        walk.seg += 1;
      }
      if (walk.seg >= walk.pts.length - 1) {
        token.position.copy(walk.pts[walk.pts.length - 1]);
        walk.active = false;
        const toId = walk.target!;
        curIndex = ringIndex(toId);
        deps.dispatch({ type: "MOVE", to: toId });
        deps.onEnter()(toId);
      } else {
        const a2 = walk.pts[walk.seg];
        const b2 = walk.pts[walk.seg + 1];
        token.position.lerpVectors(a2, b2, walk.t);
        token.position.y = Math.sin(walk.t * Math.PI) * Math.min(0.45, a2.distanceTo(b2) * 0.18);
        token.rotation.z = Math.sin(walk.t * Math.PI * 2) * 0.12;
      }
    } else {
      token.position.y += (0 - token.position.y) * Math.min(1, dt * 10);
      token.rotation.z *= 0.8;
    }

    const dx = nedTarget.x - ned.position.x;
    const dz = nedTarget.z - ned.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const step = Math.min(dist, dt * 3.2);
      ned.position.x += (dx / dist) * step;
      ned.position.z += (dz / dist) * step;
      ned.position.y = Math.abs(Math.sin(time * 14)) * 0.12;
    } else {
      ned.position.y *= 0.8;
    }
    token.rotation.y = walk.active ? 0 : Math.sin(time * 1.4) * 0.12;
    ned.rotation.y = Math.sin(time * 1.2 + 1) * 0.14;

    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.age += dt;
      p.sp.visible = p.age >= 0;
      if (p.age < 0) continue;
      p.sp.position.copy(p.base).setY(p.base.y + p.age * 0.9);
      (p.sp.material as THREE.SpriteMaterial).opacity = Math.min(1, 2.2 - p.age * 1.3);
      if (p.age > 1.7) {
        labelScene.remove(p.sp);
        (p.sp.material as THREE.SpriteMaterial).map?.dispose();
        p.sp.material.dispose();
        popups.splice(i, 1);
      }
    }

    // overlay sprites keep a constant on-screen size at any zoom
    const k = fitH * zoom * 1.15;
    labelScene.children.forEach((o) => {
      if (o.userData.base) o.scale.copy(o.userData.base).multiplyScalar(k);
    });

    tokenBlob.position.set(token.position.x, 0.08, token.position.z);
    nedBlob.position.set(ned.position.x, 0.08, ned.position.z);
    tokenBlob.scale.setScalar(1 - token.position.y * 0.6);

    outline.autoClear = true;
    outline.render(scene, camera);
    outline.autoClear = false;
    renderer.clearDepth();
    outline.render(tokenScene, camera);
    renderer.autoClear = false;
    renderer.render(labelScene, camera);
    renderer.autoClear = true;
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      [scene, tokenScene, labelScene].forEach((root) =>
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = (m as any).material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat) {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          }
        })
      );
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    },
    sync,
  };
}

export default function CityMap({ onEnter }: { onEnter: (id: LocationId) => void }) {
  const { state, dispatch } = useGame();
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const stateRef = useRef(state);
  const onEnterRef = useRef(onEnter);
  stateRef.current = state;
  onEnterRef.current = onEnter;

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
    };
    fontReady.then(start, start);
    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to state changes: week rollover, Ned wandering, money popups, bubbles
  useEffect(() => {
    apiRef.current?.sync(state);
  }, [state]);

  return <div ref={mountRef} className="world" />;
}
