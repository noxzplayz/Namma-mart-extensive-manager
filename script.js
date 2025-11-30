document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.login-container form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent the form from submitting the traditional way

            const username = event.target.username.value;
            const password = event.target.password.value;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });

                const data = await response.json();

                if (data.success) {
                    if (data.redirectUrl) {
                        localStorage.setItem('username', username);
                        if (data.employeeId) {
                            localStorage.setItem('employeeId', data.employeeId);
                        } else {
                            // Fallback: Fetch employee ID and store it
                            fetch('/api/employees')
                                .then(res => res.json())
                                .then(employees => {
                                    const employee = employees.find(emp => emp.username === username);
                                    if (employee) {
                                        localStorage.setItem('employeeId', employee.id);
                                    }
                                    window.location.href = data.redirectUrl;
                                })
                                .catch(error => {
                                    console.error('Error fetching employee ID:', error);
                                    window.location.href = data.redirectUrl;
                                });
                        }
                        window.location.href = data.redirectUrl;
                    }
                } else if (data.requiresAdminApproval) {
                    // Show OTP input for admin approval
                    const loginContainer = document.querySelector('.login-container');
                    const debugOtpHtml = data.debugOtp ? `<p style="color: red; font-weight: bold;">Debug OTP: ${data.debugOtp}</p>` : '';
                    loginContainer.innerHTML = `
                        <h2>ADMIN APPROVAL REQUIRED</h2>
                        <p>${data.message}</p>
                        ${debugOtpHtml}
                        <form id="otp-form">
                            <div class="input-group">
                                <input type="text" id="otp" name="otp" required>
                                <label for="otp">ENTER OTP</label>
                            </div>
                            <button type="submit">VERIFY OTP</button>
                        </form>
                    `;

                    const otpForm = document.getElementById('otp-form');
                    otpForm.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const otp = event.target.otp.value;

                        try {
                            const otpResponse = await fetch('/api/verify-admin-approval-otp', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ otp, employeeId: data.employeeId }),
                            });

                            const otpData = await otpResponse.json();

                            if (otpData.success) {
                                localStorage.setItem('username', username);
                                localStorage.setItem('employeeId', data.employeeId);
                                window.location.href = otpData.redirectUrl;
                            } else {
                                alert('Invalid OTP. Please try again.');
                            }
                        } catch (error) {
                            console.error('Error verifying OTP:', error);
                            alert('An error occurred. Please try again later.');
                        }
                    });
                } else {
                    alert('Login failed. Please try again.');
                }
            } catch (error) {
                console.error('Error during login:', error);
                alert('An error occurred. Please try again later.');
            }
        });
    }
});