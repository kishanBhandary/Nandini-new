export default function ProfileLoading() {
  return (
    <main className="admin-profile-page-shell">
      <div className="admin-profile-page-card">
        <div className="admin-profile-utility-row">
          <span style={{ display: 'inline-block', width: 130, height: 16, background: '#e5e7eb', borderRadius: 4 }} />
        </div>
        <div className="admin-profile-page-header">
          <h1 style={{ color: '#d1d5db' }}>Loading profile…</h1>
        </div>
        <dl className="profile-list profile-list-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <dt style={{ background: '#e5e7eb', width: 80, height: 14, borderRadius: 4 }} />
              <dd style={{ background: '#f3f4f6', width: 180, height: 14, borderRadius: 4, marginTop: 4 }} />
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
