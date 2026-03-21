import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../lib/trpc";
import { X } from "lucide-react";

const schema = z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    userId: number | null;
    username: string;
    onClose: () => void;
}

export function ResetPasswordDialog({ userId, username, onClose }: Props) {
    const mutation = trpc.settings.users.resetPassword.useMutation({
        onSuccess: () => {
            alert(`Password for ${username} has been reset.`);
            form.reset();
            onClose();
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: ({ newPassword: "" }),
    });

    if (userId === null) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500/75 transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-sm transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
                    <button onClick={onClose} className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                    Enter a new password for <strong>{username}</strong>.
                </p>

                <form onSubmit={form.handleSubmit((d) => mutation.mutate({ userId, newPassword: d.newPassword }))} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <input
                            {...form.register("newPassword")}
                            type="password"
                            autoComplete="new-password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                        {form.formState.errors.newPassword && <p className="mt-1 text-xs text-red-500">{form.formState.errors.newPassword.message}</p>}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            {mutation.isPending ? "Saving..." : "Reset"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
