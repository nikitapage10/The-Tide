/**
 * Small effects that play at a callout's point while it is shown, chosen by
 * what the callout names (ripples for the Drowning, a radar sweep for a scan,
 * and so on). Thin, faint SVG lines in the site's style; decorative only.
 * Not rendered under reduced motion (see .callout-fx in globals.css).
 */

export type FxKind =
  | "lightning"
  | "ripple"
  | "split"
  | "drift"
  | "sink"
  | "veil"
  | "bloom"
  | "brackets"
  | "isobars"
  | "flicker"
  | "tideline"
  | "grid"
  | "stream"
  | "glint"
  | "orbit"
  | "wave"
  | "echo"
  | "cold"
  | "arc"
  | "scan";

const S = { fill: "none", stroke: "rgba(255,255,255,0.5)", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };
const DOT = { fill: "rgba(255,255,255,0.7)" };

function Body({ kind }: { kind: FxKind }) {
  switch (kind) {
    case "lightning":
      // Brief, irregular flashes of a forked bolt.
      return (
        <g>
          <polyline points="-6,-30 2,-10 -5,-6 6,16 0,18 8,34" {...S} stroke="rgba(235,242,255,0.85)">
            <animate attributeName="opacity" values="0;0;1;0.1;0.9;0;0;0" keyTimes="0;0.55;0.57;0.6;0.62;0.66;0.9;1" dur="2.6s" repeatCount="indefinite" />
          </polyline>
          <polyline points="-5,-6 -16,6 -14,14" {...S} stroke="rgba(235,242,255,0.6)">
            <animate attributeName="opacity" values="0;0;0.8;0;0" keyTimes="0;0.6;0.62;0.66;1" dur="2.6s" repeatCount="indefinite" />
          </polyline>
        </g>
      );
    case "ripple":
      // Rings spreading outward, as on water.
      return (
        <g>
          {[0, 0.9, 1.8].map((b) => (
            <circle key={b} r="4" {...S}>
              <animate attributeName="r" values="3;38" dur="2.7s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.7s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      );
    case "split":
      // One arc parting into two.
      return (
        <g>
          <path d="M-14 -16 A 18 18 0 0 0 -14 16" {...S}>
            <animateTransform attributeName="transform" type="translate" values="6 0;-8 0;6 0" dur="4s" repeatCount="indefinite" />
          </path>
          <path d="M14 -16 A 18 18 0 0 1 14 16" {...S}>
            <animateTransform attributeName="transform" type="translate" values="-6 0;8 0;-6 0" dur="4s" repeatCount="indefinite" />
          </path>
        </g>
      );
    case "drift":
      // Motes drifting past, one way.
      return (
        <g>
          {[-14, -4, 8, 16].map((y, i) => (
            <circle key={y} cy={y} r="1.2" {...DOT}>
              <animate attributeName="cx" values="-34;34" dur={`${3.2 + i * 0.7}s`} begin={`${i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.8;0" dur={`${3.2 + i * 0.7}s`} begin={`${i * 0.6}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      );
    case "sink":
      // Rings drawing inward: something pulling down.
      return (
        <g>
          {[0, 1, 2].map((b) => (
            <circle key={b} r="30" {...S}>
              <animate attributeName="r" values="34;2" dur="3s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.7;0" dur="3s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      );
    case "veil":
      // A thin band of haze passing slowly down across the point.
      return (
        <g>
          {[0, 1.6].map((b) => (
            <line key={b} x1="-30" x2="30" y1="0" y2="0" {...S} strokeWidth={1}>
              <animate attributeName="y1" values="-26;26" dur="3.2s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="y2" values="-26;26" dur="3.2s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.6;0" dur="3.2s" begin={`${b}s`} repeatCount="indefinite" />
            </line>
          ))}
        </g>
      );
    case "bloom":
      // Six petals opening and turning slowly.
      return (
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0;60" dur="9s" repeatCount="indefinite" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx="0" cy="-11" rx="4" ry="10" transform={`rotate(${a})`} {...S}>
              <animate attributeName="ry" values="2;10;2" dur="4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4s" repeatCount="indefinite" />
            </ellipse>
          ))}
        </g>
      );
    case "brackets":
      // Corner brackets closing in on the point, as if locking on.
      return (
        <g>
          {[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([sx, sy]) => (
            <path key={`${sx}${sy}`} d={`M${sx! * 14} ${sy! * 8} L${sx! * 14} ${sy! * 14} L${sx! * 8} ${sy! * 14}`} {...S}>
              <animateTransform attributeName="transform" type="translate" values={`${sx! * 14} ${sy! * 14};0 0;0 0;${sx! * 14} ${sy! * 14}`} keyTimes="0;0.3;0.8;1" dur="3.4s" repeatCount="indefinite" />
            </path>
          ))}
        </g>
      );
    case "isobars":
      // Pressure lines: nested ovals, turning.
      return (
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0;360" dur="24s" repeatCount="indefinite" />
          {[10, 18, 26].map((r, i) => (
            <ellipse key={r} rx={r} ry={r * 0.7} {...S} opacity={0.6 - i * 0.15}>
              <animate attributeName="ry" values={`${r * 0.7};${r * 0.82};${r * 0.7}`} dur={`${3 + i}s`} repeatCount="indefinite" />
            </ellipse>
          ))}
        </g>
      );
    case "flicker":
      // Points of light going out and coming back, unevenly.
      return (
        <g>
          {[
            [-12, -6, 1.7],
            [-3, 5, 2.3],
            [8, -10, 1.3],
            [13, 6, 2.9],
            [-8, 13, 1.9],
          ].map(([x, y, d]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" {...DOT}>
              <animate attributeName="opacity" values="0.9;0.1;0.9;0.9;0;0.8" dur={`${d}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      );
    case "tideline":
      // A shoreline rising and falling.
      return (
        <path d="M-32 0 Q -16 -6 0 0 T 32 0" {...S}>
          <animateTransform attributeName="transform" type="translate" values="0 8;0 -8;0 8" dur="4.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="4.6s" repeatCount="indefinite" />
        </path>
      );
    case "grid":
      // A survey grid (meridians on a small globe), turning.
      return (
        <g opacity="0.7">
          <circle r="20" {...S} />
          <line x1="-20" x2="20" {...S} />
          {[6, 12].map((ry) => (
            <ellipse key={ry} rx="20" ry={ry} {...S} opacity="0.6" />
          ))}
          <ellipse ry="20" rx="10" {...S}>
            <animate attributeName="rx" values="20;0.5;20" dur="5s" repeatCount="indefinite" />
          </ellipse>
        </g>
      );
    case "stream":
      // A curving stream, flowing (dashes travelling along it).
      return (
        <path d="M-34 10 C -14 -16, 12 22, 34 -8" {...S} strokeDasharray="3 5">
          <animate attributeName="stroke-dashoffset" values="0;-32" dur="1.6s" repeatCount="indefinite" />
        </path>
      );
    case "glint":
      // A four-pointed glint, catching the light.
      return (
        <g>
          <animateTransform attributeName="transform" type="scale" values="0.2;1;0.2;0.2" keyTimes="0;0.25;0.5;1" dur="3s" repeatCount="indefinite" />
          <path d="M0 -16 L1.5 -1.5 L16 0 L1.5 1.5 L0 16 L-1.5 1.5 L-16 0 L-1.5 -1.5 Z" fill="rgba(235,242,255,0.6)" />
        </g>
      );
    case "orbit":
      // Two motes on a tilted orbit.
      return (
        <g>
          <ellipse rx="22" ry="7" {...S} opacity="0.35" />
          {[0, 1.6].map((b) => (
            <circle key={b} r="1.6" {...DOT}>
              <animateMotion path="M22 0 A22 7 0 1 1 -22 0 A22 7 0 1 1 22 0" dur="4.8s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      );
    case "wave":
      // A faint carrier wave, scrolling.
      return (
        <g>
          <clipPath id="fx-wave-clip">
            <rect x="-30" y="-12" width="60" height="24" />
          </clipPath>
          <path d="M-60 0 q 7.5 -9 15 0 t 15 0 t 15 0 t 15 0 t 15 0 t 15 0 t 15 0 t 15 0" {...S} clipPath="url(#fx-wave-clip)">
            <animateTransform attributeName="transform" type="translate" values="0 0;30 0" dur="1.8s" repeatCount="indefinite" />
          </path>
        </g>
      );
    case "echo":
      // The same small outline, returning late and fainter.
      return (
        <g>
          {[0, 0.5, 1].map((b, i) => (
            <rect key={b} x="-6" y="-6" width="12" height="12" transform="rotate(45)" {...S}>
              <animateTransform attributeName="transform" type="translate" values="0 0;24 0" dur="2.4s" begin={`${b}s`} repeatCount="indefinite" additive="sum" />
              <animate attributeName="opacity" values={`${0.7 - i * 0.15};0`} dur="2.4s" begin={`${b}s`} repeatCount="indefinite" />
            </rect>
          ))}
        </g>
      );
    case "cold":
      // A cold point: a small crystal of spokes, breathing.
      return (
        <g>
          <animateTransform attributeName="transform" type="scale" values="0.85;1.1;0.85" dur="3.6s" repeatCount="indefinite" />
          {[0, 60, 120].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <line x1="-14" x2="14" {...S} />
              <line x1="9" y1="-3" x2="12" y2="0" {...S} />
              <line x1="-9" y1="-3" x2="-12" y2="0" {...S} />
            </g>
          ))}
        </g>
      );
    case "arc":
      // A fragment of an Einstein ring sliding round.
      return (
        <g>
          <circle r="18" {...S} opacity="0.15" />
          <path d="M18 0 A 18 18 0 0 1 0 18" {...S} stroke="rgba(235,242,255,0.75)">
            <animateTransform attributeName="transform" type="rotate" values="0;360" dur="6s" repeatCount="indefinite" />
          </path>
        </g>
      );
    case "scan":
      // A radar sweep with a fading trail.
      return (
        <g>
          <circle r="26" {...S} opacity="0.25" />
          <g>
            <animateTransform attributeName="transform" type="rotate" values="0;360" dur="3.2s" repeatCount="indefinite" />
            <line x1="0" y1="0" x2="26" y2="0" {...S} stroke="rgba(235,242,255,0.7)" />
            <path d="M0 0 L26 0 A 26 26 0 0 0 22.5 -13 Z" fill="rgba(235,242,255,0.12)" />
          </g>
        </g>
      );
  }
}

export function CalloutFx({ kind, on }: { kind?: FxKind; on: boolean }) {
  if (!kind) return null;
  return (
    <svg aria-hidden="true" className={`callout-fx ${on ? "callout-fx-on" : ""}`} width="100" height="100" viewBox="-50 -50 100 100" overflow="visible">
      {on ? <Body kind={kind} /> : null}
    </svg>
  );
}
