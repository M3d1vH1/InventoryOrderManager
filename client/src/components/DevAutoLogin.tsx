import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Component for development-only auto-login
 * This is ONLY for testing purposes and will not be included in production
 */
export function DevAutoLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Check login status on mount
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const user = await apiRequest('/api/user');
        if (user && user.id) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        // Not logged in, that's okay
        setIsLoggedIn(false);
      }
    };

    checkLoginStatus();
  }, []);

  const handleAutoLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/dev-login');
      
      if (response && response.success) {
        setIsLoggedIn(true);
        
        // Invalidate the user query to trigger a refetch
        queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        
        toast.toast({
          title: 'Auto Login Successful',
          description: `Logged in as ${response.user.username}`,
        });
      }
    } catch (error) {
      console.error('Auto login failed:', error);
      toast.toast({
        title: 'Auto Login Failed',
        description: 'Could not complete auto login. See console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoggedIn) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900 p-2 rounded shadow-md z-50">
        <div className="text-sm text-green-700 dark:text-green-300 font-medium">
          ✓ Logged in
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-red-100 dark:bg-red-900 p-2 rounded shadow-md z-50">
      <Button 
        variant="destructive" 
        size="sm" 
        onClick={handleAutoLogin}
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Dev Login'}
      </Button>
    </div>
  );
}