const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const shortid = require('shortid');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');

const adapter = new FileSync('db.json');
const db = low(adapter);

// Set up the database defaults
db.defaults({ store_closed: false, employees: [], nextShiftId: 1 }).write();

// Set up SQLite database for ESR Reports
const esrDb = new Database('esrjpg.db');
esrDb.exec(`
    CREATE TABLE IF NOT EXISTS esr_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        shift_id TEXT NOT NULL,
        report_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, date, shift_id)
    );
`);
// Drop and recreate esr_jpgs table to remove unique constraint
try {
    esrDb.exec('DROP TABLE IF EXISTS esr_jpgs;');
} catch (error) {
    console.log('Drop table failed:', error.message);
}
esrDb.exec(`
    CREATE TABLE esr_jpgs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        shift_id TEXT NOT NULL,
        jpg_data BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);
// Add shift_id column if not exists (for existing databases)
try {
    esrDb.exec(`ALTER TABLE esr_reports ADD COLUMN shift_id TEXT;`);
} catch (error) {
    // Ignore if column already exists
}

const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Email configuration (provided)
const emailConfig = {
    from: 'nsoridcodings@gmail.com',
    recipients: ['yochanbr@gmail.com', '', ''],
    transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'nsoridcodings@gmail.com',
            pass: 'thvp krkn ipml dzzp' // Replace with actual App Password
        }
    })
};

// Simple in-memory OTP store for end-shift flow
let endShiftOtp = {
    otp: null,
    expiresAt: 0
};

// Simple in-memory OTP store for employee end-shift flow
let employeeEndShiftOtp = {
    otp: null,
    expiresAt: 0,
    employeeId: null
};

// Update progress tracking
let updateInProgress = false;
let updateStartTime = null;

// Admin approval OTP functionality removed - employees can login directly

// Test close flag
let testCloseDone = false;

// Handle login requests
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (username === 'nammamart' && password === 'admin12nammamart') {
        return res.json({ success: true, redirectUrl: '/admin' });
    }

    const storeClosed = db.get('store_closed').value();
    if (storeClosed) {
        return res.status(403).json({ success: false, message: 'Store is temporarily closed. Please contact admin to confirm.' });
    }

    const employee = db.get('employees').find({ username: username }).value();

    if (employee && bcrypt.compareSync(password, employee.password)) {
        if (employee.shiftEnded) {
            // Directly reset shiftEnded and set startShiftTime for new shift
            db.get('employees').find({ id: employee.id }).assign({ shiftEnded: false, startShiftTime: new Date().toISOString() }).write();
        }

        // Ensure counter_selections is an array
        if (!employee.counter_selections) {
            employee.counter_selections = [];
            db.get('employees').find({ id: employee.id }).assign({ counter_selections: [] }).write();
        }

        // Check if there is an active shift today (counter_selection with shiftEndTime null and shiftStartTime is today)
        const today = new Date().toISOString().split('T')[0];
        const activeShift = employee.counter_selections.some(sel => !sel.shiftEndTime && sel.shiftStartTime && sel.shiftStartTime.startsWith(today));
        if (activeShift) {
            res.json({ success: true, redirectUrl: '/employee.html', employeeId: employee.id });
        } else {
            res.json({ success: true, redirectUrl: '/counter_selection.html', employeeId: employee.id });
        }
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

    // Handle add employee requests
    app.post('/api/employees', (req, res) => {
        const employeeData = req.body;

        // Set username to employee-id
        employeeData.username = employeeData['employee-id'];
        delete employeeData['employee-id'];

        // Encrypt the password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(employeeData.password, salt);
        employeeData.password = hashedPassword;

        // Generate a unique ID for the employee
        employeeData.id = shortid.generate();

        // Initialize shiftEnded to false for new employees
        employeeData.shiftEnded = false;

        // Initialize counter_selections as empty array
        employeeData.counter_selections = [];

        // Save the employee to the database
        db.get('employees').push(employeeData).write();

        res.json({ success: true, message: 'Employee added successfully.' });
    });

// Get all employees
app.get('/api/employees', (req, res) => {
    const employees = db.get('employees').value();
    res.json(employees);
});

// Delete an employee
app.delete('/api/employees/:id', (req, res) => {
    const employeeId = req.params.id;
    db.get('employees').remove({ id: employeeId }).write();
    res.json({ success: true, message: 'Employee deleted successfully.' });
});

// Get a single employee by ID
app.get('/api/employees/:id', (req, res) => {
    const employeeId = req.params.id;
    const employee = db.get('employees').find({ id: employeeId }).value();
    if (employee) {
        res.json(employee);
    } else {
        res.status(404).json({ success: false, message: 'Employee not found.' });
    }
});

// Update an employee
app.put('/api/employees/:id', (req, res) => {
    const employeeId = req.params.id;
    const employeeData = req.body;

    // If the password is being updated, re-encrypt it
    if (employeeData.password) {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(employeeData.password, salt);
        employeeData.password = hashedPassword;
    }

    db.get('employees').find({ id: employeeId }).assign(employeeData).write();

    res.json({ success: true, message: 'Employee updated successfully.' });
});

// Handle counter selection data submission (FIXED SHIFT START)
app.post('/api/counter-selection', (req, res) => {
    const { employeeId, counter, pineLabValue, timestamp } = req.body;

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Ensure counter_selections exists
    let selections = employee.counter_selections || [];

    // Generate shift ID (3 digits + 3 letters from name in caps)
    const shiftNumber = db.get('nextShiftId').value();
    const namePart = employee.name.replace(/\s/g, '').substr(0, 3).toUpperCase();
    const shiftId = shiftNumber.toString().padStart(3, '0') + namePart;
    db.set('nextShiftId', shiftNumber + 1).write();

    // Create new shift entry
    const newShift = {
        id: shortid.generate(),
        shiftId: shiftId,
        counter,
        pineLabValue,
        shiftStartTime: timestamp,
        shiftEndTime: null,
        timestamp,
    };

    // Push safely
    selections.push(newShift);

    // Save back properly (THIS is the part your original code broke)
    db.get('employees')
        .find({ id: employeeId })
        .assign({ counter_selections: selections, shiftEnded: false })
        .write();

    return res.json({ success: true, message: 'Shift started successfully.' });
});

// Handle extra data submission
app.post('/api/extra', (req, res) => {
    const extraData = req.body;
    const employeeId = extraData.employeeId; // Assume employeeId is sent from client

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Initialize extra array if not exists
    if (!employee.extra) {
        employee.extra = [];
    }

    // Add the extra data
    employee.extra.push({
        id: shortid.generate(),
        itemName: extraData.itemName,
        billNumber: extraData.billNumber,
        extraAmount: extraData.extraAmount,
        modeOfPay: extraData.modeOfPay,
        timestamp: new Date().toISOString()
    });

    db.get('employees').find({ id: employeeId }).assign(employee).write();

    res.json({ success: true, message: 'Extra data saved successfully.' });
});

// Get extra data for an employee
app.get('/api/extra', (req, res) => {
    try {
        const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (employee) {
            let data = employee.extra || [];
            // Filter out invalid items
            data = data.filter(item => item && typeof item === 'object' && item.timestamp);
            if (date) {
                // Filter by date (YYYY-MM-DD)
                data = data.filter(item => {
                    const parsed = new Date(item.timestamp);
                    if (isNaN(parsed.getTime())) return false;
                    return parsed.toISOString().split('T')[0] === date;
                });
            }
            if (shiftStartTime) {
                const start = new Date(shiftStartTime);
                if (!isNaN(start.getTime())) {
                    data = data.filter(item => {
                        const ts = new Date(item.timestamp);
                        return ts >= start;
                    });
                    if (shiftEndTime) {
                        const end = new Date(shiftEndTime);
                        if (!isNaN(end.getTime())) {
                            data = data.filter(item => {
                                const ts = new Date(item.timestamp);
                                return ts <= end;
                            });
                        }
                    }
                }
            }
            res.json(data);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        console.error('Error in /api/extra:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Handle delivery data submission
app.post('/api/delivery', (req, res) => {
    const deliveryData = req.body;
    const employeeId = deliveryData.employeeId;

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.delivery) {
        employee.delivery = [];
    }

    employee.delivery.push({
        id: shortid.generate(),
        billNumber: deliveryData.billNumber,
        amount: deliveryData.amount,
        extraAmount: deliveryData.extraAmount,
        totalAmount: deliveryData.totalAmount,
        modeOfPay: deliveryData.modeOfPay,
        delivered: false,
        timestamp: new Date().toISOString()
    });

    db.get('employees').find({ id: employeeId }).assign(employee).write();

    res.json({ success: true, message: 'Delivery data saved successfully.' });
});

// Get delivery data for an employee
app.get('/api/delivery', (req, res) => {
    try {
        const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (employee) {
            let data = employee.delivery || [];
            if (date) {
                // date is in YYYY-MM-DD format
                data = data.filter(item => {
                    if (!item || !item.timestamp) return false;
                    const parsed = new Date(item.timestamp);
                    if (isNaN(parsed.getTime())) return false;
                    return parsed.toISOString().split('T')[0] === date;
                });
            }
            if (shiftStartTime) {
                const start = new Date(shiftStartTime);
                if (!isNaN(start.getTime())) {
                    data = data.filter(item => {
                        const ts = new Date(item.timestamp);
                        return ts >= start;
                    });
                    if (shiftEndTime) {
                        const end = new Date(shiftEndTime);
                        if (!isNaN(end.getTime())) {
                            data = data.filter(item => {
                                const ts = new Date(item.timestamp);
                                return ts <= end;
                            });
                        }
                    }
                }
            }
            res.json(data);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        console.error('Error in /api/delivery:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Handle bill_paid data submission
app.post('/api/bill_paid', (req, res) => {
    const billPaidData = req.body;
    const employeeId = billPaidData.employeeId;

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.bill_paid) {
        employee.bill_paid = [];
    }

    employee.bill_paid.push({
        id: shortid.generate(),
        vendorSupplier: billPaidData.vendorSupplier,
        amountPaid: billPaidData.amountPaid,
        timestamp: new Date().toISOString()
    });

    db.get('employees').find({ id: employeeId }).assign(employee).write();

    res.json({ success: true, message: 'Bill paid data saved successfully.' });
});

// Get bill_paid data for an employee
app.get('/api/bill_paid', (req, res) => {
    try {
        const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (employee) {
            let data = employee.bill_paid || [];
            if (date) {
                // date is in YYYY-MM-DD format
                data = data.filter(item => {
                    if (!item || !item.timestamp) return false;
                    const parsed = new Date(item.timestamp);
                    if (isNaN(parsed.getTime())) return false;
                    return parsed.toISOString().split('T')[0] === date;
                });
            }
            if (shiftStartTime) {
                const start = new Date(shiftStartTime);
                if (!isNaN(start.getTime())) {
                    data = data.filter(item => {
                        const ts = new Date(item.timestamp);
                        return ts >= start;
                    });
                    if (shiftEndTime) {
                        const end = new Date(shiftEndTime);
                        if (!isNaN(end.getTime())) {
                            data = data.filter(item => {
                                const ts = new Date(item.timestamp);
                                return ts <= end;
                            });
                        }
                    }
                }
            }
            res.json(data);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        console.error('Error in /api/bill_paid:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Handle issue data submission
app.post('/api/issue', (req, res) => {
    const issueData = req.body;
    const employeeId = issueData.employeeId;

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.issue) {
        employee.issue = [];
    }

    employee.issue.push({
        id: shortid.generate(),
        billNumber: issueData.billNumber,
        issueDescription: issueData.issueDescription,
        timestamp: new Date().toISOString()
    });

    db.get('employees').find({ id: employeeId }).assign(employee).write();

    res.json({ success: true, message: 'Issue data saved successfully.' });
});

// Get issue data for an employee
app.get('/api/issue', (req, res) => {
    try {
        const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (employee) {
            let data = employee.issue || [];
            if (date) {
                // date is in YYYY-MM-DD format
                data = data.filter(item => {
                    if (!item || !item.timestamp) return false;
                    const parsed = new Date(item.timestamp);
                    if (isNaN(parsed.getTime())) return false;
                    return parsed.toISOString().split('T')[0] === date;
                });
            }
            if (shiftStartTime) {
                const start = new Date(shiftStartTime);
                if (!isNaN(start.getTime())) {
                    data = data.filter(item => {
                        const ts = new Date(item.timestamp);
                        return ts >= start;
                    });
                    if (shiftEndTime) {
                        const end = new Date(shiftEndTime);
                        if (!isNaN(end.getTime())) {
                            data = data.filter(item => {
                                const ts = new Date(item.timestamp);
                                return ts <= end;
                            });
                        }
                    }
                }
            }
            res.json(data);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        console.error('Error in /api/issue:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Handle retail_credit data submission
app.post('/api/retail_credit', (req, res) => {
    const retailCreditData = req.body;
    const employeeId = retailCreditData.employeeId;

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.retail_credit) {
        employee.retail_credit = [];
    }

    employee.retail_credit.push({
        id: shortid.generate(),
        phoneNumber: retailCreditData.phoneNumber,
        amount: retailCreditData.amount,
        modeOfPay: retailCreditData.modeOfPay,
        timestamp: new Date().toISOString()
    });

    db.get('employees').find({ id: employeeId }).assign(employee).write();

    res.json({ success: true, message: 'Retail credit data saved successfully.' });
});

 // Get retail_credit data for an employee
 app.get('/api/retail_credit', (req, res) => {
     try {
         const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
         const employee = db.get('employees').find({ id: employeeId }).value();
         if (employee) {
             let data = employee.retail_credit || [];
             if (date) {
                 // date is in YYYY-MM-DD format
                 data = data.filter(item => {
                     if (!item.timestamp) return false;
                     const parsed = new Date(item.timestamp);
                     if (isNaN(parsed.getTime())) return false;
                     return parsed.toISOString().split('T')[0] === date;
                 });
             }
             if (shiftStartTime) {
                 const start = new Date(shiftStartTime);
                 if (!isNaN(start.getTime())) {
                     data = data.filter(item => {
                         const ts = new Date(item.timestamp);
                         return ts >= start;
                     });
                     if (shiftEndTime) {
                         const end = new Date(shiftEndTime);
                         if (!isNaN(end.getTime())) {
                             data = data.filter(item => {
                                 const ts = new Date(item.timestamp);
                                 return ts <= end;
                             });
                         }
                     }
                 }
             }
             res.json(data);
         } else {
             res.status(404).json({ message: 'Employee not found' });
         }
     } catch (error) {
         console.error('Error in /api/retail_credit:', error);
         res.status(500).json({ message: 'Internal server error' });
     }
 });

 // Get counter_data for an employee
 app.get('/api/counter_data', (req, res) => {
     try {
         const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
         const employee = db.get('employees').find({ id: employeeId }).value();
         if (employee) {
             let data = employee.counter_selections || [];
             if (date) {
                 // date is in YYYY-MM-DD format
                 data = data.filter(item => {
                     if (!item.timestamp) return false;
                     const parsed = new Date(item.timestamp);
                     if (isNaN(parsed.getTime())) return false;
                     return parsed.toISOString().split('T')[0] === date;
                 });
             }
             if (shiftStartTime) {
                 const start = new Date(shiftStartTime);
                 if (!isNaN(start.getTime())) {
                     data = data.filter(item => {
                         const ts = new Date(item.timestamp);
                         return ts >= start;
                     });
                     if (shiftEndTime) {
                         const end = new Date(shiftEndTime);
                         if (!isNaN(end.getTime())) {
                             data = data.filter(item => {
                                 const ts = new Date(item.timestamp);
                                 return ts <= end;
                             });
                         }
                     }
                 }
             }
             res.json(data);
         } else {
             res.status(404).json({ message: 'Employee not found' });
         }
     } catch (error) {
         console.error('Error in /api/counter_data:', error);
         res.status(500).json({ message: 'Internal server error' });
     }
 });

// Verify admin password for end shift
// Verify admin password and send OTP to configured email for end-shift
app.post('/api/verify-admin-password', async (req, res) => {
    const { password } = req.body;
    if (password !== 'admin12nammamart') {
        return res.json({ success: false });
    }

    // Generate 5-digit OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    endShiftOtp.otp = otp;
    endShiftOtp.expiresAt = Date.now() + 5 * 60 * 1000; // valid for 5 minutes

    // Prepare email
    const mailOptions = {
        from: emailConfig.from,
        to: emailConfig.recipients.filter(Boolean).join(','),
        subject: 'Namma Mart - End Shift OTP',
        text: `Your End Shift OTP is: ${otp}. It is valid for 5 minutes.`
    };

    try {
        await emailConfig.transporter.sendMail(mailOptions);

            const responseBody = { success: true, message: 'OTP sent to configured email.' };
            return res.json(responseBody);
    } catch (err) {
        console.error('Error sending OTP email:', err);
        // Clear OTP on failure
        endShiftOtp.otp = null;
        endShiftOtp.expiresAt = 0;
        return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }
});

// Send OTP to employee's email for end-shift
app.post('/api/send-employee-otp', async (req, res) => {
    const { employeeId } = req.body;
    if (!employeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (!employee.email) {
        return res.status(400).json({ success: false, message: 'Employee email not found.' });
    }

    // Generate 5-digit OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    employeeEndShiftOtp.otp = otp;
    employeeEndShiftOtp.expiresAt = Date.now() + 5 * 60 * 1000; // valid for 5 minutes
    employeeEndShiftOtp.employeeId = employeeId;

    // Prepare email
    const mailOptions = {
        from: emailConfig.from,
        to: employee.email,
        subject: 'Namma Mart - Employee End Shift OTP',
        text: `Your End Shift OTP is: ${otp}. It is valid for 5 minutes.`
    };

    try {
        await emailConfig.transporter.sendMail(mailOptions);

        const responseBody = { success: true, message: 'OTP sent to your email.' };
        return res.json(responseBody);
    } catch (err) {
        console.error('Error sending employee OTP email:', err);
        // Clear OTP on failure
        employeeEndShiftOtp.otp = null;
        employeeEndShiftOtp.expiresAt = 0;
        employeeEndShiftOtp.employeeId = null;
        return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }
});

/**
 * Verify employee OTP for end-shift
 * Additionally, record employee endShiftTime and set shiftEnded to true
 */
app.post('/api/verify-employee-otp', async (req, res) => {
    const { otp, employeeId } = req.body;
    if (isEmpty(otp) || isEmpty(employeeId)) {
        return res.status(400).json({ success: false, message: 'OTP and Employee ID are required.' });
    }

    if (!employeeEndShiftOtp.otp || Date.now() > employeeEndShiftOtp.expiresAt || employeeEndShiftOtp.employeeId !== employeeId) {
        employeeEndShiftOtp.otp = null;
        employeeEndShiftOtp.expiresAt = 0;
        employeeEndShiftOtp.employeeId = null;
        return res.status(400).json({ success: false, message: 'OTP expired or not requested.' });
    }

    if (String(otp).trim() !== String(employeeEndShiftOtp.otp)) {
        return res.status(401).json({ success: false, message: 'Invalid OTP.' });
    }

    employeeEndShiftOtp.otp = null;
    employeeEndShiftOtp.expiresAt = 0;
    employeeEndShiftOtp.employeeId = null;

    // Record endShiftTime and set shiftEnded true
    const endShiftTime = new Date().toISOString();
    const employeeForShiftEnd = db.get('employees').find({ id: employeeId }).value();
    let lastShiftIndex = -1;
    if (employeeForShiftEnd && employeeForShiftEnd.counter_selections) {
        const today = new Date().toISOString().split('T')[0];
        lastShiftIndex = employeeForShiftEnd.counter_selections.reduce((lastIndex, selection, currentIndex) => {
            if (selection.shiftStartTime && selection.shiftStartTime.startsWith(today)) {
                return currentIndex;
            }
            return lastIndex;
        }, -1);

        if (lastShiftIndex !== -1) {
            employeeForShiftEnd.counter_selections[lastShiftIndex].shiftEndTime = endShiftTime;
        }
    }
    db.get('employees').find({ id: employeeId }).assign({ shiftEnded: true, counter_selections: employeeForShiftEnd.counter_selections }).write();

    // Fetch employee data for report
    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found after verification.' });
    }

    const employeeName = employee.name || 'Employee';

    // Generate and save ESR Text Report
    const date = endShiftTime.split('T')[0];
    let reportText = '';
    try {
        // Get shift details
        const shiftStartTime = employeeForShiftEnd.counter_selections[lastShiftIndex].shiftStartTime;
        const shiftEndTimeFormatted = endShiftTime;
        const shiftId = employeeForShiftEnd.counter_selections[lastShiftIndex].shiftId;

        // Fetch today's report summary
        const reportSummaryResponse = await fetch(`http://localhost:${port}/api/todays-report-summary?employeeId=${employeeId}&date=${date}&shiftStartTime=${shiftStartTime}&shiftEndTime=${shiftEndTimeFormatted}`);
        const reportSummary = await reportSummaryResponse.json();

        // Fetch data activity summary
        const activitySummaryResponse = await fetch(`http://localhost:${port}/api/data-activity-summary?employeeId=${employeeId}&date=${date}&shiftStartTime=${shiftStartTime}&shiftEndTime=${shiftEndTimeFormatted}`);
        const activitySummary = await activitySummaryResponse.json();

        // Generate text report
        reportText = `
End Shift Report for ${employeeName}

Shift Details:
- Shift Start Time: ${new Date(shiftStartTime).toLocaleString()}
- Shift End Time: ${new Date(shiftEndTimeFormatted).toLocaleString()}
- Shift ID: ${shiftId}

Today's Report Summary:
- UPI Pinelab: ₹${reportSummary.upiPinelab || 0}
- Card Pinelab: ₹${reportSummary.cardPinelab || 0}
- UPI Paytm: ₹${reportSummary.upiPaytm || 0}
- Card Paytm: ₹${reportSummary.cardPaytm || 0}
- Cash: ₹${reportSummary.cash || 0}
- Retail Credit: ₹${reportSummary.retailCredit || 0}

Data Activity Summary:
- Entries Added: ${activitySummary.inputed || 0}
- Entries Edited: ${activitySummary.edited || 0}
- Entries Deleted: ${activitySummary.deleted || 0}

Thank you for your work today.
Regards,
Namma Mart
        `;

        // Save the text report
        const stmt = esrDb.prepare('INSERT OR REPLACE INTO esr_reports (employee_id, date, shift_id, report_data) VALUES (?, ?, ?, ?)');
        stmt.run(employeeId, date, shiftId, reportText.trim());
        console.log(`ESR Text Report generated and saved for employee ${employeeId} on ${date} with shift ID ${shiftId}`);

        // Generate and save ESR JPG
        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 800 });
            const reportUrl = `http://localhost:${port}/end_shift_report.html?employeeId=${employeeId}&date=${date}&shiftId=${shiftId}`;
            await page.goto(reportUrl, { waitUntil: 'networkidle2' });
            const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 90 });
            await browser.close();

            // Save the JPG to database
            const jpgStmt = esrDb.prepare('INSERT OR REPLACE INTO esr_jpgs (employee_id, date, shift_id, jpg_data) VALUES (?, ?, ?, ?)');
            jpgStmt.run(employeeId, date, shiftId, screenshotBuffer);
            console.log(`ESR JPG generated and saved for employee ${employeeId} on ${date} with shift ID ${shiftId}`);
        } catch (jpgError) {
            console.error('Error generating ESR JPG:', jpgError);
        }
    } catch (error) {
        console.error('Error generating ESR Text Report:', error);
    }

    // Compose email content for shift end report
    const startShiftTime = employee.startShiftTime || 'N/A';

    const emailText = `
Hello ${employeeName},

Your shift has ended successfully.

Shift Start Time: ${startShiftTime}
Shift End Time: ${endShiftTime}

${reportText}

Regards,
Namma Mart
    `;

    // Send email with nodemailer
    const mailOptions = {
        from: emailConfig.from,
        to: employee.email,
        subject: 'Namma Mart - Shift End Report',
        text: emailText
    };

    try {
        await emailConfig.transporter.sendMail(mailOptions);
        console.log(`Shift end report email with attachment sent to ${employee.email}`);
    } catch (err) {
        console.error('Error sending shift end report email:', err);
        // Not failing the API call, just logging
    }

    return res.json({ success: true, message: 'OTP verified. Shift ended and email sent.' });
});

