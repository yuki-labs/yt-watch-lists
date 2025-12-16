const { app, BrowserWindow, ipcMain, dialog, Tray, Menu } = require('electron');
const { loadConfig, saveConfig } = require('./config');
const { startServer, updateVideos, getDeletedVideos, addTombstone } = require('./server');
const path = require('path');

let mainWindow;
let tray = null;
let savePath = null;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        if (savePath) {
            mainWindow.webContents.send('config-loaded', savePath);
            // Load existing videos from file
            const fs = require('fs');
            try {
                if (fs.existsSync(savePath)) {
                    const fileContent = fs.readFileSync(savePath, 'utf-8');
                    let videos = [];
                    let timestamp = 0;
                    let deletedVideos = {};

                    try {
                        const parsed = JSON.parse(fileContent);
                        if (Array.isArray(parsed)) {
                            // Legacy format
                            videos = parsed;
                            timestamp = 0; // Legacy data effectively "old"
                        } else {
                            // New format with optional deletedVideos
                            videos = parsed.videos || [];
                            timestamp = parsed.timestamp || 0;
                            deletedVideos = parsed.deletedVideos || {};
                        }
                    } catch (e) {
                        videos = [];
                    }

                    updateVideos(videos, timestamp, deletedVideos); // Initialize server state with timestamp and tombstones
                    mainWindow.webContents.send('sync-update', videos);
                    const thumbnailsDir = path.join(path.dirname(savePath), 'thumbnails');
                    processThumbnails(videos, thumbnailsDir); // Auto-download on load
                }
            } catch (err) {
                console.error('Error loading saved videos:', err);
            }
        }
    });
}

const { processThumbnails } = require('./utils/thumbnails');

