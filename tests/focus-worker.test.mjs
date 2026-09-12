import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../dist/server/index.js",import.meta.url),"utf8");
const worker=(await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default;
let row=null;
const DB={prepare(sql){return{bind(...args){return{
  async first(){if(!row)return null;return sql.includes("schema_version")?{schema_version:row.schemaVersion,payload_json:row.payloadJson,revision:row.revision,updated_at:row.updatedAt}:{revision:row.revision,updated_at:row.updatedAt}},
  async run(){const [,schemaVersion,payloadJson,updatedAt]=args;row={schemaVersion,payloadJson,updatedAt,revision:(row?.revision||0)+1};return{success:true}}
}}}}};

const payload={goals:[{id:"g-test",title:"Persist me"}],metrics:[],expenses:[],reminders:[],feed:[]};
const put=await worker.fetch(new Request("https://focus.test/api/focus-data",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({schemaVersion:2,data:payload})}),{DB});
assert.equal(put.status,200);
assert.equal((await put.json()).saved,true);
const get=await worker.fetch(new Request("https://focus.test/api/focus-data"),{DB});
assert.equal(get.status,200);
assert.deepEqual((await get.json()).data,payload);
const page=await worker.fetch(new Request("https://focus.test/"),{DB});
assert.equal(page.status,200);
assert.match(await page.text(),/Renoweet Focus Hub/);
console.log("Focus Hub Worker API checks passed.");
