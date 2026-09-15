"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  getLabelsFromTaskTags,
  getPriorityFromTaskTags,
  LABEL_CATEGORY,
  labelSlug,
  normalizePriority,
  PRIORITY_TAG_CATEGORY,
  prioritySlug,
} from "@/lib/task-tags";
import { normalizeLabelColorHex } from "@/lib/label-colors";
import { normalizeCalendarTaskColor } from "@/lib/calendar-task-colors";
import {
  deleteTaskImageDirectory,
  repairBrokenTaskImageReferences,
} from "@/lib/task-image-storage";
import { persistTaskDetailsUpdate, persistTaskRename } from "@/lib/task-version-persistence";
import {
  plainTextToTaskDetails,
  taskDetailsHasContent,
} from "@/lib/task-details-content";
import {
  advanceDueDate,
  parseRecurrenceRule,
  serializeRecurrenceRule,
  type TaskRecurrenceRule,
} from "@/lib/task-recurrence";

export async function getTaskById(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      name: true,
      completed: true,
      details: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
      recurrenceRule: true,
      recurrenceAnchor: true,
      isNote: true,
    },
  });

  if (!task) {
    return null;
  }

  const { details, changed } = await repairBrokenTaskImageReferences(
    taskId,
    task.details,
  );

  if (!changed) {
    return task;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { details },
  });

  return {
    ...task,
    details,
  };
}

