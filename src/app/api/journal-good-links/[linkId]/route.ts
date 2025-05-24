// File: src/app/api/journal-good-links/[linkId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import journalGoodLinkService from "@/app/services/journalGoodLinkService";
import { jsonBigIntReplacer, parseBigIntParam } from "@/app/utils/jsonBigInt";

export async function GET(
  _request: NextRequest, // You can use _request if request object isn't used in this specific handler
  { params: paramsPromise }: { params: Promise<{ linkId: string }> } // Type params as a Promise
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const linkIdStr = resolvedParams.linkId; // Access linkId from the resolved object

  console.log(
    `Waiter (API /journal-good-links/[linkId]): GET request for linkId: '${linkIdStr}'`
  );
  const linkId = parseBigIntParam(linkIdStr, "link ID");
  if (linkId === null) {
    return NextResponse.json(
      { message: "Invalid link ID format." },
      { status: 400 }
    );
  }

  try {
    const link = await journalGoodLinkService.getLinkById(linkId);
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
    `Waiter (API /journal-good-links/[linkId]): DELETE request for linkId: '${linkIdStr}'`
  );
  const linkId = parseBigIntParam(linkIdStr, "link ID");

  if (linkId === null) {
    return NextResponse.json(
      { message: `Invalid link ID format: '${linkIdStr}'.` },
      { status: 400 }
    );
  }

  try {
    const deletedLink = await journalGoodLinkService.deleteLinkById(linkId);
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
    return NextResponse.json(
      { message: "Chef couldn't delete link.", error: e.message },
      { status: 500 }
    );
  }
}
