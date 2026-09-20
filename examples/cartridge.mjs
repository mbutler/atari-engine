// A reference cartridge. It is deliberately a dull game: its job is to show how the
// engine's parts wire together and to hold itself to 1982 scope, not to be good.
//
// Everything it knows lives in 128 bytes, because that is all a 2600 had and the RAM
// was in the console rather than the cartridge. State is a Uint8Array taken as an
// argument so a console could one day pass its own in and have it survive a swap.
import {VCSFrame,HEIGHT,pixels,AUDC} from '../src/index.mjs';

export const art={
 catcher:pixels(`
  ##....##
  ##....##
  ##....##
  ##....##
  ##....##
  ##....##
  ########
  .######.`),
 narrow:pixels(`
  ..#..#..
  ..#..#..
  ..#..#..
  ..#..#..
  ..#..#..
  ..#..#..
  ..####..
  ...##...`),
 faller:pixels(`
  ..####..
  .######.
  ########
  ########
  ########
  ########
  .######.
  ..####..`),
};
// Named offsets into the 128 bytes. Every byte this game owns is on this list; if a
// feature needs a byte that is not here, something else has to give it up.
export const RAM=Object.freeze({
 mode:0,        // 0 attract, 1 playing, 2 over
 catcherX:1,
 lives:2,
 scoreLow:3,scoreHigh:4,
 variation:5,
 fallAccum:6,
 spawnTimer:7,
 seed:8,
 flash:9,
 fallerX:10,    // 10 11 12
 fallerY:13,    // 13 14 15
 fallerLive:16, // 16 17 18
});
export const RAM_USED=19;
const FALLERS=3,CATCH_Y=170,LEFT=4,RIGHT=148,TOP=24,GAP=24,FLOOR=186;
// Effects are the cartridge's own; the engine only supplies the primitives.
const CAUGHT={control:AUDC.tone,frames:6,at:i=>({frequency:9-i,volume:10-i})};
const MISSED={control:AUDC.lowBuzz,frames:14,at:i=>({frequency:18+i,volume:Math.max(0,11-i)})};
const OVER={control:AUDC.bass,frames:44,priority:2,at:i=>({frequency:6+(i>>1),volume:Math.max(0,12-(i>>2))})};

