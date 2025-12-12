document.addEventListener('DOMContentLoaded', () => {
    const viewReportBtn = document.querySelector('.view-report-btn');
    const viewEsrJpgsBtn = document.querySelector('.view-esr-jpgs-btn');
    const manageEmployeesBtn = document.querySelector('.manage-employees-btn');
    const logoutBtn = document.querySelector('.logout-btn');
    const updateBtn = document.querySelector('.update-btn');
    const updateContainer = document.querySelector('.update-container');
    const endShiftBtn = document.querySelector('.end-shift-btn');
    const startShiftBtn = document.querySelector('.start-shift-btn');


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
        const warningModal = document.getElementById('update-warning-modal');
        warningModal.style.display = 'block';

        // Handle confirm button
        const confirmBtn = document.getElementById('confirm-update-btn');
        confirmBtn.onclick = () => {
            warningModal.style.display = 'none';
            showUpdateDetailsModal();
        };

        // Handle cancel button
        const cancelBtn = document.getElementById('cancel-update-btn');
        cancelBtn.onclick = () => {
            warningModal.style.display = 'none';
        };
    });

    // Function to show update details modal
    const showUpdateDetailsModal = () => {
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
                    const detailsLines = data.details.split('\n').filter(line => line.trim() !== '');
                    const latestUpdate = detailsLines[0] || 'No update details available.';
                    content.innerHTML = `<h3>Latest Update:</h3><p>${latestUpdate}</p>`;
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
            showUpdateProgressModal();
        };
    };

    // Close update details modal
    const updateDetailsClose = document.getElementById('update-details-close');
    if (updateDetailsClose) {
        updateDetailsClose.addEventListener('click', () => {
            const modal = document.getElementById('update-details-modal');
            modal.style.display = 'none';
        });
    }

    // Close update warning modal
    const updateWarningClose = document.getElementById('update-warning-close');
    if (updateWarningClose) {
        updateWarningClose.addEventListener('click', () => {
            const modal = document.getElementById('update-warning-modal');
            modal.style.display = 'none';
        });
    }

    // Close update details modal when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('update-details-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
        const warningModal = document.getElementById('update-warning-modal');
        if (event.target === warningModal) {
            warningModal.style.display = 'none';
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

        // Reset date and shift ID selects
        document.getElementById('esr-jpg-date-select').innerHTML = '<option value="">Select employee first</option>';
        document.getElementById('esr-jpg-shift-id-select').innerHTML = '<option value="">Select date first</option>';
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



    // Close modal when clicking the close button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            // No auto-oc-modal to close
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

    // Handle ESR JPG employee select change to populate dates
    const esrJpgEmployeeSelect = document.getElementById('esr-jpg-employee-select');
    if (esrJpgEmployeeSelect) {
        esrJpgEmployeeSelect.addEventListener('change', () => {
            const selectedEmployeeId = esrJpgEmployeeSelect.value;
            if (!selectedEmployeeId) {
                document.getElementById('esr-jpg-date-select').innerHTML = '<option value="">Select employee first</option>';
                document.getElementById('esr-jpg-shift-id-select').innerHTML = '<option value="">Select date first</option>';
                return;
            }

            // Fetch ESR JPGs for the selected employee to get available dates
            fetch(`/api/esr-jpgs?employeeId=${selectedEmployeeId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.jpgs && data.jpgs.length > 0) {
                        const dateSelect = document.getElementById('esr-jpg-date-select');
                        dateSelect.innerHTML = '<option value="">Select a date</option>';
                        const uniqueDates = [...new Set(data.jpgs.map(jpg => jpg.date))].sort();
                        uniqueDates.forEach(date => {
                            const option = document.createElement('option');
                            option.value = date;
                            option.textContent = date;
                            dateSelect.appendChild(option);
                        });
                    } else {
                        document.getElementById('esr-jpg-date-select').innerHTML = '<option value="">No dates available</option>';
                    }
                    document.getElementById('esr-jpg-shift-id-select').innerHTML = '<option value="">Select date first</option>';
                })
                .catch(error => {
                    console.error('Error fetching ESR JPGs for dates:', error);
                    alert('Error loading dates.');
                });
        });
    }

    // Handle ESR JPG date select change to populate shift IDs
    const esrJpgDateSelect = document.getElementById('esr-jpg-date-select');
    if (esrJpgDateSelect) {
        esrJpgDateSelect.addEventListener('change', () => {
            const selectedEmployeeId = document.getElementById('esr-jpg-employee-select').value;
            const selectedDate = esrJpgDateSelect.value;
            if (!selectedEmployeeId || !selectedDate) {
                document.getElementById('esr-jpg-shift-id-select').innerHTML = '<option value="">Select date first</option>';
                return;
            }

            // Fetch ESR JPGs for the selected employee and date to get available shift IDs
            fetch(`/api/esr-jpgs?employeeId=${selectedEmployeeId}&date=${selectedDate}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.jpgs && data.jpgs.length > 0) {
                        const shiftIdSelect = document.getElementById('esr-jpg-shift-id-select');
                        shiftIdSelect.innerHTML = '<option value="">Select a shift ID</option>';
                        data.jpgs.forEach(jpg => {
                            const option = document.createElement('option');
                            option.value = jpg.id;
                            option.textContent = jpg.shift_id || 'N/A';
                            shiftIdSelect.appendChild(option);
                        });
                    } else {
                        document.getElementById('esr-jpg-shift-id-select').innerHTML = '<option value="">No shift IDs available</option>';
                    }
                })
                .catch(error => {
                    console.error('Error fetching ESR JPGs for shift IDs:', error);
                    alert('Error loading shift IDs.');
                });
        });
    }

    // Handle ESR JPG employee selection form submission
    const esrJpgEmployeeSelectionForm = document.getElementById('esr-jpg-employee-selection-form');
    if (esrJpgEmployeeSelectionForm) {
        esrJpgEmployeeSelectionForm.addEventListener('submit', (event) => {
            event.preventDefault();

            const selectedEmployeeId = document.getElementById('esr-jpg-employee-select').value;
            const selectedDate = document.getElementById('esr-jpg-date-select').value;
            const selectedShiftId = document.getElementById('esr-jpg-shift-id-select').value;
            if (!selectedEmployeeId) {
                alert('Please select an employee.');
                return;
            }
            if (!selectedDate) {
                alert('Please select a date.');
                return;
            }
            if (!selectedShiftId) {
                alert('Please select a shift ID.');
                return;
            }

            // Fetch and display the specific ESR JPG
            fetch(`/api/esr-jpgs?employeeId=${selectedEmployeeId}&date=${selectedDate}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.jpgs && data.jpgs.length > 0) {
                        const jpg = data.jpgs.find(j => j.id == selectedShiftId);
                        if (jpg) {
                            const grid = document.getElementById('esr-jpgs-grid');
                            grid.innerHTML = '';
                            const imageUrl = `data:image/jpeg;base64,${jpg.jpgData}`;
                            const item = document.createElement('div');
                            item.className = 'jpg-item';
                            item.innerHTML = `
                                <img src="${imageUrl}" alt="ESR JPG" onclick="window.open('${imageUrl}', '_blank')">
                                <div class="date">${jpg.date} - Shift ID: ${jpg.shift_id}</div>
                            `;
                            grid.appendChild(item);

                            // Show the JPGs modal
                            const jpgsModal = document.getElementById('esr-jpgs-modal');
                            jpgsModal.style.display = 'block';
                        } else {
                            alert('Selected shift ID not found.');
                        }
                    } else {
                        alert('No ESR JPG found for the selected criteria.');
                    }
                })
                .catch(error => {
                    console.error('Error fetching ESR JPG:', error);
                    alert('Error loading ESR JPG.');
                });

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

    // Function to show update progress modal
    const showUpdateProgressModal = () => {
        const modal = document.getElementById('update-progress-modal');
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.getElementById('progress-percentage');
        const remainingTime = document.getElementById('remaining-time');

        modal.style.display = 'block';
        progressFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        remainingTime.textContent = 'Time remaining: Calculating...';

        // Start the update
        fetch('/api/update-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert('Update failed: ' + data.message);
                modal.style.display = 'none';
                return;
            }

            // Poll for update status
            const pollInterval = setInterval(() => {
                fetch('/api/update-status')
                    .then(response => response.json())
                    .then(status => {
                        if (!status.updateInProgress) {
                            clearInterval(pollInterval);
                            modal.style.display = 'none';
                            alert('Update completed successfully!');
                            window.location.reload();
                            return;
                        }

                        // Calculate progress (assume 2 minutes total)
                        const startTime = new Date(status.updateStartTime);
                        const now = new Date();
                        const elapsed = (now - startTime) / 1000; // seconds
                        const totalTime = 120; // 2 minutes
                        const progress = (elapsed / totalTime) * 100;

                        progressFill.style.width = Math.min(progress, 100) + '%';
                        progressPercentage.textContent = Math.round(Math.min(progress, 100)) + '%';

                        if (progress >= 100) {
                            remainingTime.textContent = 'Update in progress...';
                        } else {
                            const remaining = Math.max(totalTime - elapsed, 0);
                            const minutes = Math.floor(remaining / 60);
                            const seconds = Math.floor(remaining % 60);
                            remainingTime.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                        }
                    })
                    .catch(error => {
                        console.error('Error polling update status:', error);
                    });
            }, 1000); // Poll every second
        })
        .catch(error => {
            console.error('Error starting update:', error);
            alert('Error starting update.');
            modal.style.display = 'none';
        });
    };
});
