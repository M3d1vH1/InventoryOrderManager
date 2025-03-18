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

// Define the form schema
const loginFormSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [background, setBackground] = useState<string>("gradient");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [logoColor, setLogoColor] = useState<string>("primary");

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
        title: "Login Successful",
        description: `Welcome, ${data.fullName}`,
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
        title: "Login Failed",
        description: error.message || "Invalid username or password",
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
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the warehouse management system
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
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your username" {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your password" 
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
                {isLoggingIn ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="w-full border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="appearance-toggle" className="text-sm font-medium">Dark Mode</Label>
              <Switch 
                id="appearance-toggle" 
                checked={darkMode} 
                onCheckedChange={setDarkMode} 
              />
            </div>

            <div className="flex flex-col gap-2 mb-2">
              <Label htmlFor="background-select" className="text-sm font-medium">Background Style</Label>
              <Select value={background} onValueChange={setBackground}>
                <SelectTrigger id="background-select">
                  <SelectValue placeholder="Select background style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gradient">Gradient</SelectItem>
                  <SelectItem value="pattern">Pattern</SelectItem>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="logo-color" className="text-sm font-medium">Logo Color</Label>
              <Select value={logoColor} onValueChange={setLogoColor}>
                <SelectTrigger id="logo-color">
                  <SelectValue placeholder="Select logo color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}