export function catcher({ram=new Uint8Array(128),voices=null}={}){
 const frame=new VCSFrame();
 const sound=effect=>{if(voices)voices.play(effect);};
 const score=()=>ram[RAM.scoreLow]|(ram[RAM.scoreHigh]<<8);
 const award=points=>{const total=Math.min(9999,score()+points);ram[RAM.scoreLow]=total&0xff;ram[RAM.scoreHigh]=total>>8;};
 // The same trick Pitfall used for its screens: one byte of shift register stands in
 // for a random number generator there was no room to carry.
 const roll=()=>{const seed=ram[RAM.seed]||1;return ram[RAM.seed]=((seed>>1)^(-(seed&1)&0xb8))&0xff;};
 // Sixteenths of a pixel per frame. Whole-pixel speeds are too coarse to tune -- one
 // pixel a frame is already twice as fast as one every two -- so the fraction is carried
 // in an accumulator, which is what a 2600 did rather than hold a real number.
 // Speed rises with the score, so a level does not need a byte of its own.
 const speed=()=>Math.min(40,12+Math.min(20,Math.floor(score()/6))+((ram[RAM.variation]&1)?6:0));
 const begin=()=>{
  ram[RAM.mode]=1;ram[RAM.lives]=3;ram[RAM.scoreLow]=0;ram[RAM.scoreHigh]=0;
  ram[RAM.catcherX]=76;ram[RAM.fallAccum]=0;ram[RAM.spawnTimer]=0;ram[RAM.flash]=0;
  for(let i=0;i<FALLERS;i++)ram[RAM.fallerLive+i]=0;
 };
 const cartridge={
  ram,RAM_USED,
  get score(){return score();},
  get mode(){return ram[RAM.mode];},
  // One simulation step. dt is ignored on purpose: the loop is a fixed 60 Hz and every
  // position here is a whole pixel, which is what keeps the motion reading as a 2600
  // rather than as something with a floating point camera.
  update(input,panel){
   // Build collision latches from the current state once per simulation step.
   // Browser presentation may skip steps or repeat them on a faster display.
   const touching=cartridge.render().hit('catcher','faller');
   if(panel.reset){begin();return cartridge;}
   if(ram[RAM.mode]!==1){
    if(panel.select)ram[RAM.variation]=(ram[RAM.variation]+1)&3;
    if(input.action)begin();
    if(ram[RAM.flash])ram[RAM.flash]--;
    return cartridge;
   }
   // Difficulty A is the expert setting, so the catcher is the slower one.
   const step=panel.difficulty.left==='a'?1:2;
   ram[RAM.catcherX]=Math.max(LEFT,Math.min(RIGHT,ram[RAM.catcherX]+input.x*step));
   if(ram[RAM.flash])ram[RAM.flash]--;
   // Everything descends together on one accumulator, as a 2600 kernel would.
   ram[RAM.fallAccum]+=speed();
   while(ram[RAM.fallAccum]>=16){
    ram[RAM.fallAccum]-=16;
    for(let i=0;i<FALLERS;i++)if(ram[RAM.fallerLive+i])ram[RAM.fallerY+i]++;
   }
   // The hardware says something was caught but not which, exactly as two players
   // sharing a register would, so the lowest faller is taken as the one that hit.
   if(touching){
    let lowest=-1;
    for(let i=0;i<FALLERS;i++)if(ram[RAM.fallerLive+i]&&(lowest<0||ram[RAM.fallerY+i]>ram[RAM.fallerY+lowest]))lowest=i;
    if(lowest>=0){ram[RAM.fallerLive+lowest]=0;award(1);sound(CAUGHT);}
   }
   for(let i=0;i<FALLERS;i++){
    if(!ram[RAM.fallerLive+i]||ram[RAM.fallerY+i]<CATCH_Y)continue;
    ram[RAM.fallerLive+i]=0;ram[RAM.flash]=8;sound(MISSED);
    if(--ram[RAM.lives]===0){ram[RAM.mode]=2;ram[RAM.flash]=30;sound(OVER);}
   }
   // Never spawn closer than one sprite height to the last, so no scanline ever needs
   // more players than the hardware has.
   if(++ram[RAM.spawnTimer]>=24){
    let highest=HEIGHT,free=-1;
    for(let i=0;i<FALLERS;i++){
     if(!ram[RAM.fallerLive+i]){if(free<0)free=i;continue;}
     highest=Math.min(highest,ram[RAM.fallerY+i]);
    }
    const allowed=(ram[RAM.variation]&2)?2:FALLERS;
    let live=0;for(let i=0;i<FALLERS;i++)if(ram[RAM.fallerLive+i])live++;
    if(free>=0&&live<allowed&&highest>=TOP+GAP){
     ram[RAM.spawnTimer]=0;ram[RAM.fallerLive+free]=1;
     ram[RAM.fallerY+free]=TOP;ram[RAM.fallerX+free]=LEFT+(roll()%(RIGHT-LEFT));
    }
   }
   return cartridge;
  },
  // Draws the whole picture and hands it back for the host to present.
  render(){
   frame.clear(0x00);
   frame.scanlines(0,FLOOR,line=>0x90+(Math.min(4,Math.floor(line*5/FLOOR))<<1));
   frame.playfield('####################',{y:FLOOR,height:HEIGHT-FLOOR,color:0xc6,id:'floor'});
   frame.number(score(),{x:6,y:6,digits:4,color:ram[RAM.flash]&4?0x46:0x0e});
   for(let i=0;i<ram[RAM.lives];i++)frame.missile(138+i*7,8,{width:2,height:10,color:0x46});
   if(ram[RAM.mode]===0)frame.number(ram[RAM.variation]+1,{x:72,y:80,digits:1,scaleX:2,scaleY:3,color:0x1c});
   for(let i=0;i<FALLERS;i++)if(ram[RAM.fallerLive+i])
    frame.sprite(art.faller,{x:ram[RAM.fallerX+i],y:ram[RAM.fallerY+i],color:0x1c,id:'faller'});
   // The catcher blinks while the game-over flash runs, then settles back on screen.
   const blinkedOut=ram[RAM.mode]===2&&ram[RAM.flash]>0&&!(ram[RAM.flash]&2);
   if(!blinkedOut)
    frame.sprite((ram[RAM.variation]&2)?art.narrow:art.catcher,{x:ram[RAM.catcherX],y:CATCH_Y,color:0x0e,id:'catcher'});
   return frame;
  },
 };
 return cartridge;
}
