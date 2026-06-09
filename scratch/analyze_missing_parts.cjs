const { execSync } = require('child_process');

console.log('=== Fetching Missing Part IDs ===');
try {
  const query = "SELECT DISTINCT p_id FROM document_items WHERE p_id NOT IN (SELECT p_id FROM products) ORDER BY p_id;";
  const result = execSync(`npx wrangler d1 execute erp-db --remote --command="${query}" --json`, { encoding: 'utf8' });
  const parsed = JSON.parse(result);
  
  if (parsed && parsed[0] && parsed[0].results) {
    const pIds = parsed[0].results.map(r => r.p_id);
    console.log(`Total missing part IDs: ${pIds.length}`);
    
    // Group by prefix (split by hyphen or first 3-4 chars)
    const groups = {};
    for (const pId of pIds) {
      // Find prefix, e.g. "EUE-1242" -> "EUE-" or "EUE"
      // If no hyphen, e.g. "a0038304460" -> "a003"
      const match = pId.match(/^([A-Za-z0-9]+-)/);
      const prefix = match ? match[1] : pId.substring(0, 3);
      groups[prefix] = (groups[prefix] || 0) + 1;
    }
    
    // Sort groups by count descending
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    console.log('\nTop 20 Prefixes:');
    sortedGroups.slice(0, 20).forEach(([prefix, count]) => {
      console.log(`  ${prefix.padEnd(10)} : ${count} parts`);
    });
    
    console.log(`\nTotal distinct prefixes: ${sortedGroups.length}`);
    
    // Write all sorted prefixes to a file to show the user
    const prefixList = sortedGroups.map(([prefix]) => prefix);
    console.log(`Sample prefixes: ${prefixList.slice(0, 10).join(', ')}`);
  }
} catch (e) {
  console.error('Error:', e.message);
}
