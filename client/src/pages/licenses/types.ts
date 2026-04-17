export type Tone = "ok" | "warn" | "bad" | "none";
export type Mode = "all" | "risk" | "expiring" | "deficit" | "pinned";
export type SortKey = "status" | "product" | "vendor" | "type" | "seats" | "expires";
export type SortDir = "asc" | "desc";
export type Density = "comfortable" | "compact";

export type ExpiresFmt = { text: string; hint: string; tone: Tone };

export type SeatsEditState = {
  editingSeatsId: string | null;
  tmpUsed: number;
  tmpTotal: number;
  setEditingSeatsId: (v: string | null) => void;
  setTmpUsed: (v: number) => void;
  setTmpTotal: (v: number) => void;
};

export type RowMenuState = {
  menuFor: string | null;
  setMenuFor: (v: string | null) => void;
  menuAnchorRef: React.MutableRefObject<HTMLElement | null>;
};

export type BulkState = {
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
};
