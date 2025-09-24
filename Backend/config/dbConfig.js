const mongoose = require("mongoose");

const con = mongoose
  .connect("mongodb://localhost:27017/AUTO_TIMETABLE")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

module.exports = con;

/**
 mongoose.connect('mongodb://localhost:27017/tabularDSA', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

 */// ... existing code ...
   return {
     uploadTeachers: handleUpload(Teacher, REQUIRED_COLUMNS.teachers, 'teachersFile', 'Teachers'),
     uploadSubjects: handleUpload(Subject, REQUIRED_COLUMNS.subjects, 'subjectsFile', 'Subjects'),
     uploadRooms: handleUpload(Room, REQUIRED_COLUMNS.rooms, 'roomsFile', 'Rooms'),
     uploadFixedSlots: handleUpload(
       FixedSlot,
       REQUIRED_COLUMNS['fixed-slots'],
       'fixedSlotFile', // <-- Yahan 'fixedSlotFile' hai
       'Fixed Slots'
     ),
   };
// ... existing code ...// ... existing code ...
 const REQUIRED_COLUMNS = {
   teachers: ['mis_id', 'name', 'email', 'designation', 'subject_preferences'], }// <-- mis_id yahan required hai
// ... existing code ...