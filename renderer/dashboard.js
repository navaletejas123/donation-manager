// dashboard.js

let mainChart;
let pieChart;

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

let currentClarkBalance = 0;

window.refreshDashboard = async () => {
    try {
        const data = await window.api.getDashboardData();
        
        if (data.success) {
            currentClarkBalance = data.availableClarkCash || 0;

            // Update summary cards
            const totalDonationsEl = document.getElementById('total-cash-in');
            if (totalDonationsEl) totalDonationsEl.innerText = formatCurrency(data.totalCashIn || 0);

            const totalPendingEl = document.getElementById('dashboard-total-pending');
            if (totalPendingEl) totalPendingEl.innerText = formatCurrency(data.totalPending || 0);
            
            // Update total expense card
            const expenseEl = document.getElementById('total-expense');
            if (expenseEl) expenseEl.innerText = formatCurrency(data.totalExpense || 0);

            // Update Total Cash and Total Online cards
            const cashEl = document.getElementById('total-cash');
            if (cashEl) cashEl.innerText = formatCurrency(data.totalCash || 0);

            const onlineEl = document.getElementById('total-online');
            if (onlineEl) onlineEl.innerText = formatCurrency(data.totalOnline || 0);

            const clarkEl = document.getElementById('clark-cash');
            if (clarkEl) clarkEl.innerText = formatCurrency(currentClarkBalance);

            // Update Charts
            updateBarChart(data.dateWiseDonations);
            updatePieChart(data.categoryWiseDonations || []);
        } else {
            console.error("Failed to load dashboard data", data.error);
        }
    } catch (e) {
        console.error("API error", e);
    }
};

function updateBarChart(donations) {
    const ctx = document.getElementById('mainChart').getContext('2d');

    const labels = donations.map(d => d.date).sort();
    const donationData = labels.map(label => {
        const item = donations.find(d => d.date === label);
        return item ? item.total : 0;
    });

    if (mainChart) {
        mainChart.destroy();
    }

    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Donations Received',
                    data: donationData,
                    backgroundColor: 'rgba(65, 105, 225, 0.75)',
                    borderColor: 'rgba(65, 105, 225, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ' ₹' + ctx.raw.toLocaleString('en-IN')
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                }
            }
        }
    });
}

function updatePieChart(categories) {
    const ctx = document.getElementById('pieChart').getContext('2d');

    if (pieChart) {
        pieChart.destroy();
    }

    if (!categories || categories.length === 0) {
        categories = [{ category: 'No Data', total: 1 }];
    }

    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.total);

    const palette = [
        '#4169E1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
        '#14b8a6', '#e11d48', '#d97706', '#7c3aed', '#0284c7'
    ];

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: palette.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        font: { size: 12 },
                        boxWidth: 14
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw;
                            return ` ${ctx.label}: ₹${val.toLocaleString('en-IN')}`;
                        }
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    window.refreshDashboard();

    // Bank Submission Modal Logic
    const clarkCard = document.getElementById('clark-cash-card');
    const bankModal = document.getElementById('bank-submission-modal');
    const bankModalAmount = document.getElementById('bank-modal-amount');
    const closeBankModal = document.getElementById('close-bank-modal');
    const cancelBankBtn = document.getElementById('cancel-bank-btn');
    const confirmBankBtn = document.getElementById('confirm-bank-btn');

    if (clarkCard) {
        clarkCard.addEventListener('click', () => {
            if (currentClarkBalance <= 0) {
                window.showToast('Clark Cash balance is zero.', 'info');
                return;
            }
            const passwordInput = document.getElementById('bank-password-input');
            const passwordError = document.getElementById('bank-password-error');
            if (passwordInput) passwordInput.value = '';
            if (passwordError) passwordError.style.display = 'none';
            
            bankModalAmount.innerText = formatCurrency(currentClarkBalance);
            bankModal.style.display = 'block';
            setTimeout(() => passwordInput && passwordInput.focus(), 100);
        });
    }

    const hideBankModal = () => { bankModal.style.display = 'none'; };
    if (closeBankModal) closeBankModal.onclick = hideBankModal;
    if (cancelBankBtn) cancelBankBtn.onclick = hideBankModal;
    window.addEventListener('click', (e) => { if (e.target === bankModal) hideBankModal(); });

    if (confirmBankBtn) {
        confirmBankBtn.onclick = async () => {
            const passwordInput = document.getElementById('bank-password-input');
            const passwordError = document.getElementById('bank-password-error');
            
            if (passwordInput.value !== '9097') {
                passwordError.style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
                return;
            }
            
            passwordError.style.display = 'none';
            
            try {
                confirmBankBtn.disabled = true;
                confirmBankBtn.innerText = 'Processing...';
                
                const res = await window.api.addBankSubmission(currentClarkBalance);
                if (res.success) {
                    window.showToast('Cash submitted to bank successfully!', 'success');
                    passwordInput.value = '';
                    hideBankModal();
                    await window.refreshDashboard();
                } else {
                    window.showToast('Error: ' + res.error, 'error');
                }
            } catch (err) {
                console.error('Bank submission failed', err);
                window.showToast('System Error: Could not connect to backend.', 'error');
            } finally {
                confirmBankBtn.disabled = false;
                confirmBankBtn.innerText = 'Confirm Deposit';
            }
        };
    }
});
