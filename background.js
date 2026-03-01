import { addVideo, saveVideos, getVideos } from './utils/storage.js';
import { syncVideos, getLists, switchList, fetchRemoteVideos } from './utils/sync.js';
import { parseVideoUrl, fetchVideoTitle } from './utils/background_utils.js';

// Open side panel on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

let isSyncingFromServer = false;
let isConnected = false;

// Initialize Context Menu
async function updateContextMenu() {
    chrome.contextMenus.removeAll();

    // Create Parent Menu
    chrome.contextMenus.create({
        id: "addToWatchLater",
        title: "Add to Watch Later",
        contexts: ["page", "link"],
        documentUrlPatterns: ["*://*.youtube.com/*"]
    });

    chrome.contextMenus.create({
        parentId: "addToWatchLater",
        id: "add_current",
        title: "Current List",
        contexts: ["page", "link"]
    });

    // Fetch Lists from Server
    try {
        const result = await getLists();
        if (result.success && result.lists) {
            chrome.contextMenus.create({
                parentId: "addToWatchLater",
                id: "separator",
                type: "separator",
                contexts: ["page", "link"]
            });

            result.lists.forEach(list => {
                const listName = list.replace('.json', '');
                chrome.contextMenus.create({
                    parentId: "addToWatchLater",
                    id: `list_${list}`,
                    title: listName,
                    contexts: ["page", "link"]
                });
            });
        }
    } catch (e) {
        // If server down, just show default option
    }
}

chrome.runtime.onInstalled.addListener(() => {
    updateContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("Context menu clicked:", info.menuItemId);

    // Determine the video URL
    let url = null;
    if (info.linkUrl && (info.linkUrl.includes('youtube.com/watch') || info.linkUrl.includes('youtube.com/shorts/'))) {
        url = info.linkUrl;
    } else if (info.pageUrl && (info.pageUrl.includes('youtube.com/watch') || info.pageUrl.includes('youtube.com/shorts/'))) {
        url = info.pageUrl;
    }

    console.log("URL detected:", url);

    const videoId = parseVideoUrl(url);
    console.log("Video ID parsed:", videoId);

    if (!videoId) {
        console.error("Failed to parse video ID from URL");
        return;
    }

    // Handle List Switching if needed
    if (info.menuItemId.startsWith('list_')) {
        const targetList = info.menuItemId.replace('list_', '');
        console.log("Switching to list:", targetList);
        const switchResult = await switchList(targetList);
        console.log("Switch result:", switchResult);
        if (!switchResult.success) {
            console.error("Failed to switch list:", switchResult.error);
            return;
        }
        // Small delay to ensure server has fully switched
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get Title
    let title = `Video ${videoId}`;
    if (tab && tab.url === url) {
        title = tab.title.replace(' - YouTube', '');
    } else {
        title = await fetchVideoTitle(videoId);
    }
    console.log("Video title:", title);

    const videoData = {
        id: videoId,
        title: title,
        url: url,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        addedAt: Date.now()
    };
    console.log("Video data:", videoData);

    try {
        // 1. Fetch latest state from server (now from the correct list after switching)
        console.log("Fetching remote videos...");
        const remoteData = await fetchRemoteVideos();
        const remoteVideos = remoteData?.videos || null;
        console.log("Remote videos fetched:", remoteVideos?.length || 0, "videos");

        let currentList = remoteVideos || await getVideos();
        console.log("Current list has", currentList.length, "videos");

        // 2. Add video
        const exists = currentList.find(v => v.id === videoId);
        if (!exists) {
            currentList.unshift(videoData);
            console.log("Video added to list. New length:", currentList.length);

            // 3. Save & Sync
            console.log("Saving videos locally...");
            await saveVideos(currentList);
            console.log("Syncing to server...");
            const syncResult = await syncVideos(currentList);
            console.log("Sync result:", syncResult);
            console.log(`Video successfully added to list: ${info.menuItemId}`);
        } else {
            console.log(`Video ${videoId} already exists in the list`);
        }
    } catch (e) {
        console.error("Error adding video via context menu:", e);
    }
});

// Auto-sync listener (Local -> Server)
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    // Skip if we're currently applying server data (in-memory flag, same context)
    if (isSyncingFromServer) {
        console.log("Skipping auto-sync (update came from server)");
        return;
    }
    // Also check storage flag (set by popup/side panel, different context)
    const flagData = await chrome.storage.local.get('_syncFromServer');
    if (flagData._syncFromServer && (Date.now() - flagData._syncFromServer) < 2000) {
        console.log("Skipping auto-sync (update came from side panel)");
        return;
    }

    if (namespace === 'local' && changes.watchLaterVideos) {
        const newVideos = changes.watchLaterVideos.newValue;
        if (newVideos && Array.isArray(newVideos)) {
            console.log("Local videos changed, auto-syncing to server...", newVideos.length, "videos");
            try {
                const result = await syncVideos(newVideos);
                console.log("Auto-sync result:", result);
            } catch (e) {
                console.error("Auto-sync error:", e);
            }
        }
    }
});

// Polling for desktop app connection
chrome.alarms.create('pollServer', { periodInMinutes: 0.1 }); // Check every ~6s

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'pollServer') {
        await checkServer();
    }
});

