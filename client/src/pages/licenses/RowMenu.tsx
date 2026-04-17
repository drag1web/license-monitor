import { Copy, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
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
      width={300}
    >
      {!row ? null : (
        <div>
          <MenuSection title="Actions">
            <MenuItem
              icon={<Pencil className="h-4 w-4 text-white/70" />}
              title="Edit"
              description="Open editor"
              onClick={() => {
                onClose();
                onEdit();
              }}
            />

            <MenuItem
              icon={<Copy className="h-4 w-4 text-white/70" />}
              title="Duplicate"
              description="Create a copy"
              onClick={() => {
                onClose();
                onDuplicate();
              }}
            />

            <MenuItem
              icon={
                isPinned ? (
                  <PinOff className="h-4 w-4 text-cyan-200/80" />
                ) : (
                  <Pin className="h-4 w-4 text-white/70" />
                )
              }
              title={isPinned ? "Unpin" : "Pin"}
              description="Pinned stays on top"
              onClick={() => {
                onClose();
                onTogglePin();
              }}
            />

            <div className="h-px bg-white/10" />

            <MenuItem
              icon={<Trash2 className="h-4 w-4 text-rose-200/90" />}
              title="Delete"
              description="Remove from local registry"
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
