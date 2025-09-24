const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  mis_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  designation: { type: String, required: true },

  // pehle slot assigned
  assigned_slot: { type: String, default: null },

  // fir 5 subject preferences
  subject_preferences: {
    type: [String],
    validate: {
      validator: function (arr) {
        return arr.length === 5; // exactly 5 preferences required
      },
      message: "Exactly 5 subject preferences required"
    },
    required: true
  }
});

module.exports = mongoose.model('Teacher', teacherSchema);
