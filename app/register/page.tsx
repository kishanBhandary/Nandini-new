'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiError, parseApiPayload } from '../../lib/apiResponse';

const gasOptions = [
  { value: 'KONKAN', label: 'Konkan Gas' },
  { value: 'TOTAL_GAS', label: 'Total Gas' },
  { value: 'HP_GAS', label: 'HP Gas' },
  { value: 'INDIAN_GAS', label: 'Indian Gas' },
  { value: 'BHARATH_GAS', label: 'Bharath Gas' },
] as const;

const gasVariantMap = {
  KONKAN: [
    { value: 'KONKAN_17_KG', label: '17 kg' },
    { value: 'KONKAN_12_KG', label: '12 kg' },
    { value: 'KONKAN_5_5_KG', label: '5.5 kg' },
  ],
  TOTAL_GAS: [
    { value: 'TOTAL_17_KG', label: '17 kg' },
    { value: 'TOTAL_12_KG', label: '12 kg' },
  ],
  HP_GAS: [
    { value: 'HP_19_KG', label: '19 kg' },
    { value: 'HP_5_KG', label: '5 kg' },
  ],
  INDIAN_GAS: [
    { value: 'INDIAN_19_KG', label: '19 kg' },
    { value: 'INDIAN_5_KG', label: '5 kg' },
    { value: 'INDIAN_17_KG', label: '17 kg' },
    { value: 'INDIAN_12_KG', label: '12 kg' },
  ],
  BHARATH_GAS: [
    { value: 'BHARATH_19_KG', label: '19 kg' },
    { value: 'BHARATH_5_KG', label: '5 kg' },
  ],
} as const;

type GasTypeValue = (typeof gasOptions)[number]['value'];

type FormState = {
  name: string;
  phone: string;
  aadhar: string;
  address: string;
  gasType: GasTypeValue;
  gasVariant: string;
  deposit: string;
  refund: string;
};

