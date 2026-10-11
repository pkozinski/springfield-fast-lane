import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LOCATIONS, RING, ringPath, getJob } from "../game/data";
import { travelCost } from "../game/engine";
import { useGame } from "../game/store";
import type { GameState, Location, LocationId } from "../game/types";
import Clock from "./Clock";

/* ----------------------------------------------------------------------------
   Real 3D board, built procedurally with Three.js (all original meshes).
---------------------------------------------------------------------------- */
const COLS = 5;
const ROWS = 4;
const SP = 2.05; // spacing between board cells
const STEP = 0.2; // seconds per space hopped

const cellToWorld = (gx: number, gy: number) =>
  new THREE.Vector3((gx - (COLS - 1) / 2) * SP, 0, (gy - (ROWS - 1) / 2) * SP);
/** Token stands just in front of its building from the camera's view (offset toward camera, +z). */
const tokenWorld = (gx: number, gy: number) => {
  const p = cellToWorld(gx, gy);
  return new THREE.Vector3(p.x, 0, p.z + 1.0);
};
const ringIndexOf = (id: LocationId) => RING.findIndex((c) => c.id === id);

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color("#ffffff"), amt);
  else c.lerp(new THREE.Color("#000000"), -amt);
  return c;
}

/** Rounded (beveled) box — soft edges read far more premium than hard primitives. */
function rb(w: number, h: number, d: number, radius = 0.09) {
  const r = Math.min(radius, Math.min(w, h, d) / 2 - 0.001);
  return new RoundedBoxGeometry(w, h, d, 4, Math.max(0.005, r));
}

