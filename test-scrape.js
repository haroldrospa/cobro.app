async function testScrape(rnc) {
  try {
    const res = await fetch('https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx');
    const html = await res.text();
    
    // Extraer VIEWSTATE y EVENTVALIDATION
    const viewStateMatch = html.match(/id="__VIEWSTATE" value="(.*?)"/);
    const eventValidationMatch = html.match(/id="__EVENTVALIDATION" value="(.*?)"/);
    
    if (!viewStateMatch || !eventValidationMatch) {
      console.log("No viewstate found");
      return;
    }
    
    const formData = new URLSearchParams();
    formData.append('__VIEWSTATE', viewStateMatch[1]);
    formData.append('__EVENTVALIDATION', eventValidationMatch[1]);
    formData.append('ctl00$cphMain$txtRNCCedula', rnc);
    formData.append('ctl00$cphMain$btnBuscarPorRNC', 'Buscar');
    
    const postRes = await fetch('https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      body: formData.toString()
    });
    
    const postHtml = await postRes.text();
    const nameMatch = postHtml.match(/<span id="ctl00_cphMain_lblRazonSocial".*?>(.*?)<\/span>/);
    if (nameMatch) {
      console.log("FOUND:", nameMatch[1]);
    } else {
      console.log("NOT FOUND. HTML:", postHtml.substring(0, 500));
    }
  } catch(e) {
    console.error(e);
  }
}
testScrape('101001011');
