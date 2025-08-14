// Neon Auth Service using official Stack Auth React SDK
// Following the official Neon Auth React template approach

import { StackClientApp } from '@stackframe/stack';

interface NeonUser {
  id: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: NeonUser | null;
  isLoading: boolean;
}

class NeonAuthServiceSDK {
  private stackApp: StackClientApp | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    console.log('🔍 Initializing Neon Auth Service with Stack SDK...');
    
    const projectId = import.meta.env.VITE_STACK_PROJECT_ID;
    const publishableKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY;
    
    console.log('📋 Configuration check:');
    console.log('  - Project ID:', projectId ? `✅ ${projectId.substring(0, 8)}...` : '❌ Missing');
    console.log('  - Publishable Key:', publishableKey ? `✅ ${publishableKey.substring(0, 8)}...` : '❌ Missing');
    
    if (projectId && publishableKey) {
      try {
        this.stackApp = new StackClientApp({
          projectId: projectId,
          publishableClientKey: publishableKey,
        });
        this.isInitialized = true;
        console.log('✅ Stack Auth SDK initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Stack Auth SDK:', error);
        this.isInitialized = false;
      }
    } else {
      console.error('❌ Missing environment variables for Stack Auth');
      this.isInitialized = false;
    }
  }

  /**
   * Check if Neon Auth is configured
   */
  isConfigured(): boolean {
    return this.isInitialized && !!this.stackApp;
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    if (!this.isConfigured()) {
      return {
        isAuthenticated: false,
        user: null,
        isLoading: false,
      };
    }

    try {
      const user = await this.stackApp!.getUser();
      
      if (user) {
        return {
          isAuthenticated: true,
          user: {
            id: user.id,
            email: user.primaryEmail || '',
            displayName: user.displayName,
            profileImageUrl: user.profileImageUrl,
          },
          isLoading: false,
        };
      } else {
        return {
          isAuthenticated: false,
          user: null,
          isLoading: false,
        };
      }
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
   * Sign in with redirect (OAuth flow)
   */
  async signIn(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    try {
      console.log('🔄 Starting OAuth sign-in flow...');
      await this.stackApp!.signInWithRedirect();
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  }

  /**
   * Sign up with redirect (OAuth flow)
   */
  async signUp(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    try {
      console.log('🔄 Starting OAuth sign-up flow...');
      await this.stackApp!.signUpWithRedirect();
    } catch (error) {
      console.error('Sign up failed:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      await this.stackApp!.signOut();
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Configure database auth
   */
  async configureDatabaseAuth(): Promise<boolean> {
    const authState = await this.getAuthState();
    
    if (!authState.isAuthenticated || !authState.user) {
      throw new Error('User must be authenticated first');
    }

    try {
      // Get the user's access token for API calls
      const accessToken = await this.getAccessToken();

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
    if (!this.isConfigured()) {
      return null;
    }
    
    try {
      const user = await this.stackApp!.getUser();
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
    try {
      const token = await this.getAccessToken();
      if (!token) {
        return {
          isConfigured: false,
          connectionType: 'none',
          configuredAt: null,
          message: 'Not authenticated'
        };
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
        connectionType: 'unknown',
        configuredAt: null,
        message: 'Could not check status'
      };
    }
  }
}

export const neonAuthServiceSDK = new NeonAuthServiceSDK();
export type { NeonUser, AuthState };