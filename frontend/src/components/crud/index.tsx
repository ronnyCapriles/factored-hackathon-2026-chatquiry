"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/feedback/modal";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui";
import { fmt, type Messages } from "@/i18n/config";
import { useMessages } from "@/i18n/client";

// Create, edit and delete flows. Forms are plain field lists so they can map to API payloads.

export type FieldType = "text" | "textarea" | "select" | "number" | "toggle" | "multiselect" | "code";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  /** Two fields per row when true. */
  half?: boolean;
}

export type Values = Record<string, string | number | boolean | string[] | undefined>;

const control = "w-full rounded-fila border-[1.5px] border-linea bg-superficie px-4 text-[15px] focus:border-tinta";

function FieldInput({ f, value, onChange, error }: { f: Field; value: Values[string]; onChange: (v: Values[string]) => void; error?: string }) {
  const t = useMessages();
  const id = `f-${f.name}`;
  const describedBy = [f.hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  let input: ReactNode;
  switch (f.type) {
    case "textarea":
    case "code":
      input = (
        <textarea
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={f.type === "code" ? 6 : 3}
          maxLength={f.maxLength}
          placeholder={f.placeholder}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`${control} resize-y py-3 ${f.type === "code" ? "tabular text-[13px]" : ""}`}
        />
      );
      break;
    case "select":
      input = (
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} aria-invalid={!!error} className={`${control} h-12`}>
          <option value="">{t.common.choose}</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
      break;
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      input = (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
          {f.options?.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                className={`h-9 rounded-full px-3.5 text-[14px] font-semibold ${on ? "border-2 border-tinta bg-marca" : "border-[1.5px] border-linea bg-superficie hover:border-punto"}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "toggle":
      input = (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(!value)}
          className={`flex h-[28px] w-12 items-center rounded-full border-2 border-tinta p-0.5 ${value ? "justify-end bg-marca" : "justify-start bg-linea"}`}
        >
          <span className="size-5 rounded-full bg-tinta" />
          <span className="sr-only">{f.label}</span>
        </button>
      );
      break;
    default:
      input = (
        <input
          id={id}
          type={f.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          min={f.min}
          max={f.max}
          maxLength={f.maxLength}
          placeholder={f.placeholder}
          onChange={(e) => onChange(f.type === "number" ? e.target.value : e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`${control} h-12`}
        />
      );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${f.half ? "" : "col-span-2"}`}>
      <label id={`${id}-label`} htmlFor={f.type === "multiselect" ? undefined : id} className="text-[14px] font-semibold">
        {f.label}
        {f.required && <span className="text-atencion"> *</span>}
      </label>
      {input}
      {f.hint && <span id={`${id}-hint`} className="text-[13px] text-muted">{f.hint}</span>}
      {error && <span id={`${id}-err`} className="text-[13px] font-semibold text-atencion">{error}</span>}
    </div>
  );
}

function validate(fields: Field[], values: Values, t: Messages) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.name];
    const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) errors[f.name] = t.common.required;
    if (f.type === "number" && !empty) {
      const n = Number(v);
      if (Number.isNaN(n)) errors[f.name] = t.common.mustBeNumber;
      else if (f.min !== undefined && n < f.min) errors[f.name] = fmt(t.common.min, { n: f.min });
      else if (f.max !== undefined && n > f.max) errors[f.name] = fmt(t.common.max, { n: f.max });
    }
  }
  return errors;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `action` names the operation shown in the notice. */
