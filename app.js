/*root.app*/
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
    tab: "overview",
    search: "",
  },
  page: "dashboard",
  edit: null,
};

const $ = (id) => document.getElementById(id);
const authView = $("authView"),
  appView = $("appView"),
  modal = $("modal"),
  focusModal = $("focusModal");

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("toast").appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const clockEl = $("topbarClock");
  if (clockEl) clockEl.textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (res.status === 401) {
    logout(false);
    throw new Error("Session expired");
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = res;
  }

  if (!res.ok) {
    throw new Error(
      data && data.message ? data.message : `Request failed (${res.status})`,
    );
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
    $("avatar").textContent = (state.user.name || "P")[0].toUpperCase();
    render();
  } catch (err) {
    console.error("StartApp failed:", err);
    toast("Error loading user data.");
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

const logoutBtn = $("logoutBtn");
if (logoutBtn) logoutBtn.onclick = () => logout(true);

document.querySelectorAll(".nav-item, .bottom-nav button").forEach((btn) => {
  btn.onclick = () => {
    state.page = btn.dataset.page;
    document
      .querySelectorAll(".nav-item, .bottom-nav button")
      .forEach((n) =>
        n.classList.toggle("active", n.dataset.page === state.page),
      );
    document.querySelector(".sidebar").classList.remove("open");
    render();
  };
});

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("esp_theme", isDark ? "dark" : "light");
  const topThemeBtn = $("topThemeBtn");
  if (topThemeBtn) topThemeBtn.textContent = isDark ? "🌙" : "☀️";
}

const themeBtn = $("themeBtn");
if (themeBtn) themeBtn.onclick = toggleTheme;

const topThemeBtn = $("topThemeBtn");
if (topThemeBtn) topThemeBtn.onclick = toggleTheme;

if (localStorage.getItem("esp_theme") === "dark") {
  document.body.classList.add("dark-mode");
  if (topThemeBtn) topThemeBtn.textContent = "🌙";
}

const modalClose = $("modalClose");
if (modalClose) modalClose.onclick = () => modal.classList.add("hidden");

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

function empty(text) {
  return `<div class="empty">${esc(text)}</div>`;
}

