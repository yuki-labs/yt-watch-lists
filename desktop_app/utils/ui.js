import { renderPage, createBtn } from './renderHelpers.js';

// Module variable to track scroll position
let lastScrollY = 0;

// Close menus when clicking outside (Moved to module scope to prevent duplicate listeners)
document.addEventListener('click', (e) => {
    // Check if clicking inside a menu or on a menu button
    if (!e.target.closest('.dropdown-menu') && !e.target.closest('.menu-btn') && !e.target.closest('.dropdown-control-btn') && !e.target.matches('.menu-btn')) {
        closeAllMenus();
    }
});
// Global resize listener for dynamic menu layout
window.addEventListener('resize', () => {
    const openMenu = document.querySelector('.dropdown-menu.show');
    if (openMenu && typeof openMenu._updateLayout === 'function') {
        openMenu._updateLayout();
    }
});

export function renderList(videos, listElement, moveCallback, removeCallback, editCallback, moveToListCallback, addToFolderCallback) {
    if (videos.length === 0) {
        listElement.innerHTML = '<li style="padding: 20px; text-align: center; color: #999;">No videos found.</li>';
        return;
    }

    // 1. Snapshot Old Positions (FLIP: First)
    const positions = new Map();
    listElement.querySelectorAll('.video-item').forEach(li => {
        if (li.dataset.id) positions.set(li.dataset.id, li.getBoundingClientRect().top);
    });

    // 2. Reconcile DOM (Reuse/Create/Reorder)
    const currentItems = new Map();
    Array.from(listElement.children).forEach(li => {
        if (li.dataset.id) currentItems.set(li.dataset.id, li);
    });

    // Remove deleted items
    const newIds = new Set(videos.map(v => v.id));
    currentItems.forEach((li, id) => {
        if (!newIds.has(id)) li.remove();
    });

    // Handle Empty State Removal if it exists
    if (listElement.firstChild && !listElement.firstChild.classList?.contains('video-item')) {
        listElement.innerHTML = '';
    }

    videos.forEach((video) => {
        let li = currentItems.get(video.id);
        if (!li) {
            if (video.type === 'folder') {
                li = createFolderItem(video, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback);
            } else {
                li = createVideoItem(video, moveCallback, removeCallback, editCallback, moveToListCallback, addToFolderCallback);
            }
        } else {
            if (video.type === 'folder') {
                updateFolderItem(li, video, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback);
            } else {
                // Update Title if changed
                const titleEl = li.querySelector('.video-title');
                if (titleEl && titleEl.textContent !== video.title) {
                    titleEl.textContent = video.title;
                }
                // Update Thumbnail if changed
                const img = li.querySelector('.video-thumbnail');
                if (img && video.thumbnail && img.src !== video.thumbnail && img.src !== `http://localhost:5000/thumbnails/${video.id}.jpg`) {
                    img.src = video.thumbnail;
                }
            }
        }
        // Appending moves existing elements to the new sorted order (FLIP: Last)
        listElement.appendChild(li);
    });

    // 3. Animate (FLIP: Invert & Play)
    videos.forEach(video => {
        const li = listElement.querySelector(`.video-item[data-id="${video.id}"]`);
        if (!li) return;

        const oldTop = positions.get(video.id);
        if (oldTop !== undefined) {
            const newTop = li.getBoundingClientRect().top;
            const delta = oldTop - newTop;

            if (delta !== 0) {
                // Invert
                li.style.transition = 'none';
                li.style.transform = `translateY(${delta}px)`;

                // Play
                requestAnimationFrame(() => {
                    void li.offsetHeight;
                    li.style.transition = '';
                    li.style.transform = '';
                });
            }
        }
    });
}

