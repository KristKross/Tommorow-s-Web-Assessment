// Required modules
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const MySQLStore = require('express-mysql-session')(session);

// Added dotenv to load environment variables
dotenv.config();

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306, 
    waitForConnections: true, 
    connectionLimit: 10,
    queueLimit: 0 
});

const sessionStore = new MySQLStore({}, connection);

connection.getConnection((err) => {
    if (err) {
        console.error('Error connecting to the database pool:', err);
        return;
    }
    console.log('Connected to the database pool');
});

// Variables to process environment variables
const app = express();
const port = 3000;
const appId = process.env.APP_ID;
const apiKey = process.env.API_KEY;

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    key: 'recipe_session',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

// Routes to serve the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/home.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/search.html'));
});

app.get('/recipe', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/recipe.html'));
});

app.get('/favourites', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/favourites.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/register.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html/profile.html'));
});

app.get('/session-data', (req, res) => {
    if (req.session && req.session.username) {
        const query = 'SELECT username FROM users WHERE UserID = ?';
        connection.query(query, [req.session.userID], (err, results) => {
            if (err) {
                console.error('Error fetching username:', err);
                res.json({ success: false, message: 'Error occurred' });
                return;
            }
            if (results.length > 0) {
                req.session.username = results[0].username;
                res.json({ success: true, username: req.session.username, userID: req.session.userID });
            } else {
                res.json({ success: false, message: 'User not found' });
            }
        });
    } else {
        res.json({ success: false, message: 'No user logged in' });
    }
});

function getSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) {
        return 'spring';
    } else if (month >= 5 && month <= 7) {
        return 'summer';
    } else if (month >= 8 && month <= 10) {
        return 'fall'; 
    } else {
        return 'winter'; 
    }
}

const seasonalIngredients = {
    spring: ['asparagus', 'strawberry', 'peas', 'lemon', 'mint', 'lamb', 'quiche', 'frittata'],
    summer: ['tomato', 'zucchini', 'berries', 'stone fruit', 'grilled meat', 'salads', 'corn', 'avocado'],
    fall: ['pumpkin', 'apples', 'squash', 'sweet potato', 'cranberries', 'brussels sprouts', 'turkey', 'stuffing'],
    winter: ['root vegetables', 'citrus', 'stew', 'braised meat', 'roasted vegetables', 'hot chocolate', 'soup', 'baked goods']
};

// Function to fetch recipes
async function fetchRecipes(recipeName, mealType, dishType, dietLabel, healthLabel, nextPageURL = '') {
    let allHits = [];
    let nextPage = '';

    try {
        // Use nextPageURL if provided; otherwise, construct a new query
        const url = nextPageURL || (() => {
            const baseURL = 'https://api.edamam.com/api/recipes/v2?type=public';
            const params = new URLSearchParams({
                q: recipeName,
                app_id: appId,
                app_key: apiKey,
            });

            if (mealType) params.append('mealType', mealType);
            if (dishType) params.append('dishType', dishType);
            if (dietLabel) params.append('diet', dietLabel);
            if (healthLabel) params.append('health', healthLabel);

            return `${baseURL}&${params.toString()}`;
        })();

        const response = await axios.get(url);

        allHits = response.data.hits || [];
        nextPage = response.data._links?.next?.href || '';
    } catch (error) {
        console.error('Error fetching recipes:', error.message);
    }

    return { allHits, nextPage };
}

// Function to fetch recipe details usinh URI
async function fetchRecipeWithURI(results) {
    const favouriteRecipes = [];
    
    for (const result of results) {
        const URI = result.RecipeURI;

        try {
            const baseURL = 'https://api.edamam.com/api/recipes/v2/by-uri?type=public';
            const params = new URLSearchParams({
                uri: URI,
                app_id: appId,
                app_key: apiKey
            });

            const url = `${baseURL}&${params.toString()}`;
            const response = await axios.get(url);

            if (response.data.hits && response.data.hits.length > 0) {
                favouriteRecipes.push(response.data.hits[0].recipe);
            }
        } catch (error) {
            console.error('Error fetching recipe details from Edamam:', error.message);
        }
    }

    return favouriteRecipes;
}

