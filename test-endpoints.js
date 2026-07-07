async function checkEndpoints(rnc) {
  const endpoints = [
    `https://api.marcos.do/rnc/${rnc}`,
    `https://statetrack.do/api/rnc/${rnc}`,
    `https://api.adamix.net/apec/cedula/${rnc}`,
    `https://consultar-rnc.p.rapidapi.com/consultar/${rnc}`,
    `https://api.tax.do/rnc/${rnc}`,
    `https://api.dgiiapicloud.com/v1/RNC/${rnc}`,
    `https://rnc.com.do/api/${rnc}`
  ];

  for (let url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const text = await res.text();
      console.log(`[SUCCESS] ${url} -> ${res.status} ${text.substring(0, 100)}`);
    } catch (e) {
      console.log(`[FAIL] ${url} -> ${e.message}`);
    }
  }
}
checkEndpoints('101001011');
