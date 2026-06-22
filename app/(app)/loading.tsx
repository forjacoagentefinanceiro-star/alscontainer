export default function Loading() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '40vh' }}>
      <div className="animate-spin rounded-full" style={{ width: 34, height: 34, border: '3px solid #e5e7eb', borderTopColor: '#1B4F8A' }} />
    </div>
  )
}