// Route to handle initial search
app.post('/search', async (req, res) => {
    const { recipeName, mealType, dishType, dietLabel, healthLabel } = req.body;

    try {
        const { allHits, nextPage } = await fetchRecipes(recipeName, mealType, dishType, dietLabel, healthLabel);

        const formattedRecipes = allHits.map(hit => {
            const recipe = hit.recipe;
            recipe.label = recipe.label.toLowerCase();
            recipe.dishType = Array.isArray(recipe.dishType) && recipe.dishType.length > 0 ? recipe.dishType[0] : '';
            return recipe;
        });

        res.json({ recipes: formattedRecipes, nextPage });
    } catch (error) {
        console.error('Error in search endpoint:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/next', async (req, res) => {
    const { nextPageURL } = req.query; // Get next page URL from query params

    if (!nextPageURL) {
        return res.status(400).json({ error: 'Missing nextPageURL parameter' });
    }

    try {
        const { allHits, nextPage } = await fetchRecipes('', '', '', '', '', nextPageURL);

        const formattedRecipes = allHits.map(hit => {
            const recipe = hit.recipe;
            recipe.label = recipe.label.toLowerCase();
            recipe.dishType = Array.isArray(recipe.dishType) ? recipe.dishType.join(', ') : '';
            return recipe;
        });

        res.json({ recipes: formattedRecipes, nextPage });
    } catch (error) {
        console.error('Error fetching next page:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/featured-search', async (req, res) => {
    const recipeURI = req.query.q;

    if (!recipeURI) {
        return res.status(400).json({ success: false, message: 'Missing recipe URI' });
    }

    // Use the same function you use for favourites
    const recipes = await fetchRecipeWithURI([ { RecipeURI: recipeURI } ]);

    if (recipes.length > 0) {
        res.json({ recipes });
    } else {
        res.status(404).json({ success: false, message: 'No recipes found.' });
    }
});


app.get('/seasonal-recipes', async (req, res) => {
    const season = getSeason();
    const recipeName = seasonalIngredients[season][Math.floor(Math.random() * seasonalIngredients[season].length)];

    try {
        const { allHits } = await fetchRecipes(recipeName);
        
        if (allHits.length > 0) {
            const formattedRecipes = allHits.slice(0, 3).map(hit => {
                const recipe = hit.recipe;
                recipe.label = recipe.label.toLowerCase();
                recipe.dishType = Array.isArray(recipe.dishType) && recipe.dishType.length > 0 ? recipe.dishType[0] : '';
                return recipe;
            });

            res.json({ recipes: formattedRecipes });
        } else {
            res.status(404).json({ success: false, message: 'No recipes found.' });
        }
    } catch (error) {
        console.error('Error fetching seasonal recipes:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


app.post('/register', (req, res) => {
    const { email, username, password } = req.body;

    // Check if the user exists in the database
    const query = 'SELECT * FROM users WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }
        if (results.length > 0) {
            res.json({ success: false, message: 'Email is already taken' });
            return;
        }
        if (username.length < 3) {
            res.json({ success: false, message: 'Username must be at least 3 characters long' });
            return;
        }
        if (username.length > 10) {
            res.json({ success: false, message: 'Username must be at most 10 characters long' });
            return;
        }
        // Insert the user data into the database
        const insertQuery = 'INSERT INTO users (email, username, password) VALUES (?, ?, ?)';
        connection.query(insertQuery, [email, username, password], (err, results) => {
            if (err) {
                console.error('Error inserting data:', err);
                res.json({ success: false, message: 'Error occurred' });
                return;
            }
            res.json({ success: true, message: 'User registered successfully'});
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Example query to verify user
    const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
    connection.query(query, [email, password], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }

        if (results.length === 0) {
            res.json({ success: false, message: 'Invalid email or password' });
            return;
        }

        // Store username in the session
        const user = results[0];
        req.session.username = user.Username;
        req.session.userID = user.UserID

        res.json({ success: true, message: 'Login successful'});
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Route to read a user by ID 
app.get('/read-user/:userID', (req, res) => {
    const userID = req.params.userID;

    const query = 'SELECT * FROM users WHERE UserID = ?';
    connection.query(query, [userID], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }
        if (results.length === 0) {
            res.json({ success: false, message: 'User not found' });
            return;
        }
        const user = results[0];
        res.json({ success: true, message: 'User found', username: user.Username, email: user.Email, password: user.Password });
    });
});

// Route to update a user
app.put('/update-user/:userID', (req, res) => {
    const userID = req.params.userID;
    const { email, password, username } = req.body;

    let fieldsToUpdate = [];
    let values = [];

    // Check which fields are provided and add them to the update query
    if (!email && !password && !username) {
        res.json({ success: false, message: 'No input provided. Please provide a value in the input field to proceed.' });
        return;
    }

    if (email) {
        const queryCheckEmail = 'SELECT * FROM users WHERE email = ? AND UserID != ?';
        connection.query(queryCheckEmail, [email, userID], (err, results) => {
            if (err) {
                console.error('Error fetching email:', err);
                res.json({ success: false, message: 'Error occurred' });
                return;
            }
            if (results.length > 0) {
                res.json({ success: false, message: 'Email is already taken' });
                return;
            }
        });
        fieldsToUpdate.push('email = ?');
        values.push(email);
    }

    if (password) {
        fieldsToUpdate.push('password = ?');
        values.push(password);
    }
    
    if (username) {
        if (username.length < 3) {
            res.json({ success: false, message: 'Username must be at least 3 characters long' });
            return;
        }
        if (username.length > 10) {
            res.json({ success: false, message: 'Username must be at most 10 characters long' });
            return;
        }
        fieldsToUpdate.push('username = ?');
        values.push(username);
    }

    // If no valid fields are provided
    if (fieldsToUpdate.length === 0) {
        res.json({ success: false, message: 'No fields provided for update' });
        return;
    }

    // Add UserID to the values
    values.push(userID);

    const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE UserID = ?`;
    connection.query(query, values, (err, results) => {
        if (err) {
            console.error('Error updating data:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }
        res.json({ success: true, message: 'User updated successfully' });
    });
});

// Delete a user from the database
app.delete('/delete-user/:id', (req, res) => {
    const userID = req.params.id;
    const query = 'DELETE FROM users WHERE UserID = ?';
    connection.query(query, [userID], (err, results) => {
        if (err) {
            console.error('Error deleting data:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }
        res.json({ success: true, message: 'User deleted successfully' });
    });
});

// Function to add a recipe to favourites
app.post('/add-favourite', (req, res) => {
    const { user_id, recipe_name, recipe_uri } = req.body;

    const query = 'INSERT INTO favourites (UserID, RecipeName, RecipeURI) VALUES (?, ?, ?)';
    connection.query(query, [user_id, recipe_name, recipe_uri], (err, results) => {
        if (err) {
            console.error('Error adding favourite:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }
        res.json({ success: true, message: 'Recipe added to favourites' });
    });
});

// Function to fetch favourite recipes
app.get('/favourites/:userID', (req, res) => {
    const userID = req.params.userID;

    const query = 'SELECT RecipeName, RecipeURI FROM favourites WHERE UserID = ?';
    connection.query(query, [userID], (err, results) => {
        if (err) {
            console.error('Error fetching favourites:', err);    
            res.json({ success: false, message: 'Error occurred' });
            return;
        }

        res.json({ success: true, favourites: results });
    });
});

// Function to check if a recipe is favourited
app.post('/check-favourite', (req, res) => {
    const { user_id, recipe_name, recipe_uri } = req.body;

    const query = 'SELECT * FROM favourites WHERE UserID = ? AND RecipeName = ? AND RecipeURI = ?';
    connection.query(query, [user_id, recipe_name, recipe_uri], (err, results) => {
        if (err) {
            console.error('Error checking favourite:', err);
            return res.json({ success: false, message: 'Error occurred' });
        }

        if (results.length > 0) {
            res.json({ isFavourited: true });
        } else {
            res.json({ isFavourited: false });
        }
    });
});

// Function to remove a recipe from favourites
app.post('/remove-favourite', (req, res) => {
    const { user_id, recipe_name } = req.body;

    const query = 'DELETE FROM favourites WHERE UserID = ? AND RecipeName = ?';
    connection.query(query, [user_id, recipe_name], (err, results) => {
        if (err) {
            console.error('Error removing favourite:', err);
            res.json({ success: false, message: 'Error occurred' });
            return;
        }
        res.json({ success: true, message: 'Recipe removed from favourites' });
    });
});

// Function to fetch favourite recipes
app.post('/search-favourites', async (req, res) => {
    const { userID } = req.body;

    try {
        const results = await fetchFavouriteRecipeDetails(userID);
        const favouriteRecipes = await fetchRecipeWithURI(results);
        res.json({ success: true, favourites: favouriteRecipes });
    } catch (error) {
        console.error('Error fetching favourites:', error);
        res.json({ success: false, message: 'Error occurred' });
    }
});

// Function to fetch recipe details from the database
function fetchFavouriteRecipeDetails(userID) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT RecipeName, RecipeURI FROM favourites WHERE UserID = ?';
        connection.query(query, [userID], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

// Server listening on port 3000 
app.listen(port, () => { 
    console.log(`Server running at http://localhost:${port}`);
});