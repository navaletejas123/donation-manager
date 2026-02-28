const formatHistoryCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

// ---- Pay-Pending Modal setup ----
function setupPayPendingModal() {
    const modal = document.getElementById('pay-pending-modal');
    const closeBtn = document.getElementById('close-pay-pending-modal');
    const form = document.getElementById('pay-pending-form');
    const txGroup = document.getElementById('pay-pending-transaction-group');
    const txInput = document.getElementById('pay-pending-transaction-id');

    // Payment method toggle
    const paymentRadios = form.querySelectorAll('input[name="pay_pending_payment_method"]');
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'Online') {
                txGroup.style.display = 'block';
                txInput.setAttribute('required', 'true');
            } else {
                txGroup.style.display = 'none';
                txInput.removeAttribute('required');
                txInput.value = '';
            }
        });
    });

    // Close modal on X click or outside click
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

/**
 * Opens the pay-pending modal and resolves with the submitted data.
 * @param {string} title - Modal title
 * @param {number} maxAmount - Maximum allowed payment
 * @returns {Promise<{amountPaid, date, paymentMethod, transactionId}|null>}
 */
function openPayPendingModal(title, maxAmount) {
    return new Promise((resolve) => {
        const modal = document.getElementById('pay-pending-modal');
        const titleEl = document.getElementById('pay-pending-modal-title');

        // Show title and open modal first
        titleEl.textContent = title;
        modal.style.display = 'block';

        // --- Clone form to remove any stale listeners ---
        const oldForm = document.getElementById('pay-pending-form');
        const newForm = oldForm.cloneNode(true);
        oldForm.parentNode.replaceChild(newForm, oldForm);

        // Now grab references from the LIVE new form
        const amountInput  = document.getElementById('pay-pending-amount');
        const dateInput    = document.getElementById('pay-pending-date');
        const hintEl       = document.getElementById('pay-pending-max-hint');
        const txGroup      = document.getElementById('pay-pending-transaction-group');
        const txInput      = document.getElementById('pay-pending-transaction-id');

        // Reset & pre-fill
        newForm.reset();
        txGroup.style.display = 'none';
        txInput.removeAttribute('required');
        txInput.value = '';
        amountInput.max  = maxAmount;
        amountInput.value = '';
        dateInput.value  = '';
        hintEl.textContent = `Max: ${formatHistoryCurrency(maxAmount)}`;

        // Payment method toggle
        newForm.querySelectorAll('input[name="pay_pending_payment_method"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'Online') {
                    txGroup.style.display = 'block';
                    txInput.setAttribute('required', 'true');
                } else {
                    txGroup.style.display = 'none';
                    txInput.removeAttribute('required');
                    txInput.value = '';
                }
            });
        });

        // Submit handler — all reads from live in-DOM elements
        const onSubmit = (e) => {
            e.preventDefault();
            const amountPaid = parseFloat(amountInput.value);
            if (!amountPaid || amountPaid <= 0 || amountPaid > maxAmount) {
                window.showToast(`Amount must be between ₹1 and ${formatHistoryCurrency(maxAmount)}.`, 'error');
                return;
            }
            const paymentMethod = newForm.querySelector('input[name="pay_pending_payment_method"]:checked').value;
            const transactionId = txInput.value.trim();
            if (paymentMethod === 'Online' && !transactionId) {
                window.showToast('Please enter a Transaction ID for online payments.', 'error');
                return;
            }
            const date = dateInput.value;
            if (!date) {
                window.showToast('Please select a date.', 'error');
                return;
            }
            newForm.removeEventListener('submit', onSubmit);
            modal.style.display = 'none';
            resolve({ amountPaid, date, paymentMethod, transactionId: transactionId || null });
        };
        newForm.addEventListener('submit', onSubmit);

        // Close button
        const closeBtn = document.getElementById('close-pay-pending-modal');
        closeBtn.onclick = () => {
            newForm.removeEventListener('submit', onSubmit);
            modal.style.display = 'none';
            resolve(null);
        };
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupPayPendingModal();

    const searchBtn = document.getElementById('view-history-btn');
    const searchInput = document.getElementById('history-search-name');
    const historyTableBody = document.querySelector('#history-table tbody');
    const historySummary = document.getElementById('history-summary');
    
    // Autocomplete for History Search
    let debounceTimer;
    const autocompleteList = document.getElementById('history-autocomplete-list');
    if (!autocompleteList) {
        // Insert if missing
        const list = document.createElement('ul');
        list.id = 'history-autocomplete-list';
        list.className = 'autocomplete-items';
        searchInput.parentElement.appendChild(list);
    }
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        const autolist = document.getElementById('history-autocomplete-list');
        
        if (query.length < 2) {
            autolist.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            const results = await window.api.searchDonors(query);
            autolist.innerHTML = '';
            
            if (results && results.length > 0) {
                results.forEach(donor => {
                    const li = document.createElement('li');
                    li.textContent = donor.name;
                    li.addEventListener('click', () => {
                        searchInput.value = donor.name;
                        autolist.innerHTML = '';
                        searchBtn.click(); // Auto-trigger search when selecting from autocomplete
                    });
                    autolist.appendChild(li);
                });
            }
        }, 300);
    });
    
    // Close autocomplete on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-bar')) {
            const autolist = document.getElementById('history-autocomplete-list');
            if(autolist) autolist.innerHTML = '';
        }
    });

    searchBtn.addEventListener('click', async () => {
        const name = searchInput.value.trim();
        if (!name) {
            alert('Please enter a donor name.');
            return;
        }

        try {
            const data = await window.api.getDonorHistory(name);
            
            historyTableBody.innerHTML = '';

            if (data.success && data.donations.length > 0) {
                // Show summary
                historySummary.style.display = 'flex';
                document.getElementById('summary-donor-name').textContent = name;
                document.getElementById('summary-total-paid').textContent = formatHistoryCurrency(data.totalPaid);
                document.getElementById('summary-total-pending').textContent = formatHistoryCurrency(data.totalPending);

                const renderRow = (tbody, d, index) => {
                    const tr = document.createElement('tr');
                    
                    const isPending = d.pending_amount > 0;
                    
                    tr.innerHTML = `
                        <td>${index}</td>
                        <td>${window.formatDateDDMMYYYY(d.date)}</td>
                        <td>${d.category}</td>
                        <td>${formatHistoryCurrency(d.amount)}</td>
                        <td>${d.payment_method} ${d.transaction_id ? '('+d.transaction_id+')' : ''}</td>
                        <td>
                            ${isPending ? `<span class="badge-pending">${formatHistoryCurrency(d.pending_amount)}</span>` : formatHistoryCurrency(d.pending_amount)}
                        </td>
                        <td>
                            ${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : '-'}
                        </td>
                        <td>
                            <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">View</button>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">Edit</button>
                            ${isPending ? `<button class="btn-primary clear-pending-btn" style="padding: 5px 10px; font-size: 13px;">Clear</button>` : ''}
                        </td>
                    `;

                    // View listener
                    tr.querySelector('.view-btn').addEventListener('click', async () => {
                        const pymtData = await window.api.getPendingPayments(d.id);
                        let paymentHistoryHtml = '';
                        if (pymtData.success && pymtData.payments.length > 0) {
                            const rows = pymtData.payments.map((p, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${window.formatDateDDMMYYYY(p.date)}</td>
                                    <td>${formatHistoryCurrency(p.amount_paid)}</td>
                                    <td>${p.payment_method}${p.transaction_id ? ' (' + p.transaction_id + ')' : ''}</td>
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
                            <p><strong>Donor:</strong> ${name}</p>
                            <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(d.date)}</p>
                            <p><strong>Category:</strong> ${d.category}</p>
                            <p><strong>Amount:</strong> ${formatHistoryCurrency(d.amount)}</p>
                            <p><strong>Payment Method:</strong> ${d.payment_method} ${d.transaction_id ? `(${d.transaction_id})` : ''}</p>
                            <p><strong>Pending Amount:</strong> ${formatHistoryCurrency(d.pending_amount)}</p>
                            <p><strong>Last Cleared Date:</strong> ${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : 'N/A'}</p>
                            ${paymentHistoryHtml}
                        `;
                        window.showViewModal('Donation Details', html);
                    });


                    // Add edit listener
                    tr.querySelector('.edit-btn').addEventListener('click', () => {
                        if (window.editDonation) {
                            window.editDonation(d, name);
                        }
                    });

                    // Add clear pending listener
                    if (isPending) {
                        tr.querySelector('.clear-pending-btn').addEventListener('click', async () => {
                            const result = await openPayPendingModal(
                                `Clear Pending (${d.category})`, d.pending_amount
                            );
                            if (!result) return;

                            const res = await window.api.payPendingDonation({ id: d.id, ...result });
                            if (res.success) {
                                window.showToast('Pending amount cleared successfully!', 'success');
                                searchBtn.click(); // Refresh this history view
                                refreshAllDataView();
                            } else {
                                window.showToast('Failed to clear pending amount: ' + res.error, 'error');
                            }
                        });
                    }

                    tbody.appendChild(tr);
                };

                window.setupPaginationAndSearch('history-table', data.donations, renderRow);
                
            } else {
                historySummary.style.display = 'none';
                // Find table body to clear
                const searchWrapper = document.querySelector('#history-table').parentElement;
                
                // Need to bypass setupPagination wrapper if it exists, safest way is replace inner html
                historyTableBody.innerHTML = `<tr><td colspan="8" class="text-center">No history found for donor: ${name}</td></tr>`;
            }
        } catch (err) {
            console.error(err);
            alert('Error fetching history.');
        }
    });

    // Pending Section Global Refresh
    window.refreshPending = async () => {
        try {
            const data = await window.api.getPending();
            const pendingTableBody = document.querySelector('#pending-table tbody');
            pendingTableBody.innerHTML = '';

            if (data.success && data.pendingList.length > 0) {
                
                // Gather overall total
                let overallTotal = 0;
                data.pendingList.forEach(item => {
                     overallTotal += item.total_pending;
                });
                const sectionTotalElem = document.getElementById('pending-section-total');
                if (sectionTotalElem) sectionTotalElem.textContent = formatHistoryCurrency(overallTotal);

                const renderRow = (tbody, item, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${index}</td>
                        <td>${item.name}</td>
                        <td><span class="badge-pending">${formatHistoryCurrency(item.total_pending)}</span></td>
                        <td>—</td>
                        <td>
                             <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">View</button>
                             <button class="btn-primary clear-donor-btn" style="padding: 5px 10px; font-size: 13px;">Clear Total Pending</button>
                        </td>
                    `;
                    
                    // View listener
                    tr.querySelector('.view-btn').addEventListener('click', () => {
                        const html = `
                            <p><strong>Donor:</strong> ${item.name}</p>
                            <p><strong>Total Pending:</strong> ${formatHistoryCurrency(item.total_pending)}</p>
                            <p>Navigate to "Donor History" and search this name for individual record details.</p>
                        `;
                        window.showViewModal('Pending Summary', html);
                    });
                    
                    // Add clear pending for donor
                    tr.querySelector('.clear-donor-btn').addEventListener('click', async () => {
                        const result = await openPayPendingModal(
                            `Clear Pending for ${item.name}`, item.total_pending
                        );
                        if (!result) return;

                        const res = await window.api.payPendingDonor({ donorName: item.name, ...result });
                        if (res.success) {
                            window.showToast(`Pending amount for ${item.name} cleared successfully!`, 'success');
                            window.refreshPending();
                            refreshAllDataView();
                        } else {
                            window.showToast('Failed to clear pending amounts: ' + res.error, 'error');
                        }
                    });

                    tbody.appendChild(tr);
                };

                window.setupPaginationAndSearch('pending-table', data.pendingList, renderRow);

            } else {
                const sectionTotalElem = document.getElementById('pending-section-total');
                if (sectionTotalElem) sectionTotalElem.textContent = formatHistoryCurrency(0);
                
                pendingTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No pending amounts found.</td></tr>`;
            }
        } catch (err) {
            console.error("Error refreshing pending list", err);
        }
    };

    // Load Pending on start
    window.refreshPending();

    // Expose refresh so donation.js can call it after edit
    window.refreshCurrentHistory = () => {
        const name = searchInput.value.trim();
        if (name) searchBtn.click();
    };

    // Global refresh helper to re-sync everything when payments are cleared
    function refreshAllDataView() {
        if (window.refreshDashboard) window.refreshDashboard();
        if (window.refreshAllDonations) window.refreshAllDonations();
        window.refreshPending();
    }
});
