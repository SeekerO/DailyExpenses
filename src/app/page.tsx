// page.tsx (MODIFIED)

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
  Eye,
  Wallet,
  Database,
}
  from 'lucide-react';

import TransactionsModal from './lib/components/TransactionModal';
import SheetIdModal from './lib/components/SheetiIdModal';
import KeypadButton from './lib/components/KeypadButton';
// NEW IMPORT: Balance Modal
import BalanceModal from './lib/components/BalanceModal';

// --- Type Definitions ---
export interface Expense {
  id: string;
  time_stamp: string;
  category: string;
  payment: string;
  expense: number;
  total: number;
  userId: string;
}

// --- API Service Functions ---
const MOCK_USER_ID = 'live-sheet-user-5000';

const fetchExpenses = async (sheetId: string): Promise<{
  expenses: Expense[],
  overallMoney: number, // F2 (Cash Balance)
  creditBalance: number, // G2
  debitBalance: number,  // H2
  data: any
}> => {
  const response = await fetch(`/api/expenses?sheetId=${sheetId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch expenses from API. Status: ${response.status}`);
  }
  const data: { expenses: [], overallMoney: any, creditBalance: any, debitBalance: any, totalExpense: any } = await response.json();

  const expenses: Expense[] = data.expenses.map((item: any) => ({
    ...item,
    expense: parseFloat(item.expense),
    total: parseFloat(item.total)
  }));

  const overallMoney: number = parseFloat(data.overallMoney) || 0;
  const creditBalance: number = parseFloat(data.creditBalance) || 0;
  const debitBalance: number = parseFloat(data.debitBalance) || 0;

  return { expenses, overallMoney, creditBalance, debitBalance, data };
};

const saveExpenseOrIncomeViaAPI = async (
  sheetId: string,
  newTransaction: Omit<Expense, 'id' | 'total'> & { type: 'expense' | 'income' }
): Promise<void> => {
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

const updateBalanceViaAPI = async (
  sheetId: string,
  newBalance: number,
  cellReference: 'F2' | 'G2' | 'H2'
): Promise<void> => {
  const response = await fetch('/api/expenses', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sheetId, newBalance, cellReference }),
  });

  if (!response.ok) {
    const errorDetail = await response.text();
    throw new Error(`Failed to update ${cellReference}: ${response.status} - ${errorDetail}`);
  }
};


// --- App Component ---

