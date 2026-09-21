import { useCallback, useEffect, useState } from "react";
import {
    AlertCircle,
    CalendarDays,
    CircleDollarSign,
    CreditCard,
    ExternalLink,
    Receipt,
    Wallet,
    X,
} from "lucide-react";
import api from "../../utils/api";
import Spinner from "../../components/ui/Spinner";
import Toast from "../../components/ui/Toast.jsx";

const EMPTY_FEE_DATA = {
    accounts: [],
    payments: [],
    payment_requests: [],
    credit_history: [],
};

const getErrorMessage = (error, fallback) => error.response?.data?.message || fallback;
const formatCurrency = value => `₹${Number(value || 0).toFixed(2)}`;
const formatDate = value => value ? new Date(value).toLocaleDateString() : "-";

const statusStyles = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    REJECTED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
};

const StudentFees = () => {
    const token = localStorage.getItem("token");
    const [student, setStudent] = useState(null);
    const [feeData, setFeeData] = useState(EMPTY_FEE_DATA);
    const [loading, setLoading] = useState(true);
    const [methodLoading, setMethodLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [methodError, setMethodError] = useState("");
    const [form, setForm] = useState({ amount: "", utr: "" });
    const [formError, setFormError] = useState("");

    const loadFeeData = useCallback(async () => {
        const response = await api.get("/api/fees/student", {
            headers: { Authorization: `Bearer ${token}` },
        });
        setFeeData({ ...EMPTY_FEE_DATA, ...(response.data || {}) });
    }, [token]);

    useEffect(() => {
        if (!token) return;

        const loadDashboard = async () => {
            setLoading(true);
            setError("");
            try {
                const [profileResponse] = await Promise.all([
                    api.get("/api/student/profile", {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    loadFeeData(),
                ]);
                setStudent(profileResponse.data);
            } catch (requestError) {
                setError(getErrorMessage(requestError, "Failed to load fee records."));
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [token, loadFeeData]);

    const openPaymentModal = async account => {
        setSelectedAccount(account);
        setPaymentMethod(null);
        setMethodError("");
        setFormError("");
        setForm({ amount: "", utr: "" });
        setMethodLoading(true);
        try {
            const response = await api.get(
                `/api/fees/payment-method?course=${encodeURIComponent(account.course_code)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPaymentMethod(response.data);
        } catch (requestError) {
            setMethodError(getErrorMessage(requestError, "Payment method is not configured for this course."));
        } finally {
            setMethodLoading(false);
        }
    };

    const closePaymentModal = (force = false) => {
        if (submitting && !force) return;
        setSelectedAccount(null);
        setPaymentMethod(null);
        setMethodError("");
        setFormError("");
    };

    const submitPaymentRequest = async event => {
        event.preventDefault();
        const amount = Number(form.amount);
        const utr = form.utr.trim();

        if (!Number.isInteger(amount) || amount <= 0 || amount % 100 !== 0) {
            setFormError("Enter a positive whole amount in multiples of ₹100.");
            return;
        }
        if (!utr) {
            setFormError("Enter the UTR from your payment receipt.");
            return;
        }

        setSubmitting(true);
        setFormError("");
        try {
            await api.post(
                "/api/fees/payment-requests",
                { fee_account_id: selectedAccount.fee_account_id, amount, utr },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await loadFeeData();
            setToast({ type: "success", message: "Payment request submitted for verification." });
            closePaymentModal(true);
        } catch (requestError) {
            setFormError(getErrorMessage(requestError, "Failed to submit payment request."));
        } finally {
            setSubmitting(false);
        }
    };

    const accounts = Array.isArray(feeData.accounts) ? feeData.accounts : [];
    const payments = Array.isArray(feeData.payments) ? feeData.payments : [];
    const paymentRequests = Array.isArray(feeData.payment_requests) ? feeData.payment_requests : [];
    const creditHistory = Array.isArray(feeData.credit_history) ? feeData.credit_history : [];
    const totals = accounts.reduce((summary, account) => ({
        total: summary.total + Number(account.total_amount || 0),
        paid: summary.paid + Number(account.paid_amount || 0),
        remaining: summary.remaining + Number(account.remaining_amount || 0),
    }), { total: 0, paid: 0, remaining: 0 });
    const availableCredit = creditHistory.reduce((balance, entry) => (
        balance + (entry.entry_type === "CREDIT_CREATED" ? Number(entry.amount || 0) : -Number(entry.amount || 0))
    ), 0);

    return (
        <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            <header className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg"><Receipt className="w-5 h-5" /></div>
                    <div><h1 className="text-lg font-bold tracking-tight">FEES</h1><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Student finance</p></div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {error && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 text-sm font-semibold flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
                {loading ? <div className="py-24 flex justify-center"><Spinner /></div> : <>
                    <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-6 sm:p-8 shadow-lg">
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">{student ? `${student.firstname || ""} ${student.lastname || ""}`.trim() : "Student account"}</p>
                        <h2 className="text-2xl font-black mt-2">Your fee summary</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                            <Summary label="Total fees" value={formatCurrency(totals.total)} icon={<Wallet className="w-4 h-4 text-emerald-100" />} />
                            <Summary label="Paid fees" value={formatCurrency(totals.paid)} icon={<CircleDollarSign className="w-4 h-4 text-emerald-100" />} />
                            <Summary label="Remaining fees" value={formatCurrency(totals.remaining)} icon={<Wallet className="w-4 h-4 text-emerald-100" />} />
                        </div>
                    </section>

                    <Section title="Fee accounts" icon={<Wallet className="w-4 h-4 text-emerald-500" />}>
                        {accounts.length === 0 ? <EmptyState text="No fee accounts available yet." /> : <div className="grid gap-3">{accounts.map(account => (
                            <div key={account.fee_account_id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div><p className="text-sm font-bold">{account.course_code} · {account.semoryear}</p><div className="grid grid-cols-3 gap-5 mt-3 text-xs"><Metric label="Total" value={formatCurrency(account.total_amount)} /><Metric label="Paid" value={formatCurrency(account.paid_amount)} /><Metric label="Remaining" value={formatCurrency(account.remaining_amount)} /></div></div>
                                <button type="button" onClick={() => openPaymentModal(account)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"><CreditCard className="w-4 h-4" /> Pay fee</button>
                            </div>
                        ))}</div>}
                    </Section>

                    <Section title="Payment requests" icon={<Receipt className="w-4 h-4 text-emerald-500" />}>
                        {paymentRequests.length === 0 ? <EmptyState text="No payment requests submitted yet." /> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{paymentRequests.map(request => <div key={request.request_id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><p className="text-sm font-bold">{request.course_code} · {request.semoryear}</p><p className="text-xs text-slate-500 mt-1">UTR: {request.utr} · Submitted {formatDate(request.submitted_at)}</p></div><div className="flex items-center gap-3"><span className="text-sm font-black">{formatCurrency(request.amount)}</span><StatusBadge status={request.status} /></div></div>{request.status === "REJECTED" && <p className="mt-2 text-xs text-red-600 dark:text-red-300">Reason: {request.rejection_reason_text || request.rejection_reason_code || "Not provided"}</p>}</div>)}</div>}
                    </Section>

                    <Section title="Verified payment history" icon={<CalendarDays className="w-4 h-4 text-emerald-500" />}>
                        {payments.length === 0 ? <EmptyState text="No payment records available yet." /> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{payments.map(payment => <div key={payment.payment_id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"><div><p className="text-sm font-bold">{payment.course_code} · {payment.semoryear}</p><p className="text-xs text-slate-500 mt-1">{formatDate(payment.paid_at)}{payment.note ? ` · ${payment.note}` : ""}</p></div><span className="text-sm font-black text-emerald-600">{formatCurrency(payment.amount)}</span></div>)}</div>}
                    </Section>

                    <Section title={`Credit history · ${formatCurrency(Math.max(availableCredit, 0))} available`} icon={<CircleDollarSign className="w-4 h-4 text-emerald-500" />}>
                        {creditHistory.length === 0 ? <EmptyState text="No credit history available." /> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{creditHistory.map(entry => <div key={entry.ledger_id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"><div><p className="text-sm font-bold">{entry.entry_type === "CREDIT_CREATED" ? "Credit created" : "Credit applied"}{entry.course_code ? ` · ${entry.course_code} ${entry.semoryear || ""}` : ""}</p><p className="text-xs text-slate-500 mt-1">{entry.reason} · {formatDate(entry.created_at)}</p></div><span className={`text-sm font-black ${entry.entry_type === "CREDIT_CREATED" ? "text-emerald-600" : "text-slate-600 dark:text-slate-300"}`}>{entry.entry_type === "CREDIT_CREATED" ? "+" : "-"}{formatCurrency(entry.amount)}</span></div>)}</div>}
                    </Section>
                </>}
            </main>

            {selectedAccount && <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="presentation" onMouseDown={event => event.target === event.currentTarget && closePaymentModal()}>
                <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
                    <div className="flex items-start justify-between gap-4"><div><h2 id="payment-dialog-title" className="text-lg font-black">Pay {selectedAccount.course_code} fees</h2><p className="text-xs text-slate-500 mt-1">Course payment destination</p></div><button type="button" onClick={closePaymentModal} disabled={submitting} aria-label="Close payment dialog" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button></div>
                    {methodLoading ? <div className="py-12 flex justify-center"><Spinner /></div> : methodError ? <div className="mt-5 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 text-sm font-semibold">{methodError}</div> : <>
                        <div className="mt-5 p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/10"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Official college UPI ID</p><p className="mt-1 text-lg font-black">{paymentMethod?.upi_id || "Unavailable"}</p>{paymentMethod?.qr_url && <img src={paymentMethod.qr_url} alt={`Official ${selectedAccount.course_code} college payment QR code`} className="mt-4 mx-auto w-52 h-52 object-contain rounded-lg bg-white p-2" />} {paymentMethod?.qr_url && <a href={paymentMethod.qr_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">Open QR image <ExternalLink className="w-3 h-3" /></a>}</div>
                        <form onSubmit={submitPaymentRequest} className="mt-5 space-y-4"><div><label htmlFor="payment-amount" className="block text-sm font-bold mb-1.5">Amount paid</label><input id="payment-amount" type="number" min="100" step="100" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" placeholder="5000" required /></div><div><label htmlFor="payment-utr" className="block text-sm font-bold mb-1.5">UTR</label><input id="payment-utr" type="text" value={form.utr} onChange={event => setForm(current => ({ ...current, utr: event.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" placeholder="Enter payment UTR" required /></div>{formError && <p className="text-sm text-red-600 dark:text-red-300" role="alert">{formError}</p>}<button type="submit" disabled={submitting || !paymentMethod?.upi_id} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">{submitting ? "Submitting..." : "Submit payment request"}</button></form>
                    </>}
                </div>
            </div>}
        </div>
    );
};

const Section = ({ title, icon, children }) => <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">{icon}<h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h2></div><div className="p-5">{children}</div></section>;
const Metric = ({ label, value }) => <div><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p><p className="text-sm font-black mt-1">{value}</p></div>;
const EmptyState = ({ text }) => <div className="py-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
const StatusBadge = ({ status }) => <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black tracking-wider ${statusStyles[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{status}</span>;
const Summary = ({ label, value, icon }) => <div className="bg-white/15 border border-white/20 rounded-xl p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-emerald-100">{label}</p>{icon}</div><p className="text-3xl font-black mt-2">{value}</p></div>;

export default StudentFees;
