const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'donation.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS donors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_id INTEGER,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            transaction_id TEXT,
            pending_amount REAL DEFAULT 0,
            cleared_date TEXT,
            FOREIGN KEY(donor_id) REFERENCES donors(id)
        )`, () => {
            db.run("ALTER TABLE donations ADD COLUMN cleared_date TEXT", () => {});
        });

        db.run(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            payment_method TEXT DEFAULT 'Offline',
            transaction_id TEXT
        )`, () => {
             db.run("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'Offline'", () => {});
             db.run("ALTER TABLE expenses ADD COLUMN transaction_id TEXT", () => {});
        });
    });
}

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

const dbManager = {
    searchDonors: async (query) => {
        const sql = `SELECT name FROM donors WHERE name LIKE ? LIMIT 10`;
        return await allQuery(sql, [`%${query}%`]);
    },

    addDonation: async (data) => {
        try {
            let donor = await getQuery(`SELECT id FROM donors WHERE name = ?`, [data.name]);
            let donorId;

            if (!donor) {
                const result = await runQuery(`INSERT INTO donors (name) VALUES (?)`, [data.name]);
                donorId = result.lastID;
            } else {
                donorId = donor.id;
            }

            const insertDonationSql = `
                INSERT INTO donations (donor_id, date, category, amount, payment_method, transaction_id, pending_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await runQuery(insertDonationSql, [
                donorId, data.date, data.category, data.amount, data.paymentMethod, data.transactionId, data.pendingAmount
            ]);

            return { success: true };
        } catch (error) {
            console.error('Error adding donation:', error);
            return { success: false, error: error.message };
        }
    },

    updateDonation: async (data) => {
        try {
            const currentDonation = await getQuery(`SELECT pending_amount FROM donations WHERE id = ?`, [data.id]);
            const finalPending = data.pendingAmount !== undefined ? data.pendingAmount : currentDonation.pending_amount;

            const updateSql = `
                UPDATE donations
                SET date = ?, category = ?, amount = ?, payment_method = ?, transaction_id = ?, pending_amount = ?
                WHERE id = ?
            `;
            await runQuery(updateSql, [
                data.date, data.category, data.amount, data.paymentMethod, data.transactionId, finalPending, data.id
            ]);
            return { success: true };
        } catch (error) {
            console.error('Error updating donation:', error);
            return { success: false, error: error.message };
        }
    },

    getDonorHistory: async (name) => {
        try {
            const sql = `
                SELECT d.id, d.date, d.category, d.amount, d.payment_method, d.transaction_id, d.pending_amount, d.cleared_date
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                WHERE don.name = ?
                ORDER BY d.date DESC, d.id DESC
            `;
            const donations = await allQuery(sql, [name]);

            let totalPaid = 0;
            let totalPending = 0;
            
            donations.forEach(d => {
                totalPaid += d.amount;
                totalPending += d.pending_amount;
            });

            return { success: true, donations, totalPaid, totalPending };
        } catch (error) {
            console.error('Error fetching donor history:', error);
            return { success: false, error: error.message };
        }
    },

    getDashboardData: async () => {
        try {
            const cashInResult = await getQuery(`SELECT SUM(amount) as total FROM donations`);
            const pendingResult = await getQuery(`SELECT SUM(pending_amount) as total FROM donations`);

            const totalCashIn = cashInResult.total || 0;
            const totalPending = pendingResult.total || 0;

            const dateWiseDonations = await allQuery(`SELECT date, SUM(amount) as total FROM donations GROUP BY date ORDER BY date ASC`);

            return {
                success: true,
                totalCashIn,
                totalPending,
                dateWiseDonations
            };
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            return { success: false, error: error.message };
        }
    },

    addExpense: async (data) => {
        try {
            const sql = `INSERT INTO expenses (date, title, amount, description, payment_method, transaction_id) VALUES (?, ?, ?, ?, ?, ?)`;
            await runQuery(sql, [data.date, data.title, data.amount, data.description, data.paymentMethod || 'Offline', data.transactionId || null]);
            return { success: true };
        } catch (error) {
            console.error('Error adding expense:', error);
            return { success: false, error: error.message };
        }
    },

    getAllExpenses: async () => {
        try {
            const sql = `SELECT * FROM expenses ORDER BY date DESC, id DESC`;
            const expenses = await allQuery(sql);
            return { success: true, expenses };
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return { success: false, error: error.message };
        }
    },

    updateExpense: async (data) => {
        try {
            const sql = `UPDATE expenses SET date = ?, title = ?, amount = ?, description = ?, payment_method = ?, transaction_id = ? WHERE id = ?`;
            await runQuery(sql, [data.date, data.title, data.amount, data.description, data.paymentMethod || 'Offline', data.transactionId || null, data.id]);
            return { success: true };
        } catch (error) {
            console.error('Error updating expense:', error);
            return { success: false, error: error.message };
        }
    },

    getAllDonations: async () => {
        try {
            const sql = `
                SELECT d.id, d.date, d.category, d.amount, d.payment_method, d.transaction_id, d.pending_amount, d.cleared_date, don.name as donor_name
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                ORDER BY d.date DESC, d.id DESC
            `;
            const donations = await allQuery(sql);
            return { success: true, donations };
        } catch (error) {
            console.error('Error fetching all donations:', error);
            return { success: false, error: error.message };
        }
    },

    completePendingDonation: async (id, completeDate) => {
        try {
            const donation = await getQuery(`
                SELECT d.*, don.name as donor_name 
                FROM donations d 
                JOIN donors don ON d.donor_id = don.id 
                WHERE d.id = ?
            `, [id]);
            
            if (donation && donation.pending_amount > 0) {
                const insertSql = `
                    INSERT INTO donations (donor_id, date, category, amount, payment_method, transaction_id, pending_amount, cleared_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const newCategory = donation.category + ' (Pending Cleared)';
                await runQuery(insertSql, [
                    donation.donor_id, completeDate, newCategory, donation.pending_amount, donation.payment_method, donation.transaction_id, 0, completeDate
                ]);
                
                await runQuery(`UPDATE donations SET pending_amount = 0, cleared_date = ? WHERE id = ?`, [completeDate, id]);
                return { success: true };
            } else {
                 return { success: false, error: 'No pending amount found or invalid donation.' };
            }
        } catch (error) {
            console.error('Error completing pending donation:', error);
            return { success: false, error: error.message };
        }
    },

    completePendingDonor: async (donorName, completeDate) => {
        try {
             const sql = `
                SELECT d.* 
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                WHERE don.name = ? AND d.pending_amount > 0
            `;
            const pendingDonations = await allQuery(sql, [donorName]);
            
            for(let donation of pendingDonations) {
                 const insertSql = `
                    INSERT INTO donations (donor_id, date, category, amount, payment_method, transaction_id, pending_amount, cleared_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const newCategory = donation.category + ' (Pending Cleared)';
                await runQuery(insertSql, [
                    donation.donor_id, completeDate, newCategory, donation.pending_amount, donation.payment_method, donation.transaction_id, 0, completeDate
                ]);
                
                await runQuery(`UPDATE donations SET pending_amount = 0, cleared_date = ? WHERE id = ?`, [completeDate, donation.id]);
            }
            return { success: true };
        } catch (error) {
             console.error('Error completing pending by donor:', error);
             return { success: false, error: error.message };
        }
    },

    getPending: async () => {
        try {
            const sql = `
                SELECT don.name, SUM(d.pending_amount) as total_pending
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                WHERE d.pending_amount > 0
                GROUP BY don.name
                ORDER BY total_pending DESC
            `;
            const pendingList = await allQuery(sql);
            return { success: true, pendingList };
        } catch (error) {
            console.error('Error fetching pending amounts:', error);
            return { success: false, error: error.message };
        }
    }
};

module.exports = dbManager;
