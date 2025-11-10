const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const xlsx = require("xlsx");
const axios = require("axios");
const cors = require("cors");
const app = express();
// const con = require("./config/dbconfig");

// Models
const Teacher = require("./models/teacher");
const Subject = require("./models/subject");
const Room = require("./models/room");
const Division = require("./models/division");
const FixedSlot = require("./models/fixed_slots"); // Added this line
const User = require("./models/User"); // Import the User model
const bcrypt = require("bcryptjs"); // Import bcryptjs

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage: storage });

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Route for Page 1: Upload Excel Files
app.get("/", (req, res) => {
  res.render("index", { message: null });
});

app.post(
  "/upload",
  upload.fields([
    { name: "teachersFile", maxCount: 1 },
    { name: "subjectsFile", maxCount: 1 },
    { name: "roomsFile", maxCount: 1 },
    { name: "fixedSlotsFile", maxCount: 1 }, // Added fixedSlotsFile
  ]),
  async (req, res) => {
    console.log("--- File Upload Request Received ---"); // Log 1: Request received
    try {
      const { teachersFile, subjectsFile, roomsFile, fixedSlotsFile } = req.files; // Added fixedSlotsFile

      if (!teachersFile || !subjectsFile || !roomsFile || !fixedSlotsFile) { // Updated check
        console.error("Error: One or more files are missing."); // Log 2: Missing files
        return res.render("index", { message: "Please upload all four files." });
      }

      console.log("Teachers file path:", teachersFile[0].path); // Log 3: File path
      const teachersWorkbook = xlsx.readFile(teachersFile[0].path);
      const teachersSheet = xlsx.utils.sheet_to_json(
        teachersWorkbook.Sheets[teachersWorkbook.SheetNames[0]]
      );
      const teachersData = teachersSheet.map((row, index) => {
        console.log("Teachers - Processing row:", row); // Add this line to inspect the row object
        const misId = String(row.MIS_ID || '').trim();
        if (!misId) {
          throw new Error(`Validation Error: MIS ID is missing in Teachers file at row ${index + 2}.`);
        }

        const name = String(row.Name || '').trim();
        if (!name || !/^[a-zA-Z\s]+$/.test(name)) {
          throw new Error(`Validation Error: Name must contain only alphabetic characters in Teachers file at row ${index + 2}.`);
        }

        const email = String(row.Email || '').trim();
        if (!email || !/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,6}$/.test(email)) {
          throw new Error(`Validation Error: Email is missing or invalid in Teachers file at row ${index + 2}.`);
        }

        const designation = String(row.Designation || '').trim();
        if (!designation) {
          throw new Error(`Validation Error: Designation is missing in Teachers file at row ${index + 2}.`);
        }

        const subjectPreferences = row.Subject_Preferences ? String(row.Subject_Preferences).split(',').map(s => s.trim()) : [];
        if (!Array.isArray(subjectPreferences)) {
          throw new Error(`Validation Error: Subject Preferences must be a comma-separated string in Teachers file at row ${index + 2}.`);
        }

        return {
          mis_id: misId,
          name: name,
          email: email,
          designation: designation, // new field
          subject_preferences: subjectPreferences,
        };
      });
      console.log("Teachers data prepared:", teachersData.length, "records"); // Log 4: Data prepared
      await Teacher.deleteMany();
      await Teacher.insertMany(teachersData);
      console.log("Teachers data inserted into MongoDB."); // Log 5: Data inserted

      console.log("Subjects file path:", subjectsFile[0].path); // Log 3: File path
      const subjectsWorkbook = xlsx.readFile(subjectsFile[0].path);
      const subjectsSheet = xlsx.utils.sheet_to_json(
        subjectsWorkbook.Sheets[subjectsWorkbook.SheetNames[0]]
      );
      const subjectsData = subjectsSheet.map((row, index) => {
        console.log("Subjects - Processing row:", row); // Add this line to inspect the row object

        const department = String(row.Department || row.department || '').trim();
        if (!department) {
          throw new Error(`Validation Error: Department is missing in row ${index + 2}.`);
        }

        const semester = Number(row.Semester || row.semester);
        if (isNaN(semester) || semester <= 0) {
          throw new Error(`Validation Error: Semester must be a positive number in row ${index + 2}.`);
        }

        const theoryHours = Number(row.Theory || row.theory);
        if (isNaN(theoryHours) || theoryHours < 0) {
          throw new Error(`Validation Error: Theory hours must be a non-negative number in row ${index + 2}.`);
        }

        const labHours = Number(row.Lab || row.lab);
        if (isNaN(labHours) || labHours < 0) {
          throw new Error(`Validation Error: Lab hours must be a non-negative number in row ${index + 2}.`);
        }

        return {
          code: row.Code || row.code,
          name: row.Name || row.name,
          department: department,
          semester: semester, // Convert to number
          weekly_load: { theory: theoryHours, lab: labHours }, // Correctly format as an object
          total_hours: theoryHours + labHours, // Calculate total hours
        };
      });
      console.log("Subjects data prepared:", subjectsData.length, "records"); // Log 4: Data prepared
      await Subject.deleteMany();
      await Subject.insertMany(subjectsData);
      console.log("Subjects data inserted into MongoDB."); // Log 5: Data inserted

      console.log("Rooms file path:", roomsFile[0].path); // Log 3: File path
      console.log("roomsFile object:", roomsFile);
      const roomsWorkbook = xlsx.readFile(roomsFile[0].path);
      const roomsSheet = xlsx.utils.sheet_to_json(
        roomsWorkbook.Sheets[roomsWorkbook.SheetNames[0]]
      );
      const roomsData = roomsSheet.map((row, index) => {
        console.log("Rooms - Processing row:", row); // Add this line to inspect the row object
        const roomId = String(row.room_id || '').trim();
        if (!roomId) {
          throw new Error(`Validation Error: room_id is missing in Rooms file at row ${index + 2}.`);
        }

        const capacity = Number(row.Capacity);
        if (isNaN(capacity) || capacity <= 0) {
          throw new Error(`Validation Error: Capacity must be a positive number in Rooms file at row ${index + 2}.`);
        }

        return {
          room_id: roomId,
          capacity: capacity,
        };
      });
      console.log("Rooms data prepared:", roomsData.length, "records"); // Log 4: Data prepared
      console.log("Rooms data to be inserted:", roomsData);
      await Room.deleteMany({});
      await Room.insertMany(roomsData);
      console.log("Rooms data inserted into MongoDB."); // Log 5: Data inserted

      console.log("Fixed Slots file path:", fixedSlotsFile[0].path); // Log 3: File path
      const fixedSlotsWorkbook = xlsx.readFile(fixedSlotsFile[0].path);
      const fixedSlotsSheet = xlsx.utils.sheet_to_json(
        fixedSlotsWorkbook.Sheets[fixedSlotsWorkbook.SheetNames[0]]
      );

      // Fetch all subjects to create a lookup map for subject ObjectIds
      const subjectsInDb = await Subject.find({});
      const subjectMap = new Map(subjectsInDb.map(s => [s.name, s._id])); // Assuming 'Subject' column in Excel is subject name

      // Group fixed slots by division safely
      const groupedFixedSlots = fixedSlotsSheet.reduce((acc, row, index) => {
        console.log("Fixed Slots - Processing row:", row); // Add this line to inspect the row object
        const divisionName = String(row.Division || '').trim();
        if (!divisionName) {
          throw new Error(`Validation Error: Division is missing in Fixed Slots file at row ${index + 2}.`);
        }

        const day = Number(row.Day);
        if (isNaN(day) || day <= 0) {
          throw new Error(`Validation Error: Day must be a positive number in Fixed Slots file at row ${index + 2}.`);
        }

        const period = Number(row.Period);
        if (isNaN(period) || period <= 0) {
          throw new Error(`Validation Error: Period must be a positive number in Fixed Slots file at row ${index + 2}.`);
        }

        const teacher = String(row.Teacher || '').trim();
        if (!teacher) {
          throw new Error(`Validation Error: Teacher is missing in Fixed Slots file at row ${index + 2}.`);
        }

        const room = String(row.Room || '').trim();
        if (!room) {
          throw new Error(`Validation Error: Room is missing in Fixed Slots file at row ${index + 2}.`);
        }

        const subjectName = String(row.Subject || '').trim();
        if (!subjectName) {
          throw new Error(`Validation Error: Subject is missing in Fixed Slots file at row ${index + 2}.`);
        }

        if (!acc[divisionName]) {
          acc[divisionName] = {
            division: divisionName,
            fixed_slots: []
          };
        }

        const subjectId = subjectMap.get(subjectName);
        if (!subjectId) {
          throw new Error(`Validation Error: Subject '${subjectName}' not found in the database for Fixed Slots file at row ${index + 2}.`);
        }

        acc[divisionName].fixed_slots.push({
          day: day,
          period: period,
          teacher: teacher,
          room: room,
          subject: subjectId
        });

        return acc;
      }, {});

      const fixedSlotsData = Object.values(groupedFixedSlots);

      console.log("Fixed Slots data prepared:", fixedSlotsData.length, "records");
      await FixedSlot.deleteMany();
      await FixedSlot.insertMany(fixedSlotsData);
      console.log("Fixed Slots data inserted into MongoDB.");

      // Clear existing weekly schedules before populating new ones
      await Teacher.updateMany({}, { $set: { weekly_schedule: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] } } });
      await Subject.updateMany({}, { $set: { weekly_schedule: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] } } });
      await Room.updateMany({}, { $set: { weekly_schedule: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] } } });

      // Populate weekly schedules based on fixed slots
      for (const row of fixedSlotsSheet) {
        const day = Number(row.Day);
        const period = Number(row.Period);
        const teacherMisId = String(row.Teacher || '').trim();
        const roomName = String(row.Room || '').trim();
        const subjectName = String(row.Subject || '').trim();
        const subjectId = subjectMap.get(subjectName);

        if (day && period && teacherMisId && roomName && subjectId) {
          const dayOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day - 1];

          if (dayOfWeek) {
            // Update Teacher's schedule
            await Teacher.updateOne({ mis_id: teacherMisId }, { $push: { [`weekly_schedule.${dayOfWeek}`]: { period, subject: subjectId, room: roomName } } });
            // Update Subject's schedule
            await Subject.updateOne({ _id: subjectId }, { $push: { [`weekly_schedule.${dayOfWeek}`]: { period, teacher: teacherMisId, room: roomName } } });
            // Update Room's schedule
            await Room.updateOne({ name: roomName }, { $push: { [`weekly_schedule.${dayOfWeek}`]: { period, teacher: teacherMisId, subject: subjectId } } });
          }
        }
      }

      console.log("Weekly schedules updated based on fixed slots.");

      await Division.deleteMany();
      await Division.insertMany([
        { name: "Division A" },
        { name: "Division B" },
        { name: "Division C" },
        { name: "Division D" },
        { name: "Division E" },
      ]);
      console.log("Divisions data inserted into MongoDB."); // Log 5: Data inserted

      //fs.unlinkSync(teachersFile[0].path);
      //fs.unlinkSync(subjectsFile[0].path);
      //fs.unlinkSync(roomsFile[0].path);
      //fs.unlinkSync(fixedSlotsFile[0].path);
      //console.log("Uploaded temporary files deleted."); // Log 6: Files deleted

      console.log("--- File Upload Process Completed Successfully ---"); // Log 7: Success
      // Change this line to send a JSON response instead of redirecting
      res.json({ message: "Files uploaded successfully!", redirect: "/assign-teachers" });
    } catch (err) {
      console.error("Upload error caught in catch block:", err); // Log 8: Error caught
      // Also change this line to send a JSON error response
      res.status(500).json({ message: "Error uploading files.", error: err.message });
    }
  }
);

