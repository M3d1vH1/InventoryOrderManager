import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import { Key, Trash2, UserPlus } from "lucide-react";
import { CreateUserDialog } from "../../../components/settings/CreateUserDialog";
import { ResetPasswordDialog } from "../../../components/settings/ResetPasswordDialog";
import { RoleSelect } from "../../../components/settings/RoleSelect";

export const Route = createFileRoute("/_auth/settings/users")({
    component: UsersPage,
});

function UsersPage() {
    const utils = trpc.useUtils();
    const { data: users, isLoading } = trpc.settings.users.list.useQuery();

    const [createOpen, setCreateOpen] = useState(false);
    const [resetTarget, setResetTarget] = useState<{ id: number; username: string } | null>(null);

    const deleteMutation = trpc.settings.users.delete.useMutation({
        onSuccess: () => utils.settings.users.list.invalidate(),
        onError: (err) => alert(err.message),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">User Management</h2>
                    <p className="text-sm text-gray-500">
                        Add and remove team members, manage their roles, and reset access passwords.
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                    <UserPlus className="h-4 w-4" />
                    New User
                </button>
            </div>

            {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Username
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Joined
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {users?.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                                        {user.fullName}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                        {user.username}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <RoleSelect userId={user.id} currentRole={user.role} />
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                                        {format(new Date(user.createdAt), "MMM d, yyyy")}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setResetTarget({ id: user.id, username: user.username })}
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                title="Reset Password"
                                            >
                                                <Key className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
                                                        deleteMutation.mutate({ userId: user.id });
                                                    }
                                                }}
                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                title="Delete User"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CreateUserDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />

            <ResetPasswordDialog
                userId={resetTarget?.id ?? null}
                username={resetTarget?.username ?? ""}
                onClose={() => setResetTarget(null)}
            />
        </div>
    );
}
