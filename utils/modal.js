import { createList, switchList, fetchRemoteVideos, renameList, deleteList } from './sync.js';
import { showMessage } from './ui.js';

export function showListModal(lists, current, messageDiv, onUpdate, actionCallback, titleText = 'Select List') {
    const existingModal = document.getElementById('list-modal');
    if (existingModal) existingModal.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'list-modal';
    modalOverlay.className = 'modal-overlay';

    modalOverlay.onclick = (e) => {
        e.stopPropagation();
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const title = document.createElement('h3');
    title.textContent = titleText;

    const listContainer = document.createElement('div');
    listContainer.className = 'modal-list';

    lists.forEach(filename => {
        const item = document.createElement('div');
        item.className = 'modal-list-item' + (filename === current ? ' active' : '');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = filename;

        // Click handler on entire item div so the full row is clickable
        item.onclick = async (e) => {
            // Don't trigger switch if clicking rename button
            if (e.target.closest('.modal-icon-btn')) return;

            try {
                if (actionCallback) {
                    await actionCallback(filename);
                } else if (filename !== current) {
                    const switchResult = await switchList(filename);
                    if (switchResult && switchResult.success === false) {
                        if (messageDiv) showMessage('Switch failed: ' + (switchResult.error || 'Unknown error'), 'error', messageDiv);
                        return;
                    }
                    if (messageDiv) showMessage(`Switched to ${filename}`, 'success', messageDiv);
                    const remoteData = await fetchRemoteVideos();
                    if (onUpdate) {
                        // Extract videos array and timestamp from response
                        let videos = [];
                        let timestamp = 0;
                        if (remoteData) {
                            if (Array.isArray(remoteData)) {
                                videos = remoteData;
                            } else {
                                videos = remoteData.videos || [];
                                timestamp = remoteData.timestamp || 0;
                            }
                        }
                        await onUpdate(videos, timestamp);
                    }
                }
                modalOverlay.remove();
            } catch (err) {
                console.error('List switch error:', err);
                if (messageDiv) showMessage('Error switching list: ' + err.message, 'error', messageDiv);
            }
        };

        // Rename Button
        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '✎';
        renameBtn.title = 'Rename List';
        renameBtn.className = 'modal-icon-btn';

        renameBtn.onclick = (e) => {
            e.stopPropagation();
            enterRenameMode(item, filename, nameSpan);
        };

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑';
        deleteBtn.title = 'Delete List';
        deleteBtn.className = 'modal-icon-btn modal-delete-btn';

        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            enterDeleteConfirm(item, filename, nameSpan, renameBtn, deleteBtn);
        };

        item.appendChild(nameSpan);
        item.appendChild(renameBtn);
        item.appendChild(deleteBtn);
        listContainer.appendChild(item);
    });

    function enterRenameMode(itemContainer, oldName, nameSpan) {
        itemContainer.innerHTML = '';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldName.replace('.json', '');
        input.className = 'modal-rename-input';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '✔';
        saveBtn.className = 'modal-icon-btn';
        saveBtn.style.color = 'green';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✘';
        cancelBtn.className = 'modal-icon-btn';
        cancelBtn.style.color = 'red';

        const finish = async () => {
            const newNameRaw = input.value.trim();
            if (!newNameRaw || newNameRaw === oldName.replace('.json', '')) {
                reset();
                return;
            }

            let newName = newNameRaw;
            if (!newName.endsWith('.json')) newName += '.json';

            try {
                const res = await renameList(oldName, newName);
                if (res.success) {
                    modalOverlay.remove();
                    if (messageDiv) showMessage(`Renamed ${oldName} to ${newName}`, 'success', messageDiv);
                    if (oldName === current) {
                        const remoteVideos = await fetchRemoteVideos();
                        if (remoteVideos && onUpdate) onUpdate(remoteVideos);
                    }
                } else {
                    if (messageDiv) showMessage('Rename failed: ' + res.error, 'error', messageDiv);
                    reset();
                }
            } catch (e) {
                if (messageDiv) showMessage('Error: ' + e.message, 'error', messageDiv);
                reset();
            }
        };

        const reset = () => {
            itemContainer.innerHTML = '';
            itemContainer.appendChild(nameSpan);

            const rb = document.createElement('button');
            rb.innerHTML = '✎';
            rb.title = 'Rename List';
            rb.className = 'modal-icon-btn';
            rb.onclick = (e) => { e.stopPropagation(); enterRenameMode(itemContainer, oldName, nameSpan); };
            itemContainer.appendChild(rb);

            const db = document.createElement('button');
            db.innerHTML = '🗑';
            db.title = 'Delete List';
            db.className = 'modal-icon-btn modal-delete-btn';
            db.onclick = (e) => { e.stopPropagation(); enterDeleteConfirm(itemContainer, oldName, nameSpan, rb, db); };
            itemContainer.appendChild(db);
        };

        saveBtn.onclick = (e) => { e.stopPropagation(); finish(); };
        cancelBtn.onclick = (e) => { e.stopPropagation(); reset(); };
        input.onclick = (e) => e.stopPropagation();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') finish();
            if (e.key === 'Escape') reset();
        };

        itemContainer.appendChild(input);
        itemContainer.appendChild(saveBtn);
        itemContainer.appendChild(cancelBtn);
        input.focus();
    }

    function enterDeleteConfirm(itemContainer, filename, nameSpan, renameBtn, deleteBtn) {
        // Don't allow deleting the active list
        if (filename === current) {
            if (messageDiv) showMessage('Cannot delete the active list. Switch to another list first.', 'error', messageDiv);
            return;
        }

        itemContainer.innerHTML = '';

        const prompt = document.createElement('span');
        prompt.textContent = `Delete ${filename.replace('.json', '')}?`;
        prompt.style.color = '#e74c3c';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '✔';
        confirmBtn.className = 'modal-icon-btn';
        confirmBtn.style.color = 'red';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✘';
        cancelBtn.className = 'modal-icon-btn';

        const doDelete = async () => {
            try {
                const res = await deleteList(filename);
                if (res.success) {
                    if (messageDiv) showMessage(`Deleted ${filename}`, 'success', messageDiv);
                    // Remove the item from the modal
                    itemContainer.remove();
                } else {
                    if (messageDiv) showMessage('Delete failed: ' + res.error, 'error', messageDiv);
                    resetDelete();
                }
            } catch (e) {
                if (messageDiv) showMessage('Error: ' + e.message, 'error', messageDiv);
                resetDelete();
            }
        };

        const resetDelete = () => {
            itemContainer.innerHTML = '';
            itemContainer.appendChild(nameSpan);
            itemContainer.appendChild(renameBtn);
            itemContainer.appendChild(deleteBtn);
        };

        confirmBtn.onclick = (e) => { e.stopPropagation(); doDelete(); };
        cancelBtn.onclick = (e) => { e.stopPropagation(); resetDelete(); };

        itemContainer.appendChild(prompt);
        itemContainer.appendChild(confirmBtn);
        itemContainer.appendChild(cancelBtn);
    }

    const newBtn = document.createElement('button');
    newBtn.textContent = '+ Create New List';
    newBtn.className = 'primary-btn';
    newBtn.style.width = '100%';
    newBtn.style.marginTop = '10px';

    newBtn.onclick = () => {
        modalContent.innerHTML = '';

        const inputTitle = document.createElement('h3');
        inputTitle.textContent = 'New List Name';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'e.g., Music...';
        input.className = 'modal-create-input';

        const createConfirmBtn = document.createElement('button');
        createConfirmBtn.textContent = 'Create';
        createConfirmBtn.className = 'primary-btn';
        createConfirmBtn.style.width = '100%';

        const backBtn = document.createElement('button');
        backBtn.textContent = 'Cancel';
        backBtn.className = 'modal-cancel-btn';
        backBtn.onclick = () => {
            modalOverlay.remove();
            showListModal(lists, current, messageDiv, onUpdate);
        };

        createConfirmBtn.onclick = () => {
            const name = input.value.trim();
            if (name) {
                createList(name).then(async (res) => {
                    if (res.success) {
                        await switchList(name.endsWith('.json') ? name : name + '.json');
                        if (messageDiv) showMessage(`Created & switched to ${name}`, 'success', messageDiv);
                        const remoteVideos = await fetchRemoteVideos();
                        if (remoteVideos && onUpdate) {
                            onUpdate(remoteVideos);
                        }
                        modalOverlay.remove();
                    } else {
                        alert('Error: ' + res.error);
                    }
                });
            }
        };

        modalContent.appendChild(inputTitle);
        modalContent.appendChild(input);
        modalContent.appendChild(createConfirmBtn);
        modalContent.appendChild(backBtn);
        input.focus();
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cancel';
    closeBtn.className = 'modal-cancel-btn';
    closeBtn.onclick = () => modalOverlay.remove();

    modalContent.appendChild(title);
    modalContent.appendChild(listContainer);
    modalContent.appendChild(newBtn);
    modalContent.appendChild(closeBtn);
    modalOverlay.appendChild(modalContent);

    document.body.appendChild(modalOverlay);
}
