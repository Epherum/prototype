// src/app/api/goods/[id]/journal-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/utils/prisma"; // Assuming direct Prisma client usage here
import { parseBigIntParam, jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import type { JournalGoodLinkWithDetails } from "@/lib/types"; // Import your client-side type

export async function GET(
  _request: NextRequest,
  // Corrected typing for params as a Promise, which you found necessary
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  const goodIdStr = resolvedParams.id;

  console.log(
    `API GET /api/goods/${goodIdStr}/journal-links: Request received.`
  );

  if (!goodIdStr) {
    return NextResponse.json(
      { message: "Good ID is missing." },
      { status: 400 }
    );
  }

  const goodId = parseBigIntParam(goodIdStr, "good ID");
  if (goodId === null) {
    return NextResponse.json(
      { message: "Invalid Good ID format." },
      { status: 400 }
    );
  }

  try {
    const journalGoodLinks = await prisma.journalGoodLink.findMany({
      where: { goodId: goodId },
      include: {
        journal: true, // To get journal name/code
      },
      orderBy: { journal: { name: "asc" } },
    });

    // Map to the client-side type structure
    const formattedLinks: JournalGoodLinkWithDetails[] = journalGoodLinks.map(
      (link) => ({
        id: link.id.toString(), // JournalGoodLink's own ID
        goodId: link.goodId.toString(), // ID of the good this link belongs to
        journalId: link.journalId,
        journalName: link.journal.name,
        journalCode: link.journal.id, // Assuming journal.id is its code
        createdAt: link.createdAt.toISOString(), // Ensure date is ISO string
      })
    );

    // Stringify using the replacer that handles BigInts (though we've manually stringified them above)
    // This is more of a safeguard if any BigInts were to remain in nested structures.
    const body = JSON.stringify(formattedLinks, jsonBigIntReplacer);

    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const e = error as Error;
    console.error(`Error fetching journal links for good ${goodIdStr}:`, e);
    return NextResponse.json(
      { message: "Could not fetch journal links.", error: e.message },
      { status: 500 }
    );
  }
}
