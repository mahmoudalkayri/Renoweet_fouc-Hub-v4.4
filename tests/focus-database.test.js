const fs=require("node:fs");
const assert=require("node:assert/strict");

const app=fs.readFileSync(require.resolve("../app.js"),"utf8");
const serviceWorker=fs.readFileSync(require.resolve("../service-worker.js"),"utf8");
const hosting=JSON.parse(fs.readFileSync(require.resolve("../.openai/hosting.json"),"utf8"));
const migration=fs.readFileSync(require.resolve("../drizzle/0000_focus_hub_state.sql"),"utf8");

assert.equal(hosting.d1,"DB","The hosted database binding must be enabled.");
assert.match(app,/api\/focus-data/,"The Focus Hub must load from the database API.");
assert.match(app,/localStorage/,"The offline browser copy must remain available.");
assert.match(serviceWorker,/pathname\.startsWith\("\/api\/"\)/,"Database responses must never be cached by the service worker.");
assert.match(migration,/CREATE TABLE `focus_hub_state`/,"The Focus Hub state table migration is missing.");
console.log("Focus Hub database checks passed.");
