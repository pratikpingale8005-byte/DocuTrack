const pool = require("../config/db");

const getMyFiles = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT
        f.file_id,
        f.file_name,
        f.file_extension,
        f.category_id,
        f.current_version_id,
        f.policy_id,
        f.is_deleted,
        f.created_at,
        fv.version_number,
        fv.file_size,
        fv.modified_at
       FROM Files f
       LEFT JOIN File_Versions fv
         ON f.current_version_id = fv.version_id
       WHERE f.uploaded_by = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({
      message: "Files retrieved successfully",
      files: result.rows,
    });
  } catch (error) {
    console.error("Get files error:", error);

    res.status(500).json({
      message: "Failed to retrieve files",
      error: error.message,
    });
  }
};

module.exports = {
  getMyFiles,
};
