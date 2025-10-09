'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PhilippinePeso as PesoSign,
  Clock,
  List,
  CreditCard,
  X,
  ChevronLeft,
  Send,
  Loader2,
  RefreshCw,
  Database, // Icon for sheet ID
  Save, // Icon for overall money save
  Eye, // Icon for viewing transactions
}
  from 'lucide-react';



// --- Type Definitions ---
interface Expense {
  id: string;
  time_stamp: string;
  category: string;
  payment: string;
  expense: number;
  total: number;
  userId: string;
}

// --- API Service Functions (Unchanged) ---
const MOCK_USER_ID = 'live-sheet-user-5000';

const fetchExpenses = async (sheetId: string): Promise<{ expenses: Expense[], overallMoney: number }> => {
  const response = await fetch(`/api/expenses?sheetId=${sheetId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch expenses from API. Status: ${response.status}`);
  }
  const data: { expenses: [], overallMoney: any } = await response.json();

  const expenses: Expense[] = data.expenses.map((item: any) => ({
    ...item,
    expense: parseFloat(item.expense),
    total: parseFloat(item.total)
  }));

  const overallMoney: number = parseFloat(data.overallMoney) || 0;

  return { expenses, overallMoney };
};

const saveExpenseViaAPI = async (sheetId: string, newExpense: Omit<Expense, 'id' | 'total'>): Promise<void> => {
  const response = await fetch('/api/expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...newExpense, sheetId }),
  });

  if (!response.ok) {
    const errorDetail = await response.text();
    throw new Error(`Failed to save expense: ${response.status} - ${errorDetail}`);
  }
};

const updateOverallMoneyViaAPI = async (sheetId: string, overallMoney: number): Promise<void> => {
  const response = await fetch('/api/expenses', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sheetId, overallMoney }),
  });

  if (!response.ok) {
    const errorDetail = await response.text();
    throw new Error(`Failed to update overall money: ${response.status} - ${errorDetail}`);
  }
};


// --- Utility Functions ---

