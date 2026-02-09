// test-barcode.js - Test barcode scanning
const barcodeAPI = require('./barcodeAPI');

async function testBarcodeScanning() {
  console.log('🔍 Testing Barcode Scanning (Open Food Facts)\n');
  
  try {
    // Test with known working barcodes from Open Food Facts
    const testBarcodes = [
      '737628064502',  // Silk Organic Almond Milk (confirmed in docs)
      '3017620422003', // Nutella (popular EU product)
      '5449000000996', // Coca-Cola (international)
      '8076809513890'  // Barilla Pasta (EU)
    ];
    
    console.log('Test 1: Looking up products by barcode...\n');
    
    let successfulBarcode = null;
    
    for (const barcode of testBarcodes) {
      try {
        console.log(`Scanning barcode: ${barcode}...`);
        const product = await barcodeAPI.lookupBarcode(barcode);
        
        console.log(`✅ Found: ${product.productName}`);
        console.log(`   Brand: ${product.brand || 'N/A'}`);
        console.log(`   Per 100g: ${Math.round(product.caloriesPer100g)} cal, ${product.proteinPer100g}g protein`);
        console.log(`   Nutri-Score: ${product.nutriscore || 'N/A'}`);
        console.log('');
        
        if (!successfulBarcode) successfulBarcode = barcode;
      } catch (error) {
        console.log(`   ⚠️  ${error.message}\n`);
      }
    }
    
    if (!successfulBarcode) {
      console.log('❌ No barcodes found. Open Food Facts might be down or barcodes changed.');
      return;
    }
    
    // Test 2: Convert barcode to food item with custom serving
    console.log(`Test 2: Converting barcode ${successfulBarcode} to food item (50g serving)...\n`);
    const foodItem = await barcodeAPI.barcodeToFoodItem(successfulBarcode, 50);
    console.log('✅ Food item created:');
    console.log(`   ${foodItem.foodName}`);
    console.log(`   Serving: ${foodItem.servingSize}${foodItem.servingUnit}`);
    console.log(`   Calories: ${foodItem.calories}`);
    console.log(`   Protein: ${foodItem.protein}g`);
    console.log(`   Carbs: ${foodItem.carbs}g`);
    console.log(`   Fat: ${foodItem.fat}g`);
    
    console.log('\n✅ Barcode scanning tests complete!');
    console.log('\n💡 Tip: You can find more barcodes by scanning products with the Open Food Facts mobile app');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBarcodeScanning();
