import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

import { getLicenses, upsertLicense, removeLicense, type LicenseRow } from "../api";
import { useToast } from "../ui/toast";
import { useAuth } from "../auth/AuthContext";

import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { useConfirmDialog } from "../ui/modal/useConfirmDialog";

import {
  LicenseEditorDialog,
  makeEmptyDraft,
  fromRow,
  toRow,
  validateDraft,
  type Draft,
} from "../ui/modal/licenses/LicenseEditorDialog";

import type { Density, Mode, SortDir, SortKey } from "./licenses/types";
import { S } from "./licenses/styles";
import { cmp, nextDir, safeNum, statusTone, toneFromExpires } from "./licenses/utils";
import { loadPinned, savePinned } from "./licenses/pinned";
import { LicensesHero } from "./licenses/LicensesHero";
import { BulkBar } from "./licenses/BulkBar";
import { LicenseTable } from "./licenses/LicenseTable";
import { RowMenu } from "./licenses/RowMenu";

import { useSettings } from "../settings/SettingsContext";

const FILTERS_KEY = "lm_licenses_filters_v1";

type SavedFilters = {
  q: string;
  mode: Mode;
  sortKey: SortKey;
  sortDir: SortDir;
};

function readSavedFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    const x = JSON.parse(raw) as Partial<SavedFilters>;
    if (typeof x.q !== "string") return null;
    if (typeof x.mode !== "string") return null;
    if (typeof x.sortKey !== "string") return null;
    if (typeof x.sortDir !== "string") return null;
    return x as SavedFilters;
  } catch {
    return null;
  }
}

function writeSavedFilters(v: SavedFilters) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function clearSavedFilters() {
  try {
    localStorage.removeItem(FILTERS_KEY);
  } catch {
    // ignore
  }
}