export default function CustomerRegistrationPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    aadhar: '',
    address: '',
    gasType: 'KONKAN',
    gasVariant: 'KONKAN_17_KG',
    deposit: '',
    refund: '',
  });
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [aadharPreview, setAadharPreview] = useState<string | null>(null);
  const [aadharCaptureMode, setAadharCaptureMode] = useState<'file' | 'camera'>('file');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAadharFileSelect = (file: File | null) => {
    setAadharFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAadharPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAadharPreview(null);
    }
  };

  const uploadAadharImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/aadhar-upload', {
      method: 'POST',
      body: formData,
    });

    const data = await parseApiPayload(response);

    if (!response.ok) {
      throw new Error(getApiError(data, 'Failed to upload Aadhar image.'));
    }

    return typeof data.publicUrl === 'string' ? data.publicUrl : '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      let aadharImageUrl: string | undefined;

      if (aadharFile) {
        aadharImageUrl = await uploadAadharImage(aadharFile);
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          deposit: Number(form.deposit || 0),
          refund: Number(form.refund || 0),
          aadharImageUrl,
        }),
      });

      const data = await parseApiPayload(response);
      setLoading(false);

      if (response.ok) {
        setStatus({ type: 'success', message: 'Registration saved successfully.' });
        setForm({
          name: '',
          phone: '',
          aadhar: '',
          address: '',
          gasType: 'KONKAN',
          gasVariant: 'KONKAN_17_KG',
          deposit: '',
          refund: '',
        });
        setAadharFile(null);
        setAadharPreview(null);
        setAadharCaptureMode('file');
      } else {
        setStatus({ type: 'error', message: getApiError(data, 'Unable to save registration.') });
      }
    } catch (error) {
      setLoading(false);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Upload failed.' });
    }
  };

  const router = useRouter();

  return (
    <main className="container compact-screen register-page">
      <div className="card compact-card">
        <button
          type="button"
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0', marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'inherit', fontSize: '1rem' }}
        >
          ← Back
        </button>
        <h1>Gas Agency Registration</h1>
        <p>Enter customer details, upload Aadhar, and save the gas booking record.</p>

        <form className="registration-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              required
              placeholder="Enter customer name"
            />
          </div>

          <div className="form-field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
              required
              placeholder="Enter phone number"
              inputMode="tel"
            />
          </div>

          <div className="form-field">
            <label htmlFor="aadhar">Aadhar Number</label>
            <input
              id="aadhar"
              value={form.aadhar}
              onChange={(event) => handleChange('aadhar', event.target.value)}
              required
              placeholder="Enter aadhar number"
            />
          </div>

          <div className="form-field">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              value={form.address}
              onChange={(event) => handleChange('address', event.target.value)}
              required
              placeholder="Enter address"
            />
          </div>

          <div className="full-span inline-pair">
            <div className="form-field">
              <label htmlFor="gasType">Gas Brand</label>
              <select
                id="gasType"
                value={form.gasType}
                onChange={(event) => {
                  const nextGasType = event.target.value as GasTypeValue;
                  const nextVariant = gasVariantMap[nextGasType][0].value;
                  setForm((prev) => ({ ...prev, gasType: nextGasType, gasVariant: nextVariant }));
                }}
              >
                {gasOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="gasVariant">Gas Variant</label>
              <select
                id="gasVariant"
                value={form.gasVariant}
                onChange={(event) => handleChange('gasVariant', event.target.value)}
              >
                {gasVariantMap[form.gasType].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="deposit">Deposit</label>
            <input
              id="deposit"
              type="number"
              min="0"
              value={form.deposit}
              onChange={(event) => handleChange('deposit', event.target.value)}
              required
              placeholder="Enter deposit amount"
            />
          </div>

          <div className="form-field">
            <label htmlFor="refund">Refund</label>
            <input
              id="refund"
              type="number"
              min="0"
              value={form.refund}
              onChange={(event) => handleChange('refund', event.target.value)}
              required
              placeholder="Enter refund amount"
            />
          </div>

          <div className="form-field full-span">
            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: '600', color: '#333' }}>
              Aadhar Photo
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setAadharCaptureMode('file')}
                style={{
                  padding: '0.75rem 1rem',
                  border: `2px solid ${aadharCaptureMode === 'file' ? '#0056b3' : '#e0e0e0'}`,
                  borderRadius: '0.5rem',
                  backgroundColor: aadharCaptureMode === 'file' ? '#0056b3' : '#f5f5f5',
                  color: aadharCaptureMode === 'file' ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  boxShadow: aadharCaptureMode === 'file' ? '0 2px 8px rgba(0, 86, 179, 0.15)' : 'none',
                }}
                onMouseOver={(e) => {
                  if (aadharCaptureMode !== 'file') {
                    (e.target as HTMLButtonElement).style.borderColor = '#bbb';
                    (e.target as HTMLButtonElement).style.backgroundColor = '#fafafa';
                  }
                }}
                onMouseOut={(e) => {
                  if (aadharCaptureMode !== 'file') {
                    (e.target as HTMLButtonElement).style.borderColor = '#e0e0e0';
                    (e.target as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
                  }
                }}
              >
                <span style={{ marginRight: '0.5rem' }}>📁</span>
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setAadharCaptureMode('camera')}
                style={{
                  padding: '0.75rem 1rem',
                  border: `2px solid ${aadharCaptureMode === 'camera' ? '#0056b3' : '#e0e0e0'}`,
                  borderRadius: '0.5rem',
                  backgroundColor: aadharCaptureMode === 'camera' ? '#0056b3' : '#f5f5f5',
                  color: aadharCaptureMode === 'camera' ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  boxShadow: aadharCaptureMode === 'camera' ? '0 2px 8px rgba(0, 86, 179, 0.15)' : 'none',
                }}
                onMouseOver={(e) => {
                  if (aadharCaptureMode !== 'camera') {
                    (e.target as HTMLButtonElement).style.borderColor = '#bbb';
                    (e.target as HTMLButtonElement).style.backgroundColor = '#fafafa';
                  }
                }}
                onMouseOut={(e) => {
                  if (aadharCaptureMode !== 'camera') {
                    (e.target as HTMLButtonElement).style.borderColor = '#e0e0e0';
                    (e.target as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
                  }
                }}
              >
                <span style={{ marginRight: '0.5rem' }}>📷</span>
                Take Photo
              </button>
            </div>

            <div style={{
              border: '2px dashed #d0d0d0',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: '#fafafa',
              transition: 'all 0.2s ease',
            }}>
              {!aadharPreview ? (
                <>
                  {aadharCaptureMode === 'file' ? (
                    <>
                      <input
                        id="aadharImage"
                        type="file"
                        accept="image/*"
                        onChange={(event) => handleAadharFileSelect(event.target.files?.[0] ?? null)}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="aadharImage"
                        style={{
                          display: 'block',
                          cursor: 'pointer',
                          padding: '0.5rem',
                        }}
                      >
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
                        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                          Click to select or drag and drop
                        </p>
                        <p style={{ margin: '0.25rem 0', color: '#999', fontSize: '0.8rem' }}>
                          PNG, JPG or JPEG
                        </p>
                      </label>
                    </>
                  ) : (
                    <>
                      <input
                        id="aadharCamera"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => handleAadharFileSelect(event.target.files?.[0] ?? null)}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="aadharCamera"
                        style={{
                          display: 'block',
                          cursor: 'pointer',
                          padding: '0.5rem',
                        }}
                      >
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📷</div>
                        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                          Tap to open camera
                        </p>
                      </label>
                    </>
                  )}
                </>
              ) : (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={aadharPreview}
                    alt="Aadhar preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '280px',
                      borderRadius: '0.5rem',
                      border: '2px solid #0056b3',
                      objectFit: 'contain',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAadharFileSelect(null)}
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: '2px solid white',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(220, 53, 69, 0.25)',
                    }}
                    title="Remove photo"
                  >
                    ✕
                  </button>
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0.5rem 0', color: '#555', fontSize: '0.85rem', fontWeight: '500' }}>
                      Photo captured successfully
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button className="full-span" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Registration'}
          </button>
        </form>

        {status ? <div className={`status ${status.type}`}>{status.message}</div> : null}
      </div>
    </main>
  );
}
