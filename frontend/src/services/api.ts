import axios from 'axios'

const API_BASE_URL = '/api'

export interface QueryRequest {
  sql: string
  signature?: string
}

export interface QueryResponse {
  success: boolean
  data?: {
    execution_id: string
    state: string
    submitted_at: string
    expires_at: string
    result: {
      rows: any[]
      metadata: any
    }
  }
  error?: string
  payment?: {
    signature: string
    amount: string
    status: string
  }
}

export interface HealthResponse {
  success: boolean
  data: {
    status: string
    timestamp: string
    version: string
    environment: string
  }
}

export interface InfoResponse {
  success: boolean
  data: {
    name: string
    version: string
    description: string
    pricing: {
      usdc: string
      sol: string
    }
    endpoints: string[]
  }
}

class ApiService {
  async executeQuery(query: string, signature?: string): Promise<QueryResponse> {
    try {
      console.log('API: Executing query with signature:', signature ? 'Yes' : 'No')
      
      const headers: any = {
        'Content-Type': 'application/json'
      }
      
      // Add signature to header if provided
      if (signature) {
        headers['X-Payment-Signature'] = signature
      }
      
      const response = await axios.post<QueryResponse>(`${API_BASE_URL}/query`, {
        sql: query
      }, { headers })
      
      console.log('API: Query successful:', response.data)
      return response.data
    } catch (error: any) {
      console.log('API: Query error:', error.response?.status, error.response?.data)
      if (error.response?.status === 402) {
        // Payment required - return a special response to trigger payment flow
        console.log('API: Payment required (402)')
        throw new Error('PAYMENT_REQUIRED')
      }
      throw new Error(error.response?.data?.error || 'Failed to execute query')
    }
  }

  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await axios.get<HealthResponse>(`${API_BASE_URL}/health`)
      return response.data
    } catch (error: any) {
      throw new Error('Failed to get health status')
    }
  }

  async getInfo(): Promise<InfoResponse> {
    try {
      const response = await axios.get<InfoResponse>(`${API_BASE_URL}/info`)
      return response.data
    } catch (error: any) {
      throw new Error('Failed to get API info')
    }
  }

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/query/validate`, {
        sql: query
      })
      return response.data
    } catch (error: any) {
      return {
        valid: false,
        error: error.response?.data?.error || 'Query validation failed'
      }
    }
  }
}

export const apiService = new ApiService()
