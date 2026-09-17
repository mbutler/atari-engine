import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoices} from '../src/index.mjs';
const recorder=()=>{const writes=[];return {writes,set(channel,registers){writes.push([channel,{...registers}]);return this;},off(channel){writes.push([channel,'off']);return this;}};};
const steady=(control=4,frames=3)=>({control,frames,at:frame=>({frequency:frame,volume:9})});
test('an effect is written one frame at a time and then releases the channel',()=>{
 const sound=recorder(),voices=createVoices(sound);
 assert.equal(voices.play(steady()),0);
 assert.deepEqual(sound.writes,[],'nothing sounds until the loop steps');
 voices.step();voices.step();voices.step();
 assert.deepEqual(sound.writes,[[0,{control:4,frequency:0,volume:9}],[0,{control:4,frequency:1,volume:9}],[0,{control:4,frequency:2,volume:9}]]);
 assert.equal(voices.busy(0),true);
 voices.step();
 assert.deepEqual(sound.writes.at(-1),[0,'off']);
 assert.equal(voices.busy(0),false);
 voices.step();   // nothing left to do
 assert.equal(sound.writes.length,4);
});
test('a looping effect repeats instead of releasing',()=>{
 const sound=recorder(),voices=createVoices(sound);
 voices.play({control:14,frames:2,loop:true,at:frame=>({volume:frame})});
 for(let i=0;i<5;i++)voices.step();
 assert.deepEqual(sound.writes.map(([,w])=>w.volume),[0,1,0,1,0]);
 assert.equal(voices.busy(0),true);
 voices.stop(0);
 assert.deepEqual(sound.writes.at(-1),[0,'off']);
});
test('channels are handed out automatically and louder claims keep them',()=>{
 const sound=recorder(),voices=createVoices(sound);
 assert.equal(voices.play(steady(4,99)),0);
 assert.equal(voices.play(steady(8,99)),1);
 assert.deepEqual(voices.active,[0,1]);
 // Both busy and neither outranked: a quiet effect waits its turn.
 assert.equal(voices.play({control:4,frames:5,priority:-1,at:()=>({volume:2})}),null);
 // An explosion outranks a footstep and takes the weaker channel.
 assert.equal(voices.play({control:8,frames:5,priority:3,at:()=>({volume:15})}),0);
 voices.silence();
 assert.deepEqual(voices.active,[]);
});
test('a fixed effect can be written as a plain list of frames',()=>{
 const sound=recorder(),voices=createVoices(sound,{channels:[1]});
 assert.equal(voices.play([{control:4,frequency:6,volume:12},{volume:6},{volume:0}]),1);
 voices.step();voices.step();
 assert.deepEqual(sound.writes,[[1,{control:4,frequency:6,volume:12}],[1,{control:undefined,volume:6}]]);
});
test('effects that could not sound are refused when they are played',()=>{
 const voices=createVoices(recorder());
 assert.throws(()=>voices.play([]),/at least one frame/);
 assert.throws(()=>voices.play({frames:2,at:()=>({volume:1})}),/must set control/);
 assert.throws(()=>voices.play({control:4,frames:0,at:()=>({})}),/positive whole number/);
 assert.throws(()=>voices.play({control:4}),/list of frames/);
 assert.throws(()=>voices.play(steady(),{channel:7}),/not part of this voice set/);
 assert.throws(()=>createVoices(null),/needs a sound/);
});
