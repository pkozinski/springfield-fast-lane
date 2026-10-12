/* An analog week-clock, à la Jones in the Fast Lane — the hand sweeps a full
   turn as the week's hours are spent. */
export default function Clock({
  hours,
  total,
  size = 62,
}: {
  hours: number;
  total: number;
  size?: number;
}) {
  const frac = Math.max(0, Math.min(1, (total - hours) / total)); // 0 = fresh week, 1 = spent
  const low = hours / total <= 0.2;
  const cx = 32;
  const cy = 32;
  const R = 24;

  const ang = frac * 2 * Math.PI;
  const hx = cx + (R - 5) * Math.sin(ang);
  const hy = cy - (R - 5) * Math.cos(ang);

  // remaining-time arc, from the hand back to 12 o'clock
  const remFrac = 1 - frac;
  const startAng = ang;
  const endAng = 2 * Math.PI - 1e-4;
  const arcR = R - 2;
  const ax0 = cx + arcR * Math.sin(startAng);
  const ay0 = cy - arcR * Math.cos(startAng);
  const ax1 = cx + arcR * Math.sin(endAng);
  const ay1 = cy - arcR * Math.cos(endAng);
  const largeArc = remFrac > 0.5 ? 1 : 0;

  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * Math.PI;
    const major = i % 3 === 0;
    const r1 = R - (major ? 5 : 3);
    ticks.push(
      <line
        key={i}
        x1={cx + r1 * Math.sin(a)}
        y1={cy - r1 * Math.cos(a)}
        x2={cx + R * Math.sin(a)}
        y2={cy - R * Math.cos(a)}
        stroke="#1d1a17"
        strokeWidth={major ? 2 : 1.1}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* case */}
      <circle cx={cx} cy={cy} r={R + 5} fill="#fed90f" stroke="#1d1a17" strokeWidth="2.5" />
      {/* face */}
      <circle cx={cx} cy={cy} r={R} fill="#fffdf3" stroke="#1d1a17" strokeWidth="1.5" />
      {remFrac > 0.001 && (
        <path
          d={`M ${ax0} ${ay0} A ${arcR} ${arcR} 0 ${largeArc} 1 ${ax1} ${ay1}`}
          fill="none"
          stroke={low ? "#ef4b3c" : "#7cc4f2"}
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      {ticks}
      {/* hand */}
      <line
        x1={cx}
        y1={cy}
        x2={hx}
        y2={hy}
        stroke={low ? "#d62f22" : "#1d1a17"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3" fill="#ef4b3c" stroke="#1d1a17" strokeWidth="1.2" />
    </svg>
  );
}
