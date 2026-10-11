/* Engraved cameo-style character medallions — a non-emoji, CK3-flavored avatar. */

interface Face {
  bg: string;
  hat?: boolean;
  beard?: boolean;
  long?: boolean;
  hood?: boolean;
}

const FACES: Record<string, Face> = {
  p0: { bg: "#5f6d7e" },
  p1: { bg: "#7a5c8c", hat: true },
  p2: { bg: "#8a6a44", beard: true },
  p3: { bg: "#3f7a6b", long: true },
  p4: { bg: "#8c5346", hat: true, beard: true },
  p5: { bg: "#566b8c" },
  p6: { bg: "#6b7d46", long: true },
  p7: { bg: "#8a6d3a", hood: true },
};

export const AVATAR_IDS = Object.keys(FACES);
export const DEFAULT_AVATAR = "p0";
export const isAvatarId = (v: string) => v in FACES;

function Shapes({ f }: { f: Face }) {
  return (
    <g fill="#ece0c4">
      {/* shoulders */}
      <path d="M7 48 C7 33 16 29 24 29 C32 29 41 33 41 48 Z" />
      {/* hair behind head */}
      {f.long && (
        <>
          <path d="M15 15 C11 19 11 32 14.5 36 L18.5 31 C16 25 16 19 18 15.5 Z" />
          <path d="M33 15 C37 19 37 32 33.5 36 L29.5 31 C32 25 32 19 30 15.5 Z" />
        </>
      )}
      {f.hood && <path d="M11 22 C11 7 37 7 37 22 L33 22 C33 12 15 12 15 22 Z" />}
      {/* head */}
      <circle cx="24" cy="19" r="9" />
      {/* short hair cap */}
      {!f.hat && !f.hood && !f.long && (
        <path d="M15.5 18 C15 9 33 9 32.5 18 C30 13.5 18 13.5 15.5 18 Z" />
      )}
      {f.long && <path d="M15.5 17 C15 9.5 33 9.5 32.5 17 C30 14 18 14 15.5 17 Z" />}
      {/* beard */}
      {f.beard && (
        <path d="M16 20 C16 30 32 30 32 20 C31 25.5 29 28 24 28 C19 28 17 25.5 16 20 Z" />
      )}
      {/* hat */}
      {f.hat && (
        <>
          <path d="M13 12.5 C13 10.8 35 10.8 35 12.5 C35 14.2 13 14.2 13 12.5 Z" />
          <path d="M17.5 12.5 L18 6 C18 5 30 5 30 6 L30.5 12.5 Z" />
        </>
      )}
    </g>
  );
}

export function Portrait({ id, size = 48 }: { id: string; size?: number }) {
  const f = FACES[id] ?? FACES[DEFAULT_AVATAR];
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block" }} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill={f.bg} />
      <circle cx="24" cy="24" r="24" fill="url(#portraitShade)" />
      <Shapes f={f} />
    </svg>
  );
}

/** One-time gradient defs for portraits (include once near the app root). */
export function PortraitDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <radialGradient id="portraitShade" cx="0.5" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </radialGradient>
      </defs>
    </svg>
  );
}
