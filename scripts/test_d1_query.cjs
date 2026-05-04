const { execSync } = require('child_process');
const path = require('path');

try {
  const resultJson = execSync(`npx wrangler d1 execute erp-db --remote --command="SELECT p_id, part_number, name FROM products LIMIT 5;" --json`, { cwd: path.join(__dirname, '..'), encoding: 'utf-8' });
  console.log(resultJson);
} catch (e) {
  console.error(e.message);
}
