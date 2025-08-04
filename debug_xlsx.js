import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the XLSX file
const filePath = path.join(__dirname, 'attached_assets', '13040781472_2025.03.25-2025.08.04_1754314127571.xlsx');

try {
  console.log('🔍 Reading XLSX file:', filePath);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log('❌ File does not exist:', filePath);
    process.exit(1);
  }
  
  // Read the file
  const workbook = XLSX.readFile(filePath);
  
  console.log('📊 Worksheet names:', workbook.SheetNames);
  
  // Get the first worksheet
  const worksheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[worksheetName];
  
  // Convert to CSV format with semicolon delimiter (matching the app)
  const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
  
  // Split into lines and analyze
  const lines = csvData.split('\n');
  console.log('📊 Total lines:', lines.length);
  
  // Show headers
  if (lines.length > 0) {
    console.log('📋 Headers:', lines[0]);
    const headers = lines[0].split(';');
    console.log('📋 Parsed headers array:', headers);
  }
  
  // Look for April 2025 data
  const aprilLines = lines.filter(line => line.includes('2025-04'));
  console.log('🗓️  April 2025 lines found:', aprilLines.length);
  
  // Show first few April lines
  console.log('🗓️  First 5 April lines:');
  aprilLines.slice(0, 5).forEach((line, index) => {
    console.log(`   ${index + 1}: ${line}`);
  });
  
  // Show overall data structure
  console.log('📊 First 10 lines of converted CSV:');
  lines.slice(0, 10).forEach((line, index) => {
    console.log(`   ${index + 1}: ${line}`);
  });
  
  // Save converted CSV for inspection
  const outputPath = path.join(__dirname, 'debug_output.csv');
  fs.writeFileSync(outputPath, csvData);
  console.log('💾 Converted CSV saved to:', outputPath);
  
} catch (error) {
  console.error('❌ Error processing XLSX file:', error);
}