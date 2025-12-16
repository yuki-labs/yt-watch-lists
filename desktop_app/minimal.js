const { app } = require('electron');
console.log('App object:', app);
if (app) {
    console.log('App is defined. Quitting.');
    app.quit();
} else {
    console.error('CRITICAL: App is undefined!');
    process.exit(1);
}