/**
 * End employee shift with password verification
 */
app.post('/api/end-employee-shift', async (req, res) => {
    const { password, employeeId } = req.body;
    if (!password || !employeeId) {
        return res.status(400).json({ success: false, message: 'Password and Employee ID are required.' });
    }

    const employeeRecord = db.get('employees').find({ id: employeeId }).value();
    if (!employeeRecord) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Verify employee password
    if (!bcrypt.compareSync(password, employeeRecord.password)) {
        return res.status(401).json({ success: false, message: 'Invalid password.' });
    }

    // Record endShiftTime and set shiftEnded true
    const endShiftTime = new Date().toISOString();
    const employeeForShiftEnd = db.get('employees').find({ id: employeeId }).value();
    let lastShiftIndex = -1;
    if (employeeForShiftEnd && employeeForShiftEnd.counter_selections) {
        const today = new Date().toISOString().split('T')[0];
        lastShiftIndex = employeeForShiftEnd.counter_selections.reduce((lastIndex, selection, currentIndex) => {
            if (selection.shiftStartTime && selection.shiftStartTime.startsWith(today)) {
                return currentIndex;
            }
            return lastIndex;
        }, -1);

        if (lastShiftIndex !== -1) {
            employeeForShiftEnd.counter_selections[lastShiftIndex].shiftEndTime = endShiftTime;
        }
    }
    db.get('employees').find({ id: employeeId }).assign({ shiftEnded: true, counter_selections: employeeForShiftEnd.counter_selections }).write();

    // Use the employee data fetched earlier for report
    const employeeName = employeeRecord.name || 'Employee';

    // Generate and save ESR Text Report
    const date = endShiftTime.split('T')[0];
    let reportText = '';
    try {
        // Get shift details
        const shiftStartTime = employeeForShiftEnd.counter_selections[lastShiftIndex].shiftStartTime;
        const shiftEndTimeFormatted = endShiftTime;
        const shiftId = employeeForShiftEnd.counter_selections[lastShiftIndex].shiftId;

        // Fetch today's report summary
        const reportSummaryResponse = await fetch(`http://localhost:${port}/api/todays-report-summary?employeeId=${employeeId}&date=${date}&shiftStartTime=${shiftStartTime}&shiftEndTime=${shiftEndTimeFormatted}`);
        const reportSummary = await reportSummaryResponse.json();

        // Fetch data activity summary
        const activitySummaryResponse = await fetch(`http://localhost:${port}/api/data-activity-summary?employeeId=${employeeId}&date=${date}&shiftStartTime=${shiftStartTime}&shiftEndTime=${shiftEndTimeFormatted}`);
        const activitySummary = await activitySummaryResponse.json();

        // Generate text report
        reportText = `
End Shift Report for ${employeeName}

Shift Details:
- Shift Start Time: ${new Date(shiftStartTime).toLocaleString()}
- Shift End Time: ${new Date(shiftEndTimeFormatted).toLocaleString()}
- Shift ID: ${shiftId}

Today's Report Summary:
- UPI Pinelab: ₹${reportSummary.upiPinelab || 0}
- Card Pinelab: ₹${reportSummary.cardPinelab || 0}
- UPI Paytm: ₹${reportSummary.upiPaytm || 0}
- Card Paytm: ₹${reportSummary.cardPaytm || 0}
- Cash: ₹${reportSummary.cash || 0}
- Retail Credit: ₹${reportSummary.retailCredit || 0}

Data Activity Summary:
- Entries Added: ${activitySummary.inputed || 0}
- Entries Edited: ${activitySummary.edited || 0}
- Entries Deleted: ${activitySummary.deleted || 0}

Thank you for your work today.
Regards,
Namma Mart
        `;

        // Save the text report
        const stmt = esrDb.prepare('INSERT OR REPLACE INTO esr_reports (employee_id, date, shift_id, report_data) VALUES (?, ?, ?, ?)');
        stmt.run(employeeId, date, shiftId, reportText.trim());
        console.log(`ESR Text Report generated and saved for employee ${employeeId} on ${date} with shift ID ${shiftId}`);

        // Generate and save ESR JPG
        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 800 });
            const reportUrl = `http://localhost:${port}/end_shift_report.html?employeeId=${employeeId}&date=${date}&shiftId=${shiftId}`;
            await page.goto(reportUrl, { waitUntil: 'networkidle2' });
            const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 90 });
            await browser.close();

            // Save the JPG to database
            const jpgStmt = esrDb.prepare('INSERT OR REPLACE INTO esr_jpgs (employee_id, date, shift_id, jpg_data) VALUES (?, ?, ?, ?)');
            jpgStmt.run(employeeId, date, shiftId, screenshotBuffer);
            console.log(`ESR JPG generated and saved for employee ${employeeId} on ${date} with shift ID ${shiftId}`);
        } catch (jpgError) {
            console.error('Error generating ESR JPG:', jpgError);
        }
    } catch (error) {
        console.error('Error generating ESR Text Report:', error);
    }

    // Compose email content for shift end report
    const startShiftTime = employeeRecord.startShiftTime || 'N/A';

    const emailText = `
Hello ${employeeName},

Your shift has ended successfully.

Shift Start Time: ${startShiftTime}
Shift End Time: ${endShiftTime}

${reportText}

Regards,
Namma Mart
    `;

    // Send email with nodemailer
    const mailOptions = {
        from: emailConfig.from,
        to: employeeRecord.email,
        subject: 'Namma Mart - Shift End Report',
        text: emailText
    };

    try {
        await emailConfig.transporter.sendMail(mailOptions);
        console.log(`Shift end report email with attachment sent to ${employeeRecord.email}`);
    } catch (err) {
        console.error('Error sending shift end report email:', err);
        // Not failing the API call, just logging
    }

    return res.json({ success: true, message: 'Shift ended and email sent.' });
});

