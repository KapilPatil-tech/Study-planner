// Public.app
const API_BASE = "https://study-planner-7e91.onrender.com";
const state = {
  token: localStorage.getItem("esp_token"),
  user: null,
  data: {
    subjects: [],
    assignments: [],
    exams: [],
    timetable: [],
    notes: [],
    attendance: [],
  },
  admin: {
    stats: null,
    users: [],
    records: { subjects: [], assignments: [], exams: [], attendance: [] },
    tab: "students",
    analytics: null,
    search: "",
  },
  page: "dashboard",
  edit: null,
};

const $ = (id) => document.getElementById(id);
const authView = $("authView"),
  appView = $("appView"),
  modal = $("modal");

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("toast").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const fullUrl = `${API_BASE}${url}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    logout(false);
    throw new Error("Session expired");
  }

  const data = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : res;

  if (!res.ok) {
    const message =
      data && data.message ? data.message : `Request failed (${res.status})`;

    throw new Error(message);
  }

  return data;
}

function setAuthTab(tab) {
  document
    .querySelectorAll(".auth-tabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.auth === tab));
  $("loginForm").classList.toggle("hidden", tab !== "login");
  $("signupForm").classList.toggle("hidden", tab !== "signup");
}
document
  .querySelectorAll("[data-auth]")
  .forEach((b) => (b.onclick = () => setAuthTab(b.dataset.auth)));

$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("loginEmail").value,
        password: $("loginPassword").value,
      }),
    });
    state.token = result.token;
    localStorage.setItem("esp_token", state.token);
    await startApp();
  } catch (err) {
    toast(err.message);
  }
};

$("signupForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const result = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: $("signupName").value,
        rollNo: $("signupRoll").value,
        email: $("signupEmail").value,
        password: $("signupPassword").value,
        college: $("signupCollege").value,
        branch: $("signupBranch").value,
        semester: $("signupSemester").value,
      }),
    });
    state.token = result.token;
    localStorage.setItem("esp_token", state.token);
    await startApp();
  } catch (err) {
    toast(err.message);
  }
};

async function startApp() {
  try {
    state.user = await api("/api/me");
    state.data = await api("/api/data");
    if (state.user.role === "admin") await loadAdmin();
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    $("avatar").textContent = (state.user.name || "S")[0].toUpperCase();
    render();
  } catch {
    logout(false);
  }
}

async function loadAdmin() {
  if (state.user?.role !== "admin") return;
  try {
    const [stats, users, records] = await Promise.all([
      api("/api/admin/stats"),
      api("/api/admin/users"),
      api("/api/admin/records"),
    ]);
    state.admin = { ...state.admin, stats, users, records };
  } catch (e) {
    toast(e.message);
  }
}

function logout(show = true) {
  state.token = null;
  localStorage.removeItem("esp_token");
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  if (show) toast("Logged out.");
}

$("logoutBtn").onclick = () => logout(true);

document.querySelectorAll(".nav-item,.bottom-nav button").forEach((btn) => {
  btn.onclick = () => {
    state.page = btn.dataset.page;
    document
      .querySelectorAll(".nav-item")
      .forEach((n) =>
        n.classList.toggle("active", n.dataset.page === state.page),
      );
    document.querySelector(".sidebar").classList.remove("open");
    render();
  };
});

const sidebar = document.querySelector(".sidebar");
const mobileMenu = $("mobileMenu");

mobileMenu.onclick = (e) => {
  e.stopPropagation();
  sidebar.classList.toggle("open");
};

// Close sidebar when tapping/clicking outside it
document.addEventListener("click", (e) => {
  if (
    window.innerWidth <= 800 &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    !mobileMenu.contains(e.target)
  ) {
    sidebar.classList.remove("open");
  }
});

// Prevent clicks inside sidebar from closing it
sidebar.addEventListener("click", (e) => {
  e.stopPropagation();
});

$("themeBtn").onclick = () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "esp_theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light",
  );
};
if (localStorage.getItem("esp_theme") === "dark")
  document.body.classList.add("dark-mode");

$("modalClose").onclick = () => modal.classList.add("hidden");
modal.onclick = (e) => {
  if (e.target === modal) modal.classList.add("hidden");
};

$("pdfBtn").onclick = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/export/pdf`, {
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    });
    if (!res.ok) throw new Error("Could not create PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Engineering_Study_Report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast(e.message);
  }
};

$("backupBtn").onclick = () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    user: state.user,
    ...state.data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Engineering_Study_Planner_Backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}
function pct(a, b) {
  return b ? Math.min(100, Math.round((a / b) * 100)) : 0;
}
function empty(text) {
  return `<div class="empty">${esc(text)}</div>`;
}
function formatDate(d) {
  if (!d) return "-";
  const x = new Date(d + "T00:00:00");
  return isNaN(x) ? d : x.toLocaleDateString();
}

function plannerStorageKey() {
  return `esp_smart_plan_${state.user?._id || state.user?.id || "student"}`;
}
function loadSavedPlan() {
  try {
    return JSON.parse(localStorage.getItem(plannerStorageKey()) || "null");
  } catch {
    return null;
  }
}
function savePlan(plan) {
  localStorage.setItem(plannerStorageKey(), JSON.stringify(plan));
}
function plannerDate(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).includes("T") ? raw : `${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function plannerDaysBetween(a, b) {
  return Math.max(0, Math.ceil((b - a) / 86400000));
}
function plannerFormatMinutes(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60),
    m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
function generateSmartPlan(opts) {
  const d = state.data;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = opts.examId
    ? d.exams.find((x) => String(x._id) === String(opts.examId))
    : null;
  const examDate = exam ? plannerDate(exam.date) : null;
  const days = Math.max(1, Math.min(60, Number(opts.days) || 7));
  let end = examDate || new Date(today.getTime() + (days - 1) * 86400000);
  if (end < today) end = new Date(today);
  const totalDays = Math.max(
    1,
    Math.min(60, plannerDaysBetween(today, end) + 1),
  );
  const hours = Math.max(1, Math.min(12, Number(opts.hours) || 3));
  const session = Math.max(25, Math.min(120, Number(opts.session) || 50));
  const weak = (opts.weak || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const upcomingAssignments = d.assignments
    .filter((a) => !a.completed)
    .map((a) => ({
      subject: String(a.subject || "").toLowerCase(),
      date: plannerDate(a.dueDate),
      priority: a.priority,
    }));
  const upcomingExams = d.exams.map((e) => ({
    subject: String(e.subject || "").toLowerCase(),
    date: plannerDate(e.date),
  }));

  const subjects = d.subjects.length
    ? d.subjects.map((s) => ({
        name: s.name || "General Study",
        score:
          (weak.some((w) =>
            String(s.name || "")
              .toLowerCase()
              .includes(w),
          )
            ? 5
            : 0) +
          (s.completed ? 0 : 2) +
          (upcomingAssignments.some(
            (a) =>
              a.subject.includes(String(s.name || "").toLowerCase()) &&
              a.date &&
              plannerDaysBetween(today, a.date) <= 7,
          )
            ? 3
            : 0) +
          (upcomingExams.some(
            (e) =>
              e.subject.includes(String(s.name || "").toLowerCase()) &&
              e.date &&
              plannerDaysBetween(today, e.date) <= 14,
          )
            ? 4
            : 0),
      }))
    : [{ name: "General Study", score: 1 }];

  subjects.sort((a, b) => b.score - a.score);
  const plan = [];
  let completedMinutes = 0;
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = new Date(today.getTime() + dayIndex * 86400000);
    const isExamEve = examDate && plannerDaysBetween(date, examDate) <= 1;
    const available = hours * 60;
    const targetSessions = Math.max(1, Math.floor(available / session));
    const slots = [];
    for (let s = 0; s < targetSessions; s++) {
      let subject;
      if (isExamEve) subject = subjects[s % subjects.length];
      else subject = subjects[(dayIndex + s) % subjects.length];
      const mins = Math.min(
        session,
        available - slots.reduce((sum, x) => sum + x.minutes, 0),
      );
      if (mins < 20) break;
      const isRevision = isExamEve || dayIndex >= totalDays - 2;
      slots.push({
        subject: subject.name,
        minutes: mins,
        type: isRevision
          ? "Revision & practice"
          : s === 0
            ? "Concept study"
            : "Practice & questions",
        done: false,
      });
      completedMinutes += mins;
    }
    if (!slots.length)
      slots.push({
        subject: subjects[0].name,
        minutes: session,
        type: "Concept study",
        done: false,
      });
    plan.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
      sessions: slots,
    });
  }
  return {
    createdAt: new Date().toISOString(),
    examId: opts.examId || "",
    examSubject: exam?.subject || "",
    examDate: exam?.date || "",
    hours,
    session,
    days: totalDays,
    weak: opts.weak || "",
    totalMinutes: completedMinutes,
    plan,
  };
}

/* ===== Phases 7–13 utility layer ===== */
function localKey(name) {
  return `esp_${name}_${state.user?._id || state.user?.id || "student"}`;
}
function getLocal(name, fallback = []) {
  try {
    return JSON.parse(
      localStorage.getItem(localKey(name)) || JSON.stringify(fallback),
    );
  } catch {
    return fallback;
  }
}
function setLocal(name, value) {
  localStorage.setItem(localKey(name), JSON.stringify(value));
}
function daysUntil(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).includes("T") ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
}
function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function examPrepKey(examId) {
  return `${localKey("exam_prep")}_${examId}`;
}
function getPrep(examId) {
  try {
    return JSON.parse(localStorage.getItem(examPrepKey(examId)) || "null");
  } catch {
    return null;
  }
}
function savePrep(examId, obj) {
  localStorage.setItem(examPrepKey(examId), JSON.stringify(obj));
}

function ensureNotifications() {
  const existing = getLocal("notifications", []);
  const generated = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  state.data.assignments
    .filter((a) => !a.completed)
    .forEach((a) => {
      const n = daysUntil(a.dueDate);
      if (n !== null && n <= 2)
        generated.push({
          id: `a_${a._id}`,
          title: `Assignment due ${n <= 0 ? "today" : n === 1 ? "tomorrow" : "soon"}`,
          body: `${a.title}${a.subject ? ` · ${a.subject}` : ""}`,
          kind: "deadline",
          read: false,
          createdAt: new Date().toISOString(),
        });
    });
  state.data.exams.forEach((e) => {
    const n = daysUntil(e.date);
    if (n !== null && n >= 0 && n <= 7)
      generated.push({
        id: `e_${e._id}`,
        title: `Exam in ${n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`}`,
        body: `${e.subject}${e.examType ? ` · ${e.examType}` : ""}`,
        kind: "exam",
        read: false,
        createdAt: new Date().toISOString(),
      });
  });
  state.data.attendance.forEach((a) => {
    const p = pct(safeNum(a.attended), safeNum(a.total));
    if (a.total && p < 75)
      generated.push({
        id: `att_${a._id}`,
        title: "Attendance critical",
        body: `${a.subject} is at ${p}% attendance.`,
        kind: "attendance",
        read: false,
        createdAt: new Date().toISOString(),
      });
  });
  const map = new Map(existing.map((x) => [x.id, x]));
  generated.forEach((x) => {
    if (!map.has(x.id)) map.set(x.id, x);
  });
  const result = [...map.values()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
  setLocal("notifications", result);
  return result;
}
function goalsData() {
  return getLocal("goals", {
    dailyMinutes: 120,
    weeklyMinutes: 600,
    completedMinutes: 0,
    streak: 0,
    lastStudyDate: "",
    history: [],
  });
}
function saveGoals(x) {
  setLocal("goals", x);
}
function studyMinutesFromPlan() {
  const p = loadSavedPlan();
  return p
    ? p.plan
        .flatMap((d) => d.sessions)
        .filter((s) => s.done)
        .reduce((a, s) => a + safeNum(s.minutes), 0)
    : 0;
}
function calculateExamPrep(exam) {
  const key = exam._id,
    existing = getPrep(key);
  const topics =
    existing?.topics ||
    String(exam.syllabus || "")
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((name, i) => ({ id: `t${i}`, name, done: false, important: i < 2 }));
  return {
    topics,
    notes: existing?.notes || "",
    questions: existing?.questions || 0,
    score: existing?.score || 0,
  };
}
function prepScore(prep) {
  const t = prep.topics || [];
  return t.length
    ? Math.round((t.filter((x) => x.done).length / t.length) * 100)
    : 0;
}
function generateNotificationsFromData() {
  ensureNotifications();
}

