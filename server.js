require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/Engineering_study_planner";
const JWT_SECRET = process.env.JWT_SECRET || "development_secret_change_me";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later." },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  college: { type: String, default: "" },
  branch: { type: String, default: "" },
  semester: { type: String, default: "" },
  rollNo: { type: String, default: "" },
  role: { type: String, enum: ["student", "admin"], default: "student" },
  createdAt: { type: Date, default: Date.now },
});

const subjectSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  code: String,
  faculty: String,
  semester: String,
  credits: Number,
  deadline: String,
  priority: {
    type: String,
    enum: ["High", "Medium", "Low"],
    default: "Medium",
  },
  icon: { type: String, default: "📚" },
  notes: String,
  completed: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const assignmentSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  subject: String,
  dueDate: String,
  priority: {
    type: String,
    enum: ["High", "Medium", "Low"],
    default: "Medium",
  },
  description: String,
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const examSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  subject: String,
  examType: String,
  date: String,
  time: String,
  room: String,
  syllabus: String,
  createdAt: { type: Date, default: Date.now },
});

const timetableSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  day: String,
  startTime: String,
  endTime: String,
  subject: String,
  room: String,
  faculty: String,
  createdAt: { type: Date, default: Date.now },
});

const noteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  subject: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const attendanceSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  subject: String,
  attended: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Subject = mongoose.model("Subject", subjectSchema);
const Assignment = mongoose.model("Assignment", assignmentSchema);
const Exam = mongoose.model("Exam", examSchema);
const Timetable = mongoose.model("Timetable", timetableSchema);
const Note = mongoose.model("Note", noteSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

function tokenFor(user) {
  return jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token)
    return res.status(401).json({ message: "Authentication required." });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Session expired. Please log in again." });
  }
}

function modelFor(type) {
  return {
    subjects: Subject,
    assignments: Assignment,
    exams: Exam,
    timetable: Timetable,
    notes: Note,
    attendance: Attendance,
  }[type];
}

app.post("/api/setup-admin", async (req, res) => {
  const secret = process.env.ADMIN_SETUP_KEY;
  if (!secret || req.body.key !== secret)
    return res.status(403).json({ message: "Invalid setup key." });
  const email = (req.body.email || "").toLowerCase();
  const user = await User.findOne({ email });
  if (!user)
    return res
      .status(404)
      .json({ message: "User not found. Create the account first." });
  user.role = "admin";
  await user.save();
  res.json({ message: `${user.email} is now an admin.` });
});

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password, college, branch, semester, rollNo } =
      req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email and password are required." });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashed,
      college,
      branch,
      semester,
      rollNo,
    });
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ message: "Unable to create account." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    res.json({ token: tokenFor(user), user: safeUser(user) });
  } catch {
    res.status(500).json({ message: "Unable to log in." });
  }
});

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    college: user.college,
    branch: user.branch,
    semester: user.semester,
    rollNo: user.rollNo,
    role: user.role,
  };
}

function adminOnly(req, res, next) {
  User.findById(req.userId)
    .then((user) => {
      if (!user || user.role !== "admin")
        return res.status(403).json({ message: "Admin access required." });
      req.admin = user;
      next();
    })
    .catch(() =>
      res.status(500).json({ message: "Unable to verify admin access." }),
    );
}