function makeLabel(text: string) {
  const fs = 34;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${fs}px Georgia, serif`;
  const w = Math.ceil(ctx.measureText(text).width);
  canvas.width = w + 34;
  canvas.height = fs + 26;
  const c = canvas.getContext("2d")!;
  c.font = `600 ${fs}px Georgia, serif`;
  c.beginPath();
  (c as any).roundRect(2, 2, canvas.width - 4, canvas.height - 4, 12);
  c.fillStyle = "#fbf6ea";
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "#c9a24b";
  c.stroke();
  c.fillStyle = "#1c1710";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  const s = 0.0095;
  sprite.scale.set(canvas.width * s, canvas.height * s, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Add a grid of emissive windows to the front (+Z) and right (+X) faces of a box. */
function addWindows(g: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, dense = false) {
  const cols = dense ? [-0.3, 0, 0.3] : [-0.28, 0.28];
  const rowGap = dense ? 0.42 : 0.55;
  const floors = Math.max(1, Math.floor((h - 0.5) / rowGap) + 1);
  const ws = dense ? 0.2 : 0.26;
  for (let f = 0; f < floors; f++) {
    const wy = 0.42 + f * rowGap;
    if (wy > h - 0.2) break;
    for (const sx of cols) {
      const wz = new THREE.Mesh(rb(ws, 0.28, 0.05, 0.02), mat);
      wz.position.set(sx * w, wy, d / 2 + 0.01);
      g.add(wz);
      const wx = new THREE.Mesh(rb(0.05, 0.28, ws, 0.02), mat);
      wx.position.set(w / 2 + 0.01, wy, sx * d);
      g.add(wx);
    }
  }
}

/** Build one building with a silhouette unique to its establishment. */
function buildBuilding(loc: Location) {
  const g = new THREE.Group();
  g.userData.locId = loc.id;

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(loc.accent), roughness: 0.5, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.4, envMapIntensity: 1.0 });
  const roofMat = new THREE.MeshPhysicalMaterial({ color: shade(loc.accent, -0.22), roughness: 0.6, clearcoat: 0.3, envMapIntensity: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: shade(loc.accent, 0.18), roughness: 0.5, envMapIntensity: 1.0 });
  const winMat = new THREE.MeshPhysicalMaterial({ color: "#cfeaff", emissive: "#4a7ea8", emissiveIntensity: 0.35, roughness: 0.08, metalness: 0, clearcoat: 1, envMapIntensity: 1.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: "#aed8f2", emissive: "#2f6c94", emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.6 });
  const gold = new THREE.MeshStandardMaterial({ color: "#e0b954", roughness: 0.25, metalness: 0.95, envMapIntensity: 1.3 });
  const metal = new THREE.MeshStandardMaterial({ color: "#9aa1a9", roughness: 0.3, metalness: 0.85, envMapIntensity: 1.2 });
  const doorMat = new THREE.MeshStandardMaterial({ color: shade(loc.accent, -0.55), roughness: 0.5, envMapIntensity: 0.9 });

  let body: THREE.Mesh;
  let topY = 1.5;
  let halfW = 0.65;

  const mkBox = (w: number, h: number, d: number, y: number, mat: THREE.Material = bodyMat) => {
    const m = new THREE.Mesh(rb(w, h, d), mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const flatRoof = (w: number, h: number, d: number) => {
    const r = mkBox(w + 0.12, 0.16, d + 0.12, h + 0.08, roofMat);
    r.castShadow = true;
    const rim = mkBox(w + 0.18, 0.08, d + 0.18, h + 0.17, rimMat);
    rim.receiveShadow = true;
  };
  const door = (d: number) => {
    const m = new THREE.Mesh(rb(0.34, 0.5, 0.06, 0.03), doorMat);
    m.position.set(0, 0.25, d / 2 + 0.02);
    g.add(m);
  };

  switch (loc.id) {
    case "home": {
      const w = 1.0, h = 0.85, d = 1.0;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 0.7, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + 0.35;
      roof.castShadow = true;
      g.add(roof);
      mkBox(0.16, 0.42, 0.16, h + 0.42, roofMat).position.x = w * 0.28;
      topY = h + 0.7;
      halfW = w / 2;
      break;
    }
    case "employment": {
      // stepped office tower
      const w = 1.1, h = 1.3, d = 1.0;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      mkBox(0.78, 0.7, 0.72, h + 0.35);
      flatRoof(0.78, h + 0.7, 0.72);
      topY = h + 0.9;
      halfW = w / 2;
      break;
    }
    case "university": {
      const w = 1.3, h = 1.05, d = 1.2;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      flatRoof(w, h, d);
      const tower = mkBox(0.52, 0.95, 0.52, h + 0.55);
      void tower;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      dome.position.y = h + 1.03;
      g.add(dome);
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), gold);
      clock.rotation.x = Math.PI / 2;
      clock.position.set(0, h + 0.62, 0.28);
      g.add(clock);
      topY = h + 1.3;
      halfW = w / 2;
      break;
    }
    case "bank": {
      // round rotunda + dome + columns
      const r = 0.72, h = 1.3;
      body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), bodyMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r + 0.02, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      dome.position.y = h;
      dome.castShadow = true;
      g.add(dome);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), gold);
      finial.position.y = h + r + 0.05;
      g.add(finial);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h * 0.9, 10), gold);
        col.position.set(Math.cos(a) * (r + 0.12), (h * 0.9) / 2, Math.sin(a) * (r + 0.12));
        g.add(col);
      }
      topY = h + r + 0.2;
      halfW = r + 0.1;
      break;
    }
    case "factory": {
      // long, low shed + sawtooth + stacks
      const w = 1.55, h = 0.85, d = 1.1;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      for (let i = -1; i <= 1; i++) {
        const tooth = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, d * 0.9, 3), roofMat);
        tooth.rotation.set(Math.PI / 2, 0, Math.PI / 6);
        tooth.position.set(i * 0.5, h + 0.14, 0);
        g.add(tooth);
      }
      for (const ox of [-0.4, 0.0]) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.95, 12), metal);
        stack.position.set(ox, h + 0.5, -0.3);
        stack.castShadow = true;
        g.add(stack);
      }
      topY = h + 1.0;
      halfW = w / 2;
      break;
    }
    case "zmart": {
      // wide big-box + pylon sign
      const w = 1.65, h = 1.0, d = 1.25;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      flatRoof(w, h, d);
      const pole = mkBox(0.12, 1.0, 0.12, h + 0.3, metal);
      void pole;
      const sign = mkBox(0.5, 0.42, 0.08, h + 0.95, bodyMat);
      (sign.material as THREE.MeshStandardMaterial) = new THREE.MeshStandardMaterial({ color: shade(loc.accent, 0.25), emissive: shade(loc.accent, -0.1), emissiveIntensity: 0.4 });
      topY = h + 1.2;
      halfW = w / 2;
      break;
    }
    case "hitech": {
      // sleek glass tower
      const w = 0.92, h = 2.1, d = 0.92;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, glassMat, true);
      door(d);
      mkBox(0.7, 0.22, 0.7, h + 0.11, rimMat);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), metal);
      ant.position.y = h + 0.6;
      g.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshStandardMaterial({ color: "#ff5a6a", emissive: "#ff2a3a", emissiveIntensity: 0.9 }));
      tip.position.y = h + 1.05;
      g.add(tip);
      topY = h + 1.1;
      halfW = w / 2;
      break;
    }
    case "cinema": {
      // wide hall + marquee + vertical blade sign
      const w = 1.35, h = 1.2, d = 1.05;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      const marquee = mkBox(w + 0.2, 0.26, 0.4, 0.95, rimMat);
      void marquee;
      const strip = mkBox(w + 0.14, 0.12, 0.42, 0.95, new THREE.MeshStandardMaterial({ color: "#ffd36a", emissive: "#ffb21e", emissiveIntensity: 0.8 }));
      void strip;
      door(d);
      flatRoof(w, h, d);
      const blade = mkBox(0.26, 1.0, 0.1, h + 0.4, new THREE.MeshStandardMaterial({ color: "#2a1540", emissive: "#ff5bd0", emissiveIntensity: 0.6 }));
      blade.position.x = w / 2;
      topY = h + 0.9;
      halfW = w / 2;
      break;
    }
    case "club": {
      // hexagonal club + disco ball
      const r = 0.72, h = 1.3;
      body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), bodyMat);
      body.position.y = h / 2;
      body.rotation.y = Math.PI / 6;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.14, 6), new THREE.MeshStandardMaterial({ color: "#e879f9", emissive: "#d019d0", emissiveIntensity: 0.7 }));
      band.rotation.y = Math.PI / 6;
      band.position.y = h * 0.7;
      g.add(band);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), metal);
      pole.position.y = h + 0.25;
      g.add(pole);
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshStandardMaterial({ color: "#cdd6e2", roughness: 0.15, metalness: 0.95, flatShading: true }));
      ball.position.y = h + 0.65;
      ball.userData.spin = true;
      g.add(ball);
      topY = h + 0.9;
      halfW = r;
      break;
    }
    case "gym": {
      // wide hall with a barrel roof
      const w = 1.35, h = 0.95, d = 1.15;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, d + 0.1, 20, 1, false, 0, Math.PI), roofMat);
      barrel.rotation.z = Math.PI / 2;
      barrel.rotation.y = Math.PI / 2;
      barrel.position.y = h;
      barrel.castShadow = true;
      g.add(barrel);
      topY = h + w / 2;
      halfW = w / 2;
      break;
    }
    case "cafe": {
      const w = 0.98, h = 1.0, d = 0.98;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      // slanted striped awning over the door
      const awn = mkBox(w + 0.1, 0.06, 0.4, 0.78, new THREE.MeshStandardMaterial({ color: shade(loc.accent, 0.2) }));
      awn.position.z = d / 2 + 0.16;
      awn.rotation.x = -0.5;
      flatRoof(w, h, d);
      // umbrella beside
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), metal);
      pole.position.set(w / 2 + 0.25, 0.25, d / 2 + 0.2);
      g.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 10), new THREE.MeshStandardMaterial({ color: "#d9534f" }));
      top.position.set(w / 2 + 0.25, 0.6, d / 2 + 0.2);
      g.add(top);
      topY = h + 0.2;
      halfW = w / 2;
      break;
    }
    case "grocery": {
      const w = 1.2, h = 1.0, d = 1.05;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      flatRoof(w, h, d);
      const canopy = mkBox(w + 0.2, 0.08, 0.42, 0.82, new THREE.MeshStandardMaterial({ color: shade(loc.accent, 0.22) }));
      canopy.position.z = d / 2 + 0.16;
      // produce crates
      for (const ox of [-0.3, 0.1]) {
        const crate = mkBox(0.22, 0.2, 0.22, 0.1, new THREE.MeshStandardMaterial({ color: "#9a6b3f" }));
        crate.position.set(ox, 0.1, d / 2 + 0.28);
      }
      topY = h + 0.2;
      halfW = w / 2;
      break;
    }
    case "burger": {
      const w = 1.15, h = 0.9, d = 1.15;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      flatRoof(w, h, d);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 20, Math.PI), gold);
      arch.position.y = h + 0.34;
      g.add(arch);
      topY = h + 0.6;
      halfW = w / 2;
      break;
    }
    default: {
      const w = 1.2, h = 1.4, d = 1.2;
      body = mkBox(w, h, d, h / 2);
      addWindows(g, w, h, d, winMat);
      door(d);
      flatRoof(w, h, d);
      topY = h + 0.2;
      halfW = w / 2;
    }
  }

  body.userData.locId = loc.id;

  const label = makeLabel(loc.short);
  label.position.set(0, topY + 0.5, 0);
  g.add(label);

  return { group: g, body, topY, halfW };
}

interface Api {
  dispose: () => void;
  sync: (locId: LocationId) => void;
}

function initScene(
  mount: HTMLDivElement,
  deps: { dispatch: (a: any) => void; onEnter: () => (id: LocationId) => void; getState: () => GameState }
): Api {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#171119");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  // image-based lighting for soft, realistic reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 8.6, 9.6);
  camera.lookAt(0, 0.2, 0);

  // lights
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x3a2c1a, 0.55));
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xfff4de, 1.25);
  sun.position.set(6, 11, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -9;
  sc.right = 9;
  sc.top = 9;
  sc.bottom = -9;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // island slab (rounded, soft-edged diorama base)
  const islW = COLS * SP + 1.1;
  const islD = ROWS * SP + 1.1;
  const grass = new THREE.MeshStandardMaterial({ color: "#6fb24e", roughness: 0.9, envMapIntensity: 0.5 });
  const dirt = new THREE.MeshStandardMaterial({ color: "#7a5c36", roughness: 1 });
  const base = new THREE.Mesh(rb(islW, 0.9, islD, 0.18), dirt);
  base.position.y = -0.47;
  base.receiveShadow = true;
  scene.add(base);
  const grassTop = new THREE.Mesh(rb(islW - 0.08, 0.16, islD - 0.08, 0.14), grass);
  grassTop.position.y = -0.04;
  grassTop.receiveShadow = true;
  scene.add(grassTop);

  // walkway tiles on ring cells
  const roadMat = new THREE.MeshStandardMaterial({ color: "#d8c49a", roughness: 0.85, envMapIntensity: 0.4 });
  RING.forEach((c) => {
    const tile = new THREE.Mesh(rb(SP * 0.94, 0.08, SP * 0.94, 0.06), roadMat);
    const p = cellToWorld(c.x, c.y);
    tile.position.set(p.x, 0.04, p.z);
    tile.receiveShadow = true;
    scene.add(tile);
  });

  // central plaza + fountain
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.08, 36), roadMat);
  plaza.position.set(0, 0.04, (1.5 - (ROWS - 1) / 2) * SP);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const fBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.22, 24),
    new THREE.MeshStandardMaterial({ color: "#cdbf9b", roughness: 0.8 })
  );
  fBase.position.copy(plaza.position);
  fBase.position.y = 0.15;
  fBase.castShadow = true;
  scene.add(fBase);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: "#7fc7e6", roughness: 0.2, metalness: 0.3 })
  );
  water.position.copy(fBase.position);
  water.position.y = 0.22;
  scene.add(water);

  // trees
  const trunkMat = new THREE.MeshStandardMaterial({ color: "#6b4a2b", roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: "#3f9b52", roughness: 0.9 });
  const treeCells: [number, number][] = [
    [0, 1],
    [1, 1],
    [3, 1],
    [1, 2],
    [3, 2],
  ];
  treeCells.forEach(([gx, gy]) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8), trunkMat);
    trunk.position.y = 0.25;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), leafMat);
    leaves.position.y = 0.95;
    leaves.castShadow = true;
    t.add(trunk, leaves);
    const p = cellToWorld(gx, gy);
    t.position.set(p.x, 0.05, p.z);
    scene.add(t);
  });

  // buildings
  const pickables: THREE.Object3D[] = [];
  const bodies: { id: LocationId; body: THREE.Mesh }[] = [];
  const jobMarkers: Record<string, THREE.Mesh> = {};
  LOCATIONS.forEach((loc) => {
    const { group, body, topY, halfW } = buildBuilding(loc);
    const p = cellToWorld(loc.x, loc.y);
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    pickables.push(group);
    bodies.push({ id: loc.id, body });

    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: "#ffcf4d", emissive: "#a9780a", emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 })
    );
    star.position.set(p.x + halfW, topY + 0.35, p.z + halfW);
    star.visible = false;
    star.userData.spin = true;
    scene.add(star);
    jobMarkers[loc.id] = star;
  });

  // token: a glossy game pawn with a highlight ring
  const token = new THREE.Group();
  const pawnMat = new THREE.MeshStandardMaterial({ color: "#e8c65e", roughness: 0.18, metalness: 0.95, envMapIntensity: 1.4 });
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.14, 20), pawnMat);
  foot.position.y = 0.07;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.5, 16), pawnMat);
  stem.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 20), pawnMat);
  head.position.y = 0.82;
  [foot, stem, head].forEach((m) => {
    m.castShadow = true;
    token.add(m);
  });
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.05, 12, 32),
    new THREE.MeshStandardMaterial({ color: "#ffd86a", emissive: "#c99a2a", emissiveIntensity: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  token.add(ring);
  scene.add(token);

  let curIndex = ringIndexOf(deps.getState().location);
  if (curIndex < 0) curIndex = 0;
  const startP = tokenWorld(RING[curIndex].x, RING[curIndex].y);
  token.position.set(startP.x, 0, startP.z);

  // ---- interaction + animation ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverId: LocationId | null = null;

  const walk = {
    active: false,
    cells: [] as THREE.Vector3[],
    seg: 0,
    t: 0,
    target: null as LocationId | null,
  };

  function setHover(id: LocationId | null) {
    if (hoverId === id) return;
    // restore previous
    if (hoverId) {
      const prev = bodies.find((b) => b.id === hoverId);
      if (prev) (prev.body.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    }
    hoverId = id;
    if (id) {
      const b = bodies.find((x) => x.id === id);
      if (b) (b.body.material as THREE.MeshStandardMaterial).emissive.setHex(0x3a2d10);
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
    if (walk.active) return;
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
    walk.cells = [
      tokenWorld(RING[curIndex].x, RING[curIndex].y),
      ...path.map((c) => tokenWorld(c.x, c.y)),
    ];
    walk.seg = 0;
    walk.t = 0;
    walk.active = true;
    walk.target = toId;
    setHover(null);
  }

  const onMove = (e: PointerEvent) => {
    if (walk.active) return;
    setHover(pick(e));
  };
  const onClick = (e: PointerEvent) => {
    const id = pick(e);
    if (id) startWalk(id);
  };
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerdown", onClick);

  // sync job markers + here ring to current state
  function refreshMarkers() {
    const st = deps.getState();
    const job = st.jobId ? getJob(st.jobId) : null;
    Object.entries(jobMarkers).forEach(([id, m]) => (m.visible = job?.locationId === id));
  }
  refreshMarkers();

  function sync(locId: LocationId) {
    const idx = ringIndexOf(locId);
    refreshMarkers();
    if (idx < 0 || idx === curIndex || walk.active) return;
    // snap token to the new location (e.g. after a week rolls over)
    curIndex = idx;
    const p = tokenWorld(RING[idx].x, RING[idx].y);
    token.position.set(p.x, 0, p.z);
  }

  // resize
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

  // animation loop
  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    // spin disco balls
    scene.traverse((o) => {
      if ((o as any).userData?.spin) o.rotation.y += dt * 1.5;
    });
    water.position.y = 0.22 + Math.sin(time * 2) * 0.01;

    // hover bob
    bodies.forEach((b) => {
      const g = b.body.parent!;
      const want = b.id === hoverId && !walk.active ? 0.12 : 0;
      g.position.y += (want - g.position.y) * Math.min(1, dt * 12);
    });

    if (walk.active) {
      walk.t += dt / STEP;
      while (walk.t >= 1 && walk.seg < walk.cells.length - 1) {
        walk.t -= 1;
        walk.seg += 1;
      }
      if (walk.seg >= walk.cells.length - 1) {
        // arrived
        const end = walk.cells[walk.cells.length - 1];
        token.position.set(end.x, 0, end.z);
        walk.active = false;
        const toId = walk.target!;
        curIndex = ringIndexOf(toId);
        deps.dispatch({ type: "MOVE", to: toId });
        deps.onEnter()(toId);
      } else {
        const a = walk.cells[walk.seg];
        const b = walk.cells[walk.seg + 1];
        token.position.x = a.x + (b.x - a.x) * walk.t;
        token.position.z = a.z + (b.z - a.z) * walk.t;
        token.position.y = Math.sin(walk.t * Math.PI) * 0.45; // hop arc
      }
    } else {
      token.position.y += (0 - token.position.y) * Math.min(1, dt * 10);
    }
    // gentle idle bob of the pawn head handled by scale? keep static.
    ring.rotation.z = time; // subtle spin

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onClick);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as any).material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
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
    if (!mountRef.current) return;
    const api = initScene(mountRef.current, {
      dispatch,
      onEnter: () => onEnterRef.current,
      getState: () => stateRef.current,
    });
    apiRef.current = api;
    return () => api.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to external location changes (week rollover sends you home)
  useEffect(() => {
    apiRef.current?.sync(state.location);
  }, [state.location, state.jobId]);

  return (
    <div className="card stage board-card">
      <div className="map-head">
        <div>
          <h2>Fast Lane City</h2>
          <p>Pick a spot — your token travels the board, then you head inside.</p>
        </div>
        <span className="tag">{state.hours}h left</span>
      </div>

      <div className="board board-3d">
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
