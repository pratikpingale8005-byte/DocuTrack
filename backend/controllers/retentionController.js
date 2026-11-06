const pool = require("../config/db");

const checkRetentionPolicies = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const expiredFiles = await client.query(`
      SELECT
        f.file_id,
        f.file_name,
        f.uploaded_by,
        f.policy_id,
        rp.policy_name,
        rp.retention_days,
        rp.action_on_expiry,
        f.created_at
      FROM Files f
      JOIN Retention_Policies rp
        ON f.policy_id = rp.policy_id
      WHERE f.is_deleted = FALSE
        AND f.created_at + (rp.retention_days * INTERVAL '1 day')
            <= CURRENT_TIMESTAMP
    `);

    let flagged = 0;
    let softDeleted = 0;
    let notified = 0;

    for (const file of expiredFiles.rows) {
      if (file.action_on_expiry === "soft_delete") {
        await client.query(
          `UPDATE Files
           SET is_deleted = TRUE,
               deleted_at = CURRENT_TIMESTAMP
           WHERE file_id = $1`,
          [file.file_id]
        );

        await client.query(
          `INSERT INTO Activity_Log
            (file_id, user_id, action, details)
           VALUES ($1, $2, $3, $4)`,
          [
            file.file_id,
            file.uploaded_by,
            "RETENTION_SOFT_DELETE",
            `File soft deleted after ${file.retention_days}-day retention period`,
          ]
        );

        softDeleted++;
      } else if (file.action_on_expiry === "flag") {
        await client.query(
          `INSERT INTO Anomaly_Alerts
            (user_id, alert_type, details)
           VALUES ($1, $2, $3)`,
          [
            file.uploaded_by,
            "RETENTION_EXPIRED",
            `Retention policy expired for file "${file.file_name}"`,
          ]
        );

        flagged++;
      } else if (file.action_on_expiry === "notify") {
        await client.query(
          `INSERT INTO Anomaly_Alerts
            (user_id, alert_type, details)
           VALUES ($1, $2, $3)`,
          [
            file.uploaded_by,
            "RETENTION_NOTIFICATION",
            `Retention period expired for file "${file.file_name}"`,
          ]
        );

        notified++;
      }
    }

    await client.query("COMMIT");

    res.json({
      message: "Retention policy check completed",
      expired_files_found: expiredFiles.rows.length,
      flagged,
      soft_deleted: softDeleted,
      notified,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Retention policy error:", error);

    res.status(500).json({
      message: "Retention policy check failed",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  checkRetentionPolicies,
};
