// Servidor da vakinha: sem dependências. Rode com: node server.js
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=process.env.PORT||3000,ADMIN=process.env.ADMIN_PASSWORD||"vitor_clubexxx";
const FILE=process.env.DATA_FILE||path.join(__dirname,"data.json");
let D={camp:{title:"Ajude meu próximo vídeo a sair do papel",desc:"Estou juntando uma grana para produzir meu próximo vídeo. Quem apoiar pode, se quiser, receber o processo por dentro: storyboard, animatic e mais.",goal:1000,pix:"",wa:"",raised:0,count:0,supporters:[]},content:{},codes:[{code:"ESCUTAN0_RESENHA",label:"Grupo do WhatsApp",rw:["storyboard","animatic","bastidores","credito"]}]};
try{D=Object.assign(D,JSON.parse(fs.readFileSync(FILE,"utf8")))}catch(e){}
const save=()=>fs.writeFileSync(FILE,JSON.stringify(D));
const IDS=["storyboard","animatic","bastidores","credito"];
const sha=s=>crypto.createHash("sha256").update(String(s)).digest();
const isAdmin=req=>ADMIN&&crypto.timingSafeEqual(sha((req.headers.authorization||"").replace(/^Bearer /,"")),sha(ADMIN));
const tries={};
function blocked(ip){const t=tries[ip];return t&&t.n>=15&&Date.now()-t.t<15*60e3}
function fail(ip){const t=tries[ip]=tries[ip]&&Date.now()-tries[ip].t<15*60e3?tries[ip]:{n:0,t:Date.now()};t.n++}
const str=(v,n)=>String(v==null?"":v).trim().slice(0,n);
const norm=c=>str(c,40).toUpperCase().replace(/\s+/g,"");
const pub=()=>D.camp;
http.createServer((req,res)=>{
  const url=req.url.split("?")[0],ip=req.socket.remoteAddress;
  const send=(c,o)=>{res.writeHead(c,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization"});res.end(JSON.stringify(o))};
  if(req.method==="OPTIONS")return send(204,{});
  if(req.method==="GET"&&(url==="/"||url==="/index.html")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return fs.createReadStream(path.join(__dirname,"public","index.html")).pipe(res)}
  let raw="";req.on("data",d=>{raw+=d;if(raw.length>2e5)req.destroy()});
  req.on("end",()=>{
    let b={};try{b=raw?JSON.parse(raw):{}}catch(e){return send(400,{error:"JSON inválido"})}
    try{
      if(url==="/api/state")return send(200,pub());
      if(url==="/api/club/login"){
        if(blocked(ip))return send(429,{error:"Muitas tentativas. Tente em alguns minutos."});
        const name=str(b.name,40),code=norm(b.code),c=D.codes.find(x=>x.code===code);
        if(!name||!c){fail(ip);return send(401,{error:"Nome ou código incorreto."})}
        return send(200,{name,items:c.rw.map(id=>({id,content:D.content[id]||""}))});
      }
      if(url.startsWith("/api/admin/")){
        if(blocked(ip))return send(429,{error:"Muitas tentativas."});
        if(!isAdmin(req)){fail(ip);return send(401,{error:"Senha de admin incorreta."})}
        if(url==="/api/admin/data")return send(200,{camp:D.camp,content:D.content,codes:D.codes});
        if(url==="/api/admin/camp"){const c=D.camp;c.title=str(b.title,120)||c.title;c.desc=str(b.desc,600)||c.desc;c.goal=Math.max(1,+b.goal||c.goal);c.pix=str(b.pix,140);c.wa=str(b.wa,20).replace(/\D/g,"");save();return send(200,c)}
        if(url==="/api/admin/content"){for(const id of IDS)if(b.content&&id in b.content)D.content[id]=str(b.content[id],500);save();return send(200,D.content)}
        if(url==="/api/admin/donation"){const v=+b.amount,n=str(b.name,60);if(!n||!(v>0))return send(400,{error:"Nome e valor"});const c=D.camp;c.raised+=v;c.count++;c.supporters=[{name:n,amount:v,msg:str(b.msg,200)},...c.supporters].slice(0,30);save();return send(200,c)}
        if(url==="/api/admin/codes"){
          let code=norm(b.code)||"CLUBE-"+crypto.randomBytes(3).toString("hex").toUpperCase();
          if(!/^[A-Z0-9_-]{4,40}$/.test(code))return send(400,{error:"Código: 4 a 40 letras, números, - ou _"});
          if(D.codes.some(x=>x.code===code))return send(400,{error:"Esse código já existe."});
          D.codes.push({code,label:str(b.label,60),rw:(b.rw||[]).filter(id=>IDS.includes(id))});save();return send(200,D.codes);
        }
        if(url==="/api/admin/codes/delete"){D.codes=D.codes.filter(x=>x.code!==norm(b.code));save();return send(200,D.codes)}
      }
      send(404,{error:"Não encontrado"});
    }catch(e){send(500,{error:"Erro interno"})}
  });
}).listen(PORT,()=>console.log("Rodando na porta "+PORT));
