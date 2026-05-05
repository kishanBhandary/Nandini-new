'use client';

import { useState } from 'react';
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
        {message ? <p className="profile-action-message">{message}</p> : null}
      </section>

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
        
        .dialog-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
