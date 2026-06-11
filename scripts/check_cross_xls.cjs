const xlsx = require('xlsx');
const wb = xlsx.readFile('D:\\Downloads\\cross.xlsx');
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log(data.slice(0, 5));
