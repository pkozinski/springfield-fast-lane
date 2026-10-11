import { useEffect, useRef } from "react";
import * as THREE from "three";
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
/** Token stands on the inner walkway, in front of its building (offset toward centre). */
const tokenWorld = (gx: number, gy: number) => {
  const p = cellToWorld(gx, gy);
  const dir = new THREE.Vector3(-p.x, 0, -p.z);
  if (dir.lengthSq() > 1e-4) dir.normalize().multiplyScalar(0.92);
  return new THREE.Vector3(p.x + dir.x, 0, p.z + dir.z);
};
const ringIndexOf = (id: LocationId) => RING.findIndex((c) => c.id === id);

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color("#ffffff"), amt);
  else c.lerp(new THREE.Color("#000000"), -amt);
  return c;
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

function massing(loc: Location): { h: number; w: number } {
  switch (loc.category) {
    case "home":
      return { h: 1.1, w: 1.15 };
    case "food":
      return { h: 1.3, w: 1.2 };
    case "leisure":
      return { h: 1.5, w: 1.25 };
    case "bank":
      return { h: 2.1, w: 1.3 };
    case "university":
      return { h: 1.9, w: 1.3 };
    case "workplace":
      return { h: 1.5, w: 1.4 };
    default:
      return { h: 1.75, w: 1.3 };
  }
}

/** Build one building as a group of simple lit meshes. */
function buildBuilding(loc: Location) {
  const g = new THREE.Group();
  g.userData.locId = loc.id;
  const { h, w } = massing(loc);
  const d = w;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(loc.accent),
    roughness: 0.65,
    metalness: 0.05,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.locId = loc.id;
  body.userData.baseColor = bodyMat.color.clone();
  g.add(body);

  // windows (emissive) on +Z and +X faces
  const winMat = new THREE.MeshStandardMaterial({
    color: "#bfe3ff",
    emissive: "#4a7ea8",
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  const floors = Math.max(1, Math.round(h / 0.55));
  for (let f = 0; f < floors; f++) {
    const wy = 0.4 + f * 0.55;
    if (wy > h - 0.25) break;
    for (const sx of [-0.28, 0.28]) {
      const wz = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.04), winMat);
      wz.position.set(sx * w, wy, d / 2 + 0.01);
      g.add(wz);
      const wx = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.26), winMat);
      wx.position.set(w / 2 + 0.01, wy, sx * d);
      g.add(wx);
    }
  }

  // door
  const doorMat = new THREE.MeshStandardMaterial({ color: shade(loc.accent, -0.55), roughness: 0.6 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.05), doorMat);
  door.position.set(0, 0.25, d / 2 + 0.01);
  g.add(door);

  // roof
  const roofMat = new THREE.MeshStandardMaterial({ color: shade(loc.accent, -0.2), roughness: 0.7 });
  if (loc.category === "home") {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.82, 0.7, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = h + 0.33;
    roof.castShadow = true;
    g.add(roof);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), roofMat);
    chim.position.set(w * 0.25, h + 0.4, d * 0.2);
    g.add(chim);
  } else {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), roofMat);
    roof.position.y = h + 0.08;
    roof.castShadow = true;
    g.add(roof);
    // parapet rim
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.16, 0.08, d + 0.16),
      new THREE.MeshStandardMaterial({ color: shade(loc.accent, 0.18), roughness: 0.6 })
    );
    rim.position.y = h + 0.16;
    g.add(rim);
  }

  // distinctive features
  const gold = new THREE.MeshStandardMaterial({ color: "#d9b24a", roughness: 0.35, metalness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: "#8d949c", roughness: 0.5, metalness: 0.4 });
  if (loc.id === "factory") {
    for (const ox of [-0.3, 0.1]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 12), metal);
      stack.position.set(ox, h + 0.45, -0.2);
      stack.castShadow = true;
      g.add(stack);
    }
  } else if (loc.id === "bank") {
    for (const ox of [-0.42, -0.14, 0.14, 0.42]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h * 0.8, 10), gold);
      col.position.set(ox, (h * 0.8) / 2, d / 2 + 0.05);
      g.add(col);
    }
    const ped = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 0.4, 3), gold);
    ped.rotation.y = Math.PI / 2;
    ped.scale.z = 0.2;
    ped.position.set(0, h + 0.2, d / 2 - 0.1);
    g.add(ped);
  } else if (loc.id === "university") {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), bodyMat);
    tower.position.y = h + 0.5;
    tower.castShadow = true;
    g.add(tower);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 4), roofMat);
    top.rotation.y = Math.PI / 4;
    top.position.y = h + 1.25;
    g.add(top);
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), gold);
    clock.rotation.x = Math.PI / 2;
    clock.position.set(0, h + 0.6, 0.26);
    g.add(clock);
  } else if (loc.id === "hitech") {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), metal);
    ant.position.set(0.3, h + 0.5, 0);
    g.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshStandardMaterial({ color: "#ff5a6a", emissive: "#ff2a3a", emissiveIntensity: 0.8 }));
    tip.position.set(0.3, h + 1.0, 0);
    g.add(tip);
  } else if (loc.id === "club") {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), metal);
    pole.position.y = h + 0.3;
    g.add(pole);
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({ color: "#cdd6e2", roughness: 0.2, metalness: 0.9, flatShading: true })
    );
    ball.position.y = h + 0.7;
    ball.userData.spin = true;
    g.add(ball);
  } else if (loc.id === "burger") {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 20, Math.PI), gold);
    arch.position.set(0, h + 0.2, 0);
    g.add(arch);
  }

  // label + optional job star
  const label = makeLabel(loc.short);
  label.position.set(0, h + (loc.category === "home" ? 1.1 : 1.0), 0);
  label.userData.labelBaseY = label.position.y;
  g.add(label);

  return { group: g, body, label };
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
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
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

  // island slab
  const islW = COLS * SP + 1.1;
  const islD = ROWS * SP + 1.1;
  const grass = new THREE.MeshStandardMaterial({ color: "#6fb24e", roughness: 0.95 });
  const dirt = new THREE.MeshStandardMaterial({ color: "#7a5c36", roughness: 1 });
  const islandMats = [dirt, dirt, grass, dirt, dirt, dirt];
  const island = new THREE.Mesh(new THREE.BoxGeometry(islW, 1.0, islD), islandMats);
  island.position.y = -0.5;
  island.receiveShadow = true;
  scene.add(island);

  // walkway tiles on ring cells
  const roadMat = new THREE.MeshStandardMaterial({ color: "#d8c49a", roughness: 0.9 });
  RING.forEach((c) => {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(SP * 0.96, 0.06, SP * 0.96), roadMat);
    const p = cellToWorld(c.x, c.y);
    tile.position.set(p.x, 0.03, p.z);
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
    const { group, body } = buildBuilding(loc);
    const p = cellToWorld(loc.x, loc.y);
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    pickables.push(group);
    bodies.push({ id: loc.id, body });

    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: "#ffcf4d", emissive: "#a9780a", emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 })
    );
    star.position.set(p.x + massing(loc).w * 0.5, massing(loc).h + 0.5, p.z + massing(loc).w * 0.5);
    star.visible = false;
    scene.add(star);
    jobMarkers[loc.id] = star;
  });

  // token: a glossy game pawn with a highlight ring
  const token = new THREE.Group();
  const pawnMat = new THREE.MeshStandardMaterial({ color: "#e6c45c", roughness: 0.3, metalness: 0.7 });
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
