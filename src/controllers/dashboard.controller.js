const pool = require('../config/db')
const { successResponse, errorResponse } = require('../utils/response')

exports.getStats = async (req, res) => {
  try {
    const isEmployee = req.user.role.toLowerCase() === 'employee'

    let projectsQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status='active' THEN 1 END) AS active
      FROM projects
    `

    let tasksQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status='completed' THEN 1 END) AS completed,
        COUNT(CASE WHEN status='in_progress' THEN 1 END) AS in_progress
      FROM tasks
    `

    let overdueQuery = `
      SELECT COUNT(*) AS total
      FROM tasks
      WHERE due_date < NOW()
      AND status != 'completed'
    `

    let projectParams = []
    let taskParams = []
    let overdueParams = []

    // Employee dashboard → only assigned tasks
    if (isEmployee) {

      projectsQuery = `
        SELECT
          COUNT(DISTINCT p.id) AS total,
          COUNT(DISTINCT CASE WHEN p.status='active' THEN p.id END) AS active
        FROM projects p
        JOIN tasks t ON t.project_id = p.id
        WHERE t.assignee_id = $1
      `

      tasksQuery += `
        WHERE assignee_id = $1
      `

      overdueQuery += `
        AND assignee_id = $1
      `

      projectParams = [req.user.id]
      taskParams = [req.user.id]
      overdueParams = [req.user.id]
    }

    const [projects, tasks, members, overdue] = await Promise.all([
      pool.query(projectsQuery, projectParams),
      pool.query(tasksQuery, taskParams),
      pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE status='active'"
      ),
      pool.query(overdueQuery, overdueParams)
    ])

    return successResponse(res, {
      totalProjects: Number(projects.rows[0].total),
      activeProjects: Number(projects.rows[0].active),
      totalTasks: Number(tasks.rows[0].total),
      completedTasks: Number(tasks.rows[0].completed),
      inProgressTasks: Number(tasks.rows[0].in_progress),
      overdueTasks: Number(overdue.rows[0].total),
      teamMembers: Number(members.rows[0].total),
    })

  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}




exports.getActivity = async (req, res) => {
  try {

    const isEmployee = req.user.role.toLowerCase() === 'employee'

    let query = `
      SELECT
        t.id,
        t.title,
        t.status,
        t.updated_at AS created_at,
        u.id AS user_id,
        u.name AS user_name
      FROM tasks t
      JOIN users u
        ON t.reporter_id = u.id
    `

    const params = []

    // Employee -> only assigned tasks activity
    if (isEmployee) {
      query += `
        WHERE t.assignee_id = $1
      `
      params.push(req.user.id)
    }

    query += `
      ORDER BY t.updated_at DESC
      LIMIT 10
    `

    const result = await pool.query(query, params)

    const activity = result.rows.map(r => ({
      id: r.id,
      user: {
        id: r.user_id,
        name: r.user_name
      },
      message: `updated task "${r.title}" to ${r.status.replace('_', ' ')}`,
      createdAt: r.created_at
    }))

    return successResponse(res, activity)

  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}



exports.getProjectProgress = async (req, res) => {
  try {

    const isEmployee = req.user.role.toLowerCase() === 'employee'

    let query = `
      SELECT
        p.id,
        p.name,
        p.status,
        u.name AS manager_name,
        COUNT(t.id)::int AS "tasksCount",
        COUNT(
          CASE
            WHEN t.status='completed'
            THEN 1
          END
        )::int AS "completedTasksCount"
      FROM projects p
      LEFT JOIN tasks t
        ON t.project_id = p.id
      LEFT JOIN users u
        ON p.manager_id = u.id
    `

    const params = []

    if (isEmployee) {
      query += `
        WHERE p.id IN (
          SELECT DISTINCT project_id
          FROM tasks
          WHERE assignee_id = $1
        )
      `
      params.push(req.user.id)
    }

    query += `
      GROUP BY
        p.id,
        p.name,
        p.status,
        u.name
      ORDER BY
        p.created_at DESC
    `

    const result = await pool.query(query, params)

    return successResponse(res, result.rows)

  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}


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