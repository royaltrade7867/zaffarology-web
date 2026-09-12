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

/* ------------------------------ brand marks ------------------------------ */

/**
 * Social logos are FILLED marks on their own geometry, not members of the
 * stroked 24-grid family above — a brand mark redrawn at 1.75 stroke stops
 * being recognisable, which is the only thing it has to be. They keep
 * `currentColor` so they still inherit the control's colour.
 *
 * Drawn here rather than pulled from a CDN: the app's CSP allows no external
 * stylesheets or images, so an icon font or a remote SVG sprite would fail
 * silently and leave empty buttons.
 */
function Brand({ size = 18, className, style, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
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

export const Globe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
  </Svg>
);

export const Instagram = (p: IconProps) => (
  <Brand {...p}>
    <path d="M12 2.2c3.2 0 3.6 0 4.8.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.83.92 1.4.17.42.37 1.05.42 2.2.06 1.2.07 1.6.07 4.8s0 3.6-.07 4.8c-.05 1.2-.25 1.8-.42 2.2-.22.6-.5 1-.92 1.4-.42.43-.83.7-1.4.92-.42.17-1.05.37-2.2.42-1.2.06-1.6.07-4.8.07s-3.6 0-4.8-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.5-1.4-.92-.43-.42-.7-.83-.92-1.4-.17-.42-.37-1.05-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.8c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .92-1.4.42-.43.83-.7 1.4-.92.42-.17 1.05-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.3.83-.4.4-.64.8-.84 1.3-.15.4-.34 1-.39 2.1C2.6 9.9 2.6 10.3 2.6 12s0 2.1.07 3.3c.05 1.1.24 1.7.39 2.1.2.5.44.9.84 1.3.4.4.8.64 1.3.84.4.15 1 .34 2.1.39 1.2.06 1.6.07 4.7.07s3.5 0 4.7-.07c1.1-.05 1.7-.24 2.1-.39.5-.2.9-.44 1.3-.84.4-.4.64-.8.84-1.3.15-.4.34-1 .39-2.1.06-1.2.07-1.6.07-3.3s0-2.1-.07-3.3c-.05-1.1-.24-1.7-.39-2.1-.2-.5-.44-.9-.84-1.3-.4-.4-.8-.64-1.3-.83-.4-.16-1-.35-2.1-.4C15.5 4 15.1 4 12 4Z" />
    <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.25a3.25 3.25 0 1 1 0-6.5 3.25 3.25 0 0 1 0 6.5Z" />
    <circle cx="17.2" cy="6.8" r="1.2" />
  </Brand>
);

export const Facebook = (p: IconProps) => (
  <Brand {...p}>
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.5-3.89 3.77-3.89 1.1 0 2.24.19 2.24.19v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
  </Brand>
);

export const TikTok = (p: IconProps) => (
  <Brand {...p}>
    <path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12V9.5a6 6 0 0 0-.78-.05 5.75 5.75 0 1 0 5.75 5.75V8.9a7 7 0 0 0 4.1 1.32V7.1a4.1 4.1 0 0 1-4.15-4.1V2Z" />
  </Brand>
);

export const LinkedIn = (p: IconProps) => (
  <Brand {...p}>
    <path d="M20.45 2H3.55A1.53 1.53 0 0 0 2 3.5v17A1.53 1.53 0 0 0 3.55 22h16.9A1.53 1.53 0 0 0 22 20.5v-17A1.53 1.53 0 0 0 20.45 2ZM8.1 18.7H5.16V9.53H8.1v9.17ZM6.63 8.25a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm12.08 10.45h-2.93v-4.46c0-1.06-.02-2.43-1.48-2.43-1.48 0-1.71 1.16-1.71 2.36v4.53H9.66V9.53h2.81v1.25h.04a3.08 3.08 0 0 1 2.77-1.52c2.97 0 3.52 1.95 3.52 4.5v4.94Z" />
  </Brand>
);

export const YouTube = (p: IconProps) => (
  <Brand {...p}>
    <path d="M21.58 7.2a2.51 2.51 0 0 0-1.77-1.78C18.25 5 12 5 12 5s-6.25 0-7.81.42A2.51 2.51 0 0 0 2.42 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.8 2.51 2.51 0 0 0 1.77 1.78C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.78A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.8ZM10 15V9l5.2 3L10 15Z" />
  </Brand>
);

export const XTwitter = (p: IconProps) => (
  <Brand {...p}>
    <path d="M17.53 3h3.02l-6.6 7.54L21.7 21h-6.07l-4.76-6.22L5.42 21H2.4l7.06-8.07L2.3 3h6.23l4.3 5.69L17.53 3Zm-1.06 16.19h1.67L7.6 4.72H5.8l10.67 14.47Z" />
  </Brand>
);
