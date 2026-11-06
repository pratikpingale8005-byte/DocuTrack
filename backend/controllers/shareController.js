const pool = require("../config/db");

const shareFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const sharedBy = req.user.user_id;
    const { shared_with, permission_type } = req.body;

    if (!shared_with || !permission_type) {
      return res.status(400).json({
        message: "shared_with and permission_type are required",
      });
    }

    if (!["view", "edit", "download"].includes(permission_type)) {
      return res.status(400).json({
        message: "Invalid permission type",
      });
    }

    const fileResult = await pool.query(
      `SELECT file_id, file_name
       FROM Files
       WHERE file_id = $1
         AND uploaded_by = $2
         AND is_deleted = FALSE`,
      [fileId, sharedBy]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        message: "File not found or you are not the owner",
      });
    }

    const userResult = await pool.query(
      `SELECT user_id, name, email
       FROM Users
       WHERE user_id = $1`,
      [shared_with]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User to share with not found",
      });
    }

    const existingShare = await pool.query(
      `SELECT share_id
       FROM Shared_Access
       WHERE file_id = $1
         AND shared_with = $2`,
      [fileId, shared_with]
    );

    if (existingShare.rows.length > 0) {
      return res.status(409).json({
        message: "File is already shared with this user",
      });
    }

    const result = await pool.query(
      `INSERT INTO Shared_Access
        (file_id, shared_with, shared_by, permission_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [fileId, shared_with, sharedBy, permission_type]
    );

    await pool.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [
        fileId,
        sharedBy,
        "SHARE",
        `File shared with user ${shared_with} (${permission_type})`,
      ]
    );

    res.status(201).json({
      message: "File shared successfully",
      share: result.rows[0],
    });
  } catch (error) {
    console.error("Share file error:", error);

    res.status(500).json({
      message: "File sharing failed",
      error: error.message,
    });
  }
};

module.exports = {
  shareFile,
};