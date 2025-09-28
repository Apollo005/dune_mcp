export interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  recipient: string;
  chain: string;
  timestamp: number;
  expiresAt: number;
}

export interface PaymentVerification {
  transactionHash: string;
  amount: number;
  sender: string;
  recipient: string;
  timestamp: number;
}

export interface DuneQueryRequest {
  sql: string;
  parameters?: Record<string, any>;
}

export interface DuneQueryResponse {
  execution_id: string;
  query_id?: number;
  state: 'QUERY_STATE_PENDING' | 'QUERY_STATE_EXECUTING' | 'QUERY_STATE_COMPLETED' | 'QUERY_STATE_FAILED';
  submitted_at: string;
  expires_at: string;
  result?: {
    rows: any[];
    metadata: {
      column_names: string[];
      result_set_bytes: number;
      total_row_count: number;
    };
  };
}

export interface X402Response {
  error: string;
  payment: {
    id: string;
    amount: string;
    currency: string;
    recipient: string;
    chain: string;
    expires_at: string;
    instructions: string;
  };
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  payment?: PaymentRequest;
}
