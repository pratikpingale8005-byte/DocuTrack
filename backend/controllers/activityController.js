const pool = require("../config/db");

const getActivityLogs = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT
        al.activity_id,
        al.file_id,
        f.file_name,
        al.user_id,
        u.name AS user_name,
        al.action,
        al.details,
        al.action_timestamp
       FROM Activity_Log al
       LEFT JOIN Files f
         ON al.file_id = f.file_id
       JOIN Users u
         ON al.user_id = u.user_id
       WHERE al.user_id = $1
       ORDER BY al.action_timestamp DESC`,
      [userId]
    );

    res.json({
      message: "Activity logs retrieved successfully",
      logs: result.rows,
    });
  } catch (error) {
    console.error("Get activity logs error:", error);

    res.status(500).json({
      message: "Failed to retrieve activity logs",
      error: error.message,
    });
  }
};

module.exports = {
  getActivityLogs,
};