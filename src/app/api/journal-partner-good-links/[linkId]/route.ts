// File: src/app/api/journal-partner-good-links/[linkId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";

export async function GET(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ linkId: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const linkIdStr = resolvedParams.linkId; // Access linkId from the resolved object

  console.log(
    `Waiter (API /journal-partner-good-links/[linkId]): GET request for linkId: '${linkIdStr}'`
  );
  const linkId = parseBigIntParam(linkIdStr, "link ID");
  if (!linkId)
    return NextResponse.json(
      { message: "Invalid link ID format." },
      { status: 400 }
    );

  try {
    const link = await jpgLinkService.getLinkById(linkId);
    if (!link)
      return NextResponse.json(
        { message: `3-way link with ID '${linkId}' not found.` },
        { status: 404 }
      );
    const body = JSON.stringify(link, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { message: "Could not fetch 3-way link.", error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ linkId: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const linkIdStr = resolvedParams.linkId; // Access linkId from the resolved object

  console.log(
    `Waiter (API /journal-partner-good-links/[linkId]): DELETE request for linkId: '${linkIdStr}'`
  );
  const linkId = parseBigIntParam(linkIdStr, "link ID");
  if (!linkId)
    return NextResponse.json(
      { message: "Invalid link ID format." },
      { status: 400 }
    );

  try {
    const deletedLink = await jpgLinkService.deleteLinkById(linkId);
    if (!deletedLink)
      return NextResponse.json(
        { message: `3-way link ID '${linkId}' not found.` },
        { status: 404 }
      );
    return NextResponse.json({
      message: `3-way link ID '${linkId}' successfully deleted.`,
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { message: "Could not delete 3-way link.", error: e.message },
      { status: 500 }
    );
  }
}
