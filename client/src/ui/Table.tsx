import React from "react";
import { cn } from "./cn/cn";
import { ChevronDown, ChevronUp, SearchX } from "lucide-react";

const TOKENS = {
  container:
    "relative rounded-2xl " +
    "border border-white/[0.08] " +
    "bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/25 " +
    "backdrop-blur-xl " +
    "shadow-[0_18px_60px_rgba(0,0,0,0.45)] " +
    "ring-1 ring-white/[0.04]",

  topGlow:
    "pointer-events-none absolute inset-x-0 top-0 h-px " +
    "bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent",

  scroll:
    "overflow-auto " +
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
    "px-4 py-3 whitespace-nowrap",

  tdBase:
    "px-4 py-3 text-white/85 " +
    "border-b border-white/[0.06] align-middle",

  trRow:
    "transition-colors " +
    "hover:bg-white/[0.035] " +
    "focus-within:bg-white/[0.035]",

  zebra:
    "[&>tbody>tr:nth-child(even)]:bg-white/[0.015] " +
    "[&>tbody>tr:nth-child(odd)]:bg-transparent",

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

  sectionDivider:
    "h-px bg-gradient-to-r from-transparent via-white/10 to-transparent",
};

export function Table({
  className,
  children,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(TOKENS.container, className)} {...p}>
      <div className={TOKENS.topGlow} />
      {children}
    </div>
  );
}

export function TableScroll({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(TOKENS.scroll, className)} {...p} />;
}

type Density = "comfortable" | "compact";

type TableInnerProps = React.TableHTMLAttributes<HTMLTableElement> & {
  zebra?: boolean;
  stickyHeader?: boolean;
  density?: Density;
  fixedLayout?: boolean;
};

export function TableInner({
  className,
  zebra = true,
  stickyHeader = false,
  density = "comfortable",
  fixedLayout = false,
  ...p
}: TableInnerProps) {
  return (
    <table
      data-density={density}
      className={cn(
        TOKENS.table,
        fixedLayout ? "table-fixed" : "table-auto",
        zebra && TOKENS.zebra,
        stickyHeader &&
          "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 " +
            "[&_thead_th]:backdrop-blur-xl [&_thead_th]:bg-slate-950/80",
        className
      )}
      {...p}
    />
  );
}

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
  return <tr className={cn(interactive && TOKENS.trRow, className)} {...p} />;
}

function densityClass(kind: "th" | "td", density: Density | undefined): string {
  const d = density ?? "comfortable";
  return TOKENS.density[d][kind];
}

export function Th({
  className,
  ...p
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
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
        "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-cyan-300/25 [&:has(:focus-visible)]:rounded-xl",
        className
      )}
      {...p}
    />
  );
}

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
        title={hint ?? "Сортировать"}
        onClick={onToggle}
        className={cn(
          "group inline-flex w-full min-w-0 items-center gap-2",
          justify,
          "outline-none rounded-xl px-2 py-1 -mx-2 -my-1",
          onToggle
            ? "hover:bg-white/[0.05] active:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-300/25 cursor-pointer"
            : "cursor-default"
        )}
      >
        <span className="min-w-0 whitespace-nowrap">{label}</span>

        {onToggle && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center",
              "text-white/45 group-hover:text-white/70 transition-colors"
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>
    </Th>
  );
}

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
    <div className={cn("px-6 py-10 flex flex-col items-center text-center gap-3", className)}>
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
              "grid gap-2 rounded-2xl border border-white/[0.06]",
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