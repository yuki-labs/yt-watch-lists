// Helper to safely extract videos array from storage data
function extractVideosArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data.videos) return data.videos;
    return [];
}

export function getVideos() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['watchLaterVideos'], (result) => {
            resolve(extractVideosArray(result.watchLaterVideos));
        });
    });
}

export function getLastModified() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['watchLaterTimestamp'], (result) => {
            resolve(result.watchLaterTimestamp || 0);
        });
    });
}

// Initialize timestamp for legacy data (videos exist but no timestamp)
export function initializeTimestamp() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['watchLaterVideos', 'watchLaterTimestamp'], (result) => {
            const videos = extractVideosArray(result.watchLaterVideos);
            const timestamp = result.watchLaterTimestamp;

            // Only initialize if there are videos but no timestamp
            if (videos.length > 0 && !timestamp) {
                const newTimestamp = Date.now();
                chrome.storage.local.set({ watchLaterTimestamp: newTimestamp }, () => {
                    console.log('Initialized missing timestamp:', newTimestamp);
                    resolve(newTimestamp);
                });
            } else {
                resolve(timestamp || 0);
            }
        });
    });
}

export function addVideo(video) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['watchLaterVideos', 'watchLaterDeletedVideos'], (result) => {
            let videos = extractVideosArray(result.watchLaterVideos);
            const deletedVideos = result.watchLaterDeletedVideos || {};

            // Check if video exists and is NOT tombstoned
            const existingVideo = videos.find(v => v.id === video.id);
            const tombstoneTs = deletedVideos[video.id];

            if (existingVideo) {
                // If tombstoned, allow re-add by removing old entry first
                if (tombstoneTs) {
                    videos = videos.filter(v => v.id !== video.id);
                } else {
                    reject(new Error('Video already in list'));
                    return;
                }
            }

            videos.unshift(video);
            const timestamp = Date.now();

            // Remove from tombstones if re-adding
            delete deletedVideos[video.id];

            chrome.storage.local.set({
                watchLaterVideos: videos,
                watchLaterTimestamp: timestamp,
                watchLaterDeletedVideos: deletedVideos
            }, () => {
                resolve(videos);
            });
        });
    });
}

export function removeVideo(videoId) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['watchLaterVideos', 'watchLaterDeletedVideos'], (result) => {
            let videos = extractVideosArray(result.watchLaterVideos);
            const deletedVideos = result.watchLaterDeletedVideos || {};

            videos = videos.filter(v => v.id !== videoId);
            const timestamp = Date.now();

            // Record deletion timestamp (tombstone)
            deletedVideos[videoId] = timestamp;

            chrome.storage.local.set({
                watchLaterVideos: videos,
                watchLaterTimestamp: timestamp,
                watchLaterDeletedVideos: deletedVideos
            }, () => {
                resolve(videos);
            });
        });
    });
}

// Get all deleted video tombstones
export function getDeletedVideos() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['watchLaterDeletedVideos'], (result) => {
            resolve(result.watchLaterDeletedVideos || {});
        });
    });
}

// Save deleted videos (for sync)
export function saveDeletedVideos(deletedVideos) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ watchLaterDeletedVideos: deletedVideos || {} }, () => {
            resolve(deletedVideos);
        });
    });
}

export function saveVideos(videos, timestamp = null) {
    return new Promise((resolve) => {
        // Ensure we're saving a proper array
        const videosArray = Array.isArray(videos) ? videos : [];
        const data = { watchLaterVideos: videosArray };
        // If provided (e.g. from server sync), use it. Else use current time.
        data.watchLaterTimestamp = timestamp || Date.now();

        chrome.storage.local.set(data, () => {
            resolve(videosArray);
        });
    });
}
