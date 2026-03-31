import { useState } from "react";

// ══════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;900&family=Crimson+Pro:wght@300;400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#060810}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-thumb{background:#c8a96e44;border-radius:3px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes glow{0%,100%{text-shadow:0 0 20px #c8a96e55}50%{text-shadow:0 0 44px #c8a96ecc}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  .fu{animation:fadeUp .35s ease forwards}
  .glow{animation:glow 3s ease infinite}
  .spin{animation:spin 1.2s linear infinite}
  .btn{transition:transform .1s;cursor:pointer}
  .btn:active{transform:scale(.97)}
  .btn:disabled{cursor:not-allowed;opacity:.3}
  input,select{outline:none}
`;

// ══════════════════════════════════════════════
// REGIONS
// ══════════════════════════════════════════════
const REGIONS = [
  {id:"demacia",    name:"Demacia",      color:"#5b8dd9",ref:"Demacia",    fc:"DE"},
  {id:"noxus",      name:"Noxus",        color:"#cc3333",ref:"Noxus",       fc:"NX"},
  {id:"freljord",   name:"Freljord",     color:"#5badcc",ref:"Freljord",    fc:"FR"},
  {id:"piltover",   name:"Piltover",     color:"#c8a200",ref:"PiltoverZaun",fc:"PZ"},
  {id:"ionia",      name:"Ionia",        color:"#b060d0",ref:"Ionia",       fc:"IO"},
  {id:"bilgewater", name:"Bilgewater",   color:"#20aa60",ref:"Bilgewater",  fc:"BW"},
  {id:"shadowisles",name:"Shadow Isles", color:"#33cc77",ref:"ShadowIsles", fc:"SI"},
  {id:"targon",     name:"Targon",       color:"#7090cc",ref:"MtTargon",    fc:"MT"},
  {id:"shurima",    name:"Shurima",      color:"#cc7020",ref:"Shurima",     fc:"SH"},
  {id:"bandle",     name:"Bandle City",  color:"#cc9020",ref:"BandleCity",  fc:"BC"},
];

const FI = {DE:0,FR:1,IO:2,NX:3,PZ:4,SI:5,BW:6,SH:7,MT:9,BC:10,RU:12};

// ══════════════════════════════════════════════
// STORAGE & SEED
// ══════════════════════════════════════════════
const LS = "rg_v6";

function freshAdmin() {
  return {role:"admin",coins:0,wins:0,losses:0,streak:0,deck:null,regions:null,shop:null,shopLocked:false,postMatchChoice:false,opponent:null};
}
function freshPlayer() {
  return {role:"player",coins:100,wins:0,losses:0,streak:0,deck:null,regions:null,shop:null,shopLocked:false,postMatchChoice:false,opponent:null};
}
function freshBracket() {
  return {generated:false,WB:[],LB1:[],LB2:[]};
}

const SEED = {
  users: {
    Storyteller: {password:"5r2w",...freshAdmin()},
    Lawa:        {password:"3k7m",...freshAdmin()},
  },
  pending: {},
  bracket: freshBracket(),
};

function load() {
  try { const s=localStorage.getItem(LS); if(s)return JSON.parse(s); } catch(e){}
  return JSON.parse(JSON.stringify(SEED));
}
function save(d) { try{localStorage.setItem(LS,JSON.stringify(d));}catch(e){} }

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function genPw() {
  const d="23456789",l="abcdefghjkmnpqrstuvwxyz";
  const r=a=>a[Math.floor(Math.random()*a.length)];
  return r(d)+r(l)+r(d)+r(l);
}
function shuffle(a) {
  const b=[...a];
  for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
  return b;
}
function getBracket(losses) {
  if(losses===0)return"winners";
  if(losses===1)return"lb1";
  if(losses===2)return"lb2";
  return"eliminated";
}
function winCoins(streak) { return streak>=3?200:streak===2?150:100; }
function regionIcon(ref) { return `https://dd.b.pvp.net/latest/core/en_us/img/regions/icon-${ref}.png`; }
function cardImg(code) { const s=parseInt(code.slice(0,2),10); return `https://dd.b.pvp.net/latest/set${s}/en_us/img/cards/${code}.png`; }
function deckUrl(deck) { const c=deckCode(deck||[]); return c?`https://runeterra.ar/lor/decks/code/${c}`:null; }

// ══════════════════════════════════════════════
// DECK CODE ENCODER
// ══════════════════════════════════════════════
function varint(v){const b=[];while(v>127){b.push((v&127)|128);v>>>=7;}b.push(v&127);return b;}
function b32(bytes){
  const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let r="",bits=0,acc=0;
  for(const b of bytes){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;r+=A[(acc>>bits)&31];}}
  if(bits>0)r+=A[(acc<<(5-bits))&31];
  return r;
}
function deckCode(entries){
  if(!entries?.length)return"";
  const g={3:[],2:[],1:[]};
  for(const e of entries){g[Math.min(3,Math.max(1,e.count||1))].push(e.code);}
  const bytes=[0x25];
  for(const cnt of[3,2,1]){
    const map={};
    for(const code of g[cnt]){
      const sn=parseInt(code.slice(0,2),10),fc=code.slice(2,4),k=`${sn}|${fc}`;
      if(!map[k])map[k]={set:sn,fc,nums:[]};
      map[k].nums.push(parseInt(code.slice(4),10));
    }
    const grps=Object.values(map).sort((a,b)=>a.nums.length!==b.nums.length?a.nums.length-b.nums.length:(FI[a.fc]||99)-(FI[b.fc]||99));
    for(const v of varint(grps.length))bytes.push(v);
    for(const gg of grps){
      for(const v of varint(gg.nums.length))bytes.push(v);
      for(const v of varint(gg.set))bytes.push(v);
      for(const v of varint(FI[gg.fc]||0))bytes.push(v);
      for(const n of [...gg.nums].sort((a,b)=>a-b)){for(const v of varint(n))bytes.push(v);}
    }
  }
  bytes.push(0);
  return b32(new Uint8Array(bytes));
}

