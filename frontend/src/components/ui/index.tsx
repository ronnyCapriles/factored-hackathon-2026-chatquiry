import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "ink";
type Size = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "border-2 border-tinta bg-marca text-tinta font-bold hover:brightness-95",
  secondary: "border-2 border-tinta bg-superficie text-tinta font-semibold hover:bg-fondo",
  tertiary: "border-0 bg-transparent text-tinta font-semibold underline underline-offset-4",
  ink: "border-2 border-tinta bg-tinta text-fondo font-semibold hover:opacity-90",
};
const SIZE: Record<Size, string> = { md: "h-12 px-7 text-[16px]", sm: "h-10 px-4 text-[14px]" };

function cls(variant: Variant, size: Size, extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap transition disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={cls(variant, size, className)} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={cls(variant, size, className)} />;
}

export function Card({
  children,
  emphasis,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  emphasis?: boolean;
  className?: string;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag
      className={`rounded-tarjeta bg-superficie ${emphasis ? "border-2 border-tinta" : "border-[1.5px] border-linea"} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`etiqueta ${className}`}>{children}</span>;
}

export function Perforado({ className = "" }: { className?: string }) {
  return <div className={`perforado ${className}`} aria-hidden="true" />;
}

export function Avatar({
  initials,
  src,
  tone = "light",
  size = 38,
}: {
  initials: string;
  src?: string;
  tone?: "light" | "ink" | "brand";
  size?: number;
}) {
  const tones = {
    light: "bg-marca-suave border-[1.5px] border-punto text-tinta",
    ink: "bg-tinta text-fondo",
    brand: "bg-marca border-2 border-tinta text-tinta",
  };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars are small data URLs
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full border-2 border-tinta object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tones[tone]}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`-mx-3 overflow-x-auto ${className}`}>
      <table className="w-full border-separate border-spacing-0 text-[14px] [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-2">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <th className={`etiqueta border-b-[1.5px] border-linea font-semibold ${align === "right" ? "text-right" : "text-left"} ${className}`}>{children}</th>;
}

export function Td({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`border-b border-linea-2 align-middle ${align === "right" ? "text-right" : ""} ${className}`}>{children}</td>;
}

export function KeyValue({ k, v, mono }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[14px]">
      <span>{k}</span>
      <span className={mono ? "tabular text-[13px] text-muted" : "font-semibold text-right"}>{v}</span>
    </div>
  );
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-[28px] font-bold tracking-tight">{children}</h1>
      {aside}
    </div>
  );
}

export { ReadOnlyBadge, StateChip } from "./client";
