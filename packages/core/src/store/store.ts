import type { CategoryPath } from "@/category";
import type { CategoryMode } from "@/config/config";
import type { Slug } from "@/slug";

export type StoreName = Slug;

export type StoreCategory = {
    path: CategoryPath;
    description?: string;
    subcategories?: Record<string, StoreCategory>;
};

export type StoreCategories = Record<string, StoreCategory>;

export type Store = {
    name: StoreName;
    kind: string;
    categoryMode?: CategoryMode;
    description?: string | undefined;
    categories?: StoreCategories;
    properties?: Record<string, unknown>;
}

export type StoreData = Omit<Store, 'name'>;
export type Registry = {
    [storeName: string]: Store
}