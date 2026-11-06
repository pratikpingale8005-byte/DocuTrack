// ========================================
// DOCUTRACK - CORE API AND UTILITY FUNCTIONS
// ========================================

const API_BASE_URL =
  (window.DOCUTRACK_CONFIG && window.DOCUTRACK_CONFIG.apiBaseUrl) ||
  "http://localhost:5001";

const ROLES = { 1: "Admin", 2: "Manager", 3: "Employee" };
const CATEGORIES = {
  1: "Word", 2: "Excel", 3: "PDF", 4: "PPT", 5: "Image", 6: "Video", 7: "Other"
};

// ========================================
// AUTHENTICATION
// ========================================

function getToken() {
  return localStorage.getItem("token");
}

function getCurrentUser() {
  const userJSON = localStorage.getItem("user");
  return userJSON ? JSON.parse(userJSON) : null;
}

function isAuthenticated() {
  return !!getToken();
}

function requireAuthentication() {
  if (!isAuthenticated()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

async function loginUser(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      return { success: true, message: data.message, user: data.user };
    }

    return { success: false, message: data.message || "Invalid credentials" };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "Network error. Please try again." };
  }
}

function getAuthHeaders(includeJson = true) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

// ========================================
// GENERIC API REQUEST
// ========================================

async function apiRequest(endpoint, method = "GET", body = null) {
  try {
    const options = {
      method,
      headers: getAuthHeaders()
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await readJsonResponse(response);

    if (isAuthFailure(response.status, data)) {
      logout();
      return { success: false, message: "Session expired. Please login again." };
    }

    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.error("API request error:", error);
    return { success: false, message: "Network error. Please try again.", error };
  }
}

// ========================================
// FILE OPERATIONS
// ========================================

async function uploadFile(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });

    const data = await readJsonResponse(response);

    if (isAuthFailure(response.status, data)) {
      logout();
      return { success: false, message: "Session expired. Please login again." };
    }

    if (response.ok) {
      return { success: true, data, message: data?.message || "File uploaded successfully" };
    }

    return { success: false, message: data?.message || "Upload failed" };
  } catch (error) {
    console.error("Upload error:", error);
    return { success: false, message: "Network error during upload" };
  }
}

async function loadMyFiles() {
  return apiRequest("/api/files/", "GET");
}

async function downloadFile(fileId) {
  return downloadBlob(`/api/files/${fileId}/download`);
}

async function deleteFile(fileId) {
  return apiRequest(`/api/files/${fileId}`, "DELETE");
}

async function restoreFile(fileId) {
  return apiRequest(`/api/files/${fileId}/restore`, "POST");
}

async function shareFile(fileId, sharedWith, permissionType) {
  return apiRequest(`/api/files/${fileId}/share`, "POST", {
    shared_with: Number(sharedWith),
    permission_type: permissionType
  });
}

async function loadSharedFiles() {
  return apiRequest("/api/files/shared-with-me", "GET");
}

async function downloadSharedFile(fileId) {
  return downloadBlob(`/api/files/${fileId}/shared-download`);
}

async function transferOwnership(fileId, toUserId, reason) {
  return apiRequest(`/api/files/${fileId}/transfer-ownership`, "POST", {
    to_user_id: Number(toUserId),
    reason: reason || null
  });
}

async function loadActivityLogs() {
  return apiRequest("/api/files/activity-logs", "GET");
}

async function loadAlerts() {
  return apiRequest("/api/files/anomaly-alerts", "GET");
}

async function runRetentionCheck() {
  return apiRequest("/api/files/retention/check", "POST");
}

// ========================================
// TAG OPERATIONS
// ========================================

async function createTag(tagName) {
  return apiRequest("/api/tags", "POST", {
    tag_name: tagName
  });
}

async function loadTags() {
  return apiRequest("/api/tags", "GET");
}

async function loadFileTags(fileId) {
  return apiRequest(`/api/files/${fileId}/tags`, "GET");
}

async function addTagToFile(fileId, tagId) {
  return apiRequest(`/api/files/${fileId}/tags`, "POST", {
    tag_id: Number(tagId)
  });
}

async function removeTagFromFile(fileId, tagId) {
  return apiRequest(`/api/files/${fileId}/tags/${tagId}`, "DELETE");
}

