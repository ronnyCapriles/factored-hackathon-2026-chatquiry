import "server-only";
import type { ChatquiryApi } from "./client";
import { liveApi } from "./live";
import { mockApi } from "./mock";

/**
 * Server-side only, so the backend URL and tokens never reach the browser.
 * The token argument is for the sign-in action, before the session cookie exists.
 */
export function api(token?: string): ChatquiryApi {
  const mode = process.env.CHATQUIRY_API_MODE || "mock";
  if (mode === "live") return liveApi(token);
  if (mode === "mock") return mockApi;
  throw new Error(`Unknown CHATQUIRY_API_MODE: ${mode}`);
}

export type { ChatquiryApi, ConversationFilter } from "./client";
