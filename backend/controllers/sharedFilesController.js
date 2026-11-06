const pool = require("../config/db");

const getSharedFiles = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT
        sa.share_id,
        sa.file_id,
        f.file_name,
        f.file_extension,
        f.category_id,
        sa.shared_by,
        u.name AS shared_by_name,
        u.email AS shared_by_email,
        sa.permission_type,
        sa.shared_at,
        f.current_version_id,
        fv.version_number,
        fv.file_size
       FROM Shared_Access sa
       JOIN Files f
         ON sa.file_id = f.file_id
       JOIN Users u
         ON sa.shared_by = u.user_id
       LEFT JOIN File_Versions fv
         ON f.current_version_id = fv.version_id
       WHERE sa.shared_with = $1
         AND f.is_deleted = FALSE
       ORDER BY sa.shared_at DESC`,
      [userId]
    );

    res.json({
      message: "Shared files retrieved successfully",
      files: result.rows,
    });
  } catch (error) {
    console.error("Get shared files error:", error);

    res.status(500).json({
      message: "Failed to retrieve shared files",
      error: error.message,
    });
  }
};

module.exports = {
  getSharedFiles,
};