function render() {
  const titles = {
    dashboard: ["OVERVIEW", "Dashboard"],
    subjects: ["ACADEMICS", "Subjects"],
    assignments: ["PRODUCTIVITY", "Assignments"],
    exams: ["ACADEMICS", "Exam Schedule"],
    timetable: ["SCHEDULE", "Timetable"],
    notes: ["KNOWLEDGE", "Notes"],
    attendance: ["ANALYTICS", "Attendance"],
    "attendance-intelligence": ["ANALYTICS", "Attendance Intelligence"],
    planner: ["AI STUDY TOOLS", "Smart Study Planner"],
    "exam-prep": ["EXAM TOOLS", "Exam Preparation"],
    analytics: ["ANALYTICS", "Study Analytics"],
    notifications: ["ALERTS", "Notifications"],
    goals: ["PRODUCTIVITY", "Goals & Streak"],
    profile: ["ACCOUNT", "Profile"],
    admin: ["ADMINISTRATION", "Admin Panel"],
  };
  $("pageEyebrow").textContent = titles[state.page][0];
  $("pageTitle").textContent = titles[state.page][1];
  document
    .querySelectorAll(".admin-only")
    .forEach((el) =>
      el.classList.toggle("hidden", state.user?.role !== "admin"),
    );
  if (state.user?.role !== "admin" && state.page === "admin")
    state.page = "dashboard";
  $("pageContent").innerHTML = views[state.page]();
  bindPage();
}

