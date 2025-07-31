import { Subtask } from '../types/subtaskSchema';
import { ValidationResult, ValidationConfig } from '../types/executionTypes';
export declare class Validator {
    private embeddings;
    validateOutput(subtask: Subtask, output: string): ValidationResult;
    private executeRule;
    private executeSchemaRule;
    private executeRegexRule;
    private executeSemanticRule;
    private executeCustomRule;
    private executeBuiltinCustomFunction;
    private validateWordCount;
    private validateKeywords;
    private validateSentiment;
    private validateCodeBlocks;
    private validateUrls;
    private validateAgainstSchema;
    private calculateSimpleSimilarity;
    private getValidationConfig;
    static createDefaultValidation(subtaskType: string): ValidationConfig;
}
//# sourceMappingURL=validator.d.ts.map