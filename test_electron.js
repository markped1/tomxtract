const electron = require('electron');
console.log('Process type:', process.type);
console.log('Electron module type:', typeof electron);
if (typeof electron === 'string') {
  console.log('Shim detected. Path:', electron);
  // Try to find the built-in one if possible
  try {
    const internalApp = process.electronBinding ? process.electronBinding('app') : 'No electronBinding';
    console.log('Internal app binding:', internalApp);
  } catch (e) {
    console.log('Failed to get internal binding:', e.message);
  }
} else {
  console.log('Keys:', Object.keys(electron));
}
process.exit(0);