/**
 * Verify admin approval OTP for employee relogin
 * Additionally, set employee startShiftTime and reset shiftEnded flag
 */
app.post('/api/verify-admin-approval-otp', (req, res) => {
    const { otp, employeeId } = req.body;
    if (isEmpty(otp) || isEmpty(employeeId)) {
        return res.status(400).json({ success: false, message: 'OTP and Employee ID are required.' });
    }

    if (!adminApprovalOtp.otp || Date.now() > adminApprovalOtp.expiresAt || adminApprovalOtp.employeeId !== employeeId) {
        adminApprovalOtp.otp = null;
        adminApprovalOtp.expiresAt = 0;
        adminApprovalOtp.employeeId = null;
        return res.status(400).json({ success: false, message: 'OTP expired or not requested.' });
    }

    if (String(otp).trim() !== String(adminApprovalOtp.otp)) {
        return res.status(401).json({ success: false, message: 'Invalid OTP.' });
    }

    adminApprovalOtp.otp = null;
    adminApprovalOtp.expiresAt = 0;
    adminApprovalOtp.employeeId = null;

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Set shiftEnded to false and record startShiftTime to current time
    db.get('employees').find({ id: employeeId }).assign({ shiftEnded: false, startShiftTime: new Date().toISOString() }).write();

    return res.json({ success: true, message: 'OTP verified. New shift started.', redirectUrl: '/counter_selection.html', employeeId });
});

