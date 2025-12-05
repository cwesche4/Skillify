export interface Automation {
  id: string
  name: string
  status: "ACTIVE" | "INACTIVE" | "PAUSED"
  createdAt: Date
}
