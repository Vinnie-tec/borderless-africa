
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

type Props = {
  children: ReactNode;
};

export default function AdminLayout({ children }: Props) {
  return (
    <Suspense fallback={<p>Loading admin area...</p>}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

async function AdminLayoutContent({ children }: Props) {
  await connection();
  await requireAdmin();

  return (
    <div>
      <AdminSidebar />

      <div>
        <AdminHeader />

        <main>{children}</main>
      </div>
    </div>
  );
}
