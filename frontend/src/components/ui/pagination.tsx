import Link from "next/link";
import { fmt } from "@/i18n/config";
import { getMessages } from "@/i18n/server";

/** Keeps the current filters in every page link. */
export async function Pagination({
  page,
  pageSize,
  total,
  params,
  basePath,
  anchor,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
  /** Element id to land on, so paging a section lower on the page keeps it in view. */
  anchor?: string;
}) {
  const t = await getMessages();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    q.set("page", String(p));
    return `${basePath}?${q.toString()}${anchor ? `#${anchor}` : ""}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const numbers = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);

  const btn = "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-[14px] font-semibold";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={t.pagination.label}>
      <span className="text-[14px] text-muted">
        <span className="tabular">{fmt(t.pagination.range, { from: from.toLocaleString(), to: to.toLocaleString(), total: total.toLocaleString() })}</span>
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} border-[1.5px] border-linea bg-superficie hover:border-tinta`}>{t.pagination.prev}</Link>
        ) : (
          <span className={`${btn} border-[1.5px] border-linea text-muted opacity-50`}>{t.pagination.prev}</span>
        )}
        {numbers.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`${btn} tabular ${n === page ? "border-2 border-tinta bg-marca" : "border-[1.5px] border-linea bg-superficie hover:border-tinta"}`}>
              {n}
            </Link>
          </span>
        ))}
        {page < pages ? (
          <Link href={href(page + 1)} className={`${btn} border-[1.5px] border-linea bg-superficie hover:border-tinta`}>{t.pagination.next}</Link>
        ) : (
          <span className={`${btn} border-[1.5px] border-linea text-muted opacity-50`}>{t.pagination.next}</span>
        )}
      </div>
    </nav>
  );
}
