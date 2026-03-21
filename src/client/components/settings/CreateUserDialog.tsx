import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "../../lib/trpc";
import { X } from "lucide-react";

const schema = z.object({
    username: z.string().min(3),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(1),
    role: z.enum(["admin", "front_office", "warehouse", "viewer"]),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onClose: () => void;
}

export function CreateUserDialog({ open, onClose }: Props) {
    const utils = trpc.useUtils();

    const mutation = trpc.settings.users.create.useMutation({
        onSuccess: () => {
            utils.settings.users.list.invalidate();
            form.reset();
            onClose();
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            username: "",
            password: "",
            fullName: "",
            role: "warehouse",
        },
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500/75 transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Create New User</h3>
                    <button onClick={onClose} className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input
                            {...form.register("fullName")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                        {form.formState.errors.fullName && <p className="mt-1 text-xs text-red-500">{form.formState.errors.fullName.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Username</label>
                        <input
                            {...form.register("username")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                        {form.formState.errors.username && <p className="mt-1 text-xs text-red-500">{form.formState.errors.username.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            {...form.register("password")}
                            type="password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                        {form.formState.errors.password && <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Role</label>
                        <select
                            {...form.register("role")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white"
                        >
                            <option value="admin">Admin</option>
                            <option value="front_office">Front Office</option>
                            <option value="warehouse">Warehouse</option>
                            <option value="viewer">Viewer</option>
                        </select>
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
                            {mutation.isPending ? "Creating..." : "Create User"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
