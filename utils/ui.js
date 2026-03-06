// Module variable to track scroll position
let lastScrollY = 0;
let spacerAdded = false; // Tracks if we added top spacer & scroll

export function renderList(videos, listElement, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback, enterFolderCallback) {
    const emptyState = document.getElementById('empty-state');

    if (videos.length === 0) {
        emptyState.classList.remove('hidden');
        listElement.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');

    // 1. Snapshot Old Positions (FLIP: First) - BEFORE any DOM changes
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

    videos.forEach((video) => {
        let li = currentItems.get(video.id);
        if (!li) {
            if (video.type === 'folder') {
                li = createFolderItem(video, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback, enterFolderCallback);
            } else {
                li = createVideoItem(video, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback);
            }
        } else {
            if (video.type === 'folder') {
                // Update folder: re-render children
                updateFolderItem(li, video, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback);
            } else {
                // Update Title if changed
                const a = li.querySelector('.video-link');
                if (a && a.textContent !== video.title) {
                    a.textContent = video.title;
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

    // Close menus when clicking outside logic is handled at module level in desktop, 
    // but here strict mirroring suggests we might want to check if listeners act differently.
    // The previous code added a listener every render. Let's fix that.
}

// Module level listener to prevent duplicates
document.addEventListener('click', (e) => {
    if (!e.target.matches('.menu-btn')) {
        closeAllMenus();
    }
});

function closeAllMenus() {
    // FLIP Animation: Capture Start Positions
    const videoItems = Array.from(document.querySelectorAll('.video-item'));
    const startPositions = new Map();
    videoItems.forEach(el => startPositions.set(el, el.getBoundingClientRect().top));

    // Close all open dropdown menus
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        menu.classList.remove('show');
    });

    const container = document.querySelector('.container');
    const scrollSpacer = document.getElementById('scroll-spacer');
    const header = document.querySelector('header');
    const shiftSelector = '.header, .button-group, .search-container, #message, h2, #settings-panel, .video-item';

    // Helper: reset all shifted elements and video list container
    function resetShiftedElements(animate) {
        const els = document.querySelectorAll(shiftSelector);
        els.forEach(el => {
            el.classList.remove('shift-up');
            if (animate) {
                el.style.transition = 'transform 0.25s ease';
                el.style.transform = '';
                setTimeout(() => { if (!el.style.transform) el.style.transition = ''; }, 300);
            } else {
                el.style.transition = animate === false ? 'none' : '';
                el.style.transform = '';
                if (animate === null) el.style.transition = '';
            }
        });
        const videoList = document.getElementById('video-list');
        if (videoList) {
            videoList.classList.remove('shift-up');
            if (animate) {
                videoList.style.transition = 'margin-top 0.25s ease, padding-top 0.25s ease';
                setTimeout(() => { videoList.style.transition = ''; }, 300);
            } else {
                videoList.style.transition = animate === false ? 'none' : '';
            }
            videoList.style.marginTop = '';
            videoList.style.paddingTop = '';
        }
    }

    if (container && scrollSpacer && header && document.body.classList.contains('neumorphic')) {
        const spacerHeight = scrollSpacer.offsetHeight;

        // Get current shift amount from header dataset (stored during open)
        let shiftAmount = header.dataset.shiftAmount ? parseFloat(header.dataset.shiftAmount) : 0;
        if (!shiftAmount) {
            const transform = header.style.transform;
            if (transform && transform !== 'none') {
                const match = transform.match(/translateY\s*\(\s*-?(\d+(\.\d+)?)\s*px\s*\)/i);
                if (match) shiftAmount = parseFloat(match[1]);
            }
        }

        if (shiftAmount > 0) {
            delete header.dataset.shiftAmount;
            const minScroll = spacerHeight - shiftAmount;
            const isAtShiftedTop = container.scrollTop <= minScroll + 5;

            if (isAtShiftedTop) {
                // STATIC CLOSE: Remove transforms instantly, adjust scroll
                resetShiftedElements(false);

                const originalBehavior = container.style.scrollBehavior;
                container.style.scrollBehavior = 'auto';
                container.scrollTop += shiftAmount;
                container.style.scrollBehavior = originalBehavior;

                if (container.scrollTop < spacerHeight) {
                    container.scrollTop = spacerHeight;
                }
            } else {
                // ANIMATED CLOSE: Transition elements back
                resetShiftedElements(true);
            }
        } else {
            // No shift detected, clean up anyway
            resetShiftedElements(null);
        }
    } else {
        // Non-neumorphic reset
        resetShiftedElements(null);
    }

    // Remove scroll handler if it exists
    if (container && container._shiftScrollHandler) {
        container.removeEventListener('scroll', container._shiftScrollHandler);
        container._shiftScrollHandler = null;
    }

    // Scroll back past the spacer after animation
    if (container && scrollSpacer && document.body.classList.contains('neumorphic')) {
        setTimeout(() => {
            container.scrollTop = scrollSpacer.offsetHeight;
        }, 300);
    }

    // FLIP Animation: Play
    // Force layout update to get new positions
    videoItems.forEach(el => {
        const startTop = startPositions.get(el);
        const newTop = el.getBoundingClientRect().top;
        const diff = startTop - newTop;

        // Apply Invert if moved
        if (Math.abs(diff) >= 1) {
            el.style.transition = 'none';
            el.style.transform = `translateY(${diff}px)`;

            // Trigger animation in next frame
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.3s ease';
                    el.style.transform = '';
                });
            });
        }
    });
}