app.get("/api/admin/stats", auth, adminOnly, async (req, res) => {
  const [
    students,
    subjects,
    assignments,
    exams,
    attendanceRecords,
    notes,
    timetable,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    Subject.countDocuments(),
    Assignment.countDocuments(),
    Exam.countDocuments(),
    Attendance.countDocuments(),
    Note.countDocuments(),
    Timetable.countDocuments(),
  ]);
  const [completedSubjects, completedAssignments] = await Promise.all([
    Subject.countDocuments({ completed: true }),
    Assignment.countDocuments({ completed: true }),
  ]);
  const totalAttendance = await Attendance.aggregate([
    {
      $group: {
        _id: null,
        attended: { $sum: "$attended" },
        total: { $sum: "$total" },
      },
    },
  ]);
  const attendancePercent = totalAttendance[0]?.total
    ? Math.round((totalAttendance[0].attended / totalAttendance[0].total) * 100)
    : 0;
  res.json({
    students,
    subjects,
    assignments,
    exams,
    attendanceRecords,
    notes,
    timetable,
    completedSubjects,
    completedAssignments,
    attendancePercent,
  });
});

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  const users = await User.find({ role: "student" })
    .select("-password")
    .sort({ createdAt: -1 });
  res.json(users);
});

app.get("/api/admin/analytics", auth, adminOnly, async (req, res) => {
  const [
    usersByBranch,
    usersBySemester,
    subjectCompletion,
    assignmentCompletion,
  ] = await Promise.all([
    User.aggregate([
      { $match: { role: "student" } },
      {
        $group: {
          _id: { $ifNull: ["$branch", "Unknown"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      { $match: { role: "student" } },
      {
        $group: {
          _id: { $ifNull: ["$semester", "Unknown"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Subject.aggregate([{ $group: { _id: "$completed", count: { $sum: 1 } } }]),
    Assignment.aggregate([
      { $group: { _id: "$completed", count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    usersByBranch,
    usersBySemester,
    subjectCompletion,
    assignmentCompletion,
  });
});

app.get("/api/admin/records", auth, adminOnly, async (req, res) => {
  const [subjects, assignments, exams, attendance] = await Promise.all([
    Subject.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(500),
    Assignment.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(500),
    Exam.find().populate("userId", "name email").sort({ date: 1 }).limit(500),
    Attendance.find()
      .populate("userId", "name email")
      .sort({ updatedAt: -1 })
      .limit(500),
  ]);
  res.json({ subjects, assignments, exams, attendance });
});

app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  if (req.params.id === req.userId)
    return res
      .status(400)
      .json({ message: "You cannot delete your own admin account." });
  const user = await User.findOne({ _id: req.params.id, role: "student" });
  if (!user) return res.status(404).json({ message: "Student not found." });

  const filter = { userId: user._id };
  await Promise.all([
    Subject.deleteMany(filter),
    Assignment.deleteMany(filter),
    Exam.deleteMany(filter),
    Timetable.deleteMany(filter),
    Note.deleteMany(filter),
    Attendance.deleteMany(filter),
    User.deleteOne({ _id: user._id }),
  ]);
  res.json({ deleted: true });
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(safeUser(user));
});

app.put("/api/me", auth, async (req, res) => {
  const allowed = ["name", "college", "branch", "semester", "rollNo"];
  const update = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) update[k] = req.body[k];
  });
  const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
  res.json(safeUser(user));
});

app.put("/api/auth/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Current and new password are required." });
    if (String(newPassword).length < 8)
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters." });
    const user = await User.findById(req.userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect." });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({
      message:
        "Password changed successfully. Please log in again on other devices.",
    });
  } catch (e) {
    res.status(500).json({ message: "Unable to change password." });
  }
});

app.get("/api/data", auth, async (req, res) => {
  const filter = { userId: req.userId };
  const [subjects, assignments, exams, timetable, notes, attendance] =
    await Promise.all([
      Subject.find(filter).sort({ pinned: -1, createdAt: -1 }),
      Assignment.find(filter).sort({ completed: 1, dueDate: 1 }),
      Exam.find(filter).sort({ date: 1 }),
      Timetable.find(filter).sort({ day: 1, startTime: 1 }),
      Note.find(filter).sort({ updatedAt: -1 }),
      Attendance.find(filter).sort({ subject: 1 }),
    ]);
  res.json({ subjects, assignments, exams, timetable, notes, attendance });
});

function validateId(id) {
  return mongoose.isValidObjectId(id);
}

app.get("/api/health", async (req, res) => {
  res.json({ ok: true, mongo: mongoose.connection.readyState === 1 });
});

const resourceModels = {
  subjects: Subject,
  assignments: Assignment,
  exams: Exam,
  timetable: Timetable,
  notes: Note,
  attendance: Attendance,
};

function cleanPayload(type, body) {
  const allowed = {
    subjects: [
      "name",
      "code",
      "faculty",
      "semester",
      "credits",
      "deadline",
      "priority",
      "icon",
      "notes",
      "completed",
      "pinned",
    ],
    assignments: [
      "title",
      "subject",
      "dueDate",
      "priority",
      "description",
      "completed",
    ],
    exams: ["subject", "examType", "date", "time", "room", "syllabus"],
    timetable: ["day", "startTime", "endTime", "subject", "room", "faculty"],
    notes: ["title", "subject", "content"],
    attendance: ["subject", "attended", "total"],
  };
  const result = {};
  for (const key of allowed[type] || []) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
}

function validateResource(type, data) {
  if (type === "subjects" && !String(data.name || "").trim())
    return "Subject name is required.";
  if (type === "assignments" && !String(data.title || "").trim())
    return "Assignment title is required.";
  if (type === "exams" && !String(data.subject || "").trim())
    return "Exam subject is required.";
  if (type === "timetable" && !String(data.subject || "").trim())
    return "Timetable subject is required.";
  if (
    type === "notes" &&
    (!String(data.title || "").trim() || !String(data.content || "").trim())
  )
    return "Note title and content are required.";
  if (type === "attendance") {
    if (!String(data.subject || "").trim())
      return "Attendance subject is required.";
    const attended = Number(data.attended),
      total = Number(data.total);
    if (
      !Number.isFinite(attended) ||
      !Number.isFinite(total) ||
      attended < 0 ||
      total < 0 ||
      attended > total
    )
      return "Attendance values are invalid. Attended cannot exceed total classes.";
  }
  return null;
}

// Explicit CRUD endpoints. These avoid ambiguous resource handling and return useful errors.
app.post("/api/:type", auth, async (req, res) => {
  const type = req.params.type;
  const Model = resourceModels[type];
  if (!Model) return res.status(404).json({ message: "Invalid resource." });
  try {
    if (mongoose.connection.readyState !== 1)
      return res
        .status(503)
        .json({
          message:
            "MongoDB is not connected. Start MongoDB and restart the server.",
        });
    const payload = cleanPayload(type, req.body || {});
    const validation = validateResource(type, payload);
    if (validation) return res.status(400).json({ message: validation });
    payload.userId = new mongoose.Types.ObjectId(req.userId);
    const item = await Model.create(payload);
    console.log(`[CREATE] ${type}: ${item._id} user=${req.userId}`);
    res.status(201).json(item);
  } catch (err) {
    console.error(`[CREATE ERROR] ${type}:`, err);
    res.status(400).json({ message: err?.message || "Unable to save record." });
  }
});

app.put("/api/:type/:id", auth, async (req, res) => {
  const type = req.params.type;
  const Model = resourceModels[type];
  if (!Model) return res.status(404).json({ message: "Invalid resource." });
  if (!validateId(req.params.id))
    return res.status(400).json({ message: "Invalid record ID." });
  try {
    const payload = cleanPayload(type, req.body || {});
    const validation = validateResource(type, payload);
    if (validation) return res.status(400).json({ message: validation });
    const item = await Model.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: payload },
      { new: true, runValidators: true },
    );
    if (!item) return res.status(404).json({ message: "Record not found." });
    res.json(item);
  } catch (err) {
    console.error(`[UPDATE ERROR] ${type}:`, err);
    res
      .status(400)
      .json({ message: err?.message || "Unable to update record." });
  }
});

app.delete("/api/:type/:id", auth, async (req, res) => {
  const type = req.params.type;
  const Model = resourceModels[type];
  if (!Model) return res.status(404).json({ message: "Invalid resource." });
  if (!validateId(req.params.id))
    return res.status(400).json({ message: "Invalid record ID." });
  try {
    const result = await Model.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });
    res.json({ deleted: result.deletedCount === 1 });
  } catch (err) {
    res
      .status(400)
      .json({ message: err?.message || "Unable to delete record." });
  }
});

