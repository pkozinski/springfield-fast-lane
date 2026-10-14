import type { LocationId } from "../game/types";

/*
  Front-facing storefront art for the flat (Jones-style) board.
  Every facade is drawn in a 160 x 120 box standing on the ground line (y = 116),
  with chunky ink outlines to match the rest of the cartoon UI.
*/

const INK = "#2b2723";
const ink = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const thin = { ...ink, strokeWidth: 2 };
const GROUND = 116;

function Win({ x, y, w = 16, h = 16, fill = "#9fdcf7" }: { x: number; y: number; w?: number; h?: number; fill?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={fill} {...thin} />
      <path d={`M${x + 3} ${y + h - 4} L${x + w - 5} ${y + 3}`} stroke="#fff" strokeWidth={2} opacity={0.7} />
    </g>
  );
}

function Door({ x, w = 16, h = 26, fill = "#7a4b2a" }: { x: number; w?: number; h?: number; fill?: string }) {
  return (
    <g>
      <rect x={x} y={GROUND - h} width={w} height={h} rx={2} fill={fill} {...thin} />
      <circle cx={x + w - 4} cy={GROUND - h / 2} r={1.6} fill={INK} />
    </g>
  );
}

function Sign({
  x, y, w, h = 15, text, bg, fg = "#fff", size = 10.5,
}: { x: number; y: number; w: number; h?: number; text: string; bg: string; fg?: string; size?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={bg} {...thin} />
      <text
        x={x + w / 2} y={y + h / 2 + size * 0.36} textAnchor="middle" fontSize={size} fill={fg}
        fontFamily='"Luckiest Guy", "Arial Black", Impact, sans-serif' letterSpacing={0.5}
      >
        {text}
      </text>
    </g>
  );
}

function Awning({ x, y, w, a, b, n = 6 }: { x: number; y: number; w: number; a: string; b: string; n?: number }) {
  const sw = w / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${x + i * sw} ${y} h${sw} v9 q${-sw / 2} 5 ${-sw} 0 Z`} fill={i % 2 ? b : a} {...thin} />
      ))}
    </g>
  );
}

function Tree({ x, s = 1 }: { x: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${GROUND}) scale(${s})`}>
      <rect x={-2.5} y={-14} width={5} height={14} fill="#8a5a35" {...thin} />
      <circle cx={0} cy={-22} r={11} fill="#5cb85c" {...thin} />
    </g>
  );
}

/* ---- the buildings ---- */

function Home() {
  // 742 Evergreen Terrace: salmon walls, brown roof, garage on the right
  return (
    <g>
      <rect x={18} y={56} width={80} height={60} fill="#f2a46f" {...ink} />
      <path d="M10 60 L58 26 L106 60 Z" fill="#8a4b2b" {...ink} />
      <rect x={80} y={30} width={10} height={20} fill="#b9a89a" {...thin} />
      <Win x={28} y={68} w={18} h={16} />
      <Win x={70} y={68} w={18} h={16} />
      <Win x={50} y={36} w={16} h={14} />
      <Door x={50} w={16} h={28} fill="#7d5aa6" />
      <rect x={98} y={74} width={46} height={42} fill="#f2a46f" {...ink} />
      <path d="M94 78 L121 60 L148 78 Z" fill="#8a4b2b" {...ink} />
      <rect x={104} y={86} width={34} height={30} fill="#fbfaf4" {...thin} />
      {[94, 102, 110].map((y) => <path key={y} d={`M104 ${y} h34`} stroke={INK} strokeWidth={1.5} />)}
    </g>
  );
}

