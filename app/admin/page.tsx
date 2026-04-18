'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getApiError, parseApiPayload } from '../../lib/apiResponse';

type Customer = {
  id: string;
  name: string;
  phone: string;
  aadhar: string;
  address: string;
  gasType: string;
  gasVariant: string;
  deposit: number;
  refund: number;
  aadharImageUrl?: string;
  createdAt: string;
};

type AdminUser = {
  id: string;
  username: string;
  createdAt: string;
};

type DashboardSection = 'all-users' | 'cancelled' | 'create-admin';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>('all-users');
  const [searchTerm, setSearchTerm] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsStatus, setAdminsStatus] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }

    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isMobileMenuOpen]);

  const fetchCustomers = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch('/api/customers');
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to fetch customers.'));
      }
      const loadedCustomers: Customer[] = Array.isArray(data.customers) ? (data.customers as Customer[]) : [];
      setCustomers(loadedCustomers);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    setAdminsStatus(null);
    try {
      const response = await fetch('/api/admin/list');
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to fetch admins.'));
      }
      const loadedAdmins: AdminUser[] = Array.isArray(data.admins) ? (data.admins as AdminUser[]) : [];
      setAdmins(loadedAdmins);
    } catch (error) {
      setAdminsStatus(error instanceof Error ? error.message : 'Unable to load admins.');
    } finally {
      setAdminsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);
    setCreatingAdmin(true);

    try {
      const response = await fetch('/api/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newAdminUsername, password: newAdminPassword }),
      });

      const data = await parseApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to create admin.'));
      }

      setAdminMessage(`Success: ${typeof data.message === 'string' ? data.message : 'Admin created.'}`);
      setNewAdminUsername('');
      setNewAdminPassword('');
      await fetchAdmins();
    } catch (error) {
      setAdminMessage(`Error: ${error instanceof Error ? error.message : 'Unable to create admin.'}`);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    const numericQuery = normalizedQuery.replace(/\D/g, '');

    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter((customer) => {
      const searchableText = [customer.name, customer.address, customer.gasType, customer.gasVariant]
        .join(' ')
        .toLowerCase();
      const phoneDigits = customer.phone.replace(/\D/g, '');
      const aadharDigits = customer.aadhar.replace(/\D/g, '');

      const textMatch = searchableText.includes(normalizedQuery);
      const directValueMatch =
        customer.phone.toLowerCase().includes(normalizedQuery) || customer.aadhar.toLowerCase().includes(normalizedQuery);
      const numericMatch = numericQuery.length > 0 && (phoneDigits.includes(numericQuery) || aadharDigits.includes(numericQuery));

      return textMatch || directValueMatch || numericMatch;
    });
  }, [customers, searchTerm]);

  const cancelledCustomers = useMemo(() => {
    return customers.filter((customer) => customer.refund > 0);
  }, [customers]);

  const showUsersSection = activeSection === 'all-users';
  const showCancelledSection = activeSection === 'cancelled';
  const showCreateAdminSection = activeSection === 'create-admin';

  const openCustomerProfile = (customerId: string) => {
    router.push(`/admin/users/${customerId}`);
  };

  const downloadCsv = () => {
    const headers = [
      'Name',
      'Phone',
      'Aadhar',
      'Address',
      'Gas Type',
      'Gas Variant',
      'Deposit',
      'Refund',
      'Aadhar Image URL',
      'Saved At',
    ];
    const rows = customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.aadhar,
      customer.address,
      customer.gasType,
      customer.gasVariant,
      customer.deposit.toString(),
      customer.refund.toString(),
      customer.aadharImageUrl ?? '',
      new Date(customer.createdAt).toISOString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers-data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className={`admin-dashboard-shell ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      <div 
        className={`mobile-menu-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>
      
      <button 
        className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>
      
      <aside className={`admin-dashboard-menu ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        <h1 className="dashboard-brand">Nandini Enterprises</h1>

        <nav className="dashboard-nav">
          <button
            type="button"
            className={`dashboard-nav-item ${showUsersSection ? 'active' : ''}`}
            onClick={() => {
              setActiveSection('all-users');
              setIsMobileMenuOpen(false);
            }}
          >
            All Users
          </button>
          <button
            type="button"
            className={`dashboard-nav-item ${showCancelledSection ? 'active' : ''}`}
            onClick={() => {
              setActiveSection('cancelled');
              setIsMobileMenuOpen(false);
            }}
          >
            Cancelled Cylinders
          </button>
          <button
            type="button"
            className={`dashboard-nav-item ${showCreateAdminSection ? 'active' : ''}`}
            onClick={() => {
              setActiveSection('create-admin');
              setIsMobileMenuOpen(false);
            }}
          >
            Create Admin
          </button>
        </nav>

        <div className="menu-stats">
          <p>Total users: {customers.length}</p>
          <p>Cancelled cylinders: {cancelledCustomers.length}</p>
        </div>

        <button className="download-button" onClick={downloadCsv} disabled={loading || customers.length === 0}>
          Download Full Data
        </button>
      </aside>

      <section className="admin-dashboard-content">
        {status ? <div className="status error">{status}</div> : null}

        {loading ? <p>Loading customer data...</p> : null}

        {!loading && showUsersSection ? (
          <>
            <header className="dashboard-header">
              <div className="dashboard-header-copy">
                <h2>All Registered Users</h2>
                <p>Search a user and open profile to view all details.</p>
              </div>
              <Link href="/register" className="dashboard-register-link">
                New Registration
              </Link>
            </header>

            <div className="search-bar dashboard-search-bar">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, phone, aadhar or address"
              />
            </div>

            <div className="table-wrapper dashboard-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Aadhar</th>
                    <th>Gas Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No users found for this search.</td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.name}</td>
                        <td>{customer.phone}</td>
                        <td>{customer.aadhar}</td>
                        <td>{customer.gasType}</td>
                        <td>
                          <button type="button" className="view-profile-button" onClick={() => openCustomerProfile(customer.id)}>
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {!loading && showCancelledSection ? (
          <>
            <header className="dashboard-header">
              <div className="dashboard-header-copy">
                <h2>Cancelled Cylinders</h2>
                <p>Users with refund amount are shown here as cancelled cylinder entries.</p>
              </div>
              <Link href="/register" className="dashboard-register-link">
                New Registration
              </Link>
            </header>

            <div className="table-wrapper dashboard-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Gas Variant</th>
                    <th>Refund</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No cancelled cylinder records found.</td>
                    </tr>
                  ) : (
                    cancelledCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.name}</td>
                        <td>{customer.phone}</td>
                        <td>{customer.gasVariant}</td>
                        <td>Rs. {customer.refund}</td>
                        <td>
                          <button type="button" className="view-profile-button" onClick={() => openCustomerProfile(customer.id)}>
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {!loading && showCreateAdminSection ? (
          <section className="admin-creation-section admin-creation-full">
            <h2>Add New Admin</h2>
            <p>Create a separate admin login for dashboard access.</p>
            <form onSubmit={createAdmin} className="admin-form">
              <div className="form-group">
                <label htmlFor="admin-username">Admin Username</label>
                <input
                  id="admin-username"
                  type="text"
                  value={newAdminUsername}
                  onChange={(event) => setNewAdminUsername(event.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={creatingAdmin}
                />
              </div>
              <div className="form-group">
                <label htmlFor="admin-password">Admin Password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={newAdminPassword}
                  onChange={(event) => setNewAdminPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={creatingAdmin}
                />
              </div>
              <button type="submit" className="create-admin-button" disabled={creatingAdmin}>
                {creatingAdmin ? 'Creating...' : 'Create Admin'}
              </button>
            </form>
            {adminMessage ? (
              <div className={`admin-message ${adminMessage.startsWith('Success:') ? 'success' : 'error'}`}>{adminMessage}</div>
            ) : null}

            <div className="admin-list-section">
              <h3>Existing Admins</h3>
              {adminsStatus ? <p className="admin-list-error">{adminsStatus}</p> : null}
              {adminsLoading ? <p>Loading admins...</p> : null}
              {!adminsLoading ? (
                <div className="table-wrapper admin-list-table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.length === 0 ? (
                        <tr>
                          <td colSpan={2}>No admins found.</td>
                        </tr>
                      ) : (
                        admins.map((admin) => (
                          <tr key={admin.id}>
                            <td>{admin.username}</td>
                            <td>{new Date(admin.createdAt).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
