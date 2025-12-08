// /page.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";
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
    Repeat,
} from "lucide-react";

type Winner = "player" | "banker" | "tie";
type GameResult = {
    id: string;
    winner: Winner;
    playerScore?: number;
    bankerScore?: number;
    timestamp: number;
    shoeNumber: number;
    dealerNumber: number;
    predictedWinner?: "player" | "banker";
    isCorrectPrediction?: boolean;
};

type Pattern = {
    type: string;
    description: string;
    strength: number;
};

const STORAGE_KEY = "baccaratResults";

const BaccaratRecorder: React.FC = () => {
    const [results, setResults] = useState<GameResult[]>([]);
    const [currentShoe, setCurrentShoe] = useState<number>(1);
    const [currentDealer, setCurrentDealer] = useState<number>(1);
    const [selectedResult, setSelectedResult] = useState<Winner | null>(null);
    const [playerScore, setPlayerScore] = useState<string>("");
    const [bankerScore, setBankerScore] = useState<string>("");
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<
        "recorder" | "stats" | "patterns" | "prediction"
    >("recorder");

    // Load on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                setResults(data.results || []);
                setCurrentShoe(data.currentShoe || 1);
                setCurrentDealer(data.currentDealer || 1);
            }
        } catch (e) {
            // ignore
        }
    }, []);

    // Save when results or shoe/dealer change
    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ results, currentShoe, currentDealer })
        );
    }, [results, currentShoe, currentDealer]);

    // helpers: get chronological (oldest → newest)

    const getChronological = (arr: any) => [...arr]; 

    // ---- Statistics ----
    const getStatistics = () => {
        if (results.length === 0) {
            return {
                total: 0,
                playerWins: 0,
                bankerWins: 0,
                ties: 0,
                playerWinRate: "0.0",
                bankerWinRate: "0.0",
                tieRate: "0.0",
                currentStreak: { type: "" as Winner | "", count: 0 },
                longestStreak: { type: "" as Winner | "", count: 0 },
                avgPlayerScore: "0.00",
                avgBankerScore: "0.00",
                shoesPlayed: 0,
                correctPredictions: 0,
                totalPredictions: 0,
                predictionAccuracy: "0.0",
            };
        }

        const total = results.length;
        const playerWins = results.filter((r) => r.winner === "player").length;
        const bankerWins = results.filter((r) => r.winner === "banker").length;
        const ties = results.filter((r) => r.winner === "tie").length;

        // Current streak: look from newest backwards (chronological reversed)
        const chronological = getChronological(results);
        let currentStreakType: Winner | null = null;
        let currentCount = 0;
        for (let i = chronological.length - 1; i >= 0; i--) {
            const r = chronological[i];
            if (r.winner === "tie") continue;
            if (!currentStreakType) {
                currentStreakType = r.winner;
                currentCount = 1;
            } else if (r.winner === currentStreakType) {
                currentCount++;
            } else {
                break;
            }
        }

        // Longest streak (scan chronologically)
        let longestStreak = { type: "" as Winner | "", count: 0 };
        let tempType: Winner | null = null;
        let tempCount = 0;
        for (const r of chronological) {
            if (r.winner === "tie") continue;
            if (!tempType) {
                tempType = r.winner;
                tempCount = 1;
            } else if (r.winner === tempType) {
                tempCount++;
            } else {
                if (tempCount > longestStreak.count) {
                    longestStreak = { type: tempType, count: tempCount };
                }
                tempType = r.winner;
                tempCount = 1;
            }
        }
        if (tempCount > longestStreak.count && tempType) {
            longestStreak = { type: tempType, count: tempCount };
        }

        // Averages
        const resultsWithScores = results.filter(
            (r) => typeof r.playerScore === "number" && typeof r.bankerScore === "number"
        );
        const avgPlayerScore =
            resultsWithScores.length > 0
                ? (
                    resultsWithScores.reduce((s, r) => s + (r.playerScore || 0), 0) /
                    resultsWithScores.length
                ).toFixed(2)
                : "0.00";
        const avgBankerScore =
            resultsWithScores.length > 0
                ? (
                    resultsWithScores.reduce((s, r) => s + (r.bankerScore || 0), 0) /
                    resultsWithScores.length
                ).toFixed(2)
                : "0.00";

        const shoesPlayed = new Set(results.map((r) => r.shoeNumber)).size;

        // Prediction performance per currentShoe
        const currentShoeResults = results.filter((r) => r.shoeNumber === currentShoe);
        const predictedHands = currentShoeResults.filter(
            (r) => r.predictedWinner !== undefined && r.winner !== "tie"
        );
        const correctPredictions = predictedHands.filter((r) => r.isCorrectPrediction).length;
        const totalPredictions = predictedHands.length;
        const predictionAccuracy =
            totalPredictions > 0
                ? ((correctPredictions / totalPredictions) * 100).toFixed(1)
                : "0.0";

        return {
            total,
            playerWins,
            bankerWins,
            ties,
            playerWinRate: ((playerWins / total) * 100).toFixed(1),
            bankerWinRate: ((bankerWins / total) * 100).toFixed(1),
            tieRate: ((ties / total) * 100).toFixed(1),
            currentStreak: {
                type: (currentStreakType as Winner) || "",
                count: currentCount,
            },
            longestStreak,
            avgPlayerScore,
            avgBankerScore,
            shoesPlayed,
            correctPredictions,
            totalPredictions,
            predictionAccuracy,
        };
    };

    // ---- Patterns (operate on chronological order) ----
    const detectPatterns = (): Pattern[] => {
        if (results.length < 6) {
            return [
                {
                    type: "Insufficient Data",
                    description: "Record at least 6 results to detect patterns",
                    strength: 0,
                },
            ];
        }
        const chronological = getChronological(results).filter((r) => r.winner !== "tie");
        const last10 = chronological.slice(-10);
        const patterns: Pattern[] = [];

        // Zigzag (alternating)
        let zigzag = 0;
        for (let i = 0; i < last10.length - 1; i++) {
            if (last10[i].winner !== last10[i + 1].winner) zigzag++;
        }
        const zigzagStrength = last10.length > 1 ? (zigzag / (last10.length - 1)) * 100 : 0;
        if (zigzagStrength >= 60) {
            patterns.push({
                type: "Zigzag Pattern",
                description: `Alternating pattern (${zigzag}/${last10.length - 1} alternations)`,
                strength: zigzagStrength,
            });
        }

        // Streak detection from chronological
        const stats = getStatistics();
        if (stats.currentStreak.count >= 3) {
            const type = stats.currentStreak.type || "";
            patterns.push({
                type: `${type.charAt(0).toUpperCase() + type.slice(1)} Streak`,
                description: `${stats.currentStreak.count} consecutive ${type} wins`,
                strength: Math.min(stats.currentStreak.count * 22, 100),
            });
        }

        // Dominance
        const recentPlayer = last10.filter((r) => r.winner === "player").length;
        const recentBanker = last10.filter((r) => r.winner === "banker").length;
        if (recentPlayer >= 7) {
            patterns.push({
                type: "Player Dominance",
                description: `Player winning ${recentPlayer} of last ${last10.length} hands`,
                strength: (recentPlayer / last10.length) * 100,
            });
        } else if (recentBanker >= 7) {
            patterns.push({
                type: "Banker Dominance",
                description: `Banker winning ${recentBanker} of last ${last10.length} hands`,
                strength: (recentBanker / last10.length) * 100,
            });
        }

        // Chop (balanced)
        const diff = Math.abs(recentPlayer - recentBanker);
        if (diff <= 2 && last10.length >= 8) {
            patterns.push({
                type: "Chop (Balanced)",
                description: `Nearly equal distribution: P${recentPlayer} vs B${recentBanker}`,
                strength: 70,
            });
        }

        // Double pattern (pairs)
        let doubleCount = 0;
        for (let i = 0; i < chronological.length - 1; i++) {
            if (chronological[i].winner === chronological[i + 1].winner) doubleCount++;
        }
        if (doubleCount >= 3) {
            patterns.push({
                type: "Double Pattern",
                description: `Pairs detected (${doubleCount} doubles)`,
                strength: (doubleCount / Math.max(1, chronological.length - 1)) * 100,
            });
        }

        if (patterns.length === 0) {
            patterns.push({
                type: "Random Distribution",
                description: "No clear patterns detected - results appear random",
                strength: 50,
            });
        }

        return patterns;
    };

    // ---- Prediction (uses chronological data properly) ----
    const getPrediction = () => {
        // Require at least 5 real (non-tie) hands
        const chronological = getChronological(results);
        const nonTieChron = chronological.filter((r) => r.winner !== "tie");
        if (nonTieChron.length < 5) {
            return {
                prediction: "Need More Data",
                confidence: 0,
                reason: "Record at least 5 P/B results for predictions",
                alternate: null,
                signals: [] as string[],
                nextPattern: [] as ("player" | "banker" | "unknown")[],
            };
        }

        const last10 = nonTieChron.slice(-10);
        const stats = getStatistics();
        const patterns = detectPatterns();

        let prediction: "player" | "banker" = "banker";
        let confidence = 46.0; // base banker edge
        let reason = "Baseline statistical probability";
        let alternate: "player" | "banker" | null = null;
        const signals: string[] = [];
        const nextPattern: ("player" | "banker" | "unknown")[] = [];

        // Zigzag strong
        const zigzag = patterns.find((p) => p.type === "Zigzag Pattern");
        if (zigzag && zigzag.strength > 60) {
            // If last result exists, next is opposite
            const lastWinner = nonTieChron[nonTieChron.length - 1].winner;
            prediction = lastWinner === "player" ? "banker" : "player";
            confidence = Math.min(zigzag.strength, 90);
            reason = "Strong zigzag pattern suggests alternation";
            signals.push("🔄 Zigzag active");
            // alternate pattern for next 6
            let cur = prediction;
            for (let i = 0; i < 6; i++) {
                nextPattern.push(cur);
                cur = cur === "player" ? "banker" : "player";
            }
        }
        // Long streak likely to break
        else if (stats.currentStreak.count >= 6) {
            prediction = stats.currentStreak.type === "player" ? "banker" : "player";
            confidence = Math.min(60 + stats.currentStreak.count * 2, 90);
            reason = `Long ${stats.currentStreak.type} streak likely to break`;
            signals.push(`⚠️ ${stats.currentStreak.count}-hand streak`);
            for (let i = 0; i < 4; i++) nextPattern.push(prediction);
            nextPattern.push("unknown");
            nextPattern.push("unknown");
        }
        // Short streak continuation
        else if (stats.currentStreak.count >= 3) {
            prediction = stats.currentStreak.type as "player" | "banker";
            confidence = Math.min(50 + stats.currentStreak.count * 6, 75);
            reason = `${stats.currentStreak.count}-hand streak may continue`;
            signals.push(`🔥 ${stats.currentStreak.count}-hand streak`);
            alternate = prediction === "player" ? "banker" : "player";
            for (let i = 0; i < 3; i++) nextPattern.push(prediction);
            for (let i = 0; i < 3; i++) nextPattern.push(alternate!);
        }
        // Dominance correction
        else if (last10.filter((r) => r.winner === "player").length >= 7) {
            prediction = "banker";
            confidence = 65;
            reason = "Player dominance suggests banker correction";
            signals.push("📊 Player dominance");
            for (let i = 0; i < 4; i++) nextPattern.push("banker");
            nextPattern.push("unknown");
            nextPattern.push("unknown");
        } else if (last10.filter((r) => r.winner === "banker").length >= 7) {
            prediction = "player";
            confidence = 65;
            reason = "Banker dominance suggests player correction";
            signals.push("📊 Banker dominance");
            for (let i = 0; i < 4; i++) nextPattern.push("player");
            nextPattern.push("unknown");
            nextPattern.push("unknown");
        }
        // Double pattern
        else if (patterns.find((p) => p.type === "Double Pattern")) {
            const lastWinner = nonTieChron[nonTieChron.length - 1].winner;
            // If last two are same maybe expect alternation, otherwise expect pair
            const secondLast = nonTieChron[nonTieChron.length - 2]?.winner;
            if (lastWinner === secondLast) {
                prediction = lastWinner === "player" ? "banker" : "player";
                confidence = 55;
                reason = "Double pattern suggests a switch after pairs";
                signals.push("👥 Double pattern");
                for (let i = 0; i < 2; i++) nextPattern.push(prediction);
                const opp = prediction === "player" ? "banker" : "player";
                for (let i = 0; i < 2; i++) nextPattern.push(opp);
                nextPattern.push("unknown");
                nextPattern.push("unknown");
            } else {
                prediction = lastWinner as "player" | "banker";
                confidence = 58;
                reason = "Double pattern suggests pair formation";
                signals.push("👥 Expecting pair completion");
                nextPattern.push(prediction);
                nextPattern.push(prediction);
                nextPattern.push(prediction === "player" ? "banker" : "player");
                nextPattern.push("unknown");
                nextPattern.push("unknown");
                nextPattern.push("unknown");
            }
        } else {
            // Default statistical balance: slight bias to banker historically
            const recentPlayer = last10.filter((r) => r.winner === "player").length;
            const recentBanker = last10.filter((r) => r.winner === "banker").length;
            if (recentPlayer < recentBanker) {
                prediction = "player";
                confidence = 48;
                reason = "Statistical rebalancing expected";
            } else {
                prediction = "banker";
                confidence = 46;
                reason = "Statistical baseline favors banker";
            }
            signals.push("📈 Statistical baseline");
            const pattern = ["banker", "player", "banker", "banker", "player", "player"];
            pattern.forEach((p) => nextPattern.push(p as "player" | "banker"));
        }

        while (nextPattern.length < 6) nextPattern.push("unknown");

        // add any strong pattern signals
        patterns.forEach((p) => {
            if (p.strength > 60 && !signals.some((s) => s.includes(p.type))) {
                signals.push(`🎯 ${p.type}`);
            }
        });

        return {
            prediction,
            confidence: Number(confidence.toFixed(1)),
            reason,
            alternate,
            signals,
            nextPattern: nextPattern.slice(0, 6),
        };
    };

    // ---- Road Generators (chronological -> render left-to-right oldest->newest columns) ----
    const generateBigRoad = () => {
        // Use results directly — do NOT reverse
        const ordered = results.filter((r) => r.winner !== "tie");

        const road: { winner: "player" | "banker"; ties: number }[][] = [];
        let currentColumn: { winner: "player" | "banker"; ties: number }[] = [];
        let lastWinner: "player" | "banker" | null = null;

        for (const r of ordered) {
            const winner = r.winner as "player" | "banker";

            // continue streak in same column
            if (lastWinner === winner || lastWinner === null) {
                currentColumn.push({ winner, ties: 0 });
            } else {
                // start new column
                if (currentColumn.length > 0) {
                    road.push([...currentColumn]);
                }
                currentColumn = [{ winner, ties: 0 }];
            }
            lastWinner = winner;
        }

        if (currentColumn.length > 0) {
            road.push(currentColumn);
        }

        return road.slice(-12); // keep last 12 columns
    };

    const generateBeadPlate = () => {
        const maxRows = 6;
        const maxCols = 12;
        const plate: (GameResult | null)[][] = Array.from({ length: maxRows }, () =>
            Array.from({ length: maxCols }, () => null)
        );

        const chronological = getChronological(results);
        // Fill left-to-right, top-to-bottom
        const recent = chronological.slice(-maxRows * maxCols);
        let col = 0;
        let row = 0;
        for (const r of recent) {
            plate[row][col] = r;
            row++;
            if (row >= maxRows) {
                row = 0;
                col++;
                if (col >= maxCols) break;
            }
        }
        return plate;
    };

    const generateDerivedRoad = (skipColumns: number) => {
        // Simplified derived roads using Big Road column lengths
        const bigRoad = generateBigRoad();
        if (bigRoad.length <= skipColumns) return [];
        const derived: ("red" | "blue")[][] = [];
        for (let i = skipColumns; i < bigRoad.length; i++) {
            const cur = bigRoad[i];
            const back = bigRoad[i - skipColumns];
            if (!cur || !back) continue;
            const column: ("red" | "blue")[] = [];
            for (let j = 0; j < cur.length; j++) {
                column.push(back.length === cur.length ? "red" : "blue");
            }
            derived.push(column);
        }
        return derived.slice(-12);
    };

    const generateBigEyeBoy = () => generateDerivedRoad(1);
    const generateSmallRoad = () => generateDerivedRoad(2);
    const generateCockroachRoad = () => generateDerivedRoad(3);

    // Predicted road builder (uses nextPattern array oldest->newest for the predicted sequence)
    const generatePredictedRoad = (
        nextPattern: ("player" | "banker" | "unknown")[]
    ) => {
        const road: { winner: "player" | "banker" | "unknown" }[][] = [];
        let currentColumn: { winner: "player" | "banker" | "unknown" }[] = [];
        let lastWinner: "player" | "banker" | null = null;

        for (const w of nextPattern) {
            if (w === "unknown") {
                // unknown always breaks columns for visibility
                if (currentColumn.length > 0) {
                    road.push([...currentColumn]);
                    currentColumn = [];
                }
                road.push([{ winner: "unknown" }]);
                lastWinner = null;
            } else {
                if (lastWinner === w || lastWinner === null) {
                    currentColumn.push({ winner: w });
                } else {
                    if (currentColumn.length > 0) road.push([...currentColumn]);
                    currentColumn = [{ winner: w }];
                }
                lastWinner = w;
            }
        }
        if (currentColumn.length > 0) road.push(currentColumn);
        return road;
    };

    // ---- Actions ----
    const addResult = () => {
        if (!selectedResult) {
            alert("Please select a winner!");
            return;
        }

        // compute prediction based on current collection BEFORE adding this result
        const currentPrediction = getPrediction();
        const predictedWinner =
            currentPrediction.prediction === "player" || currentPrediction.prediction === "banker"
                ? currentPrediction.prediction
                : undefined;
        const isCorrectPrediction =
            predictedWinner && selectedResult !== "tie" ? predictedWinner === selectedResult : undefined;

        const newResult: GameResult = {
            id: Date.now().toString(),
            winner: selectedResult,
            playerScore: playerScore ? parseInt(playerScore) : undefined,
            bankerScore: bankerScore ? parseInt(bankerScore) : undefined,
            timestamp: Date.now(),
            shoeNumber: currentShoe,
            dealerNumber: currentDealer,
            predictedWinner,
            isCorrectPrediction,
        };

        setResults((prev) => [...prev, newResult]); // store chronological as append (oldest -> newest)
        // Reset form
        setSelectedResult(null);
        setPlayerScore("");
        setBankerScore("");
    };

    const deleteResult = (id: string) => {
        setResults((prev) => prev.filter((r) => r.id !== id));
    };

    const clearAllResults = () => {
        if (confirm("Are you sure you want to clear all results?")) {
            setResults([]);
            setCurrentShoe(1);
            setCurrentDealer(1);
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const startNewShoe = () => setCurrentShoe((p) => p + 1);
    const changeDealer = () => setCurrentDealer((p) => p + 1);

    const exportData = () => {
        const dataStr = JSON.stringify({ results, currentShoe, currentDealer }, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `baccarat-results-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                setResults(data.results || []);
                setCurrentShoe(data.currentShoe || 1);
                setCurrentDealer(data.currentDealer || 1);
            } catch (err) {
                alert("Invalid file format: " + String(err));
            }
        };
        reader.readAsText(file);
    };

    // Derived states used in render
    const stats: any = getStatistics();
    const patterns = detectPatterns();
    const prediction = getPrediction();
    const bigRoad = generateBigRoad();
    const beadPlate = generateBeadPlate();
    const bigEyeBoy = generateBigEyeBoy();
    const smallRoad = generateSmallRoad();
    const cockroachRoad = generateCockroachRoad();
    const predictedRoad = generatePredictedRoad(prediction.nextPattern);

    // Render
    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-blue-500/30">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-blue-400 mb-1">Baccarat Analyzer</h1>
                            <p className="text-slate-300">Professional Results Tracker & Predictor</p>
                        </div>
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

                {/* Tabs */}
                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-2 mb-6 border border-blue-500/30">
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: "recorder", label: "Recorder", icon: PlusCircle },
                            { id: "stats", label: "Statistics", icon: BarChart3 },
                            { id: "patterns", label: "Patterns", icon: Grid3x3 },
                            { id: "prediction", label: "Prediction", icon: Brain },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-3 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${activeTab === tab.id ? "bg-blue-600 text-white" : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recorder Tab */}
                {activeTab === "recorder" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Input */}
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
                                                onClick={() => setSelectedResult("player")}
                                                className={`py-4 rounded-lg font-bold transition ${selectedResult === "player"
                                                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                                    }`}
                                            >
                                                Player
                                            </button>
                                            <button
                                                onClick={() => setSelectedResult("banker")}
                                                className={`py-4 rounded-lg font-bold transition ${selectedResult === "banker"
                                                    ? "bg-red-600 text-white ring-2 ring-red-400"
                                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                                    }`}
                                            >
                                                Banker
                                            </button>
                                            <button
                                                onClick={() => setSelectedResult("tie")}
                                                className={`py-4 rounded-lg font-bold transition ${selectedResult === "tie"
                                                    ? "bg-green-600 text-white ring-2 ring-green-400"
                                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
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
                                            {showAdvanced ? "− Hide" : "+ Show"} Optional Scores
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
                                            <input type="file" accept=".json" onChange={importData} className="hidden" />
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

                                {/* Big Road */}
                                {results.length > 0 && (
                                    <div className="mb-6 bg-slate-900/50 p-4 rounded-lg">
                                        <h3 className="text-sm font-bold text-slate-400 mb-3">Big Road</h3>
                                        <div className="overflow-x-auto w-full max-w-full pb-2">
                                            <div className="flex gap-1">
                                                {bigRoad.map((column, colIdx) => (
                                                    <div key={colIdx} className="flex flex-col-reverse gap-1">
                                                        {column.map((cell, cellIdx) => (
                                                            <div
                                                                key={cellIdx}
                                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${cell.winner === "player"
                                                                    ? "border-blue-500 text-blue-400 bg-blue-500/10"
                                                                    : "border-red-500 text-red-400 bg-red-500/10"
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
                                        <p className="text-slate-400 text-xs mt-3"> Hollow circles represent wins. Columns show streaks. </p>
                                    </div>
                                )}

                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {results.length === 0 ? (
                                        <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">
                                            <AlertCircle size={24} className="mx-auto mb-2" />
                                            <p>Start recording results to see statistics and predictions</p>
                                        </div>
                                    ) : (
                                        // Show newest first
                                        [...results].slice().reverse().map((result, idx) => (
                                            <div
                                                key={result.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border ${result.winner === "player" ? "bg-blue-900/20 border-blue-500/30" : result.winner === "banker" ? "bg-red-900/20 border-red-500/30" : "bg-green-900/20 border-green-500/30"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-slate-500 font-mono text-sm w-8">#{results.length - idx}</div>
                                                    <div className={`px-3 py-1 rounded font-bold text-sm ${result.winner === "player" ? "bg-blue-600 text-white" : result.winner === "banker" ? "bg-red-600 text-white" : "bg-green-600 text-white"
                                                        }`}>
                                                        {result.winner.toUpperCase()}
                                                    </div>

                                                    {result.predictedWinner && result.winner !== "tie" && (
                                                        <div className={`text-sm flex items-center gap-1 ${result.isCorrectPrediction ? "text-green-400" : "text-yellow-400"}`}>
                                                            {result.isCorrectPrediction ? "✓" : "✗"} Pred: {result.predictedWinner === "player" ? "P" : "B"}
                                                        </div>
                                                    )}

                                                    {typeof result.playerScore === "number" && typeof result.bankerScore === "number" && (
                                                        <div className="text-slate-300 text-sm">
                                                            P: {result.playerScore} - B: {result.bankerScore}
                                                        </div>
                                                    )}

                                                    <div className="text-slate-500 text-xs flex gap-2 items-center">
                                                        <span>Shoe #{result.shoeNumber}</span>
                                                        <span className="text-yellow-400">| Dealer #{result.dealerNumber}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteResult(result.id)} className="text-red-400 hover:text-red-300 transition">
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

                {/* Stats Tab */}
                {activeTab === "stats" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${Math.min(Number(stats.playerWinRate), 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-red-300">Banker</span>
                                        <span className="text-white font-bold">{stats.bankerWins} ({stats.bankerWinRate}%)</span>
                                    </div>
                                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${Math.min(Number(stats.bankerWinRate), 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-green-300">Tie</span>
                                        <span className="text-white font-bold">{stats.ties} ({stats.tieRate}%)</span>
                                    </div>
                                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${Math.min(Number(stats.tieRate), 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                <TrendingUp size={20} /> Streak Analysis
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-slate-400 block mb-2">Current Streak</span>
                                    <div className="text-2xl font-bold">
                                        {stats.currentStreak.count > 0 ? (
                                            <span className={`${stats.currentStreak.type === "player" ? "text-blue-400" : stats.currentStreak.type === "banker" ? "text-red-400" : "text-slate-400"}`}>
                                                {stats.currentStreak.count} hands ({stats.currentStreak.type})
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
                                            <span className={`${stats.longestStreak.type === "player" ? "text-blue-400" : "text-red-400"}`}>
                                                {stats.longestStreak.count} hands ({stats.longestStreak.type})
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">No data</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                {Number(stats.avgPlayerScore) > 0 && (
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

                        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                <Target size={20} /> vs True Probability
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Player: Your {stats.playerWinRate}% vs 44.62%</span>
                                        <span className={Number(stats.playerWinRate) > 44.62 ? "text-green-400" : "text-red-400"}>
                                            {(Number(stats.playerWinRate) - 44.62).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600" style={{ width: `${Math.min(Number(stats.playerWinRate), 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Banker: Your {stats.bankerWinRate}% vs 45.86%</span>
                                        <span className={Number(stats.bankerWinRate) > 45.86 ? "text-green-400" : "text-red-400"}>
                                            {(Number(stats.bankerWinRate) - 45.86).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-600" style={{ width: `${Math.min(Number(stats.bankerWinRate), 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Tie: Your {stats.tieRate}% vs 9.52%</span>
                                        <span className={Number(stats.tieRate) > 9.52 ? "text-green-400" : "text-red-400"}>
                                            {(Number(stats.tieRate) - 9.52).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-600" style={{ width: `${Math.min(Number(stats.tieRate), 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-500 text-xs mt-4">True probabilities based on 8 decks: Banker 45.86%, Player 44.62%, Tie 9.52%.</p>
                        </div>
                    </div>
                )}

                {/* Patterns Tab */}
                {activeTab === "patterns" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                    <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                                        <Grid3x3 size={20} /> Big Road
                                    </h3>
                                    {bigRoad.length > 0 ? (
                                        <div className="bg-slate-900/80 p-4 rounded-lg overflow-x-auto">
                                            <div className="flex gap-1">
                                                {bigRoad.map((column, colIdx) => (
                                                    <div key={colIdx} className="flex flex-col-reverse gap-1 min-h-[200px]">
                                                        {column.map((cell, cellIdx) => (
                                                            <div
                                                                key={cellIdx}
                                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${cell.winner === "player"
                                                                    ? "border-blue-500 text-blue-400 bg-blue-500/10"
                                                                    : "border-red-500 text-red-400 bg-red-500/10"
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">No data yet</div>
                                    )}
                                    <p className="text-slate-400 text-xs mt-3"> Hollow circles represent wins. Columns show streaks. </p>
                                </div>

                                <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                    <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                                        <Circle size={20} /> Bead Plate (Chronological)
                                    </h3>
                                    {beadPlate.some((row) => row.some((c) => c !== null)) ? (
                                        <div className="bg-slate-900/80 p-4 rounded-lg overflow-x-auto">
                                            <div className="inline-block">
                                                {beadPlate.map((row, rowIdx) => (
                                                    <div key={rowIdx} className="flex gap-1">
                                                        {row.map((cell, colIdx) => (
                                                            <div
                                                                key={colIdx}
                                                                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${cell === null ? "bg-slate-800/50 border border-slate-700" : cell.winner === "player" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50" : cell.winner === "banker" ? "bg-red-600 text-white shadow-lg shadow-red-600/50" : "bg-green-600 text-white shadow-lg shadow-green-600/50"
                                                                    }`}
                                                            >
                                                                {cell && (cell.winner === "player" ? "P" : cell.winner === "banker" ? "B" : "T")}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">No data yet</div>
                                    )}
                                    <p className="text-slate-400 text-xs mt-3"> Filled circles in reading order (top to bottom, left to right). </p>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Brain size={20} /> Derived Road Analysis
                                </h3>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-3">Big Eye Boy</h4>
                                        {bigEyeBoy.length > 0 ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1">
                                                    {bigEyeBoy.map((col, i) => (
                                                        <div key={i} className="flex flex-col-reverse gap-1">
                                                            {col.map((c, j) => (
                                                                <div key={j} className={`w-4 h-4 rounded-full border border-current transition-all hover:scale-125 ${c === "red" ? "border-red-500 text-red-500/50" : "border-blue-500 text-blue-500/50"}`} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/80 p-4 rounded-lg text-center text-slate-600 text-xs">Need 2+ columns</div>
                                        )}
                                        <p className="text-slate-500 text-xs mt-2"> Starts 1 column after Big Road </p>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-3">Small Road</h4>
                                        {smallRoad.length > 0 ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1">
                                                    {smallRoad.map((col, i) => (
                                                        <div key={i} className="flex flex-col-reverse gap-1">
                                                            {col.map((c, j) => (
                                                                <div key={j} className={`w-4 h-4 rounded-full transition-all hover:scale-125 ${c === "red" ? "bg-red-500/50" : "bg-blue-500/50"}`} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/80 p-4 rounded-lg text-center text-slate-600 text-xs">Need 3+ columns</div>
                                        )}
                                        <p className="text-slate-500 text-xs mt-2"> Skips 1 column vs Big Eye Boy </p>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-3">Cockroach Road</h4>
                                        {cockroachRoad.length > 0 ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1">
                                                    {cockroachRoad.map((col, i) => (
                                                        <div key={i} className="flex flex-col-reverse gap-1">
                                                            {col.map((c, j) => (
                                                                <div key={j} className={`w-4 h-4 rounded-full transition-all hover:scale-125 ${c === "red" ? "bg-red-500 shadow-md shadow-red-500/50" : "bg-blue-500 shadow-md shadow-blue-500/50"}`} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/80 p-4 rounded-lg text-center text-slate-600 text-xs">Need 4+ columns</div>
                                        )}
                                        <p className="text-slate-500 text-xs mt-2"> Skips 2 columns vs Big Eye Boy </p>
                                    </div>
                                </div>

                                <div className="mt-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                                    <p className="text-blue-300 text-sm"> <strong>How to read:</strong> Derived roads help predict next outcome patterns. Red circles suggest the shoe is following a predictable pattern, while blue circles indicate more chaotic/random results. </p>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                                    <Brain size={24} /> Pattern Analysis
                                </h2>
                                {patterns.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {patterns.slice(0, 3).map((p, i) => (
                                            <div key={i} className="bg-slate-900/50 rounded-lg p-5 border border-slate-700 hover:border-blue-500/50 transition-all">
                                                <div className="flex items-start justify-between mb-3">
                                                    <h3 className="text-lg font-bold text-white">{p.type}</h3>
                                                    <div className={`text-xl font-bold ${p.strength >= 70 ? "text-green-400" : p.strength >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                                                        {p.strength.toFixed(0)}%
                                                    </div>
                                                </div>
                                                <p className="text-slate-400 text-sm">{p.description}</p>
                                                <div className="h-2 mt-3 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${p.strength}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">No clear patterns detected yet.</div>
                                )}
                            </div>

                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-lg font-bold text-blue-400 mb-4">Understanding the Roads</h3>
                                <div className="space-y-4 text-sm">
                                    <div className="bg-slate-900/50 rounded-lg p-4">
                                        <div className="font-bold text-white mb-2">Big Road</div>
                                        <p className="text-slate-400 mb-3">The primary pattern display showing actual game results in columns (streaks).</p>
                                    </div>
                                    <div className="bg-slate-900/50 rounded-lg p-4">
                                        <div className="font-bold text-white mb-2">Bead Plate</div>
                                        <p className="text-slate-400 mb-3">Shows all results in chronological order, reading top to bottom, left to right.</p>
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
                {activeTab === "prediction" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Brain size={20} /> Next Hand Prediction
                                </h3>
                                <div className="text-slate-400 text-sm mb-2">Most Likely Outcome:</div>
                                <div className={`text-6xl font-extrabold mb-4 capitalize ${prediction.prediction === "player" ? "text-blue-400" : prediction.prediction === "banker" ? "text-red-400" : "text-slate-500"}`}>
                                    {String(prediction.prediction)}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-slate-400">Confidence:</div>
                                    <div className="text-3xl font-bold text-yellow-400">{prediction.confidence}%</div>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 rounded-lg p-6">
                                <div className="text-slate-400 text-sm mb-3 flex items-center gap-2">
                                    <Target size={16} /> Predicted Road (Next Hands)
                                </div>

                                {predictedRoad.length > 0 ? (
                                    <div className="bg-slate-900/80 p-4 rounded-lg overflow-x-auto h-[150px] flex items-end">
                                        <div className="flex gap-1 ">
                                            {predictedRoad.map((column, colIdx) => (
                                                <div key={colIdx} className="flex flex-col-reverse gap-1 min-h-[100px]">
                                                    {column.map((cell, cellIdx) => (
                                                        <div
                                                            key={cellIdx}
                                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all hover:scale-110 ${cell.winner === "player"
                                                                ? "border-blue-500 text-blue-400 bg-blue-500/10"
                                                                : cell.winner === "banker"
                                                                    ? "border-red-500 text-red-400 bg-red-500/10"
                                                                    : "border-slate-500 text-slate-500 bg-slate-500/10"
                                                                }`}
                                                        >
                                                            {cell.winner === "player" ? "P" : cell.winner === "banker" ? "B" : "?"}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-900/80 p-8 rounded-lg text-center text-slate-500">Prediction data required.</div>
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

                            <div className="md:col-span-2 bg-slate-900/50 rounded-lg p-6">
                                <div className="text-slate-400 text-sm mb-3 flex items-center gap-2">
                                    <TrendingUp size={16} /> Prediction Rationale
                                </div>
                                <p className="text-white font-semibold mb-3">{prediction.reason}</p>
                                {prediction.signals.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-blue-400 font-bold text-sm">Active Signals:</p>
                                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1 pl-4">
                                            {prediction.signals.map((s, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="text-blue-400">•</span>
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-1 space-y-6">
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
                                        <span className={`font-bold text-2xl ${Number(stats.predictionAccuracy) >= 50 ? "text-green-400" : "text-yellow-400"}`}>
                                            {stats.predictionAccuracy}%
                                        </span>
                                    </div>
                                    {stats.totalPredictions === 0 && (
                                        <p className="text-slate-500 text-sm mt-2">Start recording results to track prediction accuracy.</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-blue-500/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                                    <Brain size={20} /> Prediction Logic
                                </h3>
                                <div className="text-slate-300 text-sm space-y-4">
                                    <p>The AI prediction is based on a combination of:</p>
                                    <ul className="list-disc list-inside text-slate-400 text-sm space-y-2">
                                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span><span>Road pattern detection (Zigzag, Dominance, etc.)</span></li>
                                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span><span>Current streak analysis and reversal anticipation</span></li>
                                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span><span>Double and repeating patterns</span></li>
                                        <li className="flex items-start gap-2"><span className="text-blue-400">•</span><span>Statistical probability baselines</span></li>
                                    </ul>
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="font-bold text-yellow-400 mb-1">Pattern Prediction Logic:</p>
                                        <p className="text-xs">Based on detected patterns, the AI generates a 6-hand forecast showing the most likely sequence of outcomes.</p>
                                    </div>
                                    <p className="pt-2 border-t border-slate-700">Remember: Baccarat outcomes are random. Predictions are for entertainment and tracking purposes only.</p>
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
