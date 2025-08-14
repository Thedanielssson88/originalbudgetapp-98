// Mock Stack Auth Service for development/fallback when real Stack Auth fails

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

class MockStackAuthService {
  private mockUser: StackUser | null = null;
  private isAuth = false;

  /**
   * Check if Stack Auth is properly configured
   */
  isConfigured(): boolean {
    // Return true so UI shows, even if it's mock
    return true;
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    return {
      isAuthenticated: this.isAuth,
      user: this.mockUser,
      isLoading: false,
    };
  }

  /**
   * Sign in with mock data
   */
  async signIn(): Promise<void> {
    console.log('Mock Stack Auth: Sign in initiated');
    
    // Simulate sign in with mock user
    this.mockUser = {
      id: 'mock-user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      profileImageUrl: null,
    };
    this.isAuth = true;
    
    alert('Mock inloggning lyckades! (Detta är en demo-implementation)');
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    console.log('Mock Stack Auth: Sign out');
    this.mockUser = null;
    this.isAuth = false;
  }

  /**
   * Configure database connection with mock user
   */
  async configureDatabaseAuth(): Promise<boolean> {
    if (!this.isAuth || !this.mockUser) {
      throw new Error('User must be authenticated first');
    }

    console.log('Mock Stack Auth: Configuring database for:', this.mockUser.email);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  }

  /**
   * Get mock access token
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.isAuth) return null;
    return 'mock-access-token-123';
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
    return {
      isConfigured: this.isAuth,
      connectionType: 'mock',
      configuredAt: this.isAuth ? new Date().toISOString() : null,
      message: this.isAuth ? 'Mock database configured' : 'Not configured'
    };
  }
}

export const mockStackAuthService = new MockStackAuthService();
export type { StackUser, AuthState };