const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

// Use app.getPath('userData') to ensure the database is writable in production
const dbPath = path.join(app.getPath('userData'), 'donation.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database at:', dbPath);
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS special_functions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

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
            bank_check_number TEXT,
            bank_name TEXT,
            pending_amount REAL DEFAULT 0,
            cleared_date TEXT,
            FOREIGN KEY(donor_id) REFERENCES donors(id)
        )`, () => {
            db.run("ALTER TABLE donations ADD COLUMN cleared_date TEXT", () => {});
            db.run("ALTER TABLE donations ADD COLUMN bank_check_number TEXT", () => {});
            db.run("ALTER TABLE donations ADD COLUMN bank_name TEXT", () => {});
            db.run("ALTER TABLE donations ADD COLUMN reset_number TEXT", () => {});
            db.run("ALTER TABLE donations ADD COLUMN function_id INTEGER", () => {});
        });

        db.run(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            payment_method TEXT DEFAULT 'Offline',
            transaction_id TEXT,
            bank_check_number TEXT,
            bank_name TEXT
        )`, () => {
             db.run("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'Offline'", () => {});
             db.run("ALTER TABLE expenses ADD COLUMN transaction_id TEXT", () => {});
             db.run("ALTER TABLE expenses ADD COLUMN bank_check_number TEXT", () => {});
             db.run("ALTER TABLE expenses ADD COLUMN bank_name TEXT", () => {});
             db.run("ALTER TABLE expenses ADD COLUMN function_id INTEGER", () => {});
        });

        // Stores individual payment history per donation when clearing pending
        db.run(`CREATE TABLE IF NOT EXISTS pending_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donation_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            amount_paid REAL NOT NULL,
            payment_method TEXT NOT NULL,
            transaction_id TEXT,
            bank_check_number TEXT,
            bank_name TEXT,
            FOREIGN KEY(donation_id) REFERENCES donations(id)
        )`, () => {
            db.run("ALTER TABLE pending_payments ADD COLUMN bank_check_number TEXT", () => {});
            db.run("ALTER TABLE pending_payments ADD COLUMN bank_name TEXT", () => {});
        });

        db.run(`CREATE TABLE IF NOT EXISTS bank_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            time TEXT,
            amount REAL NOT NULL
        )`, () => {
            db.run("ALTER TABLE bank_submissions ADD COLUMN time TEXT", () => {});
        });
        // Indexes for large data performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_donations_pending ON donations(pending_amount)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pending_payments_donation_id ON pending_payments(donation_id)`);
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
                INSERT INTO donations (donor_id, date, category, amount, payment_method, transaction_id, bank_check_number, bank_name, pending_amount, reset_number, function_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await runQuery(insertDonationSql, [
                donorId, data.date, data.category, data.amount, data.paymentMethod, data.transactionId, data.bankCheckNumber, data.bankName, data.pendingAmount, data.resetNumber, data.functionId || null
            ]);

            return { success: true };
        } catch (error) {
            console.error('Error adding donation:', error);
            return { success: false, error: error.message };
        }
    },

    updateDonation: async (data) => {
        try {
            const currentDonation = await getQuery(`SELECT pending_amount, function_id FROM donations WHERE id = ?`, [data.id]);
            const finalPending = data.pendingAmount !== undefined ? data.pendingAmount : currentDonation.pending_amount;
            const finalFunctionId = data.functionId !== undefined ? data.functionId : currentDonation.function_id;

            const updateSql = `
                UPDATE donations
                SET date = ?, category = ?, amount = ?, payment_method = ?, transaction_id = ?, bank_check_number = ?, bank_name = ?, pending_amount = ?, reset_number = ?, function_id = ?
                WHERE id = ?
            `;
            await runQuery(updateSql, [
                data.date, data.category, data.amount, data.paymentMethod, data.transactionId, data.bankCheckNumber, data.bankName, finalPending, data.resetNumber, finalFunctionId, data.id
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
                SELECT d.id, d.date, d.category, d.amount, d.payment_method, d.transaction_id, d.bank_check_number, d.bank_name, d.pending_amount, d.cleared_date, d.reset_number, sf.name as function_name
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                LEFT JOIN special_functions sf ON d.function_id = sf.id
                WHERE don.name = ?
                ORDER BY d.date DESC, d.id DESC
            `;
            const donations = await allQuery(sql, [name]);

            let totalPaid = 0;
            let totalPending = 0;
            
            donations.forEach(d => {
                totalPaid += (d.amount - d.pending_amount);
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
            // Calculate everything based on actual payments made
            // Total Paid = (Initial Payments) + (Subsequent Payments)
            // Initial Paid for a donation = amount - pending_amount - (sum of all pending_payments for this donation)
            
            // 1. Get initial payments from donations
            const initialPaymentsResult = await getQuery(`
                SELECT 
                    SUM(CASE WHEN payment_method = 'Offline' THEN (amount - pending_amount - (SELECT COALESCE(SUM(amount_paid), 0) FROM pending_payments WHERE donation_id = d.id)) ELSE 0 END) as initial_cash,
                    SUM(CASE WHEN payment_method = 'Online' THEN (amount - pending_amount - (SELECT COALESCE(SUM(amount_paid), 0) FROM pending_payments WHERE donation_id = d.id)) ELSE 0 END) as initial_online,
                    SUM(pending_amount) as total_pending
                FROM donations d
            `);

            // 2. Get subsequent payments from pending_payments
            const subsequentPaymentsResult = await getQuery(`
                SELECT 
                    SUM(CASE WHEN payment_method = 'Offline' THEN amount_paid ELSE 0 END) as subsequent_cash,
                    SUM(CASE WHEN payment_method = 'Online' THEN amount_paid ELSE 0 END) as subsequent_online
                FROM pending_payments
            `);

            const totalCash = (initialPaymentsResult.initial_cash || 0) + (subsequentPaymentsResult.subsequent_cash || 0);
            const totalOnline = (initialPaymentsResult.initial_online || 0) + (subsequentPaymentsResult.subsequent_online || 0);
            const totalPending = initialPaymentsResult.total_pending || 0;
            const totalCashIn = totalCash + totalOnline;

            const expenseResult = await getQuery(`SELECT SUM(amount) as total FROM expenses`);

            // Calculate Clark Cash Balance (Total Cash Donations - Clark Cash Expenses - Bank Submissions)
            const clarkCashExpensesResult = await getQuery(`SELECT SUM(amount) as total FROM expenses WHERE payment_method = 'Clark Cash'`);
            const bankSubmissionsResult = await getQuery(`SELECT SUM(amount) as total FROM bank_submissions`);
            
            const totalClarkCashExpenses = clarkCashExpensesResult.total || 0;
            const totalBankSubmissions = bankSubmissionsResult.total || 0;
            const availableClarkCash = totalCash - totalClarkCashExpenses - totalBankSubmissions;

            const totalExpense = expenseResult.total || 0;

            const dateWiseDonations = await allQuery(`SELECT date, SUM(amount) as total FROM donations GROUP BY date ORDER BY date ASC`);
            const categoryWiseDonations = await allQuery(`SELECT category, SUM(amount) as total FROM donations GROUP BY category ORDER BY total DESC`);

            return {
                success: true,
                totalCashIn,
                totalPending,
                totalExpense,
                totalCash,
                totalOnline,
                availableClarkCash,
                dateWiseDonations,
                categoryWiseDonations
            };
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            return { success: false, error: error.message };
        }
    },

    getAnalyticsData: async () => {
        try {
            // Monthly donations - initial paid part
            const monthlyDonations = await allQuery(`
                SELECT 
                    strftime('%Y-%m', date) as month, 
                    SUM(amount - pending_amount - (SELECT COALESCE(SUM(amount_paid), 0) FROM pending_payments WHERE donation_id = d.id)) as total, 
                    COUNT(*) as count
                FROM donations d
                WHERE date >= date('now', '-12 months')
                GROUP BY strftime('%Y-%m', date)
                ORDER BY month ASC
            `);

            // Monthly expenses for the last 12 months
            const monthlyExpenses = await allQuery(`
                SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
                FROM expenses
                WHERE date >= date('now', '-12 months')
                GROUP BY strftime('%Y-%m', date)
                ORDER BY month ASC
            `);

            // Payment method breakdown (donations - initial paid part)
            const paymentMethodDonations = await allQuery(`
                SELECT 
                    payment_method, 
                    SUM(amount - pending_amount - (SELECT COALESCE(SUM(amount_paid), 0) FROM pending_payments WHERE donation_id = d.id)) as total, 
                    COUNT(*) as count
                FROM donations d
                GROUP BY payment_method
                ORDER BY total DESC
            `);

            // Payment method breakdown (subsequent payments)
            const paymentMethodPending = await allQuery(`
                SELECT payment_method, SUM(amount_paid) as total, COUNT(*) as count
                FROM pending_payments
                GROUP BY payment_method
            `);

            // Top 10 donors - total paid so far
            const topDonors = await allQuery(`
                SELECT don.name, SUM(d.amount - d.pending_amount) as total, COUNT(d.id) as count
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                GROUP BY don.name
                ORDER BY total DESC
                LIMIT 10
            `);

            // Expense breakdown by payment method
            const expenseByMethod = await allQuery(`
                SELECT payment_method, SUM(amount) as total
                FROM expenses
                GROUP BY payment_method
                ORDER BY total DESC
            `);

            // Yearly summary (all years - total paid)
            const yearlySummary = await allQuery(`
                SELECT strftime('%Y', date) as year,
                       SUM(amount - pending_amount) as donations,
                       COUNT(*) as count
                FROM donations
                GROUP BY strftime('%Y', date)
                ORDER BY year ASC
            `);



            // Yearly expenses
            const yearlyExpenses = await allQuery(`
                SELECT strftime('%Y', date) as year, SUM(amount) as expenses
                FROM expenses
                GROUP BY strftime('%Y', date)
                ORDER BY year ASC
            `);

            // Recent 30 days daily trend
            const dailyTrend = await allQuery(`
                SELECT date, SUM(amount) as total, COUNT(*) as count
                FROM donations
                WHERE date >= date('now', '-30 days')
                GROUP BY date
                ORDER BY date ASC
            `);

            // Total donor count
            const donorCount = await getQuery(`SELECT COUNT(*) as total FROM donors`);
            const donationCount = await getQuery(`SELECT COUNT(*) as total FROM donations`);

            return {
                success: true,
                monthlyDonations,
                monthlyExpenses,
                paymentMethodDonations,
                paymentMethodPending,
                topDonors,
                expenseByMethod,
                yearlySummary,
                yearlyExpenses,
                dailyTrend,
                donorCount: donorCount.total || 0,
                donationCount: donationCount.total || 0
            };
        } catch (error) {
            console.error('Error fetching analytics data:', error);
            return { success: false, error: error.message };
        }
    },

    addExpense: async (data) => {
        try {
            const sql = `INSERT INTO expenses (date, title, amount, description, payment_method, transaction_id, bank_check_number, bank_name, function_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            await runQuery(sql, [data.date, data.title, data.amount, data.description, data.paymentMethod || 'Offline', data.transactionId || null, data.bankCheckNumber || null, data.bankName || null, data.functionId || null]);
            return { success: true };
        } catch (error) {
            console.error('Error adding expense:', error);
            return { success: false, error: error.message };
        }
    },

    getAllExpenses: async () => {
        try {
            const sql = `
                SELECT e.*, sf.name as function_name 
                FROM expenses e 
                LEFT JOIN special_functions sf ON e.function_id = sf.id 
                ORDER BY e.date DESC, e.id DESC
            `;
            const expenses = await allQuery(sql);
            return { success: true, expenses };
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return { success: false, error: error.message };
        }
    },

    // Server-side paginated expenses with optional search
    getPaginatedExpenses: async ({ page = 1, limit = 50, search = '', dateFilter = '', monthFilter = '', yearFilter = '' } = {}) => {
        try {
            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            if (search) {
                conditions.push(`(e.title LIKE ? OR e.description LIKE ? OR e.payment_method LIKE ? OR e.bank_check_number LIKE ? OR e.bank_name LIKE ? OR CAST(e.amount AS TEXT) LIKE ? OR sf.name LIKE ?)`);
                const like = `%${search}%`;
                params.push(like, like, like, like, like, like, like);
            }
            if (dateFilter) {
                conditions.push(`e.date = ?`);
                params.push(dateFilter);
            }
            if (monthFilter) {
                conditions.push(`strftime('%Y-%m', e.date) = ?`);
                params.push(monthFilter);
            }
            if (yearFilter && !monthFilter) {
                conditions.push(`strftime('%Y', e.date) = ?`);
                params.push(String(yearFilter));
            }
            const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const countRow = await getQuery(`SELECT COUNT(*) as total FROM expenses e LEFT JOIN special_functions sf ON e.function_id = sf.id ${whereSql}`, params);
            const expenses = await allQuery(
                `SELECT e.*, sf.name as function_name FROM expenses e LEFT JOIN special_functions sf ON e.function_id = sf.id ${whereSql} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            return { success: true, expenses, total: countRow.total, page, limit };
        } catch (error) {
            console.error('Error fetching paginated expenses:', error);
            return { success: false, error: error.message };
        }
    },

    getPaginatedBankSubmissions: async ({ page = 1, limit = 10 } = {}) => {
        try {
            const offset = (page - 1) * limit;
            const countRow = await getQuery(`SELECT COUNT(*) as total FROM bank_submissions`);
            const history = await allQuery(
                `SELECT * FROM bank_submissions ORDER BY id DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            );
            return { success: true, history, total: countRow.total, page, limit };
        } catch (error) {
            console.error('Error fetching paginated bank submissions:', error);
            return { success: false, error: error.message };
        }
    },

    updateExpense: async (data) => {
        try {
            const currentExpense = await getQuery(`SELECT function_id FROM expenses WHERE id = ?`, [data.id]);
            const finalFunctionId = data.functionId !== undefined ? data.functionId : (currentExpense ? currentExpense.function_id : null);
            
            const sql = `UPDATE expenses SET date = ?, title = ?, amount = ?, description = ?, payment_method = ?, transaction_id = ?, bank_check_number = ?, bank_name = ?, function_id = ? WHERE id = ?`;
            await runQuery(sql, [data.date, data.title, data.amount, data.description, data.paymentMethod || 'Offline', data.transactionId || null, data.bankCheckNumber || null, data.bankName || null, finalFunctionId, data.id]);
            return { success: true };
        } catch (error) {
            console.error('Error updating expense:', error);
            return { success: false, error: error.message };
        }
    },

    getAllDonations: async () => {
        try {
            const sql = `
                SELECT d.id, d.date, d.category, d.amount, d.payment_method, d.transaction_id, d.bank_check_number, d.bank_name, d.pending_amount, d.cleared_date, d.reset_number, don.name as donor_name, sf.name as function_name
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                LEFT JOIN special_functions sf ON d.function_id = sf.id
                ORDER BY d.date DESC, d.id DESC
            `;
            const donations = await allQuery(sql);
            return { success: true, donations };
        } catch (error) {
            console.error('Error fetching all donations:', error);
            return { success: false, error: error.message };
        }
    },

    // Server-side paginated donations with optional search
    getPaginatedDonations: async ({ page = 1, limit = 50, search = '', dateFilter = '', monthFilter = '', yearFilter = '' } = {}) => {
        try {
            const offset = (page - 1) * limit;
            let conditions = [];
            let params = [];
            if (search) {
                conditions.push(`(don.name LIKE ? OR d.category LIKE ? OR sf.name LIKE ? OR d.payment_method LIKE ? OR d.bank_check_number LIKE ? OR d.bank_name LIKE ? OR CAST(d.amount AS TEXT) LIKE ?)`);
                const like = `%${search}%`;
                params.push(like, like, like, like, like, like, like);
            }
            if (dateFilter) {
                conditions.push(`d.date = ?`);
                params.push(dateFilter);
            }
            if (monthFilter) {
                conditions.push(`strftime('%Y-%m', d.date) = ?`);
                params.push(monthFilter);
            }
            if (yearFilter && !monthFilter) {
                conditions.push(`strftime('%Y', d.date) = ?`);
                params.push(String(yearFilter));
            }
            const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const countRow = await getQuery(
                `SELECT COUNT(*) as total FROM donations d JOIN donors don ON d.donor_id = don.id LEFT JOIN special_functions sf ON d.function_id = sf.id ${whereSql}`,
                params
            );
            const donations = await allQuery(
                `SELECT d.id, d.date, d.category, d.amount, d.payment_method, d.transaction_id, d.bank_check_number, d.bank_name, d.pending_amount, d.cleared_date, d.reset_number, don.name as donor_name, sf.name as function_name
                 FROM donations d JOIN donors don ON d.donor_id = don.id LEFT JOIN special_functions sf ON d.function_id = sf.id
                 ${whereSql} ORDER BY d.date DESC, d.id DESC LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );
            return { success: true, donations, total: countRow.total, page, limit };
        } catch (error) {
            console.error('Error fetching paginated donations:', error);
            return { success: false, error: error.message };
        }
    },

    payPendingDonation: async (data) => {
        try {
            const donation = await getQuery(`
                SELECT d.*, don.name as donor_name 
                FROM donations d 
                JOIN donors don ON d.donor_id = don.id 
                WHERE d.id = ?
            `, [data.id]);
            
            if (donation && donation.pending_amount > 0) {
                const amountToClear = Math.min(data.amountPaid, donation.pending_amount);
                const remainingPending = parseFloat((donation.pending_amount - amountToClear).toFixed(2));

                // Store in payment history table (no new donation row)
                await runQuery(
                    `INSERT INTO pending_payments (donation_id, date, amount_paid, payment_method, transaction_id, bank_check_number, bank_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [donation.id, data.date, amountToClear, data.paymentMethod, data.transactionId, data.bankCheckNumber, data.bankName]
                );

                // Update original donation row in-place
                // Always update cleared_date to latest payment date
                await runQuery(
                    `UPDATE donations SET pending_amount = ?, cleared_date = ? WHERE id = ?`,
                    [remainingPending, data.date, data.id]
                );
                return { success: true };
            } else {
                 return { success: false, error: 'No pending amount found or invalid donation.' };
            }
        } catch (error) {
            console.error('Error completing pending donation:', error);
            return { success: false, error: error.message };
        }
    },

    payPendingDonor: async (data) => {
        try {
             const sql = `
                SELECT d.* 
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                WHERE don.name = ? AND d.pending_amount > 0
                ORDER BY d.date ASC, d.id ASC
            `;
            const pendingDonations = await allQuery(sql, [data.donorName]);
            
            let remainingToPay = data.amountPaid;

            for(let donation of pendingDonations) {
                if (remainingToPay <= 0) break;

                const amountToClear = Math.min(remainingToPay, donation.pending_amount);
                const remainingPending = parseFloat((donation.pending_amount - amountToClear).toFixed(2));

                // Store in payment history table (no new donation row)
                await runQuery(
                    `INSERT INTO pending_payments (donation_id, date, amount_paid, payment_method, transaction_id, bank_check_number, bank_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [donation.id, data.date, amountToClear, data.paymentMethod, data.transactionId, data.bankCheckNumber, data.bankName]
                );

                // Update original donation row in-place
                // Always update cleared_date to latest payment date
                await runQuery(
                    `UPDATE donations SET pending_amount = ?, cleared_date = ? WHERE id = ?`,
                    [remainingPending, data.date, donation.id]
                );
                
                remainingToPay -= amountToClear;
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
    },

    getPendingPayments: async (donationId) => {
        try {
            const sql = `SELECT * FROM pending_payments WHERE donation_id = ? ORDER BY date DESC, id DESC`;
            const payments = await allQuery(sql, [donationId]);
            return { success: true, payments };
        } catch (error) {
            console.error('Error fetching pending payments:', error);
            return { success: false, error: error.message };
        }
    },

    deleteDonation: async (id) => {
        try {
            // Remove pending payment history first (FK)
            await runQuery(`DELETE FROM pending_payments WHERE donation_id = ?`, [id]);
            await runQuery(`DELETE FROM donations WHERE id = ?`, [id]);
            return { success: true };
        } catch (error) {
            console.error('Error deleting donation:', error);
            return { success: false, error: error.message };
        }
    },

    deleteExpense: async (id) => {
        try {
            await runQuery(`DELETE FROM expenses WHERE id = ?`, [id]);
            return { success: true };
        } catch (error) {
            console.error('Error deleting expense:', error);
            return { success: false, error: error.message };
        }
    },

    addBankSubmission: async (amount) => {
        try {
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            await runQuery(`INSERT INTO bank_submissions (date, time, amount) VALUES (?, ?, ?)`, [date, time, amount]);
            return { success: true };
        } catch (error) {
            console.error('Error adding bank submission:', error);
            return { success: false, error: error.message };
        }
    },

    addSpecialFunction: async (data) => {
        try {
            const sql = `INSERT INTO special_functions (name, date) VALUES (?, ?)`;
            await runQuery(sql, [data.name, data.date]);
            return { success: true };
        } catch (error) {
            console.error('Error adding special function:', error);
            return { success: false, error: error.message };
        }
    },

    getSpecialFunctions: async () => {
        try {
            const sql = `SELECT * FROM special_functions ORDER BY date DESC, id DESC`;
            const functions = await allQuery(sql);
            return { success: true, functions };
        } catch (error) {
            console.error('Error fetching special functions:', error);
            return { success: false, error: error.message };
        }
    },

    getFunctionDetails: async (id) => {
        try {
            const func = await getQuery(`SELECT * FROM special_functions WHERE id = ?`, [id]);
            if (!func) return { success: false, error: 'Function not found' };

            const donationsSql = `
                SELECT d.*, don.name as donor_name
                FROM donations d
                JOIN donors don ON d.donor_id = don.id
                WHERE d.function_id = ?
                ORDER BY d.date DESC, d.id DESC
            `;
            const donations = await allQuery(donationsSql, [id]);

            const expensesSql = `
                SELECT * FROM expenses WHERE function_id = ? ORDER BY date DESC, id DESC
            `;
            const expenses = await allQuery(expensesSql, [id]);

            let totalDonations = 0;
            let totalPending = 0;
            donations.forEach(d => {
                totalDonations += (d.amount - d.pending_amount);
                totalPending += d.pending_amount;
            });

            let totalExpenses = 0;
            expenses.forEach(e => {
                totalExpenses += e.amount;
            });

            return {
                success: true,
                func,
                donations,
                expenses,
                totalDonations,
                totalPending,
                totalExpenses
            };
        } catch (error) {
            console.error('Error fetching function details:', error);
            return { success: false, error: error.message };
        }
    },

    deleteSpecialFunction: async (id) => {
        try {
            // Start a transaction for safety if needed, but sequential runs are fine in this simple setup
            // 1. Delete associated pending payments first (linked to donations of this function)
            await runQuery(`
                DELETE FROM pending_payments 
                WHERE donation_id IN (SELECT id FROM donations WHERE function_id = ?)
            `, [id]);

            // 2. Delete associated donations
            await runQuery(`DELETE FROM donations WHERE function_id = ?`, [id]);

            // 3. Delete associated expenses
            await runQuery(`DELETE FROM expenses WHERE function_id = ?`, [id]);

            // 4. Delete the function itself
            await runQuery(`DELETE FROM special_functions WHERE id = ?`, [id]);

            return { success: true };
        } catch (error) {
            console.error('Error deleting special function:', error);
            return { success: false, error: error.message };
        }
    }
};

module.exports = dbManager;
