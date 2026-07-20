const pool = require('../config/db')
const { successResponse, errorResponse } = require('../utils/response')

// GET /api/folders — list folders with document counts (all roles)
exports.getAllFolders = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.id, f.name, f.created_at,
             u.name AS created_by_name,
             COUNT(d.id)::int AS documents_count
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      LEFT JOIN documents d ON d.folder_id = f.id
      GROUP BY f.id, f.name, f.created_at, u.name
      ORDER BY f.name ASC
    `)
    const folders = result.rows.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.created_at,
      createdBy: f.created_by_name || null,
      documentsCount: f.documents_count,
    }))
    return successResponse(res, folders)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

// POST /api/folders — create (admin/manager via route restrictTo)
exports.createFolder = async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) return errorResponse(res, 'Folder name is required.')
    const trimmed = name.trim()

    const exists = await pool.query('SELECT id FROM folders WHERE LOWER(name) = LOWER($1)', [trimmed])
    if (exists.rows[0]) return errorResponse(res, 'A folder with this name already exists.')

    const result = await pool.query(
      `INSERT INTO folders (name, created_by) VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [trimmed, req.user.id]
    )
    const f = result.rows[0]
    return successResponse(
      res,
      { id: f.id, name: f.name, createdAt: f.created_at, documentsCount: 0 },
      'Folder created successfully.',
      201
    )
  } catch (err) { return errorResponse(res, err.message, 500) }
}

// PATCH /api/folders/:id — rename (admin/manager)
exports.renameFolder = async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) return errorResponse(res, 'Folder name is required.')
    const trimmed = name.trim()

    const exists = await pool.query(
      'SELECT id FROM folders WHERE LOWER(name) = LOWER($1) AND id != $2',
      [trimmed, req.params.id]
    )
    if (exists.rows[0]) return errorResponse(res, 'A folder with this name already exists.')

    const result = await pool.query(
      `UPDATE folders SET name = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, name`,
      [trimmed, req.params.id]
    )
    if (!result.rows[0]) return errorResponse(res, 'Folder not found.', 404)
    return successResponse(res, result.rows[0], 'Folder renamed successfully.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

// DELETE /api/folders/:id — delete folder; documents are KEPT and unfiled
// (documents.folder_id has ON DELETE SET NULL, so no document is ever lost)
exports.deleteFolder = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM folders WHERE id = $1 RETURNING id',
      [req.params.id]
    )
    if (!result.rows[0]) return errorResponse(res, 'Folder not found.', 404)
    return successResponse(res, { id: req.params.id }, 'Folder deleted. Its documents were moved to All Files.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}