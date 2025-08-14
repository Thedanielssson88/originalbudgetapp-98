import { mockStackAuthService, type StackUser as MockStackUser, type AuthState as MockAuthState } from './mockStackAuthService';

// Debug environment variables
console.log('🔍 Stack Auth Debug Info:');
console.log('VITE_STACK_PROJECT_ID:', import.meta.env.VITE_STACK_PROJECT_ID);
console.log('VITE_STACK_PUBLISHABLE_CLIENT_KEY:', import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY);
console.log('All env vars:', import.meta.env);

// Try to import Stack Auth, fallback to mock if it fails
let StackClientApp: any = null;
let stackApp: any = null;
let useRealStackAuth = false;

try {
  console.log('🔄 Attempting to import Stack Auth...');
  const stackModule = await import('@stackframe/stack');
  StackClientApp = stackModule.StackClientApp;
  console.log('✅ Stack Auth module imported successfully');
  
  if (import.meta.env.VITE_STACK_PROJECT_ID && import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY) {
    console.log('🔄 Initializing Stack Auth with credentials...');
    stackApp = new StackClientApp({
      projectId: import.meta.env.VITE_STACK_PROJECT_ID,
      publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
    });
    useRealStackAuth = true;
    console.log('✅ Real Stack Auth initialized successfully');
  } else {
    console.warn('⚠️ Stack Auth environment variables missing');
    console.log('Missing PROJECT_ID:', !import.meta.env.VITE_STACK_PROJECT_ID);
    console.log('Missing CLIENT_KEY:', !import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY);
  }
} catch (error) {
  console.warn('⚠️ Stack Auth failed to initialize, using mock implementation:', error);
  useRealStackAuth = false;
}

interface StackUser {
  id: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: StackUser | null;
  isLoading: boolean;
}

class StackAuthService {
  private app = stackApp;

  /**
   * Get the Stack app instance
   */
  getApp() {
    return this.app;
  }

  /**
   * Check if Stack Auth is properly configured
   */
  isConfigured(): boolean {
    return useRealStackAuth ? !!this.app : mockStackAuthService.isConfigured();
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    if (!useRealStackAuth) {
      return await mockStackAuthService.getAuthState();
    }

    try {
      if (!this.app) {
        return {
          isAuthenticated: false,
          user: null,
          isLoading: false,
        };
      }

      const user = await this.app.getUser();
      
      return {
        isAuthenticated: !!user,
        user: user ? {
          id: user.id,
          email: user.primaryEmail || '',
          displayName: user.displayName,
          profileImageUrl: user.profileImageUrl,
        } : null,
        isLoading: false,
      };
    } catch (error) {
      console.error('Error getting auth state:', error);
      return {
        isAuthenticated: false,
        user: null,
        isLoading: false,
      };
    }
  }

  /**
   * Sign in with redirect
   */
  async signIn(): Promise<void> {
    if (!useRealStackAuth) {
      return await mockStackAuthService.signIn();
    }

    if (!this.app) {
      throw new Error('Stack Auth not configured');
    }

    try {
      await this.app.signInWithRedirect();
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (!useRealStackAuth) {
      return await mockStackAuthService.signOut();
    }

    if (!this.app) return;
    
    try {
      await this.app.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  /**
   * Configure database connection with Stack Auth user
   */
  async configureDatabaseAuth(): Promise<boolean> {
    if (!useRealStackAuth) {
      return await mockStackAuthService.configureDatabaseAuth();
    }

    const authState = await this.getAuthState();
    
    if (!authState.isAuthenticated || !authState.user) {
      throw new Error('User must be authenticated first');
    }

    try {
      // Get the user's access token for API calls
      const user = await this.app.getUser();
      const accessToken = await user?.getIdToken();

      // Send user info to backend to set up authenticated database connection
      const response = await fetch('/api/auth/configure-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          user: authState.user
        })
      });

      if (!response.ok) {
        throw new Error('Failed to configure database auth');
      }

      return true;
    } catch (error) {
      console.error('Failed to configure database auth:', error);
      return false;
    }
  }

  /**
   * Get user access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    if (!useRealStackAuth) {
      return await mockStackAuthService.getAccessToken();
    }

    if (!this.app) return null;
    
    try {
      const user = await this.app.getUser();
      if (!user) return null;
      
      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Check database configuration status
   */
  async getDatabaseStatus(): Promise<{
    isConfigured: boolean;
    connectionType: string;
    configuredAt: string | null;
    message: string;
  }> {
    if (!useRealStackAuth) {
      return await mockStackAuthService.getDatabaseStatus();
    }

    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/auth/database-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check database status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking database status:', error);
      return {
        isConfigured: false,
        connectionType: 'default',
        configuredAt: null,
        message: 'Could not check database status'
      };
    }
  }
}

export const stackAuthService = new StackAuthService();
export type { StackUser, AuthState };