const pool = require('../config/db')
const { successResponse, errorResponse } = require('../utils/response')
const path = require('path')
const fs = require('fs')

exports.getAllDocuments = async (req, res) => {
  try {
    const { projectId, search } = req.query
    let query = `SELECT d.*, u.name AS uploader_name, p.name AS project_name
      FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN projects p ON d.project_id = p.id WHERE 1=1`
    const params = []
    if (projectId) { params.push(projectId); query += ` AND d.project_id = $${params.length}` }
    if (search) { params.push(`%${search}%`); query += ` AND d.name ILIKE $${params.length}` }
    query += ' ORDER BY d.created_at DESC'
    const result = await pool.query(query, params)
    const docs = result.rows.map(d => ({
      id: d.id, name: d.name, originalName: d.original_name,
      fileType: d.file_type, fileSize: d.file_size, url: d.url,
      description: d.description, createdAt: d.created_at,
      project: d.project_id ? { id: d.project_id, name: d.project_name } : null,
      uploadedBy: { id: d.uploaded_by, name: d.uploader_name }
    }))
    return successResponse(res, docs)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded.')
    const { description, projectId } = req.body
    const { originalname, mimetype, size, path: filePath } = req.file
    const ext = originalname.split('.').pop().toLowerCase()
    // In production: upload to Cloudinary here
    // For now: store local path
    const url = `/uploads/${req.file.filename}`
    const result = await pool.query(
      'INSERT INTO documents (name, original_name, file_type, file_size, url, description, project_id, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [originalname, originalname, ext, size, url, description, projectId || null, req.user.id]
    )
    const doc = await pool.query(
      `SELECT d.*, u.name AS uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = $1`,
      [result.rows[0].id]
    )
    return successResponse(res, doc.rows[0], 'File uploaded successfully.', 201)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

// exports.deleteDocument = async (req, res) => {
//   try {
//     const result = await pool.query('DELETE FROM documents WHERE id=$1 RETURNING id', [req.params.id])
//     if (!result.rows[0]) return errorResponse(res, 'Document not found.', 404)
//     return successResponse(res, null, 'Document deleted.')
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }


function resolveUploadPath(doc) {
  return path.join(__dirname, '..', '..', 'uploads', path.basename(doc.url))
}

exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id])
    const doc = result.rows[0]
    if (!doc) return res.status(404).json({ message: 'Document not found' })

    const filePath = resolveUploadPath(doc)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File missing on server' })
    }
    // res.download streams the file and sets Content-Disposition with the original name
    res.download(filePath, doc.original_name || doc.name)
  } catch (err) {
    res.status(500).json({ message: 'Failed to download document' })
  }
}

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'DELETE FROM documents WHERE id = $1 RETURNING *',
      [id]
    )
    const doc = result.rows[0]
    if (!doc) return res.status(404).json({ message: 'Document not found' })

    // best-effort file cleanup — DB row is already gone, so a failed unlink
    // shouldn't fail the request; just log it
    fs.unlink(resolveUploadPath(doc), (err) => {
      if (err) console.warn('Could not remove file for document', id, err.message)
    })

    res.json({ success: true, data: { id } })
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete document' })
  }
}