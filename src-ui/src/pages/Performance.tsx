import React, { useEffect, useMemo, useState } from 'react'
import './Dashboard.css'
import { useAppStore } from '../store/appStore'
import { listProjectTasks } from '../ipc/taskCommands'

interface UITask {
  task_id: string
  type: string
  capability: string
  status: string
  oneshot_count?: number
  last_agent?: string
  last_agent_key_hint?: string
  modified?: boolean
}

export default function Performance() {
  const { projects } = useAppStore()
  const [tasksByProject, setTasksByProject] = useState<Record<string, UITask[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      const entries: Record<string, UITask[]> = {}
      for (const p of projects) {
        try {
          const res = await listProjectTasks(p.id)
          if (res.ok) entries[p.id] = (res.tasks as unknown as UITask[])
        } catch {}
      }
      setTasksByProject(entries)
      setLoading(false)
    }
    loadAll()
  }, [projects])

  const metrics = useMemo(() => {
    const perProject: Record<string, { accepted: number; corrected: number; rejected: number }> = {}
    const perCapability: Record<string, { accepted: number; corrected: number; rejected: number }> = {}
    const perAgent: Record<string, { accepted: number; corrected: number; rejected: number }> = {}

    const inc = (bucket: Record<string, { accepted: number; corrected: number; rejected: number }>, key: string, field: 'accepted' | 'corrected' | 'rejected') => {
      if (!bucket[key]) bucket[key] = { accepted: 0, corrected: 0, rejected: 0 }
      bucket[key][field]++
    }

    for (const [projectId, tasks] of Object.entries(tasksByProject)) {
      if (!perProject[projectId]) perProject[projectId] = { accepted: 0, corrected: 0, rejected: 0 }
      for (const t of tasks) {
        const accepted = t.status === 'completed' && (t.oneshot_count ?? 0) > 0
        const rejected = t.status === 'failed'
        const corrected = t.status === 'completed' && !accepted

        if (accepted) inc(perProject, projectId, 'accepted')
        else if (corrected) inc(perProject, projectId, 'corrected')
        else if (rejected) inc(perProject, projectId, 'rejected')

        const capKey = t.capability || 'unknown'
        if (accepted) inc(perCapability, capKey, 'accepted')
        else if (corrected) inc(perCapability, capKey, 'corrected')
        else if (rejected) inc(perCapability, capKey, 'rejected')

        // Per agent should be aggregated by API key hint (provider), not agent name
        const agentKey = t.last_agent_key_hint || 'unknown'
        if (accepted) inc(perAgent, agentKey, 'accepted')
        else if (corrected) inc(perAgent, agentKey, 'corrected')
        else if (rejected) inc(perAgent, agentKey, 'rejected')
      }
    }

    return { perProject, perCapability, perAgent }
  }, [tasksByProject])

  const renderTable = (title: string, data: Record<string, { accepted: number; corrected: number; rejected: number }>) => (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-content">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Accepted</th>
              <th>Corrected</th>
              <th>Rejected</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v.accepted}</td>
                <td>{v.corrected}</td>
                <td>{v.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Performance</h2>
        {loading && <span className="subtle">Loading metrics…</span>}
      </div>
      <div className="grid grid-2">
        {renderTable('Per Project', metrics.perProject)}
        {renderTable('Per Capability', metrics.perCapability)}
        {renderTable('Per Agent', metrics.perAgent)}
      </div>
    </div>
  )
}