async function checkServer() {
    try {
        const response = await fetch('http://127.0.0.1:5000/status');
        if (response.ok) {
            const status = await response.json();

            let forceSync = false;
            if (!isConnected) {
                console.log("Desktop app connected. Will force sync.");
                isConnected = true;
                forceSync = true; // Force sync on first connect
                updateContextMenu(); // Refresh lists on connect
            }

            // Get last synced version from storage
            const localData = await chrome.storage.local.get(['lastSyncedVersion']);
            const lastSyncedVersion = localData.lastSyncedVersion || 0;

            // Check for updates from server (or force sync on first connect)
            if (forceSync || (status.version && status.version > lastSyncedVersion)) {
                console.log("Syncing from desktop app. Force:", forceSync, "Version:", status.version, ">", lastSyncedVersion);
                const videoResponse = await fetch('http://127.0.0.1:5000/videos');
                if (videoResponse.ok) {
                    const data = await videoResponse.json();

                    // Handle new format: { videos, timestamp, deletedVideos }
                    const serverVideos = Array.isArray(data) ? data : (data.videos || []);
                    const serverTimestamp = Array.isArray(data) ? 0 : (data.timestamp || 0);
                    const serverDeletedVideos = Array.isArray(data) ? {} : (data.deletedVideos || {});

                    // Get local timestamp to compare
                    const localData = await chrome.storage.local.get(['watchLaterTimestamp', 'watchLaterVideos']);
                    const localTimestamp = localData.watchLaterTimestamp || 0;
                    const localVideosRaw = localData.watchLaterVideos;
                    const localVideoCount = Array.isArray(localVideosRaw) ? localVideosRaw.length :
                        (localVideosRaw && localVideosRaw.videos ? localVideosRaw.videos.length : 0);

                    console.log("Comparing - Server:", serverVideos.length, "videos, timestamp", serverTimestamp,
                        "| Local:", localVideoCount, "videos, timestamp", localTimestamp);

                    // Merge tombstones first
                    const localDeletedData = await chrome.storage.local.get(['watchLaterDeletedVideos']);
                    const localDeletedVideos = localDeletedData.watchLaterDeletedVideos || {};
                    const mergedTombstones = { ...localDeletedVideos };
                    for (const [id, ts] of Object.entries(serverDeletedVideos)) {
                        if (!mergedTombstones[id] || ts > mergedTombstones[id]) {
                            mergedTombstones[id] = ts;
                        }
                    }

                    // Get local videos as array
                    const localVideos = Array.isArray(localVideosRaw) ? localVideosRaw :
                        (localVideosRaw && localVideosRaw.videos ? localVideosRaw.videos : []);

                    // When we detect a server version change, the desktop made a change.
                    // Always accept server data in this case (desktop is authoritative for its own changes).
                    // Only do timestamp comparison on forceSync (first connect) where we might have newer offline data.
                    const shouldUseServer = forceSync ? (serverTimestamp > localTimestamp) : true;

                    if (shouldUseServer) {
                        // Server data is authoritative
                        console.log("Using server data. Force:", forceSync, "Server:", serverTimestamp, "Local:", localTimestamp);

                        let finalVideos = [...serverVideos];
                        let hasLocalOnlyVideos = false;

                        // Only merge local-only videos on first connect (forceSync).
                        // During regular polls, the server is authoritative — if a video
                        // was removed server-side (e.g. moved to another list), we must
                        // NOT re-add it from stale local data.
                        if (forceSync) {
                            const serverVideoIds = new Set(serverVideos.map(v => v.id));
                            for (const v of localVideos) {
                                if (!serverVideoIds.has(v.id)) {
                                    const tombstoneTs = mergedTombstones[v.id];
                                    const addedAt = v.addedAt || 0;
                                    if (!tombstoneTs || addedAt > tombstoneTs) {
                                        console.log("Preserving local-only video:", v.id);
                                        finalVideos.unshift(v);
                                        hasLocalOnlyVideos = true;
                                    }
                                }
                            }
                        }

                        // Save with NEW timestamp if we added local videos, otherwise use server's
                        const newTimestamp = hasLocalOnlyVideos ? Date.now() : serverTimestamp;
                        // Set in-memory flag to prevent auto-sync listener from pushing this back
                        isSyncingFromServer = true;
                        await saveVideos(finalVideos, newTimestamp);
                        await chrome.storage.local.set({ watchLaterDeletedVideos: mergedTombstones });
                        isSyncingFromServer = false;

                        // Push merged list back to server if we added local videos
                        if (hasLocalOnlyVideos) {
                            console.log("Pushing merged list to server for consistent ordering");
                            try {
                                await syncVideos(finalVideos);
                            } catch (e) {
                                console.warn("Push merged list failed:", e);
                            }
                        }
                    } else {
                        console.log("Local is newer on first connect, keeping local:", localTimestamp, ">=", serverTimestamp);
                        // Still save merged tombstones
                        await chrome.storage.local.set({ watchLaterDeletedVideos: mergedTombstones });

                        // Push local data to desktop since we have newer data
                        if (localVideos.length > 0) {
                            console.log("Force sync: Pushing newer local data to desktop");
                            try {
                                await syncVideos(localVideos);
                            } catch (e) {
                                console.warn("Force push to desktop failed:", e);
                            }
                        }
                    }

                    // Update last synced version regardless (so we don't re-check this version)
                    await chrome.storage.local.set({ lastSyncedVersion: status.version });
                }
            }
        } else {
            isConnected = false;
        }
    } catch (e) {
        isConnected = false;
    }
}
