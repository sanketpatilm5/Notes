var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertNoteSchema: () => insertNoteSchema,
  insertPasswordResetTokenSchema: () => insertPasswordResetTokenSchema,
  insertTenantSchema: () => insertTenantSchema,
  insertUserSchema: () => insertUserSchema,
  notes: () => notes,
  notesRelations: () => notesRelations,
  passwordResetTokens: () => passwordResetTokens,
  passwordResetTokensRelations: () => passwordResetTokensRelations,
  tenants: () => tenants,
  tenantsRelations: () => tenantsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  plan: varchar("plan").notNull().default("free"),
  // 'free' or 'pro'
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role").notNull().default("member"),
  // 'admin' or 'member'
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  notes: many(notes)
}));
var usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id]
  }),
  notes: many(notes),
  passwordResetTokens: many(passwordResetTokens)
}));
var notesRelations = relations(notes, ({ one }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id]
  }),
  tenant: one(tenants, {
    fields: [notes.tenantId],
    references: [tenants.id]
  })
}));
var passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id]
  })
}));
var insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, count, lt } from "drizzle-orm";
import bcryptjs from "bcryptjs";
var DatabaseStorage = class {
  async getTenant(id) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || void 0;
  }
  async getTenantBySlug(slug) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant || void 0;
  }
  async createTenant(insertTenant) {
    const [tenant] = await db.insert(tenants).values(insertTenant).returning();
    return tenant;
  }
  async upgradeTenant(id) {
    const [tenant] = await db.update(tenants).set({ plan: "pro" }).where(eq(tenants.id, id)).returning();
    return tenant;
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async createUser(insertUser) {
    const hashedPassword = bcryptjs.hashSync(insertUser.password, 8);
    const [user] = await db.insert(users).values({ ...insertUser, password: hashedPassword }).returning();
    return user;
  }
  async updateUserPassword(id, newPassword) {
    const hashedPassword = bcryptjs.hashSync(newPassword, 8);
    const [user] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return user || void 0;
  }
  async getNotes(tenantId) {
    return await db.select().from(notes).where(eq(notes.tenantId, tenantId));
  }
  async getNote(id, tenantId) {
    const [note] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)));
    return note || void 0;
  }
  async createNote(insertNote) {
    const [note] = await db.insert(notes).values(insertNote).returning();
    return note;
  }
  async updateNote(id, tenantId, updates) {
    const [note] = await db.update(notes).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(notes.id, id), eq(notes.tenantId, tenantId))).returning();
    return note || void 0;
  }
  async deleteNote(id, tenantId) {
    const result = await db.delete(notes).where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }
  async getNotesCount(tenantId) {
    const [result] = await db.select({ count: count() }).from(notes).where(eq(notes.tenantId, tenantId));
    return result.count;
  }
  async getNotesByUser(tenantId, userId) {
    const rows = await db.select().from(notes).where(and(eq(notes.tenantId, tenantId), eq(notes.userId, userId)));
    return rows;
  }
  async createPasswordResetToken(insertToken) {
    const [token] = await db.insert(passwordResetTokens).values(insertToken).returning();
    return token;
  }
  async getPasswordResetToken(token) {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken || void 0;
  }
  async markTokenAsUsed(tokenId) {
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, tokenId));
  }
  async cleanupExpiredTokens() {
    const now = /* @__PURE__ */ new Date();
    await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now));
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import jwt from "jsonwebtoken";
import bcryptjs2 from "bcryptjs";
var JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
var secretKey = JWT_SECRET;
async function seedDatabase() {
  try {
    const existingAcme = await storage.getTenantBySlug("acme");
    const existingGlobex = await storage.getTenantBySlug("globex");
    let acmeTenant = existingAcme;
    let globexTenant = existingGlobex;
    if (!acmeTenant) {
      acmeTenant = await storage.createTenant({ name: "Acme", slug: "acme", plan: "free" });
      console.log("Created tenant acme");
    }
    if (!globexTenant) {
      globexTenant = await storage.createTenant({ name: "Globex", slug: "globex", plan: "free" });
      console.log("Created tenant globex");
    }
    const seedPassword = process.env.SEED_PASSWORD || "password";
    const usersToCreate = [
      { email: "admin@acme.test", password: seedPassword, role: "admin", tenantId: acmeTenant.id },
      { email: "user@acme.test", password: seedPassword, role: "member", tenantId: acmeTenant.id },
      { email: "admin@globex.test", password: seedPassword, role: "admin", tenantId: globexTenant.id },
      { email: "user@globex.test", password: seedPassword, role: "member", tenantId: globexTenant.id }
    ];
    for (const userData of usersToCreate) {
      const existingUser = await storage.getUserByEmail(userData.email);
      if (!existingUser) {
        await storage.createUser(userData);
        console.log("Created user:", userData.email, "password:", seedPassword);
      } else {
        console.log("User already exists:", userData.email);
      }
    }
    return true;
  } catch (err) {
    console.error("seedDatabase error", err);
    throw err;
  }
}
var setCORSHeaders = (res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
};
var handleServerError = (res, context, error) => {
  console.error(`${context} error:`, error?.stack || error);
  if (process.env.NODE_ENV === "development") {
    return res.status(500).json({ message: error?.message || "Internal server error", stack: error?.stack || String(error) });
  }
  return res.status(500).json({ message: "Internal server error" });
};
var authenticateToken = async (req, res, next) => {
  setCORSHeaders(res);
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }
  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("JWT verification failed:", error);
    return res.status(403).json({ message: "Invalid token" });
  }
};
async function registerRoutes(app2) {
  app2.get("/api/health", (req, res) => {
    setCORSHeaders(res);
    res.json({ status: "ok" });
  });
  app2.get("/health", (req, res) => {
    setCORSHeaders(res);
    res.json({ status: "ok" });
  });
  app2.post("/api/auth/login", async (req, res) => {
    setCORSHeaders(res);
    console.log("Login attempt:", req.body.email);
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log("User not found:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const passwordMatch = bcryptjs2.compareSync(password, user.password);
      if (!passwordMatch) {
        console.log("Password mismatch for user:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        console.log("Tenant not found for user:", email);
        return res.status(500).json({ message: "Tenant not found" });
      }
      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenant.id,
        tenantSlug: tenant.slug
      }, secretKey, { expiresIn: "7d" });
      console.log("Login successful for:", email);
      res.json({ token });
    } catch (error) {
      return handleServerError(res, "Login", error);
    }
  });
  app2.post("/api/auth/seed", authenticateToken, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    console.log("Seeding database...");
    try {
      let acmeTenant = await storage.getTenantBySlug("acme");
      if (!acmeTenant) {
        acmeTenant = await storage.createTenant({
          name: "ACME Corp",
          slug: "acme",
          plan: "free"
        });
        console.log("Created ACME tenant");
      }
      let globexTenant = await storage.getTenantBySlug("globex");
      if (!globexTenant) {
        globexTenant = await storage.createTenant({
          name: "Globex Inc",
          slug: "globex",
          plan: "free"
        });
        console.log("Created Globex tenant");
      }
      await seedDatabase();
      res.json({ message: "Database seeded successfully" });
    } catch (error) {
      return handleServerError(res, "Seed", error);
    }
  });
  app2.get("/api/notes", authenticateToken, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      const notes2 = await storage.getNotesByUser(req.user.tenantId, req.user.userId);
      const normalized = notes2.map((n) => ({
        ...n,
        ownerEmail: n.ownerEmail || req.user.email
      }));
      return res.json(normalized);
    } catch (error) {
      return handleServerError(res, "Get notes", error);
    }
  });
  app2.get("/api/notes/:id", authenticateToken, async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id, req.user.tenantId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      if (note.userId !== req.user.userId) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      return handleServerError(res, "Get note", error);
    }
  });
  app2.post("/api/notes", authenticateToken, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      if (tenant.plan === "free") {
        const notesCount = await storage.getNotesCount(req.user.tenantId);
        if (notesCount >= 3) {
          console.log(`Free plan limit reached for tenant ${req.user.tenantSlug}`);
          return res.status(403).json({ message: "Free plan limit reached. Upgrade to Pro for unlimited notes." });
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
      return handleServerError(res, "Create note", error);
    }
  });
  app2.put("/api/notes/:id", authenticateToken, async (req, res) => {
    try {
      const existingNote = await storage.getNote(req.params.id, req.user.tenantId);
      if (!existingNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      if (existingNote.userId !== req.user.userId) {
        console.log(`User ${req.user.email} attempted to update note ${req.params.id} owned by another user`);
        return res.status(403).json({ message: "You can only update your own notes" });
      }
      const { title, content } = req.body;
      const note = await storage.updateNote(req.params.id, req.user.tenantId, {
        title,
        content,
        userId: existingNote.userId,
        // Keep original owner
        tenantId: req.user.tenantId
      });
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      console.log(`Updated note ${req.params.id} for user ${req.user.email}`);
      res.json(note);
    } catch (error) {
      return handleServerError(res, "Update note", error);
    }
  });
  app2.delete("/api/notes/:id", authenticateToken, async (req, res) => {
    try {
      const existingNote = await storage.getNote(req.params.id, req.user.tenantId);
      if (!existingNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      if (existingNote.userId !== req.user.userId) {
        console.log(`User ${req.user.email} attempted to delete note ${req.params.id} owned by another user`);
        return res.status(403).json({ message: "You can only delete your own notes" });
      }
      const deleted = await storage.deleteNote(req.params.id, req.user.tenantId);
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      console.log(`Deleted note ${req.params.id} for user ${req.user.email}`);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      return handleServerError(res, "Delete note", error);
    }
  });
  app2.post("/api/tenants/:slug/upgrade", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin role required" });
      }
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.user.tenantId) {
        return res.status(404).json({ message: "Tenant not found or access denied" });
      }
      const upgradedTenant = await storage.upgradeTenant(tenant.id);
      console.log(`Upgraded tenant ${req.params.slug} to Pro plan`);
      res.json(upgradedTenant);
    } catch (error) {
      return handleServerError(res, "Upgrade tenant", error);
    }
  });
  app2.post("/api/tenants/:slug/invite", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin role required" });
      }
      const tenant = await storage.getTenantBySlug(req.params.slug);
      if (!tenant || tenant.id !== req.user.tenantId) {
        return res.status(404).json({ message: "Tenant not found or access denied" });
      }
      const { email, role = "member" } = req.body;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      const crypto = await import("crypto");
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      const newUser = await storage.createUser({
        email,
        password: "temp-password-" + crypto.randomBytes(8).toString("hex"),
        role,
        tenantId: req.user.tenantId
      });
      await storage.createPasswordResetToken({
        token: resetToken,
        userId: newUser.id,
        expiresAt,
        used: false
      });
      console.log(`Invited user ${email} to tenant ${req.params.slug} with reset token`);
      res.status(201).json({
        message: "User invited successfully. Password reset token created.",
        userId: newUser.id
        // passwordResetToken removed from response to prevent token leakage
      });
    } catch (error) {
      return handleServerError(res, "Invite user", error);
    }
  });
  app2.post("/api/auth/request-reset", async (req, res) => {
    setCORSHeaders(res);
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If the email exists, a reset link will be sent." });
      }
      const crypto = await import("crypto");
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
      await storage.cleanupExpiredTokens();
      await storage.createPasswordResetToken({
        token: resetToken,
        userId: user.id,
        expiresAt,
        used: false
      });
      console.log(`Password reset requested for ${email}`);
      res.json({
        message: "If the email exists, a reset link will be sent.",
        // For development only - remove in production
        resetToken
      });
    } catch (error) {
      return handleServerError(res, "Request password reset", error);
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    setCORSHeaders(res);
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      if (resetToken.used || resetToken.expiresAt < /* @__PURE__ */ new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      await storage.updateUserPassword(resetToken.userId, newPassword);
      await storage.markTokenAsUsed(resetToken.id);
      console.log(`Password reset successfully for user ${resetToken.userId}`);
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      return handleServerError(res, "Reset password", error);
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const listenOptions = { port, host: "0.0.0.0" };
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }
  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
  if (process.env.SEED_DB === "true") {
    (async () => {
      try {
        console.log("SEED_DB=true \u2014 seeding database now...");
        await seedDatabase();
        console.log("Seeding complete.");
      } catch (e) {
        console.error("Seeding failed:", e);
      }
    })();
  }
})();
