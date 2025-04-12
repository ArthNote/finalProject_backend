import { Project, ProjectMember, Task } from '@prisma/client'

export type ProjectWithDetails = Project & {
  owner: {
    id: string
    name: string
    image: string | null
  }
  members: (ProjectMember & {
    user: {
      id: string
      name: string
      image: string | null
    }
  })[]
  tasks: Task[]
}

export interface CreateProjectDTO {
  name: string
  description: string
  status?: string
  priority?: string
  startDate?: Date
  endDate?: Date
  tags?: string[]
  category?: string
}

export interface UpdateProjectDTO extends Partial<CreateProjectDTO> {
  progress?: number
}

export interface ProjectQuery {
  search?: string
  status?: string
  ownerId?: string
  memberId?: string
  tags?: string[]
  priority?: string
  sortBy?: 'updatedAt' | 'endDate' | 'name'
  sortOrder?: 'asc' | 'desc'
}