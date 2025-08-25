import { invokeWithFallback as invoke } from './tauriWrapper';

// Task-related type definitions
export interface Task {
  task_id: string;
  type: string;
  capability: string;
  description: string;
  preamble: string;
  token_limit: number;
  dependencies?: string[];
  input_chain?: string[];
  metadata?: Record<string, any>;
  default_priority?: number;
  priority_override?: number;
  manual_agent_override?: string;
  approval_required?: boolean;
  clarity_prompt?: string;
  template_source?: string;
  modified?: boolean;
  last_modified?: string;
  oneshot_count?: number;
}

export interface TaskCreateRequest {
  project_id: string;
  task: Task;
}

export interface TaskCreateResponse {
  ok: boolean;
  task_id?: string;
  error?: string;
}

export interface TaskUpdateRequest {
  project_id: string;
  task_id: string;
  partial: Partial<Task>;
}

export interface TaskListResponse {
  ok: boolean;
  tasks: Task[];
  error?: string;
}

export interface TaskDefaultsResponse {
  [key: string]: Task;
}

export interface OkResponse {
  ok: boolean;
  error?: string;
}

// Task command wrappers
export async function createTask(projectId: string, task: Task): Promise<TaskCreateResponse> {
  try {
    return await invoke<TaskCreateResponse>('tasks_create', {
      project_id: projectId,
      task
    });
  } catch (error) {
    console.error('Failed to create task:', error);
    return { ok: false, error: String(error) };
  }
}

export async function updateTask(projectId: string, taskId: string, partial: Partial<Task>): Promise<OkResponse> {
  try {
    return await invoke<OkResponse>('tasks_update', {
      project_id: projectId,
      task_id: taskId,
      partial
    });
  } catch (error) {
    console.error('Failed to update task:', error);
    return { ok: false, error: String(error) };
  }
}

export async function deleteTask(projectId: string, taskId: string): Promise<OkResponse> {
  try {
    return await invoke<OkResponse>('tasks_delete', {
      project_id: projectId,
      task_id: taskId
    });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return { ok: false, error: String(error) };
  }
}

export async function listProjectTasks(projectId: string): Promise<TaskListResponse> {
  try {
    return await invoke<TaskListResponse>('tasks_list', {
      project_id: projectId
    });
  } catch (error) {
    console.error('Failed to list project tasks:', error);
    return { ok: false, tasks: [], error: String(error) };
  }
}

export async function listAllTasks(): Promise<TaskListResponse> {
  try {
    return await invoke<TaskListResponse>('tasks_list_all');
  } catch (error) {
    console.error('Failed to list all tasks:', error);
    return { ok: false, tasks: [], error: String(error) };
  }
}

export async function loadTaskDefaults(): Promise<TaskDefaultsResponse> {
  try {
    const response = await invoke<TaskDefaultsResponse>('load_task_defaults');
    return response;
  } catch (error) {
    console.error('Failed to load task defaults:', error);
    // Return empty defaults on error
    return {};
  }
}

export async function resetTaskToDefault(
  projectId: string,
  taskId: string,
  templateSource: string
): Promise<OkResponse> {
  try {
    return await invoke<OkResponse>('reset_task_to_default', {
      project_id: projectId,
      task_id: taskId,
      template_source: templateSource
    });
  } catch (error) {
    console.error('Failed to reset task to default:', error);
    return { ok: false, error: String(error) };
  }
}

// Batch operations
export async function batchCreateTasks(projectId: string, tasks: Task[]): Promise<TaskCreateResponse[]> {
  const results: TaskCreateResponse[] = [];
  
  for (const task of tasks) {
    const result = await createTask(projectId, task);
    results.push(result);
    
    // Stop on first error
    if (!result.ok) {
      console.error(`Batch task creation failed at task: ${task.description}`);
      break;
    }
  }
  
  return results;
}

export async function batchUpdateTasks(
  projectId: string,
  updates: Array<{ taskId: string; partial: Partial<Task> }>
): Promise<OkResponse[]> {
  const results: OkResponse[] = [];
  
  for (const update of updates) {
    const result = await updateTask(projectId, update.taskId, update.partial);
    results.push(result);
    
    // Continue even on error to attempt all updates
  }
  
  return results;
}

// Utility functions
export function validateTask(task: Partial<Task>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!task.description?.trim()) {
    errors.push('Task description is required');
  }
  
  if (!task.preamble?.trim()) {
    errors.push('Task preamble is required');
  }
  
  if (task.token_limit !== undefined) {
    if (task.token_limit < 100) {
      errors.push('Token limit must be at least 100');
    }
    if (task.token_limit > 10000) {
      errors.push('Token limit cannot exceed 10000');
    }
  }
  
  if (task.priority_override !== undefined) {
    if (task.priority_override < 1 || task.priority_override > 10) {
      errors.push('Priority override must be between 1 and 10');
    }
  }
  
  if (task.default_priority !== undefined) {
    if (task.default_priority < 1 || task.default_priority > 10) {
      errors.push('Default priority must be between 1 and 10');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isTaskModified(task: Task, defaultTask?: Task): boolean {
  if (!defaultTask) return true;
  
  return (
    task.description !== defaultTask.description ||
    task.preamble !== defaultTask.preamble ||
    task.token_limit !== defaultTask.token_limit ||
    task.capability !== defaultTask.capability ||
    task.type !== defaultTask.type ||
    JSON.stringify(task.metadata) !== JSON.stringify(defaultTask.metadata)
  );
}