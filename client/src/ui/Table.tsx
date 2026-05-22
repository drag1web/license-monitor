import React from "react";
import { cn } from "./cn/cn";
import { ChevronDown, ChevronUp, SearchX } from "lucide-react";

type Density = "comfortable" | "compact";
type SortDir = "asc" | "desc" | null;

const density = {
  comfortable: {
    th: "px-4 py-3",
    td: "px-4 py-3",
  },
  compact: {
    th: "px-3 py-2",
    td: "px-3 py-2",
  },
};

export function Table({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
      {...p}
    />
  );
}

export function TableScroll({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-y-auto overflow-x-hidden", className)} {...p} />;
}

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
  density: d = "comfortable",
  fixedLayout = false,
  ...p
}: TableInnerProps) {
  return (
    <table
      data-density={d}
      className={cn(
        "w-full border-collapse text-sm",
        fixedLayout ? "table-fixed" : "table-auto",
        zebra && "[&>tbody>tr:nth-child(even)]:bg-slate-50",
        stickyHeader && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50",
        className
      )}
      {...p}
    />
  );
}

export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-slate-50", props.className)}
      {...props}
    />
  );
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({
  className,
  interactive = true,
  ...p
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(interactive && "hover:bg-slate-50", className)}
      {...p}
    />
  );
}

function useDensity(ref: React.RefObject<HTMLElement | null>) {
  const [d, setD] = React.useState<Density>("comfortable");

  React.useEffect(() => {
    const table = ref.current?.closest("table");
    setD((table?.getAttribute("data-density") as Density) || "comfortable");
  }, [ref]);

  return d;
}

export function Th({
  className,
  ...p
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const ref = React.useRef<HTMLTableCellElement | null>(null);
  const d = useDensity(ref);

  return (
    <th
      ref={ref}
      className={cn(
        "whitespace-nowrap border-b border-slate-200 text-left font-semibold text-slate-600",
        density[d].th,
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
  const d = useDensity(ref);

  return (
    <td
      ref={ref}
      className={cn(
        "border-b border-slate-100 align-middle text-slate-800",
        density[d].td,
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
        "flex items-start gap-3 border-b border-slate-200 px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">
          {title}
        </div>

        {description && (
          <div className="mt-1 text-xs text-slate-500">
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
        "flex items-center gap-2 border-b border-slate-200 px-4 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TableSectionDivider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-slate-200", className)} />;
}

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
  const Icon = dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : null;

  return (
    <Th className={cn(className, align !== "left" && "text-center")}>
      <button
        type="button"
        title={hint ?? "Сортировать"}
        onClick={onToggle}
        className={cn(
          "inline-flex w-full items-center gap-2 rounded-md px-1 py-0.5",
          align === "left"
            ? "justify-start"
            : align === "center"
              ? "justify-center"
              : "justify-end",
          onToggle && "hover:bg-slate-200"
        )}
      >
        <span>{label}</span>

        {onToggle && (
          <span className="text-slate-400">
            {Icon ? (
              <Icon className="h-3.5 w-3.5" />
            ) : (
              <span className="block h-3.5 w-3.5" />
            )}
          </span>
        )}
      </button>
    </Th>
  );
}

export function TableEmpty({
  title = "Нет данных",
  description = "Измените фильтры или обновите данные.",
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
        "flex flex-col items-center gap-3 px-6 py-10 text-center",
        className
      )}
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-slate-50">
        <SearchX className="h-5 w-5 text-slate-500" />
      </div>

      <div className="text-sm font-semibold text-slate-900">
        {title}
      </div>

      <div className="max-w-[48ch] text-xs leading-relaxed text-slate-500">
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
            className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <div
                key={c}
                className="h-4 animate-pulse rounded bg-slate-200"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}