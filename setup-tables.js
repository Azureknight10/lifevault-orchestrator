// setup-tables.js - Create Azure Tables for Vitality data
const { TableServiceClient } = require('@azure/data-tables');
require('dotenv').config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const tableService = TableServiceClient.fromConnectionString(connectionString);

async function setupTables() {
  console.log('🗄️  Setting up Azure Tables for Vitality/Analytics...\n');
  
  const tables = [
    {
      name: 'MealLog',
      description: 'Stores individual meals with food items and nutrition totals',
      schema: `
        PartitionKey: USER_<userId>
        RowKey: <timestamp>_<mealId>
        Fields:
          - mealType: breakfast|lunch|dinner|snack
          - mealName: optional friendly name
          - foodItems: JSON array of food objects
          - totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, totalSugar
          - notes, location, mood
          - neo4jNodeId, syncedToGraph
      `
    },
    {
      name: 'WorkoutLog',
      description: 'Stores workout sessions with type, duration, and intensity',
      schema: `
        PartitionKey: USER_<userId>
        RowKey: <timestamp>_<workoutId>
        Fields:
          - workoutType: yoga|strength|cardio|hiit|sports|other
          - workoutName, duration (minutes), intensity
          - effortLevel (1-10), caloriesBurned
          - workoutDetails: JSON with exercises/sets/reps
          - notes, location
          - neo4jNodeId, syncedToGraph
      `
    },
    {
      name: 'DailySummary',
      description: 'Stores daily aggregates of nutrition and activity',
      schema: `
        PartitionKey: USER_<userId>
        RowKey: <date> (YYYY-MM-DD)
        Fields:
          - Nutrition: totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, totalSugar
          - Activity: workoutCount, totalWorkoutMinutes, totalCaloriesBurned
          - Daily metrics: weight, sleepHours, energyLevel, stressLevel
          - Goals: calorieGoal, proteinGoal, workoutGoal, goalsMetToday
          - neo4jNodeId, syncedToGraph
      `
    },
    {
      name: 'FoodCache',
      description: 'Caches nutrition data for frequently used foods and barcodes',
      schema: `
        PartitionKey: <source> (USDA|BARCODE)
        RowKey: <fdcId or barcode>
        Fields:
          - foodName, brand
          - caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g
          - lastUpdated, imageUrl
      `
    }
  ];
  
  for (const table of tables) {
    try {
      await tableService.createTable(table.name);
      console.log(`✅ Created table: ${table.name}`);
      console.log(`   ${table.description}`);
      console.log(`   Schema: ${table.schema.trim()}\n`);
    } catch (error) {
      if (error.statusCode === 409) {
        console.log(`ℹ️  Table already exists: ${table.name}\n`);
      } else {
        console.error(`❌ Error creating ${table.name}:`, error.message);
      }
    }
  }
  
  console.log('✅ Azure Tables setup complete!\n');
  console.log('📊 Summary:');
  console.log('   - MealLog: Track meals with USDA or barcode nutrition data');
  console.log('   - WorkoutLog: Track workouts with duration and intensity');
  console.log('   - DailySummary: Daily aggregates and goal tracking');
  console.log('   - FoodCache: Cache frequently used foods for faster lookups');
}

setupTables().catch(console.error);
