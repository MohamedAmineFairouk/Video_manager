export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  const pages = []
  for (let p = start; p <= end; p++) pages.push(p)

  return (
    <div className="pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>Préc</button>
      {pages.map((p) => (
        <button
          key={p}
          className={`page-btn ${p === page ? 'active' : ''}`}
          onClick={() => onChange(p)}
        >{p}</button>
      ))}
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Suiv</button>
    </div>
  )
}