function FlandersHouse() {
  return (
    <g>
      <Tree x={20} s={0.9} />
      <rect x={36} y={58} width={88} height={58} fill="#a8d5a2" {...ink} />
      <path d="M28 62 L80 28 L132 62 Z" fill="#7a5aa6" {...ink} />
      <Win x={46} y={70} w={18} h={16} />
      <Win x={96} y={70} w={18} h={16} />
      <Door x={72} w={16} h={28} fill="#fbfaf4" />
      <path d="M140 116 v-16 M146 116 v-16 M152 116 v-16 M136 104 h20" stroke="#fbfaf4" strokeWidth={4} />
      <path d="M140 116 v-16 M146 116 v-16 M152 116 v-16 M136 104 h20" fill="none" {...thin} strokeWidth={1} />
    </g>
  );
}

function Employment() {
  return (
    <g>
      <rect x={22} y={34} width={116} height={82} fill="#d6e6f3" {...ink} />
      <rect x={16} y={28} width={128} height={10} fill="#4a8fd9" {...ink} />
      <path d="M128 28 V8" {...thin} />
      <path d="M128 9 h16 v10 h-16 Z" fill="#ef4b3c" {...thin} />
      <Sign x={30} y={44} w={100} text="EMPLOYMENT" bg="#2f6fd6" size={10} />
      {[32, 54, 90, 112].map((x) => <Win key={x} x={x} y={68} w={16} h={16} />)}
      <Awning x={60} y={86} w={40} a="#4a8fd9" b="#fbfaf4" n={4} />
      <Door x={70} w={20} h={20} fill="#9fdcf7" />
    </g>
  );
}

function University() {
  return (
    <g>
      <rect x={10} y={56} width={140} height={60} fill="#c4563e" {...ink} />
      <rect x={66} y={22} width={28} height={36} fill="#c4563e" {...ink} />
      <path d="M62 24 Q80 2 98 24 Z" fill="#5fb08a" {...ink} />
      <path d="M80 4 v-4" {...thin} />
      <circle cx={80} cy={38} r={9} fill="#fbfaf4" {...thin} />
      <path d="M80 38 v-6 M80 38 h4" {...thin} />
      <path d="M44 62 L80 46 L116 62 Z" fill="#fbfaf4" {...ink} />
      {[50, 64, 96, 110].map((x) => <rect key={x} x={x - 3} y={62} width={7} height={54} fill="#fbfaf4" {...thin} />)}
      <Door x={72} w={16} h={30} fill="#6b3f1f" />
      {[18, 132].map((x) => <Win key={x} x={x} y={70} w={12} h={18} />)}
      {[18, 132].map((x) => <Win key={x} x={x} y={94} w={12} h={14} />)}
    </g>
  );
}

function Krusty() {
  return (
    <g>
      <rect x={14} y={64} width={132} height={52} fill="#fbfaf4" {...ink} />
      <rect x={10} y={56} width={140} height={12} fill="#e0352b" {...ink} />
      <path d="M10 68 h140" stroke="#f6c443" strokeWidth={4} />
      <Win x={22} y={78} w={36} h={22} />
      <Win x={102} y={78} w={36} h={22} />
      <Door x={70} w={20} h={30} fill="#9fdcf7" />
      {/* Krusty's head on the roof */}
      <circle cx={80} cy={34} r={20} fill="#fbfaf4" {...ink} />
      <circle cx={60} cy={30} r={8} fill="#5fb85f" {...thin} />
      <circle cx={100} cy={30} r={8} fill="#5fb85f" {...thin} />
      <circle cx={73} cy={30} r={4.5} fill="#fff" {...thin} />
      <circle cx={87} cy={30} r={4.5} fill="#fff" {...thin} />
      <circle cx={73} cy={30} r={1.6} fill={INK} />
      <circle cx={87} cy={30} r={1.6} fill={INK} />
      <circle cx={80} cy={38} r={4} fill="#e0352b" {...thin} />
      <path d="M70 45 Q80 52 90 45" fill="none" stroke="#e0352b" strokeWidth={3} />
      <Sign x={30} y={54} w={100} h={14} text="KRUSTY BURGER" bg="#e0352b" fg="#f6c443" size={9.5} />
    </g>
  );
}

