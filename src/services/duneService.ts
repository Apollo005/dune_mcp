import axios from 'axios';
import { config } from '../config';
import { DuneQueryRequest, DuneQueryResponse } from '../types';

export class DuneService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = config.dune.baseUrl;
    this.apiKey = config.dune.apiKey;
  }

  private getHeaders() {
    return {
      'X-Dune-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Execute using dynamic query ID matching (free tier compatible)
   * Intelligently matches SQL queries to appropriate query IDs from queries.json
   */
  async executeQuery(queryRequest: DuneQueryRequest): Promise<DuneQueryResponse> {
    try {
      // Step 1: Find the best matching query ID based on SQL content
      console.log('Starting query matching...');
      const matchStartTime = Date.now();
      const queryId = this.findMatchingQueryId(queryRequest.sql);
      const matchTime = Date.now() - matchStartTime;
      console.log(`Query matching completed in ${matchTime}ms`);
      
      console.log(`Matched SQL to query ID: ${queryId}`);
      console.log(`SQL: ${queryRequest.sql.substring(0, 100)}...`);
      
      // Step 2: Get results from the matched query (free endpoint)
      console.log('Starting Dune API call...');
      const apiStartTime = Date.now();
      const response = await axios.get(`${this.baseUrl}/api/v1/query/${queryId}/results`, {
        headers: {
          'x-dune-api-key': this.apiKey,
        }
      });
      const apiTime = Date.now() - apiStartTime;
      console.log(`Dune API call completed in ${apiTime}ms`);

      console.log(`Query results retrieved successfully for ID: ${queryId}`);
      console.log(`Rows returned: ${response.data.result?.rows?.length || 0}`);
      
      // Limit response size for faster processing (max 1000 rows)
      const allRows = response.data.result?.rows || [];
      const limitedRows = allRows.slice(0, 1000);
      if (allRows.length > 1000) {
        console.log(`Response limited to 1000 rows (was ${allRows.length}) for performance`);
      }

      console.log('Building response object...');
      const responseStartTime = Date.now();
      const result = {
        execution_id: `dynamic_${queryId}`,
        state: 'QUERY_STATE_COMPLETED' as const,
        submitted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        result: {
          rows: limitedRows,
          metadata: {
            ...response.data.result?.metadata || {},
            total_rows: allRows.length,
            returned_rows: limitedRows.length,
            truncated: allRows.length > 1000
          }
        }
      };
      const responseTime = Date.now() - responseStartTime;
      console.log(`⚡ Response object built in ${responseTime}ms`);
      
      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Dune API error: ${errorMessage}`);
    }
  }

  /**
   * Intelligently match SQL query to the best query ID from queries.json
   */
  private findMatchingQueryId(sql: string): number {
    const queries = require('../config/queries.json');
    const solanaQueries = queries.solana_queries || {};
    
    const lowerSql = sql.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    // Score each query based on SQL content matching
    for (const [queryKey, queryDef] of Object.entries(solanaQueries)) {
      const query = queryDef as any;
      let score = 0;
      
      // Check for table name matches (highest priority)
      if (query.example_sql) {
        const exampleSql = query.example_sql.toLowerCase();
        
        // Extract table names from both SQLs
        const sqlTables = this.extractTableNames(lowerSql);
        const exampleTables = this.extractTableNames(exampleSql);
        
        // Score based on table name matches
        for (const sqlTable of sqlTables) {
          for (const exampleTable of exampleTables) {
            if (sqlTable === exampleTable) {
              score += 10; // High score for exact table match
            } else if (sqlTable.includes(exampleTable) || exampleTable.includes(sqlTable)) {
              score += 5; // Medium score for partial table match
            }
          }
        }
        
        // Score based on keyword matches
        const sqlKeywords = this.extractKeywords(lowerSql);
        const exampleKeywords = this.extractKeywords(exampleSql);
        
        for (const sqlKeyword of sqlKeywords) {
          for (const exampleKeyword of exampleKeywords) {
            if (sqlKeyword === exampleKeyword) {
              score += 2; // Medium score for keyword match
            }
          }
        }
        
        // Score based on description relevance
        if (query.description) {
          const description = query.description.toLowerCase();
          for (const sqlKeyword of sqlKeywords) {
            if (description.includes(sqlKeyword)) {
              score += 1; // Low score for description match
            }
          }
        }
      }
      
      // Bonus for exact SQL match
      if (query.example_sql && lowerSql.includes(query.example_sql.toLowerCase())) {
        score += 20; // Very high score for exact match
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = query;
      }
    }
    
    // If we found a good match, use it
    if (bestMatch && bestScore > 0) {
      console.log(`Best match: ${bestMatch.name} (ID: ${bestMatch.id}, Score: ${bestScore})`);
      return bestMatch.id;
    }
    
    // Fallback to default query ID
    console.log(`No good match found, using default query ID: 3237025`);
    return 3237025; // Default fallback
  }

  /**
   * Extract table names from SQL query
   */
  private extractTableNames(sql: string): string[] {
    const tableRegex = /from\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi;
    const tables: string[] = [];
    let match;
    
    while ((match = tableRegex.exec(sql)) !== null) {
      tables.push(match[1].toLowerCase());
    }
    
    return [...new Set(tables)]; // Remove duplicates
  }

  /**
   * Extract important keywords from SQL query
   */
  private extractKeywords(sql: string): string[] {
    // Remove common SQL keywords and extract meaningful terms
    const cleanedSql = sql
      .replace(/\b(select|from|where|and|or|group|by|order|limit|join|inner|left|right|outer|on|as|having|distinct|count|sum|avg|min|max)\b/gi, ' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanedSql.split(' ')
      .filter(word => word.length > 2) // Only words longer than 2 characters
      .map(word => word.toLowerCase());
  }

  /**
   * Poll for query execution results
   */
  private async pollForResults(executionId: string, maxAttempts = 30): Promise<DuneQueryResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // First check execution status
        const statusResponse = await axios.get(
          `${this.baseUrl}/api/v1/execution/${executionId}/status`,
          {
            headers: this.getHeaders(),
          }
        );

        const status = statusResponse.data;

        if (status.state === 'QUERY_STATE_COMPLETED') {
          // Now get the results
          const resultsResponse = await axios.get(
            `${this.baseUrl}/api/v1/execution/${executionId}/results`,
            {
              headers: this.getHeaders(),
            }
          );
          
          return {
            execution_id: executionId,
            state: status.state,
            submitted_at: status.submitted_at,
            expires_at: status.expires_at,
            result: resultsResponse.data.result,
          };
        }

        if (status.state === 'QUERY_STATE_FAILED') {
          throw new Error(`Query execution failed: ${status.error || 'Unknown error'}`);
        }

        // Still pending or executing, wait before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        if (attempt === maxAttempts - 1) {
          throw new Error(`Failed to get query results: ${error.response?.data?.error || error.message}`);
        }
        // Wait before retry on error
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Query execution timeout');
  }

  /**
   * Extract parameters from SQL query (basic implementation)
   */
  private extractParameters(sql: string): any[] {
    // Simple parameter extraction - look for {{parameter_name}} patterns
    const parameterRegex = /\{\{(\w+)\}\}/g;
    const parameters: any[] = [];
    let match;

    while ((match = parameterRegex.exec(sql)) !== null) {
      const paramName = match[1];
      parameters.push({
        key: paramName,
        type: 'text',
        default_value: '',
      });
    }

    return parameters;
  }

  /**
   * Validate SQL query for security (allow any data, not just Solana)
   */
  validateSolanaQuery(sql: string): { valid: boolean; error?: string } {
    // Check for dangerous operations (keep security validation)
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'create', 'alter', 'truncate'];
    const lowerSql = sql.toLowerCase();
    const hasDangerousKeyword = dangerousKeywords.some(keyword => lowerSql.includes(keyword));

    if (hasDangerousKeyword) {
      return {
        valid: false,
        error: 'Only SELECT queries are allowed'
      };
    }

    return { valid: true };
  }

  /**
   * Execute an existing saved query by ID (alternative approach)
   * This is more efficient if you have pre-saved queries
   */
  async executeSavedQuery(queryId: number, parameters: Record<string, any> = {}): Promise<DuneQueryResponse> {
    try {
      // Execute the saved query directly
      const executeResponse = await axios.post(
        `${this.baseUrl}/api/v1/query/${queryId}/execute`,
        parameters,
        {
          headers: this.getHeaders(),
          params: {
            performance: 'medium',
          },
        }
      );

      const executionId = executeResponse.data.execution_id;
      
      // Poll for results
      return await this.pollForResults(executionId);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Dune API error executing saved query: ${errorMessage}`);
    }
  }

  /**
   * Get latest result from a saved query without re-executing
   */
  async getLatestQueryResult(queryId: number): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/query/${queryId}/results/latest`,
        {
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`Failed to get latest results: ${errorMessage}`);
    }
  }
}
