"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { demoMode } from "@/lib/api";

const NAV = [
  { href: "/", label: "Explain" },
  { href: "/fix", label: "Fix" },
  { href: "/stats", label: "Stats" },
];

function DemoBadge() {
  const demo = useSyncExternalStore(demoMode.subscribe, demoMode.get, () => false);
  if (!demo) return null;
  return (
    <span
      className="rise hidden items-center gap-1.5 rounded-full border border-sx-line bg-sx-soft px-3 py-1 text-xs text-sx-mute sm:inline-flex"
      title="The backend is not reachable, so results come from local demo fixtures."
    >
      <Info className="size-3.5" strokeWidth={2} aria-hidden />
      Demo data, backend offline
    </span>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-sx-line bg-sx-page/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-serif text-2xl tracking-tight" aria-label="FixLoop home">
            Fix<span className="text-sx-blue">Loop</span>
          </Link>
          <DemoBadge />
        </div>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
                  active ? "bg-sx-ink text-white" : "text-sx-mute hover:bg-sx-soft hover:text-sx-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
