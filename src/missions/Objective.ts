export type ObjectiveStatus = 'inactive' | 'active' | 'complete' | 'failed'

export interface Objective {
  id: string
  description: string
  status: ObjectiveStatus
  optional: boolean
}
