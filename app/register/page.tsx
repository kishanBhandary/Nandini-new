'use client';

import { FormEvent, useState } from 'react';
import { getApiError, parseApiPayload } from '../../lib/apiResponse';

const gasOptions = [
  { value: 'KONKAN', label: 'Konkan' },
  { value: 'BHARATH_GAS', label: 'Bharath Gas' },
  { value: 'INDIAN_GAS', label: 'Indian Gas' },
] as const;

const gasVariantMap = {
  KONKAN: [
    { value: 'KONKAN_17_KG', label: '17 kg' },
    { value: 'KONKAN_12_KG', label: '12 kg' },
    { value: 'KONKAN_5_5_KG', label: '5.5 kg' },
  ],
  BHARATH_GAS: [
    { value: 'BHARATH_19_KG', label: '19 kg' },
    { value: 'BHARATH_5_KG', label: '5 kg' },
  ],
  INDIAN_GAS: [
    { value: 'INDIAN_17_KG', label: '17 kg' },
    { value: 'INDIAN_12_KG', label: '12 kg' },
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
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      } else {
        setStatus({ type: 'error', message: getApiError(data, 'Unable to save registration.') });
      }
    } catch (error) {
      setLoading(false);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Upload failed.' });
    }
  };

  return (
    <main className="container compact-screen register-page">
      <div className="card compact-card">
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
            <label htmlFor="aadharImage">Aadhar Photo</label>
            <input
              id="aadharImage"
              type="file"
              accept="image/*"
              onChange={(event) => setAadharFile(event.target.files?.[0] ?? null)}
            />
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
