import { Suspense } from "react";
import { connection } from "next/server";
import { asc, eq, ilike, or, and } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth-helpers";
import { UserRoleControl } from "@/components/admin/user-role-control";
import { UserCapabilityControl } from "@/components/admin/user-capability-control";

import { UserSuspensionControl } from "@/components/admin/user-suspension-control";

import { db } from "@/lib/db";
import { user, userCapabilities } from "@/lib/db/schema";

type Props = {
  searchParams: Promise<{
    q?: string;
    role?: string;
    capability?: string;
  }>;
};

export default function AdminUsersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<p>Loading users...</p>}>
      <AdminUsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminUsersContent({ searchParams }: Props) {
  await connection();

  const session = await requireAdmin();

  const params = await searchParams;

  const search = params.q?.trim().slice(0, 100) ?? "";
  const role = ["user", "admin"].includes(params.role ?? "") ? params.role : "";
  const capability = ["client", "freelancer"].includes(params.capability ?? "")
    ? params.capability
    : "";

  const conditions = [];

  if (search) {
    conditions.push(
      or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))!,
    );
  }

  if (role) {
    conditions.push(eq(user.role, role));
  }

  if (capability) {
    conditions.push(
      eq(userCapabilities.capability, capability as "client" | "freelancer"),
    );
  }

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      capability: userCapabilities.capability,
      banned: user.banned,
      banReason: user.banReason,
    })
    .from(user)
    .leftJoin(userCapabilities, eq(user.id, userCapabilities.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(user.name));

  // Group capability rows so each account appears only once.
  const groupedUsers = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      banned: boolean;
      banReason: string | null;
      role: string;
      emailVerified: boolean;
      createdAt: Date;
      capabilities: string[];
    }
  >();

  for (const row of users) {
    const existing = groupedUsers.get(row.id);

    if (existing) {
      if (row.capability && !existing.capabilities.includes(row.capability)) {
        existing.capabilities.push(row.capability);
      }
    } else {
      groupedUsers.set(row.id, {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        emailVerified: row.emailVerified,
        createdAt: row.createdAt,
        capabilities: row.capability ? [row.capability] : [],
        banned: row.banned,
        banReason: row.banReason,
      });
    }
  }

  const userList = Array.from(groupedUsers.values());

  return (
    <div>
      <header>
        <h2>User management</h2>
        <p>View and manage registered accounts and marketplace access.</p>
        <p>
          Matching accounts: <strong>{userList.length}</strong>
        </p>
      </header>

      <form action="/admin/users" method="GET">
        <div>
          <label htmlFor="q">Search users</label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="Search by name or email..."
            defaultValue={search}
          />
        </div>

        <div>
          <label htmlFor="role">Account role</label>
          <select id="role" name="role" defaultValue={role}>
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label htmlFor="capability">Marketplace capability</label>
          <select id="capability" name="capability" defaultValue={capability}>
            <option value="">All capabilities</option>
            <option value="client">Client</option>
            <option value="freelancer">Freelancer</option>
          </select>
        </div>

        <button type="submit">Apply filters</button>
        <a href="/admin/users">Clear filters</a>
      </form>

      {userList.length === 0 ? (
        <p>No users match your search or filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Capabilities</th>
              <th>Email verified</th>
              <th>Joined</th>
              <th>Suspension</th>
            </tr>
          </thead>

          <tbody>
            {userList.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>
                  <UserRoleControl
                    userId={account.id}
                    currentRole={account.role}
                    isCurrentUser={account.id === session.user.id}
                  />
                </td>
                <td>
                  <UserCapabilityControl
                    userId={account.id}
                    currentCapabilities={account.capabilities}
                  />
                </td>
                <td>{account.emailVerified ? "Yes" : "No"}</td>
                <td>{account.createdAt.toLocaleDateString()}</td>
                <td>
                  <UserSuspensionControl
                    userId={account.id}
                    isSuspended={account.banned}
                    banReason={account.banReason}
                    isCurrentUser={account.id === session.user.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
