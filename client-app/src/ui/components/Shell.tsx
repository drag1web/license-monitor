import { Minus, Square, X } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="fixed left-0 right-0 top-0 z-[70] flex h-10 items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-sm [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <div className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
            E
          </div>
          <span>Entitlex</span>
          <span className="text-slate-400">Клиент лицензирования</span>
        </div>

        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => window.entitlexWindow?.minimize()}
            className="grid h-7 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Свернуть"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => window.entitlexWindow?.maximize()}
            className="grid h-7 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Развернуть"
          >
            <Square className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => window.entitlexWindow?.close()}
            className="grid h-7 w-9 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
            title="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 pb-8 pt-16">
        {children}
      </div>
    </div>
  );
}