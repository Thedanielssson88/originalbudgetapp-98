import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MainCategoriesSettings } from "@/components/MainCategoriesSettings";
import { PaydaySettings } from "@/components/PaydaySettings";
import { UserManagement } from "@/components/UserManagement";
import { useBudget } from "@/hooks/useBudget";
import { getCurrentState, updateSelectedBudgetMonth } from "@/orchestrator/budgetOrchestrator";
import { apiStore } from "@/store/apiStore";
import { simpleGoogleDriveService } from "@/services/simpleGoogleDriveService";
import { Calendar, User, Shield, Database, Settings, DollarSign, FolderOpen, ChevronLeft, ChevronRight, Cloud, CloudOff } from "lucide-react";

const SettingsPage = () => {
  const { budgetState } = useBudget();
  const [currentPayday, setCurrentPayday] = useState(25);

  // Month navigation functions
  const navigateToPreviousMonth = () => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    updateSelectedBudgetMonth(prevMonthKey);
  };

  const navigateToNextMonth = () => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    updateSelectedBudgetMonth(nextMonthKey);
  };

  const handleBudgetMonthChange = (value: string) => {
    updateSelectedBudgetMonth(value);
  };
  
  // User name states
  const [userName1, setUserName1] = useState('Andreas');
  const [userName2, setUserName2] = useState('Susanna');
  const [tempUserName1, setTempUserName1] = useState('Andreas');
  const [tempUserName2, setTempUserName2] = useState('Susanna');
  
  // Account management states - get from central state
  const accounts = budgetState.accounts || [];
  const [newAccountName, setNewAccountName] = useState('');
  
  // Budget template states
  const [budgetTemplates, setBudgetTemplates] = useState<{[key: string]: any}>({});
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // Backup states
  const [hasBackup, setHasBackup] = useState(false);
  
  // Google Drive states
  const [isGoogleDriveInitialized, setIsGoogleDriveInitialized] = useState(false);
  const [isSignedInToGoogle, setIsSignedInToGoogle] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [googleBackupExists, setGoogleBackupExists] = useState(false);
  const [googleBackupLastModified, setGoogleBackupLastModified] = useState('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedData = localStorage.getItem('budgetCalculatorData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setUserName1(parsed.userName1 || 'Andreas');
        setUserName2(parsed.userName2 || 'Susanna');
        setTempUserName1(parsed.userName1 || 'Andreas');
        setTempUserName2(parsed.userName2 || 'Susanna');
        setBudgetTemplates(parsed.budgetTemplates || {});
        setAutoBackupEnabled(parsed.autoBackupEnabled || false);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
    
    // Check if backup exists
    const backup = localStorage.getItem('budgetCalculatorBackup');
    setHasBackup(!!backup);
    
    // Initialize Google Drive
    initializeGoogleDrive();
  }, []);

  const initializeGoogleDrive = async () => {
    try {
      const initialized = await simpleGoogleDriveService.initialize();
      setIsGoogleDriveInitialized(initialized);
      
      if (initialized) {
        const status = simpleGoogleDriveService.getSignInStatus();
        setIsSignedInToGoogle(status.isSignedIn);
        setGoogleUserEmail(status.userEmail);
        
        if (status.isSignedIn) {
          await updateGoogleBackupInfo();
        }
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
    }
  };

  const updateGoogleBackupInfo = async () => {
    try {
      const backupExists = await simpleGoogleDriveService.checkBackupExists();
      setGoogleBackupExists(backupExists);
    } catch (error) {
      console.error('Failed to get Google backup info:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    try {
      const success = await simpleGoogleDriveService.signIn();
      if (success) {
        const status = simpleGoogleDriveService.getSignInStatus();
        setIsSignedInToGoogle(status.isSignedIn);
        setGoogleUserEmail(status.userEmail);
        await updateGoogleBackupInfo();
      }
    } catch (error) {
      console.error('Google sign in failed:', error);
      alert('Inloggning till Google Drive misslyckades. Försök igen eller kontakta support.');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleGoogleSignOut = () => {
    simpleGoogleDriveService.signOut();
    setIsSignedInToGoogle(false);
    setGoogleUserEmail('');
    setGoogleBackupExists(false);
    setGoogleBackupLastModified('');
  };

  const handleGoogleBackup = async () => {
    setIsLoadingGoogle(true);
    try {
      const success = await simpleGoogleDriveService.createBackup();
      if (success) {
        await updateGoogleBackupInfo();
        alert('Backup sparad till Google Drive!');
      } else {
        alert('Backup till Google Drive misslyckades.');
      }
    } catch (error) {
      console.error('Google backup failed:', error);
      alert('Backup till Google Drive misslyckades.');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleGoogleRestore = async () => {
    if (!confirm('Detta kommer att ersätta all nuvarande data med data från Google Drive. Vill du fortsätta?')) {
      return;
    }

    setIsLoadingGoogle(true);
    try {
      const success = await simpleGoogleDriveService.restoreBackup();
      if (success) {
        alert('Data återställd från Google Drive! Sidan laddas om.');
        window.location.reload();
      } else {
        alert('Återställning från Google Drive misslyckades.');
      }
    } catch (error) {
      console.error('Google restore failed:', error);
      alert('Återställning från Google Drive misslyckades.');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const toggleAutoBackup = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    
    // Save to localStorage
    const savedData = localStorage.getItem('budgetCalculatorData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        parsed.autoBackupEnabled = enabled;
        localStorage.setItem('budgetCalculatorData', JSON.stringify(parsed));
      } catch (error) {
        console.error('Failed to save auto backup setting:', error);
      }
    }
  };

  const handlePaydayChange = (newPayday: number) => {
    setCurrentPayday(newPayday);
    console.log('Payday changed to:', newPayday);
  };

  const saveUserNames = () => {
    setUserName1(tempUserName1);
    setUserName2(tempUserName2);
    
    // Save to localStorage
    const savedData = localStorage.getItem('budgetCalculatorData');
    const currentData = savedData ? JSON.parse(savedData) : {};
    const updatedData = {
      ...currentData,
      userName1: tempUserName1,
      userName2: tempUserName2
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(updatedData));
    console.log('User names saved');
  };

  const addAccountHandler = async () => {
    if (newAccountName.trim() && !accounts.some(acc => acc.name === newAccountName.trim())) {
      console.log('Adding new account:', newAccountName.trim());
      
      try {
        // Use the API store to create the account in the database
        await apiStore.createAccount({
          name: newAccountName.trim(),
          startBalance: 0
        });
        
        setNewAccountName('');
        console.log('Account added successfully via API');
      } catch (error) {
        console.error('Failed to create account:', error);
        // You could show a toast notification here
      }
    }
  };

  const removeAccountHandler = async (accountToRemove: string) => {
    console.log('Removing account:', accountToRemove);
    
    // Find the account ID to remove
    const accountToDelete = accounts.find(acc => acc.name === accountToRemove);
    if (accountToDelete) {
      try {
        // Use the API store to delete the account from the database
        await apiStore.deleteAccount(accountToDelete.id);
        console.log('Account removed successfully via API');
      } catch (error) {
        console.error('Failed to delete account:', error);
        // You could show a toast notification here
      }
    }
  };

  const createBackup = () => {
    const savedData = localStorage.getItem('budgetCalculatorData');
    const currentData = savedData ? JSON.parse(savedData) : {};
    
    const backupData = {
      ...currentData,
      backupDate: new Date().toISOString(),
      version: '1.0'
    };
    
    localStorage.setItem('budgetCalculatorBackup', JSON.stringify(backupData));
    setHasBackup(true);
    console.log('Backup created successfully');
  };

  const loadBackup = () => {
    const backup = localStorage.getItem('budgetCalculatorBackup');
    if (backup) {
      localStorage.setItem('budgetCalculatorData', backup);
      
      // Reload the page to apply all changes
      window.location.reload();
    }
  };

  const exportData = () => {
    console.log('🚀 [EXPORT] Starting comprehensive data export...');
    
    // Get ALL localStorage keys and their data
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      allKeys.push(localStorage.key(i));
    }
    
    console.log('📦 [EXPORT] Found localStorage keys:', allKeys);
    
    // Export ALL localStorage data (comprehensive backup)
    const allData: Record<string, any> = {
      exportDate: new Date().toISOString(),
      version: '3.0',
      deviceInfo: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timestamp: Date.now()
      }
    };
    
    // Add all localStorage data
    allKeys.forEach(key => {
      if (key) {
        const value = localStorage.getItem(key);
        allData[key] = value;
        console.log(`📦 [EXPORT] Adding key: ${key}, size: ${value ? value.length : 0} chars`);
      }
    });
    
    // Log what we're actually exporting
    console.log('📦 [EXPORT] Complete export data:', {
      totalKeys: Object.keys(allData).length,
      hasMainData: !!allData.budgetCalculatorData,
      mainDataSize: allData.budgetCalculatorData ? allData.budgetCalculatorData.length : 0,
      allKeys: Object.keys(allData)
    });
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-data-KOMPLETT-${new Date().toISOString().split('T')[0]}.json`;
    
    // For mobile compatibility, try different download methods
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      // Mobile device - try alternative download method
      console.log('📱 [EXPORT] Mobile device detected, using alternative download method');
      try {
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('📱 [EXPORT] Mobile download failed:', error);
        // Fallback: show data in a new window/tab
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`<pre>${dataStr}</pre>`);
          alert('Export data visas i nytt fönster. Kopiera texten och spara som .json fil.');
        }
      }
    } else {
      // Desktop - normal download
      link.click();
    }
    
    URL.revokeObjectURL(url);
    console.log('✅ [EXPORT] Export completed');
    alert(`Export slutförd! Alla data (${Object.keys(allData).length} nycklar) har exporterats.`);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('🔄 [IMPORT] Starting data import from file:', file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        console.log('🔄 [IMPORT] Parsed import data:', {
          version: data.version,
          exportDate: data.exportDate,
          totalKeys: Object.keys(data).length,
          hasMainData: !!data.budgetCalculatorData,
          allKeys: Object.keys(data).filter(k => !['exportDate', 'version', 'deviceInfo'].includes(k))
        });
        
        let importedCount = 0;
        
        // Import ALL data (except metadata)
        Object.keys(data).forEach(key => {
          if (!['exportDate', 'version', 'deviceInfo'].includes(key)) {
            const value = data[key];
            if (value !== null && value !== undefined) {
              localStorage.setItem(key, value);
              importedCount++;
              console.log(`✅ [IMPORT] Imported key: ${key}, size: ${value.length} chars`);
            }
          }
        });
        
        console.log(`✅ [IMPORT] Successfully imported ${importedCount} keys`);
        
        // Show detailed success message
        alert(`Data importerad framgångsrikt! 
${importedCount} datanycklar har importerats.
Exporterad: ${data.exportDate ? new Date(data.exportDate).toLocaleString('sv-SE') : 'Okänt datum'}
Version: ${data.version || 'Okänd'}

Sidan laddas om för att tillämpa alla ändringar.`);
        
        // Reload page to apply all changes
        window.location.reload();
      } catch (error) {
        console.error('❌ [IMPORT] Import error:', error);
        alert(`Fel vid import av data: ${error instanceof Error ? error.message : 'Okänt fel'}
        
Kontrollera att filen är en giltig JSON-fil som exporterats från denna app.`);
      }
    };
    
    reader.onerror = (error) => {
      console.error('❌ [IMPORT] File read error:', error);
      alert('Fel vid läsning av fil. Försök igen.');
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header - Same as main budget page */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Familjens Budgetkalkylator
          </h1>
          <p className="text-muted-foreground text-lg">
            Beräkna era gemensamma utgifter och individuella bidrag
          </p>
        </div>

        {/* Month Selector - Same as main budget page */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-foreground">
              Aktuell månad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigateToPreviousMonth()}
                className="p-3 h-12 w-12 text-primary hover:text-primary/80"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              
              <Select 
                value={budgetState.selectedMonthKey} 
                onValueChange={(value) => handleBudgetMonthChange(value)}
              >
                <SelectTrigger className="w-auto min-w-[200px] border-none bg-transparent text-xl font-semibold text-primary hover:bg-muted/50 transition-colors text-center justify-center">
                  <SelectValue>
                    {(() => {
                      const monthNames = [
                        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                      ];
                      
                      const [year, month] = budgetState.selectedMonthKey.split('-');
                      const monthIndex = parseInt(month) - 1;
                      return `${monthNames[monthIndex]} ${year}`;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const monthNames = [
                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                    ];
                    
                    const availableMonths = Object.keys(budgetState.historicalData || {});
                    const currentDate = new Date();
                    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    const allMonths = new Set([currentMonthKey, ...availableMonths]);
                    
                    return Array.from(allMonths).sort().reverse().map(monthKey => {
                      const [year, month] = monthKey.split('-');
                      const monthIndex = parseInt(month) - 1;
                      const displayName = `${monthNames[monthIndex]} ${year}`;
                      
                      return (
                        <SelectItem key={monthKey} value={monthKey}>
                          {displayName}
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigateToNextMonth()}
                className="p-3 h-12 w-12 text-primary hover:text-primary/80"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Page-specific content starts here */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Inställningar - {(() => {
              const monthNames = [
                'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
              ];
              const [year, month] = budgetState.selectedMonthKey.split('-');
              const monthIndex = parseInt(month) - 1;
              return `${monthNames[monthIndex]} ${year}`;
            })()}
          </h1>
          <p className="text-muted-foreground text-lg">
            Konfigurera alla aspekter av budgetkalkylatorn
          </p>
        </div>

        <Tabs defaultValue="payday" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-8">
            <TabsTrigger value="payday" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Lönedatum</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Kategorier</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Användare</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Backup</span>
            </TabsTrigger>
            <TabsTrigger value="googledrive" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">Google Drive</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Avancerat</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Mallar</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Konton</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payday" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Lönedatum & Månadsperiod
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaydaySettings 
                  currentPayday={currentPayday}
                  onPaydayChange={handlePaydayChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Kategorier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MainCategoriesSettings 
                  mainCategories={budgetState.mainCategories || []}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Backup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button onClick={createBackup} className="w-full">
                    Skapa backup
                  </Button>
                  <Button 
                    onClick={loadBackup} 
                    variant="outline" 
                    className="w-full"
                    disabled={!hasBackup}
                  >
                    Återställ från backup
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-3">Datasynkronisering</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Synkronisera data mellan mobil och dator. Exportera från en enhet och importera på en annan.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={exportData} variant="secondary" className="w-full">
                      Exportera all data
                    </Button>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importData}
                        style={{ display: 'none' }}
                        id="import-file"
                      />
                      <Button 
                        onClick={() => document.getElementById('import-file')?.click()}
                        variant="outline" 
                        className="w-full"
                      >
                        Importera data
                      </Button>
                    </div>
                  </div>
                  <Alert className="mt-4">
                    <AlertDescription>
                      <strong>För att synkronisera data mellan enheter:</strong><br/>
                      1. På enheten med data: Klicka "Exportera all data"<br/>
                      2. På den andra enheten: Klicka "Importera data" och välj filen<br/>
                      3. Sidan laddas om automatiskt med den importerade datan
                    </AlertDescription>
                  </Alert>
                </div>

                {hasBackup && (
                  <Alert>
                    <AlertDescription>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Backup tillgänglig</Badge>
                        <span>Du har en sparad backup som kan återställas</span>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="googledrive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Google Drive Molnsynkronisering
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isGoogleDriveInitialized ? (
                  <Alert>
                    <AlertDescription>
                      <div className="space-y-2">
                        <p><strong>Google Drive API inte konfigurerat</strong></p>
                        <p>För att använda automatisk molnsynkronisering behöver följande miljövariabler vara satta:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li><code>VITE_GOOGLE_CLIENT_ID</code> - Google OAuth 2.0 Client ID</li>
                          <li><code>VITE_GOOGLE_API_KEY</code> - Google API Key</li>
                        </ul>
                        <p className="mt-2">Kontakta administratören för att konfigurera dessa nycklar.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {/* Google Account Status */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Google-konto</h3>
                      {isSignedInToGoogle ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Inloggad
                            </Badge>
                            <span>{googleUserEmail}</span>
                          </div>
                          <Button 
                            onClick={handleGoogleSignOut}
                            variant="outline"
                            size="sm"
                          >
                            Logga ut från Google Drive
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Inte inloggad</Badge>
                          </div>
                          <Button 
                            onClick={handleGoogleSignIn}
                            disabled={isLoadingGoogle}
                            className="w-full sm:w-auto"
                          >
                            {isLoadingGoogle ? 'Loggar in...' : 'Logga in till Google Drive'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Backup Status */}
                    {isSignedInToGoogle && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Backup-status</h3>
                        <div className="space-y-3">
                          {googleBackupExists ? (
                            <Alert>
                              <AlertDescription>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                    Backup finns
                                  </Badge>
                                  <span>
                                    Senast uppdaterad: {new Date(googleBackupLastModified).toLocaleString('sv-SE')}
                                  </span>
                                </div>
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <Alert>
                              <AlertDescription>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">Ingen backup</Badge>
                                  <span>Ingen backup hittades i Google Drive</span>
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Auto Backup Settings */}
                    {isSignedInToGoogle && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Automatisk backup</h3>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">
                              Automatisk molnsynkronisering
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Sparar automatiskt alla ändringar till Google Drive
                            </p>
                          </div>
                          <Switch
                            checked={autoBackupEnabled}
                            onCheckedChange={toggleAutoBackup}
                          />
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Manual Backup Controls */}
                    {isSignedInToGoogle && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Manuell backup</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Button 
                            onClick={handleGoogleBackup}
                            disabled={isLoadingGoogle}
                            className="w-full"
                          >
                            {isLoadingGoogle ? 'Sparar...' : 'Spara backup till Google Drive'}
                          </Button>
                          <Button 
                            onClick={handleGoogleRestore}
                            disabled={isLoadingGoogle || !googleBackupExists}
                            variant="outline"
                            className="w-full"
                          >
                            {isLoadingGoogle ? 'Återställer...' : 'Återställ från Google Drive'}
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Instructions */}
                    <Alert>
                      <AlertDescription>
                        <strong>Så fungerar Google Drive-synkronisering:</strong><br/>
                        1. Logga in till ditt Google-konto<br/>
                        2. All budgetdata sparas automatiskt i en fil på Google Drive<br/>
                        3. Data synkroniseras mellan alla enheter där du är inloggad<br/>
                        4. Du kan när som helst återställa data från molnet
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Avancerade Månadsalternativ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    Avancerade månadsalternativ inkluderar automatisk månadsgenerering, 
                    kopiering av budgetdata mellan månader, och hantering av historisk data.
                    Dessa funktioner är tillgängliga i huvudbudgetvyn.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Budgetmallar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Namn på ny mall"
                    />
                    <Button onClick={() => {
                      if (newTemplateName.trim()) {
                        console.log('Creating template:', newTemplateName);
                        setNewTemplateName('');
                      }
                    }}>
                      Skapa mall
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Sparade mallar</h3>
                  {Object.keys(budgetTemplates).length === 0 ? (
                    <Alert>
                      <AlertDescription>
                        Inga mallar har sparats än. Skapa en mall för att återanvända budgetinställningar.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {Object.keys(budgetTemplates).map(templateName => (
                        <div key={templateName} className="flex items-center justify-between p-3 border rounded">
                          <span>{templateName}</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              Använd
                            </Button>
                            <Button size="sm" variant="destructive">
                              Ta bort
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Ändra konton
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Namn på nytt konto"
                    />
                    <Button onClick={addAccountHandler}>
                      Lägg till konto
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Aktuella konton</h3>
                  <div className="space-y-2">
                    {accounts.map(account => (
                      <div key={account.id || account.name} className="flex items-center justify-between p-3 border rounded">
                        <span>{account.name}</span>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => removeAccountHandler(account.name)}
                        >
                          Ta bort
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;