use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;
use serde_json::json;
use crate::models::{Project, ProjectType, Task, TaskStatus, Capability};
use crate::state::AppState;

pub struct TaskShredder {
    state: Arc<AppState>,
}

impl TaskShredder {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }
    
    pub async fn shred_project(&self, project: &Project) -> anyhow::Result<Vec<Task>> {
        let tasks = match &project.project_type {
            ProjectType::CodingProject => self.shred_coding_project(project),
            ProjectType::DataAnalysis => self.shred_data_analysis(project),
            ProjectType::Research => self.shred_research_project(project),
            ProjectType::Writing => self.shred_writing_project(project),
            ProjectType::Design => self.shred_design_project(project),
            ProjectType::Marketing => self.shred_marketing_project(project),
            ProjectType::Custom => self.shred_custom_project(project),
        };
        
        Ok(tasks)
    }
    
    fn shred_coding_project(&self, project: &Project) -> Vec<Task> {
        let mut tasks = Vec::new();
        let base_prompt = &project.prompt;
        
        // 1. Architecture Planning
        let arch_task = Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: "architecture".to_string(),
            capability: Capability::Text,
            status: TaskStatus::Queued,
            dependencies: vec![],
            input_chain: vec![],
            input: json!({
                "prompt": format!("Create a detailed architecture plan for: {}", base_prompt),
                "requirements": base_prompt
            }),
            output: None,
            preamble: Some("Design a modular, scalable architecture. Include component diagrams, data flow, and technology stack recommendations.".to_string()),
            token_limit: 2000,
            priority_override: Some(1),
            approval_required: true,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        };
        let arch_task_id = arch_task.id.clone();
        tasks.push(arch_task);
        
        // 2. Module Planning
        let module_task = Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: "module_planning".to_string(),
            capability: Capability::Text,
            status: TaskStatus::Blocked,
            dependencies: vec![arch_task_id.clone()],
            input_chain: vec![arch_task_id.clone()],
            input: json!({
                "prompt": "Break down the architecture into implementable modules",
            }),
            output: None,
            preamble: Some("Create detailed module specifications with clear interfaces and responsibilities.".to_string()),
            token_limit: 1500,
            priority_override: Some(2),
            approval_required: false,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        };
        let module_task_id = module_task.id.clone();
        tasks.push(module_task);
        
        // 3. Core Implementation
        let impl_task = Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: "core_implementation".to_string(),
            capability: Capability::Code,
            status: TaskStatus::Blocked,
            dependencies: vec![module_task_id.clone()],
            input_chain: vec![arch_task_id.clone(), module_task_id.clone()],
            input: json!({
                "prompt": "Implement the core modules",
                "language": "auto-detect",
            }),
            output: None,
            preamble: Some("Implement clean, well-documented code following best practices. Include error handling and logging.".to_string()),
            token_limit: 4000,
            priority_override: Some(3),
            approval_required: true,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        };
        let impl_task_id = impl_task.id.clone();
        tasks.push(impl_task);
        
        // 4. Unit Tests
        let test_task = Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: "unit_testing".to_string(),
            capability: Capability::Code,
            status: TaskStatus::Blocked,
            dependencies: vec![impl_task_id.clone()],
            input_chain: vec![impl_task_id.clone()],
            input: json!({
                "prompt": "Write comprehensive unit tests",
            }),
            output: None,
            preamble: Some("Create thorough unit tests with edge cases, mocks, and good coverage.".to_string()),
            token_limit: 2000,
            priority_override: Some(4),
            approval_required: false,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        };
        let test_task_id = test_task.id.clone();
        tasks.push(test_task);
        
        // 5. Documentation
        let doc_task = Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: "documentation".to_string(),
            capability: Capability::Text,
            status: TaskStatus::Blocked,
            dependencies: vec![impl_task_id.clone()],
            input_chain: vec![arch_task_id, module_task_id, impl_task_id],
            input: json!({
                "prompt": "Generate comprehensive documentation",
            }),
            output: None,
            preamble: Some("Create user-friendly documentation including API reference, usage examples, and setup guide.".to_string()),
            token_limit: 2500,
            priority_override: Some(5),
            approval_required: false,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        };
        tasks.push(doc_task);
        
        // 6. Final Review
        let review_task = Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: "review".to_string(),
            capability: Capability::Text,
            status: TaskStatus::Blocked,
            dependencies: vec![test_task_id, doc_task.id.clone()],
            input_chain: vec![],
            input: json!({
                "prompt": "Review the complete implementation",
            }),
            output: None,
            preamble: Some("Perform final review, suggest improvements, and ensure all requirements are met.".to_string()),
            token_limit: 1000,
            priority_override: Some(6),
            approval_required: true,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        };
        tasks.push(review_task);
        
        tasks
    }
    
    fn shred_data_analysis(&self, project: &Project) -> Vec<Task> {
        let mut tasks = Vec::new();
        
        // 1. Data Understanding
        tasks.push(self.create_task(
            project,
            "data_understanding",
            Capability::Text,
            vec![],
            "Analyze data requirements and identify sources",
            1500,
            Some(1),
        ));
        
        // 2. Data Preparation
        tasks.push(self.create_task(
            project,
            "data_preparation",
            Capability::Code,
            vec![tasks[0].id.clone()],
            "Clean, transform, and prepare data for analysis",
            2000,
            Some(2),
        ));
        
        // 3. Analysis
        tasks.push(self.create_task(
            project,
            "analysis",
            Capability::Code,
            vec![tasks[1].id.clone()],
            "Perform statistical analysis and generate insights",
            3000,
            Some(3),
        ));
        
        // 4. Visualization
        tasks.push(self.create_task(
            project,
            "visualization",
            Capability::Code,
            vec![tasks[2].id.clone()],
            "Create meaningful visualizations and charts",
            2000,
            Some(4),
        ));
        
        // 5. Report
        tasks.push(self.create_task(
            project,
            "report",
            Capability::Text,
            vec![tasks[2].id.clone(), tasks[3].id.clone()],
            "Generate comprehensive analysis report",
            2500,
            Some(5),
        ));
        
        tasks
    }
    
    fn shred_research_project(&self, project: &Project) -> Vec<Task> {
        let mut tasks = Vec::new();
        
        // 1. Literature Review
        tasks.push(self.create_task(
            project,
            "literature_review",
            Capability::Text,
            vec![],
            "Conduct comprehensive literature review",
            3000,
            Some(1),
        ));
        
        // 2. Hypothesis Formation
        tasks.push(self.create_task(
            project,
            "hypothesis",
            Capability::Text,
            vec![tasks[0].id.clone()],
            "Formulate research hypothesis and questions",
            1500,
            Some(2),
        ));
        
        // 3. Methodology
        tasks.push(self.create_task(
            project,
            "methodology",
            Capability::Text,
            vec![tasks[1].id.clone()],
            "Design research methodology",
            2000,
            Some(3),
        ));
        
        // 4. Analysis
        tasks.push(self.create_task(
            project,
            "analysis",
            Capability::Text,
            vec![tasks[2].id.clone()],
            "Analyze findings and draw conclusions",
            3000,
            Some(4),
        ));
        
        // 5. Paper Writing
        tasks.push(self.create_task(
            project,
            "paper",
            Capability::Text,
            vec![tasks[3].id.clone()],
            "Write research paper with citations",
            4000,
            Some(5),
        ));
        
        tasks
    }
    
    fn shred_writing_project(&self, project: &Project) -> Vec<Task> {
        let mut tasks = Vec::new();
        
        // 1. Outline
        tasks.push(self.create_task(
            project,
            "outline",
            Capability::Text,
            vec![],
            "Create detailed content outline",
            1000,
            Some(1),
        ));
        
        // 2. Draft
        tasks.push(self.create_task(
            project,
            "draft",
            Capability::Text,
            vec![tasks[0].id.clone()],
            "Write first draft",
            4000,
            Some(2),
        ));
        
        // 3. Edit
        tasks.push(self.create_task(
            project,
            "edit",
            Capability::Text,
            vec![tasks[1].id.clone()],
            "Edit and refine content",
            3000,
            Some(3),
        ));
        
        // 4. Polish
        tasks.push(self.create_task(
            project,
            "polish",
            Capability::Text,
            vec![tasks[2].id.clone()],
            "Final polish and formatting",
            2000,
            Some(4),
        ));
        
        tasks
    }
    
    fn shred_design_project(&self, project: &Project) -> Vec<Task> {
        let mut tasks = Vec::new();
        
        // 1. Concept
        tasks.push(self.create_task(
            project,
            "concept",
            Capability::Text,
            vec![],
            "Develop design concept and mood board",
            1500,
            Some(1),
        ));
        
        // 2. Wireframes
        tasks.push(self.create_task(
            project,
            "wireframes",
            Capability::Image,
            vec![tasks[0].id.clone()],
            "Create wireframes and layout",
            2000,
            Some(2),
        ));
        
        // 3. Visual Design
        tasks.push(self.create_task(
            project,
            "visual_design",
            Capability::Image,
            vec![tasks[1].id.clone()],
            "Create visual designs and mockups",
            3000,
            Some(3),
        ));
        
        // 4. Design System
        tasks.push(self.create_task(
            project,
            "design_system",
            Capability::Text,
            vec![tasks[2].id.clone()],
            "Document design system and guidelines",
            2000,
            Some(4),
        ));
        
        tasks
    }
    
    fn shred_marketing_project(&self, project: &Project) -> Vec<Task> {
        let mut tasks = Vec::new();
        
        // 1. Market Research
        tasks.push(self.create_task(
            project,
            "market_research",
            Capability::Text,
            vec![],
            "Conduct market research and competitor analysis",
            2500,
            Some(1),
        ));
        
        // 2. Strategy
        tasks.push(self.create_task(
            project,
            "strategy",
            Capability::Text,
            vec![tasks[0].id.clone()],
            "Develop marketing strategy",
            2000,
            Some(2),
        ));
        
        // 3. Content Creation
        tasks.push(self.create_task(
            project,
            "content",
            Capability::Text,
            vec![tasks[1].id.clone()],
            "Create marketing content and copy",
            3000,
            Some(3),
        ));
        
        // 4. Campaign Plan
        tasks.push(self.create_task(
            project,
            "campaign",
            Capability::Text,
            vec![tasks[2].id.clone()],
            "Design campaign execution plan",
            2000,
            Some(4),
        ));
        
        tasks
    }
    
    fn shred_custom_project(&self, project: &Project) -> Vec<Task> {
        // For custom projects, create a generic set of tasks
        let mut tasks = Vec::new();
        
        // 1. Analysis
        tasks.push(self.create_task(
            project,
            "analysis",
            Capability::Text,
            vec![],
            "Analyze requirements and create plan",
            2000,
            Some(1),
        ));
        
        // 2. Implementation
        tasks.push(self.create_task(
            project,
            "implementation",
            Capability::Text,
            vec![tasks[0].id.clone()],
            "Execute main project tasks",
            4000,
            Some(2),
        ));
        
        // 3. Review
        tasks.push(self.create_task(
            project,
            "review",
            Capability::Text,
            vec![tasks[1].id.clone()],
            "Review and finalize deliverables",
            1500,
            Some(3),
        ));
        
        tasks
    }
    
    fn create_task(
        &self,
        project: &Project,
        task_type: &str,
        capability: Capability,
        dependencies: Vec<String>,
        preamble: &str,
        token_limit: u32,
        priority: Option<i32>,
    ) -> Task {
        Task {
            id: self.generate_task_id(),
            project_id: project.id.clone(),
            task_type: task_type.to_string(),
            capability,
            status: if dependencies.is_empty() { TaskStatus::Queued } else { TaskStatus::Blocked },
            dependencies: dependencies.clone(),
            input_chain: dependencies,
            input: json!({
                "prompt": project.prompt.clone(),
                "task_type": task_type,
            }),
            output: None,
            preamble: Some(preamble.to_string()),
            token_limit,
            priority_override: priority,
            approval_required: priority.map_or(false, |p| p == 1),
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            error: None,
            retry_count: 0,
            updated_at: Utc::now(),
            metadata: None,
            user_edited: false,
            oneshot_count: 0,
        }
    }
    
    fn generate_task_id(&self) -> String {
        format!("task-{}", Uuid::new_v4())
    }
}