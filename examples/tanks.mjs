// Two independent joysticks: turn, drive, fire. Rules and artwork belong here;
// the engine supplies input ports, collision latches and two audio channels.
import {VCSFrame,pixels,AUDC} from '../src/index.mjs';
export const RAM=Object.freeze({mode:0,variation:1,actions:2,selectHeld:3,tick:4,ready:5,
 x:6,y:8,direction:10,turn:12,score:14,reload:16,expert:18,
 shotX:20,shotY:22,shotDirection:24,shotLife:26}); // Each player field uses two bytes.
export const RAM_USED=28,WIN_SCORE=5;
const VECTORS=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const rotate=rows=>Array.from({length:8},(_,y)=>{
 let row=0;for(let x=0;x<8;x++)if(rows[7-x]&(1<<(7-y)))row|=1<<(7-x);return row;
});
const UP=pixels(`...##...
...##...
##.##.##
########
########
########
##....##
##....##`);
const NE=pixels(`......##
.....###
.##.###.
.#####..
.######.
.######.
..####..
........`);
export const ART=[UP,NE];
for(let i=2;i<8;i++)ART.push(rotate(ART[i-2]));
const FIRE={control:AUDC.noise,frames:6,at:i=>({frequency:4+i*3,volume:9-i})};
const HIT={control:AUDC.lowBuzz,frames:24,priority:2,at:i=>({frequency:8+(i>>1),volume:Math.max(0,12-(i>>1))})};
const STILL={x:0,y:0,action:false};
const PANEL={select:false,reset:false,difficulty:{left:'b',right:'b'}};
const SPAWN=[24,128],COLORS=[0x8c,0x4c];
export function tanks({ram=new Uint8Array(128),voices=null}={}){
 if(!(ram instanceof Uint8Array)||ram.length!==128)throw new RangeError('A cartridge needs 128 bytes of RAM');
 const frame=new VCSFrame();
 const sound=(effect,channel)=>{if(voices)voices.play(effect,{channel});};
 const round=()=>{
  for(let p=0;p<2;p++){
   ram[RAM.x+p]=SPAWN[p];ram[RAM.y+p]=100;ram[RAM.direction+p]=p?6:2;
   ram[RAM.shotLife+p]=0;ram[RAM.reload+p]=0;ram[RAM.turn+p]=0;
  }
  ram[RAM.ready]=45;
 };
 const begin=()=>{ram[RAM.mode]=1;ram[RAM.score]=0;ram[RAM.score+1]=0;ram[RAM.tick]=0;round();};
 const cart={
  ram,RAM_USED,
  get mode(){return ram[RAM.mode];},
  get winner(){return ram[RAM.mode]!==2?null:ram[RAM.score]===ram[RAM.score+1]?'draw':ram[RAM.score]>ram[RAM.score+1]?'left':'right';},
  update({left=STILL,right=STILL}={},panel=PANEL){
   ram[RAM.expert]=Number(panel.difficulty.left==='a');ram[RAM.expert+1]=Number(panel.difficulty.right==='a');
   const actions=Number(left.action)|(Number(right.action)<<1),pressed=actions&~ram[RAM.actions];ram[RAM.actions]=actions;
   const select=panel.select&&!ram[RAM.selectHeld];ram[RAM.selectHeld]=Number(panel.select);
   if(select&&ram[RAM.mode]!==1)ram[RAM.variation]^=1;
   if(panel.reset||(pressed&&ram[RAM.mode]!==1)){begin();return cart;}
   if(ram[RAM.mode]!==1)return cart;
   if(ram[RAM.ready]){ram[RAM.ready]--;return cart;}
   ram[RAM.tick]=(ram[RAM.tick]+1)&255;
   const inputs=[left,right],previous=[];
   for(let p=0;p<2;p++){
    previous.push([ram[RAM.x+p],ram[RAM.y+p],ram[RAM.direction+p]]);
    if(ram[RAM.turn+p])ram[RAM.turn+p]--;
    if(inputs[p].x&&!ram[RAM.turn+p]){
     ram[RAM.direction+p]=(ram[RAM.direction+p]+Math.sign(inputs[p].x)+8)%8;ram[RAM.turn+p]=8;
    }
    if(!(ram[RAM.tick]&1)){
     const [dx,dy]=VECTORS[ram[RAM.direction+p]],drive=-Math.sign(inputs[p].y);
     ram[RAM.x+p]=Math.max(4,Math.min(148,ram[RAM.x+p]+dx*drive));
     ram[RAM.y+p]=Math.max(28,Math.min(172,ram[RAM.y+p]+dy*drive*2));
    }
   }
   // Resolve both proposed moves together, so player order confers no advantage.
   const contact=cart.render(),together=contact.hit('tank0','tank1');
   const blocked=[0,1].map(p=>together||contact.hit(`tank${p}`,'wall'));
   for(let p=0;p<2;p++)if(blocked[p]){
    [ram[RAM.x+p],ram[RAM.y+p],ram[RAM.direction+p]]=previous[p];
   }
   for(let p=0;p<2;p++){
    if(ram[RAM.reload+p])ram[RAM.reload+p]--;
    if(inputs[p].action&&!ram[RAM.reload+p]&&!ram[RAM.shotLife+p]){
     ram[RAM.shotX+p]=ram[RAM.x+p]+3;ram[RAM.shotY+p]=ram[RAM.y+p]+7;
     ram[RAM.shotDirection+p]=ram[RAM.direction+p];ram[RAM.shotLife+p]=90;
     ram[RAM.reload+p]=ram[RAM.expert+p]?70:40;sound(FIRE,p);
    }
   }
   // Two short missile steps prevent tunnelling. Read both hits before resolving
   // either: simultaneous hits score for both players, including a possible draw.
   for(let step=0;step<2;step++){
    for(let p=0;p<2;p++)if(ram[RAM.shotLife+p]){
     const [dx,dy]=VECTORS[ram[RAM.shotDirection+p]];
     const x=ram[RAM.shotX+p]+dx,y=ram[RAM.shotY+p]+dy*2;
     if(x<4||x>154||y<28||y>186){ram[RAM.shotLife+p]=0;continue;}
     ram[RAM.shotX+p]=x;ram[RAM.shotY+p]=y;
    }
    const collision=cart.render();
    const hits=[0,1].map(p=>!!ram[RAM.shotLife+p]&&collision.hit(`shot${p}`,`tank${1-p}`)&&!collision.hit(`shot${p}`,'wall'));
    for(let p=0;p<2;p++)if(collision.hit(`shot${p}`,'wall'))ram[RAM.shotLife+p]=0;
    if(hits.some(Boolean)){
     for(let p=0;p<2;p++)if(hits[p]){ram[RAM.score+p]++;sound(HIT,p);}
     if(ram[RAM.score]>=WIN_SCORE||ram[RAM.score+1]>=WIN_SCORE){ram[RAM.mode]=2;ram[RAM.shotLife]=0;ram[RAM.shotLife+1]=0;}
     else round();
     break;
    }
   }
   for(let p=0;p<2;p++)if(ram[RAM.shotLife+p])ram[RAM.shotLife+p]--;
   return cart;
  },
  render(){
   frame.clear(0x00);
   frame.number(ram[RAM.score],{x:44,y:4,digits:1,color:COLORS[0]});
   frame.number(ram[RAM.score+1],{x:108,y:4,digits:1,color:COLORS[1]});
   frame.playfield('#'.repeat(40),{mode:'asymmetric',y:24,height:4,color:0xc4,id:'wall'});
   frame.playfield('#'.repeat(40),{mode:'asymmetric',y:188,height:4,color:0xc4,id:'wall'});
   for(const [y,height,cover] of [[28,32,false],[60,24,true],[84,52,false],[136,24,true],[160,28,false]]){
    const row=Array(40).fill('.');row[0]=row[39]='#';
    if(cover&&ram[RAM.variation])row[19]=row[20]='#';
    frame.playfield(row.join(''),{mode:'asymmetric',y,height,color:0xc4,id:'wall'});
   }
   for(let p=0;p<2;p++){
    frame.sprite(ART[ram[RAM.mode]===0?(p?6:2):ram[RAM.direction+p]],{
     x:ram[RAM.mode]===0?SPAWN[p]:ram[RAM.x+p],y:ram[RAM.mode]===0?100:ram[RAM.y+p],color:COLORS[p],id:`tank${p}`});
    if(ram[RAM.shotLife+p])frame.missile(ram[RAM.shotX+p],ram[RAM.shotY+p],{width:2,height:2,color:COLORS[p],id:`shot${p}`});
   }
   if(ram[RAM.mode]===0)frame.number(ram[RAM.variation]+1,{x:76,y:100,digits:1,color:0x0e});
   if(ram[RAM.mode]===2)frame.number(WIN_SCORE,{x:76,y:100,digits:1,color:cart.winner==='draw'?0x0e:COLORS[cart.winner==='left'?0:1]});
   return frame;
  },
 };
 return cart;
}
