document.addEventListener('DOMContentLoaded', () => {

    fetch('/session-data')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (document.querySelector('#username')) {
                    const userNameID = document.querySelector('#username');
                    showUsername(userNameID, data.username);
                }
            
                const setActivePage = (button) => {
                    document.querySelectorAll('.active').forEach(activeButton => {
                        activeButton.classList.remove('active');
                    });
                    button.classList.add('active');
            
                    const mainContainer = document.getElementById('main-container');
                    mainContainer.innerHTML = '';
            
                    if (button.textContent.includes('Personal Info')) {
                        showPersonalInfo(mainContainer, data.userID);
            
                    } else if (button.textContent.includes('Profile Settings')) {
                        showProfileSettings(mainContainer, data.userID);
            
                    } else if (button.textContent.includes('Favourites')) {
                        showFavourites(mainContainer, data.userID);
                    }
                };
            
                document.querySelectorAll('.nav-item').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const clickedButton = event.target.closest('.nav-item');
                        setActivePage(clickedButton);
                    });
                });
            
                // Render the active page on DOMContentLoaded
                const activeButton = document.querySelector('.nav-item.active');
                if (activeButton) {
                    setActivePage(activeButton);
                }
            }
        })
        .catch(error => console.error('Error fetching session data:', error));
});

// Function to show username
function showUsername(userNameID, username) {
    userNameID.textContent = `Hi, ${username}`;
}

function showPersonalInfo(mainContainer, userID) {
    fetch(`/read-user/${userID}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch user data');
            return response.json();
        })
        .then(data => {
            mainContainer.innerHTML = `
                <h2>Personal Info</h2>
                <form id="personal-info-form">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" value="${data.email}" readonly>
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" value="${data.username}" readonly>
                </form>    
                <div class="button-container">
                    <button id="logout-button">Log Out</button>
                    <button id="delete-button">Delete Account</button>
                </div>            
            `;

            document.querySelector('#logout-button').addEventListener('click', () => {
                localStorage.clear();
                window.location.href = '/login';
            });
        })
        .catch(error => console.error('Error:', error));
}

function showProfileSettings(mainContainer, userID) {
    fetch(`/read-user/${userID}`)
        .then(response => response.json())
        .then(data => {
            mainContainer.innerHTML = `
                <h2>Update Your Account Information</h2>
                <div class="update-section">
                    <label>Email Address:</label>
                    <div class="input-container"> 
                        <p id="email-display" class="display">${data.email}</p>
                        <button class="edit-button" data-field="email">Edit</button>
                    </div>
                    <div class="edit-field hidden" id="email-field">
                        <input type="email" id="email-input" placeholder="Enter new email address"">
                        <button class="save-button" data-field="email">Save</button>
                        <button class="cancel-button" data-field="email">Cancel</button>
                    </div>
                    <p id="email-error" class="error-message hidden"></p>
                </div>

                <div class="update-section">
                    <label>Username:</label>
                    <div class="input-container">
                        <p id="username-display" class="display">${data.username}</p>
                        <button class="edit-button" data-field="username">Edit</button>
                    </div>
                    <div class="edit-field hidden" id="username-field">
                        <input type="text" id="username-input" class="input" placeholder="Enter new username">
                        <button class="save-button" data-field="username">Save</button>
                        <button class="cancel-button" data-field="username">Cancel</button>
                    </div>
                    <p id="username-error" class="error-message hidden"></p>
                </div>

                <div class="update-section">
                    <label>Password:</label>
                    <div class="input-container">
                        <p id="password-display" class="display">
                            ${Array(15).fill('\u2022').join('')}
                        </p>
                        <button class="edit-button" data-field="password">Edit</button>
                    </div>
                    <div class="edit-field hidden" id="password-field">
                        <input type="password" id="password-input" placeholder="Enter new password">
                        <button class="save-button" data-field="password">Save</button>
                        <button class="cancel-button" data-field="password">Cancel</button>
                    </div>
                    <p id="password-error" class="error-message hidden"></p>
                </div>
            `;
            document.querySelectorAll('.input').forEach(input => {
                input.addEventListener('click', (event) => {
                    const field = event.target.id.split('-')[0];
                    const inputElement = document.getElementById(`${field}-input`);
                    const errorElement = document.getElementById(`${field}-error`);
                    if (errorElement) {
                        errorElement.classList.remove('visible');
                        inputElement.classList.remove('error')
                    }
                });
            });

            document.querySelectorAll('.edit-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const field = event.target.dataset.field;
                    document.getElementById(`${field}-display`).style.display = 'none';
                    document.getElementById(`${field}-field`).classList.remove('hidden');
                    event.target.style.display = 'none';
                });
            });
            
            document.querySelectorAll('.cancel-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const field = event.target.dataset.field;
                    document.getElementById(`${field}-display`).style.display = 'block';
                    document.getElementById(`${field}-field`).classList.add('hidden');
                    document.getElementById(`${field}-field`).classList.remove('error');
                    document.querySelector(`.edit-button[data-field="${field}"]`).style.display = 'block';

                    document.getElementById(`${field}-error`).classList.remove('visible');
                });
            });
            
            document.querySelectorAll('.save-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const field = event.target.dataset.field;
                    const newValue = document.getElementById(`${field}-input`).value;
            
                    // Send the updated value to the backend
                    fetch(`/update-user/${userID}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [field]: newValue })
                    })
                    .then(response => response.json())
                    .then(data => {
                        const errorElement = document.getElementById(`${field}-error`);
                        const inputElement = document.getElementById(`${field}-input`);

                        if (!data.success) {
                            errorElement.textContent = data.message;
                            errorElement.classList.add('visible');
                            inputElement.classList.add('error')
                            return;
                        }
                        if (data.success) {
                            errorElement.classList.remove('visible');
                            alert(`${field} updated successfully!`);
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(error => console.error('Error:', error));
                });
            });
        })
        .catch(error => console.error('Error:', error));
}

