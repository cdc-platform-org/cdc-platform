const [missingKeys, setMissingKeys] = useState<Record<string, string[]>>({});
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchMissingKeys = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/admin/missing-keys');
      setMissingKeys(data);
    } catch (error) {
      console.error('Failed to fetch missing keys:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchMissingKeys();
}, []);

const handleAutoTranslate = async (locale: string) => {
  try {
    await axios.post('/api/admin/auto-translate', { locale });
    alert(`Auto-translation for ${locale} completed successfully.`);
  } catch (error) {
    console.error('Failed to auto-translate:', error);
    alert('Auto-translation failed.');
  }
};
<div className="translation-status">
  <h2>Translation Status</h2>
  {loading ? (
    <p>Loading missing keys...</p>
  ) : (
    Object.entries(missingKeys).map(([locale, keys]) => (
      <div key={locale}>
        <h3>{locale.toUpperCase()}</h3>
        {keys.length > 0 ? (
          <div>
            <p>Missing Keys:</p>
            <ul>
              {keys.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
            <button onClick={() => handleAutoTranslate(locale)}>Auto-Translate</button>
          </div>
        ) : (
          <p>All keys are translated.</p>
        )}
      </div>
    ))
  )}
</div>
