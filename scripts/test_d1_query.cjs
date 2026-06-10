const { execSync } = require('child_process');
const path = require('path');

try {
  const resultJson = execSync(`node node_modules/wrangler/bin/wrangler.js d1 execute erp-db --remote --command="SELECT count(*) FROM product_stock;" --json`, { cwd: path.join(__dirname, '..'), encoding: 'utf-8' });



  const data = JSON.parse(resultJson);
  console.log(JSON.stringify(data[0].results, null, 2));
} catch (e) {
  console.error("Error executing:", e.message);
}