// Global resize listener for dynamic menu layout
window.addEventListener('resize', () => {
    const openMenu = document.querySelector('.dropdown-menu.show');
    if (openMenu && openMenu._updateLayout) {
        requestAnimationFrame(() => openMenu._updateLayout());
    }
});

function showRenameDialog(currentTitle, onSave) {
    // Overlay
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

function createFolderItem(folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback, enterFolderCallback) {
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
    pill.textContent = `▶ ${folder.children.length} video${folder.children.length !== 1 ? 's' : ''}`;

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
    titleEl.className = 'video-link folder-title';
    titleEl.textContent = folder.title;
    titleContainer.appendChild(titleEl);

    infoDiv.appendChild(titleContainer);

    header.appendChild(thumbWrap);
    header.appendChild(infoDiv);

    // Click to enter folder (drill-down)
    header.addEventListener('click', (e) => {
        e.stopPropagation();
        if (enterFolderCallback) enterFolderCallback(folder.id);
    });

    li.appendChild(header);
    return li;
}

function updateFolderItem(li, folder, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback) {
    li._folderData = folder;

    const titleEl = li.querySelector('.folder-title');
    if (titleEl && titleEl.textContent !== folder.title) {
        titleEl.textContent = folder.title;
    }

    const pill = li.querySelector('.folder-pill');
    if (pill) {
        pill.textContent = `▶ ${folder.children.length} video${folder.children.length !== 1 ? 's' : ''}`;
    }
}

function createVideoItem(video, removeCallback, moveCallback, editCallback, moveToListCallback, addToFolderCallback) {
    // ... (rest of function setup)
    const li = document.createElement('li');
    li.className = 'video-item';
    li.draggable = true;
    li.dataset.id = video.id;

    // ... (drag handlers, img, infoDiv setup omitted for brevity - preserved in real code)

    li.addEventListener('dragstart', (e) => {
        if (li.classList.contains('editing-mode')) {
            e.preventDefault();
            return;
        }
        li.classList.add('dragging');
    });

    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
    });

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

    const titleContainer = document.createElement('div');
    titleContainer.className = 'title-container';

    const a = document.createElement('a');
    a.href = video.url;
    a.className = 'video-link';
    a.textContent = video.title;
    a.target = '_blank';
    a.title = video.title;
    titleContainer.appendChild(a);
    infoDiv.appendChild(titleContainer);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '&#8942;';
    menuBtn.title = 'Options';

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';
    const menuList = document.createElement('div');
    menuList.className = 'menu-list-container';

    const opts = [
        { label: 'Open in New Tab', icon: '❐', action: () => chrome.tabs.create({ url: video.url }) },
        { label: 'Open in Current Tab', icon: '↗', action: () => chrome.tabs.update({ url: video.url }) },
        { label: 'Edit Title', icon: '✎', action: () => enterEditMode(video, li, titleContainer, a, editCallback) },
        { label: 'Move to Top', icon: '⤒', action: () => moveCallback(video.id, 'top') },
        { label: 'Move Up', icon: '↑', action: () => moveCallback(video.id, 'up') },
        { label: 'Move Down', icon: '↓', action: () => moveCallback(video.id, 'down') },
        { label: 'Move to Bottom', icon: '⤓', action: () => moveCallback(video.id, 'bottom') },
        { label: 'Move to List...', icon: '➔', action: () => moveToListCallback && moveToListCallback(video.id) },
        { label: 'Add to Folder', icon: '📁', action: () => addToFolderCallback && addToFolderCallback(video) },
        { label: 'Remove', icon: '🗑', action: () => removeCallback(video.id), isDelete: true }
    ];

    let currentPage = 0;
    let itemsPerPage = 6; // Dynamic
    let totalPages = Math.ceil(opts.length / itemsPerPage);

    function renderPage(page) {
        // Validation
        if (page < 0) page = 0;
        if (page >= totalPages && totalPages > 0) page = totalPages - 1;
        currentPage = page;

        menuList.innerHTML = '';
        let start = page * itemsPerPage;
        // Fix start index validation
        if (start >= opts.length) start = Math.max(0, opts.length - itemsPerPage);

        const end = start + itemsPerPage;
        const pageItems = opts.slice(start, end);
        pageItems.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'dropdown-item';
            btn.title = opt.label;
            if (opt.isDelete) btn.classList.add('delete-item');
            const iconSpan = document.createElement('span');
            iconSpan.className = 'menu-icon';
            iconSpan.textContent = opt.icon;
            const textSpan = document.createElement('span');
            textSpan.className = 'menu-text';
            textSpan.textContent = opt.label;
            btn.appendChild(iconSpan);
            btn.appendChild(textSpan);
            btn.onclick = (e) => {
                e.stopPropagation();
                closeAllMenus();
                opt.action();
            };
            menuList.appendChild(btn);
        });

        // Hide arrows if everything fits
        if (opts.length <= itemsPerPage) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'block';
            nextBtn.style.display = 'block';
        }
    }

    // Dynamic Layout Calculation
    dropdown._updateLayout = () => {
        const liWidth = li.clientWidth;
        // Constants from CSS
        const btnFullWidth = 44; // 40px width + 4px gap
        const containerPadding = 10; // 5px left + 5px right
        const arrowOverhead = 80; // 30px arrow * 2 + 10px gap * 2

        // 1. Calculate max items if NO arrows were present
        // Formula: 44N - 4 + 10 <= liWidth  =>  44N <= liWidth - 6
        const maxNoArrows = Math.floor((liWidth - 6) / 44);

        if (opts.length <= maxNoArrows) {
            // Everything fits without pagination
            itemsPerPage = opts.length;
        } else {
            // Pagination needed (Arrows visible)
            // Formula: 44N - 4 + 10 + 80 <= liWidth => 44N <= liWidth - 86
            const maxWithArrows = Math.floor((liWidth - 86) / 44);
            itemsPerPage = Math.max(1, maxWithArrows); // Ensure at least 1
        }

        totalPages = Math.ceil(opts.length / itemsPerPage);
        renderPage(currentPage);
    };

    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '←';
    prevBtn.className = 'dropdown-control-btn';
    prevBtn.style.border = 'none';
    prevBtn.style.background = 'none';
    prevBtn.style.cursor = 'pointer';
    prevBtn.style.fontWeight = 'bold';
    prevBtn.onclick = (e) => {
        e.stopPropagation();
        currentPage = (currentPage > 0) ? currentPage - 1 : totalPages - 1;
        renderPage(currentPage);
    };

    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '→';
    nextBtn.className = 'dropdown-control-btn';
    nextBtn.style.border = 'none';
    nextBtn.style.background = 'none';
    nextBtn.style.cursor = 'pointer';
    nextBtn.style.fontWeight = 'bold';
    nextBtn.onclick = (e) => {
        e.stopPropagation();
        currentPage = (currentPage < totalPages - 1) ? currentPage + 1 : 0;
        renderPage(currentPage);
    };

    // Assemble dropdown
    dropdown.appendChild(prevBtn);
    dropdown.appendChild(menuList);
    dropdown.appendChild(nextBtn);
    // Initial render acts as placeholder; real render happens on open
    renderPage(0);

    // Click handler for the menu button
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        const isCurrentlyOpen = dropdown.classList.contains('show');
        closeAllMenus(); // ensure other menus are closed
        if (!isCurrentlyOpen) {
            // Calc layout BEFORE showing to avoid jump
            dropdown._updateLayout();

            dropdown.classList.add('show');
            if (document.body.classList.contains('neumorphic')) {
                const desiredGap = 10;

                // Wait for dropdown to render so we can measure positions
                requestAnimationFrame(() => {
                    const dropdownRect = dropdown.getBoundingClientRect();

                    const prevSibling = li.previousElementSibling;
                    const isTopItem = !prevSibling || !prevSibling.classList.contains('video-item');
                    const staticElements = document.querySelectorAll('header, .button-group, .search-container, #message, h2, #settings-panel');

                    if (isTopItem) {
                        // TOP ITEM: Measure gap to the element immediately above video list
                        // Order from bottom to top: search-container, button-group, header
                        const searchContainer = document.querySelector('.search-container');
                        const closestAbove = searchContainer || document.querySelector('.button-group') || document.querySelector('header');

                        if (closestAbove) {
                            const aboveRect = closestAbove.getBoundingClientRect();
                            // Current gap above = dropdown top - element bottom
                            const currentGapAbove = dropdownRect.top - aboveRect.bottom;
                            // Shift UP increases the gap, so: newGap = currentGap + shift
                            // We want: newGap = desiredGap, so: shift = desiredGap - currentGap
                            const exactShift = desiredGap - currentGapAbove;

                            if (exactShift > 0) {
                                // Calculate how much to expand the video list container
                                // Goal: gap above dropdown (container inner top → dropdown top) = gap below (dropdown bottom → card top)
                                const videoList = document.getElementById('video-list');
                                const videoListRect = videoList ? videoList.getBoundingClientRect() : null;
                                const liRect = li.getBoundingClientRect();
                                // Gap below = distance from dropdown bottom to the video card's top edge
                                const gapBelow = Math.abs(liRect.top - dropdownRect.bottom);
                                // Current gap above = dropdown top to container inner top edge
                                const currentGapAbove = videoListRect ? (dropdownRect.top - videoListRect.top) : 0;
                                // We want the new gap above = gapBelow, so expansion = gapBelow - currentGapAbove
                                const listExpansion = Math.max(exactShift, gapBelow - currentGapAbove);

                                // Pure CSS animation - just apply transforms with transition
                                staticElements.forEach(el => {
                                    el.classList.add('shift-up');
                                    el.style.transition = 'transform 0.25s ease';
                                    el.style.transform = `translateY(-${listExpansion}px)`;
                                    if (el.tagName === 'HEADER') {
                                        el.dataset.shiftAmount = listExpansion;
                                    }
                                });
                                // Expand the video list container upward
                                if (videoList) {
                                    videoList.classList.add('shift-up');
                                    videoList.style.transition = 'margin-top 0.25s ease, padding-top 0.25s ease';
                                    videoList.style.marginTop = `-${listExpansion}px`;
                                    videoList.style.paddingTop = `${16 + listExpansion}px`;
                                }
                            }
                        }
                    } else {
                        // OTHER ITEMS: Measure gap to previous sibling
                        const prevRect = prevSibling.getBoundingClientRect();
                        // Current gap above = dropdown top - previous item bottom
                        const currentGapAbove = dropdownRect.top - prevRect.bottom;
                        // Shift UP increases the gap, so: newGap = currentGap + shift
                        // We want: newGap = desiredGap, so: shift = desiredGap - currentGap
                        const exactShift = desiredGap - currentGapAbove;

                        if (exactShift > 0) {
                            // Pure CSS animation - collect elements and apply transforms
                            const elementsToShift = [...staticElements];
                            let sibling = li.previousElementSibling;
                            while (sibling) {
                                if (sibling.classList.contains('video-item')) {
                                    elementsToShift.push(sibling);
                                }
                                sibling = sibling.previousElementSibling;
                            }

                            // Spacer already exists (permanent in neumorphic mode), no DOM changes needed
                            elementsToShift.forEach(el => {
                                el.classList.add('shift-up');
                                el.style.transition = 'transform 0.25s ease';
                                el.style.transform = `translateY(-${exactShift}px)`;
                                // Store shift amount on element for reliable retrieval during close
                                if (el.tagName === 'HEADER') {
                                    el.dataset.shiftAmount = exactShift;
                                }
                            });

                            // Also expand the video list container upward, same as top-item branch
                            const videoList = document.getElementById('video-list');
                            if (videoList) {
                                videoList.classList.add('shift-up');
                                videoList.style.transition = 'margin-top 0.25s ease, padding-top 0.25s ease';
                                videoList.style.marginTop = `-${exactShift}px`;
                                videoList.style.paddingTop = `${16 + exactShift}px`;
                            }
                        }
                    }
                });
            }
        }
    };

    // Layout the list item
    li.appendChild(img);
    li.appendChild(infoDiv);
    li.appendChild(menuBtn);
    li.appendChild(dropdown);
    return li;
}

