import React from "react";
import { cn } from "./cn/cn";
import { ChevronDown, ChevronUp, SearchX } from "lucide-react";

/**
 * ==========================================
 *  TABLE DESIGN SYSTEM (Glass / Graphite)
 * ==========================================
 * Features:
 * - glass container with top glow
 * - optional sticky header
 * - zebra rows + hover highlight
 * - density modes (comfortable/compact)
 * - caption + toolbar + empty state
 * - sortable headers (optional)
 * - skeleton rows (optional)
 */

/* ------------------------------------------
 *  Tokens (tailwind classes)
 * ------------------------------------------ */

const TOKENS = {
  container:
    "relative overflow-hidden rounded-2xl " +
    "border border-white/[0.08] " +
    "bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/25 " +
    "backdrop-blur-xl " +
    "shadow-[0_18px_60px_rgba(0,0,0,0.45)] " +
    "ring-1 ring-white/[0.04]",

  topGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-px " +
    "bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent",

  bottomFade:
    "pointer-events-none absolute inset-x-0 bottom-0 h-10 " +
    "bg-gradient-to-b from-transparent to-black/25",

  scroll:
    "overflow-auto " +
    // nicer scrollbars (webkit)
    "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb]:bg-white/10 " +
    "hover:[&::-webkit-scrollbar-thumb]:bg-white/15 " +
    "[&::-webkit-scrollbar-track]:bg-transparent",

  table: "w-full border-collapse text-sm",

  thead:
    "bg-white/[0.03] " +
    "shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]",

  thBase:
    "text-left font-semibold tracking-[0.01em] " +
    "text-white/70 " +
    "border-b border-white/[0.08] " +
    "px-4 py-3",

  tdBase:
    "px-4 py-3 text-white/85 " +
    "border-b border-white/[0.06]",

  trRow:
    "transition-colors " +
    "hover:bg-white/[0.035] " +
    "focus-within:bg-white/[0.035]",

  zebra:
    "[&>tbody>tr:nth-child(even)]:bg-white/[0.015] " +
    "[&>tbody>tr:nth-child(odd)]:bg-transparent",

  // density variants
  density: {
    comfortable: {
      th: "py-3 px-4",
      td: "py-3 px-4",
    },
    compact: {
      th: "py-2 px-3",
      td: "py-2 px-3",
    },
  },

  // subtle “divider” for groups/sections
  sectionDivider:
    "h-px bg-gradient-to-r from-transparent via-white/10 to-transparent",
};

/* ------------------------------------------
 *  Base Container
 * ------------------------------------------ */

export function Table({
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(TOKENS.container, className)} {...p}>
      <div className={TOKENS.topGlow} />
      <div className={TOKENS.bottomFade} />
      {children}
    </div>
  );
}

/**
 * Wrapper with scrolling; use it when you want sticky header to work properly.
 * Example:
 * <Table>
 *   <TableScroll className="max-h-[60vh]">
 *     <TableInner stickyHeader>...</TableInner>
 *   </TableScroll>
 * </Table>
 */
export function TableScroll({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(TOKENS.scroll, className)} {...p} />;
}

/* ------------------------------------------
 *  Table Inner (table element)
 * ------------------------------------------ */

type Density = "comfortable" | "compact";

type TableInnerProps = React.TableHTMLAttributes<HTMLTableElement> & {
  zebra?: boolean;
  stickyHeader?: boolean;
  density?: Density;
};

export function TableInner({
  className,
  zebra = true,
  stickyHeader = false,
  density = "comfortable",
  ...p
}: TableInnerProps) {
  // We store density in data-attr for Th/Td helpers
  return (
    <table
      data-density={density}
      className={cn(
        TOKENS.table,
        zebra && TOKENS.zebra,
        stickyHeader &&
          // sticky thead cells
          "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 " +
            "[&_thead_th]:backdrop-blur-xl [&_thead_th]:bg-slate-950/55",
        className
      )}
      {...p}
    />
  );
}

/* ------------------------------------------
 *  Head / Body helpers
 * ------------------------------------------ */

export function THead({
  className,
  ...p
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(TOKENS.thead, className)} {...p} />;
}

export function TBody({
  className,
  ...p
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...p} />;
}

export function Tr({
  className,
  interactive = true,
  ...p
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr className={cn(interactive && TOKENS.trRow, className)} {...p} />
  );
}

/* ------------------------------------------
 *  Cells
 * ------------------------------------------ */

