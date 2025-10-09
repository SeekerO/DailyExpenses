/* eslint-disable @typescript-eslint/no-explicit-any */

import { google } from "googleapis";
import { NextResponse } from "next/server";

// --- Configuration ---
// Removed SHEET_ID from environment variables. It will now be read from the request.
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Only check for service account credentials now.
if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
  // NOTE: This will fail the app deployment if the variables are missing.
  // In a real scenario, you might want to handle this more gracefully.
  throw new Error("Missing Google Service Account environment variables.");
}
//aa
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: SERVICE_ACCOUNT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// sheets instance is created once, using the authenticated client
// The 'auth' object will be used for every request made via this 'sheets' instance.
const sheets = google.sheets({ version: "v4", auth });

// EXPENSE_RANGE for GET: Reads 6 columns (A:F), now including overall_money(F).
const EXPENSE_RANGE = "Sheet1!A:F";

// --- Type Definition for Sheet Data ---
interface ExpenseRecord {
  id: string;
  time_stamp: string;
  category: string;
  payment: string;
  expense: number;
  total: number;
  userId: string; // Keep this to satisfy the front-end interface
  // overall_money is read from F2 but not part of the expense rows
}

// Mapping is correct for reading 5 columns (A:E) from the sheet.
const mapSheetRowToExpense = (row: any[], index: number): ExpenseRecord => {
  // Column order: time_stamp(A), category(B), payment(C), expense(D), total(E)
  return {
    id: (index + 2).toString(),
    time_stamp: row[0], // A
    category: row[1], // B
    payment: row[2], // C
    expense: parseFloat(row[3]) || 0, // D
    total: parseFloat(row[4]) || 0, // E
    userId: "N/A", // Set default since it's not in the sheet
  };
};

/**
 * Handles GET requests to fetch all expense data and overall_money from the Google Sheet.
 * Sheet ID is now passed as a query parameter.
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
      spreadsheetId: SHEET_ID, // Use the ID from the query param
      range: EXPENSE_RANGE, // A:F
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      // Return empty array and 0 for overall_money if no data
      return NextResponse.json(
        { expenses: [], overallMoney: 0 },
        { status: 200 }
      );
    }

    // NEW: Extract overall_money from F2 (rows[1][5] assuming F is the 6th column, index 5)
    // The image shows 50649 in E2, but the header is 'overall_money' in F1.
    // I will assume overall_money is in F2 (rows[1][5]) for the new feature.
    // However, since EXPENSE_RANGE is A:F, rows[0] is the header.
    // The expense data starts at row 2 (index 1 in the array).
    // The value in F2 is at rows[1][5].
    const overallMoneyRaw = rows[1]?.[5] || 0;
    const overallMoney = parseFloat(overallMoneyRaw.toString()) || 0;

    // The first row is usually the header, so we slice it off.
    const expenseRows = rows.slice(1);

    // Filter out rows that might be empty due to range (A:F) extending past data
    const expenses: ExpenseRecord[] = expenseRows
      .filter((row) => row.length > 0 && row[0]) // Ensure row is not empty and time_stamp (A) exists
      .map(mapSheetRowToExpense);

    // Return both expenses and the overall_money
    return NextResponse.json({ expenses, overallMoney }, { status: 200 });
  } catch (error) {
    console.error("Google Sheets GET Error:", error);
    // Returning the error message to help with debugging
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
 * Handles POST requests to append a new expense row to the Google Sheet.
 * Sheet ID is now passed in the request body.
 */
export async function POST(request: Request) {
  try {
    const { sheetId, ...newExpense } = await request.json();

    if (!sheetId) {
      return NextResponse.json(
        { message: "Missing sheetId in request body." },
        { status: 400 }
      );
    }

    // Data array MUST match your sheet column order: [A, B, C, D]
    // The total (E) is calculated by a Google Sheet formula.
    const rowData = [
      newExpense.time_stamp,
      newExpense.category,
      newExpense.payment,
      newExpense.expense.toFixed(2),
      // REMOVED newExpense.total, as it's calculated by the sheet formula
      // Note: Column F (overall_money) is not modified by POST
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId, // Use the ID from the request body
      // Append range is A:D (4 columns)
      range: "Sheet1!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [rowData],
      },
    });

    if (
      response.data.updates?.updatedCells &&
      response.data.updates.updatedCells > 0
    ) {
      return NextResponse.json(
        { message: "Expense logged successfully." },
        { status: 201 }
      );
    } else {
      throw new Error("Append operation failed to update cells.");
    }
  } catch (error) {
    console.error("Google Sheets POST Error:", error);
    return NextResponse.json(
      {
        message: `Failed to log expense to Google Sheet. Error: ${
          (error as Error).message
        }`,
      },
      { status: 500 }
    );
  }
}

/**
 * NEW HANDLER: Handles PATCH requests to update the overall_money in cell F2.
 */
export async function PATCH(request: Request) {
  try {
    const { sheetId, overallMoney } = await request.json();

    if (!sheetId) {
      return NextResponse.json(
        { message: "Missing sheetId in request body." },
        { status: 400 }
      );
    }

    if (typeof overallMoney !== "number" || overallMoney < 0) {
      return NextResponse.json(
        { message: "Invalid overallMoney value." },
        { status: 400 }
      );
    }

    // The value to update (formatted as a string for Google Sheets)
    const value = overallMoney.toFixed(2);

    // Target range is the overall_money cell (F2)
    const range = "Sheet1!F2";

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: "USER_ENTERED", // Use USER_ENTERED to allow a number string
      requestBody: {
        values: [[value]], // Must be a 2D array: [[newValue]]
      },
    });

    if (response.data.updatedCells && response.data.updatedCells > 0) {
      return NextResponse.json(
        { message: "Overall money updated successfully." },
        { status: 200 }
      );
    } else {
      throw new Error("Update operation failed to modify cell F2.");
    }
  } catch (error) {
    console.error("Google Sheets PATCH Error:", error);
    return NextResponse.json(
      {
        message: `Failed to update overall money. Error: ${
          (error as Error).message
        }`,
      },
      { status: 500 }
    );
  }
}
