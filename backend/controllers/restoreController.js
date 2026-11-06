const pool = require("../config/db");

const restoreFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.user_id;

    const result = await pool.query(
      `UPDATE Files
       SET is_deleted = FALSE,
           deleted_at = NULL
       WHERE file_id = $1
         AND uploaded_by = $2
         AND is_deleted = TRUE
       RETURNING file_id, file_name, is_deleted, deleted_at`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Deleted file not found",
      });
    }

    await pool.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [fileId, userId, "RESTORE", "File restored"]
    );

    res.json({
      message: "File restored successfully",
      file: result.rows[0],
    });
  } catch (error) {
    console.error("Restore file error:", error);

    res.status(500).json({
      message: "File restoration failed",
      error: error.message,
    });
  }
};

module.exports = {
  restoreFile,
};