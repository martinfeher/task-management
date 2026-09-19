"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type KanbanColumnRecord = {
  id: string;
  listId: string;
  name: string;
  position: number;
};

const NOT_ASSIGNED_COLUMN_NAME = "Not assigned";

export async function initializeKanbanBoard(listId: string) {
  const existingColumns = await prisma.kanbanColumn.findMany({
    where: { listId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  let notAssignedColumn = existingColumns.find(
    (column) => column.name === NOT_ASSIGNED_COLUMN_NAME,
  );

  if (!notAssignedColumn) {
    notAssignedColumn = await prisma.kanbanColumn.create({
      data: {
        listId,
        name: NOT_ASSIGNED_COLUMN_NAME,
        position: 0,
      },
    });
  }

  await prisma.task.updateMany({
    where: {
      listId,
      deletedAt: null,
      parentId: null,
      kanbanColumnId: null,
    },
    data: {
      kanbanColumnId: notAssignedColumn.id,
    },
  });

  revalidatePath("/");
  return notAssignedColumn;
}

export async function renameKanbanColumn(
  listId: string,
  columnId: string,
  name: string,
) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Column name is required");
  }

  const column = await prisma.kanbanColumn.findFirst({
    where: { id: columnId, listId },
    select: { id: true },
  });

  if (!column) {
    throw new Error("Kanban column not found");
  }

  await prisma.kanbanColumn.update({
    where: { id: columnId },
    data: { name: trimmedName },
  });

  revalidatePath("/");
}

export async function createKanbanColumn(listId: string, name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Column name is required");
  }

  const aggregate = await prisma.kanbanColumn.aggregate({
    where: { listId },
    _max: { position: true },
  });

  const column = await prisma.kanbanColumn.create({
    data: {
      listId,
      name: trimmedName,
      position: (aggregate._max.position ?? -1) + 1,
    },
  });

  revalidatePath("/");
  return column satisfies KanbanColumnRecord;
}

export async function createKanbanTask(
  listId: string,
  columnId: string,
  name: string,
) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Task name is required");
  }

  const column = await prisma.kanbanColumn.findFirst({
    where: { id: columnId, listId },
    select: { id: true },
  });

  if (!column) {
    throw new Error("Kanban column not found");
  }

  const task = await prisma.$transaction(async (tx) => {
    const aggregate = await tx.task.aggregate({
      where: {
        listId,
        kanbanColumnId: columnId,
        deletedAt: null,
        parentId: null,
      },
      _max: { position: true },
    });

    return tx.task.create({
      data: {
        listId,
        kanbanColumnId: columnId,
        name: trimmedName,
        position: (aggregate._max.position ?? -1) + 1,
        important: false,
      },
    });
  });

  revalidatePath("/");
  return task;
}

export async function getKanbanColumnsForList(listId: string) {
  return prisma.kanbanColumn.findMany({
    where: { listId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      listId: true,
      name: true,
      position: true,
    },
  });
}

async function reindexKanbanColumnTasks(
  tx: Pick<typeof prisma, "task">,
  listId: string,
  columnId: string,
) {
  const columnTasks = await tx.task.findMany({
    where: {
      listId,
      kanbanColumnId: columnId,
      deletedAt: null,
      parentId: null,
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(
    columnTasks.map((task, index) =>
      tx.task.update({
        where: { id: task.id },
        data: { position: index },
      }),
    ),
  );
}

export async function moveKanbanTask(
  listId: string,
  taskId: string,
  targetColumnId: string,
  insertIndex: number,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, listId, deletedAt: null, parentId: null },
    select: { id: true, kanbanColumnId: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const targetColumn = await prisma.kanbanColumn.findFirst({
    where: { id: targetColumnId, listId },
    select: { id: true },
  });

  if (!targetColumn) {
    throw new Error("Kanban column not found");
  }

  const sourceColumnId = task.kanbanColumnId;

  await prisma.$transaction(async (tx) => {
    const targetTasks = await tx.task.findMany({
      where: {
        listId,
        kanbanColumnId: targetColumnId,
        deletedAt: null,
        parentId: null,
        id: { not: taskId },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const clampedIndex = Math.max(0, Math.min(insertIndex, targetTasks.length));
    const orderedTargetIds = targetTasks.map((item) => item.id);
    orderedTargetIds.splice(clampedIndex, 0, taskId);

    await Promise.all(
      orderedTargetIds.map((id, index) =>
        tx.task.update({
          where: { id },
          data: {
            position: index,
            kanbanColumnId: targetColumnId,
          },
        }),
      ),
    );

    if (sourceColumnId && sourceColumnId !== targetColumnId) {
      await reindexKanbanColumnTasks(tx, listId, sourceColumnId);
    }
  });

  revalidatePath("/");
}

export async function deleteKanbanColumn(listId: string, columnId: string) {
  const column = await prisma.kanbanColumn.findFirst({
    where: { id: columnId, listId },
    select: { id: true, name: true },
  });

  if (!column) {
    throw new Error("Kanban column not found");
  }

  if (column.name === NOT_ASSIGNED_COLUMN_NAME) {
    throw new Error("The default column cannot be removed");
  }

  const taskCount = await prisma.task.count({
    where: {
      listId,
      kanbanColumnId: columnId,
      deletedAt: null,
      parentId: null,
      completed: false,
    },
  });

  if (taskCount > 0) {
    throw new Error("Only empty columns can be removed");
  }

  await prisma.kanbanColumn.delete({
    where: { id: columnId },
  });

  revalidatePath("/");
}
