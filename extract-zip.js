const AdmZip = require('adm-zip');
const zip = new AdmZip('attached_assets/picscripter_1761986715323.zip');
zip.extractAllTo('attached_assets/', true);
console.log('Extracted successfully');
