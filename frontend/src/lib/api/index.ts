import "server-only";
import type { ChatquiryApi } from "./client";
import { mockApi } from "./mock";

/** Server-side only, so the backend URL and tokens never reach the browser. */
export function api(): ChatquiryApi {
  const mode = process.env.CHATQUIRY_API_MODE ?? "mock";
  if (mode !== "mock") {
    throw new Error(`CHATQUIRY_API_MODE=${mode} is not supported yet`);
  }
  return mockApi;
}

export type { ChatquiryApi, ConversationFilter } from "./client";
