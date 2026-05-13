import { notFound, redirect } from 'next/navigation';
import { prisma } from '../../../../lib/prisma';
import { getValidSession } from '../../../../lib/apiAuth';
import ProfileActions from '../../../admin/users/[id]/profile-actions';

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

type WorkerUserProfilePageProps = {
  params: {
    id: string;
  };
};

export default async function WorkerUserProfilePage({ params }: WorkerUserProfilePageProps) {
  const session = await getValidSession();
  if (!session || session.role !== 'WORKER') {
    redirect('/worker/login');
  }

  const customer = await prisma.customer.findUnique({
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
  });

  if (!customer) {
    notFound();
  }

  const aadharImages = parseAadharImageUrls(customer.aadharImageUrl);

  return (
    <main className="admin-profile-page-shell">
      <div className="admin-profile-page-card">
        <div className="admin-profile-utility-row">
          <a href="/worker" className="admin-profile-back-link">
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
            <dt>Aadhar Image</dt>
            <dd>
              {aadharImages.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {aadharImages.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      Open image {index + 1}
                    </a>
                  ))}
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
          basePath="/worker"
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
      </div>
    </main>
  );
}
