const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'output');
if (fs.existsSync(outputDir)) {
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.csv'));
  console.log(`CSV files in output: ${files.join(', ')}`);
  
  for (const file of files) {
    if (file.startsWith('documents_master_') || file.startsWith('documents_detail_')) {
      const filePath = path.join(outputDir, file);
      const buffer = fs.readFileSync(filePath);
      console.log(`\nFile: ${file} (Size: ${buffer.length} bytes)`);
      // check first 100 bytes hex
      console.log('Hex:', buffer.slice(0, 100).toString('hex'));
      // try utf8
      console.log('UTF-8 String:', buffer.slice(0, 200).toString('utf8'));
    }
  }
} else {
  console.log('output dir not found');
}
