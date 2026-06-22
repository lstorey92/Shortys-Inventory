import Link from "next/link";
import { InventoryCountClient } from "@/components/inventory-count-client";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto mt-6 w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-100 via-orange-50 to-lime-50 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Shorty&apos;s Pizza Shack</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Inventory Workbench
              </h1>
              <p className="mt-2 text-sm text-slate-700">
                Phase-1 implementation: multi-location count flow and integration endpoints for Toast/XtraCHEF.
              </p>
            </div>
            <nav className="flex gap-2">
              <Link
                href="/api/health"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Health API
              </Link>
              <Link
                href="/api/integrations/toast/token"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Test Toast Token
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="pb-10">
        <InventoryCountClient />
      </main>
    </div>
  );
}
