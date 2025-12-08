import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Download,
  RefreshCw,
  Edit3,
  Clock,
} from "lucide-react";

export function StudentImporter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [semesterSearch, setSemesterSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSemesters();
  }, []);

  async function fetchSemesters() {
    const { data, error } = await supabase
      .from("semesters")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSemesters(data);
      // Auto-select active semester if available
      const activeSem = data.find((s) => s.is_active);
      if (activeSem) {
        setSelectedSemester(activeSem.id);
        setSemesterSearch(activeSem.name);
      }
    }
  }

  // Filter semesters by search
  const filteredSemesters = semesters.filter((sem) =>
    sem.name.toLowerCase().includes(semesterSearch.toLowerCase())
  );

  // Smart dropdown visibility - hide if search matches selected semester exactly
  const selectedSemesterName =
    semesters.find((s) => s.id === selectedSemester)?.name || "";
  const showDropdown =
    semesterSearch &&
    filteredSemesters.length > 0 &&
    semesterSearch !== selectedSemesterName;

  // Keyboard navigation handler
  function handleKeyDown(e) {
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSemesters.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredSemesters.length
        ) {
          const selected = filteredSemesters[highlightedIndex];
          setSelectedSemester(selected.id);
          setSemesterSearch(selected.name);
          setHighlightedIndex(-1);
        }
        break;
      case "Escape":
        setHighlightedIndex(-1);
        break;
    }
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  }

  function handleDrop(e) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }

  function processFile(selectedFile) {
    // Validate file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(csv|xlsx|xls)$/)
    ) {
      alert("Please upload a CSV or Excel file (.csv, .xls, .xlsx)");
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  }

  function parseFile(file) {
    const reader = new FileReader();
    const isCSV = file.name.toLowerCase().endsWith(".csv");

    reader.onload = (e) => {
      try {
        let allData = [];

        if (isCSV) {
          // Handle CSV with UTF-8 encoding
          const text = e.target.result;
          const workbook = XLSX.read(text, { type: "string", raw: false });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          allData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        } else {
          // Handle Excel - process ALL sheets
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Iterate through all sheets and concatenate data
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            allData = allData.concat(sheetData);
          });
        }

        // Normalize headers and validate
        const normalizedData = normalizeData(allData);
        setPreviewData(normalizedData.slice(0, 5)); // Show first 5 rows
      } catch (error) {
        console.error("Parse error:", error);
        alert("Error parsing file. Please check the format.");
        setFile(null);
      }
    };

    // Use readAsText for CSV with UTF-8, readAsArrayBuffer for Excel
    if (isCSV) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  function normalizeData(rawData) {
    return rawData
      .map((row) => {
        const normalized = {};

        // Map headers (case-insensitive)
        Object.keys(row).forEach((key) => {
          const upperKey = key.toUpperCase().trim();

          if (upperKey.includes("ID") && upperKey.includes("NO")) {
            normalized.student_id = String(row[key]).trim();
          } else if (upperKey === "NAME" || upperKey.includes("FULL")) {
            normalized.full_name = String(row[key]).trim();
          } else if (upperKey === "MAJOR") {
            normalized.major = String(row[key]).trim();
          } else if (upperKey === "YEAR") {
            normalized.year_level = String(row[key]).trim();
          } else if (upperKey === "DEPT" || upperKey === "DEPARTMENT") {
            normalized.department = String(row[key]).trim();
          } else if (upperKey === "COLLEGE") {
            normalized.college_code = String(row[key]).trim().toUpperCase();
          }
        });

        return normalized;
      })
      .filter((row) => row.student_id && row.full_name); // Remove rows without required fields
  }

  async function handleImport() {
    if (!selectedSemester) {
      alert("Please select a semester");
      return;
    }

    if (!file) {
      alert("Please select a file to upload");
      return;
    }

    setUploading(true);
    setProgress(0);

    // Parse the full file
    const reader = new FileReader();
    const isCSV = file.name.toLowerCase().endsWith(".csv");

    reader.onload = async (e) => {
      try {
        let allData = [];

        if (isCSV) {
          // Handle CSV with UTF-8 encoding
          const text = e.target.result;
          const workbook = XLSX.read(text, { type: "string", raw: false });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          allData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        } else {
          // Handle Excel - process ALL sheets
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Iterate through all sheets and concatenate data
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            allData = allData.concat(sheetData);
          });
        }

        const normalizedData = normalizeData(allData);
        await processBatchImport(normalizedData, selectedSemester);
      } catch (error) {
        console.error("Import error:", error);
        alert("Import failed: " + error.message);
        setUploading(false);
      }
    };

    // Use readAsText for CSV with UTF-8, readAsArrayBuffer for Excel
    if (isCSV) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  async function processBatchImport(studentsArray, semesterId) {
    const errors = [];
    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const importEntries = []; // Track inserted/updated students for log

    // Step 1: Get all colleges to match codes
    const { data: colleges } = await supabase.from("colleges").select("*");
    const collegeMap = {};
    colleges?.forEach((c) => {
      collegeMap[c.code.toUpperCase()] = c.id;
    });

    // Step 2: Check for duplicates within the file
    const seen = new Set();
    const uniqueStudents = [];

    studentsArray.forEach((student, index) => {
      if (seen.has(student.student_id)) {
        errors.push({
          row: index + 2, // +2 for header and 0-index
          student_id: student.student_id,
          error: "Duplicate ID in file",
        });
      } else {
        seen.add(student.student_id);
        uniqueStudents.push(student);
      }
    });

    // Step 3: Fetch existing students to compare (batched to bypass 1000 limit)
    const studentIds = uniqueStudents.map((s) => s.student_id);
    const existingMap = {};

    // Fetch in batches of 500 to stay well under limit
    const FETCH_BATCH_SIZE = 500;
    for (let i = 0; i < studentIds.length; i += FETCH_BATCH_SIZE) {
      const batchIds = studentIds.slice(i, i + FETCH_BATCH_SIZE);
      const { data: existingStudents } = await supabase
        .from("students")
        .select("*")
        .in("student_id", batchIds);

      existingStudents?.forEach((s) => {
        existingMap[s.student_id] = s;
      });
    }

    // Step 4: Process in batches of 100
    const BATCH_SIZE = 100;
    const batches = [];
    for (let i = 0; i < uniqueStudents.length; i += BATCH_SIZE) {
      batches.push(uniqueStudents.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Prepare payload
      const studentPayload = await Promise.all(
        batch.map(async (s) => {
          let collegeId = collegeMap[s.college_code];

          // Auto-create college if it doesn't exist
          if (s.college_code && !collegeId) {
            const { data: newCollege, error: collegeError } = await supabase
              .from("colleges")
              .insert({ code: s.college_code, name: s.college_code })
              .select()
              .single();

            if (!collegeError && newCollege) {
              collegeId = newCollege.id;
              collegeMap[s.college_code] = collegeId;
            }
          }

          const payload = {
            student_id: s.student_id,
            full_name: s.full_name,
            major: s.major || null,
            year_level: s.year_level || null,
            department: s.department || null,
            college_id: collegeId || null,
          };

          // Helper to compare values robustly (treats null/undefined/"" as equal, trims strings)
          const areValuesDifferent = (val1, val2) => {
            const v1 =
              val1 === null || val1 === undefined ? "" : String(val1).trim();
            const v2 =
              val2 === null || val2 === undefined ? "" : String(val2).trim();
            return v1 !== v2;
          };

          // Check if data has changed
          const existing = existingMap[s.student_id];
          if (existing) {
            const hasChanges =
              areValuesDifferent(existing.full_name, payload.full_name) ||
              areValuesDifferent(existing.major, payload.major) ||
              areValuesDifferent(existing.year_level, payload.year_level) ||
              areValuesDifferent(existing.department, payload.department) ||
              areValuesDifferent(existing.college_id, payload.college_id);

            if (!hasChanges) {
              return { ...payload, _unchanged: true };
            }
          }

          return payload;
        })
      );

      // Separate unchanged from changed/new
      const toUpsert = studentPayload.filter((p) => !p._unchanged);
      unchangedCount += studentPayload.filter((p) => p._unchanged).length;

      if (toUpsert.length > 0) {
        // Clean the _unchanged flag
        toUpsert.forEach((p) => delete p._unchanged);

        // Upsert students
        const { data: upsertedStudents, error: upsertError } = await supabase
          .from("students")
          .upsert(toUpsert, { onConflict: "student_id" })
          .select();

        if (upsertError) {
          console.error("Upsert error:", upsertError);
          errors.push({
            batch: batchIndex + 1,
            error: upsertError.message,
          });
          continue;
        }

        // Count inserted vs updated and track entries
        upsertedStudents.forEach((s) => {
          const existing = existingMap[s.student_id];
          if (existing) {
            updatedCount++;
            importEntries.push({
              student_id: s.student_id,
              action: "updated",
              old_data: existing,
              new_data: s,
            });
          } else {
            insertedCount++;
            importEntries.push({
              student_id: s.student_id,
              action: "inserted",
              old_data: null,
              new_data: s,
            });
          }
        });

        // Create enrollment records
        const enrollments = upsertedStudents.map((s) => ({
          student_id: s.student_id,
          semester_id: semesterId,
          enrolled_at: new Date().toISOString(),
        }));

        await supabase.from("semester_enrollments").upsert(enrollments, {
          onConflict: "student_id,semester_id",
          ignoreDuplicates: true,
        });
      }

      // Update progress
      setProgress(Math.round(((batchIndex + 1) / batches.length) * 100));
    }

    // Create import log record
    try {
      const { data: logRecord, error: logError } = await supabase
        .from("student_import_logs")
        .insert({
          imported_by: user?.id,
          semester_id: semesterId,
          file_name: file?.name || "Unknown",
          total_rows: studentsArray.length,
          inserted_count: insertedCount,
          updated_count: updatedCount,
          unchanged_count: unchangedCount,
          error_count: errors.length,
        })
        .select()
        .single();

      if (logError) {
        console.error("Error creating import log:", logError);
      } else if (logRecord && importEntries.length > 0) {
        // Create import entry records in batches
        const entryBatches = [];
        for (let i = 0; i < importEntries.length; i += 100) {
          entryBatches.push(importEntries.slice(i, i + 100));
        }

        for (const entryBatch of entryBatches) {
          const entriesToInsert = entryBatch.map((entry) => ({
            import_log_id: logRecord.id,
            student_id: entry.student_id,
            action: entry.action,
            old_data: entry.old_data,
            new_data: entry.new_data,
          }));

          await supabase.from("student_import_entries").insert(entriesToInsert);
        }
      }

      // Create notifications for super admins
      if (logRecord) {
        try {
          // Get semester name for notification
          const { data: semInfo } = await supabase
            .from("semesters")
            .select("name")
            .eq("id", semesterId)
            .single();

          // Get super admins with student_imports enabled
          const { data: superAdmins } = await supabase
            .from("profiles")
            .select("id, username, notification_preferences")
            .eq("role", "super_admin")
            .eq("status", "active");

          // Get current user's profile for username
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user?.id)
            .single();

          const notificationsToCreate = [];
          const currentUsername = currentProfile?.username || "Unknown";

          superAdmins?.forEach((admin) => {
            // Skip self-notification
            if (admin.id === user?.id) return;

            // Check if they have student_imports enabled
            const prefs = admin.notification_preferences || {};
            if (prefs.student_imports === false) return;

            notificationsToCreate.push({
              user_id: admin.id,
              type: "student_import",
              message: `${currentUsername} imported students to ${
                semInfo?.name || "semester"
              }: +${insertedCount} new, ${updatedCount} updated`,
              reference_id: logRecord.id,
            });
          });

          if (notificationsToCreate.length > 0) {
            await supabase.from("notifications").insert(notificationsToCreate);
          }
        } catch (notifErr) {
          console.error("Error creating import notifications:", notifErr);
        }
      }
    } catch (logErr) {
      console.error("Error logging import:", logErr);
    }

    // Show results
    setResults({
      inserted: insertedCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      errors,
    });
    setShowResults(true);
    setUploading(false);
    setFile(null);
    setPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadErrorLog() {
    const errorData = results.errors.map((e) => ({
      Row: e.row || "N/A",
      "Student ID": e.student_id || "N/A",
      Error: e.error,
    }));

    const ws = XLSX.utils.json_to_sheet(errorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "import_errors.xlsx");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Import Students
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Upload CSV or Excel files to batch import students
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/students/import/logs")}
          className="flex items-center"
        >
          <Clock className="w-4 h-4 mr-2" />
          View Import Logs
        </Button>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* Semester Selection - Searchable */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Semester <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search semester..."
                value={semesterSearch}
                onChange={(e) => {
                  setSemesterSearch(e.target.value);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {filteredSemesters.map((sem, index) => (
                    <div
                      key={sem.id}
                      onClick={() => {
                        setSelectedSemester(sem.id);
                        setSemesterSearch(sem.name);
                        setHighlightedIndex(-1);
                      }}
                      className={`px-4 py-2 cursor-pointer transition-colors ${
                        index === highlightedIndex
                          ? "bg-primary-100 dark:bg-primary-900/40"
                          : selectedSemester === sem.id
                          ? "bg-primary-50 dark:bg-primary-900/20"
                          : "hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-900 dark:text-slate-100">
                          {sem.name}
                        </span>
                        {sem.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* File Upload with Drag & Drop */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Upload File <span className="text-red-500">*</span>
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:border-primary-500 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  CSV, XLS, XLSX (Max 10MB)
                </p>
              </label>
            </div>
          </div>

          {/* Required Headers Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Required Column Headers
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-blue-700 dark:text-blue-300">
              <div>
                • <strong>ID NO</strong> (or similar)
              </div>
              <div>
                • <strong>NAME</strong>
              </div>
              <div>
                • <strong>MAJOR</strong>
              </div>
              <div>
                • <strong>YEAR</strong>
              </div>
              <div>
                • <strong>DEPT</strong>
              </div>
              <div>
                • <strong>COLLEGE</strong> (code)
              </div>
            </div>
          </div>

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Preview (First 5 rows)
              </h3>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                        Major
                      </th>
                      <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                        Year
                      </th>
                      <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                        Dept
                      </th>
                      <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-200">
                        College
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-800">
                        <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                          {row.student_id}
                        </td>
                        <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                          {row.full_name}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {row.major}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {row.year_level}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {row.department}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {row.college_code}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Importing students...
                </span>
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!selectedSemester || !file || uploading}
              loading={uploading}
              className="flex-1 flex items-center justify-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Students
            </Button>
            {file && !uploading && (
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setPreviewData([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex items-center"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results Modal with 3-way breakdown */}
      <Modal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        title="Import Results"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {/* Inserted */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-semibold text-green-900 dark:text-green-100">
                  Inserted
                </span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {results.inserted}
              </p>
            </div>

            {/* Updated */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  Updated
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {results.updated}
              </p>
            </div>

            {/* Unchanged */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Unchanged
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                {results.unchanged}
              </p>
            </div>
          </div>

          {/* Errors */}
          {results.errors.length > 0 && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="font-semibold text-orange-900 dark:text-orange-100">
                  Errors: {results.errors.length}
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {results.errors.slice(0, 5).map((err, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-orange-700 dark:text-orange-300"
                  >
                    {err.row && `Row ${err.row}: `}
                    {err.student_id && `${err.student_id} - `}
                    {err.error}
                  </div>
                ))}
                {results.errors.length > 5 && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 italic">
                    ...and {results.errors.length - 5} more errors
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={downloadErrorLog}
                className="mt-3 w-full flex justify-center items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Error Log
              </Button>
            </div>
          )}

          <Button onClick={() => setShowResults(false)} className="w-full">
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