function showFavourites(mainContainer) {
    mainContainer.innerHTML = `
        <h2>Favourites</h2>
        <div id="favourites"></div>
    `;
}

// Function to fetch favourite recipes
// async function fetchFavourites(userID) {
//     try {
//         const response = await fetch(`/search-favourites`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ userID })
//         });
//         const data = await response.json();

//         if (data.success) {
//             renderFavouriteRecipes(data.favourites);
//         } else {
//             console.error('Error fetching favourites:', data.message);
//         }
//     } catch (error) {
//         console.error('Error fetching favourites:', error);
//     }
// }

// // Function to render favourite recipes
// function renderFavouriteRecipes(favourites) {
//     const favouritesContainer = document.getElementById('favourites');
//     favouritesContainer.innerHTML = favourites.map((recipe, index) => {
//         return `
//             <div class="recipe" data-index="${index}">
//                 <div class="recipe-image-container">
//                     <img src="${recipe.image}" alt="${recipe.label}">
//                 </div>
//                 <div class="recipe-column">
//                     <div class="dish-type">${recipe.dishType}</div>
//                     <div class="recipe-name">${recipe.label}</div>
//                     <div class="time-container">
//                         <div class="clock-image"></div> 
//                         <h4 class="cooking-time">${recipe.totalTime} min</h4>
//                     </div>
//                 </div>
//             </div>
//         `;
//     }).join('');

//     document.querySelectorAll('.recipe').forEach((recipeElement, index) => {
//         recipeElement.addEventListener('click', () => {
//             const recipe = favourites[index];
//             recipe.label = recipe.label.toLowerCase();
//             localStorage.setItem('selectedRecipe', JSON.stringify(recipe));
//             window.location.href = `/recipe?q=${encodeURIComponent(recipe.label)}`;
//         });
//     });
// }

// Fetch favourites on page load

// function fetchFavouritesOnPageLoad() {
//     fetch('/session-data')
//     .then(response => response.json())
//     .then(data => {
//         if (data.success) {
//             userID = data.userID;
//             console.log(userID)
//             fetchFavourites(userID);
//         } else {
//             console.error('Error: User is not logged in.');
//         }
//     });
// }

// fetchFavouritesOnPageLoad();