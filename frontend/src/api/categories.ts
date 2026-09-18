import { request } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { Category, CategoryCreateInput, CategoryUpdateInput } from "@/types/api";

export function fetchCategories(signal?: AbortSignal): Promise<Category[]> {
  return request<Category[]>(endpoints.categories, { signal });
}

export function createCategory(input: CategoryCreateInput): Promise<Category> {
  return request<Category>(endpoints.categories, { method: "POST", body: input });
}

export function updateCategory(
  id: number,
  input: CategoryUpdateInput
): Promise<Category> {
  return request<Category>(endpoints.category(id), {
    method: "PATCH",
    body: input,
  });
}

export function deleteCategory(id: number): Promise<void> {
  return request<void>(endpoints.category(id), { method: "DELETE" });
}
