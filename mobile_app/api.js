import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const IP_KEY = 'desktop_ip';
const VIDEOS_KEY = 'local_videos';
const TIMESTAMP_KEY = 'local_timestamp';
const DELETED_VIDEOS_KEY = 'deleted_videos';
const PENDING_SYNC_KEY = 'pending_sync';

export const getServerIp = async () => {
    try {
        return await AsyncStorage.getItem(IP_KEY);
    } catch (e) {
        console.error('Failed to get IP', e);
        return null;
    }
};

export const setServerIp = async (ip) => {
    try {
        await AsyncStorage.setItem(IP_KEY, ip);
    } catch (e) {
        console.error('Failed to set IP', e);
    }
};

// Local Storage Helpers
export const saveLocalVideos = async (videos, timestamp = null) => {
    try {
        await AsyncStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
        if (timestamp !== null) {
            await AsyncStorage.setItem(TIMESTAMP_KEY, String(timestamp));
        }
    } catch (e) {
        console.error('Failed to save local videos', e);
    }
};

export const getLocalVideos = async () => {
    try {
        const json = await AsyncStorage.getItem(VIDEOS_KEY);
        return json ? JSON.parse(json) : [];
    } catch (e) {
        console.error('Failed to get local videos', e);
        return [];
    }
};

export const getLocalTimestamp = async () => {
    try {
        const ts = await AsyncStorage.getItem(TIMESTAMP_KEY);
        return ts ? parseInt(ts, 10) : 0;
    } catch (e) {
        return 0;
    }
};

export const getDeletedVideos = async () => {
    try {
        const json = await AsyncStorage.getItem(DELETED_VIDEOS_KEY);
        return json ? JSON.parse(json) : {};
    } catch (e) {
        return {};
    }
};

export const saveDeletedVideos = async (deletedVideos) => {
    try {
        await AsyncStorage.setItem(DELETED_VIDEOS_KEY, JSON.stringify(deletedVideos));
    } catch (e) {
        console.error('Failed to save deleted videos', e);
    }
};

export const setPendingSync = async (isPending) => {
    try {
        await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(isPending));
    } catch (e) {
        console.error('Failed to set pending sync', e);
    }
};

export const getPendingSync = async () => {
    try {
        const json = await AsyncStorage.getItem(PENDING_SYNC_KEY);
        return json ? JSON.parse(json) : false;
    } catch (e) {
        return false;
    }
};

// Filter videos based on tombstones using timestamp comparison
const filterTombstoned = (videos, tombstones) => {
    return videos.filter(v => {
        const tombstoneTs = tombstones[v.id];
        if (!tombstoneTs) return true;
        const addedAt = v.addedAt || 0;
        return addedAt > tombstoneTs;
    });
};

export const fetchVideos = async () => {
    try {
        const ip = await getServerIp();
        if (!ip) throw new Error('No Server IP configured');

        const response = await fetch(`http://${ip}/videos`);
        if (!response.ok) throw new Error('Failed to fetch videos');

        const data = await response.json();

        // Handle both old format (array) and new format ({ videos, timestamp, deletedVideos })
        let serverVideos, serverTimestamp, serverTombstones;
        if (Array.isArray(data)) {
            serverVideos = data;
            serverTimestamp = 0;
            serverTombstones = {};
        } else {
            serverVideos = data.videos || [];
            serverTimestamp = data.timestamp || 0;
            serverTombstones = data.deletedVideos || {};
        }

        // Get local data
        const localVideos = await getLocalVideos();
        const localTimestamp = await getLocalTimestamp();
        const localTombstones = await getDeletedVideos();

        // Merge tombstones
        const mergedTombstones = { ...localTombstones };
        for (const [id, ts] of Object.entries(serverTombstones)) {
            if (!mergedTombstones[id] || ts > mergedTombstones[id]) {
                mergedTombstones[id] = ts;
            }
        }

        let resultVideos;

        if (serverTimestamp > localTimestamp) {
            // Server is newer - use server's order but merge local-only videos
            const serverVideoIds = new Set(serverVideos.map(v => v.id));
            resultVideos = [...serverVideos];
            let hasLocalOnlyVideos = false;

            // Add local-only videos (not in server and not tombstoned)
            for (const v of localVideos) {
                if (!serverVideoIds.has(v.id)) {
                    const tombstoneTs = mergedTombstones[v.id];
                    const addedAt = v.addedAt || 0;
                    if (!tombstoneTs || addedAt > tombstoneTs) {
                        resultVideos.unshift(v);
                        hasLocalOnlyVideos = true;
                    }
                }
            }

            // Save with NEW timestamp if we added local videos
            const newTimestamp = hasLocalOnlyVideos ? Date.now() : serverTimestamp;
            await saveLocalVideos(resultVideos, newTimestamp);

            // Push merged list back to server for consistent ordering
            if (hasLocalOnlyVideos) {
                try {
                    await syncVideos(resultVideos);
                } catch (e) {
                    console.log('Push merged list failed:', e);
                }
            }
        } else {
            // Local is newer or equal - keep local
            resultVideos = localVideos;
            // NOTE: We do NOT push here. Only explicit user actions (reorder, add, delete)
            // should push to server. This prevents overwriting server changes just because
            // mobile's local timestamp is newer from a previous sync.
        }

        // Save merged tombstones
        await saveDeletedVideos(mergedTombstones);

        // Filter and return
        return filterTombstoned(resultVideos, mergedTombstones);
    } catch (e) {
        console.log('Network fetch failed, falling back to local', e);
        const localVideos = await getLocalVideos();
        const localTombstones = await getDeletedVideos();
        return filterTombstoned(localVideos, localTombstones);
    }
};

