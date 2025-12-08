import { useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Search, User } from "lucide-react";
import { Card } from "../ui/Card";
import { debounce } from "../../lib/utils";

export function StudentSearch({ onSelect, selected }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function (300ms delay)
  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("students")
          .select(
            `
            *,
            colleges (name)
          `
          )
          .or(
            `full_name.ilike.%${searchQuery}%,student_id.ilike.%${searchQuery}%`
          )
          .limit(20);

        if (error) throw error;
        setResults(data || []);
        setShowResults(true);
      } catch (error) {
        console.error("Error searching students:", error);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  function handleInputChange(e) {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  }

  function handleSelect(student) {
    onSelect(student);
    setQuery(student.full_name);
    setShowResults(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or student ID..."
          value={selected ? selected.full_name : query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg"
        />
      </div>

      {/* Results Dropdown */}
      {showResults && !selected && (
        <Card className="absolute z-10 w-full mt-2 max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-slate-500">
              <div className="loading-shimmer h-20 rounded-lg" />
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              No students found
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {results.map((student) => (
                <button
                  key={student.student_id}
                  onClick={() => handleSelect(student)}
                  className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                      {student.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {student.full_name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {student.student_id} •{" "}
                        {student.colleges?.name || "No College"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {student.department} • Year {student.year_level}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Selected Student Display */}
      {selected && (
        <Card className="mt-2 p-4 bg-primary-50 dark:bg-primary-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg">
                {selected.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {selected.full_name}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selected.student_id}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onSelect(null);
                setQuery("");
              }}
              className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
