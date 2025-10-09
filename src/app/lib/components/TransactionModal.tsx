import {
    Clock,
    List,
    X,
    ShoppingCart,
    Car,
    Lightbulb,
    Clapperboard,
    Receipt,
    Tag,
    LucideIcon
} from 'lucide-react';
import formatTimestamp from '../util/formatTimestamp';

interface Expense {
    id: string;
    time_stamp: string;
    category: string;
    payment: string;
    expense: number;
    total: number;
    userId: string;
}

const CategoryIcons: { [key: string]: LucideIcon } = {
    'Groceries': ShoppingCart,
    'Transport': Car,
    'Utilities': Lightbulb,
    'Entertainment': Clapperboard,
    'Bills': Receipt,
    'Other': Tag,
    'DEFAULT': Tag, // Fallback icon
};

const getCategoryIcon = (category: string) => {
    // Look up the icon, falling back to Tag if the category is not found
    const IconComponent = CategoryIcons[category] || CategoryIcons['DEFAULT'];
    // Icon color set to the indigo accent for better visibility in dark mode
    return <IconComponent className="h-5 w-5 mr-2 text-indigo-400" />;
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
                                            {/* Category Name: ADDED flex items-center and the icon call */}
                                            <span className="text-lg font-semibold text-gray-100 flex items-center">
                                                {getCategoryIcon(expense.category)}
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

export default TransactionsModal;