// Route for Page 2: Assign Teachers
app.get("/assign-teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find({}, "name mis_id email");
    const subjects = await Subject.find(
      {},
      "name code assignedTeachers"
    ).populate("assignedTeachers");
    res.render("assign-teachers", { teachers, subjects });
  } catch (err) {
    console.error("Error loading assign-teachers:", err);
    res.status(500).send("Error loading assign-teachers page.");
  }
});

// New API endpoint to get teachers and subjects as JSON
app.get("/api/teachers-subjects", async (req, res) => {
  try {
    const teachers = await Teacher.find({}, "name mis_id email");
    const subjects = await Subject.find({}, "name code assignedTeachers");
    res.json({ teachers, subjects });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch teachers and subjects" });
  }
});

// Step 3: Backend me Assign Route
app.put("/api/subjects/:id/assign", async (req, res) => {
  try {
    const { teacherId } = req.body;
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { assignedTeacher: teacherId },
      { new: true }
    ).populate("assignedTeacher");
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: "Failed to assign teacher" });
  }
});

app.post("/assign", async (req, res) => {
  try {
    const assignments = req.body.assignments;
    console.log("Assignments received:", assignments);

    for (const subjectId in assignments) {
      const teacherIds = assignments[subjectId];
      const teachersArray = Array.isArray(teacherIds)
        ? teacherIds
        : teacherIds
        ? [teacherIds]
        : [];
      await Subject.findByIdAndUpdate(
        subjectId,
        { assignedTeachers: teachersArray },
        { new: true, runValidators: true }
      );
    }

    console.log("Redirecting to /get-timetable after assign");
    res.redirect("/get-timetable");
  } catch (err) {
    console.error("Assign error:", err);
    res.status(500).send("Error assigning teachers to subjects.");
  }
});

