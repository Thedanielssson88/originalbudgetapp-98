import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MainCategoriesSettings } from "@/components/MainCategoriesSettings";
import { PaydaySettings } from "@/components/PaydaySettings";
import { useBudget } from "@/hooks/useBudget";
import { Calendar, User, Shield, Database, Settings, DollarSign, FolderOpen } from "lucide-react";

const SettingsPage = () => {
  const { budgetState } = useBudget();
  const [currentPayday, setCurrentPayday] = useState(25);
  
  // User name states
  const [userName1, setUserName1] = useState('Andreas');
  const [userName2, setUserName2] = useState('Susanna');
  const [tempUserName1, setTempUserName1] = useState('Andreas');
  const [tempUserName2, setTempUserName2] = useState('Susanna');
  
  // Account management states
  const [accounts, setAccounts] = useState<string[]>(['Löpande', 'Sparkonto', 'Buffert', 'Nöje', 'Hushållskonto']);
  const [newAccountName, setNewAccountName] = useState('');
  
  // Budget template states
  const [budgetTemplates, setBudgetTemplates] = useState<{[key: string]: any}>({});
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // Backup states
  const [hasBackup, setHasBackup] = useState(false);

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
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
    
    // Check if backup exists
    const backup = localStorage.getItem('budgetCalculatorBackup');
    setHasBackup(!!backup);
  }, []);

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

  const addAccount = () => {
    if (newAccountName.trim() && !accounts.includes(newAccountName.trim())) {
      const updatedAccounts = [...accounts, newAccountName.trim()];
      setAccounts(updatedAccounts);
      setNewAccountName('');
      
      // Save to localStorage
      const savedData = localStorage.getItem('budgetCalculatorData');
      const currentData = savedData ? JSON.parse(savedData) : {};
      const updatedData = {
        ...currentData,
        accounts: updatedAccounts
      };
      localStorage.setItem('budgetCalculatorData', JSON.stringify(updatedData));
    }
  };

  const removeAccount = (accountToRemove: string) => {
    const updatedAccounts = accounts.filter(account => account !== accountToRemove);
    setAccounts(updatedAccounts);
    
    // Save to localStorage
    const savedData = localStorage.getItem('budgetCalculatorData');
    const currentData = savedData ? JSON.parse(savedData) : {};
    const updatedData = {
      ...currentData,
      accounts: updatedAccounts
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(updatedData));
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
    const savedData = localStorage.getItem('budgetCalculatorData');
    if (savedData) {
      const dataStr = JSON.stringify(JSON.parse(savedData), null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Inställningar
          </h1>
          <p className="text-muted-foreground text-lg">
            Konfigurera alla aspekter av budgetkalkylatorn
          </p>
        </div>

        <Tabs defaultValue="payday" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
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
                  mainCategories={budgetState.categories?.map(cat => cat.name) || []}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Användarnamn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="user1">Första användaren</Label>
                    <Input
                      id="user1"
                      value={tempUserName1}
                      onChange={(e) => setTempUserName1(e.target.value)}
                      placeholder="Ange första användarens namn"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="user2">Andra användaren</Label>
                    <Input
                      id="user2"
                      value={tempUserName2}
                      onChange={(e) => setTempUserName2(e.target.value)}
                      placeholder="Ange andra användarens namn"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={saveUserNames}>
                    Spara användarnamn
                  </Button>
                </div>

                <Alert>
                  <AlertDescription>
                    Aktuella namn: <strong>{userName1}</strong> och <strong>{userName2}</strong>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
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
                  <h3 className="text-lg font-semibold mb-3">Export/Import</h3>
                  <Button onClick={exportData} variant="secondary" className="w-full">
                    Exportera data till fil
                  </Button>
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
                    <Button onClick={addAccount}>
                      Lägg till konto
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Aktuella konton</h3>
                  <div className="space-y-2">
                    {accounts.map(account => (
                      <div key={account} className="flex items-center justify-between p-3 border rounded">
                        <span>{account}</span>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => removeAccount(account)}
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