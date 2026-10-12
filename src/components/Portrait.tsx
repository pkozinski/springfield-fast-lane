/* Yellow cartoon townsfolk portraits, drawn as small SVGs (no image assets). */

const INK = "#1d1a17";
const SKIN = "#fed90f";

type Hair = "bald" | "beehive" | "spikes" | "star" | "blueCap" | "wavy" | "curly" | "sidePart";

interface Face {
  name: string;
  bg: string;
  shirt: string;
  hair: Hair;
  hairColor?: string;
  stubble?: boolean;
  glasses?: boolean;
  mustache?: boolean;
  pearls?: boolean;
  collar?: string;
}

const FACES: Record<string, Face> = {
  p0: { name: "Dad", bg: "#7cc4f2", shirt: "#f6f6f2", hair: "bald", stubble: true },
  p1: { name: "Mom", bg: "#f6a5c0", shirt: "#45a84e", hair: "beehive", hairColor: "#2f63d6", pearls: true },
  p2: { name: "Troublemaker", bg: "#ffb347", shirt: "#e8562a", hair: "spikes" },
  p3: { name: "Brainiac", bg: "#b8e07a", shirt: "#e8432a", hair: "star" },
  p4: { name: "Best Friend", bg: "#f4e27a", shirt: "#d8433a", hair: "blueCap", hairColor: "#2e5bd6", glasses: true },
  p5: { name: "Bartender", bg: "#9fb3c8", shirt: "#5d708f", hair: "wavy", hairColor: "#55524d" },
  p6: { name: "Aunt", bg: "#c9b6e8", shirt: "#8fa3c7", hair: "curly", hairColor: "#9c8fc0" },
  p7: { name: "Neighbor", bg: "#8fd6c3", shirt: "#7a6bb5", hair: "sidePart", hairColor: "#6b3f1f" },
};

/** Ned Flanders: the rival's face (not selectable by the player). */
export const RIVAL_FACE: Face = {
  name: "Ned Flanders",
  bg: "#bfe3a0",
  shirt: "#3f9142",
  hair: "sidePart",
  hairColor: "#7a4a22",
  glasses: true,
  mustache: true,
  collar: "#f4a7c4",
};

export const AVATAR_IDS = Object.keys(FACES);
export const DEFAULT_AVATAR = "p0";
export const isAvatarId = (v: string) => v in FACES;
export const avatarName = (id: string) => (FACES[id] ?? FACES[DEFAULT_AVATAR]).name;
export const avatarShirt = (id: string) => (FACES[id] ?? FACES[DEFAULT_AVATAR]).shirt;

