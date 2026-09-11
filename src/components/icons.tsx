/**
 * The app's icon set — drawn, not glyphs.
 *
 * One family, one stroke weight (1.75), one 24-grid, `currentColor` throughout,
 * so an icon inherits whatever colour its control already uses and every icon
 * sits on the same optical weight. Unicode arrows and emoji were the previous
 * stand-in; they render differently on every platform and cannot be aligned to
 * a text baseline reliably.
 *
 * `title` makes an icon announce itself to a screen reader. Leave it off when
 * the icon sits beside a visible label or inside a button that already has an
 * `aria-label` — otherwise the name is read twice.
 */
type IconProps = {
  size?: number;
  className?: string;
  /** Per-instance colour, for an accent that varies at runtime (a pillar's own
   *  hue). Prefer `className` when the colour is fixed. */
  style?: React.CSSProperties;
  /** Accessible name. Omit when the parent control is already labelled. */
  title?: string;
};

function Svg({ size = 18, className, style, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>
);

export const Plus = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const Trash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12" />
    <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
  </Svg>
);

export const Share = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v13" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" />
  </Svg>
);

/** Filled when pinned, outline when not — the fill is the state. */
export const Pin = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" fill={filled ? "currentColor" : "none"} />
    <path d="M12 13v7" />
  </Svg>
);

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);

export const MeetingIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0111 0" />
    <path d="M16 7.5a2.75 2.75 0 010 5.5M17.5 19a5.4 5.4 0 00-2-4.2" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Svg>
);

export const Back = (p: IconProps) => (
  <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
);

export const Play = (p: IconProps) => (
  <Svg {...p}><path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" /></Svg>
);

export const Pause = (p: IconProps) => (
  <Svg {...p}><path d="M9.5 5v14M14.5 5v14" /></Svg>
);

/** A microphone, for the record control. */
export const Mic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
  </Svg>
);

export const Close = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
);

export const Menu = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);

export const People = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3 19a6 6 0 0112 0" />
    <path d="M16.5 6.5a3.25 3.25 0 010 6.5M18 19a5.9 5.9 0 00-2.2-4.6" />
  </Svg>
);

export const Mail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </Svg>
);

/** An inbound task someone assigned to you. */
export const Inbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    <path d="M5 5h14l2 8v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" />
  </Svg>
);
