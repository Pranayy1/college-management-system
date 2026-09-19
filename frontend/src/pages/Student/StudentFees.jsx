import { useEffect, useState } from "react";
import { CalendarDays, CircleDollarSign, CreditCard, Receipt, Wallet } from "lucide-react";
import api from "../../utils/api";

const StudentFees = () => {
	const token = localStorage.getItem("token");
	const [student, setStudent] = useState(null);

	useEffect(() => {
		if (!token) return;
		api.get("/api/student/profile", { headers: { Authorization: `Bearer ${token}` } }).then((res) => setStudent(res.data)).catch(() => setStudent(null));
	}, [token]);

	return (
		<div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
			<header className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800"><div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3"><div className="p-2 bg-emerald-600 text-white rounded-lg"><Receipt className="w-5 h-5" /></div><div><h1 className="text-lg font-bold tracking-tight">FEES</h1><p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Student finance</p></div></div></header>
			<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
				<section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-6 sm:p-8 shadow-lg"><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">{student ? `${student.firstname || ""} ${student.lastname || ""}`.trim() : "Student account"}</p><h2 className="text-2xl font-black mt-2">Your fee summary</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6"><Summary label="Remaining fees" value="--" icon={Wallet} /><Summary label="Paid fees" value="--" icon={CircleDollarSign} /></div></section>
				<section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-emerald-500" /><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment history</h2></div><div className="p-10 text-center"><CreditCard className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-700" /><p className="text-sm font-semibold text-slate-500 mt-3">No payment records available yet.</p><p className="text-xs text-slate-400 mt-1">Paid amounts and payment dates will appear here.</p></div></section>
				<section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h2 className="text-sm font-bold">Pay fees</h2><p className="text-xs text-slate-500 mt-1">Online payment will be available here once it is configured.</p></div><button disabled className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 text-sm font-bold cursor-not-allowed"><CreditCard className="w-4 h-4" /> Pay fees</button></section>
			</main>
		</div>
	);
};

const Summary = ({ label, value, icon: Icon }) => <div className="bg-white/15 border border-white/20 rounded-xl p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-emerald-100">{label}</p><Icon className="w-4 h-4 text-emerald-100" /></div><p className="text-3xl font-black mt-2">{value}</p></div>;

export default StudentFees;
