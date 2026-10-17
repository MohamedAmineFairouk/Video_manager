// `scrollToTop` : après le changement de page, remonte en haut (utile pour la pagination
// placée sous la grille). La page défile soit dans la fenêtre, soit dans `.content`.
export default function Pagination({ page, totalPages, onChange, scrollToTop = false }) {
  if (totalPages <= 1) return null

  const go = (p, e) => {
    onChange(p)
    if (!scrollToTop) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    e.currentTarget.closest('.content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  const pages = []
  for (let p = start; p <= end; p++) pages.push(p)

  return (
    <div className="pagination">
      <button className="page-btn" disabled={page <= 1} onClick={(e) => go(page - 1, e)}>Préc</button>
      {pages.map((p) => (
        <button
          key={p}
          className={`page-btn ${p === page ? 'active' : ''}`}
          onClick={(e) => go(p, e)}
        >{p}</button>
      ))}
      <button className="page-btn" disabled={page >= totalPages} onClick={(e) => go(page + 1, e)}>Suiv</button>
    </div>
  )
}
