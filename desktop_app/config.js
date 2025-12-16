const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getConfigPath() {
    return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath));
            return config.savePath || null;
        }
    } catch (err) {
        console.error('Error loading config:', err);
    }
    return null;
}

function saveConfig(savePath) {
    try {
        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify({ savePath }));
    } catch (err) {
        console.error('Error saving config:', err);
    }
}

module.exports = { loadConfig, saveConfig };
