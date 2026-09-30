import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Note = Database["public"]["Tables"]["notes"]["Row"];
type Todo = Database["public"]["Tables"]["todos"]["Row"];
export type ProductivityEntity = "notes" | "todos";
export type PendingProductivityItem =
  | { entity: "notes"; row: Note }
  | { entity: "todos"; row: Todo };

const queueKey = (userId: string) => `credmais:productivity-queue:${userId}`;
const snapshotKey = (entity: ProductivityEntity, userId: string) =>
  `credmais:productivity-snapshot:${entity}:${userId}`;

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem espaço/modo privado: a tela continua utilizável durante a sessão.
  }
};

export const loadProductivitySnapshot = <T>(entity: ProductivityEntity, userId: string) =>
  read<T[]>(snapshotKey(entity, userId), []);

export const saveProductivitySnapshot = <T>(entity: ProductivityEntity, userId: string, rows: T[]) =>
  write(snapshotKey(entity, userId), rows);

export const loadProductivityQueue = (userId: string) =>
  read<PendingProductivityItem[]>(queueKey(userId), []);

export const queueOfflineNote = (userId: string, title: string): Note => {
  const row: Note = { id: crypto.randomUUID(), user_id: userId, title, created_at: new Date().toISOString() };
  write(queueKey(userId), [...loadProductivityQueue(userId), { entity: "notes", row }]);
  return row;
};

export const queueOfflineTodo = (userId: string, task: string): Todo => {
  const row: Todo = { id: crypto.randomUUID(), user_id: userId, task, is_complete: false, created_at: new Date().toISOString() };
  write(queueKey(userId), [...loadProductivityQueue(userId), { entity: "todos", row }]);
  return row;
};

export const flushProductivityQueue = async (userId: string) => {
  const queue = loadProductivityQueue(userId);
  if (!queue.length) return 0;
  const notes = queue.filter((item): item is Extract<PendingProductivityItem, { entity: "notes" }> => item.entity === "notes");
  const todos = queue.filter((item): item is Extract<PendingProductivityItem, { entity: "todos" }> => item.entity === "todos");
  const syncedIds = new Set<string>();

  if (notes.length) {
    const { error } = await supabase.from("notes").upsert(notes.map((item) => item.row), { onConflict: "id" });
    if (!error) notes.forEach((item) => syncedIds.add(item.row.id));
  }
  if (todos.length) {
    const { error } = await supabase.from("todos").upsert(todos.map((item) => item.row), { onConflict: "id" });
    if (!error) todos.forEach((item) => syncedIds.add(item.row.id));
  }

  if (syncedIds.size) {
    write(queueKey(userId), queue.filter((item) => !syncedIds.has(item.row.id)));
  }
  return syncedIds.size;
};
