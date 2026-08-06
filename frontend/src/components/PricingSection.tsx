import React from 'react';

interface PricingSectionProps {
  currentPlan: 'free' | 'pro' | 'enterprise';
  apiCallsUsed: number;
  apiCallsLimit: number;
}

const PricingSection: React.FC<PricingSectionProps> = ({ 
  currentPlan, 
  apiCallsUsed, 
  apiCallsLimit 
}) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '€0',
      period: 'für immer kostenlos',
      color: '#22c55e',
      features: [
        'Unbegrenzte Bots',
        '1.000 API Calls / Minute',
        'Real-time Webhooks',
        '50 MB File Uploads',
        'Community Support',
        'Analytics Dashboard',
        'API Dokumentation',
      ],
      buttonText: 'Aktuell',
      isCurrent: currentPlan === 'free',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '€29',
      period: 'pro Monat',
      color: '#3b82f6',
      badge: 'Q4 2026',
      features: [
        'Alles aus Free',
        '10.000 API Calls / Minute',
        'Priority Webhooks',
        '500 MB File Uploads',
        'Email Support (24h)',
        'Advanced Analytics',
        'Custom Branding',
      ],
      buttonText: 'Demnächst',
      isCurrent: currentPlan === 'pro',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      period: 'individuelle Angebote',
      color: '#a855f7',
      badge: '2027',
      features: [
        'Alles aus Pro',
        'Unbegrenzte API Calls',
        'Dedicated Webhooks',
        'Unbegrenzte Uploads',
        '24/7 Priority Support',
        'SLA 99.95%',
        'On-Premise Option',
      ],
      buttonText: 'Demnächst',
      isCurrent: currentPlan === 'enterprise',
    },
  ];

  return (
    <div style={{ marginTop: '48px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px' }}>
          Dein Plan
        </h2>
        <p style={{ color: '#8b8aa8', fontSize: '14px' }}>
          API Usage: {apiCallsUsed.toLocaleString()} / {apiCallsLimit.toLocaleString()} Calls (30 Tage)
        </p>
        {/* Usage Bar */}
        <div style={{
          width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)',
          borderRadius: '999px', marginTop: '12px', overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min((apiCallsUsed / apiCallsLimit) * 100, 100)}%`,
            height: '100%',
            background: apiCallsUsed > apiCallsLimit * 0.9 
              ? 'linear-gradient(90deg, #ef4444, #f97316)' 
              : 'linear-gradient(90deg, #22c55e, #10b981)',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Pricing Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {plans.map(plan => (
          <div key={plan.id} style={{
            background: plan.isCurrent 
              ? 'linear-gradient(135deg, rgba(232,184,109,0.1), rgba(232,184,109,0.05))' 
              : '#0d0f18',
            border: plan.isCurrent 
              ? '2px solid rgba(232,184,109,0.4)' 
              : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative' as const,
          }}>
            {/* Badge */}
            {plan.badge && (
              <div style={{
                position: 'absolute' as const, top: '16px', right: '16px',
                padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                background: 'rgba(234,179,8,0.15)', color: '#fbbf24',
                border: '1px solid rgba(234,179,8,0.3)',
              }}>
                ? {plan.badge}
              </div>
            )}

            {plan.isCurrent && (
              <div style={{
                position: 'absolute' as const, top: '16px', right: '16px',
                padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                background: 'rgba(232,184,109,0.15)', color: '#e8b86d',
                border: '1px solid rgba(232,184,109,0.3)',
              }}>
                ? Aktuell
              </div>
            )}

            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>
              {plan.name}
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '36px', fontWeight: 900 }}>{plan.price}</span>
              <span style={{ color: '#8b8aa8', fontSize: '14px', marginLeft: '8px' }}>
                {plan.period}
              </span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '24px' }}>
              {plan.features.map((feature, idx) => (
                <li key={idx} style={{
                  padding: '8px 0',
                  color: '#8b8aa8',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ color: '#22c55e' }}>?</span> {feature}
                </li>
              ))}
            </ul>

            <button
              disabled={plan.isCurrent || plan.buttonText === 'Demnächst'}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: plan.isCurrent 
                  ? 'rgba(139,138,168,0.1)' 
                  : plan.buttonText === 'Demnächst'
                  ? 'rgba(139,138,168,0.1)'
                  : 'linear-gradient(135deg, #b46a0e, #e8b86d)',
                color: plan.isCurrent || plan.buttonText === 'Demnächst' ? '#8b8aa8' : '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: plan.isCurrent || plan.buttonText === 'Demnächst' 
                  ? 'not-allowed' 
                  : 'pointer',
                opacity: plan.isCurrent || plan.buttonText === 'Demnächst' ? 0.5 : 1,
              }}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingSection;