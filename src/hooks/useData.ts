import useSWR from 'swr';
import { Bid, RFQ } from '@/types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

export function useBids() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<Bid[]>>(
    '/api/bids',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    bids: data?.data || [],
    isLoading,
    isError: error || !data?.success,
    timestamp: data?.timestamp,
    refresh: mutate,
  };
}

export function useRFQs() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<RFQ[]>>(
    '/api/rfqs',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  return {
    rfqs: data?.data || [],
    isLoading,
    isError: error || !data?.success,
    timestamp: data?.timestamp,
    refresh: mutate,
  };
}

export function useStats() {
  const { bids } = useBids();
  const { rfqs } = useRFQs();

  return {
    totalBids: bids.length,
    closingSoon: bids.filter(b => b.status === 'closing-soon').length,
    rfqsSent: rfqs.filter(r => r.status === 'sent').length,
    rfqsOverdue: rfqs.filter(r => r.status === 'overdue').length,
  };
}