async function downloadBlob(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${getToken()}` }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "download";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return { success: true, message: "File downloaded" };
    }

    const errorData = await readJsonResponse(response);
    if (isAuthFailure(response.status, errorData)) {
      logout();
      return { success: false, message: "Session expired. Please login again." };
    }
    return { success: false, message: errorData?.message || "Download failed" };
  } catch (error) {
    console.error("Download error:", error);
    return { success: false, message: "Download failed" };
  }
}

// ========================================
// UI HELPERS
// ========================================

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function getCategoryName(categoryId) {
  return CATEGORIES[categoryId] || "Unknown";
}

function getRoleName(roleId) {
  return ROLES[roleId] || "Unknown";
}

function iconSvg(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function brandMark() {
  return `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M9.5 5h8.4L24 11.1V26a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 8 26V6.5A1.5 1.5 0 0 1 9.5 5z" fill="none" stroke="currentColor" stroke-width="1.75"/>
    <path d="M17.5 5v6.2H24" fill="none" stroke="currentColor" stroke-width="1.75"/>
    <path d="M12.2 18.4l2.3 2.3 5.1-5.3" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function getFileIcon(categoryId) {
  const doc = `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>`;
  const marks = {
    1: `${doc}<path d="M8 13h8"/><path d="M8 17h5"/>`,
    2: `${doc}<path d="M8 13h8"/><path d="M8 17h8"/><path d="M12 11v8"/>`,
    3: `${doc}<path d="M8 14h8"/><path d="M8 17h6"/>`,
    4: `${doc}<path d="M8 15h8"/><path d="M10 12v6"/>`,
    5: `${doc}<circle cx="10" cy="13" r="1"/><path d="M8 18l3-3 2 2 3-4"/>`,
    6: `${doc}<path d="M10 13l5 3-5 3z"/>`,
    7: doc
  };
  return iconSvg(marks[categoryId] || doc);
}

function navIcon(name) {
  const paths = {
    dashboard: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
    files: `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>`,
    upload: `<path d="M12 16V5"/><path d="M8 8l4-4 4 4"/><path d="M5 19h14"/>`,
    shared: `<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 4.13a3 3 0 0 1 0 5.74"/>`,
    search: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`,
    activity: `<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>`,
    alerts: `<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>`,
    profile: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>`
  };
  return iconSvg(paths[name] || paths.files);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function initSidebar(activePage) {
  const user = getCurrentUser();
  if (!user) return;

  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const item = (page, href, label, icon) => `
    <a href="${href}" class="nav-link ${activePage === page ? "active" : ""}">
      <span class="nav-icon">${navIcon(icon)}</span>
      <span>${label}</span>
    </a>`;

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <span class="brand-icon">${brandMark()}</span>
      <span class="brand-text">DocuTrack</span>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-user-name">${escapeHtml(user.name)}</div>
      <div class="sidebar-user-role">${escapeHtml(getRoleName(user.role_id))}</div>
    </div>
    <nav class="sidebar-nav" aria-label="Main">
      ${item("dashboard", "dashboard.html", "Dashboard", "dashboard")}
      ${item("files", "files.html", "My Files", "files")}
      ${item("upload", "upload.html", "Upload", "upload")}
      ${item("shared", "shared.html", "Shared With Me", "shared")}
      ${item("search", "search.html", "Search", "search")}
      ${item("activity", "activity.html", "Activity Logs", "activity")}
      ${item("alerts", "alerts.html", "Alerts", "alerts")}
      ${item("profile", "profile.html", "Profile", "profile")}
    </nav>
    <div class="sidebar-legal">
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms & Conditions</a>
    </div>
    <button type="button" class="sidebar-logout" id="sidebarLogout">
      <span class="nav-icon">${navIcon("logout")}</span>
      <span>Logout</span>
    </button>
  `;

  document.getElementById("sidebarLogout").addEventListener("click", logout);
}

function initPageHeader(title, subtitle = "") {
  const user = getCurrentUser();
  const header = document.getElementById("page-header");
  if (!header || !user) return;

  header.innerHTML = `
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
    </div>
    <div class="header-user">
      <div class="header-user-info">
        <span class="header-user-name">${escapeHtml(user.name)}</span>
        <span class="header-user-email">${escapeHtml(user.email)}</span>
      </div>
      <span class="role-badge">${escapeHtml(getRoleName(user.role_id))}</span>
    </div>
  `;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

function initModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) modal.classList.remove("active");
    });
  });
}

function renderStatusBadge(isDeleted) {
  if (isDeleted) {
    return '<span class="status-badge status-deleted">Deleted</span>';
  }
  return '<span class="status-badge status-active">Active</span>';
}

function renderEmptyState(message) {
  return `
    <div class="empty-state">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = '<div class="loading-state"><p>Loading...</p></div>';
  }
}

function isAdmin() {
  const user = getCurrentUser();
  return user && user.role_id === 1;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function isAuthFailure(status, data) {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /token/i.test(data?.message || "");
}
