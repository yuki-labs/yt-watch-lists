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
