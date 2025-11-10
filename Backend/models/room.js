//const mongoose = require('mongoose');

//const roomSchema = new mongoose.Schema({
  //  room_id: { type: String, required: true, unique: true },
//    name: { type: String, required: true },
//    capacity: { type: Number, required: true }
//});

//module.exports = mongoose.model('Room', roomSchema);
 const mongoose = require("mongoose");

 const roomSchema = new mongoose.Schema({
   room_id: { type: String, required: true, unique: true }, // e.g., N-303
   capacity: { type: Number, required: true }, // e.g., 60
   // update kar 😊 null thi nd aandar ea lea
  weekly_schedule: {
     type: Object,
     default: {
       Monday: [{
        period: { type: Number, default: null },
        teacher: { type: String, default: null },
        room: { type: String, default: null },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }
      }],
      Tuesday: [{
        period: { type: Number, default: null },
        teacher: { type: String, default: null },
        room: { type: String, default: null },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }
      }],
      Wednesday: [{
        period: { type: Number, default: null },
        teacher: { type: String, default: null },
        room: { type: String, default: null },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }
      }],
      Thursday: [{
        period: { type: Number, default: null },
        teacher: { type: String, default: null },
        room: { type: String, default: null },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }
      }],
      Friday: [{
        period: { type: Number, default: null },
        teacher: { type: String, default: null },
        room: { type: String, default: null },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }
      }],
      Saturday: [{
        period: { type: Number, default: null },
        teacher: { type: String, default: null },
        room: { type: String, default: null },
        subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", default: null }
      }]
    }
   },
 });

 module.exports = mongoose.model("Room", roomSchema);
