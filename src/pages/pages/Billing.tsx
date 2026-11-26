/*
 * Phause Billing Dashboard
 * Dynamic data: current subscription, invoice history and CSV billing statement.
 * Payment methods and billing address still need their own APIs.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/shell/PageHead';
import { apiClient } from '../../api/client';
import { cancelSubscription } from '../../api/billing/billing.api';
import { getAppToken } from '../../stores/auth.store';
import jsPDF from 'jspdf';
import PhauseLogo from '../../image/phause-logo.png';
import { useToastFeedback } from '../../hooks/useToastFeedback';


interface Plan {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  currency: string;
  billingCycle: string;
  maxCampaigns: number | null;
  maxCampaignsPerDay: number | null;
  maxUsers: number | null;
  features?: Record<string, boolean | number | string>;
}
interface CurrentSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: Plan;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  cancelAtPeriodEnd?: boolean;
  gatewayProvider?: string | null;
}
interface Usage {
  maxCampaigns: number | null;
  maxCampaignsPerDay: number | null;
  maxUsers: number | null;
  usedCampaigns: number;
  usedCampaignsToday: number;
  usedUsers: number;
  monthlyApiQuota: number;
  usedApiRequests: number;
  remainingCampaigns: number | null;
  remainingCampaignsToday: number | null;
  remainingUsers: number | null;
  remainingApiRequests: number | null;
}
interface CurrentSubscriptionResponse {
  subscription: CurrentSubscription | null;
  payments: unknown[];
  usage: Usage | null;
}
interface Invoice {
  id: string;
  paymentId: string | null;
  date: string;
  description: string;
  amount: number | string;
  currency: string;
  status: string;
  provider: string;
  receiptUrl: string | null;
}
interface InvoicesResponse {
  invoices: Invoice[];
}
interface StatementResponse {
  filename: string;
  contentType: string;
  content: string;
}
interface Method {
  id: number;
  brand: string;
  last4: string;
  exp: string;
  tint: string;
  def: boolean;
}

interface InvoiceReceipt {
  id: string;
  paymentId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  receiptUrl: string | null;
}

/** Loads the public company logo and converts it to a data URL for jsPDF. */
const loadImageAsBase64 = (src: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Unable to process the company logo.'));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error(`Unable to load the company logo from ${src}.`));
    image.src = src;
  });

const ICON_CARD = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" />
    <path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" />
  </svg>
);
const ICON_DL = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" />
  </svg>
);
const ICON_CSV = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 25, height: 25 }}>
    <path d="M7 3.75h7l5 5v11.5A.75.75 0 0 1 18.25 21h-11.5A.75.75 0 0 1 6 20.25V4.5a.75.75 0 0 1 .75-.75Z" />
    <path d="M14 4v5h5M8.5 13h7M8.5 16h7" />
    <path d="M8.5 18.5h7" />
  </svg>
);

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};
const formatMoney = (value: string | number | undefined, currency = 'USD') => {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency.toUpperCase()} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
  }
};
const displayCycle = (value?: string) => value ? value.toLowerCase().replaceAll('_', ' ') : '—';
const displayStatus = (value?: string) => value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';
const percent = (used: number, max: number | null) => max == null || max <= 0 ? 0 : Math.min(100, Math.max(0, used / max * 100));

function UsageMeter({ label, used, limit, tone }: { label: string; used: number; limit: number | null; tone?: 'warning' | 'cyan' }) {
  const unlimited = limit == null;
  const value = `${used.toLocaleString()} / ${unlimited ? 'Unlimited' : limit.toLocaleString()}`;
  return (
    <div>
      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{label}</span>
        <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{value}</b>
      </div>
      <div className={`ax-progress ax-progress--sm${tone === 'warning' ? ' ax-progress--warning' : ''}`}>
        <div className="ax-progress__track">
          <div className="ax-progress__fill" style={{ width: unlimited ? '0%' : `${percent(used, limit)}%`, ...(tone === 'cyan' ? { background: 'var(--ax-viz-cyan)' } : {}) }} />
        </div>
      </div>
      {!unlimited && percent(used, limit) >= 90 && <p style={{ color: 'var(--ax-warning-500)', fontSize: 'var(--ax-text-xs)', marginTop: 5 }}>Approaching your limit</p>}
    </div>
  );
}

