const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

let currentVideos = [];
let currentTimestamp = 0;
let currentDeletedVideos = {}; // Tombstones: { videoId: deletionTimestamp }
let dataVersion = Date.now();

function updateVideos(videos, timestamp = Date.now(), deletedVideos = null) {
    currentVideos = videos;
    currentTimestamp = timestamp;
    if (deletedVideos !== null) {
        currentDeletedVideos = deletedVideos;
    }
    dataVersion = Date.now();
    console.log(`Server updated. Videos: ${videos.length}, Tombstones: ${Object.keys(currentDeletedVideos).length}, Timestamp: ${currentTimestamp}`);
}

function addTombstone(videoId, timestamp = Date.now()) {
    currentDeletedVideos[videoId] = timestamp;
    currentTimestamp = timestamp; // Update timestamp so clients see the change
    dataVersion = Date.now();
    console.log(`Tombstone added for ${videoId}. Total tombstones: ${Object.keys(currentDeletedVideos).length}`);
    return currentDeletedVideos;
}

let serverInstance = null;

function startServer(port, onSync, getSavePath, thumbnailsPath, listHandlers) {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
    }

    const server = express();
    server.use(cors()); // Allow all CORS requests for local network access
    server.use(bodyParser.json());

    if (thumbnailsPath) {
        server.use('/thumbnails', express.static(thumbnailsPath));
    }

    server.get('/status', (req, res) => {
        res.send({ status: 'running', version: dataVersion });
    });

    server.get('/videos', (req, res) => {
        // Filter out tombstoned videos before returning
        const filteredVideos = currentVideos.filter(v => !currentDeletedVideos[v.id]);
        res.send({ videos: filteredVideos, timestamp: currentTimestamp, deletedVideos: currentDeletedVideos });
    });

    // List Management Endpoints
    if (listHandlers) {
        server.get('/lists', async (req, res) => {
            try {
                const result = await listHandlers.getLists();
                res.send(result);
            } catch (e) {
                res.status(500).send({ success: false, error: e.message });
            }
        });

        server.post('/lists/create', async (req, res) => {
            try {
                const { filename } = req.body;
                if (!filename) return res.status(400).send({ success: false, error: 'Filename required' });
                const result = await listHandlers.createList(filename);
                res.send(result);
            } catch (e) {
                res.status(500).send({ success: false, error: e.message });
            }
        });

        server.post('/lists/switch', async (req, res) => {
            try {
                const { filename } = req.body;
                if (!filename) return res.status(400).send({ success: false, error: 'Filename required' });
                const result = await listHandlers.switchList(filename);
                res.send(result);
            } catch (e) {
                res.status(500).send({ success: false, error: e.message });
            }
        });

        server.post('/lists/move', async (req, res) => {
            try {
                const { videoId, targetFilename } = req.body;
                if (!videoId || !targetFilename) return res.status(400).send({ success: false, error: 'Missing parameters' });
                const result = await listHandlers.moveVideo(videoId, targetFilename);
                res.send(result);
            } catch (e) {
                res.status(500).send({ success: false, error: e.message });
            }
        });

        server.post('/lists/rename', async (req, res) => {
            try {
                const { oldFilename, newFilename } = req.body;
                if (!oldFilename || !newFilename) return res.status(400).send({ success: false, error: 'Missing parameters' });
                const result = await listHandlers.renameList(oldFilename, newFilename);
                res.send(result);
            } catch (e) {
                res.status(500).send({ success: false, error: e.message });
            }
        });
    }

    server.post('/sync', (req, res) => {
        const { videos, timestamp, deletedVideos } = req.body;
        // Default to 0 if no timestamp provided (legacy client)
        const clientTimestamp = timestamp || 0;
        const clientDeletedVideos = deletedVideos || {};

        if (!videos) {
            return res.status(400).send({ error: 'No videos provided' });
        }

        // Conflict Resolution
        // If server data is NEWER than client data, reject the update and send back server data.
        // We give a small buffer? No, strict > is fine.
        // If timestamps are equal, we accept client (last write wins / identical).
        if (currentTimestamp > clientTimestamp) {
            console.log(`Conflict: Server (${currentTimestamp}) > Client (${clientTimestamp}). Sending server data.`);
            return res.send({
                status: 'conflict',
                serverVideos: currentVideos,
                serverTimestamp: currentTimestamp,
                serverDeletedVideos: currentDeletedVideos
            });
        }

        // Accept Update (Client is newer or equal)
        console.log(`Sync accepted: Client (${clientTimestamp}) >= Server (${currentTimestamp}). Updating.`);

        // Merge tombstones (keep newer deletion for each ID)
        const mergedDeletedVideos = { ...currentDeletedVideos };
        for (const [id, ts] of Object.entries(clientDeletedVideos)) {
            if (!mergedDeletedVideos[id] || ts > mergedDeletedVideos[id]) {
                mergedDeletedVideos[id] = ts;
            }
        }

        // MERGE videos: use client's order but preserve server-only videos
        const clientVideoIds = new Set(videos.map(v => v.id));
        const mergedVideos = [...videos];

        // Add server-only videos (not in client and not tombstoned)
        for (const v of currentVideos) {
            if (!clientVideoIds.has(v.id)) {
                // Check if tombstoned
                const tombstoneTs = mergedDeletedVideos[v.id];
                const addedAt = v.addedAt || 0;
                if (!tombstoneTs || addedAt > tombstoneTs) {
                    console.log("Preserving server-only video:", v.id);
                    mergedVideos.push(v); // Add to end (client videos have priority)
                }
            }
        }

        // Clear tombstones for videos that have been re-added (addedAt > tombstoneTs)
        for (const v of mergedVideos) {
            const tombstoneTs = mergedDeletedVideos[v.id];
            if (tombstoneTs) {
                const addedAt = v.addedAt || 0;
                if (addedAt > tombstoneTs) {
                    console.log("Clearing tombstone for re-added video:", v.id);
                    delete mergedDeletedVideos[v.id];
                }
            }
        }

        // Update local state with merged data
        updateVideos(mergedVideos, clientTimestamp, mergedDeletedVideos);

        // Notify main process with merged videos
        onSync(mergedVideos);

        // Save to file if path exists
        const savePath = getSavePath();
        if (savePath) {
            try {
                // Cleanup removed thumbnails
                if (thumbnailsPath && fs.existsSync(savePath)) {
                    try {
                        const path = require('path');
                        const oldContent = fs.readFileSync(savePath, 'utf-8');
                        // Handle legacy array format vs new object format
                        let oldVideos = [];
                        try {
                            const parsed = JSON.parse(oldContent);
                            if (Array.isArray(parsed)) {
                                oldVideos = parsed;
                            } else {
                                oldVideos = parsed.videos || [];
                            }
                        } catch (e) { }

                        const newIds = new Set(videos.map(v => v.id));

                        oldVideos.forEach(v => {
                            if (!newIds.has(v.id)) {
                                const thumbPath = path.join(thumbnailsPath, `${v.id}.jpg`);
                                if (fs.existsSync(thumbPath)) {
                                    fs.unlinkSync(thumbPath);
                                }
                            }
                        });
                    } catch (e) {
                        console.error('Error cleaning up thumbnails:', e);
                    }
                }

                // Atomic write combined object
                // Filter videos using timestamp-based tombstone logic
                const cleanedVideos = mergedVideos.filter(v => {
                    const tombstoneTs = mergedDeletedVideos[v.id];
                    if (!tombstoneTs) return true;
                    const addedAt = v.addedAt || 0;
                    return addedAt > tombstoneTs;
                });

                const fileData = {
                    videos: cleanedVideos,
                    timestamp: clientTimestamp,
                    deletedVideos: mergedDeletedVideos
                };

                const tempPath = `${savePath}.tmp`;
                fs.writeFileSync(tempPath, JSON.stringify(fileData, null, 2));
                fs.renameSync(tempPath, savePath);

                // Also update the in-memory videos to the cleaned version
                currentVideos = cleanedVideos;

                res.send({ status: 'success', saved: true, version: dataVersion });
            } catch (err) {
                console.error('Error saving file:', err);
                res.status(500).send({ error: 'Failed to save file' });
            }
        } else {
            res.send({ status: 'success', saved: false, message: 'No save path selected', version: dataVersion });
        }
    });

    // Listen on 0.0.0.0 to allow external connections (e.g. from mobile app)
    serverInstance = server.listen(port, '0.0.0.0', () => {
        console.log(`Sync server running on port ${port}`);
    });

    serverInstance.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log('Address in use, retrying...');
            setTimeout(() => {
                serverInstance.close();
                serverInstance.listen(port, '0.0.0.0');
            }, 1000);
        }
    });
}
// Note: We need to inject the list management functions or move them to a shared module.
// For now, main.js handles IPC. We should probably update startServer to accept a 'context' object or similar.
// Actually, since main.js imports server.js, we can just export a 'setListHandlers' function or pass them in startServer options.
// Let's refactor startServer signature slightly in the next step to accept list handlers.

function getDeletedVideos() {
    return currentDeletedVideos;
}

module.exports = { startServer, updateVideos, getDeletedVideos, addTombstone };

