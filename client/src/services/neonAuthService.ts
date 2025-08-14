// Real Neon Auth Service using Stack Auth React SDK
// Following the official Neon Auth React template approach

interface NeonUser {
  id: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: NeonUser | null;
  isLoading: boolean;
}

class NeonAuthService {
  private projectId: string;
  private publishableKey: string;
  private baseUrl = 'https://api.stack-auth.com/api/v1';
  private currentUser: NeonUser | null = null;
  private authToken: string | null = null;

  constructor() {
    console.log('🔍 Neon Auth Service initializing...');
    
    this.projectId = import.meta.env.VITE_STACK_PROJECT_ID || '';
    this.publishableKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY || '';
    
    console.log('📋 Configuration status:');
    console.log('  - Project ID:', this.projectId ? `✅ ${this.projectId.substring(0, 8)}...` : '❌ Missing');
    console.log('  - Publishable Key:', this.publishableKey ? `✅ ${this.publishableKey.substring(0, 8)}...` : '❌ Missing');
    console.log('  - Is Configured:', this.isConfigured());
    
    // Load stored auth state
    this.loadStoredAuth();
  }

  /**
   * Check if Neon Auth is configured
   */
  isConfigured(): boolean {
    return !!(this.projectId && this.publishableKey);
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

    return {
      isAuthenticated: !!this.currentUser,
      user: this.currentUser,
      isLoading: false,
    };
  }

  /**
   * Sign in by redirecting to Neon Auth
   */
  async signIn(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    const redirectUrl = `${this.baseUrl}/projects/${this.projectId}/oauth/authorize?` +
      `client_id=${this.publishableKey}&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback')}&` +
      `response_type=code&` +
      `scope=email profile`;

    console.log('🔄 Redirecting to Neon Auth:', redirectUrl);
    window.location.href = redirectUrl;
  }

  /**
   * Handle callback from Neon Auth
   */
  async handleCallback(code: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/projects/${this.projectId}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stack-Publishable-Client-Key': this.publishableKey,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: window.location.origin + '/auth/callback',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await response.json();
      this.authToken = tokenData.access_token;

      // Get user info
      const userResponse = await fetch(`${this.baseUrl}/projects/${this.projectId}/current-user`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-Stack-Publishable-Client-Key': this.publishableKey,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();
      this.currentUser = {
        id: userData.id,
        email: userData.primaryEmail || userData.email,
        displayName: userData.displayName,
        profileImageUrl: userData.profileImageUrl,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      };

      this.storeAuth();
      return true;
    } catch (error) {
      console.error('Auth callback failed:', error);
      return false;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    this.currentUser = null;
    this.authToken = null;
    this.clearStoredAuth();

    // Optional: Call Neon Auth logout endpoint
    if (this.isConfigured()) {
      try {
        await fetch(`${this.baseUrl}/projects/${this.projectId}/oauth/logout`, {
          method: 'POST',
          headers: {
            'X-Stack-Publishable-Client-Key': this.publishableKey,
          },
        });
      } catch (error) {
        console.warn('Logout API call failed:', error);
      }
    }
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    return this.authToken;
  }

  /**
   * Configure database auth
   */
  async configureDatabaseAuth(): Promise<boolean> {
    if (!this.currentUser || !this.authToken) {
      throw new Error('User must be authenticated first');
    }

    try {
      const response = await fetch('/api/auth/configure-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          user: this.currentUser,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Database configuration failed:', error);
      return false;
    }
  }

  /**
   * Get database status
   */
  async getDatabaseStatus(): Promise<{
    isConfigured: boolean;
    connectionType: string;
    configuredAt: string | null;
    message: string;
  }> {
    try {
      if (!this.authToken) {
        return {
          isConfigured: false,
          connectionType: 'none',
          configuredAt: null,
          message: 'Not authenticated',
        };
      }

      const response = await fetch('/api/auth/database-status', {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Database status check failed:', error);
    }

    return {
      isConfigured: false,
      connectionType: 'unknown',
      configuredAt: null,
      message: 'Could not check status',
    };
  }

  /**
   * Store auth state in localStorage
   */
  private storeAuth(): void {
    const authData = {
      user: this.currentUser,
      token: this.authToken,
      timestamp: Date.now(),
    };
    localStorage.setItem('neon_auth_state', JSON.stringify(authData));
  }

  /**
   * Load auth state from localStorage
   */
  private loadStoredAuth(): void {
    try {
      const stored = localStorage.getItem('neon_auth_state');
      if (!stored) return;

      const authData = JSON.parse(stored);
      
      // Check if token is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - authData.timestamp > maxAge) {
        this.clearStoredAuth();
        return;
      }

      this.currentUser = authData.user;
      this.authToken = authData.token;
    } catch (error) {
      console.warn('Failed to load stored auth:', error);
      this.clearStoredAuth();
    }
  }

  /**
   * Clear stored auth state
   */
  private clearStoredAuth(): void {
    localStorage.removeItem('neon_auth_state');
  }

  /**
   * Create a simple sign-up form (for demo)
   */
  async createUser(email: string, password: string, displayName?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    try {
      console.log('Creating user with:', {
        url: `${this.baseUrl}/projects/${this.projectId}/users`,
        projectId: this.projectId,
        publishableKey: this.publishableKey ? this.publishableKey.substring(0, 8) + '...' : 'missing',
        email: email
      });

      const response = await fetch(`${this.baseUrl}/projects/${this.projectId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stack-Publishable-Client-Key': this.publishableKey,
        },
        body: JSON.stringify({
          primaryEmail: email,
          password: password,
          displayName: displayName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create user API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        
        let errorMessage = 'Failed to create user';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status}: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const userData = await response.json();
      console.log('User created successfully:', userData);
      
      // Auto sign-in after creation
      return await this.signInWithPassword(email, password);
    } catch (error) {
      console.error('User creation failed:', error);
      console.warn('🔄 Stack Auth direct API failed, this might be because:');
      console.warn('1. The credentials are configured for OAuth flow only');
      console.warn('2. The API endpoints have changed');
      console.warn('3. Additional authentication is required');
      console.warn('For now, please use the OAuth Redirect option instead.');
      throw error;
    }
  }

  /**
   * Sign in with email/password
   */
  async signInWithPassword(email: string, password: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/projects/${this.projectId}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Stack-Publishable-Client-Key': this.publishableKey,
        },
        body: JSON.stringify({
          grant_type: 'password',
          username: email,
          password: password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Sign in API error:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        
        let errorMessage = 'Invalid credentials';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status}: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const tokenData = await response.json();
      this.authToken = tokenData.access_token;

      // Get user info
      const userResponse = await fetch(`${this.baseUrl}/projects/${this.projectId}/current-user`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-Stack-Publishable-Client-Key': this.publishableKey,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();
      this.currentUser = {
        id: userData.id,
        email: userData.primaryEmail || userData.email,
        displayName: userData.displayName,
        profileImageUrl: userData.profileImageUrl,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      };

      this.storeAuth();
      return true;
    } catch (error) {
      console.error('Password sign in failed:', error);
      return false;
    }
  }
}

export const neonAuthService = new NeonAuthService();
export type { NeonUser, AuthState };