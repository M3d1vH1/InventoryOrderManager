import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../lib/trpc";

export const Route = createFileRoute("/login")({
    component: LoginPage,
});

function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const loginMutation = trpc.auth.login.useMutation({
        onSuccess: () => {
            navigate({ to: "/" });
        },
        onError: (err) => {
            setError(err.message);
        },
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        loginMutation.mutate({ username, password });
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Amphoreus</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Warehouse Management System
                    </p>
                </div>

                {/* Login Card */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Error message */}
                        {error && (
                            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Username */}
                        <div className="space-y-1">
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                autoFocus
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                           placeholder-gray-400 shadow-sm
                           focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Enter your username"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1">
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                           placeholder-gray-400 shadow-sm
                           focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Enter your password"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium
                         text-white shadow-sm hover:bg-blue-700
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loginMutation.isPending ? "Signing in..." : "Sign in"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