export async function updateTaskRecurrence(
  taskId: string,
  rule: TaskRecurrenceRule | null,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { dueDate: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      recurrenceRule: serializeRecurrenceRule(rule),
      recurrenceAnchor: rule
        ? task.dueDate ?? new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`)
        : null,
    },
    select: {
      id: true,
      recurrenceRule: true,
      recurrenceAnchor: true,
    },
  });

  revalidatePath("/");
  return {
    id: updated.id,
    recurrenceRule: updated.recurrenceRule,
    recurrenceAnchor: updated.recurrenceAnchor
      ? updated.recurrenceAnchor.toISOString()
      : null,
  };
}

export async function updateTaskDetails(taskId: string, details: string) {
  await persistTaskDetailsUpdate(taskId, details);
}

export async function updateTaskDueDate(taskId: string, dueDate: string | null) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { dueDate: true },
  });

  const existingDateValue = existing?.dueDate
    ? existing.dueDate.toISOString().slice(0, 10)
    : null;
  const dateChanged = dueDate !== existingDateValue;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      ...(dateChanged
        ? {
            dueTimeMinutes: null,
            dueDurationMinutes: null,
            dueTimeZone: "floating",
          }
        : {}),
    },
    select: {
      id: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskDueDateAndTime(
  taskId: string,
  dueDate: string | null,
  dueTime: TaskDueTime,
) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      dueTimeMinutes: normalizeDueTimeMinutes(dueTime.dueTimeMinutes),
      dueDurationMinutes: normalizeDueDurationMinutes(dueTime.dueDurationMinutes),
      dueTimeZone: normalizeDueTimeZone(dueTime.dueTimeZone),
    },
    select: {
      id: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueDate: task.dueDate,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskDueTime(taskId: string, dueTime: TaskDueTime) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueTimeMinutes: normalizeDueTimeMinutes(dueTime.dueTimeMinutes),
      dueDurationMinutes: normalizeDueDurationMinutes(dueTime.dueDurationMinutes),
      dueTimeZone: normalizeDueTimeZone(dueTime.dueTimeZone),
    },
    select: {
      id: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });

  revalidatePath("/");
  return {
    id: task.id,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
  };
}

export async function updateTaskPriority(taskId: string, priority: number | null) {
  const normalizedPriority = normalizePriority(priority);

  await prisma.$transaction(async (tx) => {
    await tx.taskTag.deleteMany({
      where: {
        taskId,
        tag: { category: PRIORITY_TAG_CATEGORY },
      },
    });

    if (normalizedPriority !== null) {
      const tag = await tx.tag.findUnique({
        where: { slug: prioritySlug(normalizedPriority) },
        select: { id: true },
      });

      if (!tag) {
        throw new Error(`Missing priority tag: ${prioritySlug(normalizedPriority)}`);
      }

      await tx.taskTag.create({
        data: {
          taskId,
          tagId: tag.id,
        },
      });
    }
  });

  revalidatePath("/");
  return {
    id: taskId,
    priority: normalizedPriority,
  };
}

export async function updateTaskCalendarColor(
  taskId: string,
  calendarColor: string | null,
) {
  const normalizedColor = normalizeCalendarTaskColor(calendarColor);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { calendarColor: normalizedColor },
    select: { id: true, calendarColor: true },
  });

  revalidatePath("/");
  return {
    id: task.id,
    calendarColor: task.calendarColor,
  };
}

export async function getLabels() {
  return prisma.tag.findMany({
    where: { category: LABEL_CATEGORY },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      color: true,
    },
  });
}

export async function getTaskLabels(taskId: string) {
  const entries = await prisma.taskTag.findMany({
    where: {
      taskId,
      tag: { category: LABEL_CATEGORY },
    },
    include: {
      tag: {
        select: {
          id: true,
          label: true,
          color: true,
        },
      },
    },
    orderBy: [{ tag: { position: "asc" } }, { tag: { createdAt: "asc" } }],
  });

  return entries.map((entry) => entry.tag);
}

export async function createLabel(label: string, color?: string | null) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Label is required");
  }

  const slug = labelSlug(trimmed);
  const normalizedColor = color
    ? normalizeLabelColorHex(color).toLowerCase()
    : null;
  const lastLabel = await prisma.tag.findFirst({
    where: { category: LABEL_CATEGORY },
    orderBy: [{ position: "desc" }, { createdAt: "desc" }],
    select: { position: true },
  });
  const position = (lastLabel?.position ?? -1) + 1;
  const tag = await prisma.tag.upsert({
    where: { slug },
    create: {
      slug,
      label: trimmed,
      category: LABEL_CATEGORY,
      position,
      color: normalizedColor,
    },
    update: {
      label: trimmed,
      ...(normalizedColor ? { color: normalizedColor } : {}),
    },
    select: {
      id: true,
      label: true,
      color: true,
    },
  });

  revalidatePath("/");
  return tag;
}

export async function renameLabel(labelId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Label is required");
  }

  const existingLabel = await prisma.tag.findFirst({
    where: { id: labelId, category: LABEL_CATEGORY },
    select: { id: true },
  });

  if (!existingLabel) {
    throw new Error("Label not found");
  }

  const slug = labelSlug(trimmed);
  const slugConflict = await prisma.tag.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (slugConflict && slugConflict.id !== labelId) {
    throw new Error("A label with this name already exists");
  }

  const tag = await prisma.tag.update({
    where: { id: labelId },
    data: {
      label: trimmed,
      slug,
    },
    select: {
      id: true,
      label: true,
      color: true,
    },
  });

  revalidatePath("/");
  return tag;
}

export async function deleteLabel(labelId: string) {
  const existingLabel = await prisma.tag.findFirst({
    where: { id: labelId, category: LABEL_CATEGORY },
    select: { id: true },
  });

  if (!existingLabel) {
    throw new Error("Label not found");
  }

  await prisma.$transaction([
    prisma.taskTag.deleteMany({
      where: { tagId: labelId },
    }),
    prisma.tag.delete({
      where: { id: labelId },
    }),
  ]);

  revalidatePath("/");
}

export async function updateLabelColor(labelId: string, color: string) {
  const existingLabel = await prisma.tag.findFirst({
    where: { id: labelId, category: LABEL_CATEGORY },
    select: { id: true },
  });

  if (!existingLabel) {
    throw new Error("Label not found");
  }

  const normalizedColor = normalizeLabelColorHex(color).toLowerCase();

  const tag = await prisma.tag.update({
    where: { id: labelId },
    data: { color: normalizedColor },
    select: {
      id: true,
      label: true,
      color: true,
    },
  });

  revalidatePath("/");
  return tag;
}

export async function applyTaskLabels(
  taskId: string,
  labelIds: string[],
  newLabelName?: string | null,
) {
  const uniqueLabelIds = new Set(labelIds);

  if (newLabelName?.trim()) {
    const trimmed = newLabelName.trim();
    const slug = labelSlug(trimmed);
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: {
        slug,
        label: trimmed,
        category: LABEL_CATEGORY,
      },
      update: {
        label: trimmed,
      },
      select: { id: true },
    });
    uniqueLabelIds.add(tag.id);
  }

  if (uniqueLabelIds.size === 0) {
    throw new Error("Select or type at least one label");
  }

  await prisma.$transaction(
    [...uniqueLabelIds].map((tagId) =>
      prisma.taskTag.upsert({
        where: {
          taskId_tagId: {
            taskId,
            tagId,
          },
        },
        create: {
          taskId,
          tagId,
        },
        update: {},
      }),
    ),
  );

  revalidatePath("/");
  return getTaskLabels(taskId);
}

export async function setTaskLabel(
  taskId: string,
  labelId: string,
  assigned: boolean,
) {
  if (assigned) {
    await prisma.taskTag.upsert({
      where: {
        taskId_tagId: {
          taskId,
          tagId: labelId,
        },
      },
      create: {
        taskId,
        tagId: labelId,
      },
      update: {},
    });
  } else {
    await prisma.taskTag.deleteMany({
      where: {
        taskId,
        tagId: labelId,
        tag: { category: LABEL_CATEGORY },
      },
    });
  }

  revalidatePath("/");
  return getTaskLabels(taskId);
}

export async function addTaskLabel(taskId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Label is required");
  }

  const slug = labelSlug(trimmed);

  await prisma.$transaction(async (tx) => {
    const tag = await tx.tag.upsert({
      where: { slug },
      create: {
        slug,
        label: trimmed,
        category: LABEL_CATEGORY,
      },
      update: {
        label: trimmed,
      },
      select: { id: true },
    });

    await tx.taskTag.upsert({
      where: {
        taskId_tagId: {
          taskId,
          tagId: tag.id,
        },
      },
      create: {
        taskId,
        tagId: tag.id,
      },
      update: {},
    });
  });

  revalidatePath("/");
  return { id: taskId, label: trimmed };
}

export async function updateTaskPinned(taskId: string, pinned: boolean) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { pinned },
    select: { id: true, pinned: true },
  });

  revalidatePath("/");
  return task;
}

export async function updateTaskImportant(taskId: string, important: boolean) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { important },
    select: { id: true, important: true },
  });

  revalidatePath("/");
  return task;
}

export async function convertTaskToNote(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      name: true,
      details: true,
      isNote: true,
      completed: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const nextDetails =
    !taskDetailsHasContent(task.details) && task.name.trim()
      ? plainTextToTaskDetails(task.name.trim())
      : task.details;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      isNote: true,
      completed: false,
    },
    select: {
      id: true,
      isNote: true,
      details: true,
      completed: true,
    },
  });

  if (nextDetails !== task.details) {
    await persistTaskDetailsUpdate(taskId, nextDetails);
    updated.details = nextDetails;
  }

  revalidatePath("/");
  return updated;
}

export async function convertNoteToTask(taskId: string) {
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      isNote: false,
    },
    select: {
      id: true,
      isNote: true,
      details: true,
      completed: true,
    },
  });

  revalidatePath("/");
  return updated;
}

export async function renameTask(taskId: string, name: string) {
  const task = await persistTaskRename(taskId, name);

  revalidatePath("/");
  return task;
}

export async function renameTodoList(listId: string, name: string) {
  const list = await prisma.todoList.update({
    where: { id: listId },
    data: { name: name.trim() },
  });

  revalidatePath("/");
  return list;
}

export type UpdateTodoListInput = {
  name: string;
  folderId: string | null;
  color: string | null;
};

export async function updateTodoList(listId: string, input: UpdateTodoListInput) {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("List name is required");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.todoList.findUnique({
      where: { id: listId },
      select: { folderId: true },
    });

    if (!existing) {
      throw new Error("List not found");
    }

    const data: {
      name: string;
      color: string | null;
      folderId?: string | null;
      position?: number;
    } = {
      name: trimmedName,
      color: input.color,
    };

    if (input.folderId !== existing.folderId) {
      data.folderId = input.folderId;
      data.position = input.folderId
        ? await getNextFolderListPosition(tx, input.folderId)
        : await getNextTopLevelSidebarPosition(tx);
    }

    await tx.todoList.update({
      where: { id: listId },
      data,
    });
  });

  revalidatePath("/");
}

export async function deleteTodoList(listId: string) {
  const tasks = await prisma.task.findMany({
    where: { listId },
    select: { id: true },
  });

  await prisma.todoList.delete({
    where: { id: listId },
  });

  await Promise.all(tasks.map((task) => deleteTaskImageDirectory(task.id)));

  revalidatePath("/");
}

async function getNextTopLevelSidebarPosition(
  tx: Pick<typeof prisma, "todoList" | "listFolder">,
) {
  const [listAggregate, folderAggregate] = await Promise.all([
    tx.todoList.aggregate({
      where: { folderId: null },
      _max: { position: true },
    }),
    tx.listFolder.aggregate({
      _max: { position: true },
    }),
  ]);

  return (
    Math.max(
      listAggregate._max.position ?? -1,
      folderAggregate._max.position ?? -1,
    ) + 1
  );
}

async function getNextFolderListPosition(
  tx: Pick<typeof prisma, "todoList">,
  folderId: string,
) {
  const aggregate = await tx.todoList.aggregate({
    where: { folderId },
    _max: { position: true },
  });

  return (aggregate._max.position ?? -1) + 1;
}

export async function createTodoList(name: string) {
  const list = await prisma.$transaction(async (tx) => {
    const position = await getNextTopLevelSidebarPosition(tx);

    return tx.todoList.create({
      data: {
        name,
        position,
      },
    });
  });

  revalidatePath("/");
  return list;
}

export async function createListFolder(name: string) {
  const folder = await prisma.$transaction(async (tx) => {
    const position = await getNextTopLevelSidebarPosition(tx);

    return tx.listFolder.create({
      data: {
        name,
        position,
      },
    });
  });

  revalidatePath("/");
  return folder;
}

export async function renameListFolder(folderId: string, name: string) {
  const folder = await prisma.listFolder.update({
    where: { id: folderId },
    data: { name },
  });

  revalidatePath("/");
  return folder;
}

export async function deleteListFolder(folderId: string) {
  await prisma.$transaction(async (tx) => {
    const lists = await tx.todoList.findMany({
      where: { folderId },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    let nextPosition = await getNextTopLevelSidebarPosition(tx);

    for (const list of lists) {
      await tx.todoList.update({
        where: { id: list.id },
        data: {
          folderId: null,
          position: nextPosition,
        },
      });
      nextPosition += 1;
    }

    await tx.listFolder.delete({
      where: { id: folderId },
    });
  });

  revalidatePath("/");
}

export async function moveListToFolder(listId: string, folderId: string | null) {
  await prisma.$transaction(async (tx) => {
    const position = folderId
      ? await getNextFolderListPosition(tx, folderId)
      : await getNextTopLevelSidebarPosition(tx);

    await tx.todoList.update({
      where: { id: listId },
      data: {
        folderId,
        position,
      },
    });
  });

  revalidatePath("/");
}

export async function reorderLabels(labelIds: string[]) {
  const labels = await prisma.tag.findMany({
    where: { category: LABEL_CATEGORY },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const validIds = new Set(labels.map((label) => label.id));
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of labelIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    orderedIds.push(id);
    seen.add(id);
  }

  for (const label of labels) {
    if (!seen.has(label.id)) {
      orderedIds.push(label.id);
      seen.add(label.id);
    }
  }

  if (orderedIds.length !== labels.length) {
    throw new Error("Invalid label order payload");
  }

  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.tag.update({
        where: { id },
        data: { position },
      }),
    ),
  );

  revalidatePath("/");
}

export async function reorderTodoLists(listIds: string[]) {
  const lists = await prisma.todoList.findMany({
    where: { folderId: null },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const validIds = new Set(lists.map((list) => list.id));
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of listIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    orderedIds.push(id);
    seen.add(id);
  }

  for (const list of lists) {
    if (!seen.has(list.id)) {
      orderedIds.push(list.id);
      seen.add(list.id);
    }
  }

  if (orderedIds.length !== lists.length) {
    throw new Error("Invalid list order payload");
  }

  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.todoList.update({
        where: { id },
        data: { position },
      }),
    ),
  );

  revalidatePath("/");
}

export async function reorderSidebarTopLevel(
  listPositions: Array<{ id: string; position: number }>,
  folderPositions: Array<{ id: string; position: number }>,
) {
  const [lists, folders] = await Promise.all([
    prisma.todoList.findMany({
      where: { id: { in: listPositions.map((item) => item.id) } },
      select: { id: true },
    }),
    prisma.listFolder.findMany({
      where: { id: { in: folderPositions.map((item) => item.id) } },
      select: { id: true },
    }),
  ]);

  const validListIds = new Set(lists.map((list) => list.id));
  const validFolderIds = new Set(folders.map((folder) => folder.id));

  if (
    listPositions.some((item) => !validListIds.has(item.id)) ||
    folderPositions.some((item) => !validFolderIds.has(item.id))
  ) {
    throw new Error("Invalid sidebar order payload");
  }

  await prisma.$transaction([
    ...listPositions.map(({ id, position }) =>
      prisma.todoList.update({
        where: { id },
        data: { position },
      }),
    ),
    ...folderPositions.map(({ id, position }) =>
      prisma.listFolder.update({
        where: { id },
        data: { position },
      }),
    ),
  ]);

  revalidatePath("/");
}

export async function createTask(
  listId: string,
  name: string,
  dueDate?: string | null,
) {
  const task = await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { listId },
      data: { position: { increment: 1 } },
    });

    return tx.task.create({
      data: {
        listId,
        name,
        position: 0,
        important: false,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null,
      },
    });
  });

  revalidatePath("/");
  return task;
}

export async function moveTaskToList(taskId: string, targetListId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { listId: true, parentId: true },
  });

  if (!task || task.listId === targetListId) {
    return;
  }

  const sourceListId = task.listId;
  const childIds = task.parentId
    ? []
    : (
        await prisma.task.findMany({
          where: { parentId: taskId, deletedAt: null },
          select: { id: true },
        })
      ).map((child) => child.id);
  const movingIds = [taskId, ...childIds];

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { listId: targetListId },
      data: { position: { increment: movingIds.length } },
    });

    await Promise.all(
      movingIds.map((id, position) =>
        tx.task.update({
          where: { id },
          data: {
            listId: targetListId,
            position,
            ...(id === taskId && task.parentId ? { parentId: null } : {}),
          },
        }),
      ),
    );

    const sourceTasks = await tx.task.findMany({
      where: { listId: sourceListId },
      select: { id: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    await Promise.all(
      sourceTasks.map((sourceTask, position) =>
        tx.task.update({
          where: { id: sourceTask.id },
          data: { position },
        }),
      ),
    );
  });
}

export type TaskParentUpdate = {
  taskId: string;
  parentId: string | null;
};

export async function reorderTasks(
  listId: string,
  taskIds: string[],
  parentUpdates: TaskParentUpdate[] = [],
) {
  const tasks = await prisma.task.findMany({
    where: { listId, deletedAt: null },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const validIds = new Set(tasks.map((task) => task.id));
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of taskIds) {
    if (!validIds.has(id) || seen.has(id)) continue;
    orderedIds.push(id);
    seen.add(id);
  }

  for (const task of tasks) {
    if (!seen.has(task.id)) {
      orderedIds.push(task.id);
      seen.add(task.id);
    }
  }

  if (orderedIds.length !== tasks.length) {
    throw new Error("Invalid task order payload");
  }

  const validParentUpdates = parentUpdates.filter((update) =>
    validIds.has(update.taskId),
  );

  for (const update of validParentUpdates) {
    if (!update.parentId) continue;

    if (!validIds.has(update.parentId)) {
      throw new Error("Invalid parent task");
    }

    if (update.parentId === update.taskId) {
      throw new Error("Task cannot be its own parent");
    }

    const parentTask = await prisma.task.findUnique({
      where: { id: update.parentId },
      select: { parentId: true },
    });

    if (parentTask?.parentId) {
      throw new Error("Nested subtasks are not supported");
    }
  }

  await prisma.$transaction([
    ...orderedIds.map((id, position) =>
      prisma.task.update({
        where: { id },
        data: { position },
      }),
    ),
    ...validParentUpdates.map(({ taskId, parentId }) =>
      prisma.task.update({
        where: { id: taskId },
        data: { parentId },
      }),
    ),
  ]);

  revalidatePath("/");
}

export async function toggleTask(taskId: string, completed: boolean) {
  if (!completed) {
    await prisma.task.update({
      where: { id: taskId },
      data: { completed: false },
    });
    revalidatePath("/");
    return { id: taskId, completed: false as const };
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      tags: {
        select: { tagId: true },
      },
    },
  });

  if (!existing) {
    throw new Error("Task not found");
  }

  const recurrence = parseRecurrenceRule(existing.recurrenceRule);
  const spawnedTask = await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { completed: true },
    });

    if (!recurrence || !existing.dueDate || existing.parentId) {
      return null;
    }

    const nextDueDate = advanceDueDate(existing.dueDate, recurrence);

    await tx.task.updateMany({
      where: { listId: existing.listId },
      data: { position: { increment: 1 } },
    });

    const created = await tx.task.create({
      data: {
        listId: existing.listId,
        name: existing.name,
        details: existing.details,
        position: 0,
        dueDate: nextDueDate,
        dueTimeMinutes: existing.dueTimeMinutes,
        dueDurationMinutes: existing.dueDurationMinutes,
        dueTimeZone: existing.dueTimeZone,
        calendarColor: existing.calendarColor,
        important: existing.important,
        recurrenceRule: existing.recurrenceRule,
        recurrenceAnchor: existing.recurrenceAnchor ?? existing.dueDate,
      },
      select: {
        id: true,
        listId: true,
        name: true,
        dueDate: true,
        dueTimeMinutes: true,
        dueDurationMinutes: true,
        dueTimeZone: true,
        calendarColor: true,
        important: true,
        pinned: true,
        parentId: true,
        recurrenceRule: true,
        recurrenceAnchor: true,
      },
    });

    if (existing.tags.length > 0) {
      await tx.taskTag.createMany({
        data: existing.tags.map((entry) => ({
          taskId: created.id,
          tagId: entry.tagId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  revalidatePath("/");

  return {
    id: taskId,
    completed: true as const,
    spawnedTask: spawnedTask
      ? {
          id: spawnedTask.id,
          listId: spawnedTask.listId,
          name: spawnedTask.name,
          dueDate: spawnedTask.dueDate ? spawnedTask.dueDate.toISOString() : null,
          dueTimeMinutes: spawnedTask.dueTimeMinutes,
          dueDurationMinutes: spawnedTask.dueDurationMinutes,
          dueTimeZone: normalizeDueTimeZone(spawnedTask.dueTimeZone),
          calendarColor: spawnedTask.calendarColor,
          important: spawnedTask.important,
          pinned: spawnedTask.pinned,
          parentId: spawnedTask.parentId,
          recurrenceRule: spawnedTask.recurrenceRule,
          recurrenceAnchor: spawnedTask.recurrenceAnchor
            ? spawnedTask.recurrenceAnchor.toISOString()
            : null,
        }
      : undefined,
  };
}

export async function deleteTask(taskId: string) {
  const childIds = (
    await prisma.task.findMany({
      where: { parentId: taskId, deletedAt: null },
      select: { id: true },
    })
  ).map((child) => child.id);
  const idsToDelete = [taskId, ...childIds];
  const deletedAt = new Date();

  await prisma.task.updateMany({
    where: { id: { in: idsToDelete }, deletedAt: null },
    data: { deletedAt },
  });

  revalidatePath("/");
}

export type ArchivedTaskItem = {
  id: string;
  name: string;
  isNote: boolean;
  listId: string;
  listName: string;
  deletedAt: string;
};

export type RestoredTaskItem = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  hasDetails: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  calendarColor: string | null;
  recurrenceRule: string | null;
  priority: number | null;
  pinned: boolean;
  important: boolean;
  isNote: boolean;
  parentId: string | null;
  labels: { id: string; label: string; color?: string | null }[];
  listId: string;
};

async function mapRestoredTaskRecord(task: {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  dueDate: Date | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  calendarColor: string | null;
  recurrenceRule: string | null;
  pinned: boolean;
  important: boolean;
  isNote: boolean;
  parentId: string | null;
  listId: string;
  tags: Array<{
    tag: {
      id: string;
      label: string;
      color: string | null;
      category: string;
      level: number | null;
    };
  }>;
}): Promise<RestoredTaskItem> {
  const hasDetails = taskDetailsHasContent(task.details);

  return {
    id: task.id,
    name: task.name,
    completed: task.completed,
    details: "",
    hasDetails,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    calendarColor: task.calendarColor ?? null,
    recurrenceRule: task.recurrenceRule ?? null,
    priority: getPriorityFromTaskTags(task.tags),
    pinned: Boolean(task.pinned),
    important: Boolean(task.important),
    isNote: Boolean(task.isNote),
    parentId: task.parentId ?? null,
    labels: getLabelsFromTaskTags(task.tags),
    listId: task.listId,
  };
}

const restoredTaskSelect = {
  id: true,
  name: true,
  completed: true,
  details: true,
  dueDate: true,
  dueTimeMinutes: true,
  dueDurationMinutes: true,
  dueTimeZone: true,
  calendarColor: true,
  recurrenceRule: true,
  pinned: true,
  important: true,
  isNote: true,
  parentId: true,
  listId: true,
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          label: true,
          color: true,
          category: true,
          level: true,
        },
      },
    },
  },
} as const;

export type DuplicateTaskResult = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  calendarColor: string | null;
  recurrenceRule: string | null;
  priority: number | null;
  pinned: boolean;
  important: boolean;
  isNote: boolean;
  parentId: string | null;
  listId: string;
  labels: { id: string; label: string; color?: string | null }[];
};

export async function duplicateTask(
  taskId: string,
): Promise<DuplicateTaskResult> {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      name: true,
      details: true,
      detailsDoc: true,
      detailsText: true,
      schemaVersion: true,
      dueDate: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
      calendarColor: true,
      recurrenceRule: true,
      recurrenceAnchor: true,
      pinned: true,
      important: true,
      isNote: true,
      parentId: true,
      listId: true,
      tags: { select: { tagId: true } },
    },
  });

  if (!existing) {
    throw new Error("Task not found");
  }

  const duplicatedId = await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { listId: existing.listId, deletedAt: null },
      data: { position: { increment: 1 } },
    });

    const created = await tx.task.create({
      data: {
        listId: existing.listId,
        name: existing.name,
        details: existing.details,
        detailsDoc: existing.detailsDoc ?? undefined,
        detailsText: existing.detailsText,
        schemaVersion: existing.schemaVersion,
        dueDate: existing.dueDate,
        dueTimeMinutes: existing.dueTimeMinutes,
        dueDurationMinutes: existing.dueDurationMinutes,
        dueTimeZone: existing.dueTimeZone,
        calendarColor: existing.calendarColor,
        recurrenceRule: existing.recurrenceRule,
        recurrenceAnchor: existing.recurrenceAnchor,
        pinned: existing.pinned,
        important: existing.important,
        isNote: existing.isNote,
        parentId: existing.parentId,
        position: 0,
        completed: false,
      },
      select: restoredTaskSelect,
    });

    if (existing.tags.length > 0) {
      await tx.taskTag.createMany({
        data: existing.tags.map((entry) => ({
          taskId: created.id,
          tagId: entry.tagId,
        })),
        skipDuplicates: true,
      });
    }

    return created.id;
  });

  const duplicated = await prisma.task.findUniqueOrThrow({
    where: { id: duplicatedId },
    select: restoredTaskSelect,
  });

  revalidatePath("/");

  return {
    id: duplicated.id,
    name: duplicated.name,
    completed: duplicated.completed,
    details: duplicated.details,
    dueDate: duplicated.dueDate ? duplicated.dueDate.toISOString() : null,
    dueTimeMinutes: duplicated.dueTimeMinutes,
    dueDurationMinutes: duplicated.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(duplicated.dueTimeZone),
    calendarColor: duplicated.calendarColor ?? null,
    recurrenceRule: duplicated.recurrenceRule ?? null,
    priority: getPriorityFromTaskTags(duplicated.tags),
    pinned: Boolean(duplicated.pinned),
    important: Boolean(duplicated.important),
    isNote: Boolean(duplicated.isNote),
    parentId: duplicated.parentId ?? null,
    listId: duplicated.listId,
    labels: getLabelsFromTaskTags(duplicated.tags),
  };
}

export async function getArchivedTasks(): Promise<ArchivedTaskItem[]> {
  const tasks = await prisma.task.findMany({
    where: { deletedAt: { not: null } },
    orderBy: [{ deletedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isNote: true,
      deletedAt: true,
      list: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return tasks.map((task) => ({
    id: task.id,
    name: task.name,
    isNote: task.isNote,
    listId: task.list.id,
    listName: task.list.name,
    deletedAt: task.deletedAt!.toISOString(),
  }));
}

export async function restoreArchivedTask(
  taskId: string,
): Promise<RestoredTaskItem[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, parentId: true, deletedAt: true },
  });

  if (!task?.deletedAt) {
    throw new Error("Archived task not found");
  }

  const childIds = task.parentId
    ? []
    : (
        await prisma.task.findMany({
          where: { parentId: taskId, deletedAt: { not: null } },
          select: { id: true },
        })
      ).map((child) => child.id);
  const idsToRestore = [taskId, ...childIds];

  await prisma.task.updateMany({
    where: { id: { in: idsToRestore } },
    data: { deletedAt: null },
  });

  const restoredTasks = await prisma.task.findMany({
    where: { id: { in: idsToRestore } },
    select: restoredTaskSelect,
  });

  revalidatePath("/");

  return Promise.all(restoredTasks.map((item) => mapRestoredTaskRecord(item)));
}

export async function permanentlyDeleteArchivedTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, parentId: true, deletedAt: true },
  });

  if (!task?.deletedAt) {
    throw new Error("Archived task not found");
  }

  const childIds = task.parentId
    ? []
    : (
        await prisma.task.findMany({
          where: { parentId: taskId, deletedAt: { not: null } },
          select: { id: true },
        })
      ).map((child) => child.id);
  const idsToDelete = [taskId, ...childIds];

  await prisma.task.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  await Promise.all(idsToDelete.map((id) => deleteTaskImageDirectory(id)));

  revalidatePath("/");
}

export async function createSubtask(
  parentId: string,
  name: string,
): Promise<{ id: string; name: string; listId: string; parentId: string }> {
  const trimmed = name.trim();

  const parent = await prisma.task.findUnique({
    where: { id: parentId },
    select: { id: true, listId: true, parentId: true },
  });

  if (!parent) {
    throw new Error("Parent task not found");
  }

  if (parent.parentId) {
    throw new Error("Subtasks cannot have nested subtasks");
  }

  const task = await prisma.$transaction(async (tx) => {
    const siblingCount = await tx.task.count({
      where: { parentId },
    });

    return tx.task.create({
      data: {
        listId: parent.listId,
        parentId,
        name: trimmed,
        position: siblingCount,
        important: false,
      },
      select: {
        id: true,
        name: true,
        listId: true,
        parentId: true,
      },
    });
  });

  revalidatePath("/");
  return {
    id: task.id,
    name: task.name,
    listId: task.listId,
    parentId: task.parentId!,
  };
}