// UI RENDER VIEWS
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
    const lastName = state.user?.name
      ? state.user.name.split(" ").slice(-1)[0]
      : "Student";

    return `
    <section class="dashboard-hero">
      <div>
        <div class="eyebrow-light">STUDENT COMMAND CENTER</div>
        <h2>Good morning, ${esc(lastName)} 👋</h2>
        <p>${dateLabel} • Your academic overview for today.</p>
      </div>
      <div class="hero-score"><span>Productivity</span><strong>0%</strong><small>Based on progress & attendance</small></div>
    </section>
    <div class="stats">
      <div class="stat-card"><span>Total subjects</span><strong>${d.subjects?.length || 0}</strong></div>
      <div class="stat-card"><span>Pending assignments</span><strong>${d.assignments?.filter((x) => !x.completed).length || 0}</strong></div>
      <div class="stat-card"><span>Upcoming exams</span><strong>${d.exams?.length || 0}</strong></div>
      <div class="stat-card"><span>Average attendance</span><strong>0%</strong></div>
    </div>`;
  },

  subjects() {
    const d = state.data.subjects || [];
    let content =
      d.length === 0
        ? `<div class="card empty-state"><p class="muted">No subjects added yet.</p></div>`
        : `<div class="card-grid">${d
            .map(
              (s) => `
          <div class="card">
            <h3>${esc(s.name || s.title)}</h3>
            <p class="muted">${esc(s.code || "No Code")}</p>
            <div style="margin-top: 15px;">
              <button class="small-btn danger" onclick="deleteSubject('${s._id}')">Delete</button>
            </div>
          </div>
        `,
            )
            .join("")}</div>`;

    return `
      <div class="panel-heading">
        <div>
          <h2>Your Subjects</h2>
          <p class="muted">Manage your coursework and syllabus.</p>
        </div>
        <button class="primary" onclick="openSubjectModal()">+ Add Subject</button>
      </div>
      ${content}
    `;
  },

  assignments() {
    const d = state.data.assignments || [];
    let content =
      d.length === 0
        ? `<div class="card empty-state"><p class="muted">You have no pending assignments. Take a break!</p></div>`
        : `<div class="list-container">${d
            .map(
              (a) => `
          <div class="card list-item ${a.completed ? "completed" : ""}">
            <div>
              <h3>${esc(a.title)}</h3>
              <p class="muted">Due: ${esc(new Date(a.dueDate).toLocaleDateString())}</p>
            </div>
            <div>
              <button class="small-btn" onclick="toggleAssignment('${a._id}')">${a.completed ? "Undo" : "Complete"}</button>
              <button class="small-btn danger" onclick="deleteAssignment('${a._id}')">Delete</button>
            </div>
          </div>
        `,
            )
            .join("")}</div>`;

    return `
      <div class="panel-heading">
        <div>
          <h2>Assignments & Tasks</h2>
          <p class="muted">Keep track of your academic deadlines.</p>
        </div>
        <button class="primary" onclick="openAssignmentModal()">+ Add Assignment</button>
      </div>
      ${content}
    `;
  },

  admin() {
    if (state.user?.role !== "admin") return empty("Admin access required.");
    return `<div class="card"><h3>Admin Controls</h3><p class="muted">System controls ready.</p></div>`;
  },

  exams() {
    return empty("Exams management.");
  },
  timetable() {
    return empty("Timetable management.");
  },
  notes() {
    return empty("Notes management.");
  },
  attendance() {
    return empty("Attendance management.");
  },
  "attendance-intelligence"() {
    return empty("Attendance Intelligence.");
  },
  planner() {
    return empty("Smart Study Planner.");
  },
  "exam-prep"() {
    return empty("Exam Prep.");
  },
  notifications() {
    return empty("Notifications.");
  },
  goals() {
    return empty("Goals & Streak.");
  },
  profile() {
    return empty("Profile & Security settings.");
  },
};

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
    planner: ["SMART TOOLS", "Smart Study Planner"],
    "exam-prep": ["SMART TOOLS", "Exam Preparation"],
    notifications: ["ANALYTICS", "Notifications"],
    goals: ["ANALYTICS", "Goals & Streak"],
    profile: ["ACCOUNT", "Profile & Security"],
    admin: ["ADMINISTRATION", "Admin Panel"],
  };

  const pageEyebrow = $("pageEyebrow");
  const pageTitle = $("pageTitle");
  const pageContent = $("pageContent");

  if (pageEyebrow) pageEyebrow.textContent = titles[state.page][0];
  if (pageTitle && pageTitle.childNodes[0])
    pageTitle.childNodes[0].nodeValue = titles[state.page][1] + " ";

  document
    .querySelectorAll(".admin-only")
    .forEach((el) =>
      el.classList.toggle("hidden", state.user?.role !== "admin"),
    );
  if (state.user?.role !== "admin" && state.page === "admin")
    state.page = "dashboard";

  if (pageContent) {
    pageContent.innerHTML = views[state.page]();
  }
}

// MODAL CONTROLS & API ACTIONS
window.openSubjectModal = () => {
  $("modalContent").innerHTML = `
    <h3>Add New Subject</h3>
    <form onsubmit="submitSubject(event)">
      <label>Subject Name<input id="newSubName" required></label>
      <label>Subject Code<input id="newSubCode"></label>
      <button class="primary full" type="submit" style="margin-top: 15px;">Save Subject</button>
    </form>`;
  modal.classList.remove("hidden");
};

window.submitSubject = async (e) => {
  e.preventDefault();
  const payload = { name: $("newSubName").value, code: $("newSubCode").value };
  try {
    // Awaiting your exact backend route format (Assuming POST /api/subjects)
    const newSub = await api("/api/subjects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.data.subjects.push(newSub);
    modal.classList.add("hidden");
    render();
    toast("Subject added!");
  } catch (err) {
    toast(err.message);
  }
};

window.openAssignmentModal = () => {
  $("modalContent").innerHTML = `
    <h3>Add New Assignment</h3>
    <form onsubmit="submitAssignment(event)">
      <label>Title<input id="newAssTitle" required></label>
      <label>Due Date<input type="date" id="newAssDate" required></label>
      <button class="primary full" type="submit" style="margin-top: 15px;">Save Assignment</button>
    </form>`;
  modal.classList.remove("hidden");
};

window.submitAssignment = async (e) => {
  e.preventDefault();
  const payload = {
    title: $("newAssTitle").value,
    dueDate: $("newAssDate").value,
    completed: false,
  };
  try {
    // Awaiting your exact backend route format (Assuming POST /api/assignments)
    const newAss = await api("/api/assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.data.assignments.push(newAss);
    modal.classList.add("hidden");
    render();
    toast("Assignment added!");
  } catch (err) {
    toast(err.message);
  }
};

if (state.token) startApp();
