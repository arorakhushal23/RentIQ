const fs = require('fs');
const path = require('path');
const routesDir = path.join(__dirname, '..', 'backend', 'routes');
const files = fs.readdirSync(routesDir);
const report = {};
files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const regex = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  let match;
  const list = [];
  while ((match = regex.exec(content)) !== null) {
    list.push({ method: match[1].toUpperCase(), path: match[2] });
  }
  report[file] = list;
});
console.log(JSON.stringify(report, null, 2));

