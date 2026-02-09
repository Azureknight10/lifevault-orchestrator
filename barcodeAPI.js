// barcode.api.js - Open Food Facts barcode scanner integration
const axios = require('axios');

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2';

/**
 * Look up a product by barcode (UPC/EAN)
 * @param {string} barcode - The barcode number (UPC, EAN-13, etc.)
 * @returns {Object} Product with nutrition data
 */
async function lookupBarcode(barcode) {
    try {
        const url = `${OPEN_FOOD_FACTS_URL}/product/${barcode}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'LifeVault-Orchestrator/1.0'
            }
        });
        
        if (response.data.status === 0) {
            throw new Error(`Product not found for barcode: ${barcode}`);
        }
        
        const product = response.data.product;
        const nutriments = product.nutriments || {};
        
        return {
            barcode,
            productName: product.product_name || 'Unknown Product',
            brand: product.brands || '',
            servingSize: product.serving_size || '100g',
            servingQuantity: product.serving_quantity || 100,
            caloriesPer100g: nutriments['energy-kcal_100g'] || nutriments.energy_100g / 4.184 || 0,
            proteinPer100g: nutriments.proteins_100g || 0,
            carbsPer100g: nutriments.carbohydrates_100g || 0,
            fatPer100g: nutriments.fat_100g || 0,
            fiberPer100g: nutriments.fiber_100g || 0,
            sugarPer100g: nutriments.sugars_100g || 0,
            sodiumPer100g: nutriments.sodium_100g || 0,
            caloriesPerServing: nutriments['energy-kcal_serving'] || null,
            proteinPerServing: nutriments.proteins_serving || null,
            carbsPerServing: nutriments.carbohydrates_serving || null,
            fatPerServing: nutriments.fat_serving || null,
            imageUrl: product.image_url || null,
            ingredients: product.ingredients_text || null,
            categories: product.categories || null,
            labels: product.labels || null,
            nutriscore: product.nutriscore_grade || null
        };
    } catch (error) {
        if (error.response?.status === 404 || error.message.includes('not found')) {
            throw new Error(`Product not found for barcode: ${barcode}`);
        }
        console.error('Error looking up barcode:', error.message);
        throw new Error(`Barcode lookup failed: ${error.message}`);
    }
}

/**
 * Convert barcode product to food item with specific serving size
 * @param {string} barcode - The barcode to look up
 * @param {number} servingSize - Serving size in grams
 * @returns {Object} Food item with nutrition data for the serving
 */
async function barcodeToFoodItem(barcode, servingSize = null) {
    const product = await lookupBarcode(barcode);
    const grams = servingSize || product.servingQuantity || 100;
    const scaleFactor = grams / 100;
    
    return {
        barcode: product.barcode,
        foodName: `${product.brand ? product.brand + ' ' : ''}${product.productName}`,
        servingSize: grams,
        servingUnit: 'g',
        calories: Math.round(product.caloriesPer100g * scaleFactor),
        protein: Math.round(product.proteinPer100g * scaleFactor * 10) / 10,
        carbs: Math.round(product.carbsPer100g * scaleFactor * 10) / 10,
        fat: Math.round(product.fatPer100g * scaleFactor * 10) / 10,
        fiber: Math.round(product.fiberPer100g * scaleFactor * 10) / 10,
        sugar: Math.round(product.sugarPer100g * scaleFactor * 10) / 10,
        sodium: Math.round(product.sodiumPer100g * scaleFactor * 10) / 10,
        imageUrl: product.imageUrl,
        nutriscore: product.nutriscore
    };
}

/**
 * Search products by name in Open Food Facts
 * @param {string} query - Search term
 * @param {number} pageSize - Number of results
 * @returns {Array} Array of products
 */
async function searchProducts(query, pageSize = 10) {
    try {
        const url = `${OPEN_FOOD_FACTS_URL}/search`;
        const response = await axios.get(url, {
            params: { search_terms: query, page_size: pageSize, json: true },
            headers: { 'User-Agent': 'LifeVault-Orchestrator/1.0' }
        });
        return response.data.products || [];
    } catch (error) {
        console.error('Error searching products:', error.message);
        throw new Error(`Product search failed: ${error.message}`);
    }
}

module.exports = { lookupBarcode, barcodeToFoodItem, searchProducts };