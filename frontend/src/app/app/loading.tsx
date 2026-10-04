export default function Loading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-5 lg:px-8 lg:py-7" role="status" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="skeleton h-9 w-72" />
        <div className="skeleton h-9 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-tarjeta border-[1.5px] border-linea bg-superficie p-6">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-8 w-40" />
            <div className="skeleton h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-tarjeta border-[1.5px] border-linea bg-superficie p-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-5 grow" />
            <div className="skeleton h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