export default function Licenses() {
  const toast = useToast();
  const confirm = useConfirmDialog();
  const { settings, setSettings } = useSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // mounted guard (avoid setState after unmount)
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rows, setRows] = useState<LicenseRow[]>([]);

  // -----------------------------
  // Filters / view defaults from settings
  // -----------------------------
  const [q, setQ] = useState("");

  const [mode, setMode] = useState<Mode>(() => settings.data.defaultModeLicenses as Mode);

  const [density, setDensity] = useState<Density>(() => settings.density as Density);
  const [showVendor, setShowVendor] = useState(() => settings.data.showVendor);
  const [showType, setShowType] = useState(() => settings.data.showType);
  const [showNote, setShowNote] = useState(() => settings.data.showNote);

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // editor
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => makeEmptyDraft());
  const [saving, setSaving] = useState(false);

  // pinned
  const [pinned, setPinned] = useState<Set<string>>(() => loadPinned());

  // bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // inline seats edit
  const [editingSeatsId, setEditingSeatsId] = useState<string | null>(null);
  const [tmpUsed, setTmpUsed] = useState<number>(0);
  const [tmpTotal, setTmpTotal] = useState<number>(0);

  // row menu
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);

  // ------------------------------------------
  // Load licenses
  // ------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await getLicenses();
      if (!mounted.current) return;
      setRows(data ?? []);
    } catch (e: unknown) {
      if (!mounted.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // persist pinned
  useEffect(() => {
    savePinned(pinned);
  }, [pinned]);

  // ------------------------------------------
  // rememberFilters (q/sort) restore + persist
  // ------------------------------------------
  useEffect(() => {
    if (!settings.rememberFilters) {
      clearSavedFilters();
      return;
    }
    const saved = readSavedFilters();
    if (!saved) return;

    // apply once on mount/settings toggle
    setQ(saved.q);
    setMode(saved.mode);
    setSortKey(saved.sortKey);
    setSortDir(saved.sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.rememberFilters]);

  useEffect(() => {
    if (!settings.rememberFilters) return;
    writeSavedFilters({ q, mode, sortKey, sortDir });
  }, [settings.rememberFilters, q, mode, sortKey, sortDir]);

  // ------------------------------------------
  // Sync: UI -> Settings (persist defaults)
  // ------------------------------------------
  useEffect(() => {
    setSettings((s) => (s.density === density ? s : { ...s, density: density }));
  }, [density, setSettings]);

  useEffect(() => {
    setSettings((s) =>
      s.data.showVendor === showVendor ? s : { ...s, data: { ...s.data, showVendor } }
    );
  }, [showVendor, setSettings]);

  useEffect(() => {
    setSettings((s) =>
      s.data.showType === showType ? s : { ...s, data: { ...s.data, showType } }
    );
  }, [showType, setSettings]);

  useEffect(() => {
    setSettings((s) =>
      s.data.showNote === showNote ? s : { ...s, data: { ...s.data, showNote } }
    );
  }, [showNote, setSettings]);

  useEffect(() => {
    setSettings((s) =>
      s.data.defaultModeLicenses === mode ? s : { ...s, data: { ...s.data, defaultModeLicenses: mode } }
    );
  }, [mode, setSettings]);

  // ------------------------------------------
  // Sync: Settings -> UI (if changed from Settings page)
  // ------------------------------------------
  useEffect(() => setDensity(settings.density as Density), [settings.density]);
  useEffect(() => setShowVendor(settings.data.showVendor), [settings.data.showVendor]);
  useEffect(() => setShowType(settings.data.showType), [settings.data.showType]);
  useEffect(() => setShowNote(settings.data.showNote), [settings.data.showNote]);
  useEffect(() => setMode(settings.data.defaultModeLicenses as Mode), [settings.data.defaultModeLicenses]);

  // ------------------------------------------
  // Derived data
  // ------------------------------------------
  const isEdit = useMemo(() => rows.some((r) => r.id === draft.id), [rows, draft.id]);

  const counts = useMemo(() => {
    const total = rows.length;
    let deficit = 0;
    let expiring = 0;
    let risky = 0;

    for (const x of rows) {
      const used = safeNum(x.seats_used);
      const totalSeats = safeNum(x.seats_total);
      if (used > totalSeats) deficit++;

      const exp = toneFromExpires(x.expires_at ?? null);
      if (exp === "warn" || exp === "bad") expiring++;

      if (statusTone(x) !== "ok") risky++;
    }

    return { total, deficit, expiring, risky, healthy: Math.max(0, total - risky) };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows
      .filter((x) => {
        if (!needle) return true;
        const hay = `${x.product ?? ""} ${x.vendor ?? ""} ${x.license_type ?? ""} ${x.note ?? ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .filter((x) => {
        const used = safeNum(x.seats_used);
        const totalSeats = Math.max(0, safeNum(x.seats_total));
        const deficit = used > totalSeats;
        const exp = toneFromExpires(x.expires_at ?? null);
        const isRisk = deficit || exp !== "ok";

        if (mode === "all") return true;
        if (mode === "pinned") return pinned.has(x.id);
        if (mode === "deficit") return deficit;
        if (mode === "expiring") return exp === "warn" || exp === "bad";
        if (mode === "risk") return isRisk;
        return true;
      });
  }, [rows, q, mode, pinned]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort(cmp(sortKey, sortDir));
    // pinned always first (stable)
    arr.sort((a, b) => (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0));
    return arr;
  }, [filtered, sortKey, sortDir, pinned]);

  // ------------------------------------------
  // UI actions
  // ------------------------------------------
  const openAdd = useCallback(() => {
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может добавлять лицензии.",
      });
      return;
    }

    setDraft(makeEmptyDraft());
    setOpen(true);
  }, [isAdmin, toast]);

  const openEditRow = useCallback((row: LicenseRow) => {
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может редактировать лицензии.",
      });
      return;
    }

    setDraft(fromRow(row));
    setOpen(true);
  }, [isAdmin, toast]);

  const closeEditor = useCallback(() => setOpen(false), []);

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelected(new Set());
  }, []);

  const stopSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const visibleIds = useMemo(() => sorted.map((x) => x.id), [sorted]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, [visibleIds]);

  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of visibleIds) if (!prev.has(id)) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectRiskyOnly = useCallback(() => {
    setSelected(() => {
      const next = new Set<string>();
      for (const r of sorted) {
        const t = statusTone(r);
        if (t !== "ok") next.add(r.id);
      }
      return next;
    });
  }, [sorted]);

  const riskyCountVisible = useMemo(
    () => sorted.filter((x) => statusTone(x) !== "ok").length,
    [sorted]
  );

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selected.has(id)),
    [visibleIds, selected]
  );

  const save = useCallback(async () => {
    const msg = validateDraft(draft);
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может изменять реестр лицензий.",
      });
      return;
    }

    if (msg) {
      toast.push({ tone: "error", title: "Проверка", message: msg });
      return;
    }

    setSaving(true);
    try {
      const row = toRow(draft);
      const saved = await upsertLicense(row);

      setRows((prev) => {
        const idx = prev.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      toast.push({
        tone: "success",
        title: "Сохранено",
        message: `${saved.product} • ${saved.seats_used}/${saved.seats_total}`,
      });

      setOpen(false);
    } catch (e: unknown) {
      const msg2 = e instanceof Error ? e.message : String(e);
      toast.push({ tone: "error", title: "Сохранение не удалось", message: msg2 });
    } finally {
      setSaving(false);
    }
  }, [draft, isAdmin, toast]);

  const askDelete = useCallback(
    async (title: string, description: string, confirmLabel: string) => {
      if (!settings.confirmBeforeDelete) return true;
      return await confirm.ask({
        title,
        description,
        confirmLabel,
        cancelLabel: "Cancel",
        danger: true,
      });
    },
    [confirm, settings.confirmBeforeDelete]
  );

  const delOne = useCallback(
    async (row: LicenseRow) => {
      if (!isAdmin) {
        toast.push({
          tone: "error",
          title: "Недостаточно прав",
          message: "Только admin может удалять лицензии.",
        });
        return;
      }

      const ok = await askDelete(
        `Delete license "${row.product}"?`,
        "Запись будет удалена из local registry.",
        "Delete"
      );
      if (!ok) return;

      try {
        await removeLicense(row.id);
        setRows((prev) => prev.filter((x) => x.id !== row.id));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
        toast.push({ tone: "info", title: "Удалено", message: row.product });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.push({ tone: "error", title: "Удаление не удалось", message: msg });
      }
    },
    [isAdmin, askDelete, toast]
  );

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selected);
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может удалять лицензии.",
      });
      return;
    }
    if (ids.length === 0) return;

    const ok = await askDelete(
      `Delete selected: ${ids.length}?`,
      "Будут удалены выбранные записи из local registry.",
      "Delete selected"
    );
    if (!ok) return;

    setBulkBusy(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            await removeLicense(id);
            return { id, ok: true as const };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { id, ok: false as const, error: msg };
          }
        })
      );

      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
      const failed = results.filter((r) => !r.ok);

      if (okIds.size) {
        setRows((prev) => prev.filter((x) => !okIds.has(x.id)));
        setSelected(new Set());
      }

      if (failed.length) {
        toast.push({
          tone: "error",
          title: "Bulk delete partial",
          message: `Failed: ${failed.length}. Example: ${failed[0].id} — ${failed[0].error ?? "unknown"}`,
        });
      } else {
        toast.push({ tone: "success", title: "Deleted", message: `Deleted: ${okIds.size}` });
      }

      stopSelectMode();
    } finally {
      setBulkBusy(false);
    }
  }, [isAdmin, selected, askDelete, toast, stopSelectMode]);

  const seedDemo = useCallback(() => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может добавлять демо-данные.",
      });
      return;
    }

    const demo: LicenseRow[] = [
      {
        id: `lic_demo_jet_${Date.now()}`,
        product: "JetBrains All Products Pack",
        vendor: "JetBrains",
        license_type: "subscription",
        seats_total: 25,
        seats_used: 23,
        starts_at: iso(new Date(now.getFullYear(), now.getMonth() - 4, now.getDate())),
        expires_at: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9)),
        note: "Скоро истекает — продлить заранее.",
      },
      {
        id: `lic_demo_ms_${Date.now() + 1}`,
        product: "Microsoft 365 Business",
        vendor: "Microsoft",
        license_type: "subscription",
        seats_total: 80,
        seats_used: 81,
        starts_at: iso(new Date(now.getFullYear(), now.getMonth() - 2, now.getDate())),
        expires_at: iso(new Date(now.getFullYear(), now.getMonth() + 1, now.getDate() + 3)),
        note: "Дефицит seats: используемых больше, чем закуплено.",
      },
      {
        id: `lic_demo_winrar_${Date.now() + 2}`,
        product: "WinRAR",
        vendor: "RARLAB",
        license_type: "perpetual",
        seats_total: 10,
        seats_used: 3,
        starts_at: "",
        expires_at: "",
        note: "Перпетуалка, без срока.",
      },
    ];

    (async () => {
      try {
        for (const r of demo) await upsertLicense(r);
        toast.push({ tone: "success", title: "Seed demo", message: "Демо-лицензии добавлены." });
        load();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.push({ tone: "error", title: "Seed demo failed", message: msg });
      }
    })();
  }, [isAdmin, toast, load]);

  const onToggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => nextDir(d));
        return prevKey;
      }
      setSortDir(key === "product" || key === "vendor" || key === "type" ? "asc" : "desc");
      return key;
    });
  }, []);

  // Inline seats edit handlers
  const beginSeatsEdit = useCallback((row: LicenseRow) => {
    setEditingSeatsId(row.id);
    setTmpUsed(safeNum(row.seats_used));
    setTmpTotal(safeNum(row.seats_total));
  }, []);

  const cancelSeatsEdit = useCallback(() => {
    setEditingSeatsId(null);
  }, []);

  const commitSeatsEdit = useCallback(
    async (row: LicenseRow) => {
      if (!isAdmin) {
        toast.push({
          tone: "error",
          title: "Недостаточно прав",
          message: "Только admin может редактировать лицензии.",
        });
        return;
      }

      const used = Math.max(0, safeNum(tmpUsed));
      const total = Math.max(0, safeNum(tmpTotal));

      setEditingSeatsId(null);

      setRows((prev) =>
        prev.map((x) =>
          x.id === row.id ? { ...x, seats_used: used, seats_total: total } : x
        )
      );

      try {
        await upsertLicense({ ...row, seats_used: used, seats_total: total });
        toast.push({
          tone: "success",
          title: "Updated",
          message: `${row.product}: ${used}/${total}`,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.push({ tone: "error", title: "Save failed", message: msg });
        load();
      }
    },
    [isAdmin, tmpUsed, tmpTotal, toast, load]
  );

  // Row menu actions
  const openRowMenu = useCallback((row: LicenseRow, anchor: HTMLElement) => {
    menuAnchorRef.current = anchor;
    setMenuFor(row.id);
  }, []);

  const closeRowMenu = useCallback(() => setMenuFor(null), []);

  const duplicateRow = useCallback((row: LicenseRow) => {
    const d = fromRow(row);
    const newId = `lic_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    setDraft({ ...d, id: newId });
    setOpen(true);
  }, []);

  if (err) {
    return (
      <Card className="p-5">
        <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-rose-100">Ошибка</div>
          <div className="mt-1 text-xs text-rose-200/80 break-words">{err}</div>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="sm" onClick={load}>
              Обновить
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const bulkBarNode = isAdmin && selectMode ? (
    <BulkBar
      selectedCount={selected.size}
      allVisibleSelected={allVisibleSelected}
      riskyCountVisible={riskyCountVisible}
      bulkBusy={bulkBusy}
      onToggleAllVisible={toggleAllVisible}
      onInvert={invertSelection}
      onRiskyOnly={selectRiskyOnly}
      onClear={clearSelection}
      onBulkDelete={bulkDelete}
    />
  ) : null;

  const menuRow = menuFor ? rows.find((r) => r.id === menuFor) ?? null : null;
  const menuPinned = menuRow ? pinned.has(menuRow.id) : false;

  return (
    <div className={S.page}>
      {/* CONFIRM */}
      <ConfirmDialog
        open={confirm.open}
        title={confirm.cfg.title}
        description={confirm.cfg.description}
        confirmLabel={confirm.cfg.confirmLabel}
        cancelLabel={confirm.cfg.cancelLabel}
        danger={confirm.cfg.danger}
        requireText={confirm.cfg.requireText}
        value={confirm.value}
        onValueChange={confirm.setValue}
        busy={bulkBusy || saving}
        onCancel={confirm.cancel}
        onConfirm={confirm.confirm}
      />

      {/* EDITOR */}
      {isAdmin && (
        <LicenseEditorDialog
          open={open}
          isEdit={isEdit}
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onClose={closeEditor}
          onSave={save}
        />
      )}

      <LicensesHero
        counts={counts}
        loading={loading}
        rowsCount={rows.length}
        sortedCount={sorted.length}
        q={q}
        setQ={setQ}
        mode={mode}
        setMode={setMode}
        selectMode={isAdmin ? selectMode : false}
        onStartSelectMode={isAdmin ? startSelectMode : () => { }}
        onStopSelectMode={isAdmin ? stopSelectMode : () => { }}
        density={density}
        setDensity={setDensity}
        showVendor={showVendor}
        setShowVendor={setShowVendor}
        showType={showType}
        setShowType={setShowType}
        showNote={showNote}
        setShowNote={setShowNote}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        onSeedDemo={isAdmin ? seedDemo : () => { }}
        onReload={load}
        onOpenAdd={isAdmin ? openAdd : () => { }}
        bulkBar={bulkBarNode}
      />

      <LicenseTable
        loading={loading}
        rowsCount={rows.length}
        sorted={sorted}
        density={density}
        selectMode={isAdmin ? selectMode : false}
        selected={selected}
        stickyHeader={settings.data.stickyHeader}
        disableEffectsWhileScroll={settings.perf.disableEffectsWhileScroll}
        allVisibleSelected={allVisibleSelected}
        onToggleAllVisible={isAdmin ? toggleAllVisible : () => { }}
        onToggleOne={isAdmin ? toggleOne : () => { }}
        showVendor={showVendor}
        showType={showType}
        showNote={showNote}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        pinned={pinned}
        onTogglePin={togglePin}
        editingSeatsId={isAdmin ? editingSeatsId : null}
        tmpUsed={tmpUsed}
        tmpTotal={tmpTotal}
        setTmpUsed={setTmpUsed}
        setTmpTotal={setTmpTotal}
        onBeginSeatsEdit={isAdmin ? beginSeatsEdit : () => { }}
        onCancelSeatsEdit={isAdmin ? cancelSeatsEdit : () => { }}
        onCommitSeatsEdit={isAdmin ? commitSeatsEdit : () => { }}
        onOpenEditRow={isAdmin ? openEditRow : () => { }}
        onOpenRowMenu={isAdmin ? openRowMenu : () => { }}
        onSeedDemo={isAdmin ? seedDemo : () => { }}
        onOpenAdd={isAdmin ? openAdd : () => { }}
      />

      <div className="flex items-center gap-2 text-[12px] text-white/45">
        <AlertTriangle className="h-4 w-4 text-white/40" />
        {isAdmin
          ? "Delete — удаляет только запись из local registry (не трогает реальные лицензии в системе)."
          : "У вас режим только для чтения. Изменение реестра лицензий доступно только admin."}
      </div>

      {isAdmin && (
        <RowMenu
          open={menuFor != null}
          anchorEl={menuAnchorRef.current}
          row={menuRow}
          isPinned={menuPinned}
          onClose={closeRowMenu}
          onEdit={() => menuRow && openEditRow(menuRow)}
          onDuplicate={() => menuRow && duplicateRow(menuRow)}
          onTogglePin={() => menuRow && togglePin(menuRow.id)}
          onDelete={() => menuRow && delOne(menuRow)}
        />
      )}
    </div>
  );
}
