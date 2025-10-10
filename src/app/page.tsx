'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PhilippinePeso as PesoSign,
  List,
  CreditCard,
  X,
  Send,
  Loader2,
  RefreshCw,
  Database, // Icon for sheet ID
  Save, // Icon for overall money save
  Eye, // Icon for viewing transactions
  EyeOff,
  Wallet, // New icon for Income
}
  from 'lucide-react';

import TransactionsModal from './lib/components/TransactionModal';
import SheetIdModal from './lib/components/SheetiIdModal';
import KeypadButton from './lib/components/KeypadButton';

// --- Type Definitions ---
export interface Expense {
  id: string;
  time_stamp: string;
  category: string;
  payment: string;
  // NOTE: This expense property will now store the amount, 
  // which will be positive for expenses and positive for income 
  // in the local state, but the API logic will determine its sign/impact.
  expense: number;
  total: number;
  userId: string;
}

// --- API Service Functions (Modified for Income Type) ---
const MOCK_USER_ID = 'live-sheet-user-5000';

const fetchExpenses = async (sheetId: string): Promise<{ expenses: Expense[], overallMoney: number, data: any }> => {
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

  return { expenses, overallMoney, data };
};

// MODIFIED: Added type property (expense or income) to the payload
const saveExpenseOrIncomeViaAPI = async (
  sheetId: string,
  newTransaction: Omit<Expense, 'id' | 'total'> & { type: 'expense' | 'income' }
): Promise<void> => {
  // Assume the API endpoint remains the same, but it now handles a 'type' property
  const response = await fetch('/api/expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...newTransaction, sheetId }),
  });

  if (!response.ok) {
    const errorDetail = await response.text();
    throw new Error(`Failed to save transaction: ${response.status} - ${errorDetail}`);
  }
};

// This function handles the "starting money" update as requested
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


// --- App Component ---