// Helper to start/restart server
function initServer() {
    const thumbnailsPath = savePath ? path.join(path.dirname(savePath), 'thumbnails') : null;

    const listHandlers = {
        getLists: async () => {
            // Reuse the logic from IPC handler
            if (!savePath) throw new Error('No directory selected');
            const dir = path.dirname(savePath);
            const fs = require('fs');
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
            return { success: true, lists: files, current: path.basename(savePath) };
        },
        createList: async (filename) => {
            // Reuse logic
            if (!savePath) throw new Error('No directory selected');
            if (!filename.endsWith('.json')) filename += '.json';
            const dir = path.dirname(savePath);
            const newPath = path.join(dir, filename);
            const fs = require('fs');
            if (fs.existsSync(newPath)) throw new Error('File already exists');
            fs.writeFileSync(newPath, '[]');
            return { success: true };
        },
        switchList: async (filename) => {
            // Reuse logic - this one has side effects (updating savePath)
            if (!savePath) throw new Error('No directory selected');
            const dir = path.dirname(savePath);
            const newPath = path.join(dir, filename);
            const fs = require('fs');
            if (!fs.existsSync(newPath)) throw new Error('File does not exist');

            savePath = newPath;
            saveConfig(savePath);
            const fileContent = fs.readFileSync(savePath, 'utf-8');
            let videos = [];
            let timestamp = 0;
            try {
                const parsed = JSON.parse(fileContent);
                if (Array.isArray(parsed)) {
                    videos = parsed;
                    timestamp = 0;
                } else {
                    videos = parsed.videos || [];
                    timestamp = parsed.timestamp || 0;
                }
            } catch (e) {
                videos = [];
            }
            updateVideos(videos, timestamp);
            mainWindow.webContents.send('sync-update', videos);

            // Recursively restart server? No, just keep running. 
            // Ideally we shouldn't restart server inside a request handler of the server itself if possible, 
            // but here we are just switching data context.
            // We CANNOT call initServer() here because it would kill the server handling THIS request.
            // However, `updateVideos` updates the data served. 
            // Thumbnails path might change if we supported per-list thumbnails folders, 
            // but currently they are shared in the directory.

            return { success: true };
            return { success: true };
        },
        moveVideo: async (videoId, targetFilename) => {
            if (!savePath) throw new Error('No directory selected');
            const dir = path.dirname(savePath);
            const targetPath = path.join(dir, targetFilename.endsWith('.json') ? targetFilename : `${targetFilename}.json`);
            const fs = require('fs');

            if (!fs.existsSync(targetPath)) throw new Error('Target list does not exist');

            // Read Current
            const currentContent = fs.readFileSync(savePath, 'utf-8');
            let currentVideos = JSON.parse(currentContent);
            const videoIndex = currentVideos.findIndex(v => v.id === videoId);

            if (videoIndex === -1) throw new Error('Video not found in current list');

            const video = currentVideos[videoIndex];

            // Read Target
            const targetContent = fs.readFileSync(targetPath, 'utf-8');
            let targetVideos = [];
            try { targetVideos = JSON.parse(targetContent); } catch (e) { targetVideos = []; }

            // Add to Target (avoid duplicates)
            if (!targetVideos.find(v => v.id === videoId)) {
                targetVideos.unshift(video);
            }

            // Remove from Current
            currentVideos.splice(videoIndex, 1);

            // Save Both (Atomic-ish) in new format with timestamp
            const timestamp = Date.now();
            fs.writeFileSync(targetPath, JSON.stringify({ videos: targetVideos, timestamp }, null, 2));
            fs.writeFileSync(savePath, JSON.stringify({ videos: currentVideos, timestamp }, null, 2));

            // Update State
            updateVideos(currentVideos, timestamp);
            mainWindow.webContents.send('sync-update', currentVideos);

            // Move Thumbnail if needed??
            // Currently thumbnails are shared in one folder, so no need to move file.
            // If we deleted it from current, we shouldn't delete the thumbnail because it's now in target.
            // The cleanup logic in save-videos handles this by checking if ID exists in current list.
            // But here we are manipulating files directly.
            // We verify that cleanup logic only runs on strictly 'save-video' or explicit sync, not here.
            // So thumbnail stays safe.

            return { success: true };
        },
        renameList: async (oldFilename, newFilename) => {
            if (!savePath) throw new Error('No directory selected');
            const dir = path.dirname(savePath);
            const fs = require('fs');

            // Normalize names
            if (!oldFilename.endsWith('.json')) oldFilename += '.json';
            if (!newFilename.endsWith('.json')) newFilename += '.json';

            const oldPath = path.join(dir, oldFilename);
            const newPath = path.join(dir, newFilename);

            if (!fs.existsSync(oldPath)) throw new Error('List does not exist');
            if (fs.existsSync(newPath)) throw new Error('A list with that name already exists');

            // Rename
            try {
                fs.renameSync(oldPath, newPath);

                // If we renamed the CURRENT list, update savePath
                if (savePath === oldPath) {
                    savePath = newPath;
                    saveConfig(savePath);
                    // Notify renderers about generic sync-update? 
                    // Or maybe we need a 'config-loaded' or 'list-renamed' event?
                    // For now, list refresh will catch the name change.
                    // But we should update the current context in frontend.
                }

                return { success: true };
            } catch (e) {
                throw new Error('Failed to rename: ' + e.message);
            }
        }
    };

    startServer(5000, (videos) => {
        if (mainWindow) {
            mainWindow.webContents.send('sync-update', videos);
            // Also send updated tombstones
            mainWindow.webContents.send('deleted-videos-update', getDeletedVideos());
        }
        if (savePath) {
            const tPath = path.join(path.dirname(savePath), 'thumbnails');
            processThumbnails(videos, tPath);
        }
    }, () => savePath, thumbnailsPath, listHandlers);
}

// Start Server initially
initServer();

// Electron App Lifecycle
app.whenReady().then(() => {
    savePath = loadConfig();
    createWindow();

    // Restart server if config loaded to ensure paths are correct
    if (savePath) {
        initServer();
    }

    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Watch Later',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
    tray.setToolTip('Watch Later Sync');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else mainWindow.show();
    });
});

app.on('before-quit', () => {
    isQuitting = true;
});

