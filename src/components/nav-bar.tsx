"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/screener", label: "Screener" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/snapshot", label: "Snapshot" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/rl", label: "RL vs Human" },
  { href: "/options", label: "Options" },
  { href: "/options/universe", label: "Options Universe" },
  { href: "/rotation", label: "Rotation" },
  { href: "/sector-rotation", label: "Sectors" },
  { href: "/analytics", label: "Analytics" },
];

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 px-6 py-2 flex items-center gap-1">
      <span className="text-[10px] font-bold text-zinc-400 tracking-[0.25em] uppercase mr-4 select-none">
        ST
      </span>
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`text-xs px-3 py-1 rounded transition-colors font-mono ${
            pathname === href
              ? "text-zinc-100 bg-zinc-800"
              : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50"
          }`}
        >
          {label}
        </Link>
      ))}
      <button
        onClick={handleLogout}
        className="ml-auto text-xs px-3 py-1 rounded font-mono text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
      >
        Logout
      </button>
    </nav>
  );
}