export function EntityFormButton({
  mode,
  title,
  action,
  fields,
  initial = {},
  label,
  variant = mode === "create" ? "primary" : "secondary",
  size = "sm",
  description,
  iconOnly,
}: {
  mode: "create" | "edit";
  title: string;
  action: string;
  fields: Field[];
  initial?: Values;
  label?: string;
  variant?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "md";
  description?: string;
  iconOnly?: boolean;
}) {
  const t = useMessages();
  const { notImplemented } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const text = label ?? (mode === "create" ? title : t.common.edit);

  function openForm() {
    setValues(initial);
    setErrors({});
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(fields, values, t);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    await wait(700);
    setSaving(false);
    setOpen(false);
    notImplemented(action);
  }

  return (
    <>
      {iconOnly ? (
        <button type="button" onClick={openForm} aria-label={title} title={title} className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-linea bg-superficie hover:border-tinta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
          </svg>
        </button>
      ) : (
        <Button variant={variant} size={size} onClick={openForm}>
          {mode === "create" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          {text}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={title}
        description={description}
        size={fields.length > 6 ? "lg" : "md"}
        footer={
          <>
            <Button variant="tertiary" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="entity-form" size="sm" disabled={saving}>
              {saving ? t.common.saving : mode === "create" ? t.common.create : t.common.saveChanges}
            </Button>
          </>
        }
      >
        <form id="entity-form" onSubmit={submit} noValidate className="grid grid-cols-2 gap-x-5 gap-y-4">
          {fields.map((f) => (
            <FieldInput key={f.name} f={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => setValues((x) => ({ ...x, [f.name]: v }))} />
          ))}
        </form>
      </Modal>
    </>
  );
}

export function DeleteButton({
  title,
  action,
  name,
  consequence,
  confirmWord,
  label,
  iconOnly,
}: {
  title: string;
  action: string;
  name: string;
  consequence: string;
  /** When set, the user must type it to confirm. */
  confirmWord?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const t = useMessages();
  const text = label ?? t.common.delete;
  const { notImplemented } = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const ready = !confirmWord || typed.trim() === confirmWord;

  async function confirm() {
    setWorking(true);
    await wait(600);
    setWorking(false);
    setOpen(false);
    notImplemented(`${action} “${name}”`);
  }

  return (
    <>
      {iconOnly ? (
        <button type="button" onClick={() => { setTyped(""); setOpen(true); }} aria-label={`${text} ${name}`} title={text} className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-linea bg-superficie text-atencion hover:border-atencion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
          </svg>
        </button>
      ) : (
        <Button variant="tertiary" size="sm" className="text-atencion" onClick={() => { setTyped(""); setOpen(true); }}>
          {text}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !working && setOpen(false)}
        title={title}
        size="sm"
        footer={
          <>
            <Button variant="tertiary" size="sm" onClick={() => setOpen(false)} disabled={working}>
              {t.common.cancel}
            </Button>
            <button
              type="button"
              onClick={confirm}
              disabled={!ready || working}
              className="inline-flex h-10 items-center rounded-full border-2 border-atencion bg-atencion px-4 text-[14px] font-semibold disabled:opacity-50"
            >
              {working ? t.common.processing : fmt(t.common.yesDo, { action: text.toLowerCase() })}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-[15px]">
          <p>
            <b>{name}</b>. {consequence}
          </p>
          {confirmWord && (
            <label className="flex flex-col gap-1.5 text-[14px] font-semibold">
              {fmt(t.common.typeToConfirm, { word: confirmWord })}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${control} h-11 font-normal`} autoComplete="off" />
            </label>
          )}
        </div>
      </Modal>
    </>
  );
}

/** Actions without persistence yet, such as reorder, rotate or export. */
export function PendingAction({
  action,
  children,
  variant = "secondary",
  size = "sm",
  className,
  confirm,
}: {
  action: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "ink";
  size?: "sm" | "md";
  className?: string;
  confirm?: string;
}) {
  const t = useMessages();
  const { notImplemented } = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => (confirm ? setOpen(true) : notImplemented(action))}>
        {children}
      </Button>
      {confirm && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`${action}`}
          size="sm"
          footer={
            <>
              <Button variant="tertiary" size="sm" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
              <Button size="sm" onClick={() => { setOpen(false); notImplemented(action); }}>{t.common.confirm}</Button>
            </>
          }
        >
          <p className="text-[15px]">{confirm}</p>
        </Modal>
      )}
    </>
  );
}

/** Icon-sized variant of PendingAction. */
export function PendingIcon({ action, label, path }: { action: string; label: string; path: string }) {
  const { notImplemented } = useToast();
  return (
    <button type="button" onClick={() => notImplemented(action)} aria-label={label} title={label} className="flex size-9 items-center justify-center rounded-full border-[1.5px] border-linea bg-superficie hover:border-tinta">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}
