
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    label: "Dashboard",
    href: "/admin",
  },
  {
    label: "Disputes",
    href: "/admin/disputes",
  },
  {
    label: "Proposals",
    href: "/admin/proposals",
  },
  {
    label: "Contracts",
    href: "/admin/contracts",
  },
  {
    label: "Payments",
    href: "/admin/payments",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside>
      <div>
        <Link href="/admin">
          <strong>Borderless Africa</strong>
        </Link>
        <p>Administration</p>
      </div>

      <nav aria-label="Admin navigation">
        {navigation.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
