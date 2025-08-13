import { Prisma } from "@prisma/client";
import prisma from "@/app/utils/prisma";

/**
 * Finds all descendant journal IDs for one or more root journals directly from the database.
 * This is highly efficient, using a single recursive SQL query.
 * @param rootJournalIds - An array of starting journal IDs.
 * @returns A `Promise<Set<string>>` containing all unique root and descendant journal IDs.
 */
export async function getDescendantJournalIdsAsSet(
  rootJournalIds: string[]
): Promise<Set<string>> {
  if (!rootJournalIds?.length) {
    return new Set<string>();
  }
  console.log(
    `(DB Query) Finding all descendants for roots: [${rootJournalIds.join(
      ", "
    )}]`
  );

  const results: Array<{ id: string }> = await prisma.$queryRaw`
    WITH RECURSIVE "JournalDescendants" AS (
      SELECT id FROM "journals" WHERE id IN (${Prisma.join(rootJournalIds)})
      UNION ALL
      SELECT j.id FROM "journals" j
      INNER JOIN "JournalDescendants" jd ON j.parent_id = jd.id
    )
    SELECT id FROM "JournalDescendants";
  `;

  return new Set(results.map((r) => r.id));
}

/**
 * Convenience wrapper for `getDescendantJournalIdsAsSet` that returns an array.
 * @param rootJournalIds - An array of starting journal IDs.
 * @returns A `Promise<string[]>` containing all unique root and descendant journal IDs.
 */
export async function getDescendantJournalIdsAsArray(
  rootJournalIds: string[]
): Promise<string[]> {
  const idSet = await getDescendantJournalIdsAsSet(rootJournalIds);
  return Array.from(idSet);
}
