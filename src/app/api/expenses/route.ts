// route.ts (FIXED to support F2, G2, H2 Balances)

/* eslint-disable @typescript-eslint/no-explicit-any */

import { google } from "googleapis";
import { NextResponse } from "next/server";

// --- Configuration ---
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
  throw new Error("Missing Google Service Account environment variables.");
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: SERVICE_ACCOUNT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// FIXED: EXPENSE_RANGE for GET: Reads A:H to include Cash (F2), Credit (G2), and Debit (H2)
const EXPENSE_RANGE = "Sheet1!A:H";

// --- Type Definition for Sheet Data ---
interface ExpenseRecord {
  id: string;
  time_stamp: string;
  category: string;
  payment: string;
  expense: number;
  total: number;
  userId: string;
}

const mapSheetRowToExpense = (row: any[], index: number): ExpenseRecord => {
  return {
    id: (index + 2).toString(),
    time_stamp: row[0],
    category: row[1],
    payment: row[2],
    expense: parseFloat(row[3]) || 0,
    total: parseFloat(row[4]) || 0,
    userId: "N/A",
  };
};

/**
 * Handles GET requests to fetch all expense data, cashBalance (F2), credit (G2), and debit (H2).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const SHEET_ID = searchParams.get("sheetId");

    if (!SHEET_ID) {
      return NextResponse.json(
        { message: "Missing sheetId query parameter." },
        { status: 400 }
      );
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: EXPENSE_RANGE, // A:H
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        {
          expenses: [],
          overallMoney: 0,
          creditBalance: 0,
          debitBalance: 0,
          totalExpense: 0,
        },
        { status: 200 }
      );
    }

    // Row 2 (index 1) contains the balance data:
    const overallMoneyRaw = rows[1]?.[5] || 0; // F2 (Cash Balance)
    const creditBalanceRaw = rows[1]?.[6] || 0; // G2 (Credit Balance)
    const debitBalanceRaw = rows[1]?.[7] || 0; // H2 (Debit Balance)
    const totalExpenseRaw = rows[1]?.[4] || 0; // E2 (Total Expense)

    const overallMoney = parseFloat(overallMoneyRaw.toString()) || 0;
    const creditBalance = parseFloat(creditBalanceRaw.toString()) || 0;
    const debitBalance = parseFloat(debitBalanceRaw.toString()) || 0;
    const totalExpense = parseFloat(totalExpenseRaw.toString()) || 0;

    const expenseRows = rows.slice(1);

    const expenses: ExpenseRecord[] = expenseRows
      .filter((row) => row.length > 0 && row[0])
      .map(mapSheetRowToExpense);

    // FIXED: Return all three balances
    return NextResponse.json(
      { expenses, overallMoney, totalExpense, creditBalance, debitBalance },
      { status: 200 }
    );
  } catch (error) {
    console.error("Google Sheets GET Error:", error);
    return NextResponse.json(
      {
        message:
          "Failed to fetch data from Google Sheet API. Check server logs.",
      },
      { status: 500 }
    );
  }
}

/**
 * Handles POST requests to append a new transaction (expense or income) to the Google Sheet.
 */
export async function POST(request: Request) {
  try {
    const { sheetId, time_stamp, category, payment, expense } =
      await request.json();

    if (!sheetId) {
      return NextResponse.json(
        { message: "Missing sheetId in request body." },
        { status: 400 }
      );
    }

    const amount = expense;

    // Data array MUST match your sheet column order: [A, B, C, D]
    const values = [[time_stamp, category, payment, amount.toFixed(2)]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: values,
      },
    });

    if (
      response.data.updates?.updatedCells &&
      response.data.updates.updatedCells > 0
    ) {
      return NextResponse.json(
        {
          message: "Transaction saved successfully.",
          appended: response.data.updates.updatedRange,
        },
        { status: 200 }
      );
    } else {
      throw new Error("Append operation failed to modify the sheet.");
    }
  } catch (error) {
    console.error("Google Sheets POST Error:", error);
    return NextResponse.json(
      { message: `Failed to save transaction: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * FIXED: Handles PATCH requests to update Cash (F2), Credit (G2), or Debit (H2) Balances.
 * It now accepts a generic cellReference.
 */
export async function PATCH(request: Request) {
  try {
    // Expects: { sheetId, newBalance, cellReference: 'F2' | 'G2' | 'H2' }
    const { sheetId, newBalance, cellReference } = await request.json();

    if (!sheetId) {
      return NextResponse.json(
        { message: "Missing sheetId in request body." },
        { status: 400 }
      );
    }

    if (typeof newBalance !== "number") {
      return NextResponse.json(
        { message: "Invalid newBalance value. Must be a number." },
        { status: 400 }
      );
    }

    // Validation for F2, G2, H2
    const validCells = ["F2", "G2", "H2"];
    if (!validCells.includes(cellReference)) {
      return NextResponse.json(
        { message: "Invalid cellReference. Must be F2, G2, or H2." },
        { status: 400 }
      );
    }

    const value = newBalance.toFixed(2);
    const range = `Sheet1!${cellReference}`; // Use the passed cell reference

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[value]],
      },
    });

    if (response.data.updatedCells && response.data.updatedCells > 0) {
      return NextResponse.json(
        { message: `${cellReference} updated successfully.` },
        { status: 200 }
      );
    } else {
      throw new Error(
        `Update operation failed to modify cell ${cellReference}.`
      );
    }
  } catch (error) {
    console.error("Google Sheets PATCH Error:", error);
    return NextResponse.json(
      { message: `Failed to update balance: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
