async function testDGII(rnc) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetContribuyentes xmlns="http://dgii.gov.do/">
      <value>${rnc}</value>
      <patronBusqueda>0</patronBusqueda>
      <inicio>0</inicio>
    </GetContribuyentes>
  </soap:Body>
</soap:Envelope>`;

  try {
    const res = await fetch('https://dgii.gov.do/wsTransparencia/consultas.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://dgii.gov.do/GetContribuyentes',
        'User-Agent': 'Mozilla/5.0'
      },
      body: xml
    });

    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("BODY:", text.substring(0, 500));
  } catch (err) {
    console.error(err);
  }
}

testDGII('101001011');
