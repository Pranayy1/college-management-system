import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, Receipt, RotateCcw } from "lucide-react";
import api from "../../utils/api";

const FeeStructureReport = ({ role }) => {
    const token = localStorage.getItem("token");
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedTerm, setSelectedTerm] = useState("");
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) return;
        api.get("/api/courses", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => setCourses(res.data || []))
            .catch(() => setError("Failed to load courses."));
    }, [token]);

    const course = useMemo(() => courses.find((item) => item.course_code === selectedCourse), [courses, selectedCourse]);
    const termLabel = course?.sem_or_year?.toLowerCase() === "year" ? "Year" : "Semester";
    const termOptions = useMemo(() => Array.from({ length: Number(course?.total_semesters || 0) }, (_, index) => index + 1), [course]);

    const reset = () => {
        setSelectedCourse("");
        setSelectedTerm("");
        setReportData([]);
        setError("");
    };

    useEffect(() => {
        if (!selectedCourse || !selectedTerm || !token) {
            setReportData([]);
            return;
        }
        const fetchReport = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/api/fees/report?course=${selectedCourse}&sem=${selectedTerm}`, { headers: { Authorization: `Bearer ${token}` } });
                setReportData(response.data || []);
                setError("");
            } catch (err) {
                setReportData([]);
                setError(err.response?.data?.message || "Failed to load fee report.");
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [selectedCourse, selectedTerm, token]);

    const totals = reportData.reduce((summary, item) => ({
        total: summary.total + Number(item.total_amount || 0),
        paid: summary.paid + Number(item.paid_amount || 0),
        remaining: summary.remaining + Number(item.remaining_amount || 0)
    }), { total: 0, paid: 0, remaining: 0 });

    return (
        <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
            <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 text-white rounded-lg"><Receipt className="w-5 h-5" /></div><div><h1 className="text-lg font-bold tracking-tight">Fees Structure Report</h1><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{role} panel</p></div></div>
                    <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {error && <p className="p-4 rounded-xl bg-red-50 text-red-600 text-sm font-semibold">{error}</p>}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4"><Filter className="w-4 h-4 text-indigo-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Report Selection</h2></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <select value={selectedCourse} onChange={(event) => { setSelectedCourse(event.target.value); setSelectedTerm(""); }} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="">Select Course...</option>{courses.map((item) => <option key={item.id} value={item.course_code}>{item.course_name}</option>)}</select>
                        <select value={selectedTerm} disabled={!selectedCourse} onChange={(event) => setSelectedTerm(event.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm disabled:opacity-40 outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="">Select {termLabel}...</option>{termOptions.map((term) => <option key={term} value={term}>{termLabel} {term}</option>)}</select>
                    </div>
                </section>
                {loading ? <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"><div className="w-8 h-8 mx-auto border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div> : selectedCourse && selectedTerm ? <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[{ label: "Assigned", value: totals.total }, { label: "Paid", value: totals.paid }, { label: "Remaining", value: totals.remaining }].map((item) => <div key={item.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{item.label} fees</p><p className="text-2xl font-black mt-2">₹{item.value.toFixed(2)}</p></div>)}
                    </div>
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-200 dark:border-slate-800"><h2 className="text-sm font-bold">{course.course_name} · {termLabel} {selectedTerm}</h2></div>{reportData.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No fee assignments found for this class.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px]"><thead className="bg-slate-50 dark:bg-slate-950/50"><tr><th className="px-5 py-3 text-left text-[10px] uppercase text-slate-500">Student</th><th className="px-5 py-3 text-center text-[10px] uppercase text-slate-500">Assigned</th><th className="px-5 py-3 text-center text-[10px] uppercase text-slate-500">Paid</th><th className="px-5 py-3 text-center text-[10px] uppercase text-slate-500">Remaining</th><th className="px-5 py-3 text-center text-[10px] uppercase text-slate-500">Last payment</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{reportData.map((item) => <tr key={item.fee_account_id}><td className="px-5 py-4"><p className="text-sm font-bold">{item.firstname} {item.lastname}</p><p className="text-xs text-slate-500 font-mono">{item.rollnumber}</p></td><td className="px-5 py-4 text-center text-sm">₹{Number(item.total_amount).toFixed(2)}</td><td className="px-5 py-4 text-center text-sm text-emerald-600">₹{Number(item.paid_amount).toFixed(2)}</td><td className="px-5 py-4 text-center text-sm font-bold text-amber-600">₹{Number(item.remaining_amount).toFixed(2)}</td><td className="px-5 py-4 text-center text-xs text-slate-500">{item.last_paid_at ? new Date(item.last_paid_at).toLocaleDateString() : "Not paid"}</td></tr>)}</tbody></table></div>}</section>
                </> : <section className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center"><BarChart3 className="w-10 h-10 mx-auto text-indigo-500 mb-4" /><h2 className="text-lg font-bold">Select a course and term</h2><p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">Choose the course and semester/year to view assigned, paid, and remaining fees.</p></section>}
            </main>
        </div>
    );
};

export default FeeStructureReport;