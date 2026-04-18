'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';

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

function fileNameForCustomer(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'customer'}-profile.pdf`;
}

function buildProfilePdf(customer: CustomerProfileData) {
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
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDownload = () => {
    const doc = buildProfilePdf(customer);
    doc.save(fileNameForCustomer(customer.name));
    setMessage('Profile PDF downloaded.');
  };

  const handleWhatsAppShare = async () => {
    setIsBusy(true);
    setMessage(null);

    try {
      const doc = buildProfilePdf(customer);
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
    <section className={`profile-actions-panel ${className}`.trim()}>
      <button type="button" className="profile-action-btn" onClick={handleDownload}>
        <DownloadIcon />
        <span>Download Profile PDF</span>
      </button>
      <button type="button" className="profile-action-btn whatsapp" onClick={handleWhatsAppShare} disabled={isBusy}>
        <MessageIcon />
        <span>{isBusy ? 'Preparing PDF...' : 'Send PDF to WhatsApp'}</span>
      </button>
      <button type="button" className="profile-action-btn sms" onClick={handleSms}>
        <MessageIcon />
        <span>Send SMS Message</span>
      </button>
      {message ? <p className="profile-action-message">{message}</p> : null}
    </section>
  );
}
