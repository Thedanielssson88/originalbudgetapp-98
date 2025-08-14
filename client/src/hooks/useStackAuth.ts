import { useState, useEffect, useCallback } from 'react';
import { neonAuthVite, type NeonUser, type AuthState } from '@/services/neonAuthVite';

interface UseStackAuthReturn {
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: NeonUser | null;
  isLoading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  configureDatabaseAuth: () => Promise<boolean>;
  getDatabaseStatus: () => Promise<{
    isConfigured: boolean;
    connectionType: string;
    configuredAt: string | null;
    message: string;
  }>;
}

export function useStackAuth(): UseStackAuthReturn {
  const [isConfigured] = useState(neonAuthVite.isConfigured());
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Load initial auth state
  useEffect(() => {
    const loadAuthState = async () => {
      if (!isConfigured) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
        return;
      }

      try {
        const state = await neonAuthVite.getAuthState();
        setAuthState(state);
        setError(null);
      } catch (error) {
        console.error('Failed to load auth state:', error);
        setError('Failed to load authentication state');
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    };

    loadAuthState();
  }, [isConfigured]);

  // Listen for auth changes (Stack Auth provides this automatically)
  useEffect(() => {
    if (!isConfigured) return;

    const checkAuthState = async () => {
      try {
        const state = await neonAuthVite.getAuthState();
        setAuthState(state);
        setError(null);
      } catch (error) {
        console.error('Auth state check failed:', error);
      }
    };

    // Check auth state periodically
    const interval = setInterval(checkAuthState, 5000);
    
    return () => clearInterval(interval);
  }, [isConfigured]);

  // Sign in function
  const signIn = useCallback(async (): Promise<void> => {
    if (!isConfigured) {
      setError('Stack Auth not configured');
      return;
    }

    try {
      setError(null);
      await neonAuthVite.signIn();
      // The redirect will handle the rest
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Sign in failed: ${errorMessage}`);
      throw error;
    }
  }, [isConfigured]);

  // Sign out function
  const signOut = useCallback(async (): Promise<void> => {
    try {
      await neonAuthVite.signOut();
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Sign out failed: ${errorMessage}`);
      throw error;
    }
  }, []);

  // Configure database auth
  const configureDatabaseAuth = useCallback(async (): Promise<boolean> => {
    if (!authState.isAuthenticated) {
      setError('Must be authenticated to configure database');
      return false;
    }

    try {
      setError(null);
      const success = await neonAuthVite.configureDatabaseAuth();
      
      if (!success) {
        setError('Failed to configure database authentication');
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Database configuration failed: ${errorMessage}`);
      return false;
    }
  }, [authState.isAuthenticated]);

  // Get database status
  const getDatabaseStatus = useCallback(async () => {
    try {
      return await neonAuthVite.getDatabaseStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to get database status: ${errorMessage}`);
      return {
        isConfigured: false,
        connectionType: 'default',
        configuredAt: null,
        message: 'Could not check database status'
      };
    }
  }, []);

  return {
    isConfigured,
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    isLoading: authState.isLoading,
    error,
    signIn,
    signOut,
    configureDatabaseAuth,
    getDatabaseStatus
  };
}