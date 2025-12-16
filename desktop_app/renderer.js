import { renderList, toggleClearButton } from './utils/ui.js';
import { saveVideos, selectFile, onSyncUpdate, onConfigLoaded, downloadThumbnails, getLists, createList, switchList, moveVideo, getDeletedVideos, onDeletedVideosUpdate, addTombstone } from './utils/ipc.js';
import { enableDragAndDrop } from './utils/drag_drop.js';
import { showListModal } from './utils/modal.js';

const selectFileBtn = document.getElementById('select-file-btn');
const statusDiv = document.getElementById('status');
const videoList = document.getElementById('video-list');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

// Theme Logic
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'neumorphic') {
    document.body.classList.add('neumorphic');
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('neumorphic');
        const isNeumorphic = document.body.classList.contains('neumorphic');
        localStorage.setItem('theme', isNeumorphic ? 'neumorphic' : 'default');
    });
}

let allVideos = [];
let deletedVideos = {}; // Tombstones: { videoId: deletionTimestamp }

// Event Listeners
selectFileBtn.addEventListener('click', async () => {
    const path = await selectFile();
    if (path) {
        statusDiv.textContent = `Saving to: ${path}`;
    }
});

const downloadBtn = document.getElementById('download-thumbs-btn');
if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Downloading...';
        try {
            const result = await downloadThumbnails(allVideos);
            if (result.success) {
                alert(`Downloaded ${result.downloaded} thumbnails.\nErrors: ${result.errors.length}`);
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Refresh Thumbnails';
        render(); // Re-render to show new thumbnails
    });
}

searchInput.addEventListener('input', () => {
    toggleClearButton(searchInput, clearSearchBtn);
    render();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    toggleClearButton(searchInput, clearSearchBtn);
    render();
});

// IPC Listeners
onSyncUpdate((videos) => {
    allVideos = videos;
    render();
});

onConfigLoaded(async (path) => {
    if (path) {
        statusDiv.textContent = `Saving to: ${path}`;
        // Fetch deleted videos when config loads
        deletedVideos = await getDeletedVideos();
        render();
    }
});

// Listen for tombstone updates
onDeletedVideosUpdate((newDeletedVideos) => {
    deletedVideos = newDeletedVideos;
    render();
});

// Enable DnD
enableDragAndDrop(videoList, handleReorder);

// Logic
function render() {
    const rawTerm = searchInput.value;
    const lowerTerm = rawTerm.toLowerCase();

    // Filter out tombstoned videos using timestamp comparison
    // Only remove if tombstone timestamp > video addedAt
    const nonDeletedVideos = allVideos.filter(v => {
        const tombstoneTs = deletedVideos[v.id];
        if (!tombstoneTs) return true; // No tombstone, keep video
        const addedAt = v.addedAt || 0;
        return addedAt > tombstoneTs; // Keep if re-added after deletion
    });

    const filteredVideos = nonDeletedVideos.filter(video =>
        video.title.toLowerCase().includes(lowerTerm) || video.id.includes(rawTerm)
    );
    renderList(filteredVideos, videoList, handleMove, handleRemoveVideo, handleEditVideo, handleMoveToList);
}

async function handleMoveToList(videoId) {
    const result = await getLists();
    if (result.success) {
        showListModal(result.lists, result.current, async (targetList) => {
            if (targetList === result.current) return;
            const moveResult = await moveVideo(videoId, targetList);
            if (moveResult.success) {
                // Server sends sync-update, which updates allVideos via IPC listener
                // So we usually don't need to manually remove it here, BUT
                // we might want instant feedback if server is slow?
                // IPC is fast. Let's rely on onSyncUpdate.
            } else {
                alert('Error moving video: ' + moveResult.error);
            }
        }, 'Move to List...');
    } else {
        alert('Error fetching lists: ' + result.error);
    }
}

async function handleRemoveVideo(videoId) {
    if (confirm('Remove this video?')) {
        allVideos = allVideos.filter(v => v.id !== videoId);
        // Create tombstone BEFORE saving to prevent re-sync from re-adding
        await addTombstone(videoId);
        await saveVideos(allVideos);
        render();
    }
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
    await saveVideos(allVideos);
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
    await saveVideos(allVideos);
}

async function handleEditVideo(id, newTitle) {
    const index = allVideos.findIndex(v => v.id === id);
    if (index !== -1) {
        allVideos[index].title = newTitle;
        await saveVideos(allVideos);
        render();
    }
}

// List Management UI
const listBtn = document.getElementById('change-list-btn');
if (listBtn) {
    listBtn.addEventListener('click', async () => {
        const result = await getLists();
        if (result.success) {
            showListModal(result.lists, result.current);
        } else {
            alert('Error fetching lists: ' + result.error);
        }
    });
}

// Global MutationObserver to rescan 3D elements when list changes
// const observer = new MutationObserver(() => {
//    if (threeManager.enabled) threeManager.scan();
// });
// observer.observe(videoList, { childList: true, subtree: true });
