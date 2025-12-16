export function renderPage(dropdown, opts, page, itemsPerPage, totalPages, setPageCallback, closeMenusCallback) {
    dropdown.innerHTML = ''; // Clear

    // 1. Prev Button
    if (totalPages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'dropdown-control-btn prev-btn';
        prevBtn.innerHTML = '‹';
        // Hide if on first page?
        if (page === 0) prevBtn.style.visibility = 'hidden';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            if (page > 0) setPageCallback(page - 1);
        };
        dropdown.appendChild(prevBtn);
    }

    // 2. Container
    const container = document.createElement('div');
    container.className = 'menu-list-container';

    // Slice items
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const itemsToShow = opts.slice(start, end);

    itemsToShow.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'dropdown-item';
        if (opt.isDelete) btn.classList.add('delete-item');
        if (opt.type) btn.classList.add(`btn-${opt.type}`);

        // Tooltip
        btn.title = opt.label;

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
            if (closeMenusCallback) closeMenusCallback();
            opt.action();
        };
        container.appendChild(btn);
    });

    dropdown.appendChild(container);

    // 3. Next Button
    if (totalPages > 1) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'dropdown-control-btn next-btn';
        nextBtn.innerHTML = '›';
        if (page === totalPages - 1) nextBtn.style.visibility = 'hidden';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            if (page < totalPages - 1) setPageCallback(page + 1);
        };
        dropdown.appendChild(nextBtn);
    }
}

export function createBtn(text, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'move-btn';
    btn.textContent = text;
    btn.title = title;
    btn.onclick = onClick;
    return btn;
}
