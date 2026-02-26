// app.js

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Add active class to clicked button and target section
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // Trigger specific refreshes based on section
            if (targetId === 'dashboard-section' && window.refreshDashboard) {
                window.refreshDashboard();
            } else if (targetId === 'history-section' && window.refreshHistory) {
                // Not strictly needed on switch, but good if we want to retain state or clear
            } else if (targetId === 'all-donations-section' && window.refreshAllDonations) {
                window.refreshAllDonations();
                window.refreshPending();
            }
        });
    });

    // Initialize application data
    if (window.refreshDashboard) window.refreshDashboard();
});
