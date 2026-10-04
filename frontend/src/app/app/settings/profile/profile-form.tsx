"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/feedback/toast";
import { Avatar, Button, Card, Label } from "@/components/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { LOCALES, THEMES, fmt, type Locale, type Theme } from "@/i18n/config";
import { saveProfile, type FormState } from "@/lib/actions";
import type { Availability, StaffProfile } from "@/lib/api/types";

const AVAILABILITY: Availability[] = ["available", "paused", "offline"];
const TIMEZONES = ["America/Bogota", "America/Mexico_City", "America/Argentina/Buenos_Aires", "America/Sao_Paulo"];
const NOTIFICATIONS = [
  ["newHandoff", "nNewHandoff"],
  ["desktop", "nDesktop"],
  ["sound", "nSound"],
  ["dailySummary", "nDaily"],
] as const;

const input = "h-12 rounded-fila border-[1.5px] border-linea bg-superficie px-4 text-[15px]";

/** Crops to a centered square and downsizes to 256px so the upload stays small. */
async function toAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold">{label}</span>
      <div className="flex gap-1 rounded-full bg-fondo p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`h-10 grow rounded-full px-3 text-[14px] font-semibold ${value === o.value ? "bg-tinta text-fondo" : "hover:bg-superficie"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfileForm({ profile }: { profile: StaffProfile }) {
  const t = useMessages();
  const m = t.profile;
  const { toast } = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const [avatar, setAvatar] = useState(profile.avatarUrl ?? "");
  const [removed, setRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [greeting, setGreeting] = useState(profile.greeting ?? "");
  const [availability, setAvailability] = useState<Availability>(profile.availability);
  const uiLocale = useLocale();
  const [locale, setLocale] = useState<Locale>(profile.locale ?? uiLocale);
  const [theme, setTheme] = useState<Theme>(profile.theme ?? "system");
  const fileRef = useRef<HTMLInputElement>(null);
  const handlesChats = profile.maxConcurrentChats > 0;

  useEffect(() => {
    if (state.ok) toast({ kind: "success", title: m.saved, message: m.savedMessage });
    if (state.error) toast({ kind: "error", title: m.notSaved, message: m.errors[state.error as keyof typeof m.errors] ?? state.error });
    // Only react to a new server response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setPhotoError(m.errPhotoType);
    if (file.size > 5_000_000) return setPhotoError(m.errPhotoSize);
    setAvatar(await toAvatar(file));
    setRemoved(false);
  }

  const shownAvatar = removed ? undefined : avatar || undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="avatarUrl" value={avatar.startsWith("data:") && avatar !== profile.avatarUrl ? avatar : ""} />
      <input type="hidden" name="removeAvatar" value={removed ? "1" : ""} />
      <input type="hidden" name="availability" value={availability} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="theme" value={theme} />
      {!handlesChats && <input type="hidden" name="greeting" value={greeting} />}

      <Card className="grid grid-cols-1 gap-8 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-7">
        <div className="flex flex-col gap-5">
          <Label>{m.photoAndName}</Label>
          <div className="flex items-center gap-5">
            <Avatar initials={profile.initials} src={shownAvatar} tone={profile.role === "admin" ? "brand" : "ink"} size={88} />
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  {shownAvatar ? m.change : m.upload}
                </Button>
                {shownAvatar && (
                  <Button variant="tertiary" size="sm" onClick={() => { setRemoved(true); setAvatar(""); }}>
                    {m.remove}
                  </Button>
                )}
              </div>
              <span className="text-[13px] text-muted">{m.photoFormats}</span>
              {photoError && <span className="text-[13px] font-semibold text-atencion" role="alert">{photoError}</span>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} aria-label={m.photoLabel} />
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
            {m.displayName}
            <input name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required className={input} />
            <span className="font-normal text-muted">{m.displayNameHint}</span>
          </label>
          {handlesChats && (
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              {m.greeting}
              <textarea name="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} maxLength={280} rows={3} className="resize-none rounded-fila border-[1.5px] border-linea bg-superficie px-4 py-3 text-[15px] font-normal" />
              <span className="font-normal text-muted">{fmt(m.greetingHint, { n: greeting.length })}</span>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>{m.preview}</Label>
          <div className="flex flex-col gap-2 rounded-telefono border-2 border-tinta bg-superficie p-4 text-[14px]">
            <div className="flex items-center gap-2.5 border-b-[1.5px] border-linea pb-3">
              <Avatar initials={displayName.slice(0, 1).toUpperCase() || "?"} src={shownAvatar} tone="ink" size={34} />
              <span className="flex flex-col leading-tight">
                <span className="font-bold">{displayName || "…"}</span>
                <span className="text-[12px] text-muted">Banco LATAM · {profile.team}</span>
              </span>
            </div>
            <p className="self-center pt-1 text-[11px] text-muted">{fmt(m.joined, { name: displayName || "…" })}</p>
            <p className="self-start rounded-[16px_16px_16px_4px] bg-fondo px-3 py-2">{greeting || "…"}</p>
          </div>
        </div>
      </Card>

      {handlesChats && (
        <Card className="flex flex-col gap-3 p-7">
          <Label>{m.availability}</Label>
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={m.availability}>
            {AVAILABILITY.map((a) => {
              const on = availability === a;
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAvailability(a)}
                  className={`flex flex-col items-start gap-1 rounded-fila px-4 py-3 text-left ${on ? "border-2 border-tinta bg-marca" : "border-2 border-linea bg-superficie hover:border-punto"}`}
                >
                  <span className="font-bold">{t.availability[a]}</span>
                  <span className="text-[13px]">{t.availability[`${a}Hint`]}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-7">
        <div className="flex flex-col gap-1">
          <Label>{m.interface}</Label>
          <span className="text-[13px] text-muted">{m.interfaceHint}</span>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Segmented label={t.prefs.language} value={locale} onChange={setLocale} options={LOCALES.map((l) => ({ value: l, label: t.languages[l] }))} />
          <Segmented label={t.prefs.theme} value={theme} onChange={setTheme} options={THEMES.map((x) => ({ value: x, label: t.prefs[x] }))} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-7">
          <Label>{m.contact}</Label>
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
            {m.extension}
            <input name="phoneExtension" defaultValue={profile.phoneExtension} inputMode="numeric" maxLength={10} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
            {m.timezone}
            <select name="timezone" defaultValue={profile.timezone} className={input}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.split("/").pop()!.replace("_", " ")}</option>
              ))}
            </select>
          </label>
        </Card>
        <Card className="flex flex-col gap-3 p-7">
          <Label>{m.notifications}</Label>
          {NOTIFICATIONS.map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 rounded-fila bg-fondo px-4 py-3 text-[15px]">
              {m[label]}
              <input type="checkbox" name={`n_${key}`} defaultChecked={profile.notifications[key]} className="size-5 accent-[var(--tinta)]" />
            </label>
          ))}
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? t.common.saving : t.common.saveChanges}</Button>
      </div>
    </form>
  );
}
