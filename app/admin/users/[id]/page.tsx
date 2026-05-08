import { notFound } from 'next/navigation';
import { prisma } from '../../../../lib/prisma';
import ProfileActions from './profile-actions';

type AdminUserProfilePageProps = {
  params: {
    id: string;
  };
};

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

  return (
    <main className="admin-profile-page-shell">
      <div className="admin-profile-page-card">
        <div className="admin-profile-utility-row">
          <a href="/admin" className="admin-profile-back-link">
            Back to Dashboard
          </a>
        </div>

        <div className="admin-profile-page-header">
          <h1>User Profile</h1>
        </div>

        <dl className="profile-list profile-list-full">
          <div>
            <dt>Name</dt>
            <dd>{customer.name}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{customer.phone}</dd>
          </div>
          <div>
            <dt>Aadhar</dt>
            <dd>{customer.aadhar}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{customer.address}</dd>
          </div>
          <div>
            <dt>Gas Type</dt>
            <dd>{customer.gasType}</dd>
          </div>
          <div>
            <dt>Gas Variant</dt>
            <dd>{customer.gasVariant}</dd>
          </div>
          <div>
            <dt>Deposit</dt>
            <dd>Rs. {customer.deposit}</dd>
          </div>
          <div>
            <dt>Refund</dt>
            <dd>Rs. {customer.refund}</dd>
          </div>
          <div>
            <dt>Cancelled Cylinder</dt>
            <dd>{customer.refund > 0 ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Aadhar Image</dt>
            <dd>
              {customer.aadharImageUrl ? (
                <div className="aadhar-image-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={customer.aadharImageUrl}
                    alt={`Aadhar of ${customer.name}`}
                    className="aadhar-inline-img"
                  />
                  <a href={customer.aadharImageUrl} target="_blank" rel="noreferrer" className="aadhar-open-link">
                    Open full size
                  </a>
                </div>
              ) : (
                'No image'
              )}
            </dd>
          </div>
          <div>
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
        {activityLogs.length > 0 ? (
          <section className="activity-log-section">
            <h2 className="activity-log-title">Activity History</h2>
            <div className="activity-log-list">
              {activityLogs.map((log) => {
                let changes: Record<string, { from: unknown; to: unknown }> | null = null;
                try {
                  if (log.changes) changes = JSON.parse(log.changes);
                } catch { /* ignore */ }

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
                    {changes ? (
                      <div className="activity-log-changes">
                        {Object.entries(changes).map(([field, { from, to }]) => (
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
        .aadhar-image-preview {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .aadhar-inline-img {
          max-width: 280px;
          max-height: 200px;
          object-fit: contain;
          border-radius: 8px;
          border: 1px solid #E5E7EB;
        }
        .aadhar-open-link {
          font-size: 0.85rem;
          color: #2563EB;
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
          padding: 0.85rem 1rem;
          background: #F9FAFB;
          border: 1px solid #F3F4F6;
          border-radius: 10px;
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
          margin-top: 0.5rem;
          padding-left: 0.5rem;
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
      `}</style>
    </main>
  );
}