const views = {
  dashboard() {
    const d = state.data;
    const now = new Date();
    const dayName = now.toLocaleDateString(undefined, { weekday: "long" });
    const dateLabel = now.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const subjects = [...d.subjects];
    const assignments = [...d.assignments];
    const exams = [...d.exams];
    const timetable = [...d.timetable];
    const attendance = [...d.attendance];

    const completedSubjects = subjects.filter((x) => x.completed).length;
    const completedAssignments = assignments.filter((x) => x.completed).length;
    const subjectProgress = pct(completedSubjects, subjects.length);
    const assignmentProgress = pct(completedAssignments, assignments.length);
    const attendanceAvg = attendance.length
      ? Math.round(
          attendance.reduce(
            (sum, x) => sum + pct(Number(x.attended), Number(x.total)),
            0,
          ) / attendance.length,
        )
      : 0;
    const productivity = Math.round(
      (subjectProgress + assignmentProgress + attendanceAvg) / 3,
    );
    const pendingAssignments = assignments.filter((x) => !x.completed).length;

    const todayClasses = timetable
      .filter((x) => String(x.day).toLowerCase() === dayName.toLowerCase())
      .sort((a, b) =>
        String(a.startTime || "").localeCompare(String(b.startTime || "")),
      );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateValue = (x) => {
      const raw = x?.dueDate || x?.date || x?.deadline;
      if (!raw) return null;
      const dt = new Date(String(raw).includes("T") ? raw : `${raw}T00:00:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };
    const daysLeft = (dt) => Math.ceil((dt - today) / 86400000);
    const deadlineItems = assignments
      .filter((x) => !x.completed && dateValue(x))
      .map((x) => ({ ...x, _kind: "Assignment", _date: dateValue(x) }))
      .filter((x) => daysLeft(x._date) >= 0)
      .sort((a, b) => a._date - b._date)
      .slice(0, 5);
    const examItems = exams
      .filter((x) => dateValue(x))
      .map((x) => ({ ...x, _kind: "Exam", _date: dateValue(x) }))
      .filter((x) => daysLeft(x._date) >= 0)
      .sort((a, b) => a._date - b._date)
      .slice(0, 5);
    const upcoming = [...deadlineItems, ...examItems]
      .sort((a, b) => a._date - b._date)
      .slice(0, 6);

    const lowAttendance = attendance
      .map((x) => ({ ...x, _pct: pct(Number(x.attended), Number(x.total)) }))
      .filter((x) => x.total > 0 && x._pct < 75)
      .sort((a, b) => a._pct - b._pct)
      .slice(0, 4);

    const subjectCards = subjects
      .slice()
      .sort((a, b) => Number(b.completed) - Number(a.completed))
      .slice(0, 6);
    const firstName =
      String(state.user?.name || "Student")
        .trim()
        .split(/\s+/)[0] || "Student";
    const greeting =
      now.getHours() < 12
        ? "Good morning"
        : now.getHours() < 18
          ? "Good afternoon"
          : "Good evening";

    return `
    <section class="dashboard-hero">
      <div>
        <div class="eyebrow">STUDENT COMMAND CENTER</div>
        <h2>${greeting}, ${esc(firstName)} 👋</h2>
        <p>${dateLabel} · Your academic overview for today.</p>
      </div>
      <div class="hero-score"><span>Productivity</span><strong>${productivity}%</strong><small>Based on progress & attendance</small></div>
    </section>

    <div class="stats dashboard-stats">
      <div class="stat-card"><div class="icon">📚</div><strong>${subjects.length}</strong><span>Total subjects</span><small class="stat-sub">${completedSubjects} completed</small></div>
      <div class="stat-card"><div class="icon">📝</div><strong>${pendingAssignments}</strong><span>Pending assignments</span><small class="stat-sub">${assignmentProgress}% completed</small></div>
      <div class="stat-card"><div class="icon">🗓️</div><strong>${examItems.length}</strong><span>Upcoming exams</span><small class="stat-sub">Next 30-day view</small></div>
      <div class="stat-card"><div class="icon">📊</div><strong>${attendanceAvg}%</strong><span>Average attendance</span><small class="stat-sub">${lowAttendance.length ? "⚠️ Attention needed" : "✓ On track"}</small></div>
    </div>

    <div class="dashboard-grid-main">
      <div class="card dashboard-panel">
        <div class="panel-heading"><div><h3>Today's Schedule</h3><p class="muted">${dayName}'s classes</p></div><button class="secondary" data-action="add-timetable">+ Add Class</button></div>
        ${todayClasses.length ? `<div class="schedule-list">${todayClasses.map((x, i) => `<div class="schedule-row"><div class="schedule-time"><b>${esc(x.startTime || "--:--")}</b><span>${esc(x.endTime || "")}</span></div><div class="schedule-dot"></div><div class="schedule-info"><b>${esc(x.subject)}</b><span>${esc(x.faculty || "Faculty not set")} · Room ${esc(x.room || "-")}</span></div></div>`).join("")}</div>` : `<div class="empty compact">No classes scheduled for ${dayName}.<br><button class="link-btn" data-action="add-timetable">Add today's first class →</button></div>`}
      </div>

      <div class="card dashboard-panel">
        <div class="panel-heading"><div><h3>Upcoming Deadlines</h3><p class="muted">Assignments and exams that need attention</p></div></div>
        ${
          upcoming.length
            ? `<div class="deadline-list">${upcoming
                .map((x) => {
                  const left = daysLeft(x._date);
                  const urgent = left <= 2;
                  return `<div class="deadline-row"><div class="deadline-icon ${urgent ? "urgent" : ""}">${x._kind === "Exam" ? "🗓️" : "📝"}</div><div class="deadline-info"><b>${esc(x.title || x.subject)}</b><span>${esc(x._kind)}${x.examType ? " · " + esc(x.examType) : ""} · ${formatDate(String(x._date.toISOString()).slice(0, 10))}</span></div><span class="countdown ${urgent ? "urgent" : ""}">${left === 0 ? "Today" : left === 1 ? "Tomorrow" : left + " days"}</span></div>`;
                })
                .join("")}</div>`
            : empty("No upcoming deadlines or exams.")
        }
      </div>
    </div>

    <div class="dashboard-grid-main">
      <div class="card dashboard-panel">
        <div class="panel-heading"><div><h3>Subject Progress</h3><p class="muted">Your current semester completion</p></div><button class="link-btn" data-page-jump="subjects">View all →</button></div>
        ${subjectCards.length ? `<div class="subject-progress-list">${subjectCards.map((x) => `<div class="subject-progress-row"><div class="subject-progress-head"><span>${esc(x.icon || "📚")} <b>${esc(x.name)}</b></span><b>${x.completed ? 100 : 0}%</b></div><div class="progress"><i style="width:${x.completed ? 100 : 0}%"></i></div><small>${esc(x.code || "No code")} · ${x.completed ? "Completed" : "In progress"}</small></div>`).join("")}</div>` : empty("Add subjects to start tracking progress.")}
      </div>

      <div class="card dashboard-panel">
        <div class="panel-heading"><div><h3>Attendance Alerts</h3><p class="muted">Keep every subject above the safe zone</p></div><button class="link-btn" data-page-jump="attendance">Manage →</button></div>
        ${lowAttendance.length ? `<div class="alert-list">${lowAttendance.map((x) => `<div class="attendance-alert"><div><b>${esc(x.subject)}</b><span>${x.attended}/${x.total} classes attended</span></div><div class="alert-percent">${x._pct}%</div></div>`).join("")}</div><div class="attendance-tip">⚠️ Attendance below 75% may require immediate attention.</div>` : `<div class="success-state"><div>✓</div><b>Attendance looks healthy</b><span>No subject is currently below 75%.</span></div>`}
      </div>
    </div>

    <div class="card quick-actions-panel">
      <div class="panel-heading"><div><h3>Quick Actions</h3><p class="muted">Add academic data without leaving the dashboard</p></div></div>
      <div class="quick-grid dashboard-quick-grid">
        <button class="quick" data-action="add-subject"><span>📚</span><b>Add Subject</b><small>Semester subject</small></button>
        <button class="quick" data-action="add-assignment"><span>📝</span><b>Add Assignment</b><small>Track a deadline</small></button>
        <button class="quick" data-action="add-exam"><span>🗓️</span><b>Add Exam</b><small>Schedule an exam</small></button>
        <button class="quick" data-action="add-attendance"><span>📊</span><b>Update Attendance</b><small>Record classes</small></button>
      </div>
    </div>`;
  },
  subjects() {
    return listPage(
      "Subjects",
      "Manage your semester subjects.",
      "Add Subject",
      "subjects",
      state.data.subjects
        .map(
          (x) => `
      <div class="item">
        <div class="item-main"><div class="item-title">${esc(x.icon)} ${esc(x.name)} ${x.pinned ? "📌" : ""}</div>
        <div class="item-meta">${esc(x.code || "No code")} · ${esc(x.faculty || "No faculty")} · ${x.credits || 0} credits · Deadline ${formatDate(x.deadline)}</div>
        <span class="badge ${x.priority.toLowerCase()}">${esc(x.priority)}</span> ${x.completed ? "<span class='badge low'>Completed</span>" : ""}</div>
        <div class="actions"><button class="small-btn" data-edit="subjects" data-id="${x._id}">Edit</button><button class="small-btn" data-toggle="subjects" data-id="${x._id}">${x.completed ? "Undo" : "Complete"}</button><button class="small-btn" data-pin="subjects" data-id="${x._id}">📌</button><button class="small-btn danger" data-delete="subjects" data-id="${x._id}">Delete</button></div>
      </div>`,
        )
        .join(""),
    );
  },
  assignments() {
    return listPage(
      "Assignments",
      "Track labs, submissions, projects and homework.",
      "Add Assignment",
      "assignments",
      state.data.assignments
        .map(
          (x) => `
      <div class="item"><div class="item-main"><div class="item-title">${esc(x.title)}</div><div class="item-meta">${esc(x.subject || "")} · Due ${formatDate(x.dueDate)} · ${esc(x.description || "")}</div><span class="badge ${x.priority.toLowerCase()}">${x.completed ? "Completed" : "Pending"} · ${esc(x.priority)}</span></div>
      <div class="actions"><button class="small-btn" data-toggle="assignments" data-id="${x._id}">${x.completed ? "Undo" : "Complete"}</button><button class="small-btn" data-edit="assignments" data-id="${x._id}">Edit</button><button class="small-btn danger" data-delete="assignments" data-id="${x._id}">Delete</button></div></div>`,
        )
        .join(""),
    );
  },
  exams() {
    return listPage(
      "Exam Schedule",
      "Keep internal, practical, mid-sem and end-sem exams organized.",
      "Add Exam",
      "exams",
      state.data.exams
        .map(
          (x) =>
            `<div class="item"><div class="item-main"><div class="item-title">${esc(x.subject)}</div><div class="item-meta">${esc(x.examType || "Exam")} · ${formatDate(x.date)} · ${esc(x.time || "")} · Room ${esc(x.room || "-")}</div><div class="item-meta">${esc(x.syllabus || "")}</div></div><div class="actions"><button class="small-btn" data-edit="exams" data-id="${x._id}">Edit</button><button class="small-btn danger" data-delete="exams" data-id="${x._id}">Delete</button></div></div>`,
        )
        .join(""),
    );
  },
  timetable() {
    return listPage(
      "Timetable",
      "Build your weekly class schedule.",
      "Add Class",
      "timetable",
      state.data.timetable
        .map(
          (x) =>
            `<div class="item"><div class="item-main"><div class="item-title">${esc(x.day)} · ${esc(x.subject)}</div><div class="item-meta">${esc(x.startTime)} - ${esc(x.endTime)} · Room ${esc(x.room || "-")} · ${esc(x.faculty || "")}</div></div><div class="actions"><button class="small-btn" data-edit="timetable" data-id="${x._id}">Edit</button><button class="small-btn danger" data-delete="timetable" data-id="${x._id}">Delete</button></div></div>`,
        )
        .join(""),
    );
  },
  notes() {
    return listPage(
      "Notes",
      "Store revision points, formulas, lab notes and reminders.",
      "Add Note",
      "notes",
      state.data.notes
        .map(
          (x) =>
            `<div class="item"><div class="item-main"><div class="item-title">📝 ${esc(x.title)}</div><div class="item-meta">${esc(x.subject || "")} · Updated ${new Date(x.updatedAt).toLocaleDateString()}</div><p style="margin-top:8px;font-size:13px">${esc(x.content || "").slice(0, 180)}</p></div><div class="actions"><button class="small-btn" data-edit="notes" data-id="${x._id}">Edit</button><button class="small-btn danger" data-delete="notes" data-id="${x._id}">Delete</button></div></div>`,
        )
        .join(""),
    );
  },
  attendance() {
    const rows = state.data.attendance
      .map((x) => {
        const p = pct(x.attended, x.total);
        return `<tr><td>${esc(x.subject)}</td><td>${x.attended}</td><td>${x.total}</td><td><b>${p}%</b><div class="progress" style="margin-top:6px"><i style="width:${p}%"></i></div></td><td><button class="small-btn" data-edit="attendance" data-id="${x._id}">Edit</button><button class="small-btn danger" data-delete="attendance" data-id="${x._id}">Delete</button></td></tr>`;
      })
      .join("");
    return `<div class="page-head"><div><h2>Attendance tracker</h2><p class="muted">Monitor attendance and identify low-attendance subjects.</p></div><button class="primary" data-action="add-attendance">+ Add attendance</button></div><div class="card table-wrap"><table class="data-table"><thead><tr><th>Subject</th><th>Attended</th><th>Total</th><th>Percentage</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${empty("No attendance records yet.")}</td></tr>`}</tbody></table></div>`;
  },

  "attendance-intelligence"() {
    const rows = state.data.attendance || [];
    const avg = rows.length
      ? Math.round(
          rows.reduce(
            (a, x) => a + pct(Number(x.attended), Number(x.total)),
            0,
          ) / rows.length,
        )
      : 0;
    const critical = rows.filter(
      (x) =>
        Number(x.total) > 0 && pct(Number(x.attended), Number(x.total)) < 75,
    ).length;
    const healthy = rows.filter(
      (x) =>
        Number(x.total) > 0 && pct(Number(x.attended), Number(x.total)) >= 80,
    ).length;

    return `<div class="page-head"><div>
    <div class="eyebrow">PHASE 6 · ATTENDANCE INTELLIGENCE</div>
    <h2>Know your attendance risk 🎯</h2>
    <p class="muted">Calculate recovery classes, safe absences and identify subjects that need attention.</p>
  </div><button class="primary" data-action="add-attendance">+ Add attendance</button></div>

  <div class="attendance-kpis">
    <div class="stat-card"><div class="icon">📊</div><strong>${avg}%</strong><span>Average attendance</span></div>
    <div class="stat-card"><div class="icon">🔴</div><strong>${critical}</strong><span>Critical subjects</span></div>
    <div class="stat-card"><div class="icon">🟢</div><strong>${healthy}</strong><span>Healthy subjects</span></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="panel-heading"><div><h3>Subject intelligence</h3><p class="muted">Your current attendance status.</p></div></div>
      ${
        rows.length
          ? `<div class="attendance-bars">${rows
              .map((x) => {
                const a = Number(x.attended),
                  t = Number(x.total),
                  q = pct(a, t);
                const risk =
                  q < 75 ? "Critical" : q < 80 ? "Warning" : "Healthy";
                return `<div class="att-row"><div class="att-head"><span><b>${esc(x.subject)}</b><small>${a}/${t} classes</small></span><strong class="risk-${risk.toLowerCase()}">${q}% · ${risk}</strong></div>
        <div class="progress"><i class="att-${q < 75 ? "danger" : q < 80 ? "warn" : "good"}" style="width:${Math.min(100, q)}%"></i></div></div>`;
              })
              .join("")}</div>`
          : empty("No attendance records yet.")
      }
    </div>

    <div class="card">
      <h3>Attendance calculator</h3>
      <p class="muted">Choose a subject and target. The calculator tells you how many consecutive classes you need to attend.</p>
      <label>Subject<select id="attCalcSubject"><option value="">Select subject</option>
        ${rows.map((x) => `<option value="${x._id}">${esc(x.subject)}</option>`).join("")}
      </select></label>
      <label>Target attendance (%)<input id="attCalcTarget" type="number" min="50" max="99" value="80"></label>
      <div id="attCalcResult" class="calc-result">Select a subject to calculate.</div>
    </div>
  </div>

  <div class="card">
    <div class="panel-heading"><div><h3>What should I do?</h3><p class="muted">Simple actions based on your current percentage.</p></div></div>
    <div class="rule-grid">
      <div><b>🔴 Below 75%</b><span>Attend every upcoming class until recovered.</span></div>
      <div><b>🟡 75%–79%</b><span>Be careful with absences; target 80%+.</span></div>
      <div><b>🟢 80%+</b><span>You are in the healthy zone.</span></div>
    </div>
  </div>`;
  },

  admin() {
    if (state.user?.role !== "admin")
      return `<div class="card">${empty("Admin access required.")}</div>`;
    const s = state.admin.stats || {};
    const tabs = ["students", "subjects", "assignments", "attendance", "exams"];
    let content = "";
    if (state.admin.tab === "students") {
      content = `<div class="table-wrap"><table class="data-table admin-table"><thead><tr><th>Student</th><th>Email</th><th>College</th><th>Branch</th><th>Semester</th><th>Joined</th><th>Action</th></tr></thead><tbody>
      ${state.admin.users.map((u) => `<tr><td><b>${esc(u.name)}</b><br><small>${esc(u.rollNo || "-")}</small></td><td>${esc(u.email)}</td><td>${esc(u.college || "-")}</td><td>${esc(u.branch || "-")}</td><td>${esc(u.semester || "-")}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td><td><button class="small-btn danger" data-admin-delete-user="${u._id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="7">${empty("No registered students.")}</td></tr>`}
    </tbody></table></div>`;
    } else if (state.admin.tab === "subjects") {
      content = adminRecordTable(
        state.admin.records.subjects,
        ["Subject", "Student", "Code", "Faculty", "Deadline", "Status"],
        (x) =>
          `<td><b>${esc(x.name)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${esc(x.code || "-")}</td><td>${esc(x.faculty || "-")}</td><td>${formatDate(x.deadline)}</td><td>${x.completed ? "Completed" : "Pending"}</td>`,
      );
    } else if (state.admin.tab === "assignments") {
      content = adminRecordTable(
        state.admin.records.assignments,
        ["Assignment", "Student", "Subject", "Due", "Priority", "Status"],
        (x) =>
          `<td><b>${esc(x.title)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${esc(x.subject || "-")}</td><td>${formatDate(x.dueDate)}</td><td>${esc(x.priority)}</td><td>${x.completed ? "Completed" : "Pending"}</td>`,
      );
    } else if (state.admin.tab === "attendance") {
      content = adminRecordTable(
        state.admin.records.attendance,
        ["Subject", "Student", "Attended", "Total", "Percentage"],
        (x) =>
          `<td><b>${esc(x.subject)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${x.attended}</td><td>${x.total}</td><td><b>${pct(x.attended, x.total)}%</b></td>`,
      );
    } else {
      content = adminRecordTable(
        state.admin.records.exams,
        ["Subject", "Student", "Type", "Date", "Time", "Room"],
        (x) =>
          `<td><b>${esc(x.subject)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${esc(x.examType || "-")}</td><td>${formatDate(x.date)}</td><td>${esc(x.time || "-")}</td><td>${esc(x.room || "-")}</td>`,
      );
    }
    return `<div class="admin-kpi">
    <div class="stat-card"><div class="icon">👨‍🎓</div><strong>${s.students || 0}</strong><span>Registered students</span></div>
    <div class="stat-card"><div class="icon">📚</div><strong>${s.subjects || 0}</strong><span>Total subjects</span></div>
    <div class="stat-card"><div class="icon">📝</div><strong>${s.assignments || 0}</strong><span>Assignments</span></div>
    <div class="stat-card"><div class="icon">🗓</div><strong>${s.exams || 0}</strong><span>Exams</span></div>
  </div>
  <div class="grid-2">
    <div class="card"><h3>Database statistics</h3><div class="table-wrap"><table class="data-table"><tbody>
      <tr><td>Students</td><td><b>${s.students || 0}</b></td></tr>
      <tr><td>Subjects</td><td><b>${s.subjects || 0}</b></td></tr>
      <tr><td>Completed subjects</td><td><b>${s.completedSubjects || 0}</b></td></tr>
      <tr><td>Assignments</td><td><b>${s.assignments || 0}</b></td></tr>
      <tr><td>Completed assignments</td><td><b>${s.completedAssignments || 0}</b></td></tr>
      <tr><td>Exam records</td><td><b>${s.exams || 0}</b></td></tr>
      <tr><td>Attendance records</td><td><b>${s.attendanceRecords || 0}</b></td></tr>
      <tr><td>Notes</td><td><b>${s.notes || 0}</b></td></tr>
      <tr><td>Timetable entries</td><td><b>${s.timetable || 0}</b></td></tr>
      <tr><td>Overall attendance</td><td><b>${s.attendancePercent || 0}%</b></td></tr>
    </tbody></table></div></div>
    <div class="card"><h3>Admin controls</h3><p class="muted">You have full read access to student academic records. Deleting a student permanently deletes that student's subjects, assignments, exams, timetable, notes and attendance records.</p><div class="progress" style="margin-top:20px"><i style="width:${s.attendancePercent || 0}%"></i></div><p class="item-meta" style="margin-top:8px">Overall attendance across all recorded classes: ${s.attendancePercent || 0}%</p></div>
  </div>
  <div class="card" style="margin-top:18px"><div class="admin-tabs">${tabs.map((t) => `<button class="${state.admin.tab === t ? "active" : ""}" data-admin-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>${content}</div>`;
  },
  planner() {
    const saved = loadSavedPlan();
    const exams = state.data.exams
      .filter((x) => plannerDate(x.date))
      .sort((a, b) => plannerDate(a.date) - plannerDate(b.date));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = exams.filter((x) => plannerDate(x.date) >= today);
    const examOptions = upcoming
      .map(
        (x) =>
          `<option value="${esc(x._id)}" ${saved?.examId === x._id ? "selected" : ""}>${esc(x.subject)} — ${formatDate(x.date)}${x.examType ? ` (${esc(x.examType)})` : ""}</option>`,
      )
      .join("");
    const defaultHours = saved?.hours || 3,
      defaultSession = saved?.session || 50,
      defaultDays = saved?.days || 7,
      defaultWeak = saved?.weak || "";
    const examCountdown = saved?.examDate
      ? Math.max(0, plannerDaysBetween(today, plannerDate(saved.examDate)))
      : null;
    const planHtml = saved
      ? saved.plan
          .map(
            (day, di) => `
    <div class="plan-day">
      <div class="plan-day-head"><div><span class="plan-day-number">Day ${di + 1}</span><h3>${esc(day.label)}</h3></div><span class="plan-minutes">${plannerFormatMinutes(day.sessions.reduce((a, s) => a + s.minutes, 0))}</span></div>
      <div class="plan-sessions">
        ${day.sessions
          .map(
            (s, si) => `<label class="study-session ${s.done ? "done" : ""}">
          <input type="checkbox" data-plan-done="${di}:${si}" ${s.done ? "checked" : ""}>
          <span class="session-check">✓</span>
          <span class="session-info"><b>${esc(s.subject)}</b><small>${esc(s.type)} · ${plannerFormatMinutes(s.minutes)}</small></span>
        </label>`,
          )
          .join("")}
      </div>
    </div>`,
          )
          .join("")
      : empty("Generate your first personalized study plan.");

    return `<div class="planner-hero">
    <div><span class="eyebrow">SMART STUDY ENGINE</span><h2>Build a study plan around your exams 🎯</h2>
    <p>Use your available hours, weak subjects and exam dates to create a realistic day-by-day revision schedule.</p></div>
    <div class="planner-hero-icon">🤖</div>
  </div>
  <div class="grid-2 planner-grid">
    <div class="card planner-config">
      <div class="section-heading"><div><h3>Plan settings</h3><p class="muted">The planner uses your existing subjects, assignments and exams.</p></div></div>
      <form id="plannerForm">
        <label>Target exam <select id="plannerExam"><option value="">No specific exam — plan by number of days</option>${examOptions}</select></label>
        <div class="form-grid-2">
          <label>Study hours / day<input id="plannerHours" type="number" min="1" max="12" step="0.5" value="${defaultHours}"></label>
          <label>Session length (minutes)<input id="plannerSession" type="number" min="25" max="120" step="5" value="${defaultSession}"></label>
        </div>
        <label>Planning days (if no exam)<input id="plannerDays" type="number" min="1" max="60" value="${defaultDays}"></label>
        <label>Weak / priority subjects <input id="plannerWeak" placeholder="e.g. DBMS, DSA, Operating Systems" value="${esc(defaultWeak)}"></label>
        <button class="primary-btn" type="submit">✨ Generate Smart Study Plan</button>
      </form>
      <div class="planner-tips"><b>How it prioritizes</b><span>🔴 Weak subjects get extra weight</span><span>📝 Near deadlines get priority</span><span>🗓️ Upcoming exams get priority</span><span>🔁 Final days focus on revision</span></div>
    </div>
    <div class="card">
      <div class="section-heading"><div><h3>Plan overview</h3><p class="muted">${saved ? `Created ${new Date(saved.createdAt).toLocaleString()}` : "Your plan summary will appear here."}</p></div>
      ${saved ? `<button class="small-btn danger" id="clearPlan">Clear plan</button>` : ""}</div>
      ${
        saved
          ? `<div class="planner-stats">
        <div><b>${saved.days}</b><span>Days</span></div><div><b>${saved.hours}h</b><span>Daily target</span></div><div><b>${plannerFormatMinutes(saved.totalMinutes)}</b><span>Total study</span></div><div><b>${examCountdown === null ? "—" : examCountdown}</b><span>${examCountdown === null ? "Exam countdown" : "Days to exam"}</span></div>
      </div>
      <div class="progress"><i style="width:${Math.min(100, Math.round((saved.plan.flatMap((x) => x.sessions).filter((s) => s.done).length / Math.max(1, saved.plan.flatMap((x) => x.sessions).length)) * 100))}%"></i></div>
      <p class="item-meta planner-completion">${saved.plan.flatMap((x) => x.sessions).filter((s) => s.done).length} / ${saved.plan.flatMap((x) => x.sessions).length} study sessions completed</p>
      ${saved.examSubject ? `<div class="planner-exam">🗓️ <b>${esc(saved.examSubject)}</b> exam on <b>${formatDate(saved.examDate)}</b></div>` : ""}`
          : empty(
              "Generate a plan to see your schedule, countdown and completion progress.",
            )
      }
    </div>
  </div>
  <div class="card planner-output"><div class="section-heading"><div><h3>📅 Your daily study plan</h3><p class="muted">Tick a session when you finish it. Progress is saved in this browser.</p></div></div>${planHtml}</div>`;
  },

  "exam-prep"() {
    const exams = state.data.exams
      .filter((e) => daysUntil(e.date) !== null)
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    const selected = state._selectedExamPrep || exams[0]?._id || "";
    const exam = exams.find((e) => e._id === selected) || exams[0];
    if (!exam)
      return `<div class="card">${empty("Add an exam first to start exam preparation.")}</div>`;
    const prep = calculateExamPrep(exam),
      score = prepScore(prep),
      left = daysUntil(exam.date);
    const topics = prep.topics || [];
    return `<div class="page-head"><div><span class="eyebrow">PHASE 7 · EXAM PREPARATION</span><h2>${esc(exam.subject)} preparation</h2><p class="muted">${esc(exam.examType || "Exam")} · ${formatDate(exam.date)} · ${left < 0 ? "Past exam" : left === 0 ? "Exam today" : `${left} days left`}</p></div>
    <select id="prepExamSelect">${exams.map((e) => `<option value="${e._id}" ${e._id === exam._id ? "selected" : ""}>${esc(e.subject)} — ${formatDate(e.date)}</option>`).join("")}</select></div>
  <div class="prep-kpis"><div class="stat-card"><div class="icon">📈</div><strong>${score}%</strong><span>Preparation</span></div><div class="stat-card"><div class="icon">📚</div><strong>${topics.filter((x) => x.done).length}/${topics.length}</strong><span>Topics completed</span></div><div class="stat-card"><div class="icon">❓</div><strong>${prep.questions || 0}</strong><span>Practice questions</span></div><div class="stat-card"><div class="icon">⏳</div><strong>${left < 0 ? "—" : left}</strong><span>Days remaining</span></div></div>
  <div class="grid-2"><div class="card"><h3>Syllabus & revision checklist</h3><p class="muted">Topics are created from the exam syllabus. Add or edit the list below.</p>
    <div class="topic-list">${topics.map((t, i) => `<label class="topic-item ${t.done ? "done" : ""}"><input type="checkbox" data-prep-topic="${i}" ${t.done ? "checked" : ""}><span>${esc(t.name)}</span>${t.important ? `<b>Important</b>` : ""}</label>`).join("") || empty("No syllabus topics. Add topics below.")}</div>
    <div class="two-col" style="margin-top:14px"><input id="newTopic" placeholder="Add topic"><button class="secondary" id="addTopic">+ Add topic</button></div>
    <div class="progress" style="margin-top:16px"><i style="width:${score}%"></i></div>
  </div><div class="card"><h3>Practice tracker</h3><label>Practice questions solved<input id="prepQuestions" type="number" min="0" value="${prep.questions || 0}"></label>
    <label>Important notes<textarea id="prepNotes" placeholder="Key formulas, topics to revise, mistakes...">${esc(prep.notes || "")}</textarea></label>
    <button class="primary" id="savePrep">Save preparation</button>
    <button class="secondary" id="sendPrepToPlanner" style="margin-top:10px">🤖 Build study plan for this exam</button>
  </div></div>`;
  },

  analytics() {
    const d = state.data;
    const att = d.attendance.map((x) => ({
      subject: x.subject,
      p: pct(safeNum(x.attended), safeNum(x.total)),
    }));
    const subjectRows = d.subjects
      .map(
        (s) =>
          `<div class="analytics-row"><span>${esc(s.name)}</span><div class="progress"><i style="width:${s.completed ? 100 : 0}%"></i></div><b>${s.completed ? 100 : 0}%</b></div>`,
      )
      .join("");
    const completedA = d.assignments.filter((x) => x.completed).length;
    const completedS = d.subjects.filter((x) => x.completed).length;
    const avg = att.length
      ? Math.round(att.reduce((a, x) => a + x.p, 0) / att.length)
      : 0;
    const doneSessions =
      loadSavedPlan()
        ?.plan.flatMap((x) => x.sessions)
        .filter((x) => x.done).length || 0;
    const studyMin = studyMinutesFromPlan();
    return `<div class="page-head"><div><span class="eyebrow">PHASE 8 · STUDY ANALYTICS</span><h2>Your academic performance</h2><p class="muted">A lightweight analytics view based on your planner data.</p></div></div>
  <div class="analytics-kpis"><div class="stat-card"><div class="icon">📚</div><strong>${completedS}/${d.subjects.length}</strong><span>Subjects completed</span></div><div class="stat-card"><div class="icon">✓</div><strong>${completedA}/${d.assignments.length}</strong><span>Assignments completed</span></div><div class="stat-card"><div class="icon">📊</div><strong>${avg}%</strong><span>Average attendance</span></div><div class="stat-card"><div class="icon">⏱</div><strong>${plannerFormatMinutes(studyMin)}</strong><span>Completed study time</span></div></div>
  <div class="grid-2"><div class="card"><h3>Subject progress</h3>${subjectRows || empty("Add subjects to see progress.")}</div>
  <div class="card"><h3>Attendance performance</h3>${att.map((x) => `<div class="analytics-row"><span>${esc(x.subject)}</span><div class="progress"><i style="width:${x.p}%"></i></div><b>${x.p}%</b></div>`).join("") || empty("Add attendance records.")}</div></div>
  <div class="card"><h3>Productivity snapshot</h3><div class="analytics-big">${doneSessions}<span>study sessions completed in your Smart Planner</span></div><p class="muted">Use the Goals & Streak page to set weekly study targets.</p></div>`;
  },

  notifications() {
    const list = ensureNotifications();
    const unread = list.filter((x) => !x.read).length;
    return `<div class="page-head"><div><span class="eyebrow">PHASE 9 · ALERT CENTER</span><h2>Notifications 🔔</h2><p class="muted">${unread} unread notification${unread === 1 ? "" : "s"}.</p></div><button class="secondary" id="markAllRead">Mark all read</button></div>
  <div class="notification-list">${list.map((n, i) => `<div class="notification ${n.read ? "read" : ""}"><div class="notification-icon">${n.kind === "exam" ? "🗓" : n.kind === "attendance" ? "⚠️" : "📝"}</div><div><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${new Date(n.createdAt).toLocaleString()}</small></div><button class="small-btn" data-notification-read="${i}">${n.read ? "Read" : "Mark read"}</button></div>`).join("") || empty("No notifications.")}</div>`;
  },

  goals() {
    const g = goalsData(),
      today = new Date().toISOString().slice(0, 10);
    const daily = Math.min(
      100,
      Math.round(
        (safeNum(g.completedMinutes) / Math.max(1, safeNum(g.dailyMinutes))) *
          100,
      ),
    );
    const weekly = Math.min(
      100,
      Math.round(
        (safeNum(g.completedMinutes) / Math.max(1, safeNum(g.weeklyMinutes))) *
          100,
      ),
    );
    return `<div class="page-head"><div><span class="eyebrow">PHASE 9 · PRODUCTIVITY</span><h2>Goals & Study Streak 🔥</h2><p class="muted">Set targets and build consistency.</p></div></div>
  <div class="goals-kpis"><div class="stat-card"><div class="icon">🔥</div><strong>${g.streak || 0}</strong><span>Day streak</span></div><div class="stat-card"><div class="icon">⏱</div><strong>${g.completedMinutes || 0}m</strong><span>Tracked study time</span></div><div class="stat-card"><div class="icon">🎯</div><strong>${daily}%</strong><span>Daily target</span></div><div class="stat-card"><div class="icon">📅</div><strong>${weekly}%</strong><span>Weekly target</span></div></div>
  <div class="grid-2"><div class="card"><h3>Study goals</h3><label>Daily target (minutes)<input id="goalDaily" type="number" min="15" value="${g.dailyMinutes}"></label><label>Weekly target (minutes)<input id="goalWeekly" type="number" min="60" value="${g.weeklyMinutes}"></label><button class="primary" id="saveGoals">Save goals</button></div>
  <div class="card"><h3>Log a study session</h3><label>Minutes studied<input id="goalMinutes" type="number" min="1" value="50"></label><button class="primary" id="logStudy">+ Log study session</button><p class="muted" style="margin-top:12px">Last study date: ${g.lastStudyDate || "Not logged"}</p></div></div>`;
  },

  profile() {
    const u = state.user;
    return `<div class="grid-2"><div class="card"><h3>Student profile</h3><form id="profileForm"><label>Name<input id="pName" value="${esc(u.name)}"></label><label>Email<input value="${esc(u.email)}" disabled></label><label>College<input id="pCollege" value="${esc(u.college)}"></label><label>Branch<input id="pBranch" value="${esc(u.branch)}"></label><div class="two-col"><label>Semester<input id="pSemester" value="${esc(u.semester)}"></label><label>Roll No.<input id="pRoll" value="${esc(u.rollNo)}"></label></div><button class="primary" type="submit">Save profile</button></form></div>
  <div class="card"><h3>Security & reports</h3><form id="passwordForm"><label>Current password<input id="currentPassword" type="password" required></label><label>New password<input id="newPassword" type="password" minlength="8" required></label><button class="secondary" type="submit">Change password</button></form><hr style="margin:20px 0;border:0;border-top:1px solid var(--line)"><p class="muted">Download your complete academic report or portable JSON backup.</p><button class="secondary" id="profilePdf" style="margin-top:12px">⇩ Download PDF Report</button><button class="secondary" id="profileBackup" style="margin:10px 0">⇩ Download JSON Backup</button></div></div>`;
  },
};

function listPage(title, desc, actionText, type, body) {
  return `<div class="page-head"><div><h2>${title}</h2><p class="muted">${desc}</p></div><button class="primary" data-action="${actionText.includes("Subject") ? "add-subject" : actionText.includes("Assignment") ? "add-assignment" : actionText.includes("Exam") ? "add-exam" : actionText.includes("Class") ? "add-timetable" : "add-note"}">+ ${actionText}</button></div><div class="list">${body || empty(`No ${title.toLowerCase()} yet.`)}</div>`;
}

function adminRecordTable(rows, headers, cells) {
  return `<div class="table-wrap"><table class="data-table admin-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((x) => `<tr>${cells(x)}</tr>`).join("") || `<tr><td colspan="${headers.length}">${empty("No records found.")}</td></tr>`}</tbody></table></div>`;
}

function bindPageOriginal() {
  document.querySelectorAll("[data-admin-tab]").forEach(
    (b) =>
      (b.onclick = async () => {
        state.admin.tab = b.dataset.adminTab;
        render();
      }),
  );
  document.querySelectorAll("[data-admin-delete-user]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm("Delete this student and ALL of their academic data?"))
          return;
        try {
          await api(`/api/admin/users/${b.dataset.adminDeleteUser}`, {
            method: "DELETE",
          });
          await loadAdmin();
          render();
          toast("Student and related data deleted.");
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => openForm(b.dataset.action)));
  document.querySelectorAll("[data-page-jump]").forEach(
    (b) =>
      (b.onclick = () => {
        state.page = b.dataset.pageJump;
        render();
      }),
  );
  document
    .querySelectorAll("[data-delete]")
    .forEach(
      (b) => (b.onclick = () => removeItem(b.dataset.delete, b.dataset.id)),
    );
  document
    .querySelectorAll("[data-toggle]")
    .forEach(
      (b) => (b.onclick = () => toggleItem(b.dataset.toggle, b.dataset.id)),
    );
  document
    .querySelectorAll("[data-pin]")
    .forEach((b) => (b.onclick = () => pinSubject(b.dataset.id)));
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () => openForm("edit-" + b.dataset.edit, b.dataset.id)),
    );
  const plannerForm = $("plannerForm");
  if (plannerForm)
    plannerForm.onsubmit = (e) => {
      e.preventDefault();
      const plan = generateSmartPlan({
        examId: $("plannerExam").value,
        hours: $("plannerHours").value,
        session: $("plannerSession").value,
        days: $("plannerDays").value,
        weak: $("plannerWeak").value,
      });
      savePlan(plan);
      toast("Smart study plan generated!");
      render();
    };
  document.querySelectorAll("[data-plan-done]").forEach(
    (cb) =>
      (cb.onchange = () => {
        const saved = loadSavedPlan();
        if (!saved) return;
        const [di, si] = cb.dataset.planDone.split(":").map(Number);
        if (saved.plan[di]?.sessions[si])
          saved.plan[di].sessions[si].done = cb.checked;
        savePlan(saved);
        render();
      }),
  );
  const clearPlan = $("clearPlan");
  if (clearPlan)
    clearPlan.onclick = () => {
      if (confirm("Clear your current study plan?")) {
        localStorage.removeItem(plannerStorageKey());
        render();
      }
    };

  const attCalcSubject = $("attCalcSubject");
  const attCalcTarget = $("attCalcTarget");
  const attCalcResult = $("attCalcResult");

  function updateAttendanceCalc() {
    if (!attCalcSubject || !attCalcResult) return;
    const row = state.data.attendance.find(
      (x) => x._id === attCalcSubject.value,
    );
    const target = Math.min(
      99,
      Math.max(50, Number(attCalcTarget?.value || 80)),
    );
    if (!row) {
      attCalcResult.textContent = "Select a subject to calculate.";
      return;
    }

    const attended = Number(row.attended || 0);
    const total = Number(row.total || 0);
    const current = pct(attended, total);

    if (total === 0) {
      attCalcResult.innerHTML =
        "<b>No classes recorded yet.</b><span>Add attendance data first.</span>";
      return;
    }

    if (current >= target) {
      const maxAbsences = Math.floor(attended / (target / 100) - total);
      attCalcResult.innerHTML = `<b>✅ Target reached</b><span>${esc(row.subject)} is at ${current}%. You can miss approximately <strong>${Math.max(0, maxAbsences)}</strong> more class${maxAbsences === 1 ? "" : "es"} and remain at ${target}% or above.</span>`;
      return;
    }

    const needed = Math.ceil(
      ((target * total) / 100 - attended) / (1 - target / 100),
    );
    const future = attended + needed;
    const futureTotal = total + needed;
    const futurePct = pct(future, futureTotal);

    attCalcResult.innerHTML = `<b>⚠️ Attend the next ${needed} class${needed === 1 ? "" : "es"} consecutively</b>
       <span>Current: ${current}% (${attended}/${total})</span>
       <span>After ${needed} attended class${needed === 1 ? "" : "es"}: <strong>${futurePct}%</strong> (${future}/${futureTotal})</span>`;
  }

  if (attCalcSubject) {
    attCalcSubject.onchange = updateAttendanceCalc;
    if (attCalcTarget) attCalcTarget.oninput = updateAttendanceCalc;
  }

  const pf = $("profileForm");
  if (pf)
    pf.onsubmit = async (e) => {
      e.preventDefault();
      try {
        state.user = await api("/api/me", {
          method: "PUT",
          body: JSON.stringify({
            name: $("pName").value,
            college: $("pCollege").value,
            branch: $("pBranch").value,
            semester: $("pSemester").value,
            rollNo: $("pRoll").value,
          }),
        });
        $("avatar").textContent = state.user.name[0].toUpperCase();
        toast("Profile updated");
        render();
      } catch (err) {
        toast(err.message);
      }
    };
  if ($("profilePdf")) $("profilePdf").onclick = () => $("pdfBtn").click();
  if ($("profileBackup"))
    $("profileBackup").onclick = () => $("backupBtn").click();
}

function bindPhase713() {
  const prepSel = $("prepExamSelect");
  if (prepSel)
    prepSel.onchange = () => {
      state._selectedExamPrep = prepSel.value;
      render();
    };
  document.querySelectorAll("[data-prep-topic]").forEach(
    (cb) =>
      (cb.onchange = () => {
        const examId = $("prepExamSelect")?.value;
        if (!examId) return;
        const exam = state.data.exams.find((e) => e._id === examId);
        const p = calculateExamPrep(exam);
        p.topics[Number(cb.dataset.prepTopic)].done = cb.checked;
        savePrep(examId, p);
        render();
      }),
  );
  const addTopic = $("addTopic");
  if (addTopic)
    addTopic.onclick = () => {
      const examId = $("prepExamSelect").value,
        exam = state.data.exams.find((e) => e._id === examId),
        p = calculateExamPrep(exam),
        val = $("newTopic").value.trim();
      if (!val) return toast("Enter a topic.");
      p.topics.push({
        id: `t${Date.now()}`,
        name: val,
        done: false,
        important: false,
      });
      savePrep(examId, p);
      render();
    };
  const savePrepBtn = $("savePrep");
  if (savePrepBtn)
    savePrepBtn.onclick = () => {
      const examId = $("prepExamSelect").value,
        exam = state.data.exams.find((e) => e._id === examId),
        p = calculateExamPrep(exam);
      p.questions = safeNum($("prepQuestions").value);
      p.notes = $("prepNotes").value;
      savePrep(examId, p);
      toast("Exam preparation saved.");
      render();
    };
  const sendPlanner = $("sendPrepToPlanner");
  if (sendPlanner)
    sendPlanner.onclick = () => {
      state.page = "planner";
      render();
      setTimeout(() => {
        const x = $("plannerExam");
        if (x) {
          x.value = $("prepExamSelect").value;
        }
      }, 0);
    };
  const markAll = $("markAllRead");
  if (markAll)
    markAll.onclick = () => {
      const n = ensureNotifications().map((x) => ({ ...x, read: true }));
      setLocal("notifications", n);
      render();
    };
  document.querySelectorAll("[data-notification-read]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = ensureNotifications();
        n[Number(b.dataset.notificationRead)].read = true;
        setLocal("notifications", n);
        render();
      }),
  );
  const saveGoalsBtn = $("saveGoals");
  if (saveGoalsBtn)
    saveGoalsBtn.onclick = () => {
      const g = goalsData();
      g.dailyMinutes = safeNum($("goalDaily").value, 120);
      g.weeklyMinutes = safeNum($("goalWeekly").value, 600);
      saveGoals(g);
      toast("Goals saved.");
      render();
    };
  const logStudy = $("logStudy");
  if (logStudy)
    logStudy.onclick = () => {
      const g = goalsData(),
        mins = safeNum($("goalMinutes").value, 0),
        today = new Date().toISOString().slice(0, 10);
      if (mins <= 0) return toast("Enter study minutes.");
      if (g.lastStudyDate) {
        const last = new Date(g.lastStudyDate + "T00:00:00"),
          now = new Date(today + "T00:00:00"),
          diff = Math.round((now - last) / 86400000);
        if (diff === 1) g.streak = (g.streak || 0) + 1;
        else if (diff > 1) g.streak = 1;
      } else g.streak = 1;
      g.lastStudyDate = today;
      g.completedMinutes = (g.completedMinutes || 0) + mins;
      g.history = (g.history || [])
        .concat({ date: today, minutes: mins })
        .slice(-90);
      saveGoals(g);
      toast(`Logged ${mins} minutes.`);
      render();
    };
  const adminSearch = $("adminSearch");
  if (adminSearch)
    adminSearch.oninput = () => {
      state.admin.search = adminSearch.value;
      render();
      setTimeout(() => {
        const el = $("adminSearch");
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 0);
    };
  const pfw = $("passwordForm");
  if (pfw)
    pfw.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/api/auth/change-password", {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: $("currentPassword").value,
            newPassword: $("newPassword").value,
          }),
        });
        toast("Password changed. Please log in again.");
        setTimeout(() => logout(false), 800);
      } catch (err) {
        toast(err.message);
      }
    };
}

