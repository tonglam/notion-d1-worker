// AI Service Configuration Types
export interface DeepSeekConfig {
  LIMITS: {
    MAX_INPUT_TOKENS: number;
    MAX_OUTPUT_TOKENS: number;
  };
}

export interface DashScopeConfig {
  BASE_URL: string;
  ENDPOINTS: {
    IMAGE_SYNTHESIS: string;
    TASK_STATUS: (taskId: string) => string;
  };
  MODELS: {
    IMAGE: string;
  };
  DEFAULT_CONFIG: {
    IMAGE: {
      SIZE: string;
      COUNT: number;
      MAX_ATTEMPTS: number;
      CHECK_INTERVAL: number;
    };
  };
  LIMITS: {
    MAX_PROMPT_LENGTH: number;
    MAX_CONCURRENT_TASKS: number;
    MAX_REQUESTS_PER_SECOND: number;
    MAX_REQUESTS_PER_MINUTE: number;
  };
}

// AI Service Types
export interface AIServiceConfig {
  dashscopeApiKey: string;
  maxAttempts?: number;
  checkInterval?: number;
}

// DashScope Types
export interface DashScopeErrorResponse {
  code: string;
  message: string;
  request_id: string;
}

export interface DashScopeTaskMetrics {
  TOTAL: number;
  SUCCEEDED: number;
  FAILED: number;
}

export interface DashScopeImageResult {
  orig_prompt: string;
  actual_prompt: string;
  url: string;
}

export interface DashScopeTaskStatusResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: "PENDING" | "SUCCEEDED" | "FAILED";
    submit_time?: string;
    scheduled_time?: string;
    end_time?: string;
    results?: DashScopeImageResult[];
    task_metrics?: DashScopeTaskMetrics;
    code?: string;
    message?: string;
    error?: string;
  };
  usage: {
    image_count: number;
  };
}

export interface DashScopeCreateTaskResponse {
  request_id: string;
  output: {
    task_status: "PENDING";
    task_id: string;
  };
}

export type DashScopeResponse =
  | DashScopeCreateTaskResponse
  | DashScopeTaskStatusResponse
  | DashScopeErrorResponse;

// Task Types
export interface CreateTaskResult {
  taskId?: string;
  error?: string;
}

export interface TaskStatusResult {
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  imageUrl?: string;
  error?: string;
}

// Generation Types
export interface GenerationResult<T> {
  data?: T;
  error?: string;
}

export interface ImageResult {
  image_url?: string;
  r2_image_url?: string;
  task_id?: string;
}

export interface DeepSeekResult {
  text: string;
  reasoning?: string;
}
