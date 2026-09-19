import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, Receipt, RotateCcw } from "lucide-react";
import api from "../../utils/api";

const FeeStructureReport = ({ role }) => {
    const token = localStorage.getItem("token");
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedTerm, setSelectedTerm] = useState("");
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
        setError("");
    };

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
                <section className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center"><BarChart3 className="w-10 h-10 mx-auto text-indigo-500 mb-4" /><h2 className="text-lg font-bold">{selectedCourse && selectedTerm ? `${course.course_name} · ${termLabel} ${selectedTerm}` : "Select a course and term"}</h2><p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">The fee structure report is ready for this selection. Fee amounts will appear here when fee data is connected.</p></section>
            </main>
        </div>
    );
};

export default FeeStructureReport;