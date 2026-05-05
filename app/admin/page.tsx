'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getApiError, parseApiPayload } from '../../lib/apiResponse';
import s from './Dashboard.module.css';

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

type CancelledCylinder = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAadhar: string;
  gasType: string;
  gasVariant: string;
  depositAmount: number;
  refundAmount: number;
  cancelledAt: string;
  reason?: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    aadhar: string;
    address: string;
  };
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
  const [cancelledCylinders, setCancelledCylinders] = useState<CancelledCylinder[]>([]);
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
  const [cancelledSearchTerm, setCancelledSearchTerm] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<Customer | null>(null);
  const [cancelRefund, setCancelRefund] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Read section from URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section === 'cancelled' || section === 'create-admin' || section === 'all-users') {
        setActiveSection(section as DashboardSection);
      }
    }
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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
    // Fetch customers and cancelled cylinders in parallel
    setLoading(true);
    Promise.all([
      fetch('/api/customers').then(r => parseApiPayload(r)),
      fetch('/api/cancelled-cylinders').then(r => parseApiPayload(r)),
    ]).then(([custData, cancelData]) => {
      setCustomers(Array.isArray(custData.customers) ? (custData.customers as Customer[]) : []);
      setCancelledCylinders(Array.isArray(cancelData.cancelledCylinders) ? (cancelData.cancelledCylinders as CancelledCylinder[]) : []);
    }).catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Unable to load data.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const fetchCancelledCylinders = async () => {
    try {
      const response = await fetch('/api/cancelled-cylinders');
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to fetch cancelled cylinders.'));
      }
      const loadedCancelledCylinders: CancelledCylinder[] = Array.isArray(data.cancelledCylinders)
        ? (data.cancelledCylinders as CancelledCylinder[])
        : [];
      setCancelledCylinders(loadedCancelledCylinders);
    } catch (error) {
      console.error('Error fetching cancelled cylinders:', error);
    }
  };

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

  // Only fetch admins when create-admin section is opened
  useEffect(() => {
    if (activeSection === 'create-admin' && admins.length === 0 && !adminsLoading) {
      fetchAdmins();
    }
  }, [activeSection]);

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

  const cancelledCustomerIds = useMemo(() => {
    return new Set(cancelledCylinders.map((c) => c.customerId));
  }, [cancelledCylinders]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    const numericQuery = normalizedQuery.replace(/\D/g, '');

    // Hide cancelled customers from the main list
    const activeCustomers = customers.filter((customer) => !cancelledCustomerIds.has(customer.id));

    if (!normalizedQuery) {
      return activeCustomers;
    }

    return activeCustomers.filter((customer) => {
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
  }, [customers, searchTerm, cancelledCustomerIds]);

  const filteredCancelled = useMemo(() => {
    const q = cancelledSearchTerm.trim().toLowerCase();
    if (!q) return cancelledCylinders;
    const numericQ = q.replace(/\D/g, '');
    return cancelledCylinders.filter((c) => {
      const text = [c.customerName, c.gasType, c.gasVariant, c.reason ?? ''].join(' ').toLowerCase();
      const phoneDigits = c.customerPhone.replace(/\D/g, '');
      const aadharDigits = c.customerAadhar.replace(/\D/g, '');
      return (
        text.includes(q) ||
        c.customerPhone.toLowerCase().includes(q) ||
        c.customerAadhar.toLowerCase().includes(q) ||
        (numericQ.length > 0 && (phoneDigits.includes(numericQ) || aadharDigits.includes(numericQ)))
      );
    });
  }, [cancelledCylinders, cancelledSearchTerm]);

  const showUsersSection = activeSection === 'all-users';
  const showCancelledSection = activeSection === 'cancelled';
  const showCreateAdminSection = activeSection === 'create-admin';

  const openCustomerProfile = (customerId: string) => {
    router.push(`/admin/users/${customerId}`);
  };

  const openCancelModal = (customer: Customer) => {
    setCancelModal(customer);
    setCancelRefund(String(customer.deposit));
    setCancelReason('');
    setCancelError('');
  };

  const closeCancelModal = () => {
    setCancelModal(null);
    setCancelRefund('');
    setCancelReason('');
    setCancelError('');
  };

  const submitCancel = async () => {
    if (!cancelModal || cancellingId) return;
    const refundAmount = Number(cancelRefund);
    if (isNaN(refundAmount) || refundAmount < 0) {
      setCancelError('Please enter a valid refund amount.');
      return;
    }
    setCancellingId(cancelModal.id);
    setCancelError('');
    try {
      const response = await fetch(`/api/customers/${cancelModal.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmount, reason: cancelReason }),
      });
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to cancel cylinder.'));
      }
      closeCancelModal();
      const [custRes, cancelRes] = await Promise.all([
        fetch('/api/customers').then(r => parseApiPayload(r)),
        fetch('/api/cancelled-cylinders').then(r => parseApiPayload(r)),
      ]);
      setCustomers(Array.isArray(custRes.customers) ? (custRes.customers as Customer[]) : []);
      setCancelledCylinders(Array.isArray(cancelRes.cancelledCylinders) ? (cancelRes.cancelledCylinders as CancelledCylinder[]) : []);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Unable to cancel cylinder.');
    } finally {
      setCancellingId(null);
    }
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
    <div className={s.shell}>
      <div
        className={isMobileMenuOpen ? s.overlayActive : s.overlay}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* ── Mobile Header Bar ────────────────────── */}
      <div className={s.mobileHeader}>
        <button
          className={`${s.mobileToggle} ${isMobileMenuOpen ? s.mobileToggleActive : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>
        <span className={s.mobileHeaderTitle}>Nandini Enterprises</span>
      </div>

      {/* ── Sidebar ──────────────────────────────── */}
      <aside className={`${s.sidebar} ${isMobileMenuOpen ? s.sidebarOpen : ''}`}>
        <h1 className={s.brand}>Nandini Enterprises</h1>
        <p className={s.brandSub}>Gas Agency Dashboard</p>

        <nav className={s.nav}>
          <button
            type="button"
            className={`${s.navItem} ${showUsersSection ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('all-users'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            All Users
          </button>
          <button
            type="button"
            className={`${s.navItem} ${showCancelledSection ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('cancelled'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Cancelled Cylinders
          </button>
          <button
            type="button"
            className={`${s.navItem} ${showCreateAdminSection ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('create-admin'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Create Admin
          </button>
        </nav>

        <div className={s.statsCard}>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Active Users</span>
            <span className={s.statsValue}>{customers.filter(c => !cancelledCustomerIds.has(c.id)).length}</span>
          </div>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Cancelled</span>
            <span className={s.statsValue}>{cancelledCylinders.length}</span>
          </div>
        </div>

        <button className={s.downloadBtn} onClick={downloadCsv} disabled={loading || customers.length === 0}>
          Download Full Data
        </button>
      </aside>

      {/* ── Main Content ─────────────────────────── */}
      <main className={s.main}>
        {status ? <div className={s.statusError}>{status}</div> : null}
        {loading ? <p className={s.loadingText}>Loading customer data...</p> : null}

        {/* ── All Users ────────────────────────────── */}
        {!loading && showUsersSection ? (
          <>
            <header className={s.header}>
              <div className={s.headerCopy}>
                <h2 className={s.headerTitle}>All Registered Users</h2>
                <p className={s.headerSub}>Search a user and open profile to view all details</p>
              </div>
              <Link href="/register" className={s.newRegBtn}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Registration
              </Link>
            </header>

            <div className={s.searchWrap}>
              <input
                type="text"
                className={s.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone, aadhaar or address"
              />
            </div>

            <div className={s.tableCard}>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Aadhaar</th>
                      <th>Gas Type</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr><td colSpan={5} className={s.emptyCell}>No users found for this search.</td></tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id}>
                          <td>{customer.name}</td>
                          <td>{customer.phone}</td>
                          <td>{customer.aadhar}</td>
                          <td>{customer.gasType}</td>
                          <td>
                            <div className={s.actionCell}>
                              <button type="button" className={s.viewBtn} onClick={() => openCustomerProfile(customer.id)}>
                                View Profile
                              </button>
                              <button
                                type="button"
                                className={s.cancelBtn}
                                disabled={cancellingId === customer.id}
                                onClick={() => openCancelModal(customer)}
                              >
                                {cancellingId === customer.id ? 'Cancelling…' : 'Cancel Cylinder'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* ── Cancelled Cylinders ──────────────────── */}
        {!loading && showCancelledSection ? (
          <>
            <header className={s.header}>
              <div className={s.headerCopy}>
                <h2 className={s.headerTitle}>Cancelled Cylinders</h2>
                <p className={s.headerSub}>View all customers who have cancelled their cylinders</p>
              </div>
              <Link href="/register" className={s.newRegBtn}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Registration
              </Link>
            </header>

            <div className={s.searchWrap}>
              <input
                type="text"
                className={s.searchInput}
                value={cancelledSearchTerm}
                onChange={(e) => setCancelledSearchTerm(e.target.value)}
                placeholder="Search cancelled by name, phone, or aadhaar"
              />
            </div>

            <div className={s.tableCard}>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Gas Variant</th>
                      <th>Deposit</th>
                      <th>Refund</th>
                      <th>Cancelled Date</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCancelled.length === 0 ? (
                      <tr><td colSpan={8} className={s.emptyCell}>No cancelled cylinder records found.</td></tr>
                    ) : (
                      filteredCancelled.map((cancelled) => (
                        <tr key={cancelled.id}>
                          <td>{cancelled.customerName}</td>
                          <td>{cancelled.customerPhone}</td>
                          <td>{cancelled.gasVariant}</td>
                          <td>₹{cancelled.depositAmount}</td>
                          <td>₹{cancelled.refundAmount}</td>
                          <td>{new Date(cancelled.cancelledAt).toLocaleDateString()}</td>
                          <td>{cancelled.reason || '-'}</td>
                          <td>
                            <button type="button" className={s.viewBtn} onClick={() => openCustomerProfile(cancelled.customerId)}>
                              View Profile
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* ── Create Admin ─────────────────────────── */}
        {!loading && showCreateAdminSection ? (
          <div className={s.createSection}>
            <div className={s.createCard}>
              <h2 className={s.createTitle}>Add New Admin</h2>
              <p className={s.createSub}>Create a separate admin login for dashboard access.</p>
              <form onSubmit={createAdmin} className={s.form}>
                <div className={s.formGroup}>
                  <label htmlFor="admin-username" className={s.formLabel}>Admin Username</label>
                  <input
                    id="admin-username"
                    type="text"
                    className={s.formInput}
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    disabled={creatingAdmin}
                  />
                </div>
                <div className={s.formGroup}>
                  <label htmlFor="admin-password" className={s.formLabel}>Admin Password</label>
                  <input
                    id="admin-password"
                    type="password"
                    className={s.formInput}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    disabled={creatingAdmin}
                  />
                </div>
                <button type="submit" className={s.createBtn} disabled={creatingAdmin}>
                  {creatingAdmin ? 'Creating...' : 'Create Admin'}
                </button>
              </form>
              {adminMessage ? (
                <div className={`${s.message} ${adminMessage.startsWith('Success:') ? s.messageSuccess : s.messageError}`}>
                  {adminMessage}
                </div>
              ) : null}

              <div className={s.adminList}>
                <h3 className={s.adminListTitle}>Existing Admins</h3>
                {adminsStatus ? <p className={s.adminListError}>{adminsStatus}</p> : null}
                {adminsLoading ? <p className={s.loadingText}>Loading admins...</p> : null}
                {!adminsLoading ? (
                  <div className={s.tableCard}>
                    <div className={s.tableScroll}>
                      <table className={s.table}>
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admins.length === 0 ? (
                            <tr><td colSpan={2} className={s.emptyCell}>No admins found.</td></tr>
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
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* ── Cancel Cylinder Modal ──────────────────── */}
      {cancelModal ? (
        <div className={s.modalBackdrop} onClick={closeCancelModal}>
          <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.modalTitle}>Cancel Cylinder</h3>
            <p className={s.modalSub}>Cancelling for <strong>{cancelModal.name}</strong> (Deposit: ₹{cancelModal.deposit})</p>
            {cancelError ? <p className={s.modalError}>{cancelError}</p> : null}
            <div className={s.modalField}>
              <label className={s.modalLabel} htmlFor="cancel-refund">Refund Amount (₹)</label>
              <input
                id="cancel-refund"
                type="number"
                min="0"
                className={s.modalInput}
                value={cancelRefund}
                onChange={(e) => setCancelRefund(e.target.value)}
                placeholder="Enter refund amount"
                autoFocus
              />
            </div>
            <div className={s.modalField}>
              <label className={s.modalLabel} htmlFor="cancel-reason">Reason (optional)</label>
              <input
                id="cancel-reason"
                type="text"
                className={s.modalInput}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested"
              />
            </div>
            <div className={s.modalActions}>
              <button type="button" className={s.modalCancelBtn} onClick={closeCancelModal}>Go Back</button>
              <button type="button" className={s.modalConfirmBtn} disabled={!!cancellingId} onClick={submitCancel}>
                {cancellingId ? 'Processing…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
