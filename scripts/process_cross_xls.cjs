const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { execSync } = require('child_process');

const inputFile = 'D:\\Downloads\\cross.xlsx';
const outputFile = 'D:\\Downloads\\cross_result.xlsx';

console.log(`Reading ${inputFile}...`);
const wb = xlsx.readFile(inputFile);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
let data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Fetching products from local D1 database...');
const dbCmd = `npx wrangler d1 execute erp-db --local --command="SELECT p_id, name, part_numbers, car_models, brand, specifications FROM products" --json`;

let dbOutput;
try {
  dbOutput = execSync(dbCmd, { maxBuffer: 1024 * 1024 * 50 }).toString();
} catch (e) {
  console.error("Failed to fetch database", e);
  process.exit(1);
}

// Find the JSON array in the wrangler output
const jsonStart = dbOutput.indexOf('[');
const jsonEnd = dbOutput.lastIndexOf(']') + 1;
if (jsonStart === -1 || jsonEnd === 0) {
    console.error("Failed to parse JSON output from wrangler:", dbOutput);
    process.exit(1);
}

const parsedOutput = JSON.parse(dbOutput.substring(jsonStart, jsonEnd));
// wrangler d1 execute --json returns an array of results. The first object has a "results" array.
const products = parsedOutput[0].results;

const productMap = new Map();
for (const p of products) {
    productMap.set(p.p_id, p);
}

console.log(`Fetched ${products.length} products. Matching with excel data...`);

// Ensure headers
if (data.length > 0) {
    // Check if we already have the columns, if not append them
    let headerRow = data[0];
    if (headerRow.indexOf('內容') === -1) headerRow.push('內容');
    if (headerRow.indexOf('適用車型料號') === -1) headerRow.push('適用車型料號');
}

const contentColIdx = data[0].indexOf('內容');
const carModelPartNumColIdx = data[0].indexOf('適用車型料號');

for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || !row[0]) continue;
    
    const pid = String(row[0]).trim();
    const product = productMap.get(pid);
    
    let content = '';
    let applicablePartNums = '';
    
    if (product) {
        // Build content
        content = [product.name, product.brand, product.specifications].filter(Boolean).join(' | ');
        
        // Build applicable car model part numbers
        try {
            if (product.part_numbers && product.part_numbers !== '[]') {
                const pnList = JSON.parse(product.part_numbers);
                applicablePartNums = pnList.map(pn => {
                    let s = pn.part_number;
                    if (pn.car_model) s += ` (${pn.car_model})`;
                    return s;
                }).filter(Boolean).join(', ');
            } else if (product.car_models && product.car_models !== '[]') {
                const cmList = JSON.parse(product.car_models);
                applicablePartNums = cmList.map(cm => cm.model).join(', ');
            }
        } catch (e) {
            console.error(`Error parsing JSON for pid ${pid}:`, e);
        }
    } else {
        content = '找不到此料號';
    }
    
    // Fill data
    row[contentColIdx] = content;
    row[carModelPartNumColIdx] = applicablePartNums;
}

console.log(`Writing result to ${outputFile}...`);
const newWs = xlsx.utils.aoa_to_sheet(data);
const newWb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
xlsx.writeFile(newWb, outputFile);

console.log('Done!');
