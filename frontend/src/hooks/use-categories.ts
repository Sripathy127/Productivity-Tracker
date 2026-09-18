import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from "@/api/categories";
import type { Category, CategoryCreateInput, CategoryUpdateInput } from "@/types/api";

export const categoryKeys = { all: ["categories"] as const };

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => fetchCategories(signal),
    // Categories change rarely; a long stale time keeps the timeline snappy.
    staleTime: 5 * 60_000,
  });
}

function useCategoryInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    // Deleting or recolouring a category changes how existing bars render.
    void queryClient.invalidateQueries({ queryKey: ["activities"] });
    void queryClient.invalidateQueries({ queryKey: ["activity-stats"] });
  };
}

export function useCreateCategory() {
  const invalidate = useCategoryInvalidation();
  return useMutation({
    mutationFn: (input: CategoryCreateInput) => createCategory(input),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useCategoryInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CategoryUpdateInput }) =>
      updateCategory(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useCategoryInvalidation();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
  });
}
