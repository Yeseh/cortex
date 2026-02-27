
# Cortex Features Big Design and braindump

## What should it do?
Cortex provides a harness for agents to perform complex tasks.

### Design Principles 
- Vendor and tool agnostic
- Progressive Disclosure: context should be revealed as needed, not all at once. 
   - This means that any and all knowledge and memory should be surfaced only when relevant to the current task.
   - Support multiple levels of context and detail, allowing agents to drill down into specific areas as needed.

### Core Features
- Enterprise memory
    - Self learning, adaptive memory
- Project management
- Session management
- Knowledge bases
- Agent subsystems

## Non-Goals
- 

## Technical Architecture
- Modular design: Each feature should be implemented as a separate module that can be easily added, removed, or replaced.
- API-first approach: All functionalities should be accessible via well-defined APIs to facilitate integration with other systems.
- Containerization: Use containerization (e.g., Docker) to ensure consistent deployment across different environments.

**Modules**:
- Memory Module
- Project Management Module
- Session Management Module

## Memory
Cortex should have a robust memory system that allows it to remember past interactions, user preferences, and important context over long periods. This memory should be:
- Persistent: Memory should be stored securely and persist across sessions.
- Contextual: Cortex should be able to recall relevant information based on the current context of the conversation.
- Configurable: Users should be able to manage what Cortex remembers and for how long.

### Memory backends

- Local storage: Store memory on the user's device for privacy.
    - Agents are already great at traversing filesystems, finding files, and reading/writing data. So this is a natural starting point

Eventually we can build
- SQLite database: Lightweight database for structured memory storage. Enables semantic/hybrid search with sqlite-vec capabilities.

## Coding Standards
The user should be able to specify coding standards for their projects. This includes:
- Indentation style (spaces vs tabs, number of spaces)
- Line length limits
- Naming conventions for variables, functions, classes, etc.
- Commenting standards (when and how to comment code)
- File and folder structure guidelines

Enforce with linters and formatters.
- Only relevant standards should be applied based on the programming language used in the project.
- Standards discovery:
    - Ask which area of the code should be analyzed
    - Use interviewing techniques to ask targeted questions about coding standards and opinions 
    - Record and remember standards for future use 

## Agent Subsystems
- An agent subsystem consists of multiple specialized agents that work together to accomplish complex tasks. Each agent has a specific role and expertise, allowing for a modular and scalable approach to problem-solving.
- A subsystem is controlled by a single "orchestrator" agent that coordinates the activities of the specialized agents and manages the workflow.


