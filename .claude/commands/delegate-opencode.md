Delegate a task to OpenCode for execution: $ARGUMENTS

This command runs OpenCode in non-interactive mode to handle tasks that may be better suited for a different AI workflow or require specific OpenCode features.

Steps:
1. Extract the task description from the arguments
2. Run `opencode run "$ARGUMENTS"` to execute the task in OpenCode
3. Display the output from OpenCode
4. If the task involves code generation or file modifications, verify the results

Usage examples:
- `/delegate-opencode Explain the authentication flow in this codebase`
- `/delegate-opencode Refactor the video processing module for better performance`
- `/delegate-opencode --model anthropic/claude-3-5-sonnet Add error handling to the webcam capture function`

Available flags:
- `--continue` or `-c`: Continue the last OpenCode session
- `--session <id>` or `-s <id>`: Continue a specific session
- `--share`: Share the session
- `--model <provider/model>` or `-m <provider/model>`: Specify model to use
- `--agent <name>`: Use a specific agent
