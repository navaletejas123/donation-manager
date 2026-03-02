const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron');
const path = require('path');
const dbManager = require('./database');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
         icon: path.join(__dirname, 'assets/icon.png'), 
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    Menu.setApplicationMenu(null);

    globalShortcut.register('CommandOrControl+R', () => {
        if (mainWindow) {
            mainWindow.reload();
        }
    });


    globalShortcut.register('F5', () => {
        if (mainWindow) {
            mainWindow.reload();
        }
    });


    globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (mainWindow) {
            mainWindow.webContents.openDevTools();
        }
    });

    ipcMain.on('window-minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('window-maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.on('window-close', () => {
        if (mainWindow) mainWindow.close();
    });
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

ipcMain.handle('pay-pending-donation', async (event, data) => {
    return await dbManager.payPendingDonation(data);
});

ipcMain.handle('pay-pending-donor', async (event, data) => {
    return await dbManager.payPendingDonor(data);
});

ipcMain.handle('get-pending-payments', async (event, donationId) => {
    return await dbManager.getPendingPayments(donationId);
});

ipcMain.handle('delete-donation', async (event, id) => {
    return await dbManager.deleteDonation(id);
});

ipcMain.handle('get-paginated-expenses', async (event, params) => {
    return await dbManager.getPaginatedExpenses(params);
});

ipcMain.handle('get-paginated-donations', async (event, params) => {
    return await dbManager.getPaginatedDonations(params);
});