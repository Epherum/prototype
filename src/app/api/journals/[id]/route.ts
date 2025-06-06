// File: app/api/journals/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  journalService,
  UpdateJournalData,
} from "@/app/services/journalService"; // Chef and Order Slip type
import { z } from "zod"; // Waiter's notepad
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

// Waiter's checklist for "Update Dish" orders
const updateJournalSchema = z
  .object({
    name: z
      .string()
      .min(1, "Dish name required")
      .max(255, "Dish name too long")
      .optional(),
    isTerminal: z.boolean().optional(),
    additionalDetails: z.any().optional(),
  })
  .strict(); // .strict() means no extra ingredients allowed that aren't on the checklist

// This function runs when your frontend calls GET /api/journals/{some_id}
export async function GET(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const dishId = resolvedParams.id; // Access id from the resolved object

  // You need to get the session to access companyId and userId
  const session = (await getServerSession(authOptions)) as
    | import("@/lib/authOptions").ExtendedSession
    | null;
  if (!session?.user || !session.user.id || !session.user.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }
  const user = session.user as import("@/lib/authOptions").ExtendedUser;
  const userContext = {
    companyId: user.companyId,
    userId: user.id,
  };

  console.log(
    `Waiter (API): Customer wants details for dish '${dishId}'. Asking Chef...`
  );
  try {
    const journal = await journalService.getJournalById(dishId, userContext);
    if (!journal) {
      console.warn(
        `Waiter (API): Chef says dish '${dishId}' is not on the menu.`
      );
      return NextResponse.json(
        { message: `Dish (Journal) '${dishId}' not found on the menu.` },
        { status: 404 }
      );
    }
    console.log(
      `Waiter (API): Chef found dish '${dishId}'. Giving details to customer.`
    );
    return NextResponse.json(journal);
  } catch (error) {
    const e = error as Error;
    console.error(
      `Waiter (API): Chef had a problem finding dish '${dishId}'!`,
      e.message
    );
    return NextResponse.json(
      { message: "Chef couldn't find that dish.", error: e.message },
      { status: 500 }
    );
  }
}

// This function runs when your frontend calls PUT /api/journals/{some_id} (to update)
export async function PUT(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const dishId = resolvedParams.id; // Access id from the resolved object

  // Get session and user context as in GET
  const session = (await getServerSession(authOptions)) as
    | import("@/lib/authOptions").ExtendedSession
    | null;
  if (!session?.user || !session.user.id || !session.user.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }
  const user = session.user as import("@/lib/authOptions").ExtendedUser;
  const userContext = {
    companyId: user.companyId,
    userId: user.id,
  };

  console.log(`Waiter (API): Customer wants to update dish '${dishId}'.`);
  try {
    const rawOrderChanges = await _request.json();
    console.log(
      `Waiter (API): Customer's requested changes for dish '${dishId}':`,
      rawOrderChanges
    );

    // Waiter checks the requested changes
    const validation = updateJournalSchema.safeParse(rawOrderChanges);
    if (!validation.success) {
      console.warn(
        "Waiter (API): Customer's update request is unclear/invalid:",
        validation.error.format()
      );
      return NextResponse.json(
        {
          message: "Update request for dish is unclear.",
          errors: validation.error.format(),
        },
        { status: 400 }
      );
    }
    if (Object.keys(validation.data).length === 0) {
      console.warn(
        "Waiter (API): Customer asked to update a dish but provided no changes."
      );
      return NextResponse.json(
        { message: "No changes provided for the dish update." },
        { status: 400 }
      );
    }

    const validChanges = validation.data as UpdateJournalData;
    console.log(
      "Waiter (API): Update request is clear. Passing to Chef:",
      validChanges
    );

    // Give the changes to the Chef
    const updatedDish = await journalService.updateJournal(
      dishId,
      validChanges,
      userContext
    );
    if (!updatedDish) {
      console.warn(
        `Waiter (API): Chef says dish '${dishId}' was not found for update.`
      );
      return NextResponse.json(
        { message: `Dish (Journal) '${dishId}' not found, cannot update.` },
        { status: 404 }
      );
    }

    console.log(
      `Waiter (API): Chef successfully updated dish '${dishId}'! Informing customer.`
    );
    return NextResponse.json(updatedDish);
  } catch (error) {
    const e = error as Error;
    console.error(
      `Waiter (API): Chef couldn't update dish '${dishId}'!`,
      e.message
    );
    return NextResponse.json(
      { message: `Chef couldn't update dish '${dishId}'.`, error: e.message },
      { status: 500 }
    );
  }
}

// This function runs when your frontend calls DELETE /api/journals/{some_id}
export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  // Await the paramsPromise to get the actual params object
  const resolvedParams = await paramsPromise;
  const dishId = resolvedParams.id; // Access id from the resolved object

  // Get session and user context as in GET
  const session = (await getServerSession(authOptions)) as
    | import("@/lib/authOptions").ExtendedSession
    | null;
  if (!session?.user || !session.user.id || !session.user.companyId) {
    return NextResponse.json(
      { message: "Unauthorized: Session or user details missing" },
      { status: 401 }
    );
  }
  const user = session.user as import("@/lib/authOptions").ExtendedUser;
  const userContext = {
    companyId: user.companyId,
    userId: user.id,
  };

  console.log(
    `Waiter (API): Customer wants to remove dish '${dishId}' from the menu.`
  );
  try {
    // Tell the Chef to remove the dish
    const deletedDish = await journalService.deleteJournal(dishId, userContext);
    // If service.deleteJournal throws an error if not found, this part might not be reached for 404.
    // The service currently returns null if not found, or throws for children.
    // Let's adjust service to throw for "not found" too for consistency. (See change in service)

    console.log(
      `Waiter (API): Chef successfully removed dish '${dishId}'. Informing customer.`
    );
    return NextResponse.json({
      message: `Dish (Journal) '${dishId}' successfully removed from the menu.`,
    });
  } catch (error) {
    const e = error as Error;
    console.error(
      `Waiter (API): Chef couldn't remove dish '${dishId}'!`,
      e.message
    );
    let statusCode = 500;
    if (
      e.message.includes("has side dishes") ||
      e.message.includes("has child journals")
    ) {
      statusCode = 409; // Conflict - cannot delete because of children
    } else if (e.message.includes("not found")) {
      statusCode = 404; // Not Found
    }
    return NextResponse.json(
      { message: `Chef couldn't remove dish '${dishId}'.`, error: e.message },
      { status: statusCode }
    );
  }
}
