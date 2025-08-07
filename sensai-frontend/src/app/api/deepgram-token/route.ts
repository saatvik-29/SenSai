import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

export async function GET() {
  try {
    // Ensure API key is available
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Deepgram API key" }, { status: 500 });
    }

    const dg = createClient(apiKey);
    const { result, error } = await dg.auth.grantToken();

    // Handle Deepgram API errors
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const access_token = result.access_token;
    return NextResponse.json({ token: access_token });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch token" }, { status: 500 });
  }
}