function closeAllMenus() {
    // FLIP Animation: Capture Start Positions
    const videoItems = Array.from(document.querySelectorAll('.video-item'));
    const startPositions = new Map();
    videoItems.forEach(el => startPositions.set(el, el.getBoundingClientRect().top));

    // Capture currently open menus to remove 'show'
    const openMenus = document.querySelectorAll('.dropdown-menu.show');
    openMenus.forEach(menu => {
        menu.classList.remove('show');
    });

    const header = document.querySelector('.header'); // Desktop typically uses class .header or tag header
    const container = document.documentElement; // Desktop scroll is usually on body/html

    // Universal "Smart Close" Logic

    let shiftAmount = 0;
    if (header && header.dataset.shiftAmount) {
        shiftAmount = parseFloat(header.dataset.shiftAmount);
    } else if (header) {
        // Fallback regex
        let transform = header.style.transform;
        if (transform && transform !== 'none') {
            const match = transform.match(/translateY\s*\(\s*-?(\d+(\.\d+)?)\s*px\s*\)/i);
            if (match) shiftAmount = parseFloat(match[1]);
        }
    }

    if (shiftAmount > 0 && header) { // Always use Animated Close for smooth "slide" effect
        // Ensure transition is active before removing shift
        const elementsToReset = document.querySelectorAll('.header.shift-up, .button-group.shift-up, .search-container.shift-up, #status.shift-up, h2.shift-up, .video-item.shift-up, .video-item');

        elementsToReset.forEach(el => {
            el.style.transition = 'transform 0.25s ease';
            el.classList.remove('shift-up');
            el.style.transform = '';
        });

        // Cleanup inline transition after animation
        setTimeout(() => {
            elementsToReset.forEach(el => el.style.transition = '');
        }, 300);

        delete header.dataset.shiftAmount;

    } else {
        // Fallback cleanup if no shift detected
        const elementsToReset = document.querySelectorAll('.header.shift-up, .button-group.shift-up, .search-container.shift-up, #status.shift-up, h2.shift-up, .video-item.shift-up');
        elementsToReset.forEach(el => {
            el.classList.remove('shift-up');
            el.style.transform = '';
        });
    }

    // FLIP Animation: Play
    const endPositions = new Map();
    videoItems.forEach(el => endPositions.set(el, el.getBoundingClientRect().top));

    videoItems.forEach(el => {
        const start = startPositions.get(el);
        const end = endPositions.get(el);
        if (start !== undefined && end !== undefined && start !== end) {
            const delta = start - end;
            // Apply FLIP only if we want animation (Universal now)
            el.style.transition = 'none';
            el.style.transform = `translateY(${delta}px)`;
            requestAnimationFrame(() => {
                void el.offsetHeight;
                el.style.transition = 'transform 0.25s ease';
                el.style.transform = '';
            });
        }
    });
}

function showRenameDialog(currentTitle, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'rename-dialog-overlay';

    const card = document.createElement('div');
    card.className = 'rename-dialog-card';

    const heading = document.createElement('div');
    heading.className = 'rename-dialog-heading';
    heading.textContent = 'Rename Folder';

    const textarea = document.createElement('textarea');
    textarea.className = 'rename-dialog-input';
    textarea.value = currentTitle;
    textarea.rows = 3;

    const btnRow = document.createElement('div');
    btnRow.className = 'rename-dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'rename-dialog-btn cancel';
    cancelBtn.textContent = 'Cancel';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'rename-dialog-btn save';
    saveBtn.textContent = 'Save';

    const close = () => overlay.remove();
    const save = () => {
        const val = textarea.value.trim();
        close();
        if (val) onSave(val);
    };

    cancelBtn.onclick = close;
    saveBtn.onclick = save;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
        if (e.key === 'Escape') close();
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(heading);
    card.appendChild(textarea);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    textarea.focus();
    textarea.select();
}

function createFolderItem(folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback) {
    const li = document.createElement('li');
    li.className = 'video-item folder-item';
    li.dataset.id = folder.id;
    li._folderData = folder;

    const header = document.createElement('div');
    header.className = 'folder-header';

    // Thumbnail + pill wrapper
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'folder-thumb-wrap';

    const img = document.createElement('img');
    img.src = folder.thumbnail || '';
    img.className = 'video-thumbnail';

    const pill = document.createElement('div');
    pill.className = 'folder-pill';
    const collapsed = folder.collapsed !== false;
    pill.textContent = `${collapsed ? '▶' : '▼'} ${folder.children.length} video${folder.children.length !== 1 ? 's' : ''}`;

    const renameBtn = document.createElement('button');
    renameBtn.className = 'folder-rename-btn';
    renameBtn.textContent = '✎';
    renameBtn.title = 'Rename folder';
    renameBtn.onclick = (e) => {
        e.stopPropagation();
        showRenameDialog(folder.title, (newTitle) => {
            if (newTitle && newTitle !== folder.title) {
                editCallback(folder.id, newTitle);
            }
        });
    };

    const pillRow = document.createElement('div');
    pillRow.className = 'folder-pill-row';
    pillRow.appendChild(pill);
    pillRow.appendChild(renameBtn);

    thumbWrap.appendChild(img);
    thumbWrap.appendChild(pillRow);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'video-info';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'title-container';
    const titleEl = document.createElement('span');
    titleEl.className = 'video-title folder-title';
    titleEl.textContent = folder.title;
    titleContainer.appendChild(titleEl);

    infoDiv.appendChild(titleContainer);

    header.appendChild(thumbWrap);
    header.appendChild(infoDiv);

    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'folder-children';
    if (collapsed) {
        childrenDiv.style.display = 'none';
    }

    renderFolderChildren(childrenDiv, folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback);

    header.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = childrenDiv.style.display === 'none';
        childrenDiv.style.display = isCollapsed ? 'block' : 'none';
        li._folderData.collapsed = !isCollapsed;
        pill.textContent = `${isCollapsed ? '▼' : '▶'} ${li._folderData.children.length} video${li._folderData.children.length !== 1 ? 's' : ''}`;
    });

    li.appendChild(header);
    li.appendChild(childrenDiv);
    return li;
}

