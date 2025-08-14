// Vite-compatible Neon Auth Service
// Custom implementation that works with React + Vite (not Next.js)

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

class NeonAuthViteService {
  private projectId: string;
  private publishableKey: string;
  private baseUrl = 'https://api.stack-auth.com/api/v1';
  private authUrl = 'https://app.stack-auth.com';
  private currentUser: NeonUser | null = null;
  private authToken: string | null = null;

  constructor() {
    console.log('🔍 Initializing Neon Auth Service (Vite-compatible)...');
    
    this.projectId = import.meta.env.VITE_STACK_PROJECT_ID || '';
    this.publishableKey = import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY || '';
    
    console.log('📋 Configuration status:');
    console.log('  - Project ID:', this.projectId ? `✅ ${this.projectId.substring(0, 8)}...` : '❌ Missing');
    console.log('  - Publishable Key:', this.publishableKey ? `✅ ${this.publishableKey.substring(0, 8)}...` : '❌ Missing');
    console.log('  - Is Configured:', this.isConfigured());
    
    // Load stored auth state and check for OAuth callback
    this.loadStoredAuth();
    this.handleOAuthCallback();
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

    // If we have a stored user and token, validate it
    if (this.currentUser && this.authToken) {
      try {
        // Validate token by making a simple API call
        const response = await fetch(`${this.baseUrl}/projects/${this.projectId}/current-user`, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'X-Stack-Publishable-Client-Key': this.publishableKey,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          this.currentUser = {
            id: userData.id,
            email: userData.primaryEmail || userData.email || '',
            displayName: userData.displayName || null,
            profileImageUrl: userData.profileImageUrl || null,
          };

          return {
            isAuthenticated: true,
            user: this.currentUser,
            isLoading: false,
          };
        } else {
          // Token is invalid, clear stored auth
          this.clearStoredAuth();
        }
      } catch (error) {
        console.error('Error validating auth state:', error);
        this.clearStoredAuth();
      }
    }

    return {
      isAuthenticated: false,
      user: null,
      isLoading: false,
    };
  }

  /**
   * Sign in with OAuth redirect
   */
  async signIn(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const state = this.generateRandomString();
    
    // Store state for CSRF protection
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = `${this.authUrl}/handler/oauth/authorize?` +
      `project_id=${this.projectId}&` +
      `client_id=${this.publishableKey}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=openid profile email&` +
      `state=${state}`;

    console.log('🔄 Redirecting to OAuth sign in:', authUrl);
    window.location.href = authUrl;
  }

  /**
   * Sign up with OAuth redirect
   */
  async signUp(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Neon Auth not configured');
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const state = this.generateRandomString();
    
    // Store state for CSRF protection
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = `${this.authUrl}/handler/oauth/authorize?` +
      `project_id=${this.projectId}&` +
      `client_id=${this.publishableKey}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=openid profile email&` +
      `state=${state}&` +
      `mode=signup`;

    console.log('🔄 Redirecting to OAuth sign up:', authUrl);
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback
   */
  private async handleOAuthCallback(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      alert(`Authentication error: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && state) {
      const storedState = sessionStorage.getItem('oauth_state');
      sessionStorage.removeItem('oauth_state');

      if (state !== storedState) {
        console.error('OAuth state mismatch - possible CSRF attack');
        alert('Authentication failed: Security validation error');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      try {
        console.log('🔄 Processing OAuth callback...');
        await this.exchangeCodeForToken(code);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        console.log('✅ OAuth authentication successful!');
      } catch (error) {
        console.error('OAuth callback failed:', error);
        alert('Authentication failed. Please try again.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<void> {
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    
    const response = await fetch(`${this.baseUrl}/projects/${this.projectId}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stack-Publishable-Client-Key': this.publishableKey,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.publishableKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
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
      email: userData.primaryEmail || userData.email || '',
      displayName: userData.displayName || null,
      profileImageUrl: userData.profileImageUrl || null,
    };

    this.storeAuth();
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    this.currentUser = null;
    this.authToken = null;
    this.clearStoredAuth();
    console.log('✅ Signed out successfully');
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
      const response = await fetch('/api/auth/configure-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          user: authState.user
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Database configuration failed:', error);
      return false;
    }
  }

  /**
   * Get access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    return this.authToken;
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
   * Generate random string for OAuth state parameter
   */
  private generateRandomString(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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
    this.currentUser = null;
    this.authToken = null;
  }
}

export const neonAuthVite = new NeonAuthViteService();
export type { NeonUser, AuthState };