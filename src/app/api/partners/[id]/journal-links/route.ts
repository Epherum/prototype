// File: src/app/api/partners/[id]/journal-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import journalPartnerLinkService from "@/app/services/journalPartnerLinkService"; // Adjust path if needed
import { parseBigIntParam, jsonBigIntReplacer } from "@/app/utils/jsonBigInt"; // Adjust path if needed
import type { JournalPartnerLink, Journal } from "@prisma/client"; // Import Prisma types

// Define a type for the response we want to send to the client
interface JournalLinkWithDetailsClientResponse {
  id: string; // JournalPartnerLink.id
  partnerId: string; // Partner.id
  journalId: string; // Journal.id
  journalName?: string;
  journalCode?: string;
  linkedAt?: string | null;
  partnershipType?: string | null;
  exoneration?: boolean | null;
  periodType?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  documentReference?: string | null;
}

// Type for the service return when journal is included
type JournalPartnerLinkWithJournal = JournalPartnerLink & {
  journal?: Journal & { code?: string };
}; // Added Journal.code as optional

export async function GET(
  _request: NextRequest,
  // Ensure this matches your folder structure. If your folder is `[id]`, this is correct.
  // If your folder was actually `[partnerId]`, then it should be { params: Promise<{ partnerId: string }> }
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  // Use `resolvedParams.id` because your folder is `[id]`
  const partnerIdStr = resolvedParams.id;

  console.log(
    `API Handler: GET /api/partners/[id]/journal-links. Received dynamic segment (id) as: "${partnerIdStr}"`
  );

  if (!partnerIdStr) {
    console.error(
      "API Handler: Partner ID string (from route parameter 'id') is undefined or empty."
    );
    return NextResponse.json(
      { message: "Partner ID is missing in the request path." },
      { status: 400 }
    );
  }

  const partnerIdBigInt = parseBigIntParam(partnerIdStr, "partner ID");
  if (partnerIdBigInt === null) {
    console.error(
      `API Handler: parseBigIntParam returned null for partnerIdStr: "${partnerIdStr}". This means it's not a valid BigInt string.`
    );
    return NextResponse.json(
      {
        message: `Invalid Partner ID format: "${partnerIdStr}" could not be parsed as a valid ID.`,
      },
      { status: 400 }
    );
  }

  try {
    const linksFromService = await journalPartnerLinkService.getLinksForPartner(
      partnerIdBigInt
    );

    // It's good practice to check if linksFromService is null or undefined
    if (!linksFromService) {
      console.warn(
        `API Handler: journalPartnerLinkService.getLinksForPartner returned null/undefined for partner ID ${partnerIdBigInt}`
      );
      return NextResponse.json([], { status: 200 }); // Return empty array or appropriate response
    }

    if (linksFromService.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const clientResponse: JournalLinkWithDetailsClientResponse[] =
      linksFromService.map((link: JournalPartnerLinkWithJournal) => {
        const journalDetails = link.journal;

        return {
          id: String(link.id), // This is the JournalPartnerLink.id, used for unlinking
          partnerId: String(link.partnerId), // CORRECTED: Was String(link.id), should be Partner's ID
          journalId: String(link.journalId),
          journalName: journalDetails?.name,
          // IMPROVED: Use journal.code if available, fallback to journal.id
          journalCode: journalDetails?.code
            ? String(journalDetails.code)
            : String(journalDetails?.id || link.journalId),
          partnershipType: link.partnershipType,
          exoneration: link.exoneration,
          periodType: link.periodType,
          dateDebut: link.dateDebut?.toISOString() || null,
          dateFin: link.dateFin?.toISOString() || null,
          documentReference: link.documentReference,
          // linkedAt: link.createdAt?.toISOString() || null; // If you use createdAt for this
        };
      });

    const body = JSON.stringify(clientResponse, jsonBigIntReplacer);
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      `API Handler Error: GET /api/partners/${partnerIdStr}/journal-links:`,
      e.message,
      e.stack // Log stack for more details
    );
    return NextResponse.json(
      { message: "Could not fetch links for partner.", error: e.message },
      { status: 500 }
    );
  }
}
