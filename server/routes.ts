import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { z } from "zod";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// CORS middleware
const setCORSHeaders = (res: any) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
};

// Auth middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  setCORSHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    console.log('JWT verification failed:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Health endpoint
  app.get('/api/health', (req, res) => {
    setCORSHeaders(res);
    res.json({ status: 'ok' });
  });

  app.get('/health', (req, res) => {
    setCORSHeaders(res);
    res.json({ status: 'ok' });
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    setCORSHeaders(res);
    console.log('Login attempt:', req.body.email);
    
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log('User not found:', email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const passwordMatch = bcryptjs.compareSync(password, user.password);
      if (!passwordMatch) {
        console.log('Password mismatch for user:', email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        console.log('Tenant not found for user:', email);
        return res.status(500).json({ message: 'Tenant not found' });
      }

      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        tenantSlug: tenant.slug
      }, JWT_SECRET, { expiresIn: '7d' });

      console.log('Login successful for:', email);
      res.json({ token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Seed endpoint
  app.post('/api/auth/seed', async (req, res) => {
    setCORSHeaders(res);
    console.log('Seeding database...');
    
    try {
      // Create tenants
      let acmeTenant = await storage.getTenantBySlug('acme');
      if (!acmeTenant) {
        acmeTenant = await storage.createTenant({
          name: 'ACME Corp',
          slug: 'acme',
          plan: 'free'
        });
        console.log('Created ACME tenant');
      }

      let globexTenant = await storage.getTenantBySlug('globex');
      if (!globexTenant) {
        globexTenant = await storage.createTenant({
          name: 'Globex Inc',
          slug: 'globex',
          plan: 'free'
        });
        console.log('Created Globex tenant');
      }

      // Create users
      const usersToCreate = [
        { email: 'admin@acme.test', password: 'password', role: 'admin', tenantId: acmeTenant.id },
        { email: 'user@acme.test', password: 'password', role: 'member', tenantId: acmeTenant.id },
        { email: 'admin@globex.test', password: 'password', role: 'admin', tenantId: globexTenant.id },
        { email: 'user@globex.test', password: 'password', role: 'member', tenantId: globexTenant.id },
      ];

      for (const userData of usersToCreate) {
        const existingUser = await storage.getUserByEmail(userData.email);
        if (!existingUser) {
          await storage.createUser(userData);
          console.log('Created user:', userData.email);
        }
      }

      res.json({ message: 'Database seeded successfully' });
    } catch (error) {
      console.error('Seed error:', error);
      res.status(500).json({ message: 'Seeding failed' });
    }
  });

  // Notes endpoints
  app.get('/api/notes', authenticateToken, async (req: any, res) => {
    try {
      const notes = await storage.getNotes(req.user.tenantId);
      console.log(`Retrieved ${notes.length} notes for tenant ${req.user.tenantSlug}`);
      res.json(notes);
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ message: 'Failed to fetch notes' });
    }
  });

  app.get('/api/notes/:id', authenticateToken, async (req: any, res) => {
    try {
      const note = await storage.getNote(req.params.id, req.user.tenantId);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }
      res.json(note);
    } catch (error) {
      console.error('Get note error:', error);
      res.status(500).json({ message: 'Failed to fetch note' });
    }
  });

  app.post('/api/notes', authenticateToken, async (req: any, res) => {
    try {
      const tenant = await storage.getTenant(req.user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // Check plan limits
      if (tenant.plan === 'free') {
        const notesCount = await storage.getNotesCount(req.user.tenantId);
        if (notesCount >= 3) {
          console.log(`Free plan limit reached for tenant ${req.user.tenantSlug}`);
          return res.status(403).json({ message: 'Free plan limit reached. Upgrade to Pro for unlimited notes.' });
        }
      }

      const { title, content } = req.body;
      const note = await storage.createNote({
        title,
        content,
        userId: req.user.userId,
        tenantId: req.user.tenantId
      });

      console.log(`Created note "${title}" for user ${req.user.email}`);
      res.status(201).json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ message: 'Failed to create note' });
    }
  });

  app.put('/api/notes/:id', authenticateToken, async (req: any, res) => {
    try {
      // First get the existing note to check ownership
      const existingNote = await storage.getNote(req.params.id, req.user.tenantId);
      if (!existingNote) {
        return res.status(404).json({ message: 'Note not found' });
      }

      // Check authorization: admin can update any note in tenant, member can only update own notes
      if (req.user.role === 'member' && existingNote.userId !== req.user.userId) {
        console.log(`User ${req.user.email} attempted to update note ${req.params.id} owned by another user`);
        return res.status(403).json({ message: 'You can only update your own notes' });
      }

      const { title, content } = req.body;
      const note = await storage.updateNote(req.params.id, req.user.tenantId, {
        title,
        content,
        userId: existingNote.userId, // Keep original owner
        tenantId: req.user.tenantId
      });

      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }

      console.log(`Updated note ${req.params.id} for user ${req.user.email}`);
      res.json(note);
    } catch (error) {
      console.error('Update note error:', error);
      res.status(500).json({ message: 'Failed to update note' });
    }
  });

  app.delete('/api/notes/:id', authenticateToken, async (req: any, res) => {
    try {
      // First get the existing note to check ownership
      const existingNote = await storage.getNote(req.params.id, req.user.tenantId);
      if (!existingNote) {
        return res.status(404).json({ message: 'Note not found' });
      }

      // Check authorization: admin can delete any note in tenant, member can only delete own notes
      if (req.user.role === 'member' && existingNote.userId !== req.user.userId) {
        console.log(`User ${req.user.email} attempted to delete note ${req.params.id} owned by another user`);
        return res.status(403).json({ message: 'You can only delete your own notes' });
      }

      const deleted = await storage.deleteNote(req.params.id, req.user.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: 'Note not found' });
      }

      console.log(`Deleted note ${req.params.id} for user ${req.user.email}`);
      res.json({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Delete note error:', error);
      res.status(500).json({ message: 'Failed to delete note' });
    }
  });

  // Upgrade tenant endpoint
  app.post('/api/tenants/:slug/upgrade', authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin role required' });
      }

      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.user.tenantId) {
        return res.status(404).json({ message: 'Tenant not found or access denied' });
      }

      const upgradedTenant = await storage.upgradeTenant(tenant.id);
      console.log(`Upgraded tenant ${req.params.slug} to Pro plan`);
      res.json(upgradedTenant);
    } catch (error) {
      console.error('Upgrade tenant error:', error);
      res.status(500).json({ message: 'Failed to upgrade tenant' });
    }
  });

  // Invite user endpoint
  app.post('/api/tenants/:slug/invite', authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin role required' });
      }

      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.user.tenantId) {
        return res.status(404).json({ message: 'Tenant not found or access denied' });
      }

      const { email, role = 'member' } = req.body;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const newUser = await storage.createUser({
        email,
        password: 'password',
        role,
        tenantId: req.user.tenantId
      });

      console.log(`Invited user ${email} to tenant ${req.params.slug}`);
      res.status(201).json({ message: 'User invited successfully', userId: newUser.id });
    } catch (error) {
      console.error('Invite user error:', error);
      res.status(500).json({ message: 'Failed to invite user' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
