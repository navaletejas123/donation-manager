// expense.js

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

    window.refreshExpenses = async () => {
        try {
            const data = await window.api.getAllExpenses();
            expenseTableBody.innerHTML = '';

            if (data.success && data.expenses.length > 0) {
                const renderRow = (tbody, e, index) => {
                    const tr = document.createElement('tr');
                    
                    tr.innerHTML = `
                        <td>${index}</td>
                        <td>${window.formatDateDDMMYYYY(e.date)}</td>
                        <td>${e.title}</td>
                        <td>${e.description ? (e.description.length > 30 ? e.description.substring(0,30) + '...' : e.description) : '-'}</td>
                        <td>${formatExpenseCurrency(e.amount)}</td>
                        <td>${e.payment_method || 'Offline'} ${e.transaction_id ? '('+e.transaction_id+')' : ''}</td>
                        <td>
                            <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">View</button>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px;">Edit</button>
                        </td>
                    `;

                    // View listener
                    tr.querySelector('.view-btn').addEventListener('click', () => {
                        const html = `
                            <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(e.date)}</p>
                            <p><strong>Title:</strong> ${e.title}</p>
                            <p><strong>Amount:</strong> ${formatExpenseCurrency(e.amount)}</p>
                            <p><strong>Payment Method:</strong> ${e.payment_method || 'Offline'} ${e.transaction_id ? `(${e.transaction_id})` : ''}</p>
                            <p><strong>Description:</strong> ${e.description ? e.description.replace(/\\n/g, '<br>') : 'N/A'}</p>
                        `;
                        window.showViewModal('Expense Details', html);
                    });

                    // Add edit listener
                    tr.querySelector('.edit-btn').addEventListener('click', () => {
                        editingExpenseId = e.id;
                        document.getElementById('expense-date').value = e.date;
                        document.getElementById('expense-title').value = e.title;
                        document.getElementById('expense-amount').value = e.amount;
                        document.getElementById('expense-desc').value = e.description || '';
                        
                        // Set payment radios
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
                        
                        // Scroll to form smoothly
                        document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });

                    tbody.appendChild(tr);
                };

                window.setupPaginationAndSearch('expense-table', data.expenses, renderRow);
            } else {
                expenseTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No expenses found.</td></tr>`;
            }
        } catch (err) {
            console.error("Error refreshing expenses list", err);
        }
    };

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
            if (result.success) {
                window.showToast(editingExpenseId ? 'Expense updated successfully!' : 'Expense added successfully!', 'success');
                resetExpenseForm();
                window.refreshExpenses();
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
        
        // Reset to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

    // Payment method toggle listener
    const expRadios = document.querySelectorAll('input[name="expense_payment_method"]');
    expRadios.forEach(radio => {
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

    // Set today's date as default for forms
    resetExpenseForm();
    const donationDate = document.getElementById('donation-date');
    if(donationDate) donationDate.value = new Date().toISOString().split('T')[0];

    // Initial table load
    window.refreshExpenses();
});
