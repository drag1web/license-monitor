import { useCallback, useRef, useState } from "react";

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [cfg, setCfg] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    requireText?: string;
  }>({ title: "" });

  const resolver = useRef<null | ((ok: boolean) => void)>(null);

  const ask = useCallback(async (next: typeof cfg) => {
    setCfg(next);
    setValue("");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const cancel = useCallback(() => {
    setOpen(false);
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  const confirm = useCallback(() => {
    if (cfg.requireText && value !== cfg.requireText) return;
    setOpen(false);
    resolver.current?.(true);
    resolver.current = null;
  }, [cfg.requireText, value]);

  return { open, cfg, value, setValue, ask, cancel, confirm };
}
