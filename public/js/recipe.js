const { showError } = require('../../modules/errorHandler.js');

let currentPage = 1;
let currentRecipeName = '';

// Function to update the URI without reloading the page
function updateURI(uri) {
    history.pushState(null, '', uri);
}

function attachEventListeners() {
    document.querySelector('#search-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const recipeName = event.target.elements.recipeName.value;
        currentRecipeName = recipeName;
        currentPage = 1; // Reset to the first page for new search
        window.location.href = `/search?q=${encodeURIComponent(recipeName)}&page=${currentPage}`;
    });
}

// Call attachEventListeners to set up the event listener
attachEventListeners();

let recipeName = new URLSearchParams(window.location.search).get('q');
if (recipeName) {
    try {
        const decodedRecipeName = decodeURIComponent(recipeName);
        const recipeData = JSON.parse(localStorage.getItem('selectedRecipe'));

        if (recipeData && recipeData.label === decodedRecipeName) {
            const elements = {
                recipeImage: document.getElementById('recipe-image'),
                recipeNameElement: document.getElementById('recipe-name'),
                recipeCookingTime: document.getElementById('recipe-cooking-time'),
                recipeIngredients: document.getElementById('recipe-ingredients'),
            };

            if (Object.values(elements).every(el => el)) {
                elements.recipeImage.src = recipeData.image;
                elements.recipeImage.alt = recipeData.label;
                elements.recipeNameElement.textContent = recipeData.label;
                elements.recipeCookingTime.textContent = `Cooking Time: ${recipeData.totalTime} min`;
                elements.recipeIngredients.innerHTML = `
                    <ul>
                        ${recipeData.ingredientLines.map(ingredient => `
                            <li>${ingredient}</li>
                        `).join('')}
                    </ul>
                `;
            } else {
                showError();
            }
        } else {
            showError();
        }
    } catch (error) {
        showError('Invalid recipe name in the URL.');
    }
} else {
    showError();
}

function showError(message) {
    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.id = 'error-message';
    errorMessageDiv.innerHTML = `
        <div class="error-title">Whoops! This one's a bit undercooked.</div>
        <div class="error-message">${message || "The page you're looking for is unavailable. Please try again using our menu at the top."}</div>
    `;
    
    const form = document.getElementById('search-form');
    form.parentNode.insertBefore(errorMessageDiv, form.nextSibling);
    errorMessageDiv.style.display = 'block';
}