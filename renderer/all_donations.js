// all_donations.js

const formatAllCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

const DELETE_PASSWORD = '9097';

/**
 * Opens delete password modal, resolves true if correct password entered, null if cancelled.
 */
function openDeletePasswordModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('delete-password-modal');
        const form = document.getElementById('delete-password-form');
        const input = document.getElementById('delete-password-input');
        const errorEl = document.getElementById('delete-password-error');
        const closeBtn = document.getElementById('close-delete-modal');

        // Reset state
        input.value = '';
        errorEl.style.display = 'none';
        modal.style.display = 'block';
        setTimeout(() => input.focus(), 100);

        const onSubmit = (e) => {
            e.preventDefault();
            if (input.value === DELETE_PASSWORD) {
                form.removeEventListener('submit', onSubmit);
                modal.style.display = 'none';
                resolve(true);
            } else {
                errorEl.style.display = 'block';
                input.value = '';
                input.focus();
            }
        };

        // Clone to remove any stale listeners
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        const newInput = document.getElementById('delete-password-input');
        const newErrorEl = document.getElementById('delete-password-error');
        newErrorEl.style.display = 'none';
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (newInput.value === DELETE_PASSWORD) {
                modal.style.display = 'none';
                resolve(true);
            } else {
                newErrorEl.style.display = 'block';
                newInput.value = '';
                newInput.focus();
            }
        });

        closeBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(null);
        };

        window.addEventListener('click', function onOutside(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                window.removeEventListener('click', onOutside);
                resolve(null);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {

    window.refreshAllDonations = async () => {
        try {
            const data = await window.api.getAllDonations();
            
            if (data.success) {
                let totalPaid = 0;
                let totalPending = 0;
                
                data.donations.forEach(d => {
                    totalPaid += d.amount;
                    totalPending += d.pending_amount;
                });
                
                document.getElementById('all-donations-total-paid').textContent = formatAllCurrency(totalPaid);
                document.getElementById('all-donations-total-pending').textContent = formatAllCurrency(totalPending);

                const renderRow = (tbody, d, index) => {
                    const tr = document.createElement('tr');
                    const hasPending = d.pending_amount > 0;
                    
                    tr.innerHTML = `
                        <td>${index}</td>
                        <td>${window.formatDateDDMMYYYY(d.date)}</td>
                        <td>${d.donor_name}</td>
                        <td>${d.category}</td>
                        <td>${formatAllCurrency(d.amount)}</td>
                        <td>${d.payment_method} ${d.transaction_id ? '('+d.transaction_id+')' : ''}</td>
                        <td>
                            ${hasPending ? `<span class="badge-pending">${formatAllCurrency(d.pending_amount)}</span>` : formatAllCurrency(d.pending_amount)}
                        </td>
                        <td>${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : '-'}</td>
                        <td>
                            <button class="btn-primary view-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">View</button>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px; margin-right: 5px;">Edit</button>
                            <button class="btn-danger delete-btn" style="padding: 5px 10px; font-size: 13px; background: #e53e3e; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Delete</button>
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
                                    <td>${formatAllCurrency(p.amount_paid)}</td>
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
                            <p><strong>Donor:</strong> ${d.donor_name}</p>
                            <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(d.date)}</p>
                            <p><strong>Category:</strong> ${d.category}</p>
                            <p><strong>Amount:</strong> ${formatAllCurrency(d.amount)}</p>
                            <p><strong>Payment Method:</strong> ${d.payment_method} ${d.transaction_id ? `(${d.transaction_id})` : ''}</p>
                            <p><strong>Pending Amount:</strong> ${formatAllCurrency(d.pending_amount)}</p>
                            <p><strong>Last Cleared Date:</strong> ${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : 'N/A'}</p>
                            ${paymentHistoryHtml}
                        `;
                        window.showViewModal('Donation Details', html);
                    });

                    // Edit listener
                    tr.querySelector('.edit-btn').addEventListener('click', () => {
                        if (window.editDonation) {
                            window.editDonation(d, d.donor_name);
                        }
                    });

                    // Delete listener
                    tr.querySelector('.delete-btn').addEventListener('click', async () => {
                        const confirmed = await openDeletePasswordModal();
                        if (!confirmed) return;

                        const res = await window.api.deleteDonation(d.id);
                        if (res.success) {
                            window.showToast('Donation deleted successfully!', 'success');
                            if (window.refreshAllDonations) window.refreshAllDonations();
                            if (window.refreshDashboard) window.refreshDashboard();
                            if (window.refreshPending) window.refreshPending();
                        } else {
                            window.showToast('Error deleting donation: ' + res.error, 'error');
                        }
                    });

                    tbody.appendChild(tr);
                };

                window.setupPaginationAndSearch('all-donations-table', data.donations, renderRow);
            } else {
                console.error('Failed to get all donations');
            }
        } catch (err) {
            console.error(err);
        }
    };
});
