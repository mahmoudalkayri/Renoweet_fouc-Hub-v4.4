const ASSETS=__FOCUS_HUB_ASSETS__;
const OWNER_KEY="primary";
const MAX_PAYLOAD_BYTES=524288;

const MIME={
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png"
};

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store","x-content-type-options":"nosniff"}})}
function extension(path){const i=path.lastIndexOf(".");return i<0?"":path.slice(i).toLowerCase()}
function decode(entry){if(entry.encoding!=="base64")return entry.body;const raw=atob(entry.body),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}

async function handleFocusData(request,env){
  if(!env.DB)return json({error:"Focus Hub database is unavailable."},503);
  if(request.method==="GET"){
    const row=await env.DB.prepare("SELECT schema_version, payload_json, revision, updated_at FROM focus_hub_state WHERE owner_key = ? LIMIT 1").bind(OWNER_KEY).first();
    if(!row)return json({error:"No Focus Hub data has been saved yet."},404);
    try{return json({schemaVersion:Number(row.schema_version)||1,data:JSON.parse(row.payload_json),revision:Number(row.revision)||1,updatedAt:row.updated_at})}
    catch{return json({error:"The saved Focus Hub data could not be read."},500)}
  }
  if(request.method==="PUT"){
    const declared=Number(request.headers.get("content-length")||0);if(declared>MAX_PAYLOAD_BYTES)return json({error:"Focus Hub data is too large."},413);
    let input;try{input=await request.json()}catch{return json({error:"A valid JSON body is required."},400)}
    if(!input||typeof input!=="object"||Array.isArray(input)||!input.data||typeof input.data!=="object"||Array.isArray(input.data))return json({error:"A Focus Hub data object is required."},400);
    const payload=JSON.stringify(input.data);if(new TextEncoder().encode(payload).length>MAX_PAYLOAD_BYTES)return json({error:"Focus Hub data is too large."},413);
    const schemaVersion=Math.max(1,Math.trunc(Number(input.schemaVersion)||1)),updatedAt=new Date().toISOString();
    await env.DB.prepare("INSERT INTO focus_hub_state (owner_key, schema_version, payload_json, revision, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(owner_key) DO UPDATE SET schema_version = excluded.schema_version, payload_json = excluded.payload_json, revision = focus_hub_state.revision + 1, updated_at = excluded.updated_at").bind(OWNER_KEY,schemaVersion,payload,updatedAt).run();
    const row=await env.DB.prepare("SELECT revision, updated_at FROM focus_hub_state WHERE owner_key = ? LIMIT 1").bind(OWNER_KEY).first();
    return json({saved:true,revision:Number(row?.revision)||1,updatedAt:row?.updated_at||updatedAt});
  }
  return new Response("Method not allowed",{status:405,headers:{allow:"GET, PUT"}})
}

function serveAsset(request,url){
  if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405,headers:{allow:"GET, HEAD"}});
  let key;try{key=decodeURIComponent(url.pathname).replace(/^\/+/,"")||"index.html"}catch{return new Response("Bad request",{status:400})}
  const entry=ASSETS[key];if(!entry)return new Response("Not found",{status:404});
  const headers=new Headers({"content-type":MIME[extension(key)]||"application/octet-stream","x-content-type-options":"nosniff","referrer-policy":"same-origin","x-frame-options":"SAMEORIGIN","cache-control":key==="service-worker.js"?"no-cache":"public, max-age=0, must-revalidate"});
  return new Response(request.method==="HEAD"?null:decode(entry),{status:200,headers});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(url.pathname==="/api/focus-data")return await handleFocusData(request,env);
      return serveAsset(request,url);
    }catch(error){console.error("Focus Hub request failed",error);return url.pathname.startsWith("/api/")?json({error:"The Focus Hub database request failed."},500):new Response("Focus Hub unavailable",{status:500})}
  }
};
