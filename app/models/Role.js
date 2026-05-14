const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'admin',
      'provider',
      'patient',
      'doctor',
      'nurse',
      'druggist',
      'hospital',
      'ambulance',
      'ayurvedic',
      'dental',
      'eyeCare',
      'gym',
      'maternity',
      'nursingHome',
      'radiology',
      'yoga'
    ]
  },
  permissions: [{
    type: String
  }]
}, { timestamps: true });

// Middleware
roleSchema.pre('save', async function (next) {
  if (this.name === 'admin' && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = ['all'];
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);