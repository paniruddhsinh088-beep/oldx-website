// Strict raw-JSON boundary, shared by inactive server compositions. No logging.
export function parseBoundedJson(body,{maxBytes=16384}={}){
 try{
 if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>65536)return {ok:false,code:'INVALID_JSON'};
 if(typeof body!=='string'&&!(body instanceof Uint8Array))return {ok:false,code:'INVALID_JSON'};
 if((typeof body==='string'?Buffer.byteLength(body,'utf8'):body.byteLength)>maxBytes)return {ok:false,code:'BODY_TOO_LARGE'};
  const text=typeof body==='string'?body:new TextDecoder('utf-8',{fatal:true}).decode(body);let pos=0,nodes=0;
  const ws=()=>{while(/[\x20\t\r\n]/.test(text[pos]??'x'))pos++;};
  const string=()=>{const re=/"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;re.lastIndex=pos;const match=re.exec(text);if(!match)throw new Error();pos=re.lastIndex;return JSON.parse(match[0]);};
  function value(depth){
   ws();if(depth>6||++nodes>128)throw new Error();const c=text[pos];
   if(c==='"')return string();
   if(c==='{'||c==='['){
    pos++;const object=c==='{',out=object?{}:[],keys=new Set(),end=object?'}':']';ws();if(text[pos]===end){pos++;return out;}
    while(true){ws();if(object){const key=string();if(keys.has(key)||['__proto__','constructor','prototype'].includes(key)||keys.size>=32)throw new Error();keys.add(key);ws();if(text[pos++]!==':')throw new Error();out[key]=value(depth+1);}else{if(out.length>=32)throw new Error();out.push(value(depth+1));}
     ws();if(text[pos]===end){pos++;return out;}if(text[pos++]!==',')throw new Error();
    }
   }
   const re=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null/y;re.lastIndex=pos;const match=re.exec(text);if(!match)throw new Error();pos=re.lastIndex;const primitive=JSON.parse(match[0]);if(typeof primitive==='number'&&!Number.isFinite(primitive))throw new Error();return primitive;
  }
  const data=value(0);ws();if(pos!==text.length||!data||Array.isArray(data)||typeof data!=='object')throw new Error();return {ok:true,value:data};
 }catch{return {ok:false,code:'INVALID_JSON'};}
}
