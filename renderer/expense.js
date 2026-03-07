// expense.js — server-side paginated, performant for large datasets

const formatExpenseCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

const EXPENSE_DELETE_PASSWORD = '9097';

function openExpenseDeleteModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('delete-password-modal');
        const input = document.getElementById('delete-password-input');
        const errorEl = document.getElementById('delete-password-error');
        const closeBtn = document.getElementById('close-delete-modal');

        input.value = '';
        errorEl.style.display = 'none';
        modal.style.display = 'block';
        setTimeout(() => input.focus(), 100);

        const form = document.getElementById('delete-password-form');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        const newInput = document.getElementById('delete-password-input');
        const newErrorEl = document.getElementById('delete-password-error');
        newErrorEl.style.display = 'none';

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (newInput.value === EXPENSE_DELETE_PASSWORD) {
                modal.style.display = 'none';
                resolve(true);
            } else {
                newErrorEl.style.display = 'block';
                newInput.value = '';
                newInput.focus();
            }
        });

        closeBtn.onclick = () => { modal.style.display = 'none'; resolve(null); };

        window.addEventListener('click', function onOutside(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                window.removeEventListener('click', onOutside);
                resolve(null);
            }
        });
    });
}

async function updateExpenseTotalPill() {
    try {
        const dashData = await window.api.getDashboardData();
        const pill = document.getElementById('expense-total-pill');
        if (pill && dashData.success) {
            pill.textContent = `Total: ${formatExpenseCurrency(dashData.totalExpense || 0)}`;
        }
    } catch (e) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseTableBody = document.querySelector('#expense-table tbody');
    let editingExpenseId = null;

    // ---- SERVER-SIDE PAGINATION STATE ----
    let currentPage = 1;
    const itemsPerPage = 50;
    let currentSearch = '';
    let currentDate = '';
    let currentMonth = '';
    let totalRecords = 0;
    let debounceTimer = null;

    // -------- SETUP CONTROLS (once) --------
    const tableContainer = document.querySelector('#expense-table').parentElement;
    let controls = tableContainer.querySelector('.table-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'table-controls';
        controls.innerHTML = `
            <div class="filter-bar">
                <input type="text" class="table-search-input" placeholder="Search expenses...">
                <input type="date" class="table-date-filter" title="Filter by date">
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
        tableContainer.insertBefore(controls, document.querySelector('#expense-table'));
    }

    // Pagination goes BELOW the table
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
    const dateFilter = controls.querySelector('.table-date-filter');
    const monthFilter = controls.querySelector('.table-month-filter');
    const yearFilter = controls.querySelector('.table-year-filter');
    const clearBtn = controls.querySelector('.clear-filters-btn');
    const prevBtn = paginationBar.querySelector('.prev-btn');
    const nextBtn = paginationBar.querySelector('.next-btn');
    const pageInfo = paginationBar.querySelector('.pagination-info');

    // Populate year filter
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= thisYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearFilter.appendChild(opt);
    }

    // -------- FETCH & RENDER --------
    const fetchAndRender = async () => {
        try {
            // Build monthFilter param: YYYY-MM if both month and year selected,
            // or just the year if only year selected
            let monthParam = '';
            const mVal = monthFilter.value;
            const yVal = yearFilter.value;
            if (mVal && yVal) monthParam = `${yVal}-${mVal}`;
            else if (yVal) monthParam = yVal; // partial prefix match won't work with strftime, handle below
            // For year-only filter we use a LIKE approach — we'll pass it as dateFilter prefix workaround
            // Actually let's pass year as monthFilter prefix with strftime('%Y', date) = yVal
            // We'll add a yearFilter param instead
            const data = await window.api.getPaginatedExpenses({
                page: currentPage,
                limit: itemsPerPage,
                search: currentSearch,
                dateFilter: currentDate,
                monthFilter: monthParam,
                yearFilter: (!mVal && yVal) ? yVal : ''
            });

            if (!data.success) {
                expenseTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Error loading expenses.</td></tr>`;
                return;
            }

            totalRecords = data.total;
            const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;

            pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalRecords} records)`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;

            expenseTableBody.innerHTML = '';
            if (data.expenses.length === 0) {
                expenseTableBody.innerHTML = `<tr><td colspan="8" class="text-center">No expenses found.</td></tr>`;
                updateExpenseTotalPill();
                return;
            }

            const startIndex = (currentPage - 1) * itemsPerPage;
            data.expenses.forEach((e, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${startIndex + idx + 1}</td>
                    <td>${window.formatDateDDMMYYYY(e.date)}</td>
                    <td>${e.title}</td>
                    <td>${e.description ? (e.description.length > 30 ? e.description.substring(0, 30) + '...' : e.description) : '-'}</td>
                    <td>${formatExpenseCurrency(e.amount)}</td>
                    <td>${e.payment_method || 'Offline'} ${e.transaction_id ? '(' + e.transaction_id + ')' : ''}</td>
                    <td>
                        <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 4px;">View</button>
                        <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 4px;">Edit</button>
                        <button class="btn-danger delete-btn" style="padding: 5px 10px; font-size: 13px; background:#e53e3e; color:#fff; border:none; border-radius:6px; cursor:pointer;">Delete</button>
                    </td>
                `;

                tr.querySelector('.view-btn').addEventListener('click', () => {
                    const html = `
                        <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(e.date)}</p>
                        <p><strong>Title:</strong> ${e.title}</p>
                        <p><strong>Amount:</strong> ${formatExpenseCurrency(e.amount)}</p>
                        <p><strong>Payment Method:</strong> ${e.payment_method || 'Offline'} ${e.transaction_id ? `(${e.transaction_id})` : ''}</p>
                        <p><strong>Description:</strong> ${e.description ? e.description.replace(/\n/g, '<br>') : 'N/A'}</p>
                    `;
                    window.showViewModal('Expense Details', html);
                });

                tr.querySelector('.edit-btn').addEventListener('click', () => {
                    editingExpenseId = e.id;
                    document.getElementById('expense-date').value = e.date;
                    document.getElementById('expense-title').value = e.title;
                    document.getElementById('expense-amount').value = e.amount;
                    document.getElementById('expense-desc').value = e.description || '';

                    const pMethod = e.payment_method || 'Offline';
                    document.querySelector(`input[name="expense_payment_method"][value="${pMethod}"]`).checked = true;

                    const transGroup = document.getElementById('expense-transaction-group');
                    const transInput = document.getElementById('expense-transaction-id');
                    if (pMethod === 'Online') {
                        transGroup.style.display = 'block';
                        transInput.value = e.transaction_id || '';
                        transInput.setAttribute('required', 'true');
                    } else {
                        transGroup.style.display = 'none';
                        transInput.value = '';
                        transInput.removeAttribute('required');
                    }

                    document.getElementById('expense-submit-btn').textContent = 'Update Expense';
                    document.getElementById('cancel-expense-edit-btn').style.display = 'inline-block';
                    document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
                });

                tr.querySelector('.delete-btn').addEventListener('click', async () => {
                    const confirmed = await openExpenseDeleteModal();
                    if (!confirmed) return;
                    const res = await window.api.deleteExpense(e.id);
                    if (res.success) {
                        window.showToast('Expense deleted successfully!', 'success');
                        await fetchAndRender();
                        if (window.refreshDashboard) window.refreshDashboard();
                    } else {
                        window.showToast('Error deleting expense: ' + res.error, 'error');
                    }
                });

                expenseTableBody.appendChild(tr);
            });

            updateExpenseTotalPill();
        } catch (err) {
            console.error('Error loading expenses', err);
            expenseTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Failed to load expenses.</td></tr>`;
        }
    };

    // -------- PUBLIC REFRESH --------
    window.refreshExpenses = async () => {
        currentPage = 1;
        currentSearch = '';
        currentDate = '';
        currentMonth = '';
        if (searchInput) searchInput.value = '';
        if (dateFilter) dateFilter.value = '';
        if (monthFilter) monthFilter.value = '';
        if (yearFilter) yearFilter.value = '';
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

    dateFilter.addEventListener('change', () => {
        currentDate = dateFilter.value;
        currentPage = 1;
        fetchAndRender();
    });

    monthFilter.addEventListener('change', () => {
        currentPage = 1;
        fetchAndRender();
    });

    yearFilter.addEventListener('change', () => {
        currentPage = 1;
        fetchAndRender();
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        dateFilter.value = '';
        monthFilter.value = '';
        yearFilter.value = '';
        currentSearch = '';
        currentDate = '';
        currentPage = 1;
        fetchAndRender();
    });

    // -------- PAGINATION BUTTONS --------
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; fetchAndRender(); }
    });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
        if (currentPage < totalPages) { currentPage++; fetchAndRender(); }
    });

    // -------- FORM SUBMIT --------
    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = document.getElementById('expense-date').value;
        const title = document.getElementById('expense-title').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const description = document.getElementById('expense-desc').value;
        const paymentMethod = document.querySelector('input[name="expense_payment_method"]:checked').value;
        const transactionId = document.getElementById('expense-transaction-id').value;

        const data = { id: editingExpenseId, date, title, amount, description, paymentMethod, transactionId };

        try {
            let result;
            if (editingExpenseId) {
                result = await window.api.updateExpense(data);
            } else {
                result = await window.api.addExpense(data);
            }

            if (result.success) {
                window.showToast(editingExpenseId ? 'Expense updated successfully!' : 'Expense added successfully!', 'success');
                resetExpenseForm();
                await fetchAndRender();
                if (window.refreshDashboard) window.refreshDashboard();
            } else {
                window.showToast('Error: ' + result.error, 'error');
            }
        } catch (err) {
            console.error('Failed to save expense', err);
            window.showToast('Failed to save expense due to system error.', 'error');
        }
    });

    document.getElementById('cancel-expense-edit-btn').addEventListener('click', resetExpenseForm);

    function resetExpenseForm() {
        expenseForm.reset();
        editingExpenseId = null;
        document.getElementById('expense-submit-btn').textContent = 'Save Expense';
        document.getElementById('cancel-expense-edit-btn').style.display = 'none';
        document.querySelector('input[name="expense_payment_method"][value="Offline"]').checked = true;
        document.getElementById('expense-transaction-group').style.display = 'none';
        document.getElementById('expense-transaction-id').removeAttribute('required');
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

    // Payment method toggle
    document.querySelectorAll('input[name="expense_payment_method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const transGroup = document.getElementById('expense-transaction-group');
            const transInput = document.getElementById('expense-transaction-id');
            if (e.target.value === 'Online') {
                transGroup.style.display = 'block';
                transInput.setAttribute('required', 'true');
            } else {
                transGroup.style.display = 'none';
                transInput.removeAttribute('required');
                transInput.value = '';
            }
        });
    });

    // Init
    resetExpenseForm();
    const donationDate = document.getElementById('donation-date');
    if (donationDate) donationDate.value = new Date().toISOString().split('T')[0];

    // Initial load
    fetchAndRender();
});
