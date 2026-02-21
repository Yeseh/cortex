import type { CategoryPath } from "@/category";
import type { CategoryMode } from "@/config/config";
import type { Slug } from "@/slug";

export type StoreName = Slug;

export type StoreCategory = {
    path: CategoryPath;
    description?: string | undefined;
    subcategories?: StoreCategories;
};

export type StoreCategories = StoreCategory[];

export type Store = {
    name: StoreName;
    kind: string;
    categoryMode: CategoryMode;
    categories: StoreCategories;
    properties: Record<string, unknown>;
    description?: string | undefined;
}

export type StoreData = Omit<Store, 'name'>;