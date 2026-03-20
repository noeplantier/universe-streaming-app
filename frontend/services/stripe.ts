import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface SubscriptionPlan {
  id: 'premium_monthly' | 'premium_annual';
  name: string;
  price: number;
  currency: string;
  period: 'month' | 'year';
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'premium_monthly',
    name: 'Premium Mensuel',
    price: 3.99,
    currency: 'EUR',
    period: 'month',
    features: ['Sans publicité', 'Qualité HD', 'Contenus exclusifs', 'Téléchargement offline', '4 appareils'],
  },
  {
    id: 'premium_annual',
    name: 'Premium Annuel',
    price: 39.99,
    currency: 'EUR',
    period: 'year',
    features: ['Sans publicité', 'Qualité HD', 'Contenus exclusifs', 'Téléchargement offline', '4 appareils', '2 mois offerts'],
  },
];

export interface CheckoutSession {
  url: string;
  session_id: string;
}

export interface PaymentStatus {
  status: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  metadata: Record<string, string>;
}

export const stripeService = {
  async createCheckoutSession(planId: string, userId: string, originUrl: string): Promise<CheckoutSession> {
    const response = await fetch(`${API_BASE}/api/payments/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        user_id: userId,
        origin_url: originUrl,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create checkout session');
    }
    
    return response.json();
  },

  async getPaymentStatus(sessionId: string): Promise<PaymentStatus> {
    const response = await fetch(`${API_BASE}/api/payments/status/${sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get payment status');
    }
    
    return response.json();
  },

  async pollPaymentStatus(
    sessionId: string,
    onSuccess: (status: PaymentStatus) => void,
    onError: (error: Error) => void,
    maxAttempts: number = 10,
    intervalMs: number = 2000
  ): Promise<void> {
    let attempts = 0;
    
    const poll = async () => {
      try {
        const status = await this.getPaymentStatus(sessionId);
        
        if (status.payment_status === 'paid') {
          onSuccess(status);
          return;
        }
        
        if (status.status === 'expired') {
          onError(new Error('Payment session expired'));
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, intervalMs);
        } else {
          onError(new Error('Payment status check timed out'));
        }
      } catch (error: any) {
        onError(error);
      }
    };
    
    poll();
  },

  getOriginUrl(): string {
    if (Platform.OS === 'web') {
      return window.location.origin;
    }
    // For native apps, use the API base URL
    return API_BASE || 'https://cinema-social-dev.preview.emergentagent.com';
  },

  getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(p => p.id === planId);
  },
};
