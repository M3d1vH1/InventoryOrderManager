import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

// Define User type
export type User = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

// Context type
type UserContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetchUser: () => void;
};

// Create context with default values
const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: false,
  error: null,
  refetchUser: () => {}
});

// Context provider component
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);

  // Query for fetching user data
  const { 
    data, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['/api/user'],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user state when data changes
  useEffect(() => {
    if (data) {
      setUser(data as User);
    }
  }, [data]);

  const value = {
    user,
    isLoading,
    error: error as Error,
    refetchUser: refetch
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook for using the user context
export const useUser = () => useContext(UserContext);