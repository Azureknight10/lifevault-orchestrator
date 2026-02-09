// vitalityHelpers.js - Helper functions for VitalityAgent
const { TableClient } = require('@azure/data-tables');
const { v4: uuid } = require('uuid');
const usdaAPI = require('./usdaAPI');
const barcodeAPI = require('./barcodeAPI');
require('dotenv').config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Initialize table clients
const mealLogTable = TableClient.fromConnectionString(connectionString, 'MealLog');
const workoutLogTable = TableClient.fromConnectionString(connectionString, 'WorkoutLog');
const dailySummaryTable = TableClient.fromConnectionString(connectionString, 'DailySummary');
const foodCacheTable = TableClient.fromConnectionString(connectionString, 'FoodCache');

/**
 * Log a meal with nutrition data
 * @param {Object} mealData - { type, name, foodItems: [{source, id, servingSize}], notes }
 * @returns {Object} Logged meal with totals
 */
async function logMeal(mealData) {
  try {
    const timestamp = new Date().toISOString();
    const mealId = uuid();
    
    // Enrich food items with nutrition data
    const enrichedFoodItems = await Promise.all(
      mealData.foodItems.map(async (item) => {
        if (item.source === 'barcode') {
          return await barcodeAPI.barcodeToFoodItem(item.barcode, item.servingSize);
        } else if (item.source === 'usda') {
          return await usdaAPI.lookupNutritionData({
            name: item.name,
            servingSize: item.servingSize,
            servingUnit: item.servingUnit || 'g'
          });
        } else {
          // Manual entry - item already has nutrition data
          return item;
        }
      })
    );
    
    // Calculate totals
    const totals = usdaAPI.calculateNutritionTotals(enrichedFoodItems);
    
    // Create entity
    const entity = {
      partitionKey: 'USER_DEFAULT',
      rowKey: `${timestamp}_${mealId}`,
      timestamp: timestamp,
      mealType: mealData.type || 'meal',
      mealName: mealData.name || '',
      foodItems: JSON.stringify(enrichedFoodItems),
      ...totals,
      notes: mealData.notes || '',
      location: mealData.location || '',
      mood: mealData.mood || '',
      syncedToGraph: false
    };
    
    // Write to Azure Tables
    await mealLogTable.createEntity(entity);
    
    console.log(`✅ Logged ${entity.mealType}: ${totals.totalCalories} cal, ${totals.totalProtein}g protein`);
    
    // Update daily summary
    await updateDailySummary(new Date().toISOString().split('T')[0]);
    
    return {
      success: true,
      mealId,
      ...totals,
      foodItems: enrichedFoodItems
    };
    
  } catch (error) {
    console.error('Error logging meal:', error.message);
    throw error;
  }
}

/**
 * Log a workout
 * @param {Object} workoutData - { type, name, duration, intensity, effortLevel, details, notes }
 * @returns {Object} Logged workout
 */
async function logWorkout(workoutData) {
  try {
    const timestamp = new Date().toISOString();
    const workoutId = uuid();
    
    // Estimate calories burned (simple formula - can be enhanced)
    const caloriesBurned = estimateCaloriesBurned(
      workoutData.type,
      workoutData.duration,
      workoutData.intensity
    );
    
    const entity = {
      partitionKey: 'USER_DEFAULT',
      rowKey: `${timestamp}_${workoutId}`,
      timestamp: timestamp,
      workoutType: workoutData.type,
      workoutName: workoutData.name || workoutData.type,
      duration: workoutData.duration,
      intensity: workoutData.intensity || 'moderate',
      effortLevel: workoutData.effortLevel || null,
      caloriesBurned,
      workoutDetails: JSON.stringify(workoutData.details || {}),
      notes: workoutData.notes || '',
      location: workoutData.location || '',
      syncedToGraph: false
    };
    
    await workoutLogTable.createEntity(entity);
    
    console.log(`✅ Logged ${entity.workoutType}: ${entity.duration} min, ${caloriesBurned} cal burned`);
    
    // Update daily summary
    await updateDailySummary(new Date().toISOString().split('T')[0]);
    
    return {
      success: true,
      workoutId,
      caloriesBurned,
      duration: workoutData.duration
    };
    
  } catch (error) {
    console.error('Error logging workout:', error.message);
    throw error;
  }
}

