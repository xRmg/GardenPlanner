// Garden Planner JavaScript

// Initialize garden grid
function initGardenGrid() {
    const gridContainer = document.querySelector('.grid-container');
    const gridSize = document.getElementById('grid-size').value;
    const [rows, cols] = gridSize.split('x').map(Number);

    gridContainer.innerHTML = '';
    for (let i = 0; i < rows * cols; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => openPlantPopup(i));
        gridContainer.appendChild(cell);
    }
}

// Open plant details popup
function openPlantPopup(index) {
    const popup = document.getElementById('plant-popup');
    popup.classList.add('active');

    // Simulate plant data
    const plants = {
        tomato: {
            name: 'Tomato',
            plantingDate: 'Mar 1, 2026',
            growthDuration: '60 days',
            spacing: '12 inches',
            variety: 'Heirloom',
            companionPlants: ['Basil', 'Marigold'],
            pests: 'Aphids'
        },
        carrot: {
            name: 'Carrot',
            plantingDate: 'Feb 28, 2026',
            growthDuration: '75 days',
            spacing: '3 inches',
            variety: 'Nantes',
            companionPlants: ['Onions', 'Peas'],
            pests: 'Carrot Fly'
        }
    };

    // Update popup content
    const plantData = plants.tomato; // Simulate selected plant
    document.querySelector('.popup-content h2').textContent = plantData.name;
    document.querySelector('.popup-grid .popup-section:first-child p').innerHTML =
        `<p>Planting date: ${plantData.plantingDate}</p>
    <p>Growth duration: ${plantData.growthDuration}</p>
    <p>Spacing: ${plantData.spacing}</p>`;
    document.querySelector('.popup-grid .popup-section:last-child p').innerHTML =
        `<p>Variety: ${plantData.variety}</p>
    <p>Companion plants: ${plantData.companionPlants.join(', ')}</p>
    <p>Pests: ${plantData.pests}</p>`;
}

// Close popup
function closePopup() {
    document.getElementById('plant-popup').classList.remove('active');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initGardenGrid();
    document.getElementById('grid-size').addEventListener('change', initGardenGrid);
    document.querySelector('.close-btn').addEventListener('click', closePopup);

    // Simulate plant selection
    document.querySelectorAll('.plant-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const plant = icon.dataset.plant;
            // Add plant to grid (simplified)
            const cells = document.querySelectorAll('.grid-cell');
            if (cells.length > 0) {
                cells[0].classList.add('planted');
                cells[0].innerHTML = `<img src="images/${plant}.png" alt="${plant}">`;
            }
        });
    });
});