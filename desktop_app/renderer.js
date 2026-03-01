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
    renderList(filteredVideos, videoList, handleMove, handleRemoveVideo, handleEditVideo, handleMoveToList, handleAddToFolder);
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

async function handleAddToFolder(video) {
    const index = allVideos.findIndex(v => v.id === video.id);
    if (index === -1) return;

    const folder = {
        type: 'folder',
        id: 'folder_' + Date.now(),
        title: '📁 ' + video.title,
        thumbnail: video.thumbnail,
        children: [video],
        collapsed: true,
    };

    allVideos.splice(index, 1, folder);
    await saveVideos(allVideos);
    render();
}

async function handleRemoveVideo(videoId) {
    // Check if in a folder first
    let inFolder = false;
    allVideos = allVideos.map(item => {
        if (item.type === 'folder') {
            const childIdx = item.children.findIndex(c => c.id === videoId);
            if (childIdx !== -1) {
                inFolder = true;
                const newChildren = item.children.filter(c => c.id !== videoId);
                if (newChildren.length === 0) return null;
                return { ...item, children: newChildren };
            }
        }
        return item;
    }).filter(item => item !== null);

    if (!inFolder) {
        allVideos = allVideos.filter(v => v.id !== videoId);
        await addTombstone(videoId);
    }
    await saveVideos(allVideos);
    render();
}

async function handleMove(videoId, direction) {
    // Check if in a folder first
    let inFolder = false;
    for (let i = 0; i < allVideos.length; i++) {
        const item = allVideos[i];
        if (item.type === 'folder') {
            const childIdx = item.children.findIndex(c => c.id === videoId);
            if (childIdx !== -1) {
                inFolder = true;
                const newChildren = [...item.children];
                if (direction === 'up' && childIdx > 0) {
                    [newChildren[childIdx], newChildren[childIdx - 1]] = [newChildren[childIdx - 1], newChildren[childIdx]];
                } else if (direction === 'down' && childIdx < newChildren.length - 1) {
                    [newChildren[childIdx], newChildren[childIdx + 1]] = [newChildren[childIdx + 1], newChildren[childIdx]];
                } else if (direction === 'top') {
                    const [child] = newChildren.splice(childIdx, 1);
                    newChildren.unshift(child);
                } else if (direction === 'bottom') {
                    const [child] = newChildren.splice(childIdx, 1);
                    newChildren.push(child);
                }
                allVideos[i] = { ...item, children: newChildren };
                break;
            }
        }
    }

    if (!inFolder) {
        const index = allVideos.findIndex(v => v.id === videoId);
        if (index === -1) return;

        const newVideos = [...allVideos];
        const [video] = newVideos.splice(index, 1);

        if (direction === 'top') newVideos.unshift(video);
        else if (direction === 'bottom') newVideos.push(video);
        else if (direction === 'up') {
            if (index > 0) newVideos.splice(index - 1, 0, video);
            else newVideos.splice(index, 0, video);
        } else if (direction === 'down') {
            if (index < newVideos.length) newVideos.splice(index + 1, 0, video);
            else newVideos.splice(index, 0, video);
        }
        allVideos = newVideos;
    }
    await saveVideos(allVideos);
    render();
}

async function handleEditVideo(id, newTitle) {
    let found = false;
    allVideos = allVideos.map(item => {
        if (item.type === 'folder') {
            const childIdx = item.children.findIndex(c => c.id === id);
            if (childIdx !== -1) {
                found = true;
                const newChildren = [...item.children];
                newChildren[childIdx] = { ...newChildren[childIdx], title: newTitle };
                return { ...item, children: newChildren };
            }
        }
        if (item.id === id) { found = true; return { ...item, title: newTitle }; }
        return item;
    });
    if (found) {
        await saveVideos(allVideos);
        render();
    }
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

// Quit Dialog (themed)
const { ipcRenderer } = window.require('electron');
ipcRenderer.on('show-quit-dialog', () => {
    // Remove any existing quit dialog
    const existing = document.getElementById('quit-dialog-overlay');
    if (existing) existing.remove();

    const isNeu = document.body.classList.contains('neumorphic');

    const overlay = document.createElement('div');
    overlay.id = 'quit-dialog-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: '9999'
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
        padding: '24px', borderRadius: isNeu ? '20px' : '10px', width: '320px',
        textAlign: 'center',
        backgroundColor: isNeu ? '#e0e5ec' : 'white',
        color: isNeu ? '#4a4a4a' : '#333',
        boxShadow: isNeu
            ? '9px 9px 16px #9baec8, -9px -9px 16px #ffffff'
            : '0 4px 20px rgba(0,0,0,0.2)',
        border: isNeu ? 'none' : '1px solid #eee'
    });

    const title = document.createElement('h3');
    title.textContent = 'Close Watch Later';
    title.style.marginTop = '0';

    const desc = document.createElement('p');
    desc.textContent = 'Minimizing to tray keeps the sync server running for the browser extension and mobile app.';
    Object.assign(desc.style, { fontSize: '0.85rem', color: isNeu ? '#6a6a6a' : '#888', margin: '8px 0 20px' });

    const btnStyle = (extra = {}) => Object.assign({
        padding: '10px 0', width: '100%', border: 'none', borderRadius: isNeu ? '50px' : '6px',
        cursor: 'pointer', fontSize: '0.95rem', marginBottom: '8px',
        backgroundColor: isNeu ? '#e0e5ec' : '#f5f5f5',
        color: isNeu ? '#4a4a4a' : '#333',
        boxShadow: isNeu ? '4px 4px 8px #9baec8, -4px -4px 8px #ffffff' : 'none'
    }, extra);

    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = 'Minimize to Tray';
    Object.assign(minimizeBtn.style, btnStyle({
        backgroundColor: isNeu ? '#e0e5ec' : '#cc0000', color: isNeu ? '#4a4a4a' : 'white',
        fontWeight: 'bold'
    }));

    const quitBtn = document.createElement('button');
    quitBtn.textContent = 'Quit Completely';
    Object.assign(quitBtn.style, btnStyle());

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, btnStyle({
        backgroundColor: 'transparent', boxShadow: 'none', color: isNeu ? '#888' : '#999'
    }));

    const respond = (choice) => { overlay.remove(); ipcRenderer.send('quit-dialog-response', choice); };
    minimizeBtn.onclick = () => respond('minimize');
    quitBtn.onclick = () => respond('quit');
    cancelBtn.onclick = () => respond('cancel');
    overlay.onclick = (e) => { if (e.target === overlay) respond('cancel'); };

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(minimizeBtn);
    modal.appendChild(quitBtn);
    modal.appendChild(cancelBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
});
