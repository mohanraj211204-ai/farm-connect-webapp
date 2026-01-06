const express = require('express');
const router = express.Router();
const Product = require('../routes/Product');
const User = require('../routes/User');

// Get all products (for buyers)
router.get('/all', async (req, res) => {
  try {
    const { 
      category, 
      minPrice, 
      maxPrice, 
      location, 
      search,
      page = 1,
      limit = 20
    } = req.query;
    
    let filter = { isAvailable: true };
    
    // Apply filters
    if (category && category !== 'all') filter.category = category;
    
    if (minPrice || maxPrice) {
      filter.pricePerUnit = {};
      if (minPrice) filter.pricePerUnit.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerUnit.$lte = Number(maxPrice);
    }
    
    if (location) filter['location.district'] = new RegExp(location, 'i');
    
    if (search) {
      filter.$or = [
        { productName: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    // Get products with farmer details
    const products = await Product.find(filter)
      .populate('farmerId', 'fullName location rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // Get total count for pagination
    const total = await Product.countDocuments(filter);
    
    res.json({
      success: true,
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Get farmer's products
router.get('/my-products', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const products = await Product.find({ farmerId: decoded.id })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      products
    });
    
  } catch (error) {
    console.error('Get my products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('farmerId', 'fullName mobile location rating totalTransactions');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Increment view count
    product.views += 1;
    await product.save();
    
    res.json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product'
    });
  }
});

// Add new product
router.post('/add', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Only farmers can add products
    if (decoded.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Only farmers can add products'
      });
    }
    
    const {
      productName,
      category,
      description,
      quantity,
      pricePerUnit,
      qualityGrade,
      harvestDate,
      tags
    } = req.body;
    
    // Get farmer location
    const farmer = await User.findById(decoded.id);
    
    // Mock market price (In production, fetch from API)
    const mockMarketPrices = {
      'tomato': 32, 'potato': 18, 'onion': 28,
      'rice': 45, 'wheat': 22, 'mango': 60,
      'banana': 25, 'apple': 80, 'orange': 40
    };
    
    const marketPrice = mockMarketPrices[productName.toLowerCase()] || 
                       Math.round(pricePerUnit * (0.9 + Math.random() * 0.3));
    
    // Create product
    const product = new Product({
      farmerId: decoded.id,
      productName,
      category,
      description,
      quantity: {
        value: quantity.value,
        unit: quantity.unit || 'kg'
      },
      pricePerUnit,
      marketPrice,
      qualityGrade: qualityGrade || 'regular',
      harvestDate: harvestDate || new Date(),
      location: farmer.location,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Product added successfully',
      product
    });
    
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product'
    });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check ownership
    if (product.farmerId.toString() !== decoded.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }
    
    // Update fields
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'farmerId') {
        product[key] = updates[key];
      }
    });
    
    await product.save();
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (product.farmerId.toString() !== decoded.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }
    
    await product.deleteOne();
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    });
  }
});

module.exports = router;