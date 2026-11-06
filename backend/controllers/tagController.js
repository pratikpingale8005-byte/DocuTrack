const pool = require("../config/db");

const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};

const userCanViewFile = async (fileId, userId) => {
  const result = await pool.query(
    `SELECT f.file_id
     FROM Files f
     LEFT JOIN Shared_Access sa
       ON f.file_id = sa.file_id
      AND sa.shared_with = $2
     WHERE f.file_id = $1
       AND (
         f.uploaded_by = $2
         OR (f.is_deleted = FALSE AND sa.share_id IS NOT NULL)
       )
     LIMIT 1`,
    [fileId, userId]
  );

  return result.rows.length > 0;
};

const userCanManageFileTags = async (fileId, userId) => {
  const result = await pool.query(
    `SELECT file_id
     FROM Files
     WHERE file_id = $1
       AND uploaded_by = $2
       AND is_deleted = FALSE
     LIMIT 1`,
    [fileId, userId]
  );

  return result.rows.length > 0;
};

const createTag = async (req, res) => {
  try {
    const tagName = req.body.tag_name
      ? req.body.tag_name.trim()
      : "";

    if (!tagName) {
      return res.status(400).json({
        message: "tag_name is required",
      });
    }

    if (tagName.length > 50) {
      return res.status(400).json({
        message: "tag_name must be 50 characters or less",
      });
    }

    const existingTag = await pool.query(
      `SELECT tag_id, tag_name
       FROM Tags
       WHERE LOWER(tag_name) = LOWER($1)
       LIMIT 1`,
      [tagName]
    );

    if (existingTag.rows.length > 0) {
      return res.status(409).json({
        message: "Tag already exists",
        tag: existingTag.rows[0],
      });
    }

    const result = await pool.query(
      `INSERT INTO Tags (tag_name)
       VALUES ($1)
       RETURNING tag_id, tag_name`,
      [tagName]
    );

    res.status(201).json({
      message: "Tag created successfully",
      tag: result.rows[0],
    });
  } catch (error) {
    console.error("Create tag error:", error);

    res.status(500).json({
      message: "Failed to create tag",
    });
  }
};

const getTags = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tag_id, tag_name
       FROM Tags
       ORDER BY tag_name ASC`
    );

    res.json({
      message: "Tags retrieved successfully",
      tags: result.rows,
    });
  } catch (error) {
    console.error("Get tags error:", error);

    res.status(500).json({
      message: "Failed to retrieve tags",
    });
  }
};

const addTagToFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.user_id;
    const { tag_id } = req.body;

    if (!isPositiveInteger(fileId)) {
      return res.status(400).json({
        message: "Invalid file ID",
      });
    }

    if (!isPositiveInteger(tag_id)) {
      return res.status(400).json({
        message: "Invalid tag ID",
      });
    }

    const canManage = await userCanManageFileTags(fileId, userId);

    if (!canManage) {
      return res.status(403).json({
        message: "You do not have permission to manage tags for this file",
      });
    }

    const tagResult = await pool.query(
      `SELECT tag_id, tag_name
       FROM Tags
       WHERE tag_id = $1`,
      [tag_id]
    );

    if (tagResult.rows.length === 0) {
      return res.status(404).json({
        message: "Tag not found",
      });
    }

    const existingTag = await pool.query(
      `SELECT file_id, tag_id
       FROM File_Tags
       WHERE file_id = $1
         AND tag_id = $2`,
      [fileId, tag_id]
    );

    if (existingTag.rows.length > 0) {
      return res.status(409).json({
        message: "Tag is already assigned to this file",
      });
    }

    await pool.query(
      `INSERT INTO File_Tags (file_id, tag_id)
       VALUES ($1, $2)`,
      [fileId, tag_id]
    );

    await pool.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [
        fileId,
        userId,
        "ADD_TAG",
        `Tag added: ${tagResult.rows[0].tag_name}`,
      ]
    );

    res.status(201).json({
      message: "Tag added to file successfully",
      tag: tagResult.rows[0],
    });
  } catch (error) {
    console.error("Add tag to file error:", error);

    res.status(500).json({
      message: "Failed to add tag to file",
    });
  }
};

const removeTagFromFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const tagId = req.params.tagId;
    const userId = req.user.user_id;

    if (!isPositiveInteger(fileId)) {
      return res.status(400).json({
        message: "Invalid file ID",
      });
    }

    if (!isPositiveInteger(tagId)) {
      return res.status(400).json({
        message: "Invalid tag ID",
      });
    }

    const canManage = await userCanManageFileTags(fileId, userId);

    if (!canManage) {
      return res.status(403).json({
        message: "You do not have permission to manage tags for this file",
      });
    }

    const result = await pool.query(
      `DELETE FROM File_Tags
       WHERE file_id = $1
         AND tag_id = $2
       RETURNING tag_id`,
      [fileId, tagId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Tag assignment not found",
      });
    }

    await pool.query(
      `INSERT INTO Activity_Log
        (file_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [fileId, userId, "REMOVE_TAG", `Tag removed: ${tagId}`]
    );

    res.json({
      message: "Tag removed from file successfully",
    });
  } catch (error) {
    console.error("Remove tag from file error:", error);

    res.status(500).json({
      message: "Failed to remove tag from file",
    });
  }
};

const getFileTags = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.user_id;

    if (!isPositiveInteger(fileId)) {
      return res.status(400).json({
        message: "Invalid file ID",
      });
    }

    const canView = await userCanViewFile(fileId, userId);

    if (!canView) {
      return res.status(403).json({
        message: "You do not have permission to view tags for this file",
      });
    }

    const result = await pool.query(
      `SELECT t.tag_id, t.tag_name
       FROM File_Tags ft
       JOIN Tags t
         ON ft.tag_id = t.tag_id
       WHERE ft.file_id = $1
       ORDER BY t.tag_name ASC`,
      [fileId]
    );

    res.json({
      message: "File tags retrieved successfully",
      tags: result.rows,
    });
  } catch (error) {
    console.error("Get file tags error:", error);

    res.status(500).json({
      message: "Failed to retrieve file tags",
    });
  }
};

module.exports = {
  createTag,
  getTags,
  addTagToFile,
  removeTagFromFile,
  getFileTags,
};
