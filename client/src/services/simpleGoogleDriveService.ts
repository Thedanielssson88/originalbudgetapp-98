// Simple Google Drive integration with OAuth2 popup login
import { StorageKey, getDirectly, setDirectly, removeDirectly } from './storageService';

interface BackupData {
  accounts: any[];
  huvudkategorier: any[];
  underkategorier: any[];
  categoryRules: any[];
  transactions: any[];
  budgetPosts: any[];
  monthlyBudgets: any[];
  banks: any[];
  bankCsvMappings: any[];
  exportDate: string;
  version: string;
}

class SimpleGoogleDriveService {
  private isSignedIn = false;
  private userEmail = '';
  private accessToken = '';

  async initialize(): Promise<boolean> {
    try {
      console.log('[GoogleDrive] 🚀 Initializing simple Google Drive service...');
      
      // Check if user is already logged in
      const savedToken = getDirectly('googleDriveAccessToken');
      const savedEmail = getDirectly('googleDriveUserEmail');
      
      if (savedToken && savedEmail) {
        // Testa om token fortfarande fungerar
        const isValid = await this.validateToken(savedToken);
        if (isValid) {
          this.accessToken = savedToken;
          this.userEmail = savedEmail;
          this.isSignedIn = true;
          console.log('[GoogleDrive] ✅ Restored existing session for:', savedEmail);
        } else {
          // Clear invalid tokens
          removeDirectly('googleDriveAccessToken');
          removeDirectly('googleDriveUserEmail');
        }
      }
      
      return true;
    } catch (error) {
      console.error('[GoogleDrive] ❌ Initialization failed:', error);
      return false;
    }
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async signIn(): Promise<boolean> {
    try {
      console.log('[GoogleDrive] 🔐 Starting Google OAuth2 flow...');
      
      // Google OAuth2 parameters
      const clientId = '764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com';
      const redirectUri = window.location.origin + '/oauth/google';
      const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
      const responseType = 'token';
      
      // Skapa OAuth2 URL
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=${responseType}&` +
        `include_granted_scopes=true&` +
        `state=budget_calculator`;

      // Öppna popup-fönster för inloggning
      const popup = window.open(
        authUrl,
        'google_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blockerad. Tillåt popups för denna sida.');
      }

      // Vänta på att användaren loggar in
      return new Promise((resolve) => {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            resolve(false);
          }
        }, 1000);

        // Lyssna på meddelanden från popup
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            popup.close();
            
            this.accessToken = event.data.accessToken;
            this.userEmail = event.data.email;
            this.isSignedIn = true;
            
            // Spara session
            setDirectly('googleDriveAccessToken', this.accessToken);
            setDirectly('googleDriveUserEmail', this.userEmail);
            
            console.log('[GoogleDrive] ✅ Successfully signed in:', this.userEmail);
            resolve(true);
          } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            popup.close();
            console.error('[GoogleDrive] ❌ OAuth error:', event.data.error);
            resolve(false);
          }
        };

        window.addEventListener('message', messageHandler);
      });
    } catch (error) {
      console.error('[GoogleDrive] ❌ Sign in failed:', error);
      return false;
    }
  }

  async signOut(): Promise<void> {
    try {
      console.log('[GoogleDrive] 🚪 Signing out...');
      
      // Revoke token
      if (this.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: 'POST'
        });
      }
      
      // Rensa lokal data
      this.accessToken = '';
      this.userEmail = '';
      this.isSignedIn = false;
      
      removeDirectly('googleDriveAccessToken');
      removeDirectly('googleDriveUserEmail');
      
      console.log('[GoogleDrive] ✅ Successfully signed out');
    } catch (error) {
      console.error('[GoogleDrive] ❌ Sign out error:', error);
    }
  }

  getSignInStatus() {
    return {
      isSignedIn: this.isSignedIn,
      userEmail: this.userEmail
    };
  }

  async createBackup(): Promise<boolean> {
    if (!this.isSignedIn) {
      console.warn('[GoogleDrive] ⚠️ Not signed in - cannot create backup');
      return false;
    }

    try {
      console.log('[GoogleDrive] 💾 Creating backup...');
      
      // Get all data from API instead of localStorage
      const apiResponse = await fetch('/api/bootstrap');
      if (!apiResponse.ok) {
        throw new Error('Failed to fetch data for backup');
      }
      
      const apiData = await apiResponse.json();
      const backupData: BackupData = {
        ...apiData,
        exportDate: new Date().toISOString(),
        version: '3.0' // Updated version for API-based backups
      };

      // Skapa fil i Google Drive
      const metadata = {
        name: 'budget-calculator-backup.json',
        parents: ['appDataFolder'] // Använd app-specifik mapp
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: form
      });

      if (uploadResponse.ok) {
        console.log('[GoogleDrive] ✅ Backup created successfully');
        return true;
      } else {
        console.error('[GoogleDrive] ❌ Backup creation failed:', await uploadResponse.text());
        return false;
      }
    } catch (error) {
      console.error('[GoogleDrive] ❌ Backup creation error:', error);
      return false;
    }
  }

  async restoreBackup(): Promise<boolean> {
    if (!this.isSignedIn) {
      console.warn('[GoogleDrive] ⚠️ Not signed in - cannot restore backup');
      return false;
    }

    try {
      console.log('[GoogleDrive] 📥 Restoring backup...');
      
      // Hitta backup-filen
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='budget-calculator-backup.json' and parents in 'appDataFolder'&orderBy=modifiedTime desc`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const searchData = await searchResponse.json();
      
      if (!searchData.files || searchData.files.length === 0) {
        console.warn('[GoogleDrive] ⚠️ No backup found');
        return false;
      }

      const fileId = searchData.files[0].id;
      
      // Ladda ner backup-data
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!downloadResponse.ok) {
        console.error('[GoogleDrive] ❌ Download failed:', await downloadResponse.text());
        return false;
      }

      const backupData: BackupData = await downloadResponse.json();
      
      // Restore data via API instead of localStorage
      console.log('[GoogleDrive] 🔄 Restoring data via API...');
      
      // Check backup version
      if (backupData.version && backupData.version.startsWith('3.')) {
        // New API-based backup format
        await this.restoreFromApiBackup(backupData);
      } else {
        // Legacy localStorage backup - convert to API format
        console.warn('[GoogleDrive] ⚠️ Legacy backup detected, conversion not implemented yet');
        return false;
      }

      console.log('[GoogleDrive] ✅ Backup restored successfully');
      return true;
    } catch (error) {
      console.error('[GoogleDrive] ❌ Backup restoration error:', error);
      return false;
    }
  }

