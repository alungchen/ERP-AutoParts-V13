const { execSync } = require('child_process');
const path = require('path');

const DB_NAME = 'erp-db';

try {
  const query = `SELECT p_id, part_number, name FROM products WHERE part_number LIKE '%COM-T016T%';`;
  const resultJson = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="${query}" --json`, { cwd: path.join(__dirname, '..'), encoding: 'utf-8' });
  
  console.log(resultJson);
} catch (e) {
  console.error(e.message);
}
