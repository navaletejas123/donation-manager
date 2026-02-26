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
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        // Use the existing autocomplete list from donation.js if possible, or create a simple one here.
        // For simplicity in this demo, the user can just type the exact name or part of it, and we fetch exact match on "View History".
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

                // Populate table
                data.donations.forEach(d => {
                    const tr = document.createElement('tr');
                    
                    const isPending = d.pending_amount > 0;
                    
                    tr.innerHTML = `
                        <td>${d.date}</td>
                        <td>${d.category}</td>
                        <td>${formatHistoryCurrency(d.amount)}</td>
                        <td>${d.payment_method} ${d.transaction_id ? '('+d.transaction_id+')' : ''}</td>
                        <td class="${isPending ? 'text-danger' : 'text-success'}">
                            ${formatHistoryCurrency(d.pending_amount)}
                        </td>
                        <td>
                            ${isPending ? `<input type="date" class="clear-date-input" title="Clear Date">` : '-'}
                        </td>
                        <td>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">Edit</button>
                            ${isPending ? `<button class="btn-primary clear-pending-btn" style="padding: 5px 10px; font-size: 13px;">Clear</button>` : ''}
                        </td>
                    `;

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
                                 alert("Please select a date to clear pending amount.");
                                 return;
                             }
                             
                             if (confirm(`Are you sure you want to clear ${formatHistoryCurrency(d.pending_amount)} pending amount on ${dateInput}?`)) {
                                 const res = await window.api.completePendingDonation(d.id, dateInput);
                                 if (res.success) {
                                     alert("Pending amount cleared successfully!");
                                     searchBtn.click(); // Refresh this history view
                                     refreshAllDataView();
                                 } else {
                                     alert("Failed to clear pending amount: " + res.error);
                                 }
                             }
                        });
                    }

                    historyTableBody.appendChild(tr);
                });
            } else {
                historySummary.style.display = 'none';
                historyTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No history found for donor: ${name}</td></tr>`;
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
                data.pendingList.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.name}</td>
                        <td style="color: #d9534f; font-weight: bold;">${formatHistoryCurrency(item.total_pending)}</td>
                        <td>
                            <input type="date" class="donor-clear-date-input" title="Clear Date">
                        </td>
                        <td>
                             <button class="btn-primary clear-donor-btn" style="padding: 5px 10px; font-size: 13px;">Clear Total Pending</button>
                        </td>
                    `;
                    
                    // Add clear pending for donor
                    tr.querySelector('.clear-donor-btn').addEventListener('click', async () => {
                         const dateInput = tr.querySelector('.donor-clear-date-input').value;
                         if (!dateInput) {
                             alert("Please select a date to clear this donor's pending amount.");
                             return;
                         }
                         
                         if (confirm(`Are you sure you want to clear the entire ${formatHistoryCurrency(item.total_pending)} pending amount for ${item.name} on ${dateInput}?`)) {
                             const res = await window.api.completePendingDonor(item.name, dateInput);
                             if (res.success) {
                                 alert(`All pending amounts for ${item.name} cleared successfully!`);
                                 window.refreshPending();
                                 refreshAllDataView();
                             } else {
                                 alert("Failed to clear pending amounts: " + res.error);
                             }
                         }
                    });

                    pendingTableBody.appendChild(tr);
                });
            } else {
                pendingTableBody.innerHTML = `<tr><td colspan="2" class="text-center">No pending amounts found.</td></tr>`;
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