// Confirm the OTP and then close the store (end shift)
app.post('/api/confirm-endshift-otp', (req, res) => {
    const { otp } = req.body;
    if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required.' });
    }

    if (!endShiftOtp.otp || Date.now() > endShiftOtp.expiresAt) {
        // Clear stale OTP
        endShiftOtp.otp = null;
        endShiftOtp.expiresAt = 0;
        return res.status(400).json({ success: false, message: 'OTP expired or not requested.' });
    }

    if (String(otp).trim() !== String(endShiftOtp.otp)) {
        return res.status(401).json({ success: false, message: 'Invalid OTP.' });
    }

    // OTP valid — close the store
    endShiftOtp.otp = null;
    endShiftOtp.expiresAt = 0;
    db.set('store_closed', true).write();
    return res.json({ success: true, message: 'Shift ended, store closed.' });
});

// Localhost-only debug endpoint to view current OTP (for development/testing only)
app.get('/api/debug-current-otp', (req, res) => {
    const ip = (req.ip || '').toString();
    const isLocal = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.0.0.1') || req.hostname === 'localhost';
    if (!isLocal) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!endShiftOtp.otp) {
        return res.json({ success: false, message: 'No OTP currently set.' });
    }

    return res.json({ success: true, otp: endShiftOtp.otp, expiresAt: endShiftOtp.expiresAt });
});

