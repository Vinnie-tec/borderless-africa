import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth handles its authentication endpoints here.
export const { GET, POST } = toNextJsHandler(auth);
