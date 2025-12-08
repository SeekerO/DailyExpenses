"use client"

import React, { useState, useEffect } from 'react';
import {
    PlusCircle,
    BarChart3,
    TrendingUp,
    Brain,
    History,
    Trash2,
    Download,
    Upload,
    Target,
    Activity,
    AlertCircle,
    Grid3x3,
    Circle,
    Repeat
} from 'lucide-react';

type GameResult = {
    id: string;
    winner: 'player' | 'banker' | 'tie';
    playerScore?: number;
    bankerScore?: number;
    timestamp: number;
    shoeNumber: number;
    dealerNumber: number; // NEW: Track the dealer for this hand
    // New fields for prediction tracking
    predictedWinner?: 'player' | 'banker';
    isCorrectPrediction?: boolean;
};

type Pattern = {
    type: string;
    description: string;
    strength: number;
};

const BaccaratRecorder: React.FC = () => {
    const [results, setResults] = useState<GameResult[]>([]);
    const [currentShoe, setCurrentShoe] = useState<number>(1);
    const [currentDealer, setCurrentDealer] = useState<number>(1); // NEW: State for current dealer
    const [selectedResult, setSelectedResult] = useState<'player' | 'banker' | 'tie' | null>(null);
    const [playerScore, setPlayerScore] = useState<string>('');
    const [bankerScore, setBankerScore] = useState<string>('');
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'recorder' | 'stats' | 'patterns' | 'prediction'>('recorder');

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('baccaratResults');
        if (saved) {
            const data = JSON.parse(saved);
            setResults(data.results || []);
            setCurrentShoe(data.currentShoe || 1);
            setCurrentDealer(data.currentDealer || 1); // Load new dealer state
        }
    }, []);

    // Save to localStorage whenever results change
    useEffect(() => {
        if (results.length > 0) {
            localStorage.setItem('baccaratResults', JSON.stringify({
                results,
                currentShoe,
                currentDealer // Save new dealer state
            }));
        }
    }, [results, currentShoe, currentDealer]);

    // Prediction utility function defined here for use in addResult
    const getPrediction = () => {
        if (results.length < 5) {
            return {
                prediction: 'Need More Data',
                confidence: 0,
                reason: 'Record at least 5 results for predictions',
                alternate: null,
                signals: [],
                nextPattern: [] as ('player' | 'banker' | 'unknown')[]
            };
        }

        const stats = getStatistics();
        const patterns = detectPatterns();
        const last10 = results.slice(0, 10).filter(r => r.winner !== 'tie');
        const last20 = results.slice(0, 20).filter(r => r.winner !== 'tie');

        const recentPlayer = last10.filter(r => r.winner === 'player').length;
        const recentBanker = last10.filter(r => r.winner === 'banker').length;

        let prediction: 'player' | 'banker' | 'Need More Data' = 'banker';
        let confidence = 45.86; // Default banker probability
        let reason = '';
        let alternate: 'player' | 'banker' | null = null;
        const signals: string[] = [];

        // Generate next pattern prediction (next 6 hands)
        const nextPattern: ('player' | 'banker' | 'unknown')[] = [];

        // Check for zigzag pattern
        const zigzagPattern = patterns.find(p => p.type === 'Zigzag Pattern');
        if (zigzagPattern && zigzagPattern.strength > 60) {
            prediction = results[0].winner === 'player' ? 'banker' : 'player';
            confidence = zigzagPattern.strength;
            reason = 'Strong zigzag pattern suggests alternation';
            signals.push('🔄 Zigzag pattern active');

            // Generate alternating pattern
            let current = prediction as 'player' | 'banker';
            for (let i = 0; i < 6; i++) {
                nextPattern.push(current);
                current = current === 'player' ? 'banker' : 'player';
            }
        }
        // Check for streak continuation
        else if (stats.currentStreak.count >= 3 && stats.currentStreak.count < 6) {
            prediction = stats.currentStreak.type as 'player' | 'banker';
            confidence = Math.min(50 + (stats.currentStreak.count * 5), 75);
            reason = `${stats.currentStreak.count}-streak may continue`;
            signals.push(`🔥 ${stats.currentStreak.count}-hand streak`);
            alternate = prediction === 'player' ? 'banker' : 'player';

            // Predict streak continuation then reversal
            for (let i = 0; i < 3; i++) {
                nextPattern.push(prediction);
            }
            const opposite = prediction === 'player' ? 'banker' : 'player';
            for (let i = 0; i < 3; i++) {
                nextPattern.push(opposite);
            }
        }
        // Check for streak break
        else if (stats.currentStreak.count >= 6) {
            prediction = stats.currentStreak.type === 'player' ? 'banker' : 'player';
            confidence = 60 + (stats.currentStreak.count * 2);
            reason = `Long streak likely to break (${stats.currentStreak.count} hands)`;
            signals.push(`⚠️ ${stats.currentStreak.count}-hand streak - reversal likely`);

            // Predict reversal and new streak
            for (let i = 0; i < 4; i++) {
                nextPattern.push(prediction as 'player' | 'banker');
            }
            nextPattern.push('unknown');
            nextPattern.push('unknown');
        }
        // Check for dominance correction
        else if (recentPlayer >= 7) {
            prediction = 'banker';
            confidence = 65;
            reason = 'Player dominance suggests banker correction';
            signals.push('📊 Player dominance detected');
            alternate = 'player';

            // Predict banker surge
            for (let i = 0; i < 4; i++) {
                nextPattern.push('banker');
            }
            nextPattern.push('unknown');
            nextPattern.push('unknown');
        }
        else if (recentBanker >= 7) {
            prediction = 'player';
            confidence = 65;
            reason = 'Banker dominance suggests player correction';
            signals.push('📊 Banker dominance detected');
            alternate = 'banker';

            // Predict player surge
            for (let i = 0; i < 4; i++) {
                nextPattern.push('player');
            }
            nextPattern.push('unknown');
            nextPattern.push('unknown');
        }
        // Check for double pattern
        else if (patterns.find(p => p.type === 'Double Pattern')) {
            if (results[0].winner === results[1]?.winner) {
                prediction = results[0].winner === 'player' ? 'banker' : 'player';
                confidence = 55;
                reason = 'Double pattern suggests switch after pair';
                signals.push('👥 Double pattern active');

                // Predict alternating doubles
                const opposite = prediction as 'player' | 'banker';
                nextPattern.push(opposite);
                nextPattern.push(opposite);
                const next = opposite === 'player' ? 'banker' : 'player';
                nextPattern.push(next);
                nextPattern.push(next);
                nextPattern.push('unknown');
                nextPattern.push('unknown');
            } else {
                prediction = results[0].winner as 'player' | 'banker';
                confidence = 60;
                reason = 'Double pattern suggests pair formation';
                signals.push('👥 Expecting pair completion');

                // Predict pair completion
                nextPattern.push(prediction);
                const opposite = prediction === 'player' ? 'banker' : 'player';
                nextPattern.push(opposite);
                nextPattern.push(opposite);
                nextPattern.push('unknown');
                nextPattern.push('unknown');
                nextPattern.push('unknown');
            }
        }
        // Default statistical prediction
        else {
            // Slight bias toward the less frequent recent outcome
            if (recentPlayer < recentBanker) {
                prediction = 'player';
                confidence = 48;
                reason = 'Statistical rebalancing expected';
            } else {
                prediction = 'banker';
                confidence = 46;
                reason = 'Statistical probability favors banker';
            }
            signals.push('📈 Using statistical baseline');

            // Generate balanced pattern
            const pattern = ['banker', 'player', 'banker', 'banker', 'player', 'player'];
            pattern.forEach(p => nextPattern.push(p as 'player' | 'banker'));
        }

        // Fill remaining slots if needed
        while (nextPattern.length < 6) {
            nextPattern.push('unknown');
        }

        // Add pattern signals
        patterns.forEach(pattern => {
            if (pattern.strength > 60 && !signals.some(s => s.includes(pattern.type))) {
                signals.push(`🎯 ${pattern.type} detected`);
            }
        });

        return {
            prediction,
            confidence: confidence.toFixed(1),
            reason,
            alternate,
            signals,
            nextPattern: nextPattern.slice(0, 6)
        };
    };

    const addResult = () => {
        if (!selectedResult) {
            alert('Please select a winner!');
            return;
        }

        // --- PREDICTION TRACKING LOGIC ---
        // Get the prediction based on the current 'results' array (i.e., prediction for the hand about to be recorded)
        const currentPrediction = getPrediction();

        const predictedWinner: 'player' | 'banker' | undefined = (currentPrediction.prediction === 'player' || currentPrediction.prediction === 'banker')
            ? currentPrediction.prediction
            : undefined;

        // Check for correctness: only compare if a prediction was made, and the actual result wasn't a tie.
        const isCorrectPrediction: boolean | undefined = (predictedWinner && selectedResult !== 'tie')
            ? predictedWinner === selectedResult
            : undefined;
        // ------------------------------------

        const newResult: GameResult = {
            id: Date.now().toString(),
            winner: selectedResult,
            playerScore: playerScore ? parseInt(playerScore) : undefined,
            bankerScore: bankerScore ? parseInt(bankerScore) : undefined,
            timestamp: Date.now(),
            shoeNumber: currentShoe,
            dealerNumber: currentDealer, // NEW: Include current dealer number
            // Store prediction metadata
            predictedWinner,
            isCorrectPrediction
        };

        setResults(prev => [newResult, ...prev]);

        // Reset form
        setSelectedResult(null);
        setPlayerScore('');
        setBankerScore('');
    };

    const deleteResult = (id: string) => {
        setResults(prev => prev.filter(r => r.id !== id));
    };

    const clearAllResults = () => {
        if (confirm('Are you sure you want to clear all results?')) {
            setResults([]);
            setCurrentShoe(1);
            setCurrentDealer(1); // Reset dealer too
            localStorage.removeItem('baccaratResults');
        }
    };

    // Renamed function for clarity
    const startNewShoe = () => {
        setCurrentShoe(prev => prev + 1);
    };

    // NEW FUNCTION
    const changeDealer = () => {
        setCurrentDealer(prev => prev + 1);
    };


    const exportData = () => {
        const dataStr = JSON.stringify({ results, currentShoe, currentDealer }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `baccarat-results-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);
                    setResults(data.results || []);
                    setCurrentShoe(data.currentShoe || 1);
                    setCurrentDealer(data.currentDealer || 1); // Import new dealer state
                } catch (error) {
                    alert('Invalid file format');
                }
            };
            reader.readAsText(file);
        }
    };

    // Statistics calculations
    const getStatistics = () => {
        if (results.length === 0) {
            return {
                total: 0,
                playerWins: 0,
                bankerWins: 0,
                ties: 0,
                playerWinRate: 0,
                bankerWinRate: 0,
                tieRate: 0,
                currentStreak: { type: '', count: 0 },
                longestStreak: { type: '', count: 0 },
                avgPlayerScore: 0,
                avgBankerScore: 0,
                shoesPlayed: 0,
                correctPredictions: 0,
                totalPredictions: 0,
                predictionAccuracy: '0.0'
            };
        }

        const total = results.length;
        const playerWins = results.filter(r => r.winner === 'player').length;
        const bankerWins = results.filter(r => r.winner === 'banker').length;
        const ties = results.filter(r => r.winner === 'tie').length;

        // Calculate streaks
        let currentStreak = { type: results[0].winner, count: 1 };
        for (let i = 1; i < results.length; i++) {
            if (results[i].winner === currentStreak.type && results[i].winner !== 'tie') {
                currentStreak.count++;
            } else if (results[i].winner !== 'tie') {
                break;
            }
        }

        let longestStreak = { type: '', count: 0 };
        let tempStreak = { type: results[0].winner, count: 1 };

        for (let i = 1; i < results.length; i++) {
            if (results[i].winner === tempStreak.type && results[i].winner !== 'tie') {
                tempStreak.count++;
            } else if (results[i].winner !== 'tie') {
                if (tempStreak.count > longestStreak.count && tempStreak.type !== 'tie') {
                    longestStreak = { ...tempStreak };
                }
                tempStreak = { type: results[i].winner, count: 1 };
            }
        }
        if (tempStreak.count > longestStreak.count && tempStreak.type !== 'tie') {
            longestStreak = { ...tempStreak };
        }

        // Average scores
        const resultsWithScores = results.filter(r => r.playerScore !== undefined && r.bankerScore !== undefined);
        const avgPlayerScore = resultsWithScores.length > 0
            ? resultsWithScores.reduce((sum, r) => sum + (r.playerScore || 0), 0) / resultsWithScores.length
            : 0;
        const avgBankerScore = resultsWithScores.length > 0
            ? resultsWithScores.reduce((sum, r) => sum + (r.bankerScore || 0), 0) / resultsWithScores.length
            : 0;

        const shoesPlayed = new Set(results.map(r => r.shoeNumber)).size;

        // --- PREDICTION PERFORMANCE LOGIC (Per Shoe) ---
        const currentShoeResults = results.filter(r => r.shoeNumber === currentShoe);

        // Filter out ties for prediction tracking, as prediction only targets P/B
        const predictedHands = currentShoeResults.filter(r =>
            r.predictedWinner !== undefined &&
            r.winner !== 'tie'
        );

        const correctPredictions = predictedHands.filter(r => r.isCorrectPrediction === true).length;
        const totalPredictions = predictedHands.length;
        const predictionAccuracy = totalPredictions > 0
            ? (correctPredictions / totalPredictions * 100).toFixed(1)
            : '0.0';
        // ----------------------------------------------------

        return {
            total,
            playerWins,
            bankerWins,
            ties,
            playerWinRate: (playerWins / total * 100).toFixed(1),
            bankerWinRate: (bankerWins / total * 100).toFixed(1),
            tieRate: (ties / total * 100).toFixed(1),
            currentStreak,
            longestStreak,
            avgPlayerScore: avgPlayerScore.toFixed(2),
            avgBankerScore: avgBankerScore.toFixed(2),
            shoesPlayed,
            // NEW RETURN VALUES
            correctPredictions,
            totalPredictions,
            predictionAccuracy
        };
    };

    // Pattern detection
    const detectPatterns = (): Pattern[] => {
        if (results.length < 6) {
            return [{
                type: 'Insufficient Data',
                description: 'Record at least 6 results to detect patterns',
                strength: 0
            }];
        }

        const patterns: Pattern[] = [];
        const recentResults = results.slice(0, 20).filter(r => r.winner !== 'tie');
        const last10 = results.slice(0, 10).filter(r => r.winner !== 'tie');

        // Zigzag pattern (alternating wins)
        let zigzagCount = 0;
        for (let i = 0; i < last10.length - 1; i++) {
            if (last10[i].winner !== last10[i + 1].winner) {
                zigzagCount++;
            }
        }
        if (zigzagCount >= 6) {
            patterns.push({
                type: 'Zigzag Pattern',
                description: `Strong alternating pattern detected (${zigzagCount}/${last10.length - 1} alternations)`,
                strength: (zigzagCount / (last10.length - 1)) * 100
            });
        }

        // Streak pattern
        const stats = getStatistics();
        if (stats.currentStreak.count >= 3) {
            patterns.push({
                type: `${stats.currentStreak.type.charAt(0).toUpperCase() + stats.currentStreak.type.slice(1)} Streak`,
                description: `${stats.currentStreak.count} consecutive ${stats.currentStreak.type} wins`,
                strength: Math.min(stats.currentStreak.count * 20, 100)
            });
        }

        // Dominance pattern
        const recentPlayer = last10.filter(r => r.winner === 'player').length;
        const recentBanker = last10.filter(r => r.winner === 'banker').length;

        if (recentPlayer >= 7) {
            patterns.push({
                type: 'Player Dominance',
                description: `Player winning ${recentPlayer} of last ${last10.length} hands`,
                strength: (recentPlayer / last10.length) * 100
            });
        } else if (recentBanker >= 7) {
            patterns.push({
                type: 'Banker Dominance',
                description: `Banker winning ${recentBanker} of last ${last10.length} hands`,
                strength: (recentBanker / last10.length) * 100
            });
        }

        // Chop pattern (balanced)
        const diff = Math.abs(recentPlayer - recentBanker);
        if (diff <= 2 && last10.length >= 8) {
            patterns.push({
                type: 'Chop (Balanced)',
                description: `Nearly equal distribution: P${recentPlayer} vs B${recentBanker}`,
                strength: 70
            });
        }

        // Double pattern (pairs of same outcome)
        let doubleCount = 0;
        for (let i = 0; i < recentResults.length - 1; i += 2) {
            if (recentResults[i].winner === recentResults[i + 1]?.winner) {
                doubleCount++;
            }
        }
        if (doubleCount >= 3) {
            patterns.push({
                type: 'Double Pattern',
                description: `Results appearing in pairs (${doubleCount} doubles detected)`,
                strength: (doubleCount / (recentResults.length / 2)) * 100
            });
        }

        if (patterns.length === 0) {
            patterns.push({
                type: 'Random Distribution',
                description: 'No clear patterns detected - results appear random',
                strength: 50
            });
        }

        return patterns;
    };

    // Generate Big Road display
    const generateBigRoad = () => {
        const road: { winner: 'player' | 'banker', ties: number }[][] = [];
        let currentColumn: { winner: 'player' | 'banker', ties: number }[] = [];
        let lastWinner: 'player' | 'banker' | null = null;

        const nonTieResults = results.slice().reverse().filter(r => r.winner !== 'tie');

        for (let i = 0; i < nonTieResults.length; i++) {
            const result = nonTieResults[i];
            const winner = result.winner as 'player' | 'banker';

            if (winner === lastWinner) {
                currentColumn.push({ winner, ties: 0 });
            } else {
                if (currentColumn.length > 0) {
                    road.push([...currentColumn]);
                }
                currentColumn = [{ winner, ties: 0 }];
                lastWinner = winner;
            }
        }

        if (currentColumn.length > 0) {
            road.push(currentColumn);
        }

        return road.slice(-12); // Show last 12 columns
    };

    // Generate Bead Plate (Bead Road)
    const generateBeadPlate = () => {
        const maxRows = 6;
        const maxCols = 12;
        const plate: (GameResult | null)[][] = Array(maxRows).fill(null).map(() => Array(maxCols).fill(null));

        const recentResults = results.slice(0, maxRows * maxCols).reverse();

        let col = 0;
        let row = 0;

        for (const result of recentResults) {
            if (row < maxRows && col < maxCols) {
                plate[row][col] = result;
                row++;
                if (row >= maxRows) {
                    row = 0;
                    col++;
                }
            }
        }

        return plate;
    };

    // Generate Big Eye Boy (derived road)
    const generateBigEyeBoy = () => {
        const bigRoad = generateBigRoad();
        if (bigRoad.length < 2) return [];

        const derived: ('red' | 'blue')[][] = [];

        for (let i = 1; i < Math.min(bigRoad.length, 12); i++) {
            const currentCol = bigRoad[i];
            const prevCol = bigRoad[i - 1];

            if (!currentCol || !prevCol) continue;

            const column: ('red' | 'blue')[] = [];

            for (let j = 0; j < currentCol.length; j++) {
                // Simplified Big Eye Boy logic: red for predictable, blue for chaotic
                if (prevCol.length === currentCol.length) {
                    column.push('red');
                } else {
                    column.push('blue');
                }
            }

            derived.push(column);
        }

        return derived.slice(-12);
    };

    // Generate Small Road
    const generateSmallRoad = () => {
        const bigRoad = generateBigRoad();
        if (bigRoad.length < 3) return [];

        const derived: ('red' | 'blue')[][] = [];

        for (let i = 2; i < Math.min(bigRoad.length, 12); i++) {
            const currentCol = bigRoad[i];
            const twoColsBack = bigRoad[i - 2];

            if (!currentCol || !twoColsBack) continue;

            const column: ('red' | 'blue')[] = [];

            for (let j = 0; j < currentCol.length; j++) {
                if (twoColsBack.length === currentCol.length) {
                    column.push('red');
                } else {
                    column.push('blue');
                }
            }

            derived.push(column);
        }

        return derived.slice(-12);
    };

    // Generate Cockroach Road
    const generateCockroachRoad = () => {
        const bigRoad = generateBigRoad();
        if (bigRoad.length < 4) return [];

        const derived: ('red' | 'blue')[][] = [];

        for (let i = 3; i < Math.min(bigRoad.length, 12); i++) {
            const currentCol = bigRoad[i];
            const threeColsBack = bigRoad[i - 3];

            if (!currentCol || !threeColsBack) continue;

            const column: ('red' | 'blue')[] = [];

            for (let j = 0; j < currentCol.length; j++) {
                if (threeColsBack.length === currentCol.length) {
                    column.push('red');
                } else {
                    column.push('blue');
                }
            }

            derived.push(column);
        }

        return derived.slice(-12);
    };

    // --- NEW FUNCTION: Generate Predicted Road ---
    const generatePredictedRoad = (nextPattern: ('player' | 'banker' | 'unknown')[]) => {
        const road: { winner: 'player' | 'banker' | 'unknown' }[][] = [];
        let currentColumn: { winner: 'player' | 'banker' | 'unknown' }[] = [];
        let lastWinner: 'player' | 'banker' | null = null; // Only track P/B for streaks

        for (const winner of nextPattern) {
            const isP_B = winner === 'player' || winner === 'banker';

            if (isP_B) {
                if (winner === lastWinner) {
                    currentColumn.push({ winner });
                } else {
                    if (currentColumn.length > 0) {
                        road.push([...currentColumn]);
                    }
                    currentColumn = [{ winner }];
                    lastWinner = winner;
                }
            } else { // 'unknown'
                // An 'unknown' always breaks a P/B streak and starts its own 1-hand column.
                // If the previous column was also 'unknown', they are still separated for visual clarity.
                if (currentColumn.length > 0) {
                    road.push([...currentColumn]);
                }
                road.push([{ winner }]);
                currentColumn = [];
                lastWinner = null;
            }
        }

        if (currentColumn.length > 0) {
            road.push(currentColumn);
        }

        return road;
    };
    // ---------------------------------------------


    const stats: any = getStatistics();
    const patterns = detectPatterns();
    const prediction = getPrediction();
    const bigRoad = generateBigRoad();
    const beadPlate = generateBeadPlate();
    const bigEyeBoy = generateBigEyeBoy();
    const smallRoad = generateSmallRoad();
    const cockroachRoad = generateCockroachRoad();
    // NEW: Predicted Road
    const predictedRoad = generatePredictedRoad(prediction.nextPattern);


    return (
        <div className="min-h-screen w-screen overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-blue-500/30">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-blue-400 mb-1">Baccarat Analyzer</h1>
                            <p className="text-slate-300">Professional Results Tracker & Predictor</p>
                        </div>
                        {/* UPDATED: Shoe and Dealer Indicators/Buttons */}
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-sm text-slate-400">Current Shoe (Deck)</div>
                                <div className="text-2xl font-bold text-blue-400">#{currentShoe}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-slate-400">Current Dealer</div>
                                <div className="text-2xl font-bold text-green-400">#{currentDealer}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={changeDealer}
                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition flex items-center gap-2 text-sm"
                                >
                                    <Repeat size={18} />
                                    New Dealer
                                </button>
                                <button
                                    onClick={startNewShoe}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
                                >
                                    <Repeat size={18} />
                                    New Shoe (Shuffle)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-2 mb-6 border border-blue-500/30">
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'recorder', label: 'Recorder', icon: PlusCircle },
                            { id: 'stats', label: 'Statistics', icon: BarChart3 },
                            { id: 'patterns', label: 'Patterns', icon: Grid3x3 },
                            { id: 'prediction', label: 'Prediction', icon: Brain }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-3 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recorder Tab */}
                {activeTab === 'recorder' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Input Section */}
                        <div className="lg:col-span-1">
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30 mb-6">
                                <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <PlusCircle size={20} />
                                    Record Result
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-slate-300 mb-2 block font-semibold">Winner *</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => setSelectedResult('player')}
                                                className={`py-4 rounded-lg font-bold transition ${selectedResult === 'player'
                                                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                    }`}
                                            >
                                                Player
                                            </button>
                                            <button
                                                onClick={() => setSelectedResult('banker')}
                                                className={`py-4 rounded-lg font-bold transition ${selectedResult === 'banker'
                                                    ? 'bg-red-600 text-white ring-2 ring-red-400'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                    }`}
                                            >
                                                Banker
                                            </button>
                                            <button
                                                onClick={() => setSelectedResult('tie')}
                                                className={`py-4 rounded-lg font-bold transition ${selectedResult === 'tie'
                                                    ? 'bg-green-600 text-white ring-2 ring-green-400'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                    }`}
                                            >
                                                Tie
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="text-blue-400 hover:text-blue-300 text-sm mb-2"
                                        >
                                            {showAdvanced ? '− Hide' : '+ Show'} Optional Scores
                                        </button>

                                        {showAdvanced && (
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <label className="text-slate-400 text-sm mb-1 block">Player Score</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="9"
                                                        value={playerScore}
                                                        onChange={(e) => setPlayerScore(e.target.value)}
                                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                                                        placeholder="0-9"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-slate-400 text-sm mb-1 block">Banker Score</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="9"
                                                        value={bankerScore}
                                                        onChange={(e) => setBankerScore(e.target.value)}
                                                        className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                                                        placeholder="0-9"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={addResult}
                                        disabled={!selectedResult}
                                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <PlusCircle size={20} />
                                        Add Result
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-lg font-bold text-blue-400 mb-4">Quick Stats</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Total Hands:</span>
                                        <span className="text-white font-bold">{stats.total}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-blue-400">Player:</span>
                                        <span className="text-white font-bold">{stats.playerWins} ({stats.playerWinRate}%)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-red-400">Banker:</span>
                                        <span className="text-white font-bold">{stats.bankerWins} ({stats.bankerWinRate}%)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-green-400">Tie:</span>
                                        <span className="text-white font-bold">{stats.ties} ({stats.tieRate}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Results History */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                                        <History size={20} />
                                        Results History ({stats.total})
                                    </h2>
                                    <div className="flex gap-2">
                                        <label className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition cursor-pointer flex items-center gap-2">
                                            <Upload size={16} />
                                            Import
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={importData}
                                                className="hidden"
                                            />
                                        </label>
                                        <button
                                            onClick={exportData}
                                            disabled={results.length === 0}
                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Download size={16} />
                                            Export
                                        </button>
                                        <button
                                            onClick={clearAllResults}
                                            disabled={results.length === 0}
                                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Trash2 size={16} />
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {/* Big Road Display */}
                                {results.length > 0 && (
                                    <div className="mb-6 bg-slate-900/50 p-4 rounded-lg">
                                        <h3 className="text-sm font-bold text-slate-400 mb-3">Big Road</h3>
                                        <div className="flex gap-1 overflow-x-auto pb-2">
                                            {bigRoad.map((column, colIdx) => (
                                                <div key={colIdx} className="flex flex-col-reverse gap-1">
                                                    {column.map((cell, cellIdx) => (
                                                        <div
                                                            key={cellIdx}
                                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${cell.winner === 'player'
                                                                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                                                : 'border-red-500 text-red-400 bg-red-500/10'
                                                                }`}
                                                        >
                                                            {/* Tie count logic omitted for brevity, keeping original for display */}
                                                            {cell.ties > 0 && (
                                                                <span className="absolute text-xs font-mono text-green-400 -translate-x-3 translate-y-3">
                                                                    {cell.ties}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-slate-400 text-xs mt-3"> Hollow circles represent wins. Columns show streaks. </p>
                                    </div>
                                )}


                                {/* Individual Results List */}
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {results.length === 0 ? (
                                        <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">
                                            <AlertCircle size={24} className="mx-auto mb-2" />
                                            <p>Start recording results to see statistics and predictions</p>
                                        </div>
                                    ) : (
                                        results.map((result, idx) => (
                                            <div key={result.id} className={`flex items-center justify-between p-3 rounded-lg border ${result.winner === 'player' ? 'bg-blue-900/20 border-blue-500/30' : result.winner === 'banker' ? 'bg-red-900/20 border-red-500/30' : 'bg-green-900/20 border-green-500/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-slate-500 font-mono text-sm w-8">#{results.length - idx}</div>
                                                    <div className={`px-3 py-1 rounded font-bold text-sm ${result.winner === 'player' ? 'bg-blue-600 text-white' : result.winner === 'banker' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                                                        }`}
                                                    >
                                                        {result.winner.toUpperCase()}
                                                    </div>
                                                    {/* Display Prediction Result */}
                                                    {result.predictedWinner && result.winner !== 'tie' && (
                                                        <div className={`text-sm flex items-center gap-1 ${result.isCorrectPrediction ? 'text-green-400' : 'text-yellow-400'}`}>
                                                            {result.isCorrectPrediction ? '✓' : '✗'} Pred: {result.predictedWinner === 'player' ? 'P' : 'B'}
                                                        </div>
                                                    )}
                                                    {result.playerScore !== undefined && result.bankerScore !== undefined && (
                                                        <div className="text-slate-300 text-sm">
                                                            P: {result.playerScore} - B: {result.bankerScore}
                                                        </div>
                                                    )}
                                                    {/* UPDATED: Show Shoe and Dealer number */}
                                                    <div className="text-slate-500 text-xs flex gap-2 items-center">
                                                        <span>Shoe #{result.shoeNumber}</span>
                                                        <span className="text-yellow-400">| Dealer #{result.dealerNumber}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteResult(result.id)} className="text-red-400 hover:text-red-300 transition" >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statistics Tab */}
                {activeTab === 'stats' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Win Distribution */}
                        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                <BarChart3 size={20} /> Win Distribution
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-blue-300">Player</span>
                                        <span className="text-white font-bold">{stats.playerWins} ({stats.playerWinRate}%)</span>
                                    </div>
                                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${stats.playerWinRate}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-red-300">Banker</span>
                                        <span className="text-white font-bold">{stats.bankerWins} ({stats.bankerWinRate}%)</span>
                                    </div>
                                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${stats.bankerWinRate}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-green-300">Tie</span>
                                        <span className="text-white font-bold">{stats.ties} ({stats.tieRate}%)</span>
                                    </div>
                                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${stats.tieRate}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Streak Analysis */}
                        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                <TrendingUp size={20} /> Streak Analysis
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-slate-400 block mb-2">Current Streak</span>
                                    <div className="text-2xl font-bold">
                                        {stats.currentStreak.count > 0 ? (
                                            <span className={`${stats.currentStreak.type === 'player' ? 'text-blue-400' : stats.currentStreak.type === 'banker' ? 'text-red-400' : 'text-slate-400'}`}>
                                                {stats.currentStreak.count} hands ({stats.currentStreak.type.charAt(0).toUpperCase() + stats.currentStreak.type.slice(1)})
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">No data</span>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-slate-700 pt-4">
                                    <span className="text-slate-400 block mb-2">Longest Streak</span>
                                    <div className="text-2xl font-bold">
                                        {stats.longestStreak.count > 0 ? (
                                            <span className={`${stats.longestStreak.type === 'player' ? 'text-blue-400' : 'text-red-400'}`}>
                                                {stats.longestStreak.count} hands ({stats.longestStreak.type.charAt(0).toUpperCase() + stats.longestStreak.type.slice(1)})
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">No data</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Session Info & Averages */}
                        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                <History size={20} /> Session Info
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Total Hands</span>
                                    <span className="text-white font-bold text-xl">{stats.total}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Shoes Played</span>
                                    <span className="text-white font-bold text-xl">{stats.shoesPlayed}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Current Shoe</span>
                                    <span className="text-white font-bold text-xl">#{currentShoe}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Current Dealer</span>
                                    <span className="text-white font-bold text-xl">#{currentDealer}</span>
                                </div>
                                {parseFloat(stats.avgPlayerScore) > 0 && (
                                    <>
                                        <div className="border-t border-slate-700 pt-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-slate-400">Avg Player Score</span>
                                                <span className="text-blue-400 font-bold">{stats.avgPlayerScore}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">Avg Banker Score</span>
                                                <span className="text-red-400 font-bold">{stats.avgBankerScore}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Comparison to True Odds */}
                        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                <Target size={20} /> vs True Probability
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Player: Your {stats.playerWinRate}% vs 44.62%</span>
                                        <span className={parseFloat(stats.playerWinRate) > 44.62 ? 'text-green-400' : 'text-red-400'}>
                                            {(parseFloat(stats.playerWinRate) - 44.62).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600" style={{ width: `${Math.min(parseFloat(stats.playerWinRate), 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Banker: Your {stats.bankerWinRate}% vs 45.86%</span>
                                        <span className={parseFloat(stats.bankerWinRate) > 45.86 ? 'text-green-400' : 'text-red-400'}>
                                            {(parseFloat(stats.bankerWinRate) - 45.86).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-600" style={{ width: `${Math.min(parseFloat(stats.bankerWinRate), 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Tie: Your {stats.tieRate}% vs 9.52%</span>
                                        <span className={parseFloat(stats.tieRate) > 9.52 ? 'text-green-400' : 'text-red-400'}>
                                            {(parseFloat(stats.tieRate) - 9.52).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-600" style={{ width: `${Math.min(parseFloat(stats.tieRate), 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-500 text-xs mt-4">True probabilities based on 8 decks: Banker 45.86%, Player 44.62%, Tie 9.52%.</p>
                        </div>
                    </div>
                )}

                {/* Patterns Tab */}
                {activeTab === 'patterns' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Road Maps */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Bead Plate & Big Road */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Big Road */}
                                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                    <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                                        <Grid3x3 size={20} /> Big Road
                                    </h3>
                                    {bigRoad.length > 0 ? (
                                        <div className="bg-slate-900/80 p-4 rounded-lg overflow-x-auto">
                                            <div className="flex gap-1 inline-block">
                                                {bigRoad.map((column, colIdx) => (
                                                    <div key={colIdx} className="flex flex-col-reverse gap-1 min-h-[200px]">
                                                        {column.map((cell, cellIdx) => (
                                                            <div
                                                                key={cellIdx}
                                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${cell.winner === 'player'
                                                                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                                                    : 'border-red-500 text-red-400 bg-red-500/10'
                                                                    }`}
                                                            >
                                                                {cell.ties > 0 && (
                                                                    <span className="absolute text-xs font-mono text-green-400 -translate-x-3 translate-y-3">
                                                                        {cell.ties}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">
                                            No data yet
                                        </div>
                                    )}
                                    <p className="text-slate-400 text-xs mt-3"> Hollow circles represent wins. Columns show streaks. </p>
                                </div>
                                {/* Bead Plate */}
                                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                    <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                                        <Circle size={20} /> Bead Plate (Chronological)
                                    </h3>
                                    {beadPlate.some(row => row.some(cell => cell !== null)) ? (
                                        <div className="bg-slate-900/80 p-4 rounded-lg overflow-x-auto">
                                            <div className="inline-block">
                                                {beadPlate.map((row, rowIdx) => (
                                                    <div key={rowIdx} className="flex gap-1">
                                                        {row.map((cell, colIdx) => (
                                                            <div key={colIdx} className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${cell === null ? 'bg-slate-800/50 border border-slate-700' : cell.winner === 'player' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50' : cell.winner === 'banker' ? 'bg-red-600 text-white shadow-lg shadow-red-600/50' : 'bg-green-600 text-white shadow-lg shadow-green-600/50'
                                                                }`}
                                                            >
                                                                {cell && (cell.winner === 'player' ? 'P' : cell.winner === 'banker' ? 'B' : 'T')}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">
                                            No data yet
                                        </div>
                                    )}
                                    <p className="text-slate-400 text-xs mt-3"> Filled circles in reading order (top to bottom, left to right). </p>
                                </div>
                            </div>
                            {/* Derived Roads */}
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Brain size={20} /> Derived Road Analysis
                                </h3>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    {/* Big Eye Boy */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-3">Big Eye Boy</h4>
                                        {bigEyeBoy.length > 0 ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1">
                                                    {bigEyeBoy.map((column, colIdx) => (
                                                        <div key={colIdx} className="flex flex-col-reverse gap-1">
                                                            {column.map((cell, cellIdx) => (
                                                                <div key={cellIdx} className={`w-4 h-4 rounded-full border border-current transition-all hover:scale-125 ${cell === 'red' ? 'border-red-500 text-red-500/50' : 'border-blue-500 text-blue-500/50'
                                                                    }`} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/80 p-4 rounded-lg text-center text-slate-600 text-xs"> Need 2+ columns </div>
                                        )}
                                        <p className="text-slate-500 text-xs mt-2"> Starts 1 column after Big Road </p>
                                    </div>
                                    {/* Small Road */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-3">Small Road</h4>
                                        {smallRoad.length > 0 ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1">
                                                    {smallRoad.map((column, colIdx) => (
                                                        <div key={colIdx} className="flex flex-col-reverse gap-1">
                                                            {column.map((cell, cellIdx) => (
                                                                <div key={cellIdx} className={`w-4 h-4 rounded-full transition-all hover:scale-125 ${cell === 'red' ? 'bg-red-500/50' : 'bg-blue-500/50'
                                                                    }`} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/80 p-4 rounded-lg text-center text-slate-600 text-xs"> Need 3+ columns </div>
                                        )}
                                        <p className="text-slate-500 text-xs mt-2"> Skips 1 column vs Big Eye Boy </p>
                                    </div>
                                    {/* Cockroach Road */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-3">Cockroach Road</h4>
                                        {cockroachRoad.length > 0 ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1">
                                                    {cockroachRoad.map((column, colIdx) => (
                                                        <div key={colIdx} className="flex flex-col-reverse gap-1">
                                                            {column.map((cell, cellIdx) => (
                                                                <div key={cellIdx} className={`w-4 h-4 rounded-full transition-all hover:scale-125 ${cell === 'red' ? 'bg-red-500 shadow-md shadow-red-500/50' : 'bg-blue-500 shadow-md shadow-blue-500/50'
                                                                    }`} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/80 p-4 rounded-lg text-center text-slate-600 text-xs"> Need 4+ columns </div>
                                        )}
                                        <p className="text-slate-500 text-xs mt-2"> Skips 2 columns vs Big Eye Boy </p>
                                    </div>
                                </div>
                                <div className="mt-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                                    <p className="text-blue-300 text-sm"> <strong>How to read:</strong> Derived roads help predict next outcome patterns. Red circles suggest the shoe is following a predictable pattern, while blue circles indicate more chaotic/random results. </p>
                                </div>
                            </div>
                        </div>

                        {/* Pattern Analysis */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                                    <Brain size={24} /> Pattern Analysis
                                </h2>
                                {patterns.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {patterns.slice(0, 3).map((pattern, idx) => (
                                            <div key={idx} className="bg-slate-900/50 rounded-lg p-5 border border-slate-700 hover:border-blue-500/50 transition-all" >
                                                <div className="flex items-start justify-between mb-3">
                                                    <h3 className="text-lg font-bold text-white">{pattern.type}</h3>
                                                    <div className={`text-xl font-bold ${pattern.strength >= 70 ? 'text-green-400' : pattern.strength >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {pattern.strength.toFixed(0)}%
                                                    </div>
                                                </div>
                                                <p className="text-slate-400 text-sm">{pattern.description}</p>
                                                <div className="h-2 mt-3 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${pattern.strength}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">
                                        No clear patterns detected yet.
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-lg font-bold text-blue-400 mb-4">Understanding the Roads</h3>
                                <div className="space-y-4 text-sm">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-slate-900/50 rounded-lg p-4">
                                            <div className="font-bold text-white mb-2">Big Road</div>
                                            <p className="text-slate-400 mb-3">The primary pattern display showing actual game results in columns (streaks).</p>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-4">
                                            <div className="font-bold text-white mb-2">Bead Plate</div>
                                            <p className="text-slate-400 mb-3">Shows all results in chronological order, reading top to bottom, left to right.</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-700 pt-4">
                                        <div className="font-bold text-white mb-1">Derived Roads (B.E.B, Small, Cockroach)</div>
                                        <p className="text-slate-400">These roads display patterns based on the Big Road. Red = predictable trend, Blue = choppy/chaotic trend.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Prediction Tab */}
                {activeTab === 'prediction' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* LEFT COLUMN: Main Prediction & Next Pattern */}
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Prediction Result */}
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Brain size={20} /> Next Hand Prediction
                                </h3>
                                <div className="text-slate-400 text-sm mb-2">Most Likely Outcome:</div>
                                <div className={`text-6xl font-extrabold mb-4 capitalize ${prediction.prediction === 'player' ? 'text-blue-400' : prediction.prediction === 'banker' ? 'text-red-400' : 'text-slate-500'}`}>
                                    {prediction.prediction}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-slate-400">Confidence:</div>
                                    <div className="text-3xl font-bold text-yellow-400">{prediction.confidence}%</div>
                                </div>
                            </div>

                            {/* Predicted Pattern - Next 6 Hands (Visual Road) */}
                            <div className="bg-slate-900/50 rounded-lg p-6">
                                <div className="text-slate-400 text-sm mb-3 flex items-center gap-2">
                                    <Target size={16} /> Predicted Road (Next Hands)
                                </div>

                                {predictedRoad.length > 0 ? (
                                    <div className="bg-slate-900/80 p-4 rounded-lg overflow-x-auto h-[150px] flex items-end">
                                        <div className="flex gap-1 inline-block">
                                            {predictedRoad.map((column, colIdx) => (
                                                <div key={colIdx} className="flex flex-col-reverse gap-1 min-h-[100px]">
                                                    {column.map((cell, cellIdx) => (
                                                        <div
                                                            key={cellIdx}
                                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${cell.winner === 'player'
                                                                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                                                : cell.winner === 'banker'
                                                                    ? 'border-red-500 text-red-400 bg-red-500/10'
                                                                    : 'border-slate-500 text-slate-500 bg-slate-500/10' // 'unknown'
                                                                }`}
                                                        >
                                                            {cell.winner === 'player' ? 'P' : cell.winner === 'banker' ? 'B' : '?'}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">
                                        Prediction data required.
                                    </div>
                                )}

                                <div className="mt-4 text-center">
                                    <div className="inline-flex items-center gap-4 text-xs">
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full border-2 border-blue-500 text-blue-400 bg-blue-500/10"></div>
                                            <span className="text-slate-400">Player</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full border-2 border-red-500 text-red-400 bg-red-500/10"></div>
                                            <span className="text-slate-400">Banker</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-full border-2 border-slate-500 text-slate-500 bg-slate-500/10"></div>
                                            <span className="text-slate-400">Unknown</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Prediction Reason and Signals */}
                            <div className="md:col-span-2 bg-slate-900/50 rounded-lg p-6">
                                <div className="text-slate-400 text-sm mb-3 flex items-center gap-2">
                                    <TrendingUp size={16} /> Prediction Rationale
                                </div>
                                <p className="text-white font-semibold mb-3">{prediction.reason}</p>
                                {prediction.signals.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-blue-400 font-bold text-sm">Active Signals:</p>
                                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1 pl-4">
                                            {prediction.signals.map((signal, idx) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="text-blue-400">•</span>
                                                    <span>{signal}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Performance & Logic Info */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* PREDICTION PERFORMANCE CARD (Per Shoe) */}
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Activity size={20} />
                                    Prediction Performance (Current Shoe)
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Correct Count:</span>
                                        <span className="text-green-400 font-bold text-3xl">{stats.correctPredictions}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Total Predicted Hands:</span>
                                        <span className="text-white font-bold text-xl">{stats.totalPredictions}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-slate-700 pt-4">
                                        <span className="text-slate-400">Accuracy:</span>
                                        <span className={`font-bold text-2xl ${parseFloat(stats.predictionAccuracy) >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {stats.predictionAccuracy}%
                                        </span>
                                    </div>
                                    {stats.totalPredictions === 0 && (
                                        <p className="text-slate-500 text-sm mt-2">Start recording results to track prediction accuracy.</p>
                                    )}
                                </div>
                            </div>
                            {/* Prediction Logic Info */}
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Brain size={20} /> Prediction Logic
                                </h3>
                                <div className="text-slate-300 text-sm space-y-4">
                                    <p>The AI prediction is based on a combination of:</p>
                                    <ul className="list-disc list-inside text-slate-400 text-sm space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-400">•</span>
                                            <span>Road pattern detection (Zigzag, Dominance, etc.)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-400">•</span>
                                            <span>Current streak analysis and reversal anticipation</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-400">•</span>
                                            <span>Double and repeating patterns</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-400">•</span>
                                            <span>Statistical probability baselines</span>
                                        </li>
                                    </ul>
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="font-bold text-yellow-400 mb-1">Pattern Prediction Logic:</p>
                                        <p className="text-xs">Based on detected patterns, the AI generates a 6-hand forecast showing the most likely sequence of outcomes.</p>
                                    </div>
                                    <p className="pt-2 border-t border-slate-700">
                                        Remember: Baccarat outcomes are random. Predictions are for entertainment and tracking purposes only.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BaccaratRecorder;