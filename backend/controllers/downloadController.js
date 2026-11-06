const pool = require("../config/db");
const fs = require("fs");

const downloadFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT
        f.file_name,
        f.is_deleted,
        fv.storage_path
       FROM Files f
       JOIN File_Versions fv
         ON f.current_version_id = fv.version_id
       WHERE f.file_id = $1
         AND f.uploaded_by = $2`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    const file = result.rows[0];

    if (file.is_deleted) {
      return res.status(400).json({
        message: "File has been deleted",
      });
    }

    if (!fs.existsSync(file.storage_path)) {
      return res.status(404).json({
        message: "Physical file not found",
      });
    }

    await pool.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [fileId, userId, "DOWNLOAD", "File downloaded"]
    );

    res.download(file.storage_path, file.file_name);
  } catch (error) {
    console.error("Download file error:", error);

    res.status(500).json({
      message: "File download failed",
      error: error.message,
    });
  }
};

module.exports = {
  downloadFile,
};