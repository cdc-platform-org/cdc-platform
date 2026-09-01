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
    } else {
      console.log('Promo code applied:', data);
    }
  } catch (error) {
    setPromoError('Invalid promo code.');
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
