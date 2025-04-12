import { Router, Request, Response } from 'express'
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} from '../controllers/projects'
import { auth } from '../lib/auth'

const router = Router()

// Get all projects with filtering
router.get('/', async (req: Request, res: Response) => {
  await getProjects(req, res)
})

// Get single project by ID
router.get('/:id', async (req: Request, res: Response) => {
  await getProject(req, res)
})

// Create new project
router.post('/', async (req: Request, res: Response) => {
  await createProject(req, res)
})

// Update project
router.put('/:id', async (req: Request, res: Response) => {
  await updateProject(req, res)
})

// Delete project
router.delete('/:id', async (req: Request, res: Response) => {
  await deleteProject(req, res)
})

export default router
