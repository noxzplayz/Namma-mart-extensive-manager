function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const employeeId = urlParams.get('id');

    // Set the default tab to be open
    document.querySelector('.tab-link.active').click();

    async function fetchEmployeeData() {
        try {
            const response = await fetch(`/api/employees/${employeeId}`);
            const employee = await response.json();
            populateForm(employee);
        } catch (error) {
            console.error('Error fetching employee data:', error);
        }
    }

    function populateForm(employee) {
        const forms = document.querySelectorAll('.tab-content form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (employee[input.name]) {
                    if (input.type === 'checkbox') {
                        if (employee[input.name].includes(input.value)) {
                            input.checked = true;
                        }
                    } else {
                        input.value = employee[input.name];
                    }
                }
            });
        });

        // Trigger change events to apply conditional logic
        const dobInput = document.getElementById('dob');
        const fullTimeSelect = document.getElementById('full-time');
        if (dobInput) dobInput.dispatchEvent(new Event('change'));
        if (fullTimeSelect) fullTimeSelect.dispatchEvent(new Event('change'));
    }

    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async (event) => {
            event.preventDefault();

            const forms = document.querySelectorAll('.tab-content form');
            const formData = {};

            forms.forEach(form => {
                const inputs = form.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.type === 'checkbox') {
                        if (input.checked) {
                            if (!formData[input.name]) {
                                formData[input.name] = [];
                            }
                            formData[input.name].push(input.value);
                        }
                    } else {
                        formData[input.name] = input.value;
                    }
                });
            });

            try {
                const response = await fetch(`/api/employees/${employeeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });

                const result = await response.json();

                if (result.success) {
                    alert('Employee updated successfully!');
                    window.close();
                } else {
                    alert('Error updating employee: ' + result.message);
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('An error occurred while submitting the form.');
            }
        });
    }

    if (employeeId) {
        fetchEmployeeData();
    }
});