// ══════════════════════════════════════════════
// DATA DRAGON
// ══════════════════════════════════════════════
async function fetchCards(refs){
  const all=[];
  await Promise.all([1,2,3,4,5,6,7].map(async s=>{
    try{
      const res=await fetch(`https://dd.b.pvp.net/latest/set${s}/en_us/data/set${s}-en_us.json`);
      if(!res.ok)return;
      for(const c of await res.json()){
        if(!c.collectible)continue;
        if(!c.regionRefs?.some(r=>refs.includes(r)))continue;
        all.push({code:c.cardCode,name:c.name,cost:c.cost,isChamp:c.supertype==="Champion",regions:c.regionRefs});
      }
    }catch(e){}
  }));
  return all;
}
// Real card codes from Data Dragon — fallback when fetch is blocked by sandbox CSP
const REAL_CARDS = {
  demacia: {
    champions: [
      {code:"01DE001",name:"Garen",cost:4},
      {code:"01DE023",name:"Lux",cost:6},
      {code:"01DE028",name:"Fiora",cost:3},
      {code:"01DE040",name:"Jarvan IV",cost:5},
      {code:"01DE042",name:"Quinn",cost:5},
    ],
    cards: [
      {code:"01DE002",name:"Radiant Guardian",cost:5},
      {code:"01DE003",name:"Brightsteel Protector",cost:3},
      {code:"01DE004",name:"Cithria the Bold",cost:5},
      {code:"01DE005",name:"Vanguard Sergeant",cost:3},
      {code:"01DE007",name:"For Demacia!",cost:6},
      {code:"01DE009",name:"Mobilize",cost:4},
      {code:"01DE010",name:"Prismatic Barrier",cost:2},
      {code:"01DE011",name:"Shield of Durand",cost:4},
      {code:"01DE012",name:"Purify",cost:3},
      {code:"01DE013",name:"Single Combat",cost:3},
      {code:"01DE014",name:"War Chefs",cost:3},
      {code:"01DE016",name:"Fleetfeather Tracker",cost:2},
    ],
  },
  noxus: {
    champions: [
      {code:"01NX001",name:"Darius",cost:6},
      {code:"01NX020",name:"Draven",cost:3},
      {code:"02NX003",name:"Katarina",cost:4},
      {code:"01NX038",name:"Swain",cost:5},
      {code:"02NX007",name:"Vladimir",cost:4},
    ],
    cards: [
      {code:"01NX002",name:"Decimate",cost:6},
      {code:"01NX003",name:"Might",cost:1},
      {code:"01NX004",name:"Reckoning",cost:7},
      {code:"01NX005",name:"Crowd Favorite",cost:3},
      {code:"01NX006",name:"Trifarian Assessor",cost:5},
      {code:"01NX007",name:"Imperial Demolitionist",cost:2},
      {code:"01NX008",name:"Legion Marauder",cost:3},
      {code:"01NX009",name:"Noxian Fervor",cost:2},
      {code:"01NX010",name:"Ravenous Butcher",cost:2},
      {code:"01NX011",name:"Omen Hawk",cost:2},
      {code:"01NX012",name:"Bloody Business",cost:4},
      {code:"01NX013",name:"Death\'s Hand",cost:3},
    ],
  },
  freljord: {
    champions: [
      {code:"01FR001",name:"Ashe",cost:3},
      {code:"01FR006",name:"Braum",cost:4},
      {code:"01FR013",name:"Tryndamere",cost:7},
      {code:"01FR039",name:"Sejuani",cost:6},
      {code:"02FR003",name:"Anivia",cost:7},
    ],
    cards: [
      {code:"01FR002",name:"Blighted Ravine",cost:6},
      {code:"01FR003",name:"Kindly Tavernkeeper",cost:3},
      {code:"01FR004",name:"Troll Chant",cost:2},
      {code:"01FR005",name:"Avarosan Sentry",cost:2},
      {code:"01FR007",name:"Wyrding Stones",cost:3},
      {code:"01FR008",name:"Babbling Bjerg",cost:4},
      {code:"01FR009",name:"Pack Mentality",cost:4},
      {code:"01FR010",name:"Icevale Archer",cost:2},
      {code:"01FR011",name:"Troll Ravager",cost:5},
      {code:"01FR012",name:"Frozen Thrall",cost:5},
      {code:"01FR014",name:"Frostbite",cost:2},
      {code:"01FR015",name:"Glacial Storm",cost:8},
    ],
  },
  piltover: {
    champions: [
      {code:"01PZ013",name:"Ezreal",cost:3},
      {code:"02PZ002",name:"Vi",cost:5},
      {code:"05PZ013",name:"Jayce",cost:5},
      {code:"02PZ024",name:"Jinx",cost:5},
      {code:"03PZ001",name:"Heimerdinger",cost:5},
    ],
    cards: [
      {code:"01PZ001",name:"Thermogenic Beam",cost:4},
      {code:"01PZ003",name:"Progress Day!",cost:5},
      {code:"01PZ004",name:"Vault Breaker",cost:3},
      {code:"01PZ005",name:"Mystic Shot",cost:2},
      {code:"01PZ006",name:"Get Excited!",cost:2},
      {code:"01PZ007",name:"Loping Telescope",cost:2},
      {code:"01PZ008",name:"Ferros Financier",cost:4},
      {code:"01PZ009",name:"Chump Whump",cost:3},
      {code:"01PZ010",name:"Flash of Brilliance",cost:3},
      {code:"01PZ011",name:"Rummage",cost:2},
      {code:"01PZ012",name:"Jury-Rig",cost:1},
      {code:"01PZ014",name:"Statikk Shock",cost:3},
    ],
  },
  ionia: {
    champions: [
      {code:"01IO005",name:"Zed",cost:4},
      {code:"02IO018",name:"Shen",cost:4},
      {code:"01IO035",name:"Karma",cost:6},
      {code:"02IO004",name:"Lee Sin",cost:6},
      {code:"01IO024",name:"Yasuo",cost:3},
    ],
    cards: [
      {code:"01IO001",name:"Twin Disciplines",cost:2},
      {code:"01IO002",name:"Deny",cost:3},
      {code:"01IO003",name:"Will of Ionia",cost:4},
      {code:"01IO004",name:"Sonic Wave",cost:2},
      {code:"01IO006",name:"Recall",cost:2},
      {code:"01IO007",name:"Pale Cascade",cost:2},
      {code:"01IO008",name:"Eye of the Dragon",cost:3},
      {code:"01IO009",name:"Concussive Palm",cost:3},
      {code:"01IO010",name:"Shadow Apprentice",cost:1},
      {code:"01IO011",name:"Navori Highwayman",cost:5},
      {code:"01IO012",name:"Elusive Student",cost:2},
      {code:"01IO013",name:"Deep Meditation",cost:3},
    ],
  },
  bilgewater: {
    champions: [
      {code:"01BW001",name:"Miss Fortune",cost:5},
      {code:"01BW004",name:"Gangplank",cost:5},
      {code:"02BW005",name:"Twisted Fate",cost:3},
      {code:"03BW001",name:"Fizz",cost:2},
      {code:"01BW010",name:"Graves",cost:3},
    ],
    cards: [
      {code:"01BW002",name:"Make It Rain",cost:2},
      {code:"01BW003",name:"Powder Keg",cost:1},
      {code:"01BW005",name:"Black Market Merchant",cost:3},
      {code:"01BW006",name:"Warning Shot",cost:1},
      {code:"01BW007",name:"Marai Warden",cost:2},
      {code:"01BW008",name:"Hired Gun",cost:2},
      {code:"01BW009",name:"Crackshot Corsair",cost:2},
      {code:"01BW011",name:"Petty Officer",cost:3},
      {code:"01BW012",name:"Jaull-fish",cost:7},
      {code:"01BW013",name:"Dead Man\'s Plate",cost:4},
      {code:"01BW014",name:"Parrrley",cost:1},
      {code:"01BW015",name:"Yordle Grifter",cost:3},
    ],
  },
  shadowisles: {
    champions: [
      {code:"01SI006",name:"Thresh",cost:5},
      {code:"01SI007",name:"Elise",cost:3},
      {code:"03SI001",name:"Kalista",cost:3},
      {code:"01SI041",name:"Hecarim",cost:6},
      {code:"04SI001",name:"Vex",cost:5},
    ],
    cards: [
      {code:"01SI001",name:"Vile Feast",cost:2},
      {code:"01SI002",name:"Glimpse Beyond",cost:2},
      {code:"01SI003",name:"Grasp of the Undying",cost:3},
      {code:"01SI004",name:"Mist\'s Call",cost:2},
      {code:"01SI005",name:"The Box",cost:7},
      {code:"01SI008",name:"Haunted Relic",cost:1},
      {code:"01SI009",name:"Cursed Keeper",cost:2},
      {code:"01SI010",name:"Deadbloom Wanderer",cost:3},
      {code:"01SI011",name:"Rhasa the Sunderer",cost:6},
      {code:"01SI012",name:"Phantom Prankster",cost:2},
      {code:"01SI013",name:"Wraithcaller",cost:4},
      {code:"01SI014",name:"Blighted Caretaker",cost:3},
    ],
  },
  targon: {
    champions: [
      {code:"02MT001",name:"Leona",cost:4},
      {code:"02MT006",name:"Diana",cost:4},
      {code:"03MT007",name:"Aurelion Sol",cost:10},
      {code:"02MT009",name:"Taric",cost:5},
      {code:"03MT001",name:"Zoe",cost:1},
    ],
    cards: [
      {code:"02MT002",name:"Starshaping",cost:6},
      {code:"02MT003",name:"Mountain Goat",cost:1},
      {code:"02MT004",name:"Solari Priestess",cost:3},
      {code:"02MT005",name:"Crescent Guardian",cost:4},
      {code:"02MT007",name:"Moondreamer",cost:4},
      {code:"02MT008",name:"Radiant Diffusion",cost:3},
      {code:"02MT010",name:"Spacey Sketcher",cost:2},
      {code:"02MT011",name:"Lunari Duskbringer",cost:2},
      {code:"02MT012",name:"Pale Cascade",cost:2},
      {code:"02MT013",name:"Guiding Touch",cost:1},
      {code:"02MT014",name:"Astral Protection",cost:3},
      {code:"02MT015",name:"Gift of the Hearthblood",cost:2},
    ],
  },
  shurima: {
    champions: [
      {code:"04SH065",name:"Azir",cost:8},
      {code:"04SH003",name:"Nasus",cost:5},
      {code:"04SH001",name:"Sivir",cost:4},
      {code:"04SH004",name:"Renekton",cost:5},
      {code:"05SH025",name:"Taliyah",cost:5},
    ],
    cards: [
      {code:"04SH005",name:"Rite of Calling",cost:2},
      {code:"04SH006",name:"Ancient Preparations",cost:1},
      {code:"04SH007",name:"Emperor\'s Dais",cost:4},
      {code:"04SH008",name:"Shaped Stone",cost:1},
      {code:"04SH009",name:"Rock Hopper",cost:2},
      {code:"04SH010",name:"Preservarium",cost:2},
      {code:"04SH011",name:"Rite of Passage",cost:3},
      {code:"04SH012",name:"Quicksand",cost:3},
      {code:"04SH013",name:"Sandstone Charger",cost:4},
      {code:"04SH014",name:"Sai Scout",cost:2},
      {code:"04SH015",name:"Merciless Hunter",cost:3},
      {code:"04SH016",name:"Rite of Negation",cost:4},
    ],
  },
  bandle: {
    champions: [
      {code:"05BC014",name:"Teemo",cost:1},
      {code:"03BC001",name:"Lulu",cost:3},
      {code:"05BC182",name:"Ziggs",cost:2},
      {code:"01IO033",name:"Kennen",cost:3},
      {code:"02BW022",name:"Tristana",cost:5},
    ],
    cards: [
      {code:"05BC001",name:"Bandle City Mayor",cost:3},
      {code:"05BC002",name:"Conchologist",cost:2},
      {code:"05BC003",name:"Zaunite Urchin",cost:2},
      {code:"05BC004",name:"Papercraft Dragon",cost:4},
      {code:"05BC005",name:"Multi-Totem",cost:2},
      {code:"05BC006",name:"Lecturing Yordle",cost:4},
      {code:"05BC007",name:"Poro Cannon",cost:2},
      {code:"05BC008",name:"Tenor of Terror",cost:3},
      {code:"05BC009",name:"Yordle Ranger",cost:3},
      {code:"05BC010",name:"Pokey Stick",cost:1},
      {code:"05BC011",name:"Veigar",cost:5},
      {code:"05BC013",name:"Flame Chompers!",cost:3},
    ],
  },
};

function fallbackCards(regionIds){
  const all=[];
  regionIds.forEach(id=>{
    const data=REAL_CARDS[id];
    if(!data)return;
    const reg=REGIONS.find(r=>r.id===id);
    data.champions.forEach(c=>all.push({...c,isChamp:true,regions:[reg.ref]}));
    data.cards.forEach(c=>all.push({...c,isChamp:false,regions:[reg.ref]}));
  });
  return all;
}
function buildDeck(cards){
  const champs=shuffle(cards.filter(c=>c.isChamp)).slice(0,2);
  const others=shuffle(cards.filter(c=>!c.isChamp)).slice(0,12);
  return [...champs.map(c=>({...c,count:2})),...others.map(c=>({...c,count:3}))];
}
function buildShop(allCards,deck=[]){
  const used=new Set(deck.map(c=>c.code));
  const pool=allCards.filter(c=>!used.has(c.code));
  const champs=shuffle(pool.filter(c=>c.isChamp));
  const cards=shuffle(pool.filter(c=>!c.isChamp));
  return {champion:champs[0]?{...champs[0],cost:25}:null,cards:cards.slice(0,8).map(c=>({...c,cost:10}))};
}

