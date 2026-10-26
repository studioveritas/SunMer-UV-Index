import Link from "next/link";

/** Cities · Sea · Snow. Links, not tabs: each mode is its own cacheable page. */
export function ModeNav({ active }: { active: "cities" | "sea" | "snow" }) {
  const items = [
    { id: "cities", href: "/", label: "Cities" },
    { id: "sea", href: "/sea", label: "Sea" },
    { id: "snow", href: "/snow", label: "Snow" },
  ] as const;
  return (
    <nav className="tabs modes" aria-label="Mode">
      {items.map((i) => (
        <Link key={i.id} href={i.href} aria-current={active === i.id ? "page" : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
