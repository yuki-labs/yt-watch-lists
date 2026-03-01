import { createList, switchList, renameList, deleteList } from './ipc.js';

export function showListModal(lists, current, onSelect, titleText = 'Select List') {
    const existingModal = document.getElementById('list-modal');
    if (existingModal) existingModal.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'list-modal';
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '2000';

    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '10px';
    modalContent.style.width = '300px';
    modalContent.style.width = '300px';
    modalContent.style.border = '1px solid #eee'; // Add simple border instead of shadow for visibility

    // Neumorphic styling adaptation
    if (document.body.classList.contains('neumorphic')) {
        modalContent.style.backgroundColor = '#e0e5ec';
        // Removed neumorphic shadows as requested
        modalContent.style.border = '1px solid #d1d9e6';
        modalContent.style.color = '#4a4a4a';
    }

    const title = document.createElement('h3');
    title.textContent = titleText;
    title.style.marginTop = '0';

    const listContainer = document.createElement('div');
    listContainer.style.maxHeight = '200px';
    listContainer.style.overflowY = 'auto';
    listContainer.style.margin = '10px 0';

    lists.forEach(filename => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.borderBottom = '1px solid #eee';
        item.style.borderRadius = '4px';
        item.style.marginBottom = '2px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = filename;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.flexGrow = '1';

        if (filename === current) {
            item.style.fontWeight = 'bold';
            item.style.backgroundColor = 'rgba(0,0,0,0.05)';
        }

        item.onmouseenter = () => { if (filename !== current) item.style.backgroundColor = 'rgba(0,0,0,0.03)'; };
        item.onmouseleave = () => { if (filename !== current) item.style.backgroundColor = 'transparent'; };

        nameSpan.onclick = async () => {
            if (onSelect) {
                await onSelect(filename);
            } else if (filename !== current) {
                await switchList(filename);
            }
            modalOverlay.remove();
        };

        // Rename Button
        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '✎';
        renameBtn.title = 'Rename List';
        renameBtn.style.background = 'none';
        renameBtn.style.border = 'none';
        renameBtn.style.cursor = 'pointer';
        renameBtn.style.color = '#999';
        renameBtn.style.marginLeft = '10px';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            enterRenameMode(item, filename, nameSpan);
        };

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑';
        deleteBtn.title = 'Delete List';
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.color = '#e74c3c';
        deleteBtn.style.marginLeft = '5px';
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
        // Clear children
        itemContainer.innerHTML = '';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldName.replace('.json', '');
        input.style.flexGrow = '1';
        input.style.padding = '4px';
        input.style.marginRight = '5px';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '✔';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.color = 'green';
        saveBtn.style.border = 'none';
        saveBtn.style.background = 'none';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✘';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.color = 'red';
        cancelBtn.style.border = 'none';
        cancelBtn.style.background = 'none';

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
                    // If we renamed the CURRENT list, we need to update 'current'
                } else {
                    alert('Rename failed: ' + res.error);
                    reset();
                }
            } catch (e) {
                alert('Error: ' + e.message);
                reset();
            }
        };

        const reset = () => {
            itemContainer.innerHTML = '';
            itemContainer.appendChild(nameSpan);

            const rb = document.createElement('button');
            rb.innerHTML = '✎';
            rb.style.background = 'none';
            rb.style.border = 'none';
            rb.style.cursor = 'pointer';
            rb.style.color = '#999';
            rb.style.marginLeft = '10px';
            rb.onclick = (e) => { e.stopPropagation(); enterRenameMode(itemContainer, oldName, nameSpan); };
            itemContainer.appendChild(rb);

            const db = document.createElement('button');
            db.innerHTML = '🗑';
            db.style.background = 'none';
            db.style.border = 'none';
            db.style.cursor = 'pointer';
            db.style.color = '#e74c3c';
            db.style.marginLeft = '5px';
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
        if (filename === current) {
            alert('Cannot delete the active list. Switch to another list first.');
            return;
        }

        itemContainer.innerHTML = '';

        const prompt = document.createElement('span');
        prompt.textContent = `Delete ${filename.replace('.json', '')}?`;
        prompt.style.color = '#e74c3c';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '✔';
        confirmBtn.style.background = 'none';
        confirmBtn.style.border = 'none';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.color = 'red';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✘';
        cancelBtn.style.background = 'none';
        cancelBtn.style.border = 'none';
        cancelBtn.style.cursor = 'pointer';

        const doDelete = async () => {
            try {
                const res = await deleteList(filename);
                if (res.success) {
                    itemContainer.remove();
                } else {
                    alert('Delete failed: ' + res.error);
                    resetDelete();
                }
            } catch (e) {
                alert('Error: ' + e.message);
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
        // Replace modal content with input form since prompt() is not supported
        modalContent.innerHTML = '';

        const inputTitle = document.createElement('h3');
        inputTitle.textContent = 'New List Name';
        inputTitle.style.marginTop = '0';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'e.g., Music, Work...';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.marginBottom = '10px';
        input.style.boxSizing = 'border-box';
        input.style.borderRadius = '4px';
        input.style.border = '1px solid #ccc';

        // Neumorphic Input Style
        if (document.body.classList.contains('neumorphic')) {
            input.style.backgroundColor = '#e0e5ec';
            input.style.border = 'none';
            input.style.boxShadow = 'inset 6px 6px 10px #9baec8, inset -6px -6px 10px #ffffff';
            input.style.color = '#4a4a4a';
        }

        const createConfirmBtn = document.createElement('button');
        createConfirmBtn.textContent = 'Create';
        createConfirmBtn.className = 'primary-btn';
        createConfirmBtn.style.width = '100%';

        const backBtn = document.createElement('button');
        backBtn.textContent = 'Cancel';
        backBtn.style.marginTop = '10px';
        backBtn.style.background = 'none';
        backBtn.style.border = 'none';
        backBtn.style.cursor = 'pointer';
        backBtn.style.width = '100%';
        backBtn.onclick = () => {
            modalOverlay.remove();
            showListModal(lists, current); // Re-open list
        };

        createConfirmBtn.onclick = () => {
            const name = input.value.trim();
            if (name) {
                createList(name).then(async (res) => {
                    if (res.success) {
                        await switchList(name.endsWith('.json') ? name : name + '.json');
                        modalOverlay.remove();
                    } else {
                        alert('Error creating list: ' + res.error);
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
    closeBtn.style.marginTop = '10px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.width = '100%';
    closeBtn.onclick = () => modalOverlay.remove();

    modalContent.appendChild(title);
    modalContent.appendChild(listContainer);
    modalContent.appendChild(newBtn);
    modalContent.appendChild(closeBtn);
    modalOverlay.appendChild(modalContent);

    document.body.appendChild(modalOverlay);
}
