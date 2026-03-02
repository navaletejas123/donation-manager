const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    searchDonors: (query) => ipcRenderer.invoke('search-donors', query),
    addDonation: (data) => ipcRenderer.invoke('add-donation', data),
    updateDonation: (data) => ipcRenderer.invoke('update-donation', data),
    getDonorHistory: (name) => ipcRenderer.invoke('get-donor-history', name),
    getDashboardData: () => ipcRenderer.invoke('get-dashboard-data'),
    addExpense: (data) => ipcRenderer.invoke('add-expense', data),
    getAllExpenses: () => ipcRenderer.invoke('get-all-expenses'),
    getPaginatedExpenses: (params) => ipcRenderer.invoke('get-paginated-expenses', params),
    updateExpense: (data) => ipcRenderer.invoke('update-expense', data),
    getPending: () => ipcRenderer.invoke('get-pending'),
    getAllDonations: () => ipcRenderer.invoke('get-all-donations'),
    getPaginatedDonations: (params) => ipcRenderer.invoke('get-paginated-donations', params),
    payPendingDonation: (data) => ipcRenderer.invoke('pay-pending-donation', data),
    payPendingDonor: (data) => ipcRenderer.invoke('pay-pending-donor', data),
    getPendingPayments: (donationId) => ipcRenderer.invoke('get-pending-payments', donationId),
    deleteDonation: (id) => ipcRenderer.invoke('delete-donation', id),

     windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),
});




