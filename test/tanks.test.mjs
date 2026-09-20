import test from 'node:test';
import assert from 'node:assert/strict';
import {tanks,RAM,RAM_USED,ART,WIN_SCORE} from '../examples/tanks.mjs';
import {createTankInputs} from '../examples/tanks-controls.mjs';
import {createClock,createVoices} from '../src/index.mjs';
const STILL={x:0,y:0,action:false},FIRE={...STILL,action:true},IDLE={left:STILL,right:STILL};
const PANEL={difficulty:{left:'b',right:'b'},reset:false,select:false};
const start=options=>{const c=tanks(options);c.update(IDLE,{...PANEL,reset:true});c.ram[RAM.ready]=0;return c;};
const key=(target,code,type='keydown')=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code});target.dispatchEvent(e);};
test('both keyboard ports independently support diagonal input and fire',()=>{
 const target=new EventTarget(),input=createTankInputs({target,pads:()=>[]});
 for(const code of ['KeyW','KeyA','Space','ArrowDown','ArrowRight','Enter'])key(target,code);
 let read=input.read();
 assert.deepEqual({x:read.left.x,y:read.left.y,action:read.left.action},{x:-1,y:-1,action:true});
 assert.deepEqual({x:read.right.x,y:read.right.y,action:read.right.action},{x:1,y:1,action:true});
 for(const code of ['KeyW','KeyA','Space'])key(target,code,'keyup');
 read=input.read();assert.equal(read.left.x,0);assert.equal(read.left.y,0);assert.equal(read.left.action,false);
 assert.equal(read.right.x,1);assert.equal(read.right.y,1);assert.equal(read.right.action,true);
 input.clear();read=input.read();assert.equal(read.right.action,false);assert.equal(read.right.x,0);
 input.destroy();key(target,'KeyD');assert.equal(input.read().left.x,0);
});
test('two gamepads supply full independent joystick and fire readings',()=>{
 const pads=[{connected:true,axes:[-1,-1],buttons:[{pressed:true}]},{connected:true,axes:[1,1],buttons:[{pressed:false},{pressed:true}]}];
 const input=createTankInputs({target:new EventTarget(),pads:()=>pads});
 const read=input.read();assert.equal(read.left.x,-1);assert.equal(read.left.y,-1);assert.equal(read.left.action,true);
 assert.equal(read.right.x,1);assert.equal(read.right.y,1);assert.equal(read.right.action,true);
 pads[0]=null;const after=input.read();assert.equal(after.left.action,false);assert.equal(after.right.action,true);
 input.destroy();
});
test('tank state fits RAM and eight directions are distinct player bitmaps',()=>{
 assert.ok(RAM_USED<=100);assert.equal(new Set(ART.map(rows=>rows.join(','))).size,8);
 for(const rows of ART){assert.equal(rows.length,8);assert.ok(rows.every(row=>row>=0&&row<=255));}
 assert.throws(()=>tanks({ram:new Uint8Array(20)}),/128/);
});
test('players turn separately, drive forward or backward, and stay on screen',()=>{
 const c=start();c.update({left:{...STILL,x:1},right:{...STILL,x:-1}},PANEL);
 assert.equal(c.ram[RAM.direction],3);assert.equal(c.ram[RAM.direction+1],5);
 c.ram[RAM.direction]=2;c.ram[RAM.direction+1]=6;
 c.update({left:{...STILL,y:-1},right:{...STILL,y:1}},PANEL);
 assert.equal(c.ram[RAM.x],25);assert.equal(c.ram[RAM.x+1],129);
 for(let i=0;i<400;i++)c.update({left:{...STILL,y:1},right:{...STILL,y:1}},PANEL);
 assert.ok(c.ram[RAM.x]>=4);assert.ok(c.ram[RAM.x+1]<=148);
});
test('cover blocks tanks and shells, while the open variation lets shells through',()=>{
 for(const variation of [0,1]){
  const c=start();c.ram[RAM.variation]=variation;
  c.ram[RAM.x]=68;c.ram[RAM.y]=64;c.ram[RAM.tick]=1;
  c.update({left:{...STILL,y:-1},right:STILL},PANEL);
  assert.equal(c.ram[RAM.x],variation?68:69);
  c.ram[RAM.shotLife]=10;c.ram[RAM.shotX]=74;c.ram[RAM.shotY]=66;c.ram[RAM.shotDirection]=2;
  c.update(IDLE,PANEL);assert.equal(!!c.ram[RAM.shotLife],!variation);
  assert.equal(c.ram[RAM.score],0);
 }
});
test('tank contact blocks both proposed moves without favouring an input port',()=>{
 const c=start();c.ram[RAM.x]=60;c.ram[RAM.x+1]=68;c.ram[RAM.tick]=1;
 c.update({left:{...STILL,y:-1},right:{...STILL,y:-1}},PANEL);
 assert.equal(c.ram[RAM.x],60);assert.equal(c.ram[RAM.x+1],68);
});
test('both players fire together with one missile and sound channel each; difficulty changes reload',()=>{
 const writes=[],voices=createVoices({set:(channel,registers)=>writes.push({channel,...registers}),off:()=>{}});
 const c=start({voices});c.update({left:FIRE,right:FIRE},{...PANEL,difficulty:{left:'a',right:'b'}});voices.step();
 assert.ok(c.ram[RAM.shotLife]>0&&c.ram[RAM.shotLife+1]>0);
 assert.equal(c.render().commands.filter(command=>command.kind==='missile').length,2);
 assert.deepEqual(writes.map(write=>write.channel),[0,1]);
 assert.equal(c.ram[RAM.reload],70);assert.equal(c.ram[RAM.reload+1],40);
 for(let i=0;i<200;i++){c.update({left:FIRE,right:FIRE},PANEL);voices.step();}
 assert.ok(writes.some(write=>write.control===2),'hit effects replace firing sounds');
 assert.ok(writes.every(write=>write.channel===0||write.channel===1));
});
test('both players can win and simultaneous fifth hits end in a draw',()=>{
 for(const expected of ['left','right','draw']){
  const c=start(),inputs={left:expected==='right'?STILL:FIRE,right:expected==='left'?STILL:FIRE};
  for(let i=0;i<1500&&c.mode!==2;i++)c.update(inputs,PANEL);
  assert.equal(c.winner,expected);assert.equal(c.mode,2);
  assert.equal(Math.max(c.ram[RAM.score],c.ram[RAM.score+1]),WIN_SCORE);
  c.update(inputs,PANEL);assert.equal(c.mode,2,'held fire cannot restart a finished match');
  c.update(IDLE,PANEL);c.update({left:FIRE,right:STILL},PANEL);
  assert.equal(c.mode,1);assert.equal(c.ram[RAM.score],0);assert.equal(c.ram[RAM.score+1],0);
 }
});
test('Select toggles variations once per press outside play and Reset preserves selection',()=>{
 const c=tanks();for(let i=0;i<5;i++)c.update(IDLE,{...PANEL,select:true});assert.equal(c.ram[RAM.variation],1);
 c.update(IDLE,{...PANEL,reset:true});assert.equal(c.ram[RAM.variation],1);
 c.update(IDLE,PANEL);c.update(IDLE,{...PANEL,select:true});assert.equal(c.ram[RAM.variation],1);
});
test('full joystick matches stay deterministic across render rates and within the object budget',()=>{
 for(const variation of [0,1]){
  const run=fps=>{
   const c=start(),clock=createClock();c.ram[RAM.variation]=variation;let step=0;
   for(let i=0;i<fps*12;i++){
    clock.advance(1/fps,()=>{
     const turn=step%240<24?1:0,drive=step%160<80?-1:1;
     c.update({left:{x:turn,y:drive,action:true},right:{x:-turn,y:-drive,action:true}},PANEL);step++;
    });
    const frame=c.render();assert.equal(frame.commands.filter(c=>c.kind==='sprite').length,2);
    assert.ok(frame.commands.filter(c=>c.kind==='missile').length<=2);
   }
   assert.equal(step,720);return c.ram;
  };
  const normal=run(60);for(const fps of [20,30,144])assert.deepEqual(run(fps),normal);
 }
});
