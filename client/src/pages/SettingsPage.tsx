import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MainCategoriesSettings } from "@/components/MainCategoriesSettings";
import { PaydaySettings } from "@/components/PaydaySettings";
import { UserManagement } from "@/components/UserManagement";
import AccountTypesManager from "@/components/AccountTypesManager";
import { NeonAuthSettings } from "@/components/NeonAuthSettings";
import { useBudget } from "@/hooks/useBudget";
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { useAccountTypes } from "@/hooks/useAccountTypes";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { getCurrentState, updateSelectedBudgetMonth } from "@/orchestrator/budgetOrchestrator";
import { apiStore } from "@/store/apiStore";
import { simpleGoogleDriveService } from "@/services/simpleGoogleDriveService";
import { useBooleanSetting, useUpdateUserSetting } from "@/hooks/useUserSettings";
import { Calendar, User, Shield, Database, Settings, DollarSign, FolderOpen, ChevronLeft, ChevronRight, Cloud, CloudOff } from "lucide-react";

// Mobile Scrolling Settings Component
const MobileScrollingSettings = () => {
  const mobileScrollEnabled = useBooleanSetting('mobileScrollEnabled', true);
  const updateSetting = useUpdateUserSetting();

  const handleToggle = (enabled: boolean) => {
    updateSetting.mutate({
      settingKey: 'mobileScrollEnabled',
      settingValue: enabled.toString()
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Side-scrollning på mobile</Label>
          <p className="text-sm text-muted-foreground">
            Aktivera eller inaktivera swipe-gester för sidnavigering på mobila enheter
          </p>
        </div>
        <Switch
          checked={mobileScrollEnabled}
          onCheckedChange={handleToggle}
          disabled={updateSetting.isPending}
        />
      </div>
    </div>
  );
};

// Auto Update Balance Settings Component
const AutoUpdateBalanceSettings = () => {
  const autoUpdateEnabled = useBooleanSetting('autoUpdateBalance', true);
  const updateSetting = useUpdateUserSetting();

  const handleToggle = (enabled: boolean) => {
    updateSetting.mutate({
      settingKey: 'autoUpdateBalance',
      settingValue: enabled.toString()
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Uppdatera Faktiskt banksaldo automatiskt</Label>
          <p className="text-sm text-muted-foreground">
            Uppdaterar automatiskt "Faktiskt banksaldo" när CSV/XLSX-filer importeras, 
            om "Bankens saldo" redan finns
          </p>
        </div>
        <Switch
          checked={autoUpdateEnabled}
          onCheckedChange={handleToggle}
          disabled={updateSetting.isPending}
        />
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { budgetState } = useBudget();
  
  // Use API accounts instead of budgetState.accounts
  const { data: accountsFromAPI = [] } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: familyMembers } = useFamilyMembers();
  const createAccountMutation = useCreateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const updateAccountMutation = useUpdateAccount();
  const [currentPayday, setCurrentPayday] = useState(25);
  const [newAccountOwner, setNewAccountOwner] = useState("gemensamt");
  const [newAccountType, setNewAccountType] = useState<string>("none");

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
  
  // Account management states - get from API instead of central state
  const accounts = accountsFromAPI || [];
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

  // Selective export/import states
  const [selectedTables, setSelectedTables] = useState<string[]>(['accounts', 'transactions', 'huvudkategorier', 'underkategorier']);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    // TODO: Load user settings from API instead of localStorage
    // For now, use default values until user settings API is implemented
    setUserName1('Andreas');
    setUserName2('Susanna');
    setTempUserName1('Andreas');
    setTempUserName2('Susanna');
    setBudgetTemplates({});
    setAutoBackupEnabled(false);
    
    // Check if legacy backup exists (for emergency recovery)
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
    // TODO: Save auto backup preference to user settings API
    console.log('Auto backup toggled:', enabled);
  };

  const handlePaydayChange = (newPayday: number) => {
    setCurrentPayday(newPayday);
    console.log('Payday changed to:', newPayday);
  };

  const saveUserNames = () => {
    setUserName1(tempUserName1);
    setUserName2(tempUserName2);
    // TODO: Save user names to user settings API
    console.log('User names saved:', { userName1: tempUserName1, userName2: tempUserName2 });
  };

  const addAccountHandler = async () => {
    if (newAccountName.trim() && !accounts.some(acc => acc.name === newAccountName.trim())) {
      console.log('Adding new account:', newAccountName.trim());
      
      try {
        // Use React Query mutation to create the account in the database
        await createAccountMutation.mutateAsync({
          name: newAccountName.trim(),
          balance: 0, // balance field, not startBalance
          assignedTo: newAccountOwner === 'gemensamt' ? null : newAccountOwner,
          bankTemplateId: null,
          accountTypeId: newAccountType === 'none' || !newAccountType ? null : newAccountType
        });
        
        setNewAccountName('');
        setNewAccountOwner('gemensamt');
        setNewAccountType('none');
        console.log('Account added successfully via API');
      } catch (error) {
        console.error('Failed to create account:', error);
        // You could show a toast notification here
      }
    }
  };

  const handleAccountAssignment = async (accountId: string, assignedTo: string) => {
    try {
      await updateAccountMutation.mutateAsync({
        id: accountId,
        data: { assignedTo: assignedTo === 'gemensamt' ? null : assignedTo }
      });
      console.log('Account assignment updated successfully');
    } catch (error) {
      console.error('Failed to update account assignment:', error);
    }
  };

  const handleAccountTypeChange = async (accountId: string, accountTypeId: string) => {
    try {
      await updateAccountMutation.mutateAsync({
        id: accountId,
        data: { accountTypeId: accountTypeId === 'none' ? null : accountTypeId }
      });
      console.log('Account type updated successfully');
    } catch (error) {
      console.error('Failed to update account type:', error);
    }
  };

  const removeAccountHandler = async (accountToRemove: string) => {
    console.log('Removing account:', accountToRemove);
    
    // Find the account ID to remove
    const accountToDelete = accounts.find(acc => acc.name === accountToRemove);
    if (accountToDelete?.id) {
      try {
        // Use React Query mutation to delete the account from the database
        await deleteAccountMutation.mutateAsync(accountToDelete.id);
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

  const exportData = async () => {
    console.log('🚀 [EXPORT] Starting API-based data export...');
    
    try {
      // Get all data from API instead of localStorage
      const response = await fetch('/api/bootstrap');
      if (!response.ok) {
        throw new Error('Failed to fetch data for export');
      }
      
      const apiData = await response.json();
      
      // Create export data with API data
      const allData: Record<string, any> = {
        exportDate: new Date().toISOString(),
        version: '4.0', // New version for API-based exports
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timestamp: Date.now()
        },
        // Include all API data
        ...apiData
      };
      
      // Log what we're exporting
      console.log('📦 [EXPORT] Complete export data:', {
        totalKeys: Object.keys(allData).length,
        hasAccounts: !!allData.accounts,
        accountsCount: allData.accounts?.length || 0,
        transactionsCount: allData.transactions?.length || 0,
        allKeys: Object.keys(allData)
      });
      
      const dataStr = JSON.stringify(allData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-data-API-${new Date().toISOString().split('T')[0]}.json`;
      
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
      console.log('✅ [EXPORT] API-based export completed');
      alert(`Export slutförd! Alla data från API (${Object.keys(allData).length} fält) har exporterats.`);
    } catch (error) {
      console.error('❌ [EXPORT] Export failed:', error);
      alert('Export misslyckades. Se konsolen för detaljer.');
    }
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('🔄 [IMPORT] Starting API-based data import from file:', file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        console.log('🔄 [IMPORT] Parsed import data:', {
          version: data.version,
          exportDate: data.exportDate,
          totalKeys: Object.keys(data).length,
          hasAccounts: !!data.accounts,
          hasTransactions: !!data.transactions,
          allKeys: Object.keys(data).filter(k => !['exportDate', 'version', 'deviceInfo'].includes(k))
        });
        
        // Check if this is a new API-based export (version 4.0+)
        if (data.version && data.version.startsWith('4.')) {
          // Use the restore API endpoint
          const response = await fetch('/api/restore-backup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });

          if (!response.ok) {
            throw new Error(`Import API failed: ${response.statusText}`);
          }

          console.log('✅ [IMPORT] API-based import completed successfully');
          alert(`Data importerad framgångsrikt via API! 
Exporterad: ${data.exportDate ? new Date(data.exportDate).toLocaleString('sv-SE') : 'Okänt datum'}
Version: ${data.version}

Sidan laddas om för att visa importerad data.`);
          
          // Reload page to show imported data
          window.location.reload();
        } else if (data.version === '5.0-selective') {
          // This is a selective export - user should use the selective import instead
          alert(`Detta är en selektiv export (version ${data.version}). 
          
Använd knappen "Importera selektiv data" istället för att importera denna fil.

Selektiva exporter kan bara importeras via den selektiva importen.`);
        } else {
          // Legacy localStorage-based export
          alert(`Legacy format detected (version ${data.version || 'unknown'}). 
Please use Google Drive backup/restore or export new data format from current app.`);
        }
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

  // Available tables for selective export/import
  const availableTables = [
    { id: 'accounts', name: 'Konton', description: 'Bankkonton och saldo' },
    { id: 'accountTypes', name: 'Kontotyper', description: 'Olika typer av konton' },
    { id: 'transactions', name: 'Transaktioner', description: 'Alla transaktioner och betalningar' },
    { id: 'huvudkategorier', name: 'Huvudkategorier', description: 'Primära utgiftskategorier' },
    { id: 'underkategorier', name: 'Underkategorier', description: 'Detaljerade underkategorier' },
    { id: 'categoryRules', name: 'Kategoriregler', description: 'Automatiska kategoriseringsregler' },
    { id: 'familyMembers', name: 'Familjemedlemmar', description: 'Hushållsmedlemmar' },
    { id: 'inkomstkallor', name: 'Inkomstkällor', description: 'Källor för inkomst' },
    { id: 'inkomstkallorMedlem', name: 'Inkomst per medlem', description: 'Inkomstkällor kopplade till familjemedlemmar' },
    { id: 'monthlyAccountBalances', name: 'Månadssaldo', description: 'Månatliga kontosaldo' },
    { id: 'monthlyBudgets', name: 'Månadsbudgetar', description: 'Budgetinställningar per månad' },
    { id: 'budgetPosts', name: 'Budgetposter', description: 'Individuella budgetposter' },
    { id: 'plannedTransfers', name: 'Planerade överföringar', description: 'Automatiska överföringar' },
    { id: 'banks', name: 'Banker', description: 'Bankinformation' },
    { id: 'bankCsvMappings', name: 'CSV-mappningar', description: 'Kolumnmappningar för bankimport' },
    { id: 'userSettings', name: 'Användarinställningar', description: 'Personliga inställningar' }
  ];

  const handleTableSelection = (tableId: string, checked: boolean) => {
    if (checked) {
      setSelectedTables(prev => [...prev, tableId]);
    } else {
      setSelectedTables(prev => prev.filter(id => id !== tableId));
    }
  };

  const handleSelectAll = () => {
    setSelectedTables(availableTables.map(table => table.id));
  };

  const handleSelectNone = () => {
    setSelectedTables([]);
  };

  const exportSelectedData = async () => {
    if (selectedTables.length === 0) {
      alert('Välj minst en tabell att exportera');
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/export-selective', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tables: selectedTables }),
      });

      if (!response.ok) {
        throw new Error(`Export misslyckades: ${response.statusText}`);
      }

      const exportData = await response.json();
      
      // Create and download the file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budgetdata-selective-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(`Export slutförd! ${selectedTables.length} tabeller exporterade.`);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export misslyckades: ${error instanceof Error ? error.message : 'Okänt fel'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const importSelectedData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsImporting(true);
        const data = JSON.parse(e.target?.result as string);
        
        if (data.version !== '5.0-selective') {
          throw new Error('Denna fil är inte en giltig selektiv export. Använd "Importera all data" för fullständiga exporter.');
        }

        const response = await fetch('/api/import-selective', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: data.data,
            tables: data.tables,
            sourceUserId: data.userId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Import misslyckades: ${response.statusText}`);
        }

        const result = await response.json();
        alert(`Import slutförd! ${result.totalRecords} poster importerade från ${result.importedTables.length} tabeller.`);
        
        // Reload the page to show imported data
        window.location.reload();
        
      } catch (error) {
        console.error('Import error:', error);
        alert(`Import misslyckades: ${error instanceof Error ? error.message : 'Okänt fel'}`);
      } finally {
        setIsImporting(false);
      }
    };
    
    reader.readAsText(file);
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
              <span className="hidden sm:inline">Utbetalning</span>
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
                  Utbetalning & Månadsperiod
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

                <Separator />

                {/* Selective Export/Import Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Selektiv Dataexport/Import</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Välj specifika datatabeller att exportera eller importera. Exporterad data från inloggad användare kan importeras till vilken användare som helst.
                  </p>
                  
                  {/* Table Selection */}
                  <div className="space-y-4 mb-6">
                    <div className="flex gap-2 mb-3">
                      <Button onClick={handleSelectAll} variant="outline" size="sm">
                        Välj alla
                      </Button>
                      <Button onClick={handleSelectNone} variant="outline" size="sm">
                        Avmarkera alla
                      </Button>
                      <Badge variant="secondary" className="ml-auto">
                        {selectedTables.length} av {availableTables.length} valda
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                      {availableTables.map((table) => (
                        <div key={table.id} className="flex items-start space-x-3 p-2 hover:bg-muted rounded">
                          <Checkbox
                            id={table.id}
                            checked={selectedTables.includes(table.id)}
                            onCheckedChange={(checked) => handleTableSelection(table.id, !!checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <label htmlFor={table.id} className="text-sm font-medium cursor-pointer">
                              {table.name}
                            </label>
                            <p className="text-xs text-muted-foreground truncate">
                              {table.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export/Import Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      onClick={exportSelectedData} 
                      variant="secondary" 
                      className="w-full"
                      disabled={isExporting || selectedTables.length === 0}
                    >
                      {isExporting ? 'Exporterar...' : 'Exportera valda tabeller'}
                    </Button>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importSelectedData}
                        style={{ display: 'none' }}
                        id="import-selective-file"
                        disabled={isImporting}
                      />
                      <Button 
                        onClick={() => document.getElementById('import-selective-file')?.click()}
                        variant="outline" 
                        className="w-full"
                        disabled={isImporting}
                      >
                        {isImporting ? 'Importerar...' : 'Importera selektiv data'}
                      </Button>
                    </div>
                  </div>

                  <Alert className="mt-4">
                    <AlertDescription>
                      <strong>Selektiv export/import:</strong><br/>
                      1. Välj de tabeller du vill exportera<br/>
                      2. Klicka "Exportera valda tabeller" för att ladda ner data<br/>
                      3. På målanvändaren: Klicka "Importera selektiv data" och välj filen<br/>
                      4. Data importeras till den inloggade användaren oavsett vem som exporterade
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
                  Avancerade Inställningar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <MobileScrollingSettings />
                <AutoUpdateBalanceSettings />
                
                <Separator />
                
                <NeonAuthSettings />
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Månadsalternativ</h3>
                  <Alert>
                    <AlertDescription>
                      Avancerade månadsalternativ inkluderar automatisk månadsgenerering, 
                      kopiering av budgetdata mellan månader, och hantering av historisk data.
                      Dessa funktioner är tillgängliga i huvudbudgetvyn.
                    </AlertDescription>
                  </Alert>
                </div>
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
            <Tabs defaultValue="manage-accounts" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manage-accounts">Hantera konton</TabsTrigger>
                <TabsTrigger value="manage-account-types">Hantera kontotyper</TabsTrigger>
              </TabsList>

              <TabsContent value="manage-accounts">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Hantera konton
                    </CardTitle>
                    <CardDescription>
                      Skapa och hantera konton samt tilldela ägare till varje konto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Namn på nytt konto"
                      className="flex-1"
                    />
                    <Select value={newAccountType} onValueChange={setNewAccountType}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Välj kontotyp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ingen kontotyp</SelectItem>
                        {accountTypes?.map((accountType) => (
                          <SelectItem key={accountType.id} value={accountType.id}>
                            {accountType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newAccountOwner} onValueChange={setNewAccountOwner}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Välj ägare" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemensamt">Gemensamt</SelectItem>
                        {familyMembers?.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addAccountHandler}>
                      Lägg till konto
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Konton och tilldelning</h3>
                  <div className="space-y-2">
                    {accounts.map(account => (
                      <div key={account.id || account.name} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Saldo: {(account.balance || 0).toLocaleString('sv-SE')} kr
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Select
                            value={account.accountTypeId || 'none'}
                            onValueChange={(value) => handleAccountTypeChange(account.id, value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Kontotyp" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen kontotyp</SelectItem>
                              {accountTypes?.map((accountType) => (
                                <SelectItem key={accountType.id} value={accountType.id}>
                                  {accountType.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={account.assignedTo || 'gemensamt'}
                            onValueChange={(value) => handleAccountAssignment(account.id, value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gemensamt">Gemensamt</SelectItem>
                              {familyMembers?.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => removeAccountHandler(account.name)}
                          >
                            Ta bort
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage-account-types">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Hantera kontotyper
                </CardTitle>
                <CardDescription>
                  Lägg till, redigera och ta bort kontotyper som kan tilldelas konton
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <AccountTypesManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;