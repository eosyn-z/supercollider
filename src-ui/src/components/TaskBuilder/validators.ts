import { z } from 'zod'

export const TaskSchema = z.object({
  type: z.enum(['code','text','image','sound','video','clarify','eval']),
  capability: z.enum(['code','text','image','sound','video','any']),
  deps: z.array(z.string()).default([]),
  input_chain: z.array(z.string()).default([]),
  input: z.any(),
  preamble: z.string().optional().nullable(),
  token_limit: z.number().int().positive().optional().nullable(),
  manual_agent_override: z.string().optional().nullable(),
  priority_override: z.number().int().optional().nullable(),
  approval_required: z.boolean().default(false),
  metadata: z.record(z.any()).optional().nullable(),
  clarity_prompt: z.string().optional().nullable(),
})

export type TaskInput = z.infer<typeof TaskSchema>