function updateFolderItem(li, folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback) {
    li._folderData = folder;
    const titleEl = li.querySelector('.folder-title');
    if (titleEl && titleEl.textContent !== folder.title) titleEl.textContent = folder.title;
    const pill = li.querySelector('.folder-pill');
    if (pill) {
        const collapsed = folder.collapsed !== false;
        pill.textContent = `${collapsed ? '▶' : '▼'} ${folder.children.length} video${folder.children.length !== 1 ? 's' : ''}`;
    }
    const childrenDiv = li.querySelector('.folder-children');
    if (childrenDiv) renderFolderChildren(childrenDiv, folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback);
}

function renderFolderChildren(container, folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback) {
    container.innerHTML = '';
    folder.children.forEach(child => {
        const childLi = createVideoItem(child, moveCallback, removeCallback, editCallback, moveToListCallback, addToFolderCallback);
        childLi.classList.add('folder-child-video');
        container.appendChild(childLi);
    });
}

function createVideoItem(video, moveCallback, removeCallback, editCallback, moveToListCallback, addToFolderCallback) {
    const li = document.createElement('li');
    li.className = 'video-item';
    li.draggable = true;
    li.dataset.id = video.id;

    li.addEventListener('dragstart', (e) => {
        if (li.classList.contains('editing-mode')) {
            e.preventDefault();
            return;
        }
        li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));

    const img = document.createElement('img');
    const localThumbUrl = `http://localhost:5000/thumbnails/${video.id}.jpg`;
    const remoteThumbUrl = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;

    img.src = localThumbUrl;
    img.onerror = () => {
        if (img.src !== remoteThumbUrl) {
            img.src = remoteThumbUrl;
        }
    };
    img.className = 'video-thumbnail';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'video-info';

    // Title Container
    const titleContainer = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'video-title';
    title.textContent = video.title;
    titleContainer.appendChild(title);

    const url = document.createElement('div');
    url.className = 'video-url';
    url.textContent = video.url;

    infoDiv.appendChild(titleContainer);
    infoDiv.appendChild(url);

    // Menu Button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '&#8942;'; // Vertical ellipsis
    menuBtn.title = 'Options';
    menuBtn.onclick = (e) => {
        e.stopPropagation();

        const isCurrentlyOpen = dropdown.classList.contains('show');

        // Close all other menus first
        closeAllMenus();

        if (!isCurrentlyOpen) {

            // Calculate and Apply Layout BEFORE showing
            if (typeof dropdown._updateLayout === 'function') {
                dropdown._updateLayout();
            }

            dropdown.classList.add('show');

            // Universal Animation: Move ALL previous items out of the way (upwards)
            // Calculate shift amount standard ~60px
            const shiftAmount = 60;
            const header = document.querySelector('.header');
            if (header) header.dataset.shiftAmount = shiftAmount;

            let sibling = li.previousElementSibling;
            let hasPreviousVideo = false;

            // Shift previous video items
            while (sibling) {
                if (sibling.classList.contains('video-item')) {
                    sibling.classList.add('shift-up');
                    hasPreviousVideo = true;
                }
                sibling = sibling.previousElementSibling;
            }

            // Global Shift
            const staticElements = document.querySelectorAll('.header, #status, .search-container, h2');
            if (hasPreviousVideo) {
                staticElements.forEach(el => el.classList.add('shift-up'));
            }
        }
    };

    // Dropdown Menu
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';

    // Desktop Options
    const opts = [
        { label: 'Edit Title', icon: '✎', action: () => enterEditMode(video, li, titleContainer, title, editCallback), type: 'edit' },
        { label: 'Move to Top', icon: '⤒', action: () => moveCallback(video.id, 'top'), type: 'move-up' },
        { label: 'Move Up', icon: '↑', action: () => moveCallback(video.id, 'up'), type: 'move-up' },
        { label: 'Move Down', icon: '↓', action: () => moveCallback(video.id, 'down'), type: 'move-down' },
        { label: 'Move to Bottom', icon: '⤓', action: () => moveCallback(video.id, 'bottom'), type: 'move-down' },
        { label: 'Move to List...', icon: '➔', action: () => moveToListCallback && moveToListCallback(video.id), type: 'move' },
        { label: 'Add to Folder', icon: '📁', action: () => addToFolderCallback && addToFolderCallback(video), type: 'folder' },
        { label: 'Remove', icon: '🗑', action: () => removeCallback(video.id), isDelete: true, type: 'delete' }
    ];

    // Dynamic Pagination State (Closure)
    let currentPage = 0;

    // Layout Logic attached to element
    dropdown._updateLayout = () => {
        // Measure available width (approx padding 20px * 2)
        const containerWidth = li.clientWidth - 40;

        let itemsPerPage = opts.length; // Default all

        // Default to Pagination Logic for layout consistency (Neumorphic & Default Horizontal Bar)
        const btnWidth = 50; // 40px + gap
        const arrowWidth = 30;
        const padding = 16;

        const availableForButtons = containerWidth - (2 * arrowWidth) - padding - 20;
        const possibleButtons = Math.floor(availableForButtons / btnWidth);

        if (possibleButtons < opts.length) {
            itemsPerPage = Math.max(1, possibleButtons);
        }

        const totalPages = Math.ceil(opts.length / itemsPerPage);
        if (currentPage >= totalPages) currentPage = totalPages - 1;
        if (currentPage < 0) currentPage = 0;

        renderPage(dropdown, opts, currentPage, itemsPerPage, totalPages, (newPage) => {
            currentPage = newPage;
            dropdown._updateLayout(); // Re-render
        }, closeAllMenus);
    };

    li.appendChild(img);
    li.appendChild(infoDiv);
    li.appendChild(menuBtn);
    li.appendChild(dropdown);

    return li;
}

