import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Boxes, Lock, User } from "lucide-react";

type LoginFormValues = {
  username: string;
  password: string;
};

interface LoginResponse {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'front_office' | 'warehouse';
  email: string | null;
  createdAt: string;
  lastLogin: string | null;
  active: boolean;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loginFormSchema = z.object({
    username: z.string().min(1, { message: t("login.username") + " " + t("common.isRequired") }),
    password: z.string().min(1, { message: t("login.password") + " " + t("common.isRequired") }),
  });

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation<LoginResponse, Error, LoginFormValues>({
    mutationFn: async (values: LoginFormValues) => {
      return apiRequest<LoginResponse>('/api/login', {
        method: 'POST',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: t('login.loginSuccessful'),
        description: t('login.welcomeMessage', { name: data.fullName }),
      });
      if (data.role === 'warehouse') {
        setLocation('/order-picking');
      } else {
        setLocation('/dashboard');
      }
    },
    onError: (error) => {
      toast({
        title: t('login.loginFailed'),
        description: error.message || t('login.invalidCredentials'),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoggingIn(false);
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setIsLoggingIn(true);
    loginMutation.mutate(values);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-mesh-gradient bg-dot-pattern relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-teal-400/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-300/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative animate-scale-in">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-xl shadow-teal-500/25 mb-4">
            <Boxes size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WMS</h1>
          <p className="text-sm text-slate-400 mt-1">{t('login.credentials')}</p>
        </div>

        {/* Login card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-black/[0.06] p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">{t('login.title')}</h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">{t('login.username')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder={`${t('login.username')}...`}
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">{t('login.password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="password"
                          placeholder={`${t('login.password')}...`}
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('login.loggingIn')}
                  </span>
                ) : (
                  t('login.loginButton')
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Warehouse Management System
        </p>
      </div>
    </div>
  );
}