// Route for Fetching Timetable from FastAPI
app.get("/get-timetable", async (req, res) => {
  try {
    const teachers = await Teacher.find({}, "name email");
    const subjects = await Subject.find(
      {},
      "name code assignedTeachers"
    ).populate("assignedTeachers");
    const rooms = await Room.find({}, "name capacity");
    const divisions = await Division.find({}, "name");

    const timetableData = {
      teachers: teachers.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        email: t.email,
      })),
      subjects: subjects.map((s) => ({
        id: s._id.toString(),
        code: s.code,
        name: s.name,
        assignedTeachers: s.assignedTeachers.map((t) => t._id.toString()),
      })),
      rooms: rooms.map((r) => ({
        id: r._id.toString(),
        name: r.name,
        capacity: r.capacity,
      })),
      divisions: divisions.map((d) => ({ id: d._id.toString(), name: d.name })),
    };

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/generate-timetable",
        timetableData
      );
      const timetables = response.data;
      res.render("display-timetable", { timetables });
    } catch (apiError) {
      console.error("FastAPI Error:", apiError.message);
      res.render("display-timetable", {
        timetables: [],
        error: "Failed to generate timetable. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error preparing timetable data:", error.message);
    res.status(500).send(`Failed to prepare timetable data: ${error.message}`);
  }
});

