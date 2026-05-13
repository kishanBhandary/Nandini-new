import { notFound } from 'next/navigation';
import { prisma } from '../../../../lib/prisma';
import ProfileActions from './profile-actions';

function parseAadharImageUrls(value: string | null | undefined): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3);
      }
    } catch {
      return [];
    }
  }

  return [trimmed];
}

type AdminUserProfilePageProps = {
  params: {
    id: string;
  };
};

const HIDDEN_ACTIVITY_FIELDS = new Set(['aadharImages', 'aadharImageUrl', 'address']);

function formatEnumValue(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function AdminUserProfilePage({ params }: AdminUserProfilePageProps) {
  const [customer, activityLogs] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        phone: true,
        aadhar: true,
        address: true,
        gasType: true,
        gasVariant: true,
        deposit: true,
        refund: true,
        aadharImageUrl: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { customerId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  if (!customer) {
    notFound();
  }

  const aadharImages = parseAadharImageUrls(customer.aadharImageUrl);
  const activityLogsForDisplay = activityLogs
    .map((log) => {
      let changes: Record<string, { from: unknown; to: unknown }> | null = null;
      try {
        if (log.changes) changes = JSON.parse(log.changes);
      } catch { /* ignore */ }

      const visibleChanges = changes
        ? Object.entries(changes).filter(([field]) => !HIDDEN_ACTIVITY_FIELDS.has(field))
        : [];

      const shouldHide = changes && visibleChanges.length === 0;
      if (shouldHide) return null;

      return { log, visibleChanges };
    })
    .filter((entry): entry is { log: (typeof activityLogs)[number]; visibleChanges: Array<[string, { from: unknown; to: unknown }]> } => entry !== null);

  return (
    <main className="admin-profile-page-shell">
      <div className="admin-profile-page-card">
        <div className="admin-profile-utility-row">
          <a href="/admin" className="admin-profile-back-link">
            Back to Dashboard
          </a>
        </div>

        <div className="admin-profile-page-header">
          <div>
            <p className="profile-kicker">Customer Profile</p>
            <h1>{customer.name}</h1>
            <p className="profile-subline">Registered on {new Date(customer.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="profile-top-stats" aria-label="Profile summary">
            <div className="profile-stat-pill">
              <span className="stat-label">Deposit</span>
              <strong>Rs. {customer.deposit}</strong>
            </div>
            <div className="profile-stat-pill">
              <span className="stat-label">Refund</span>
              <strong>Rs. {customer.refund}</strong>
            </div>
          </div>
        </div>

        <dl className="profile-list profile-list-full profile-info-grid">
          <div className="profile-info-card">
            <dt>Name</dt>
            <dd>{customer.name}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Phone</dt>
            <dd>{customer.phone}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Aadhar</dt>
            <dd>{customer.aadhar}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Address</dt>
            <dd>{customer.address}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Gas Type</dt>
            <dd>{formatEnumValue(customer.gasType)}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Gas Variant</dt>
            <dd>{formatEnumValue(customer.gasVariant)}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Deposit</dt>
            <dd>Rs. {customer.deposit}</dd>
          </div>
          <div className="profile-info-card">
            <dt>Refund</dt>
            <dd>Rs. {customer.refund}</dd>
          </div>
          <div className="profile-info-card profile-info-card-wide">
            <dt>Aadhar Image</dt>
            <dd>
              {aadharImages.length > 0 ? (
                <div className="aadhar-image-preview">
                  {aadharImages.map((url, index) => (
                    <div key={url} className="aadhar-image-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Aadhar ${index + 1} of ${customer.name}`}
                        className="aadhar-inline-img"
                      />
                      <a href={url} target="_blank" rel="noreferrer" className="aadhar-open-link">
                        Open full size {index + 1}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                'No image'
              )}
            </dd>
          </div>
          <div className="profile-info-card">
            <dt>Registered At</dt>
            <dd>{new Date(customer.createdAt).toLocaleString()}</dd>
          </div>
        </dl>

        <ProfileActions
          className="profile-actions-bottom"
          customer={{
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            aadhar: customer.aadhar,
            address: customer.address,
            gasType: customer.gasType,
            gasVariant: customer.gasVariant,
            deposit: customer.deposit,
            refund: customer.refund,
            aadharImageUrl: customer.aadharImageUrl,
            createdAt: customer.createdAt.toISOString(),
          }}
        />

        {/* Activity Log */}
        {activityLogsForDisplay.length > 0 ? (
          <section className="activity-log-section">
            <h2 className="activity-log-title">Activity History</h2>
            <div className="activity-log-list">
              {activityLogsForDisplay.map(({ log, visibleChanges }) => {
                return (
                  <div key={log.id} className="activity-log-item">
                    <div className="activity-log-header">
                      <span className={`activity-log-badge activity-log-badge-${log.action.toLowerCase()}`}>
                        {log.action}
                      </span>
                      <span className="activity-log-time">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.performedBy ? (
                        <span className="activity-log-by">by {log.performedBy}</span>
                      ) : null}
                    </div>
                    {visibleChanges.length > 0 ? (
                      <div className="activity-log-changes">
                        {visibleChanges.map(([field, { from, to }]) => (
                          <div key={field} className="activity-log-change">
                            <strong>{field}:</strong>{' '}
                            <span className="change-from">{String(from)}</span>
                            {' → '}
                            <span className="change-to">{String(to)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <style>{`
        .profile-kicker {
          margin: 0 0 0.3rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
        }
        .profile-subline {
          margin: 0.35rem 0 0;
          color: #6b7280;
          font-size: 0.9rem;
        }
        .profile-top-stats {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }
        .profile-stat-pill {
          min-width: 108px;
          border-radius: 12px;
          padding: 0.55rem 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .stat-label {
          font-size: 0.72rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .profile-stat-pill strong {
          color: #0f172a;
          font-size: 0.92rem;
        }
        .profile-info-grid {
          margin-top: 0.5rem;
          gap: 0.8rem;
        }
        .profile-info-card {
          border: 1px solid #e5e7eb;
          background: #fcfcfd;
          border-radius: 12px;
          padding: 0.8rem;
          min-width: 0;
        }
        .profile-info-card dt {
          margin: 0;
          color: #6b7280;
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 700;
        }
        .profile-info-card dd {
          margin: 0.35rem 0 0;
          color: #111827;
          font-size: 0.95rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .profile-info-card-wide {
          grid-column: 1 / -1;
        }
        .aadhar-image-preview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 0.7rem;
        }
        .aadhar-image-tile {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 0.55rem;
          background: #ffffff;
        }
        .aadhar-inline-img {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 7px;
          border: 1px solid #E5E7EB;
        }
        .aadhar-open-link {
          display: inline-block;
          margin-top: 0.45rem;
          font-size: 0.82rem;
          color: #1d4ed8;
          text-decoration: none;
          font-weight: 600;
        }
        .aadhar-open-link:hover {
          text-decoration: underline;
        }
        .activity-log-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #E5E7EB;
        }
        .activity-log-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #111827;
          margin: 0 0 1rem;
        }
        .activity-log-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .activity-log-item {
          padding: 0.95rem 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }
        .activity-log-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .activity-log-badge {
          display: inline-block;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .activity-log-badge-edit {
          background: #DBEAFE;
          color: #1D4ED8;
        }
        .activity-log-badge-cancel {
          background: #FEE2E2;
          color: #DC2626;
        }
        .activity-log-badge-create {
          background: #D1FAE5;
          color: #059669;
        }
        .activity-log-badge-deposit_change {
          background: #FEF3C7;
          color: #D97706;
        }
        .activity-log-badge-refund_change {
          background: #FCE7F3;
          color: #DB2777;
        }
        .activity-log-time {
          font-size: 0.8rem;
          color: #6B7280;
        }
        .activity-log-by {
          font-size: 0.8rem;
          color: #9CA3AF;
          font-style: italic;
        }
        .activity-log-changes {
          margin-top: 0.6rem;
          padding-left: 0.55rem;
          border-left: 2px solid #dbeafe;
        }
        .activity-log-change {
          font-size: 0.82rem;
          color: #374151;
          padding: 0.15rem 0;
        }
        .change-from {
          color: #DC2626;
          text-decoration: line-through;
        }
        .change-to {
          color: #059669;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .profile-top-stats {
            width: 100%;
          }
          .profile-stat-pill {
            flex: 1;
          }
          .aadhar-inline-img {
            height: 110px;
          }
        }
      `}</style>
    </main>
  );
}
