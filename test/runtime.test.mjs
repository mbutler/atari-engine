import test from 'node:test';
import assert from 'node:assert/strict';
import {createClock,createInput,createConsole} from '../src/index.mjs';
test('clock produces equal updates across different refresh rates',()=>{for(const fps of [30,60,120,144]){let count=0;const clock=createClock();for(let i=0;i<fps;i++)clock.advance(1/fps,dt=>{assert.equal(dt,1/60);count++;});assert.equal(count,60);}});
test('clock caps background catchup and reset removes partial frames',()=>{const c=createClock();assert.equal(c.advance(10,()=>{}),3);c.advance(1/240,()=>{});c.reset();assert.equal(c.advance(1/240,()=>{}),0);});
test('a quick action tap survives until a simulation step reads it',()=>{const input=createInput({target:new EventTarget()});input.press('Space');input.release('Space');assert.equal(input.read().action,true);assert.equal(input.read().action,false);input.press('Space');input.clear();assert.equal(input.read().action,false);input.destroy();});
test('input combines key aliases and provides cleanup',()=>{const target=new EventTarget(),commands=[];const input=createInput({target,onCommand:c=>commands.push(c)});input.press('ArrowLeft');input.press('KeyA');input.release('ArrowLeft');assert.equal(input.read().x,-1);input.press('Space');assert.equal(input.read().action,true);const e=new Event('keydown',{cancelable:true});Object.assign(e,{code:'KeyP',repeat:false});target.dispatchEvent(e);assert.deepEqual(commands,['pause']);input.destroy();target.dispatchEvent(e);assert.deepEqual(commands,['pause']);assert.deepEqual(input.read(),{x:0,y:0,action:false});});
test('momentary switches latch a tap, and holding Select keeps reading true',()=>{
 const panel=createConsole({target:new EventTarget()});
 panel.press('Digit1');panel.release('Digit1');
 assert.equal(panel.read().select,true,'a tap between reads must survive');
 assert.equal(panel.read().select,false);
 // Held down it stays true, which is how a console runs through its variations.
 panel.press('Digit1');
 assert.equal(panel.read().select,true);
 assert.equal(panel.read().select,true);
 panel.release('Digit1');
 assert.equal(panel.read().select,false);
 panel.press('Digit2');
 assert.equal(panel.read().reset,true);
 panel.destroy();
});
test('toggle switches flip once per press, not per key repeat',()=>{
 const changes=[],panel=createConsole({target:new EventTarget(),onSwitch:(name,value)=>changes.push([name,value])});
 assert.deepEqual(panel.read(),{select:false,reset:false,color:true,difficulty:{left:'b',right:'b'}});
 panel.press('Digit3');
 assert.equal(panel.read().color,false);
 panel.press('Digit3');                       // still held: must not flip back
 assert.equal(panel.read().color,false);
 panel.release('Digit3');panel.press('Digit3');
 assert.equal(panel.read().color,true);
 panel.press('Digit4');panel.press('Digit5');
 assert.deepEqual(panel.read().difficulty,{left:'a',right:'a'});
 assert.deepEqual(changes,[['color',false],['color',true],['left','a'],['right','a']]);
 panel.destroy();
});
test('a host can flip switches itself, and unmapped keys are ignored',()=>{
 const changes=[],panel=createConsole({target:new EventTarget(),onSwitch:(n,v)=>changes.push([n,v])});
 panel.set({color:false,left:'a'});
 assert.equal(panel.read().color,false);
 assert.equal(panel.read().difficulty.left,'a');
 panel.set({color:false});                    // already there: no event
 assert.deepEqual(changes,[['color',false],['left','a']]);
 assert.throws(()=>panel.set({right:'c'}),/"a" or "b"/);
 panel.press('KeyZ');
 assert.deepEqual(panel.read(),{select:false,reset:false,color:false,difficulty:{left:'a',right:'b'}});
 panel.destroy();
});
test('the console listens to real key events and stops when destroyed',()=>{
 const target=new EventTarget(),panel=createConsole({target});
 const tap=code=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{code,repeat:false});target.dispatchEvent(e);
                  const u=new Event('keyup');Object.assign(u,{code});target.dispatchEvent(u);};
 tap('Digit1');
 assert.equal(panel.read().select,true);
 tap('Digit3');
 assert.equal(panel.read().color,false);
 panel.destroy();
 tap('Digit1');tap('Digit3');
 assert.deepEqual(panel.read(),{select:false,reset:false,color:false,difficulty:{left:'b',right:'b'}});
});
