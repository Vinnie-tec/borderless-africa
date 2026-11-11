import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
  boolean,
  uuid,
  varchar,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),

  // Every account receives a role.
  // Public registration cannot choose this value.
  role: text("role").default("user").notNull(),
});

// A user can operate in one or both marketplace modes.
export const marketplaceCapabilityEnum = pgEnum("marketplace_capability", [
  "client",
  "freelancer",
]);

// Stores the marketplace capabilities enabled for each user.
//
// A composite primary key prevents the same capability
// from being assigned to the same user more than once.
export const userCapabilities = pgTable(
  "user_capabilities",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    capability: marketplaceCapabilityEnum("capability").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.capability],
    }),

    // Helps us find all users with a particular capability.
    index("user_capabilities_capability_idx").on(table.capability),
  ],
);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "open",
  "closed",
  "cancelled",
]);

export const jobs = pgTable(
  "jobs",
  {
    // Unique identifier for each job.
    id: uuid("id").defaultRandom().primaryKey(),

    // The user who owns and posted this job.
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    title: varchar("title", { length: 160 }).notNull(),

    description: text("description").notNull(),

    // We'll connect this to a proper categories table later.
    category: varchar("category", { length: 100 }).notNull(),

    // PostgreSQL numeric preserves decimal precision for money.
    budget: numeric("budget", {
      precision: 12,
      scale: 2,
    }).notNull(),

    // ISO currency code, e.g. NGN, KES, GHS, USD.
    currency: varchar("currency", { length: 3 }).notNull(),

    // Expected delivery time in calendar days.
    deliveryDays: integer("delivery_days").notNull(),

    status: jobStatusEnum("status").default("draft").notNull(),

    // Optional deadline for accepting proposals.
    closingAt: timestamp("closing_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Quickly retrieve jobs belonging to a client.
    index("jobs_client_id_idx").on(table.clientId),

    // Useful for browsing open jobs.
    index("jobs_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
