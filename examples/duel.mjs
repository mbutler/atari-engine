// Two sticks, two players, one ball. A keyboard or gamepad drives each stick;
// physical paddles are not required. All mutable game state lives in console RAM.
import {VCSFrame,AUDC} from '../src/index.mjs';
export const RAM=Object.freeze({mode:0,leftY:1,rightY:2,ballX:3,ballY:4,
 rightward:5,vertical:6,leftScore:7,rightScore:8,serve:9,variation:10,
 leftExpert:11,rightExpert:12,actions:13,selectHeld:14});
export const RAM_USED=15;
export const COURT=Object.freeze({top:28,bottom:186,left:10,right:148,win:7});
const BAT=Object.freeze(Array(8).fill(0xc0));
const BOUNCE={control:AUDC.tone,frames:3,at:i=>({frequency:8,volume:8-i*2})};
const POINT={control:AUDC.bass,frames:18,priority:1,at:i=>({frequency:12+(i>>1),volume:Math.max(0,10-i)})};
const WIN={control:AUDC.bass,frames:40,priority:2,at:i=>({frequency:6+(i>>2),volume:Math.max(0,12-(i>>2))})};
const STILL={x:0,y:0,action:false};
const PANEL={select:false,reset:false,difficulty:{left:'b',right:'b'}};
export function duel({ram=new Uint8Array(128),voices=null}={}){
 if(!(ram instanceof Uint8Array)||ram.length!==128)throw new RangeError('A cartridge needs 128 bytes of RAM');
 const frame=new VCSFrame();
 const height=side=>ram[side==='left'?RAM.leftExpert:RAM.rightExpert]?16:24;
 const sound=(effect,channel)=>{if(voices)voices.play(effect,{channel});};
 const serve=()=>{ram[RAM.ballX]=79;ram[RAM.ballY]=106;ram[RAM.vertical]=ram[RAM.rightward]?2:0;ram[RAM.serve]=60;};
 const begin=()=>{
  ram[RAM.mode]=1;ram[RAM.leftScore]=0;ram[RAM.rightScore]=0;
  ram[RAM.leftY]=94;ram[RAM.rightY]=94;ram[RAM.rightward]=1;serve();
 };
 const point=side=>{
  const score=side==='left'?RAM.leftScore:RAM.rightScore;
  ram[score]++;ram[RAM.rightward]=side==='left'?1:0;
  if(ram[score]===COURT.win){ram[RAM.mode]=2;sound(WIN,1);}
  else{serve();sound(POINT,1);}
 };
 const cart={
  ram,RAM_USED,
  get mode(){return ram[RAM.mode];},
  get winner(){return ram[RAM.mode]===2?(ram[RAM.leftScore]===COURT.win?'left':'right'):null;},
  update({left=STILL,right=STILL}={},panel=PANEL){
   ram[RAM.leftExpert]=Number(panel.difficulty.left==='a');
   ram[RAM.rightExpert]=Number(panel.difficulty.right==='a');
   const actions=Number(left.action)|(Number(right.action)<<1);
   const pressed=actions&~ram[RAM.actions];ram[RAM.actions]=actions;
   const select=panel.select&&!ram[RAM.selectHeld];ram[RAM.selectHeld]=Number(panel.select);
   if(select&&ram[RAM.mode]!==1)ram[RAM.variation]^=1;
   if(panel.reset||(pressed&&ram[RAM.mode]!==1)){begin();return cart;}
   if(ram[RAM.mode]!==1)return cart;
   for(const [side,input,offset] of [['left',left,RAM.leftY],['right',right,RAM.rightY]])
    ram[offset]=Math.max(COURT.top,Math.min(COURT.bottom-height(side),ram[offset]+Math.sign(input.y)*3));
   if(ram[RAM.serve]){ram[RAM.serve]--;return cart;}
   // A faster variation takes two whole-pixel steps. Collisions are rebuilt for
   // each step, independently of browser presentation, so neither bat can be skipped.
   for(let step=0;step<=ram[RAM.variation];step++){
    ram[RAM.ballX]+=ram[RAM.rightward]?1:-1;
    let y=ram[RAM.ballY]+ram[RAM.vertical]-1;
    if(y<COURT.top||y>COURT.bottom-3){ram[RAM.vertical]=2-ram[RAM.vertical];y=Math.max(COURT.top,Math.min(COURT.bottom-3,y));sound(BOUNCE,0);}
    ram[RAM.ballY]=y;
    const collision=cart.render();
    const side=ram[RAM.rightward]?'right':'left';
    if(collision.hit('ball',side)){
     ram[RAM.rightward]^=1;
     ram[RAM.ballX]=side==='left'?COURT.left+2:COURT.right-2;
     const center=ram[side==='left'?RAM.leftY:RAM.rightY]+height(side)/2;
     ram[RAM.vertical]=ram[RAM.ballY]+1<center?0:2;
     sound(BOUNCE,0);
    }
    if(ram[RAM.ballX]===0){point('right');break;}
    if(ram[RAM.ballX]>=158){point('left');break;}
   }
   return cart;
  },
  render(){
   frame.clear(0x00);
   frame.playfield('####################',{y:24,height:2,color:0x06});
   frame.playfield('####################',{y:188,height:2,color:0x06});
   for(let y=30;y<184;y+=12)frame.playfield('...................#',{y,height:5,color:0x02});
   // The score overlay is deliberately outside the object budget (see README).
   frame.number(ram[RAM.leftScore],{x:52,y:4,digits:1,color:0x8c});
   frame.number(ram[RAM.rightScore],{x:100,y:4,digits:1,color:0x4c});
   for(const side of ['left','right'])frame.sprite(BAT,{x:COURT[side],
    y:ram[RAM.mode]===0?94:ram[side==='left'?RAM.leftY:RAM.rightY],
    lineHeight:height(side)/8,color:side==='left'?0x8c:0x4c,id:side});
   if(ram[RAM.mode]===1)frame.missile(ram[RAM.ballX],ram[RAM.ballY],{width:2,height:3,color:0x0e,id:'ball'});
   if(ram[RAM.mode]===0)frame.number(ram[RAM.variation]+1,{x:76,y:100,digits:1,color:0x0e});
   if(ram[RAM.mode]===2)frame.number(COURT.win,{x:76,y:100,digits:1,color:cart.winner==='left'?0x8c:0x4c});
   return frame;
  },
 };
 return cart;
}
