// Local rehearsal only: no message, booking, contact disclosure, review entitlement
// or persistence. Provider identity comes from the selected public sample.
export function inspectSampleEnquiry(provider, input) {
  const invalid = fields => ({ok:false,fields});
  if(!provider || typeof provider.id!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(provider.id) ||
      !Array.isArray(provider.services) || !provider.services.length || provider.services.length>12 ||
      !input || typeof input!=='object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',')!=='description,service,timing') return invalid(['service','description','timing']);
  const fields=[];
  if(typeof input.service!=='string' || !provider.services.includes(input.service))fields.push('service');
  const description=typeof input.description==='string'?input.description.normalize('NFC').trim():'';
  if(typeof input.description!=='string' || input.description.length>400 || description.length<5 ||
    /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(description))fields.push('description');
  if(!['flexible','this-week'].includes(input.timing))fields.push('timing');
  return fields.length?invalid(fields):{ok:true,value:{providerId:provider.id,service:input.service,description,timing:input.timing}};
}
