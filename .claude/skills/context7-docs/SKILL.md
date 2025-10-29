---
name: context7-docs
description: Look up official documentation, API references, code examples, and usage guides for any library, framework, or SDK using Context7. Use when the user asks about library documentation, API usage, how to use a package, or needs current version information for any technology.
---

# Context7 Documentation Lookup

This skill provides access to up-to-date official documentation for libraries, frameworks, and SDKs through the Context7 MCP server.

## When to Use This Skill

Automatically use this skill when the user:
- Asks "how do I use [library]?"
- Requests documentation for a package or framework
- Needs API reference information
- Asks about specific features or methods in a library
- Wants code examples or usage patterns
- Needs version-specific documentation
- Mentions keywords like: "docs", "documentation", "API", "how to use", "examples", "reference"

## How to Use Context7

### Step 1: Resolve the Library ID

First, use `resolve-library-id` to find the Context7-compatible library ID:

```
mcp__context7__resolve-library-id with libraryName: "react"
```

The tool returns a library ID in the format `/org/project` or `/org/project/version`.

**Skip this step ONLY if** the user explicitly provides a library ID in the format `/org/project` or `/org/project/version`.

### Step 2: Fetch Documentation

Use the library ID from Step 1 to fetch documentation:

```
mcp__context7__get-library-docs with:
- context7CompatibleLibraryID: "/facebook/react"
- topic: "hooks" (optional - focuses on specific topics)
- tokens: 5000 (optional - default is 5000, increase for more context)
```

## Selection Guidelines

When `resolve-library-id` returns multiple matches:

1. **Prioritize exact name matches** over partial matches
2. **Consider trust scores** - libraries with scores 7-10 are more authoritative
3. **Check documentation coverage** - higher Code Snippet counts indicate better docs
4. **Match user intent** - read descriptions to find the most relevant library

## Examples

### Example 1: Basic Library Lookup
User: "How do I use React hooks?"

1. Call `resolve-library-id` with libraryName: "react"
2. Select the most relevant library ID (e.g., `/facebook/react`)
3. Call `get-library-docs` with context7CompatibleLibraryID: `/facebook/react` and topic: "hooks"
4. Present the documentation and code examples to the user

### Example 2: Specific Version
User: "Show me Next.js 14 routing documentation"

1. Call `resolve-library-id` with libraryName: "next.js"
2. Look for version 14 in the results or use `/vercel/next.js/v14.x.x`
3. Call `get-library-docs` with topic: "routing"
4. Present the documentation

### Example 3: User Provides Library ID
User: "Get docs for /mongodb/docs on aggregation"

1. **Skip resolve-library-id** since user provided the ID
2. Call `get-library-docs` directly with:
   - context7CompatibleLibraryID: `/mongodb/docs`
   - topic: "aggregation"
3. Present the documentation

## Best Practices

- **Always resolve first** unless the user provides a library ID
- **Use topic parameter** to narrow down large documentation sets
- **Adjust tokens** if you need more comprehensive documentation (up to ~10000)
- **Present clearly** - extract relevant code examples and explanations
- **Acknowledge limitations** - if no good matches exist, suggest query refinements

## Common Libraries

Some frequently used libraries:
- React: `/facebook/react`
- Next.js: `/vercel/next.js`
- MongoDB: `/mongodb/docs`
- Supabase: `/supabase/supabase`
- And many more available through `resolve-library-id`

## Error Handling

If `resolve-library-id` returns no good matches:
1. Clearly state no matches were found
2. Suggest the user refine their query
3. Ask for more specific library name or alternative names

If `get-library-docs` fails:
1. Verify the library ID format is correct
2. Try without the topic parameter for broader results
3. Check if the library exists in Context7's database
