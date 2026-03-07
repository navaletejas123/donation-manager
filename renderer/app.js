// app.js

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Add active class to clicked button and target section
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            sessionStorage.setItem('activeSection', targetId);

            // Trigger specific refreshes based on section
            if (targetId === 'dashboard-section' && window.refreshDashboard) {
                window.refreshDashboard();
            } else if (targetId === 'history-section' && window.refreshHistory) {
                // Not strictly needed on switch, but good if we want to retain state or clear
            } else if (targetId === 'all-donations-section' && window.refreshAllDonations) {
                window.refreshAllDonations();
                window.refreshPending();
            }
        });
    });

    // Initialize application data
    const savedSection = sessionStorage.getItem('activeSection');
    if (savedSection) {
        const savedBtn = document.querySelector(`.nav-btn[data-target="${savedSection}"]`);
        if (savedBtn) {
            savedBtn.click();
        } else if (window.refreshDashboard) {
            window.refreshDashboard();
        }
    } else if (window.refreshDashboard) {
        window.refreshDashboard();
    }
});

// --- GLOBAL UI HELPERS ---

// 1. Toast Notifications
window.showToast = (message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span style="font-size: 18px;">${type === 'success' ? '✓' : '⚠'}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger reflow for transition
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Override native alert globally for convenience
window.alert = (msg) => {
    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
        window.showToast(msg, 'error');
    } else {
        window.showToast(msg, 'success');
    }
};

// 2. Format Date DD-MM-YYYY
window.formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    if (!day || !month || !year) return dateString;
    return `${day}-${month}-${year}`;
};

// 3. Pagination and Search Helper (for client-side tables: history, pending)
window.setupPaginationAndSearch = (tableId, dataArray, renderRowCallback) => {
    const tableEl = document.querySelector(`#${tableId}`);
    const tableContainer = tableEl.parentElement;

    // Create/find filter controls above table
    let controls = tableContainer.querySelector('.table-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'table-controls';
        tableContainer.insertBefore(controls, tableEl);
    }
    controls.innerHTML = `
        <div class="filter-bar">
            <input type="text" class="table-search-input" placeholder="Search...">
            <input type="date" class="table-date-filter" title="Filter by exact date">
            <select class="table-month-filter" title="Filter by month">
                <option value="">All Months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
            </select>
            <button class="btn-secondary clear-filters-btn" style="padding:5px 10px;font-size:13px;">Clear</button>
        </div>
    `;

    // Pagination bar BELOW the table
    let paginationBar = tableContainer.querySelector('.pagination-bar');
    if (!paginationBar) {
        paginationBar = document.createElement('div');
        paginationBar.className = 'pagination-bar';
        tableContainer.appendChild(paginationBar);
    }
    paginationBar.innerHTML = `
        <span class="pagination-info">Page 1 of 1</span>
        <div class="pagination-controls">
            <button class="pagination-btn prev-btn">&#8249; Prev</button>
            <button class="pagination-btn next-btn">Next &#8250;</button>
        </div>
    `;

    let currentPage = 1;
    const itemsPerPage = 10;
    let filteredData = [...dataArray];

    const searchInput = controls.querySelector('.table-search-input');
    const dateFilterEl = controls.querySelector('.table-date-filter');
    const monthFilterEl = controls.querySelector('.table-month-filter');
    const clearBtn = controls.querySelector('.clear-filters-btn');
    const prevBtn = paginationBar.querySelector('.prev-btn');
    const nextBtn = paginationBar.querySelector('.next-btn');
    const pageInfo = paginationBar.querySelector('.pagination-info');
    const tbody = document.querySelector(`#${tableId} tbody`);

    const applyFilters = () => {
        const term = searchInput.value.toLowerCase();
        const dateVal = dateFilterEl.value; // YYYY-MM-DD
        const monthVal = monthFilterEl.value; // 01..12

        filteredData = dataArray.filter(item => {
            // Text search
            const matchText = !term || Object.values(item).some(val =>
                String(val).toLowerCase().includes(term)
            );
            // Date filter (item.date is YYYY-MM-DD)
            const matchDate = !dateVal || (item.date && item.date === dateVal);
            // Month filter
            const matchMonth = !monthVal || (item.date && item.date.substring(5, 7) === monthVal);
            return matchText && matchDate && matchMonth;
        });
        currentPage = 1;
        renderPage();
    };

    const renderPage = () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${filteredData.length} records)`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        tbody.innerHTML = '';
        if (filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center">No results found</td></tr>`;
            return;
        }

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = filteredData.slice(start, end);
        pageData.forEach((item, index) => {
            renderRowCallback(tbody, item, start + index + 1);
        });
    };

    searchInput.addEventListener('input', applyFilters);
    dateFilterEl.addEventListener('change', applyFilters);
    monthFilterEl.addEventListener('change', applyFilters);
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        dateFilterEl.value = '';
        monthFilterEl.value = '';
        filteredData = [...dataArray];
        currentPage = 1;
        renderPage();
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderPage(); }
    });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
        if (currentPage < totalPages) { currentPage++; renderPage(); }
    });

    // Initial render
    renderPage();
};


// 4. Generic View Modal
window.showViewModal = (title, detailsHtml) => {
    let modal = document.getElementById('view-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'view-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2 id="view-modal-title" style="color: var(--secondary-blue); border-bottom: 2px solid var(--primary-blue); padding-bottom: 10px;"></h2>
                <div id="view-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-modal').onclick = () => {
            modal.style.display = 'none';
        };

        window.onclick = (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        };
    }

    document.getElementById('view-modal-title').textContent = title;
    document.getElementById('view-modal-body').innerHTML = detailsHtml;
    modal.style.display = 'block';
};

// renderer/renderer.js
document.getElementById('min-btn')?.addEventListener('click', () => {
    window.api.windowMinimize();
});

document.getElementById('max-btn')?.addEventListener('click', () => {
    window.api.windowMaximize();
});

document.getElementById('close-btn')?.addEventListener('click', () => {
    window.api.windowClose();
});