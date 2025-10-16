// BalanceModal.tsx
import React from 'react';
import {
    X,
    Wallet,
    PhilippinePeso,
    Save,
    Eye,
    EyeOff,
} from 'lucide-react';

// Interfaces for the modal props
interface BalanceModalProps {
    onClose: () => void;

    // Current Balances (from F2, G2, H2 on sheet)
    cashBalance: number;
    creditBalance: number;
    debitBalance: number;
    totalOverallBalance: number;

    // Balances derived from calculations
    moneyBalance: number;
    creditDebtBalance: number;
    debitUsageBalance: number;
    cashDeducted: number;
    creditDeducted: number;
    debitDeducted: number;
    totalExpense: number;

    // State for inputs (used in "Set" mode)
    cashBalanceInput: string;
    setCashBalanceInput: React.Dispatch<React.SetStateAction<string>>;
    creditBalanceInput: string;
    setCreditBalanceInput: React.Dispatch<React.SetStateAction<string>>;
    debitBalanceInput: string;
    setDebitBalanceInput: React.Dispatch<React.SetStateAction<string>>;

    // Actions/Status
    handleUpdateBalance: (balanceType: 'cash' | 'credit' | 'debit') => Promise<void>;
    isUpdatingOverall: boolean;
    submitError: string | null;
}