// ══════════════════════════════════════════════
// BRACKET GENERATION
// ══════════════════════════════════════════════
function generateBracket(playerNames){
  const ps=shuffle([...playerNames]);
  const makeMatch=(id,p1,p2)=>({id,p1:p1||null,p2:p2||null,winner:p2?null:p1,loser:null});

  // WB Round 1 — random pairs
  const WBR1=[];
  for(let i=0;i<ps.length;i+=2){
    WBR1.push(makeMatch(`WR1-M${Math.floor(i/2)+1}`,ps[i],ps[i+1]));
  }
  if(ps.length%2===1){
    // bye: last player auto-wins
    const last=WBR1[WBR1.length-1];
    last.winner=last.p1;
  }

  // WB R2 — empty, filled by results
  const WBR2=[];
  for(let i=0;i<Math.floor(WBR1.length/2);i++){
    WBR2.push(makeMatch(`WR2-M${i+1}`,null,null));
  }

  // WB Final
  const WBF=WBR2.length>0?[makeMatch("WRF-M1",null,null)]:[];

  // LB1 R1 — losers of WBR1 paired
  const LB1R1=[];
  for(let i=0;i<Math.floor(WBR1.length/2);i++){
    LB1R1.push(makeMatch(`L1R1-M${i+1}`,null,null));
  }

  // LB1 R2
  const LB1R2=LB1R1.length>0?[makeMatch("L1R2-M1",null,null)]:[];

  // LB2 R1 — last chance
  const LB2R1=[makeMatch("L2R1-M1",null,null)];

  return {
    generated:true,
    WB:[WBR1,WBR2,WBF].filter(r=>r.length>0),
    LB1:[LB1R1,LB1R2].filter(r=>r.length>0),
    LB2:[LB2R1],
  };
}

// When a match result is reported, route winner/loser to next matches
function routeResult(bracket,matchId,winner,loser){
  const b=JSON.parse(JSON.stringify(bracket));

  // Find and update the match
  function findAndUpdate(rounds){
    for(let ri=0;ri<rounds.length;ri++){
      for(let mi=0;mi<rounds[ri].length;mi++){
        if(rounds[ri][mi].id===matchId){
          rounds[ri][mi].winner=winner;
          rounds[ri][mi].loser=loser;
          return {rounds,ri,mi};
        }
      }
    }
    return null;
  }

  function fillSlot(rounds,ri,mi,player){
    if(!rounds[ri+1])return;
    const nextMatchIdx=Math.floor(mi/2);
    const slot=mi%2===0?"p1":"p2";
    if(rounds[ri+1][nextMatchIdx]){
      rounds[ri+1][nextMatchIdx][slot]=player;
    }
  }

  // Try WB
  const wbResult=findAndUpdate(b.WB);
  if(wbResult){
    const{ri,mi}=wbResult;
    fillSlot(b.WB,ri,mi,winner);
    // Loser goes to LB1
    if(b.LB1[0]){
      const lbIdx=Math.floor(mi/2);
      const lbSlot=mi%2===0?"p1":"p2";
      if(b.LB1[0][lbIdx])b.LB1[0][lbIdx][lbSlot]=loser;
    }
    return b;
  }

  // Try LB1
  const lb1Result=findAndUpdate(b.LB1);
  if(lb1Result){
    const{ri,mi}=lb1Result;
    fillSlot(b.LB1,ri,mi,winner);
    // Loser goes to LB2
    if(b.LB2[0]){
      const slot=b.LB2[0][0].p1?("p2"):"p1";
      b.LB2[0][0][slot]=loser;
    }
    return b;
  }

  // Try LB2 — loser eliminated
  findAndUpdate(b.LB2);
  return b;
}

// ══════════════════════════════════════════════
// STYLE TOKENS
// ══════════════════════════════════════════════
const C={bg:"#060810",surface:"#0d0f18",dim:"#0a0c14",gold:"#c8a96e",text:"#e8d5b0",muted:"#555",faint:"#333"};
const sCard={background:C.surface,border:"1px solid #c8a96e28",borderRadius:"12px",padding:"18px"};
const sLbl={fontFamily:"'Cinzel',serif",fontSize:"11px",color:C.muted,letterSpacing:".1em",textTransform:"uppercase"};
const sInp={width:"100%",background:C.bg,border:"1px solid #c8a96e44",borderRadius:"8px",padding:"10px 14px",color:C.text,fontFamily:"'Crimson Pro',serif",fontSize:"17px"};

// ══════════════════════════════════════════════
// SMALL COMPONENTS
// ══════════════════════════════════════════════
function CoinBadge({n}){
  return <div style={{display:"flex",alignItems:"center",gap:"6px",background:"#c8a96e15",border:"1px solid #c8a96e44",borderRadius:"20px",padding:"5px 14px",fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"16px",fontWeight:600}}>🪙 {n}</div>;
}
function Div(){return <div style={{height:"1px",background:"linear-gradient(90deg,transparent,#c8a96e22,transparent)",margin:"4px 0"}}/>;}
function CopyBtn({text}){
  const[cp,setCp]=useState(false);
  return <button className="btn" onClick={()=>{navigator.clipboard?.writeText(text);setCp(true);setTimeout(()=>setCp(false),1500);}} style={{padding:"4px 11px",background:cp?"#1a3a1a":"#c8a96e18",border:`1px solid ${cp?"#4a8a4a":"#c8a96e44"}`,borderRadius:"6px",color:cp?"#6b6":C.gold,fontFamily:"'Cinzel',serif",fontSize:"10px",fontWeight:600}}>{cp?"✓ Copied":"Copy"}</button>;
}

// ══════════════════════════════════════════════
// TAB BAR
// ══════════════════════════════════════════════
function BracketIcon(){
  return(
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
      <rect x="0" y="0" width="4" height="2.5" rx="0.7"/>
      <rect x="0" y="4" width="4" height="2.5" rx="0.7"/>
      <rect x="0" y="8.5" width="4" height="2.5" rx="0.7"/>
      <rect x="0" y="11" width="4" height="2" rx="0.7"/>
      <line x1="4" y1="1.25" x2="4.5" y2="1.25" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="4" y1="5.25" x2="4.5" y2="5.25" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="4.5" y1="1.25" x2="4.5" y2="5.25" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="4.5" y1="3.25" x2="5" y2="3.25" stroke="currentColor" strokeWidth="0.9"/>
      <rect x="5" y="2" width="4" height="2.5" rx="0.7"/>
      <line x1="4" y1="9.75" x2="4.5" y2="9.75" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="4" y1="12" x2="4.5" y2="12" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="4.5" y1="9.75" x2="4.5" y2="12" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="4.5" y1="10.9" x2="5" y2="10.9" stroke="currentColor" strokeWidth="0.9"/>
      <rect x="5" y="9.6" width="4" height="2.5" rx="0.7"/>
      <line x1="9" y1="3.25" x2="9.5" y2="3.25" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="9" y1="10.9" x2="9.5" y2="10.9" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="9.5" y1="3.25" x2="9.5" y2="10.9" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="9.5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="0.9"/>
      <rect x="10" y="5.75" width="3" height="2.5" rx="0.7"/>
    </svg>
  );
}

const TABS_PLAYER=[
  {id:"deck",label:"Deck",icon:"🃏"},
  {id:"shop",label:"Shop",icon:"🛒"},
  {id:"bracket",label:"Bracket",icon:<BracketIcon/>},
  {id:"standings",label:"Standings",icon:"🏆"},
];
const TABS_ADMIN=[
  {id:"bracket",label:"Bracket",icon:<BracketIcon/>},
  {id:"standings",label:"Standings",icon:"🏆"},
];

