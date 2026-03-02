// dashboard.js

let mainChart;

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

window.refreshDashboard = async () => {
    try {
        const data = await window.api.getDashboardData();
        
        if (data.success) {
            // Update summary cards
            document.getElementById('total-cash-in').innerText = formatCurrency(data.totalCashIn);
            document.getElementById('dashboard-total-pending').innerText = formatCurrency(data.totalPending);
            
            // Update total expense card
            const expenseEl = document.getElementById('total-expense');
            if (expenseEl) expenseEl.innerText = formatCurrency(data.totalExpense || 0);

            // Update Chart
            updateChart(data.dateWiseDonations);
        } else {
            console.error("Failed to load dashboard data", data.error);
        }
    } catch (e) {
        console.error("API error", e);
    }
};

function updateChart(donations) {
    const ctx = document.getElementById('mainChart').getContext('2d');

    // Extract unique dates and sort them
    const labels = donations.map(d => d.date).sort();

    // Map data to labels
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
                    backgroundColor: 'rgba(65, 105, 225, 0.8)', // Primary blue
                    borderColor: 'rgba(65, 105, 225, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value;
                        }
                    }
                }
            }
        }
    });
}

// Ensure it loads exactly when the chart script loads
document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    window.refreshDashboard();
});
