// --- SheetIdModal Component (Dark Mode Updated) ---
import React from "react";
import {
    X,
    Database, // Icon for sheet ID
    Save, // Icon for overall money save
} from 'lucide-react';


interface SheetIdModalProps {
    onSubmit: (id: string) => void;
    onClose: () => void;
    initialSheetId: any;
    error: string | null;
}

const SheetIdModal: React.FC<SheetIdModalProps> = ({ onSubmit, onClose, initialSheetId, error }) => {
    const [input, setInput] = React.useState(initialSheetId);
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
                        <button onClick={() => onClose} className="text-gray-400 hover:text-gray-200">
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


export default SheetIdModal;