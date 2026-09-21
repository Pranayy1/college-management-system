import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    ClipboardCheck,
    Eye,
    Filter,
    RotateCcw,
    Search,
    XCircle,
} from "lucide-react";
import api from "../../utils/api";
import ConfirmSaveModal from "../../components/modals/ConfirmSaveModal.jsx";
import Spinner from "../../components/ui/Spinner";
import Toast from "../../components/ui/Toast.jsx";

const STATUS_STYLES = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    REJECTED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
};

const getErrorMessage = (error, fallback) => error.response?.data?.message || fallback;
const formatCurrency = value => `₹${Number(value || 0).toFixed(2)}`;
const formatDate = value => value ? new Date(value).toLocaleString() : "-";

const FeePaymentVerification = () => {
    const token = localStorage.getItem("token");
    const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const [courses, setCourses] = useState([]);
    const [requests, setRequests] = useState([]);
    const [status, setStatus] = useState("PENDING");
    const [search, setSearch] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [course, setCourse] = useState("");
    const [semoryear, setSemoryear] = useState("");
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [detail, setDetail] = useState(null);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionError, setRejectionError] = useState("");
    const [confirmVerify, setConfirmVerify] = useState(false);

    const selectedCourse = useMemo(() => courses.find(item => item.course_code === course), [courses, course]);
    const termLabel = selectedCourse?.sem_or_year?.toLowerCase() === "year" ? "Year" : "Semester";
    const termOptions = useMemo(
        () => Array.from({ length: Number(selectedCourse?.total_semesters || 0) }, (_, index) => index + 1),
        [selectedCourse]
    );

    useEffect(() => {
        if (!token) return;
        api.get("/api/courses", authConfig)
            .then(response => setCourses(response.data || []))
            .catch(requestError => setError(getErrorMessage(requestError, "Failed to load courses.")));
    }, [authConfig, token]);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ status });
            if (searchQuery) params.set("search", searchQuery);
            if (course) params.set("course", course);
            if (semoryear) params.set("semoryear", semoryear);
            const response = await api.get(`/api/fees/payment-requests?${params.toString()}`, authConfig);
            setRequests(Array.isArray(response.data) ? response.data : []);
        } catch (requestError) {
            setRequests([]);
            setError(getErrorMessage(requestError, "Failed to load payment requests."));
        } finally {
            setLoading(false);
        }
    }, [authConfig, course, searchQuery, semoryear, status]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const openReview = async request => {
        setSelectedRequest(request);
        setDetail(null);
        setShowRejectForm(false);
        setRejectionReason("");
        setRejectionError("");
        setDetailLoading(true);
        try {
            const response = await api.get(`/api/fees/payment-requests/${request.request_id}`, authConfig);
            setDetail(response.data);
        } catch (requestError) {
            setError(getErrorMessage(requestError, "Failed to load payment request details."));
        } finally {
            setDetailLoading(false);
        }
    };

    const closeReview = () => {
        if (actionSubmitting) return;
        setSelectedRequest(null);
        setDetail(null);
        setShowRejectForm(false);
        setRejectionReason("");
        setRejectionError("");
    };

    const verifyRequest = async () => {
        if (!selectedRequest) return;
        setActionSubmitting(true);
        try {
            await api.post(`/api/fees/payment-requests/${selectedRequest.request_id}/verify`, {}, authConfig);
            setToast({ type: "success", message: "Payment verified successfully." });
            setConfirmVerify(false);
            closeReview();
            await loadRequests();
        } catch (requestError) {
            setToast({ type: "error", message: getErrorMessage(requestError, "Failed to verify payment request.") });
        } finally {
            setActionSubmitting(false);
        }
    };

    const cancelRejection = () => {
        if (actionSubmitting) return;
        setShowRejectForm(false);
        setRejectionReason("");
        setRejectionError("");
    };

    const rejectRequest = async event => {
        event.preventDefault();
        const reason = rejectionReason.trim();
        if (!reason) {
            setRejectionError("A rejection reason is required.");
            return;
        }
        if (reason.length > 500) {
            setRejectionError("The rejection reason must be 500 characters or fewer.");
            return;
        }

        setActionSubmitting(true);
        setRejectionError("");
        try {
            await api.post(
                `/api/fees/payment-requests/${selectedRequest.request_id}/reject`,
                { reason },
                authConfig
            );
            setToast({ type: "success", message: "Payment request rejected." });
            closeReview();
            await loadRequests();
        } catch (requestError) {
            setRejectionError(getErrorMessage(requestError, "Failed to reject payment request."));
        } finally {
            setActionSubmitting(false);
        }
    };

    const resetFilters = () => {
        setStatus("PENDING");
        setSearch("");
        setSearchQuery("");
        setCourse("");
        setSemoryear("");
    };

    const reviewRequest = detail?.payment_request || selectedRequest;
    const isPending = reviewRequest?.status === "PENDING";

    return (
        <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-12">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg"><ClipboardCheck className="w-5 h-5" /></div>
                    <div><h1 className="text-lg font-bold tracking-tight">Payment Verification</h1><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest hidden sm:block">Review student UPI claims</p></div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
                {error && <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4"><Filter className="w-4 h-4 text-indigo-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Request filters</h2></div>
                    <form onSubmit={event => { event.preventDefault(); setSearchQuery(search.trim()); }} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select value={status} onChange={event => setStatus(event.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select>
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Student, roll number, or UTR" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" /></div>
                        <select value={course} onChange={event => { setCourse(event.target.value); setSemoryear(""); }} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"><option value="">All courses</option>{courses.map(item => <option key={item.id} value={item.course_code}>{item.course_name}</option>)}</select>
                        <div className="flex gap-2"><select value={semoryear} disabled={!course} onChange={event => setSemoryear(event.target.value)} className="min-w-0 flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-40"><option value="">All {termLabel.toLowerCase()}s</option>{termOptions.map(term => <option key={term} value={term}>{termLabel} {term}</option>)}</select><button type="button" onClick={resetFilters} aria-label="Reset filters" className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"><RotateCcw className="w-4 h-4" /></button></div>
                    </form>
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800"><h2 className="text-sm font-bold">Payment requests</h2></div>
                    {loading ? <div className="p-16 flex justify-center"><Spinner /></div> : requests.length === 0 ? <div className="p-16 text-center text-sm font-semibold text-slate-500">{status === "PENDING" ? "No pending payment requests." : "No payment requests found."}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[950px]"><thead className="bg-slate-50 dark:bg-slate-950/50"><tr>{["Student", "Roll number", "Course", "Term", "Amount", "UTR", "Status", "Submitted", "Action"].map(label => <th key={label} className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-slate-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{requests.map(request => <tr key={request.request_id}><td className="px-5 py-4 text-sm font-bold">{request.student_name || "-"}</td><td className="px-5 py-4 text-xs font-mono text-slate-500">{request.rollnumber || "-"}</td><td className="px-5 py-4 text-sm">{request.course_code}</td><td className="px-5 py-4 text-sm">{request.semoryear}</td><td className="px-5 py-4 text-sm font-black">{formatCurrency(request.amount)}</td><td className="px-5 py-4 text-xs font-mono">{request.utr}</td><td className="px-5 py-4"><StatusBadge status={request.status} /></td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(request.submitted_at)}</td><td className="px-5 py-4"><button type="button" onClick={() => openReview(request)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">{request.status === "PENDING" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {request.status === "PENDING" ? "Review" : "View"}</button></td></tr>)}</tbody></table></div>}
                </section>
            </main>

            {selectedRequest && <ReviewModal
                detailLoading={detailLoading}
                detail={detail}
                reviewRequest={reviewRequest}
                isPending={isPending}
                actionSubmitting={actionSubmitting}
                confirmVerify={confirmVerify}
                rejectionReason={rejectionReason}
                rejectionError={rejectionError}
                showRejectForm={showRejectForm}
                onClose={closeReview}
                onVerify={() => setConfirmVerify(true)}
                onConfirmVerify={verifyRequest}
                onCancelVerify={() => setConfirmVerify(false)}
                onShowReject={() => { setShowRejectForm(true); setRejectionError(""); }}
                onCancelReject={cancelRejection}
                onReasonChange={value => { setRejectionReason(value); setRejectionError(""); }}
                onReject={rejectRequest}
            />}
        </div>
    );
};

const ReviewModal = ({ detailLoading, detail, reviewRequest, isPending, actionSubmitting, confirmVerify, rejectionReason, rejectionError, showRejectForm, onClose, onVerify, onConfirmVerify, onCancelVerify, onShowReject, onCancelReject, onReasonChange, onReject }) => (
    <>
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6" role="dialog" aria-modal="true" aria-labelledby="request-review-title">
                <div className="flex items-start justify-between gap-4"><div><h2 id="request-review-title" className="text-lg font-black">Payment request review</h2><p className="text-xs text-slate-500 mt-1">Manual verification workflow</p></div><button type="button" onClick={onClose} disabled={actionSubmitting} aria-label="Close review" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><XCircle className="w-5 h-5" /></button></div>
                {detailLoading ? <div className="py-12 flex justify-center"><Spinner /></div> : <>
                    <div className="mt-5 grid grid-cols-2 gap-4"><Detail label="Student" value={reviewRequest?.student_name} /><Detail label="Roll number" value={reviewRequest?.rollnumber} /><Detail label="Course" value={reviewRequest?.course_code} /><Detail label="Semester/Year" value={reviewRequest?.semoryear} /><Detail label="Amount" value={formatCurrency(reviewRequest?.amount)} /><Detail label="UTR" value={reviewRequest?.utr} /><Detail label="Submitted" value={formatDate(reviewRequest?.submitted_at)} /><Detail label="Status" value={<StatusBadge status={reviewRequest?.status} />} /></div>
                    {detail?.fee_account && <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fee account</p><div className="grid grid-cols-2 gap-4 mt-3"><Detail label="Total amount" value={formatCurrency(detail.fee_account.total_amount)} /><Detail label="Current paid amount" value={formatCurrency(detail.fee_account.current_paid_amount)} /></div></div>}
                    {reviewRequest?.status === "REJECTED" && <p className="mt-4 text-sm text-red-600 dark:text-red-300">Reason: {reviewRequest.rejection_reason || "Not provided"}</p>}
                    {reviewRequest?.status === "VERIFIED" && <div className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">Verified {formatDate(reviewRequest.verified_at)} by {reviewRequest.verified_by || "Admin"}</div>}
                    {isPending && <div className="mt-6 space-y-4">
                        {!showRejectForm ? <div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={onVerify} disabled={actionSubmitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /> Verify Payment</button><button type="button" onClick={onShowReject} disabled={actionSubmitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50"><XCircle className="w-4 h-4" /> Reject Payment</button></div> : <form onSubmit={onReject} className="border-t border-slate-200 dark:border-slate-800 pt-4"><label htmlFor="rejection-reason" className="block text-sm font-bold mb-1.5">Rejection reason</label><textarea id="rejection-reason" maxLength={500} rows="3" value={rejectionReason} onChange={event => onReasonChange(event.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent resize-y" placeholder="Explain why this payment cannot be verified." /><p className="text-xs text-slate-500 mt-1">{rejectionReason.length}/500</p>{rejectionError && <p className="text-sm text-red-600 dark:text-red-300 mt-2" role="alert">{rejectionError}</p>}<div className="flex gap-2 mt-3"><button type="button" onClick={onCancelReject} disabled={actionSubmitting} className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold">Cancel</button><button type="submit" disabled={actionSubmitting} className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">{actionSubmitting ? "Rejecting..." : "Confirm rejection"}</button></div></form>}
                    </div>}
                </>}
            </div>
        </div>
        <ConfirmSaveModal show={confirmVerify} title="Verify Payment" message={`Verify this payment request from ${reviewRequest?.student_name || "the student"} for ${formatCurrency(reviewRequest?.amount)} with UTR ${reviewRequest?.utr || "-"}?`} confirmText="Verify Payment" onCancel={onCancelVerify} onConfirm={onConfirmVerify} loading={actionSubmitting} />
    </>
);

const Detail = ({ label, value }) => <div><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p><div className="text-sm font-bold mt-1 break-words">{value || "-"}</div></div>;
const StatusBadge = ({ status }) => <span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black tracking-wider ${STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{status || "-"}</span>;

export default FeePaymentVerification;
