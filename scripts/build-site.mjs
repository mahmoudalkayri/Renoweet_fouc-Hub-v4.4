import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const runtimeFiles=[
  "index.html","styles.css","app.js","manifest.webmanifest","service-worker.js",
  "icons/icon.svg","icons/apple-touch-icon.png",
  "Renoweet-OS-Drive-v2.2.html","Renoweet-Bookkeeping-Drive-v2.2.html","Renoweet-BOD-Drive-v2.2.html",
  "renoweet-drive-core-v3.0.js","renoweet-os-drive-adapter-v3.6.js",
  "renoweet-bookkeeping-drive-adapter-v3.7.js","renoweet-bookkeeping-enhancements-v4.3.js",
  "renoweet-accounting-engine-v4.4.js","renoweet-bookkeeping-v4.4.js","styles-accounting-v4.4.css",
  "renoweet-os-enhancements-v4.3.js","renoweet-bod-drive-adapter-v2.js",
  "Renoweet-Legacy-Import-2026-Q3.html","migration-2026-q3.json"
];
const binary=new Set([".png"]),assets={};
for(const file of runtimeFiles){
  const filename=path.join(root,file);if(!fs.existsSync(filename))throw new Error(`Missing runtime asset: ${file}`);
  const ext=path.extname(file).toLowerCase(),isBinary=binary.has(ext),content=fs.readFileSync(filename,isBinary?undefined:"utf8");
  assets[file]={encoding:isBinary?"base64":"utf8",body:isBinary?content.toString("base64"):content};
}
const template=fs.readFileSync(path.join(root,"worker/index.template.js"),"utf8");
if(!template.includes("__FOCUS_HUB_ASSETS__"))throw new Error("Worker asset placeholder is missing.");
const dist=path.join(root,"dist");fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(path.join(dist,"server"),{recursive:true});fs.mkdirSync(path.join(dist,".openai","drizzle","meta"),{recursive:true});
fs.writeFileSync(path.join(dist,"server","index.js"),template.replace("__FOCUS_HUB_ASSETS__",JSON.stringify(assets))+"\n");
fs.copyFileSync(path.join(root,".openai","hosting.json"),path.join(dist,".openai","hosting.json"));
fs.copyFileSync(path.join(root,"drizzle","0000_focus_hub_state.sql"),path.join(dist,".openai","drizzle","0000_focus_hub_state.sql"));
fs.copyFileSync(path.join(root,"drizzle","meta","_journal.json"),path.join(dist,".openai","drizzle","meta","_journal.json"));
console.log(`Built Focus Hub Worker with ${runtimeFiles.length} embedded assets.`);