/**
 * Estimate calories burned based on workout type, duration, and intensity
 * @param {string} type - Workout type
 * @param {number} duration - Duration in minutes
 * @param {string} intensity - light|moderate|vigorous
 * @returns {number} Estimated calories burned
 */
function estimateCaloriesBurned(type, duration, intensity) {
  // Calories per minute by workout type and intensity (for ~180lb person)
  const calorieRates = {
    yoga: { light: 2.5, moderate: 3.5, vigorous: 5 },
    strength: { light: 3, moderate: 5, vigorous: 7 },
    cardio: { light: 5, moderate: 8, vigorous: 12 },
    hiit: { light: 8, moderate: 12, vigorous: 15 },
    sports: { light: 4, moderate: 6, vigorous: 9 },
    other: { light: 3, moderate: 5, vigorous: 7 }
  };
  
  const rate = calorieRates[type]?.[intensity] || calorieRates.other[intensity] || 5;
  return Math.round(rate * duration);
}

/**
 * Update or create daily summary
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function updateDailySummary(date) {
  try {
    // Query all meals for the day
    const mealQuery = `PartitionKey eq 'USER_DEFAULT' and RowKey ge '${date}T00:00:00' and RowKey lt '${date}T23:59:59'`;
    const meals = mealLogTable.listEntities({ queryOptions: { filter: mealQuery } });
    
    let nutritionTotals = {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      totalSugar: 0,
      mealCount: 0
    };
    
    for await (const meal of meals) {
      nutritionTotals.totalCalories += meal.totalCalories || 0;
      nutritionTotals.totalProtein += meal.totalProtein || 0;
      nutritionTotals.totalCarbs += meal.totalCarbs || 0;
      nutritionTotals.totalFat += meal.totalFat || 0;
      nutritionTotals.totalFiber += meal.totalFiber || 0;
      nutritionTotals.totalSugar += meal.totalSugar || 0;
      nutritionTotals.mealCount++;
    }
    
    // Query all workouts for the day
    const workoutQuery = `PartitionKey eq 'USER_DEFAULT' and RowKey ge '${date}T00:00:00' and RowKey lt '${date}T23:59:59'`;
    const workouts = workoutLogTable.listEntities({ queryOptions: { filter: workoutQuery } });
    
    let activityTotals = {
      workoutCount: 0,
      totalWorkoutMinutes: 0,
      totalCaloriesBurned: 0,
      workoutTypes: []
    };
    
    for await (const workout of workouts) {
      activityTotals.workoutCount++;
      activityTotals.totalWorkoutMinutes += workout.duration || 0;
      activityTotals.totalCaloriesBurned += workout.caloriesBurned || 0;
      if (workout.workoutType && !activityTotals.workoutTypes.includes(workout.workoutType)) {
        activityTotals.workoutTypes.push(workout.workoutType);
      }
    }
    
    // Create or update daily summary
    const summaryEntity = {
      partitionKey: 'USER_DEFAULT',
      rowKey: date,
      timestamp: new Date().toISOString(),
      ...nutritionTotals,
      ...activityTotals,
      workoutTypes: JSON.stringify(activityTotals.workoutTypes),
      syncedToGraph: false
    };
    
    await dailySummaryTable.upsertEntity(summaryEntity, 'Replace');
    
  } catch (error) {
    console.error('Error updating daily summary:', error.message);
  }
}

/**
 * Get daily summary
 * @param {string} date - Date in YYYY-MM-DD format (default: today)
 * @returns {Object} Daily summary
 */
async function getDailySummary(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const entity = await dailySummaryTable.getEntity('USER_DEFAULT', targetDate);
    
    return {
      date: targetDate,
      nutrition: {
        calories: entity.totalCalories,
        protein: entity.totalProtein,
        carbs: entity.totalCarbs,
        fat: entity.totalFat,
        fiber: entity.totalFiber,
        sugar: entity.totalSugar,
        mealCount: entity.mealCount
      },
      activity: {
        workoutCount: entity.workoutCount,
        minutes: entity.totalWorkoutMinutes,
        caloriesBurned: entity.totalCaloriesBurned,
        workoutTypes: JSON.parse(entity.workoutTypes || '[]')
      }
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return { date: date || new Date().toISOString().split('T')[0], nutrition: {}, activity: {} };
    }
    throw error;
  }
}

module.exports = {
  logMeal,
  logWorkout,
  getDailySummary,
  estimateCaloriesBurned
};