// IPC Handlers
ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Data Directory',
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const dirPath = result.filePaths[0];
        savePath = path.join(dirPath, 'watch_later.json');

        // Ensure thumbnails dir exists
        const thumbnailsPath = path.join(dirPath, 'thumbnails');
        if (!require('fs').existsSync(thumbnailsPath)) {
            require('fs').mkdirSync(thumbnailsPath);
        }

        saveConfig(savePath);

        // Load existing videos if file exists
        const fs = require('fs');
        if (fs.existsSync(savePath)) {
            try {
                const fileContent = fs.readFileSync(savePath, 'utf-8');
                const parsed = JSON.parse(fileContent);
                const videos = Array.isArray(parsed) ? parsed : (parsed.videos || []);
                const timestamp = Array.isArray(parsed) ? 0 : (parsed.timestamp || 0);
                updateVideos(videos, timestamp);
                mainWindow.webContents.send('sync-update', videos);
                processThumbnails(videos, thumbnailsPath); // Auto-download on load
            } catch (err) {
                console.error('Error loading existing file:', err);
            }
        }

        // Restart server with new paths
        initServer();

        return dirPath;
    }
    return null;
});

ipcMain.handle('save-videos', async (event, videos) => {
    if (savePath) {
        try {
            const fs = require('fs');
            const path = require('path');
            const thumbnailsDir = path.join(path.dirname(savePath), 'thumbnails');

            // Cleanup removed thumbnails
            if (fs.existsSync(savePath) && fs.existsSync(thumbnailsDir)) {
                try {
                    const oldContent = fs.readFileSync(savePath, 'utf-8');
                    const oldVideos = JSON.parse(oldContent);
                    const newIds = new Set(videos.map(v => v.id));

                    oldVideos.forEach(v => {
                        if (!newIds.has(v.id)) {
                            const thumbPath = path.join(thumbnailsDir, `${v.id}.jpg`);
                            if (fs.existsSync(thumbPath)) {
                                fs.unlinkSync(thumbPath);
                            }
                        }
                    });
                } catch (e) {
                    console.error('Error cleaning up thumbnails:', e);
                }
            }

            // Atomic write: write to temp file then rename (new format with timestamp)
            const timestamp = Date.now();
            const tempPath = `${savePath}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify({ videos, timestamp }, null, 2));
            fs.renameSync(tempPath, savePath);

            updateVideos(videos, timestamp); // Update server state

            // Auto-download on save
            processThumbnails(videos, thumbnailsDir);

            return { success: true };
        } catch (err) {
            console.error('Error saving file:', err);
            return { success: false, error: err.message };
        }
    }
    return { success: false, error: 'No directory selected' };
});

ipcMain.handle('download-thumbnails', async (event, videos) => {
    if (!savePath) return { success: false, error: 'No directory selected' };
    const thumbnailsDir = path.join(path.dirname(savePath), 'thumbnails');
    await processThumbnails(videos, thumbnailsDir);
    return { success: true, downloaded: 0, errors: [] }; // Simplified response as it's async/background now
});

ipcMain.handle('get-deleted-videos', async () => {
    return getDeletedVideos();
});

ipcMain.handle('add-tombstone', async (event, videoId) => {
    const timestamp = Date.now();
    // Use server's addTombstone to properly update state and version
    const deletedVideos = addTombstone(videoId, timestamp);
    // Also save to file if savePath exists
    if (savePath) {
        try {
            const fs = require('fs');
            const tombstonePath = savePath.replace('.json', '_tombstones.json');
            fs.writeFileSync(tombstonePath, JSON.stringify(deletedVideos, null, 2));
        } catch (e) {
            console.error('Error saving tombstones:', e);
        }
    }
    // Notify renderer about updated tombstones
    if (mainWindow) {
        mainWindow.webContents.send('deleted-videos-update', deletedVideos);
    }
    return { success: true, timestamp };
});

// --- Multiple Lists Support ---

ipcMain.handle('get-lists', async () => {
    if (!savePath) return { success: false, error: 'No directory selected' };
    const dir = path.dirname(savePath);
    try {
        const fs = require('fs');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'package.json' && f !== 'package-lock.json');
        return { success: true, lists: files, current: path.basename(savePath) };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('create-list', async (event, filename) => {
    if (!savePath) return { success: false, error: 'No directory selected' };
    if (!filename.endsWith('.json')) filename += '.json';

    const dir = path.dirname(savePath);
    const newPath = path.join(dir, filename);
    const fs = require('fs');

    if (fs.existsSync(newPath)) return { success: false, error: 'File already exists' };

    try {
        fs.writeFileSync(newPath, '[]');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('switch-list', async (event, filename) => {
    if (!savePath) return { success: false, error: 'No directory selected' };
    const dir = path.dirname(savePath);
    const newPath = path.join(dir, filename);
    const fs = require('fs');

    if (!fs.existsSync(newPath)) return { success: false, error: 'File does not exist' };

    try {
        // Update Save Path
        savePath = newPath;
        saveConfig(savePath); // Persist selection

        // Load Data
        const fileContent = fs.readFileSync(savePath, 'utf-8');
        let videos = [];
        let timestamp = 0;
        try {
            const parsed = JSON.parse(fileContent);
            videos = Array.isArray(parsed) ? parsed : (parsed.videos || []);
            timestamp = Array.isArray(parsed) ? 0 : (parsed.timestamp || 0);
        } catch (e) {
            videos = []; // Handle empty/corrupt files gracefully
            timestamp = 0;
        }

        updateVideos(videos, timestamp);
        mainWindow.webContents.send('sync-update', videos);

        // Restart Server/Thumbnails context
        // Note: Server doesn't strictly need restart as it serves currentVideos array,
        // but we might want to ensure thumbnail path context if it depended on it (it depends on savePath which is global here)
        initServer();

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('rename-list', async (event, { oldFilename, newFilename }) => {
    if (!savePath) return { success: false, error: 'No directory selected' };
    const dir = path.dirname(savePath);
    const fs = require('fs');

    // Normalize
    if (!oldFilename.endsWith('.json')) oldFilename += '.json';
    if (!newFilename.endsWith('.json')) newFilename += '.json';

    const oldPath = path.join(dir, oldFilename);
    const newPath = path.join(dir, newFilename);

    if (!fs.existsSync(oldPath)) return { success: false, error: 'List does not exist' };
    if (fs.existsSync(newPath)) return { success: false, error: 'List already exists' };

    try {
        fs.renameSync(oldPath, newPath);

        if (savePath === oldPath) {
            savePath = newPath;
            saveConfig(savePath);
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('move-video', async (event, { videoId, targetFilename }) => {
    if (!savePath) return { success: false, error: 'No directory selected' };

    // We can reuse the listHandler logic logic if we extracted it, 
    // or just call the handler directly if scope allows. 
    // The handlers are inside initServer scope.
    // So we should probably duplicate the logic or refactor.
    // For safety and speed, let's duplicate the core file logic for IPC or better yet:
    // refactor listHandlers to be outside initServer or attached to something accessible.

    // Actually, let's just implement the file logic here again for now to minimize refactoring risk
    // during this step, as `initServer` closure captures `savePath` which is global anyway.

    try {
        const dir = path.dirname(savePath);
        const targetPath = path.join(dir, targetFilename.endsWith('.json') ? targetFilename : `${targetFilename}.json`);
        const fs = require('fs');

        if (!fs.existsSync(targetPath)) return { success: false, error: 'Target list does not exist' };

        // Read Current
        const currentContent = fs.readFileSync(savePath, 'utf-8');
        let currentVideos = JSON.parse(currentContent);
        const videoIndex = currentVideos.findIndex(v => v.id === videoId);

        if (videoIndex === -1) return { success: false, error: 'Video not found' };

        const video = currentVideos[videoIndex];

        // Read Target
        const targetContent = fs.readFileSync(targetPath, 'utf-8');
        let targetVideos = [];
        try { targetVideos = JSON.parse(targetContent); } catch (e) { targetVideos = []; }

        // Add to Target (at top of list)
        if (!targetVideos.find(v => v.id === videoId)) {
            targetVideos.unshift(video);
        }

        // Remove from Current
        currentVideos.splice(videoIndex, 1);

        // Save (new format with timestamp)
        const timestamp = Date.now();
        fs.writeFileSync(targetPath, JSON.stringify({ videos: targetVideos, timestamp }, null, 2));
        fs.writeFileSync(savePath, JSON.stringify({ videos: currentVideos, timestamp }, null, 2));

        // Update State
        updateVideos(currentVideos, timestamp);
        mainWindow.webContents.send('sync-update', currentVideos);

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
