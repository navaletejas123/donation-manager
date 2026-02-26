// all_donations.js

const formatAllCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

document.addEventListener('DOMContentLoaded', () => {
    const allDonationsTableBody = document.querySelector('#all-donations-table tbody');

    window.refreshAllDonations = async () => {
        try {
            const data = await window.api.getAllDonations();
            allDonationsTableBody.innerHTML = '';

            if (data.success && data.donations.length > 0) {
                data.donations.forEach(d => {
                    const tr = document.createElement('tr');
                    
                    tr.innerHTML = `
                        <td>${d.date}</td>
                        <td>${d.donor_name}</td>
                        <td>${d.category}</td>
                        <td>${formatAllCurrency(d.amount)}</td>
                        <td>${d.payment_method} ${d.transaction_id ? '('+d.transaction_id+')' : ''}</td>
                        <td class="${d.pending_amount > 0 ? 'text-danger' : 'text-success'}">
                            ${formatAllCurrency(d.pending_amount)}
                        </td>
                        <td>${d.cleared_date ? d.cleared_date : '-'}</td>
                        <td>
                            <button class="btn-secondary edit-btn" style="padding: 5px 10px; font-size: 13px;">Edit</button>
                        </td>
                    `;

                    // Add edit listener
                    tr.querySelector('.edit-btn').addEventListener('click', () => {
                        if (window.editDonation) {
                            window.editDonation(d, d.donor_name);
                        }
                    });

                    allDonationsTableBody.appendChild(tr);
                });
            } else {
                allDonationsTableBody.innerHTML = `<tr><td colspan="8" class="text-center">No donations found.</td></tr>`;
            }
        } catch (err) {
            console.error(err);
        }
    };
});
