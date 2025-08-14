import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStackAuth } from '@/hooks/useStackAuth';
import { neonAuthVite } from '@/services/neonAuthVite';
import { Database, User, Shield, CheckCircle, AlertCircle, ExternalLink, UserPlus } from 'lucide-react';

export function NeonAuthSettings() {
  const {
    isConfigured,
    isAuthenticated,
    user,
    isLoading,
    error,
    signIn,
    signOut,
    configureDatabaseAuth,
    getDatabaseStatus
  } = useStackAuth();

  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState(false);
  const [databaseConfigLoading, setDatabaseConfigLoading] = useState(false);
  const [customConnectionString, setCustomConnectionString] = useState('');
  const [useCustomConnection, setUseCustomConnection] = useState(false);
  
  // No longer needed - using OAuth flow only

  // Check database status on load
  useEffect(() => {
    if (isAuthenticated) {
      getDatabaseStatus().then((status) => {
        setIsDatabaseConfigured(status.isConfigured);
      }).catch(console.error);
    }
  }, [isAuthenticated, getDatabaseStatus]);

  const handleSignIn = async () => {
    try {
      await signIn();
      // OAuth redirect should happen
      console.log('Stack Auth sign in initiated');
    } catch (error) {
      console.error('Sign in failed:', error);
      alert('OAuth-inloggning misslyckades. Detta kan bero på att OAuth-endpoints inte är korrekt konfigurerade för denna Stack Auth-miljö. Kontakta administratören för korrekt OAuth-konfiguration.');
    }
  };

  const handleSignUp = async () => {
    try {
      await neonAuthVite.signUp();
      console.log('Redirecting to Stack Auth sign-up...');
    } catch (error) {
      console.error('Sign up redirect failed:', error);
      alert('OAuth-registrering misslyckades. Detta kan bero på att OAuth-endpoints inte är korrekt konfigurerade för denna Stack Auth-miljö. Kontakta administratören för korrekt OAuth-konfiguration.');
    }
  };

  const handleDatabaseConfiguration = async () => {
    if (!isAuthenticated) {
      alert('Du måste logga in med Stack Auth först');
      return;
    }

    setDatabaseConfigLoading(true);
    try {
      const success = await configureDatabaseAuth();
      if (success) {
        setIsDatabaseConfigured(true);
        alert('Neon-databasen är nu konfigurerad med Stack Auth!');
      } else {
        alert('Kunde inte konfigurera databasen. Försök igen.');
      }
    } catch (error) {
      console.error('Database configuration failed:', error);
      alert('Ett fel uppstod vid konfiguration av databasen.');
    } finally {
      setDatabaseConfigLoading(false);
    }
  };

  const handleCustomConnection = async () => {
    if (!customConnectionString.trim()) {
      alert('Ange en giltig anslutningssträng');
      return;
    }

    setDatabaseConfigLoading(true);
    try {
      // Send custom connection string to backend
      const response = await fetch('/api/auth/configure-custom-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionString: customConnectionString,
          userEmail: user?.email || 'custom-user'
        })
      });

      if (response.ok) {
        setIsDatabaseConfigured(true);
        alert('Anpassad databasanslutning konfigurerad!');
      } else {
        throw new Error('Failed to configure custom connection');
      }
    } catch (error) {
      console.error('Custom connection failed:', error);
      alert('Kunde inte konfigurera anpassad databasanslutning.');
    } finally {
      setDatabaseConfigLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Neon Database Authentication</h3>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Stack Auth är inte konfigurerat. Kontrollera att <code>VITE_STACK_PROJECT_ID</code> och <code>VITE_STACK_PUBLISHABLE_CLIENT_KEY</code> är satta.
          </AlertDescription>
        </Alert>
        
        {/* Debug information */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Debug Info:</strong><br/>
            VITE_STACK_PROJECT_ID: {import.meta.env.VITE_STACK_PROJECT_ID || 'undefined'}<br/>
            VITE_STACK_PUBLISHABLE_CLIENT_KEY: {import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ? 'Set' : 'undefined'}<br/>
            Environment: {import.meta.env.MODE}<br/>
            DEV: {import.meta.env.DEV ? 'true' : 'false'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Neon Database Authentication</h3>
      </div>

      <Alert>
        <AlertDescription>
          <strong>Säker databasanslutning med Stack Auth:</strong><br/>
          Använd Stack Auth för att säkert ansluta till Neon PostgreSQL-databasen. 
          Detta möjliggör personlig data isolering och säkrare hantering av dina budgetdata.
        </AlertDescription>
      </Alert>

      {/* Neon Authentication Status */}
      <div className="space-y-4">
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">Neon Authentication - Inloggad</div>
                <div className="text-sm text-green-700">
                  Inloggad som {user.displayName || user.email} ({user.email})
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Inloggad
              </Badge>
              <Button 
                onClick={signOut}
                variant="outline"
                size="sm"
              >
                Logga ut
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5" />
                <div>
                  <div className="font-medium">Neon Authentication</div>
                  <div className="text-sm text-muted-foreground">
                    Inte inloggad - välj inloggningsmetod nedan
                  </div>
                </div>
              </div>
              <Badge variant="outline">
                <AlertCircle className="h-3 w-3 mr-1" />
                Inte inloggad
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  <h4 className="font-medium">Stack Auth Authentication</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Använd Stack Auth för säker inloggning och kontohantering. <strong>OBS:</strong> OAuth-endpoints konfigureras för din specifika Stack Auth-miljö.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button 
                    onClick={handleSignIn}
                    disabled={isLoading}
                    variant="default"
                    className="w-full"
                  >
                    {isLoading ? 'Loggar in...' : 'Logga in'}
                  </Button>
                  
                  <Button 
                    onClick={handleSignUp}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    {isLoading ? 'Skapar konto...' : 'Skapa konto'}
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>
                    <strong>Info:</strong> Du kommer att omdirigeras till Stack Auth's säkra inloggningssida där du kan logga in eller skapa ett nytt konto.
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">Debug Info (klicka för att visa)</summary>
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                      <p><strong>Project ID:</strong> {import.meta.env.VITE_STACK_PROJECT_ID}</p>
                      <p><strong>OAuth URL:</strong> https://app.stack-auth.com/handler/oauth/authorize</p>
                      <p><strong>Redirect URI:</strong> {window.location.origin}{window.location.pathname}</p>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-600">
              {error}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Database Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <h4 className="text-md font-medium">Databasanslutning</h4>
        </div>

        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Neon Database Configuration</div>
                <div className="text-sm text-muted-foreground">
                  Konfigurera säker anslutning till Neon PostgreSQL med Stack Auth
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDatabaseConfigured ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Konfigurerad
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Inte konfigurerad
                  </Badge>
                )}
                <Button
                  onClick={handleDatabaseConfiguration}
                  disabled={databaseConfigLoading || isDatabaseConfigured}
                  size="sm"
                >
                  {databaseConfigLoading ? 'Konfigurerar...' : 
                   isDatabaseConfigured ? 'Konfigurerad' : 'Konfigurera Database'}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Custom Connection Option */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Anpassad databasanslutning</Label>
                  <p className="text-sm text-muted-foreground">
                    Använd en anpassad Neon connection string istället för automatisk konfiguration
                  </p>
                </div>
                <Switch
                  checked={useCustomConnection}
                  onCheckedChange={setUseCustomConnection}
                />
              </div>

              {useCustomConnection && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="custom-connection">Neon Connection String</Label>
                    <Input
                      id="custom-connection"
                      type="password"
                      placeholder="postgresql://user:password@host/database?sslmode=require"
                      value={customConnectionString}
                      onChange={(e) => setCustomConnectionString(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Din connection string från Neon Console. Den kommer att sparas säkert och krypterat.
                    </p>
                  </div>
                  <Button
                    onClick={handleCustomConnection}
                    disabled={databaseConfigLoading || !customConnectionString.trim()}
                    className="w-full"
                  >
                    {databaseConfigLoading ? 'Konfigurerar...' : 'Konfigurera Anpassad Anslutning'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Du måste först logga in med Stack Auth för att konfigurera databasanslutningen.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Help & Documentation */}
      <div className="space-y-3">
        <h4 className="text-md font-medium">Hjälp & Dokumentation</h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Vad är Neon Authentication?</strong><br/>
            Neon är en serverless PostgreSQL-plattform som tillhandahåller säkra, skalbar databaser. 
            Med Stack Auth kan du ansluta till din personliga Neon-databas säkert.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <a href="https://docs.stack-auth.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Stack Auth Docs
              </a>
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <a href="https://neon.tech/docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Neon Dokumentation
              </a>
            </Button>
            <span className="text-muted-foreground">•</span>
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Neon Console
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}