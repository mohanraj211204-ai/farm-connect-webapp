const express = require('express');
const router = express.Router();

// Mock market prices (In production, integrate with real APIs)
const mockMarketPrices = {
  'tomato': { price: 32, trend: 'up', change: 2 },
  'potato': { price: 18, trend: 'down', change: 1 },
  'onion': { price: 28, trend: 'stable', change: 0 },
  'rice': { price: 45, trend: 'up', change: 3 },
  'wheat': { price: 22, trend: 'stable', change: 0 },
  'mango': { price: 60, trend: 'up', change: 5 },
  'banana': { price: 25, trend: 'down', change: 2 },
  'apple': { price: 80, trend: 'up', change: 4 },
  'orange': { price: 40, trend: 'stable', change: 0 },
  'carrot': { price: 30, trend: 'up', change: 3 },
  'cauliflower': { price: 25, trend: 'down', change: 2 },
  'brinjal': { price: 20, trend: 'stable', change: 0 },
  'cabbage': { price: 18, trend: 'up', change: 1 },
  'capsicum': { price: 35, trend: 'stable', change: 0 },
  'ladyfinger': { price: 28, trend: 'down', change: 1 },
  'cucumber': { price: 22, trend: 'stable', change: 0 },
  'pumpkin': { price: 20, trend: 'up', change: 1 },
  'radish': { price: 15, trend: 'stable', change: 0 },
  'spinach': { price: 12, trend: 'up', change: 2 },
  'coriander': { price: 10, trend: 'stable', change: 0 }
};

// Get market prices
router.get('/', (req, res) => {
  try {
    const { product } = req.query;
    
    if (product) {
      const priceData = mockMarketPrices[product.toLowerCase()] || 
                       { price: 25, trend: 'stable', change: 0 };
      
      return res.json({
        success: true,
        product,
        ...priceData,
        lastUpdated: new Date().toISOString()
      });
    }
    
    // Return all prices
    const prices = {};
    Object.keys(mockMarketPrices).forEach(key => {
      prices[key] = {
        ...mockMarketPrices[key],
        lastUpdated: new Date().toISOString()
      };
    });
    
    res.json({
      success: true,
      prices,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get market prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market prices'
    });
  }
});

module.exports = router;