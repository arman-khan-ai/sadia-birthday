const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

// Read .env without requiring an extra package. Keep this file private and out of the ZIP.
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*ADMIN_PASSWORD\s*=\s*(.*?)\s*$/);
    if (match && !process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = match[1].replace(/^['"]|['"]$/g, "");
  }
}
app.use(express.json({ limit: "25mb" }));
app.use(express.static(__dirname));
const DATA_DIR = path.join(__dirname, "Data");
const DATA_FILE = path.join(DATA_DIR, "wishes.json");
const MUSIC_DIR = path.join(__dirname, "music");
const MUSIC_META = path.join(MUSIC_DIR, "current-song.json");
fs.mkdirSync(DATA_DIR, { recursive: true }); fs.mkdirSync(MUSIC_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
let adminToken = null;
const readWishes = () => JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const writeWishes = (w) => fs.writeFileSync(DATA_FILE, JSON.stringify(w, null, 2));
function requireAdmin(req, res, next) { if (!adminToken || req.get("x-admin-token") !== adminToken) return res.status(401).json({error:"Admin login required."}); next(); }
app.get("/api/wishes", (req,res)=>{ try { res.json(readWishes()); } catch { res.status(500).json({error:"Could not load wishes."}); } });
app.post("/api/wishes", (req,res)=>{ try { const {name,message}=req.body; if(typeof name!=="string"||typeof message!=="string"||!name.trim()||!message.trim()) return res.status(400).json({error:"Please enter your name and birthday wish."}); if(name.trim().length>50||message.trim().length>300) return res.status(400).json({error:"Name or message is too long."}); const wish={id:crypto.randomUUID(),name:name.trim(),message:message.trim(),date:new Date().toISOString()}; const wishes=readWishes(); wishes.push(wish); writeWishes(wishes); res.status(201).json({success:true,wish}); } catch { res.status(500).json({error:"Could not save your wish."}); } });
app.post("/api/admin/login",(req,res)=>{ const expected=process.env.ADMIN_PASSWORD; const supplied=typeof req.body.password==="string"?req.body.password:""; if(!expected) return res.status(500).json({error:"ADMIN_PASSWORD is missing from your .env file."}); const a=Buffer.from(supplied), b=Buffer.from(expected); if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(401).json({error:"That admin password is not correct."}); adminToken=crypto.randomBytes(32).toString("hex"); res.json({success:true,token:adminToken}); });
app.post("/api/admin/logout",requireAdmin,(req,res)=>{adminToken=null;res.json({success:true});});
app.put("/api/admin/wishes/:id",requireAdmin,(req,res)=>{try{const {name,message}=req.body;if(typeof name!=="string"||typeof message!=="string"||!name.trim()||!message.trim())return res.status(400).json({error:"Name and wish cannot be empty."});const wishes=readWishes();const w=wishes.find(x=>x.id===req.params.id);if(!w)return res.status(404).json({error:"Wish not found."});w.name=name.trim().slice(0,50);w.message=message.trim().slice(0,300);writeWishes(wishes);res.json({success:true,wish:w});}catch{res.status(500).json({error:"Could not update wish."});}});
app.delete("/api/admin/wishes/:id",requireAdmin,(req,res)=>{try{const wishes=readWishes();const next=wishes.filter(x=>x.id!==req.params.id);if(next.length===wishes.length)return res.status(404).json({error:"Wish not found."});writeWishes(next);res.json({success:true});}catch{res.status(500).json({error:"Could not delete wish."});}});
app.get("/api/music",(req,res)=>{try{if(!fs.existsSync(MUSIC_META))return res.json({src:""});const meta=JSON.parse(fs.readFileSync(MUSIC_META,"utf8"));res.json(meta);}catch{res.status(500).json({error:"Could not read song."});}});
app.post("/api/admin/music",requireAdmin,(req,res)=>{try{const {name,data}=req.body;if(typeof data!=="string"||!data.startsWith("data:audio/"))return res.status(400).json({error:"Choose a valid audio file."});const match=data.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);if(!match)return res.status(400).json({error:"Invalid audio data."});const buffer=Buffer.from(match[2],"base64");if(buffer.length>20*1024*1024)return res.status(413).json({error:"Song must be under 20 MB."});const ext=({"audio/mpeg":"mp3","audio/mp4":"m4a","audio/wav":"wav","audio/x-wav":"wav","audio/ogg":"ogg","audio/aac":"aac"})[match[1]]||"mp3";const filename=`birthday-song.${ext}`;for(const file of fs.readdirSync(MUSIC_DIR))if(/^birthday-song\./.test(file))fs.unlinkSync(path.join(MUSIC_DIR,file));fs.writeFileSync(path.join(MUSIC_DIR,filename),buffer);const meta={src:`/music/${filename}`,title:(name||"A song for Sadia").replace(/[<>]/g,"").slice(0,100)};fs.writeFileSync(MUSIC_META,JSON.stringify(meta,null,2));res.json({success:true,...meta});}catch{res.status(500).json({error:"Could not upload song."});}});
app.listen(PORT,()=>console.log(`Birthday website running at http://localhost:${PORT}`));