function TryNSave() {
  return (
    <g>
      <rect x={8} y={44} width={144} height={72} fill="#3b7ce0" {...ink} />
      <rect x={8} y={44} width={144} height={12} fill="#2a5fb5" {...ink} />
      <Sign x={26} y={60} w={108} h={18} text="TRY-N-SAVE" bg="#ef4b3c" fg="#fed90f" size={12} />
      <rect x={52} y={86} width={56} height={30} fill="#9fdcf7" {...thin} />
      <path d="M80 86 v30" {...thin} />
      <Win x={16} y={88} w={26} h={16} />
      <Win x={118} y={88} w={26} h={16} />
    </g>
  );
}

function Globex() {
  return (
    <g>
      <rect x={40} y={28} width={80} height={88} fill="#20b3a8" {...ink} />
      <rect x={52} y={14} width={56} height={16} fill="#20b3a8" {...ink} />
      {[38, 56, 74].map((y) => [50, 72, 94].map((x) => <rect key={`${x}${y}`} x={x} y={y} width={16} height={12} fill="#c7f1ee" {...thin} />))}
      <rect x={18} y={84} width={124} height={32} fill="#17958c" {...ink} />
      <Door x={70} w={20} h={24} fill="#c7f1ee" />
      <circle cx={34} cy={70} r={14} fill="#2f6fd6" {...ink} />
      <path d="M22 66 q12 6 24 0 M26 76 q8 4 16 0" stroke="#5fb85f" strokeWidth={3} fill="none" />
      <ellipse cx={34} cy={70} rx={20} ry={6} fill="none" stroke="#f2c14e" strokeWidth={3} transform="rotate(-20 34 70)" />
      <Sign x={96} y={92} w={40} h={13} text="GLOBEX" bg="#fbfaf4" fg="#17958c" size={8.5} />
    </g>
  );
}

function Aztec() {
  return (
    <g>
      <path d="M20 116 V50 h120 v66 Z" fill="#e08a1e" {...ink} />
      <path d="M34 50 v-10 h92 v10 M48 40 v-10 h64 v10 M62 30 v-8 h36 v8" fill="#c9701a" {...ink} />
      <rect x={28} y={60} width={104} height={20} fill="#fbfaf4" {...ink} />
      {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={34 + i * 8.4} cy={63.5} r={1.8} fill="#fed90f" />)}
      <text x={80} y={76} textAnchor="middle" fontSize={9} fill={INK} fontFamily='"Luckiest Guy", Impact, sans-serif'>DOUBLE FEATURE</text>
      <rect x={70} y={2} width={20} height={20} fill="#ef4b3c" {...thin} />
      <text x={80} y={16} textAnchor="middle" fontSize={8} fill="#fed90f" fontFamily='"Luckiest Guy", Impact, sans-serif'>AZTEC</text>
      <rect x={58} y={88} width={44} height={28} fill="#7a1f1f" {...thin} />
      <path d="M80 88 v28" {...thin} />
      <rect x={30} y={88} width={20} height={24} fill="#fed90f" {...thin} />
      <rect x={110} y={88} width={20} height={24} fill="#fed90f" {...thin} />
    </g>
  );
}

function Moes() {
  return (
    <g>
      <rect x={30} y={44} width={100} height={72} fill="#7a4b2a" {...ink} />
      {[56, 70, 84, 98].map((y) => <path key={y} d={`M30 ${y} h100`} stroke="#5e3920" strokeWidth={2} />)}
      <rect x={26} y={38} width={108} height={10} fill="#5e3920" {...ink} />
      <rect x={46} y={52} width={68} height={20} rx={5} fill="#2b2723" {...thin} />
      <text x={80} y={67} textAnchor="middle" fontSize={13} fill="#ff6fb5" fontFamily='"Luckiest Guy", Impact, sans-serif' style={{ filter: "drop-shadow(0 0 2px #ff6fb5)" }}>MOE'S</text>
      <Door x={70} w={20} h={32} fill="#3d2414" />
      <rect x={40} y={86} width={14} height={8} fill="#f6c443" {...thin} />
      <text x={47} y={92.5} textAnchor="middle" fontSize={5} fill={INK}>DUFF</text>
    </g>
  );
}

