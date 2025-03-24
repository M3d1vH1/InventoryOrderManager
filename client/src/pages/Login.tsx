import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

// Define the login form schema type
type LoginFormValues = {
  username: string;
  password: string;
};

// Interface for login response
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
  const [background, setBackground] = useState<string>("gradient");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [logoColor, setLogoColor] = useState<string>("primary");

  // Create validation schema with translations
  const loginFormSchema = z.object({
    username: z.string().min(1, { message: t("login.username") + " " + t("common.isRequired") }),
    password: z.string().min(1, { message: t("login.password") + " " + t("common.isRequired") }),
  });

  // Initialize form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Save preferences to localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('loginPreferences');
    if (savedPreferences) {
      const { background, darkMode, logoColor } = JSON.parse(savedPreferences);
      setBackground(background || 'gradient');
      setDarkMode(darkMode || false);
      setLogoColor(logoColor || 'primary');
    }
  }, []);
  
  // Update localStorage when preferences change
  useEffect(() => {
    localStorage.setItem('loginPreferences', JSON.stringify({
      background,
      darkMode,
      logoColor
    }));
    
    // Apply dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [background, darkMode, logoColor]);

  // Handle login mutation
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
      
      // Redirect based on role
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

  // Handle form submission
  const onSubmit = (values: LoginFormValues) => {
    setIsLoggingIn(true);
    loginMutation.mutate(values);
  };

  // Get background style based on selection
  const getBackgroundStyle = () => {
    switch(background) {
      case 'gradient':
        return 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500';
      case 'pattern':
        return 'bg-grid-pattern bg-background';
      case 'solid':
        return 'bg-primary/5';
      default:
        return 'bg-background';
    }
  };

  // Get logo color style based on selection
  const getLogoColorStyle = () => {
    switch(logoColor) {
      case 'primary':
        return 'text-primary';
      case 'blue':
        return 'text-blue-500';
      case 'green':
        return 'text-green-500';
      case 'red':
        return 'text-red-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 ${getBackgroundStyle()}`}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className={`text-4xl font-bold ${getLogoColorStyle()}`}>WMS</div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">{t('login.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('login.credentials')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login.username')}</FormLabel>
                    <FormControl>
                      <Input placeholder={`${t('login.username')}...`} {...field} />
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
                    <FormLabel>{t('login.password')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={`${t('login.password')}...`} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? t('login.loggingIn') : t('login.loginButton')}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="w-full border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="appearance-toggle" className="text-sm font-medium">{t('login.preferences.darkMode')}</Label>
              <Switch 
                id="appearance-toggle" 
                checked={darkMode} 
                onCheckedChange={setDarkMode} 
              />
            </div>

            <div className="flex flex-col gap-2 mb-2">
              <Label htmlFor="background-select" className="text-sm font-medium">{t('login.preferences.backgroundStyle')}</Label>
              <Select value={background} onValueChange={setBackground}>
                <SelectTrigger id="background-select">
                  <SelectValue placeholder={t('login.preferences.selectBackgroundStyle')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gradient">{t('login.preferences.gradient')}</SelectItem>
                  <SelectItem value="pattern">{t('login.preferences.pattern')}</SelectItem>
                  <SelectItem value="solid">{t('login.preferences.solid')}</SelectItem>
                  <SelectItem value="none">{t('login.preferences.none')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="logo-color" className="text-sm font-medium">{t('login.preferences.logoColor')}</Label>
              <Select value={logoColor} onValueChange={setLogoColor}>
                <SelectTrigger id="logo-color">
                  <SelectValue placeholder={t('login.preferences.selectLogoColor')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">{t('login.preferences.primary')}</SelectItem>
                  <SelectItem value="blue">{t('login.preferences.blue')}</SelectItem>
                  <SelectItem value="green">{t('login.preferences.green')}</SelectItem>
                  <SelectItem value="red">{t('login.preferences.red')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}