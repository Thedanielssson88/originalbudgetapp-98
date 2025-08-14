import { useState, useEffect, useCallback } from 'react';
import { googleAuthService, type GoogleUser, type AuthState } from '@/services/googleAuthService';

interface UseGoogleAuthReturn {
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: GoogleUser | null;
  isLoading: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => void;
  configureDatabaseAuth: () => Promise<boolean>;
}

export function useGoogleAuth(): UseGoogleAuthReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        const initialized = await googleAuthService.initialize();
        setIsInitialized(initialized);
        
        // Get initial auth state
        const initialState = googleAuthService.getAuthState();
        setAuthState(initialState);
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
        setError('Failed to initialize Google authentication');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = googleAuthService.subscribe((newState) => {
      setAuthState(newState);
      setError(null);
    });

    return unsubscribe;
  }, []);

  // Sign in function
  const signIn = useCallback(async (): Promise<boolean> => {
    if (!isInitialized) {
      setError('Google Auth not initialized');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const success = await googleAuthService.signIn();
      
      if (!success) {
        setError('Failed to sign in with Google');
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Sign in failed: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Sign out function
  const signOut = useCallback(() => {
    try {
      googleAuthService.signOut();
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Sign out failed: ${errorMessage}`);
    }
  }, []);

  // Configure database auth
  const configureDatabaseAuth = useCallback(async (): Promise<boolean> => {
    if (!authState.isAuthenticated) {
      setError('Must be authenticated to configure database');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const success = await googleAuthService.configureDatabaseAuth();
      
      if (!success) {
        setError('Failed to configure database authentication');
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Database configuration failed: ${errorMessage}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated]);

  return {
    isInitialized,
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    isLoading,
    error,
    signIn,
    signOut,
    configureDatabaseAuth
  };
}