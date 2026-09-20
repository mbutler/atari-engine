import test from 'node:test';
import assert from 'node:assert/strict';
import {duel,RAM,RAM_USED,COURT} from '../examples/duel.mjs';
import {createDuelInputs} from '../examples/duel-controls.mjs';
import {createClock,createInput} from '../src/index.mjs';
const STILL={x:0,y:0,action:false},IDLE={left:STILL,right:STILL};
const PANEL={select:false,reset:false,difficulty:{left:'b',right:'b'}};
const start=options=>{const cart=duel(options);cart.update(IDLE,{...PANEL,reset:true});return cart;};
const key=(target,code,type='keydown',repeat=false)=>{
 const event=new Event(type,{cancelable:true});Object.assign(event,{code,repeat});target.dispatchEvent(event);return event;
};
test('shared keyboard has independent directions and latched action buttons',()=>{
 const target=new EventTarget(),commands=[],input=createDuelInputs({target,pads:()=>[],onCommand:c=>commands.push(c)});
 key(target,'KeyW');assert.equal(key(target,'ArrowDown').defaultPrevented,true);
 let read=input.read();assert.equal(read.left.y,-1);assert.equal(read.right.y,1);
 key(target,'Space');key(target,'Space','keyup');key(target,'Enter');key(target,'Enter','keyup');
 read=input.read();assert.equal(read.left.action,true);assert.equal(read.right.action,true);
 read=input.read();assert.equal(read.left.action,false);assert.equal(read.right.action,false);
 key(target,'KeyP');key(target,'KeyP','keydown',true);assert.deepEqual(commands,['pause']);
 input.clear();assert.equal(input.read().left.y,0);assert.equal(input.read().right.y,0);
 input.destroy();key(target,'KeyS');key(target,'ArrowUp');assert.equal(input.read().left.y,0);assert.equal(input.read().right.y,0);
});
test('gamepad ports stay separate and can be mixed with keyboard controls',()=>{
 const target=new EventTarget();
 const pads=[{connected:true,axes:[0,-1],buttons:[{pressed:true}]},{connected:true,axes:[0,1],buttons:[]}];
 const input=createDuelInputs({target,pads:()=>pads});
 let read=input.read();assert.equal(read.left.y,-1);assert.equal(read.right.y,1);
 assert.equal(read.left.action,true);assert.equal(read.right.action,false);
 pads[0]=null;key(target,'KeyS');read=input.read();assert.equal(read.left.y,1);assert.equal(read.right.y,1);
 pads[1]=null;assert.equal(input.read().right.y,0);input.destroy();
});
test('custom action bindings replace the defaults without breaking the default controller',()=>{
 const target=new EventTarget(),custom=createInput({target,keys:{Enter:'action'}}),standard=createInput({target});
 key(target,'Space');key(target,'Space','keyup');assert.equal(custom.read().action,false);assert.equal(standard.read().action,true);
 key(target,'Enter');key(target,'Enter','keyup');assert.equal(custom.read().action,true);assert.equal(standard.read().action,false);
 custom.destroy();standard.destroy();
 assert.throws(()=>createInput({target,keys:{KeyW:'north'}}),/bindings/);
});
test('both bats move independently, clamp at court edges, and have separate difficulty',()=>{
 const cart=start();cart.update({left:{...STILL,y:-1},right:{...STILL,y:1}},PANEL);
 assert.equal(cart.ram[RAM.leftY],91);assert.equal(cart.ram[RAM.rightY],97);
 for(let i=0;i<100;i++)cart.update({left:{...STILL,y:-1},right:{...STILL,y:1}},PANEL);
 assert.equal(cart.ram[RAM.leftY],COURT.top);assert.equal(cart.ram[RAM.rightY],COURT.bottom-24);
 cart.update(IDLE,{...PANEL,difficulty:{left:'a',right:'b'}});
 assert.deepEqual(cart.render().commands.filter(c=>c.kind==='sprite').map(c=>c.height),[16,24]);
 cart.update(IDLE,{...PANEL,difficulty:{left:'b',right:'a'}});
 assert.deepEqual(cart.render().commands.filter(c=>c.kind==='sprite').map(c=>c.height),[24,16]);
});
test('ball reflects off each bat and the court walls with separate sound channels',()=>{
 const sounds=[],cart=start({voices:{play:(effect,options)=>sounds.push(options.channel)}});
 cart.ram[RAM.serve]=0;cart.ram[RAM.ballX]=12;cart.ram[RAM.ballY]=100;cart.ram[RAM.rightward]=0;
 cart.update(IDLE,PANEL);assert.equal(cart.ram[RAM.rightward],1);assert.equal(cart.ram[RAM.leftScore],0);
 cart.ram[RAM.ballX]=146;cart.ram[RAM.ballY]=100;cart.update(IDLE,PANEL);assert.equal(cart.ram[RAM.rightward],0);
 cart.ram[RAM.ballX]=80;cart.ram[RAM.ballY]=COURT.top;cart.ram[RAM.vertical]=0;
 cart.update(IDLE,PANEL);assert.equal(cart.ram[RAM.vertical],2);assert.equal(cart.ram[RAM.ballY],COURT.top);
 cart.ram[RAM.ballY]=COURT.bottom-3;cart.ram[RAM.vertical]=2;
 cart.update(IDLE,PANEL);assert.equal(cart.ram[RAM.vertical],0);
 cart.ram[RAM.ballX]=157;cart.ram[RAM.rightward]=1;cart.update(IDLE,PANEL);
 assert.equal(cart.ram[RAM.leftScore],1);assert.equal(cart.ram[RAM.serve],60);assert.deepEqual(sounds,[0,0,0,0,1]);
});
test('misses award the opponent a point and the seventh point ends the match',()=>{
 for(const winner of ['left','right']){
  const cart=start();
  for(let i=1;i<=7;i++){
   cart.ram[RAM.serve]=0;cart.ram[RAM.ballX]=winner==='left'?157:1;
   cart.ram[RAM.rightward]=Number(winner==='left');cart.update(IDLE,PANEL);
   assert.equal(cart.ram[winner==='left'?RAM.leftScore:RAM.rightScore],i);
  }
  assert.equal(cart.winner,winner);assert.equal(cart.mode,2);
  const before=cart.ram.slice();cart.update(IDLE,PANEL);assert.deepEqual(cart.ram,before);
  cart.update({left:STILL,right:{...STILL,action:true}},PANEL);
  assert.equal(cart.mode,1);assert.equal(cart.ram[RAM.leftScore],0);assert.equal(cart.ram[RAM.rightScore],0);
 }
});
test('select advances once per press, fast play takes two steps, and reset preserves variation',()=>{
 const cart=duel();
 for(let i=0;i<10;i++)cart.update(IDLE,{...PANEL,select:true});
 assert.equal(cart.ram[RAM.variation],1);
 cart.update(IDLE,{...PANEL,reset:true});assert.equal(cart.ram[RAM.variation],1);
 cart.ram[RAM.serve]=0;cart.ram[RAM.ballX]=80;cart.update(IDLE,PANEL);assert.equal(cart.ram[RAM.ballX],82);
 cart.update(IDLE,{...PANEL,select:true});assert.equal(cart.ram[RAM.variation],1,'variation stays fixed during a match');
});
test('matches replay identically across render rates and stay within the object budget',()=>{
 const run=fps=>{
  const cart=start(),clock=createClock();let step=0;
  for(let i=0;i<fps*20;i++){
   clock.advance(1/fps,()=>{
    cart.update({left:{...STILL,y:Math.floor(step/45)%2?1:-1},right:{...STILL,y:Math.floor(step/61)%2?-1:1}},PANEL);step++;
   });
   const frame=cart.render();
   assert.equal(frame.commands.filter(c=>c.kind==='sprite').length,2);
   assert.ok(frame.commands.filter(c=>c.kind==='missile').length<=1);
  }
  assert.equal(step,1200);assert.equal(cart.ram.length,128);assert.ok(RAM_USED<=100);
  assert.ok(cart.ram[RAM.leftScore]+cart.ram[RAM.rightScore]>0);
  return cart.ram;
 };
 const reference=run(60);for(const fps of [20,30,120,144])assert.deepEqual(run(fps),reference);
});