const { isEmpty } = require('lodash');

// Verify admin password for start shift and record startShiftTime
app.post('/api/start-shift', (req, res) => {
    const { password } = req.body;
    if (password === 'admin12nammamart') {
        const startShiftTime = new Date().toISOString();
        db.set('store_closed', false).write();
        db.set('startShiftTime', startShiftTime).write();
        res.json({ success: true, startShiftTime });
    } else {
        res.json({ success: false });
    }
});

// Get store status
app.get('/api/store-status', (req, res) => {
    res.json({ closed: db.get('store_closed').value() });
});



// Update data entry
app.put('/api/:type/:id', (req, res) => {
    let { type, id } = req.params;
    if (type === 'counter_data') {
        type = 'counter_selections';
    }
    const updateData = req.body;
    const employeeId = updateData.employeeId;

    // Require a non-empty edit reason for audit purposes
    if (!updateData.editReason || String(updateData.editReason).trim() === '') {
        return res.status(400).json({ success: false, message: 'editReason is required when editing an entry.' });
    }

    const employee = db.get('employees').find({ id: employeeId }).value();
    if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
    }

    const dataArray = employee[type];
    if (!dataArray) {
        return res.status(404).json({ message: 'Data type not found' });
    }

    const index = dataArray.findIndex(item => item.id === id);
    if (index === -1) {
        return res.status(404).json({ message: 'Data entry not found' });
    }

    // Store original data in history
    if (!employee.history) {
        employee.history = [];
    }
    const originalData = { ...dataArray[index] };
    employee.history.push({
        id: shortid.generate(),
        timestamp: new Date().toISOString(),
        action: 'edit',
        type: type,
        itemId: id,
        reason: updateData.editReason || '',
        originalData: originalData,
        modifiedData: { ...dataArray[index], ...updateData }
    });

    // Remove editReason from updateData
    delete updateData.editReason;

    dataArray[index] = { ...dataArray[index], ...updateData };
    db.get('employees').find({ id: employeeId }).assign(employee).write();

    res.json({ success: true, message: 'Data updated successfully.' });
});

