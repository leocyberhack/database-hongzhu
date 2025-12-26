import { create } from 'zustand'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import type { AuditLog } from '../types'

interface AuditLogState {
  logs: AuditLog[]
  hydrate: (items: AuditLog[]) => void
  addLog: (log: Omit<AuditLog, 'id' | 'operated_at'> & { operated_at?: string }) => void
}

export const useAuditLogStore = create<AuditLogState>((set, get) => ({
  logs: [],
  hydrate: (items) => set({ logs: items }),
  addLog: (log) =>
    set({
      logs: [
        {
          ...log,
          id: nanoid(8),
          operated_at: log.operated_at ?? dayjs().toISOString(),
        },
        ...get().logs,
      ],
    }),
}))
