import Link from "next/link";

const NAV = [
  { href: "/", label: "Explain" },
  { href: "/fix", label: "Fix" },
  { href: "/stats", label: "Stats" },
];

export function Header() {
  return (
    <header className="border-b border-sx-line">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-serif text-2xl tracking-tight" aria-label="FixLoop home">
          Fix<span className="text-sx-blue">Loop</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-sx-mute transition-colors duration-200 hover:bg-sx-soft hover:text-sx-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