const BalanceModal: React.FC<BalanceModalProps> = ({
    onClose,
    // Input/Action Props
    cashBalance,
    cashBalanceInput,
    setCashBalanceInput,
    creditBalanceInput,
    setCreditBalanceInput,
    debitBalanceInput,
    setDebitBalanceInput,
    handleUpdateBalance,
    isUpdatingOverall,
    submitError,
    // Display Props
    totalOverallBalance,
    moneyBalance,
    creditDebtBalance,
    debitUsageBalance,
    cashDeducted,
    creditDeducted,
    debitDeducted,
    totalExpense,
    creditBalance, // Needed for comparison in Set Mode
    debitBalance,  // Needed for comparison in Set Mode
}) => {
    // Local state to toggle between "Show Balances" and "Set Balances" modes
    const [showBalanceMode, setShowBalanceMode] = React.useState(true);

    const handleModeToggle = () => {
        setShowBalanceMode(prev => !prev);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                    <h2 className="text-xl font-bold text-indigo-400 flex items-center">
                        <Wallet className="h-5 w-5 mr-2" />
                        {showBalanceMode ? 'Current Balances Overview' : 'Set Account Balances'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Mode Toggle */}
                <div className="flex justify-center mb-4">
                    <button
                        onClick={handleModeToggle}
                        className="px-4 py-2 rounded-full text-sm font-medium bg-gray-700 text-indigo-400 hover:bg-gray-600 transition flex items-center space-x-2"
                    >
                        {showBalanceMode ? (
                            <>
                                <EyeOff className='h-4 w-4' /> Switch to Set Mode
                            </>
                        ) : (
                            <>
                                <Eye className='h-4 w-4' /> Switch to View Mode
                            </>
                        )}
                    </button>
                </div>


                {/* CONTENT AREA */}
                {showBalanceMode ? (
                    // UI for displaying new segregated balances (View Mode)
                    <div className="bg-indigo-950 p-4 rounded-lg shadow-inner">
                        <h3 className="text-base sm:text-md font-extrabold text-white mb-3 border-b border-indigo-900 pb-2 flex items-center">
                            <PhilippinePeso className="h-5 w-5 mr-2" /> Total Overall Balance
                        </h3>
                        <div className="flex justify-between items-center py-1 mb-2">
                            <span className="text-lg sm:text-xl font-bold text-gray-300">Total All Accounts:</span>
                            <span className={`text-xl sm:text-2xl font-extrabold ${totalOverallBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {totalOverallBalance.toFixed(2)}
                            </span>
                        </div>
                        <div className="h-px bg-indigo-900 my-2"></div>

                        <h3 className="text-base sm:text-md font-extrabold text-indigo-400 mb-3 border-b border-indigo-900 pb-2 flex items-center">
                            <Wallet className="h-5 w-5 mr-2" /> Balances from Sheet (F2, G2, H2)
                        </h3>

                        {/* Money Balance (F2 minus Cash Deductions) */}
                        <div className="flex justify-between items-center py-1">
                            <span className="text-sm sm:text-base font-medium text-gray-300">Money Balance (Cash/eCash):</span>
                            <span className={`text-md sm:text-lg font-bold ${moneyBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {moneyBalance.toFixed(2)}
                            </span>
                        </div>

                        {/* Credit Balance (G2) */}
                        <div className="flex justify-between items-center py-1">
                            <span className="text-sm sm:text-base font-medium text-gray-300">Credit Balance (Sheet G2):</span>
                            <span className={`text-md sm:text-lg font-bold ${creditDebtBalance >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                                {creditDebtBalance.toFixed(2)}
                            </span>
                        </div>

                        {/* Debit Balance (H2) */}
                        <div className="flex justify-between items-center py-1">
                            <span className="text-sm sm:text-base font-medium text-gray-300">Debit Balance (Sheet H2):</span>
                            <span className={`text-md sm:text-lg font-bold ${debitUsageBalance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                                {debitUsageBalance.toFixed(2)}
                            </span>
                        </div>

                        <div className="h-px bg-indigo-900 my-2"></div>

                        <h3 className="text-base sm:text-md font-extrabold text-red-400 mb-3 border-b border-indigo-900 pb-2 flex items-center">
                            <X className="h-5 w-5 mr-2" /> Total Deductions (From History)
                        </h3>

                        {/* Cash Deducted */}
                        <div className="flex justify-between items-center py-1">
                            <span className="text-sm sm:text-base font-medium text-gray-300">Cash/eCash Deducted:</span>
                            <span className="text-lg sm:text-xl font-bold text-red-400">
                                {cashDeducted.toFixed(2)}
                            </span>
                        </div>

                        {/* Credit Deducted */}
                        <div className="flex justify-between items-center py-1">
                            <span className="text-sm sm:text-base font-medium text-gray-300">Credit Deducted:</span>
                            <span className="text-lg sm:text-xl font-bold text-red-400">
                                {creditDeducted.toFixed(2)}
                            </span>
                        </div>

                        {/* Debit Deducted */}
                        <div className="flex justify-between items-center py-1">
                            <span className="text-sm sm:text-base font-medium text-gray-300">Debit Deducted:</span>
                            <span className="text-lg sm:text-xl font-bold text-red-400">
                                {debitDeducted.toFixed(2)}
                            </span>
                        </div>

                        <div className="h-px bg-indigo-900 my-2"></div>

                        {/* Total Deducted (from Sheet/API E2) */}
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm sm:text-md font-bold text-indigo-400">Total All Expense (from Sheet E2):</span>
                            <span className={`text-lg sm:text-xl font-extrabold text-red-400`}>
                                {totalExpense.toFixed(2)}
                            </span>
                        </div>

                    </div>
                ) : (
                    // UI for modifying all three balances (F2, G2, H2) (Set Mode)
                    <div className="bg-green-950 p-4 rounded-lg shadow-inner space-y-4">

                        {/* 1. Cash Balance (F2) */}
                        <div className="border-b border-green-800 pb-2">
                            <span className="text-xs sm:text-sm font-medium uppercase text-green-300">Cash Balance (Sheet F2):</span>
                            <div className="flex items-center mt-1">
                                <input
                                    type="number"
                                    value={cashBalanceInput}
                                    onChange={(e) => setCashBalanceInput(e.target.value)}
                                    placeholder="Update Cash Balance"
                                    className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-l-lg shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                                    disabled={isUpdatingOverall}
                                />
                                <button
                                    onClick={() => handleUpdateBalance('cash')}
                                    disabled={isUpdatingOverall || cashBalanceInput === cashBalance.toString()}
                                    className={`flex items-center justify-center py-2 px-4 rounded-r-lg text-white font-semibold transition duration-200 ${isUpdatingOverall || cashBalanceInput === cashBalance.toString()
                                        ? 'bg-green-700 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-500'
                                        }`}
                                >
                                    <Save className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* 2. Credit Balance (G2) */}
                        <div className="border-b border-purple-800 pb-2">
                            <span className="text-xs sm:text-sm font-medium uppercase text-purple-300">Credit Balance (Sheet G2):</span>
                            <div className="flex items-center mt-1">
                                <input
                                    type="number"
                                    value={creditBalanceInput}
                                    onChange={(e) => setCreditBalanceInput(e.target.value)}
                                    placeholder="Update Credit Balance"
                                    className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-l-lg shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    disabled={isUpdatingOverall}
                                />
                                <button
                                    onClick={() => handleUpdateBalance('credit')}
                                    disabled={isUpdatingOverall || creditBalanceInput === creditBalance.toString()}
                                    className={`flex items-center justify-center py-2 px-4 rounded-r-lg text-white font-semibold transition duration-200 ${isUpdatingOverall || creditBalanceInput === creditBalance.toString()
                                        ? 'bg-purple-700 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-500'
                                        }`}
                                >
                                    <Save className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* 3. Debit Balance (H2) */}
                        <div>
                            <span className="text-xs sm:text-sm font-medium uppercase text-indigo-300">Debit Balance (Sheet H2):</span>
                            <div className="flex items-center mt-1">
                                <input
                                    type="number"
                                    value={debitBalanceInput}
                                    onChange={(e) => setDebitBalanceInput(e.target.value)}
                                    placeholder="Update Debit Balance"
                                    className="w-full py-2 px-3 border border-gray-700 bg-gray-700 text-gray-100 rounded-l-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    disabled={isUpdatingOverall}
                                />
                                <button
                                    onClick={() => handleUpdateBalance('debit')}
                                    disabled={isUpdatingOverall || debitBalanceInput === debitBalance.toString()}
                                    className={`flex items-center justify-center py-2 px-4 rounded-r-lg text-white font-semibold transition duration-200 ${isUpdatingOverall || debitBalanceInput === debitBalance.toString()
                                        ? 'bg-indigo-700 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-500'
                                        }`}
                                >
                                    <Save className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Error message */}
                        {submitError && (
                            <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-300 rounded-lg flex items-center">
                                <X className="h-5 w-5 mr-2" />
                                <p className="text-sm">{submitError}</p>
                            </div>
                        )}

                    </div>
                )}

                {/* Footer */}
                <div className="border-t border-gray-700 pt-4 mt-4">
                    <button onClick={onClose} className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition">
                        Close
                    </button>
                </div>
            </div>
        </div >
    );
};

export default BalanceModal;