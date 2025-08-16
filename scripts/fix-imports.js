const fs = require('fs');
const path = require('path');

// Fix import paths in compiled JavaScript files
const mainJsPath = path.join(__dirname, '../dist/main/main/main.js');
const preloadJsPath = path.join(__dirname, '../dist/main/main/preload.js');

// Read and fix main.js
if (fs.existsSync(mainJsPath)) {
  let content = fs.readFileSync(mainJsPath, 'utf8');
  content = content.replace(/require\("\.\.\/shared\/types"\)/g, 'require("../shared/types")');
  fs.writeFileSync(mainJsPath, content);
  console.log('✅ Fixed imports in main.js');
}

// Read and fix preload.js
if (fs.existsSync(preloadJsPath)) {
  let content = fs.readFileSync(preloadJsPath, 'utf8');
  content = content.replace(/require\("\.\.\/shared\/types"\)/g, 'require("../shared/types")');
  fs.writeFileSync(preloadJsPath, content);
  console.log('✅ Fixed imports in preload.js');
}

console.log('✅ Import paths fixed in compiled files');