// Delete data entry
// Permanently delete a history entry by id (specific route placed before generic delete)
app.delete('/api/permanently-delete-history/:id', (req, res) => {
    const { id } = req.params;

    const employees = db.get('employees').value();
    let found = false;

    for (let emp of employees) {
        if (emp.history && Array.isArray(emp.history)) {
            const index = emp.history.findIndex(h => h.id === id);
            if (index !== -1) {
                emp.history.splice(index, 1);
                found = true;
                break;
            }
        }
    }

    if (found) {
        db.write();
        res.json({ success: true, message: 'History entry deleted permanently.' });
    } else {
        res.status(404).json({ success: false, message: 'History entry not found.' });
    }
});

app.delete('/api/:type/:id', (req, res) => {
    let { type, id } = req.params;
     if (type === 'counter_data') {
        type = 'counter_selections';
    }
    const { employeeId } = req.query;
    // Reason can be passed as query or body (DELETE bodies are allowed by some clients)
    const reason = (req.query.reason) || (req.body && req.body.reason) || '';

    if (!reason || String(reason).trim() === '') {
        return res.status(400).json({ message: 'A reason is required to delete an entry.' });
    }

    const employee = db.get('employees').find({ id: employeeId });
    if (!employee.value()) {
        return res.status(404).json({ message: 'Employee not found' });
    }

    const dataArray = employee.get(type).value();
    if (!dataArray) {
        return res.status(404).json({ message: 'Data type not found' });
    }

    const index = dataArray.findIndex(item => item && item.id === id);
    if (index === -1) {
        return res.status(404).json({ message: 'Data entry not found' });
    }

    // Store original data in history before deletion (include provided reason)
    if (!employee.value().history) {
        employee.value().history = [];
    }
    const originalData = { ...dataArray[index] };
    employee.value().history.push({
        id: shortid.generate(),
        timestamp: new Date().toISOString(),
        action: 'delete',
        type: type,
        itemId: id,
        reason: String(reason),
        originalData: originalData,
        modifiedData: null
    });

    dataArray.splice(index, 1);
    db.write();

    res.json({ success: true, message: 'Data deleted successfully.' });
});

