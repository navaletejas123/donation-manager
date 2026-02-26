const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dbManager = require('./database');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Channels

ipcMain.handle('search-donors', async (event, query) => {
    return await dbManager.searchDonors(query);
});

ipcMain.handle('add-donation', async (event, data) => {
    return await dbManager.addDonation(data);
});

ipcMain.handle('update-donation', async (event, data) => {
    return await dbManager.updateDonation(data);
});

ipcMain.handle('get-donor-history', async (event, name) => {
    return await dbManager.getDonorHistory(name);
});

ipcMain.handle('get-dashboard-data', async (event) => {
    return await dbManager.getDashboardData();
});

ipcMain.handle('add-expense', async (event, data) => {
    return await dbManager.addExpense(data);
});

ipcMain.handle('get-all-expenses', async (event) => {
    return await dbManager.getAllExpenses();
});

ipcMain.handle('update-expense', async (event, data) => {
    return await dbManager.updateExpense(data);
});

ipcMain.handle('get-pending', async (event) => {
    return await dbManager.getPending();
});

ipcMain.handle('get-all-donations', async (event) => {
    return await dbManager.getAllDonations();
});

ipcMain.handle('complete-pending-donation', async (event, id, date) => {
    return await dbManager.completePendingDonation(id, date);
});

ipcMain.handle('complete-pending-donor', async (event, donorName, date) => {
    return await dbManager.completePendingDonor(donorName, date);
});
