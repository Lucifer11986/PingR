import React, { useState } from 'react';

interface PayPalUpgradeButtonProps {
  plan: 'pro' | 'enterprise';
  userId: string;
  currentPlan: string;
}

const PayPalUpgradeButton: React.FC<PayPalUpgradeButtonProps> = ({ plan, userId, currentPlan }) => {
  const [loading, setLoading] = useState(false);

  const prices = {
    pro: '€29',
    enterprise: 'Custom'
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('nokki_dev_token');
      
      const response = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          userId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.approvalUrl) {
        // Redirect to PayPal
        window.location.href = data.approvalUrl;
      } else {
        alert(data.error || 'Fehler beim Erstellen der Zahlung');
        setLoading(false);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Verbindungsfehler');
      setLoading(false);
    }
  };

  const isCurrentPlan = currentPlan === plan;
  const isDisabled = loading || isCurrentPlan || plan === 'enterprise';

  return (
    <button
      onClick={handleUpgrade}
      disabled={isDisabled}
      style={{
        width: '100%',
        padding: '12px',
        borderRadius: '10px',
        border: 'none',
        background: isCurrentPlan 
          ? 'rgba(139,138,168,0.1)' 
          : plan === 'enterprise'
          ? 'rgba(139,138,168,0.1)'
          : 'linear-gradient(135deg, #0070ba, #003087)', // PayPal Blue
        color: isCurrentPlan || plan === 'enterprise' ? '#8b8aa8' : '#fff',
        fontWeight: 700,
        fontSize: '14px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {loading ? (
        <>? Lädt...</>
      ) : isCurrentPlan ? (
        <>? Aktueller Plan</>
      ) : plan === 'enterprise' ? (
        <>?? Kontakt aufnehmen</>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l1.088-6.882a1.125 1.125 0 0 1 1.118-.9h2.344c4.407 0 7.684-1.789 8.711-6.992.026-.125.05-.242.076-.358.014-.09.028-.182.04-.258.146-.018.292-.046.437-.063a6.96 6.96 0 0 1 1.04 0c.145.018.288.046.431.063z"/>
          </svg>
          Upgrade mit PayPal ({prices[plan]}/Monat)
        </>
      )}
    </button>
  );
};

export default PayPalUpgradeButton;