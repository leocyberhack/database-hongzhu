import { create } from 'zustand'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import type { Approval } from '../types'

interface ApprovalsState {
  approvals: Approval[]
  hydrate: (items: Approval[]) => void
  submit: (payload: Omit<Approval, 'id' | 'status' | 'applied_at' | 'decided_at'>) => Approval
  decide: (id: string, status: Approval['status'], comment?: string) => void
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  approvals: [],
  hydrate: (items) => set({ approvals: items }),
  submit: (payload) => {
    const approval: Approval = {
      ...payload,
      id: nanoid(8),
      status: '待审批',
      applied_at: dayjs().toISOString(),
    }
    set({ approvals: [approval, ...get().approvals] })
    return approval
  },
  decide: (id, status, comment) => {
    set({
      approvals: get().approvals.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              comment,
              decided_at: dayjs().toISOString(),
            }
          : item,
      ),
    })
  },
}))
