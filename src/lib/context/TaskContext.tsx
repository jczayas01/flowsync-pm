"use client"
// src/lib/context/TaskContext.tsx
// Shared task state between Tasks tab and Gantt tab
// Enables real-time sync: edit in Tasks → reflects in Gantt instantly

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface TaskContextValue {
  // Optimistic task updates — key: taskId, value: partial task data
  localUpdates:  Map<string, Partial<any>>
  selectedTaskId: string | null

  // Update a task optimistically (before server confirms)
  updateTask: (taskId: string, patch: Partial<any>) => void

  // Clear optimistic update (after server confirms)
  clearUpdate: (taskId: string) => void

  // Select a task (syncs highlight between Tasks and Gantt)
  selectTask: (taskId: string | null) => void

  // Apply local updates to a task array
  applyUpdates: (tasks: any[]) => any[]
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [localUpdates,   setLocalUpdates]   = useState<Map<string, Partial<any>>>(new Map())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const updateTask = useCallback((taskId: string, patch: Partial<any>) => {
    setLocalUpdates(m => {
      const n = new Map(m)
      n.set(taskId, { ...(n.get(taskId) || {}), ...patch })
      return n
    })
  }, [])

  const clearUpdate = useCallback((taskId: string) => {
    setLocalUpdates(m => {
      const n = new Map(m)
      n.delete(taskId)
      return n
    })
  }, [])

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId)
  }, [])

  const applyUpdates = useCallback((tasks: any[]) => {
    if (localUpdates.size === 0) return tasks
    return tasks.map(t => {
      const patch = localUpdates.get(t.id)
      return patch ? { ...t, ...patch } : t
    })
  }, [localUpdates])

  return (
    <TaskContext.Provider value={{ localUpdates, selectedTaskId, updateTask, clearUpdate, selectTask, applyUpdates }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTaskContext() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error("useTaskContext must be used within TaskProvider")
  return ctx
}

export function useTaskContextSafe() {
  return useContext(TaskContext)
}
