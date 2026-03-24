import { useState } from "react";
import { trpc } from "../../lib/trpc";
import type { UserRole } from "../../../shared/types";

export function RoleSelect({ userId, currentRole }: { userId: number, currentRole: UserRole }) {
    const utils = trpc.useUtils();
    const [updating, setUpdating] = useState(false);

    const mutation = trpc.settings.users.updateRole.useMutation({
        onMutate: () => setUpdating(true),
        onSettled: () => setUpdating(false),
        onSuccess: () => utils.settings.users.list.invalidate(),
        onError: (err) => alert(err.message),
    });

    return (
        <select
            value={currentRole}
            disabled={updating}
            onChange={(e) => {
                const newRole = e.target.value as UserRole;
                if (newRole !== currentRole) {
                    mutation.mutate({ userId, role: newRole });
                }
            }}
            className="block w-32 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-1 border-transparent hover:border-gray-200 transition-colors bg-transparent disabled:opacity-50"
        >
            <option value="admin">Admin</option>
            <option value="front_office">Front Office</option>
            <option value="warehouse">Warehouse</option>
            <option value="viewer">Viewer</option>
        </select>
    );
}
