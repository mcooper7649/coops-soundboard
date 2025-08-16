const fs = require('fs');
const path = require('path');

// Copy shared types to main output directory
const sharedTypesPath = path.join(__dirname, '../dist/main/shared/types.js');
const mainOutputPath = path.join(__dirname, '../dist/main');

if (fs.existsSync(sharedTypesPath)) {
  // Create a copy in the main directory
  const content = fs.readFileSync(sharedTypesPath, 'utf8');
  fs.writeFileSync(path.join(mainOutputPath, 'types.js'), content);
  console.log('✅ Shared types copied to main output directory');
} else {
  console.log('❌ Shared types not found at:', sharedTypesPath);
}
