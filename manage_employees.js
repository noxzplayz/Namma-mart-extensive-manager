document.addEventListener('DOMContentLoaded', () => {
    const addEmployeeBtn = document.querySelector('.add-employee-btn');
    const employeeList = document.querySelector('.employee-list');

    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', () => {
            window.open('add_employee.html', '_blank');
        });
    }

    async function fetchEmployees() {
        try {
            const response = await fetch('/api/employees');
            const employees = await response.json();
            renderEmployees(employees);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    }

    function renderEmployees(employees) {
        employeeList.innerHTML = '';
        employees.forEach(employee => {
            const card = document.createElement('div');
            card.className = 'employee-card';
            card.innerHTML = `
                <span class="employee-name">${employee.name}</span>
                <div class="employee-actions">
                    <button class="edit-btn" data-id="${employee.id}">Edit</button>
                    <button class="delete-btn" data-id="${employee.id}">Delete</button>
                </div>
            `;
            employeeList.appendChild(card);
        });
    }

    employeeList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const employeeId = event.target.dataset.id;
            if (confirm('Are you sure you want to delete this employee?')) {
                try {
                    const response = await fetch(`/api/employees/${employeeId}`, {
                        method: 'DELETE',
                    });
                    const result = await response.json();
                    if (result.success) {
                        fetchEmployees(); // Refresh the list
                    } else {
                        alert('Error deleting employee: ' + result.message);
                    }
                } catch (error) {
                    console.error('Error deleting employee:', error);
                    alert('An error occurred while deleting the employee.');
                }
            }
        } else if (event.target.classList.contains('edit-btn')) {
            const employeeId = event.target.dataset.id;
            window.open(`edit_employee.html?id=${employeeId}`, '_blank');
        }
    });

    fetchEmployees();
});