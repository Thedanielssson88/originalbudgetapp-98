// Quick test för XLSX-kategori mappning
import XLSX from 'xlsx';

console.log('=== XLSX DIRECT TEST ===');

// Läs XLSX-filen direkt
const workbook = XLSX.readFile('./attached_assets/13040781472_2025.03.25-2025.08.04_1754314127571.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Konvertera till CSV
const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
const lines = csvData.split('\n').filter(line => line.trim());

console.log(`Total lines: ${lines.length}`);
console.log('First 5 lines:');
lines.slice(0, 5).forEach((line, i) => console.log(`${i}: ${line}`));

// Hitta header-raden
let headerIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Datum') && lines[i].includes('Kategori')) {
    headerIndex = i;
    break;
  }
}

if (headerIndex >= 0) {
  console.log(`\nHeader found at line ${headerIndex}: ${lines[headerIndex]}`);
  const headers = lines[headerIndex].split(';');
  console.log('Headers:', headers);
  
  // Leta efter kategori-kolumner
  const kategoriIndex = headers.indexOf('Kategori');
  const underkategoriIndex = headers.indexOf('Underkategori');
  
  console.log(`Kategori index: ${kategoriIndex}, Underkategori index: ${underkategoriIndex}`);
  
  // Visa sample data
  if (lines.length > headerIndex + 1) {
    const sampleLine = lines[headerIndex + 1];
    const fields = sampleLine.split(';');
    console.log(`\nSample line: ${sampleLine}`);
    console.log(`Kategori value: "${fields[kategoriIndex] || 'MISSING'}"`);
    console.log(`Underkategori value: "${fields[underkategoriIndex] || 'MISSING'}"`);
  }
} else {
  console.log('No header row found!');
}