function Bowlarama() {
  return (
    <g>
      <rect x={14} y={60} width={132} height={56} fill="#f08cc0" {...ink} />
      <path d="M8 64 L80 46 L152 64 Z" fill="#21a6a0" {...ink} />
      <Sign x={34} y={68} w={92} h={15} text="BOWL-A-RAMA" bg="#21a6a0" size={10} />
      <Win x={22} y={90} w={30} h={18} />
      <Win x={108} y={90} w={30} h={18} />
      <Door x={70} w={20} h={26} fill="#9fdcf7" />
      {/* giant pin + ball on the roof */}
      <path d="M118 52 c-6 -10 -2 -18 0 -22 c-3 -4 -3 -10 2 -12 c5 2 5 8 2 12 c2 4 6 12 0 22 Z" fill="#fbfaf4" {...ink} />
      <path d="M117 26 h6" stroke="#ef4b3c" strokeWidth={3} />
      <circle cx={42} cy={44} r={11} fill="#2f3d8f" {...ink} />
      <circle cx={39} cy={40} r={1.8} fill="#fbfaf4" />
      <circle cx={44} cy={39} r={1.8} fill="#fbfaf4" />
    </g>
  );
}

function KwikEMart() {
  return (
    <g>
      <rect x={14} y={54} width={132} height={62} fill="#efe4c4" {...ink} />
      <rect x={10} y={44} width={140} height={14} fill="#2fa35a" {...ink} />
      <path d="M10 58 h140" stroke="#f08a24" strokeWidth={5} />
      <path d="M10 56 h140 M10 61 h140" stroke={INK} strokeWidth={1.5} />
      <Sign x={34} y={22} w={92} h={18} text="KWIK-E-MART" bg="#fbfaf4" fg="#2fa35a" size={11} />
      <path d="M50 40 v4 M110 40 v4" {...thin} />
      <Win x={22} y={70} w={40} h={24} />
      <Win x={98} y={70} w={40} h={24} />
      <Door x={68} w={24} h={36} fill="#9fdcf7" />
      <rect x={26} y={98} width={10} height={14} fill="#ef4b3c" {...thin} />
    </g>
  );
}

function LardLad() {
  return (
    <g>
      <rect x={18} y={62} width={124} height={54} fill="#ef6fae" {...ink} />
      <rect x={14} y={56} width={132} height={10} fill="#c94487" {...ink} />
      <Sign x={30} y={70} w={100} h={14} text="LARD LAD" bg="#fbfaf4" fg="#c94487" size={10} />
      <Win x={26} y={90} w={30} h={18} />
      <Win x={104} y={90} w={30} h={18} />
      <Door x={70} w={20} h={26} fill="#9fdcf7" />
      {/* the giant donut */}
      <circle cx={80} cy={32} r={24} fill="#d8a05a" {...ink} />
      <path d="M58 30 a22 22 0 0 1 44 0 q-4 8 -10 4 q-6 6 -12 0 q-6 6 -12 0 q-6 4 -10 -4 Z" fill="#f78fc4" {...thin} />
      <circle cx={80} cy={32} r={8} fill="#74c3f0" {...ink} />
      {[[66, 22, "#fed90f"], [74, 16, "#2f6fd6"], [90, 18, "#5fb85f"], [96, 26, "#fed90f"], [64, 30, "#ef4b3c"]].map(([x, y, c]) => (
        <rect key={`${x}${y}`} x={x as number} y={y as number} width={5} height={2} rx={1} fill={c as string} transform={`rotate(${(x as number) % 50} ${x} ${y})`} />
      ))}
    </g>
  );
}

