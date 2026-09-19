import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import Toast from "../../components/ui/Toast.jsx";
import {
    AlertCircle,
    CheckCircle2,
    Coins,
    Filter,
    ListChecks,
    RotateCcw,
    Save,
    UserRound
} from "lucide-react";

const AssignFees = () => {
    const token = localStorage.getItem("token");
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedSem, setSelectedSem] = useState("");
    const [assignmentMode, setAssignmentMode] = useState("class");
    const [selectedStudent, setSelectedStudent] = useState("");
    const [amount, setAmount] = useState("");
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    const selectedCourseData = useMemo(
        () => courses.find((course) => course.course_code === selectedCourse),
        [courses, selectedCourse]
    );
    const semLabel = selectedCourseData?.sem_or_year?.toLowerCase() === "year" ? "Year" : "Semester";
    const semesterOptions = useMemo(() => {
        const total = Number(selectedCourseData?.total_semesters || 0);
        return Array.from({ length: total }, (_, index) => index + 1);
    }, [selectedCourseData]);

    useEffect(() => {
        if (!token) return;
        api.get("/api/courses", { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => setCourses(response.data || []))
            .catch(() => setError("Failed to load courses."));
    }, [token]);

    useEffect(() => {
        if (!selectedCourse || !selectedSem) {
            setStudents([]);
            setSelectedStudent("");
            return;
        }

        const loadStudents = async () => {
            try {
                setLoadingStudents(true);
                const response = await api.get(
                    `/api/attendance/students?course=${selectedCourse}&sem=${selectedSem}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setStudents(response.data || []);
                await loadAssignments(selectedCourse, selectedSem);
                setSelectedStudent("");
                setError("");
            } catch {
                setStudents([]);
                setError("Failed to load students for this class.");
            } finally {
                setLoadingStudents(false);
            }
        };

        loadStudents();
    }, [selectedCourse, selectedSem, token]);

    const getStudentKey = (student) => String(student.student_id || student.id || student.rollnumber);
    const getStudentName = (student) => student.name || `${student.firstname || ""} ${student.lastname || ""}`.trim() || "Unnamed student";

    const loadAssignments = async (courseCode, term) => {
        const response = await api.get(`/api/fees/report?course=${courseCode}&sem=${term}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setAssignments((response.data || []).reduce((result, item) => ({
            ...result,
            [String(item.student_id)]: { amount: Number(item.total_amount), course: courseCode, sem: term }
        }), {}));
    };

    const handleReset = () => {
        setSelectedCourse("");
        setSelectedSem("");
        setAssignmentMode("class");
        setSelectedStudent("");
        setAmount("");
        setStudents([]);
        setError("");
    };

    const handleAssign = async (event) => {
        event.preventDefault();
        const numericAmount = Number(amount);

        if (!selectedCourse || !selectedSem) {
            setError("Select a course and semester/year first.");
            return;
        }
        if (!numericAmount || numericAmount < 0) {
            setError("Enter a valid fee amount.");
            return;
        }
        if (assignmentMode === "individual" && !selectedStudent) {
            setError("Select a student to assign individual fees.");
            return;
        }

        const targetStudents = assignmentMode === "class"
            ? students
            : students.filter((student) => getStudentKey(student) === selectedStudent);

        try {
            setSaving(true);
            const response = await api.post("/api/fees/assign", {
                course_code: selectedCourse,
                semoryear: Number(selectedSem),
                amount: numericAmount,
                mode: assignmentMode,
                student_id: assignmentMode === "individual" ? Number(selectedStudent) : undefined
            }, { headers: { Authorization: `Bearer ${token}` } });
            await loadAssignments(selectedCourse, selectedSem);
            setError("");
            setToast({ type: "success", message: response.data.message });
        } catch (err) {
            const message = err.response?.data?.message || "Failed to assign fees.";
            setError(message);
            setToast({ type: "error", message });
        } finally {
            setSaving(false);
        }
    };

    const visibleAssignments = students.filter((student) => assignments[getStudentKey(student)]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-12">
            <header className="sticky top-0 z-20 bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-md shadow-emerald-500/20"><Coins className="w-5 h-5" /></div>
                        <div><h1 className="text-lg font-bold tracking-tight">Assign Fees</h1><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest hidden sm:block">Student Finance Configuration</p></div>
                    </div>
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"><RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset Form</span></button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
                {error && <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p>{error}</p></div>}

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4"><Filter className="w-4 h-4 text-emerald-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Class Selection</h2></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select value={selectedCourse} onChange={(event) => { setSelectedCourse(event.target.value); setSelectedSem(""); setError(""); }} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option value="">Select Course...</option>
                            {courses.map((course) => <option key={course.id} value={course.course_code}>{course.course_name}</option>)}
                        </select>
                        <select value={selectedSem} onChange={(event) => { setSelectedSem(event.target.value); setError(""); }} disabled={!selectedCourse} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-40 outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option value="">Select {semLabel}...</option>
                            {semesterOptions.map((semester) => <option key={semester} value={semester}>{semLabel} {semester}</option>)}
                        </select>
                    </div>
                </section>

                {selectedCourse && selectedSem ? (
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-5"><Coins className="w-4 h-4 text-emerald-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Fee Assignment</h2></div>
                        <form onSubmit={handleAssign} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${assignmentMode === "class" ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-800"}`}>
                                    <input type="radio" name="assignmentMode" value="class" checked={assignmentMode === "class"} onChange={(event) => setAssignmentMode(event.target.value)} className="mt-1 accent-emerald-600" />
                                    <span><span className="block text-sm font-bold">All / Whole Class</span><span className="block text-xs text-slate-500 mt-1">Assign the same amount to every student in this class.</span></span>
                                </label>
                                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${assignmentMode === "individual" ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-800"}`}>
                                    <input type="radio" name="assignmentMode" value="individual" checked={assignmentMode === "individual"} onChange={(event) => setAssignmentMode(event.target.value)} className="mt-1 accent-emerald-600" />
                                    <span><span className="block text-sm font-bold">Individual Student</span><span className="block text-xs text-slate-500 mt-1">Assign a fee amount to one selected student.</span></span>
                                </label>
                            </div>

                            {assignmentMode === "individual" && <select value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)} disabled={loadingStudents || students.length === 0} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm disabled:opacity-40 outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">{loadingStudents ? "Loading students..." : "Select Student..."}</option>{students.map((student) => <option key={getStudentKey(student)} value={getStudentKey(student)}>{getStudentName(student)} ({student.rollnumber || "No roll number"})</option>)}</select>}

                            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                                <label className="w-full sm:max-w-xs"><span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Fee Amount</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" className="w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></div></label>
                                <button type="submit" disabled={loadingStudents || saving || students.length === 0} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? "Saving..." : "Assign Fees"}</button>
                            </div>
                        </form>
                    </section>
                ) : <EmptyState />}

                {selectedCourse && selectedSem && <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"><UserRound className="w-4 h-4 text-emerald-500" /><h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Current Class Assignments</h2></div>{visibleAssignments.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No fee assignments made in this session.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{visibleAssignments.map((student) => <div key={getStudentKey(student)} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-bold">{getStudentName(student)}</p><p className="text-xs text-slate-500 font-mono mt-1">Roll No: {student.rollnumber || "-"}</p></div><span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-black"><CheckCircle2 className="w-3.5 h-3.5" /> ₹{assignments[getStudentKey(student)].amount}</span></div>)}</div>}</section>}
            </main>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
        </div>
    );
};

const EmptyState = () => <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center px-4"><ListChecks className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-4" /><h2 className="text-lg font-bold">Awaiting Class Selection</h2><p className="text-sm text-slate-500 mt-1 max-w-xs">Select a course and semester/year to configure student fees.</p></div>;

export default AssignFees;