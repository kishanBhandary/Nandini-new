'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
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
  createdAt: string;
};

export default function WorkerDashboardPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchCustomers = async (query = '') => {
    setLoading(true);
    setStatus(null);
    try {
      const url = `/api/customers?hasTransaction=true${query ? `&search=${encodeURIComponent(query)}` : ''}`;
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

  useEffect(() => {
    fetchCustomers();
  }, []);

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

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchCustomers(search.trim());
  };

  const visibleCustomers = customers;

  const openCustomerProfile = (customerId: string) => {
    router.push(`/admin/users/${customerId}`);
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
        <Link href="/register" className="new-registration-link">
          New Registration
        </Link>

        <h1 className="dashboard-brand">Nandini Worker</h1>
        <p className="dashboard-subtitle">Worker Dashboard</p>

        <nav className="dashboard-nav">
          <button type="button" className="dashboard-nav-item active">
            Customer Search
          </button>
        </nav>

        <div className="menu-stats">
          <p>Total records: {customers.length}</p>
          <p>Filtered records: {visibleCustomers.length}</p>
        </div>
      </aside>

      <section className="admin-dashboard-content">
        <header className="dashboard-header">
          <h2>Customer Records</h2>
          <p>Search, filter, and open profile details.</p>
        </header>

        <form className="search-bar dashboard-search-bar" onSubmit={handleSearch}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, aadhar, or phone"
          />
          <button type="submit">Search</button>
        </form>

        {status ? <div className="status error">{status}</div> : null}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="table-wrapper dashboard-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Aadhar</th>
                    <th>Address</th>
                    <th>Gas Type</th>
                    <th>Gas Variant</th>
                    <th>Deposit</th>
                    <th>Refund</th>
                    <th>Saved At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={10}>No records found.</td>
                    </tr>
                  ) : (
                    visibleCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.name}</td>
                        <td>{customer.phone}</td>
                        <td>{customer.aadhar}</td>
                        <td>{customer.address}</td>
                        <td>{customer.gasType}</td>
                        <td>{customer.gasVariant}</td>
                        <td>₹{customer.deposit}</td>
                        <td>₹{customer.refund}</td>
                        <td>{new Date(customer.createdAt).toLocaleString()}</td>
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

            <div className="mobile-cards">
              {visibleCustomers.length === 0 ? (
                <p>No records found.</p>
              ) : (
                visibleCustomers.map((customer) => (
                  <div key={customer.id} className="customer-card">
                    <h3>{customer.name}</h3>
                    <div className="card-details">
                      <p><strong>Phone:</strong> {customer.phone}</p>
                      <p><strong>Aadhar:</strong> {customer.aadhar}</p>
                      <p><strong>Address:</strong> {customer.address}</p>
                      <p><strong>Gas Type:</strong> {customer.gasType}</p>
                      <p><strong>Gas Variant:</strong> {customer.gasVariant}</p>
                      <p><strong>Deposit:</strong> ₹{customer.deposit}</p>
                      <p><strong>Refund:</strong> ₹{customer.refund}</p>
                      <p><strong>Saved At:</strong> {new Date(customer.createdAt).toLocaleString()}</p>
                    </div>
                    <button type="button" className="view-profile-button" onClick={() => openCustomerProfile(customer.id)}>
                      View Profile
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