const line = { stroke: INK, strokeWidth: 1.3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Hair that sits on top of the head. Spiky styles are skin-coloured and need the seam hidden. */
function HairTop({ f }: { f: Face }) {
  const c = f.hairColor ?? "#5a3a1e";
  switch (f.hair) {
    case "bald":
      return (
        <g fill="none" {...line}>
          <path d="M22 9.2C21.6 5.2 24.8 4.8 25 8.6" />
          <path d="M25.6 8.8C26 4.4 29.2 4.6 29 8.8" />
          <path d="M15.4 19l1.4-2.2 1.4 2.2 1.4-2.2" />
        </g>
      );
    case "beehive":
      return <ellipse cx="24.5" cy="-3" rx="10.5" ry="16.5" fill={c} {...line} />;
    case "spikes":
      return (
        <>
          <path d="M15 15.5 15.4 6.5 18.5 10 20 4.5 22.8 9 24.5 3.5 27 9 29 4.5 30.8 10 33.4 6.5 33 15.5Z" fill={SKIN} {...line} />
          <rect x="15.7" y="11" width="16.6" height="5.5" fill={SKIN} />
        </>
      );
    case "star":
      return (
        <>
          <path d="M14.6 16.5 9 11.5 15.8 10.6 15.4 4 21 8 24 1.5 27 8 32.6 4 32.2 10.6 39 11.5 33.4 16.5Z" fill={SKIN} {...line} />
          <rect x="15.7" y="10" width="16.6" height="7" fill={SKIN} />
        </>
      );
    case "blueCap":
      return <path d="M14.6 17C13.2 8.4 19.6 6 25 6.4c6 0 9.4 2.6 8.5 9.8-3.6-4-11.4-4.8-18.9.8Z" fill={c} {...line} />;
    case "wavy":
      return (
        <path
          d="M14.8 15.6C13.8 8.6 17.6 7 19.8 8.6c1.2-2.6 5-2.8 6.2-.6 2-2 5.8-1 7 1.8.7 1.8.6 3.8.3 5.6-3.4-3.6-14.2-3.8-18.5.2Z"
          fill={c}
          {...line}
        />
      );
    case "curly":
      return (
        <g fill={c} {...line}>
          <circle cx="16.5" cy="12" r="4" />
          <circle cx="21.5" cy="8.4" r="4.2" />
          <circle cx="27" cy="8.2" r="4.2" />
          <circle cx="31.6" cy="11.6" r="4" />
        </g>
      );
    case "sidePart":
      return (
        <path
          d="M14.6 17.4C13.4 8.4 20 6.4 26 6.8c6 .4 8 3.2 7.4 8.4-2.4-3-6.4-3.8-11.4-3-3.2.6-5.8 2.2-7.4 5.2Z"
          fill={c}
          {...line}
        />
      );
  }
}

function FaceArt({ f }: { f: Face }) {
  const hairBehind = f.hair === "beehive";
  return (
    <g clipPath="url(#portraitClip)">
      <circle cx="24" cy="24" r="24" fill={f.bg} />
      <circle cx="24" cy="24" r="24" fill="url(#portraitSun)" />

      {/* shoulders + collar */}
      <path d="M4 50C5 40 13 37 24 37s19 3 20 13Z" fill={f.shirt} {...line} />
      {f.collar && <path d="M20 37.2 24 42.5l4-5.3Z" fill={f.collar} {...line} />}
      {f.pearls &&
        [17, 20.5, 24, 27.5, 31].map((x, i) => (
          <circle key={x} cx={x} cy={38.6 + (i === 2 ? 1.4 : i % 4 === 0 ? 0 : 0.9)} r="1.5" fill="#e23b3b" stroke={INK} strokeWidth="0.7" />
        ))}

      {/* neck + tall cartoon head */}
      <rect x="19.2" y="30" width="9.6" height="8" fill={SKIN} {...line} />
      {hairBehind && <HairTop f={f} />}
      <rect x="15" y="8" width="18" height="27.5" rx="8.6" fill={SKIN} {...line} />
      {!hairBehind && <HairTop f={f} />}

      {/* ear */}
      <circle cx="15.6" cy="24.4" r="2.6" fill={SKIN} {...line} />
      <path d="M15.4 23.4c.9.4.9 1.6 0 2" fill="none" {...line} strokeWidth={0.9} />

      {/* stubble muzzle */}
      {f.stubble && <path d="M19 27c0 7.4 14 9 15.6 1-3.6 2-9.6 3-15.6-1Z" fill="#d4b47a" {...line} />}

      {/* big round eyes */}
      <circle cx="23" cy="19.2" r="4.3" fill="#fff" {...line} />
      <circle cx="30.6" cy="19.2" r="4.3" fill="#fff" {...line} />
      <circle cx="23.9" cy="19.8" r="1.15" fill={INK} />
      <circle cx="31.4" cy="19.8" r="1.15" fill={INK} />
      {f.glasses && (
        <g fill="none" stroke={INK} strokeWidth="1.7">
          <circle cx="23" cy="19.2" r="5.1" />
          <circle cx="30.6" cy="19.2" r="5.1" />
        </g>
      )}

      {/* nose + mouth */}
      <path d="M28.2 22.6c5.4-.6 6.8 1 6.4 2.4-.4 1.5-3.4 1.4-6.4.9" fill={SKIN} {...line} />
      {f.mustache ? (
        <path d="M25.6 27.6c2-1.6 6.6-1.8 8.8 0-2.2 1.4-6.6 1.6-8.8 0Z" fill={f.hairColor} {...line} />
      ) : (
        <path d="M22 29.8c3 3.4 7.4 3.2 10-.6" fill="none" {...line} />
      )}
    </g>
  );
}

export function Portrait({ id, size = 48 }: { id: string; size?: number }) {
  const f = FACES[id] ?? FACES[DEFAULT_AVATAR];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block" }} aria-label={f.name} role="img">
      <FaceArt f={f} />
    </svg>
  );
}

export function RivalPortrait({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block" }} aria-label={RIVAL_FACE.name} role="img">
      <FaceArt f={RIVAL_FACE} />
    </svg>
  );
}

/** One-time defs for portraits (include once near the app root). */
export function PortraitDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <clipPath id="portraitClip">
          <circle cx="24" cy="24" r="24" />
        </clipPath>
        <radialGradient id="portraitSun" cx="0.35" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
