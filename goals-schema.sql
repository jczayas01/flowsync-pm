// FlowSync PM — Core TypeScript Types
// Mirrors the Prisma schema for use throughout the app

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type Methodology = 'WATERFALL' | 'AGILE' | 'SCRUM'
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
export type ProjectHealth = 'GREEN' | 'AMBER' | 'RED'
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type PhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'SKIPPED'
export type MilestoneStatus = 'UPCOMING' | 'ACHIEVED' | 'MISSED' | 'AT_RISK'
export type RiskStatus = 'OPEN' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED' | 'TRIGGERED'
export type RiskProbability = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
export type RiskImpact = 'NEGLIGIBLE' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL'
export type ChangeStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED'
export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'PM' | 'MEMBER' | 'VIEWER' | 'CLIENT'
export type Plan = 'FREE' | 'PRO' | 'CONSULTANT' | 'BUSINESS' | 'ENTERPRISE'
export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'REVIEW' | 'COMPLETED' | 'CANCELLED'
export type BudgetCategory = 'LABOR' | 'MATERIALS' | 'EQUIPMENT' | 'TRAVEL' | 'SOFTWARE' | 'CONSULTING' | 'CONTINGENCY' | 'OTHER'

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  timezone: string
  locale: string
  currency: string
  isActive: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CurrentUser extends User {
  workspaces: WorkspaceSummary[]
  activeWorkspaceId?: string
}

// ─────────────────────────────────────────────
// WORKSPACE
// ─────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: Plan
  logoUrl?: string
  primaryColor: string
  accentColor: string
  defaultTimezone: string
  defaultCurrency: string
  ssoEnabled: boolean
  seats: number
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
  plan: Plan
  logoUrl?: string
  primaryColor: string
  role: UserRole
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: UserRole
  joinedAt: Date
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
}

// ─────────────────────────────────────────────
// PROJECT
// ─────────────────────────────────────────────

export interface Project {
  id: string
  workspaceId: string
  code: string
  name: string
  description?: string
  methodology: Methodology
  status: ProjectStatus
  health: ProjectHealth
  startDate?: Date
  endDate?: Date
  actualEnd?: Date
  budgetTotal: number
  budgetSpent: number
  currency: string
  percentComplete: number
  timezone: string
  createdAt: Date
  updatedAt: Date
  // Relations
  createdBy?: Pick<User, 'id' | 'name' | 'avatarUrl'>
  members?: ProjectMember[]
  _count?: {
    tasks: number
    risks: number
    milestones: number
  }
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: UserRole
  allocation: number
  joinedAt: Date
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
}

// ─────────────────────────────────────────────
// PHASE (Waterfall)
// ─────────────────────────────────────────────

export interface Phase {
  id: string
  projectId: string
  name: string
  description?: string
  order: number
  status: PhaseStatus
  plannedStart?: Date
  plannedEnd?: Date
  actualStart?: Date
  actualEnd?: Date
  gateApproved: boolean
  gateApprovedBy?: string
  gateApprovedAt?: Date
  gateNotes?: string
  color?: string
  createdAt: Date
  updatedAt: Date
  tasks?: Task[]
}

// ─────────────────────────────────────────────
// TASK
// ─────────────────────────────────────────────

export interface Task {
  id: string
  projectId: string
  phaseId?: string
  sprintId?: string
  parentId?: string
  code: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  startDate?: Date
  dueDate?: Date
  completedAt?: Date
  estimatedHours?: number
  actualHours?: number
  remainingHours?: number
  storyPoints?: number
  percentComplete: number
  isCriticalPath: boolean
  ownerId?: string
  createdAt: Date
  updatedAt: Date
  // Relations
  owner?: Pick<User, 'id' | 'name' | 'avatarUrl'>
  assignees?: ProjectMember[]
  subtasks?: Task[]
  dependencies?: TaskDependency[]
  _count?: { subtasks: number; comments: number }
}

export interface TaskDependency {
  id: string
  dependentTaskId: string
  precedingTaskId: string
  dependencyType: 'FS' | 'SS' | 'FF' | 'SF'
  lagDays: number
}

// ─────────────────────────────────────────────
// MILESTONE
// ─────────────────────────────────────────────

