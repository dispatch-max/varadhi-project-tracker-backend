const pool = require('../config/db')
const { successResponse, errorResponse } = require('../utils/response')

exports.getStats = async (req, res) => {
  try {
    const [projects, tasks, members, overdue] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status='active' THEN 1 END) AS active FROM projects"),
      pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status='completed' THEN 1 END) AS completed, COUNT(CASE WHEN status='in_progress' THEN 1 END) AS in_progress FROM tasks"),
      pool.query("SELECT COUNT(*) AS total FROM users WHERE status='active'"),
      pool.query("SELECT COUNT(*) AS total FROM tasks WHERE due_date < NOW() AND status != 'completed'")
    ])
    return successResponse(res, {
      totalProjects: parseInt(projects.rows[0].total),
      activeProjects: parseInt(projects.rows[0].active),
      totalTasks: parseInt(tasks.rows[0].total),
      completedTasks: parseInt(tasks.rows[0].completed),
      inProgressTasks: parseInt(tasks.rows[0].in_progress),
      overdueTasks: parseInt(overdue.rows[0].total),
      teamMembers: parseInt(members.rows[0].total),
    })
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.getActivity = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.status, t.updated_at AS created_at,
        u.id AS user_id, u.name AS user_name
      FROM tasks t JOIN users u ON t.reporter_id = u.id
      ORDER BY t.updated_at DESC LIMIT 10
    `)
    const activity = result.rows.map(r => ({
      id: r.id,
      user: { id: r.user_id, name: r.user_name },
      message: `updated task "${r.title}" to ${r.status.replace('_', ' ')}`,
      createdAt: r.created_at
    }))
    return successResponse(res, activity)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

// exports.getBurndown = async (req, res) => {
//   try {
//     const { projectId } = req.params
//     const project = await pool.query('SELECT start_date, end_date FROM projects WHERE id=$1', [projectId])
//     if (!project.rows[0]) return errorResponse(res, 'Project not found.', 404)
//     const totalTasks = await pool.query('SELECT COUNT(*) FROM tasks WHERE project_id=$1', [projectId])
//     const total = parseInt(totalTasks.rows[0].count)
//     // Generate simple burndown data
//     const data = []
//     for (let i = 1; i <= 14; i++) {
//       const ideal = Math.max(0, total - Math.round((total / 14) * i))
//       data.push({ day: `Day ${i}`, ideal, actual: i <= 7 ? ideal + Math.floor(Math.random() * 3) : null })
//     }
//     return successResponse(res, data)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }
exports.getBurndown = async (req, res) => {
  try {
    const { projectId } = req.params

    const project = await pool.query(
      'SELECT start_date, end_date FROM projects WHERE id = $1',
      [projectId]
    )
    if (!project.rows[0]) return errorResponse(res, 'Project not found.', 404)

    const { start_date, end_date } = project.rows[0]

    // Total tasks in the project (the starting height of the burndown)
    const totalRes = await pool.query(
      'SELECT COUNT(*)::int AS total FROM tasks WHERE project_id = $1',
      [projectId]
    )
    const total = totalRes.rows[0].total

    // Build the day series + cumulative completed-by-end-of-day in one query.
    // Falls back to a 14-day window from start_date if end_date is missing.
    const series = await pool.query(
      `
      WITH bounds AS (
        SELECT
          $2::date AS start_day,
          COALESCE($3::date, $2::date + INTERVAL '13 day') AS end_day
      ),
      days AS (
        SELECT generate_series(
          (SELECT start_day FROM bounds),
          (SELECT end_day   FROM bounds),
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        d.day,
        (
          SELECT COUNT(*)::int
          FROM tasks t
          WHERE t.project_id = $1
            AND t.completed_at IS NOT NULL
            AND t.completed_at::date <= d.day
        ) AS completed_by_day
      FROM days d
      ORDER BY d.day
      `,
      [projectId, start_date, end_date]
    )

    const rows = series.rows
    const span = Math.max(rows.length - 1, 1) // avoid divide-by-zero
    const today = new Date()

    const data = rows.map((row, i) => {
      const ideal = Math.max(0, Math.round(total - (total / span) * i))
      const isFuture = new Date(row.day) > today
      return {
        day: `Day ${i + 1}`,
        ideal,
        // real remaining = total - completed by that day; null for future days
        actual: isFuture ? null : Math.max(0, total - row.completed_by_day),
      }
    })

    return successResponse(res, data)
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}