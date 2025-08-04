// Google Drive integration för automatisk datasynkronisering
import { StorageKey } from './storageService';

// Konfiguration - dessa behöver sättas av användaren
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Filnamn för backup i Google Drive
const BACKUP_FILENAME = 'budget-calculator-backup.json';

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

interface BackupData {
  budgetCalculatorData: string | null;
  main_categories: string | null;
  subcategories: string | null;
  banks: string | null;
  bank_csv_mappings: string | null;
  exportDate: string;
  version: string;
}

class GoogleDriveService {
  private tokenClient: any = null;
  private gapiInited = false;
  private gisInited = false;
  private isSignedIn = false;
  private userEmail = '';

  async initialize(): Promise<boolean> {
    try {
      if (!CLIENT_ID || !API_KEY) {
        console.warn('[GoogleDrive] API credentials not configured');
        return false;
      }

      // Load Google APIs
      await this.loadGoogleAPIs();
      
      // Initialize GAPI
      await this.initializeGapi();
      
      // Initialize Google Identity Services
      this.initializeGis();
      
      console.log('[GoogleDrive] ✅ Service initialized successfully');
      return true;
    } catch (error) {
      console.error('[GoogleDrive] ❌ Initialization failed:', error);
      return false;
    }
  }

  private async loadGoogleAPIs(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load GAPI
      if (!window.gapi) {
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => {
          // Load GIS
          const gisScript = document.createElement('script');
          gisScript.src = 'https://accounts.google.com/gsi/client';
          gisScript.onload = () => resolve();
          gisScript.onerror = () => reject(new Error('Failed to load GIS'));
          document.head.appendChild(gisScript);
        };
        gapiScript.onerror = () => reject(new Error('Failed to load GAPI'));
        document.head.appendChild(gapiScript);
      } else {
        resolve();
      }
    });
  }

  private async initializeGapi(): Promise<void> {
    return new Promise((resolve, reject) => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
          });
          this.gapiInited = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private initializeGis(): void {
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        console.log('[GoogleDrive] ✅ Access token received');
        this.isSignedIn = true;
        this.getUserInfo();
      },
    });
    this.gisInited = true;
  }

  private async getUserInfo(): Promise<void> {
    try {
      const response = await window.gapi.client.request({
        path: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });
      this.userEmail = response.result.email || '';
      console.log('[GoogleDrive] ✅ User info retrieved:', this.userEmail);
    } catch (error) {
      console.error('[GoogleDrive] ❌ Failed to get user info:', error);
    }
  }

  async signIn(): Promise<boolean> {
    try {
      if (!this.gisInited) {
        throw new Error('Google Identity Services not initialized');
      }

      return new Promise((resolve) => {
        this.tokenClient.callback = (tokenResponse: any) => {
          this.isSignedIn = true;
          this.getUserInfo();
          resolve(true);
        };

        if (window.gapi.client.getToken() === null) {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          this.tokenClient.requestAccessToken({ prompt: '' });
        }
      });
    } catch (error) {
      console.error('[GoogleDrive] ❌ Sign in failed:', error);
      return false;
    }
  }

  signOut(): void {
    const token = window.gapi.client.getToken();
    if (token !== null) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken('');
      this.isSignedIn = false;
      this.userEmail = '';
      console.log('[GoogleDrive] ✅ Signed out successfully');
    }
  }

  getSignInStatus(): { isSignedIn: boolean; userEmail: string } {
    return {
      isSignedIn: this.isSignedIn,
      userEmail: this.userEmail
    };
  }

  async createBackup(): Promise<boolean> {
    try {
      if (!this.isSignedIn) {
        throw new Error('Not signed in to Google Drive');
      }

      // Samla all data från localStorage
      const backupData: BackupData = {
        budgetCalculatorData: localStorage.getItem('budgetCalculatorData'),
        main_categories: localStorage.getItem('main_categories'),
        subcategories: localStorage.getItem('subcategories'),
        banks: localStorage.getItem('banks'),
        bank_csv_mappings: localStorage.getItem('bank_csv_mappings'),
        exportDate: new Date().toISOString(),
        version: '2.1-googledrive'
      };

      // Konvertera till JSON
      const jsonData = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Kolla om backup-fil redan finns
      const existingFile = await this.findBackupFile();
      
      if (existingFile) {
        // Uppdatera befintlig fil
        await this.updateFile(existingFile.id, blob);
        console.log('[GoogleDrive] ✅ Backup updated successfully');
      } else {
        // Skapa ny fil
        await this.createFile(BACKUP_FILENAME, blob);
        console.log('[GoogleDrive] ✅ Backup created successfully');
      }

      return true;
    } catch (error) {
      console.error('[GoogleDrive] ❌ Backup failed:', error);
      return false;
    }
  }

  async restoreBackup(): Promise<boolean> {
    try {
      if (!this.isSignedIn) {
        throw new Error('Not signed in to Google Drive');
      }

      const backupFile = await this.findBackupFile();
      if (!backupFile) {
        throw new Error('No backup file found in Google Drive');
      }

      // Ladda ned fil-innehåll
      const content = await this.downloadFile(backupFile.id);
      const backupData: BackupData = JSON.parse(content);

      // Återställ data till localStorage
      if (backupData.budgetCalculatorData) {
        localStorage.setItem('budgetCalculatorData', backupData.budgetCalculatorData);
      }
      if (backupData.main_categories) {
        localStorage.setItem('main_categories', backupData.main_categories);
      }
      if (backupData.subcategories) {
        localStorage.setItem('subcategories', backupData.subcategories);
      }
      if (backupData.banks) {
        localStorage.setItem('banks', backupData.banks);
      }
      if (backupData.bank_csv_mappings) {
        localStorage.setItem('bank_csv_mappings', backupData.bank_csv_mappings);
      }

      console.log('[GoogleDrive] ✅ Backup restored successfully');
      return true;
    } catch (error) {
      console.error('[GoogleDrive] ❌ Restore failed:', error);
      return false;
    }
  }

  async getBackupInfo(): Promise<{ exists: boolean; lastModified?: string } | null> {
    try {
      if (!this.isSignedIn) return null;

      const backupFile = await this.findBackupFile();
      if (backupFile) {
        return {
          exists: true,
          lastModified: backupFile.modifiedTime
        };
      } else {
        return { exists: false };
      }
    } catch (error) {
      console.error('[GoogleDrive] ❌ Failed to get backup info:', error);
      return null;
    }
  }

  private async findBackupFile(): Promise<GoogleDriveFile | null> {
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `name='${BACKUP_FILENAME}' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        spaces: 'drive'
      });

      const files = response.result.files;
      return files && files.length > 0 ? files[0] : null;
    } catch (error) {
      console.error('[GoogleDrive] ❌ Failed to find backup file:', error);
      return null;
    }
  }

  private async createFile(name: string, blob: Blob): Promise<string> {
    const metadata = {
      name: name,
      description: 'Budget Calculator automatisk backup'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({
        'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`
      }),
      body: form
    });

    const result = await response.json();
    return result.id;
  }

  private async updateFile(fileId: string, blob: Blob): Promise<void> {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: new Headers({
        'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`,
        'Content-Type': 'application/json'
      }),
      body: blob
    });

    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }
  }

  private async downloadFile(fileId: string): Promise<string> {
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });

    return response.body;
  }
}

// Singleton instance
export const googleDriveService = new GoogleDriveService();

// Global type declarations for Google APIs
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export default googleDriveService;