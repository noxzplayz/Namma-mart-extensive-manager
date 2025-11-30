document.addEventListener('DOMContentLoaded', () => {
    const viewReportBtn = document.querySelector('.view-report-btn');
    const viewEsrJpgsBtn = document.querySelector('.view-esr-jpgs-btn');
    const manageEmployeesBtn = document.querySelector('.manage-employees-btn');
    const logoutBtn = document.querySelector('.logout-btn');
    const updateBtn = document.querySelector('.update-btn');
    const updateContainer = document.querySelector('.update-container');
    const endShiftBtn = document.querySelector('.end-shift-btn');
    const startShiftBtn = document.querySelector('.start-shift-btn');
    const autoOcBtn = document.querySelector('.auto-oc-btn');

    // Function to check for updates
    const checkForUpdates = () => {
        fetch('/api/check-update')
            .then(response => response.json())
            .then(data => {
                if (data.updateAvailable) {
                    updateContainer.classList.add('update-available');
                } else {
                    updateContainer.classList.remove('update-available');
                }
            })
            .catch(error => {
                console.error('Error checking for updates:', error);
            });
    };

    // Check for updates on page load
    checkForUpdates();

    // Check for updates every 5 minutes
    setInterval(checkForUpdates, 5 * 60 * 1000);

    // Update button click handler
    updateBtn.addEventListener('click', () => {
        const modal = document.getElementById('update-details-modal');
        const content = document.getElementById('update-details-content');
        const proceedBtn = document.getElementById('proceed-update-btn');

        // Show modal and fetch update details
        modal.style.display = 'block';
        content.innerHTML = '<p>Loading update details...</p>';

        fetch('/api/update-details')
            .then(response => response.json())
            .then(data => {
                if (data.details) {
                    const detailsHtml = data.details.split('\n').map(line => `<p>${line}</p>`).join('');
                    content.innerHTML = `<h3>What's New in This Update:</h3>${detailsHtml}`;
                } else {
                    content.innerHTML = '<p>Unable to fetch update details. Proceed with update anyway?</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching update details:', error);
                content.innerHTML = '<p>Error loading update details. Proceed with update anyway?</p>';
            });

        // Handle proceed button
        proceedBtn.onclick = () => {
            modal.style.display = 'none';
            fetch('/api/update-app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Update successful: ' + data.message);
                    // Optionally reload the page or redirect
                    window.location.reload();
                } else {
                    alert('Update failed: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error updating app:', error);
                alert('Error updating app.');
            });
        };
    });

    // Close update details modal
    const updateDetailsClose = document.getElementById('update-details-close');
    if (updateDetailsClose) {
        updateDetailsClose.addEventListener('click', () => {
            const modal = document.getElementById('update-details-modal');
            modal.style.display = 'none';
        });
    }

    // Close update details modal when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('update-details-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Check store status on page load
    fetch('/api/store-status')
        .then(response => response.json())
        .then(data => {
            if (data.closed) {
                viewReportBtn.style.display = 'none';
                viewEsrJpgsBtn.style.display = 'none';
                manageEmployeesBtn.style.display = 'none';
                logoutBtn.style.display = 'none';
                endShiftBtn.style.display = 'none';
                startShiftBtn.style.display = 'block';
            } else {
                viewReportBtn.style.display = 'block';
                viewEsrJpgsBtn.style.display = 'block';
                manageEmployeesBtn.style.display = 'block';
                logoutBtn.style.display = 'block';
                endShiftBtn.style.display = 'block';
                startShiftBtn.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error fetching store status:', error);
        });

    viewReportBtn.addEventListener('click', () => {
        window.open('view_report.html', '_blank');
    });

    viewEsrJpgsBtn.addEventListener('click', () => {
        const modal = document.getElementById('esr-jpg-employee-selection-modal');
        modal.style.display = 'block';

        // Fetch employees and populate select
        fetch('/api/employees')
            .then(response => response.json())
            .then(employees => {
                const select = document.getElementById('esr-jpg-employee-select');
                select.innerHTML = '<option value="">Select an employee</option>';
                employees.forEach(employee => {
                    const option = document.createElement('option');
                    option.value = employee.id;
                    option.textContent = employee.name;
                    select.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error fetching employees:', error);
                alert('Error loading employees.');
            });
    });

    manageEmployeesBtn.addEventListener('click', () => {
        window.open('manage_employees.html', '_blank');
    });

    logoutBtn.addEventListener('click', () => {
        window.location.href = '/';
    });

    endShiftBtn.addEventListener('click', () => {
        const password = prompt('Enter admin password to request End Shift OTP:');
        if (!password) return;

        // Step 1: verify password and request OTP to be emailed
        fetch('/api/verify-admin-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        })
        .then(response => response.json())
        .then(async data => {
            if (!data || !data.success) {
                alert('Incorrect password. Cannot request OTP.');
                return;
            }

            // If server returned a debug OTP (local dev), show it so testing is easier
            if (data.debugOtp) {
                alert('OTP (debug): ' + data.debugOtp + '\n(Use this only for local testing)');
            } else {
                alert('OTP sent to configured admin email. Please check your inbox.');
            }

            // Prompt for OTP and confirm
            const otp = prompt('Enter the 5-digit OTP sent to the admin email:');
            if (!otp) {
                alert('OTP is required to end shift.');
                return;
            }

            try {
                const confirmRes = await fetch('/api/confirm-endshift-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ otp })
                });
                const confirmData = await confirmRes.json();
                if (confirmData && confirmData.success) {
                    alert('Shift ended successfully. Store is now closed.');
                    viewReportBtn.style.display = 'none';
                    viewEsrJpgsBtn.style.display = 'none';
                    manageEmployeesBtn.style.display = 'none';
                    logoutBtn.style.display = 'none';
                    endShiftBtn.style.display = 'none';
                    startShiftBtn.style.display = 'block';
                } else {
                    alert('OTP verification failed: ' + (confirmData.message || 'Invalid OTP'));
                }
            } catch (err) {
                console.error('Error confirming OTP:', err);
                alert('Error verifying OTP.');
            }
        })
        .catch(error => {
            console.error('Error requesting OTP:', error);
            alert('Error requesting OTP.');
        });
    });

    startShiftBtn.addEventListener('click', () => {
        const password = prompt('Enter admin password to start shift:');
        if (password) {
            fetch('/api/start-shift', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Shift started successfully. Store is now open.');
                    viewReportBtn.style.display = 'block';
                    manageEmployeesBtn.style.display = 'block';
                    logoutBtn.style.display = 'block';
                    endShiftBtn.style.display = 'block';
                    startShiftBtn.style.display = 'none';
                } else {
                    alert('Incorrect password. Shift not started.');
                }
            })
            .catch(error => {
                console.error('Error starting shift:', error);
                alert('Error starting shift.');
            });
        }
    });

    autoOcBtn.addEventListener('click', () => {
        const modal = document.getElementById('auto-oc-modal');
        modal.style.display = 'block';

        // Fetch current settings
        fetch('/api/auto-oc-settings')
            .then(response => response.json())
            .then(settings => {
                if (settings.open_time) {
                    const [openHours24, openMinutes] = settings.open_time.split(':');
                    const openH24 = parseInt(openHours24);
                    const openH12 = openH24 % 12 || 12;
                    const openAmpm = openH24 >= 12 ? 'PM' : 'AM';
                    document.getElementById('open-hours').value = openH12;
                    document.getElementById('open-minutes').value = parseInt(openMinutes);
                    document.getElementById('open-ampm').value = openAmpm;
                }
                if (settings.close_time) {
                    const [closeHours24, closeMinutes] = settings.close_time.split(':');
                    const closeH24 = parseInt(closeHours24);
                    const closeH12 = closeH24 % 12 || 12;
                    const closeAmpm = closeH24 >= 12 ? 'PM' : 'AM';
                    document.getElementById('close-hours').value = closeH12;
                    document.getElementById('close-minutes').value = parseInt(closeMinutes);
                    document.getElementById('close-ampm').value = closeAmpm;
                }
                // Set enable checkboxes
                document.getElementById('enable-open').checked = settings.enable_open !== false;
                document.getElementById('enable-close').checked = settings.enable_close !== false;
            })
            .catch(error => {
                console.error('Error loading settings:', error);
            });
    });

    // Close modal when clicking the close button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('auto-oc-modal');
            modal.style.display = 'none';
        });
    }

    // Close employee selection modal
    const employeeSelectionClose = document.getElementById('employee-selection-close');
    if (employeeSelectionClose) {
        employeeSelectionClose.addEventListener('click', () => {
            const modal = document.getElementById('employee-selection-modal');
            modal.style.display = 'none';
        });
    }

    // Close ESR JPG employee selection modal
    const esrJpgEmployeeSelectionClose = document.getElementById('esr-jpg-employee-selection-close');
    if (esrJpgEmployeeSelectionClose) {
        esrJpgEmployeeSelectionClose.addEventListener('click', () => {
            const modal = document.getElementById('esr-jpg-employee-selection-modal');
            modal.style.display = 'none';
        });
    }

    // Close ESR JPGs modal
    const esrJpgsClose = document.getElementById('esr-jpgs-close');
    if (esrJpgsClose) {
        esrJpgsClose.addEventListener('click', () => {
            const modal = document.getElementById('esr-jpgs-modal');
            modal.style.display = 'none';
        });
    }

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('auto-oc-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
        const employeeModal = document.getElementById('employee-selection-modal');
        if (event.target === employeeModal) {
            employeeModal.style.display = 'none';
        }
        const esrJpgEmployeeModal = document.getElementById('esr-jpg-employee-selection-modal');
        if (event.target === esrJpgEmployeeModal) {
            esrJpgEmployeeModal.style.display = 'none';
        }
        const esrJpgsModal = document.getElementById('esr-jpgs-modal');
        if (event.target === esrJpgsModal) {
            esrJpgsModal.style.display = 'none';
        }
    });

    // Handle Auto O/C form submission
    const autoOcForm = document.getElementById('auto-oc-form');
    if (autoOcForm) {
        autoOcForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const enableOpen = document.getElementById('enable-open').checked;
            const enableClose = document.getElementById('enable-close').checked;
            const openHours = document.getElementById('open-hours').value;
            const openMinutes = document.getElementById('open-minutes').value;
            const openAmpm = document.getElementById('open-ampm').value;
            const closeHours = document.getElementById('close-hours').value;
            const closeMinutes = document.getElementById('close-minutes').value;
            const closeAmpm = document.getElementById('close-ampm').value;

            // Validate inputs
            if (!openHours || !openMinutes || !closeHours || !closeMinutes) {
                alert('Please fill in all time fields.');
                return;
            }

            // Send to server
            fetch('/api/auto-oc-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enable_open: enableOpen,
                    enable_close: enableClose,
                    open_hours: openHours,
                    open_minutes: openMinutes,
                    open_ampm: openAmpm,
                    close_hours: closeHours,
                    close_minutes: closeMinutes,
                    close_ampm: closeAmpm
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Auto Open/Close settings saved successfully!');
                    // Close modal
                    const modal = document.getElementById('auto-oc-modal');
                    modal.style.display = 'none';
                } else {
                    alert('Error saving settings: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error saving settings:', error);
                alert('Error saving settings.');
            });
        });
    }

    // Handle employee selection form submission
    const employeeSelectionForm = document.getElementById('employee-selection-form');
    if (employeeSelectionForm) {
        employeeSelectionForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const selectedEmployeeId = document.getElementById('employee-select').value;
            const selectedDate = document.getElementById('shift-summary-date').value;
            if (!selectedEmployeeId) {
                alert('Please select an employee.');
                return;
            }
            if (!selectedDate) {
                alert('Please select a date.');
                return;
            }

            // Open end_shift_report.html with employeeId and date parameters
            window.open(`end_shift_report.html?employeeId=${selectedEmployeeId}&date=${selectedDate}`, '_blank');

            // Close the modal
            const modal = document.getElementById('employee-selection-modal');
            modal.style.display = 'none';
        });
    }

    let currentEmployeeId = null;

    // Function to fetch and display ESR JPGs
    const fetchAndDisplayEsrJpgs = (employeeId, date = null) => {
        let url = `/api/esr-jpgs?employeeId=${employeeId}`;
        if (date) {
            url += `&date=${date}`;
        }

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const grid = document.getElementById('esr-jpgs-grid');
                    grid.innerHTML = '';

                    if (data.jpgs && data.jpgs.length > 0) {
                        data.jpgs.forEach(jpg => {
                            const imageUrl = `data:image/jpeg;base64,${jpg.jpgData}`;
                            const item = document.createElement('div');
                            item.className = 'jpg-item';
                            item.innerHTML = `
                                <img src="${imageUrl}" alt="ESR JPG" onclick="window.open('${imageUrl}', '_blank')">
                                <div class="date">${jpg.date}</div>
                            `;
                            grid.appendChild(item);
                        });
                    } else {
                        grid.innerHTML = '<p>No ESR JPGs found for this employee.</p>';
                    }

                    // Show the JPGs modal
                    const jpgsModal = document.getElementById('esr-jpgs-modal');
                    jpgsModal.style.display = 'block';
                } else {
                    alert('Error loading ESR JPGs: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error fetching ESR JPGs:', error);
                alert('Error loading ESR JPGs.');
            });
    };

    // Handle ESR JPG employee selection form submission
    const esrJpgEmployeeSelectionForm = document.getElementById('esr-jpg-employee-selection-form');
    if (esrJpgEmployeeSelectionForm) {
        esrJpgEmployeeSelectionForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const selectedEmployeeId = document.getElementById('esr-jpg-employee-select').value;
            if (!selectedEmployeeId) {
                alert('Please select an employee.');
                return;
            }

            currentEmployeeId = selectedEmployeeId;

            // Fetch ESR JPGs for the selected employee
            fetchAndDisplayEsrJpgs(selectedEmployeeId);

            // Close the employee selection modal
            const modal = document.getElementById('esr-jpg-employee-selection-modal');
            modal.style.display = 'none';
        });
    }

    // Handle apply date filter
    const applyDateFilterBtn = document.getElementById('apply-date-filter-btn');
    if (applyDateFilterBtn) {
        applyDateFilterBtn.addEventListener('click', () => {
            if (!currentEmployeeId) {
                alert('Please select an employee first.');
                return;
            }

            const dateFilter = document.getElementById('esr-jpg-date-filter').value;
            fetchAndDisplayEsrJpgs(currentEmployeeId, dateFilter);
        });
    }

    // Handle clear date filter
    const clearDateFilterBtn = document.getElementById('clear-date-filter-btn');
    if (clearDateFilterBtn) {
        clearDateFilterBtn.addEventListener('click', () => {
            if (!currentEmployeeId) {
                alert('Please select an employee first.');
                return;
            }

            document.getElementById('esr-jpg-date-filter').value = '';
            fetchAndDisplayEsrJpgs(currentEmployeeId);
        });
    }
});
