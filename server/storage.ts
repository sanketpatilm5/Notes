import { 
  tenants, users, notes, passwordResetTokens,
  type Tenant, type User, type Note, type PasswordResetToken,
  type InsertTenant, type InsertUser, type InsertNote, type InsertPasswordResetToken
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, lt } from "drizzle-orm";
import bcryptjs from "bcryptjs";

export interface IStorage {
  // Tenant methods
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  upgradeTenant(id: string): Promise<Tenant>;

  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, newPassword: string): Promise<User | undefined>;

  // Password reset token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenId: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;

  // Note methods
  getNotes(tenantId: string): Promise<Note[]>;
  getNote(id: string, tenantId: string): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, tenantId: string, updates: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string, tenantId: string): Promise<boolean>;
  getNotesCount(tenantId: string): Promise<number>;
  // Returns notes for a specific tenant created by a specific user
  getNotesByUser(tenantId: string, userId: string): Promise<Note[]>;

}

export class DatabaseStorage implements IStorage {
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(insertTenant).returning();
    return tenant;
  }

  async upgradeTenant(id: string): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ plan: "pro" })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = bcryptjs.hashSync(insertUser.password, 8);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<User | undefined> {
    const hashedPassword = bcryptjs.hashSync(newPassword, 8);
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getNotes(tenantId: string): Promise<Note[]> {
    return await db.select().from(notes).where(eq(notes.tenantId, tenantId));
  }

  async getNote(id: string, tenantId: string): Promise<Note | undefined> {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)));
    return note || undefined;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes).values(insertNote).returning();
    return note;
  }

  async updateNote(id: string, tenantId: string, updates: Partial<InsertNote>): Promise<Note | undefined> {
    const [note] = await db
      .update(notes)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)))
      .returning();
    return note || undefined;
  }

  async deleteNote(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.tenantId, tenantId)));
    return (result.rowCount || 0) > 0;
  }

  async getNotesCount(tenantId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(notes)
      .where(eq(notes.tenantId, tenantId));
    return result.count;
  }

  async getNotesByUser(tenantId: string, userId: string): Promise<Note[]> {
    const rows = await db
      .select()
      .from(notes)
      .where(and(eq(notes.tenantId, tenantId), eq(notes.userId, userId)));
    return rows as unknown as Note[];
  }



  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(insertToken).returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markTokenAsUsed(tokenId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now));
  }
}

export const storage = new DatabaseStorage();
