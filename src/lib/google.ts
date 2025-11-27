import { google } from "googleapis";

const getAuth = () => {
  // Clean up environment variables
  // Remove surrounding quotes if they exist (common mistake when copying from .env)
  const client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^["']|["']$/g, "").trim();
  
  // Handle private key:
  // 1. Remove surrounding quotes
  // 2. Replace literal \n with actual newlines
  const private_key = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!client_email || !private_key) {
    throw new Error("Missing Google Service Account credentials");
  }

  // Log the email being used (helpful for debugging "account not found" errors)
  // We don't log the key for security
  console.log(`[Google Auth] Initializing with email: ${client_email}`);

  return new google.auth.GoogleAuth({
    credentials: {
      client_email,
      private_key,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
};

export async function getSheetData(spreadsheetId: string, range: string = "Sheet1!A:Z") {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
}

export async function getSheetTabs(spreadsheetId: string) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    return response.data.sheets?.map(sheet => ({
      title: sheet.properties?.title || "Untitled",
      sheetId: sheet.properties?.sheetId || 0,
    })) || [];
  } catch (error) {
    console.error("Error fetching sheet tabs:", error);
    throw error;
  }
}
