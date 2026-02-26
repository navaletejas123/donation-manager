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
                data.expenses.forEach(e => {
                    const tr = document.createElement('tr');
                    
                    tr.innerHTML = `
                        <td>${e.date}</td>
                        <td>${e.title}</td>
                        <td>${e.description || '-'}</td>
                        <td>${formatExpenseCurrency(e.amount)}</td>
                        <td>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px;">Edit</button>
                        </td>
                    `;

                    // Add edit listener
                    tr.querySelector('.edit-btn').addEventListener('click', () => {
                        editingExpenseId = e.id;
                        document.getElementById('expense-date').value = e.date;
                        document.getElementById('expense-title').value = e.title;
                        document.getElementById('expense-amount').value = e.amount;
                        document.getElementById('expense-desc').value = e.description || '';
                        
                        document.getElementById('expense-submit-btn').textContent = 'Update Expense';
                        document.getElementById('cancel-expense-edit-btn').style.display = 'inline-block';
                    });

                    expenseTableBody.appendChild(tr);
                });
            } else {
                expenseTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No expenses found.</td></tr>`;
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

        const data = { id: editingExpenseId, date, title, amount, description };

        try {
            let result;
            if (editingExpenseId) {
                result = await window.api.updateExpense(data);
                if (result.success) alert('Expense updated successfully!');
            } else {
                result = await window.api.addExpense(data);
                if (result.success) alert('Expense added successfully!');
            }
            
            if (result.success) {
                resetExpenseForm();
                window.refreshExpenses();
                if (window.refreshDashboard) window.refreshDashboard();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error('Failed to save expense', err);
        }
    });

    document.getElementById('cancel-expense-edit-btn').addEventListener('click', resetExpenseForm);

    function resetExpenseForm() {
        expenseForm.reset();
        editingExpenseId = null;
        document.getElementById('expense-submit-btn').textContent = 'Save Expense';
        document.getElementById('cancel-expense-edit-btn').style.display = 'none';
        
        // Reset to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date').value = today;
    }

    // Set today's date as default for forms
    resetExpenseForm();
    const donationDate = document.getElementById('donation-date');
    if(donationDate) donationDate.value = new Date().toISOString().split('T')[0];

    // Initial table load
    window.refreshExpenses();
});
