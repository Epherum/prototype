// File: src/app/api/journal-partner-links/[linkId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";

export async function GET(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ linkId: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const linkIdStr = resolvedParams.linkId; // Access linkId from the resolved object

  console.log(`Waiter (API /jpl/[id]): GET request for linkId: '${linkIdStr}'`);

  const linkId = parseBigIntParam(linkIdStr, "link ID"); // Use the string version

  if (linkId === null) {
    // Check if parsing failed
    return NextResponse.json(
      { message: "Invalid link ID format." },
      { status: 400 }
    );
  }

  console.log(`Waiter (API /jpl/[id]): Parsed linkId to BigInt: ${linkId}`);

  try {
    const link = await journalPartnerLinkService.getLinkById(linkId); // Pass the BigInt
    if (!link) {
      return NextResponse.json(
        { message: `Link with ID '${linkId}' not found.` },
        { status: 404 }
      );
    }
    const body = JSON.stringify(link, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error("Error in GET /jpl/[id]:", e);
    return NextResponse.json(
      { message: "Could not fetch link.", error: e.message },
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
    `Waiter (API /jpl/[id]): DELETE request for link ID '${linkIdStr}'`
  );
  const linkId = parseBigIntParam(linkIdStr, "link ID");

  if (linkId === null) {
    // Check if parsing failed
    return NextResponse.json(
      { message: "Invalid link ID format." },
      { status: 400 }
    );
  }

  console.log(
    `Waiter (API /jpl/[id]): Parsed linkId for DELETE to BigInt: ${linkId}`
  );

  try {
    const deletedLink = await journalPartnerLinkService.deleteLinkById(linkId); // Pass the BigInt
    if (!deletedLink) {
      return NextResponse.json(
        { message: `Link with ID '${linkId}' not found for deletion.` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      message: `Link with ID '${linkId}' successfully deleted.`,
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      `Waiter (API /jpl/[id]): Chef error deleting link '${linkId}':`,
      e.message
    );
    return NextResponse.json(
      { message: "Chef couldn't delete link.", error: e.message },
      { status: 500 }
    );
  }
}
