// Enkel Google Drive integration med OAuth2 popup-inloggning
import { StorageKey } from './storageService';

interface BackupData {
  budgetCalculatorData: string | null;
  main_categories: string | null;
  subcategories: string | null;
  banks: string | null;
  bank_csv_mappings: string | null;
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
      
      // Kontrollera om användaren redan är inloggad
      const savedToken = localStorage.getItem('googleDriveAccessToken');
      const savedEmail = localStorage.getItem('googleDriveUserEmail');
      
      if (savedToken && savedEmail) {
        // Testa om token fortfarande fungerar
        const isValid = await this.validateToken(savedToken);
        if (isValid) {
          this.accessToken = savedToken;
          this.userEmail = savedEmail;
          this.isSignedIn = true;
          console.log('[GoogleDrive] ✅ Restored existing session for:', savedEmail);
        } else {
          // Rensa ogiltiga tokens
          localStorage.removeItem('googleDriveAccessToken');
          localStorage.removeItem('googleDriveUserEmail');
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
            localStorage.setItem('googleDriveAccessToken', this.accessToken);
            localStorage.setItem('googleDriveUserEmail', this.userEmail);
            
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
      
      localStorage.removeItem('googleDriveAccessToken');
      localStorage.removeItem('googleDriveUserEmail');
      
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
      
      // Samla all data från localStorage
      const backupData: BackupData = {
        budgetCalculatorData: localStorage.getItem(StorageKey.BUDGET_CALCULATOR_DATA),
        main_categories: localStorage.getItem(StorageKey.MAIN_CATEGORIES),
        subcategories: localStorage.getItem(StorageKey.SUBCATEGORIES),
        banks: localStorage.getItem(StorageKey.BANKS),
        bank_csv_mappings: localStorage.getItem(StorageKey.BANK_CSV_MAPPINGS),
        exportDate: new Date().toISOString(),
        version: '2.0'
      };

      // Skapa fil i Google Drive
      const metadata = {
        name: 'budget-calculator-backup.json',
        parents: ['appDataFolder'] // Använd app-specifik mapp
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' }));

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: form
      });

      if (response.ok) {
        console.log('[GoogleDrive] ✅ Backup created successfully');
        return true;
      } else {
        console.error('[GoogleDrive] ❌ Backup creation failed:', await response.text());
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
      
      // Återställ data till localStorage
      if (backupData.budgetCalculatorData) {
        localStorage.setItem(StorageKey.BUDGET_CALCULATOR_DATA, backupData.budgetCalculatorData);
      }
      if (backupData.main_categories) {
        localStorage.setItem(StorageKey.MAIN_CATEGORIES, backupData.main_categories);
      }
      if (backupData.subcategories) {
        localStorage.setItem(StorageKey.SUBCATEGORIES, backupData.subcategories);
      }
      if (backupData.banks) {
        localStorage.setItem(StorageKey.BANKS, backupData.banks);
      }
      if (backupData.bank_csv_mappings) {
        localStorage.setItem(StorageKey.BANK_CSV_MAPPINGS, backupData.bank_csv_mappings);
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
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='budget-calculator-backup.json' and parents in 'appDataFolder'`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const data = await response.json();
      return data.files && data.files.length > 0;
    } catch {
      return false;
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