  async checkBackupExists(): Promise<boolean> {
    if (!this.isSignedIn) return false;

    try {
      const checkResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='budget-calculator-backup.json' and parents in 'appDataFolder'`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const data = await checkResponse.json();
      return data.files && data.files.length > 0;
    } catch {
      return false;
    }
  }

  private async restoreFromApiBackup(backupData: BackupData): Promise<void> {
    console.log('[GoogleDrive] 🔄 Starting API-based restore...');
    
    try {
      // Note: This would require a comprehensive restore API endpoint
      // that can recreate all user data in the correct order
      
      // For now, we'll call a comprehensive restore endpoint
      const restoreResponse = await fetch('/api/restore-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData)
      });

      if (!restoreResponse.ok) {
        throw new Error(`Restore API failed: ${restoreResponse.statusText}`);
      }

      console.log('[GoogleDrive] ✅ API restore completed successfully');
    } catch (error) {
      console.error('[GoogleDrive] ❌ API restore failed:', error);
      throw error;
    }
  }
}

// Skapa OAuth redirect-hanterare för popup
if (window.location.pathname === '/oauth/google') {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  
  if (params.get('access_token')) {
    // Hämta användarinfo
    fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${params.get('access_token')}`
      }
    })
    .then(response => response.json())
    .then(userInfo => {
      window.opener?.postMessage({
        type: 'GOOGLE_OAUTH_SUCCESS',
        accessToken: params.get('access_token'),
        email: userInfo.email
      }, window.location.origin);
    })
    .catch(error => {
      window.opener?.postMessage({
        type: 'GOOGLE_OAUTH_ERROR',
        error: error.message
      }, window.location.origin);
    });
  } else {
    window.opener?.postMessage({
      type: 'GOOGLE_OAUTH_ERROR',
      error: params.get('error') || 'Unknown error'
    }, window.location.origin);
  }
}

export const simpleGoogleDriveService = new SimpleGoogleDriveService();