import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '../../../../lib/prisma';
import ProfileActions from './profile-actions';

type AdminUserProfilePageProps = {
  params: {
    id: string;
  };
};

export default async function AdminUserProfilePage({ params }: AdminUserProfilePageProps) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
  });

  if (!customer) {
    notFound();
  }

  return (
    <main className="admin-profile-page-shell">
      <div className="admin-profile-page-card">
        <div className="admin-profile-utility-row">
          <Link href="/admin" className="admin-profile-back-link">
            Back to Dashboard
          </Link>
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
                <a href={customer.aadharImageUrl} target="_blank" rel="noreferrer">
                  Open image
                </a>
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
      </div>
    </main>
  );
}
