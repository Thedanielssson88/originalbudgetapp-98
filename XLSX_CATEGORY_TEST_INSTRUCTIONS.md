# XLSX Kategorimappning Test

## Problem som skulle vara löst:
- XLSX-filer visade "-" för bankCategory och bankSubCategory 
- CSV-filer fungerade korrekt
- Kategoridata fanns i XLSX men sparades inte till transaktioner

## Förbättringar som gjorts:
1. ✅ Förbättrad header-sökning för att hitta rätt kolumnindex
2. ✅ Detaljerad loggning för kategorikolumner i XLSX-parsning  
3. ✅ Specifik debug-information för bankCategory och bankSubCategory mappning

## Test-instruktioner:

### Steg 1: Ladda upp XLSX-fil
1. Gå till "Importera transaktioner" 
2. Välj kontot "Hushållskonto"
3. Ladda upp filen: `13040781472_2025.03.25-2025.08.04_1754314127571.xlsx`

### Steg 2: Kontrollera konsol-loggar
Öppna Developer Console (F12 > Console) och leta efter:

```
🔍 [XLSX] Found header row at index: X
🔍 [XLSX] Category column "Kategori" at position Y
🔍 [XLSX] Category column "Underkategori" at position Z
🔍 [XLSX] Sample Kategori: "Övriga utgifter" at index Y
🔍 [XLSX] Sample Underkategori: "Övriga kontoöverföringar" at index Z
```

Sedan i parseCSVContent:
```
[ORCHESTRATOR] 🔍 Column indices - BankCategory: Y, BankSubCategory: Z
[ORCHESTRATOR] 🔍 Processing line X: BankCategory: "Övriga utgifter", BankSubCategory: "Övriga kontoöverföringar"
```

### Steg 3: Kontrollera resultatet
Efter import, växla till "Transaktionslista" och kontrollera:
- Bankkategori-kolumnen ska visa faktiska kategorier (t.ex. "Övriga utgifter") istället för "-"
- Underkategori-kolumnen ska visa underkategorier (t.ex. "Övriga kontoöverföringar") istället för "-"

## Förväntade resultat:
- ✅ XLSX-kategorier ska nu mappas korrekt
- ✅ Transaktioner ska visa bankCategory och bankSubCategory istället för "-"
- ✅ Samma kategorifunktionalitet som CSV-filer

Rapportera tillbaka om kategorierna nu visas korrekt!