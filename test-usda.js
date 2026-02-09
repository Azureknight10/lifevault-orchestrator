const usdaAPI = require('./usdaAPI');  // Adjust path if usdaAPI.js is in helpers/

// test-usda.js - Test the USDA API integration

async function testUSDAAPI() {
    console.log('🧪 Testing USDA FoodData Central API\n');
    
    try {
        // Test 1: Search for a food
        console.log('Test 1: Searching for "chicken breast"...');
        const searchResults = await usdaAPI.searchFoods('chicken breast', 3);
        console.log(`✅ Found ${searchResults.length} results`);
        searchResults.forEach((food, i) => {
            console.log(`  ${i + 1}. ${food.description} (FDC ID: ${food.fdcId})`);
        });
        console.log('');
        
        // Test 2: Get detailed nutrition for a food item
        console.log('Test 2: Looking up nutrition for 200g chicken breast...');
        const chickenData = await usdaAPI.lookupNutritionData({
            name: 'chicken breast',
            servingSize: 200,
            servingUnit: 'g'
        });
        console.log('✅ Nutrition data retrieved:');
        console.log(`  Food: ${chickenData.foodName}`);
        console.log(`  Serving: ${chickenData.servingSize}${chickenData.servingUnit}`);
        console.log(`  Calories: ${chickenData.calories}`);
        console.log(`  Protein: ${chickenData.protein}g`);
        console.log(`  Carbs: ${chickenData.carbs}g`);
        console.log(`  Fat: ${chickenData.fat}g`);
        console.log('');
        
        // Test 3: Batch lookup and calculate meal totals
        console.log('Test 3: Calculating totals for a full meal...');
        const meal = [
            { name: 'chicken breast', servingSize: 200, servingUnit: 'g' },
            { name: 'brown rice', servingSize: 150, servingUnit: 'g' },
            { name: 'broccoli', servingSize: 100, servingUnit: 'g' }
        ];
        
        const enrichedMeal = await usdaAPI.batchLookupNutrition(meal);
        const totals = usdaAPI.calculateNutritionTotals(enrichedMeal);
        
        console.log('✅ Meal items:');
        enrichedMeal.forEach(item => {
            console.log(`  - ${item.foodName} (${item.servingSize}${item.servingUnit}): ${item.calories} cal`);
        });
        console.log('\n📊 Meal Totals:');
        console.log(`  Calories: ${totals.totalCalories}`);
        console.log(`  Protein: ${totals.totalProtein}g`);
        console.log(`  Carbs: ${totals.totalCarbs}g`);
        console.log(`  Fat: ${totals.totalFat}g`);
        console.log(`  Fiber: ${totals.totalFiber}g`);
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
    }
}

// Run the tests
testUSDAAPI();