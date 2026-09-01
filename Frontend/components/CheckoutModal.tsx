import axios from 'axios'; // Add axios for API calls
const [promoCode, setPromoCode] = useState('');
const [promoError, setPromoError] = useState<string | null>(null);

const handleApplyPromoCode = async () => {
  try {
    const { data } = await axios.post('/api/apply-promo', { promoCode });
    if (data.discount === 100) {
      // Handle 100% discount logic
      console.log('Promo code applied: 100% discount');
      // Activate the product/course directly
      try {
        await axios.post('/api/activate-access', { promoCode });
        window.location.href = '/success';
      } catch (activationError) {
        setPromoError('Failed to activate access. Please contact support.');
      }
    } else {
      console.log('Promo code applied:', data);
    }
  } catch (error) {
    if (error.response?.status === 400) {
      setPromoError('Promo code expired or invalid.');
    } else {
      setPromoError('An unexpected error occurred. Please try again.');
    }
  }
};
<div className="promo-code-section">
  <label htmlFor="promoCode">Promo Code</label>
  <input
    type="text"
    id="promoCode"
    value={promoCode}
    onChange={(e) => setPromoCode(e.target.value)}
    placeholder="Enter promo code"
  />
  <button onClick={handleApplyPromoCode}>Apply</button>
  {promoError && <p className="error">{promoError}</p>}
</div>
