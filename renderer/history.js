// history.js

const formatHistoryCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

document.addEventListener('DOMContentLoaded', () => {
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
                            ${isPending ? `<input type="date" class="clear-date-input" title="Clear Date">` : (d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : '-')}
                        </td>
                        <td>
                            <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">View</button>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">Edit</button>
                            ${isPending ? `<button class="btn-primary clear-pending-btn" style="padding: 5px 10px; font-size: 13px;">Clear</button>` : ''}
                        </td>
                    `;

                    // View listener
                    tr.querySelector('.view-btn').addEventListener('click', () => {
                        const html = `
                            <p><strong>Donor:</strong> ${name}</p>
                            <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(d.date)}</p>
                            <p><strong>Category:</strong> ${d.category}</p>
                            <p><strong>Amount:</strong> ${formatHistoryCurrency(d.amount)}</p>
                            <p><strong>Payment Method:</strong> ${d.payment_method} ${d.transaction_id ? `(${d.transaction_id})` : ''}</p>
                            <p><strong>Pending Amount:</strong> ${formatHistoryCurrency(d.pending_amount)}</p>
                            <p><strong>Cleared Date:</strong> ${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : 'N/A'}</p>
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
                             const dateInput = tr.querySelector('.clear-date-input').value;
                             if (!dateInput) {
                                 window.showToast("Please select a date to clear pending amount.", "error");
                                 return;
                             }
                             
                             if (confirm(`Are you sure you want to clear ${formatHistoryCurrency(d.pending_amount)} pending amount on ${dateInput}?`)) {
                                 const res = await window.api.completePendingDonation(d.id, dateInput);
                                 if (res.success) {
                                     window.showToast("Pending amount cleared successfully!", "success");
                                     searchBtn.click(); // Refresh this history view
                                     refreshAllDataView();
                                 } else {
                                     window.showToast("Failed to clear pending amount: " + res.error, "error");
                                 }
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
                        <td>
                            <input type="date" class="donor-clear-date-input" title="Clear Date">
                        </td>
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
                         const dateInput = tr.querySelector('.donor-clear-date-input').value;
                         if (!dateInput) {
                             window.showToast("Please select a date to clear this donor's pending amount.", "error");
                             return;
                         }
                         
                         if (confirm(`Are you sure you want to clear the entire ${formatHistoryCurrency(item.total_pending)} pending amount for ${item.name} on ${dateInput}?`)) {
                             const res = await window.api.completePendingDonor(item.name, dateInput);
                             if (res.success) {
                                 window.showToast(`All pending amounts for ${item.name} cleared successfully!`, "success");
                                 window.refreshPending();
                                 refreshAllDataView();
                             } else {
                                 window.showToast("Failed to clear pending amounts: " + res.error, "error");
                             }
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

    // Global refresh helper to re-sync everything when payments are cleared
    function refreshAllDataView() {
        if (window.refreshDashboard) window.refreshDashboard();
        if (window.refreshAllDonations) window.refreshAllDonations();
        window.refreshPending();
    }
});
