// test-vitality.js - Test logging meals and workouts to Azure Tables
const vitality = require('./vitalityHelpers');

async function testVitalitySystem() {
  console.log('🍽️  Testing Vitality System - Meal & Workout Logging\n');
  
  try {
    // Test 1: Log breakfast with USDA foods
    console.log('Test 1: Logging breakfast with USDA foods...\n');
    
    const breakfast = await vitality.logMeal({
      type: 'breakfast',
      name: 'High-protein breakfast',
      foodItems: [
        { source: 'usda', name: 'eggs', servingSize: 150, servingUnit: 'g' },
        { source: 'usda', name: 'whole wheat toast', servingSize: 60, servingUnit: 'g' },
        { source: 'usda', name: 'avocado', servingSize: 50, servingUnit: 'g' }
      ],
      notes: 'Post-workout breakfast',
      location: 'home'
    });
    
    console.log('📊 Breakfast totals:');
    console.log(`   Calories: ${breakfast.totalCalories}`);
    console.log(`   Protein: ${breakfast.totalProtein}g`);
    console.log(`   Carbs: ${breakfast.totalCarbs}g`);
    console.log(`   Fat: ${breakfast.totalFat}g\n`);
    
    // Test 2: Log snack with barcode
    console.log('Test 2: Logging snack with barcode scan...\n');
    
    const snack = await vitality.logMeal({
      type: 'snack',
      name: 'Afternoon snack',
      foodItems: [
        { source: 'barcode', barcode: '3017620422003', servingSize: 20 } // Nutella
      ],
      notes: 'Sweet treat'
    });
    
    console.log('📊 Snack totals:');
    console.log(`   Calories: ${snack.totalCalories}`);
    console.log(`   Protein: ${snack.totalProtein}g`);
    console.log(`   Fat: ${snack.totalFat}g\n`);
    
    // Test 3: Log lunch with mixed sources
    console.log('Test 3: Logging lunch with mixed sources (USDA + barcode)...\n');
    
    const lunch = await vitality.logMeal({
      type: 'lunch',
      name: 'Power lunch',
      foodItems: [
        { source: 'usda', name: 'chicken breast', servingSize: 200, servingUnit: 'g' },
        { source: 'usda', name: 'brown rice', servingSize: 150, servingUnit: 'g' },
        { source: 'barcode', barcode: '5449000000996', servingSize: 330 } // Coca-Cola
      ],
      notes: 'Lunch meeting',
      location: 'restaurant'
    });
    
    console.log('📊 Lunch totals:');
    console.log(`   Calories: ${lunch.totalCalories}`);
    console.log(`   Protein: ${lunch.totalProtein}g\n`);
    
    // Test 4: Log a workout
    console.log('Test 4: Logging morning workout...\n');
    
    const workout = await vitality.logWorkout({
      type: 'yoga',
      name: 'Morning Vinyasa Flow',
      duration: 45,
      intensity: 'moderate',
      effortLevel: 7,
      details: {
        exercises: [
          { name: 'Sun Salutation A', sets: 5 },
          { name: 'Warrior II hold', sets: 2, duration: 3 }
        ]
      },
      notes: 'Felt great, good flexibility',
      location: 'home'
    });
    
    console.log('📊 Workout summary:');
    console.log(`   Duration: ${workout.duration} minutes`);
    console.log(`   Calories burned: ${workout.caloriesBurned}\n`);
    
    // Test 5: Log strength training
    console.log('Test 5: Logging afternoon strength training...\n');
    
    const strength = await vitality.logWorkout({
      type: 'strength',
      name: 'Upper body workout',
      duration: 60,
      intensity: 'vigorous',
      effortLevel: 9,
      details: {
        exercises: [
          { name: 'Bench press', sets: 4, reps: 8 },
          { name: 'Pull-ups', sets: 3, reps: 10 },
          { name: 'Shoulder press', sets: 3, reps: 12 }
        ]
      },
      notes: 'Hit new PR on bench!',
      location: 'gym'
    });
    
    console.log('📊 Workout summary:');
    console.log(`   Duration: ${strength.duration} minutes`);
    console.log(`   Calories burned: ${strength.caloriesBurned}\n`);
    
    // Test 6: Get daily summary
    console.log('Test 6: Getting today\'s daily summary...\n');
    
    // Wait a moment for summary to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const summary = await vitality.getDailySummary();
    
    console.log('📅 Daily Summary:');
    console.log('   Nutrition:');
    console.log(`     - ${summary.nutrition.calories || 0} calories`);
    console.log(`     - ${summary.nutrition.protein || 0}g protein`);
    console.log(`     - ${summary.nutrition.carbs || 0}g carbs`);
    console.log(`     - ${summary.nutrition.fat || 0}g fat`);
    console.log(`     - ${summary.nutrition.mealCount || 0} meals logged`);
    console.log('   Activity:');
    console.log(`     - ${summary.activity.workoutCount || 0} workouts`);
    console.log(`     - ${summary.activity.minutes || 0} minutes exercised`);
    console.log(`     - ${summary.activity.caloriesBurned || 0} calories burned`);
    console.log(`     - Workout types: ${summary.activity.workoutTypes?.join(', ') || 'none'}`);
    
    console.log('\n✅ All vitality tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check Azure Portal to see your data in the tables');
    console.log('   2. Integrate these functions into VitalityAgent');
    console.log('   3. Add Neo4j graph nodes for richer analytics');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testVitalitySystem();
