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

// Live Clock in Topbar
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

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
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

// Navigation Handlers
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

// Mobile Sidebar Controls
const sidebar = document.querySelector(".sidebar");
const mobileMenu = $("mobileMenu");
mobileMenu.onclick = (e) => {
  e.stopPropagation();
  sidebar.classList.toggle("open");
};
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

// Theme Toggles
function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("esp_theme", isDark ? "dark" : "light");
  $("topThemeBtn").textContent = isDark ? "🌙" : "☀️";
}
$("themeBtn").onclick = toggleTheme;
$("topThemeBtn").onclick = toggleTheme;
if (localStorage.getItem("esp_theme") === "dark") {
  document.body.classList.add("dark-mode");
  $("topThemeBtn").textContent = "🌙";
}

// Modals
$("modalClose").onclick = () => modal.classList.add("hidden");
$("focusModalBtn").onclick = () => focusModal.classList.remove("hidden");
$("focusModalClose").onclick = () => focusModal.classList.add("hidden");

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
  $("pageEyebrow").textContent = titles[state.page][0];
  $("pageTitle").childNodes[0].nodeValue = titles[state.page][1] + " ";

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
      <div class="stat-card"><span>Total subjects</span><strong>${d.subjects.length}</strong><small class="muted">0 completed</small></div>
      <div class="stat-card"><span>Pending assignments</span><strong>${d.assignments.filter((x) => !x.completed).length}</strong><small class="muted">0% completed</small></div>
      <div class="stat-card"><span>Upcoming exams</span><strong>${d.exams.length}</strong><small class="muted">Next 30-day view</small></div>
      <div class="stat-card"><span>Average attendance</span><strong>0%</strong><small class="muted">✓ On track</small></div>
    </div>

    <div class="dashboard-grid-main">
      <div class="card">
        <div class="panel-heading"><h3>Today's Schedule</h3><button class="secondary" data-action="add-timetable">+ Add Class</button></div>
        <p class="muted">No classes scheduled for ${dayName}.</p>
      </div>
      <div class="card">
        <div class="panel-heading"><h3>Upcoming Deadlines</h3></div>
        <p class="muted">No upcoming deadlines or exams.</p>
      </div>
    </div>`;
  },

  admin() {
    if (state.user?.role !== "admin") return empty("Admin access required.");

    const adminNavItems = [
      { id: "overview", label: "Overview", icon: "📊" },
      { id: "students", label: "Students", icon: "👥" },
      { id: "academic", label: "Academic Content", icon: "📚" },
      { id: "announcements", label: "Announcements", icon: "📢" },
      { id: "notifications", label: "Notifications", icon: "🔔" },
      { id: "analytics", label: "Analytics", icon: "📈" },
      { id: "maintenance", label: "Maintenance Mode", icon: "🛠️" },
      { id: "feature_controls", label: "Feature Controls", icon: "⚡" },
      { id: "global_settings", label: "Global Settings", icon: "⚙️" },
      { id: "export_approvals", label: "Export Approvals", icon: "🔒" },
      { id: "activity_logs", label: "Activity Logs", icon: "📜" },
      { id: "security", label: "Security", icon: "🛡️" },
    ];

    let activeContent = "";
    const tab = state.admin.tab;

    if (tab === "overview") {
      activeContent = `
      <div class="admin-banner">
        <div>
          <div class="eyebrow">ADMIN CONTROL CENTER</div>
          <h2>System command center</h2>
          <p class="muted">Manage users, academic content, announcements, global settings and security from one protected console.</p>
        </div>
        <div class="status-pill"><span class="dot"></span> System operational</div>
      </div>

      <div class="admin-stats-grid">
        <div class="stat-card"><strong>2</strong><span>Students</span></div>
        <div class="stat-card"><strong>8</strong><span>Subjects</span></div>
        <div class="stat-card"><strong>2</strong><span>Assignments</span></div>
        <div class="stat-card"><strong>2</strong><span>Exams</span></div>
        <div class="stat-card"><strong>1</strong><span>Announcements</span></div>
        <div class="stat-card"><strong>9</strong><span>Recent logs</span></div>
      </div>

      <div class="card">
        <h3>Quick controls</h3>
        <div class="quick-controls-grid">
          <button class="quick-control-btn" data-admin-jump="announcements">📢 New announcement</button>
          <button class="quick-control-btn" data-admin-jump="notifications">🔔 Broadcast notification</button>
          <button class="quick-control-btn" data-admin-jump="maintenance">🛠️ Maintenance</button>
          <button class="quick-control-btn" data-admin-jump="feature_controls">⚡ Feature controls</button>
        </div>
      </div>`;
    } else if (tab === "students") {
      activeContent = `
      <div class="card">
        <h3>👥 Student management</h3>
        <p class="muted">Activate, deactivate, reset passwords or remove student accounts.</p>
        <input style="margin:15px 0" placeholder="Search students...">
        <table class="data-table">
          <thead><tr><th>STUDENT</th><th>BRANCH</th><th>SEMESTER</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
          <tbody>
            <tr><td><b>Patil Kapil</b><br><small>kpcprestor21970@gmail.com</small></td><td>CE</td><td>5</td><td><span class="status-pill">Active</span></td><td><button class="small-btn">Disable</button> <button class="small-btn">Reset password</button> <button class="small-btn danger">Delete</button></td></tr>
          </tbody>
        </table>
      </div>`;
    } else if (tab === "announcements") {
      activeContent = `
      <div class="two-col">
        <div class="card">
          <h3>📢 Create announcement</h3>
          <label>Title<input placeholder="Important academic notice"></label>
          <label>Message<textarea placeholder="Write the announcement..."></textarea></label>
          <button class="primary full">Publish announcement</button>
        </div>
        <div class="card"><h3>Recent announcements</h3>${empty("No announcements published.")}</div>
      </div>`;
    } else if (tab === "maintenance") {
      activeContent = `
      <div class="card">
        <h3>🛠️ Maintenance mode</h3>
        <div class="toggle-row">
          <div><b>Maintenance mode</b><p class="muted">Disable student access temporarily</p></div>
          <label class="switch"><input type="checkbox"><span class="slider"></span></label>
        </div>
        <label>Maintenance message<textarea>System is temporarily under maintenance. Please try again later.</textarea></label>
        <button class="primary full">Save maintenance settings</button>
      </div>`;
    } else if (tab === "feature_controls") {
      activeContent = `
      <div class="card">
        <h3>⚡ Feature controls</h3>
        <p class="muted">Turn product modules on or off globally for students.</p>
        <div class="toggle-row"><div><b>Smart Planner</b></div><label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>
        <div class="toggle-row"><div><b>Exam Preparation</b></div><label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>
        <div class="toggle-row"><div><b>Focus Timer</b></div><label class="switch"><input type="checkbox" checked><span class="slider"></span></label></div>
        <button class="primary full" style="margin-top:15px">Save feature controls</button>
      </div>`;
    } else {
      activeContent = `<div class="card"><h3>${tab.replace("_", " ").toUpperCase()}</h3><p class="muted">Module controls ready for configuration.</p></div>`;
    }

    return `
    <div class="admin-shell">
      <aside class="admin-sub-sidebar">
        <div class="admin-sidebar-header">
          <div class="brand-mark">EP</div>
          <div><strong>Admin Center</strong><small>Control & security</small></div>
        </div>
        ${adminNavItems
          .map(
            (item) => `
          <button class="admin-nav-item ${tab === item.id ? "active" : ""}" data-admin-tab="${item.id}">
            <span>${item.icon}</span> ${item.label}
          </button>
        `,
          )
          .join("")}
      </aside>
      <div class="admin-content-view">${activeContent}</div>
    </div>`;
  },

  subjects() {
    return empty("Subjects management.");
  },
  assignments() {
    return empty("Assignments management.");
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

function bindPage() {
  document.querySelectorAll("[data-admin-tab]").forEach((b) => {
    b.onclick = () => {
      state.admin.tab = b.dataset.adminTab;
      render();
    };
  });
  document.querySelectorAll("[data-admin-jump]").forEach((b) => {
    b.onclick = () => {
      state.admin.tab = b.dataset.adminJump;
      render();
    };
  });
}

// FOCUS TIMER LOGIC
let focusSeconds = 25 * 60;
let focusInterval = null;

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.onclick = () => {
    document
      .querySelectorAll(".preset-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    focusSeconds = Number(btn.dataset.time) * 60;
    updateFocusDisplay();
  };
});

function updateFocusDisplay() {
  const m = Math.floor(focusSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (focusSeconds % 60).toString().padStart(2, "0");
  $("focusDisplay").textContent = `${m}:${s}`;
}

$("startFocusBtn").onclick = () => {
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
    $("startFocusBtn").textContent = "Start focus";
  } else {
    $("startFocusBtn").textContent = "Pause focus";
    focusInterval = setInterval(() => {
      if (focusSeconds > 0) {
        focusSeconds--;
        updateFocusDisplay();
      } else {
        clearInterval(focusInterval);
        focusInterval = null;
        toast("Focus session complete!");
        $("startFocusBtn").textContent = "Start focus";
      }
    }, 1000);
  }
};

$("resetFocusBtn").onclick = () => {
  clearInterval(focusInterval);
  focusInterval = null;
  const activePreset = document.querySelector(".preset-btn.active");
  focusSeconds = (activePreset ? Number(activePreset.dataset.time) : 25) * 60;
  updateFocusDisplay();
  $("startFocusBtn").textContent = "Start focus";
};

if (state.token) startApp();
