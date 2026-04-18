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
        <div className="overflow-hidden">
          {/* Header */}
          <div className="px-3 pt-3 pb-2">
            <div className="rounded-2xl bg-[rgba(var(--card),0.18)] px-3 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[rgba(var(--fg),0.05)]">
                  <KeyRound className="h-4 w-4 text-cyan-300/85" />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[rgba(var(--fg),0.90)]">
                    {row.product}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[rgba(var(--fg),0.46)]">
                    {row.vendor ? <span>{row.vendor}</span> : null}
                    {row.license_type ? <span>{row.license_type}</span> : null}
                    {isPinned ? (
                      <span className="rounded-xl bg-cyan-500/10 px-2 py-1 text-cyan-200/85">
                        pinned
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <MenuSection title="Actions">
            <MenuItem
              icon={<Pencil className="h-4 w-4 text-[rgba(var(--fg),0.72)]" />}
              title="Edit"
              description="Открыть редактор лицензии"
              onClick={() => {
                onClose();
                onEdit();
              }}
            />

            <MenuItem
              icon={<Copy className="h-4 w-4 text-[rgba(var(--fg),0.72)]" />}
              title="Duplicate"
              description="Создать копию записи"
              onClick={() => {
                onClose();
                onDuplicate();
              }}
            />

            <MenuItem
              icon={
                isPinned ? (
                  <PinOff className="h-4 w-4 text-cyan-200/85" />
                ) : (
                  <Pin className="h-4 w-4 text-[rgba(var(--fg),0.72)]" />
                )
              }
              title={isPinned ? "Unpin" : "Pin"}
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

          <div className="mx-3 my-2 h-px bg-[rgba(100,130,170,0.14)]" />

          <MenuSection title="Danger zone">
            <MenuItem
              icon={<Trash2 className="h-4 w-4 text-rose-200/90" />}
              title="Delete"
              description="Удалить только из local registry"
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