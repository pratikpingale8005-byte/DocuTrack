const express = require("express");

const { uploadFile } = require("../controllers/fileController");
const { deleteFile } = require("../controllers/deleteController");
const { restoreFile } = require("../controllers/restoreController");
const { getMyFiles } = require("../controllers/fileListController");
const { downloadFile } = require("../controllers/downloadController");
const { shareFile } = require("../controllers/shareController");

const {
  getSharedFiles,
} = require("../controllers/sharedFilesController");

const {
  downloadSharedFile,
} = require("../controllers/sharedDownloadController");

const {
  getActivityLogs,
} = require("../controllers/activityController");

const {
  getAnomalyAlerts,
} = require("../controllers/anomalyController");

const {
  transferOwnership,
} = require("../controllers/ownershipController");

const {
  checkRetentionPolicies,
} = require("../controllers/retentionController");

const {
  addTagToFile,
  removeTagFromFile,
  getFileTags,
} = require("../controllers/tagController");

const authenticateToken = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();


// ==========================================
// FILE UPLOAD
// ==========================================

router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  uploadFile
);


// ==========================================
// RETENTION POLICY CHECK
// ==========================================

router.post(
  "/retention/check",
  authenticateToken,
  checkRetentionPolicies
);


// ==========================================
// GET FILE TAGS
// ==========================================

router.get(
  "/:id/tags",
  authenticateToken,
  getFileTags
);


// ==========================================
// ADD TAG TO FILE
// ==========================================

router.post(
  "/:id/tags",
  authenticateToken,
  addTagToFile
);


// ==========================================
// REMOVE TAG FROM FILE
// ==========================================

router.delete(
  "/:id/tags/:tagId",
  authenticateToken,
  removeTagFromFile
);


// ==========================================
// OWNERSHIP TRANSFER
// ==========================================

router.post(
  "/:id/transfer-ownership",
  authenticateToken,
  transferOwnership
);


// ==========================================
// DELETE FILE
// ==========================================

router.delete(
  "/:id",
  authenticateToken,
  deleteFile
);


// ==========================================
// RESTORE FILE
// ==========================================

router.post(
  "/:id/restore",
  authenticateToken,
  restoreFile
);


// ==========================================
// GET MY FILES
// ==========================================

router.get(
  "/",
  authenticateToken,
  getMyFiles
);


// ==========================================
// GET FILES SHARED WITH ME
// ==========================================

router.get(
  "/shared-with-me",
  authenticateToken,
  getSharedFiles
);


// ==========================================
// GET ACTIVITY LOGS
// ==========================================

router.get(
  "/activity-logs",
  authenticateToken,
  getActivityLogs
);


// ==========================================
// GET ANOMALY ALERTS
// ==========================================

router.get(
  "/anomaly-alerts",
  authenticateToken,
  getAnomalyAlerts
);


// ==========================================
// SHARE FILE
// ==========================================

router.post(
  "/:id/share",
  authenticateToken,
  shareFile
);


// ==========================================
// DOWNLOAD SHARED FILE
// ==========================================

router.get(
  "/:id/shared-download",
  authenticateToken,
  downloadSharedFile
);


// ==========================================
// DOWNLOAD MY FILE
// ==========================================

router.get(
  "/:id/download",
  authenticateToken,
  downloadFile
);


module.exports = router;