function TabBar({active,onChange,isAdmin}){
  const tabs=isAdmin?TABS_ADMIN:TABS_PLAYER;
  return(
    <div style={{display:"flex",gap:"3px",background:"#090b12",borderRadius:"10px",padding:"4px",border:"1px solid #c8a96e1a"}}>
      {tabs.map(t=>(
        <button key={t.id} className="btn" onClick={()=>onChange(t.id)}
          style={{flex:1,padding:"8px 4px",background:active===t.id?"#c8a96e18":"transparent",border:`1px solid ${active===t.id?"#c8a96e44":"transparent"}`,borderRadius:"7px",color:active===t.id?C.gold:C.muted,fontFamily:"'Cinzel',serif",fontSize:"11px",fontWeight:600,letterSpacing:".04em",transition:"all .18s",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
          <span style={{fontSize:"13px",lineHeight:1}}>{t.icon}</span>
          <span style={{fontSize:"9px"}}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════
function LoginScreen({data,onLogin,onSpectator,onRegister}){
  const[mode,setMode]=useState("login");
  const[name,setName]=useState("");
  const[pw,setPw]=useState("");
  const[err,setErr]=useState("");
  const[done,setDone]=useState(false);

  function doLogin(){
    const n=name.trim();
    if(!n){setErr("Enter a username.");return;}
    if(n==="Spectator"){onSpectator();return;}
    if(!data.users[n]){setErr("Account not found.");return;}
    if(data.users[n].password!==pw){setErr("Incorrect password.");return;}
    onLogin(n);
  }
  function doReg(){
    const n=name.trim();
    if(!n){setErr("Enter your Discord username.");return;}
    if(n==="Spectator"){setErr("Reserved name.");return;}
    if(data.users[n]||data.pending[n]){setErr("Name already taken or pending.");return;}
    onRegister(n,genPw());
    setDone(true);
  }

  const wrapStyle={display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"40px 20px",background:`radial-gradient(ellipse at 50% -10%,#1a1200,${C.bg} 55%)`};

  if(done)return(
    <div style={wrapStyle}><style>{CSS}</style>
      <div className="fu" style={{...sCard,maxWidth:"420px",width:"100%",textAlign:"center",borderColor:"#c8a96e55"}}>
        <div style={{fontSize:"32px",marginBottom:"12px"}}>⏳</div>
        <div style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"15px",fontWeight:600,marginBottom:"10px"}}>Registration Submitted</div>
        <div style={{fontSize:"13px",color:"#aaa",lineHeight:1.7}}>Your account <strong style={{color:C.text}}>{name.trim()}</strong> is pending. Admin will DM your password on Discord.</div>
        <button className="btn" onClick={()=>{setDone(false);setMode("login");setName("");}} style={{marginTop:"18px",padding:"9px 22px",background:"#c8a96e18",border:"1px solid #c8a96e44",borderRadius:"8px",color:C.gold,fontFamily:"'Cinzel',serif",fontSize:"12px"}}>Back to Login</button>
      </div>
    </div>
  );

  return(
    <div style={wrapStyle}><style>{CSS}</style>
      <div className="glow" style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(22px,5vw,44px)",fontWeight:900,color:C.gold,textAlign:"center",letterSpacing:".12em",marginBottom:"6px"}}>CHRONICLES OF RUNETERRA</div>
      <div style={{...sLbl,marginBottom:"34px",letterSpacing:".3em",textAlign:"center"}}>Community · Triple Elimination · Eternal</div>
      <div className="fu" style={{width:"100%",maxWidth:"400px",display:"flex",flexDirection:"column",gap:"13px"}}>
        {mode==="login"?(
          <>
            <div style={sCard}>
              <div style={{...sLbl,marginBottom:"10px"}}>Login</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Username" style={{...sInp,marginBottom:"8px"}}/>
              <input value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" type="password" style={sInp} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            {err&&<div style={{color:"#cc4444",fontSize:"13px",textAlign:"center",fontFamily:"'Cinzel',serif"}}>{err}</div>}
            <button className="btn" onClick={doLogin} style={{padding:"14px",background:"linear-gradient(135deg,#c8a96e,#9a7440)",border:"none",borderRadius:"10px",color:C.bg,fontFamily:"'Cinzel',serif",fontSize:"15px",fontWeight:900,letterSpacing:".15em"}}>ENTER THE GAUNTLET</button>
            <div style={{padding:"13px",background:"#c8a96e08",border:"1px solid #c8a96e15",borderRadius:"10px",textAlign:"center"}}>
              <div style={{fontSize:"12px",color:"#555",marginBottom:"4px"}}>Watch without an account</div>
              <div style={{fontSize:"12px",color:"#444",marginBottom:"9px"}}>Enter <strong style={{color:"#888"}}>Spectator</strong> as username — no password</div>
              <button className="btn" onClick={()=>{setMode("register");setErr("");}} style={{padding:"5px 14px",background:"transparent",border:"1px solid #c8a96e33",borderRadius:"6px",color:"#777",fontFamily:"'Cinzel',serif",fontSize:"11px"}}>Register new account →</button>
            </div>
          </>
        ):(
          <>
            <div style={sCard}>
              <div style={{...sLbl,marginBottom:"10px"}}>Register</div>
              <div style={{fontSize:"13px",color:"#666",marginBottom:"12px",lineHeight:1.6}}>Enter your Discord username. The admin will DM you your password.</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Discord username" style={sInp}/>
            </div>
            {err&&<div style={{color:"#cc4444",fontSize:"13px",textAlign:"center",fontFamily:"'Cinzel',serif"}}>{err}</div>}
            <button className="btn" onClick={doReg} style={{padding:"14px",background:"linear-gradient(135deg,#c8a96e,#9a7440)",border:"none",borderRadius:"10px",color:C.bg,fontFamily:"'Cinzel',serif",fontSize:"15px",fontWeight:900,letterSpacing:".15em"}}>SUBMIT REGISTRATION</button>
            <button className="btn" onClick={()=>{setMode("login");setErr("");}} style={{padding:"10px",background:"transparent",border:"1px solid #333",borderRadius:"8px",color:C.muted,fontFamily:"'Cinzel',serif",fontSize:"12px"}}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// REGION SELECT
// ══════════════════════════════════════════════
function RegionSelect({onComplete}){
  const[sel,setSel]=useState([]);
  const[loading,setLoading]=useState(false);
  function toggle(id){sel.includes(id)?setSel(sel.filter(r=>r!==id)):sel.length<2?setSel([...sel,id]):null;}
  async function start(){
    if(sel.length!==2)return;
    setLoading(true);
    const refs=sel.map(id=>REGIONS.find(r=>r.id===id).ref);
    let cards=await fetchCards(refs);
    if(cards.length<10)cards=fallbackCards(sel);
    onComplete(sel,buildDeck(cards),buildShop(cards,[]),cards);
  }
  if(loading)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:"16px"}}>
      <div className="spin" style={{width:"44px",height:"44px",borderRadius:"50%",border:"3px solid #c8a96e33",borderTopColor:C.gold}}/>
      <div style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"13px",letterSpacing:".1em"}}>Fetching cards from Data Dragon…</div>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",padding:"30px 20px"}}>
      <div className="fu" style={{width:"100%",maxWidth:"560px",display:"flex",flexDirection:"column",gap:"14px"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"20px",fontWeight:900,color:C.gold,marginBottom:"4px"}}>Choose Your Regions</div>
          <div style={{color:C.muted,fontSize:"13px"}}>Select 2 regions to build your starting deck</div>
        </div>
        <div style={sCard}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"11px"}}>
            <div style={sLbl}>Regions</div>
            <div style={{...sLbl,color:sel.length===2?"#4a9":C.gold}}>{sel.length}/2</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"6px"}}>
            {REGIONS.map(r=>(
              <div key={r.id} className="btn" onClick={sel.length===2&&!sel.includes(r.id)?undefined:()=>toggle(r.id)}
                style={{background:sel.includes(r.id)?r.color+"20":C.surface,border:`2px solid ${sel.includes(r.id)?r.color:"#c8a96e18"}`,borderRadius:"10px",padding:"10px 5px",textAlign:"center",opacity:sel.length===2&&!sel.includes(r.id)?0.35:1,position:"relative",transition:"all .2s"}}>
                {sel.includes(r.id)&&<div style={{position:"absolute",top:3,right:5,color:r.color,fontSize:"10px",fontWeight:700}}>✓</div>}
                <img src={regionIcon(r.ref)} alt={r.name} style={{width:"26px",height:"26px",objectFit:"contain",display:"block",margin:"0 auto 4px"}} onError={e=>{e.target.style.display="none";}}/>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:"9px",color:sel.includes(r.id)?r.color:"#777",lineHeight:1.3}}>{r.name}</div>
              </div>
            ))}
          </div>
        </div>
        {sel.length===2&&(
          <div className="fu" style={{...sCard,borderColor:"#c8a96e44",background:"#c8a96e08",display:"flex",gap:"10px"}}>
            {sel.map(id=>{const r=REGIONS.find(x=>x.id===id);return(
              <div key={id} style={{flex:1,textAlign:"center",padding:"12px",background:r.color+"18",borderRadius:"8px",border:`1px solid ${r.color}44`}}>
                <img src={regionIcon(r.ref)} alt={r.name} style={{width:"30px",height:"30px",objectFit:"contain",display:"block",margin:"0 auto 5px"}} onError={e=>{e.target.style.display="none";}}/>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:"10px",color:r.color}}>{r.name}</div>
              </div>
            );})}
          </div>
        )}
        <button className="btn" disabled={sel.length!==2} onClick={start}
          style={{padding:"14px",background:sel.length===2?"linear-gradient(135deg,#c8a96e,#9a7440)":"#111",border:sel.length===2?"none":"1px solid #222",borderRadius:"10px",color:sel.length===2?C.bg:C.faint,fontFamily:"'Cinzel',serif",fontSize:"14px",fontWeight:900,letterSpacing:".15em"}}>
          BUILD DECK & START
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// DECK CODE BOX
// ══════════════════════════════════════════════
function DeckCodeBox({deck}){
  const code=deckCode(deck||[]);
  if(!code)return null;
  return(
    <div style={{...sCard,borderColor:"#c8a96e55",background:C.dim}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
        <div style={sLbl}>Live Deck Code</div>
        <CopyBtn text={code}/>
      </div>
      <div style={{background:C.bg,borderRadius:"8px",padding:"9px 13px",fontFamily:"monospace",fontSize:"11px",color:C.gold,wordBreak:"break-all",lineHeight:1.8,border:"1px solid #c8a96e22"}}>{code}</div>
      <a href={`https://runeterra.ar/lor/decks/code/${code}`} target="_blank" rel="noopener noreferrer" style={{display:"block",marginTop:"8px",fontSize:"12px",color:"#5599cc",textDecoration:"none"}}>▶ View on runeterra.ar →</a>
    </div>
  );
}

// ══════════════════════════════════════════════
// DECK SCREEN
// ══════════════════════════════════════════════
function DeckScreen({deck,regionIds}){
  const d=deck||[];
  const champs=d.filter(c=>c.isChamp);
  const cards=d.filter(c=>!c.isChamp);
  const total=d.reduce((s,c)=>s+c.count,0);
  return(
    <div className="fu" style={{display:"flex",flexDirection:"column",gap:"13px"}}>
      <div style={{display:"flex",gap:"8px"}}>
        {(regionIds||[]).map(id=>{const r=REGIONS.find(x=>x.id===id);return r?(
          <div key={id} style={{flex:1,background:r.color+"15",border:`1px solid ${r.color}44`,borderRadius:"10px",padding:"10px",textAlign:"center"}}>
            <img src={regionIcon(r.ref)} alt={r.name} style={{width:"26px",height:"26px",objectFit:"contain",display:"block",margin:"0 auto 4px"}} onError={e=>{e.target.style.display="none";}}/>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"9px",color:r.color}}>{r.name}</div>
          </div>
        ):null;})}
        <div style={{...sCard,padding:"10px",textAlign:"center",minWidth:"60px"}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"18px",fontWeight:900,color:C.gold}}>{total}</div>
          <div style={{fontSize:"9px",color:"#444",marginTop:"2px"}}>cards</div>
        </div>
      </div>
      <DeckCodeBox deck={d}/>
      {[{title:`👑 Champions (${champs.length})`,list:champs,ch:true},{title:`🃏 Cards (${cards.length})`,list:cards,ch:false}].map(({title,list,ch})=>(
        <div key={title} style={sCard}>
          <div style={{...sLbl,marginBottom:"10px"}}>{title}</div>
          <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
            {list.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",background:ch?"#1a1200":C.dim,border:`1px solid ${ch?"#c8a96e44":"#c8a96e18"}`,borderRadius:"7px",padding:"6px 10px"}}>
                <img src={cardImg(c.code)} alt={c.name} style={{width:"36px",height:"36px",objectFit:"contain",borderRadius:"4px",flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>
                <span style={{flex:1,fontSize:"13px",color:ch?C.gold:"#ddd"}}>{c.name}</span>
                {c.cost!==undefined&&<span style={{fontSize:"10px",color:"#555"}}>{c.cost}✦</span>}
                <span style={{fontSize:"11px",color:"#444"}}>×{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// SHOP SCREEN
// ══════════════════════════════════════════════
function ShopScreen({shop,coins,deck,locked,postMatchChoice,onBuy,onReroll,onKeepShop,onNewShop}){
  const[swapping,setSwapping]=useState(null);

  if(locked)return(
    <div className="fu" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:"14px"}}>
      <div style={{fontSize:"44px"}}>🔒</div>
      <div style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"15px",fontWeight:600,letterSpacing:".1em"}}>Shop Locked</div>
      <div style={{fontSize:"13px",color:C.muted,textAlign:"center",maxWidth:"260px"}}>Shop is locked during your active match. It reopens after results are reported.</div>
    </div>
  );

  if(postMatchChoice)return(
    <div className="fu" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:"14px"}}>
      <div style={{fontSize:"36px"}}>⚔️</div>
      <div style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"15px",fontWeight:600,letterSpacing:".1em"}}>Match Over</div>
      <div style={{fontSize:"13px",color:C.muted,textAlign:"center",marginBottom:"6px"}}>Keep your current shop or get a fresh one?</div>
      <div style={{display:"flex",gap:"10px",width:"100%",maxWidth:"320px"}}>
        <button className="btn" onClick={onKeepShop} style={{flex:1,padding:"13px",background:C.surface,border:"1px solid #c8a96e44",borderRadius:"10px",color:C.gold,fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:600}}>Keep Shop</button>
        <button className="btn" onClick={onNewShop} style={{flex:1,padding:"13px",background:"linear-gradient(135deg,#c8a96e,#9a7440)",border:"none",borderRadius:"10px",color:C.bg,fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:600}}>New Shop</button>
      </div>
    </div>
  );

  const s=shop||{champion:null,cards:[]};
  const allBought=!s.champion&&(!s.cards||s.cards.length===0);

  return(
    <div className="fu" style={{display:"flex",flexDirection:"column",gap:"13px"}}>
      {swapping&&(
        <div onClick={()=>setSwapping(null)} style={{position:"fixed",inset:0,background:"#000000cc",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div onClick={e=>e.stopPropagation()} style={{...sCard,maxWidth:"400px",width:"100%",border:"1px solid #c8a96e66",boxShadow:"0 0 60px #c8a96e22",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"14px",fontWeight:600,marginBottom:"4px"}}>Replace a card from your deck</div>
            <div style={{fontSize:"13px",color:"#777",marginBottom:"12px"}}>Adding <strong style={{color:C.text}}>{swapping.name}</strong>{swapping.isChamp?" 👑":""} <span style={{color:C.gold}}>🪙{swapping.cost}</span></div>
            <Div/>
            <div style={{...sLbl,margin:"11px 0 8px"}}>Select card to replace:</div>
            <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
              {(deck||[]).map((e,i)=>(
                <div key={i} className="btn" onClick={()=>{onBuy(swapping,e);setSwapping(null);}}
                  style={{display:"flex",alignItems:"center",gap:"9px",background:e.isChamp?"#1a1200":C.dim,border:`1px solid ${e.isChamp?"#c8a96e44":"#c8a96e18"}`,borderRadius:"7px",padding:"7px 11px"}}>
                  <img src={cardImg(e.code)} alt={e.name} style={{width:"30px",height:"30px",objectFit:"contain",borderRadius:"3px",flexShrink:0}} onError={ev=>{ev.target.style.display="none";}}/>
                  <span style={{flex:1,fontSize:"13px",color:e.isChamp?C.gold:"#ddd"}}>{e.name}</span>
                  <span style={{fontSize:"11px",color:"#444"}}>×{e.count}</span>
                  <span style={{fontSize:"10px",background:"#c8a96e20",color:C.gold,padding:"2px 7px",borderRadius:"4px",fontFamily:"'Cinzel',serif"}}>Replace</span>
                </div>
              ))}
            </div>
            <button className="btn" onClick={()=>setSwapping(null)} style={{marginTop:"11px",width:"100%",padding:"8px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:"7px",color:"#444",fontFamily:"'Cinzel',serif",fontSize:"12px"}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={sLbl}>Card Shop</div>
        <button className="btn" disabled={coins<5} onClick={onReroll}
          style={{display:"flex",alignItems:"center",gap:"6px",background:coins>=5?"#c8a96e18":"#111",border:`1px solid ${coins>=5?"#c8a96e44":"#222"}`,borderRadius:"8px",padding:"6px 13px",color:coins>=5?C.gold:C.faint,fontFamily:"'Cinzel',serif",fontSize:"12px",fontWeight:600}}>
          🔄 Reroll — 🪙5
        </button>
      </div>

      {allBought&&<div style={{textAlign:"center",padding:"20px",color:C.muted,fontSize:"13px"}}>All cards purchased. Reroll for new offers.</div>}

      {s.champion&&(
        <div style={sCard}>
          <div style={{...sLbl,marginBottom:"9px"}}>Champion Slot</div>
          <div className="btn" onClick={()=>coins>=s.champion.cost&&setSwapping(s.champion)}
            style={{display:"flex",alignItems:"center",gap:"10px",background:"#1a1200",border:"1px solid #c8a96e55",borderRadius:"8px",padding:"9px 12px",opacity:coins<s.champion.cost?0.55:1}}>
            <img src={cardImg(s.champion.code)} alt={s.champion.name} style={{width:"40px",height:"40px",objectFit:"contain",borderRadius:"4px",flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>
            <span style={{flex:1,color:C.gold,fontSize:"13px"}}>{s.champion.name}</span>
            <span style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"13px",fontWeight:600}}>🪙{s.champion.cost}</span>
            <span style={{fontSize:"10px",background:"#c8a96e18",color:coins>=s.champion.cost?C.gold:"#444",padding:"2px 8px",borderRadius:"4px",fontFamily:"'Cinzel',serif"}}>{coins>=s.champion.cost?"Buy":"🔒"}</span>
          </div>
        </div>
      )}

      {s.cards?.length>0&&(
        <div style={sCard}>
          <div style={{...sLbl,marginBottom:"9px"}}>Card Offers ({s.cards.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
            {s.cards.map((c,i)=>(
              <div key={i} className="btn" onClick={()=>coins>=c.cost&&setSwapping(c)}
                style={{display:"flex",alignItems:"center",gap:"10px",background:C.dim,border:"1px solid #c8a96e18",borderRadius:"7px",padding:"7px 12px",opacity:coins<c.cost?0.55:1}}>
                <img src={cardImg(c.code)} alt={c.name} style={{width:"36px",height:"36px",objectFit:"contain",borderRadius:"4px",flexShrink:0}} onError={e=>{e.target.style.display="none";}}/>
                <span style={{flex:1,fontSize:"13px",color:"#ddd"}}>{c.name}</span>
                {c.cost!==undefined&&<span style={{fontSize:"10px",color:"#444"}}>{c.cost}✦</span>}
                <span style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"12px",fontWeight:600}}>🪙{c.cost}</span>
                <span style={{fontSize:"10px",background:"#c8a96e18",color:coins>=c.cost?C.gold:"#444",padding:"2px 7px",borderRadius:"4px",fontFamily:"'Cinzel',serif"}}>{coins>=c.cost?"Buy":"🔒"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// BRACKET SVG
// ══════════════════════════════════════════════
function BracketSVG({rounds,me,title,color}){
  if(!rounds||rounds.length===0||rounds[0].length===0){
    return <div style={{fontSize:"13px",color:"#333",fontStyle:"italic",padding:"8px 0"}}>— no matches yet —</div>;
  }

  const BW=130,BH=22,YGAP=6,MGAP=18;

  // Calculate R1 slot positions
  const r1=rounds[0];
  const slotY=(matchIdx,slot)=>{
    const matchStart=matchIdx*(BH*2+YGAP+MGAP);
    return slot===0?matchStart:matchStart+BH+YGAP;
  };
  const matchCenter=(matchIdx)=>{
    const y1=slotY(matchIdx,0)+BH/2;
    const y2=slotY(matchIdx,1)+BH/2;
    return(y1+y2)/2;
  };

  // Build column slot data
  // Col 0: r1 = 2 boxes per match
  // Col 1+: 1 box per match (showing winner/TBD), y = center of two feeding matches
  const cols=[];
  // Column 0 = R1 pairs
  cols.push(r1.map((m,mi)=>({match:m,y:slotY(mi,0),y2:slotY(mi,1),isCombined:true})));

  // Subsequent columns
  let prevMatchCenters=r1.map((_,mi)=>matchCenter(mi));
  for(let ri=1;ri<rounds.length;ri++){
    const row=rounds[ri];
    const newCenters=[];
    cols.push(row.map((m,mi)=>{
      const cy1=prevMatchCenters[mi*2];
      const cy2=prevMatchCenters[mi*2+1]??cy1;
      const cy=(cy1!==undefined&&cy2!==undefined)?(cy1+cy2)/2:cy1??0;
      newCenters.push(cy);
      return{match:m,y:cy-BH/2,isCombined:false};
    }));
    prevMatchCenters=newCenters;
  }

  // SVG size
  const lastR1=r1.length-1;
  const svgH=slotY(lastR1,1)+BH+20;
  const colX=(ci)=>ci*(BW+50);
  const svgW=colX(cols.length)+BW+20;
  const midX=(ci)=>colX(ci)+BW+25;

  function Slot({x,y,name,active,isWinner}){
    return(
      <g>
        <rect x={x} y={y} width={BW} height={BH} rx="4"
          fill={active?"#c8a96e22":isWinner?"#0a1a0a":"#0c0e18"}
          stroke={active?"#c8a96e":isWinner?"#4a8a2a":"#c8a96e22"}
          strokeWidth={active?1.5:0.7}/>
        <text x={x+7} y={y+BH*0.67} fontFamily="'Crimson Pro',serif" fontSize="11.5"
          fill={active?"#c8a96e":isWinner?"#7c7":name&&name!=="TBD"?"#ccc":"#333"}>
          {name||"TBD"}
        </text>
        {active&&<text x={x+BW-13} y={y+BH*0.67} fontSize="9" fill="#c8a96e88">⭐</text>}
        {isWinner&&!active&&<text x={x+BW-13} y={y+BH*0.67} fontSize="9" fill="#4a8a2a">✓</text>}
      </g>
    );
  }

  function L({x1,y1,x2,y2}){return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8a96e18" strokeWidth="1.2"/>;}

  // Connect two source Y-centers to one target Y-center
  function Conn({fromX,fromCy1,fromCy2,toX,toCy}){
    const mx=midX(cols.indexOf(cols.find(_=>colX(cols.indexOf(_))===fromX))||0);
    // Actually use midX between fromX and toX
    const mx2=(fromX+BW+toX)/2;
    return(<g>
      <L x1={fromX+BW} y1={fromCy1} x2={mx2} y2={fromCy1}/>
      <L x1={fromX+BW} y1={fromCy2} x2={mx2} y2={fromCy2}/>
      <L x1={mx2} y1={fromCy1} x2={mx2} y2={fromCy2}/>
      <L x1={mx2} y1={(fromCy1+fromCy2)/2} x2={toX} y2={toCy}/>
    </g>);
  }

  return(
    <div>
      <div style={{...sLbl,marginBottom:"10px",color}}>{title}</div>
      <div style={{overflowX:"auto"}}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{display:"block",minWidth:"300px"}}>
          {/* Round labels */}
          {cols.map((_,ci)=>(
            <text key={ci} x={colX(ci)} y={10} fontFamily="Cinzel,serif" fontSize="7.5" fill="#3a3a3a" letterSpacing="0.08em">
              {ci===0?`ROUND 1`:ci===cols.length-1?`FINAL`:`ROUND ${ci+1}`}
            </text>
          ))}

          {/* R1: pairs */}
          {cols[0]?.map((slot,mi)=>{
            const m=slot.match;
            const w=m.winner;
            return(
              <g key={m.id}>
                <Slot x={colX(0)} y={slot.y} name={m.p1} active={m.p1===me} isWinner={w&&w===m.p1}/>
                <Slot x={colX(0)} y={slot.y2} name={m.p2} active={m.p2===me} isWinner={w&&w===m.p2}/>
                {/* Connect to next col */}
                {cols[1]&&cols[1][Math.floor(mi/2)]&&(
                  <Conn
                    fromX={colX(0)}
                    fromCy1={slot.y+BH/2}
                    fromCy2={slot.y2+BH/2}
                    toX={colX(1)}
                    toCy={cols[1][Math.floor(mi/2)].y+BH/2}
                  />
                )}
              </g>
            );
          })}

          {/* Subsequent cols: single box per match */}
          {cols.slice(1).map((col,ci)=>{
            const realCi=ci+1;
            return col.map((slot,mi)=>{
              const m=slot.match;
              const name=m.winner||(m.p1?m.p2?"TBD":m.p1:"?");
              const active=m.p1===me||m.p2===me||m.winner===me;
              const isWinner=!!m.winner;
              return(
                <g key={m.id}>
                  <Slot x={colX(realCi)} y={slot.y} name={name} active={m.p1===me||m.p2===me} isWinner={isWinner}/>
                  {/* Connect to next col */}
                  {cols[realCi+1]&&cols[realCi+1][Math.floor(mi/2)]&&(
                    <Conn
                      fromX={colX(realCi)}
                      fromCy1={slot.y+BH/2}
                      fromCy2={(cols[realCi][mi%2===0?mi+1:mi]?.y??slot.y)+BH/2}
                      toX={colX(realCi+1)}
                      toCy={cols[realCi+1][Math.floor(mi/2)].y+BH/2}
                    />
                  )}
                </g>
              );
            });
          })}

          {/* Trophy at end */}
          {cols.length>0&&(()=>{
            const lastCol=cols[cols.length-1];
            const lastSlot=lastCol[lastCol.length-1];
            return lastSlot?<text x={colX(cols.length)+5} y={lastSlot.y+BH*0.7} fontSize="16">🏆</text>:null;
          })()}
        </svg>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// BRACKET SCREEN
// ══════════════════════════════════════════════
function BracketScreen({data,me}){
  const{users,bracket}=data;
  const myData=users[me]||{};
  const myOpp=myData.opponent||null;
  const myBracket=getBracket(myData.losses||0);

  return(
    <div className="fu" style={{display:"flex",flexDirection:"column",gap:"13px"}}>
      {!bracket.generated&&(
        <div style={{...sCard,textAlign:"center",borderColor:"#c8a96e33",background:"#0a0c14"}}>
          <div style={{fontSize:"13px",color:C.muted}}>Bracket not yet generated. Admin will start the tournament once all players have registered.</div>
        </div>
      )}

      {myOpp&&(
        <div style={{...sCard,borderColor:"#cc333344",background:"#150808"}}>
          <div style={{...sLbl,marginBottom:"10px"}}>Your Current Match</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"20px",padding:"10px 0"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:"14px",color:C.gold,fontWeight:700}}>{me}</div>
              <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{myData.wins||0}W–{myData.losses||0}L</div>
            </div>
            <div style={{fontFamily:"'Cinzel',serif",color:"#444",fontSize:"16px"}}>VS</div>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:"14px",color:"#cc6666",fontWeight:700}}>{myOpp}</div>
              {users[myOpp]&&<div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{users[myOpp].wins||0}W–{users[myOpp].losses||0}L</div>}
            </div>
          </div>
          <div style={{textAlign:"center",padding:"5px",background:"#c8a96e0a",borderRadius:"6px",marginTop:"5px"}}>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"11px",color:myBracket==="winners"?C.gold:myBracket==="lb1"?"#5badcc":"#cc7020"}}>
              {myBracket==="winners"?"🏆 Winners Bracket":myBracket==="lb1"?"⚔️ Losers Bracket 1":"🔥 Losers Bracket 2"}
            </span>
          </div>
        </div>
      )}

      {bracket.generated&&(
        <>
          <div style={sCard}>
            <BracketSVG rounds={bracket.WB} me={me} title="🏆 Winners Bracket" color={C.gold}/>
          </div>
          {bracket.LB1?.some(r=>r.some(m=>m.p1||m.p2))&&(
            <div style={{...sCard,borderColor:"#5badcc33"}}>
              <BracketSVG rounds={bracket.LB1} me={me} title="⚔️ Losers Bracket 1" color="#5badcc"/>
            </div>
          )}
          {bracket.LB2?.some(r=>r.some(m=>m.p1||m.p2))&&(
            <div style={{...sCard,borderColor:"#cc702033"}}>
              <BracketSVG rounds={bracket.LB2} me={me} title="🔥 Losers Bracket 2 (Last Chance)" color="#cc7020"/>
            </div>
          )}
        </>
      )}

      <div style={{...sCard,borderStyle:"dashed",borderColor:"#c8a96e1a"}}>
        <div style={{...sLbl,marginBottom:"9px"}}>Triple Elimination Rules</div>
        {[["Lose in Winners Bracket","→ Losers Bracket 1"],["Lose in Losers Bracket 1","→ Losers Bracket 2"],["Lose in Losers Bracket 2","→ Eliminated (3 losses total)"]].map(([k,v],i)=>(
          <div key={i} style={{display:"flex",gap:"10px",fontSize:"12px",padding:"5px 0",borderBottom:"1px solid #c8a96e08"}}>
            <span style={{color:"#666",flex:1}}>{k}</span>
            <span style={{color:C.muted}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// STANDINGS SCREEN
// ══════════════════════════════════════════════
function StandingsScreen({data,me,showCoins}){
  const{users}=data;
  const bLabel={winners:"WB",lb1:"LB1",lb2:"LB2",eliminated:"OUT"};
  const sorted=Object.keys(users)
    .filter(n=>users[n].role==="player")
    .map(n=>({name:n,...users[n]}))
    .sort((a,b)=>b.coins-a.coins);
  const medal=i=>i===0?"🥇":i===1?"🥈":i===2?"🥉":null;

  return(
    <div className="fu" style={{display:"flex",flexDirection:"column",gap:"8px"}}>
      <div style={sLbl}>Standings</div>
      {sorted.length===0&&<div style={{...sCard,textAlign:"center",color:C.muted,fontSize:"13px"}}>No players registered yet.</div>}
      {sorted.map((p,i)=>{
        const isMe=p.name===me;
        const url=deckUrl(p.deck);
        return(
          <div key={p.name} style={{...sCard,display:"flex",alignItems:"center",gap:"11px",background:isMe?"#c8a96e0a":C.surface,border:`1px solid ${isMe?"#c8a96e55":"#c8a96e18"}`,padding:"11px 14px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:medal(i)?"16px":"13px",fontWeight:900,color:i===0?C.gold:i===1?"#aaa":i===2?"#cc7020":"#2a2a2a",width:"24px",textAlign:"center"}}>{medal(i)||(i+1)}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",color:isMe?C.gold:"#ddd",fontWeight:isMe?600:400}}>{isMe?"⭐ ":""}{p.name}</div>
              <div style={{fontSize:"11px",color:"#3a3a3a"}}>{p.wins||0}W – {p.losses||0}L · {bLabel[getBracket(p.losses||0)]}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
              {showCoins&&<span style={{fontFamily:"'Cinzel',serif",fontSize:"14px",color:C.gold,fontWeight:600}}>🪙{p.coins||0}</span>}
              {url
                ?<a href={url} target="_blank" rel="noopener noreferrer" style={{fontSize:"11px",color:"#5599cc",textDecoration:"none",fontFamily:"'Cinzel',serif"}}>Deck ↗</a>
                :<span style={{fontSize:"11px",color:"#2a2a2a"}}>No deck</span>
              }
            </div>
          </div>
        );
      })}
      {showCoins&&(
        <div style={{...sCard,marginTop:"4px"}}>
          <div style={{...sLbl,marginBottom:"8px"}}>Coin Economy</div>
          {[["Win","🪙100"],["2 wins in a row","🪙150"],["3+ wins in a row","🪙200"],["Loss","🪙50"],["Champion (shop)","🪙25"],["Card (shop)","🪙10"],["Reroll","🪙5"]].map(([k,v],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #c8a96e08",fontSize:"12px"}}>
              <span style={{color:"#555"}}>{k}</span>
              <span style={{color:C.gold,fontFamily:"'Cinzel',serif",fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════
function AdminPanel({data,onUpdate,onClose,allCards}){
  const[atab,setAtab]=useState("report");
  const[p1,setP1]=useState("");
  const[p2,setP2]=useState("");
  const[winner,setWinner]=useState("");
  const[msg,setMsg]=useState("");
  const{users,pending,bracket}=data;
  const players=Object.keys(users).filter(n=>users[n].role==="player");
  const pendingKeys=Object.keys(pending||{});

  const selSt={background:C.dim,border:"1px solid #c8a96e33",borderRadius:"7px",padding:"8px",color:C.text,fontFamily:"'Crimson Pro',serif",fontSize:"14px",width:"100%"};
  const aTBtn=(t,label)=>(
    <button key={t} className="btn" onClick={()=>{setAtab(t);setMsg("");setP1("");setP2("");setWinner("");}}
      style={{padding:"6px 14px",background:atab===t?"#c8a96e18":"transparent",border:`1px solid ${atab===t?"#c8a96e44":"transparent"}`,borderRadius:"7px",color:atab===t?C.gold:C.muted,fontFamily:"'Cinzel',serif",fontSize:"11px",fontWeight:600}}>
      {label}
    </button>
  );

  function setMatch(){
    if(!p1||!p2||p1===p2){setMsg("Select two different players.");return;}
    const nu=JSON.parse(JSON.stringify(data));
    nu.users[p1].shopLocked=true;nu.users[p1].opponent=p2;
    nu.users[p2].shopLocked=true;nu.users[p2].opponent=p1;
    onUpdate(nu);
    setMsg(`Match set: ${p1} vs ${p2}. Shops locked.`);
  }

  function report(){
    if(!winner||!p1||!p2||winner!==p1&&winner!==p2){setMsg("Select players and a valid winner.");return;}
    const loser=winner===p1?p2:p1;
    const nu=JSON.parse(JSON.stringify(data));
    const w=nu.users[winner],l=nu.users[loser];
    w.streak=(w.streak||0)+1;w.wins=(w.wins||0)+1;
    const earned=winCoins(w.streak);
    w.coins=(w.coins||0)+earned;
    w.shopLocked=false;w.postMatchChoice=true;w.opponent=null;
    l.streak=0;l.losses=(l.losses||0)+1;
    l.coins=(l.coins||0)+50;
    l.shopLocked=false;l.postMatchChoice=true;l.opponent=null;
    // Find and update bracket match
    const allRounds=[...(nu.bracket.WB||[]).flat(),...(nu.bracket.LB1||[]).flat(),...(nu.bracket.LB2||[]).flat()];
    const bMatch=allRounds.find(m=>(!m.winner)&&((m.p1===p1&&m.p2===p2)||(m.p1===p2&&m.p2===p1)));
    if(bMatch){nu.bracket=routeResult(nu.bracket,bMatch.id,winner,loser);}
    onUpdate(nu);
    setMsg(`${winner} wins! +${earned}🪙  |  ${loser} loses +50🪙`);
    setP1("");setP2("");setWinner("");
  }

  function genBracket(){
    const ps=players.filter(n=>data.users[n].regions);
    if(ps.length<2){setMsg("Need at least 2 players with decks.");return;}
    const nu=JSON.parse(JSON.stringify(data));
    nu.bracket=generateBracket(ps);
    onUpdate(nu);
    setMsg(`Bracket generated for ${ps.length} players.`);
  }

  function approve(n){
    const pw=pending[n]?.password;if(!pw)return;
    const nu=JSON.parse(JSON.stringify(data));
    nu.users[n]={password:pw,...freshPlayer()};
    delete nu.pending[n];
    onUpdate(nu);
  }
  function deny(n){
    const nu=JSON.parse(JSON.stringify(data));
    delete nu.pending[n];
    onUpdate(nu);
  }

  return(
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:300,overflowY:"auto",padding:"20px"}}>
      <div style={{maxWidth:"560px",margin:"0 auto",display:"flex",flexDirection:"column",gap:"14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Cinzel',serif",color:C.gold,fontSize:"18px",fontWeight:900,letterSpacing:".1em"}}>⚙️ Admin Panel</div>
          <button className="btn" onClick={onClose} style={{padding:"7px 14px",background:"transparent",border:"1px solid #444",borderRadius:"7px",color:"#777",fontFamily:"'Cinzel',serif",fontSize:"12px"}}>Close</button>
        </div>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
          {aTBtn("report","Report")}
          {aTBtn("registrations",`Registrations (${pendingKeys.length})`)}
          {aTBtn("players","Players")}
          {aTBtn("bracket","Bracket")}
        </div>

        {atab==="report"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"11px"}}>
            <div style={sCard}>
              <div style={{...sLbl,marginBottom:"11px"}}>Set Match & Lock Shops</div>
              <div style={{display:"flex",gap:"8px",marginBottom:"9px"}}>
                <select value={p1} onChange={e=>setP1(e.target.value)} style={selSt}>
                  <option value="">Player 1</option>
                  {players.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <select value={p2} onChange={e=>setP2(e.target.value)} style={selSt}>
                  <option value="">Player 2</option>
                  {players.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button className="btn" onClick={setMatch} style={{width:"100%",padding:"9px",background:"#0d1a2a",border:"1px solid #334466",borderRadius:"8px",color:"#5599cc",fontFamily:"'Cinzel',serif",fontSize:"12px",fontWeight:600}}>🔒 Set Match & Lock Shops</button>
            </div>
            <div style={sCard}>
              <div style={{...sLbl,marginBottom:"11px"}}>Report Match Result</div>
              <div style={{fontSize:"12px",color:C.muted,marginBottom:"7px"}}>Winner:</div>
              <div style={{display:"flex",gap:"8px",marginBottom:"11px"}}>
                {[p1,p2].filter(Boolean).map(n=>(
                  <button key={n} className="btn" onClick={()=>setWinner(n)}
                    style={{flex:1,padding:"10px",background:winner===n?"#1a3a1a":"#0d0f18",border:`1px solid ${winner===n?"#4a8a4a":"#c8a96e22"}`,borderRadius:"8px",color:winner===n?"#6c6":C.text,fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:winner===n?700:400}}>
                    {n}
                  </button>
                ))}
                {!p1&&!p2&&<div style={{flex:1,fontSize:"13px",color:"#333",padding:"10px",textAlign:"center"}}>Select players above first</div>}
              </div>
              <button className="btn" onClick={report} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#3a6a3a,#2a4a2a)",border:"none",borderRadius:"8px",color:"#8c8",fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:600}}>✓ Report Result & Unlock Shops</button>
            </div>
            {msg&&<div style={{padding:"10px 14px",background:"#0a1a0a",border:"1px solid #3a6a3a",borderRadius:"8px",color:"#8c8",fontSize:"13px",fontFamily:"'Cinzel',serif"}}>{msg}</div>}
          </div>
        )}

        {atab==="registrations"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
            {pendingKeys.length===0
              ?<div style={{...sCard,textAlign:"center",color:C.muted,fontSize:"13px"}}>No pending registrations.</div>
              :pendingKeys.map(n=>(
                <div key={n} style={{...sCard,display:"flex",alignItems:"center",gap:"12px"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"14px",color:C.text,fontWeight:600}}>{n}</div>
                    <div style={{fontSize:"12px",color:C.muted,marginTop:"2px"}}>Generated password:</div>
                    <div style={{fontFamily:"monospace",fontSize:"20px",color:C.gold,letterSpacing:".12em",marginTop:"2px"}}>{pending[n].password}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                    <button className="btn" onClick={()=>approve(n)} style={{padding:"6px 12px",background:"#1a3a1a",border:"1px solid #3a6a3a",borderRadius:"6px",color:"#6c6",fontFamily:"'Cinzel',serif",fontSize:"11px"}}>✓ Approve</button>
                    <button className="btn" onClick={()=>deny(n)} style={{padding:"6px 12px",background:"#1a0a0a",border:"1px solid #4a2222",borderRadius:"6px",color:"#c66",fontFamily:"'Cinzel',serif",fontSize:"11px"}}>✗ Deny</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {atab==="players"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
            {players.length===0&&<div style={{...sCard,textAlign:"center",color:C.muted,fontSize:"13px"}}>No players yet.</div>}
            {players.map(n=>{
              const u=users[n];
              return(
                <div key={n} style={{...sCard,padding:"11px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:"13px",color:C.text,fontWeight:600}}>{n}</div>
                      <div style={{fontSize:"11px",color:"#444",marginTop:"2px"}}>{u.wins||0}W–{u.losses||0}L · {getBracket(u.losses||0)} · 🪙{u.coins||0}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:"11px",color:"#555"}}>pw: {u.password}</div>
                      {u.shopLocked&&<div style={{fontSize:"11px",color:"#cc7020",marginTop:"2px"}}>🔒 locked</div>}
                      {u.opponent&&<div style={{fontSize:"11px",color:"#cc6666",marginTop:"2px"}}>vs {u.opponent}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {atab==="bracket"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"11px"}}>
            <div style={sCard}>
              <div style={{...sLbl,marginBottom:"10px"}}>Generate Bracket</div>
              <div style={{fontSize:"13px",color:C.muted,marginBottom:"12px",lineHeight:1.6}}>
                Randomly seeds all players who have selected their regions into the Winners Bracket.
                <br/>Players with decks: <strong style={{color:C.text}}>{players.filter(n=>data.users[n].regions).length}</strong>
              </div>
              <button className="btn" onClick={genBracket} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#c8a96e,#9a7440)",border:"none",borderRadius:"8px",color:C.bg,fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:900,letterSpacing:".1em"}}>
                🎲 Generate Bracket
              </button>
            </div>
            {msg&&<div style={{padding:"10px 14px",background:"#0a1a0a",border:"1px solid #3a6a3a",borderRadius:"8px",color:"#8c8",fontSize:"13px",fontFamily:"'Cinzel',serif"}}>{msg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// SPECTATOR VIEW
// ══════════════════════════════════════════════
function SpectatorView({data}){
  const[tab,setTab]=useState("bracket");
  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"16px"}}>
      <style>{CSS}</style>
      <div style={{background:"#090b13",borderBottom:"1px solid #c8a96e1a",padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:900,color:C.gold,letterSpacing:".1em"}}>CHRONICLES OF RUNETERRA</div>
        <div style={{fontSize:"12px",color:C.muted}}>👁 Spectator</div>
      </div>
      <div style={{padding:"13px 18px",maxWidth:"640px",margin:"0 auto"}}>
        <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
          {["bracket","standings"].map(t=>(
            <button key={t} className="btn" onClick={()=>setTab(t)}
              style={{padding:"8px 18px",background:tab===t?"#c8a96e18":"transparent",border:`1px solid ${tab===t?"#c8a96e44":"#c8a96e1a"}`,borderRadius:"8px",color:tab===t?C.gold:C.muted,fontFamily:"'Cinzel',serif",fontSize:"12px",fontWeight:600}}>
              {t==="bracket"?"🏆 Bracket":"📊 Standings"}
            </button>
          ))}
        </div>
        {tab==="bracket"&&<BracketScreen data={data} me={null}/>}
        {tab==="standings"&&<StandingsScreen data={data} me={null} showCoins={false}/>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
export default function App(){
  const[data,setDataRaw]=useState(load);
  const[me,setMe]=useState(null);
  const[screen,setScreen]=useState("login");
  const[tab,setTab]=useState("bracket");
  const[showAdmin,setShowAdmin]=useState(false);
  const[allCards,setAllCards]=useState([]);

  function setData(d){setDataRaw(d);save(d);}

  function onLogin(username){
    setMe(username);
    const u=data.users[username];
    if(u.role==="admin"){setTab("bracket");setScreen("tournament");}
    else if(!u.regions){setScreen("selectRegions");}
    else{setTab("deck");setScreen("tournament");}
  }
  function onSpectator(){setMe("Spectator");setScreen("spectator");}
  function onRegister(username,pw){
    setData({...data,pending:{...data.pending,[username]:{password:pw,ts:Date.now()}}});
  }
  function onRegionComplete(regionIds,deck,shop,cards){
    const nu=JSON.parse(JSON.stringify(data));
    nu.users[me].regions=regionIds;
    nu.users[me].deck=deck;
    nu.users[me].shop=shop;
    setData(nu);
    setAllCards(cards);
    setTab("deck");
    setScreen("tournament");
  }
  function onBuy(shopItem,deckEntry){
    const nu=JSON.parse(JSON.stringify(data));
    const u=nu.users[me];
    u.coins-=shopItem.cost;
    u.deck=u.deck.filter(e=>e.code!==deckEntry.code);
    u.deck.push({...shopItem,count:deckEntry.count});
    if(shopItem.isChamp)u.shop.champion=null;
    else u.shop.cards=u.shop.cards.filter(c=>c.code!==shopItem.code);
    setData(nu);
  }
  function onReroll(){
    const nu=JSON.parse(JSON.stringify(data));
    const u=nu.users[me];u.coins-=5;
    u.shop=buildShop(allCards,u.deck||[]);
    setData(nu);
  }
  function onKeepShop(){const nu=JSON.parse(JSON.stringify(data));nu.users[me].postMatchChoice=false;setData(nu);}
  function onNewShop(){
    const nu=JSON.parse(JSON.stringify(data));
    const u=nu.users[me];u.postMatchChoice=false;
    u.shop=buildShop(allCards,u.deck||[]);
    setData(nu);
  }
  function onLogout(){setMe(null);setScreen("login");setShowAdmin(false);}

  if(screen==="login")return <LoginScreen data={data} onLogin={onLogin} onSpectator={onSpectator} onRegister={onRegister}/>;
  if(screen==="spectator")return <SpectatorView data={data}/>;
  if(screen==="selectRegions")return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Crimson Pro',Georgia,serif"}}>
      <style>{CSS}</style>
      <RegionSelect onComplete={onRegionComplete}/>
    </div>
  );

  const userData=data.users[me]||{};
  const isAdmin=userData.role==="admin";
  const myBracket=getBracket(userData.losses||0);
  const bColor={winners:C.gold,lb1:"#5badcc",lb2:"#cc7020",eliminated:"#cc3333"};
  const bLabel={winners:"🏆 Winners",lb1:"⚔️ LB1",lb2:"🔥 LB2",eliminated:"💀 Out"};

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Crimson Pro',Georgia,serif",fontSize:"16px"}}>
      <style>{CSS}</style>
      {showAdmin&&<AdminPanel data={data} onUpdate={setData} onClose={()=>setShowAdmin(false)} allCards={allCards}/>}

      <div style={{background:"#090b13",borderBottom:"1px solid #c8a96e1a",padding:"10px 18px",position:"sticky",top:0,zIndex:50,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"13px",fontWeight:900,color:C.gold,letterSpacing:".1em"}}>CHRONICLES OF RUNETERRA</div>
          <div style={{fontSize:"11px",color:isAdmin?"#888":bColor[myBracket],marginTop:"1px"}}>
            {me}{isAdmin?" · Admin":` · ${userData.wins||0}W–${userData.losses||0}L · ${bLabel[myBracket]}`}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {isAdmin&&<button className="btn" onClick={()=>setShowAdmin(true)} style={{padding:"5px 11px",background:"#1a1200",border:"1px solid #c8a96e44",borderRadius:"7px",color:C.gold,fontFamily:"'Cinzel',serif",fontSize:"11px",fontWeight:600}}>⚙️ Admin</button>}
          {!isAdmin&&<CoinBadge n={userData.coins||0}/>}
          <button className="btn" onClick={onLogout} style={{padding:"5px 10px",background:"transparent",border:"1px solid #333",borderRadius:"6px",color:"#444",fontFamily:"'Cinzel',serif",fontSize:"10px"}}>Logout</button>
        </div>
      </div>

      <div style={{padding:"13px 18px",maxWidth:"640px",margin:"0 auto"}}>
        <div style={{marginBottom:"13px"}}>
          <TabBar active={tab} onChange={setTab} isAdmin={isAdmin}/>
        </div>
        {tab==="deck"&&!isAdmin&&<DeckScreen deck={userData.deck} regionIds={userData.regions}/>}
        {tab==="shop"&&!isAdmin&&<ShopScreen shop={userData.shop} coins={userData.coins||0} deck={userData.deck||[]} locked={userData.shopLocked} postMatchChoice={userData.postMatchChoice} onBuy={onBuy} onReroll={onReroll} onKeepShop={onKeepShop} onNewShop={onNewShop}/>}
        {tab==="bracket"&&<BracketScreen data={data} me={me}/>}
        {tab==="standings"&&<StandingsScreen data={data} me={me} showCoins={isAdmin}/>}
      </div>
    </div>
  );
}