export interface Milestone {
  id: string
  projectId: string
  name: string
  description?: string
  dueDate: Date
  achievedAt?: Date
  status: MilestoneStatus
  color: string
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────
// BASELINE
// ─────────────────────────────────────────────

export interface Baseline {
  id: string
  projectId: string
  name: string
  description?: string
  snapshotData: BaselineSnapshot
  budgetTotal: number
  startDate: Date
  endDate: Date
  createdById: string
  createdAt: Date
}

export interface BaselineSnapshot {
  tasks: Array<{ id: string; title: string; startDate?: string; dueDate?: string; percentComplete: number }>
  budget: { total: number; categories: Record<string, number> }
  schedule: { startDate: string; endDate: string; percentComplete: number }
  milestones: Array<{ id: string; name: string; dueDate: string }>
}

// ─────────────────────────────────────────────
// RISK
// ─────────────────────────────────────────────

export interface Risk {
  id: string
  projectId: string
  code: string
  title: string
  description?: string
  category?: string
  probability: RiskProbability
  impact: RiskImpact
  score: number // 1–25
  status: RiskStatus
  ownerId?: string
  mitigationPlan?: string
  contingencyPlan?: string
  identifiedAt: Date
  reviewDate?: Date
  closedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────
// CHANGE REQUEST
// ─────────────────────────────────────────────

export interface ChangeRequest {
  id: string
  projectId: string
  code: string
  title: string
  description?: string
  scheduleImpact?: string
  budgetImpact?: number
  scopeImpact?: string
  qualityImpact?: string
  status: ChangeStatus
  priority: TaskPriority
  requestedById: string
  approvedById?: string
  approvedAt?: Date
  implementedAt?: Date
  rejectedReason?: string
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────
// BUDGET
// ─────────────────────────────────────────────

export interface BudgetItem {
  id: string
  projectId: string
  category: BudgetCategory
  name: string
  description?: string
  plannedCost: number
  actualCost: number
  earnedValue: number
  currency: string
  periodStart?: Date
  periodEnd?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// Earned Value Metrics
export interface EVMMetrics {
  budgetAtCompletion: number    // BAC
  plannedValue: number          // PV
  earnedValue: number           // EV
  actualCost: number            // AC
  costVariance: number          // CV = EV - AC
  scheduleVariance: number      // SV = EV - PV
  costPerformanceIndex: number  // CPI = EV / AC
  schedulePerformanceIndex: number // SPI = EV / PV
  estimateAtCompletion: number  // EAC = BAC / CPI
  estimateToComplete: number    // ETC = EAC - AC
  varianceAtCompletion: number  // VAC = BAC - EAC
}

// ─────────────────────────────────────────────
// SPRINT (Scrum)
// ─────────────────────────────────────────────

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal?: string
  status: SprintStatus
  startDate: Date
  endDate: Date
  plannedPoints?: number
  completedPoints?: number
  retroNotes?: string
  createdAt: Date
  updatedAt: Date
  tasks?: Task[]
}

// ─────────────────────────────────────────────
// STATUS UPDATE / REPORT
// ─────────────────────────────────────────────

export interface StatusUpdate {
  id: string
  projectId: string
  type: string
  periodStart: Date
  periodEnd: Date
  health: ProjectHealth
  summary?: string
  accomplishments?: string
  nextSteps?: string
  risks?: string
  issues?: string
  budgetPlanned?: number
  budgetActual?: number
  percentComplete?: number
  scheduledEnd?: Date
  forecastEnd?: Date
  aiGenerated: boolean
  createdById: string
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────
// GANTT (computed view types)
// ─────────────────────────────────────────────

export interface GanttRow {
  id: string
  type: 'phase' | 'task' | 'milestone'
  title: string
  startDate: Date
  endDate: Date
  percentComplete: number
  status: PhaseStatus | TaskStatus | MilestoneStatus
  isCriticalPath?: boolean
  parentId?: string
  depth: number
  assignees?: Pick<User, 'id' | 'name' | 'avatarUrl'>[]
  dependencies?: string[] // IDs of preceding items
}

export interface GanttViewport {
  startDate: Date
  endDate: Date
  zoom: 'day' | 'week' | 'month' | 'quarter'
  today: Date
}

// ─────────────────────────────────────────────
// DASHBOARD (aggregated view)
// ─────────────────────────────────────────────

export interface DashboardStats {
  activeProjects: number
  tasksOverdue: number
  upcomingMilestones: number
  openRisks: number
  budgetUtilization: number // percentage
  teamMembers: number
}

export interface ProjectCard {
  id: string
  code: string
  name: string
  methodology: Methodology
  status: ProjectStatus
  health: ProjectHealth
  percentComplete: number
  endDate?: Date
  budgetTotal: number
  budgetSpent: number
  tasksOverdue: number
  openRisks: number
  members: Pick<User, 'id' | 'name' | 'avatarUrl'>[]
}

// ─────────────────────────────────────────────
// API RESPONSE WRAPPERS
// ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    perPage?: number
    totalPages?: number
  }
}

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, string[]>
}

// ─────────────────────────────────────────────
// FORM TYPES
// ─────────────────────────────────────────────

export interface CreateProjectInput {
  name: string
  description?: string
  methodology: Methodology
  startDate?: string
  endDate?: string
  budgetTotal?: number
  currency?: string
  templateId?: string
  teamMembers?: Array<{ email: string; role: UserRole }>
}

export interface CreateTaskInput {
  title: string
  description?: string
  phaseId?: string
  sprintId?: string
  parentId?: string
  priority?: TaskPriority
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  storyPoints?: number
  assigneeIds?: string[]
}

export interface CreateRiskInput {
  title: string
  description?: string
  category?: string
  probability: RiskProbability
  impact: RiskImpact
  ownerId?: string
  mitigationPlan?: string
  contingencyPlan?: string
  reviewDate?: string
}
