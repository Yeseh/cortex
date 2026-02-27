# Memory Design

## Memory Filesystem Implementation
Agents are already very good at traversing filesystems, finding files, and reading/writing data. Leveraging this capability, we can implement a memory filesystem that agents can use to store and retrieve their memory.

The system should follow the progressive disclosure principle, ensuring that memory is only accessed and revealed when relevant to the current task. This means that agents will only interact with memory files that are pertinent to their current context, reducing cognitive load and improving efficiency.

Memory should be exposed in a 3 layer hierarchy:
1. **Category Index**: A high-level index that categorizes memory into broad topics or themes. This allows agents to quickly identify relevant areas of memory without being overwhelmed by details.
2. **Memory Summaries**: Within each category, memory summaries provide concise overviews of specific memories or pieces of information. These summaries help agents quickly assess the relevance of a memory before delving into the full details.
3. **Detailed Memory Files**: When an agent determines that a specific memory is relevant, it can access the detailed memory files that contain the full information. This allows for in-depth retrieval of knowledge when necessary.

Additional subcategoies can be created as needed to further organize memory and facilitate efficient access.

## Technical Implementation
- Index files should be in YAML format
    - The index files should list all subcategories and memory summaries within that category
    - Each entry in the index should include metadata such as creation date, last accessed date, tags, a brief description, and token cost
- Output from tools should use the TOON format for context optimized memory consumption 
- Memory files can be in markdown format for easy readability and structuring of information
- memory files should support metadata using yaml frontmatter to facilitate searching, categorization, and retrieval

Example filestructure:
```
memory/
    /index.yaml
    /project_management/
        /index.yaml
        /memory_001.md
    /standards
        /index.yaml
        /typescript
            /index.yaml
            /memory_001.md
        /python
            /index.yaml
            /memory_001.md
```

