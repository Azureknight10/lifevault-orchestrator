const axios = require('axios');

// usdaAPI.js - Helper module for USDA FoodData Central API
require('dotenv').config();

const USDA_API_KEY = process.env.USDA_API_KEY;
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

/**
 * Search for foods by query string
 * @param {string} query - Search term (e.g., "chicken breast", "brown rice")
 * @param {number} pageSize - Number of results to return (default: 10)
 * @returns {Array} Array of food objects with basic info
 */
async function searchFoods(query, pageSize = 10) {
    try {
        const response = await axios.post(
            `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}`,
            {
                query: query,
                pageSize: pageSize,
                dataType: ["Foundation", "SR Legacy", "Branded"]
            }
        );
        
        return response.data.foods || [];
    } catch (error) {
        console.error('Error searching foods:', error.message);
        throw new Error(`USDA API search failed: ${error.message}`);
    }
}

/**
 * Get detailed nutrition information for a specific food by FDC ID
 * @param {string|number} fdcId - FoodData Central ID
 * @returns {Object} Detailed food object with full nutrient data
 */
async function getFoodDetails(fdcId) {
    try {
        const response = await axios.get(
            `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`
        );
        
        return response.data;
    } catch (error) {
        console.error('Error getting food details:', error.message);
        throw new Error(`USDA API details failed: ${error.message}`);
    }
}

/**
 * Lookup and enrich a food item with nutrition data scaled to serving size
 * @param {Object} foodItem - { name: string, servingSize: number, servingUnit: string }
 * @returns {Object} Enriched food item with nutrition data
 */
async function lookupNutritionData(foodItem) {
    try {
        // First search for the food
        const searchResults = await searchFoods(foodItem.name, 1);
        
        if (searchResults.length === 0) {
            throw new Error(`Food not found: ${foodItem.name}`);
        }
        
        const food = searchResults[0];
        const details = await getFoodDetails(food.fdcId);
        
        // Extract key nutrients (USDA data is typically per 100g)
        const nutrients = details.foodNutrients || [];
        
        // Helper to find nutrient by name
        const findNutrient = (name) => {
            const nutrient = nutrients.find(n => n.nutrient?.name === name);
            return nutrient?.amount || 0;
        };
        
        // Get nutrients per 100g
        const per100g = {
            calories: findNutrient('Energy'),
            protein: findNutrient('Protein'),
            carbs: findNutrient('Carbohydrate, by difference'),
            fat: findNutrient('Total lipid (fat)'),
            fiber: findNutrient('Fiber, total dietary'),
            sugar: findNutrient('Sugars, total including NLEA')
        };
        
        // Scale to user's serving size (assuming grams)
        const scaleFactor = foodItem.servingSize / 100;
        
        return {
            fdcId: food.fdcId,
            foodName: food.description || foodItem.name,
            servingSize: foodItem.servingSize,
            servingUnit: foodItem.servingUnit || 'g',
            calories: Math.round(per100g.calories * scaleFactor),
            protein: Math.round(per100g.protein * scaleFactor * 10) / 10,
            carbs: Math.round(per100g.carbs * scaleFactor * 10) / 10,
            fat: Math.round(per100g.fat * scaleFactor * 10) / 10,
            fiber: Math.round(per100g.fiber * scaleFactor * 10) / 10,
            sugar: Math.round(per100g.sugar * scaleFactor * 10) / 10
        };
    } catch (error) {
        console.error('Error looking up nutrition data:', error.message);
        throw error;
    }
}

/**
 * Get multiple food items' nutrition data in batch
 * @param {Array} foodItems - Array of { name, servingSize, servingUnit }
 * @returns {Array} Array of enriched food items
 */
async function batchLookupNutrition(foodItems) {
    try {
        const enrichedItems = await Promise.all(
            foodItems.map(item => lookupNutritionData(item))
        );
        return enrichedItems;
    } catch (error) {
        console.error('Error in batch lookup:', error.message);
        throw error;
    }
}

/**
 * Calculate nutrition totals from an array of food items
 * @param {Array} foodItems - Array of enriched food items
 * @returns {Object} Totals for calories, protein, carbs, fat, fiber, sugar
 */
function calculateNutritionTotals(foodItems) {
    return foodItems.reduce((totals, item) => {
        return {
            totalCalories: totals.totalCalories + (item.calories || 0),
            totalProtein: Math.round((totals.totalProtein + (item.protein || 0)) * 10) / 10,
            totalCarbs: Math.round((totals.totalCarbs + (item.carbs || 0)) * 10) / 10,
            totalFat: Math.round((totals.totalFat + (item.fat || 0)) * 10) / 10,
            totalFiber: Math.round((totals.totalFiber + (item.fiber || 0)) * 10) / 10,
            totalSugar: Math.round((totals.totalSugar + (item.sugar || 0)) * 10) / 10
        };
    }, {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        totalSugar: 0
    });
}

module.exports = {
    searchFoods,
    getFoodDetails,
    lookupNutritionData,
    batchLookupNutrition,
    calculateNutritionTotals
};