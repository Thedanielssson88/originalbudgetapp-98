# Google Drive Integration Setup

För att aktivera automatisk molnsynkronisering med Google Drive behöver du konfigurera Google Drive API.

## Steg 1: Skapa Google Cloud-projekt

1. Gå till [Google Cloud Console](https://console.cloud.google.com/)
2. Skapa ett nytt projekt eller välj ett befintligt
3. Aktivera Google Drive API:
   - Gå till **APIs & Services > Library**
   - Sök efter "Google Drive API" och klicka **Enable**

## Steg 2: Skapa OAuth 2.0-referenser

1. Gå till **APIs & Services > Credentials**
2. Klicka **Create Credentials > OAuth 2.0 Client ID**
3. Konfigurera OAuth consent screen först om du inte redan gjort det:
   - Välj **External** om du inte har Google Workspace
   - Fyll i appens namn och e-postadress
   - Lägg till scopes: `https://www.googleapis.com/auth/drive.file`
4. Skapa OAuth 2.0 Client ID:
   - Välj **Web application**
   - Lägg till din domän i **Authorized JavaScript origins**:
     - För development: `http://localhost:5000`
     - För production: `https://din-app.replit.app`

## Steg 3: Skapa API-nyckel

1. I **APIs & Services > Credentials**
2. Klicka **Create Credentials > API Key**
3. Rekommendera att begränsa nyckeln till Google Drive API

## Steg 4: Konfigurera miljövariabler

Lägg till följande miljövariabler i Replit Secrets:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

## Steg 5: Testa integration

1. Starta om appen
2. Gå till **Inställningar > Google Drive**
3. Klicka **"Logga in till Google Drive"**
4. Godkänn åtkomst till ditt Google Drive
5. Testa att spara och återställa backup

## Säkerhet

- Håll API-nyckeln och Client ID hemliga
- Använd begränsade scopes (`drive.file` istället för `drive`)
- Överväg att använda domänbegränsningar för API-nyckeln i production

## Felsökning

**"API credentials not configured"**
- Kontrollera att miljövariablerna är satta korrekt
- Starta om appen efter att ha lagt till miljövariabler

**"Inloggning misslyckades"**
- Kontrollera att din domän är listad i OAuth 2.0-klientens "Authorized JavaScript origins"
- Kontrollera att Google Drive API är aktiverat

**"Backup misslyckades"**
- Kontrollera att användaren har godkänt åtkomst till Drive
- Kontrollera konsolloggar för detaljerade felmeddelanden