function bindPage() {
  ensureNotifications();
  bindPageOriginal();
  bindPhase713();
}

function openForm(kind, id) {
  let type = kind.startsWith("edit-")
    ? kind.slice(5)
    : kind.replace("add-", "");
  // Buttons use singular action names (add-subject, add-assignment, add-exam, add-class),
  // while the API/state collections use plural names. Normalize them before reading state.
  const typeMap = {
    subject: "subjects",
    assignment: "assignments",
    exam: "exams",
    class: "timetable",
    timetable: "timetable",
    note: "notes",
    attendance: "attendance",
  };
  type = typeMap[type] || type;
  if (!state.data[type]) {
    toast("Unable to open this form. Invalid data type: " + type);
    return;
  }
  const existing = id ? state.data[type].find((x) => x._id === id) : null;
  state.edit = { type, id };
  let title = "",
    html = "";
  const v = (k) => esc(existing?.[k] || "");
  if (type === "subjects") {
    title = existing ? "Edit Subject" : "Add Subject";
    html = `<form id="modalForm"><h2>${title}</h2><div class="form-grid"><label>Subject Name<input name="name" required value="${v("name")}"></label><label>Subject Code<input name="code" value="${v("code")}"></label><label>Faculty<input name="faculty" value="${v("faculty")}"></label><label>Semester<input name="semester" value="${v("semester")}"></label><label>Credits<input name="credits" type="number" value="${existing?.credits || 3}"></label><label>Deadline<input name="deadline" type="date" value="${v("deadline")}"></label><label>Priority<select name="priority"><option ${existing?.priority === "High" ? "selected" : ""}>High</option><option ${existing?.priority === "Medium" || !existing ? "selected" : ""}>Medium</option><option ${existing?.priority === "Low" ? "selected" : ""}>Low</option></select></label><label>Icon<input name="icon" value="${v("icon") || "📚"}"></label><label class="wide">Notes<textarea name="notes">${v("notes")}</textarea></label></div><button class="primary full" type="submit">Save Subject</button></form>`;
  } else if (type === "assignments") {
    title = existing ? "Edit Assignment" : "Add Assignment";
    html = `<form id="modalForm"><h2>${title}</h2><label>Title<input name="title" required value="${v("title")}"></label><div class="form-grid"><label>Subject<input name="subject" value="${v("subject")}"></label><label>Due Date<input name="dueDate" type="date" value="${v("dueDate")}"></label><label>Priority<select name="priority"><option>High</option><option ${existing?.priority === "Medium" || !existing ? "selected" : ""}>Medium</option><option>Low</option></select></label></div><label>Description<textarea name="description">${v("description")}</textarea><button class="primary full" type="submit">Save Assignment</button></form>`;
  } else if (type === "exams") {
    title = existing ? "Edit Exam" : "Add Exam";
    html = `<form id="modalForm"><h2>${title}</h2><div class="form-grid"><label>Subject<input name="subject" required value="${v("subject")}"></label><label>Exam Type<input name="examType" value="${v("examType")}" placeholder="Mid Sem / End Sem"></label><label>Date<input name="date" type="date" value="${v("date")}"></label><label>Time<input name="time" type="time" value="${v("time")}"></label><label>Room<input name="room" value="${v("room")}"></label><label class="wide">Syllabus<textarea name="syllabus">${v("syllabus")}</textarea></label></div><button class="primary full" type="submit">Save Exam</button></form>`;
  } else if (type === "timetable") {
    title = existing ? "Edit Class" : "Add Class";
    html = `<form id="modalForm"><h2>${title}</h2><div class="form-grid"><label>Day<select name="day">${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((x) => `<option ${existing?.day === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Subject<input name="subject" required value="${v("subject")}"></label><label>Start<input name="startTime" type="time" value="${v("startTime")}"></label><label>End<input name="endTime" type="time" value="${v("endTime")}"></label><label>Room<input name="room" value="${v("room")}"></label><label>Faculty<input name="faculty" value="${v("faculty")}"></label></div><button class="primary full" type="submit">Save Class</button></form>`;
  } else if (type === "notes") {
    title = existing ? "Edit Note" : "Add Note";
    html = `<form id="modalForm"><h2>${title}</h2><label>Title<input name="title" required value="${v("title")}"></label><label>Subject<input name="subject" value="${v("subject")}"></label><label>Content<textarea name="content" required>${v("content")}</textarea></label><button class="primary full" type="submit">Save Note</button></form>`;
  } else if (type === "attendance") {
    title = existing ? "Edit Attendance" : "Add Attendance";
    html = `<form id="modalForm"><h2>${title}</h2><label>Subject<input name="subject" required value="${v("subject")}"></label><div class="two-col"><label>Classes Attended<input name="attended" type="number" min="0" value="${existing?.attended || 0}"></label><label>Total Classes<input name="total" type="number" min="0" value="${existing?.total || 0}"></label></div><button class="primary full" type="submit">Save Attendance</button></form>`;
  }
  $("modalContent").innerHTML = html;
  modal.classList.remove("hidden");
  const form = $("modalForm");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const submit =
      form.querySelector('button[type="submit"]') ||
      form.querySelector("button.primary");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Saving...";
    }
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      ["credits", "attended", "total"].forEach((k) => {
        if (data[k] !== undefined && data[k] !== "") data[k] = Number(data[k]);
        if (data[k] === "") delete data[k];
      });
      if (existing) {
        await api(`/api/${type}/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        await api(`/api/${type}`, {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      modal.classList.add("hidden");
      await refresh();
      toast(existing ? "Updated successfully" : "Added successfully");
    } catch (err) {
      toast(err.message || "Unable to save record");
      console.error("Save error:", err);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent =
          type === "subjects"
            ? "Save Subject"
            : type === "assignments"
              ? "Save Assignment"
              : type === "exams"
                ? "Save Exam"
                : type === "timetable"
                  ? "Save Class"
                  : type === "notes"
                    ? "Save Note"
                    : "Save Attendance";
      }
    }
  };
}

async function refresh() {
  state.data = await api("/api/data");
  if (state.user?.role === "admin") await loadAdmin();
  render();
}
async function removeItem(type, id) {
  if (!confirm("Delete this record?")) return;
  try {
    await api(`/api/${type}/${id}`, { method: "DELETE" });
    await refresh();
    toast("Deleted");
  } catch (e) {
    toast(e.message);
  }
}
async function toggleItem(type, id) {
  const item = state.data[type].find((x) => x._id === id);
  try {
    await api(`/api/${type}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ completed: !item.completed }),
    });
    await refresh();
    toast(item.completed ? "Marked pending" : "Marked complete");
  } catch (e) {
    toast(e.message);
  }
}
async function pinSubject(id) {
  const item = state.data.subjects.find((x) => x._id === id);
  await api(`/api/subjects/${id}`, {
    method: "PUT",
    body: JSON.stringify({ pinned: !item.pinned }),
  });
  await refresh();
}

if (state.token) startApp();

views.admin = function () {
  if (state.user?.role !== "admin")
    return `<div class="card">${empty("Admin access required.")}</div>`;
  const s = state.admin.stats || {},
    q = (state.admin.search || "").toLowerCase();
  const users = state.admin.users.filter((u) =>
    [u.name, u.email, u.branch, u.semester, u.rollNo]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
  const rec = state.admin.records;
  let content = "";
  if (state.admin.tab === "students") {
    content = `<input id="adminSearch" placeholder="Search students by name, email, branch, semester or roll no." value="${esc(state.admin.search || "")}"><div class="table-wrap"><table class="data-table admin-table"><thead><tr><th>Student</th><th>Email</th><th>College</th><th>Branch</th><th>Semester</th><th>Joined</th><th>Action</th></tr></thead><tbody>${users.map((u) => `<tr><td><b>${esc(u.name)}</b><br><small>${esc(u.rollNo || "-")}</small></td><td>${esc(u.email)}</td><td>${esc(u.college || "-")}</td><td>${esc(u.branch || "-")}</td><td>${esc(u.semester || "-")}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td><td><button class="small-btn danger" data-admin-delete-user="${u._id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="7">${empty("No students found.")}</td></tr>`}</tbody></table></div>`;
  } else if (state.admin.tab === "subjects")
    content = adminRecordTable(
      rec.subjects,
      ["Subject", "Student", "Code", "Faculty", "Deadline", "Status"],
      (x) =>
        `<td><b>${esc(x.name)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${esc(x.code || "-")}</td><td>${esc(x.faculty || "-")}</td><td>${formatDate(x.deadline)}</td><td>${x.completed ? "Completed" : "Pending"}</td>`,
    );
  else if (state.admin.tab === "assignments")
    content = adminRecordTable(
      rec.assignments,
      ["Assignment", "Student", "Subject", "Due", "Priority", "Status"],
      (x) =>
        `<td><b>${esc(x.title)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${esc(x.subject || "-")}</td><td>${formatDate(x.dueDate)}</td><td>${esc(x.priority)}</td><td>${x.completed ? "Completed" : "Pending"}</td>`,
    );
  else if (state.admin.tab === "attendance")
    content = adminRecordTable(
      rec.attendance,
      ["Subject", "Student", "Attended", "Total", "Percentage"],
      (x) =>
        `<td><b>${esc(x.subject)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${x.attended}</td><td>${x.total}</td><td><b>${pct(x.attended, x.total)}%</b></td>`,
    );
  else
    content = adminRecordTable(
      rec.exams,
      ["Subject", "Student", "Type", "Date", "Time", "Room"],
      (x) =>
        `<td><b>${esc(x.subject)}</b></td><td>${esc(x.userId?.name || "-")}</td><td>${esc(x.examType || "-")}</td><td>${formatDate(x.date)}</td><td>${esc(x.time || "-")}</td><td>${esc(x.room || "-")}</td>`,
    );
  return `<div class="admin-kpi"><div class="stat-card"><div class="icon">👨‍🎓</div><strong>${s.students || 0}</strong><span>Students</span></div><div class="stat-card"><div class="icon">📚</div><strong>${s.subjects || 0}</strong><span>Subjects</span></div><div class="stat-card"><div class="icon">📝</div><strong>${s.assignments || 0}</strong><span>Assignments</span></div><div class="stat-card"><div class="icon">🗓</div><strong>${s.exams || 0}</strong><span>Exams</span></div></div>
  <div class="grid-2"><div class="card"><h3>Database health</h3><div class="admin-stat-list"><span>Attendance records <b>${s.attendanceRecords || 0}</b></span><span>Notes <b>${s.notes || 0}</b></span><span>Timetable entries <b>${s.timetable || 0}</b></span><span>Overall attendance <b>${s.attendancePercent || 0}%</b></span></div></div><div class="card"><h3>Admin controls</h3><p class="muted">Search students, monitor academic records and remove student data when required. Student deletion cascades through academic records.</p></div></div>
  <div class="card" style="margin-top:18px"><div class="admin-tabs">${["students", "subjects", "assignments", "attendance", "exams"].map((t) => `<button class="${state.admin.tab === t ? "active" : ""}" data-admin-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>${content}</div>`;
};