const App: React.FC = () => {
  const [userId] = useState<string>(MOCK_USER_ID);

  // State for Sheet ID
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [showSheetIdModal, setShowSheetIdModal] = useState(false);

  // State for Transactions Modal
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);

  // State for Balance
  const [showBalance, setShowBalance] = useState<boolean | null>(true);

  // State for Layout Balance Toggle
  const [showLayoutBalance, setShowLayoutBalance] = useState(false);

  // Initial state for isLoading should be true
  const [isLoading, setIsLoading] = useState(true);
  const [currentInput, setCurrentInput] = useState('0');

  // MODIFIED: Default category/payment for expense/income
  const [category, setCategory] = useState('Groceries');
  const [paymentType, setPaymentType] = useState('GCASH/MAYA');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense'); // NEW STATE
  const [expenseHistory, setExpenseHistory] = useState<Expense[]>([]);

  // State for Overall Money
  const [overallMoney, setOverallMoney] = useState(0);
  const [overallMoneyInput, setOverallMoneyInput] = useState('');
  const [totalExpense, setTotalExpense] = useState(0)

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingOverall, setIsUpdatingOverall] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // MODIFIED CATEGORIES: Added Income option
  const EXPENSE_CATEGORIES = useMemo(() => ['Food', 'Groceries', 'Transport', 'Utilities', 'Entertainment', 'Bills', 'Borrowed', 'Other'], []);
  const INCOME_CATEGORIES = useMemo(() => ['Salary', 'Allowance', 'Other Income'], []); // NEW INCOME CATEGORIES

  // MODIFIED PAYMENT_TYPES: Separated for clarity, and added Salary/Allowance as requested
  const EXPENSE_PAYMENT_TYPES = useMemo(() => ['GCASH/MAYA', 'CASH', 'Credit', 'Debit'], []);
  const INCOME_PAYMENT_TYPES = useMemo(() => ['Salary', 'Allowance'], []); // NEW INCOME PAYMENT TYPES

  // Conditional Categories and Payment Types based on transaction type
  const CURRENT_CATEGORIES = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const CURRENT_PAYMENT_TYPES = transactionType === 'expense' ? EXPENSE_PAYMENT_TYPES : INCOME_PAYMENT_TYPES;


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
      const { expenses, overallMoney: loadedOverallMoney, data } = await fetchExpenses(sheetId);

      expenses.sort((a, b) => new Date(b.time_stamp).getTime() - new Date(a.time_stamp).getTime());
      const convertToFloat = parseFloat(data.totalExpense)
      setExpenseHistory(expenses);
      setOverallMoney(loadedOverallMoney);
      setOverallMoneyInput(loadedOverallMoney.toString());
      setTotalExpense(convertToFloat)

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


  // // MODIFIED: Calculate total expenses, total income, and remaining money
  // const { totalExpenses } = useMemo(() => {
  //   let expenses = 0;
  //   // We assume expenseHistory from the API only contains expense entries
  //   expenseHistory.forEach(e => {
  //     expenses += e.expense;
  //   });

  //   return {
  //     totalExpenses: expenses,
  //   };
  // }, [expenseHistory]);

  const { remainingMoney, totalDeducted } = useMemo(() => {
    const deducted = totalExpense;
    const remaining = overallMoney - deducted;

    return {
      remainingMoney: remaining,
      totalDeducted: deducted,
    };
  }, [overallMoney, totalExpense]);


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

  // NEW: Handler to toggle transaction type and reset category/payment
  const handleTransactionTypeToggle = (type: 'expense' | 'income') => {
    setTransactionType(type);
    setCurrentInput('0');
    setSubmitError(null);

    // Reset category/payment based on the new type
    if (type === 'expense') {
      setCategory(EXPENSE_CATEGORIES[0]);
      setPaymentType(EXPENSE_PAYMENT_TYPES[0]);
    } else {
      // Set to Salary or Allowance as they are the new main choices for income
      setCategory(INCOME_CATEGORIES[0]); // Defaults to 'Salary'
      setPaymentType(INCOME_PAYMENT_TYPES[0]); // Defaults to 'Salary'
    }
  }


  // MODIFIED: Consolidated submission logic for both Expense and Income
  const handleSubmitTransaction = async () => {
    if (!sheetId) {
      setSubmitError("Please set the Google Sheet ID first.");
      setShowSheetIdModal(true);
      return;
    }

    const amount = parseFloat(currentInput);
    if (isNaN(amount) || amount <= 0) {
      setSubmitError(`Please enter a valid ${transactionType} amount.`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const newTransaction: Omit<Expense, 'id' | 'total'> & { type: 'expense' | 'income' } = {
      time_stamp: new Date().toISOString(),
      category: category,
      payment: paymentType,
      expense: amount, // The API will handle the sign based on 'type'
      userId: userId,
      type: transactionType, // NEW PROPERTY
    };

    try {
      // Log the transaction type to the console as requested by the user's intent to "log it when I added money"
      console.log(`Submitting ${transactionType.toUpperCase()} with details:`, {
        amount: amount,
        category: category,
        payment: paymentType
      });

      await saveExpenseOrIncomeViaAPI(sheetId, newTransaction); // MODIFIED API CALL

      // --- NEW LOGIC: Conditional PATCH for Overall Money (F2) when logging Income ---
      if (transactionType === 'income') {
        // Calculate the new overall money by adding the income amount
        const newOverallMoney = overallMoney + amount;

        // Explicitly call the PATCH API to update cell F2
        await updateOverallMoneyViaAPI(sheetId, newOverallMoney);

        // Update local state immediately (optional, loadExpenses will confirm)
        setOverallMoney(newOverallMoney);
        setOverallMoneyInput(newOverallMoney.toString());
      }
      // --- END NEW LOGIC ---

      // Reload all data to refresh transactions, total expense, and confirm F2 (if not updated above)
      await loadExpenses();

      setCurrentInput('0');

      // Keep the current category/payment type for the user's next log (convenience)

    } catch (e) {
      console.error(`Error saving ${transactionType} to live sheet: `, e);
      setSubmitError((e as Error).message || `Failed to save ${transactionType}. Please check network.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Overall Money Update Handler (Starting Money Function) ---
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

  // --- Utility functions for UI ---

  const getInitialSheetId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('googleSheetId') || '';
    }
    return '';
  }

  const getPaymentClasses = (paymentType: string) => {
    switch (paymentType) {
      case 'GCASH/MAYA':
        return 'bg-blue-600 text-white border-blue-700 shadow-md hover:bg-blue-500';
      case 'CASH':
        return 'bg-green-700 text-white border-green-800 shadow-md hover:bg-green-600';
      case 'Credit':
        return 'bg-purple-600 text-white border-purple-700 shadow-md hover:bg-purple-500';
      case 'Debit':
        return 'bg-indigo-600 text-white border-indigo-700 shadow-md hover:bg-indigo-500';
      // NEW: Income Types (Salary/Allowance)
      case 'Salary':
        return 'bg-emerald-600 text-white border-emerald-700 shadow-md hover:bg-emerald-500';
      case 'Allowance':
        return 'bg-cyan-600 text-white border-cyan-700 shadow-md hover:bg-cyan-500';
      default:
        return 'bg-indigo-600 text-white border-indigo-700 shadow-md hover:bg-indigo-500';
    }
  };

  const handleSHowBalanceLayoutToggle = () => {
    setShowBalance(!showBalance)
  }

  // --- Main Render Logic ---

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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4">

      {/* <header className="w-full max-w-lg mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-indigo-400 tracking-tight">Daily Financial Log</h1>
        <p className="text-sm text-gray-400 mt-1 flex justify-center items-center">
          <span className="font-semibold text-green-400">LIVE DATA: </span>
          Connected to secure Back-end API for Google Sheet access.
          <button
            onClick={() => {
              setSubmitError(null);
              setShowSheetIdModal(true);
            }}
            className="ml-2 p-1 rounded-full text-indigo-400 hover:bg-gray-700 transition"
            title="Change Sheet ID"
          >
            <Database className="h-4 w-4" />
          </button>
        </p>
      </header> */}

      <main className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 mb-8">

        <div className='w-full relative flex items-center gap-3 mb-4'>
          <button onClick={() => setShowLayoutBalance(!showLayoutBalance)} className=' text-white'>
            {showLayoutBalance ? <EyeOff /> : <Eye />}
          </button>

          {showLayoutBalance && <button
            onClick={() => handleSHowBalanceLayoutToggle()}
            className=" px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-indigo-400 hover:bg-gray-600 transition"
          >
            {showBalance ? 'Set Money' : 'Show Balance'}
          </button>}

        </div>

        {/* --- Overall Money/Balance Section --- */}
        {showLayoutBalance && <>
          {!showBalance && showBalance !== null ?
            // UI for modifying starting money (OverallMoneyInput)
            <div className="bg-green-950 p-4 rounded-lg shadow-inner mb-6">
              <div className="flex justify-between items-center text-green-300 mb-2">
                <span className="text-xs sm:text-sm font-medium uppercase">Overall Starting Money (Sheet F2):</span>
              </div>

              <div className="flex items-center">
                <input
                  type="number"
                  value={overallMoneyInput}
                  onChange={(e) => setOverallMoneyInput(e.target.value)}
                  placeholder="Update starting money"
                  className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-l-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                  disabled={isUpdatingOverall}
                />
                <button
                  onClick={handleUpdateOverallMoney}
                  disabled={isUpdatingOverall || overallMoneyInput === overallMoney.toString()}
                  className={`flex items-center justify-center py-2 px-4 rounded-r-lg text-white font-semibold transition duration-200 ${isUpdatingOverall || overallMoneyInput === overallMoney.toString()
                    ? 'bg-green-700 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500'
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
            :
            // UI for displaying balance
            <div className="bg-indigo-950 p-4 rounded-lg shadow-inner mb-6">
              <h3 className="text-base sm:text-md font-extrabold text-indigo-400 mb-3 border-b border-indigo-900 pb-2 flex items-center">
                <PesoSign className="h-5 w-5 mr-2" /> Overall Balance
              </h3>

              <div className="flex justify-between items-center py-1">
                <span className="text-sm sm:text-base font-medium text-gray-300">Overall Starting Money:</span>
                <span className="text-md sm:text-lg font-bold text-green-400">
                  {overallMoney.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-sm sm:text-base font-medium text-gray-300">Total Deducted (Expenses):</span>
                <span className="text-lg sm:text-xl font-bold text-red-400">
                  {totalDeducted.toFixed(2)}
                </span>
              </div>

              <div className="h-px bg-indigo-900 my-2"></div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg sm:text-md font-bold text-indigo-400">Available Money:</span>
                <span className={`text-xl sm:text-lg font-extrabold ${remainingMoney >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                  {remainingMoney.toFixed(2)}
                </span>
              </div>
            </div>
          }
        </>}

        {/* NEW: Transaction Type Toggle (Expense or Income) */}
        <div className='flex justify-center gap-3 mb-6'>
          <button
            onClick={() => handleTransactionTypeToggle('expense')}
            className={`py-2 px-4 rounded-lg font-semibold transition duration-200 flex items-center ${transactionType === 'expense'
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            <Send className="h-5 w-5 mr-2" /> Log Expense
          </button>
          <button
            onClick={() => handleTransactionTypeToggle('income')}
            className={`py-2 px-4 rounded-lg font-semibold transition duration-200 flex items-center ${transactionType === 'income'
              ? 'bg-green-600 text-white hover:bg-green-500'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            <Wallet className="h-5 w-5 mr-2" /> Log Income
          </button>
        </div>


        {/* Input Area */}
        <div className="mb-6">
          <div className='flex items-center mb-2 gap-5'>
            <label className="block text-sm font-medium text-gray-300 ">
              {transactionType === 'expense' ? 'Expense Amount' : 'Income Amount'}
            </label>
          </div>
          <div className="relative">
            <label className='text-[11px] text-gray-500 absolute left-4 bottom-1'>Available Balance:    ₱{remainingMoney.toFixed(2)}</label>
            <PesoSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={currentInput}
              readOnly
              inputMode="none"
              className="input-display w-full text-right pr-4 py-3 pl-10 text-3xl sm:text-4xl font-light tracking-wide border border-indigo-900 rounded-xl transition duration-150 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Categories and Payment */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          {/* Category Dropdown (Uses CURRENT_CATEGORIES) */}
          <div>
            <label htmlFor="category" className="flex items-center text-sm font-medium text-gray-300 mb-1">
              <List className="h-4 w-4 mr-1 text-indigo-400" /> Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              {CURRENT_CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-gray-700 text-gray-100">{c}</option>
              ))}
            </select>
          </div>

          {/* Payment Type Grid (Uses CURRENT_PAYMENT_TYPES) */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-300 mb-1">
              <CreditCard className="h-4 w-4 mr-1 text-indigo-400" /> Payment Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CURRENT_PAYMENT_TYPES.map(p => (
                <button
                  key={p}
                  onClick={() => setPaymentType(p)}
                  className={`py-3 px-1 sm:px-3 rounded-lg font-medium transition  text-[10px]  duration-150 border-2 
                    ${paymentType === p
                      ? getPaymentClasses(p)
                      : `bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600`
                    } 
                  `}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Keypad & Submit Button */}
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
            onClick={handleSubmitTransaction}
            disabled={isSubmitting || isUpdatingOverall}
            className={`col-span-2 flex items-center justify-center rounded-xl p-4 text-white font-semibold transition duration-200 shadow-lg ${isSubmitting || isUpdatingOverall
              ? 'bg-indigo-800 cursor-not-allowed'
              : transactionType === 'expense'
                ? 'bg-red-600 hover:bg-red-500 active:shadow-none active:translate-y-0.5'
                : 'bg-green-600 hover:bg-green-500 active:shadow-none active:translate-y-0.5'
              }`}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                {transactionType === 'expense' ?
                  <><Send className="h-5 w-5 mr-2" /> Log Expense</>
                  :
                  <><Wallet className="h-5 w-5 mr-2" /> Log Income</>
                }
              </>
            )}
          </button>
        </div>

        {/* View Transactions Button */}
        <button
          onClick={() => setShowTransactionsModal(true)}
          className="w-full flex items-center justify-center rounded-lg p-3 text-sm font-semibold transition duration-200 border bg-indigo-600 text-white hover:bg-indigo-500 mt-4 shadow-md hover:shadow-lg"
        >
          <Eye className="h-4 w-4 mr-2" /> View All {expenseHistory.length} Transactions
        </button>

        {/* Refresh/Retry Button */}
        <button
          onClick={loadExpenses}
          disabled={isLoading || isSubmitting || isUpdatingOverall}
          className={`w-full flex items-center justify-center rounded-lg p-3 text-sm font-semibold transition duration-200 border ${isLoading || isSubmitting || isUpdatingOverall
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700'
            : 'bg-gray-700 text-indigo-400 border-indigo-900 hover:bg-gray-600'
            } mt-2`}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>

        {/* Submission Error Message */}
        {
          submitError && (
            <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-300 rounded-lg flex items-center">
              <X className="h-5 w-5 mr-2" />
              <p className="text-sm">{submitError}</p>
            </div>
          )
        }
      </main >

      {/* RENDER MODALS */}
      {
        showSheetIdModal && (
          <SheetIdModal
            onSubmit={handleSetSheetId}
            onClose={() => setShowSheetIdModal(false)}
            initialSheetId={getInitialSheetId()}
            error={submitError}
          />
        )
      }

      {
        showTransactionsModal && (
          <TransactionsModal
            expenses={expenseHistory}
            onClose={() => setShowTransactionsModal(false)}
          />
        )
      }

    </div >
  );
};

export default App;