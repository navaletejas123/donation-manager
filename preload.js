const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    searchDonors: (query) => ipcRenderer.invoke('search-donors', query),
    addDonation: (data) => ipcRenderer.invoke('add-donation', data),
    updateDonation: (data) => ipcRenderer.invoke('update-donation', data),
    getDonorHistory: (name) => ipcRenderer.invoke('get-donor-history', name),
    getDashboardData: () => ipcRenderer.invoke('get-dashboard-data'),
    addExpense: (data) => ipcRenderer.invoke('add-expense', data),
    getAllExpenses: () => ipcRenderer.invoke('get-all-expenses'),
    updateExpense: (data) => ipcRenderer.invoke('update-expense', data),
    getPending: () => ipcRenderer.invoke('get-pending'),
    getAllDonations: () => ipcRenderer.invoke('get-all-donations'),
    payPendingDonation: (data) => ipcRenderer.invoke('pay-pending-donation', data),
    payPendingDonor: (data) => ipcRenderer.invoke('pay-pending-donor', data),
    getPendingPayments: (donationId) => ipcRenderer.invoke('get-pending-payments', donationId),
    deleteDonation: (id) => ipcRenderer.invoke('delete-donation', id)
});
