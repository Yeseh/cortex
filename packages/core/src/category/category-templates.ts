import type { ConfigCategories } from "@yeseh/cortex-core";

export const defaultGlobalStoreCategories: ConfigCategories = {
    admin: {
        description: "Meta category for managing the memory store",
    },
    human: {
        description: "Meta category for human-related information, such as user profiles, preferences, and communication style.",
        subcategories: {
            profile: {
                description: "User profiles, including names, roles, and contact information.",
            },
            preferences: {
                description: "User preferences for communication style, content format, and interaction frequency.",
            },
        },
    },
    agents: {
        description: "Information for AI agents, including their capabilities, personality, and interaction logs.",
        subcategories: {
            persona: {
                description: "Agent personas, detailing their characteristics, expertise, and communication style.",
            }
        }
    }
}!;

export const defaultProjectCategories: ConfigCategories = {
    admin: {
        description: "Meta category for managing the memory store",
    },
    tasks: {
        description: "Use for project management, task tracking, and to-do lists.",
    },
    standup: {
        description: "Daily standup notes, blockers, and progress updates.",
    },
    decisions: {
        description: "Key project decisions, rationale, and alternatives considered.",
    },
    standards: {
        description: "Standard operating procedures, guidelines, and best practices.",
        subcategories: {
            coding: {
                description: "Coding standards, style guides, and code review checklists. Subcategories may include specific language standards.",
            },
        },
    }
}!;