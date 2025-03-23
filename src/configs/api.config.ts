// Notion API Configuration
export const NOTION_API_CONFIG = {
  VERSION: "2022-06-28",
  RATE_LIMITS: {
    MAX_REQUESTS_PER_SECOND: 3,
    MAX_REQUESTS_PER_MINUTE: 90,
  },
} as const;

// DeepSeek API Configuration
export const DEEPSEEK_API_CONFIG = {
  MODELS: {
    CHAT: "deepseek-chat",
    REASONER: "deepseek-reasoner",
  },
  LIMITS: {
    MAX_INPUT_TOKENS: 32000,
    MAX_OUTPUT_TOKENS: 8000,
  },
} as const;

// DashScope API Configuration
export const DASHSCOPE_API_CONFIG = {
  BASE_URL: "https://dashscope.aliyuncs.com/api/v1",
  ENDPOINTS: {
    IMAGE_SYNTHESIS: "/services/aigc/text2image/image-synthesis",
    TASK_STATUS: (taskId: string) => `/tasks/${taskId}`,
  },
  MODELS: {
    IMAGE: "wanx2.1-t2i-turbo",
  },
  DEFAULT_CONFIG: {
    IMAGE: {
      SIZE: "1024*1024",
      COUNT: 1,
      MAX_ATTEMPTS: 30,
      CHECK_INTERVAL: 2000,
    },
  },
  LIMITS: {
    MAX_PROMPT_LENGTH: 1000,
    MAX_CONCURRENT_TASKS: 50,
    MAX_REQUESTS_PER_SECOND: 5,
    MAX_REQUESTS_PER_MINUTE: 100,
  },
} as const;
