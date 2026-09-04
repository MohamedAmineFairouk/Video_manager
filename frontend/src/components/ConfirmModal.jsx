export default function ConfirmModal({ open, text, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal-overlay" style={{ zIndex: 10500 }} onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="confirm-box">
        <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700, color: '#dbeafe' }}>Confirmer la suppression</h3>
        <p style={{ color: '#e0f2fe', margin: 0, fontSize: 14, lineHeight: 1.5 }}>{text}</p>
        <div className="confirm-actions">
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={onCancel}>Annuler</button>
          <button className="btn" style={{ width: 'auto', background: 'linear-gradient(135deg, #0080ff, #dc2626)' }} onClick={onConfirm}>Supprimer</button>
        </div>
      </div>
    </div>
  )
}
