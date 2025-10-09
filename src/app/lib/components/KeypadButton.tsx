import {
    X,
    Delete,
} from 'lucide-react';


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

export default KeypadButton;