// src/app/api/journal-partner-good-links/bulk/route.ts

import { NextRequest, NextResponse } from "next/server";
import jpgLinkService from "@/app/services/journalPartnerGoodLinkService";
import { jsonBigIntReplacer } from "@/app/utils/jsonBigInt";
import { withAuthorization } from "@/lib/auth/withAuthorization";
import { apiLogger } from "@/lib/logger";
import { z } from "zod";
import { createJournalPartnerGoodLinkSchema } from "@/lib/schemas/journalPartnerGoodLink.schema";

// Bulk create schema - use the client-side schema for validation, not the orchestrated one
const BulkCreateSchema = z.object({
  links: z.array(createJournalPartnerGoodLinkSchema).min(1, "At least one link is required"),
});

// Bulk delete schema
const BulkDeleteSchema = z.object({
  linkIds: z.array(z.string()).min(1, "At least one link ID is required"),
});

/**
 * POST /api/journal-partner-good-links/bulk
 * Creates multiple three-way links in a single batch operation.
 * @param {NextRequest} request - The incoming Next.js request object containing the bulk creation payload.
 * @body {object} body - The bulk creation data.
 * @body {array} body.links - Array of link creation objects.
 * @returns {NextResponse} A JSON response containing the newly created links.
 * @status 201 - Created: Links successfully created.
 * @status 400 - Bad Request: Invalid request body or validation errors.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission CREATE_JOURNAL - Requires 'CREATE' action on 'JOURNAL' resource.
 */
