document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById('inventory-body');

    try {
        const response = await fetch('/api/inventory');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
      
        tableBody.innerHTML = '';

    
        data.forEach(row => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>${row.StoreName}</td>
                <td>${row.ManagerName}</td>
                <td>${row.BodyStyle}</td>
                <td><strong>${row.AvailableVehicles}</strong></td>
            `;
            
            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error fetching inventory:", error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color: red;">Failed to load data. Check console.</td></tr>`;
    }
});
