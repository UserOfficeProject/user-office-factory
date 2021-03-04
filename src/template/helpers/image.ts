import handlebar, { SafeString } from 'handlebars';
import JsBarcode from 'jsbarcode';
import { DOMImplementation, XMLSerializer } from 'xmldom';

handlebar.registerHelper('$barcode', function(data: string) {
  const xmlSerializer = new XMLSerializer();
  const document = new DOMImplementation().createDocument(
    'http://www.w3.org/1999/xhtml',
    'html',
    null
  );
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  JsBarcode(svgNode, data, {
    xmlDocument: document,
    ean128: true,
  });

  const qrSVG = xmlSerializer.serializeToString(svgNode);

  return new SafeString(qrSVG);
});
