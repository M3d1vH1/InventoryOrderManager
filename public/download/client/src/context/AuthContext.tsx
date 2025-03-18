import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

// User interface matching the server response
export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'front_office' | 'warehouse';
  email: string | null;
  createdAt: string;
  lastLogin: string | null;
  active: boolean;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  hasPermission: (requiredRoles: string[]) => boolean;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: () => {},
  hasPermission: () => false,
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for tracking if initial load is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Fetch current user
  const { 
    data: user, 
    isLoading,
    error,
    refetch
  } = useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await apiRequest<User>('/api/user');
      } catch (error) {
        // Return null if unauthenticated to avoid error state
        if ((error as any).status === 401) {
          return null as any;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 15 * 60 * 1000, // Refresh token every 15 minutes
  });

  // Handle logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/logout', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(['currentUser'], null);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setLocation('/login');
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out',
      });
    },
    onError: (error) => {
      toast({
        title: 'Logout failed',
        description: (error as Error).message || 'An error occurred during logout',
        variant: 'destructive',
      });
    },
  });

  // Update initial load state
  useEffect(() => {
    if (!isLoading) {
      setInitialLoadComplete(true);
    }
  }, [isLoading]);

  // Check permissions
  const hasPermission = (requiredRoles: string[]): boolean => {
    if (!user) return false;
    return requiredRoles.includes(user.role);
  };

  // Check if user is authenticated and redirect if needed
  useEffect(() => {
    if (initialLoadComplete && !isLoading) {
      const currentPath = window.location.pathname;
      
      // If not logged in and not on login page, redirect to login
      if (!user && currentPath !== '/login') {
        setLocation('/login');
      }
      
      // If logged in and on login page, redirect based on role
      if (user && currentPath === '/login') {
        if (user.role === 'warehouse') {
          setLocation('/order-picking');
        } else {
          setLocation('/dashboard');
        }
      }
    }
  }, [user, initialLoadComplete, isLoading, setLocation]);

  // Prepare context value
  const value = {
    user: user ?? null, // Ensure user is User | null, not undefined
    isLoading: isLoading || !initialLoadComplete,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}