function densityClass(
  kind: "th" | "td",
  density: Density | undefined
): string {
  const d = density ?? "comfortable";
  return TOKENS.density[d][kind];
}

export function Th({
  className,
  ...p
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  // Find density from nearest table (data-density)
  // TS ok because we only read dataset
  const ref = React.useRef<HTMLTableCellElement | null>(null);
  const [density, setDensity] = React.useState<Density>("comfortable");

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = el.closest("table");
    const d = (t?.getAttribute("data-density") as Density) || "comfortable";
    setDensity(d);
  }, []);

  return (
    <th
      ref={ref}
      className={cn(
        TOKENS.thBase,
        densityClass("th", density),
        // subtle header gradient
        "bg-gradient-to-b from-white/[0.05] to-white/[0.02]",
        className
      )}
      {...p}
    />
  );
}

export function Td({
  className,
  ...p
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const ref = React.useRef<HTMLTableCellElement | null>(null);
  const [density, setDensity] = React.useState<Density>("comfortable");

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = el.closest("table");
    const d = (t?.getAttribute("data-density") as Density) || "comfortable";
    setDensity(d);
  }, []);

  return (
    <td
      ref={ref}
      className={cn(
        TOKENS.tdBase,
        densityClass("td", density),
        // nice focus inside cells
        "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-cyan-300/25 [&:has(:focus-visible)]:rounded-xl",
        className
      )}
      {...p}
    />
  );
}

/* ------------------------------------------
 *  Nice utilities (optional)
 * ------------------------------------------ */

export function TableCaption({
  title,
  description,
  className,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 pt-4 pb-3",
        "border-b border-white/[0.06]",
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold tracking-[0.02em] text-white/85">
          {title}
        </div>
        {description && (
          <div className="mt-1 text-[12px] text-white/45 leading-snug">
            {description}
          </div>
        )}
      </div>

      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}

export function TableToolbar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-4 py-3 flex items-center gap-2",
        "border-b border-white/[0.06]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TableSectionDivider({ className }: { className?: string }) {
  return <div className={cn(TOKENS.sectionDivider, className)} />;
}

/* ------------------------------------------
 *  Sortable header (optional)
 * ------------------------------------------ */

type SortDir = "asc" | "desc" | null;

export function SortTh({
  className,
  label,
  dir,
  onToggle,
  align = "left",
  hint,
}: {
  label: string;
  dir: SortDir;
  onToggle?: () => void;
  align?: "left" | "center" | "right";
  hint?: string;
  className?: string;
}) {
  const justify =
    align === "left"
      ? "justify-start text-left"
      : align === "center"
      ? "justify-center text-center"
      : "justify-end text-right";

  const Icon = dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : null;

  return (
    <Th className={cn(className, align !== "left" && "text-center")}>
      <button
        type="button"
        title={hint ?? "Sort"}
        onClick={onToggle}
        className={cn(
          "group inline-flex items-center gap-2",
          justify,
          "w-full",
          "outline-none",
          "rounded-xl px-2 py-1 -mx-2 -my-1",
          "hover:bg-white/[0.05] active:bg-white/[0.07]",
          "focus-visible:ring-2 focus-visible:ring-cyan-300/25"
        )}
      >
        <span className="truncate">{label}</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center",
            "text-white/45 group-hover:text-white/70 transition-colors"
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
        </span>
      </button>
    </Th>
  );
}

/* ------------------------------------------
 *  Empty state (optional)
 * ------------------------------------------ */

export function TableEmpty({
  title = "Nothing here yet",
  description = "Try changing filters or refresh the data.",
  className,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-6 py-10 flex flex-col items-center text-center gap-3",
        className
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-2xl grid place-items-center",
          "bg-white/[0.04] border border-white/[0.08]",
          "shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
        )}
      >
        <SearchX className="h-5 w-5 text-cyan-200/80" />
      </div>

      <div className="text-sm font-semibold text-white/85">{title}</div>
      <div className="max-w-[48ch] text-[12px] text-white/45 leading-relaxed">
        {description}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------
 *  Skeleton (optional)
 * ------------------------------------------ */

export function TableSkeleton({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-4", className)}>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className={cn(
              "grid gap-2",
              "rounded-2xl border border-white/[0.06]",
              "bg-white/[0.02] px-3 py-2"
            )}
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <div
                key={c}
                className={cn(
                  "h-4 rounded-lg",
                  "bg-gradient-to-r from-white/[0.06] via-white/[0.10] to-white/[0.06]",
                  "animate-pulse"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