/** Converts an ISO string to a localized date/time string. */
const formatTimestamp = (isoString: string): string => {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// --- App Component ---

const App: React.FC = () => {
  const [userId] = useState<string>(MOCK_USER_ID);

  // State for Sheet ID
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [showSheetIdModal, setShowSheetIdModal] = useState(false);

  // State for Transactions Modal
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [currentInput, setCurrentInput] = useState('0');
  const [category, setCategory] = useState('Groceries');
  const [paymentType, setPaymentType] = useState('Gcash');
  const [expenseHistory, setExpenseHistory] = useState<Expense[]>([]);

  // State for Overall Money
  const [overallMoney, setOverallMoney] = useState(0);
  const [overallMoneyInput, setOverallMoneyInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingOverall, setIsUpdatingOverall] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const CATEGORIES = useMemo(() => ['Groceries', 'Transport', 'Utilities', 'Entertainment', 'Bills', 'Other'], []);
  const PAYMENT_TYPES = useMemo(() => ['GCASH', 'MAYA', 'Credit', 'Debit'], []);

  // --- Sheet ID and Local Storage Logic (Unchanged) ---
  useEffect(() => {
    const savedSheetId = localStorage.getItem('googleSheetId');
    if (savedSheetId) {
      setSheetId(savedSheetId);
    } else {
      setShowSheetIdModal(true);
      setIsLoading(false);
    }
  }, []);

  const handleSetSheetId = (id: string) => {
    if (id) {
      localStorage.setItem('googleSheetId', id);
      setSheetId(id);
      setShowSheetIdModal(false);
      if (!isLoading) {
        setIsLoading(true);
        loadExpenses();
      }
    } else {
      setSubmitError("Sheet ID cannot be empty.");
    }
  };


  // Function to load and set expenses (Unchanged)
  const loadExpenses = useCallback(async () => {
    if (!sheetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSubmitError(null);
    try {
      const { expenses, overallMoney: loadedOverallMoney } = await fetchExpenses(sheetId);

      expenses.sort((a, b) => new Date(b.time_stamp).getTime() - new Date(a.time_stamp).getTime());
      setExpenseHistory(expenses);
      setOverallMoney(loadedOverallMoney);
      setOverallMoneyInput(loadedOverallMoney.toString());

    } catch (e) {
      console.error("Error fetching live sheet data:", e);
      setSubmitError(`Failed to load history from server/Google Sheet. Check if Sheet ID is correct and service account has access. (${(e as Error).message})`);
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  // Initial Data Load from "Sheet" (via API) - Triggers when sheetId state changes
  useEffect(() => {
    if (sheetId) {
      loadExpenses();
    }
  }, [sheetId, loadExpenses]);

  // Calculate total expenses and remaining money (Unchanged)
  const { totalExpenses } = useMemo(() => {
    let total = 0;
    expenseHistory.forEach(e => {
      total += e.expense;
    });
    return {
      totalExpenses: total
    };
  }, [expenseHistory]);

  const { remainingMoney, totalDeducted } = useMemo(() => {
    const deducted = totalExpenses;
    const remaining = overallMoney - deducted;

    return {
      remainingMoney: remaining,
      totalDeducted: deducted,
    };
  }, [overallMoney, totalExpenses]);


  // --- Keypad Logic (Unchanged) ---
  const handleKey = useCallback((key: string) => {
    setSubmitError(null);
    setCurrentInput(prev => {
      if (key === 'C') return '0';
      if (key === 'BACK') {
        if (prev.length === 1) return '0';
        return prev.slice(0, -1);
      }
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev + '.';
      }

      const next = prev === '0' ? key : prev + key;

      const decimalIndex = next.indexOf('.');
      if (decimalIndex !== -1 && next.length > decimalIndex + 3) {
        return prev;
      }

      if (next.length > 10) return prev;

      return next;
    });
  }, []);

  // --- Expense Submission (Unchanged logic) ---
  const handleSubmitExpense = async () => {
    if (!sheetId) {
      setSubmitError("Please set the Google Sheet ID first.");
      setShowSheetIdModal(true);
      return;
    }

    const amount = parseFloat(currentInput);
    if (isNaN(amount) || amount <= 0) {
      setSubmitError("Please enter a valid expense amount.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const newExpense: Omit<Expense, 'id' | 'total'> = {
      time_stamp: new Date().toISOString(),
      category: category,
      payment: paymentType,
      expense: amount,
      userId: userId,
    };

    try {
      await saveExpenseViaAPI(sheetId, newExpense);
      await loadExpenses();

      setCurrentInput('0');
      setCategory(CATEGORIES[0]);

    } catch (e) {
      console.error("Error saving to live sheet: ", e);
      setSubmitError((e as Error).message || "Failed to save expense. Please check network.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Overall Money Update Handler (Unchanged logic) ---
  const handleUpdateOverallMoney = async () => {
    if (!sheetId) {
      setSubmitError("Please set the Google Sheet ID first.");
      setShowSheetIdModal(true);
      return;
    }

    const amount = parseFloat(overallMoneyInput);
    if (isNaN(amount) || amount < 0) {
      setSubmitError("Please enter a valid value for overall money.");
      return;
    }

    setIsUpdatingOverall(true);
    setSubmitError(null);

    try {
      await updateOverallMoneyViaAPI(sheetId, amount);
      setOverallMoney(amount);
      setOverallMoneyInput(amount.toString());

    } catch (e) {
      console.error("Error updating overall money: ", e);
      setSubmitError((e as Error).message || "Failed to update overall money. Check API logs.");
    } finally {
      setIsUpdatingOverall(false);
    }
  };

  // --- Loading and Sheet ID Missing UI (Unchanged) ---

  if (isLoading && sheetId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
        <span className="ml-3 text-indigo-600">Loading Live Google Sheet Data via API...</span>
      </div>
    );
  }

  // Show modal if sheet ID is missing
  if (showSheetIdModal || !sheetId) {
    return <SheetIdModal
      onSubmit={handleSetSheetId}
      onClose={() => setShowSheetIdModal(false)}
      initialSheetId={localStorage.getItem('googleSheetId') || ''}
      error={submitError}
    />
  }


  return (
    // Base container padding remains p-4, ensuring some space around the content
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <style>
        {/* CSS styles (Unchanged) */}
        {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .input-display:focus {
                    outline: none;
                    box-shadow: none;
                }
                /* Hide native number input arrows */
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }
                `}
      </style>

      <header className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-indigo-700 tracking-tight">Daily Expense Log</h1>
        <p className="text-sm text-gray-500 mt-1 flex justify-center items-center">
          <span className="font-semibold text-green-600">LIVE DATA: </span>
          Connected to secure Back-end API for Google Sheet access.
          <button
            onClick={() => {
              setSubmitError(null);
              setShowSheetIdModal(true);
            }}
            className="ml-2 p-1 rounded-full text-indigo-500 hover:bg-indigo-100 transition"
            title="Change Sheet ID"
          >
            <Database className="h-4 w-4" />
          </button>
        </p>
      </header>

      {/* Main content now uses smaller padding on mobile (p-4) and larger on sm+ (sm:p-6) */}
      <main className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-4 sm:p-6 mb-8">

        {/* Overall Starting Money Display & Editor */}
        <div className="bg-green-50 p-4 rounded-lg shadow-inner mb-6">
          <div className="flex justify-between items-center text-green-700 mb-2">
            {/* Reduce text size slightly for better fit on small screens */}
            <span className="text-xs sm:text-sm font-medium uppercase">Overall Starting Money (Sheet F2):</span>
            <span className="text-2xl sm:text-3xl font-bold">
              ₱{overallMoney.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center">
            <input
              type="number"
              value={overallMoneyInput}
              onChange={(e) => setOverallMoneyInput(e.target.value)}
              placeholder="Update starting money"
              className="w-full py-2 px-3 border border-gray-300 bg-white rounded-l-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              disabled={isUpdatingOverall}
            />
            <button
              onClick={handleUpdateOverallMoney}
              disabled={isUpdatingOverall || overallMoneyInput === overallMoney.toString()}
              className={`flex items-center justify-center py-2 px-4 rounded-r-lg text-white font-semibold transition duration-200 ${isUpdatingOverall || overallMoneyInput === overallMoney.toString()
                ? 'bg-green-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
                }`}
            >
              {isUpdatingOverall ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <Save className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Overall Deduction and Available Money Summary */}
        <div className="bg-indigo-50 p-4 rounded-lg shadow-inner mb-6">
          <h3 className="text-base sm:text-lg font-extrabold text-indigo-800 mb-3 border-b border-indigo-200 pb-2 flex items-center">
            <PesoSign className="h-5 w-5 mr-2" /> Overall Balance
          </h3>

          <div className="flex justify-between items-center py-1">
            <span className="text-sm sm:text-base font-medium text-gray-700">Overall Starting Money:</span>
            <span className="text-lg sm:text-xl font-bold text-green-600">
              + ₱{overallMoney.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-sm sm:text-base font-medium text-gray-700">Total Deducted (Expenses):</span>
            <span className="text-lg sm:text-xl font-bold text-red-600">
              - ₱{totalDeducted.toFixed(2)}
            </span>
          </div>

          <div className="h-px bg-indigo-300 my-2"></div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-lg sm:text-xl font-bold text-indigo-800">Available Money:</span>
            <span className={`text-2xl sm:text-3xl font-extrabold ${remainingMoney >= 0 ? 'text-indigo-800' : 'text-red-800'}`}>
              ₱{remainingMoney.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Input Area */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Expense Amount</label>
          <div className="relative">
            <PesoSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={currentInput}
              readOnly
              inputMode="none"
              // Adjusted font size to fit better on small screens (text-3xl on mobile, text-4xl on sm+)
              className="input-display w-full text-right pr-4 py-3 pl-10 text-3xl sm:text-4xl font-light tracking-wide border border-indigo-200 rounded-xl transition duration-150 bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Categories and Payment */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          {/* Category Dropdown (Unchanged grid) */}
          <div>
            <label htmlFor="category" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <List className="h-4 w-4 mr-1 text-indigo-500" /> Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Payment Type Grid (Already grid-cols-4, which should be fine) */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <CreditCard className="h-4 w-4 mr-1 text-indigo-500" /> Payment Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_TYPES.map(p => (
                <button
                  key={p}
                  onClick={() => setPaymentType(p)}
                  className={`py-2 px-1 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition duration-150 border-2 
                                        ${paymentType === p
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    } `}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Keypad & Submit Button (Keypad buttons use p-4, which is okay) */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {['7', '8', '9', 'C'].map(key => (
            <KeypadButton key={key} value={key} onClick={handleKey} isUtility={key !== 'C'} />
          ))}
          {['4', '5', '6', 'BACK'].map(key => (
            <KeypadButton key={key} value={key} onClick={handleKey} isUtility={key !== 'BACK'} />
          ))}
          {['1', '2', '3', '.'].map(key => (
            <KeypadButton key={key} value={key} onClick={handleKey} />
          ))}
          {['0', '00'].map(key => (
            <KeypadButton key={key} value={key} onClick={handleKey} />
          ))}
          <button
            onClick={handleSubmitExpense}
            disabled={isSubmitting || isUpdatingOverall}
            className={`col-span-2 flex items-center justify-center rounded-xl p-4 text-white font-semibold transition duration-200 shadow-lg ${isSubmitting || isUpdatingOverall
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 active:shadow-none active:translate-y-0.5'
              }`}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" /> Log Expense
              </>
            )}
          </button>
        </div>

        {/* View Transactions Button */}
        <button
          onClick={() => setShowTransactionsModal(true)}
          className="w-full flex items-center justify-center rounded-lg p-3 text-sm font-semibold transition duration-200 border bg-indigo-600 text-white hover:bg-indigo-700 mt-4 shadow-md hover:shadow-lg"
        >
          <Eye className="h-4 w-4 mr-2" /> View All {expenseHistory.length} Transactions
        </button>

        {/* Refresh/Retry Button */}
        <button
          onClick={loadExpenses}
          disabled={isLoading || isSubmitting || isUpdatingOverall}
          className={`w-full flex items-center justify-center rounded-lg p-3 text-sm font-semibold transition duration-200 border ${isLoading || isSubmitting || isUpdatingOverall
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
            } mt-2`}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>

        {/* Submission Error Message */}
        {submitError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
            <X className="h-5 w-5 mr-2" />
            <p className="text-sm">{submitError}</p>
          </div>
        )}
      </main>

      {/* RENDER MODALS */}
      {showSheetIdModal && (
        <SheetIdModal
          onSubmit={handleSetSheetId}
          onClose={() => setShowSheetIdModal(false)}
          initialSheetId={localStorage.getItem('googleSheetId') || ''}
          error={submitError}
        />
      )}

      {showTransactionsModal && (
        <TransactionsModal
          expenses={expenseHistory}
          onClose={() => setShowTransactionsModal(false)}
        />
      )}

    </div>
  );
};


// --- NEW Component: TransactionsModal (Responsive Styles Applied) ---
interface TransactionsModalProps {
  expenses: Expense[];
  onClose: () => void;
}

const TransactionsModal: React.FC<TransactionsModalProps> = ({ expenses, onClose }) => {
  return (
    // Modal Backdrop - full screen
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-0 sm:p-4 z-50">
      {/* Modal Content - full width/height on mobile, constrained on sm+ */}
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl p-4 sm:p-6 w-full h-full max-h-full sm:max-w-lg sm:h-auto sm:max-h-[90vh] flex flex-col">

        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
            <List className="h-5 w-5 mr-2 text-indigo-600" /> All Recent Transactions
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body (Scrollable List) */}
        <div className="flex-grow overflow-y-auto">
          {expenses.length === 0 ? (
            <p className="p-4 text-gray-500 text-center">No expenses recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {expenses.map(expense => (
                <li key={expense.id} className="p-4 hover:bg-indigo-50 transition duration-150">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold text-gray-800">
                        {expense.category}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1" /> {formatTimestamp(expense.time_stamp)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-red-600">
                        -₱{expense.expense.toFixed(2)}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {expense.payment}
                      </span>
                      <span className="block text-xs font-semibold text-gray-400 mt-0.5">
                        Sheet Total: {expense.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t pt-4 mt-4">
          <button onClick={onClose} className="w-full py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition">
            Close
          </button>
        </div>

      </div>
    </div>
  );
};


// --- SheetIdModal Component (Responsive Styles Applied) ---
interface SheetIdModalProps {
  onSubmit: (id: string) => void;
  onClose: () => void;
  initialSheetId: string;
  error: string | null;
}

const SheetIdModal: React.FC<SheetIdModalProps> = ({ onSubmit, onClose, initialSheetId, error }) => {
  const [input, setInput] = useState(initialSheetId);
  const canClose = !!initialSheetId;

  return (
    // Modal Backdrop - full screen
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      {/* Modal Content - mobile p-4, sm:p-6, max-w-full on mobile, then max-w-md */}
      <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-full sm:max-w-md">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold text-indigo-700 flex items-center">
            <Database className="h-5 w-5 mr-2" /> Google Sheet ID
          </h2>
          {canClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Please enter the ID of your Google Sheet. It will be saved in your {`${"browser's "}`} local storage.
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter Google Sheet ID here..."
          className="w-full py-2 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-4"
        />

        {error && (
          <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <button
          onClick={() => onSubmit(input.trim())}
          className="w-full flex items-center justify-center py-3 px-4 rounded-lg text-white font-semibold transition duration-200 bg-indigo-600 hover:bg-indigo-700"
        >
          <Save className="h-5 w-5 mr-2" /> Save ID & Load Data
        </button>
      </div>
    </div>
  );
};

// Not working
// --- Keypad Button Component (Unchanged) ---
interface KeypadButtonProps {
  value: string;
  onClick: (key: string) => void;
  isUtility?: boolean;
}

const KeypadButton: React.FC<KeypadButtonProps> = ({ value, onClick }) => {
  // const isSpecial = value === 'C' || value === 'BACK';

  let content: React.ReactNode;
  // Reduced font size slightly for better fit on small phones
  let baseClass = 'rounded-xl p-3 sm:p-4 font-bold text-xl sm:text-2xl transition duration-200 shadow-md active:shadow-none active:translate-y-0.5';

  if (value === 'C') {
    content = <X className="h-7 w-7 sm:h-8 sm:w-8 mx-auto" />;
    baseClass += ' bg-red-100 text-red-600 hover:bg-red-200';
  } else if (value === 'BACK') {
    content = <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8 mx-auto" />;
    baseClass += ' bg-yellow-100 text-yellow-600 hover:bg-yellow-200';
  } else {
    content = value;
    baseClass += ' bg-gray-100 text-gray-800 hover:bg-gray-200';
  }

  return (
    <button
      onClick={() => onClick(value === 'BACK' ? 'BACK' : value)}
      className={baseClass}
    >
      {content}
    </button>
  );
};

export default App;