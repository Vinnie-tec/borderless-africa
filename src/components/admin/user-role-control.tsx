
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { changeUserRole } from "@/app/admin/users/actions";
import { useToast } from "@/components/toast/toast-provider";

type Props = {
  userId: string;
  currentRole: string;
  isCurrentUser: boolean;
};

type UserRole = "user" | "admin";

export function UserRoleControl({
  userId,
  currentRole,
  isCurrentUser,
}: Props) {
  const [role, setRole] = useState<UserRole>(
    currentRole === "admin" ? "admin" : "user",
  );

  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleChange(newRole: UserRole) {
    startTransition(async () => {
      try {
        const result = await changeUserRole({
          userId,
          newRole,
        });

        if (!result.success) {
          toast.error("Role update failed", {
            description: result.message,
          });
          return;
        }

        setRole(newRole);

        toast.success("Role updated", {
          description: result.message,
        });

        router.refresh();
      } catch {
        toast.error("Role update failed", {
          description: "Something went wrong. Please try again.",
        });
      }
    });
  }

  return (
    <div>
      <select
        aria-label="Change account role"
        value={role}
        disabled={isPending || isCurrentUser}
        onChange={(event) =>
          handleChange(event.target.value as UserRole)
        }
      >
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      {isPending && <span> Updating...</span>}

      {isCurrentUser && (
        <small>Your administrator role</small>
      )}
    </div>
  );
}
