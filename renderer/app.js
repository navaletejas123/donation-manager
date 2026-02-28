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
    if (window.refreshDashboard) window.refreshDashboard();
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

// 3. Pagination and Search Helper
window.setupPaginationAndSearch = (tableId, dataArray, renderRowCallback) => {
    const tableContainer = document.querySelector(`#${tableId}`).parentElement;
    
    // Create or find controls container
    let controls = tableContainer.querySelector('.table-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'table-controls';
        
        controls.innerHTML = `
            <input type="text" class="table-search-input" placeholder="Search...">
            <div class="pagination-controls">
                <button class="pagination-btn prev-btn">Previous</button>
                <span class="pagination-info">Page 1 of 1</span>
                <button class="pagination-btn next-btn">Next</button>
            </div>
        `;
        tableContainer.insertBefore(controls, document.querySelector(`#${tableId}`));
    }

    let currentPage = 1;
    const itemsPerPage = 10;
    let filteredData = [...dataArray];

    const searchInput = controls.querySelector('.table-search-input');
    const prevBtn = controls.querySelector('.prev-btn');
    const nextBtn = controls.querySelector('.next-btn');
    const pageInfo = controls.querySelector('.pagination-info');
    const tbody = document.querySelector(`#${tableId} tbody`);

    const renderPage = () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
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
            renderRowCallback(tbody, item, start + index + 1); // index is global offset
        });
    };

    // Attach Search Event (Replace old listeners to avoid duplicates)
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredData = dataArray.filter(item => {
            return Object.values(item).some(val => 
                String(val).toLowerCase().includes(term)
            );
        });
        currentPage = 1;
        renderPage();
    });

    const newPrevBtn = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    newPrevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    });

    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    newNextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
        }
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