export const POST = withAuthorization(
  async function POST(request: NextRequest) {
    try {
      const rawBody = await request.json();
      const validation = BulkCreateSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for bulk link creation.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { links } = validation.data;

      // Debug logging to see what data types we're receiving
      apiLogger.debug("Received links data for bulk creation:", {
        count: links.length,
        firstLink: links.length > 0 ? {
          journalId: `${links[0].journalId} (${typeof links[0].journalId})`,
          partnerId: `${links[0].partnerId} (${typeof links[0].partnerId})`,
          goodId: `${links[0].goodId} (${typeof links[0].goodId})`,
        } : null
      });

      // Create links one by one (could be optimized for better transaction handling)
      const createdLinks = [];
      const errors = [];

      for (let i = 0; i < links.length; i++) {
        try {
          // Pass data directly to service - schema will handle string/bigint conversion
          const newLink = await jpgLinkService.createFullJpgLink(links[i]);
          createdLinks.push(newLink);
        } catch (error) {
          const e = error as Error;
          const errorMessage = e.message || 'Unknown error occurred';
          apiLogger.error(`Failed to create link at index ${i}`, {
            index: i,
            linkData: {
              journalId: links[i].journalId,
              partnerId: links[i].partnerId?.toString(),
              goodId: links[i].goodId?.toString(),
            },
            error: errorMessage,
            stack: e.stack
          });
          errors.push({
            index: i,
            error: errorMessage
          });
        }
      }

      if (errors.length > 0 && createdLinks.length === 0) {
        // All failed
        apiLogger.error("Bulk create journal-partner-good-links - All failed", { 
          errorCount: errors.length,
          detailedErrors: errors.map(e => `Link ${e.index}: ${e.error}`).join(' | '),
          errors: errors.map(e => ({
            index: e.index,
            error: e.error,
            // Don't log the full data to avoid BigInt serialization issues
          }))
        });
        const body = JSON.stringify({
          message: "All link creations failed.",
          errors,
        }, jsonBigIntReplacer);
        return new NextResponse(body, {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      } else if (errors.length > 0) {
        // Partial success
        apiLogger.warn("Bulk create journal-partner-good-links - Partial success", { 
          created: createdLinks.length,
          failed: errors.length,
          detailedErrors: errors.map(e => `Link ${e.index}: ${e.error}`).join(' | '),
          errors: errors.map(e => ({
            index: e.index,
            error: e.error,
            // Don't log the full data to avoid BigInt serialization issues
          }))
        });
        const body = JSON.stringify({ 
          links: createdLinks, 
          errors,
          message: `${createdLinks.length} links created, ${errors.length} failed.`
        }, jsonBigIntReplacer);
        return new NextResponse(body, {
          status: 207, // Multi-status
          headers: { "Content-Type": "application/json" },
        });
      }

      // All succeeded
      apiLogger.info("Bulk create journal-partner-good-links - Success", { 
        created: createdLinks.length 
      });
      const body = JSON.stringify(createdLinks, jsonBigIntReplacer);
      return new NextResponse(body, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      const e = error as Error;
      apiLogger.error("API POST /api/journal-partner-good-links/bulk Error", { 
        error: e.message, 
        stack: e.stack 
      });
      return NextResponse.json(
        { message: "An internal error occurred during bulk creation." },
        { status: 500 }
      );
    }
  },
  { action: "CREATE", resource: "JOURNAL" }
);

/**
 * DELETE /api/journal-partner-good-links/bulk
 * Deletes multiple Journal-Partner-Good links by their IDs.
 * @param {NextRequest} request - The incoming Next.js request object containing the bulk deletion payload.
 * @body {object} body - The bulk deletion data.
 * @body {array} body.linkIds - Array of link IDs to delete.
 * @returns {NextResponse} A JSON response indicating success or error details.
 * @status 200 - OK: Links successfully deleted.
 * @status 207 - Multi-Status: Some links deleted, some failed.
 * @status 400 - Bad Request: Invalid request body.
 * @status 500 - Internal Server Error: An unexpected error occurred.
 * @permission DELETE_JOURNAL - Requires 'DELETE' action on 'JOURNAL' resource.
 */
export const DELETE = withAuthorization(
  async function DELETE(request: NextRequest) {
    try {
      const rawBody = await request.json();
      const validation = BulkDeleteSchema.safeParse(rawBody);

      if (!validation.success) {
        return NextResponse.json(
          {
            message: "Invalid request body for bulk link deletion.",
            errors: validation.error.format(),
          },
          { status: 400 }
        );
      }

      const { linkIds } = validation.data;

      // Convert string IDs to BigInt
      const bigIntIds = linkIds.map(id => {
        try {
          return BigInt(id);
        } catch {
          throw new Error(`Invalid link ID: ${id}`);
        }
      });

      // Delete links one by one
      const deletedLinks = [];
      const errors = [];

      for (let i = 0; i < bigIntIds.length; i++) {
        try {
          const deleted = await jpgLinkService.deleteLinkById(bigIntIds[i]);
          if (deleted) {
            deletedLinks.push({ id: linkIds[i], status: 'deleted' });
          } else {
            errors.push({
              id: linkIds[i],
              error: 'Link not found'
            });
          }
        } catch (error) {
          const e = error as Error;
          errors.push({
            id: linkIds[i],
            error: e.message
          });
        }
      }

      if (errors.length > 0 && deletedLinks.length === 0) {
        // All failed
        apiLogger.error("Bulk delete journal-partner-good-links - All failed", { errors });
        return NextResponse.json(
          {
            message: "All link deletions failed.",
            errors,
          },
          { status: 400 }
        );
      } else if (errors.length > 0) {
        // Partial success
        apiLogger.warn("Bulk delete journal-partner-good-links - Partial success", { 
          deleted: deletedLinks.length,
          failed: errors.length,
          errors 
        });
        return NextResponse.json(
          {
            message: `${deletedLinks.length} links deleted, ${errors.length} failed.`,
            deleted: deletedLinks,
            errors,
          },
          { status: 207 } // Multi-status
        );
      }

      // All succeeded
      apiLogger.info("Bulk delete journal-partner-good-links - Success", { 
        deleted: deletedLinks.length 
      });
      return NextResponse.json(
        {
          message: `Successfully deleted ${deletedLinks.length} links.`,
          deleted: deletedLinks,
        },
        { status: 200 }
      );

    } catch (error) {
      const e = error as Error;
      apiLogger.error("API DELETE /api/journal-partner-good-links/bulk Error", { 
        error: e.message, 
        stack: e.stack 
      });
      return NextResponse.json(
        { message: "An internal error occurred during bulk deletion." },
        { status: 500 }
      );
    }
  },
  { action: "DELETE", resource: "JOURNAL" }
);