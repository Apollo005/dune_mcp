import * as queries from '../config/queries.json';

export interface QueryDefinition {
  id: number;
  name: string;
  description: string;
  category: string;
  cost_credits: number;
  parameters: QueryParameter[];
  example_sql?: string;
}

export interface QueryParameter {
  name: string;
  type: 'text' | 'number' | 'boolean';
  default?: any;
  description: string;
}

export class QueryManager {
  private queries: Record<string, QueryDefinition>;

  constructor() {
    this.queries = (queries as any).solana_queries;
  }

  /**
   * Get all available queries
   */
  getAllQueries(): Record<string, QueryDefinition> {
    return this.queries;
  }

  /**
   * Get query by key
   */
  getQuery(key: string): QueryDefinition | null {
    return this.queries[key] || null;
  }

  /**
   * Get query by ID
   */
  getQueryById(id: number): { key: string; query: QueryDefinition } | null {
    for (const [key, query] of Object.entries(this.queries)) {
      if (query.id === id) {
        return { key, query };
      }
    }
    return null;
  }

  /**
   * Get queries by category
   */
  getQueriesByCategory(category: string): Record<string, QueryDefinition> {
    const filtered: Record<string, QueryDefinition> = {};
    for (const [key, query] of Object.entries(this.queries)) {
      if (query.category === category) {
        filtered[key] = query;
      }
    }
    return filtered;
  }

  /**
   * List all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    Object.values(this.queries).forEach(query => categories.add(query.category));
    return Array.from(categories);
  }

  /**
   * Validate parameters for a query
   */
  validateParameters(queryKey: string, parameters: Record<string, any>): { valid: boolean; errors: string[] } {
    const query = this.getQuery(queryKey);
    if (!query) {
      return { valid: false, errors: ['Query not found'] };
    }

    const errors: string[] = [];
    
    // Check for required parameters and type validation
    for (const param of query.parameters) {
      const value = parameters[param.name];
      
      if (value !== undefined) {
        // Type validation
        if (param.type === 'number' && isNaN(Number(value))) {
          errors.push(`Parameter '${param.name}' must be a number`);
        } else if (param.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter '${param.name}' must be a boolean`);
        }
      }
      // Note: All parameters are optional since they have defaults
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get default parameters for a query
   */
  getDefaultParameters(queryKey: string): Record<string, any> {
    const query = this.getQuery(queryKey);
    if (!query) return {};

    const defaults: Record<string, any> = {};
    query.parameters.forEach(param => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    });
    return defaults;
  }
}

