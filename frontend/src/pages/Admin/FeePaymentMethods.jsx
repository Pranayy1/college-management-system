import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, Library, Save } from "lucide-react";
import api from "../../utils/api";
import Spinner from "../../components/ui/Spinner";
import Toast from "../../components/ui/Toast.jsx";

const QR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_QR_SIZE = 5 * 1024 * 1024;
const UPI_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,254}@[A-Za-z0-9.-]+$/;

const getErrorMessage = (error, fallback) => error.response?.data?.message || fallback;

const FeePaymentMethods = () => {
    const token = localStorage.getItem("token");
    const authConfig = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [upiId, setUpiId] = useState("");
    const [qrFile, setQrFile] = useState(null);
    const [qrPreview, setQrPreview] = useState("");
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingMethod, setLoadingMethod] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!token) return;
        api.get("/api/courses", authConfig)
            .then(response => setCourses(response.data || []))
            .catch(requestError => setError(getErrorMessage(requestError, "Failed to load courses.")))
            .finally(() => setLoadingCourses(false));
    }, [authConfig, token]);

    useEffect(() => () => {
        if (qrPreview) URL.revokeObjectURL(qrPreview);
    }, [qrPreview]);

    const loadPaymentMethod = async courseCode => {
        setLoadingMethod(true);
        setError("");
        setFormError("");
        setPaymentMethod(null);
        setUpiId("");
        setQrFile(null);
        setQrPreview("");
        try {
            const response = await api.get(
                `/api/fees/payment-method?course=${encodeURIComponent(courseCode)}`,
                authConfig
            );
            setPaymentMethod(response.data);
            setUpiId(response.data.upi_id || "");
        } catch (requestError) {
            if (requestError.response?.status === 404) {
                setError("");
                return;
            }
            setError(getErrorMessage(requestError, "Failed to load payment destination."));
        } finally {
            setLoadingMethod(false);
        }
    };

    const handleCourseChange = event => {
        const courseCode = event.target.value;
        setSelectedCourse(courseCode);
        if (courseCode) loadPaymentMethod(courseCode);
        else {
            setPaymentMethod(null);
            setUpiId("");
            setQrFile(null);
            setQrPreview("");
            setError("");
            setFormError("");
        }
    };

    const handleQrChange = event => {
        const file = event.target.files?.[0];
        setFormError("");
        if (!file) {
            setQrFile(null);
            setQrPreview("");
            return;
        }
        if (!QR_TYPES.includes(file.type)) {
            setQrFile(null);
            setQrPreview("");
            setFormError("Only PNG, JPEG, and WebP QR images are allowed.");
            event.target.value = "";
            return;
        }
        if (file.size > MAX_QR_SIZE) {
            setQrFile(null);
            setQrPreview("");
            setFormError("The QR image must be 5 MB or smaller.");
            event.target.value = "";
            return;
        }
        setQrFile(file);
        setQrPreview(URL.createObjectURL(file));
    };

    const handleSave = async event => {
        event.preventDefault();
        const normalizedUpi = upiId.trim();
        if (!selectedCourse) return setFormError("Select a course first.");
        if (!normalizedUpi || normalizedUpi.length > 255 || !UPI_PATTERN.test(normalizedUpi)) {
            return setFormError("Enter a valid UPI ID, such as college@upi.");
        }
        if (!qrFile) return setFormError("Select a new QR image before saving.");

        setSaving(true);
        setFormError("");
        try {
            const formData = new FormData();
            formData.append("course_code", selectedCourse);
            formData.append("upi_id", normalizedUpi);
            formData.append("qr_image", qrFile);
            const response = await api.post("/api/fees/payment-method", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            setToast({ type: "success", message: response.data.message || "Payment destination saved successfully." });
            await loadPaymentMethod(selectedCourse);
        } catch (requestError) {
            setFormError(getErrorMessage(requestError, "Failed to save payment destination."));
        } finally {
            setSaving(false);
        }
    };

    const selectedCourseData = courses.find(course => course.course_code === selectedCourse);

    return (
        <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-12">
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-lg"><Library className="w-5 h-5" /></div>
                    <div><h1 className="text-lg font-bold tracking-tight">Payment Methods</h1><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest hidden sm:block">Course payment destination</p></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6">
                {error && <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4"><Library className="w-4 h-4 text-blue-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Course selection</h2></div>
                    <select value={selectedCourse} onChange={handleCourseChange} disabled={loadingCourses} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-50"><option value="">{loadingCourses ? "Loading courses..." : "Select Course..."}</option>{courses.map(course => <option key={course.id} value={course.course_code}>{course.course_name} ({course.course_code})</option>)}</select>
                </section>

                {selectedCourse && <>
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                        <h2 className="text-sm font-bold">Current payment destination</h2>
                        <p className="text-xs text-slate-500 mt-1">{selectedCourseData?.course_name || selectedCourse} · {selectedCourse}</p>
                        {loadingMethod ? <div className="py-10 flex justify-center"><Spinner /></div> : paymentMethod ? <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Official UPI ID</p><p className="text-lg font-black mt-1">{paymentMethod.upi_id}</p></div>{paymentMethod.qr_url ? <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Current QR</p><img src={paymentMethod.qr_url} alt={`Current official ${selectedCourse} payment QR`} className="w-48 h-48 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-2" /></div> : <p className="text-sm text-slate-500">No QR image is currently available.</p>}</div> : <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm font-semibold">Payment destination is not configured for this course.</div>}
                    </section>

                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-5"><ImagePlus className="w-4 h-4 text-blue-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Configuration</h2></div>
                        <form onSubmit={handleSave} className="space-y-5">
                            <label className="block"><span className="block text-sm font-bold mb-1.5">UPI ID</span><input type="text" value={upiId} maxLength={255} onChange={event => { setUpiId(event.target.value); setFormError(""); }} placeholder="college@upi" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" /><span className="block text-xs text-slate-500 mt-1">Use the official college UPI ID for this course.</span></label>
                            <label className="block"><span className="block text-sm font-bold mb-1.5">QR image</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrChange} className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-bold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-500/10 dark:file:text-blue-300" /><span className="block text-xs text-slate-500 mt-1">PNG, JPEG, or WebP up to 5 MB. A new QR is required on every save.</span></label>
                            {qrPreview && <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/10"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">New QR preview · replaces current QR after saving</p><img src={qrPreview} alt="New payment QR preview" className="mt-3 w-48 h-48 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-2" /></div>}
                            {formError && <p className="text-sm text-red-600 dark:text-red-300" role="alert">{formError}</p>}
                            <button type="submit" disabled={saving || !selectedCourse || !qrFile} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save payment destination"}</button>
                        </form>
                    </section>
                </>}
            </main>
        </div>
    );
};

export default FeePaymentMethods;
