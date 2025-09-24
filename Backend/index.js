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
      const teachersData = teachersSheet.map((row) => ({
        mis_id: row.MIS_ID,
        name: row.Name,
        email: row.Email,
        designation: row.Designation, // new field
        subject_preferences: row.Subject_Preferences ? row.Subject_Preferences.split(',').map(s => s.trim()) : [],
      }));
      console.log("Teachers data prepared:", teachersData.length, "records"); // Log 4: Data prepared
      await Teacher.deleteMany();
      await Teacher.insertMany(teachersData);
      console.log("Teachers data inserted into MongoDB."); // Log 5: Data inserted

      console.log("Subjects file path:", subjectsFile[0].path); // Log 3: File path
      const subjectsWorkbook = xlsx.readFile(subjectsFile[0].path);
      const subjectsSheet = xlsx.utils.sheet_to_json(
        subjectsWorkbook.Sheets[subjectsWorkbook.SheetNames[0]]
      );
      const subjectsData = subjectsSheet.map((row) => {
        console.log("Processing row:", row); // Add this line to inspect the row object
        const theoryHours = Number(row.Theory || row.theory) || 0;
        const labHours = Number(row.Lab || row.lab) || 0;
        return {
          code: row.Code || row.code,
          name: row.Name || row.name,
          department: row.Department || row.department,
          semester: Number(row.Semester || row.semester) || 0, // Convert to number
          weekly_load: { theory: theoryHours, lab: labHours }, // Correctly format as an object
          total_hours: theoryHours + labHours, // Calculate total hours
        };
      });
      console.log("Subjects data prepared:", subjectsData.length, "records"); // Log 4: Data prepared
      await Subject.deleteMany();
      await Subject.insertMany(subjectsData);
      console.log("Subjects data inserted into MongoDB."); // Log 5: Data inserted

      console.log("Rooms file path:", roomsFile[0].path); // Log 3: File path
      const roomsWorkbook = xlsx.readFile(roomsFile[0].path);
      const roomsSheet = xlsx.utils.sheet_to_json(
        roomsWorkbook.Sheets[roomsWorkbook.SheetNames[0]]
      );
      const roomsData = roomsSheet.map((row) => ({
        room_id: row.Room_ID, // Mapped to 'Room_ID' from your Excel
        name: row.Name,       // Mapped to 'Name' from your Excel
        capacity: Number(row.Capacity), // Mapped to 'Capacity' from your Excel and converted to number
      }));
      console.log("Rooms data prepared:", roomsData.length, "records"); // Log 4: Data prepared
      await Room.deleteMany();
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
        const divisionName = row.Division?.toString().trim(); // Trim and ensure string
        if (!divisionName) {
          console.warn(`Skipping fixed slot at row ${index + 2}: Division missing`);
          return acc; // skip this row
        }

        if (!acc[divisionName]) {
          acc[divisionName] = {
            division: divisionName,
            fixed_slots: []
          };
        }

        const subjectId = subjectMap.get(row.Subject);
        if (!subjectId) {
          console.warn(`Skipping fixed slot at row ${index + 2}: Subject '${row.Subject}' not found`);
          return acc; // skip this fixed slot if subject not found
        }

        acc[divisionName].fixed_slots.push({
          day: Number(row.Day),
          period: Number(row.Period),
          teacher: row.Teacher,
          room: row.Room,
          subject: subjectId
        });

        return acc;
      }, {});

      const fixedSlotsData = Object.values(groupedFixedSlots);

      console.log("Fixed Slots data prepared:", fixedSlotsData.length, "records");
      await FixedSlot.deleteMany();
      await FixedSlot.insertMany(fixedSlotsData);
      console.log("Fixed Slots data inserted into MongoDB.");

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