// Helper to remove old render logic dependency
function createControls() { return null; }

function enterEditMode(video, li, titleContainer, titleElement, editCallback) {
    li.draggable = false;
    li.classList.add('editing-mode');

    const input = document.createElement('textarea');
    input.value = video.title;
    input.style.width = '100%';
    input.style.padding = '4px';
    input.style.fontSize = '1rem';
    input.rows = 1;
    input.style.resize = 'none';
    input.style.overflow = 'hidden';
    input.style.minHeight = '0';
    input.style.fontFamily = 'inherit';
    input.style.boxSizing = 'border-box';

    const autoResize = () => {
        input.style.height = 'auto';
        input.style.height = (input.scrollHeight + 2) + 'px';
    };

    input.addEventListener('input', autoResize);

    const cleanup = () => {
        titleContainer.innerHTML = '';
        titleContainer.appendChild(titleElement);
        li.draggable = true;
        li.classList.remove('editing-mode');
    };

    const save = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== video.title) {
            editCallback(video.id, newTitle);
        }
        cleanup(); // Always cleanup to dismiss the text box
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
        }
        if (e.key === 'Escape') cleanup();
    });

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '5px';
    btnContainer.style.marginTop = '4px';

    const saveBtn = createBtn('✔', 'Save', (e) => { e.stopPropagation(); save(); });
    saveBtn.style.color = 'green';

    const cancelBtn = createBtn('✘', 'Cancel', (e) => { e.stopPropagation(); cleanup(); });
    cancelBtn.style.color = 'red';

    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(cancelBtn);

    titleContainer.innerHTML = '';
    titleContainer.appendChild(input);
    titleContainer.appendChild(btnContainer);

    requestAnimationFrame(() => {
        autoResize();
        input.focus();
    });
}

export function toggleClearButton(input, button) {
    if (input.value) {
        button.classList.remove('hidden');
    } else {
        button.classList.add('hidden');
    }
}
