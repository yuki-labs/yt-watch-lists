import { getVideos, addVideo, removeVideo, saveVideos, initializeTimestamp, getLastModified, getDeletedVideos, saveDeletedVideos } from './utils/storage.js';
import { renderList, showMessage, enableDragAndDrop } from './utils/ui.js';
import { syncVideos, getLists, createList, switchList, fetchRemoteVideos } from './utils/sync.js';
import { showListModal } from './utils/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize timestamp for legacy data before doing anything else
    await initializeTimestamp();
    const addBtn = document.getElementById('add-btn');
    const syncBtn = document.getElementById('sync-btn');
    const listBtn = document.getElementById('change-list-btn');
    const searchInput = document.getElementById('search-input');
    const videoList = document.getElementById('video-list');
    const messageDiv = document.getElementById('message');

    let allVideos = [];

    // Lazy loading: only render VIDEOS_PER_PAGE at a time
    const VIDEOS_PER_PAGE = 20;
    let displayedCount = VIDEOS_PER_PAGE;

    // For infinite scroll
    let currentFilteredVideos = [];
    let isLoadingMore = false;

    const clearSearchBtn = document.getElementById('clear-search-btn');

    // Enable DnD
    enableDragAndDrop(videoList, handleReorder);

    // Settings Cog Logic
    const settingsCog = document.getElementById('settings-cog');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsCog && settingsPanel) {
        settingsCog.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = settingsPanel.classList.contains('open');
            if (isOpen) {
                settingsPanel.classList.remove('open');
                settingsCog.classList.remove('active');
            } else {
                settingsPanel.classList.add('open');
                settingsCog.classList.add('active');
            }
        });
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && e.target !== settingsCog) {
                settingsPanel.classList.remove('open');
                settingsCog.classList.remove('active');
            }
        });
    }

    // Theme Logic
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'neumorphic') {
        document.body.classList.add('neumorphic');
    }

    // Scroll past spacer in neumorphic mode (spacer is always 100px, hidden by scrolling)
    function scrollPastSpacer() {
        const container = document.querySelector('.container');
        const scrollSpacer = document.getElementById('scroll-spacer');
        if (container && scrollSpacer && document.body.classList.contains('neumorphic')) {
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
                container.scrollTop = scrollSpacer.offsetHeight;
            });
        }
    }

    // Prevent scrolling above the header's current visual position
    function setupScrollLimiter() {
        const container = document.querySelector('.container');
        if (!container) return;

        container.addEventListener('scroll', () => {
            if (!document.body.classList.contains('neumorphic')) return;

            const scrollSpacer = document.getElementById('scroll-spacer');
            const header = document.querySelector('header');
            if (!scrollSpacer || !header) return;

            const spacerHeight = scrollSpacer.offsetHeight;

            // Get the current shift amount from the header's transform
            let shiftAmount = 0;
            const transform = header.style.transform;
            if (transform) {
                const match = transform.match(/translateY\(-?(\d+)px\)/);
                if (match) {
                    shiftAmount = parseInt(match[1], 10);
                }
            }

            // Minimum scroll = spacer height minus any shift that's been applied
            // This keeps the header's visual top at the viewport top
            const minScroll = spacerHeight - shiftAmount;

            if (container.scrollTop < minScroll) {
                container.scrollTop = minScroll;
            }
        });
    }

    setupScrollLimiter();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('neumorphic');
            const isNeu = document.body.classList.contains('neumorphic');
            localStorage.setItem('theme', isNeu ? 'neumorphic' : 'default');
            // Scroll past spacer when switching to neumorphic
            if (isNeu) {
                scrollPastSpacer();
            } else {
                // Reset scroll when leaving neumorphic
                const container = document.querySelector('.container');
                if (container) container.scrollTop = 0;
            }
        });
    }

    // Dark Mode Logic
    const darkToggle = document.getElementById('dark-toggle');
    const savedDark = localStorage.getItem('colorScheme');
    if (savedDark === 'dark') {
        document.body.classList.add('dark');
    }
    if (darkToggle) {
        darkToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const isDark = document.body.classList.contains('dark');
            localStorage.setItem('colorScheme', isDark ? 'dark' : 'light');
        });
    }

    // Initial load: Compare local vs remote timestamps, use the newer one
    try {
        const remoteData = await fetchRemoteVideos();
        const localVideos = await getVideos();
        const localTimestamp = await getLastModified();
        const localTombstones = await getDeletedVideos();

        if (remoteData) {
            console.log('Remote data received:', JSON.stringify(remoteData).substring(0, 200));

            // Handle both old format (array) and new format ({ videos, timestamp, deletedVideos })
            let remoteVideos, remoteTimestamp, remoteTombstones;
            if (Array.isArray(remoteData)) {
                // Old format: just an array, no timestamp
                remoteVideos = remoteData;
                remoteTimestamp = 0;
                remoteTombstones = {};
                console.log('Detected old format (array), videos count:', remoteVideos.length);
            } else {
                // New format: { videos, timestamp, deletedVideos }
                remoteVideos = remoteData.videos || [];
                remoteTimestamp = remoteData.timestamp || 0;
                remoteTombstones = remoteData.deletedVideos || {};
                console.log('Detected new format, videos count:', remoteVideos.length, 'timestamp:', remoteTimestamp);
            }

            // Merge tombstones (keep the newer deletion timestamp for each ID)
            const mergedTombstones = { ...localTombstones };
            for (const [id, ts] of Object.entries(remoteTombstones)) {
                if (!mergedTombstones[id] || ts > mergedTombstones[id]) {
                    mergedTombstones[id] = ts;
                }
            }

            // Filter out videos where tombstone timestamp > video addedAt timestamp
            // This means: only remove video if it was deleted AFTER it was added
            const filterTombstoned = (videos) => {
                return videos.filter(v => {
                    const tombstoneTs = mergedTombstones[v.id];
                    if (!tombstoneTs) return true; // No tombstone, keep video
                    const addedAt = v.addedAt || 0;
                    // Keep video if it was added AFTER the tombstone (re-added)
                    return addedAt > tombstoneTs;
                });
            };

            console.log('Local timestamp:', localTimestamp, 'Remote timestamp:', remoteTimestamp);
            console.log('Local videos count:', localVideos.length, 'Remote videos count:', remoteVideos.length);
            console.log('Tombstones count:', Object.keys(mergedTombstones).length);

            // If local is empty but remote has data, prefer remote (data recovery)
            if (localVideos.length === 0 && remoteVideos.length > 0) {
                console.log('Local is empty, using remote data for recovery');
                allVideos = filterTombstoned(remoteVideos);
                await saveVideos(allVideos, remoteTimestamp);
            } else {
                // Server is the single source of truth while connected.
                // Always use server data to avoid pushing stale local data back.
                console.log('Using server data. Remote:', remoteVideos.length, 'videos, Local:', localVideos.length, 'videos');
                allVideos = filterTombstoned(remoteVideos);
                // Set sync flag to prevent the background auto-sync from pushing this back
                await chrome.storage.local.set({ _syncFromServer: Date.now() });
                await saveVideos(allVideos, remoteTimestamp || Date.now());
                setTimeout(() => chrome.storage.local.remove('_syncFromServer'), 1000);
            }

            // Save merged tombstones
            await saveDeletedVideos(mergedTombstones);
        } else {
            // No server available, use local
            allVideos = localVideos;
        }
    } catch (e) {
        console.log('Using local storage due to error:', e);
        allVideos = await getVideos();
    }

    // Safety: ensure allVideos is always an array
    if (!Array.isArray(allVideos)) {
        console.warn('allVideos was not an array, resetting:', allVideos);
        allVideos = [];
    }

    render();

    // Scroll past spacer after initial render (hides it in neumorphic mode)
    scrollPastSpacer();

    // Real-time updates via Server-Sent Events
    let lastSSEVersion = 0;
    try {
        const eventSource = new EventSource('http://127.0.0.1:5000/events');
        eventSource.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.version && data.version !== lastSSEVersion) {
                    lastSSEVersion = data.version;
                    const remoteData = await fetchRemoteVideos();
                    if (remoteData) {
                        const videos = Array.isArray(remoteData) ? remoteData : (remoteData.videos || []);
                        allVideos = videos;
                        // Save locally with sync flag to prevent background auto-sync
                        await chrome.storage.local.set({ _syncFromServer: Date.now() });
                        await saveVideos(allVideos, Date.now());
                        setTimeout(() => chrome.storage.local.remove('_syncFromServer'), 1000);
                        render();
                    }
                }
            } catch (e) { /* ignore parse errors */ }
        };
        eventSource.onerror = () => {
            // Server disconnected, close and rely on background poller fallback
            eventSource.close();
        };
    } catch (e) { /* EventSource not available or server offline */ }

    // Listen for storage changes (fallback from background sync)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.watchLaterVideos) {
            allVideos = changes.watchLaterVideos.newValue || [];
            render();
        }
    });

    // Search listener
    searchInput.addEventListener('input', (e) => {
        displayedCount = VIDEOS_PER_PAGE; // Reset pagination on search
        toggleClearButton();
        render();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        displayedCount = VIDEOS_PER_PAGE; // Reset pagination on clear
        toggleClearButton();
        render();
    });

    function toggleClearButton() {
        if (searchInput.value) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
    }

    function render() {
        const rawTerm = searchInput.value;
        const lowerTerm = rawTerm.toLowerCase();

        const filteredVideos = allVideos.filter(video =>
            video.title.toLowerCase().includes(lowerTerm) || video.id.includes(rawTerm)
        );

        // Store filtered videos for scroll handler
        currentFilteredVideos = filteredVideos;

        // Only display up to displayedCount videos
        const videosToShow = filteredVideos.slice(0, displayedCount);
        renderList(videosToShow, videoList, handleRemove, handleMove, handleEdit, handleMoveToList);

        // Show count indicator if there are more videos
        updateScrollIndicator(filteredVideos.length, displayedCount);
    }

    // (scroll variables already declared above)

    function updateScrollIndicator(total, shown) {
        let indicator = document.getElementById('scroll-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'scroll-indicator';
            indicator.style.textAlign = 'center';
            indicator.style.padding = '10px';
            indicator.style.color = '#999';
            indicator.style.fontSize = '12px';
            videoList.parentNode.insertBefore(indicator, videoList.nextSibling);
        }

        if (shown >= total) {
            indicator.textContent = `Showing all ${total} videos`;
        } else {
            indicator.textContent = `Showing ${shown} of ${total} videos (scroll for more)`;
        }
    }

    // Infinite scroll handler
    const container = document.querySelector('.container');
    container.addEventListener('scroll', () => {
        if (isLoadingMore) return;

        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

        // Load more when within 200px of bottom
        if (scrollBottom < 200 && displayedCount < currentFilteredVideos.length) {
            isLoadingMore = true;
            displayedCount += VIDEOS_PER_PAGE;
            render();
            isLoadingMore = false;
        }
    });

    async function handleMoveToList(videoId) {
        // Fetch lists again to be fresh
        const result = await getLists();
        if (result.success) {
            const filteredLists = result.lists.filter(f => !f.endsWith('_tombstones.json'));
            showListModal(filteredLists, result.current, messageDiv, null, async (targetList) => {
                if (targetList === result.current) return;

                const moveResult = await import('./utils/sync.js').then(m => m.moveVideo(videoId, targetList));
                if (moveResult.success) {
                    showMessage(`Moved video to ${targetList}`, 'success', messageDiv);
                    // Update local list and persist to storage
                    // Server already updated by POST /lists/move, no need to sync back
                    allVideos = allVideos.filter(v => v.id !== videoId);
                    await chrome.storage.local.set({ _syncFromServer: Date.now() });
                    await saveVideos(allVideos);
                    setTimeout(() => chrome.storage.local.remove('_syncFromServer'), 1000);
                    render();
                } else {
                    showMessage('Error moving video: ' + moveResult.error, 'error', messageDiv);
                }
            }, 'Move to List...');
        } else {
            showMessage('Error fetching lists: ' + result.error, 'error', messageDiv);
        }
    }

    async function handleEdit(videoId, newTitle) {
        const index = allVideos.findIndex(v => v.id === videoId);
        if (index !== -1) {
            allVideos[index].title = newTitle;
            await saveAndSync(allVideos);
            render();
        }
    }

    // Helper to Save Locally AND Sync if possible
    async function saveAndSync(videos) {
        await saveVideos(videos);
        // Try auto-sync?
        try {
            await syncVideos(videos);
        } catch (e) { /* ignore offline */ }
    }

    // Sync listener
    syncBtn.addEventListener('click', async () => {
        const videos = await getVideos();
        if (videos.length === 0) {
            showMessage('Nothing to sync.', 'error', messageDiv);
            return;
        }

        const result = await syncVideos(videos);
        if (result.success) {
            if (result.updatedFromServer) {
                allVideos = result.videos;
                render(); // Re-render with new data
                showMessage('Synced! (Updated from Desktop)', 'success', messageDiv);
            } else {
                showMessage(result.saved ? 'Synced & Saved!' : 'Synced to App!', 'success', messageDiv);
            }
        } else {
            showMessage('Sync failed. Is app running?', 'error', messageDiv);
        }
    });

    // Add Video listener
    addBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            let videoId = null;
            const urlObj = new URL(tab.url);

            if (tab.url.includes('youtube.com/watch')) {
                videoId = urlObj.searchParams.get('v');
            } else if (tab.url.includes('youtube.com/shorts/')) {
                videoId = urlObj.pathname.split('/shorts/')[1];
            }

            if (!videoId) {
                showMessage('Not a valid YouTube video URL.', 'error', messageDiv);
                return;
            }

            const videoData = {
                id: videoId,
                title: tab.title.replace(' - YouTube', ''),
                url: tab.url,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                addedAt: Date.now()
            };

            const newVideos = await addVideo(videoData);
            allVideos = newVideos;
            await saveAndSync(allVideos); // Auto-sync on add
            render();
            showMessage('Video added!', 'success', messageDiv);

        } catch (error) {
            console.error(error);
            showMessage(error.message || 'Error adding video.', 'error', messageDiv);
        }
    });

    async function handleRemove(videoId) {
        const newVideos = await removeVideo(videoId);
        allVideos = newVideos;
        await saveAndSync(allVideos);
        render();
    }

    async function handleMove(videoId, direction) {
        const index = allVideos.findIndex(v => v.id === videoId);
        if (index === -1) return;

        const newVideos = [...allVideos];
        const [video] = newVideos.splice(index, 1);

        if (direction === 'top') {
            newVideos.unshift(video);
        } else if (direction === 'bottom') {
            newVideos.push(video);
        } else if (direction === 'up') {
            if (index > 0) newVideos.splice(index - 1, 0, video);
            else newVideos.splice(index, 0, video);
        } else if (direction === 'down') {
            if (index < newVideos.length) newVideos.splice(index + 1, 0, video);
            else newVideos.splice(index, 0, video);
        }

        allVideos = newVideos;
        await saveAndSync(allVideos);
        render();
    }

    async function handleReorder(newOrderIds) {
        const newVideos = [];
        const idMap = new Map(allVideos.map(v => [v.id, v]));

        newOrderIds.forEach(id => {
            if (idMap.has(id)) {
                newVideos.push(idMap.get(id));
                idMap.delete(id);
            }
        });

        for (const video of idMap.values()) {
            newVideos.push(video);
        }

        allVideos = newVideos;
        await saveAndSync(allVideos);
    }

    // List Management UI
    if (listBtn) {
        listBtn.addEventListener('click', async () => {
            const result = await getLists();
            if (result.success) {
                const filteredLists = result.lists.filter(f => !f.endsWith('_tombstones.json'));
                showListModal(filteredLists, result.current, messageDiv, async (videos, timestamp) => {
                    allVideos = videos;
                    // Set flag to prevent background auto-sync from pushing old data back
                    await chrome.storage.local.set({ _syncFromServer: Date.now() });
                    // Save with the server's timestamp so timestamps match
                    await saveVideos(allVideos, timestamp || Date.now());
                    // Update synced version so background poller doesn't re-fetch
                    try {
                        const statusResp = await fetch('http://127.0.0.1:5000/status');
                        if (statusResp.ok) {
                            const status = await statusResp.json();
                            await chrome.storage.local.set({ lastSyncedVersion: status.version });
                        }
                    } catch (e) { /* ignore */ }
                    // Clear flag after delay
                    setTimeout(() => chrome.storage.local.remove('_syncFromServer'), 1000);
                    render();
                });
            } else {
                showMessage('Error fetching lists: ' + (result.error || 'Server not running?'), 'error', messageDiv);
            }
        });
    }
});
