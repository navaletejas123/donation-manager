document.addEventListener('DOMContentLoaded', () => {
    const api = window.api;

    const sfSelect = document.getElementById('sf-select');
    const createNewBtn = document.getElementById('sf-create-new-btn');
    const createFormContainer = document.getElementById('sf-create-form-container');
    const createForm = document.getElementById('sf-create-form');
    const cancelCreateBtn = document.getElementById('sf-cancel-create-btn');
    const detailsContainer = document.getElementById('sf-details-container');

    const newNameInput = document.getElementById('sf-new-name');
    const newDateInput = document.getElementById('sf-new-date');

    const totalDonationsEl = document.getElementById('sf-total-donations');
    const totalPendingEl = document.getElementById('sf-total-pending');
    const totalExpensesEl = document.getElementById('sf-total-expenses');
    const netBalanceEl = document.getElementById('sf-net-balance');

    const donationsTableBody = document.querySelector('#sf-donations-table tbody');
    const expensesTableBody = document.querySelector('#sf-expenses-table tbody');

    // Add Donation to Function Form
    const addDonationForm = document.getElementById('sf-add-donation-form');
    const donorNameInput = document.getElementById('sf-donor-name');
    const autocompleteList = document.getElementById('sf-autocomplete-list');
    const resetNumberInput = document.getElementById('sf-reset-number');
    const donationDateInput = document.getElementById('sf-donation-date');
    const donationAmountInput = document.getElementById('sf-donation-amount');
    const pendingAmountInput = document.getElementById('sf-pending-amount');
    const paymentMethodRadios = document.getElementsByName('sf_payment_method');
    const transactionIdGroup = document.getElementById('sf-transaction-id-group');
    const transactionIdInput = document.getElementById('sf-transaction-id');
    const bankCheckGroup = document.getElementById('sf-bank-check-group');
    const bankCheckNumberInput = document.getElementById('sf-bank-check-number');
    const bankNameInput = document.getElementById('sf-bank-name');

    const attendeesCountEl = document.getElementById('sf-attendees-count');

    let currentFunctions = [];
    let donationsData = [];
    let expensesData = [];
    let donationsPage = 1;
    let expensesPage = 1;
    const pageSize = 10;

    // Date default
    const today = new Date().toISOString().split('T')[0];
    donationDateInput.value = today;

    // Load Functions
    async function loadFunctions() {
        const res = await api.getSpecialFunctions();
        if (res.success) {
            currentFunctions = res.functions;
            sfSelect.innerHTML = '<option value="" disabled selected>Select an event / puja...</option>';
            res.functions.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.name} (${f.date})`;
                sfSelect.appendChild(opt);
            });
        }
    }

    function renderDonations() {
        if (!donationsTableBody) return;
        donationsTableBody.innerHTML = '';
        
        const start = (donationsPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = donationsData.slice(start, end);
        const totalPages = Math.ceil(donationsData.length / pageSize) || 1;

        pageData.forEach((d, index) => {
            const tr = document.createElement('tr');
            const displayMethod = d.pending_amount > 0 ? `<span style="color:#999;font-style:italic;">null</span>` : d.payment_method;
            tr.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${d.donor_name}</td>
                <td>₹${d.amount.toFixed(2)}</td>
                <td>₹${d.pending_amount.toFixed(2)}</td>
                <td>${displayMethod}</td>
            `;
            donationsTableBody.appendChild(tr);
        });

        // Update pagination UI
        const info = document.getElementById('sf-donations-info');
        if (info) info.textContent = `Page ${donationsPage} of ${totalPages}`;
        
        const prevBtn = document.getElementById('sf-donations-prev');
        const nextBtn = document.getElementById('sf-donations-next');
        if (prevBtn) prevBtn.disabled = donationsPage === 1;
        if (nextBtn) nextBtn.disabled = donationsPage === totalPages;
    }

    function renderExpenses() {
        if (!expensesTableBody) return;
        expensesTableBody.innerHTML = '';
        
        const start = (expensesPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = expensesData.slice(start, end);
        const totalPages = Math.ceil(expensesData.length / pageSize) || 1;

        pageData.forEach((e, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${e.title}</td>
                <td>₹${e.amount.toFixed(2)}</td>
            `;
            expensesTableBody.appendChild(tr);
        });

        // Update pagination UI
        const info = document.getElementById('sf-expenses-info');
        if (info) info.textContent = `Page ${expensesPage} of ${totalPages}`;
        
        const prevBtn = document.getElementById('sf-expenses-prev');
        const nextBtn = document.getElementById('sf-expenses-next');
        if (prevBtn) prevBtn.disabled = expensesPage === 1;
        if (nextBtn) nextBtn.disabled = expensesPage === totalPages;
    }

    // Load Function Details
    async function loadFunctionDetails(id) {
        if (!id) return;
        const res = await api.getFunctionDetails(id);
        if (res.success) {
            detailsContainer.style.display = 'block';
            
            if (totalDonationsEl) totalDonationsEl.textContent = `₹${res.totalDonations.toFixed(2)}`;
            if (totalPendingEl) totalPendingEl.textContent = `₹${res.totalPending.toFixed(2)}`;
            if (totalExpensesEl) totalExpensesEl.textContent = `₹${res.totalExpenses.toFixed(2)}`;
            
            if (attendeesCountEl) attendeesCountEl.textContent = res.donations.length;

            const net = res.totalDonations - res.totalExpenses;
            if (netBalanceEl) netBalanceEl.textContent = `₹${net.toFixed(2)}`;

            donationsData = res.donations || [];
            expensesData = res.expenses || [];
            donationsPage = 1;
            expensesPage = 1;

            renderDonations();
            renderExpenses();
            
            // Set date to function date
            donationDateInput.value = res.func.date;
        }
    }

    // Pagination Event Listeners
    document.getElementById('sf-donations-prev').addEventListener('click', () => {
        if (donationsPage > 1) {
            donationsPage--;
            renderDonations();
        }
    });

    document.getElementById('sf-donations-next').addEventListener('click', () => {
        const totalPages = Math.ceil(donationsData.length / pageSize);
        if (donationsPage < totalPages) {
            donationsPage++;
            renderDonations();
        }
    });

    document.getElementById('sf-expenses-prev').addEventListener('click', () => {
        if (expensesPage > 1) {
            expensesPage--;
            renderExpenses();
        }
    });

    document.getElementById('sf-expenses-next').addEventListener('click', () => {
        const totalPages = Math.ceil(expensesData.length / pageSize);
        if (expensesPage < totalPages) {
            expensesPage++;
            renderExpenses();
        }
    });

    sfSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        createFormContainer.style.display = 'none';
        loadFunctionDetails(id);
    });

    createNewBtn.addEventListener('click', () => {
        detailsContainer.style.display = 'none';
        sfSelect.value = '';
        createFormContainer.style.display = 'block';
        newDateInput.value = today;
    });

    cancelCreateBtn.addEventListener('click', () => {
        createFormContainer.style.display = 'none';
    });

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: newNameInput.value.trim(),
            date: newDateInput.value
        };
        const res = await api.addSpecialFunction(data);
        if (res.success) {
            newNameInput.value = '';
            createFormContainer.style.display = 'none';
            await loadFunctions();
            // Need to select the newly created function
            // Since it's sorted by date DESC, id DESC, it will usually be at the top
            // but we can just reload all and pick the first or by name.
            if (currentFunctions.length > 0) {
                const justAdded = currentFunctions.find(f => f.name === data.name);
                if (justAdded) {
                    sfSelect.value = justAdded.id;
                    loadFunctionDetails(justAdded.id);
                } else {
                    sfSelect.value = currentFunctions[0].id;
                    loadFunctionDetails(currentFunctions[0].id);
                }
            }
        } else {
            alert('Error creating function: ' + res.error);
        }
    });

    // Payment method toggle logic
    function updatePaymentMethodState() {
        const pendingAmount = parseFloat(pendingAmountInput.value || 0);
        const isFrozen = pendingAmount > 0;

        paymentMethodRadios.forEach(radio => {
            radio.disabled = isFrozen;
            if (isFrozen && radio.value === 'Offline') {
                radio.checked = true;
            }
        });

        if (isFrozen) {
            transactionIdGroup.style.display = 'none';
            transactionIdInput.removeAttribute('required');
            transactionIdInput.value = '';
            bankCheckGroup.style.display = 'none';
            bankCheckNumberInput.removeAttribute('required');
            bankNameInput.removeAttribute('required');
            bankCheckNumberInput.value = '';
            bankNameInput.value = '';
        } else {
            // Restore visibility based on current selection if not frozen
            const val = document.querySelector('input[name="sf_payment_method"]:checked').value;
            transactionIdGroup.style.display = (val === 'Online') ? 'block' : 'none';
            if(val === 'Online') transactionIdInput.setAttribute('required', 'true');
            else transactionIdInput.removeAttribute('required');

            bankCheckGroup.style.display = (val === 'Bank Check') ? 'block' : 'none';
            if(val === 'Bank Check') {
                bankCheckNumberInput.setAttribute('required', 'true');
                bankNameInput.setAttribute('required', 'true');
            } else {
                bankCheckNumberInput.removeAttribute('required');
                bankNameInput.removeAttribute('required');
            }
        }
    }

    pendingAmountInput.addEventListener('input', updatePaymentMethodState);

    donationAmountInput.addEventListener('input', (e) => {
        const originalTotalStr = donationAmountInput.dataset.originalTotal;
        if (originalTotalStr) {
            const originalTotal = parseFloat(originalTotalStr);
            const currentAmount = parseFloat(donationAmountInput.value) || 0;
            const newPending = Math.max(0, originalTotal - currentAmount);
            pendingAmountInput.value = newPending.toFixed(2);
            updatePaymentMethodState();
        }
    });

    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', updatePaymentMethodState);
    });

    // Autocomplete for donor name
    let debounceTime;
    donorNameInput.addEventListener('input', function(e) {
        clearTimeout(debounceTime);
        const val = e.target.value.trim();
        autocompleteList.innerHTML = '';
        if (val.length < 2) {
            autocompleteList.style.display = 'none';
            return;
        }
        debounceTime = setTimeout(async () => {
            try {
                const results = await api.searchDonors(val);
                autocompleteList.innerHTML = '';
                if (results && results.length > 0) {
                    autocompleteList.style.display = 'block';
                    results.forEach(donor => {
                        const li = document.createElement('li');
                        li.textContent = donor.name;
                        li.addEventListener('click', () => {
                            donorNameInput.value = donor.name;
                            autocompleteList.style.display = 'none';
                        });
                        autocompleteList.appendChild(li);
                    });
                } else {
                    autocompleteList.style.display = 'none';
                }
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            autocompleteList.innerHTML = '';
            autocompleteList.style.display = 'none';
        }
    });

    // Add Donation form submit
    addDonationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const functionId = sfSelect.value;
        if (!functionId) return;

        // Validation for pending amount
        const amount = parseFloat(donationAmountInput.value);
        const pendingAmount = parseFloat(pendingAmountInput.value) || 0;
        
        if (pendingAmount > amount) {
            alert("Pending amount cannot be greater than total amount.");
            return;
        }

        const data = {
            name: donorNameInput.value.trim(),
            date: donationDateInput.value,
            category: "Special Function", // Defaulted category
            amount: amount,
            pendingAmount: pendingAmount,
            resetNumber: resetNumberInput.value.trim() || null,
            paymentMethod: document.querySelector('input[name="sf_payment_method"]:checked').value,
            transactionId: transactionIdInput.value.trim() || null,
            bankCheckNumber: bankCheckNumberInput.value.trim() || null,
            bankName: bankNameInput.value.trim() || null,
            functionId: parseInt(functionId)
        };

        const res = await api.addDonation(data);
        if (res.success) {
            addDonationForm.reset();
            // Set date back to the function's date if possible
            const selectedFunc = currentFunctions.find(f => f.id == functionId);
            if(selectedFunc) donationDateInput.value = selectedFunc.date;
            
            document.querySelector('input[name="sf_payment_method"][value="Offline"]').click();
            loadFunctionDetails(functionId);
            
            // Refresh dashboard or other tables globally
            if(window.refreshAllDonations) window.refreshAllDonations();
            if(window.refreshDashboard) window.refreshDashboard();
            if(window.refreshHistory) window.refreshHistory();
            if(window.refreshPending) window.refreshPending();
            
            window.showToast('Event Donation added successfully!', 'success');
        } else {
            alert('Error adding donation: ' + res.error);
        }
    });

    // Add Expense Modal Logic
    const sfExpenseModal = document.getElementById('sf-expense-modal');
    const closeSfExpenseModalBtn = document.getElementById('close-sf-expense-modal');
    const sfExpenseFormInner = document.getElementById('sf-expense-form-inner');
    const sfExpenseDateInput = document.getElementById('sf-expense-date');
    const sfExpenseTitleInput = document.getElementById('sf-expense-title');
    const sfExpenseAmountInput = document.getElementById('sf-expense-amount');
    const sfExpenseDescInput = document.getElementById('sf-expense-desc');
    
    // Payment method toggles for expense
    const sfExpClarkBalanceContainer = document.getElementById('sf-clark-cash-balance-container');
    const sfExpClarkAvailableEl = document.getElementById('sf-clark-cash-available-form');
    const sfExpOtherMethodGroup = document.getElementById('sf-expense-other-method-group');
    const sfExpOtherMethodInput = document.getElementById('sf-expense-other-method');
    const sfExpTransactionGroup = document.getElementById('sf-expense-transaction-group');
    const sfExpTransactionIdInput = document.getElementById('sf-expense-transaction-id');
    const sfExpBankCheckGroup = document.getElementById('sf-expense-bank-check-group');
    const sfExpBankCheckNumberInput = document.getElementById('sf-expense-bank-check-number');
    const sfExpBankNameInput = document.getElementById('sf-expense-bank-name');

    async function updateSfExpenseClarkCash() {
        try {
            const dashData = await api.getDashboardData();
            if (dashData.success) {
                sfExpClarkAvailableEl.textContent = `₹${(dashData.availableClarkCash || 0).toFixed(2)}`;
            }
        } catch (e) {}
    }

    document.getElementById('sf-add-expense-btn').addEventListener('click', async () => {
        const functionId = sfSelect.value;
        if (!functionId) return;
        sfExpenseFormInner.reset();
        
        // Default to function date
        const selectedFunc = currentFunctions.find(f => f.id == functionId);
        if (selectedFunc) sfExpenseDateInput.value = selectedFunc.date;
        else sfExpenseDateInput.value = new Date().toISOString().split('T')[0];
        
        // Reset sub-groups
        sfExpOtherMethodGroup.style.display = 'none';
        sfExpOtherMethodInput.removeAttribute('required');
        sfExpTransactionGroup.style.display = 'none';
        sfExpTransactionIdInput.removeAttribute('required');
        sfExpBankCheckGroup.style.display = 'none';
        sfExpBankCheckNumberInput.removeAttribute('required');
        sfExpBankNameInput.removeAttribute('required');
        sfExpClarkBalanceContainer.style.display = 'block';

        const clarkRadio = document.querySelector('input[name="sf_expense_payment_method"][value="Clark Cash"]');
        if (clarkRadio) clarkRadio.checked = true;

        await updateSfExpenseClarkCash();
        
        sfExpenseModal.style.display = 'block';
    });

    closeSfExpenseModalBtn.addEventListener('click', () => {
        sfExpenseModal.style.display = 'none';
    });

    // Payment method toggle logic
    document.querySelectorAll('input[name="sf_expense_payment_method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            sfExpTransactionGroup.style.display = (val === 'Online') ? 'block' : 'none';
            if(val === 'Online') sfExpTransactionIdInput.setAttribute('required', 'true');
            else sfExpTransactionIdInput.removeAttribute('required');

            sfExpBankCheckGroup.style.display = (val === 'Bank Check') ? 'block' : 'none';
            if(val === 'Bank Check') {
                sfExpBankCheckNumberInput.setAttribute('required', 'true');
                sfExpBankNameInput.setAttribute('required', 'true');
            } else {
                sfExpBankCheckNumberInput.removeAttribute('required');
                sfExpBankNameInput.removeAttribute('required');
            }

            sfExpOtherMethodGroup.style.display = (val === 'Other') ? 'block' : 'none';
            if(val === 'Other') sfExpOtherMethodInput.setAttribute('required', 'true');
            else sfExpOtherMethodInput.removeAttribute('required');

            sfExpClarkBalanceContainer.style.display = (val === 'Clark Cash') ? 'block' : 'none';
        });
    });

    sfExpenseFormInner.addEventListener('submit', async (e) => {
        e.preventDefault();
        const functionId = sfSelect.value;
        if (!functionId) return;
        
        const date = sfExpenseDateInput.value;
        const title = sfExpenseTitleInput.value.trim();
        const amount = parseFloat(sfExpenseAmountInput.value);
        const description = sfExpenseDescInput.value.trim();
        
        let paymentMethod = document.querySelector('input[name="sf_expense_payment_method"]:checked').value;
        if (paymentMethod === 'Other') {
            paymentMethod = sfExpOtherMethodInput.value.trim() || 'Other';
        }
        
        const transactionId = sfExpTransactionIdInput.value.trim();
        const bankCheckNumber = sfExpBankCheckNumberInput.value.trim();
        const bankName = sfExpBankNameInput.value.trim();
        
        if (!title || isNaN(amount) || amount <= 0) return;

        if (paymentMethod === 'Clark Cash') {
            const dashData = await api.getDashboardData();
            let available = dashData.availableClarkCash || 0;
            if (available <= 0) {
                window.showToast('Clark Cash balance is zero. Cannot add expense.', 'error');
                return;
            }
            if (amount > available) {
                window.showToast(`Insufficient Clark Cash balance (Available: ₹${available.toFixed(2)}).`, 'error');
                return;
            }
        }
        
        const data = {
            date: date,
            title: title,
            amount: amount,
            description: description,
            paymentMethod: paymentMethod,
            transactionId: transactionId || null,
            bankCheckNumber: bankCheckNumber || null,
            bankName: bankName || null,
            functionId: parseInt(functionId)
        };
        
        const res = await api.addExpense(data);
        if (res.success) {
            sfExpenseModal.style.display = 'none';
            loadFunctionDetails(functionId);
            if(window.refreshDashboard) window.refreshDashboard();
            if(window.refreshExpenses) window.refreshExpenses();
            window.showToast('Event Expense added successfully!', 'success');
        } else {
            alert('Error adding expense: ' + res.error);
        }
    });

    // Load functions on start
    window.refreshSpecialFunctions = loadFunctions;
    loadFunctions();
});
