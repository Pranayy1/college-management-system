import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import ConfirmSaveModal from "../../components/modals/ConfirmSaveModal";
import ImportMarksModal from "./ImportMarksModal";
import Alert from "../../components/ui/Alert";
import { 
  ListChecks, 
  Save, 
  RotateCcw, 
  FileUp, 
  BookOpen,
  ClipboardCheck,
  Calendar,
  Layers,
} from "lucide-react";

export default function FacultyEnterMarks() {
  const token = localStorage.getItem("token");

  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingMarks, setSavingMarks] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    const fetchAssignedSubjects = async () => {
      try {
        setLoadingSubjects(true);
        const res = await api.get("/api/faculty/assigned-subjects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAssignedSubjects(res.data || []);
      } catch {
        setError("Failed to load assigned subjects.");
      } finally {
        setLoadingSubjects(false);
      }
    };
    if (token) fetchAssignedSubjects();
  }, [token]);

  const selectedSubjectObj = useMemo(() => {
    return assignedSubjects.find(
      (item) => String(item.subjectcode) === String(selectedSubject)
    );
  }, [assignedSubjects, selectedSubject]);

  const selectedCourse = selectedSubjectObj?.courcecode || "";
  const selectedSem = selectedSubjectObj?.semoryear || "";

  useEffect(() => {
    if (!selectedCourse || !selectedSem) {
      setStudents([]);
      setMarks({});
      return;
    }
    const fetchStudents = async () => {
      try {
        const res = await api.get(
          `/api/marks/students?course=${selectedCourse}&sem=${selectedSem}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStudents(res.data || []);
        const initialMarks = {};
        (res.data || []).forEach((student) => {
          initialMarks[student.rollnumber] = { theory: "", practical: "" };
        });
        setMarks(initialMarks);
      } catch {
        setError("Failed to load students.");
      }
    };
    fetchStudents();
  }, [selectedCourse, selectedSem, token]);

  const handleMarkChange = (rollnumber, field, value) => {
    setMarks((prev) => ({
      ...prev,
      [rollnumber]: { ...prev[rollnumber], [field]: value },
    }));
  };

  const handleReset = () => {
    setSelectedSubject("");
    setStudents([]);
    setMarks({});
    setError("");
    setSuccess("");
  };

  const handleOpenSaveModal = () => {
    if (!selectedSubjectObj) return;

    for (const student of students) {
      if ((marks[student.rollnumber]?.theory ?? "") === "") {
        setError(`Enter theory marks for ${student.firstname} ${student.lastname}.`);
        return;
      }

      if (
        Number(selectedSubjectObj.practicalmarks || 0) > 0 &&
        (marks[student.rollnumber]?.practical ?? "") === ""
      ) {
        setError(`Enter practical marks for ${student.firstname} ${student.lastname}.`);
        return;
      }
    }

    setError("");
    setSuccess("");
    setShowSaveModal(true);
  };

  const saveMarks = async () => {
    try {
      setSavingMarks(true);
      const subjectHasPractical = Number(selectedSubjectObj?.practicalmarks || 0) > 0;
      const records = students.map((student) => ({
        rollnumber: student.rollnumber,
        theorymarks: marks[student.rollnumber]?.theory || 0,
        practicalmarks: subjectHasPractical
          ? marks[student.rollnumber]?.practical || 0
          : 0,
      }));

      await api.post(
        "/api/marks/save",
        {
          course: selectedCourse,
          sem: Number(selectedSem),
          subject: selectedSubject,
          subjectname: selectedSubjectObj?.subjectname,
          marks: records,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowSaveModal(false);
      setError("");
      setSuccess("Marks saved successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save marks.");
    } finally {
      setSavingMarks(false);
    }
  };

  const isReady = selectedSubject && selectedCourse && selectedSem;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* HEADER - Changed from 'sticky top-0' to 'relative' so it scrolls away */}
      <header className="relative z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-500/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight text-slate-900 dark:text-white">Log Marks</h1>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">Faculty Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowImportModal(true)}
              disabled={!isReady}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors disabled:opacity-30"
            >
              <FileUp className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Import Data</span>
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset Form</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Added extra bottom padding (pb-32) to account for the fixed footer */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 pb-32">
        
        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* DROPDOWN CARD */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 transition-colors">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 ml-1">Subject Configuration</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">{loadingSubjects ? "Fetching..." : "Select Subject"}</option>
              {assignedSubjects.map((sub, index) => (
                <option key={index} value={sub.subjectcode}>{sub.subjectname}</option>
              ))}
            </select>
          </div>

          {/* DETAILS INFO SECTION */}
          {selectedSubjectObj && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 transition-colors">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Course</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200 uppercase">{selectedCourse}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Semester</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{selectedSem}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Date</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{new Date().toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500 tracking-wider">Max Theory</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{selectedSubjectObj?.theorymarks ?? 100}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500 tracking-wider">Max Practical</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{selectedSubjectObj?.practicalmarks ?? 0}</p>
              </div>
            </div>
          )}
        </section>

        {/* TABLE SECTION */}
        {isReady && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 transition-colors">
              <h2 className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-500" /> Student Profile
              </h2>
              <div className="flex gap-12 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-widest pr-10">
                <span>Theory</span>
                {Number(selectedSubjectObj?.practicalmarks || 0) > 0 && <span>Practical</span>}
              </div>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {students.map((student) => (
                <div key={student.rollnumber} className="px-6 py-4 flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{student.rollnumber}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{student.firstname} {student.lastname}</span>
                  </div>
                  <div className="flex gap-6 items-center">
                    <input
                      type="number"
                      value={marks[student.rollnumber]?.theory || ""}
                      onChange={(e) => handleMarkChange(student.rollnumber, "theory", e.target.value)}
                      className="w-20 px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-center font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                    {Number(selectedSubjectObj?.practicalmarks || 0) > 0 && (
                      <input
                        type="number"
                        value={marks[student.rollnumber]?.practical || ""}
                        onChange={(e) => handleMarkChange(student.rollnumber, "practical", e.target.value)}
                        className="w-20 px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-center font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER BAR - Stays fixed to the bottom */}
      {isReady && students.length > 0 && (
        <div className="fixed bottom-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Active logging for {students.length} students
            </div>
            <button 
              onClick={handleOpenSaveModal}
              className="w-full sm:w-auto px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Save className="w-4 h-4" /> Save Marks
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}
      <ConfirmSaveModal
        show={showSaveModal}
        title="Confirm Grade Submission"
        message={`Are you sure you want to save scores for ${selectedSubjectObj?.subjectname}?`}
        confirmText="Save Marks"
        onCancel={() => setShowSaveModal(false)}
        onConfirm={saveMarks}
        loading={savingMarks}
      />
      {showImportModal && (
        <ImportMarksModal 
          token={token} 
          course={selectedCourse} 
          sem={selectedSem} 
          subject={selectedSubject} 
          onClose={() => setShowImportModal(false)} 
        />
      )}
    </div>
  );
}