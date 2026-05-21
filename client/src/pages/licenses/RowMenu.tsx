import { Copy, Pencil, Pin, PinOff, Trash2, KeyRound } from "lucide-react";
import type { LicenseRow } from "../../api";
import { PortalDropdown, MenuItem, MenuSection } from "./PortalDropdown";

export function RowMenu({
  open,
  anchorEl,
  row,
  isPinned,
  onClose,
  onEdit,
  onDuplicate,
  onTogglePin,
  onDelete,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  row: LicenseRow | null;
  isPinned: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  return (
    <PortalDropdown
      open={open}
      onClose={onClose}
      anchorRef={{ current: anchorEl } as any}
      width={320}
    >
      {!row ? null : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-3 py-3">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                <KeyRound className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {row.product}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {row.vendor ? <span>{row.vendor}</span> : null}
                  {row.license_type ? <span>{row.license_type}</span> : null}
                  {isPinned ? (
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                      закреплено
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <MenuSection title="Действия">
            <MenuItem
              icon={<Pencil className="h-4 w-4 text-slate-500" />}
              title="Редактировать"
              description="Открыть редактор лицензии"
              onClick={() => {
                onClose();
                onEdit();
              }}
            />

            <MenuItem
              icon={<Copy className="h-4 w-4 text-slate-500" />}
              title="Дублировать"
              description="Создать копию записи"
              onClick={() => {
                onClose();
                onDuplicate();
              }}
            />

            <MenuItem
              icon={
                isPinned ? (
                  <PinOff className="h-4 w-4 text-blue-600" />
                ) : (
                  <Pin className="h-4 w-4 text-slate-500" />
                )
              }
              title={isPinned ? "Открепить" : "Закрепить"}
              description={
                isPinned
                  ? "Убрать запись из закреплённых"
                  : "Закрепить запись вверху списка"
              }
              onClick={() => {
                onClose();
                onTogglePin();
              }}
            />
          </MenuSection>

          <div className="mx-3 my-2 h-px bg-slate-200" />

          <MenuSection title="Опасная зона">
            <MenuItem
              icon={<Trash2 className="h-4 w-4 text-red-600" />}
              title="Удалить"
              description="Удалить только из локального реестра"
              tone="danger"
              onClick={() => {
                onClose();
                onDelete();
              }}
            />
          </MenuSection>
        </div>
      )}
    </PortalDropdown>
  );
}