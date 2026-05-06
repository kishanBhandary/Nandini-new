'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getApiError, parseApiPayload } from '../../lib/apiResponse';
import s from '../admin/Dashboard.module.css';

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
};

type WorkerSection = 'customers' | 'cancelled' | 'pending-cylinders';

type PendingRefill = {
  id: string;
  customerId: string;
  amount: number;
  cylinderReturned: boolean;
  performedBy: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    aadhar: string;
    gasType: string;
    gasVariant: string;
  };
};

export default function WorkerDashboardPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<WorkerSection>('customers');
  const [search, setSearch] = useState('');
  const [cancelledSearch, setCancelledSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cancelledCylinders, setCancelledCylinders] = useState<CancelledCylinder[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<Customer | null>(null);
  const [cancelRefund, setCancelRefund] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Pending cylinders
  const [pendingRefills, setPendingRefills] = useState<PendingRefill[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/customers?hasTransaction=true').then(r => parseApiPayload(r)),
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

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const cancelledCustomerIds = useMemo(() => {
    return new Set(cancelledCylinders.map((c) => c.customerId));
  }, [cancelledCylinders]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const url = `/api/customers?hasTransaction=true${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
      const response = await fetch(url);
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to fetch customers.'));
      }
      setCustomers(Array.isArray(data.customers) ? (data.customers as Customer[]) : []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  };

  // Filter out cancelled customers from main list
  const activeCustomers = useMemo(() => {
    return customers.filter((c) => !cancelledCustomerIds.has(c.id));
  }, [customers, cancelledCustomerIds]);

  // Search within cancelled cylinders
  const filteredCancelled = useMemo(() => {
    const q = cancelledSearch.trim().toLowerCase();
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
  }, [cancelledCylinders, cancelledSearch]);

  const openCustomerProfile = (customerId: string) => {
    router.push(`/worker/users/${customerId}`);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
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
        fetch(`/api/customers?hasTransaction=true&_t=${Date.now()}`, { cache: 'no-store' }).then(r => parseApiPayload(r)),
        fetch(`/api/cancelled-cylinders?_t=${Date.now()}`, { cache: 'no-store' }).then(r => parseApiPayload(r)),
      ]);
      setCustomers(Array.isArray(custRes.customers) ? (custRes.customers as Customer[]) : []);
      setCancelledCylinders(Array.isArray(cancelRes.cancelledCylinders) ? (cancelRes.cancelledCylinders as CancelledCylinder[]) : []);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Unable to cancel cylinder.');
    } finally {
      setCancellingId(null);
    }
  };

  const showCustomers = activeSection === 'customers';
  const showCancelled = activeSection === 'cancelled';
  const showPending = activeSection === 'pending-cylinders';

  // Fetch pending cylinders when section becomes active
  useEffect(() => {
    if (showPending && pendingRefills.length === 0) {
      setPendingLoading(true);
      fetch('/api/pending-cylinders')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data.pendingRefills)) setPendingRefills(data.pendingRefills);
        })
        .catch(() => {})
        .finally(() => setPendingLoading(false));
    }
  }, [showPending, pendingRefills.length]);

  const markCylinderReturned = async (refill: PendingRefill) => {
    try {
      const res = await fetch(`/api/customers/${refill.customerId}/refill`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refillId: refill.id, cylinderReturned: true }),
      });
      if (!res.ok) throw new Error('Failed');
      setPendingRefills(prev => prev.filter(r => r.id !== refill.id));
    } catch { /* ignore */ }
  };

  const filteredPending = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase();
    if (!q) return pendingRefills;
    return pendingRefills.filter(r => {
      const text = [r.customer.name, r.customer.phone, r.customer.aadhar, r.customer.gasType, r.customer.gasVariant].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [pendingRefills, pendingSearch]);

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
        <span className={s.mobileHeaderTitle}>Nandini Worker</span>
      </div>

      {/* ── Sidebar ──────────────────────────────── */}
      <aside className={`${s.sidebar} ${isMobileMenuOpen ? s.sidebarOpen : ''}`}>
        <h1 className={s.brand}>Nandini Worker</h1>
        <p className={s.brandSub}>Worker Dashboard</p>

        <nav className={s.nav}>
          <button
            type="button"
            className={`${s.navItem} ${showCustomers ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('customers'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Customer Search
          </button>
          <button
            type="button"
            className={`${s.navItem} ${showCancelled ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('cancelled'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Cancelled Cylinders
          </button>
          <button
            type="button"
            className={`${s.navItem} ${showPending ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('pending-cylinders'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Cylinders
            {pendingRefills.length > 0 && <span style={{ marginLeft: 'auto', background: '#F59E0B', color: '#fff', borderRadius: '9999px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>{pendingRefills.length}</span>}
          </button>
        </nav>

        {deferredPrompt ? (
          <button
            type="button"
            className={s.navItem}
            onClick={() => { handleInstall(); setIsMobileMenuOpen(false); }}
            style={{ marginTop: '0.5rem', color: '#2563EB', fontWeight: 600 }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Install App
          </button>
        ) : null}

        <div className={s.statsCard}>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Active Customers</span>
            <span className={s.statsValue}>{activeCustomers.length}</span>
          </div>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Cancelled</span>
            <span className={s.statsValue}>{cancelledCylinders.length}</span>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────── */}
      <main className={s.main}>
        {status ? <div className={s.statusError}>{status}</div> : null}
        {loading ? <p className={s.loadingText}>Loading...</p> : null}

        {/* ── Customer Search ──────────────────────── */}
        {!loading && showCustomers ? (
          <>
            <header className={s.header}>
              <div className={s.headerCopy}>
                <h2 className={s.headerTitle}>Customer Records</h2>
                <p className={s.headerSub}>Search, filter, and open profile details</p>
              </div>
              <Link href="/register" className={s.newRegBtn}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Registration
              </Link>
            </header>

            <form className={s.searchWrap} onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className={s.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, aadhaar, or phone"
                style={{ flex: 1 }}
              />
              <button type="submit" className={s.viewBtn} style={{ padding: '0.7rem 1.2rem', fontSize: '0.88rem' }}>
                Search
              </button>
            </form>

            <div className={s.tableCard}>
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Aadhaar</th>
                      <th>Gas Type</th>
                      <th>Deposit</th>
                      <th>Refund</th>
                      <th>Saved At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCustomers.length === 0 ? (
                      <tr><td colSpan={8} className={s.emptyCell}>No records found.</td></tr>
                    ) : (
                      activeCustomers.map((customer) => (
                        <tr key={customer.id}>
                          <td>{customer.name}</td>
                          <td>{customer.phone}</td>
                          <td>{customer.aadhar}</td>
                          <td>{customer.gasType}</td>
                          <td>₹{customer.deposit}</td>
                          <td>₹{customer.refund}</td>
                          <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
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
        {!loading && showCancelled ? (
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
                value={cancelledSearch}
                onChange={(e) => setCancelledSearch(e.target.value)}
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCancelled.length === 0 ? (
                      <tr><td colSpan={7} className={s.emptyCell}>No cancelled cylinder records found.</td></tr>
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {/* ── Pending Cylinders ────────────────────── */}
        {!loading && showPending ? (
          <>
            <header className={s.header}>
              <div className={s.headerCopy}>
                <h2 className={s.headerTitle}>Pending Cylinders</h2>
                <p className={s.headerSub}>Customers who have not returned their empty cylinder after refill</p>
              </div>
            </header>

            <div className={s.searchWrap}>
              <input
                type="text"
                className={s.searchInput}
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Search by name, phone, or aadhaar"
              />
            </div>

            {pendingLoading ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>Loading…</p>
            ) : (
              <div className={s.tableCard}>
                <div className={s.tableScroll}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Gas Type</th>
                        <th>Refill Amount</th>
                        <th>Refill Date</th>
                        <th>Added By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPending.length === 0 ? (
                        <tr><td colSpan={7} className={s.emptyCell}>No pending cylinders found.</td></tr>
                      ) : (
                        filteredPending.map((r) => (
                          <tr key={r.id}>
                            <td>{r.customer.name}</td>
                            <td>{r.customer.phone}</td>
                            <td>{r.customer.gasVariant}</td>
                            <td>₹{r.amount}</td>
                            <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                            <td>{r.performedBy || '-'}</td>
                            <td>
                              <div className={s.actionCell}>
                                <button type="button" className={s.viewBtn} onClick={() => openCustomerProfile(r.customer.id)}>
                                  View
                                </button>
                                <button
                                  type="button"
                                  className={s.viewBtn}
                                  style={{ background: '#059669', color: '#fff' }}
                                  onClick={() => markCylinderReturned(r)}
                                >
                                  Mark Returned
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
            )}
          </>
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
