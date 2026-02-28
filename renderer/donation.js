// donation.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donation-form');
    const donorNameInput = document.getElementById('donor-name');
    const autocompleteList = document.getElementById('autocomplete-list');
    
    const categorySelect = document.getElementById('donation-category');
    const customCategoryInput = document.getElementById('custom-category');
    
    const paymentRadios = document.querySelectorAll('input[name="payment_method"]');
    const transactionGroup = document.getElementById('transaction-id-group');
    const transactionInput = document.getElementById('transaction-id');
    const amountInput = document.getElementById('donation-amount');
    const pendingAmountInput = document.getElementById('pending-amount');
    
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('donation-form-title');
    const idInput = document.getElementById('donation-id');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Autocomplete Logic
    let debounceTimer;
    donorNameInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            autocompleteList.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            const results = await window.api.searchDonors(query);
            autocompleteList.innerHTML = '';
            
            if (results && results.length > 0) {
                results.forEach(donor => {
                    const li = document.createElement('li');
                    li.textContent = donor.name;
                    li.addEventListener('click', () => {
                        donorNameInput.value = donor.name;
                        autocompleteList.innerHTML = '';
                    });
                    autocompleteList.appendChild(li);
                });
            }
        }, 300);
    });

    // Close autocomplete on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            autocompleteList.innerHTML = '';
        }
    });

    // Category Logic
    categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'Other') {
            customCategoryInput.style.display = 'block';
            customCategoryInput.setAttribute('required', 'true');
        } else {
            customCategoryInput.style.display = 'none';
            customCategoryInput.removeAttribute('required');
        }
    });

    // Payment Method Logic
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Online') {
                transactionGroup.style.display = 'block';
                transactionInput.setAttribute('required', 'true');
            } else {
                transactionGroup.style.display = 'none';
                transactionInput.removeAttribute('required');
                transactionInput.value = '';
            }
        });
    });

    amountInput.addEventListener('input', (e) => {
        const originalTotalStr = amountInput.dataset.originalTotal;
        if (originalTotalStr) {
            const originalTotal = parseFloat(originalTotalStr);
            const currentAmount = parseFloat(amountInput.value) || 0;
            const newPending = Math.max(0, originalTotal - currentAmount);
            pendingAmountInput.value = newPending.toFixed(2);
        }
    });

    // Form Submit Logic
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = idInput.value;
        const name = donorNameInput.value;
        const date = document.getElementById('donation-date').value;
        let category = categorySelect.value;
        if (category === 'Other') {
            category = customCategoryInput.value;
        }
        
        const amount = parseFloat(document.getElementById('donation-amount').value);
        const pendingAmount = parseFloat(document.getElementById('pending-amount').value || 0);
        
        const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;
        const transactionId = transactionInput.value;

        const data = { id, name, date, category, amount, pendingAmount, paymentMethod, transactionId };

        try {
            let result;
            if (id) {
                // Editing
                result = await window.api.updateDonation(data);
                if (result.success) {
                    window.showToast('Donation updated successfully!', 'success');
                    resetForm();
                    switchToPreviousSection(); // Return back to previous view 
                }
            } else {
                // Adding
                result = await window.api.addDonation(data);
                if (result.success) {
                    window.showToast('Donation added successfully!', 'success');
                    resetForm();
                }
            }

            if (!result.success) {
                window.showToast('Error: ' + result.error, 'error');
            }
            
            // Refresh dashboards if applicable
            if (window.refreshDashboard) window.refreshDashboard();
            if (window.refreshPending) window.refreshPending();
            if (window.refreshAllDonations) window.refreshAllDonations();
            if (window.refreshCurrentHistory) window.refreshCurrentHistory();
            
        } catch (err) {
            console.error(err);
            window.showToast('An error occurred while saving the donation.', 'error');
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        resetForm();
        switchToPreviousSection();
    });

    function resetForm() {
        form.reset();
        idInput.value = '';
        donorNameInput.removeAttribute('readonly');
        formTitle.textContent = 'Add Donation';
        submitBtn.textContent = 'Save Donation';
        cancelEditBtn.style.display = 'none';
        
        customCategoryInput.style.display = 'none';
        customCategoryInput.removeAttribute('required');
        
        transactionGroup.style.display = 'none';
        transactionInput.removeAttribute('required');
        
        pendingAmountInput.removeAttribute('readonly');
        amountInput.removeAttribute('data-original-total');
        
        autocompleteList.innerHTML = '';
        
        // Reset category explicitly
        categorySelect.value = "";
    }

    function switchToPreviousSection() {
        // Go back to wherever we came from before opening the edit form
        const prev = sessionStorage.getItem('sectionBeforeEdit') || 'all-donations-section';
        sessionStorage.removeItem('sectionBeforeEdit');
        const btn = document.querySelector(`.nav-btn[data-target="${prev}"]`);
        if (btn) btn.click();
    }

    // Expose edit function globally for history.js
    window.editDonation = (donationData, donorName) => {
        // Save the current section so we can return after editing
        const currentSection = sessionStorage.getItem('activeSection') || 'all-donations-section';
        sessionStorage.setItem('sectionBeforeEdit', currentSection);
        // Switch to add donation tab
        document.querySelector('.nav-btn[data-target="donation-section"]').click();

        
        // Populate form
        formTitle.textContent = 'Edit Donation';
        submitBtn.textContent = 'Update Donation';
        cancelEditBtn.style.display = 'inline-block';
        
        idInput.value = donationData.id;
        donorNameInput.value = donorName;
        donorNameInput.setAttribute('readonly', 'true'); // Prevents changing donor during edit per specs usually
        
        document.getElementById('donation-date').value = donationData.date;
        amountInput.value = donationData.amount;
        pendingAmountInput.value = donationData.pending_amount;
        pendingAmountInput.setAttribute('readonly', 'true'); // Do not allow manual clearing via edit

        const originalTotal = (parseFloat(donationData.amount) || 0) + (parseFloat(donationData.pending_amount) || 0);
        amountInput.dataset.originalTotal = originalTotal;

        // Category
        if (donationData.category === 'Pratham Abhishek' || donationData.category === 'Shanti Dhara') {
            categorySelect.value = donationData.category;
            customCategoryInput.style.display = 'none';
        } else {
            categorySelect.value = 'Other';
            customCategoryInput.style.display = 'block';
            customCategoryInput.value = donationData.category;
        }

        // Payment Method
        if (donationData.payment_method === 'Online') {
            document.querySelector('input[name="payment_method"][value="Online"]').checked = true;
            transactionGroup.style.display = 'block';
            transactionInput.value = donationData.transaction_id || '';
            transactionInput.setAttribute('required', 'true');
        } else {
            document.querySelector('input[name="payment_method"][value="Offline"]').checked = true;
            transactionGroup.style.display = 'none';
            transactionInput.value = '';
            transactionInput.removeAttribute('required');
        }
    };
    
    // Feature 13: Add enter key feature to all buttons globally
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const activeElem = document.activeElement;
            // If the active element is a button, or has role='button', trigger click.
            // (Natively buttons do this, but just to ensure all styled components act this way)
            if (activeElem && (activeElem.tagName === 'BUTTON' || activeElem.classList.contains('btn-primary') || activeElem.classList.contains('btn-secondary') || activeElem.classList.contains('nav-btn'))) {
                // Prevent default form submit if it's not a submit button to avoid double firing
                if (activeElem.type !== 'submit') {
                    e.preventDefault();
                    activeElem.click();
                }
            }
        }
    });
});