app.get("/api/export/pdf", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const filter = { userId: req.userId };
    const [subjects, assignments, exams, attendance] = await Promise.all([
      Subject.find(filter).sort({ name: 1 }),
      Assignment.find(filter).sort({ dueDate: 1 }),
      Exam.find(filter).sort({ date: 1 }),
      Attendance.find(filter).sort({ subject: 1 }),
    ]);

    const doc = new PDFDocument({ margin: 45, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Engineering_Study_Report_${Date.now()}.pdf"`,
    );
    doc.pipe(res);

    doc.fontSize(22).text("Engineering Study Planner", { align: "center" });
    doc.moveDown(0.4);
    doc
      .fontSize(12)
      .fillColor("#555")
      .text("Student Academic Report", { align: "center" });
    doc.fillColor("#111").moveDown();

    doc.fontSize(15).text("Student Profile");
    doc.fontSize(10).text(`Name: ${user.name}`);
    doc.text(`Email: ${user.email}`);
    doc.text(`College: ${user.college || "-"}`);
    doc.text(`Branch: ${user.branch || "-"}`);
    doc.text(`Semester: ${user.semester || "-"}`);
    doc.text(`Roll No: ${user.rollNo || "-"}`);
    doc.moveDown();

    const completed = subjects.filter((s) => s.completed).length;
    const progress = subjects.length
      ? Math.round((completed / subjects.length) * 100)
      : 0;

    doc.fontSize(15).text("Overview");
    doc.fontSize(10).text(`Subjects: ${subjects.length}`);
    doc.text(`Completed subjects: ${completed}`);
    doc.text(`Subject progress: ${progress}%`);
    doc.text(`Assignments: ${assignments.length}`);
    doc.text(`Exams: ${exams.length}`);
    doc.moveDown();

    doc.fontSize(15).text("Subjects");
    subjects.forEach((s, i) => {
      doc
        .fontSize(10)
        .text(
          `${i + 1}. ${s.name} (${s.code || "-"}) | Faculty: ${s.faculty || "-"} | Deadline: ${s.deadline || "-"} | ${s.completed ? "Completed" : "Pending"}`,
        );
    });
    doc.moveDown();

    doc.fontSize(15).text("Assignments");
    assignments.forEach((a, i) => {
      doc
        .fontSize(10)
        .text(
          `${i + 1}. ${a.title} | ${a.subject || "-"} | Due: ${a.dueDate || "-"} | ${a.completed ? "Completed" : "Pending"}`,
        );
    });
    doc.moveDown();

    doc.fontSize(15).text("Exams");
    exams.forEach((e, i) => {
      doc
        .fontSize(10)
        .text(
          `${i + 1}. ${e.subject || "-"} | ${e.examType || "-"} | ${e.date || "-"} ${e.time || ""} | Room: ${e.room || "-"}`,
        );
    });
    doc.moveDown();

    doc.fontSize(15).text("Attendance");
    attendance.forEach((a, i) => {
      const pct = a.total ? Math.round((a.attended / a.total) * 100) : 0;
      doc
        .fontSize(10)
        .text(`${i + 1}. ${a.subject} | ${a.attended}/${a.total} | ${pct}%`);
    });

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor("#777")
      .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });
    doc.end();
  } catch {
    res.status(500).json({ message: "Unable to generate PDF." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(
        `Engineering Study Planner running at http://localhost:${PORT}`,
      );
    });
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

startServer();