// Get history data for an employee
app.get('/api/history', (req, res) => {
    try {
        const { employeeId, date, type } = req.query;
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (employee) {
            let data = employee.history || [];
            if (date) {
                // date is in YYYY-MM-DD format
                data = data.filter(item => {
                    if (!item.timestamp) return false;
                    const parsed = new Date(item.timestamp);
                    if (isNaN(parsed.getTime())) return false;
                    return parsed.toISOString().split('T')[0] === date;
                });
            }
            if (type) {
                data = data.filter(item => item.type === type);
            }
            res.json(data);
        } else {
            res.status(404).json({ message: 'Employee not found' });
        }
    } catch (error) {
        console.error('Error in /api/history:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Restore data entry
app.post('/api/restore/:id', (req, res) => {
    const { id } = req.params;

    // Find the history entry
    let historyEntry;
    const employees = db.get('employees').value();
    for (let emp of employees) {
        if (emp.history) {
            historyEntry = emp.history.find(h => h.id === id);
            if (historyEntry) {
                // Restore the data to the appropriate array
                if (!emp[historyEntry.type]) {
                    emp[historyEntry.type] = [];
                }
                emp[historyEntry.type].push(historyEntry.originalData);
                // Remove the history entry
                emp.history = emp.history.filter(h => h.id !== id);
                db.write();
                return res.json({ success: true, message: 'Data restored successfully.' });
            }
        }
    }

    res.status(404).json({ message: 'History entry not found' });
});

// Revert edit entry
app.post('/api/revert-edit/:id', (req, res) => {
    const { id } = req.params;

    // Find the history entry
    let historyEntry;
    const employees = db.get('employees').value();
    for (let emp of employees) {
        if (emp.history) {
            historyEntry = emp.history.find(h => h.id === id);
            if (historyEntry) {
                // Find the current data entry and revert it
                const dataArray = emp[historyEntry.type];
                if (dataArray) {
                    const index = dataArray.findIndex(item => item.id === historyEntry.itemId);
                    if (index !== -1) {
                        // Revert to original data
                        dataArray[index] = { ...historyEntry.originalData };
                        // Remove the history entry
                        emp.history = emp.history.filter(h => h.id !== id);
                        db.write();
                        return res.json({ success: true, message: 'Edit reverted successfully.' });
                    }
                }
            }
        }
    }

    res.status(404).json({ message: 'History entry not found' });
});

app.get('/api/todays-report-summary', (req, res) => {
    try {
        const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
        if (!employeeId || !date) {
            return res.status(400).json({ success: false, message: 'employeeId and date are required.' });
        }
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        const extraData = employee.extra || [];
        const retailCreditData = employee.retail_credit || [];

        // Filter extra data by date (YYYY-MM-DD)
        let filteredExtraData = extraData.filter(item => {
            if (!item.timestamp) return false;
            const itemDate = new Date(item.timestamp);
            if (isNaN(itemDate.getTime())) return false;
            return itemDate.toISOString().split('T')[0] === date;
        });

        // Filter retail_credit data by date
        let filteredRetailCreditData = retailCreditData.filter(item => {
            if (!item.timestamp) return false;
            const itemDate = new Date(item.timestamp);
            if (isNaN(itemDate.getTime())) return false;
            return itemDate.toISOString().split('T')[0] === date;
        });

        // Further filter by shift times if provided
        if (shiftStartTime) {
            const start = new Date(shiftStartTime);
            if (!isNaN(start.getTime())) {
                filteredExtraData = filteredExtraData.filter(item => {
                    const ts = new Date(item.timestamp);
                    return ts >= start;
                });
                filteredRetailCreditData = filteredRetailCreditData.filter(item => {
                    const ts = new Date(item.timestamp);
                    return ts >= start;
                });
                if (shiftEndTime) {
                    const end = new Date(shiftEndTime);
                    if (!isNaN(end.getTime())) {
                        filteredExtraData = filteredExtraData.filter(item => {
                            const ts = new Date(item.timestamp);
                            return ts <= end;
                        });
                        filteredRetailCreditData = filteredRetailCreditData.filter(item => {
                            const ts = new Date(item.timestamp);
                            return ts <= end;
                        });
                    }
                }
            }
        }

        // Aggregate totals by payment type from extra data
        let upiPinelab = 0;
        let cardPinelab = 0;
        let upiPaytm = 0;
        let cardPaytm = 0;
        let cash = 0;
        let retailCredit = 0;

        filteredExtraData.forEach(item => {
            const mode = (item.modeOfPay || '').toLowerCase();
            const amount = parseFloat(item.extraAmount) || 0;
            if (mode === 'upi pinelab') {
                upiPinelab += amount;
            } else if (mode === 'card pinelab') {
                cardPinelab += amount;
            } else if (mode === 'upi paytm') {
                upiPaytm += amount;
            } else if (mode === 'card paytm') {
                cardPaytm += amount;
            } else if (mode === 'cash') {
                cash += amount;
            }
        });

        // Aggregate total retail credit from retail_credit data
        filteredRetailCreditData.forEach(item => {
            const amount = parseFloat(item.amount) || 0;
            retailCredit += amount;
        });

        res.json({
            upiPinelab,
            cardPinelab,
            upiPaytm,
            cardPaytm,
            cash,
            retailCredit
        });
    } catch (error) {
        console.error('Error in /api/todays-report-summary:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get data activity summary (deleted, edited, inputed counts)
app.get('/api/data-activity-summary', (req, res) => {
    try {
        const { employeeId, date, shiftStartTime, shiftEndTime } = req.query;
        if (!employeeId || !date) {
            return res.status(400).json({ success: false, message: 'employeeId and date are required.' });
        }
        const employee = db.get('employees').find({ id: employeeId }).value();
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Filter history by date and shift
        let filteredHistory = (employee.history || []).filter(item => {
            if (!item.timestamp) return false;
            const itemDate = new Date(item.timestamp);
            if (isNaN(itemDate.getTime())) return false;
            const matchesDate = itemDate.toISOString().split('T')[0] === date;
            if (!matchesDate) return false;

            if (shiftStartTime) {
                const start = new Date(shiftStartTime);
                if (!isNaN(start.getTime())) {
                    if (itemDate < start) return false;
                    if (shiftEndTime) {
                        const end = new Date(shiftEndTime);
                        if (!isNaN(end.getTime()) && itemDate > end) return false;
                    }
                }
            }
            return true;
        });

        // Count deleted and edited from history
        const deleted = filteredHistory.filter(item => item.action === 'delete').length;
        const edited = filteredHistory.filter(item => item.action === 'edit').length;

        // Count inputed (added) data: count entries in data arrays filtered by date and shift
        const dataTypes = ['extra', 'delivery', 'bill_paid', 'issue', 'retail_credit'];
        let inputed = 0;
        dataTypes.forEach(type => {
            const data = employee[type] || [];
            const filteredData = data.filter(item => {
                if (!item.timestamp) return false;
                const itemDate = new Date(item.timestamp);
                if (isNaN(itemDate.getTime())) return false;
                const matchesDate = itemDate.toISOString().split('T')[0] === date;
                if (!matchesDate) return false;

                if (shiftStartTime) {
                    const start = new Date(shiftStartTime);
                    if (!isNaN(start.getTime())) {
                        if (itemDate < start) return false;
                        if (shiftEndTime) {
                            const end = new Date(shiftEndTime);
                            if (!isNaN(end.getTime()) && itemDate > end) return false;
                        }
                    }
                }
                return true;
            });
            inputed += filteredData.length;
        });

        res.json({
            deleted,
            edited,
            inputed
        });
    } catch (error) {
        console.error('Error in /api/data-activity-summary:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update app endpoint
app.post('/api/update-app', (req, res) => {
    const { exec, spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    updateInProgress = true;
    updateStartTime = new Date();

    // Function to get current branch
    const getCurrentBranch = () => {
        return new Promise((resolve, reject) => {
            exec('git branch --show-current', (error, stdout) => {
                if (error) {
                    exec('git rev-parse --abbrev-ref HEAD', (error2, stdout2) => {
                        if (error2) {
                            resolve('main');
                        } else {
                            resolve(stdout2.trim());
                        }
                    });
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    };

    // Function to restart server
    const restartServer = () => {
        return new Promise((resolve, reject) => {
            console.log('Checking for running server processes...');

            // On Windows, use taskkill instead of pgrep/kill
            const isWindows = process.platform === 'win32';
            if (isWindows) {
                exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout) => {
                    if (!error && stdout.includes('node.exe')) {
                        console.log('Stopping existing server processes...');
                        exec('taskkill /F /IM node.exe /FI "WINDOWTITLE eq Namma Mart*"', () => {
                            setTimeout(() => {
                                console.log('Starting server...');
                                const serverProcess = spawn('node', ['server.js'], {
                                    detached: true,
                                    stdio: 'ignore'
                                });
                                serverProcess.unref();
                                console.log('Server started in background');
                                resolve();
                            }, 2000);
                        });
                    } else {
                        console.log('Starting server...');
                        const serverProcess = spawn('node', ['server.js'], {
                            detached: true,
                            stdio: 'ignore'
                        });
                        serverProcess.unref();
                        console.log('Server started in background');
                        resolve();
                    }
                });
            } else {
                // Unix-like systems
                exec('pgrep -f "node.*server.js"', (error, stdout) => {
                    if (!error && stdout.trim()) {
                        const pids = stdout.trim().split('\n');
                        console.log('Stopping existing server processes:', pids.join(', '));
                        exec(`kill ${pids.join(' ')}`, () => {
                            setTimeout(() => {
                                console.log('Starting server...');
                                const serverProcess = spawn('node', ['server.js'], {
                                    detached: true,
                                    stdio: 'ignore'
                                });
                                serverProcess.unref();
                                console.log('Server started in background');
                                resolve();
                            }, 2000);
                        });
                    } else {
                        console.log('Starting server...');
                        const serverProcess = spawn('node', ['server.js'], {
                            detached: true,
                            stdio: 'ignore'
                        });
                        serverProcess.unref();
                        console.log('Server started in background');
                        resolve();
                    }
                });
            }
        });
    };

    // Check if it's a Git repository
    if (fs.existsSync(path.join(__dirname, '.git'))) {
        console.log('Git repository detected. Checking for updates...');

        getCurrentBranch().then(branch => {
            console.log('Current branch:', branch);

            // Fetch latest changes
            console.log('Fetching latest changes...');
            exec('git fetch origin', (error) => {
                if (error) {
                    updateInProgress = false;
                    updateStartTime = null;
                    console.error('Error: Failed to fetch from remote repository.');
                    return res.status(500).json({ success: false, message: 'Update failed: Failed to fetch from remote repository.' });
                }

                // Check if there are updates
                exec('git rev-parse HEAD', (error, localStdout) => {
                    if (error) {
                        updateInProgress = false;
                        updateStartTime = null;
                        return res.status(500).json({ success: false, message: 'Update failed: Could not get local commit.' });
                    }

                    const local = localStdout.trim();
                    exec(`git rev-parse origin/${branch}`, (error, remoteStdout) => {
                        let remote = remoteStdout ? remoteStdout.trim() : null;
                        if (error || !remote) {
                            // Try main or master
                            exec('git rev-parse origin/main', (error2, remoteStdout2) => {
                                if (error2) {
                                    exec('git rev-parse origin/master', (error3, remoteStdout3) => {
                                        remote = error3 ? null : remoteStdout3.trim();
                                        checkForUpdates(local, remote, branch);
                                    });
                                } else {
                                    remote = remoteStdout2.trim();
                                    checkForUpdates(local, remote, branch);
                                }
                            });
                        } else {
                            checkForUpdates(local, remote, branch);
                        }
                    });
                });
            });
        });
    } else {
        updateInProgress = false;
        updateStartTime = null;
        console.log('This directory is not a Git repository.');
        return res.status(500).json({ success: false, message: 'Update failed: Not a Git repository. Please initialize Git and add remote origin.' });
    }

    function checkForUpdates(local, remote, branch) {
        if (!remote || local === remote) {
            updateInProgress = false;
            updateStartTime = null;
            console.log('No updates available. Application is up to date.');
            return res.json({ success: true, message: 'No updates available. Application is up to date.' });
        }

        console.log('Updates found. Pulling latest changes...');
        exec(`git pull origin ${branch}`, (error, pullStdout) => {
            if (error) {
                updateInProgress = false;
                updateStartTime = null;
                console.error('Error: Failed to pull updates from remote repository.');
                return res.status(500).json({ success: false, message: 'Update failed: Failed to pull updates from remote repository.' });
            }

            console.log('Update successful.');

            // Check if package.json exists and run npm install
            if (fs.existsSync(path.join(__dirname, 'package.json'))) {
                console.log('Installing/updating dependencies...');
                exec('npm install', (npmError) => {
                    if (npmError) {
                        console.log('Warning: Failed to install dependencies. Please run \'npm install\' manually.');
                    }

                    // Restart the server
                    restartServer().then(() => {
                        updateInProgress = false;
                        updateStartTime = null;
                        console.log('Update completed successfully!');
                        res.json({ success: true, message: 'Update completed successfully! Application has been updated and restarted.' });
                    }).catch(() => {
                        updateInProgress = false;
                        updateStartTime = null;
                        res.json({ success: true, message: 'Update completed successfully! Please restart the server manually.' });
                    });
                });
            } else {
                // Restart the server
                restartServer().then(() => {
                    updateInProgress = false;
                    updateStartTime = null;
                    console.log('Update completed successfully!');
                    res.json({ success: true, message: 'Update completed successfully! Application has been updated and restarted.' });
                }).catch(() => {
                    updateInProgress = false;
                    updateStartTime = null;
                    res.json({ success: true, message: 'Update completed successfully! Please restart the server manually.' });
                });
            }
        });
    }
});

// Get update status endpoint
app.get('/api/update-status', (req, res) => {
    res.json({ updateInProgress, updateStartTime });
});

// Check for updates endpoint
app.get('/api/check-update', (req, res) => {
    const { exec } = require('child_process');
    exec('git fetch && git status -uno', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error checking for updates: ${error}`);
            return res.json({ updateAvailable: false, error: error.message });
        }
        const hasUpdates = stdout.includes('Your branch is behind') || stdout.includes('have diverged');
        res.json({ updateAvailable: hasUpdates });
    });
});

// Get update details endpoint
app.get('/api/update-details', (req, res) => {
    const { exec } = require('child_process');
    exec('git log --oneline -10', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error getting update details: ${error}`);
            return res.json({ details: 'Unable to fetch update details.', error: error.message });
        }
        const details = stdout.split('\n').filter(line => line.trim()).join('\n');
        res.json({ details });
    });
});



// Get ESR JPGs for an employee
app.get('/api/esr-jpgs', (req, res) => {
    const { employeeId, date } = req.query;

    if (!employeeId) {
        return res.status(400).json({ success: false, message: 'employeeId is required.' });
    }

    try {
        let stmt;
        let rows;
        if (date) {
            stmt = esrDb.prepare('SELECT id, date, shift_id, jpg_data FROM esr_jpgs WHERE employee_id = ? AND date = ? ORDER BY date DESC');
            rows = stmt.all(employeeId, date);
        } else {
            stmt = esrDb.prepare('SELECT id, date, shift_id, jpg_data FROM esr_jpgs WHERE employee_id = ? ORDER BY date DESC');
            rows = stmt.all(employeeId);
        }

        // Convert BLOB to base64 for JSON response
        const jpgs = rows.map(row => ({
            id: row.id,
            date: row.date,
            shift_id: row.shift_id,
            jpgData: row.jpg_data.toString('base64')
        }));

        res.json({ success: true, jpgs });
    } catch (error) {
        console.error('Error retrieving ESR JPGs:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve ESR JPGs.' });
    }
});

// Save ESR JPG
app.post('/api/save-esr-jpg', (req, res) => {
    const { employeeId, date, shiftId, jpgData } = req.body;

    if (!employeeId || !date || !shiftId || !jpgData) {
        return res.status(400).json({ success: false, message: 'employeeId, date, shiftId, and jpgData are required.' });
    }

    try {
        // Assume jpgData is base64 encoded
        const buffer = Buffer.from(jpgData, 'base64');
        const stmt = esrDb.prepare('INSERT INTO esr_jpgs (employee_id, date, shift_id, jpg_data) VALUES (?, ?, ?, ?)');
        stmt.run(employeeId, date, shiftId, buffer);
        res.json({ success: true, message: 'ESR JPG saved successfully.' });
    } catch (error) {
        console.error('Error saving ESR JPG:', error);
        res.status(500).json({ success: false, message: 'Failed to save ESR JPG.' });
    }
});

// Scheduled auto open/close functionality
function checkScheduledOpenClose(testHour = null, testMinute = null) {
    const now = new Date();
    const currentHour = testHour !== null ? testHour : now.getHours();
    const currentMinute = testMinute !== null ? testMinute : now.getMinutes();

    // Close at 11:30 PM
    if (currentHour === 23 && currentMinute >= 30) {
        db.set('store_closed', true).write();
        console.log('Store automatically closed at 11:30 PM');
    }
    // Open at 5:00 AM
    else if (currentHour === 5 && currentMinute >= 0) {
        db.set('store_closed', false).write();
        console.log('Store automatically opened at 5:00 AM');
    }
}

// Run scheduled check every minute
setInterval(checkScheduledOpenClose, 60 * 1000);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log('To access from other devices on your network, use your local IP address.');
    console.log('Example: http://192.168.1.100:3000');

    // Run initial check on startup
    checkScheduledOpenClose();
});
