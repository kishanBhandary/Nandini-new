'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type CustomerProfileData = {
  id: string;
  name: string;
  phone: string;
  aadhar: string;
  address: string;
  gasType: string;
  gasVariant: string;
  deposit: number;
  refund: number;
  aadharImageUrl?: string | null;
  createdAt: string;
};

type ProfileActionsProps = {
  customer: CustomerProfileData;
  className?: string;
};

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 2a1 1 0 0 1 1 1v7.59l1.8-1.8a1 1 0 0 1 1.4 1.42l-3.5 3.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.42L9 10.59V3a1 1 0 0 1 1-1Zm-6 13a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.4L6 17.8a1 1 0 0 1-1.6-.8V15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H5Zm0 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM6.7 6.7a1 1 0 0 1 1.4 0L10 8.58l1.9-1.88a1 1 0 1 1 1.4 1.42L11.42 10l1.88 1.9a1 1 0 0 1-1.42 1.4L10 11.42l-1.9 1.88a1 1 0 0 1-1.4-1.42L8.58 10 6.7 8.1a1 1 0 0 1 0-1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function fileNameForCustomer(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'customer'}-profile.pdf`;
}

async function buildProfilePdf(customer: CustomerProfileData) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const left = 16;
  let y = 18;

  doc.setFontSize(18);
  doc.text('Nandini Enterprises - User Profile', left, y);

  y += 10;
  doc.setFontSize(11);

  const rows: Array<[string, string]> = [
    ['Name', customer.name],
    ['Phone', customer.phone],
    ['Aadhar', customer.aadhar],
    ['Address', customer.address],
    ['Gas Type', customer.gasType],
    ['Gas Variant', customer.gasVariant],
    ['Deposit', `Rs. ${customer.deposit}`],
    ['Refund', `Rs. ${customer.refund}`],
    ['Cancelled Cylinder', customer.refund > 0 ? 'Yes' : 'No'],
    ['Aadhar Image', customer.aadharImageUrl ?? 'No image'],
    ['Registered At', new Date(customer.createdAt).toLocaleString()],
  ];

  rows.forEach(([label, value]) => {
    const line = `${label}: ${value}`;
    const wrapped = doc.splitTextToSize(line, 178);

    doc.text(wrapped, left, y);
    y += wrapped.length * 6;

    if (y > 270) {
      doc.addPage();
      y = 18;
    }
  });

  return doc;
}

export default function ProfileActions({ customer, className = '' }: ProfileActionsProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState(customer.deposit.toString());
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Refill state
  const [showRefillDialog, setShowRefillDialog] = useState(false);
  const [refillAmount, setRefillAmount] = useState('');
  const [isRefilling, setIsRefilling] = useState(false);
  const [refills, setRefills] = useState<Array<{ id: string; amount: number; cylinderReturned: boolean; performedBy: string | null; createdAt: string }>>([]);
  const [refillsLoaded, setRefillsLoaded] = useState(false);

  const fetchRefills = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customer.id}/refill`);
      const data = await res.json();
      if (Array.isArray(data.refills)) setRefills(data.refills);
    } catch { /* ignore */ }
    setRefillsLoaded(true);
  }, [customer.id]);

  useEffect(() => {
    fetchRefills();
  }, [fetchRefills]);

  const handleRefill = async () => {
    const amt = Number(refillAmount);
    if (!refillAmount || isNaN(amt) || amt <= 0) {
      setMessage('Please enter a valid refill amount.');
      return;
    }
    setIsRefilling(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add refill.');
      setMessage('Refill added successfully!');
      setRefillAmount('');
      setShowRefillDialog(false);
      fetchRefills();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add refill.');
    } finally {
      setIsRefilling(false);
    }
  };

  const toggleCylinderReturned = async (refillId: string, current: boolean) => {
    try {
      const res = await fetch(`/api/customers/${customer.id}/refill`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refillId, cylinderReturned: !current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update.');
      setRefills(prev => prev.map(r => r.id === refillId ? { ...r, cylinderReturned: !current } : r));
      setMessage(!current ? 'Cylinder marked as returned.' : 'Cylinder marked as pending.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update cylinder status.');
    }
  };

  const handleDownload = async () => {
    const doc = await buildProfilePdf(customer);
    doc.save(fileNameForCustomer(customer.name));
    setMessage('Profile PDF downloaded.');
  };

  const handleCancelCylinder = async () => {
    if (!refundAmount || isNaN(Number(refundAmount)) || Number(refundAmount) < 0) {
      setMessage('Please enter a valid refund amount.');
      return;
    }

    setIsCancelling(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/customers/${customer.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundAmount: Number(refundAmount),
          reason: cancelReason || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel cylinder.');
      }

      setMessage('Cylinder cancelled successfully! Redirecting...');
      setShowCancelDialog(false);
      
      // Redirect to cancelled cylinders section after 1 second
      setTimeout(() => {
        router.push('/admin?section=cancelled');
      }, 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to cancel cylinder.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleWhatsAppShare = async () => {
    setIsBusy(true);
    setMessage(null);

    try {
      const doc = await buildProfilePdf(customer);
      const blob = doc.output('blob');
      const file = new File([blob], fileNameForCustomer(customer.name), { type: 'application/pdf' });

      // On supported devices, this opens share options where WhatsApp can be selected with PDF attached.
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Profile PDF - ${customer.name}`,
          text: `Customer profile PDF for ${customer.name}`,
        });
        setMessage('PDF shared. Select WhatsApp from share options.');
      } else {
        doc.save(fileNameForCustomer(customer.name));
        const phoneDigits = customer.phone.replace(/\D/g, '');
        const text = encodeURIComponent(
          `Hi ${customer.name}, your profile PDF is ready. I have downloaded it from dashboard and will share it here.`
        );

        if (phoneDigits) {
          window.open(`https://wa.me/${phoneDigits}?text=${text}`, '_blank', 'noopener,noreferrer');
          setMessage('WhatsApp chat opened. PDF is downloaded, now attach and send in chat.');
        } else {
          window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
          setMessage('WhatsApp opened. PDF is downloaded, now attach and send.');
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to share PDF to WhatsApp.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSms = () => {
    const phoneDigits = customer.phone.replace(/\D/g, '');
    const registeredDate = new Date(customer.createdAt).toLocaleDateString();
    const smsText = encodeURIComponent(
      [
        `Nandini Enterprises`,
        `Dear ${customer.name},`,
        `Your registration profile has been verified successfully.`,
        `Gas: ${customer.gasType} (${customer.gasVariant})`,
        `Deposit: Rs. ${customer.deposit}`,
        `Registered On: ${registeredDate}`,
        `Thank you.`,
      ].join('\n')
    );

    if (!phoneDigits) {
      setMessage('No valid phone number found for SMS.');
      return;
    }

    // Opens default SMS app with a ready-made professional message.
    window.location.href = `sms:${phoneDigits}?body=${smsText}`;
  };

  return (
    <>
      <section className={`profile-actions-panel ${className}`.trim()}>
        <button type="button" className="profile-action-btn" onClick={handleDownload}>
          <DownloadIcon />
          <span>Download Profile PDF</span>
        </button>
        <button type="button" className="profile-action-btn whatsapp" onClick={handleWhatsAppShare} disabled={isBusy}>
          <MessageIcon />
          <span>{isBusy ? 'Preparing PDF...' : 'Send PDF to WhatsApp'}</span>
        </button>
        {customer.refund <= 0 ? (
          <button 
            type="button" 
            className="profile-action-btn cancel" 
            onClick={() => setShowCancelDialog(true)}
          >
            <CancelIcon />
            <span>Cancel Cylinder</span>
          </button>
        ) : null}
        <button
          type="button"
          className="profile-action-btn refill"
          onClick={() => setShowRefillDialog(true)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 4a1 1 0 1 0-2 0v3H6a1 1 0 1 0 0 2h3v3a1 1 0 1 0 2 0v-3h3a1 1 0 1 0 0-2h-3V6Z" fill="currentColor" />
          </svg>
          <span>Add Refill</span>
        </button>
        {message ? <p className="profile-action-message">{message}</p> : null}
      </section>

      {/* Refill History */}
      {refillsLoaded && refills.length > 0 && (
        <section className="refill-history-section">
          <div className="refill-history-header">
            <h2 className="refill-history-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Refill History
            </h2>
            <span className="refill-history-count">{refills.length} {refills.length === 1 ? 'record' : 'records'}</span>
          </div>
          <div className="refill-history-list">
            {refills.map((r, idx) => (
              <div key={r.id} className={`refill-history-item ${r.cylinderReturned ? 'returned' : 'pending'}`}>
                <div className="refill-item-index">#{refills.length - idx}</div>
                <div className="refill-item-body">
                  <div className="refill-item-top">
                    <span className="refill-history-amount">₹{r.amount.toLocaleString('en-IN')}</span>
                    <span className={`refill-cylinder-badge ${r.cylinderReturned ? 'badge-returned' : 'badge-pending'}`}>
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                        {r.cylinderReturned
                          ? <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                        }
                      </svg>
                      {r.cylinderReturned ? 'Returned' : 'Pending'}
                    </span>
                  </div>
                  <div className="refill-item-bottom">
                    <div className="refill-history-meta">
                      <span className="refill-history-date">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{opacity: 0.5}}>
                          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                        </svg>
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="refill-history-time">{new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      {r.performedBy && (
                        <span className="refill-history-by">
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{opacity: 0.5}}>
                            <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                          </svg>
                          {r.performedBy}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`refill-toggle-btn ${r.cylinderReturned ? 'toggle-undo' : 'toggle-mark'}`}
                      onClick={() => toggleCylinderReturned(r.id, r.cylinderReturned)}
                    >
                      {r.cylinderReturned ? 'Undo Return' : 'Mark Returned'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showCancelDialog && (
        <div className="cancel-dialog-overlay" onClick={() => setShowCancelDialog(false)}>
          <div className="cancel-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Cancel Cylinder</h3>
            <p>Customer: {customer.name}</p>
            <p>Deposit Amount: Rs. {customer.deposit}</p>
            
            <div className="form-group">
              <label htmlFor="refundAmount">Refund Amount (Rs.)</label>
              <input
                id="refundAmount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                min="0"
                placeholder="Enter refund amount"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="cancelReason">Reason (Optional)</label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason"
                rows={3}
              />
            </div>
            
            <div className="dialog-actions">
              <button 
                type="button" 
                onClick={() => setShowCancelDialog(false)}
                disabled={isCancelling}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="confirm-btn"
                onClick={handleCancelCylinder}
                disabled={isCancelling}
              >
                {isCancelling ? 'Processing...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefillDialog && (
        <div className="cancel-dialog-overlay" onClick={() => setShowRefillDialog(false)}>
          <div className="cancel-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Add Refill</h3>
            <p>Customer: {customer.name}</p>

            <div className="form-group">
              <label htmlFor="refillAmount">Refill Amount (₹)</label>
              <input
                id="refillAmount"
                type="number"
                value={refillAmount}
                onChange={(e) => setRefillAmount(e.target.value)}
                min="1"
                placeholder="Enter refill amount"
                autoFocus
              />
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setShowRefillDialog(false)}
                disabled={isRefilling}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-btn refill-confirm"
                onClick={handleRefill}
                disabled={isRefilling}
              >
                {isRefilling ? 'Adding...' : 'Add Refill'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cancel-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .cancel-dialog {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .cancel-dialog h3 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
        }
        
        .cancel-dialog p {
          margin: 0.5rem 0;
          color: #666;
        }
        
        .form-group {
          margin: 1.5rem 0;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }
        
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }
        
        .dialog-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
        }
        
        .dialog-actions button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }
        
        .dialog-actions button:first-child {
          background: #f5f5f5;
          color: #333;
        }
        
        .dialog-actions button.confirm-btn {
          background: #dc3545;
          color: white;
        }

        .dialog-actions button.refill-confirm {
          background: #059669;
          color: white;
        }
        
        .dialog-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .profile-action-btn.refill {
          color: #fff;
          background: #111827;
        }

        .refill-history-section {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #E5E7EB;
        }

        .refill-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .refill-history-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
          font-weight: 700;
          color: #000;
          margin: 0;
        }

        .refill-history-count {
          font-size: 0.78rem;
          color: #555;
          background: #F0F0F0;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          font-weight: 500;
        }

        .refill-history-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .refill-history-item {
          display: flex;
          align-items: stretch;
          border-radius: 12px;
          overflow: hidden;
          transition: box-shadow 0.15s;
          background: #fff;
          border: 1px solid #E0E0E0;
        }

        .refill-history-item:hover {
          box-shadow: 0 3px 12px rgba(0,0,0,0.08);
        }

        .refill-history-item.returned {
          background: #FAFAFA;
          border-color: #D4D4D4;
        }

        .refill-history-item.pending {
          background: #fff;
          border-color: #111;
          border-width: 1.5px;
        }

        .refill-item-index {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 40px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #888;
          border-right: 1px solid #E0E0E0;
          background: #F7F7F7;
        }

        .refill-item-body {
          flex: 1;
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .refill-item-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .refill-item-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .refill-history-amount {
          font-size: 1.15rem;
          font-weight: 800;
          color: #000;
          letter-spacing: -0.01em;
        }

        .refill-history-meta {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-wrap: wrap;
        }

        .refill-history-date {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8rem;
          color: #666;
        }

        .refill-history-time {
          color: #999;
          margin-left: 0.15rem;
        }

        .refill-history-by {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.8rem;
          color: #666;
        }

        .refill-cylinder-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .badge-returned {
          background: #E8E8E8;
          color: #444;
        }

        .badge-pending {
          background: #DC2626;
          color: #fff;
        }

        .refill-toggle-btn {
          padding: 0.35rem 0.85rem;
          border: none;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .refill-toggle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.12);
        }

        .toggle-mark {
          background: #111;
          color: #fff;
        }

        .toggle-mark:hover {
          background: #000;
        }

        .toggle-undo {
          background: #fff;
          color: #555;
          border: 1px solid #D4D4D4;
        }

        .toggle-undo:hover {
          background: #F5F5F5;
        }

        @media (max-width: 480px) {
          .refill-item-index {
            min-width: 32px;
            font-size: 0.65rem;
          }
          .refill-item-body {
            padding: 0.65rem 0.75rem;
          }
          .refill-history-amount {
            font-size: 1rem;
          }
          .refill-item-bottom {
            flex-direction: column;
            align-items: flex-start;
          }
          .refill-toggle-btn {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </>
  );
}
