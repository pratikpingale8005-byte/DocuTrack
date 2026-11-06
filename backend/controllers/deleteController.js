const pool = require("../config/db");

const deleteFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.user_id;

    const result = await pool.query(
      `UPDATE Files
       SET is_deleted = TRUE,
           deleted_at = CURRENT_TIMESTAMP
       WHERE file_id = $1
         AND uploaded_by = $2
         AND is_deleted = FALSE
       RETURNING file_id, file_name, is_deleted, deleted_at`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "File not found or already deleted",
      });
    }

    await pool.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [fileId, userId, "DELETE", "File soft deleted"]
    );

    res.json({
      message: "File deleted successfully",
      file: result.rows[0],
    });
  } catch (error) {
    console.error("Delete file error:", error);

    res.status(500).json({
      message: "File deletion failed",
      error: error.message,
    });
  }
};

module.exports = {
  deleteFile,
};