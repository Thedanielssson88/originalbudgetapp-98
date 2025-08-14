# Stack Auth Setup för Neon Database Authentication

Stack Auth är en modern autentiseringsplattform som fungerar perfekt med Neon PostgreSQL. Den här guiden visar hur du ställer in Stack Auth för säker databasaccess.

## Snabb setup

Du har redan fått Stack Auth credentials från Neon. Lägg bara till dem i din `.env` fil:

```bash
# Neon Auth environment variables for Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID='9dcd4abe-925d-423b-ac64-d208074f0f61'
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY='pck_t6jg82h8em75mvwmdn5hckaqxcxk7291r6f9ak402ekdr'
STACK_SECRET_SERVER_KEY='ssk_hhmamwdeegr81ey88qyhdveqqa7gegw80xb83z191jh90'

# Database owner connection string
DATABASE_URL='postgresql://neondb_owner:npg_yXbewGR9jN7K@ep-soft-cell-abj1n4kw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
```

## Så här fungerar det

1. **Stack Auth**: Hanterar användarautentisering (Google, GitHub, email/lösenord)
2. **Neon Database**: Säker PostgreSQL databas i molnet
3. **Din app**: Ansluter användare till deras personliga data

## Komma igång

1. Lägg till credentials i `.env` (gjort ✅)
2. Starta din app: `npm run dev`
3. Gå till **Inställningar** → **Avancerat** 
4. Klicka **"Logga in med Stack Auth"**
5. Konfigurera din databasanslutning

## Vad händer när du loggar in?

- Stack Auth verifierar din identitet
- Du får en säker token
- Appen ansluter dig till din del av Neon-databasen
- All data isoleras per användare

## Autentiseringsalternativ

Stack Auth stöder flera inloggningsmetoder:
- 🔑 **Google** - Logga in med ditt Google-konto
- 🐱 **GitHub** - Logga in med GitHub
- 📧 **Email/Lösenord** - Skapa konto med email
- 🔐 **Magic Links** - Lösenordsfri inloggning

## Säkerhet

- **JWT Tokens**: Säkra tokens för API-anrop
- **Data Isolation**: Varje användare ser bara sin egen data
- **Encryption**: All data krypterad i transit och vila
- **Row Level Security**: PostgreSQL säkerhet på rad-nivå

## Felsökning

### "Stack Auth är inte konfigurerat"
- Kontrollera att `NEXT_PUBLIC_STACK_PROJECT_ID` är satt
- Kontrollera att `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` är satt
- Starta om servern efter att ha ändrat `.env`

### "Sign in failed"
- Kontrollera nätverksanslutning
- Testa i inkognito-läge
- Kontrollera browser console för felmeddelanden

### "Database configuration failed"
- Kontrollera att du är inloggad först
- Kontrollera att `DATABASE_URL` är korrekt
- Se server logs för detaljerade felmeddelanden

## Länkar

- [Stack Auth Documentation](https://docs.stack-auth.com)
- [Neon Documentation](https://neon.tech/docs)
- [Neon Console](https://console.neon.tech)

## Support

För problem med integreringen:
1. Kontrollera browser console för fel
2. Kontrollera server logs
3. Testa i inkognito-läge
4. Verifiera alla miljövariabler

Din Stack Auth integration är redan konfigurerad och redo att användas! 🎉