export function Billing() {
  const [data, setData] = useState<CurrentSubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useToastFeedback('', 'error');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useToastFeedback('', 'error');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useToastFeedback('', 'error');
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useToastFeedback('', 'error');

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [invoiceDownloadError, setInvoiceDownloadError] = useToastFeedback('', 'error');

  // Retained UI state; this API does not return payment methods.
  const [methods, setMethods] = useState<Method[]>([]);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await apiClient.get<CurrentSubscriptionResponse>('/api/subscriptions/current', getAppToken);
      setData(result);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load your subscription.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSubscription(); }, [fetchSubscription]);

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    setInvoicesError('');
    try {
      const result = await apiClient.get<InvoicesResponse>('/api/subscriptions/invoices', getAppToken);
      setInvoices(Array.isArray(result?.invoices) ? result.invoices : []);
    } catch (error) {
      setInvoicesError(error instanceof Error ? error.message : 'Unable to load invoice history.');
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);

  const handleCancelSubscription = async () => {
    const subscription = data?.subscription;
    if (!subscription?.id) {
      setCancelError('A current subscription could not be found.');
      return;
    }

    setCancelling(true);
    setCancelError('');
    try {
      const result = await cancelSubscription(subscription.id);
      setData((current) => current?.subscription
        ? {
            ...current,
            subscription: {
              ...current.subscription,
              status: result.status === 'none' ? current.subscription.status : result.status,
              autoRenew: result.status === 'none' ? false : !result.cancelAtPeriodEnd,
              cancelAtPeriodEnd: result.status === 'none' || result.cancelAtPeriodEnd,
              endDate: result.currentPeriodEnd || current.subscription.endDate,
            },
          }
        : current);
      setConfirmOpen(false);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Unable to cancel your subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const downloadStatement = async () => {
    setStatementLoading(true);
    setStatementError('');
    try {
      const statement = await apiClient.get<StatementResponse>('/api/subscriptions/invoices/statement.csv', getAppToken);
      if (!statement?.content) throw new Error('The billing statement is empty.');
      const blob = new Blob([statement.content], { type: statement.contentType || 'text/csv;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = statement.filename || 'billing-statement.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setStatementError(error instanceof Error ? error.message : 'Unable to download the billing statement.');
    } finally {
      setStatementLoading(false);
    }
  };

  const downloadInvoicePdf = async (invoice: Invoice) => {
    if (!invoice.paymentId) {
      setInvoiceDownloadError('Payment ID is missing for this invoice.');
      return;
    }

    setDownloadingInvoiceId(invoice.id);
    setInvoiceDownloadError('');

    try {
      const receipt = await apiClient.get<InvoiceReceipt>(
        `/api/subscriptions/invoices/${encodeURIComponent(invoice.paymentId)}/receipt`,
        getAppToken,
      );

      if (!receipt?.id) {
        throw new Error('Invoice receipt details could not be retrieved.');
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      const formattedAmount = formatMoney(receipt.amount, receipt.currency);
      const parsedDate = new Date(receipt.date);
      const formattedDate = Number.isNaN(parsedDate.getTime())
        ? '—'
        : parsedDate.toLocaleString('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });

      // A missing/unavailable logo should not prevent the invoice PDF from downloading.
      let logoData: string | null = null;
      try {
        logoData = await loadImageAsBase64(PhauseLogo);
      } catch (logoError) {
        console.warn('Phause logo could not be loaded for the invoice PDF:', logoError);
      }

      // White page background.
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Place a subtle, centered logo watermark in the white body BEFORE text.
      if (logoData) {
        const imageProperties = pdf.getImageProperties(logoData);
        const watermarkWidth = 112;
        const watermarkHeight = Math.min(62, watermarkWidth * imageProperties.height / imageProperties.width);
        const watermarkX = (pageWidth - watermarkWidth) / 2;
        const watermarkY = 145;

        pdf.saveGraphicsState();
        pdf.setGState(new (pdf as any).GState({ opacity: 0.055 }));
        pdf.addImage(
          logoData,
          'PNG',
          watermarkX,
          watermarkY,
          watermarkWidth,
          watermarkHeight,
          'phause-watermark',
          'FAST',
        );
        pdf.restoreGraphicsState();
      }

      // Dark branded header with invoice title on the left and logo on the right.
      pdf.setFillColor(15, 35, 55);
      pdf.rect(0, 0, pageWidth, 49, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.text('INVOICE', margin, 23);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text('PAYMENT RECEIPT', margin, 32);

      if (logoData) {
        const imageProperties = pdf.getImageProperties(logoData);
        const logoWidth = 37;
        const logoHeight = Math.min(19, logoWidth * imageProperties.height / imageProperties.width);
        const logoPanelWidth = 43;
        const logoPanelHeight = 17;
        const logoPanelX = pageWidth - margin - logoPanelWidth;
        const logoPanelY = 8;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(logoPanelX, logoPanelY, logoPanelWidth, logoPanelHeight, 2, 2, 'F');
        pdf.addImage(
          logoData,
          'PNG',
          logoPanelX + (logoPanelWidth - logoWidth) / 2,
          logoPanelY + (logoPanelHeight - logoHeight) / 2,
          logoWidth,
          logoHeight,
          'phause-header-logo',
          'FAST',
        );
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(`Invoice: ${receipt.id}`, pageWidth - margin, 40, { align: 'right' });

      // Invoice summary.
      pdf.setTextColor(35, 45, 55);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Invoice Summary', margin, 67);
      pdf.setFontSize(25);
      pdf.setTextColor(20, 115, 90);
      pdf.text(formattedAmount, margin, 83);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(110, 120, 130);
      pdf.text('Total paid', margin, 91);

      pdf.setDrawColor(225, 230, 235);
      pdf.line(margin, 102, pageWidth - margin, 102);

      // Payment details.
      pdf.setTextColor(35, 45, 55);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Payment Details', margin, 117);

      const details: [string, string][] = [
        ['Invoice ID', receipt.id],
        ['Payment ID', receipt.paymentId],
        ['Invoice Date', formattedDate],
        ['Description', receipt.description || '—'],
        ['Payment Provider', displayStatus(receipt.provider)],
        ['Payment Status', displayStatus(receipt.status)],
        ['Currency', (receipt.currency || 'USD').toUpperCase()],
      ];

      let y = 133;
      details.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(110, 120, 130);
        pdf.text(label, margin, y);

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(35, 45, 55);
        const wrappedValue = pdf.splitTextToSize(String(value), contentWidth - 48);
        pdf.text(wrappedValue, margin + 48, y);

        y += Math.max(12, wrappedValue.length * 5);
        pdf.setDrawColor(235, 238, 240);
        pdf.line(margin, y - 5, pageWidth - margin, y - 5);
      });

      // Total amount highlight.
      y += 10;
      pdf.setFillColor(245, 248, 250);
      pdf.roundedRect(margin, y, contentWidth, 25, 3, 3, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(35, 45, 55);
      pdf.text('TOTAL', margin + 6, y + 15);
      pdf.setFontSize(15);
      pdf.setTextColor(20, 115, 90);
      pdf.text(formattedAmount, pageWidth - margin - 6, y + 15, { align: 'right' });

      // Footer.
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(130, 140, 150);
      pdf.text(
        'This document was generated electronically from your billing records.',
        pageWidth / 2,
        278,
        { align: 'center' },
      );
      pdf.text('Thank you for your business.', pageWidth / 2, 284, { align: 'center' });

      const safeInvoiceId = receipt.id.replace(/[^a-zA-Z0-9-_]/g, '-');
      pdf.save(`invoice-${safeInvoiceId}.pdf`);
    } catch (error) {
      setInvoiceDownloadError(
        error instanceof Error ? error.message : 'Unable to download invoice PDF.',
      );
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const subscription = data?.subscription ?? null;
  const plan = subscription?.plan ?? null;
  const usage = data?.usage ?? null;
  const active = ['ACTIVE', 'TRIALING'].includes((subscription?.status ?? '').toUpperCase());
  const price = formatMoney(plan?.price, plan?.currency);
  const endDate = formatDate(subscription?.endDate);
  const addMethod = () => setMethods((current) => [...current, {
    id: Date.now(), brand: 'New card', last4: '0000', exp: '—',
    tint: 'var(--ax-viz-violet)', def: current.length === 0,
  }]);
  const setDefault = (id: number) => setMethods((current) => current.map((item) => ({ ...item, def: item.id === id })));
  const removeMethod = (id: number) => setMethods((current) => current.filter((item) => item.id !== id));

  return (
    <>
      <PageHead title="Billing" subtitle="Your plan, usage, payment methods and invoice history."
        actions={<>
          <Link className="ax-btn ax-btn--primary" to="/billing">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
            <span className="ax-btn__label">Change plan</span>
          </Link>
        </>}
      />

      {statementError && <div role="alert" className="ax-alert ax-alert--danger" style={{ marginBottom: 'var(--ax-space-5)' }}><p className="ax-alert__message">{statementError}</p></div>}
      {invoiceDownloadError && <div role="alert" className="ax-alert ax-alert--danger" style={{ marginBottom: 'var(--ax-space-5)' }}><p className="ax-alert__message">{invoiceDownloadError}</p></div>}

      {loadError && <div role="alert" className="ax-alert ax-alert--danger" style={{ marginBottom: 'var(--ax-space-5)' }}>
        <p className="ax-alert__message">{loadError}</p>
        <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => void fetchSubscription()}>Retry</button>
      </div>}

      {loading ? <div className="ax-skeleton" style={{ width: '100%', height: 180, borderRadius: 'var(--ax-radius-xl)' }} /> : (
        <div className="ax-dash-grid">
          {/* PLAN SUMMARY */}
          <section className="ax-card ax-card--accent-edge ax-col--8" role="region" aria-label="Current plan">
            <div className="ax-card__body">
              {subscription && plan ? <>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--ax-space-5)' }}>
                  <div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <span className="ax-card__eyebrow">Your plan</span>
                      <span className={`ax-badge ax-badge--soft ${active ? 'ax-badge--success' : 'ax-badge--warning'} ax-badge--pill`}><span className="ax-badge__dot" />{displayStatus(subscription.status)}</span>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'baseline', marginTop: 'var(--ax-space-2)' }}>
                      <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)', lineHeight: 1 }}>{plan.name}</b>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-md)' }}>{price} / {displayCycle(plan.billingCycle)}</span>
                    </div>
                    <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-2)' }}>
                      {subscription.autoRenew ? 'Renews on ' : 'Current period ends on '}
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{endDate}</span>
                      {' · '}{subscription.autoRenew ? 'Auto-renew enabled' : 'Auto-renew disabled'}
                    </p>
                    {plan.description && <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginTop: 6 }}>{plan.description}</p>}
                  </div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                    <Link className="ax-btn ax-btn--secondary" to="/pages/pricing">Change plan</Link>
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost"
                      style={{ color: 'var(--ax-danger-500)' }}
                      onClick={() => {
                        setCancelError('');
                        setConfirmOpen(true);
                      }}
                      disabled={!active || subscription.cancelAtPeriodEnd}
                    >
                      {subscription.cancelAtPeriodEnd ? 'Cancellation scheduled' : 'Cancel plan'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-5)' }}>
                  <div style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Next invoice</div>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{price}</div>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{endDate}</div>
                  </div>
                  <div style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Users in use</div>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>
                      {(usage?.usedUsers ?? 0).toLocaleString()} / {usage?.maxUsers == null ? 'Unlimited' : usage.maxUsers.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      {usage?.remainingUsers == null ? 'Remaining users not limited' : `${usage.remainingUsers} users available`}
                    </div>
                  </div>
                  <div style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Subscription started</div>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{formatDate(subscription.startDate)}</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Billing period start</div>
                  </div>
                </div>
              </> : <div style={{ padding: 'var(--ax-space-6)', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--ax-text-strong)' }}>No active subscription found</h2>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Choose a plan to get started.</p>
                <Link className="ax-btn ax-btn--primary" to="/pages/pricing">View plans</Link>
              </div>}
            </div>
          </section>

          {/* USAGE METERS */}
          <section className="ax-card ax-col--4" role="region" aria-label="Usage this period">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Usage</h2><p className="ax-card__subtitle">Current billing period</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              {usage ? <>
                <UsageMeter label="Campaigns" used={usage.usedCampaigns} limit={usage.maxCampaigns} />
                <UsageMeter label="Campaigns today" used={usage.usedCampaignsToday} limit={usage.maxCampaignsPerDay} tone="warning" />
                <UsageMeter label="Users / seats" used={usage.usedUsers} limit={usage.maxUsers} />
                <UsageMeter label="API calls" used={usage.usedApiRequests} limit={usage.monthlyApiQuota} tone="cyan" />
              </> : <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Usage information is not available.</p>}
            </div>
          </section>

          {/* PAYMENT METHODS — retained; connect payment-method API */}
          <section className="ax-card ax-col--6" role="region" aria-label="Payment methods">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Payment methods</h2></div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addMethod}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">Add method</span>
              </button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {methods.length ? <ul className="ax-list">{methods.map((m) => <li key={m.id} className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${m.tint} 16%,transparent)`, color: m.tint }}>{ICON_CARD}</span></span>
                <span className="ax-list__content"><span className="ax-list__title">{m.brand} ending <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{m.last4}</span></span><span className="ax-list__meta ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Expires {m.exp}</span></span>
                <span className="ax-list__trailing" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                  {m.def && <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Default</span>}
                  {!m.def && <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setDefault(m.id)}>Set default</button>}
                  {!m.def && <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Remove method" onClick={() => removeMethod(m.id)}>×</button>}
                </span>
              </li>)}</ul> : <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>No payment methods are returned by the current subscription API.</p>}
              <p style={{ marginTop: 10, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Add, remove and default actions are local placeholders until a payment-method API is connected.</p>
            </div>
          </section>

          {/* BILLING ADDRESS — retained; connect billing-profile API */}
          <section className="ax-card ax-col--6" role="region" aria-label="Billing details">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Billing details</h2></div><button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" disabled>Edit</button></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Billed to</div>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Billing address not available</div>
                <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>Connect your billing profile API to display the organisation address.</div>
              </div>
              <div style={{ borderTop: '1px solid var(--ax-border)', paddingTop: 'var(--ax-space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                <div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Billing email</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Not provided</div></div>
                <div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>VAT ID</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Not provided</div></div>
              </div>
            </div>
          </section>

          {/* INVOICE HISTORY — populated by GET /api/subscriptions/invoices */}
          <section className="ax-card ax-col--12" role="region" aria-label="Invoice history">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Invoice history</h2><p className="ax-card__subtitle">Invoices and payment details for your account</p></div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => void fetchInvoices()} disabled={invoicesLoading}>{invoicesLoading ? 'Refreshing…' : 'Refresh invoices'}</button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, paddingBottom: 'var(--ax-space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-4)', flexWrap: 'wrap', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-surface-subtle, var(--ax-surface))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', minWidth: 0 }}>
                  <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flex: '0 0 44px', width: 44, height: 44, borderRadius: 'var(--ax-radius-md)', color: 'var(--ax-success-600, var(--ax-accent))', background: 'color-mix(in oklab, var(--ax-success-500, var(--ax-accent)) 12%, transparent)' }}>{ICON_CSV}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <strong style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>billing-statement.csv</strong>
                    <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>CSV file · Complete billing statement · Excel compatible</span>
                  </span>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => void downloadStatement()} disabled={statementLoading}>
                  {ICON_DL}<span className="ax-btn__label">{statementLoading ? 'Preparing…' : 'Download CSV'}</span>
                </button>
              </div>
            </div>
            {invoicesError && <div role="alert" className="ax-alert ax-alert--danger" style={{ margin: '0 var(--ax-space-4) var(--ax-space-3)' }}><p className="ax-alert__message">{invoicesError}</p><button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => void fetchInvoices()}>Retry</button></div>}
            <div className="ax-table-wrap"><table className="ax-table ax-table--hover" style={{ minWidth: 1050 }}>
              <thead className="ax-table__head"><tr>
                <th className="ax-table__th" scope="col">Invoice ID</th>
                <th className="ax-table__th" scope="col">Payment ID</th>
                <th className="ax-table__th" scope="col">Date</th>
                <th className="ax-table__th" scope="col">Description</th>
                <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                <th className="ax-table__th" scope="col">Status</th>
                <th className="ax-table__th" scope="col">Provider</th>
                <th className="ax-table__th" scope="col">Receipt</th>
              </tr></thead>
              <tbody>
                {invoicesLoading ? <tr className="ax-table__row"><td className="ax-table__td" colSpan={8} style={{ textAlign: 'center', padding: 'var(--ax-space-6)' }}>Loading invoices…</td></tr>
                  : invoices.length ? invoices.map((invoice) => <tr key={invoice.id} className="ax-table__row">
                    <td className="ax-table__td"><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>{invoice.id}</span></td>
                    <td className="ax-table__td"><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>{invoice.paymentId || '—'}</span></td>
                    <td className="ax-table__td"><span>{formatDate(invoice.date)}</span><span style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>{invoice.date && !Number.isNaN(new Date(invoice.date).getTime()) ? new Date(invoice.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</span></td>
                    <td className="ax-table__td">{invoice.description || '—'}</td>
                    <td className="ax-table__td ax-table__td--num"><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{formatMoney(invoice.amount, invoice.currency)}</b></td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ${invoice.status?.toLowerCase() === 'succeeded' ? 'ax-badge--success' : 'ax-badge--warning'} ax-badge--pill`}>{displayStatus(invoice.status)}</span></td>
                    <td className="ax-table__td">{displayStatus(invoice.provider)}</td>
                    <td className="ax-table__td">
                      <button
                        type="button"
                        className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--sm"
                        onClick={() => void downloadInvoicePdf(invoice)}
                        disabled={downloadingInvoiceId === invoice.id || !invoice.paymentId}
                        title="Download invoice PDF"
                        aria-label={`Download invoice ${invoice.id} as PDF`}
                        style={{ width: 34, height: 34, display: 'inline-grid', placeItems: 'center' }}
                      >
                        {downloadingInvoiceId === invoice.id ? (
                          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" opacity=".25" />
                            <path d="M21 12a9 9 0 0 0-9-9" />
                          </svg>
                        ) : (
                          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 3v12" />
                            <path d="m7 10 5 5 5-5" />
                            <path d="M5 17v3h14v-3" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>)
                  : <tr className="ax-table__row"><td className="ax-table__td" colSpan={8} style={{ textAlign: 'center', color: 'var(--ax-text-muted)', padding: 'var(--ax-space-6)' }}>No invoices are available yet.</td></tr>}
              </tbody>
            </table></div>
            {!!invoices.length && <div className="ax-card__body" style={{ borderTop: '1px solid var(--ax-border)', paddingBlock: 'var(--ax-space-3)' }}>
              <p style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Showing {invoices.length} invoice{invoices.length === 1 ? '' : 's'}. Download billing-statement.csv above to export your billing records.</p>
            </div>}
          </section>
        </div>
      )}

      {confirmOpen && <div
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !cancelling) setConfirmOpen(false);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--ax-space-4)',
          background: 'rgba(8, 12, 20, .58)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cx-title"
          aria-describedby="cx-description"
          className="ax-card"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 440,
            overflow: 'hidden',
            border: '1px solid color-mix(in oklch, var(--ax-border) 72%, white)',
            background: 'color-mix(in oklch, var(--ax-surface-overlay) 84%, transparent)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 24px 80px rgba(0, 0, 0, .32)',
          }}
        >
          <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-7)' }}>
            <span className="ax-avatar ax-avatar--lg" style={{ background: 'color-mix(in oklch, var(--ax-danger-500) 12%, transparent)', color: 'var(--ax-danger-500)', marginInline: 'auto' }}>
              <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
            </span>
            <h2 id="cx-title" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>
              Cancel your {plan?.name ?? 'current'} plan?
            </h2>
            <p id="cx-description" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginTop: 'var(--ax-space-2)', lineHeight: 1.6 }}>
              Your plan will remain active until the current billing period ends on {endDate}. Are you sure you want to schedule its cancellation?
            </p>
            {cancelError && <p role="alert" className="ax-alert ax-alert--danger" style={{ marginTop: 'var(--ax-space-4)', textAlign: 'start' }}>{cancelError}</p>}
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center', marginTop: 'var(--ax-space-5)' }}>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setConfirmOpen(false)} disabled={cancelling}>
                Keep plan
              </button>
              <button type="button" className={`ax-btn ax-btn--danger${cancelling ? ' is-loading' : ''}`} onClick={() => void handleCancelSubscription()} disabled={cancelling}>
                {cancelling && <span className="ax-btn__spinner" aria-hidden="true" />}
                <span className="ax-btn__label">{cancelling ? 'Cancelling…' : 'Yes, cancel plan'}</span>
              </button>
            </div>
          </div>
        </section>
      </div>}
    </>
  );
}

export default Billing;