export const syncVideos = async (videos) => {
    const timestamp = Date.now();
    const deletedVideos = await getDeletedVideos();

    // Always save locally first (optimistic)
    await saveLocalVideos(videos, timestamp);

    try {
        const ip = await getServerIp();
        if (!ip) throw new Error('No Server IP configured');

        const response = await fetch(`http://${ip}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videos, timestamp, deletedVideos }),
        });

        if (!response.ok) throw new Error('Failed to sync videos');

        const result = await response.json();

        // Handle conflict (server has newer data)
        if (result.status === 'conflict') {
            console.log('Server has newer data, updating local...');
            await saveLocalVideos(result.serverVideos, result.serverTimestamp);
            if (result.serverDeletedVideos) {
                await saveDeletedVideos(result.serverDeletedVideos);
            }
            return { success: true, updatedFromServer: true, videos: result.serverVideos };
        }

        // Sync successful, clear pending flag
        await setPendingSync(false);
        return result;
    } catch (e) {
        console.log('Network sync failed, marking pending', e);
        // Mark as pending sync
        await setPendingSync(true);
        // Return a mock success response so UI doesn't freak out
        return { success: true, offline: true };
    }
};

// Delete a video (creates tombstone)
export const deleteVideo = async (videoId) => {
    const videos = await getLocalVideos();
    const filteredVideos = videos.filter(v => v.id !== videoId);
    const timestamp = Date.now();

    // Create tombstone
    const deletedVideos = await getDeletedVideos();
    deletedVideos[videoId] = timestamp;

    await saveLocalVideos(filteredVideos, timestamp);
    await saveDeletedVideos(deletedVideos);

    // Sync to server
    await syncVideos(filteredVideos);

    return filteredVideos;
};

// Add a video (clears tombstone if re-adding)
export const addVideo = async (video) => {
    let videos = await getLocalVideos();
    const deletedVideos = await getDeletedVideos();

    // Check if already exists
    const existingVideo = videos.find(v => v.id === video.id);
    const tombstoneTs = deletedVideos[video.id];

    if (existingVideo) {
        // If tombstoned, allow re-add by removing old entry first
        if (tombstoneTs) {
            videos = videos.filter(v => v.id !== video.id);
        } else {
            throw new Error('Video already in list');
        }
    }

    // Add with timestamp
    const videoWithTimestamp = { ...video, addedAt: Date.now() };
    videos.unshift(videoWithTimestamp);

    // Remove from tombstones if re-adding
    delete deletedVideos[video.id];

    const timestamp = Date.now();
    await saveLocalVideos(videos, timestamp);
    await saveDeletedVideos(deletedVideos);

    // Sync to server
    await syncVideos(videos);

    return videos;
};

export const checkStatus = async () => {
    try {
        const ip = await getServerIp();
        if (!ip) return null;

        const response = await fetch(`http://${ip}/status`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (e) {
        return null;
    }
};

const timeout = (promise, ms) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('TIMEOUT'));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
};

export const discoverServer = async (onProgress) => {
    try {
        const ip = await Network.getIpAddressAsync();
        if (!ip || ip === '0.0.0.0') return null;

        const subnet = ip.substring(0, ip.lastIndexOf('.'));
        const port = 5000;
        const batchSize = 20; // Smaller batch size for stability

        for (let i = 1; i < 255; i += batchSize) {
            const batch = [];
            for (let j = 0; j < batchSize && i + j < 255; j++) {
                const currentIp = `${subnet}.${i + j}`;
                const url = `http://${currentIp}:${port}/status`;

                batch.push(
                    timeout(fetch(url), 500)
                        .then(res => res.ok ? res.json() : null)
                        .then(data => data && data.status === 'running' ? `${currentIp}:${port}` : null)
                        .catch(() => null)
                );
            }

            if (onProgress) onProgress(i, 255);

            const results = await Promise.all(batch);
            const found = results.find(r => r !== null);
            if (found) return found;
        }
        return null;
    } catch (e) {
        console.error('Discovery failed', e);
        return null;
    }
};

export const getTheme = async () => {
    try {
        const theme = await AsyncStorage.getItem('theme');
        return theme || 'default';
    } catch (e) {
        return 'default';
    }
};

export const saveTheme = async (theme) => {
    try {
        await AsyncStorage.setItem('theme', theme);
    } catch (e) {
        console.error('Failed to save theme', e);
    }
};
