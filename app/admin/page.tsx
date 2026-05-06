'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getApiError, parseApiPayload } from '../../lib/apiResponse';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
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

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type DuplicateGroup = {
  value: string;
  count: number;
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    aadhar: string;
    address: string;
    gasType: string;
    createdAt: string;
  }>;
};

type DuplicatesData = {
  aadhar: { count: number; groups: DuplicateGroup[] };
  phone: { count: number; groups: DuplicateGroup[] };
};

type DashboardSection = 'dashboard' | 'all-users' | 'cancelled' | 'create-admin' | 'create-worker' | 'duplicates';

type DateRange = '7d' | '30d' | '90d' | 'all';

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
  const [newWorkerUsername, setNewWorkerUsername] = useState('');
  const [newWorkerPassword, setNewWorkerPassword] = useState('');
  const [creatingWorker, setCreatingWorker] = useState(false);
  const [workerMessage, setWorkerMessage] = useState<string | null>(null);
  const [workers, setWorkers] = useState<AdminUser[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [workersStatus, setWorkersStatus] = useState<string | null>(null);

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });

  // Date range for dashboard
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // Duplicates
  const [duplicatesData, setDuplicatesData] = useState<DuplicatesData | null>(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);

  // Aadhar image modal
  const [aadharModal, setAadharModal] = useState<{ name: string; url: string } | null>(null);

  // Edit customer modal
  const [editModal, setEditModal] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  // Init dark mode from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard-dark-mode');
      if (saved === 'true') setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-dark-mode', String(darkMode));
    }
  }, [darkMode]);

  // Read section from URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section === 'dashboard' || section === 'cancelled' || section === 'create-admin' || section === 'create-worker' || section === 'all-users' || section === 'duplicates') {
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

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/customers?page=${page}&limit=50`);
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to fetch customers.'));
      }
      const loadedCustomers: Customer[] = Array.isArray(data.customers) ? (data.customers as Customer[]) : [];
      setCustomers(loadedCustomers);
      if (data.pagination) {
        setPagination(data.pagination as Pagination);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch customers and cancelled cylinders in parallel
    setLoading(true);
    Promise.all([
      fetch('/api/customers?page=1&limit=50').then(r => parseApiPayload(r)),
      fetch('/api/cancelled-cylinders').then(r => parseApiPayload(r)),
    ]).then(([custData, cancelData]) => {
      setCustomers(Array.isArray(custData.customers) ? (custData.customers as Customer[]) : []);
      if (custData.pagination) setPagination(custData.pagination as Pagination);
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
  }, [activeSection, admins.length, adminsLoading]);

  const fetchWorkers = async () => {
    setWorkersLoading(true);
    setWorkersStatus(null);
    try {
      const response = await fetch('/api/worker/list');
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to fetch workers.'));
      }
      const loadedWorkers: AdminUser[] = Array.isArray(data.workers) ? (data.workers as AdminUser[]) : [];
      setWorkers(loadedWorkers);
    } catch (error) {
      setWorkersStatus(error instanceof Error ? error.message : 'Unable to load workers.');
    } finally {
      setWorkersLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'create-worker' && workers.length === 0 && !workersLoading) {
      fetchWorkers();
    }
  }, [activeSection, workers.length, workersLoading]);

  // Fetch duplicates when section is opened
  useEffect(() => {
    if (activeSection === 'duplicates' && !duplicatesData && !duplicatesLoading) {
      setDuplicatesLoading(true);
      fetch('/api/customers/duplicates')
        .then(r => parseApiPayload(r))
        .then(data => {
          if (data.duplicates) {
            setDuplicatesData(data.duplicates as DuplicatesData);
          }
        })
        .catch(console.error)
        .finally(() => setDuplicatesLoading(false));
    }
  }, [activeSection, duplicatesData, duplicatesLoading]);

  const createWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerMessage(null);
    setCreatingWorker(true);

    try {
      const response = await fetch('/api/worker/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newWorkerUsername, password: newWorkerPassword }),
      });

      const data = await parseApiPayload(response);

      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to create worker.'));
      }

      setWorkerMessage(`Success: ${typeof data.message === 'string' ? data.message : 'Worker created.'}`);
      setNewWorkerUsername('');
      setNewWorkerPassword('');
      await fetchWorkers();
    } catch (error) {
      setWorkerMessage(`Error: ${error instanceof Error ? error.message : 'Unable to create worker.'}`);
    } finally {
      setCreatingWorker(false);
    }
  };

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

  const showDashboardSection = activeSection === 'dashboard';
  const showUsersSection = activeSection === 'all-users';
  const showCancelledSection = activeSection === 'cancelled';
  const showCreateAdminSection = activeSection === 'create-admin';
  const showCreateWorkerSection = activeSection === 'create-worker';
  const showDuplicatesSection = activeSection === 'duplicates';

  // ── Date range filtering ──
  const getDateRangeFilter = useCallback((range: DateRange) => {
    if (range === 'all') return null;
    const now = new Date();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }, []);

  // ── Analytics data ──
  const activeUsers = useMemo(() => customers.filter(c => !cancelledCustomerIds.has(c.id)), [customers, cancelledCustomerIds]);

  const dateFilteredCustomers = useMemo(() => {
    const cutoff = getDateRangeFilter(dateRange);
    if (!cutoff) return customers;
    return customers.filter(c => new Date(c.createdAt) >= cutoff);
  }, [customers, dateRange, getDateRangeFilter]);

  const dateFilteredCancelled = useMemo(() => {
    const cutoff = getDateRangeFilter(dateRange);
    if (!cutoff) return cancelledCylinders;
    return cancelledCylinders.filter(c => new Date(c.cancelledAt) >= cutoff);
  }, [cancelledCylinders, dateRange, getDateRangeFilter]);

  const dateFilteredActive = useMemo(() => {
    return dateFilteredCustomers.filter(c => !cancelledCustomerIds.has(c.id));
  }, [dateFilteredCustomers, cancelledCustomerIds]);

  const gasTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredActive.forEach(c => {
      const label = c.gasType.replace(/_/g, ' ');
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [dateFilteredActive]);

  const gasVariantData = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredActive.forEach(c => {
      const label = c.gasVariant.replace(/_/g, ' ');
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [dateFilteredActive]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { registrations: number; cancellations: number }> = {};
    dateFilteredCustomers.forEach(c => {
      const d = new Date(c.createdAt);
      const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      if (!map[key]) map[key] = { registrations: 0, cancellations: 0 };
      map[key].registrations++;
    });
    dateFilteredCancelled.forEach(c => {
      const d = new Date(c.cancelledAt);
      const key = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      if (!map[key]) map[key] = { registrations: 0, cancellations: 0 };
      map[key].cancellations++;
    });
    return Object.entries(map)
      .sort((a, b) => {
        const parse = (s: string) => { const [m, y] = s.split(' '); return new Date(`${m} 1, ${y}`).getTime(); };
        return parse(a[0]) - parse(b[0]);
      })
      .map(([month, data]) => ({ month, ...data }));
  }, [dateFilteredCustomers, dateFilteredCancelled]);

  const totalDeposits = useMemo(() => dateFilteredActive.reduce((sum, c) => sum + c.deposit, 0), [dateFilteredActive]);
  const totalRefunds = useMemo(() => dateFilteredCancelled.reduce((sum, c) => sum + c.refundAmount, 0), [dateFilteredCancelled]);

  const PIE_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6'];
  const BAR_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

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
        fetch(`/api/customers?page=${pagination.page}&limit=50`).then(r => parseApiPayload(r)),
        fetch('/api/cancelled-cylinders').then(r => parseApiPayload(r)),
      ]);
      setCustomers(Array.isArray(custRes.customers) ? (custRes.customers as Customer[]) : []);
      if (custRes.pagination) setPagination(custRes.pagination as Pagination);
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

  // ── Pagination handler ──
  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchCustomers(page);
  };

  // ── Edit customer ──
  const openEditModal = (customer: Customer) => {
    setEditModal(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      aadhar: customer.aadhar,
      address: customer.address,
      gasType: customer.gasType,
      gasVariant: customer.gasVariant,
      deposit: customer.deposit,
      refund: customer.refund,
    });
    setEditMessage(null);
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditForm({});
    setEditMessage(null);
  };

  const submitEdit = async () => {
    if (!editModal || editLoading) return;
    setEditLoading(true);
    setEditMessage(null);
    try {
      const response = await fetch(`/api/customers/${editModal.id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, performedBy: 'admin' }),
      });
      const data = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(getApiError(data, 'Failed to update customer.'));
      }
      setEditMessage('Success: Customer updated successfully.');
      // Refresh customer list
      fetchCustomers(pagination.page);
      setTimeout(closeEditModal, 1200);
    } catch (error) {
      setEditMessage(`Error: ${error instanceof Error ? error.message : 'Unable to update.'}`);
    } finally {
      setEditLoading(false);
    }
  };

  const GAS_TYPES = ['KONKAN', 'TOTAL_GAS', 'HP_GAS', 'INDIAN_GAS', 'BHARATH_GAS'];
  const GAS_VARIANTS: Record<string, string[]> = {
    KONKAN: ['KONKAN_17_KG', 'KONKAN_12_KG', 'KONKAN_5_5_KG'],
    TOTAL_GAS: ['TOTAL_17_KG', 'TOTAL_12_KG'],
    HP_GAS: ['HP_19_KG', 'HP_5_KG'],
    INDIAN_GAS: ['INDIAN_19_KG', 'INDIAN_5_KG', 'INDIAN_17_KG', 'INDIAN_12_KG'],
    BHARATH_GAS: ['BHARATH_19_KG', 'BHARATH_5_KG'],
  };

  return (
    <div className={`${s.shell} ${darkMode ? s.dark : ''}`}>
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
        <button className={s.darkToggleBtn} onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode" title={darkMode ? 'Light mode' : 'Dark mode'}>
          {darkMode ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
          )}
        </button>
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
            className={`${s.navItem} ${showDashboardSection ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('dashboard'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Dashboard
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
            className={`${s.navItem} ${showDuplicatesSection ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('duplicates'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Duplicates
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
          <button
            type="button"
            className={`${s.navItem} ${showCreateWorkerSection ? s.navItemActive : ''}`}
            onClick={() => { setActiveSection('create-worker'); setIsMobileMenuOpen(false); }}
          >
            <svg className={s.navIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Create Worker
          </button>
        </nav>

        {/* Dark mode toggle in sidebar */}
        <button className={s.darkToggleSidebar} onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {darkMode ? (
            <><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> Light Mode</>
          ) : (
            <><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg> Dark Mode</>
          )}
        </button>

        <div className={s.statsCard}>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Active Users</span>
            <span className={s.statsValue}>{customers.filter(c => !cancelledCustomerIds.has(c.id)).length}</span>
          </div>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Cancelled</span>
            <span className={s.statsValue}>{cancelledCylinders.length}</span>
          </div>
          <div className={s.statsRow}>
            <span className={s.statsLabel}>Total</span>
            <span className={s.statsValue}>{pagination.total || customers.length}</span>
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

        {/* ── Dashboard Analytics ──────────────────── */}
        {!loading && showDashboardSection ? (
          <>
            <header className={s.header}>
              <div className={s.headerCopy}>
                <h2 className={s.headerTitle}>Dashboard Overview</h2>
                <p className={s.headerSub}>Business analytics and key metrics at a glance</p>
              </div>
              <div className={s.dateRangeWrap}>
                {(['7d', '30d', '90d', 'all'] as DateRange[]).map(range => (
                  <button
                    key={range}
                    type="button"
                    className={`${s.dateRangeBtn} ${dateRange === range ? s.dateRangeBtnActive : ''}`}
                    onClick={() => setDateRange(range)}
                  >
                    {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : range === '90d' ? 'Last 90 days' : 'All time'}
                  </button>
                ))}
              </div>
            </header>

            {/* Stat Cards */}
            <div className={s.analyticsGrid}>
              <div className={s.statCard}>
                <span className={s.statLabel}>Total Registrations</span>
                <span className={s.statNumber}>{dateFilteredCustomers.length}</span>
              </div>
              <div className={s.statCard}>
                <span className={s.statLabel}>Active Users</span>
                <span className={s.statNumber}>{dateFilteredActive.length}</span>
              </div>
              <div className={s.statCard}>
                <span className={s.statLabel}>Cancelled Cylinders</span>
                <span className={s.statNumber}>{dateFilteredCancelled.length}</span>
              </div>
              <div className={s.statCard}>
                <span className={s.statLabel}>Total Deposits</span>
                <span className={s.statNumber}>₹{totalDeposits.toLocaleString()}</span>
              </div>
              <div className={s.statCard}>
                <span className={s.statLabel}>Total Refunds</span>
                <span className={s.statNumber}>₹{totalRefunds.toLocaleString()}</span>
              </div>
              <div className={s.statCard}>
                <span className={s.statLabel}>Net Revenue</span>
                <span className={s.statNumber}>₹{(totalDeposits - totalRefunds).toLocaleString()}</span>
              </div>
            </div>

            {/* Charts Row */}
            <div className={s.chartsRow}>
              {/* Gas Type Distribution */}
              <div className={s.chartCard}>
                <h3 className={s.chartTitle}>Cylinder Types</h3>
                <p className={s.chartSub}>Distribution by gas type</p>
                <div className={s.chartWrap}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={gasTypeData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#F3F4F6'} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: darkMode ? '#9CA3AF' : '#6B7280' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: darkMode ? '#9CA3AF' : '#6B7280' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, background: darkMode ? '#1F2937' : '#fff', color: darkMode ? '#F9FAFB' : '#111' }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {gasTypeData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gas Variant Pie */}
              <div className={s.chartCard}>
                <h3 className={s.chartTitle}>Cylinder Variants</h3>
                <p className={s.chartSub}>Breakdown by variant size</p>
                <div className={s.chartWrap}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={gasVariantData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, percent }) => `${(name ?? '').split(' ').slice(0, 2).join(' ')} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ fontSize: 11 }}
                      >
                        {gasVariantData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, background: darkMode ? '#1F2937' : '#fff', color: darkMode ? '#F9FAFB' : '#111' }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, color: darkMode ? '#D1D5DB' : undefined }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Monthly Trends */}
            {monthlyData.length > 0 && (
              <div className={s.chartCardFull}>
                <h3 className={s.chartTitle}>Monthly Trends</h3>
                <p className={s.chartSub}>Registrations vs cancellations over time</p>
                <div className={s.chartWrap}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cancelGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#F3F4F6'} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: darkMode ? '#9CA3AF' : '#6B7280' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: darkMode ? '#9CA3AF' : '#6B7280' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, background: darkMode ? '#1F2937' : '#fff', color: darkMode ? '#F9FAFB' : '#111' }}
                      />
                      <Area type="monotone" dataKey="registrations" stroke="#3B82F6" strokeWidth={2.5} fill="url(#regGrad)" />
                      <Area type="monotone" dataKey="cancellations" stroke="#EF4444" strokeWidth={2.5} fill="url(#cancelGrad)" />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* ── All Users ────────────────────────────── */}
        {!loading && showUsersSection ? (
          <>
            <header className={s.header}>
              <div className={s.headerCopy}>
                <h2 className={s.headerTitle}>All Registered Users</h2>
                <p className={s.headerSub}>
                  {pagination.total > 0 ? `Showing ${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} users` : 'Search a user and open profile to view all details'}
                </p>
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
                      <th>Aadhar</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr><td colSpan={6} className={s.emptyCell}>No users found for this search.</td></tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id}>
                          <td>{customer.name}</td>
                          <td>{customer.phone}</td>
                          <td>{customer.aadhar}</td>
                          <td>{customer.gasType}</td>
                          <td>
                            {customer.aadharImageUrl ? (
                              <button
                                type="button"
                                className={s.imgPreviewBtn}
                                onClick={() => setAadharModal({ name: customer.name, url: customer.aadharImageUrl! })}
                                title="View Aadhar"
                              >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>None</span>
                            )}
                          </td>
                          <td>
                            <div className={s.actionCell}>
                              <button type="button" className={s.viewBtn} onClick={() => openCustomerProfile(customer.id)}>
                                View
                              </button>
                              <button type="button" className={s.editBtn} onClick={() => openEditModal(customer)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className={s.cancelBtn}
                                disabled={cancellingId === customer.id}
                                onClick={() => openCancelModal(customer)}
                              >
                                {cancellingId === customer.id ? 'Cancelling…' : 'Cancel'}
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

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={s.paginationWrap}>
                <button className={s.pageBtn} disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>
                  ← Prev
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 4) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 3) {
                    pageNum = pagination.totalPages - 6 + i;
                  } else {
                    pageNum = pagination.page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      className={`${s.pageBtn} ${pagination.page === pageNum ? s.pageBtnActive : ''}`}
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button className={s.pageBtn} disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)}>
                  Next →
                </button>
              </div>
            )}
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

        {/* ── Duplicates Detection ─────────────────── */}
        {!loading && showDuplicatesSection ? (
          <div className={s.createSection} style={{ maxWidth: '100%' }}>
            <div className={s.createCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 className={s.createTitle}>Duplicate Detection</h2>
                  <p className={s.createSub}>Customers flagged with the same Aadhar or phone number</p>
                </div>
                <button
                  type="button"
                  className={s.createBtn}
                  disabled={duplicatesLoading}
                  onClick={() => {
                    setDuplicatesData(null);
                    setDuplicatesLoading(true);
                    fetch('/api/customers/duplicates')
                      .then(r => parseApiPayload(r))
                      .then(data => {
                        if (data.duplicates) setDuplicatesData(data.duplicates as DuplicatesData);
                      })
                      .catch(console.error)
                      .finally(() => setDuplicatesLoading(false));
                  }}
                >
                  {duplicatesLoading ? 'Scanning...' : 'Refresh'}
                </button>
              </div>

              {duplicatesLoading ? <p className={s.loadingText}>Scanning for duplicates...</p> : null}

              {duplicatesData && !duplicatesLoading ? (
                <>
                  {duplicatesData.aadhar.count === 0 && duplicatesData.phone.count === 0 ? (
                    <div className={`${s.message} ${s.messageSuccess}`} style={{ marginTop: '1rem' }}>
                      No duplicates found. All Aadhar and phone numbers are unique.
                    </div>
                  ) : null}

                  {duplicatesData.aadhar.count > 0 ? (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h3 className={s.adminListTitle}>Duplicate Aadhar Numbers ({duplicatesData.aadhar.count} groups)</h3>
                      {duplicatesData.aadhar.groups.map((group) => (
                        <div key={group.value} className={s.duplicateGroup}>
                          <p className={s.duplicateGroupLabel}>Aadhar: {group.value} ({group.count} customers)</p>
                          <div className={s.tableCard}>
                            <div className={s.tableScroll}>
                              <table className={s.table}>
                                <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Gas Type</th><th>Registered</th><th>Action</th></tr></thead>
                                <tbody>
                                  {group.customers.map(c => (
                                    <tr key={c.id}>
                                      <td>{c.name}</td>
                                      <td>{c.phone}</td>
                                      <td>{c.address}</td>
                                      <td>{c.gasType}</td>
                                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                                      <td><button type="button" className={s.viewBtn} onClick={() => openCustomerProfile(c.id)}>View</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {duplicatesData.phone.count > 0 ? (
                    <div style={{ marginTop: '1.5rem' }}>
                      <h3 className={s.adminListTitle}>Duplicate Phone Numbers ({duplicatesData.phone.count} groups)</h3>
                      {duplicatesData.phone.groups.map((group) => (
                        <div key={group.value} className={s.duplicateGroup}>
                          <p className={s.duplicateGroupLabel}>Phone: {group.value} ({group.count} customers)</p>
                          <div className={s.tableCard}>
                            <div className={s.tableScroll}>
                              <table className={s.table}>
                                <thead><tr><th>Name</th><th>Aadhar</th><th>Address</th><th>Gas Type</th><th>Registered</th><th>Action</th></tr></thead>
                                <tbody>
                                  {group.customers.map(c => (
                                    <tr key={c.id}>
                                      <td>{c.name}</td>
                                      <td>{c.aadhar}</td>
                                      <td>{c.address}</td>
                                      <td>{c.gasType}</td>
                                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                                      <td><button type="button" className={s.viewBtn} onClick={() => openCustomerProfile(c.id)}>View</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
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

        {/* ── Create Worker ────────────────────────── */}
        {!loading && showCreateWorkerSection ? (
          <div className={s.createSection}>
            <div className={s.createCard}>
              <h2 className={s.createTitle}>Add New Worker</h2>
              <p className={s.createSub}>Create a worker login for limited dashboard access.</p>
              <form onSubmit={createWorker} className={s.form}>
                <div className={s.formGroup}>
                  <label htmlFor="worker-username" className={s.formLabel}>Worker Username</label>
                  <input
                    id="worker-username"
                    type="text"
                    className={s.formInput}
                    value={newWorkerUsername}
                    onChange={(e) => setNewWorkerUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    disabled={creatingWorker}
                  />
                </div>
                <div className={s.formGroup}>
                  <label htmlFor="worker-password" className={s.formLabel}>Worker Password</label>
                  <input
                    id="worker-password"
                    type="password"
                    className={s.formInput}
                    value={newWorkerPassword}
                    onChange={(e) => setNewWorkerPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    disabled={creatingWorker}
                  />
                </div>
                <button type="submit" className={s.createBtn} disabled={creatingWorker}>
                  {creatingWorker ? 'Creating...' : 'Create Worker'}
                </button>
              </form>
              {workerMessage ? (
                <div className={`${s.message} ${workerMessage.startsWith('Success:') ? s.messageSuccess : s.messageError}`}>
                  {workerMessage}
                </div>
              ) : null}

              <div className={s.adminList}>
                <h3 className={s.adminListTitle}>Existing Workers</h3>
                {workersStatus ? <p className={s.adminListError}>{workersStatus}</p> : null}
                {workersLoading ? <p className={s.loadingText}>Loading workers...</p> : null}
                {!workersLoading ? (
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
                          {workers.length === 0 ? (
                            <tr><td colSpan={2} className={s.emptyCell}>No workers found.</td></tr>
                          ) : (
                            workers.map((worker) => (
                              <tr key={worker.id}>
                                <td>{worker.username}</td>
                                <td>{new Date(worker.createdAt).toLocaleString()}</td>
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

      {/* ── Aadhar Image Modal ─────────────────────── */}
      {aadharModal ? (
        <div className={s.modalBackdrop} onClick={() => setAadharModal(null)}>
          <div className={s.aadharModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className={s.modalTitle}>Aadhar - {aadharModal.name}</h3>
              <button type="button" className={s.modalCancelBtn} onClick={() => setAadharModal(null)} style={{ margin: 0 }}>✕</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aadharModal.url}
              alt={`Aadhar of ${aadharModal.name}`}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              <a href={aadharModal.url} target="_blank" rel="noreferrer" className={s.viewBtn} style={{ textDecoration: 'none', display: 'inline-block' }}>
                Open Full Size
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit Customer Modal ────────────────────── */}
      {editModal ? (
        <div className={s.modalBackdrop} onClick={closeEditModal}>
          <div className={s.editModalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={s.modalTitle}>Edit Customer</h3>
            <p className={s.modalSub}>Editing: <strong>{editModal.name}</strong></p>
            {editMessage ? (
              <div className={`${s.message} ${editMessage.startsWith('Success:') ? s.messageSuccess : s.messageError}`} style={{ marginBottom: '0.75rem' }}>
                {editMessage}
              </div>
            ) : null}
            <div className={s.editGrid}>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Name</label>
                <input className={s.modalInput} value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Phone</label>
                <input className={s.modalInput} value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Aadhar</label>
                <input className={s.modalInput} value={editForm.aadhar || ''} onChange={e => setEditForm(f => ({ ...f, aadhar: e.target.value }))} />
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Address</label>
                <input className={s.modalInput} value={editForm.address || ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Gas Type</label>
                <select className={s.modalInput} value={editForm.gasType || ''} onChange={e => setEditForm(f => ({ ...f, gasType: e.target.value, gasVariant: '' }))}>
                  {GAS_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Gas Variant</label>
                <select className={s.modalInput} value={editForm.gasVariant || ''} onChange={e => setEditForm(f => ({ ...f, gasVariant: e.target.value }))}>
                  <option value="">Select variant</option>
                  {(GAS_VARIANTS[editForm.gasType || ''] || []).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Deposit (₹)</label>
                <input className={s.modalInput} type="number" min="0" value={editForm.deposit ?? ''} onChange={e => setEditForm(f => ({ ...f, deposit: Number(e.target.value) }))} />
              </div>
              <div className={s.modalField}>
                <label className={s.modalLabel}>Refund (₹)</label>
                <input className={s.modalInput} type="number" min="0" value={editForm.refund ?? ''} onChange={e => setEditForm(f => ({ ...f, refund: Number(e.target.value) }))} />
              </div>
            </div>
            <div className={s.modalActions}>
              <button type="button" className={s.modalCancelBtn} onClick={closeEditModal}>Cancel</button>
              <button type="button" className={s.createBtn} disabled={editLoading} onClick={submitEdit}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
