import { relations, sql } from "drizzle-orm";
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
  uniqueIndex,
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

export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
]);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),

    freelancerId: text("freelancer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    coverLetter: text("cover_letter").notNull(),

    proposedPrice: numeric("proposed_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    currency: varchar("currency", { length: 3 }).notNull(),

    deliveryDays: integer("delivery_days").notNull(),

    status: proposalStatusEnum("status").default("pending").notNull(),

    submittedAt: timestamp("submitted_at", {
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
    index("proposals_job_id_idx").on(table.jobId),
    index("proposals_freelancer_id_idx").on(table.freelancerId),

    // Prevent duplicate active applications by the same freelancer.
    uniqueIndex("proposals_active_freelancer_job_unique")
      .on(table.jobId, table.freelancerId)
      .where(sql`${table.status} IN ('pending', 'negotiating', 'accepted')`),

    // A job can have only one accepted proposal.
    uniqueIndex("proposals_one_accepted_per_job_unique")
      .on(table.jobId)
      .where(sql`${table.status} = 'accepted'`),
  ],
);

export const proposalOffers = pgTable(
  "proposal_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "restrict" }),

    // The client or freelancer who made this counteroffer.
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    proposedPrice: numeric("proposed_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    deliveryDays: integer("delivery_days").notNull(),

    offerNumber: integer("offer_number").notNull(),

    message: text("message").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("proposal_offers_proposal_id_created_at_idx").on(
      table.proposalId,
      table.createdAt,
    ),
    index("proposal_offers_sender_id_idx").on(table.senderId),
    uniqueIndex("proposal_offers_number_unique").on(
      table.proposalId,
      table.offerNumber,
    ),
  ],
);

export const contractStatusEnum = pgEnum("contract_status", [
  "awaiting_payment",
  "active",
  "delivered",
  "revision_requested",
  "completed",
  "cancelled",
  "disputed",
]);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),

    proposalId: uuid("proposal_id")
      .notNull()
      .unique()
      .references(() => proposals.id, { onDelete: "restrict" }),

    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    freelancerId: text("freelancer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    // Immutable snapshot of the agreed terms.
    title: varchar("title", { length: 160 }).notNull(),
    scope: text("scope").notNull(),

    agreedPrice: numeric("agreed_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    currency: varchar("currency", { length: 3 }).notNull(),

    deliveryDays: integer("delivery_days").notNull(),

    revisionAllowance: integer("revision_allowance").default(2).notNull(),

    status: contractStatusEnum("status").default("awaiting_payment").notNull(),

    revisionsUsed: integer("revisions_used").default(0).notNull(),

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
    uniqueIndex("contracts_one_per_job_unique").on(table.jobId),
    index("contracts_client_id_idx").on(table.clientId),
    index("contracts_freelancer_id_idx").on(table.freelancerId),
    index("contracts_status_idx").on(table.status),
  ],
);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "submitted",
  "revision_requested",
  "approved",
]);

export const contractDeliveries = pgTable(
  "contract_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "restrict" }),

    submittedById: text("submitted_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    submissionNumber: integer("submission_number").notNull(),

    message: text("message").notNull(),

    // Optional link to the submitted work.
    attachmentUrl: text("attachment_url"),

    status: deliveryStatusEnum("status")
      .default("submitted")
      .notNull(),

    reviewMessage: text("review_message"),

    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("contract_deliveries_submission_unique").on(
      table.contractId,
      table.submissionNumber
    ),

    index("contract_deliveries_contract_id_idx").on(
      table.contractId
    ),

    index("contract_deliveries_submitted_by_idx").on(
      table.submittedById
    ),
  ]
);
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
