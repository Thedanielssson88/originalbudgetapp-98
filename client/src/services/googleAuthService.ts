interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: GoogleUser | null;
  token: string | null;
}

class GoogleAuthService {
  private clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null
  };
  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.loadStoredAuth();
  }

  /**
   * Initialize Google Auth API
   */
  async initialize(): Promise<boolean> {
    if (!this.clientId) {
      console.warn('Google Client ID not configured');
      return false;
    }

    try {
      // Load Google Identity Services script if not already loaded
      if (!window.google?.accounts) {
        await this.loadGoogleScript();
      }

      // Initialize Google Identity Services
      window.google.accounts.id.initialize({
        client_id: this.clientId,
        callback: this.handleCredentialResponse.bind(this),
        auto_select: false,
        cancel_on_tap_outside: true
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize Google Auth:', error);
      return false;
    }
  }

  /**
   * Sign in with Google
   */
  async signIn(): Promise<boolean> {
    try {
      return new Promise((resolve, reject) => {
        if (!window.google?.accounts) {
          reject(new Error('Google API not loaded'));
          return;
        }

        // Show the Google One Tap prompt
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to popup if One Tap is not available
            this.signInWithPopup()
              .then(resolve)
              .catch(reject);
          }
        });

        // Set a timeout for the One Tap flow
        setTimeout(() => {
          if (!this.authState.isAuthenticated) {
            this.signInWithPopup()
              .then(resolve)
              .catch(reject);
          } else {
            resolve(true);
          }
        }, 3000);
      });
    } catch (error) {
      console.error('Google sign in failed:', error);
      return false;
    }
  }

  /**
   * Sign in with popup (fallback method)
   */
  private async signInWithPopup(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google OAuth2 not available'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'email profile',
        callback: (response: any) => {
          if (response.access_token) {
            this.fetchUserInfo(response.access_token)
              .then((user) => {
                this.updateAuthState({
                  isAuthenticated: true,
                  user,
                  token: response.access_token
                });
                resolve(true);
              })
              .catch(reject);
          } else {
            reject(new Error('No access token received'));
          }
        },
        error_callback: (error: any) => {
          reject(error);
        }
      });

      client.requestAccessToken();
    });
  }

  /**
   * Handle credential response from One Tap
   */
  private async handleCredentialResponse(response: any) {
    try {
      // Decode JWT token to get user info
      const user = this.decodeJWT(response.credential);
      
      this.updateAuthState({
        isAuthenticated: true,
        user,
        token: response.credential
      });
    } catch (error) {
      console.error('Failed to handle credential response:', error);
    }
  }

  /**
   * Fetch user info from Google API
   */
  private async fetchUserInfo(accessToken: string): Promise<GoogleUser> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture
    };
  }

  /**
   * Decode JWT token (simplified)
   */
  private decodeJWT(token: string): GoogleUser {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      };
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Sign out
   */
  signOut(): void {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    this.updateAuthState({
      isAuthenticated: false,
      user: null,
      token: null
    });

    localStorage.removeItem('google_auth_state');
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current user
   */
  getCurrentUser(): GoogleUser | null {
    return this.authState.user;
  }

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Update auth state and notify listeners
   */
  private updateAuthState(newState: AuthState): void {
    this.authState = { ...newState };
    
    // Store in localStorage
    localStorage.setItem('google_auth_state', JSON.stringify(this.authState));
    
    // Notify all listeners
    this.listeners.forEach(listener => listener(this.authState));
  }

  /**
   * Load stored auth state from localStorage
   */
  private loadStoredAuth(): void {
    try {
      const stored = localStorage.getItem('google_auth_state');
      if (stored) {
        const state = JSON.parse(stored);
        // Only restore if it seems valid (has user and token)
        if (state.isAuthenticated && state.user && state.token) {
          this.authState = state;
        }
      }
    } catch (error) {
      console.warn('Failed to load stored auth state:', error);
      localStorage.removeItem('google_auth_state');
    }
  }

  /**
   * Load Google Identity Services script
   */
  private loadGoogleScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.getElementById('google-identity-services')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google script'));
      document.head.appendChild(script);
    });
  }

  /**
   * Get auth token for API calls
   */
  getAuthToken(): string | null {
    return this.authState.token;
  }

  /**
   * Configure database connection with auth
   */
  async configureDatabaseAuth(): Promise<boolean> {
    if (!this.isAuthenticated() || !this.authState.user) {
      throw new Error('User must be authenticated first');
    }

    try {
      // Send user info to backend to set up authenticated database connection
      const response = await fetch('/api/auth/configure-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          user: this.authState.user
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
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          disableAutoSelect: () => void;
        };
        oauth2: {
          initTokenClient: (config: any) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

export const googleAuthService = new GoogleAuthService();
export type { GoogleUser, AuthState };