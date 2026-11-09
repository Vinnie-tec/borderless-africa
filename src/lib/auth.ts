import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { db } from "@/lib/db";

export const auth = betterAuth({
  // Connect Better Auth to our existing PostgreSQL database.
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Application URL and secret.
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Email/password authentication.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,

    // Development only: print the password reset link.
    // Later, we'll replace this with a real email provider.
    sendResetPassword: async ({ user, url }) => {
      console.log("\n--- PASSWORD RESET ---");
      console.log(`User: ${user.email}`);
      console.log(`Reset link: ${url}`);
      console.log("----------------------\n");
    },
  },

  // Email verification.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,

    // Development only: print the verification link.
    sendVerificationEmail: async ({ user, url }) => {
      console.log("\n--- EMAIL VERIFICATION ---");
      console.log(`User: ${user.email}`);
      console.log(`Verification link: ${url}`);
      console.log("---------------------------\n");
    },
  },

  // Additional application-specific user fields.
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
});