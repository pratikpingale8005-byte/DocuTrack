const pool = require("../config/db");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const uploadFile = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const userId = req.user.user_id;
    const fileName = req.file.originalname;
    const fileExtension = path.extname(fileName).toLowerCase();
    const fileSize = req.file.size;
    const storagePath = req.file.path;

    // --------------------------------------------------
    // 1. Determine category from file extension
    // --------------------------------------------------

    let categoryId = 7; // Other

    if ([".doc", ".docx"].includes(fileExtension)) {
      categoryId = 1;
    } else if (
      [".xls", ".xlsx", ".csv"].includes(fileExtension)
    ) {
      categoryId = 2;
    } else if (fileExtension === ".pdf") {
      categoryId = 3;
    } else if (
      [".ppt", ".pptx"].includes(fileExtension)
    ) {
      categoryId = 4;
    } else if (
      [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(
        fileExtension
      )
    ) {
      categoryId = 5;
    } else if (
      [".mp4", ".avi", ".mov", ".mkv", ".webm"].includes(
        fileExtension
      )
    ) {
      categoryId = 6;
    }

    // --------------------------------------------------
    // 2. Calculate SHA-256 hash
    // --------------------------------------------------

    const fileBuffer = fs.readFileSync(storagePath);

    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // --------------------------------------------------
    // 3. Start transaction
    // --------------------------------------------------

    await client.query("BEGIN");

    // --------------------------------------------------
    // 4. Find user's department quota
    // --------------------------------------------------

    const quotaResult = await client.query(
      `SELECT
         d.storage_quota_bytes
       FROM Users u
       JOIN Departments d
         ON u.department_id = d.department_id
       WHERE u.user_id = $1`,
      [userId]
    );

    if (quotaResult.rows.length === 0) {
      await client.query("ROLLBACK");

      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
      }

      return res.status(400).json({
        message: "Department quota information not found",
      });
    }

    const quota = Number(
      quotaResult.rows[0].storage_quota_bytes
    );

    // --------------------------------------------------
    // 5. Check if this file already exists
    // --------------------------------------------------

    const existingFile = await client.query(
      `SELECT
         f.file_id,
         f.current_version_id,
         COALESCE(fv.file_size, 0) AS current_file_size
       FROM Files f
       LEFT JOIN File_Versions fv
         ON f.current_version_id = fv.version_id
       WHERE f.file_name = $1
         AND f.uploaded_by = $2
         AND f.is_deleted = FALSE
       LIMIT 1`,
      [fileName, userId]
    );

    let fileId;
    let versionNumber;
    let oldCurrentSize = 0;

    if (existingFile.rows.length > 0) {
      // ------------------------------------------------
      // Existing file -> new version
      // ------------------------------------------------

      fileId = existingFile.rows[0].file_id;

      oldCurrentSize = Number(
        existingFile.rows[0].current_file_size
      );

      const versionResult = await client.query(
        `SELECT
           COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM File_Versions
         WHERE file_id = $1`,
        [fileId]
      );

      versionNumber =
        Number(versionResult.rows[0].next_version);
    } else {
      // ------------------------------------------------
      // New file
      // ------------------------------------------------

      const policyResult = await client.query(
        `SELECT policy_id
         FROM Retention_Policies
         WHERE applies_to_category_id = $1
            OR applies_to_category_id IS NULL
         ORDER BY
           CASE
             WHEN applies_to_category_id = $1 THEN 0
             ELSE 1
           END
         LIMIT 1`,
        [categoryId]
      );

      const policyId =
        policyResult.rows.length > 0
          ? policyResult.rows[0].policy_id
          : null;

      const fileResult = await client.query(
        `INSERT INTO Files
          (
            file_name,
            file_extension,
            category_id,
            uploaded_by,
            policy_id
          )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING file_id`,
        [
          fileName,
          fileExtension,
          categoryId,
          userId,
          policyId,
        ]
      );

      fileId = fileResult.rows[0].file_id;
      versionNumber = 1;
    }

    // --------------------------------------------------
    // 6. Calculate storage change
    // --------------------------------------------------

    const storageChange =
      fileSize - oldCurrentSize;

    // --------------------------------------------------
    // 7. Get current department usage
    // --------------------------------------------------

    const usageResult = await client.query(
      `SELECT
         COALESCE(SUM(fv.file_size), 0) AS used_storage_bytes
       FROM Users u
       JOIN Files f
         ON f.uploaded_by = u.user_id
        AND f.is_deleted = FALSE
       JOIN File_Versions fv
         ON f.current_version_id = fv.version_id
       WHERE u.department_id = (
         SELECT department_id
         FROM Users
         WHERE user_id = $1
       )`,
      [userId]
    );

    const usedStorage = Number(
      usageResult.rows[0].used_storage_bytes
    );

    const newUsedStorage =
      usedStorage + storageChange;

    // --------------------------------------------------
    // 8. Enforce quota
    // --------------------------------------------------

    if (newUsedStorage > quota) {
      await client.query("ROLLBACK");

      if (fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
      }

      return res.status(413).json({
        message: "Storage quota exceeded",
        quota_bytes: quota,
        used_storage_bytes: usedStorage,
        remaining_storage_bytes:
          quota - usedStorage,
        file_size: fileSize,
        storage_change: storageChange,
      });
    }

    // --------------------------------------------------
    // 9. Create new File_Version
    // --------------------------------------------------

    const versionResult = await client.query(
      `INSERT INTO File_Versions
        (
          file_id,
          version_number,
          storage_path,
          file_size,
          file_hash,
          modified_by
        )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING version_id`,
      [
        fileId,
        versionNumber,
        storagePath,
        fileSize,
        fileHash,
        userId,
      ]
    );

    const versionId =
      versionResult.rows[0].version_id;

    // --------------------------------------------------
    // 10. Update current version
    // --------------------------------------------------

    await client.query(
      `UPDATE Files
       SET current_version_id = $1
       WHERE file_id = $2`,
      [versionId, fileId]
    );

    // --------------------------------------------------
    // 11. Record activity
    // --------------------------------------------------

    await client.query(
      `INSERT INTO Activity_Log
        (
          file_id,
          user_id,
          action,
          details
        )
       VALUES ($1, $2, $3, $4)`,
      [
        fileId,
        userId,
        versionNumber === 1
          ? "UPLOAD"
          : "NEW_VERSION",
        `Version ${versionNumber} uploaded`,
      ]
    );

    // --------------------------------------------------
    // 12. Commit
    // --------------------------------------------------

    await client.query("COMMIT");

    // --------------------------------------------------
    // 13. Success response
    // --------------------------------------------------

    res.status(201).json({
      message:
        versionNumber === 1
          ? "File uploaded successfully"
          : "New file version uploaded successfully",

      file_id: fileId,
      version_id: versionId,
      version_number: versionNumber,
      file_name: fileName,
      file_size: fileSize,
      file_hash: fileHash,

      storage: {
        quota_bytes: quota,
        used_storage_bytes: newUsedStorage,
        remaining_storage_bytes:
          quota - newUsedStorage,
        storage_change: storageChange,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("File upload error:", error);

    if (
      req.file &&
      req.file.path &&
      fs.existsSync(req.file.path)
    ) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error(
          "Failed to remove uploaded file:",
          deleteError
        );
      }
    }

    res.status(500).json({
      message: "File upload failed",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  uploadFile,
};