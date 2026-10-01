"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, THEME_COOKIE, isLocale, isTheme } from "@/i18n/config";
import { api } from "./api";
import { ApiError } from "./api/live";
import type { Availability, IntakeQuestion, Message, ProfileUpdate } from "./api/types";
import { createStaffSession, destroyStaffSession, homeFor, requireStaff, safeNext } from "./session";

/** Errors are catalog keys so the client shows them in the user's language. */
export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function staffLogin(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const result = await api().authenticateStaff(email, password);
  // Same answer for unknown user and wrong password.
  if (!result) return { error: "invalid" };
  await createStaffSession(result.user, result.token, result.expiresAt);
  const profile = await api(result.token).getProfile(result.user.id);
  if (profile) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, profile.locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
    jar.set(THEME_COOKIE, profile.theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  }
  redirect(safeNext(form.get("next")) ?? homeFor(result.user.role));
}

export async function staffLogout() {
  await destroyStaffSession();
  redirect("/login");
}

const AVAILABILITY: Availability[] = ["available", "paused", "offline"];
const MAX_AVATAR_CHARS = 300_000;
const YEAR = 60 * 60 * 24 * 365;

export async function saveProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireStaff();
  const displayName = String(form.get("displayName") ?? "").trim();
  const greeting = String(form.get("greeting") ?? "").trim();
  const availability = String(form.get("availability") ?? "") as Availability;
  const avatar = String(form.get("avatarUrl") ?? "");
  const locale = form.get("locale");
  const theme = form.get("theme");

  if (displayName.length < 2 || displayName.length > 40) return { error: "displayName" };
  if (greeting.length > 280) return { error: "greeting" };
  if (!AVAILABILITY.includes(availability)) return { error: "availability" };
  if (avatar && (!/^data:image\/(jpeg|png|webp);base64,/.test(avatar) || avatar.length > MAX_AVATAR_CHARS)) return { error: "avatar" };
  if (!isLocale(locale) || !isTheme(theme)) return { error: "prefs" };

  const update: Partial<ProfileUpdate> = {
    displayName,
    greeting,
    availability,
    locale,
    theme,
    phoneExtension: String(form.get("phoneExtension") ?? "").trim().slice(0, 10),
    timezone: String(form.get("timezone") ?? "America/Bogota"),
    notifications: {
      newHandoff: form.get("n_newHandoff") === "on",
      desktop: form.get("n_desktop") === "on",
      sound: form.get("n_sound") === "on",
      dailySummary: form.get("n_dailySummary") === "on",
    },
  };
  if (avatar) update.avatarUrl = avatar;
  if (form.get("removeAvatar") === "1") update.avatarUrl = "";

  await api().updateProfile(user.id, update);
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set(THEME_COOKIE, theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}

// A person acting on a conversation. Errors reach the client, which shows them as a toast; sign-in redirects pass through.

export async function replyToCustomer(conversationId: string, text: string): Promise<Message | null> {
  await requireStaff("agent");
  const clean = text.trim();
  if (!clean || clean.length > 2000) return null;
  return api().replyAsAgent(conversationId, clean);
}

export async function resolveConversation(conversationId: string) {
  await requireStaff("agent");
  await api().resolveConversation(conversationId);
  revalidatePath("/app/conversations");
}

export async function returnConversationToAi(conversationId: string) {
  await requireStaff("agent");
  await api().returnToAi(conversationId);
  revalidatePath("/app/conversations");
}

export async function runHumanAction(conversationId: string, actionId: string) {
  await requireStaff("agent");
  await api().runHumanAction(conversationId, actionId);
  revalidatePath("/app/conversations");
}

/** Admin only. A rejected wording comes back as the API's reason, so the editor can show it. */
export async function saveIntakeQuestions(questions: Record<string, IntakeQuestion>): Promise<FormState> {
  await requireStaff("admin");
  try {
    await api().saveIntakeQuestions(questions);
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) return { error: e.code };
    throw e;
  }
  revalidatePath("/app/config", "layout");
  return { ok: true };
}

export async function restoreIntakeQuestions(): Promise<FormState> {
  await requireStaff("admin");
  await api().restoreIntakeQuestions();
  revalidatePath("/app/config", "layout");
  return { ok: true };
}
