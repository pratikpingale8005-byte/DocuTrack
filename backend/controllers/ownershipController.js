const pool = require("../config/db");

const transferOwnership = async (req, res) => {
  const client = await pool.connect();

  try {
    const fileId = req.params.id;
    const fromUserId = req.user.user_id;
    const { to_user_id, reason } = req.body;

    if (!to_user_id) {
      return res.status(400).json({
        message: "to_user_id is required",
      });
    }

    if (Number(to_user_id) === Number(fromUserId)) {
      return res.status(400).json({
        message: "You cannot transfer ownership to yourself",
      });
    }

    // Check that the file belongs to the current user
    const fileResult = await client.query(
      `SELECT file_id, file_name
       FROM Files
       WHERE file_id = $1
         AND uploaded_by = $2
         AND is_deleted = FALSE`,
      [fileId, fromUserId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        message: "File not found or you are not the owner",
      });
    }

    // Check that the new owner exists
    const userResult = await client.query(
      `SELECT user_id, name, email
       FROM Users
       WHERE user_id = $1`,
      [to_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "New owner not found",
      });
    }

    await client.query("BEGIN");

    // Change file ownership
    await client.query(
      `UPDATE Files
       SET uploaded_by = $1
       WHERE file_id = $2`,
      [to_user_id, fileId]
    );

    // Record ownership transfer
    const transferResult = await client.query(
      `INSERT INTO Ownership_Transfers
        (file_id, from_user_id, to_user_id, transferred_by, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        fileId,
        fromUserId,
        to_user_id,
        fromUserId,
        reason || null,
      ]
    );

    // Record activity
    await client.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [
        fileId,
        fromUserId,
        "OWNERSHIP_TRANSFER",
        `Ownership transferred to user ${to_user_id}`,
      ]
    );

    await client.query("COMMIT");

    res.status(200).json({
      message: "File ownership transferred successfully",
      file: {
        file_id: fileResult.rows[0].file_id,
        file_name: fileResult.rows[0].file_name,
        new_owner_id: Number(to_user_id),
        new_owner_name: userResult.rows[0].name,
        new_owner_email: userResult.rows[0].email,
      },
      transfer: transferResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Ownership transfer error:", error);

    res.status(500).json({
      message: "Ownership transfer failed",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  transferOwnership,
};
