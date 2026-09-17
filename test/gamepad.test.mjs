import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamepad,combineInputs,createInput} from '../src/index.mjs';
const pad=({axes=[0,0],down=[]}={})=>({connected:true,axes,buttons:Array.from({length:16},(_,i)=>({pressed:down.includes(i)}))});
const with_=state=>createGamepad({pads:()=>[state]});
test('a missing pad reads as no input at all',()=>{
 const idle=createGamepad({pads:()=>[]});
 assert.equal(idle.connected,false);
 assert.deepEqual(idle.read(),{x:0,y:0,action:false,analog:{x:0,y:0}});
});
test('the d-pad reads exactly as the keyboard does',()=>{
 assert.deepEqual(with_(pad({down:[14]})).read().x,-1);
 assert.deepEqual(with_(pad({down:[15]})).read().x,1);
 assert.deepEqual(with_(pad({down:[12]})).read().y,-1,'up is negative, as on the keyboard');
 assert.deepEqual(with_(pad({down:[13]})).read().y,1);
});
test('the stick is digital past the deadzone and analog underneath',()=>{
 const inside=with_(pad({axes:[0.2,-0.1]})).read();
 assert.deepEqual([inside.x,inside.y],[0,0],'a resting stick must not drift');
 assert.deepEqual(inside.analog,{x:0,y:0});
 const pushed=with_(pad({axes:[0.8,-0.6]})).read();
 assert.deepEqual([pushed.x,pushed.y],[1,-1]);
 assert.deepEqual(pushed.analog,{x:0.8,y:-0.6},'the raw stick stays available for continuous control');
 // The d-pad wins when both speak.
 assert.equal(with_(pad({axes:[0.9,0],down:[14]})).read().x,-1);
});
test('a button tap survives until a simulation step reads it',()=>{
 const state=pad(),stick=createGamepad({pads:()=>[state]});
 state.buttons[0].pressed=true;
 assert.equal(stick.read().action,true);
 state.buttons[0].pressed=false;
 assert.equal(stick.read().action,false);
 // Pressed and released between two reads: still reported once.
 state.buttons[0].pressed=true;stick.read();state.buttons[0].pressed=false;
 assert.equal(stick.read().action,false);
 assert.throws(()=>createGamepad({deadzone:1}),/at least 0 and below 1/);
});
test('a keyboard and a stick combine into one control',()=>{
 const keys=createInput({target:new EventTarget()});
 const state=pad(),both=combineInputs(keys,createGamepad({pads:()=>[state]}));
 assert.deepEqual(both.read(),{x:0,y:0,action:false,analog:{x:0,y:0}});
 keys.press('ArrowLeft');
 assert.equal(both.read().x,-1);
 keys.release('ArrowLeft');
 state.axes=[0.9,0];
 assert.equal(both.read().x,1,'the stick answers when the keyboard is quiet');
 state.buttons[1].pressed=true;
 assert.equal(both.read().action,true);
 both.clear();both.destroy();
 assert.throws(()=>combineInputs(),/at least one source/);
});
