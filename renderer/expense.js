// expense.js — server-side paginated, performant for large datasets

const formatExpenseCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseTableBody = document.querySelector('#expense-table tbody');
    let editingExpenseId = null;

    // ---- SERVER-SIDE PAGINATION STATE ----
    let currentPage = 1;
    const itemsPerPage = 50;
    let currentSearch = '';
    let totalRecords = 0;
    let debounceTimer = null;

    // -------- SETUP CONTROLS (once) --------
    const tableContainer = document.querySelector('#expense-table').parentElement;
    let controls = tableContainer.querySelector('.table-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'table-controls';
        controls.innerHTML = `
            <input type="text" class="table-search-input" placeholder="Search expenses...">
            <div class="pagination-controls">
                <button class="pagination-btn prev-btn">Previous</button>
                <span class="pagination-info">Page 1 of 1</span>
                <button class="pagination-btn next-btn">Next</button>
            </div>
        `;
        tableContainer.insertBefore(controls, document.querySelector('#expense-table'));
    }

    const searchInput = controls.querySelector('.table-search-input');
    const prevBtn = controls.querySelector('.prev-btn');
    const nextBtn = controls.querySelector('.next-btn');
    const pageInfo = controls.querySelector('.pagination-info');

    // -------- FETCH & RENDER --------
    const fetchAndRender = async () => {
        try {
            const data = await window.api.getPaginatedExpenses({
                page: currentPage,
                limit: itemsPerPage,
                search: currentSearch
            });

            if (!data.success) {
                expenseTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Error loading expenses.</td></tr>`;
                return;
            }

            totalRecords = data.total;
            const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;

            pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalRecords} total)`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;

            expenseTableBody.innerHTML = '';
            if (data.expenses.length === 0) {
                expenseTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No expenses found.</td></tr>`;
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
                        <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">View</button>
                        <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px;">Edit</button>
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

                expenseTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error loading expenses', err);
            expenseTableBody.innerHTML = `<tr><td colspan="7" class="text-center">Failed to load expenses.</td></tr>`;
        }
    };

    // -------- PUBLIC REFRESH --------
    window.refreshExpenses = async () => {
        currentPage = 1;
        currentSearch = '';
        if (searchInput) searchInput.value = '';
        await fetchAndRender();
    };

    // -------- SEARCH (debounced, server-side) --------
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            fetchAndRender();
        }, 300);
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
