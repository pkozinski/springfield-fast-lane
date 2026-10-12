import type { Location } from "../game/types";

/** A small, cohesive line-icon set drawn in currentColor. */
const PATHS: Record<string, JSX.Element> = {
  home: (
    <>
      <path d="M4 11 11 4 18 11" />
      <path d="M6 10v9h9v-9" />
      <path d="M9.5 19v-4h3v4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="11.5" rx="1.5" />
      <path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5" />
      <path d="M3 12.5h18" />
    </>
  ),
  book: (
    <>
      <path d="M12 6C9.5 4.3 6 4.3 3.5 5.3V18c2.5-1 6-1 8.5.7 2.5-1.7 6-1.7 8.5-.7V5.3C18 4.3 14.5 4.3 12 6Z" />
      <path d="M12 6v12" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9 12 4l8.5 5" />
      <path d="M4.5 9h15" />
      <path d="M6.5 10v7M10 10v7M14 10v7M17.5 10v7" />
      <path d="M3.5 19.5h17" />
    </>
  ),
  factory: (
    <>
      <path d="M3 20v-8l5 3v-3l5 3v-3l5 3v5Z" />
      <path d="M18 15V5h2.5v10" />
      <path d="M3 20h18" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2 11h11l2-8H6.5" />
      <circle cx="9" cy="19" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  food: (
    <>
      <path d="M7 3v8M5 3v4M9 3v4M7 11v10" />
      <path d="M15 3c2.5 1.5 2.5 6 0 7.5V21" />
    </>
  ),
  cup: (
    <>
      <path d="M5 8h12v4c0 3.3-2.7 6-6 6s-6-2.7-6-6Z" />
      <path d="M17 9c2.2 0 2.2 5 0 5" />
      <path d="M8 2.5c-.6 1 .6 1.5 0 2.5M12 2.5c-.6 1 .6 1.5 0 2.5" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M4 9v6M6.5 6.5v11M17.5 6.5v11M20 9v6" />
      <path d="M6.5 12h11" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="9" width="18" height="11" rx="1" />
      <path d="M3 9 5 5l3.5 1.6L12 5l3.5 1.6L19 5l2 4" />
      <path d="M8 9v11M16 9v11" />
    </>
  ),
  music: (
    <>
      <circle cx="8" cy="18" r="2.4" />
      <circle cx="17" cy="16" r="2.4" />
      <path d="M10.4 18V7l9-2v11" />
      <path d="M10.4 9 19.4 7" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="5" width="18" height="11" rx="1.2" />
      <path d="M9 19h6M10 16v3M14 16v3" />
    </>
  ),
  shirt: (
    <path d="M8 4 4.5 6.5 3 9.5l3 1.8L7 10v10h10V10l1 1.3 3-1.8L18.5 6.5 15 4c-.7 1.6-6.3 1.6-7 0Z" />
  ),
  car: (
    <>
      <path d="M3 15.5 5 10h11l4 4.5h1v3H3Z" />
      <circle cx="7" cy="17.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17.5" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 11V9.5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5V11" />
      <path d="M3.5 11A1.8 1.8 0 0 0 3 14.5V18h18v-3.5a1.8 1.8 0 0 0-.5-3.5Z" />
      <path d="M6 18v2M18 18v2" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M9.6 9.8c0-1.1 1.3-1.6 2.4-1.6s2.4.4 2.4 1.5c0 2.1-4.8.9-4.8 3 0 1.1 1.3 1.6 2.4 1.6s2.4-.5 2.4-1.5" />
    </>
  ),
  bills: (
    <>
      <path d="M3 6h14v8H3Z" />
      <circle cx="10" cy="10" r="2" />
      <path d="M20 10v9M16.5 15.5 20 19l3.5-3.5" />
    </>
  ),
  wealth: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="2.5" />
      <path d="M5 7v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7" />
      <path d="M5 11v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
    </>
  ),
  career: (
    <>
      <path d="M4 20h16" />
      <rect x="5" y="14" width="3.2" height="6" fill="currentColor" stroke="none" />
      <rect x="10.4" y="10" width="3.2" height="10" fill="currentColor" stroke="none" />
      <rect x="15.8" y="6" width="3.2" height="14" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 10-13h-8l1-7Z" fill="currentColor" stroke="none" />,
  star: (
    <path
      d="M12 3 14.7 9.1 21 9.7 16.2 14 17.6 20.3 12 16.9 6.4 20.3 7.8 14 3 9.7 9.3 9.1Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  moon: <path d="M15.5 3A9 9 0 1 0 21 14.5 7 7 0 0 1 15.5 3Z" />,
  donut: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M7.5 8.5l1 .8M15.5 7.2l-.6 1.1M17 13.5l-1.1.3M9 16.2l.8-.9M13.2 17l-.2-1.1" />
    </>
  ),
  pin: (
    <>
      <path d="M12 3c-1.6 0-2.2 1.4-2 3 .2 1.2.9 1.8.9 2.6-.1 1.3-2.4 3.4-2.4 6.6 0 3 1.6 5.8 3.5 5.8s3.5-2.8 3.5-5.8c0-3.2-2.3-5.3-2.4-6.6 0-.8.7-1.4.9-2.6.2-1.6-.4-3-2-3Z" />
      <path d="M10.3 10h3.4" />
    </>
  ),
  mug: (
    <>
      <path d="M5 7h10v12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19.5Z" />
      <path d="M15 10h2.2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15" />
      <path d="M5 7c0-2.5 2-3 3.4-2.2C9.6 3.4 13 3.6 13.6 5.4 15 5 16 6 15 7" />
    </>
  ),
  atom: (
    <>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.2-3.6-8.5s1-6.1 3.6-8.5Z" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

const LOCATION_ICON: Record<string, IconName> = {
  home: "home",
  employment: "briefcase",
  university: "book",
  bank: "bank",
  plant: "atom",
  krusty: "food",
  lardlad: "donut",
  trynsave: "cart",
  globex: "globe",
  kwikemart: "cart",
  bowlarama: "pin",
  aztec: "film",
  moes: "mug",
};

export function locationIcon(loc: Location): IconName {
  return LOCATION_ICON[loc.id] ?? "home";
}

export function itemIcon(category: string): IconName {
  switch (category) {
    case "wardrobe":
      return "shirt";
    case "tech":
      return "monitor";
    case "vehicle":
      return "car";
    case "comfort":
    default:
      return "sofa";
  }
}

export function leisureIcon(id: string): IconName {
  if (id === "bowling") return "pin";
  if (id === "night-out" || id === "flaming") return "mug";
  return "film";
}
