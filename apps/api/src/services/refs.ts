import { and, eq, inArray } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { cycles, issues, labels, projects, teams, users } from '../db/schema';
import { badRequest, conflict } from '../errors';

export async function assertTeamExists(db: DbOrTx, teamId: string): Promise<void> {
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId));
  if (!team) throw badRequest('Unknown team');
}

export interface RefInput {
  assigneeId?: string | null;
  labelIds?: string[];
  projectId?: string | null;
  cycleId?: string | null;
  parentId?: string | null;
}

export async function validateRefs(
  db: DbOrTx,
  teamId: string,
  input: RefInput,
  selfId: string | null,
): Promise<void> {
  if (input.assigneeId) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.assigneeId));
    if (!user) throw badRequest('Unknown assignee');
  }
  if (input.labelIds?.length) {
    const unique = [...new Set(input.labelIds)];
    const found = await db
      .select({ id: labels.id })
      .from(labels)
      .where(and(inArray(labels.id, unique), eq(labels.teamId, teamId)));
    if (found.length !== unique.length) throw badRequest('Unknown label for this team');
  }
  if (input.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.teamId, teamId)));
    if (!project) throw badRequest('Unknown project for this team');
  }
  if (input.cycleId) {
    const [cycle] = await db
      .select({ id: cycles.id })
      .from(cycles)
      .where(and(eq(cycles.id, input.cycleId), eq(cycles.teamId, teamId)));
    if (!cycle) throw badRequest('Unknown cycle for this team');
  }
  if (input.parentId) {
    if (input.parentId === selfId) throw conflict('An issue cannot be its own parent');
    const [parent] = await db.select({ teamId: issues.teamId }).from(issues).where(eq(issues.id, input.parentId));
    if (!parent) throw badRequest('Unknown parent issue');
    if (parent.teamId !== teamId) throw conflict('Parent issue must belong to the same team');
    if (selfId) {
      const seen = new Set<string>();
      let cursor: string | null = input.parentId;
      while (cursor && !seen.has(cursor)) {
        if (cursor === selfId) throw conflict('Circular parent relationship');
        seen.add(cursor);
        const [row] = await db.select({ parentId: issues.parentId }).from(issues).where(eq(issues.id, cursor));
        cursor = row?.parentId ?? null;
      }
    }
  }
}
