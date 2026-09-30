import { afterEach, describe, expect, it } from "vitest";
import {
  loadProductivityQueue,
  loadProductivitySnapshot,
  queueOfflineNote,
  queueOfflineTodo,
  saveProductivitySnapshot,
} from "@/lib/offlineProductivity";

describe("offlineProductivity", () => {
  afterEach(() => localStorage.clear());

  it("isola a fila offline por usuário e mantém UUID para envio idempotente", () => {
    const note = queueOfflineNote("user-a", "Cobrar cliente amanhã");
    const todo = queueOfflineTodo("user-a", "Revisar contrato");

    expect(note.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(todo.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(loadProductivityQueue("user-a")).toHaveLength(2);
    expect(loadProductivityQueue("user-b")).toEqual([]);
  });

  it("preserva uma cópia local da última lista carregada", () => {
    const rows = [{ id: "n1", title: "Nota local" }];
    saveProductivitySnapshot("notes", "user-a", rows);
    expect(loadProductivitySnapshot("notes", "user-a")).toEqual(rows);
    expect(loadProductivitySnapshot("notes", "user-b")).toEqual([]);
  });
});