function createBtn(text, title, onClick) {
    const btn = document.createElement('button');
    btn.style.padding = '5px 10px';
    btn.style.cursor = 'pointer';
    btn.textContent = text;
    btn.title = title;
    btn.onclick = onClick;
    return btn;
}

export function showMessage(text, type, container) {
    container.textContent = text;
    container.className = type;
    container.classList.remove('hidden');
    setTimeout(() => {
        container.classList.add('hidden');
    }, 3000);
}

export function enableDragAndDrop(container, onReorder) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            // Determine if position would actually change
            const currentAfter = draggable.nextElementSibling;
            const wouldMove = (afterElement !== currentAfter) && (afterElement !== draggable);

            if (wouldMove) {
                // FLIP: Capture old positions
                const items = [...container.querySelectorAll('.video-item:not(.dragging)')];
                const oldPositions = new Map();
                items.forEach(item => {
                    oldPositions.set(item, item.getBoundingClientRect().top);
                });

                // Perform the DOM move
                if (afterElement == null) {
                    container.appendChild(draggable);
                } else {
                    container.insertBefore(draggable, afterElement);
                }

                // FLIP: Animate from old to new
                items.forEach(item => {
                    const oldTop = oldPositions.get(item);
                    const newTop = item.getBoundingClientRect().top;
                    const delta = oldTop - newTop;

                    if (delta !== 0) {
                        item.style.transition = 'none';
                        item.style.transform = `translateY(${delta}px)`;

                        requestAnimationFrame(() => {
                            item.style.transition = 'transform 0.15s ease';
                            item.style.transform = '';
                        });
                    }
                });
            }
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const newOrderIds = [...container.querySelectorAll('.video-item')].map(li => li.dataset.id);
        onReorder(newOrderIds);
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.video-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