// Route for Generating Timetable from FastAPI
app.post("/get-timetable", async (req, res) => {
  try {
    const teachers = await Teacher.find({}, "name email");
    const subjects = await Subject.find(
      {},
      "name code assignedTeachers"
    ).populate("assignedTeachers");
    const rooms = await Room.find({}, "name capacity");
    const divisions = await Division.find({}, "name");

    const timetableData = {
      teachers: teachers.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        email: t.email,
      })),
      subjects: subjects.map((s) => ({
        id: s._id.toString(),
        code: s.code,
        name: s.name,
        assignedTeachers: s.assignedTeachers.map((t) => t._id.toString()),
      })),
      rooms: rooms.map((r) => ({
        id: r._id.toString(),
        name: r.name,
        capacity: r.capacity,
      })),
      divisions: divisions.map((d) => ({ id: d._id.toString(), name: d.name })),
    };

    console.log("\nData being sent to FastAPI:");
    console.log("Teachers:", JSON.stringify(timetableData.teachers, null, 2));
    console.log("Subjects:", JSON.stringify(timetableData.subjects, null, 2));
    console.log("Rooms:", JSON.stringify(timetableData.rooms, null, 2));
    console.log("Divisions:", JSON.stringify(timetableData.divisions, null, 2));

    console.log("Sending to FastAPI:", JSON.stringify(timetableData, null, 2));
    const response = await axios.post(
      "http://127.0.0.1:8000/generate-timetable",
      timetableData
    );
    const timetables = response.data;

    console.log("FastAPI Response:", timetables);
    res.render("display-timetable", { timetables });
  } catch (error) {
    console.error("Error generating timetable:", error.message);
    res.status(500).send(`Failed to generate timetable: ${error.message}`);
  }
});

// Fallback for misrouted requests
app.post("/generate-timetable", (req, res) => {
  res
    .status(404)
    .send(
      "Route not found. Did you mean to call the FastAPI endpoint at http://127.0.0.1:8000/generate-timetable?"
    );
});

// User Signup Route
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    user = new User({
      email,
      password, // Password will be hashed by the pre-save hook in User model
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error during signup" });
  }
});

// User Login Route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare provided password with hashed password in DB
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // For now, we'll just send a success message.
    // In a real application, you would generate a JWT token here.
    res.status(200).json({ message: "Logged in successfully" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Connect to MongoDB and start server
mongoose
  .connect("mongodb://localhost:27017/timetableDB")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000");
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
