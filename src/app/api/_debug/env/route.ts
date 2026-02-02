import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    hasStrapiUrl: Boolean(process.env.STRAPI_URL),
    hasStrapiToken: Boolean(process.env.STRAPI_API_TOKEN ?? process.env.STRAPI_TOKEN),
  });
}
