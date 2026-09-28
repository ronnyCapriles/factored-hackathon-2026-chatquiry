export default function Loading() {
  return (
    <div className="grid h-full grow grid-cols-[330px_minmax(0,1fr)_380px]" role="status" aria-busy="true">
      <div className="flex flex-col gap-3 border-r-[1.5px] border-linea bg-superficie p-4">
        <div className="skeleton h-11 rounded-full" />
        <div className="skeleton h-20" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[84px]" />
        ))}
      </div>
      <div className="flex flex-col justify-end gap-3 p-6">
        <div className="skeleton h-12 w-2/3" />
        <div className="skeleton h-12 w-1/2 self-end" />
        <div className="skeleton h-12 w-3/5" />
        <div className="skeleton mt-4 h-12 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 border-l-[1.5px] border-linea bg-superficie p-5">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
    </div>
  );
}
