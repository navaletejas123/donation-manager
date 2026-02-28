// all_donations.js

const formatAllCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

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
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px;">Edit</button>
                        </td>
                    `;

                    // View listener
                    tr.querySelector('.view-btn').addEventListener('click', () => {
                        const html = `
                            <p><strong>Donor:</strong> ${d.donor_name}</p>
                            <p><strong>Date:</strong> ${window.formatDateDDMMYYYY(d.date)}</p>
                            <p><strong>Category:</strong> ${d.category}</p>
                            <p><strong>Amount:</strong> ${formatAllCurrency(d.amount)}</p>
                            <p><strong>Payment Method:</strong> ${d.payment_method} ${d.transaction_id ? `(${d.transaction_id})` : ''}</p>
                            <p><strong>Pending Amount:</strong> ${formatAllCurrency(d.pending_amount)}</p>
                            <p><strong>Cleared Date:</strong> ${d.cleared_date ? window.formatDateDDMMYYYY(d.cleared_date) : 'N/A'}</p>
                        `;
                        window.showViewModal('Donation Details', html);
                    });

                    // Edit listener
                    tr.querySelector('.edit-btn').addEventListener('click', () => {
                        if (window.editDonation) {
                            window.editDonation(d, d.donor_name);
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
