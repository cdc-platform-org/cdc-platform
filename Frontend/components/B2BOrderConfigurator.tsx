'use client';

import { useMemo, useState } from 'react';

const packages = [
  { label: 'Starter', seats: 25, pricePerSeat: 199, roi: '8x' },
  { label: 'Growth', seats: 75, pricePerSeat: 169, roi: '12x' },
  { label: 'Enterprise', seats: 200, pricePerSeat: 139, roi: '18x' }
];

export default function B2BOrderConfigurator() {
  const [selectedPackage, setSelectedPackage] = useState(packages[1]);
  const [discount, setDiscount] = useState(10);

  const totals = useMemo(() => {
    const subtotal = selectedPackage.seats * selectedPackage.pricePerSeat;
    const discounted = subtotal * (1 - discount / 100);
    return { subtotal, discounted };
  }, [selectedPackage, discount]);

  return (
    <div className="glass-panel rounded-[32px] border border-white/10 p-8 shadow-glass">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">B2B Configurator</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Premium order planning matrix</h2>
          <p className="mt-3 text-slate-300">Select scale, estimate enterprise pricing, and align course volume with contract outcomes.</p>
        </div>
        <div className="rounded-3xl bg-slate-950/70 p-6 ring-1 ring-white/10">
          <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Live estimate</p>
          <p className="mt-3 text-2xl font-semibold text-white">${totals.discounted.toLocaleString()}</p>
          <p className="mt-2 text-sm text-slate-400">Projected contract value after discount.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {packages.map((pkg) => (
            <button
              key={pkg.label}
              onClick={() => setSelectedPackage(pkg)}
              className={`w-full rounded-3xl border p-6 text-left transition ${
                selectedPackage.label === pkg.label
                  ? 'border-cyan-400/70 bg-cyan-500/10 text-white shadow-glow'
                  : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-cyan-300/70 hover:bg-slate-900/80'
              }`}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm uppercase tracking-[0.25em] text-cyan-300/80">{pkg.label}</span>
                <span className="text-sm font-semibold text-slate-100">ROI {pkg.roi}</span>
              </div>
              <p className="mt-4 text-4xl font-semibold text-white">${pkg.pricePerSeat}</p>
              <p className="mt-2 text-sm text-slate-400">Per seat / month · {pkg.seats} seats</p>
            </button>
          ))}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/60 p-8 shadow-glass">
          <div className="space-y-5">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Contract details</p>
              <p className="mt-3 text-2xl font-semibold text-white">{selectedPackage.label} package</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Scheduled seats</p>
              <p className="mt-2 text-3xl font-semibold text-white">{selectedPackage.seats}</p>
            </div>
            <div className="space-y-3 rounded-3xl bg-slate-900/80 p-5">
              <label className="text-sm uppercase tracking-[0.2em] text-slate-400">Enterprise discount</label>
              <input
                type="range"
                min="0"
                max="30"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
                className="w-full accent-cyan-400"
              />
              <p className="text-lg font-semibold text-white">{discount}% off</p>
            </div>
            <div className="rounded-3xl bg-slate-900/80 p-5">
              <div className="flex items-center justify-between text-slate-400">
                <span>Subtotal</span>
                <span>${totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-white">
                <span>Total</span>
                <span>${totals.discounted.toLocaleString()}</span>
              </div>
            </div>
            <button className="button-primary w-full">Create order proposal</button>
          </div>
        </div>
      </div>
    </div>
  );
}
