import { getLastModified, saveVideos, getDeletedVideos, saveDeletedVideos } from './storage.js';

export async function syncVideos(videos) {
    try {
        const timestamp = await getLastModified();
        const deletedVideos = await getDeletedVideos();

        const response = await fetch('http://127.0.0.1:5000/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videos: videos, timestamp: timestamp, deletedVideos: deletedVideos })
        });

        if (response.ok) {
            const data = await response.json();

            // Handle Conflict (Server has newer data)
            if (data.status === 'conflict') {
                console.log('Server has newer data. Updating local...');
                // Set flag with timestamp to prevent auto-sync listener from re-syncing
                await chrome.storage.local.set({ _syncFromServer: Date.now() });
                await saveVideos(data.serverVideos, data.serverTimestamp);
                // Also save server's tombstones
                if (data.serverDeletedVideos) {
                    await saveDeletedVideos(data.serverDeletedVideos);
                }
                // Clear flag after delay to allow listener to process
                setTimeout(() => chrome.storage.local.remove('_syncFromServer'), 1000);
                return { success: true, updatedFromServer: true, videos: data.serverVideos };
            }

            return { success: true, saved: data.saved };
        } else {
            return { success: false, error: 'Sync failed' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function getLists() {
    try {
        const response = await fetch('http://127.0.0.1:5000/lists');
        if (response.ok) {
            return await response.json();
        } else {
            return { success: false, error: 'Failed to fetch lists' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function createList(filename) {
    try {
        const response = await fetch('http://127.0.0.1:5000/lists/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (response.ok) {
            return await response.json();
        } else {
            return { success: false, error: 'Failed to create list' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function switchList(filename) {
    try {
        const response = await fetch('http://127.0.0.1:5000/lists/switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (response.ok) {
            return await response.json();
        } else {
            return { success: false, error: 'Failed to switch list' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function moveVideo(videoId, targetFilename) {
    try {
        const response = await fetch('http://127.0.0.1:5000/lists/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, targetFilename })
        });
        if (response.ok) {
            return await response.json();
        } else {
            return { success: false, error: 'Failed to move video' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function renameList(oldFilename, newFilename) {
    try {
        const response = await fetch('http://127.0.0.1:5000/lists/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldFilename, newFilename })
        });
        if (response.ok) {
            return await response.json();
        } else {
            return { success: false, error: 'Failed to rename list' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function deleteList(filename) {
    try {
        const response = await fetch('http://127.0.0.1:5000/lists/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (response.ok) {
            return await response.json();
        } else {
            const data = await response.json().catch(() => ({}));
            return { success: false, error: data.error || 'Failed to delete list' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export async function fetchRemoteVideos() {
    try {
        const response = await fetch('http://127.0.0.1:5000/videos');
        if (response.ok) {
            const data = await response.json();
            // Return { videos, timestamp } for comparison
            return data;
        } else {
            return null;
        }
    } catch (error) {
        console.warn('Server not available:', error);
        return null;
    }
}
