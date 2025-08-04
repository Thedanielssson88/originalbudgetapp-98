// Debug script för att förstå XLSX kolumnmappning problemet
import XLSX from 'xlsx';
import fs from 'fs';

// Läs XLSX-filen
const workbook = XLSX.readFile('./attached_assets/13040781472_2025.03.25-2025.08.04_1754314127571.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

// Konvertera till CSV för att se strukturen
const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
const lines = csvData.split('\n');

console.log('=== XLSX File Analysis ===');
console.log('Total lines:', lines.length);
console.log('\nFirst 10 lines:');
lines.slice(0, 10).forEach((line, i) => {
  console.log(`Line ${i + 1}: "${line}"`);
});

// Hitta och analysera headers
const dataStartIndex = lines.findIndex(line => 
  line.includes('Datum') || line.includes('Belopp') || line.includes('Text')
);

if (dataStartIndex >= 0) {
  console.log(`\nData starts at line: ${dataStartIndex + 1}`);
  const headers = lines[dataStartIndex].split(';');
  console.log('Headers found:');
  headers.forEach((header, i) => {
    console.log(`  Column ${i + 1}: "${header.trim()}"`);
  });
  
  // Visa ett par datarader
  console.log('\nSample data rows:');
  for (let i = dataStartIndex + 1; i < Math.min(dataStartIndex + 4, lines.length); i++) {
    if (lines[i].trim()) {
      const cells = lines[i].split(';');
      console.log(`Row ${i - dataStartIndex}:`);
      cells.forEach((cell, j) => {
        console.log(`  ${headers[j] || `Col${j+1}`}: "${cell.trim()}"`);
      });
      console.log('---');
    }
  }
  
  // Leta efter kategori-kolumner
  console.log('\nLooking for category columns:');
  headers.forEach((header, i) => {
    const h = header.trim().toLowerCase();
    if (h.includes('kategori') || h.includes('category') || h.includes('huvudkategori') || h.includes('underkategori')) {
      console.log(`  Found category column ${i + 1}: "${header.trim()}"`);
    }
  });
}

// Jämför med CSV-fil
if (fs.existsSync('./attached_assets/Överföring allt_1754314127572.csv')) {
  console.log('\n=== CSV File Comparison ===');
  const csvContent = fs.readFileSync('./attached_assets/Överföring allt_1754314127572.csv', 'utf8');
  const csvLines = csvContent.split('\n');
  const csvHeaders = csvLines[0].split(';');
  
  console.log('CSV Headers:');
  csvHeaders.forEach((header, i) => {
    console.log(`  Column ${i + 1}: "${header.trim()}"`);
  });
  
  console.log('\nSample CSV data:');
  if (csvLines.length > 1) {
    const sampleRow = csvLines[1].split(';');
    sampleRow.forEach((cell, i) => {
      console.log(`  ${csvHeaders[i] || `Col${i+1}`}: "${cell.trim()}"`);
    });
  }
}