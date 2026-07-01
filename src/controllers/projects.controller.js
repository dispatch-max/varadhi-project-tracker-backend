const pool = require('../config/db')
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response')

const getProjectWithDetails = async (projectId) => {
  const project = await pool.query(`
    SELECT p.*, u.id AS manager_id, u.name AS manager_name, u.email AS manager_email
    FROM projects p LEFT JOIN users u ON p.manager_id = u.id
    WHERE p.id = $1
  `, [projectId])
  if (!project.rows[0]) return null
  const members = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, u.avatar
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = $1
  `, [projectId])
  const taskCounts = await pool.query(`
    SELECT COUNT(*) AS total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
    FROM tasks WHERE project_id = $1
  `, [projectId])
  const p = project.rows[0]
  return {
    id: p.id, name: p.name, description: p.description,
    status: p.status, startDate: p.start_date, endDate: p.end_date,
    createdAt: p.created_at, updatedAt: p.updated_at,
    manager: p.manager_id ? { id: p.manager_id, name: p.manager_name, email: p.manager_email } : null,
    members: members.rows,
    tasksCount: parseInt(taskCounts.rows[0].total),
    completedTasksCount: parseInt(taskCounts.rows[0].completed),
    progress: taskCounts.rows[0].total > 0
      ? Math.round((taskCounts.rows[0].completed / taskCounts.rows[0].total) * 100) : 0
  }
}

exports.getAllProjects = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query
    let countQ = 'SELECT COUNT(*) FROM projects WHERE 1=1'
    let dataQ = `SELECT p.id FROM projects p WHERE 1=1`
    const params = []
    if (status) { params.push(status); countQ += ` AND status = $${params.length}`; dataQ += ` AND p.status = $${params.length}` }
    if (search) { params.push(`%${search}%`); countQ += ` AND name ILIKE $${params.length}`; dataQ += ` AND p.name ILIKE $${params.length}` }
    const countResult = await pool.query(countQ, params)
    const total = parseInt(countResult.rows[0].count)
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit))
    dataQ += ` ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`
    const ids = await pool.query(dataQ, params)
    const projects = await Promise.all(ids.rows.map(r => getProjectWithDetails(r.id)))
    return paginatedResponse(res, projects, total, page, limit)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.getProjectById = async (req, res) => {
  try {
    const project = await getProjectWithDetails(req.params.id)
    if (!project) return errorResponse(res, 'Project not found.', 404)
    return successResponse(res, project)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.createProject = async (req, res) => {
  try {
    const { name, description, managerId, memberIds, startDate, endDate } = req.body
    if (!name) return errorResponse(res, 'Project name is required.')
    const result = await pool.query(
      'INSERT INTO projects (name, description, manager_id, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name, description, managerId || req.user.id, startDate, endDate]
    )
    const projectId = result.rows[0].id
    // Add manager as member
    await pool.query('INSERT INTO project_members VALUES ($1,$2) ON CONFLICT DO NOTHING', [projectId, managerId || req.user.id])
    // Add other members
    if (memberIds?.length) {
      for (const uid of memberIds) {
        await pool.query('INSERT INTO project_members VALUES ($1,$2) ON CONFLICT DO NOTHING', [projectId, uid])
      }
    }
    const project = await getProjectWithDetails(projectId)
    return successResponse(res, project, 'Project created successfully.', 201)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.updateProject = async (req, res) => {
  try {
    const { name, description, status, startDate, endDate } = req.body
    const result = await pool.query(
      'UPDATE projects SET name=COALESCE($1,name), description=COALESCE($2,description), status=COALESCE($3,status), start_date=COALESCE($4,start_date), end_date=COALESCE($5,end_date), updated_at=NOW() WHERE id=$6 RETURNING id',
      [name, description, status, startDate, endDate, req.params.id]
    )
    if (!result.rows[0]) return errorResponse(res, 'Project not found.', 404)
    const project = await getProjectWithDetails(req.params.id)
    return successResponse(res, project, 'Project updated successfully.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.archiveProject = async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE projects SET status='archived', updated_at=NOW() WHERE id=$1 RETURNING id",
      [req.params.id]
    )
    if (!result.rows[0]) return errorResponse(res, 'Project not found.', 404)
    return successResponse(res, null, 'Project archived.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.deleteProject = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING id', [req.params.id])
    if (!result.rows[0]) return errorResponse(res, 'Project not found.', 404)
    return successResponse(res, null, 'Project deleted.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.addMember = async (req, res) => {
  try {
    const { userId } = req.body
    await pool.query('INSERT INTO project_members VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, userId])
    return successResponse(res, null, 'Member added.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.removeMember = async (req, res) => {
  try {
    await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.params.userId])
    return successResponse(res, null, 'Member removed.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}
