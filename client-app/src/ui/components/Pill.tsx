export function Pill({
  tone,
  children,
}: {
  tone: "ok" | "bad" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "bad"
        ? "border-red-200 bg-red-50 text-red-700"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}