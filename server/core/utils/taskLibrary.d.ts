import { AtomicTask, AtomicTaskType, TaskSearchCriteria, TaskTemplate } from '../../../shared/types/atomicWorkflow';
export declare class TaskLibrary {
    private static taskTemplates;
    private static customTemplates;
    static getAtomicTask(taskId: string): AtomicTask | null;
    static searchTasks(criteria: TaskSearchCriteria): AtomicTask[];
    static createCustomTask(template: Partial<AtomicTask>): AtomicTask;
    static validateTaskCompatibility(task1: AtomicTask, task2: AtomicTask): boolean;
    static getTaskTemplate(templateId: string): TaskTemplate | null;
    static getAvailableTaskTypes(): AtomicTaskType[];
    static getTasksByCategory(category: string): AtomicTask[];
    private static initializeLibrary;
    private static initializeGenerationTasks;
    private static initializeProcessingTasks;
    private static initializeAnalysisTasks;
    private static initializeTransformationTasks;
    private static initializeCoordinationTasks;
    private static initializeOutputTasks;
    private static initializeCustomTemplates;
    private static addTask;
    private static cloneTask;
    private static matchesCriteria;
    private static sortSearchResults;
    private static areCompatibleTypes;
    private static generateTaskId;
    private static getDefaultRetryPolicy;
    private static getDefaultValidation;
    private static getCategoryForTask;
}
export default TaskLibrary;
//# sourceMappingURL=taskLibrary.d.ts.map