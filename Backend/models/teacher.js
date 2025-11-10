const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  mis_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  designation: { type: String, required: true },

  // pehle slot assigned
  assigned_slot: { type: String, default: null },
  // And here we are getting the data statically which we have to changeto dynamic allotment as in getting the datapointed in another schema
  

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
  },

  weekly_schedule: {
    type: Object,
    default: {
        Monday: [{ period: { type: Number, default: null }, subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }, room: { type: String, default: null } }],
        Tuesday: [{ period: { type: Number, default: null }, subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }, room: { type: String, default: null } }],
        Wednesday: [{ period: { type: Number, default: null }, subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }, room: { type: String, default: null } }],
        Thursday: [{ period: { type: Number, default: null }, subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }, room: { type: String, default: null } }],
        Friday: [{ period: { type: Number, default: null }, subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }, room: { type: String, default: null } }],
        Saturday: [{ period: { type: Number, default: null }, subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }, room: { type: String, default: null } }]
    }
  }
});

module.exports = mongoose.model('Teacher', teacherSchema);
