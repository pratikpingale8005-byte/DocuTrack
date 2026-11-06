const pool = require("../config/db");

const getAnomalyAlerts = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT
        aa.alert_id,
        aa.user_id,
        u.name AS user_name,
        aa.alert_type,
        aa.detected_at,
        aa.details,
        aa.is_resolved
       FROM Anomaly_Alerts aa
       JOIN Users u
         ON aa.user_id = u.user_id
       WHERE aa.user_id = $1
       ORDER BY aa.detected_at DESC`,
      [userId]
    );

    res.json({
      message: "Anomaly alerts retrieved successfully",
      alerts: result.rows,
    });
  } catch (error) {
    console.error("Get anomaly alerts error:", error);

    res.status(500).json({
      message: "Failed to retrieve anomaly alerts",
      error: error.message,
    });
  }
};

module.exports = {
  getAnomalyAlerts,
};
