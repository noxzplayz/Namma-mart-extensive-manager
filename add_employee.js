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

// Get the element with id="defaultOpen" and click on it
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.tab-link.active').click();

    const dobInput = document.getElementById('dob');
    const maritalStatusInput = document.getElementById('marital-status');

    if (dobInput && maritalStatusInput) {
        dobInput.addEventListener('change', () => {
            const dob = new Date(dobInput.value);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
                age--;
            }

            if (age >= 18) {
                maritalStatusInput.disabled = false;
            } else {
                maritalStatusInput.disabled = true;
                maritalStatusInput.value = ''; // Reset the value
            }
        });
    }

    const fullTimeSelect = document.getElementById('full-time');
    const fullTimeDetails = document.getElementById('full-time-details');

    if (fullTimeSelect && fullTimeDetails) {
        fullTimeSelect.addEventListener('change', () => {
            if (fullTimeSelect.value === 'yes') {
                fullTimeDetails.style.display = 'block';
            } else {
                fullTimeDetails.style.display = 'none';
                if (fullTimeSelect.value === 'no') {
                    alert('This employee will not have fixed start, end, or break times.');
                }
            }
        });
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
                const response = await fetch('/api/employees', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });

                const result = await response.json();

                if (result.success) {
                    alert('Employee added successfully!');
                    window.close();
                } else {
                    alert('Error adding employee: ' + result.message);
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('An error occurred while submitting the form.');
            }
        });
    }
});