const App: React.FC = () => {
  const [userId] = useState<string>(MOCK_USER_ID);

  const [sheetId, setSheetId] = useState<string | null>(null);
  const [showSheetIdModal, setShowSheetIdModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  // NEW STATE: Control for the new Balance Modal
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // REMOVED: showBalance and showLayoutBalance states

  const [isLoading, setIsLoading] = useState(true);
  const [currentInput, setCurrentInput] = useState('0');

  const [category, setCategory] = useState('Groceries');
  const [paymentType, setPaymentType] = useState('GCASH/MAYA');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [expenseHistory, setExpenseHistory] = useState<Expense[]>([]);

  // State for Cash Balance (F2) 
  const [cashBalance, setCashBalance] = useState(0);
  const [cashBalanceInput, setCashBalanceInput] = useState('');

  // State for Credit Balance (G2)
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditBalanceInput, setCreditBalanceInput] = useState('');

  // State for Debit Balance (H2)
  const [debitBalance, setDebitBalance] = useState(0);
  const [debitBalanceInput, setDebitBalanceInput] = useState('');

  const [totalExpense, setTotalExpense] = useState(0)

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingOverall, setIsUpdatingOverall] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const EXPENSE_CATEGORIES = useMemo(() => ['Food', 'Groceries', 'Transport', 'Utilities', 'Entertainment', 'Bills', 'Borrowed', 'Other'], []);

  const INCOME_CATEGORIES = useMemo(() => ['Cash', 'Debit', 'Credit'], []);

  const EXPENSE_PAYMENT_TYPES = useMemo(() => ['eCash', 'Cash', 'Credit', 'Debit'], []);

  const INCOME_PAYMENT_TYPES = useMemo(() => ['Salary', 'Allowance', 'Refund', 'Investment', 'Other'], []);

  const CURRENT_CATEGORIES = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const CURRENT_PAYMENT_TYPES = transactionType === 'expense' ? EXPENSE_PAYMENT_TYPES : INCOME_PAYMENT_TYPES;


  // --- Sheet ID and Local Storage Logic ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSheetId = localStorage.getItem('googleSheetId');
      if (savedSheetId) {
        setSheetId(savedSheetId);
      } else {
        setShowSheetIdModal(true);
        setIsLoading(false);
      }
    }
  }, []);

  const handleSetSheetId = (id: string) => {
    if (id) {
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


  // Function to load and set expenses 
  const loadExpenses = useCallback(async () => {
    if (!sheetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSubmitError(null);
    try {
      const {
        expenses,
        overallMoney: loadedCashBalance,
        creditBalance: loadedCreditBalance,
        debitBalance: loadedDebitBalance,
        data
      } = await fetchExpenses(sheetId);

      expenses.sort((a, b) => new Date(b.time_stamp).getTime() - new Date(a.time_stamp).getTime());
      const convertToFloat = parseFloat(data.totalExpense)
      setExpenseHistory(expenses);

      setCashBalance(loadedCashBalance);
      setCashBalanceInput(loadedCashBalance.toString());

      setCreditBalance(loadedCreditBalance);
      setCreditBalanceInput(loadedCreditBalance.toString());

      setDebitBalance(loadedDebitBalance);
      setDebitBalanceInput(loadedDebitBalance.toString());

      setTotalExpense(convertToFloat)

    } catch (e) {
      console.error("Error fetching live sheet data:", e);
      setSubmitError(`Failed to load history from server/Google Sheet. Check if Sheet ID is correct and service account has access. (${(e as Error).message})`);
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    if (sheetId) {
      loadExpenses();
    }
  }, [sheetId, loadExpenses]);


  // Calculate the segregated balances and deductions (Client-side)
  const {
    moneyBalance,
    creditDebtBalance,
    debitUsageBalance,
    cashDeducted,
    creditDeducted,
    debitDeducted,
    totalOverallBalance
  } = useMemo(() => {
    let cashDeducted = 0;
    let creditDeducted = 0;
    let debitDeducted = 0;

    expenseHistory.forEach(e => {
      const amount = e.expense;

      // Only calculate deductions for transactions that are not the new income categories
      if (!INCOME_CATEGORIES.includes(e.category)) {
        switch (e.payment) {
          case 'Credit':
            creditDeducted += amount;
            break;
          case 'Debit':
            debitDeducted += amount;
            break;
          case 'GCASH/MAYA':
          case 'CASH':
            cashDeducted += amount;
            break;
        }
      }
    });

    const moneyBalance = cashBalance - cashDeducted;
    const creditDebtBalance = creditBalance;
    const debitUsageBalance = debitBalance;

    const totalOverallBalance = cashBalance + creditBalance + debitBalance;

    return {
      moneyBalance,
      creditDebtBalance,
      debitUsageBalance,
      cashDeducted,
      creditDeducted,
      debitDeducted,
      totalOverallBalance
    };
  }, [cashBalance, creditBalance, debitBalance, expenseHistory, INCOME_CATEGORIES]);

  const remainingMoney = moneyBalance;

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

  // Handler to toggle transaction type and reset category/payment
  const handleTransactionTypeToggle = (type: 'expense' | 'income') => {
    setTransactionType(type);
    setCurrentInput('0');
    setSubmitError(null);

    // Reset category/payment based on the new type
    if (type === 'expense') {
      setCategory(EXPENSE_CATEGORIES[0]);
      setPaymentType(EXPENSE_PAYMENT_TYPES[0]);
    } else {
      setCategory(INCOME_CATEGORIES[0]);
      setPaymentType(INCOME_PAYMENT_TYPES[0]);
    }
  }


  // --- Balance Update Handler for F2, G2, H2 (Unchanged, passed to Modal) ---
  const handleUpdateBalance = async (
    balanceType: 'cash' | 'credit' | 'debit'
  ) => {
    if (!sheetId) {
      setSubmitError("Please set the Google Sheet ID first.");
      setShowSheetIdModal(true);
      return;
    }

    let inputString: string;
    let cellRef: 'F2' | 'G2' | 'H2';
    let setter: React.Dispatch<React.SetStateAction<number>>;
    let inputSetter: React.Dispatch<React.SetStateAction<string>>;

    switch (balanceType) {
      case 'cash':
        inputString = cashBalanceInput;
        cellRef = 'F2';
        setter = setCashBalance;
        inputSetter = setCashBalanceInput;
        break;
      case 'credit':
        inputString = creditBalanceInput;
        cellRef = 'G2';
        setter = setCreditBalance;
        inputSetter = setCreditBalanceInput;
        break;
      case 'debit':
        inputString = debitBalanceInput;
        cellRef = 'H2';
        setter = setDebitBalance;
        inputSetter = setDebitBalanceInput;
        break;
      default:
        return;
    }

    const amount = parseFloat(inputString);
    if (isNaN(amount)) {
      setSubmitError(`Please enter a valid value for ${balanceType} balance.`);
      return;
    }

    setIsUpdatingOverall(true);
    setSubmitError(null);

    try {
      await updateBalanceViaAPI(sheetId, amount, cellRef);
      setter(amount);
      inputSetter(amount.toString());

    } catch (e) {
      console.error(`Error updating ${balanceType} balance: `, e);
      setSubmitError((e as Error).message || `Failed to update ${balanceType} balance. Check API logs.`);
    } finally {
      setIsUpdatingOverall(false);
    }
  };


  // Submission logic with specific balance updates for Income categories
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
      expense: amount,
      userId: userId,
      type: transactionType,
    };

    try {
      await saveExpenseOrIncomeViaAPI(sheetId, newTransaction);

      // --- Logic: Conditional PATCH for F2, G2, or H2 based on Income Category ---
      if (transactionType === 'income') {
        let newBalance: number;
        let cellRef: 'F2' | 'G2' | 'H2';
        let setter: React.Dispatch<React.SetStateAction<number>>;
        let inputSetter: React.Dispatch<React.SetStateAction<string>>;

        switch (category) {
          case 'Cash':
            newBalance = cashBalance + amount;
            cellRef = 'F2';
            setter = setCashBalance;
            inputSetter = setCashBalanceInput;
            break;
          case 'Credit':
            newBalance = creditBalance + amount;
            cellRef = 'G2';
            setter = setCreditBalance;
            inputSetter = setCreditBalanceInput;
            break;
          case 'Debit':
            newBalance = debitBalance + amount;
            cellRef = 'H2';
            setter = setDebitBalance;
            inputSetter = setDebitBalanceInput;
            break;
          default:
            console.warn(`Income category "${category}" did not match a balance account. Reloading expenses only.`);
            await loadExpenses();
            setIsSubmitting(false);
            setCurrentInput('0');
            return;
        }

        await updateBalanceViaAPI(sheetId, newBalance, cellRef);

        setter(newBalance);
        inputSetter(newBalance.toString());
      }
      // --- END Income Logic ---

      await loadExpenses();

      setCurrentInput('0');

    } catch (e) {
      console.error(`Error saving ${transactionType} to live sheet: `, e);
      setSubmitError((e as Error).message || `Failed to save ${transactionType}. Please check network.`);
    } finally {
      setIsSubmitting(false);
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
      case 'Salary':
        return 'bg-emerald-600 text-white border-emerald-700 shadow-md hover:bg-emerald-500';
      case 'Allowance':
        return 'bg-cyan-600 text-white border-cyan-700 shadow-md hover:bg-cyan-500';
      case 'Refund':
        return 'bg-yellow-600 text-white border-yellow-700 shadow-md hover:bg-yellow-500';
      case 'Investment':
        return 'bg-pink-600 text-white border-pink-700 shadow-md hover:bg-pink-500';
      case 'Other':
        return 'bg-gray-600 text-white border-gray-700 shadow-md hover:bg-gray-500';
      default:
        return 'bg-indigo-600 text-white border-indigo-700 shadow-md hover:bg-indigo-500';
    }
  };

  // REMOVED: handleSHowBalanceLayoutToggle

  // --- Main Render Logic ---

  if (isLoading && sheetId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="animate-spin text-indigo-400 h-8 w-8" />
        <span className="ml-3 text-indigo-400">Loading Live Google Sheet Data via API...</span>
      </div>
    );
  }

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

      <main className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 mb-8">

        {/* --- Header & Refresh Button --- */}
        <div className='w-full relative flex items-center gap-3 mb-4'>
          {/* NEW BUTTON: Open Balance Modal */}
          <button
            onClick={() => setShowBalanceModal(true)}
            className='flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-indigo-400 hover:bg-gray-600 transition space-x-2'
          >
            <Wallet className='h-4 w-4' /> <span>Manage Balances</span>
          </button>


          <button
            onClick={loadExpenses}
            disabled={isLoading || isSubmitting || isUpdatingOverall}
            className={`ml-auto flex items-center justify-center rounded-lg p-2 text-sm font-semibold transition duration-200 border w-1/3 ${isLoading || isSubmitting || isUpdatingOverall
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700'
              : 'bg-gray-700 text-indigo-400 border-indigo-900 hover:bg-gray-600'
              }`}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

        </div>

        {/* REMOVED: The entire showLayoutBalance block has been moved to BalanceModal */}

        {/* Transaction Type Toggle (Expense or Income) */}
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
            <label className='text-[11px] text-gray-500 absolute left-4 bottom-1'>Available Cash Balance: ₱{remainingMoney.toFixed(2)}</label>
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
          {/* Category Dropdown */}
          <div>
            <label htmlFor="category" className="flex items-center text-sm font-medium text-gray-300 mb-1">
              <List className="h-4 w-4 mr-1 text-indigo-400" />
              {transactionType === 'income' ? 'Account to Credit (Category)' : 'Category'}
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

          {/* Payment Type Grid */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-300 mb-1">
              <CreditCard className="h-4 w-4 mr-1 text-indigo-400" />
              {transactionType === 'income' ? 'Income Source (Payment Type)' : 'Payment Type'}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CURRENT_PAYMENT_TYPES.map(p => (
                <button
                  key={p}
                  onClick={() => setPaymentType(p)}
                  className={`py-3 rounded-lg font-medium transition text-[11px]  duration-150 border-2 
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
            <KeypadButton key={key} value={key} onClick={handleKey} />
          ))}
          {['4', '5', '6', 'BACK'].map(key => (
            <KeypadButton key={key} value={key} onClick={handleKey} />
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

      {/* NEW RENDER: Balance Modal */}
      {
        showBalanceModal && (
          <BalanceModal
            onClose={() => setShowBalanceModal(false)}
            cashBalance={cashBalance}
            creditBalance={creditBalance}
            debitBalance={debitBalance}
            totalOverallBalance={totalOverallBalance}
            moneyBalance={moneyBalance}
            creditDebtBalance={creditDebtBalance}
            debitUsageBalance={debitUsageBalance}
            cashDeducted={cashDeducted}
            creditDeducted={creditDeducted}
            debitDeducted={debitDeducted}
            totalExpense={totalExpense}
            cashBalanceInput={cashBalanceInput}
            setCashBalanceInput={setCashBalanceInput}
            creditBalanceInput={creditBalanceInput}
            setCreditBalanceInput={setCreditBalanceInput}
            debitBalanceInput={debitBalanceInput}
            setDebitBalanceInput={setDebitBalanceInput}
            handleUpdateBalance={handleUpdateBalance}
            isUpdatingOverall={isUpdatingOverall}
            submitError={submitError}
          />
        )
      }

    </div >
  );
};

export default App;