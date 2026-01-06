const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['vegetables', 'fruits', 'grains', 'dairy', 'poultry', 'others'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  quantity: {
    value: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      enum: ['kg', 'quintal', 'ton', 'litre', 'piece', 'dozen'],
      default: 'kg'
    }
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 1
  },
  marketPrice: {
    type: Number,
    required: true
  },
  images: [String],
  harvestDate: {
    type: Date,
    default: Date.now
  },
  location: {
    district: String,
    state: String
  },
  qualityGrade: {
    type: String,
    enum: ['organic', 'grade-a', 'grade-b', 'regular'],
    default: 'regular'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);