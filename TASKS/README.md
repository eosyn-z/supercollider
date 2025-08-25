# TASKS Folder

This folder contains user-edited and saved tasks that have been modified from their default templates.

## Structure

Tasks are organized by project and category:
- `project_[id]/` - Tasks specific to a project
- `custom/` - User-created custom tasks
- `modified/` - Modified versions of default tasks

## File Format

Each task is saved as a JSON file with the following structure:
- Original template reference
- Modification timestamp
- User modifications
- Version history (optional)

## Usage

When a user edits a task from TASKDEFAULTS:
1. The modified task is saved here
2. Original template reference is maintained
3. User can reset to defaults at any time
4. Modified tasks take precedence over defaults