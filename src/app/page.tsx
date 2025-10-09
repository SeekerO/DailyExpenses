'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PhilippinePeso as PesoSign,
  Clock,
  List,
  CreditCard,
  X,
  Delete,
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

  // Initial state for isLoading should be true
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

  // --- Sheet ID and Local Storage Logic (FIXED) ---
  useEffect(() => {
    // Check for client environment before accessing localStorage
    if (typeof window !== 'undefined') {
      const savedSheetId = localStorage.getItem('googleSheetId');
      if (savedSheetId) {
        setSheetId(savedSheetId);
      } else {
        // If no ID is found, stop loading and show the modal
        setShowSheetIdModal(true);
        setIsLoading(false);
      }
    }
    // Note: If running on server (typeof window is undefined), isLoading remains true, 
    // waiting for the client-side render to run this effect.
  }, []);

  const handleSetSheetId = (id: string) => {
    if (id) {
      // Check for client environment before accessing localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('googleSheetId', id);
      }
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

  // --- Loading and Sheet ID Missing UI (Dark Mode Updated) ---

  if (isLoading && sheetId) {
    return (
      // Dark Mode Background
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="animate-spin text-indigo-400 h-8 w-8" />
        {/* Lighter text for dark mode */}
        <span className="ml-3 text-indigo-400">Loading Live Google Sheet Data via API...</span>
      </div>
    );
  }

  // Helper function to safely get sheet ID from local storage for modals
  const getInitialSheetId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('googleSheetId') || '';
    }
    return '';
  }

  // Show modal if sheet ID is missing
  if (showSheetIdModal || !sheetId) {
    return <SheetIdModal
      onSubmit={handleSetSheetId}
      onClose={() => setShowSheetIdModal(false)}
      initialSheetId={getInitialSheetId()}
      error={submitError}
    />
  }


  return (
    // Base container padding remains p-4, ensuring some space around the content
    // Dark Mode Background
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4">

      <header className="w-full max-w-lg mb-6 text-center">
        {/* Lighter primary text */}
        <h1 className="text-3xl font-extrabold text-indigo-400 tracking-tight">Daily Expense Log</h1>
        {/* Lighter secondary text */}
        <p className="text-sm text-gray-400 mt-1 flex justify-center items-center">
          <span className="font-semibold text-green-400">LIVE DATA: </span>
          Connected to secure Back-end API for Google Sheet access.
          <button
            onClick={() => {
              setSubmitError(null);
              setShowSheetIdModal(true);
            }}
            // Lighter icon color for dark mode
            className="ml-2 p-1 rounded-full text-indigo-400 hover:bg-gray-700 transition"
            title="Change Sheet ID"
          >
            <Database className="h-4 w-4" />
          </button>
        </p>
      </header>

      {/* Main content now uses smaller padding on mobile (p-4) and larger on sm+ (sm:p-6) */}
      {/* Darker background for the main card */}
      <main className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 mb-8">

        {/* Overall Starting Money Display & Editor */}
        {/* Slightly darker accent background */}
        <div className="bg-green-950 p-4 rounded-lg shadow-inner mb-6">
          <div className="flex justify-between items-center text-green-300 mb-2">
            {/* Reduce text size slightly for better fit on small screens */}
            <span className="text-xs sm:text-sm font-medium uppercase">Overall Starting Money (Sheet F2):</span>
            <span className="text-2xl sm:text-3xl font-bold">
              {overallMoney.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center">
            <input
              type="number"
              value={overallMoneyInput}
              onChange={(e) => setOverallMoneyInput(e.target.value)}
              placeholder="Update starting money"
              // Dark mode input styles (darker background, lighter text, darker border)
              className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-l-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              disabled={isUpdatingOverall}
            />
            <button
              onClick={handleUpdateOverallMoney}
              disabled={isUpdatingOverall || overallMoneyInput === overallMoney.toString()}
              className={`flex items-center justify-center py-2 px-4 rounded-r-lg text-white font-semibold transition duration-200 ${isUpdatingOverall || overallMoneyInput === overallMoney.toString()
                ? 'bg-green-700 cursor-not-allowed' // Darker disabled green
                : 'bg-green-600 hover:bg-green-500' // Adjusted hover for better dark contrast
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
        {/* Slightly darker accent background */}
        <div className="bg-indigo-950 p-4 rounded-lg shadow-inner mb-6">
          {/* Lighter header text and border */}
          <h3 className="text-base sm:text-lg font-extrabold text-indigo-400 mb-3 border-b border-indigo-900 pb-2 flex items-center">
            <PesoSign className="h-5 w-5 mr-2" /> Overall Balance
          </h3>

          <div className="flex justify-between items-center py-1">
            {/* Lighter detail text */}
            <span className="text-sm sm:text-base font-medium text-gray-300">Overall Starting Money:</span>
            {/* Adjusted green for dark background */}
            <span className="text-lg sm:text-xl font-bold text-green-400">
              {overallMoney.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            {/* Lighter detail text */}
            <span className="text-sm sm:text-base font-medium text-gray-300">Total Deducted (Expenses):</span>
            {/* Adjusted red for dark background */}
            <span className="text-lg sm:text-xl font-bold text-red-400">
              {totalDeducted.toFixed(2)}
            </span>
          </div>

          {/* Darker separator line */}
          <div className="h-px bg-indigo-900 my-2"></div>

          <div className="flex justify-between items-center pt-2">
            {/* Lighter key text */}
            <span className="text-lg sm:text-xl font-bold text-indigo-400">Available Money:</span>
            {/* Conditional text color, adjusted for dark mode */}
            <span className={`text-2xl sm:text-3xl font-extrabold ${remainingMoney >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
              {remainingMoney.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Input Area */}
        <div className="mb-6">
          {/* Lighter label text */}
          <label className="block text-sm font-medium text-gray-300 mb-2">Expense Amount</label>
          <div className="relative">
            {/* Lighter icon color */}
            <PesoSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={currentInput}
              readOnly
              inputMode="none"
              // Dark mode input: darker border, dark background, lighter text
              className="input-display w-full text-right pr-4 py-3 pl-10 text-3xl sm:text-4xl font-light tracking-wide border border-indigo-900 rounded-xl transition duration-150 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Categories and Payment */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          {/* Category Dropdown (Unchanged grid) */}
          <div>
            {/* Lighter label text and icon color */}
            <label htmlFor="category" className="flex items-center text-sm font-medium text-gray-300 mb-1">
              <List className="h-4 w-4 mr-1 text-indigo-400" /> Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              // Dark mode select styles: darker border, dark background, lighter text
              className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-gray-700 text-gray-100">{c}</option>
              ))}
            </select>
          </div>

          {/* Payment Type Grid (Already grid-cols-4, which should be fine) */}
          <div>
            {/* Lighter label text and icon color */}
            <label className="flex items-center text-sm font-medium text-gray-300 mb-1">
              <CreditCard className="h-4 w-4 mr-1 text-indigo-400" /> Payment Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_TYPES.map(p => (
                <button
                  key={p}
                  onClick={() => setPaymentType(p)}
                  className={`py-2 px-1 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition duration-150 border-2 
                                        ${paymentType === p
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' // Selected remains bright
                      // Dark mode unselected: dark background, lighter text, darker border, darker hover
                      : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
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
          {/* KeypadButton component handles dark mode internally */}
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
              ? 'bg-indigo-800 cursor-not-allowed' // Darker disabled blue
              : 'bg-indigo-600 hover:bg-indigo-500 active:shadow-none active:translate-y-0.5' // Adjusted hover for better dark contrast
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
          // Adjusted color for dark mode main action
          className="w-full flex items-center justify-center rounded-lg p-3 text-sm font-semibold transition duration-200 border bg-indigo-600 text-white hover:bg-indigo-500 mt-4 shadow-md hover:shadow-lg"
        >
          <Eye className="h-4 w-4 mr-2" /> View All {expenseHistory.length} Transactions
        </button>

        {/* Refresh/Retry Button */}
        <button
          onClick={loadExpenses}
          disabled={isLoading || isSubmitting || isUpdatingOverall}
          // Dark mode refresh button: darker background, lighter text/icon, darker hover
          className={`w-full flex items-center justify-center rounded-lg p-3 text-sm font-semibold transition duration-200 border ${isLoading || isSubmitting || isUpdatingOverall
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700'
            : 'bg-gray-700 text-indigo-400 border-indigo-900 hover:bg-gray-600'
            } mt-2`}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>

        {/* Submission Error Message */}
        {submitError && (
          // Darker error message background, lighter text
          <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-300 rounded-lg flex items-center">
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
          initialSheetId={getInitialSheetId()}
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


// --- NEW Component: TransactionsModal (Dark Mode Updated) ---
interface TransactionsModalProps {
  expenses: Expense[];
  onClose: () => void;
}

const TransactionsModal: React.FC<TransactionsModalProps> = ({ expenses, onClose }) => {
  return (
    // Modal Backdrop - full screen (darker opacity)
    <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center p-0 sm:p-4 z-50">
      {/* Modal Content - full width/height on mobile, constrained on sm+ */}
      {/* Darker modal background */}
      <div className="bg-gray-800 rounded-none sm:rounded-xl shadow-2xl p-4 sm:p-6 w-full h-full max-h-full sm:max-w-lg sm:h-auto sm:max-h-[90vh] flex flex-col">

        {/* Modal Header */}
        {/* Lighter header text and darker border */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 flex items-center">
            <List className="h-5 w-5 mr-2 text-indigo-400" /> All Recent Transactions
          </h2>
          {/* Lighter close button */}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 p-2 rounded-full hover:bg-gray-700 transition">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body (Scrollable List) */}
        <div className="flex-grow overflow-y-auto">
          {expenses.length === 0 ? (
            <p className="p-4 text-gray-400 text-center">No expenses recorded yet.</p>
          ) : (
            < ul className="divide-y divide-gray-700">
              {expenses.map(expense => (
                <li key={expense.id} className="p-4 hover:bg-gray-700 transition duration-150">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      {/* Lighter main text */}
                      <span className="text-lg font-semibold text-gray-100">
                        {expense.category}
                      </span>
                      {/* Lighter secondary text */}
                      <span className="text-xs text-gray-400 flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1" /> {formatTimestamp(expense.time_stamp)}
                      </span>
                    </div>
                    <div className="text-right">
                      {/* Adjusted red for dark mode */}
                      <span className="text-xl font-bold text-red-400">
                        {expense.expense.toFixed(2)}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {expense.payment}
                      </span>
                      {/* Lighter placeholder text */}
                      <span className="block text-xs font-semibold text-gray-500 mt-0.5">
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
        {/* Darker border */}
        <div className="border-t border-gray-700 pt-4 mt-4">
          {/* Adjusted button color for better dark mode contrast */}
          <button onClick={onClose} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition">
            Close
          </button>
        </div>

      </div>
    </div >
  );
};


// --- SheetIdModal Component (Dark Mode Updated) ---
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
    <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center p-4 z-50">
      {/* Modal Content - dark background */}
      <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-full sm:max-w-md">
        {/* Lighter header text and darker border */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
          <h2 className="text-xl font-bold text-indigo-400 flex items-center">
            <Database className="h-5 w-5 mr-2" /> Google Sheet ID
          </h2>
          {canClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Lighter descriptive text */}
        <p className="text-sm text-gray-400 mb-4">
          Please enter the ID of your Google Sheet. It will be saved in your {`${"browser's "}`} local storage.
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter Google Sheet ID here..."
          // Dark mode input styles
          className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-4"
        />

        {error && (
          // Darker error message background, lighter text
          <div className="mt-2 p-3 bg-red-900 border border-red-700 text-red-300 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Adjusted button color for better dark mode contrast */}
        <button
          onClick={() => onSubmit(input.trim())}
          className="w-full flex items-center justify-center py-3 px-4 rounded-lg text-white font-semibold transition duration-200 bg-indigo-600 hover:bg-indigo-500"
        >
          <Save className="h-5 w-5 mr-2" /> Save ID & Load Data
        </button>
      </div>
    </div>
  );
};

// --- Keypad Button Component (Dark Mode Updated) ---
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
    // Adjusted utility colors for better dark mode visibility
    baseClass += ' bg-red-900 text-red-300 hover:bg-red-800';
  } else if (value === 'BACK') {
    content = <Delete className="h-7 w-7 sm:h-8 sm:w-8 mx-auto" />;
    // Adjusted utility colors for better dark mode visibility
    baseClass += ' bg-yellow-900 text-yellow-300 hover:bg-yellow-800';
  } else {
    content = value;
    // Dark mode number keys: dark background, light text, dark hover
    baseClass += ' bg-gray-700 text-gray-100 hover:bg-gray-600';
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