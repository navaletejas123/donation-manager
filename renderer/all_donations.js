// all_donations.js — server-side paginated for large dataset support

const formatAllCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

const DELETE_PASSWORD = '9097';

function openDeletePasswordModal(titleText = 'Delete Donation') {
    return new Promise((resolve) => {
        const titleEl = document.getElementById('delete-modal-title');
        if (titleEl) titleEl.textContent = `🔒 ${titleText}`;
        const modal = document.getElementById('delete-password-modal');
        const errorEl = document.getElementById('delete-password-error');
        const closeBtn = document.getElementById('close-delete-modal');
        const oldForm = document.getElementById('delete-password-form');

        // Clone the form to remove ALL old event listeners (prevents conflicts with other JS files)
        const form = oldForm.cloneNode(true);
        oldForm.parentNode.replaceChild(form, oldForm);

        const input = form.querySelector('#delete-password-input');

        input.value = '';
        errorEl.style.display = 'none';
        modal.style.display = 'block';
        setTimeout(() => {
            input.disabled = false;
            input.readOnly = false;
            input.focus();
            input.click();
        }, 200);

        form.addEventListener('submit', function handleSubmit(e) {
            e.preventDefault();
            e.stopPropagation();
            if (input.value === DELETE_PASSWORD) {
                modal.style.display = 'none';
                form.removeEventListener('submit', handleSubmit);
                resolve(true);
            } else {
                errorEl.style.display = 'block';
                input.value = '';
                input.focus();
            }
        });

        closeBtn.onclick = () => { 
            modal.style.display = 'none'; 
            resolve(null); 
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(null);
            }
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ---- SERVER-SIDE PAGINATION STATE ----
    let currentPage = 1;
    const itemsPerPage = 50;
    let currentSearch = '';
    let currentDate = '';
    let totalRecords = 0;
    let debounceTimer = null;

    // -------- SETUP CONTROLS (filter bar above table) --------
    const tableContainer = document.querySelector('#all-donations-table').parentElement;
    let controls = tableContainer.querySelector('.table-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'table-controls';
        controls.innerHTML = `
            <div class="filter-bar">
            <div class="filterInputsContainer">
            <input type="text" class="table-search-input" placeholder="Search by donor, category, amount...">
                <input type="date" class="table-date-filter" title="Filter by date">
            </div> 
            <br />
                
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
                <select class="table-year-filter" title="Filter by year">
                    <option value="">All Years</option>
                </select>
                <button class="btn-secondary clear-filters-btn" style="padding:5px 10px;font-size:13px;">Clear</button>
            </div>
        `;
        tableContainer.insertBefore(controls, document.querySelector('#all-donations-table'));
    }

    // Pagination bar BELOW the table
    let paginationBar = tableContainer.querySelector('.pagination-bar');
    if (!paginationBar) {
        paginationBar = document.createElement('div');
        paginationBar.className = 'pagination-bar';
        paginationBar.innerHTML = `
            <span class="pagination-info">Page 1 of 1</span>
            <div class="pagination-controls">
                <button class="pagination-btn prev-btn">&#8249; Prev</button>
                <button class="pagination-btn next-btn">Next &#8250;</button>
            </div>
        `;
        tableContainer.appendChild(paginationBar);
    }

    const searchInput = controls.querySelector('.table-search-input');
    const dateFilterEl = controls.querySelector('.table-date-filter');
    const monthFilterEl = controls.querySelector('.table-month-filter');
    const yearFilterEl = controls.querySelector('.table-year-filter');
    const clearBtn = controls.querySelector('.clear-filters-btn');
    const prevBtn = paginationBar.querySelector('.prev-btn');
    const nextBtn = paginationBar.querySelector('.next-btn');
    const pageInfo = paginationBar.querySelector('.pagination-info');
    const tbody = document.querySelector('#all-donations-table tbody');

    // Populate year filter
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= thisYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearFilterEl.appendChild(opt);
    }

    const fetchAndRender = async () => {
        try {
            const mVal = monthFilterEl.value;
            const yVal = yearFilterEl.value;
            let monthParam = '';
            if (mVal && yVal) monthParam = `${yVal}-${mVal}`;

            const data = await window.api.getPaginatedDonations({
                page: currentPage,
                limit: itemsPerPage,
                search: currentSearch,
                dateFilter: dateFilterEl.value,
                monthFilter: monthParam,
                yearFilter: (!mVal && yVal) ? yVal : ''
            });

            if (!data.success) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center">Error loading donations.</td></tr>`;
                return;
            }

            totalRecords = data.total;
            const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;

            pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalRecords} records)`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;

            // Update totals from aggregated DB query (not client-calculated)
            refreshSummaryTotals();

            tbody.innerHTML = '';
            if (data.donations.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center">No donations found.</td></tr>`;
                return;
            }

            const startIndex = (currentPage - 1) * itemsPerPage;
            data.donations.forEach((d, idx) => {
                const tr = document.createElement('tr');
                const hasPending = d.pending_amount > 0;

                tr.innerHTML = `
                    <td>${startIndex + idx + 1}</td>
                    <td class="table-date-cell">${window.formatDateDDMMYYYY(d.date)}</td>
                    <td>${d.donor_name}</td>
                    <td>${d.function_name ? d.function_name : d.category}</td>
                    <td>${d.reset_number || '-'}</td>
                    <td>${formatAllCurrency(d.amount)}</td>
                    <td>
                        ${hasPending ? 'null' : `
                            ${d.payment_method} 
                            ${d.transaction_id ? '(' + d.transaction_id + ')' : ''}
                            ${d.payment_method === 'Bank Check' ? `(${d.bank_check_number}, ${d.bank_name})` : ''}
                        `}
                    </td>
                    <td>
                        ${hasPending ? `<span class="badge-pending">${formatAllCurrency(d.pending_amount)}</span>` : formatAllCurrency(d.pending_amount)}
                    </td>
                    <td class="table-date-cell">${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : '-'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn action-view view-btn" title="View"><i class="bi bi-eye-fill"></i></button>
                            <button class="action-btn action-edit edit-btn" title="Edit"><i class="bi bi-pencil-fill"></i></button>
                            <button class="action-btn action-delete delete-btn" title="Delete"><i class="bi bi-trash-fill"></i></button>
                        </div>
                    </td>
                `;

                // View
                tr.querySelector('.view-btn').addEventListener('click', async () => {
                    const pymtData = await window.api.getPendingPayments(d.id);
                    let paymentHistoryHtml = '';
                    if (pymtData.success && pymtData.payments.length > 0) {
                        const rows = pymtData.payments.map((p, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${window.formatDateDDMMYYYY(p.date)}</td>
                                <td>${formatAllCurrency(p.amount_paid)}</td>
                                <td>
                                    ${p.payment_method}
                                    ${p.transaction_id ? ' (' + p.transaction_id + ')' : ''}
                                    ${p.payment_method === 'Bank Check' ? ` (${p.bank_check_number}, ${p.bank_name})` : ''}
                                </td>
                            </tr>`).join('');
                        paymentHistoryHtml = `
                            <h4 style="margin-top:15px; border-top:1px solid #eee; padding-top:10px; color:var(--secondary-blue);">Payment History</h4>
                            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                                <thead><tr style="background:#f0f4ff;">
                                    <th style="padding:5px 8px; text-align:left;">#</th>
                                    <th style="padding:5px 8px; text-align:left;">Date</th>
                                    <th style="padding:5px 8px; text-align:left;">Amount Paid</th>
                                    <th style="padding:5px 8px; text-align:left;">Method</th>
                                </tr></thead>
                                <tbody>${rows}</tbody>
                            </table>`;
                    }
                    const html = `
                        <p><strong>Donor:</strong> ${d.donor_name}</p>
                        <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(d.date)}</p>
                        <p><strong>Category:</strong> ${d.function_name ? d.function_name : d.category}</p>
                        <p><strong>Reset Number:</strong> ${d.reset_number || 'N/A'}</p>
                        <p><strong>Amount:</strong> ${formatAllCurrency(d.amount)}</p>
                        <p><strong>Payment Method:</strong> 
                            ${d.payment_method} 
                            ${d.transaction_id ? `(${d.transaction_id})` : ''} 
                            ${d.payment_method === 'Bank Check' ? `(${d.bank_check_number}, ${d.bank_name})` : ''}
                        </p>
                        <p><strong>Pending Amount:</strong> ${formatAllCurrency(d.pending_amount)}</p>
                        <p><strong>Last Cleared Date:</strong> ${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : 'N/A'}</p>
                        ${paymentHistoryHtml}
                    `;
                    window.showViewModal('Donation Details', html);
                });

                // Edit
                tr.querySelector('.edit-btn').addEventListener('click', () => {
                    if (window.editDonation) window.editDonation(d, d.donor_name);
                });

                // Delete
                tr.querySelector('.delete-btn').addEventListener('click', async () => {
                    const confirmed = await openDeletePasswordModal();
                    if (!confirmed) return;
                    const res = await window.api.deleteDonation(d.id);
                    if (res.success) {
                        window.showToast('Donation deleted successfully!', 'success');
                        await fetchAndRender();
                        if (window.refreshDashboard) window.refreshDashboard();
                        if (window.refreshPending) window.refreshPending();
                    } else {
                        window.showToast('Error deleting donation: ' + res.error, 'error');
                    }
                });

                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error loading all donations', err);
            tbody.innerHTML = `<tr><td colspan="10" class="text-center">Failed to load data.</td></tr>`;
        }
    };

    // Fetch aggregated totals separately (fast, no data load)
    const refreshSummaryTotals = async () => {
        try {
            const dashData = await window.api.getDashboardData();
            if (dashData.success) {
                document.getElementById('all-donations-total-paid').textContent = formatAllCurrency(dashData.totalCashIn);
                document.getElementById('all-donations-total-pending').textContent = formatAllCurrency(dashData.totalPending);
            }
        } catch (e) { /* ignore */ }
    };

    // -------- PUBLIC REFRESH --------
    window.refreshAllDonations = async () => {
        currentPage = 1;
        currentSearch = '';
        currentDate = '';
        if (searchInput) searchInput.value = '';
        if (dateFilterEl) dateFilterEl.value = '';
        if (monthFilterEl) monthFilterEl.value = '';
        if (yearFilterEl) yearFilterEl.value = '';
        await fetchAndRender();
    };

    // -------- SEARCH (debounced) --------
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            fetchAndRender();
        }, 300);
    });

    dateFilterEl.addEventListener('change', () => {
        currentPage = 1;
        fetchAndRender();
    });

    monthFilterEl.addEventListener('change', () => {
        currentPage = 1;
        fetchAndRender();
    });

    yearFilterEl.addEventListener('change', () => {
        currentPage = 1;
        fetchAndRender();
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        dateFilterEl.value = '';
        monthFilterEl.value = '';
        yearFilterEl.value = '';
        currentSearch = '';
        currentDate = '';
        currentPage = 1;
        fetchAndRender();
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; fetchAndRender(); }
    });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
        if (currentPage < totalPages) { currentPage++; fetchAndRender(); }
    });

    // Initial load
    fetchAndRender();
});
