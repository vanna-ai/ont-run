import { defineOntology, userContext, fieldFrom } from 'ont-run';
import { z } from 'zod';

// Shared schemas
const accountTypeSchema = z.enum(['ai', 'human']);
const mediaTypeSchema = z.enum(['text', 'markdown', 'video', 'audio']);
const preferenceTargetTypeSchema = z.enum(['post', 'account', 'topic', 'series']);
const preferenceValueSchema = z.enum(['more', 'less']);

// User context schema for authenticated users
const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  type: accountTypeSchema,
});

export default defineOntology({
  name: 'wowie-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  auth: async (req) => {
    const token = req.headers.get('Authorization');

    if (!token) {
      return { groups: ['public'] };
    }

    // Admin access
    if (token.startsWith('admin:')) {
      return {
        groups: ['admin', 'user', 'public'],
        user: { id: 'admin-1', email: 'admin@wowie.com', type: 'human' as const },
      };
    }

    // Regular authenticated user
    // In production, this would verify JWT and fetch user data
    return {
      groups: ['user', 'public'],
      user: { id: 'user-placeholder', email: 'user@example.com', type: 'human' as const },
    };
  },

  accessGroups: {
    public: { description: 'Unauthenticated users - can browse content' },
    user: { description: 'Authenticated human users - can save posts and set preferences' },
    admin: { description: 'Administrators - full access to create and manage content' },
  },

  entities: {
    Account: {
      description: 'User account - either AI (content creator) or human (consumer)',
    },
    Post: {
      description: 'Content post created by an AI account within a series',
    },
    Topic: {
      description: 'Content topic/category for organizing posts',
    },
    Series: {
      description: 'Content series owned by an AI account with generation prompts',
    },
    UserPreference: {
      description: 'User preference for seeing more or less of specific content',
    },
    SavedPost: {
      description: 'Bookmarked post saved by a human user',
    },
  },

  functions: {
    // ==================== PUBLIC ACCESS ====================

    healthCheck: {
      description: 'Check API health status',
      access: ['public', 'user', 'admin'],
      entities: [],
      inputs: z.object({}),
      resolver: './resolvers/healthCheck.ts',
    },

    getPosts: {
      description: 'Get a list/feed of posts with optional filters',
      access: ['public', 'user', 'admin'],
      entities: ['Post', 'Account', 'Series', 'Topic'],
      inputs: z.object({
        topicId: z.string().optional(),
        seriesId: z.string().optional(),
        accountId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
      resolver: './resolvers/getPosts.ts',
    },

    getPost: {
      description: 'Get a single post by ID',
      access: ['public', 'user', 'admin'],
      entities: ['Post', 'Account', 'Series', 'Topic'],
      inputs: z.object({
        postId: z.string(),
      }),
      resolver: './resolvers/getPost.ts',
    },

    getAccount: {
      description: 'Get AI account details (public profiles)',
      access: ['public', 'user', 'admin'],
      entities: ['Account'],
      inputs: z.object({
        accountId: z.string().optional(),
        username: z.string().optional(),
      }).refine(data => data.accountId || data.username, {
        message: 'Either accountId or username must be provided',
      }),
      resolver: './resolvers/getAccount.ts',
    },

    getSeries: {
      description: 'Get series details with its posts',
      access: ['public', 'user', 'admin'],
      entities: ['Series', 'Post', 'Account'],
      inputs: z.object({
        seriesId: z.string(),
        includeRecentPosts: z.boolean().default(true),
        postLimit: z.number().int().min(1).max(50).default(10),
      }),
      resolver: './resolvers/getSeries.ts',
    },

    getTopic: {
      description: 'Get topic details with related posts',
      access: ['public', 'user', 'admin'],
      entities: ['Topic', 'Post'],
      inputs: z.object({
        topicId: z.string().optional(),
        name: z.string().optional(),
        includeRecentPosts: z.boolean().default(true),
        postLimit: z.number().int().min(1).max(50).default(10),
      }).refine(data => data.topicId || data.name, {
        message: 'Either topicId or name must be provided',
      }),
      resolver: './resolvers/getTopic.ts',
    },

    getTopics: {
      description: 'List all available topics',
      access: ['public', 'user', 'admin'],
      entities: ['Topic'],
      inputs: z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
      resolver: './resolvers/getTopics.ts',
    },

    // Option providers for fieldFrom references
    getTopicOptions: {
      description: 'Get all topics as field options',
      access: ['admin'],
      entities: ['Topic'],
      inputs: z.object({}),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: './resolvers/getTopicOptions.ts',
    },

    searchAIAccounts: {
      description: 'Search AI accounts for selection',
      access: ['admin'],
      entities: ['Account'],
      inputs: z.object({
        query: z.string(),
      }),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: './resolvers/searchAIAccounts.ts',
    },

    searchSeriesForAccount: {
      description: 'Search series for a specific AI account',
      access: ['admin'],
      entities: ['Series'],
      inputs: z.object({
        query: z.string(),
        accountId: z.string().optional(),
      }),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: './resolvers/searchSeriesForAccount.ts',
    },

    // ==================== USER ACCESS (Authenticated) ====================

    register: {
      description: 'Create a new human account with email verification',
      access: ['public', 'user', 'admin'],
      entities: ['Account'],
      inputs: z.object({
        email: z.string().email(),
        displayName: z.string().min(1).max(100).optional(),
      }),
      resolver: './resolvers/register.ts',
    },

    verifyCode: {
      description: 'Confirm email verification code to complete registration',
      access: ['public', 'user', 'admin'],
      entities: ['Account'],
      inputs: z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }),
      resolver: './resolvers/verifyCode.ts',
    },

    setPreference: {
      description: 'Set preference to see more or less of a specific target',
      access: ['user', 'admin'],
      entities: ['UserPreference', 'Account', 'Post', 'Topic', 'Series'],
      inputs: z.object({
        targetType: preferenceTargetTypeSchema,
        targetId: z.string(),
        preference: preferenceValueSchema,
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/setPreference.ts',
    },

    savePost: {
      description: 'Bookmark a post for later',
      access: ['user', 'admin'],
      entities: ['SavedPost', 'Post'],
      inputs: z.object({
        postId: z.string(),
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/savePost.ts',
    },

    unsavePost: {
      description: 'Remove a post from bookmarks',
      access: ['user', 'admin'],
      entities: ['SavedPost'],
      inputs: z.object({
        postId: z.string(),
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/unsavePost.ts',
    },

    getSavedPosts: {
      description: "List the current user's saved/bookmarked posts",
      access: ['user', 'admin'],
      entities: ['SavedPost', 'Post'],
      inputs: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/getSavedPosts.ts',
    },

    getForYouFeed: {
      description: 'Get personalized feed based on user preferences',
      access: ['user', 'admin'],
      entities: ['Post', 'UserPreference', 'Account', 'Series', 'Topic'],
      inputs: z.object({
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/getForYouFeed.ts',
    },

    searchPosts: {
      description: 'Search posts by text query',
      access: ['user', 'admin'],
      entities: ['Post', 'Account', 'Series', 'Topic'],
      inputs: z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/searchPosts.ts',
    },

    getSimilarPosts: {
      description: 'Get posts similar to a given post',
      access: ['user', 'admin'],
      entities: ['Post', 'Account', 'Series', 'Topic'],
      inputs: z.object({
        postId: z.string(),
        limit: z.number().int().min(1).max(50).default(10),
        currentUser: userContext(authenticatedUserSchema),
      }),
      resolver: './resolvers/getSimilarPosts.ts',
    },

    // ==================== ADMIN ACCESS ====================

    createAccount: {
      description: 'Create a new AI account for content generation',
      access: ['admin'],
      entities: ['Account'],
      inputs: z.object({
        type: z.literal('ai'),
        email: z.string().email(),
        username: z.string()
          .min(3)
          .max(30)
          .regex(/^[a-z0-9_-]+$/, 'Username must be URL-friendly (lowercase letters, numbers, hyphens, underscores)'),
        displayName: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(1000),
        pic: z.string().url().optional(),
      }),
      resolver: './resolvers/createAccount.ts',
    },

    createSeries: {
      description: 'Create a new content series for an AI account',
      access: ['admin'],
      entities: ['Series', 'Account'],
      inputs: z.object({
        accountId: fieldFrom('searchAIAccounts'),
        name: z.string().min(1).max(200),
        shortDescription: z.string().min(1).max(500),
        topicGenerationPrompt: z.string().min(1).max(5000),
        contentGenerationPrompt: z.string().min(1).max(5000),
      }),
      resolver: './resolvers/createSeries.ts',
    },

    createPost: {
      description: 'Create a new post in a series',
      access: ['admin'],
      entities: ['Post', 'Account', 'Series', 'Topic'],
      inputs: z.object({
        accountId: fieldFrom('searchAIAccounts'),
        seriesId: fieldFrom('searchSeriesForAccount'),
        mediaType: mediaTypeSchema,
        topicIds: z.array(fieldFrom('getTopicOptions')).min(1).max(10),
        title: z.string().min(1).max(200),
        shortDescription: z.string().min(1).max(500),
        contents: z.string().min(1),
        mediaUrl: z.string().url().optional(),
      }),
      resolver: './resolvers/createPost.ts',
    },

    createTopic: {
      description: 'Create a new topic for categorizing posts',
      access: ['admin'],
      entities: ['Topic'],
      inputs: z.object({
        name: z.string().min(1).max(100),
      }),
      resolver: './resolvers/createTopic.ts',
    },

    deletePost: {
      description: 'Delete a post by ID',
      access: ['admin'],
      entities: ['Post', 'SavedPost'],
      inputs: z.object({
        postId: z.string(),
      }),
      resolver: './resolvers/deletePost.ts',
    },

    deleteAccount: {
      description: 'Delete an account and all associated content',
      access: ['admin'],
      entities: ['Account', 'Post', 'Series', 'SavedPost', 'UserPreference'],
      inputs: z.object({
        accountId: z.string(),
      }),
      resolver: './resolvers/deleteAccount.ts',
    },
  },
});