function Plant() {
  const tower = (cx: number) => (
    <path d={`M${cx - 22} 116 C${cx - 14} 84 ${cx - 14} 66 ${cx - 18} 40 H${cx + 18} C${cx + 14} 66 ${cx + 14} 84 ${cx + 22} 116 Z`} fill="#c9c6bd" {...ink} />
  );
  return (
    <g>
      {tower(42)}
      {tower(92)}
      <path d="M26 46 h32 M76 46 h32" stroke="#a9a59a" strokeWidth={3} />
      {[[42, 30, 9], [36, 18, 7], [92, 30, 9], [98, 18, 7]].map(([x, y, r]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#f4f4ef" {...thin} />
      ))}
      <rect x={108} y={76} width={44} height={40} fill="#9aa0a8" {...ink} />
      <path d="M118 76 a12 12 0 0 1 24 0" fill="#7b8088" {...thin} />
      <Win x={114} y={88} w={12} h={10} fill="#b7f27a" />
      <Win x={134} y={88} w={12} h={10} fill="#b7f27a" />
      <circle cx={18} cy={110} r={4} fill="#9cff5a" stroke={INK} strokeWidth={1.5} />
    </g>
  );
}

function Bank() {
  return (
    <g>
      <rect x={20} y={58} width={120} height={58} fill="#3a9a66" {...ink} />
      <path d="M14 60 L80 30 L146 60 Z" fill="#fbfaf4" {...ink} />
      <circle cx={80} cy={48} r={7} fill="#fed90f" {...thin} />
      <text x={80} y={52} textAnchor="middle" fontSize={10} fill={INK} fontFamily='"Luckiest Guy", Impact, sans-serif'>$</text>
      <rect x={14} y={60} width={132} height={8} fill="#fbfaf4" {...ink} />
      {[30, 50, 110, 130].map((x) => <rect key={x} x={x - 4} y={68} width={9} height={48} fill="#fbfaf4" {...thin} />)}
      <Sign x={60} y={72} w={40} h={13} text="BANK" bg="#fbfaf4" fg="#2e8b57" size={9} />
      <Door x={68} w={24} h={26} fill="#6b3f1f" />
    </g>
  );
}

const ART: Record<LocationId | "flanders", () => JSX.Element> = {
  home: Home,
  employment: Employment,
  university: University,
  krusty: Krusty,
  trynsave: TryNSave,
  globex: Globex,
  aztec: Aztec,
  moes: Moes,
  bowlarama: Bowlarama,
  kwikemart: KwikEMart,
  lardlad: LardLad,
  plant: Plant,
  bank: Bank,
  flanders: FlandersHouse,
};

export function Facade({ id }: { id: LocationId | "flanders" }) {
  const Art = ART[id];
  return (
    <svg className="facade" viewBox="0 0 160 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <Art />
    </svg>
  );
}

/** The town square in the middle of the board: lawn, walkway, plaza and Jebediah. */
export function TownSquare() {
  const trees = [
    [40, 34], [92, 22], [208, 22], [260, 34], [30, 122], [270, 122], [70, 150], [230, 150],
  ];
  return (
    <svg className="square-art" viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={300} height={170} fill="#79c64e" />
      <ellipse cx={150} cy={88} rx={92} ry={58} fill="#efe2bd" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={150} cy={88} rx={70} ry={42} fill="none" stroke="#e1cf9f" strokeWidth={3} strokeDasharray="6 6" />
      {trees.map(([x, y]) => (
        <g key={`${x}${y}`}>
          <ellipse cx={x} cy={y + 12} rx={12} ry={4} fill="#000" opacity={0.15} />
          <rect x={x - 2.5} y={y} width={5} height={12} fill="#8a5a35" {...thin} />
          <circle cx={x} cy={y - 4} r={13} fill="#5cb85c" {...thin} />
          <path d={`M${x - 6} ${y - 9} a7 7 0 0 1 8 -3`} stroke="#8fe08a" strokeWidth={3} fill="none" />
        </g>
      ))}
    </svg>
  );
}
