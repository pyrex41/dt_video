Commit current work, create a progress log, and update todo list and task-master.

Steps:

1. Check git status to see what files have changed
2. Review the changes to understand what work was done
3. Check current task-master status with `task-master list` to identify active tasks
4. Create a new progress log file in `log_docs/` with format `PROJECT_LOG_YYYY-MM-DD_description.md` containing:
   - Date and session summary
   - Changes made (organized by component/feature)
   - Task-master tasks completed or progressed
   - Current todo list status
   - Next steps
5. Update task-master subtasks with implementation notes using `task-master update-subtask --id=<id> --prompt="notes"` for any in-progress or completed work
6. Update todo list with TodoWrite to reflect:
   - Completed todos marked as done
   - Any new todos discovered during work
   - Current in-progress status
7. Stage all changes including the new progress log with `git add .`
8. Create a commit with a descriptive message following the format:
   ```
   <type>: <brief description>

   - Detail 1
   - Detail 2
   - Detail 3

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
9. Confirm the commit was successful with `git status`
10. Provide a summary to the user of:
    - What was committed
    - Progress log location
    - Task-master updates made
    - Todo list status

Notes:
- Use descriptive commit types: feat, fix, refactor, docs, test, chore
- Progress log should be comprehensive but concise
- Include code references with file:line format where relevant
- Update task-master with specific implementation details for future context
